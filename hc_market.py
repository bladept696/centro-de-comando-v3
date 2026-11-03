# © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
# é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
# https://github.com/bladept696/centro-de-comando-v3
"""Mercado de hashrate, fase 2: o aluguer.

Protocolo (mensagens kind 4402 entre as duas apps, cifradas com NIP-44, tag "p" = destinatário):
  comprador -> vendedor  {"t":"req","sid","d","pool":{"host","port","user"},"minutes"}
  vendedor  -> comprador {"t":"acc","sid","period","sats"} | {"t":"rej","sid","why"}
  vendedor  -> comprador {"t":"inv","sid","n","pr","sats"}       (fatura adiantada de cada período)
  comprador -> vendedor  {"t":"paid","sid","n","preimage"}       (comprovativo: sha256(preimage) = payment_hash)
  qualquer um            {"t":"end","sid","why"}
O vendedor aponta as máquinas para a pool do comprador e repõe a pool original no fim ou se um pagamento falhar.
O comprador paga pela sua carteira (NWC, NIP-47) e deixa de pagar se o hashrate não aparecer na API da pool.
"""
import hashlib
import ipaddress
import json
import math
import socket
import re
import secrets
import threading
import time
import urllib.parse
import urllib.request

import websocket

import hc_nostr

MSG_KIND = 4402
SUPPORTED_POOLS = {   # só pools onde o comprador consegue confirmar o hashrate do worker
    "solo.ckpool.org": "ckpool", "eusolo.ckpool.org": "ckpool", "ausolo.ckpool.org": "ckpool",
    "public-pool.io": "public-pool",
}
WARMUP_PERIODS_MIN = 4          # minutos até a pool mostrar o hashrate (a máquina reinicia e a média demora)
PAY_GRACE_SECONDS = 100         # tempo para pagar uma fatura antes de o vendedor terminar
MIN_HASHRATE_RATIO = 0.4        # abaixo disto (2 leituras seguidas) o comprador termina
MINUTE = 60                     # segundos num minuto (os testes encurtam-no)


# ---------------------------------------------------------------- Lightning: bolt11 e LNURL
_B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
_MULT = {'m': 10 ** 8, 'u': 10 ** 5, 'n': 10 ** 2, 'p': 10 ** -1}


def bolt11_decode(pr):
    """Valor (msat), payment_hash, data e validade de uma fatura bolt11 (sem verificar a assinatura do nó)."""
    s = pr.strip().lower()
    if s.startswith('lightning:'):
        s = s[10:]
    pos = s.rfind('1')
    hrp, words = s[:pos], [_B32.index(c) for c in s[pos + 1:]]
    if hc_nostr._polymod(hc_nostr._hrp_exp(hrp) + words) != 1:
        raise ValueError("fatura com checksum inválido")
    m = re.fullmatch(r'ln(bc|tb|bcrt|tbs)(\d+)?([munp])?', hrp)
    if not m:
        raise ValueError("não é uma fatura Lightning")
    msat = None
    if m.group(2):
        # _MULT dá msat por unidade (1 BTC = 10^11 msat): 30n = 30 × 100 msat = 3 sats
        msat = (int(m.group(2)) * _MULT[m.group(3)] if m.group(3) != 'p' else int(m.group(2)) // 10) if m.group(3) else int(m.group(2)) * 10 ** 11
        msat = int(msat)
    data = words[:-6]
    ts = 0
    for w in data[:7]:
        ts = ts * 32 + w
    i, end, out = 7, len(data) - 104, {"msat": msat, "timestamp": ts, "expiry": 3600, "network": m.group(1)}
    while i < end:
        typ, ln = data[i], data[i + 1] * 32 + data[i + 2]
        val = data[i + 3:i + 3 + ln]
        if typ == 1 and ln == 52:
            out["payment_hash"] = bytes(hc_nostr._convertbits(val, 5, 8, False)).hex()
        elif typ == 6:
            e = 0
            for w in val:
                e = e * 32 + w
            out["expiry"] = e
        i += 3 + ln
    if "payment_hash" not in out:
        raise ValueError("fatura sem payment_hash")
    return out


def _http_json(url, timeout=12):
    req = urllib.request.Request(url, headers={"User-Agent": "HashCommander"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read(256 * 1024).decode('utf-8'))


def lnurl_invoice(lud16, sats, comment=""):
    """Pede ao endereço Lightning do vendedor uma fatura de `sats` (LUD-16 + LUD-06)."""
    user, domain = lud16.strip().split('@', 1)
    meta = _http_json(f"https://{domain}/.well-known/lnurlp/{urllib.parse.quote(user)}")
    if meta.get("tag") != "payRequest":
        raise RuntimeError("o endereço Lightning não aceita pagamentos")
    msat = int(sats) * 1000
    if not int(meta.get("minSendable", 1000)) <= msat <= int(meta.get("maxSendable", 10 ** 12)):
        raise RuntimeError(f"o endereço Lightning não aceita {sats} sats")
    cb = meta["callback"]
    q = {"amount": str(msat)}
    if comment and int(meta.get("commentAllowed", 0) or 0) >= len(comment):
        q["comment"] = comment
    r = _http_json(cb + ("&" if "?" in cb else "?") + urllib.parse.urlencode(q))
    pr = r.get("pr")
    if not pr:
        raise RuntimeError(r.get("reason") or "o endereço Lightning não devolveu fatura")
    dec = bolt11_decode(pr)
    if dec["msat"] != msat:
        raise RuntimeError("a fatura não tem o valor pedido")
    return pr, dec


# ---------------------------------------------------------------- NWC (NIP-47): a carteira do comprador
class NWC:
    def __init__(self, uri):
        u = urllib.parse.urlparse(uri.strip())
        if u.scheme not in ("nostr+walletconnect", "nostrwalletconnect"):
            raise ValueError("isto não é um código NWC (começa por nostr+walletconnect://)")
        q = urllib.parse.parse_qs(u.query)
        self.wallet = (u.netloc or u.path).strip('/').lower()
        self.relays = q.get("relay") or []
        self.secret = bytes.fromhex((q.get("secret") or [""])[0])
        if not re.fullmatch(r'[0-9a-f]{64}', self.wallet) or len(self.secret) != 32 or not self.relays:
            raise ValueError("código NWC incompleto (falta a carteira, o relay ou o segredo)")
        self.pub = hc_nostr.pubkey_of(self.secret).hex()
        self._nip44 = None

    def _uses_nip44(self):
        if self._nip44 is None:
            info = hc_nostr.query([{"kinds": [13194], "authors": [self.wallet], "limit": 1}], self.relays, timeout=8)
            enc = " ".join(t[1] for e in info for t in e["tags"] if t and t[0] == "encryption" and len(t) > 1)
            self._nip44 = "nip44_v2" in enc
        return self._nip44

    def request(self, method, params=None, timeout=45):
        nip44 = self._uses_nip44()
        body = json.dumps({"method": method, "params": params or {}})
        if nip44:
            content = hc_nostr.nip44_encrypt(body, hc_nostr.nip44_conversation_key(self.secret, self.wallet))
            tags = [["p", self.wallet], ["encryption", "nip44_v2"]]
        else:
            content = hc_nostr.nip04_encrypt(body, self.secret, self.wallet)
            tags = [["p", self.wallet]]
        ev = hc_nostr.sign_event(self.secret, 23194, content, tags)
        ws = hc_nostr._connect(self.relays[0], 10)
        try:
            sub = secrets.token_hex(6)
            ws.send(json.dumps(["REQ", sub, {"kinds": [23195], "authors": [self.wallet], "#e": [ev["id"]]}]))
            ws.send(json.dumps(["EVENT", ev]))
            end = time.time() + timeout
            ws.settimeout(5)
            while time.time() < end:
                try:
                    msg = json.loads(ws.recv())
                except websocket.WebSocketTimeoutException:
                    continue
                if msg[0] == "EVENT" and msg[1] == sub and hc_nostr.verify_event(msg[2]):
                    c = msg[2]["content"]
                    try:
                        txt = hc_nostr.nip44_decrypt(c, hc_nostr.nip44_conversation_key(self.secret, self.wallet)) if "?iv=" not in c else hc_nostr.nip04_decrypt(c, self.secret, self.wallet)
                    except Exception:
                        txt = hc_nostr.nip04_decrypt(c, self.secret, self.wallet)
                    r = json.loads(txt)
                    if r.get("error"):
                        raise RuntimeError(f"carteira: {r['error'].get('message') or r['error'].get('code')}")
                    return r.get("result") or {}
            raise RuntimeError("a carteira não respondeu a tempo")
        finally:
            ws.close()

    def pay_invoice(self, pr):
        return self.request("pay_invoice", {"invoice": pr}).get("preimage", "")

    def info(self):
        try:
            return self.request("get_info", timeout=20)
        except RuntimeError:
            return {}

    def balance_sats(self):
        return int(self.request("get_balance", timeout=20).get("balance", 0)) // 1000


# ---------------------------------------------------------------- hashrate do worker na pool (o comprador confirma)
_SUFFIX = {"": 1, "K": 1e3, "M": 1e6, "G": 1e9, "T": 1e12, "P": 1e15, "E": 1e18}


def _hs(v):
    if isinstance(v, (int, float)):
        return float(v)
    m = re.fullmatch(r'\s*([\d.]+)\s*([KMGTPE]?)', str(v or ''), re.I)
    return float(m.group(1)) * _SUFFIX[m.group(2).upper()] if m else 0.0


def pool_worker_ths(host, address, worker, base_url=None):
    """TH/s que a pool está a ver no worker `endereço.worker` (None se a pool não o mostrar)."""
    kind = SUPPORTED_POOLS.get(host)
    if kind == "ckpool":
        d = _http_json((base_url or f"https://{host}") + f"/users/{address}")
        for w in d.get("worker", []):
            if str(w.get("workername", "")).endswith("." + worker):
                return _hs(w.get("hashrate1m")) / 1e12
        return 0.0
    if kind == "public-pool":
        d = _http_json((base_url or "https://public-pool.io:40557") + f"/api/client/{address}")
        return sum(float(w.get("hashRate") or 0) for w in d.get("workers", []) if w.get("name") == worker) / 1e12
    return None


# ---------------------------------------------------------------- validação de qualquer pool
_HOST_RE = re.compile(r'[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+')
_LOCAL_SUFFIXES = ('.local', '.lan', '.home', '.internal', '.localdomain', '.home.arpa')


def normalize_pool_host(host):
    h = str(host or '').strip().lower()
    h = re.sub(r'^stratum\d?\+(tcp|ssl|tls)://', '', h)
    return h.split('/')[0]


def _ip_bad(ip):
    a = ipaddress.ip_address(ip)
    return a.is_private or a.is_loopback or a.is_link_local or a.is_reserved or a.is_multicast or a.is_unspecified


def pool_problem(host, port, user, password="x", resolve=False):
    """Motivo para recusar a pool, ou None. Aceita qualquer pool pública; recusa endereços da rede de casa."""
    try:
        port = int(port)
    except (TypeError, ValueError):
        return "porta da pool inválida"
    if not 1 <= port <= 65535:
        return "porta da pool inválida"
    if not re.fullmatch(r'[A-Za-z0-9._@+:\-]{1,128}', str(user or '')):
        return "utilizador da pool inválido"
    if not re.fullmatch(r'[\x21-\x7e]{1,64}', str(password or '')):
        return "palavra-passe da pool inválida"
    try:
        if _ip_bad(host):
            return "a pool não pode ser um endereço da rede de casa"
        is_ip = True
    except ValueError:
        is_ip = False
    if not is_ip:
        if host == 'localhost' or host.endswith(_LOCAL_SUFFIXES) or not _HOST_RE.fullmatch(host or ''):
            return "endereço da pool inválido"
        if resolve:
            try:
                ips = {i[4][0] for i in socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)}
            except OSError:
                return "o endereço da pool não existe"
            if any(_ip_bad(ip) for ip in ips):
                return "a pool aponta para um endereço da rede de casa"
    return None


# ---------------------------------------------------------------- motor do aluguer (vendedor e comprador)
def billing(ths, rate):
    """Período de faturação (min) e sats por fatura. O Lightning não paga frações de sat: escolhe-se o período
    mais curto com pelo menos 1 sat e erro de arredondamento até 10% (no máximo 60 min — com valores destes o
    risco de pagar adiantado é de poucos sats)."""
    per_min = max(1e-9, ths * rate)
    first = max(1, math.ceil(1 / per_min))
    for p in range(first, 61):
        v = per_min * p
        if abs(round(v) - v) / v <= 0.10:
            return p, max(1, round(v))
    p = min(60, first)
    return p, max(1, round(per_min * p))


class Market:
    """Corre numa thread: lê as mensagens de 3 em 3 s, gere os alugueres como vendedor e como comprador.

    hooks (dados pela app): seckey(), relays(), offer() -> oferta ativa ou None, machines_for_offer() -> [ip],
    snapshot(ip) -> dict, switch(ip, host, port, user) -> (ok, msg), restore(ip, snap), nwc() -> NWC ou None,
    save_state(dict), load_state() -> dict, notify(titulo, texto), pool_ths(host, address, worker) -> float|None
    """

    def __init__(self, hooks):
        self.h = hooks
        self.lock = threading.Lock()
        st = hooks["load_state"]() or {}
        self.sessions = st.get("sessions", {})
        self.history = st.get("history", [])
        self.seen = set()
        # ponto de leitura guardado: ao arrancar não se voltam a ler mensagens antigas
        self.since = max(int(st.get("since") or 0), int(time.time()) - 120)
        self.done = set(st.get("done") or [])
        self.started = int(time.time())
        self._stop = False

    # -- estado
    def _save(self):
        live = {k: v for k, v in self.sessions.items() if v.get("state") not in ("ended",)}
        self.h["save_state"]({"sessions": live, "history": self.history[-100:], "since": self.since, "done": sorted(self.done)[-500:]})

    def public(self):
        with self.lock:
            return {"sessions": [dict({k: v for k, v in s.items() if k not in ("snaps", "pending_preimages")}, sid=sid) for sid, s in self.sessions.items()],
                    "history": list(reversed(self.history[-30:]))}

    def _log(self, s, txt):
        s.setdefault("log", []).append([int(time.time()), txt])
        s["log"] = s["log"][-40:]

    # -- mensagens
    def _send(self, peer, obj):
        sk = self.h["seckey"]()
        conv = hc_nostr.nip44_conversation_key(sk, peer)
        ev = hc_nostr.sign_event(sk, MSG_KIND, hc_nostr.nip44_encrypt(json.dumps(obj), conv), [["p", peer]])
        hc_nostr.publish(ev, self.h["relays"]())

    def _inbox(self):
        sk = self.h["seckey"]()
        me = hc_nostr.pubkey_of(sk).hex()
        evs = hc_nostr.query([{"kinds": [MSG_KIND], "#p": [me], "since": self.since - 10}], self.h["relays"](), timeout=6)
        out = []
        for ev in sorted(evs, key=lambda e: e["created_at"]):
            if ev["id"] in self.seen:
                continue
            self.seen.add(ev["id"])
            self.since = max(self.since, ev["created_at"])
            try:
                out.append((ev["pubkey"], json.loads(hc_nostr.nip44_decrypt(ev["content"], hc_nostr.nip44_conversation_key(sk, ev["pubkey"]))), ev["created_at"]))
            except Exception:
                continue
        return out

    # -- comprador: começar
    def rent(self, offer, minutes, host, port, address=None, user=None, password="x"):
        """Pool conhecida (SUPPORTED_POOLS): utilizador = endereço.worker e o hashrate é confirmado na pool.
        Qualquer outra pool: o comprador dá o utilizador completo e paga sem confirmação do hashrate."""
        host = normalize_pool_host(host)
        if not 1 <= minutes <= int(offer["max_min"]):
            raise ValueError("duração fora do permitido pela oferta")
        if not self.h["nwc"]():
            raise ValueError("liga primeiro a tua carteira (NWC)")
        sid = secrets.token_hex(6)
        worker = "hcr" + sid
        verify = host in SUPPORTED_POOLS
        if verify:
            if not re.fullmatch(r'(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})', address or '', re.I):
                raise ValueError("endereço Bitcoin inválido")
            user = f"{address}.{worker}"
        password = password or "x"
        why = pool_problem(host, port, user, password)
        if why:
            raise ValueError(why)
        period, sats = billing(offer["ths"], offer["rate"])
        s = {"role": "buyer", "peer": offer["pubkey"], "d": offer["d"], "ths": offer["ths"], "rate": offer["rate"], "minutes": minutes,
             "pool": {"host": host, "port": int(port), "user": user, "pass": password}, "address": address, "worker": worker,
             "verify": verify, "state": "requested", "created": int(time.time()), "paid_sats": 0, "period": period, "sats_per": sats,
             "budget": sats * math.ceil(minutes / period) + 2, "seen_ths": None, "low": 0}
        self._log(s, "pedido enviado ao vendedor" + ("" if verify else " (pool sem confirmação do hashrate)"))
        with self.lock:
            self.sessions[sid] = s
            self._save()
        self._send(offer["pubkey"], {"t": "req", "sid": sid, "d": offer["d"], "pool": s["pool"], "minutes": minutes})
        return sid

    def stop(self, sid, why="parado por ti"):
        with self.lock:
            s = self.sessions.get(sid)
        if s and s["state"] not in ("ended",):
            self._end(sid, s, why, notify_peer=True)

    # -- fim (os dois lados)
    def _end(self, sid, s, why, notify_peer):
        if s["role"] == "seller":
            for ip, snap in (s.get("snaps") or {}).items():
                try:
                    self.h["restore"](ip, snap)
                except Exception as e:
                    self._log(s, f"falha a repor a pool de uma máquina: {e}")
            self._log(s, "pool original reposta nas máquinas")
        if notify_peer:
            try:
                self._send(s["peer"], {"t": "end", "sid": sid, "why": why})
            except Exception:
                pass
        s["state"], s["ended"], s["why"] = "ended", int(time.time()), why
        self.done.add(sid)
        self._log(s, f"terminado: {why}")
        with self.lock:
            self.history.append({k: s.get(k) for k in ("role", "peer", "ths", "rate", "minutes", "paid_sats", "created", "ended", "why")})
            self.sessions.pop(sid, None)
            self._save()
        try:
            self.h["notify"]("Aluguer de hashrate terminado", f"{'Recebeste' if s['role'] == 'seller' else 'Pagaste'} {s.get('paid_sats', 0)} sats · {why}")
        except Exception:
            pass

    # -- vendedor: pedido novo
    def _on_req(self, peer, m):
        sid = str(m.get("sid", ""))[:20]
        offer = self.h["offer"]()
        pool = dict(m.get("pool") or {})
        pool["host"], pool["pass"] = normalize_pool_host(pool.get("host")), str(pool.get("pass") or "x")
        why = None
        if not offer or offer.get("d") != m.get("d"):
            why = "oferta já não está ativa"
        elif any(s["role"] == "seller" for s in self.sessions.values()):
            why = "as máquinas já estão alugadas"
        elif not 1 <= int(m.get("minutes") or 0) <= int(offer["max_min"]):
            why = "duração fora do permitido"
        else:
            # qualquer pool serve, mas nunca um endereço da rede de casa (o nome também é resolvido e verificado)
            why = pool_problem(pool["host"], pool.get("port"), pool.get("user"), pool["pass"], resolve=True)
        if why:
            self._send(peer, {"t": "rej", "sid": sid, "why": why})
            return
        ips = self.h["machines_for_offer"]()
        period, sats = billing(offer["ths"], offer["rate"])
        s = {"role": "seller", "peer": peer, "d": offer["d"], "ths": offer["ths"], "rate": offer["rate"], "minutes": int(m["minutes"]),
             "pool": {"host": pool["host"], "port": int(pool["port"]), "user": pool["user"], "pass": pool["pass"]}, "state": "starting", "created": int(time.time()),
             "paid_sats": 0, "period": period, "sats_per": sats, "snaps": {}, "invoices": {}, "lud16": offer["lud16"]}
        for ip in ips:
            s["snaps"][ip] = self.h["snapshot"](ip)
        with self.lock:
            self.sessions[sid] = s
            self._save()      # guarda a pool original ANTES de mexer nas máquinas (se a app fechar, repõe ao arrancar)
        for ip in ips:
            ok, msg = self.h["switch"](ip, pool["host"], int(pool["port"]), pool["user"], pool["pass"])
            self._log(s, f"máquina apontada para a pool do comprador" if ok else f"falha ao mudar a pool: {msg}")
        s["state"], s["start"] = "running", int(time.time())
        self._log(s, f"aluguer aceite: {s['minutes']} min, fatura de {sats} sats a cada {period} min")
        self._send(peer, {"t": "acc", "sid": sid, "period": period, "sats": sats})
        self._invoice(sid, s, 0)

    def _invoice(self, sid, s, n):
        try:
            pr, dec = lnurl_invoice(s["lud16"], s["sats_per"], f"Hash Commander aluguer {sid} #{n}")
        except Exception as e:
            self._log(s, f"não foi possível criar a fatura: {e}")
            self._end(sid, s, "o endereço Lightning do vendedor falhou", True)
            return
        s["invoices"][str(n)] = {"hash": dec["payment_hash"], "at": int(time.time()), "paid": False}
        self._send(s["peer"], {"t": "inv", "sid": sid, "n": n, "pr": pr, "sats": s["sats_per"]})
        self._log(s, f"fatura #{n} enviada ({s['sats_per']} sats)")

    # -- comprador: fatura chegou
    def _on_inv(self, sid, s, m):
        try:
            dec = bolt11_decode(m["pr"])
        except Exception:
            self._end(sid, s, "fatura inválida do vendedor", True)
            return
        sats = (dec["msat"] or 0) // 1000
        if sats != s["sats_per"] or s["paid_sats"] + sats > s["budget"]:
            self._end(sid, s, f"o vendedor pediu {sats} sats, fora do combinado", True)
            return
        try:
            pre = self.h["nwc"]().pay_invoice(m["pr"])
        except Exception as e:
            self._end(sid, s, f"pagamento falhou: {e}", True)
            return
        if hashlib.sha256(bytes.fromhex(pre)).hexdigest() != dec["payment_hash"]:
            self._end(sid, s, "a carteira devolveu um comprovativo errado", True)
            return
        s["paid_sats"] += sats
        self._log(s, f"pagaste a fatura #{m.get('n')} ({sats} sats)")
        self._send(s["peer"], {"t": "paid", "sid": sid, "n": m.get("n"), "preimage": pre})

    # -- vendedor: pagamento chegou
    def _on_paid(self, sid, s, m):
        inv = s["invoices"].get(str(m.get("n")))
        try:
            ok = inv and hashlib.sha256(bytes.fromhex(m.get("preimage", ""))).hexdigest() == inv["hash"]
        except ValueError:
            ok = False
        if ok and not inv["paid"]:
            inv["paid"] = True
            s["paid_sats"] += s["sats_per"]
            self._log(s, f"recebeste a fatura #{m.get('n')} ({s['sats_per']} sats) ✓")

    # -- relógio de cada aluguer
    def _tick(self, sid, s):
        now = time.time()
        if s["role"] == "seller" and s["state"] == "running":
            elapsed = now - s["start"]
            for n, inv in s["invoices"].items():
                if not inv["paid"] and now - inv["at"] > PAY_GRACE_SECONDS:
                    self._end(sid, s, "pagamento em falta", True)
                    return
            if elapsed >= s["minutes"] * MINUTE:
                self._end(sid, s, "terminou o tempo combinado", True)
                return
            n = int(elapsed // (s["period"] * MINUTE))
            if str(n) not in s["invoices"] and n * s["period"] < s["minutes"]:
                self._invoice(sid, s, n)
        elif s["role"] == "buyer":
            if s["state"] == "requested" and now - s["created"] > 1.5 * MINUTE:
                self._end(sid, s, "o vendedor não respondeu", False)
                return
            if s["state"] == "running":
                if now - s["start"] > s["minutes"] * MINUTE + 2 * MINUTE:
                    self._end(sid, s, "terminou o tempo combinado", False)
                    return
                if now - s.get("checked", 0) >= MINUTE and now - s["start"] >= WARMUP_PERIODS_MIN * MINUTE:
                    s["checked"] = now
                    try:
                        v = self.h["pool_ths"](s["pool"]["host"], s["address"], s["worker"])
                    except Exception:
                        v = None
                    if v is not None:
                        s["seen_ths"] = round(v, 3)
                        s["low"] = s["low"] + 1 if v < s["ths"] * MIN_HASHRATE_RATIO else 0
                        if s["low"] >= 2:
                            self._end(sid, s, "o hashrate não está a chegar à tua pool", True)

    # -- ciclo principal
    def step(self):
        for peer, m, created in self._inbox():
            t, sid = m.get("t"), str(m.get("sid", ""))
            if sid in self.done:
                continue        # aluguer já terminado: mensagens atrasadas ou repetidas não fazem nada
            with self.lock:
                s = self.sessions.get(sid)
            try:
                # só pedidos recentes e feitos depois de a app arrancar (nunca se repete um aluguer antigo)
                if t == "req" and not s and time.time() - created < 60 and created >= self.started - 2:
                    self._on_req(peer, m)
                elif s and s["peer"] == peer:
                    if t == "acc" and s["role"] == "buyer":
                        s["state"], s["start"] = "running", int(time.time())
                        self._log(s, f"o vendedor aceitou: fatura de {m.get('sats')} sats a cada {m.get('period')} min")
                    elif t == "rej" and s["role"] == "buyer":
                        self._end(sid, s, f"recusado: {m.get('why')}", False)
                    elif t == "inv" and s["role"] == "buyer" and s["state"] in ("requested", "running"):
                        if s["state"] == "requested":   # a fatura pode chegar no mesmo segundo que o "aceite"
                            s["state"], s["start"] = "running", int(time.time())
                        self._on_inv(sid, s, m)
                    elif t == "paid" and s["role"] == "seller":
                        self._on_paid(sid, s, m)
                    elif t == "end":
                        self._end(sid, s, f"o outro lado terminou: {m.get('why')}", False)
            except Exception as e:
                if s:
                    self._log(s, f"erro: {e}")
        with self.lock:
            items = list(self.sessions.items())
        for sid, s in items:
            try:
                self._tick(sid, s)
            except Exception as e:
                self._log(s, f"erro: {e}")
        with self.lock:
            self._save()

    def recover(self):
        """Ao arrancar: um aluguer como vendedor que ficou a meio (app fechada) é terminado e a pool reposta."""
        with self.lock:
            items = list(self.sessions.items())
        for sid, s in items:
            if s["role"] == "seller":
                self._end(sid, s, "a app do vendedor foi fechada a meio", True)
            elif s["role"] == "buyer":
                self._end(sid, s, "a tua app foi fechada a meio", True)

    def run(self):
        self.recover()
        while not self._stop:
            try:
                busy = bool(self.sessions)
                if busy or self.h["offer"]():
                    self.step()
                time.sleep(3 if busy else 15)
            except Exception as e:
                print(f"[market] {e}", flush=True)
                time.sleep(10)
