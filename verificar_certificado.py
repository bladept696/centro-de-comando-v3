"""Verifica um certificado de bloco do Centro de Comando, sem precisar da app.

Uso:
    python verificar_certificado.py certificado-bloco-123456.json

Precisa de Python 3 e do pacote "cryptography" (pip install cryptography). Confirma:
  1. a assinatura Ed25519 (o certificado não foi alterado depois de assinado);
  2. o hash do bloco, recalculado a partir do cabeçalho de 80 bytes que vem no certificado.

O que NENHUM ficheiro consegue provar sozinho é que o bloco existe na rede: confirma a altura, o hash do bloco e a
transação de recompensa (coinbase) num explorador de blocos, por exemplo https://mempool.space/tx/<coinbase_txid>.
A chave pública de quem assinou serve para saber se dois certificados vêm da mesma instalação.
"""
import hashlib
import json
import struct
import sys

CONTEXT = b"HC-BLOCK-CERT-V1:"   # tem de ser igual ao CERT_CONTEXT do app.py


def canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def header_hash(h):
    raw = (struct.pack("<I", int(h["version"]) & 0xffffffff) + bytes.fromhex(h["previousblockhash"])[::-1] +
           bytes.fromhex(h["merkle_root"])[::-1] + struct.pack("<III", int(h["timestamp"]), int(h["bits"]), int(h["nonce"])))
    return hashlib.sha256(hashlib.sha256(raw).digest()).digest()[::-1].hex()


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # a consola do Windows nem sempre aceita acentos e travessões
    except Exception:
        pass
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    cert = json.load(open(sys.argv[1], "r", encoding="utf-8"))
    signed = {"v": cert["v"], "signed_at": cert["signed_at"], "payload": cert["payload"]}
    try:
        Ed25519PublicKey.from_public_bytes(bytes.fromhex(cert["public_key"])).verify(
            bytes.fromhex(cert["signature"]), CONTEXT + hashlib.sha256(canonical(signed)).digest())
        sig_ok = True
    except Exception:
        sig_ok = False
    p = cert["payload"]
    chain = p.get("chain") or {}
    print("Assinatura:        ", "VÁLIDA" if sig_ok else "INVÁLIDA (o ficheiro foi alterado ou não é deste formato)")
    print("Assinado em (UTC): ", cert["signed_at"])
    print("Chave pública:     ", cert["public_key"])
    ok = sig_ok
    if isinstance(chain.get("header"), dict):
        hh = header_hash(chain["header"])
        good = hh == chain.get("block_hash")
        ok = ok and good
        print("Hash do cabeçalho: ", "BATE CERTO com o bloco indicado" if good else "NÃO BATE: " + hh)
    else:
        print("Hash do cabeçalho:  sem cabeçalho no certificado (bloco ainda não confirmado)")
    print()
    print("Teste:             ", "SIM (certificado de demonstração, não é um bloco real)" if p.get("test") else "não")
    print("Detetado em:       ", p.get("detected_at"))
    print("Máquina:           ", (p.get("machine") or {}).get("name"))
    print("Altura do bloco:   ", chain.get("height", "— (por confirmar)"))
    print("Hash do bloco:     ", chain.get("block_hash", "—"))
    print("Transação coinbase:", chain.get("coinbase_txid", "—"))
    if chain.get("reward_sats") is not None:
        print("Recompensa:        ", chain["reward_sats"], "sats para", (p.get("payout") or {}).get("address"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
