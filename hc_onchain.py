# © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
# é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
# https://github.com/bladept696/centro-de-comando-v3
"""Pagamentos Bitcoin on-chain do mercado de hashrate.

O vendedor dá a chave pública da carteira (xpub/ypub/zpub, só de leitura): daqui saem os endereços de receber
(caminho 0/i, BIP32 sem chaves privadas). Cada aluguer usa um endereço novo e a app vigia-o na API do mempool.space
(HC_MEMPOOL_API muda o servidor, para testes). Nunca se pede nem se guarda a seed.
"""
import hashlib
import hmac
import json
import os
import re
import urllib.request

import hc_nostr

# ---------------------------------------------------------------- hashes e codificações
_B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
_B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'


def _ripemd160_py(data):
    """RIPEMD-160 em Python: há builds do OpenSSL (3.x) que já não o trazem no hashlib."""
    def rol(x, n):
        return ((x << n) | (x >> (32 - n))) & 0xffffffff
    f = [lambda x, y, z: x ^ y ^ z, lambda x, y, z: (x & y) | (~x & z), lambda x, y, z: (x | ~y) ^ z,
         lambda x, y, z: (x & z) | (y & ~z), lambda x, y, z: x ^ (y | ~z)]
    kl, kr = [0, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e], [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0]
    rl = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
          3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12, 1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
          4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13]
    rr = [5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12, 6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
          15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13, 8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
          12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11]
    sl = [11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8, 7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
          11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5, 11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
          9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6]
    sr = [8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6, 9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
          9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5, 15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
          8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11]
    h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]
    msg = data + b'\x80' + b'\0' * ((55 - len(data)) % 64) + (len(data) * 8).to_bytes(8, 'little')
    for off in range(0, len(msg), 64):
        x = [int.from_bytes(msg[off + 4 * i:off + 4 * i + 4], 'little') for i in range(16)]
        al, bl, cl, dl, el = h
        ar, br, cr, dr, er = h
        for j in range(80):
            r = j // 16
            t = (rol((al + f[r](bl, cl, dl) + x[rl[j]] + kl[r]) & 0xffffffff, sl[j]) + el) & 0xffffffff
            al, el, dl, cl, bl = el, dl, rol(cl, 10), bl, t
            t = (rol((ar + f[4 - r](br, cr, dr) + x[rr[j]] + kr[r]) & 0xffffffff, sr[j]) + er) & 0xffffffff
            ar, er, dr, cr, br = er, dr, rol(cr, 10), br, t
        t = (h[1] + cl + dr) & 0xffffffff
        h[1], h[2], h[3], h[4], h[0] = (h[2] + dl + er) & 0xffffffff, (h[3] + el + ar) & 0xffffffff, (h[4] + al + br) & 0xffffffff, (h[0] + bl + cr) & 0xffffffff, t
    return b''.join(v.to_bytes(4, 'little') for v in h)


def hash160(b):
    sha = hashlib.sha256(b).digest()
    try:
        return hashlib.new('ripemd160', sha).digest()
    except ValueError:
        return _ripemd160_py(sha)


def b58check_encode(payload):
    data = payload + hashlib.sha256(hashlib.sha256(payload).digest()).digest()[:4]
    n, out = int.from_bytes(data, 'big'), ''
    while n:
        n, r = divmod(n, 58)
        out = _B58[r] + out
    return '1' * (len(data) - len(data.lstrip(b'\0'))) + out


def b58check_decode(s):
    n = 0
    for c in s:
        i = _B58.find(c)
        if i < 0:
            raise ValueError("caráter inválido")
        n = n * 58 + i
    raw = n.to_bytes((n.bit_length() + 7) // 8, 'big')
    raw = b'\0' * (len(s) - len(s.lstrip('1'))) + raw
    payload, chk = raw[:-4], raw[-4:]
    if hashlib.sha256(hashlib.sha256(payload).digest()).digest()[:4] != chk:
        raise ValueError("checksum inválido")
    return payload


def segwit_address(hrp, ver, prog):
    data = [ver] + hc_nostr._convertbits(prog, 8, 5)
    const = 1 if ver == 0 else 0x2bc830a3
    pm = hc_nostr._polymod(hc_nostr._hrp_exp(hrp) + data + [0] * 6) ^ const
    return hrp + '1' + ''.join(_B32[d] for d in data + [(pm >> 5 * (5 - i)) & 31 for i in range(6)])


# ---------------------------------------------------------------- chaves públicas estendidas (BIP32 / 49 / 84)
# versão -> (nome, rede, tipo de endereço por omissão); a xpub/tpub não diz o tipo: escolhe-se e confirma-se o 1.º endereço
VERSIONS = {
    '0488b21e': ('xpub', 'main', None), '049d7cb2': ('ypub', 'main', 'sh-wpkh'), '04b24746': ('zpub', 'main', 'wpkh'),
    '043587cf': ('tpub', 'test', None), '044a5262': ('upub', 'test', 'sh-wpkh'), '045f1cf6': ('vpub', 'test', 'wpkh'),
}
SCRIPTS = ('wpkh', 'sh-wpkh', 'pkh')


def _compress(pt):
    return bytes([2 + (pt[1] & 1)]) + pt[0].to_bytes(32, 'big')


def _decompress(b):
    if len(b) != 33 or b[0] not in (2, 3):
        raise ValueError("chave pública inválida")
    x = int.from_bytes(b[1:], 'big')
    pt = hc_nostr.lift_x(x)
    if pt is None:
        raise ValueError("chave pública inválida")
    return pt if (pt[1] & 1) == (b[0] & 1) else (pt[0], hc_nostr.P - pt[1])


class ExtPub:
    def __init__(self, text, script=None):
        s = re.sub(r'\s+', '', str(text or ''))
        try:
            raw = b58check_decode(s)
        except (ValueError, OverflowError):
            raise ValueError("chave pública da carteira inválida (confirma que copiaste a zpub/xpub inteira)")
        if len(raw) != 78 or raw.hex()[:8] not in VERSIONS:
            raise ValueError("isto não é uma xpub/ypub/zpub (não uses a seed nem uma chave privada)")
        self.kind, self.net, default = VERSIONS[raw.hex()[:8]]
        self.script = default or (script if script in SCRIPTS else 'wpkh')
        self.depth, self.chain, self.key = raw[4], raw[13:45], raw[45:78]
        self.point = _decompress(self.key)
        self.text = s

    def _child(self, chain, key, point, i):
        h = hmac.new(chain, key + i.to_bytes(4, 'big'), hashlib.sha512).digest()
        il = int.from_bytes(h[:32], 'big')
        if il >= hc_nostr.N:
            raise ValueError("índice inválido")
        pt = hc_nostr.point_add(hc_nostr.point_mul(hc_nostr.G, il), point)
        if pt is None:
            raise ValueError("índice inválido")
        return h[32:], _compress(pt), pt

    def pubkey(self, index, change=0):
        c, k, p = self._child(self.chain, self.key, self.point, change)
        return self._child(c, k, p, int(index))[1]

    def address(self, index, change=0):
        h = hash160(self.pubkey(index, change))
        main = self.net == 'main'
        if self.script == 'wpkh':
            return segwit_address('bc' if main else 'tb', 0, h)
        if self.script == 'sh-wpkh':
            return b58check_encode((b'\x05' if main else b'\xc4') + hash160(b'\x00\x14' + h))
        return b58check_encode((b'\x00' if main else b'\x6f') + h)


# ---------------------------------------------------------------- mempool.space: ver o pagamento
def api_base():
    return (os.environ.get('HC_MEMPOOL_API') or 'https://mempool.space/api').rstrip('/')


def _get(path, timeout=12):
    req = urllib.request.Request(api_base() + path, headers={"User-Agent": "HashCommander"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read(2 * 1024 * 1024).decode('utf-8'))


def address_used(addr):
    d = _get(f"/address/{addr}")
    return int(d["chain_stats"]["tx_count"]) + int(d["mempool_stats"]["tx_count"]) > 0


def received(addr):
    """Quanto chegou a este endereço: {"seen": sats na mempool + confirmados, "confirmed": sats confirmados, "txids": [...]}"""
    seen = conf = 0
    txids = []
    for tx in _get(f"/address/{addr}/txs"):
        v = sum(int(o.get("value") or 0) for o in tx.get("vout", []) if o.get("scriptpubkey_address") == addr)
        if v <= 0:
            continue
        txids.append(tx.get("txid"))
        seen += v
        if (tx.get("status") or {}).get("confirmed"):
            conf += v
    return {"seen": seen, "confirmed": conf, "txids": txids}


def fee_rate():
    """sat/vB para confirmar em ~30 min."""
    d = _get("/v1/fees/recommended")
    return int(d.get("halfHourFee") or d.get("fastestFee") or 2)


ADDRESS_RE = re.compile(r'(bc1[02-9ac-hj-np-z]{11,71}|tb1[02-9ac-hj-np-z]{11,71}|[13mn2][1-9A-HJ-NP-Za-km-z]{25,34})')
