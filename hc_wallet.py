# © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
"""Carteira Lightning própria da app, sem custódia.

Cada pessoa tem a sua carteira no próprio computador: as 12 palavras (BIP39) ficam em wallet.json, na pasta de dados da
app, e só quem as tem controla o saldo. A app nunca guarda nem movimenta dinheiro de outras pessoas.

A carteira tem a mesma interface que a carteira NWC do mercado (pay_invoice → preimage, balance_sats, info), por isso o
mercado de hashrate usa-a sem mudanças: aluga-se a pagar a partir do saldo e vende-se a receber no endereço Lightning
próprio.
"""
import asyncio
import hashlib
import json
import os
import re
import secrets
import threading
import time

try:
    import breez_sdk_spark as bz
except Exception:          # SDK não instalado: a carteira fica indisponível e a app continua a funcionar
    bz = None

WORDLIST_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bip39_english.txt")


# ---------------------------------------------------------------- 12 palavras (BIP39)
def _words():
    with open(WORDLIST_FILE, encoding="utf-8") as f:
        w = f.read().split()
    if len(w) != 2048:
        raise RuntimeError("lista de palavras BIP39 incompleta")
    return w


def new_mnemonic():
    words = _words()
    ent = secrets.token_bytes(16)
    bits = bin(int.from_bytes(ent, "big"))[2:].zfill(128) + bin(hashlib.sha256(ent).digest()[0])[2:].zfill(8)[:4]
    return " ".join(words[int(bits[i:i + 11], 2)] for i in range(0, 132, 11))


def valid_mnemonic(m):
    """12 ou 24 palavras da lista e com o dígito de controlo certo."""
    words = _words()
    parts = re.sub(r"\s+", " ", (m or "").strip().lower()).split(" ")
    if len(parts) not in (12, 24) or any(p not in words for p in parts):
        return False
    bits = "".join(bin(words.index(p))[2:].zfill(11) for p in parts)
    cs = len(parts) // 3
    ent = int(bits[:-cs], 2).to_bytes(len(bits[:-cs]) // 8, "big")
    return bits[-cs:] == bin(hashlib.sha256(ent).digest()[0])[2:].zfill(8)[:cs]


def _v(x, i=0):
    """Valor dentro de uma variante do SDK (ex.: InputType.LIGHTNING_ADDRESS(detalhes))."""
    try:
        return x[i]
    except Exception:
        return getattr(x, "_values", [None])[i]


class Wallet:
    """hooks: data_dir() -> pasta dos dados da app, api_key() -> chave de serviço da app"""

    def __init__(self, hooks):
        self.h = hooks
        self.lock = threading.Lock()
        self._sdk = None
        self._loop = None
        self._err = ""
        self.alias = "Carteira Hash Commander"

    # -- ficheiros
    def _file(self):
        return os.path.join(self.h["data_dir"](), "wallet.json")

    def _load(self):
        try:
            with open(self._file(), encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _save(self, d):
        p = self._file()
        tmp = p + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(d, f)
        os.replace(tmp, p)

    # -- ciclo assíncrono do SDK numa thread própria
    def _run(self, coro, timeout=90):
        if self._loop is None:
            self._loop = asyncio.new_event_loop()
            threading.Thread(target=self._loop.run_forever, daemon=True, name="carteira").start()
        return asyncio.run_coroutine_threadsafe(coro, self._loop).result(timeout)

    def _connect(self):
        if self._sdk:
            return self._sdk
        if bz is None:
            raise RuntimeError("a carteira não está disponível nesta instalação")
        key = (self.h["api_key"]() or "").strip()
        if not key:
            raise RuntimeError("a carteira não está disponível nesta instalação")
        d = self._load()
        if not d.get("mnemonic"):
            raise RuntimeError("ainda não há carteira: cria uma ou recupera com as 12 palavras")

        async def go():
            cfg = bz.default_config(bz.Network.MAINNET)
            cfg.api_key = key
            store = os.path.join(self.h["data_dir"](), "wallet-data")
            os.makedirs(store, exist_ok=True)
            return await bz.connect(bz.ConnectRequest(config=cfg, seed=bz.Seed.MNEMONIC(mnemonic=d["mnemonic"], passphrase=None),
                                                      storage_dir=store))
        self._sdk = self._run(go(), timeout=120)
        return self._sdk

    def available(self):
        return bz is not None and bool((self.h["api_key"]() or "").strip())

    # -- criar / recuperar
    def create(self):
        with self.lock:
            if self._load().get("mnemonic"):
                raise RuntimeError("já existe uma carteira neste computador")
            m = new_mnemonic()
            self._save({"mnemonic": m, "backed_up": False, "created": int(time.time())})
            return m

    def restore(self, words):
        words = re.sub(r"\s+", " ", (words or "").strip().lower())
        if not valid_mnemonic(words):
            raise ValueError("as palavras não estão certas: confirma as 12 palavras e a ordem")
        with self.lock:
            if self._load().get("mnemonic"):
                raise RuntimeError("já existe uma carteira neste computador")
            self._save({"mnemonic": words, "backed_up": True, "created": int(time.time()), "restored": True})
            self._sdk = None

    def confirm_backup(self, words):
        d = self._load()
        if re.sub(r"\s+", " ", (words or "").strip().lower()) != d.get("mnemonic"):
            raise ValueError("as palavras não correspondem às da tua carteira")
        d["backed_up"] = True
        self._save(d)

    def show_words(self):
        return self._load().get("mnemonic", "")

    # -- estado
    def status(self):
        d = self._load()
        out = {"available": self.available(), "exists": bool(d.get("mnemonic")), "backed_up": bool(d.get("backed_up")),
               "address": d.get("address", ""), "balance": None, "error": ""}
        if out["available"] and out["exists"]:
            try:
                out["balance"] = self.balance_sats()
            except Exception as e:
                out["error"] = str(e)[:160]
        return out

    def balance_sats(self):
        sdk = self._connect()
        info = self._run(sdk.get_info(bz.GetInfoRequest(ensure_synced=False)), timeout=60)
        return int(info.balance_sats)

    def info(self):
        return {"alias": self.alias}

    # -- receber
    def receive(self, sats, description="Depósito na carteira Hash Commander", expiry=3600):
        sdk = self._connect()
        r = self._run(sdk.receive_payment(bz.ReceivePaymentRequest(payment_method=bz.ReceivePaymentMethod.BOLT11_INVOICE(
            description=description[:120], amount_sats=int(sats) if sats else None, expiry_secs=int(expiry),
            payment_hash=None, receiver_identity_public_key=None, preimage=None))))
        return {"invoice": r.payment_request, "fee": int(r.fee)}

    def register_address(self, username):
        username = (username or "").strip().lower()
        if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{2,30}", username):
            raise ValueError("o nome só pode ter letras, números, ponto, hífen e traço baixo (3 a 31)")
        sdk = self._connect()
        if not self._run(sdk.check_lightning_address_available(bz.CheckLightningAddressRequest(username=username))):
            raise ValueError("esse nome já está ocupado")
        info = self._run(sdk.register_lightning_address(bz.RegisterLightningAddressRequest(username=username, description="Hash Commander")))
        d = self._load()
        d["address"] = info.lightning_address
        self._save(d)
        return info.lightning_address

    # -- enviar
    def _wait_preimage(self, payment, timeout=60):
        sdk = self._sdk
        end = time.time() + timeout
        while True:
            det = getattr(payment, "details", None)
            htlc = getattr(_v(det) if det is not None and not hasattr(det, "htlc_details") else det, "htlc_details", None) if det else None
            pre = getattr(htlc, "preimage", None) if htlc else None
            st = getattr(payment, "status", None)
            if pre:
                return pre
            if st == bz.PaymentStatus.FAILED:
                raise RuntimeError("carteira: o pagamento falhou")
            if time.time() > end:
                raise RuntimeError("carteira: o pagamento não terminou a tempo")
            time.sleep(1.5)
            payment = self._run(sdk.get_payment(bz.GetPaymentRequest(payment_id=payment.id)), timeout=30).payment

    def pay_invoice(self, pr):
        """Paga uma fatura BOLT11 e devolve o comprovativo (preimage), como o NWC."""
        sdk = self._connect()
        prep = self._run(sdk.prepare_send_payment(bz.PrepareSendPaymentRequest(payment_request=bz.PaymentRequest.INPUT(input=pr.strip()))))
        res = self._run(sdk.send_payment(bz.SendPaymentRequest(prepare_response=prep)), timeout=120)
        return self._wait_preimage(res.payment)

    def pay_address(self, address, sats, comment=""):
        """Envia sats para um endereço Lightning (nome@dominio) ou LNURL: levantar e devoluções."""
        sdk = self._connect()
        parsed = self._run(sdk.parse(address.strip()))
        details = _v(parsed)
        pay_request = getattr(details, "pay_request", None) or details
        prep = self._run(sdk.prepare_lnurl_pay(bz.PrepareLnurlPayRequest(amount=int(sats), pay_request=pay_request,
                                                                          comment=(comment or None), validate_success_action_url=None)))
        res = self._run(sdk.lnurl_pay(bz.LnurlPayRequest(prepare_response=prep)), timeout=120)
        return {"sats": int(prep.amount_sats), "fee": int(prep.fee_sats), "id": res.payment.id}

    def estimate_address_fee(self, address, sats):
        sdk = self._connect()
        details = _v(self._run(sdk.parse(address.strip())))
        pay_request = getattr(details, "pay_request", None) or details
        prep = self._run(sdk.prepare_lnurl_pay(bz.PrepareLnurlPayRequest(amount=int(sats), pay_request=pay_request,
                                                                          comment=None, validate_success_action_url=None)))
        return int(prep.fee_sats)

    # -- movimentos
    def payments(self, limit=50):
        sdk = self._connect()
        r = self._run(sdk.list_payments(bz.ListPaymentsRequest(limit=int(limit))), timeout=60)
        out = []
        for p in r.payments:
            det = p.details
            desc = ""
            try:
                desc = getattr(_v(det) if det is not None and not hasattr(det, "description") else det, "description", "") or ""
            except Exception:
                pass
            out.append({"id": p.id, "in": p.payment_type == bz.PaymentType.RECEIVE, "sats": int(p.amount), "fee": int(p.fees),
                        "at": int(p.timestamp), "status": str(p.status).split(".")[-1].lower(), "desc": desc[:120]})
        return out
