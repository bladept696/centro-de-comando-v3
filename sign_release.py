"""Assina um instalador para a atualização automática do Centro de Comando.

Uso (depois de compilar o instalador com o Inno Setup):
    python sign_release.py Output\\CentroDeComando-Setup-4.0.6.exe

Cria ao lado dele o ficheiro "CentroDeComando-Setup-4.0.6.exe.sig". Na release do GitHub tens de anexar OS DOIS
ficheiros (o .exe e o .sig). A app só se atualiza sozinha se a assinatura bater certo com a chave pública que está
no app.py (UPDATE_PUBKEY_HEX); caso contrário apaga o que descarregou e não executa nada.

A chave privada fica FORA do projeto: %USERPROFILE%\\.centro-de-comando\\update-signing-key.pem
(ou o caminho da variável HC_SIGN_KEY). Faz uma cópia de segurança dela e NUNCA a publiques nem a partilhes:
quem a tiver consegue assinar atualizações que todas as instalações aceitam.
"""
import hashlib
import os
import sys

CONTEXT = b"HC-UPDATE-V1:"   # tem de ser igual ao UPDATE_SIG_CONTEXT do app.py


def main():
    if len(sys.argv) != 2 or not os.path.isfile(sys.argv[1]):
        print(__doc__)
        return 2
    from cryptography.hazmat.primitives import serialization
    key_path = os.environ.get("HC_SIGN_KEY") or os.path.join(os.path.expanduser("~"), ".centro-de-comando", "update-signing-key.pem")
    if not os.path.isfile(key_path):
        print("Chave privada não encontrada em:", key_path)
        return 1
    key = serialization.load_pem_private_key(open(key_path, "rb").read(), None)
    h = hashlib.sha256()
    with open(sys.argv[1], "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    sig = key.sign(CONTEXT + h.digest())
    out = sys.argv[1] + ".sig"
    open(out, "w", encoding="ascii").write(sig.hex())
    pub = key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw).hex()
    print("SHA-256:", h.hexdigest())
    print("Assinatura guardada em:", out)
    print("Chave pública (tem de ser igual ao UPDATE_PUBKEY_HEX do app.py):", pub)
    return 0


if __name__ == "__main__":
    sys.exit(main())
