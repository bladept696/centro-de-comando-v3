# © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
# é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
# https://github.com/bladept696/centro-de-comando-v3
"""Nostr mínimo para o Mercado de hashrate: chaves secp256k1, assinatura Schnorr (BIP340), eventos (NIP-01),
npub/nsec (NIP-19) e ligação aos relays por websocket. Sem dependências além do websocket-client."""
import hashlib
import json
import os
import secrets
import ssl
import threading
import time

import websocket

# ---------------------------------------------------------------- secp256k1 / BIP340
P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
G = (0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798,
     0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8)


def _jac_double(p):
    x, y, z = p
    if y == 0:
        return (0, 0, 0)
    ysq = y * y % P
    s = 4 * x * ysq % P
    m = 3 * x * x % P
    nx = (m * m - 2 * s) % P
    ny = (m * (s - nx) - 8 * ysq * ysq) % P
    return (nx, ny, 2 * y * z % P)


def _jac_add(p, q):
    if p[2] == 0:
        return q
    if q[2] == 0:
        return p
    z1s, z2s = p[2] * p[2] % P, q[2] * q[2] % P
    u1, u2 = p[0] * z2s % P, q[0] * z1s % P
    s1, s2 = p[1] * z2s * q[2] % P, q[1] * z1s * p[2] % P
    if u1 == u2:
        return _jac_double(p) if s1 == s2 else (0, 0, 0)
    h, r = (u2 - u1) % P, (s2 - s1) % P
    h2 = h * h % P
    h3 = h * h2 % P
    u1h2 = u1 * h2 % P
    nx = (r * r - h3 - 2 * u1h2) % P
    ny = (r * (u1h2 - nx) - s1 * h3) % P
    return (nx, ny, h * p[2] * q[2] % P)


def _to_affine(p):
    if p[2] == 0:
        return None
    zi = pow(p[2], -1, P)
    zi2 = zi * zi % P
    return (p[0] * zi2 % P, p[1] * zi2 * zi % P)


def point_mul(pt, k):
    r, q = (0, 0, 0), (pt[0], pt[1], 1)
    while k:
        if k & 1:
            r = _jac_add(r, q)
        q = _jac_double(q)
        k >>= 1
    return _to_affine(r)


def point_add(a, b):
    if a is None:
        return b
    if b is None:
        return a
    return _to_affine(_jac_add((a[0], a[1], 1), (b[0], b[1], 1)))


def _tagged(tag, msg):
    th = hashlib.sha256(tag.encode()).digest()
    return hashlib.sha256(th + th + msg).digest()


def lift_x(x):
    if x >= P:
        return None
    y_sq = (pow(x, 3, P) + 7) % P
    y = pow(y_sq, (P + 1) // 4, P)
    if y * y % P != y_sq:
        return None
    return (x, y if y % 2 == 0 else P - y)


def pubkey_of(seckey: bytes) -> bytes:
    d = int.from_bytes(seckey, 'big')
    if not 0 < d < N:
        raise ValueError("chave inválida")
    return point_mul(G, d)[0].to_bytes(32, 'big')


def schnorr_sign(msg: bytes, seckey: bytes, aux: bytes = None) -> bytes:
    aux = aux if aux is not None else secrets.token_bytes(32)
    d0 = int.from_bytes(seckey, 'big')
    if not 0 < d0 < N:
        raise ValueError("chave inválida")
    pt = point_mul(G, d0)
    d = d0 if pt[1] % 2 == 0 else N - d0
    t = (d ^ int.from_bytes(_tagged("BIP0340/aux", aux), 'big')).to_bytes(32, 'big')
    k0 = int.from_bytes(_tagged("BIP0340/nonce", t + pt[0].to_bytes(32, 'big') + msg), 'big') % N
    if k0 == 0:
        raise ValueError("nonce nulo")
    r = point_mul(G, k0)
    k = k0 if r[1] % 2 == 0 else N - k0
    e = int.from_bytes(_tagged("BIP0340/challenge", r[0].to_bytes(32, 'big') + pt[0].to_bytes(32, 'big') + msg), 'big') % N
    return r[0].to_bytes(32, 'big') + ((k + e * d) % N).to_bytes(32, 'big')


def schnorr_verify(msg: bytes, pubkey: bytes, sig: bytes) -> bool:
    try:
        pt = lift_x(int.from_bytes(pubkey, 'big'))
        r, s = int.from_bytes(sig[:32], 'big'), int.from_bytes(sig[32:], 'big')
        if pt is None or r >= P or s >= N:
            return False
        e = int.from_bytes(_tagged("BIP0340/challenge", sig[:32] + pubkey + msg), 'big') % N
        R = point_add(point_mul(G, s), point_mul((pt[0], P - pt[1]), e))
        return R is not None and R[1] % 2 == 0 and R[0] == r
    except Exception:
        return False


# ---------------------------------------------------------------- NIP-19 (bech32)
_B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'


def _polymod(values):
    gen = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
    chk = 1
    for v in values:
        b = chk >> 25
        chk = (chk & 0x1ffffff) << 5 ^ v
        for i in range(5):
            chk ^= gen[i] if ((b >> i) & 1) else 0
    return chk


def _hrp_exp(hrp):
    return [ord(c) >> 5 for c in hrp] + [0] + [ord(c) & 31 for c in hrp]


def _convertbits(data, frombits, tobits, pad=True):
    acc, bits, out, maxv = 0, 0, [], (1 << tobits) - 1
    for v in data:
        acc = (acc << frombits) | v
        bits += frombits
        while bits >= tobits:
            bits -= tobits
            out.append((acc >> bits) & maxv)
    if pad and bits:
        out.append((acc << (tobits - bits)) & maxv)
    elif not pad and (bits >= frombits or ((acc << (tobits - bits)) & maxv)):
        raise ValueError("bits a mais")
    return out


def bech32_encode(hrp, data: bytes):
    d5 = _convertbits(data, 8, 5)
    pm = _polymod(_hrp_exp(hrp) + d5 + [0] * 6) ^ 1
    return hrp + '1' + ''.join(_B32[x] for x in d5 + [(pm >> 5 * (5 - i)) & 31 for i in range(6)])


def bech32_decode(s):
    s = s.strip().lower()
    pos = s.rfind('1')
    hrp, data = s[:pos], [_B32.index(c) for c in s[pos + 1:]]
    if _polymod(_hrp_exp(hrp) + data) != 1:
        raise ValueError("checksum inválido")
    return hrp, bytes(_convertbits(data[:-6], 5, 8, False))


def npub(pubkey_hex):
    return bech32_encode('npub', bytes.fromhex(pubkey_hex))


def npub_to_hex(s):
    hrp, b = bech32_decode(s)
    if hrp != 'npub' or len(b) != 32:
        raise ValueError("npub inválido")
    return b.hex()


# ---------------------------------------------------------------- eventos (NIP-01)
def event_id(ev):
    data = json.dumps([0, ev["pubkey"], ev["created_at"], ev["kind"], ev["tags"], ev["content"]],
                      separators=(',', ':'), ensure_ascii=False)
    return hashlib.sha256(data.encode('utf-8')).hexdigest()


def sign_event(seckey: bytes, kind, content, tags, created_at=None):
    ev = {"pubkey": pubkey_of(seckey).hex(), "created_at": int(created_at or time.time()), "kind": kind,
          "tags": tags, "content": content}
    ev["id"] = event_id(ev)
    ev["sig"] = schnorr_sign(bytes.fromhex(ev["id"]), seckey).hex()
    return ev


def verify_event(ev):
    try:
        return event_id(ev) == ev["id"] and schnorr_verify(bytes.fromhex(ev["id"]), bytes.fromhex(ev["pubkey"]), bytes.fromhex(ev["sig"]))
    except Exception:
        return False


# ---------------------------------------------------------------- cifra (NIP-44 v2 e NIP-04)
import base64
import hmac as _hmac
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes


def _shared_x(seckey: bytes, pub_xonly_hex: str) -> bytes:
    pt = lift_x(int.from_bytes(bytes.fromhex(pub_xonly_hex), 'big'))
    if pt is None:
        raise ValueError("chave pública inválida")
    return point_mul(pt, int.from_bytes(seckey, 'big'))[0].to_bytes(32, 'big')


def nip44_conversation_key(seckey: bytes, pub_hex: str) -> bytes:
    return _hmac.new(b"nip44-v2", _shared_x(seckey, pub_hex), hashlib.sha256).digest()   # HKDF-extract


def _hkdf_expand(prk, info, length):
    out, t, i = b"", b"", 1
    while len(out) < length:
        t = _hmac.new(prk, t + info + bytes([i]), hashlib.sha256).digest()
        out += t
        i += 1
    return out[:length]


def nip44_message_keys(conv_key, nonce):
    k = _hkdf_expand(conv_key, nonce, 76)
    return k[:32], k[32:44], k[44:76]


def nip44_padded_len(n):
    if n <= 32:
        return 32
    next_power = 1 << ((n - 1).bit_length())
    chunk = 32 if next_power <= 256 else next_power // 8
    return chunk * ((n - 1) // chunk + 1)


def _chacha(key, nonce12, data):
    return Cipher(algorithms.ChaCha20(key, b"\x00\x00\x00\x00" + nonce12), mode=None).encryptor().update(data)


def nip44_encrypt(plaintext: str, conv_key: bytes, nonce: bytes = None) -> str:
    raw = plaintext.encode('utf-8')
    if not 1 <= len(raw) <= 65535:
        raise ValueError("tamanho da mensagem inválido")
    nonce = nonce or secrets.token_bytes(32)
    ck, cn, hk = nip44_message_keys(conv_key, nonce)
    padded = len(raw).to_bytes(2, 'big') + raw + bytes(nip44_padded_len(len(raw)) - len(raw))
    ct = _chacha(ck, cn, padded)
    mac = _hmac.new(hk, nonce + ct, hashlib.sha256).digest()
    return base64.b64encode(b"\x02" + nonce + ct + mac).decode()


def nip44_decrypt(payload: str, conv_key: bytes) -> str:
    if not payload or payload[0] == '#':
        raise ValueError("versão de cifra não suportada")
    data = base64.b64decode(payload)
    if len(data) < 99 or data[0] != 2:
        raise ValueError("cifra inválida")
    nonce, ct, mac = data[1:33], data[33:-32], data[-32:]
    ck, cn, hk = nip44_message_keys(conv_key, nonce)
    if not _hmac.compare_digest(mac, _hmac.new(hk, nonce + ct, hashlib.sha256).digest()):
        raise ValueError("mensagem adulterada")
    padded = _chacha(ck, cn, ct)
    n = int.from_bytes(padded[:2], 'big')
    if n == 0 or len(padded) != 2 + nip44_padded_len(n):
        raise ValueError("preenchimento inválido")
    return padded[2:2 + n].decode('utf-8')


def nip04_encrypt(plaintext: str, seckey: bytes, pub_hex: str) -> str:
    key, iv = _shared_x(seckey, pub_hex), secrets.token_bytes(16)
    raw = plaintext.encode('utf-8')
    pad = 16 - len(raw) % 16
    ct = Cipher(algorithms.AES(key), modes.CBC(iv)).encryptor().update(raw + bytes([pad]) * pad)
    return base64.b64encode(ct).decode() + "?iv=" + base64.b64encode(iv).decode()


def nip04_decrypt(content: str, seckey: bytes, pub_hex: str) -> str:
    ct_b64, iv_b64 = content.split("?iv=")
    d = Cipher(algorithms.AES(_shared_x(seckey, pub_hex)), modes.CBC(base64.b64decode(iv_b64))).decryptor()
    raw = d.update(base64.b64decode(ct_b64)) + d.finalize()
    return raw[:-raw[-1]].decode('utf-8')


# ---------------------------------------------------------------- chave da app
class KeyStore:
    """Chave Nostr deste Hash Commander, guardada só neste PC (nunca vai para o GitHub nem para o instalador)."""

    def __init__(self, path):
        self.path = path
        self._lock = threading.Lock()

    def seckey(self):
        with self._lock:
            try:
                with open(self.path, 'r', encoding='utf-8') as f:
                    sk = bytes.fromhex(json.load(f)["secret_key"])
                if len(sk) == 32 and 0 < int.from_bytes(sk, 'big') < N:
                    return sk
            except Exception:
                pass
            sk = secrets.token_bytes(32)
            while not 0 < int.from_bytes(sk, 'big') < N:
                sk = secrets.token_bytes(32)
            tmp = self.path + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                # "secret_key": o verificar_release.py reconhece o nome e procura este valor antes de cada release
                json.dump({"secret_key": sk.hex()}, f)
            os.replace(tmp, self.path)
            return sk

    def pubkey(self):
        return pubkey_of(self.seckey()).hex()


# ---------------------------------------------------------------- relays
DEFAULT_RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net", "wss://relay.snort.social", "wss://nostr.mom"]


def _connect(url, timeout):
    sslopt = {"cert_reqs": ssl.CERT_REQUIRED} if url.startswith('wss') else None
    return websocket.create_connection(url, timeout=timeout, sslopt=sslopt, header=["User-Agent: HashCommander"])


def publish(ev, relays, timeout=8):
    """Envia o evento a todos os relays em paralelo; devolve {relay: (ok, mensagem)}."""
    out = {}

    def one(url):
        try:
            ws = _connect(url, timeout)
            try:
                ws.send(json.dumps(["EVENT", ev]))
                end = time.time() + timeout
                while time.time() < end:
                    msg = json.loads(ws.recv())
                    if msg[0] == "OK" and msg[1] == ev["id"]:
                        out[url] = (bool(msg[2]), msg[3] if len(msg) > 3 else "")
                        return
                out[url] = (False, "sem resposta")
            finally:
                ws.close()
        except Exception as e:
            out[url] = (False, str(e)[:120])
    ths = [threading.Thread(target=one, args=(u,), daemon=True) for u in relays]
    for t in ths:
        t.start()
    for t in ths:
        t.join(timeout + 2)
    return out


def query(filters, relays, timeout=8):
    """Pede eventos a todos os relays em paralelo (até ao EOSE de cada um); devolve eventos únicos e válidos."""
    found, lock = {}, threading.Lock()

    def one(url):
        try:
            ws = _connect(url, timeout)
            try:
                sub = secrets.token_hex(6)
                ws.send(json.dumps(["REQ", sub] + list(filters)))
                end = time.time() + timeout
                while time.time() < end:
                    msg = json.loads(ws.recv())
                    if msg[0] == "EVENT" and msg[1] == sub:
                        ev = msg[2]
                        with lock:
                            if ev.get("id") not in found and verify_event(ev):
                                found[ev["id"]] = ev
                    elif msg[0] in ("EOSE", "CLOSED") and msg[1] == sub:
                        break
                try:
                    ws.send(json.dumps(["CLOSE", sub]))
                except Exception:
                    pass
            finally:
                ws.close()
        except Exception:
            pass
    ths = [threading.Thread(target=one, args=(u,), daemon=True) for u in relays]
    for t in ths:
        t.start()
    for t in ths:
        t.join(timeout + 2)
    return list(found.values())
