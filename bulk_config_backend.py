"""Backend do Editor de Configurações em Lote (para colar no app.py).

Contrato (o dashboard já chama isto):
  POST /api/bulk-config
  body: {"items": [{"ip": "192.168.1.10", "settings": {"stratumURL": "...", ...}}], "restart": true}
  resposta: {"results": [{"ip": "...", "ok": true}, {"ip": "...", "ok": false, "error": "..."}]}

Só usa a biblioteca padrão. Falta ligar `bulk_config(...)` à rota no framework do app.py.
"""
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor

# Campos que o AxeOS aceita em PATCH /api/system e que o editor pode enviar.
_ALLOWED = {
    "stratumURL", "stratumPort", "stratumUser", "stratumPassword",
    "fallbackStratumURL", "fallbackStratumPort", "fallbackStratumUser", "fallbackStratumPassword",
    "ssid", "wifiPass",
}
_IP_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")


def _call(ip, method, path, body=None, timeout=8):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"http://{ip}{path}", data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status


def _one(item, restart):
    ip = str(item.get("ip", ""))
    if not _IP_RE.match(ip):
        return {"ip": ip, "ok": False, "error": "IP inválido"}
    settings = {k: v for k, v in (item.get("settings") or {}).items() if k in _ALLOWED}
    if not settings:
        return {"ip": ip, "ok": False, "error": "nada para alterar"}
    try:
        _call(ip, "PATCH", "/api/system", settings)
        if restart:
            try:
                _call(ip, "POST", "/api/system/restart")
            except Exception:
                pass  # a máquina fecha a ligação ao reiniciar
        return {"ip": ip, "ok": True}
    except Exception as e:
        return {"ip": ip, "ok": False, "error": str(e)}


def bulk_config(payload):
    """Dispara o PATCH em paralelo para todas as máquinas e devolve o resultado de cada uma."""
    items = payload.get("items") or []
    restart = bool(payload.get("restart"))
    with ThreadPoolExecutor(max_workers=min(16, max(1, len(items)))) as ex:
        results = list(ex.map(lambda it: _one(it, restart), items))
    return {"results": results}
