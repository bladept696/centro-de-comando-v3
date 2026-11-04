# © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
# é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
# https://github.com/bladept696/centro-de-comando-v3
"""Aba "Hash Commander OS": o firmware próprio para a NerdQAxe++ (repositório público bladept696/hash-commander-os).

A máquina com HC OS responde em /api/hc/info, empurra os dados por WebSocket em /api/hc/live (estado de segundo a
segundo e cada share) e guarda as últimas shares em /api/hc/shares. Este módulo:
  * vê que firmware tem cada máquina (scan) e mantém uma ligação ao vivo às que têm HC OS enquanto a aba está aberta;
  * vai buscar a versão mais recente ao GitHub e só a aceita com a assinatura Ed25519 das atualizações da app;
  * instala pela rede (o mesmo POST /api/system/OTA do AxeOS), uma máquina de cada vez, e confirma que volta a minerar.
    Se não voltar, pede à máquina para regressar ao firmware anterior.
"""
import hashlib
import http.client
import json
import re
import os
import threading
import time
import urllib.request
from collections import deque

import websocket

REPO = "bladept696/hash-commander-os"
BOARD = "NerdQAxe++"                 # o único modelo para que há firmware
MIN_BASE = (1, 1, 0)                 # firmware oficial mais antigo de onde se pode passar direto (as definições mudaram na 1.1)
ASSET_PREFIX = "hcos-NerdQAxe++-"
WWW_PREFIX = "hcos-www-"           # página da máquina (AxeOS) da mesma versão: vai antes do firmware, como no oficial
RELEASE_CACHE_S = 600
LIVE_IDLE_S = 60                     # sem pedidos da aba durante 1 min: a ligação ao vivo fecha (a máquina só aceita 3)
BOOT_WAIT_S = 150                    # tempo para a máquina reiniciar depois de receber o firmware
MINING_WAIT_S = 420                  # a proteção do firmware só dá o arranque como bom ao fim de 3 min a minerar

UA = {"User-Agent": "HashCommander"}


def _get_json(url, timeout=4):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return json.loads(r.read(512 * 1024).decode("utf-8"))


def _post(ip, path, otp="", timeout=8):
    c = http.client.HTTPConnection(ip, timeout=timeout)
    h = dict(UA, **({"X-TOTP": otp} if otp else {}))
    c.request("POST", path, body=b"", headers=dict(h, **{"Content-Length": "0"}))
    r = c.getresponse()
    body = r.read(4096).decode("utf-8", "replace")
    c.close()
    return r.status, body


def version_tuple(v):
    """'v1.0.37.4-LTS' -> (1, 0, 37); '' ou estranho -> None"""
    m = re.match(r'v?(\d+)\.(\d+)\.(\d+)', str(v or '').strip())
    return tuple(int(x) for x in m.groups()) if m else None


def too_old(info):
    """True quando a máquina tem um AxeOS oficial anterior à 1.1.0 (o HC OS é feito sobre a 1.1.1)"""
    if not info or info.get("hcos"):
        return False
    t = version_tuple(info.get("version"))
    return bool(t) and t < MIN_BASE


def why_not_mining(ip):
    """Frase curta com o estado da máquina quando o HC OS não chega a minerar (para se saber a causa)."""
    try:
        d = _get_json(f"http://{ip}/api/v2/dashboard", timeout=4)
    except Exception:
        return "a máquina não responde"
    perf, pools = d.get("performance") or {}, (d.get("stratum") or {}).get("pools") or []
    up = (d.get("system") or {}).get("uptime")
    bits = [f"hashrate {float(perf.get('hashRate') or 0):.0f} GH/s",
            "pool ligada" if any(p.get("connected") for p in pools) else "pool desligada",
            f"{int(perf.get('sharesAccepted') or 0)} shares"]
    if up is not None:
        bits.append(f"ligada há {int(up) // 60} min")
    return ", ".join(bits)


def probe(ip):
    """Modelo, versão e (se tiver) o estado do HC OS de uma máquina. None se não responder."""
    try:
        info = _get_json(f"http://{ip}/api/system/info", timeout=3)
    except Exception:
        return None
    out = {"ip": ip, "model": info.get("deviceModel") or info.get("ASICModel") or "", "version": info.get("version") or "",
           "hostname": info.get("hostname") or "", "hcos": None, "otp": bool(info.get("otp")),
           "hashRate": float(info.get("hashRate") or 0)}
    try:
        hc = _get_json(f"http://{ip}/api/hc/info", timeout=3)
        if hc.get("hcos"):
            out["hcos"] = hc
    except Exception:
        pass
    # o HC OS 0.1.0 tinha as rotas /api/hc tapadas: reconhece-se pela versão ("v1.1.1-hcos0.1.0")
    m = re.search(r'-hcos(\d+\.\d+\.\d+)', out["version"])
    if not out["hcos"] and m:
        out["hcos"] = {"hcos": m.group(1), "partial": True, "bootGuard": {"mining": out["hashRate"] > 0}, "shareLog": {}}
    return out


class HcOs:
    """hooks: allowed(ip) -> bool, verify(digest, sig_hex) -> bool, cache_dir() -> pasta, backup(ip, info_dict)"""

    def __init__(self, hooks):
        self.h = hooks
        self.lock = threading.Lock()
        self.live = {}          # ip -> {"state", "shares": deque, "ws", "connected", "want"}
        self.jobs = {}          # ip -> estado da instalação
        self.queue = deque()
        self.release = None
        self.release_at = 0
        self._runner = None
        threading.Thread(target=self._live_keeper, daemon=True).start()

    # ------------------------------------------------------------ versão disponível
    def latest(self, force=False):
        if self.release and not force and time.time() - self.release_at < RELEASE_CACHE_S:
            return self.release
        try:
            rels = _get_json(f"https://api.github.com/repos/{REPO}/releases?per_page=10", timeout=8)
        except Exception as e:
            return self.release or {"ok": False, "error": f"não foi possível ver as versões no GitHub ({e})"}
        for r in rels:
            if r.get("draft") or not str(r.get("tag_name", "")).startswith("hcos-v"):
                continue
            assets = {a["name"]: a for a in r.get("assets", [])}
            pick = lambda pre: next((a for n, a in assets.items() if n.startswith(pre) and n.endswith(".bin") and n + ".sig" in assets), None)
            fw, www = pick(ASSET_PREFIX), pick(WWW_PREFIX)
            if fw and www:
                f = lambda a: {"name": a["name"], "size": a["size"], "url": a["browser_download_url"], "sig_url": assets[a["name"] + ".sig"]["browser_download_url"]}
                self.release = {"ok": True, "tag": r["tag_name"], "version": r["tag_name"][len("hcos-v"):], "fw": f(fw), "www": f(www),
                                "published": r.get("published_at")}
                self.release_at = time.time()
                return self.release
        self.release = {"ok": False, "error": "ainda não há nenhuma versão assinada publicada"}
        self.release_at = time.time()
        return self.release

    def _download(self, a):
        """Descarrega um ficheiro da versão (uma vez, fica na pasta da app) e só o devolve com a assinatura válida."""
        path = os.path.join(self.h["cache_dir"](), a["name"])
        with urllib.request.urlopen(urllib.request.Request(a["sig_url"], headers=UA), timeout=20) as r:
            sig = r.read(1024).decode("ascii", "replace").strip()
        if not os.path.exists(path) or os.path.getsize(path) != a["size"]:
            with urllib.request.urlopen(urllib.request.Request(a["url"], headers=UA), timeout=90) as r:
                data = r.read(8 * 1024 * 1024)
            with open(path + ".tmp", "wb") as f:
                f.write(data)
            os.replace(path + ".tmp", path)
        with open(path, "rb") as f:
            data = f.read()
        if not self.h["verify"](hashlib.sha256(data).digest(), sig):
            os.remove(path)
            raise RuntimeError(f"{a['name']} não tem uma assinatura válida: nada foi instalado")
        return data

    def _firmware(self):
        """(versão, página da máquina, firmware), já verificados."""
        rel = self.latest()
        if not rel.get("ok"):
            raise RuntimeError(rel.get("error"))
        return rel, self._download(rel["www"]), self._download(rel["fw"])

    def _upload(self, ip, path, data, otp, p0, p1):
        """Envia um ficheiro para a máquina; a barra vai de p0 a p1 %."""
        c = http.client.HTTPConnection(ip, timeout=90)
        c.putrequest("POST", path)
        c.putheader("Content-Type", "application/octet-stream")
        c.putheader("Content-Length", str(len(data)))
        c.putheader("User-Agent", "HashCommander")
        if otp:
            c.putheader("X-TOTP", otp)
        c.endheaders()
        sent = 0
        for i in range(0, len(data), 16384):
            chunk = data[i:i + 16384]
            c.send(chunk)
            sent += len(chunk)
            self._set(ip, progress=round(p0 + (p1 - p0) * sent / len(data)))
        r = c.getresponse()
        body = r.read(2048).decode("utf-8", "replace")
        c.close()
        if r.status != 200:
            raise RuntimeError("a máquina pediu o código OTP" if r.status == 401 else f"a máquina recusou o ficheiro ({r.status}: {body.strip()[:80]})")

    # ------------------------------------------------------------ ao vivo
    def want_live(self, ips):
        now = time.time()
        with self.lock:
            for ip in ips:
                if self.h["allowed"](ip):
                    self.live.setdefault(ip, {"state": None, "shares": deque(maxlen=60), "ws": None, "connected": False, "want": 0})["want"] = now

    def live_view(self):
        with self.lock:
            return {ip: {"connected": v["connected"], "state": v["state"], "shares": list(v["shares"])[-30:]}
                    for ip, v in self.live.items() if time.time() - v["want"] < LIVE_IDLE_S}

    def _live_keeper(self):
        while True:
            with self.lock:
                items = list(self.live.items())
            for ip, v in items:
                wanted = time.time() - v["want"] < LIVE_IDLE_S
                if wanted and not v["ws"]:
                    self._connect(ip, v)
                elif not wanted and v["ws"]:
                    try:
                        v["ws"].close()
                    except Exception:
                        pass
            time.sleep(2)

    def _connect(self, ip, v):
        def on_msg(_ws, msg):
            try:
                m = json.loads(msg)
            except Exception:
                return
            with self.lock:
                if m.get("t") == "state":
                    m["at"] = time.time()
                    v["state"] = m
                elif m.get("t") == "share":
                    v["shares"].append(m)

        def on_open(_ws):
            v["connected"] = True

        def run():
            try:
                ws.run_forever(ping_interval=20, ping_timeout=10)
            finally:
                v["connected"], v["ws"] = False, None

        ws = websocket.WebSocketApp(f"ws://{ip}/api/hc/live", on_message=on_msg, on_open=on_open, header=["User-Agent: HashCommander"])
        v["ws"] = ws
        threading.Thread(target=run, daemon=True).start()

    # ------------------------------------------------------------ registo de shares
    def shares(self, ip, since=0, limit=200):
        return _get_json(f"http://{ip}/api/hc/shares?since={int(since)}&limit={int(limit)}", timeout=6)

    # ------------------------------------------------------------ instalar / voltar atrás
    def install(self, ips, otp=""):
        """Põe as máquinas na fila; são instaladas uma de cada vez pela ordem dada."""
        added = []
        with self.lock:
            for ip in ips:
                j = self.jobs.get(ip)
                if j and j["state"] not in ("done", "failed", "rolled_back"):
                    continue
                self.jobs[ip] = {"ip": ip, "state": "queued", "step": "na fila", "progress": 0, "started": time.time(), "otp": otp}
                self.queue.append(ip)
                added.append(ip)
            if not self._runner or not self._runner.is_alive():
                self._runner = threading.Thread(target=self._run_queue, daemon=True)
                self._runner.start()
        return added

    def jobs_view(self):
        with self.lock:
            return [{k: v for k, v in j.items() if k != "otp"} for j in self.jobs.values()]

    def _set(self, ip, **kw):
        with self.lock:
            self.jobs[ip].update(kw)

    def _run_queue(self):
        while True:
            with self.lock:
                if not self.queue:
                    return
                ip = self.queue.popleft()
            try:
                ok = self._install_one(ip)
            except Exception as e:
                self._set(ip, state="failed", step=f"falhou: {e}")
                ok = False
            if not ok:
                # "atualizar todas": pára na primeira que falhar, as outras ficam como estavam
                with self.lock:
                    for other in self.queue:
                        self.jobs[other].update(state="failed", step="não instalada porque a anterior falhou")
                    self.queue.clear()
                return

    def _install_one(self, ip):
        job = self.jobs[ip]
        otp = job.get("otp") or ""
        self._set(ip, state="checking", step="a confirmar o modelo")
        if not self.h["allowed"](ip):
            raise RuntimeError("esta máquina não está na lista do painel")
        p = probe(ip)
        if not p:
            raise RuntimeError("a máquina não respondeu")
        if p["model"] != BOARD:
            raise RuntimeError(f"só há HC OS para a {BOARD} (esta é {p['model'] or 'desconhecida'})")
        if too_old(p):
            raise RuntimeError(f"a máquina tem o AxeOS {p['version']}, anterior à v1.1.0: atualiza primeiro para o firmware "
                               "oficial v1.1.1 (AxeOS › Update › Install from GitHub) e confirma que mina; depois instala o HC OS")
        try:
            self.h["backup"](ip, _get_json(f"http://{ip}/api/system/info", timeout=4))
        except Exception:
            pass
        self._set(ip, state="download", step="a descarregar e verificar o firmware", model=p["model"], before=p["version"])
        rel, www, fw = self._firmware()
        self._set(ip, state="upload", step="a enviar a página da máquina (AxeOS)", version=rel["version"], size=len(www) + len(fw))
        self._upload(ip, "/api/system/OTAWWW", www, otp, 0, 45)
        self._set(ip, step="a enviar o firmware")
        self._upload(ip, "/api/system/OTA", fw, otp, 45, 100)

        self._set(ip, state="rebooting", step="a reiniciar a máquina", progress=100)
        t0, info = time.time(), None
        time.sleep(8)
        while time.time() - t0 < BOOT_WAIT_S:
            info = probe(ip)
            if info and info.get("hcos"):
                break
            time.sleep(4)
        if not info or not info.get("hcos"):
            self._set(ip, state="failed", step="a máquina não voltou com o HC OS. Se continuar sem responder, ela volta sozinha ao firmware anterior depois de 3 arranques falhados.")
            return False

        self._set(ip, state="mining_check", step="a confirmar que volta a minerar")
        last_up, reboots, state_txt = None, 0, ""
        while time.time() - t0 < BOOT_WAIT_S + MINING_WAIT_S:
            info = probe(ip)
            state_txt = why_not_mining(ip)
            m = re.search(r'ligada há (\d+) min', state_txt)
            if m:
                up = int(m.group(1))
                if last_up is not None and up < last_up:
                    reboots += 1
                last_up = up
            self._set(ip, detail=state_txt + (f", reiniciou {reboots}x" if reboots else ""))
            if info and info.get("hcos") and (info["hcos"].get("bootGuard") or {}).get("mining"):
                self._set(ip, state="done", step=f"HC OS {info['hcos']['hcos']} instalado e a minerar", after=info["version"], finished=time.time())
                return True
            time.sleep(10)
        st, _ = self.rollback(ip, otp)
        self._set(ip, state="rolled_back" if st == 200 else "failed",
                  step=("não voltou a minerar: regressou ao firmware anterior" if st == 200 else "não voltou a minerar e não foi possível voltar atrás sozinha")
                  + (f" · último estado: {state_txt}" + (f", reiniciou {reboots}x" if reboots else "") if state_txt else ""))
        return False

    def rollback(self, ip, otp=""):
        if not self.h["allowed"](ip):
            return 403, "esta máquina não está na lista do painel"
        try:
            return _post(ip, "/api/hc/rollback", otp)
        except Exception as e:
            return 0, str(e)
