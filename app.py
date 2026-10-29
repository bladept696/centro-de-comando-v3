"""
CENTRO DE COMANDO - Painel de Mineração
Launcher único: arranca o servidor local e abre o painel no browser.

Este ficheiro foi desenhado para ser compilado com o PyInstaller
(--onefile) e distribuído como um único .exe, sem precisar de Python
instalado na máquina de destino.
"""

import os
import sys
import threading
import time
import webbrowser
import socket
import http.server
import socketserver
import urllib.request
import urllib.parse
import urllib.error
import json
import gzip
import io
import copy
import hmac
import hashlib
import re
import ssl
import ipaddress
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed


# --- Certificados HTTPS: funciona dentro do .exe PyInstaller ---------------
# Em alguns PCs, um .exe gerado com PyInstaller não encontra a lista de
# certificados de confiança do sistema (o "python app.py" normal encontra-a
# sempre; o .exe empacotado, nem sempre). Sem isto, TODOS os pedidos HTTPS
# feitos pelo servidor (Parasite Pool, Molepool, Firebase, VNish, ePIC...)
# falham sempre com o mesmo tipo de erro, mesmo com internet.
# Ordem de tentativa para o contexto principal:
#   1) cacert.pem ao lado do .exe/script
#   2) certifi, se estiver instalado
#   3) o comportamento por omissão do Python (como antes)
def _build_https_context():
    candidates = []
    try:
        base_dir = sys._MEIPASS if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS") else os.path.dirname(os.path.abspath(sys.argv[0] if getattr(sys, "frozen", False) else __file__))
        candidates.append(os.path.join(base_dir, "cacert.pem"))
    except Exception:
        pass
    try:
        candidates.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "cacert.pem"))
    except Exception:
        pass
    for path in candidates:
        try:
            if path and os.path.isfile(path):
                return ssl.create_default_context(cafile=path)
        except Exception:
            continue
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        pass
    try:
        return ssl.create_default_context()
    except Exception:
        return None


HTTPS_CTX = _build_https_context()


def _urlopen_https(req, timeout):
    """Como urllib.request.urlopen(), mas resistente a dois problemas distintos:
    1) o .exe não encontrar a lista de certificados (resolvido acima, por HTTPS_CTX);
    2) uma rede com inspeção de HTTPS (antivírus/router) que usa o SEU PRÓPRIO
       certificado -- nesse caso o SO costuma confiar nele, mas a lista fixa do
       certifi/cacert.pem não. Se a 1ª tentativa falhar só por validação de
       certificado, repete uma vez com o comportamento por omissão do sistema."""
    try:
        return urllib.request.urlopen(req, context=HTTPS_CTX, timeout=timeout)
    except urllib.error.URLError as e:
        reason = getattr(e, "reason", e)
        if isinstance(reason, ssl.SSLCertVerificationError) or "CERTIFICATE_VERIFY_FAILED" in str(reason):
            return _urlopen_https(req, timeout=timeout)
        raise

try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    mqtt = None
    MQTT_AVAILABLE = False

try:
    import pystray
    from PIL import Image, ImageDraw
    TRAY_AVAILABLE = True
except Exception:   # sem ecrã (ex.: Raspberry sem interface) o pystray pode falhar com outros erros além de ImportError
    pystray = None
    Image = None
    ImageDraw = None
    TRAY_AVAILABLE = False

try:
    from winotify import Notification as _WinToastNotification
    WINDOWS_TOAST_AVAILABLE = (sys.platform == 'win32')
except ImportError:
    _WinToastNotification = None
    WINDOWS_TOAST_AVAILABLE = False

PORT = 8765
SCAN_TIMEOUT = 0.6
SCAN_MAX_WORKERS = 60

# --- Versão da app / auto-update -------------------------------------------
APP_VERSION = "4.0.8"
GITHUB_REPO = "bladept696/centro-de-comando-v3"
# Chave PÚBLICA (Ed25519, em hexadecimal) com que o autor assina cada instalador publicado (ver sign_release.py).
# A app só instala uma atualização se o ficheiro descarregado tiver uma assinatura (.sig) válida para esta chave.
UPDATE_PUBKEY_HEX = "e6ef1389633f602730107fe5aad5e6e303c6e5c8acf7554883dbebbc71ef9a56"
UPDATE_SIG_CONTEXT = b"HC-UPDATE-V1:"
UPDATE_ALLOWED_HOSTS = ("github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com", "github-releases.githubusercontent.com")
UPDATE_CHECK_CACHE_SECONDS = 60 * 30
_update_cache = {"ts": 0, "data": None}
_update_cache_lock = threading.Lock()

BINANCE_RATES_CACHE_SECONDS = 20
_rates_cache = {"ts": 0, "data": None}
_rates_cache_lock = threading.Lock()

PARASITE_POOL_BASE_URL = "https://parasite.space"
PARASITE_STATS_CACHE_SECONDS = 30
_parasite_stats_cache = {}
_parasite_stats_cache_lock = threading.Lock()

PARASITE_REFINERY_CACHE_SECONDS = 30
_parasite_refinery_cache = {}
_parasite_refinery_cache_lock = threading.Lock()

PARASITE_REFINERY_STATUS_CACHE_SECONDS = 20
_parasite_refinery_status_cache = {"ts": 0, "data": None}
_parasite_refinery_status_cache_lock = threading.Lock()

USAGE_COUNTER_BASE = "https://countapi.mileshilliard.com/api/v1"
USAGE_COUNTER_PREFIX = "centro-de-comando-v3-" + GITHUB_REPO.split("/")[0]
USAGE_COUNTER_KEY = f"{USAGE_COUNTER_PREFIX}-app-starts"
USAGE_COUNTER_TIMEOUT = 4
UNIQUE_INSTALL_KEY = f"{USAGE_COUNTER_PREFIX}-unique-installs"
UNIQUE_INSTALL_MARKER_FILENAME = ".install_id"


def _usage_counter_hit(key):
    try:
        url = f"{USAGE_COUNTER_BASE}/hit/{key}"
        req = urllib.request.Request(url, headers={'User-Agent': 'CentroDeComando-UsageCounter'})
        with _urlopen_https(req, timeout=USAGE_COUNTER_TIMEOUT):
            pass
    except Exception:
        pass


def _install_marker_path():
    return os.path.join(writable_dir(), UNIQUE_INSTALL_MARKER_FILENAME)


def _is_first_run_on_this_machine():
    marker = _install_marker_path()
    if os.path.exists(marker):
        return False
    try:
        with open(marker, 'w', encoding='utf-8') as f:
            f.write(hashlib.sha256(os.urandom(16)).hexdigest())
    except Exception:
        pass
    return True


def track_app_start():
    def _run():
        _usage_counter_hit(USAGE_COUNTER_KEY)
        if _is_first_run_on_this_machine():
            _usage_counter_hit(UNIQUE_INSTALL_KEY)
    threading.Thread(target=_run, daemon=True).start()


def get_usage_count():
    result = {"starts": None, "unique_installs": None}
    for key, label in ((USAGE_COUNTER_KEY, "starts"), (UNIQUE_INSTALL_KEY, "unique_installs")):
        try:
            url = f"{USAGE_COUNTER_BASE}/get/{key}"
            req = urllib.request.Request(url, headers={'User-Agent': 'CentroDeComando-UsageCounter'})
            with _urlopen_https(req, timeout=USAGE_COUNTER_TIMEOUT) as resp:
                data = json.loads(resp.read().decode('utf-8', errors='ignore'))
            val = data.get("value")
            result[label] = int(val) if val is not None else None
        except Exception:
            pass
    return result


LAST_HEARTBEAT = {"ts": None}
HEARTBEAT_TIMEOUT = None
HEARTBEAT_GRACE = 20
SAFETY_NET_TIMEOUT_SECONDS = 30 * 60
SERVER_START_TS = time.time()
CLOSE_GRACE_SECONDS = 8
_pending_close_timer = {"timer": None}
_pending_close_lock = threading.Lock()


def _do_close_now():
    if remote_keepalive():
        print("[api/close] acesso remoto ativo - o servidor continua a correr (sai pelo ícone da bandeja).", flush=True)
        return
    print("[api/close] sem heartbeat novo dentro da janela de graça - a desligar.", flush=True)
    os._exit(0)


def cancel_pending_close():
    with _pending_close_lock:
        t = _pending_close_timer["timer"]
        if t is not None:
            t.cancel()
            _pending_close_timer["timer"] = None


def watchdog_loop():
    while True:
        time.sleep(30)
        if remote_keepalive():
            continue
        ts = LAST_HEARTBEAT["ts"] or SERVER_START_TS
        idle_for = time.time() - ts
        if idle_for > SAFETY_NET_TIMEOUT_SECONDS:
            print(f"[watchdog] rede de segurança: {idle_for:.0f}s sem qualquer heartbeat - "
                  f"a desligar processo zombie.", flush=True)
            os._exit(0)


NERDQAXE_SIGNATURE_FIELDS = {
    'ASICModel', 'hashRate', 'bestDiff', 'bestSessionDiff',
    'stratumURL', 'hostname', 'boardVersion'
}

# --- Suporte a máquinas LuxOS / Antminer (API cgminer TCP) -----------------
CGMINER_PORT = 4028
CGMINER_TIMEOUT = 2.5
CGMINER_SCAN_TIMEOUT = 0.6


CGMINER_KEY_CACHE = {}
CGMINER_IDENT_CACHE = {}


_cg_local = threading.local()
CGMINER_EXTRA_BUDGET = 3.0   # segundos para os comandos opcionais (pools, stats, placas...) depois do summary


def _cg_json(raw):
    try:
        raw = raw.rstrip(b'\x00').strip()
        return json.loads(raw.decode('utf-8', errors='ignore')) if raw else None
    except Exception:
        return None


def cgminer_command(ip, command, port=CGMINER_PORT, timeout=CGMINER_TIMEOUT, key=None):
    key = key or CGMINER_KEY_CACHE.get(ip, 'command')
    # dentro do fetch_cgminer_full há um prazo total: o painel desiste ao fim de 5,5 s e uma Antminer lenta com muitos comandos
    # a esperar o tempo todo cada um aparecia como "offline" mesmo estando a responder
    dl = getattr(_cg_local, 'deadline', None)
    if dl is not None:
        timeout = min(timeout, dl - time.time())
        if timeout < 0.15:
            return None
    try:
        t_end = time.time() + timeout
        with socket.create_connection((ip, port), timeout=timeout) as sock:
            sock.sendall(json.dumps({key: command}).encode('utf-8'))
            chunks = []
            while True:
                left = t_end - time.time()
                if left <= 0:
                    break
                # depois de já ter dados só espera um pouco mais: há firmwares (LuxOS) que não acabam a resposta com o byte NUL
                # nem fecham a ligação, e esperavam o tempo todo em cada comando
                sock.settimeout(min(left, 0.35) if chunks else left)
                try:
                    chunk = sock.recv(65536)
                except socket.timeout:
                    if chunks and _cg_json(b''.join(chunks)) is None and time.time() < t_end:
                        continue
                    break
                if not chunk:
                    break
                chunks.append(chunk)
                if chunk.endswith(b'\x00'):
                    break
            return _cg_json(b''.join(chunks))
    except Exception:
        return None


def cgminer_diagnose(ip, port=None):
    """Motivo provável de uma máquina cgminer/LuxOS/Antminer não estar a responder (texto curto)."""
    port = port or CGMINER_PORT
    try:
        socket.create_connection((ip, port), timeout=1.5).close()
    except socket.timeout:
        return f"sem resposta na porta {port}: máquina desligada, IP mudou ou está noutra rede"
    except ConnectionRefusedError:
        return f"porta {port} recusada: a API de mineração está desligada nesta máquina"
    except OSError as e:
        return f"não foi possível ligar à porta {port} ({getattr(e, 'strerror', None) or e})"
    raw = cgminer_command(ip, 'summary', port=port, timeout=2.5)
    if raw is None:
        raw = cgminer_command(ip, 'summary', port=port, timeout=2.5, key='cmd')
    if raw is None:
        return f"a porta {port} abre mas a máquina não responde ao comando summary a tempo (firmware lento, API bloqueada ou formato desconhecido)"
    if isinstance(raw, dict) and 'SUMMARY' in raw:
        return "a API responde bem (summary ok): o problema está na ligação do painel ou na lista de máquinas"
    try:
        st = (raw.get('STATUS') or [{}])[0]
        msg, code, desc = st.get('Msg'), st.get('Code'), st.get('Description')
    except Exception:
        msg = code = desc = None
    return f"a API respondeu com erro: «{msg}» (código {code}, {desc}): acesso restrito a certos IPs (api-allow) ou firmware sem este comando"


def _cgminer_scan_numeric_fields(stats_entry, prefix_pattern):
    values = []
    for key, val in stats_entry.items():
        if not re.search(prefix_pattern, key, re.IGNORECASE):
            continue
        try:
            num = float(val)
        except (TypeError, ValueError):
            continue
        if num > 0:
            values.append(num)
    return values


def _cgminer_scan_numeric_fields_recursive(node, prefix_pattern, _depth=0):
    values = []
    if _depth > 4:
        return values
    if isinstance(node, dict):
        for key, val in node.items():
            if isinstance(val, (dict, list)):
                values.extend(_cgminer_scan_numeric_fields_recursive(val, prefix_pattern, _depth + 1))
                continue
            if not re.search(prefix_pattern, key, re.IGNORECASE):
                continue
            try:
                num = float(val)
            except (TypeError, ValueError):
                continue
            if num > 0:
                values.append(num)
    elif isinstance(node, list):
        for item in node:
            values.extend(_cgminer_scan_numeric_fields_recursive(item, prefix_pattern, _depth + 1))
    return values


def cgminer_summary(ip, port, timeout=CGMINER_TIMEOUT):
    """summary com a chave 'command' (cgminer/LuxOS/Antminer/Avalon) ou 'cmd' (Whatsminer)."""
    data = cgminer_command(ip, 'summary', port=port, timeout=timeout)
    if data and 'SUMMARY' in data:
        return data
    data = cgminer_command(ip, 'summary', port=port, timeout=timeout, key='cmd')
    if data and 'SUMMARY' in data:
        CGMINER_KEY_CACHE[ip] = 'cmd'
        return data
    return None


def _avalon_tokens(text):
    return {k: v for k, v in re.findall(r'(\w+)\[([^\]]*)\]', text or '')}


def cgminer_identify(ip, port):
    """(marca, modelo) — Avalon (Canaan) e Whatsminer (MicroBT); cache de 10 min por IP."""
    now = time.time()
    c = CGMINER_IDENT_CACHE.get(ip)
    if c and now - c[0] < 600:
        return c[1], c[2]
    brand, model = '', ''
    try:
        if CGMINER_KEY_CACHE.get(ip) == 'cmd':
            brand = 'whatsminer'
            info = cgminer_command(ip, 'get_miner_info', port=port) or {}
            msg = info.get('Msg') if isinstance(info.get('Msg'), dict) else {}
            model = str(msg.get('type') or msg.get('miner_type') or 'Whatsminer')
            if model.lower() == 'whatsminer' or not model.lower().startswith('whatsminer'):
                model = 'Whatsminer ' + model if model.lower() != 'whatsminer' else model
        else:
            ver = (cgminer_command(ip, 'version', port=port) or {}).get('VERSION') or [{}]
            v = ver[0] if ver else {}
            prod = str(v.get('PROD') or v.get('Type') or '')
            if 'avalon' in prod.lower() or 'canaan' in prod.lower() or str(v.get('MODEL', '')).strip():
                brand = 'avalon'
                model = prod or ('Avalon ' + str(v.get('MODEL')))
            else:
                info = vnish_request(ip, '/api/v1/info', timeout=1.0)
                if isinstance(info, dict) and 'vnish' in json.dumps(info).lower():
                    brand = 'vnish'
                    model = str(info.get('miner') or info.get('model') or 'Antminer') + ' (Vnish)'
    except Exception:
        pass
    CGMINER_IDENT_CACHE[ip] = (now, brand, model)
    return brand, model


def probe_cgminer(ip, port=None):
    port = port or CGMINER_PORT
    data = cgminer_summary(ip, port, timeout=CGMINER_SCAN_TIMEOUT)
    if not data:
        # A porta cgminer (4028) respondeu, mas sem SUMMARY -- típico de LuxOS/cgminer
        # com a API de mineração restrita a certos IPs (ACL "api-allow", diferente
        # da palavra-passe da interface web). Mostra a máquina à mesma, com aviso.
        raw = cgminer_command(ip, 'summary', port=port, timeout=CGMINER_SCAN_TIMEOUT)
        if not (isinstance(raw, dict) and 'STATUS' in raw):
            return None
        # Goldshell (gsminer): a porta 4028 responde a tudo com "Invalid command" (código 14); a API útil é a HTTP /mcb, que o
        # probe_goldshell_http trata a seguir. Sem isto era marcada como "LuxOS (API restrita)" e como SHA-256 em vez de Scrypt.
        try:
            _st = (raw.get('STATUS') or [{}])[0]
        except Exception:
            _st = {}
        if not isinstance(_st, dict):
            _st = {}
        if 'gsminer' in str(_st.get('Description', '')).lower() or (
                _st.get('Code') == 14 and 'invalid command' in str(_st.get('Msg', '')).lower()):
            return None
        return {
            "ip": ip,
            "hostname": ip,
            "model": "LuxOS / cgminer (API restrita -- ativa o acesso remoto)",
            "protocol": "cgminer",
            "algorithm": "sha256",
            "type": "asic_sha256",
            "api_restricted": True,
        }
    version_desc = ''
    try:
        version_desc = (data.get('STATUS') or [{}])[0].get('Description', '')
    except Exception:
        pass
    
    desc_l = (version_desc or '').lower()
    is_scrypt = any(k in desc_l for k in ('l3', 'l7', 'scrypt', 'ltc', 'doge', 'dg', 'gridseed'))
    algo = 'scrypt' if is_scrypt else 'sha256'
    model = version_desc or ("Antminer Scrypt" if is_scrypt else "LuxOS / cgminer")
    try:
        _b, _m = cgminer_identify(ip, port or CGMINER_PORT)
        if _m:
            model = _m
    except Exception:
        pass

    return {
        "ip": ip,
        "hostname": ip,
        "model": model,
        "protocol": "cgminer",
        "algorithm": algo,
        "type": "asic_scrypt" if is_scrypt else "asic_sha256",
    }


def cgminer_extract_boards(ip, port, stats_entry, all_stats=None):
    """Hashrate, temperaturas e chips por placa (Antminer stock/LuxOS) + ventoinhas do chassis."""
    boards = {}
    def b(i):
        return boards.setdefault(int(i), {"id": int(i)})
    for key, val in (stats_entry or {}).items():
        m = re.match(r'^(chain_rate|chain_acn|temp_chip|temp_pcb|temp2_|temp|freq_avg|chain_acs)(\d+)$', key, re.I)
        if not m:
            continue
        name, idx = m.group(1).lower(), m.group(2)
        if name == 'chain_acs':
            if isinstance(val, str) and val.strip():
                b(idx)["chipStatus"] = val.strip()
            continue
        try:
            num = float(val)
        except (TypeError, ValueError):
            continue
        d = b(idx)
        if name == 'chain_rate':
            d["hashrate_ghs"] = num
        elif name == 'chain_acn':
            d["chips"] = int(num)
        elif name in ('temp_chip', 'temp2_'):
            d["tempChip"] = num
        elif name in ('temp_pcb', 'temp'):
            d.setdefault("tempPcb", num)
        elif name == 'freq_avg':
            d["freq"] = num
    avalon_entries = [e for e in (all_stats or []) if isinstance(e, dict)]
    for e in avalon_entries:
        for k, v in e.items():
            m = re.match(r'^MM ID(\d+)$', k)
            if not m or not isinstance(v, str):
                continue
            t = _avalon_tokens(v)
            d = b(m.group(1))
            for src, dst in (('GHSmm', 'hashrate_ghs'), ('TMax', 'tempChip'), ('Temp', 'tempPcb'), ('Freq', 'freq')):
                try:
                    d[dst] = float(t[src])
                except (KeyError, ValueError):
                    pass
    fan_list = [float(v) for k, v in sorted((stats_entry or {}).items()) if re.match(r'^fan\d+$', k, re.I) and str(v).replace('.', '', 1).isdigit() and float(v) > 0]
    if not any("hashrate_ghs" in d for d in boards.values()):
        # LuxOS: devs + temps + fans
        boards = {}
        devs = (cgminer_command(ip, 'devs', port=port) or {}).get('DEVS') or []
        for n, dv in enumerate(devs):
            i = dv.get('ASC', dv.get('ID', n))
            mhs = dv.get('MHS 5s') or dv.get('MHS av') or 0
            try:
                b(i)["hashrate_ghs"] = float(mhs) / 1000.0
            except (TypeError, ValueError):
                pass
            for src, dst in (('Chip Temp Avg', 'tempChip'), ('Temperature', 'tempPcb' if dv.get('Chip Temp Avg') else 'tempChip'),
                             ('Effective Chips', 'chips'), ('Chip Frequency', 'freq')):
                try:
                    if dv.get(src) not in (None, 0, '0'):
                        b(i)[dst] = float(dv.get(src)) if dst != 'chips' else int(float(dv.get(src)))
                except (TypeError, ValueError):
                    pass
        temps = (cgminer_command(ip, 'temps', port=port) or {}).get('TEMPS') or []
        for n, t in enumerate(temps):
            i = t.get('ID', n)
            for src, dst in (('Chip', 'tempChip'), ('Board', 'tempPcb')):
                try:
                    if float(t.get(src, 0)) > 0:
                        b(i)[dst] = float(t[src])
                except (TypeError, ValueError):
                    pass
        if not fan_list:
            fans = (cgminer_command(ip, 'fans', port=port) or {}).get('FANS') or []
            fan_list = [float(f.get('RPM')) for f in fans if f.get('RPM') not in (None, 0, '0')]
    out = [boards[k] for k in sorted(boards) if len(boards[k]) > 1]
    return out, fan_list


def fetch_cgminer_full(ip, port=None):
    port = port or CGMINER_PORT
    summary_data = cgminer_summary(ip, port)
    if not summary_data:
        return None
    _cg_local.deadline = time.time() + CGMINER_EXTRA_BUDGET   # o summary chega; o resto são extras com prazo
    try:
        return _fetch_cgminer_full(ip, port, summary_data)
    finally:
        _cg_local.deadline = None


def _fetch_cgminer_full(ip, port, summary_data):
    summary = (summary_data.get('SUMMARY') or [{}])[0]
    pools_data = cgminer_command(ip, 'pools', port=port) or {}
    pool_entry = (pools_data.get('POOLS') or [{}])
    pool_entry = pool_entry[0] if pool_entry else {}
    stats_data = cgminer_command(ip, 'stats', port=port) or {}
    stats_entries = stats_data.get('STATS') or []
    stats_entry = stats_entries[1] if len(stats_entries) > 1 else (stats_entries[0] if stats_entries else {})

    temps = _cgminer_scan_numeric_fields(stats_entry, r'temp')
    fans = _cgminer_scan_numeric_fields(stats_entry, r'fan')
    freqs = _cgminer_scan_numeric_fields(stats_entry, r'freq')
    # Avalon (Canaan): temperaturas/ventoinhas/frequência em strings "MM ID0" tipo Temp[..] Fan1[..]
    for _e in stats_entries:
        for _k, _v in (_e.items() if isinstance(_e, dict) else []):
            if re.match(r'^MM ID\d+$', _k) and isinstance(_v, str):
                _t = _avalon_tokens(_v)
                for _name, _lst in (('TMax', temps), ('Temp', temps), ('Freq', freqs)):
                    try:
                        if float(_t[_name]) > 0:
                            _lst.append(float(_t[_name]))
                    except (KeyError, ValueError):
                        pass
                for _fk, _fv in _t.items():
                    if re.match(r'^Fan\d+$', _fk):
                        try:
                            if float(_fv) > 0:
                                fans.append(float(_fv))
                        except ValueError:
                            pass
    # Whatsminer (MicroBT): temperatura e ventoinhas vêm no summary
    for _k in ('Temperature', 'Env Temp'):
        try:
            if float(summary.get(_k, 0)) > 0:
                temps.append(float(summary[_k]))
        except (TypeError, ValueError):
            pass
    for _k in ('Fan Speed In', 'Fan Speed Out'):
        try:
            if float(summary.get(_k, 0)) > 0:
                fans.append(float(summary[_k]))
        except (TypeError, ValueError):
            pass

    power_vals = []
    power_cmd_data = cgminer_command(ip, 'power', port=port)
    if power_cmd_data:
        power_vals = _cgminer_scan_numeric_fields_recursive(power_cmd_data, r'watt|actual|current.?power')

    if not power_vals:
        estats_data = cgminer_command(ip, 'estats', port=port) or {}
        estats_entries = estats_data.get('ESTATS') or estats_data.get('STATS') or []
        for entry in estats_entries:
            power_vals = _cgminer_scan_numeric_fields(entry, r'power|watt')
            if power_vals:
                break

    if not power_vals:
        power_vals = _cgminer_scan_numeric_fields(summary, r'power|watt')

    if not power_vals:
        power_vals = _cgminer_scan_numeric_fields(stats_entry, r'power|watt')

    if not power_vals:
        volt_vals = _cgminer_scan_numeric_fields(stats_entry, r'^volt|voltage')
        amp_vals = _cgminer_scan_numeric_fields(stats_entry, r'^amp|current(?!.?power)')
        if volt_vals and amp_vals:
            power_vals = [max(volt_vals) * max(amp_vals)]

    try:
        hashrate_ghs = float(summary.get('GHS 5s') or summary.get('GHS av') or (float(summary.get('MHS 5s') or 0) / 1000) or (float(summary.get('MHS 1m') or 0) / 1000) or (float(summary.get('MHS av') or 0) / 1000) or 0)
    except (TypeError, ValueError):
        hashrate_ghs = 0

    version_desc = ''
    try:
        version_desc = (summary_data.get('STATUS') or [{}])[0].get('Description', '')
    except Exception:
        pass

    desc_l = (version_desc or '').lower()
    is_scrypt = any(k in desc_l for k in ('l3', 'l7', 'scrypt', 'ltc', 'doge', 'dg', 'gridseed'))
    algo = 'scrypt' if is_scrypt else 'sha256'
    m_type = 'asic_scrypt' if is_scrypt else 'asic_sha256'

    if is_scrypt and hashrate_ghs < 1.0:
        hashrate_disp = f"{(hashrate_ghs * 1000):.2f} MH/s"
    elif hashrate_ghs >= 1000:
        hashrate_disp = f"{(hashrate_ghs / 1000):.2f} TH/s"
    else:
        hashrate_disp = f"{hashrate_ghs:.2f} GH/s"

    pool_url = pool_entry.get('URL') or pool_entry.get('Stratum URL') or '—'

    try:
        _boards, _fan_list = cgminer_extract_boards(ip, port, stats_entry, stats_entries)
    except Exception:
        _boards, _fan_list = [], []
    try:
        _brand, _ident = cgminer_identify(ip, port)
    except Exception:
        _brand, _ident = '', ''
    _vn = {}
    if _brand == 'vnish':
        try:
            _vn = vnish_enrich(ip) or {}
        except Exception:
            _vn = {}

    return {
        "hostname": ip,
        "ASICModel": _ident or version_desc or ("Antminer Scrypt" if is_scrypt else "LuxOS / Antminer"),
        "brand": _brand or None,
        "firmwareVersion": version_desc or None,
        "algorithm": algo,
        "type": m_type,
        "hashRate": hashrate_ghs,
        "hashrate_raw": hashrate_ghs * 1e9,
        "hashrate_display": hashrate_disp,
        "temp": max(temps) if temps else None,
        "fanrpm": max(fans) if fans else 0,
        "frequency": (sum(freqs) / len(freqs)) if freqs else 0,
        "power": _vn.get("power") or (max(power_vals) if power_vals else None),
        "sharesAccepted": summary.get('Accepted', 0),
        "sharesRejected": summary.get('Rejected', 0),
        "bestDiff": summary.get('Best Share', 0),
        "bestSessionDiff": summary.get('Best Share', 0),
        "stratumURL": pool_url,
        "uptimeSeconds": summary.get('Elapsed', 0),
        "protocol": "cgminer",
        "boards": _vn.get("boards") or _boards,
        "fanList": _vn.get("fanList") or _fan_list,
    }


# --- Suporte a Goldshell (API HTTP "Goldshell Hub") -----------------------
GOLDSHELL_HTTP_TIMEOUT = 2.5
GOLDSHELL_HTTP_SCAN_TIMEOUT = 0.6
_GOLDSHELL_NUMBER_RE = re.compile(r'[-+]?\d*\.?\d+')


def fetch_goldshell_devs(ip, timeout=GOLDSHELL_HTTP_TIMEOUT):
    try:
        url = f"http://{ip}/mcb/cgminer?cgminercmd=devs"
        req = urllib.request.Request(
            url, headers={'User-Agent': 'NerdQaxeDashboard/1.0', 'Accept': 'application/json'}
        )
        with _urlopen_https(req, timeout=timeout) as resp:
            raw = resp.read()
        return json.loads(raw.decode('utf-8', errors='ignore'))
    except Exception:
        return None


# ---------------- VNish (Antminer) e ePIC ----------------
VNISH_PASSWORD = os.environ.get('VNISH_PASSWORD', 'admin')
VNISH_TOKEN_CACHE = {}


def _http_json(url, headers=None, data=None, timeout=1.5):
    req = urllib.request.Request(url, data=data, headers=dict({'User-Agent': 'HashCommander', 'Accept': 'application/json'}, **(headers or {})))
    with _urlopen_https(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8', 'replace'))


def vnish_request(ip, path, token=None, timeout=1.5):
    try:
        h = {'Authorization': f'Bearer {token}'} if token else {}
        return _http_json(f"http://{ip}{path}", headers=h, timeout=timeout)
    except Exception:
        return None


def vnish_token(ip):
    c = VNISH_TOKEN_CACHE.get(ip)
    if c and time.time() - c[0] < 1800:
        return c[1]
    try:
        r = _http_json(f"http://{ip}/api/v1/unlock", headers={'Content-Type': 'application/json'},
                       data=json.dumps({"pw": VNISH_PASSWORD}).encode('utf-8'), timeout=2.0)
        tok = (r or {}).get('token')
    except Exception:
        tok = None
    VNISH_TOKEN_CACHE[ip] = (time.time(), tok)
    return tok


def _num(v):
    if isinstance(v, dict):
        v = v.get('max', v.get('avg', v.get('value')))
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def vnish_enrich(ip):
    """Placas, ventoinhas e potência pela API web do VNish (a API cgminer já dá o resto)."""
    tok = vnish_token(ip)
    s = vnish_request(ip, '/api/v1/summary', token=tok) if tok else None
    if not isinstance(s, dict):
        return {}
    m = s.get('miner') if isinstance(s.get('miner'), dict) else s
    boards = []
    for n, c in enumerate(m.get('chains') or []):
        hr = _num(c.get('hashrate_rt') if c.get('hashrate_rt') is not None else c.get('hashrate_ideal'))
        b = {"id": c.get('id', n)}
        if hr is not None:
            b["hashrate_ghs"] = hr * 1000 if hr < 1000 else hr   # TH/s ou GH/s
        for src, dst in (('chip_temp', 'tempChip'), ('pcb_temp', 'tempPcb'), ('frequency', 'freq')):
            v = _num(c.get(src))
            if v is not None:
                b[dst] = v
        if len(b) > 1:
            boards.append(b)
    cooling = m.get('cooling') or {}
    fans = [float(f['rpm']) for f in (cooling.get('fans') or []) if isinstance(f, dict) and f.get('rpm')]
    return {"boards": boards, "fanList": fans, "power": _num(m.get('power_usage'))}


def epic_get(ip, path='/summary', timeout=1.5):
    try:
        return _http_json(f"http://{ip}:4028{path}", timeout=timeout)
    except Exception:
        return None


def probe_epic(ip):
    d = epic_get(ip, '/summary', timeout=1.0)
    if not isinstance(d, dict) or not ('HBs' in d or 'powerplay' in str(d.get('Software', '')).lower()):
        return None
    return {"ip": ip, "hostname": d.get('Hostname') or ip, "model": "ePIC " + str(d.get('Software') or 'PowerPlay'),
            "protocol": "epic", "algorithm": "sha256", "type": "asic_sha256"}


def _epic_nums(v):
    if isinstance(v, (list, tuple)):
        return [x for x in (_num(i) for i in v) if x is not None]
    n = _num(v)
    return [n] if n is not None else []


def fetch_epic_full(ip):
    d = epic_get(ip, '/summary')
    if not isinstance(d, dict):
        return None
    sess = d.get('Session') if isinstance(d.get('Session'), dict) else {}
    boards, temps = [], []
    for n, hb in enumerate(d.get('HBs') or []):
        if not isinstance(hb, dict):
            continue
        b = {"id": hb.get('Index', n)}
        hr = sum(_epic_nums(hb.get('Hashrate')))
        if hr:
            b["hashrate_ghs"] = hr / 1000.0   # MH/s -> GH/s
        t = _num(hb.get('Temperature'))
        if t is not None:
            b["tempChip"] = t
            temps.append(t)
        f = _num(hb.get('Core Clock Avg') if hb.get('Core Clock Avg') is not None else hb.get('Core Clock'))
        if f is not None:
            b["freq"] = f
        if len(b) > 1:
            boards.append(b)
    mhs = None
    la = sess.get('LastAverageMHs')
    if isinstance(la, dict):
        mhs = _num(la.get('Hashrate 1m') or la.get('Hashrate 5m') or la.get('Hashrate 5s'))
    if not mhs:
        mhs = _num(sess.get('Average MHs'))
    ghs = (mhs / 1000.0) if mhs else sum(b.get('hashrate_ghs', 0) for b in boards)
    fans = []
    fd = d.get('Fans') if isinstance(d.get('Fans'), dict) else {}
    for k, v in fd.items():
        if 'rpm' in k.lower():
            fans += [x for x in _epic_nums(v) if x > 0]
    ps = d.get('Power Supply Stats') if isinstance(d.get('Power Supply Stats'), dict) else {}
    power = _num(ps.get('Input Power') if ps.get('Input Power') is not None else ps.get('Output Power'))
    if power is None and _num(ps.get('Input Voltage')) and _num(ps.get('Input Current')):
        power = _num(ps['Input Voltage']) * _num(ps['Input Current'])
    st = d.get('Stratum') if isinstance(d.get('Stratum'), dict) else {}
    disp = f"{ghs / 1000:.2f} TH/s" if ghs >= 1000 else f"{ghs:.2f} GH/s"
    return {
        "hostname": d.get('Hostname') or ip, "ASICModel": "ePIC " + str(d.get('Software') or 'PowerPlay'),
        "brand": "epic", "firmwareVersion": d.get('Software'), "algorithm": "sha256", "type": "asic_sha256",
        "hashRate": ghs, "hashrate_raw": ghs * 1e9, "hashrate_display": disp,
        "temp": max(temps) if temps else None, "fanrpm": max(fans) if fans else 0,
        "frequency": (sum(b['freq'] for b in boards if 'freq' in b) / max(1, len([b for b in boards if 'freq' in b]))),
        "power": power, "sharesAccepted": sess.get('Accepted', 0), "sharesRejected": sess.get('Rejected', 0),
        "bestDiff": sess.get('Best Share', 0), "bestSessionDiff": sess.get('Best Share', 0),
        "stratumURL": st.get('Current Pool') or '—', "uptimeSeconds": sess.get('Uptime', 0),
        "protocol": "epic", "boards": boards, "fanList": fans,
    }


def probe_goldshell_http(ip):
    # A Goldshell demora ~0,9 s a responder ao /mcb/cgminer, mais do que o tempo de espera da pesquisa (0,6 s): por isso
    # primeiro vê (rápido) se a porta 80 está aberta e só depois espera o tempo todo. IPs sem máquina continuam a falhar depressa.
    try:
        with socket.create_connection((ip, 80), timeout=GOLDSHELL_HTTP_SCAN_TIMEOUT):
            pass
    except Exception:
        return None
    data = fetch_goldshell_devs(ip, timeout=GOLDSHELL_HTTP_TIMEOUT)
    if not data or 'minfos' not in data:
        return None
    algo_names = [m.get('name') for m in (data.get('minfos') or []) if m.get('name')]
    algo_str = ", ".join(algo_names).lower() if algo_names else "scrypt"
    return {
        "ip": ip,
        "hostname": ip,
        "model": ", ".join(algo_names) or "Goldshell ASIC",
        "protocol": "goldshell-http",
        "algorithm": "scrypt" if "scrypt" in algo_str else algo_str,
        "type": "asic_scrypt" if "scrypt" in algo_str else "asic",
    }


def _goldshell_parse_numbers(text):
    if text is None:
        return []
    try:
        return [float(x) for x in _GOLDSHELL_NUMBER_RE.findall(str(text))]
    except Exception:
        return []


def fetch_goldshell_http_full(ip):
    data = fetch_goldshell_devs(ip)
    if not data or 'minfos' not in data:
        return None

    minfos = data.get('minfos') or []
    algo_names = []
    all_infos = []
    for m in minfos:
        if m.get('name'):
            algo_names.append(m['name'])
        all_infos.extend(m.get('infos') or [])

    if not all_infos:
        return None

    temps, fans, powers = [], [], []
    hashrate_mhs_total = 0.0
    accepted_total = 0
    rejected_total = 0
    uptime_minutes_max = 0.0

    for entry in all_infos:
        temps.extend(_goldshell_parse_numbers(entry.get('temp')))
        fans.extend(_goldshell_parse_numbers(entry.get('fanspeed')))
        powers.extend(_goldshell_parse_numbers(entry.get('power')))
        try:
            hashrate_mhs_total += float(entry.get('hashrate') or entry.get('av_hashrate') or 0)
        except (TypeError, ValueError):
            pass
        try:
            accepted_total += int(entry.get('accepted') or 0)
        except (TypeError, ValueError):
            pass
        try:
            rejected_total += int(entry.get('rejected') or 0)
        except (TypeError, ValueError):
            pass
        try:
            uptime_minutes_max = max(uptime_minutes_max, float(entry.get('time') or 0))
        except (TypeError, ValueError):
            pass

    algo_str = ", ".join(algo_names).lower() if algo_names else "scrypt"
    algo_key = "scrypt" if "scrypt" in algo_str else algo_str

    if hashrate_mhs_total >= 1000:
        hashrate_disp = f"{(hashrate_mhs_total / 1000):.2f} GH/s"
    else:
        hashrate_disp = f"{hashrate_mhs_total:.2f} MH/s"

    return {
        "hostname": ip,
        "ASICModel": ", ".join(algo_names) or "Goldshell Scrypt",
        "firmwareVersion": None,
        "algorithm": algo_key,
        "type": "asic_scrypt" if algo_key == "scrypt" else "asic",
        "hashRate": hashrate_mhs_total / 1000,
        "hashrate_raw": hashrate_mhs_total * 1_000_000,
        "hashrate_display": hashrate_disp,
        "temp": max(temps) if temps else None,
        "fanrpm": max(fans) if fans else 0,
        "frequency": 0,
        "power": sum(powers) if powers else None,
        "sharesAccepted": accepted_total,
        "sharesRejected": rejected_total,
        "bestDiff": 0,
        "bestSessionDiff": 0,
        "stratumURL": "—",
        "uptimeSeconds": uptime_minutes_max * 60,
        "protocol": "goldshell-http",
    }


# --- Suporte a SRBMiner-Multi (API HTTP / GPU & CPU) ----------------------
SRBMINER_PORT = 21562
SRBMINER_TIMEOUT = 2.5
SRBMINER_SCAN_TIMEOUT = 0.6


def fetch_srbminer_stats(ip, port=SRBMINER_PORT, timeout=SRBMINER_TIMEOUT):
    try:
        url = f"http://{ip}:{port}/stats"
        req = urllib.request.Request(
            url, headers={'User-Agent': 'NerdQaxeDashboard/1.0', 'Accept': 'application/json'}
        )
        with _urlopen_https(req, timeout=timeout) as resp:
            raw = resp.read()
        return json.loads(raw.decode('utf-8', errors='ignore'))
    except Exception:
        return None


def probe_srbminer(ip, port=SRBMINER_PORT):
    data = fetch_srbminer_stats(ip, port=port, timeout=SRBMINER_SCAN_TIMEOUT)
    if not data or not isinstance(data, dict):
        return None
    if 'algorithms' not in data and 'devices' not in data and 'miner_version' not in data:
        return None
    algos = [a.get('name') for a in data.get('algorithms', []) if a.get('name')]
    algo_str = ", ".join(algos).upper() if algos else "GPU"
    return {
        "ip": ip,
        "hostname": ip,
        "model": f"SRBMiner-Multi ({algo_str})",
        "protocol": "srbminer-http",
        "algorithm": algo_str.lower(),
        "type": "gpu_rig",
    }


def fetch_srbminer_full(ip, port=SRBMINER_PORT):
    data = fetch_srbminer_stats(ip, port=port)
    if not data or not isinstance(data, dict):
        return None

    algos = data.get("algorithms", [])
    main_algo = algos[0] if algos else {}
    algo_name = str(main_algo.get("name") or "GPU").upper()

    hps = float(main_algo.get("hashrate") or main_algo.get("hashrate_raw") or 0.0)

    devices = data.get("devices", [])
    powers = [d.get("power", 0) for d in devices if isinstance(d.get("power"), (int, float))]
    temps = [d.get("temperature", 0) for d in devices if isinstance(d.get("temperature"), (int, float)) and d.get("temperature", 0) > 0]
    fans = [d.get("fan_speed", 0) for d in devices if isinstance(d.get("fan_speed"), (int, float))]

    total_power = sum(powers) if powers else None
    max_temp = max(temps) if temps else None
    avg_fan = int(sum(fans) / len(fans)) if fans else 0

    if hps >= 1e12:
        disp_hr = f"{hps / 1e12:.2f} TH/s"
    elif hps >= 1e9:
        disp_hr = f"{hps / 1e9:.2f} GH/s"
    elif hps >= 1e6:
        disp_hr = f"{hps / 1e6:.2f} MH/s"
    elif hps >= 1e3:
        disp_hr = f"{hps / 1e3:.2f} kH/s"
    else:
        disp_hr = f"{hps:.0f} H/s"

    shares = main_algo.get("shares", {}) or {}
    pool = main_algo.get("pool", {}) or {}
    pool_url = pool.get("url") or pool.get("pool") or "—"

    return {
        "hostname": ip,
        "ASICModel": f"SRBMiner ({algo_name})",
        "firmwareVersion": data.get("miner_version"),
        "algorithm": algo_name.lower(),
        "type": "gpu_rig",
        "hashRate": hps / 1e9,
        "hashrate_raw": hps,
        "hashrate_display": disp_hr,
        "temp": max_temp,
        "fanrpm": avg_fan,
        "frequency": 0,
        "power": total_power,
        "sharesAccepted": shares.get("accepted", 0),
        "sharesRejected": shares.get("rejected", 0),
        "bestDiff": shares.get("best_diff", 0),
        "bestSessionDiff": shares.get("best_diff", 0),
        "stratumURL": pool_url,
        "uptimeSeconds": data.get("mining_time", 0),
        "protocol": "srbminer-http",
        "device_details": {
            "gpu_count": len(devices),
            "devices": [d.get("name", "GPU") for d in devices]
        }
    }


# --- Suporte a T-Rex Miner (API HTTP / NVIDIA GPU) ------------------------
TREX_PORT = 4067
TREX_TIMEOUT = 2.5
TREX_SCAN_TIMEOUT = 0.6


def fetch_trex_summary(ip, port=TREX_PORT, timeout=TREX_TIMEOUT):
    try:
        url = f"http://{ip}:{port}/summary"
        req = urllib.request.Request(
            url, headers={'User-Agent': 'NerdQaxeDashboard/1.0', 'Accept': 'application/json'}
        )
        with _urlopen_https(req, timeout=timeout) as resp:
            raw = resp.read()
        return json.loads(raw.decode('utf-8', errors='ignore'))
    except Exception:
        return None


def probe_trex(ip, port=TREX_PORT):
    data = fetch_trex_summary(ip, port=port, timeout=TREX_SCAN_TIMEOUT)
    if not data or not isinstance(data, dict):
        return None
    if 'algorithm' not in data and 'gpus' not in data:
        return None
    algo = str(data.get('algorithm') or "GPU").upper()
    return {
        "ip": ip,
        "hostname": ip,
        "model": f"T-Rex ({algo})",
        "protocol": "trex-http",
        "algorithm": algo.lower(),
        "type": "gpu_rig",
    }


def fetch_trex_full(ip, port=TREX_PORT):
    data = fetch_trex_summary(ip, port=port)
    if not data or not isinstance(data, dict):
        return None

    algo_name = str(data.get("algorithm") or "GPU").upper()
    hps = float(data.get("hashrate") or 0.0)

    gpus = data.get("gpus", [])
    powers = [g.get("power", 0) for g in gpus if isinstance(g.get("power"), (int, float))]
    temps = [g.get("temperature", 0) for g in gpus if isinstance(g.get("temperature"), (int, float)) and g.get("temperature", 0) > 0]
    fans = [g.get("fan_speed", 0) for g in gpus if isinstance(g.get("fan_speed"), (int, float))]

    total_power = sum(powers) if powers else None
    max_temp = max(temps) if temps else None
    avg_fan = int(sum(fans) / len(fans)) if fans else 0

    if hps >= 1e12:
        disp_hr = f"{hps / 1e12:.2f} TH/s"
    elif hps >= 1e9:
        disp_hr = f"{hps / 1e9:.2f} GH/s"
    elif hps >= 1e6:
        disp_hr = f"{hps / 1e6:.2f} MH/s"
    elif hps >= 1e3:
        disp_hr = f"{hps / 1e3:.2f} kH/s"
    else:
        disp_hr = f"{hps:.0f} H/s"

    pool_url = (data.get("active_pool") or {}).get("url") or (data.get("pool") or {}).get("url") or "—"

    return {
        "hostname": ip,
        "ASICModel": f"T-Rex ({algo_name})",
        "firmwareVersion": data.get("version"),
        "algorithm": algo_name.lower(),
        "type": "gpu_rig",
        "hashRate": hps / 1e9,
        "hashrate_raw": hps,
        "hashrate_display": disp_hr,
        "temp": max_temp,
        "fanrpm": avg_fan,
        "frequency": 0,
        "power": total_power,
        "sharesAccepted": data.get("accepted_count", 0),
        "sharesRejected": data.get("rejected_count", 0),
        "bestDiff": 0,
        "bestSessionDiff": 0,
        "stratumURL": pool_url,
        "uptimeSeconds": data.get("uptime", 0),
        "protocol": "trex-http",
        "device_details": {
            "gpu_count": len(gpus),
            "devices": [g.get("name", "GPU") for g in gpus]
        }
    }


# --- Troca Automática de Pool (fee + latência) ------------------------------
POOLS_CATALOG = [
    {"id": "antpool", "name": "AntPool", "host": "stratum.antpool.com", "port": 3333, "fee_percent": 2.5},
    {"id": "f2pool", "name": "F2Pool", "host": "btc.f2pool.com", "port": 3333, "fee_percent": 2.5},
    {"id": "viabtc", "name": "ViaBTC", "host": "btc.viabtc.com", "port": 3333, "fee_percent": 2.0},
    {"id": "braiins", "name": "Braiins Pool", "host": "stratum.braiins.com", "port": 3333, "fee_percent": 2.0},
    {"id": "luxor", "name": "Luxor", "host": "btc.global.luxor.tech", "port": 700, "fee_percent": 2.5},
    {"id": "foundry", "name": "Foundry USA", "host": "btc.global.foundrydigital.com", "port": 3333, "fee_percent": 0.0},
]

POOL_LATENCY_CACHE_SECONDS = 120
_pool_catalog_cache = {"ts": 0, "data": None}
_pool_catalog_cache_lock = threading.Lock()

POOL_LOG_FILENAME = 'pool_switch_log.json'
POOL_LOG_MAX_ENTRIES = 200
_pool_log_lock = threading.Lock()


def pool_log_path():
    return os.path.join(writable_dir(), POOL_LOG_FILENAME)


def load_pool_log():
    try:
        with open(pool_log_path(), 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def append_pool_log(device, pool_name, ok, automatic, message=""):
    with _pool_log_lock:
        log = load_pool_log()
        log.insert(0, {
            "ts": time.time(),
            "device": device,
            "pool": pool_name,
            "ok": bool(ok),
            "automatic": bool(automatic),
            "message": message,
        })
        log = log[:POOL_LOG_MAX_ENTRIES]
        try:
            with open(pool_log_path(), 'w', encoding='utf-8') as f:
                json.dump(log, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
        return log


def measure_tcp_latency(host, port, timeout=1.5):
    start = time.time()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            pass
        return round((time.time() - start) * 1000, 1)
    except Exception:
        return None


def get_pools_catalog_with_latency(force=False):
    with _pool_catalog_cache_lock:
        cached = _pool_catalog_cache["data"]
        age = time.time() - _pool_catalog_cache["ts"]
        if cached is not None and not force and age < POOL_LATENCY_CACHE_SECONDS:
            return cached

    results = []
    with ThreadPoolExecutor(max_workers=len(POOLS_CATALOG) or 1) as executor:
        futures = {
            executor.submit(measure_tcp_latency, p["host"], p["port"]): p
            for p in POOLS_CATALOG
        }
        for future in as_completed(futures):
            p = futures[future]
            entry = dict(p)
            entry["latencyMs"] = future.result()
            results.append(entry)

    results.sort(key=lambda p: p["id"])
    with _pool_catalog_cache_lock:
        _pool_catalog_cache["ts"] = time.time()
        _pool_catalog_cache["data"] = results
    return results


def score_pool(pool, min_gain_percent=0):
    if pool.get("latencyMs") is None:
        return pool.get("fee_percent", 0) + 1000
    return pool.get("fee_percent", 0) + (pool["latencyMs"] / 100) * 0.5


def build_stratum_user(btc_address, worker_suffix, device_name):
    addr = (btc_address or "").strip()
    if not addr:
        return None
    suffix = (worker_suffix or "").strip() or device_name or "worker"
    suffix = "".join(ch for ch in suffix if ch.isalnum() or ch in "-_") or "worker"
    return f"{addr}.{suffix}"


def switch_device_pool(ip, pool, btc_address, worker_suffix, device_name):
    stratum_user = build_stratum_user(btc_address, worker_suffix, device_name)
    if not stratum_user:
        return False, "Endereço BTC não configurado"

    with endpoint_cache_lock:
        protocol = endpoint_cache.get(ip, 'info')

    if protocol == 'cgminer':
        stratum_url = f"stratum+tcp://{pool['host']}:{pool['port']}"
        add_result = cgminer_command(ip, f"addpool,{stratum_url},{stratum_user},x")
        if not add_result:
            return False, "Sem resposta da API cgminer/LuxOS ao adicionar pool"
        pools_data = cgminer_command(ip, 'pools') or {}
        pools = pools_data.get('POOLS') or []
        idx = None
        for p in pools:
            if p.get('URL') == stratum_url:
                idx = p.get('POOL')
                break
        if idx is None:
            return False, "Pool adicionada mas não encontrada na lista para ativar"
        switch_result = cgminer_command(ip, f"switchpool,{idx}")
        if not switch_result:
            return False, "Falha ao ativar a pool adicionada (switchpool)"
        return True, "ok"

    if protocol in ('goldshell-http', 'srbminer-http', 'trex-http', 'epic'):
        return False, f"Troca automática de pool não suportada para o protocolo {protocol}"

    try:
        payload = json.dumps({
            "stratumURL": pool["host"],
            "stratumPort": pool["port"],
            "stratumUser": stratum_user,
            "stratumPassword": "x",
        }).encode('utf-8')
        req = urllib.request.Request(
            f"http://{ip}/api/system",
            data=payload,
            method='PATCH',
            headers={'Content-Type': 'application/json'},
        )
        with _urlopen_https(req, timeout=5) as resp:
            resp.read()
        return True, "ok"
    except Exception as e:
        return False, str(e)


coolant_lock = threading.Lock()
coolant_state = {"reading": None, "ts": 0, "error": "", "low_since": None, "tripped": False,
                 "trip_reason": "", "trip_ts": 0, "relay_result": "", "history": []}


def _coolant_num(d, *keys):
    for k in keys:
        try:
            v = d.get(k)
            if v is not None:
                return float(v)
        except (TypeError, ValueError):
            pass
    return None


def coolant_fetch_sensor(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'HashCommander-Coolant'})
    with _urlopen_https(req, timeout=3) as resp:
        d = json.loads(resp.read().decode('utf-8', 'replace'))
    return {
        "flow_lpm": _coolant_num(d, "flow_lpm", "flow", "lpm"),
        "coolant_in_c": _coolant_num(d, "coolant_in_c", "coolant_in", "temp_in", "in"),
        "coolant_out_c": _coolant_num(d, "coolant_out_c", "coolant_out", "temp_out", "out"),
    }


def coolant_call_relay(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'HashCommander-Coolant'})
        with _urlopen_https(req, timeout=3) as resp:
            return f"HTTP {resp.status}"
    except Exception as e:
        return f"erro: {e}"


def coolant_trip(cfg, reason):
    with coolant_lock:
        if coolant_state["tripped"]:
            return
        coolant_state["tripped"] = True
        coolant_state["trip_reason"] = reason
        coolant_state["trip_ts"] = time.time()
    result = "killswitch desativado (apenas alerta)"
    if cfg.get("killswitch_enabled") and (cfg.get("relay_off_url") or "").strip():
        for _ in range(3):
            result = coolant_call_relay(cfg["relay_off_url"].strip())
            if not result.startswith("erro"):
                break
    with coolant_lock:
        coolant_state["relay_result"] = result
    print(f"[coolant] KILLSWITCH: {reason} -> relé: {result}", flush=True)


def coolant_loop():
    while True:
        with POWER_CONFIG_LOCK:
            cfg = copy.deepcopy(power_config.get("coolant", {}) or {})
        if cfg.get("enabled") and (cfg.get("sensor_url") or "").strip():
            try:
                r = coolant_fetch_sensor(cfg["sensor_url"].strip())
                now = time.time()
                min_flow = float(cfg.get("min_flow_lpm", 1.0))
                grace = float(cfg.get("grace_seconds", 5))
                max_out = float(cfg.get("max_coolant_out_c", 60))
                reason = None
                with coolant_lock:
                    coolant_state.update(reading=r, ts=now, error="")
                    coolant_state["history"].append({"t": now, **r})
                    del coolant_state["history"][:-900]
                    if r["flow_lpm"] is not None and r["flow_lpm"] < min_flow:
                        if coolant_state["low_since"] is None:
                            coolant_state["low_since"] = now
                        if now - coolant_state["low_since"] >= grace:
                            reason = f"fluxo {r['flow_lpm']:.2f} L/min abaixo de {min_flow} durante {grace:.0f}s"
                    else:
                        coolant_state["low_since"] = None
                if reason is None and r["coolant_out_c"] is not None and r["coolant_out_c"] > max_out:
                    reason = f"líquido à saída a {r['coolant_out_c']:.1f} °C (limite {max_out:.0f} °C)"
                if reason:
                    coolant_trip(cfg, reason)
            except Exception as e:
                with coolant_lock:
                    coolant_state["error"] = str(e)[:160]
        time.sleep(2)


def pool_autoswitch_loop():
    while True:
        with POWER_CONFIG_LOCK:
            devices = copy.deepcopy(power_config.get("devices", []))
            pools_cfg = copy.deepcopy(power_config.get("pools", {}) or {})

        interval_min = pools_cfg.get("eval_interval_minutes") or 15
        try:
            interval_min = max(1, float(interval_min))
        except Exception:
            interval_min = 15

        auto_devices = [d for d in devices if d.get("poolAuto")]
        if auto_devices and (pools_cfg.get("btc_address") or "").strip():
            catalog = get_pools_catalog_with_latency()
            min_gain = pools_cfg.get("min_gain_percent", 5) or 0
            scored = sorted(catalog, key=score_pool)
            best = scored[0] if scored else None

            if best:
                for dev in auto_devices:
                    ip = dev.get("ip")
                    if not ip:
                        continue
                    with LATEST_READINGS_LOCK:
                        cached = LATEST_READINGS.get(ip)
                    current_url = ''
                    if cached and (time.time() - cached["ts"]) < READING_MAX_AGE:
                        current_url = str(cached["data"].get("stratumURL") or '')
                    already_best = best["host"] in current_url
                    if already_best:
                        continue

                    current_pool = next((p for p in catalog if p["host"] in current_url), None)
                    if current_pool:
                        gain = score_pool(current_pool) - score_pool(best)
                        gain_pct = gain
                        if gain_pct < min_gain:
                            continue

                    ok, msg = switch_device_pool(
                        ip, best,
                        pools_cfg.get("btc_address"),
                        pools_cfg.get("worker_suffix"),
                        dev.get("name") or ip,
                    )
                    append_pool_log(dev.get("name") or ip, best["name"], ok, True, msg)
                    with endpoint_cache_lock:
                        endpoint_cache.pop(ip, None)

        time.sleep(max(60, interval_min * 60))


DIFF_HISTORY_FILENAME = 'diff_history.json'
_diff_history_lock = threading.Lock()
_diff_history_cache = None


def diff_history_path():
    return os.path.join(writable_dir(), DIFF_HISTORY_FILENAME)


def load_diff_history():
    global _diff_history_cache
    if _diff_history_cache is not None:
        return _diff_history_cache
    try:
        with open(diff_history_path(), 'r', encoding='utf-8') as f:
            data = json.load(f)
        _diff_history_cache = data if isinstance(data, dict) else {}
    except Exception:
        _diff_history_cache = {}
    return _diff_history_cache


def save_diff_history():
    try:
        with open(diff_history_path(), 'w', encoding='utf-8') as f:
            json.dump(_diff_history_cache or {}, f, ensure_ascii=False)
    except Exception:
        pass


def record_diff_history(ip, best_diff):
    if not best_diff:
        return
    try:
        best_diff = float(best_diff)
    except (TypeError, ValueError):
        return
    if best_diff <= 0:
        return
    day_key = time.strftime('%Y-%m-%d')
    with _diff_history_lock:
        hist = load_diff_history()
        by_day = hist.setdefault(ip, {})
        if best_diff > by_day.get(day_key, 0):
            by_day[day_key] = best_diff
            save_diff_history()


DIFF_BUCKETS_FILENAME = 'diff_buckets.json'
DIFF_BUCKET_SECONDS = 15 * 60
DIFF_BUCKETS_MAX_AGE = 7 * 86400
_diff_buckets_lock = threading.Lock()
_diff_buckets_cache = None


def diff_buckets_path():
    return os.path.join(writable_dir(), DIFF_BUCKETS_FILENAME)


def load_diff_buckets():
    global _diff_buckets_cache
    if _diff_buckets_cache is not None:
        return _diff_buckets_cache
    try:
        with open(diff_buckets_path(), 'r', encoding='utf-8') as f:
            data = json.load(f)
        _diff_buckets_cache = data if isinstance(data, dict) else {}
    except Exception:
        _diff_buckets_cache = {}
    return _diff_buckets_cache


def save_diff_buckets():
    try:
        with open(diff_buckets_path(), 'w', encoding='utf-8') as f:
            json.dump(_diff_buckets_cache or {}, f, ensure_ascii=False)
    except Exception:
        pass


def record_diff_bucket(ip, best_diff):
    if not best_diff:
        return
    try:
        best_diff = float(best_diff)
    except (TypeError, ValueError):
        return
    if best_diff <= 0:
        return
    now = time.time()
    bucket_key = str(int(now // DIFF_BUCKET_SECONDS) * DIFF_BUCKET_SECONDS)
    with _diff_buckets_lock:
        buckets = load_diff_buckets()
        by_bucket = buckets.setdefault(ip, {})
        changed = False
        if best_diff > by_bucket.get(bucket_key, 0):
            by_bucket[bucket_key] = best_diff
            changed = True
        cutoff = now - DIFF_BUCKETS_MAX_AGE
        stale = [k for k in by_bucket if float(k) < cutoff]
        for k in stale:
            del by_bucket[k]
            changed = True
        if changed:
            save_diff_buckets()


DIFF_BUCKETS_RANGES = {
    '24h': (86400, 15 * 60),
    '3d': (3 * 86400, 60 * 60),
    '7d': (7 * 86400, 3 * 60 * 60),
}


def get_diff_buckets(ip, range_key):
    window_seconds, agg_seconds = DIFF_BUCKETS_RANGES.get(range_key, DIFF_BUCKETS_RANGES['24h'])
    now = time.time()
    cutoff = now - window_seconds
    with _diff_buckets_lock:
        buckets = load_diff_buckets()
        by_bucket = dict(buckets.get(ip, {}))

    agg = {}
    for k, v in by_bucket.items():
        try:
            ts = float(k)
        except (TypeError, ValueError):
            continue
        if ts < cutoff:
            continue
        agg_ts = int(ts // agg_seconds) * agg_seconds
        if v > agg.get(agg_ts, 0):
            agg[agg_ts] = v

    result = [{"ts": ts, "value": v} for ts, v in sorted(agg.items())]
    peak = max((b["value"] for b in result), default=0)
    return result, peak


# --- Eventos de recorde de best diff (usados nos pontos dos blocos) -----------
# Os buckets acima guardam o MAIOR best diff lido em cada janela de 15 min, mas o
# valor lido (bestSessionDiff) é o recorde da sessão e só sobe: depois de um recorde,
# todos os buckets seguintes repetem o mesmo número. Aqui guardamos apenas o momento
# em que o valor sobe, ou seja, quando houve mesmo um novo recorde nessa máquina.
DIFF_RECORDS_FILENAME = 'diff_records.json'
DIFF_RECORDS_MAX_AGE = 7 * 86400
DIFF_RECORDS_MAX_PER_IP = 3000
_diff_records_lock = threading.Lock()
_diff_records_cache = None
_diff_last_seen = {}


def diff_records_path():
    return os.path.join(writable_dir(), DIFF_RECORDS_FILENAME)


def load_diff_records():
    global _diff_records_cache
    if _diff_records_cache is not None:
        return _diff_records_cache
    try:
        with open(diff_records_path(), 'r', encoding='utf-8') as f:
            data = json.load(f)
        _diff_records_cache = data if isinstance(data, dict) else {}
    except Exception:
        _diff_records_cache = {}
    return _diff_records_cache


def save_diff_records():
    try:
        with open(diff_records_path(), 'w', encoding='utf-8') as f:
            json.dump(_diff_records_cache or {}, f, ensure_ascii=False)
    except Exception:
        pass


def _record_source_value(data):
    """Recorde da sessão (só sobe até a máquina reiniciar). Se a máquina não tiver
    esse campo, usa o best diff geral."""
    sess = data.get('bestSessionDiff')
    raw = sess if sess is not None else data.get('bestDiff')
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def record_diff_event(ip, value):
    """Regista um evento só quando o valor SOBE em relação à leitura anterior.
    - 1ª leitura desde que o painel arrancou: só fixa a referência (não sabemos quando foi atingido).
    - Valor igual ou mais baixo (ex.: a máquina reiniciou): só atualiza a referência."""
    if value is None or value < 0:
        return
    now = time.time()
    with _diff_records_lock:
        last = _diff_last_seen.get(ip)
        _diff_last_seen[ip] = value
        if last is None or value <= last:
            return
        records = load_diff_records()
        events = records.setdefault(ip, [])
        events.append([round(now, 1), value])
        cutoff = now - DIFF_RECORDS_MAX_AGE
        events[:] = [e for e in events if e[0] >= cutoff][-DIFF_RECORDS_MAX_PER_IP:]
        save_diff_records()


def get_diff_records(ip, range_key):
    window_seconds = DIFF_BUCKETS_RANGES.get(range_key, DIFF_BUCKETS_RANGES['24h'])[0]
    cutoff = time.time() - window_seconds
    with _diff_records_lock:
        events = list(load_diff_records().get(ip, []))
    return [{"ts": e[0], "value": e[1]} for e in events if e[0] >= cutoff]


POWER_CONFIG_FILENAME = 'config.json'
LEGACY_POWER_CONFIG_FILENAME = 'power_profiles.json'
POWER_CONFIG_LOCK = threading.Lock()

DEFAULT_POWER_CONFIG = {
    "mqtt": {
        "host": "",
        "port": 1883,
        "username": "",
        "password": "",
        "topic_solar": "",
        "topic_tariff": "",
    },
    "profiles": [],
    "devices": [],
    "mrr": {
        "api_key": "",
        "api_secret": "",
    },
    "alerts": {
        "telegram_bot_token": "",
        "telegram_chat_id": "",
        "discord_webhook_url": "",
        "hashrate_drop_pct": 30,
        "notify_offline": True,
        "notify_record": True,
        "notify_rental_ending": True,
        "notify_hashrate_drop": True,
        "notify_windows_toast": True,
        "notify_health": True,
        "notify_daily": False,
        "daily_hour": 21,
        "webhook_url": "",
    },
    "pools": {
        "btc_address": "",
        "worker_suffix": "",
        "min_gain_percent": 5,
        "eval_interval_minutes": 15,
    },
    "coolant": {
        "enabled": False,
        "sensor_url": "",
        "killswitch_enabled": False,
        "relay_off_url": "",
        "relay_on_url": "",
        "min_flow_lpm": 1.0,
        "grace_seconds": 5,
        "max_coolant_out_c": 60,
    },
    "security": {
        "https_enabled": False,
        "restrict_proxy_to_known_ips": True,
        "remote_keepalive": False,
    },
}

endpoint_cache_lock = threading.Lock()
endpoint_cache = {}

mqtt_state_lock = threading.Lock()
mqtt_state = {
    "connected": False,
    "error": None,
    "solar": None,
    "tariff": None,
    "last_update": None,
}
mqtt_client_ref = {"client": None}


def _parse_version(v):
    v = (v or "").strip().lstrip('vV')
    parts = []
    for p in v.split('.'):
        num = ''
        for ch in p:
            if ch.isdigit():
                num += ch
            else:
                break
        parts.append(int(num) if num else 0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:3])


def check_for_update(force=False):
    with _update_cache_lock:
        cached = _update_cache["data"]
        age = time.time() - _update_cache["ts"]
        if cached is not None and not force and age < UPDATE_CHECK_CACHE_SECONDS:
            return cached

    result = {
        "current_version": APP_VERSION,
        "latest_version": None,
        "update_available": False,
        "release_url": None,
        "release_notes": None,
        "installer_url": None,
        "installer_name": None,
        "installer_size": None,
        "signature_url": None,
        "error": None,
    }
    try:
        api_url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
        req = urllib.request.Request(
            api_url,
            headers={
                'User-Agent': 'CentroDeComando-UpdateCheck',
                'Accept': 'application/vnd.github+json',
            }
        )
        with _urlopen_https(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8', errors='ignore'))

        tag = data.get('tag_name', '') or ''
        result["latest_version"] = tag.lstrip('vV') or None
        result["release_url"] = data.get('html_url')
        notes = data.get('body') or ''
        result["release_notes"] = notes[:2000]
        result["update_available"] = _parse_version(tag) > _parse_version(APP_VERSION)

        assets = data.get('assets') or []
        best = None
        for a in assets:
            name = (a.get('name') or '')
            if not name.lower().endswith('.exe'):
                continue
            if best is None:
                best = a
            if 'setup' in name.lower() or 'instalador' in name.lower():
                best = a
                break
        if best:
            result["installer_url"] = best.get('browser_download_url')
            result["installer_name"] = best.get('name')
            result["installer_size"] = best.get('size')
            # a assinatura é um ficheiro "<instalador>.sig" na mesma release
            sig_name = (best.get('name') or '') + '.sig'
            for a in assets:
                if (a.get('name') or '') == sig_name:
                    result["signature_url"] = a.get('browser_download_url')
                    break
    except Exception as e:
        result["error"] = str(e)

    with _update_cache_lock:
        _update_cache["ts"] = time.time()
        _update_cache["data"] = result
    return result


UPDATE_DOWNLOAD_MAX_BYTES = 300 * 1024 * 1024
_update_install_state = {"status": "idle", "error": None}
_update_install_lock = threading.Lock()


def update_download_dir():
    d = os.path.join(writable_dir(), "updates")
    try:
        os.makedirs(d, exist_ok=True)
    except Exception:
        pass
    return d


def _update_url_ok(url):
    try:
        u = urllib.parse.urlparse(url)
    except Exception:
        return False
    return u.scheme == 'https' and (u.hostname or '').lower() in UPDATE_ALLOWED_HOSTS


def verify_update_signature(digest, sig_hex):
    """True só se sig_hex for uma assinatura Ed25519 válida (da chave UPDATE_PUBKEY_HEX) sobre o SHA-256 do instalador."""
    try:
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
        sig = bytes.fromhex((sig_hex or '').strip())
        pub = Ed25519PublicKey.from_public_bytes(bytes.fromhex(UPDATE_PUBKEY_HEX))
        pub.verify(sig, UPDATE_SIG_CONTEXT + digest)
        return True
    except Exception:
        return False


# ---------- Certificados de bloco ----------
# Cada instalação tem a sua própria chave Ed25519 (criada na primeira vez e guardada ao lado do programa). NÃO é a chave das
# atualizações: essa fica só no PC do programador e nunca pode vir dentro da app. O certificado assina as provas recolhidas
# quando um bloco é encontrado (hora, máquina, share, transação de recompensa e cabeçalho do bloco); o cabeçalho confirma-se
# por si (o seu hash tem de bater com o do bloco) e a transação confirma-se em qualquer explorador de blocos.
CERT_CONTEXT = b"HC-BLOCK-CERT-V1:"
CERT_KEY_FILENAME = 'block_cert_key.json'
CERT_MAX_PAYLOAD = 32768
_cert_key_lock = threading.Lock()
_cert_key_cache = None


def cert_key_path():
    return os.path.join(writable_dir(), CERT_KEY_FILENAME)


def _cert_private_key():
    global _cert_key_cache
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    with _cert_key_lock:
        if _cert_key_cache is not None:
            return _cert_key_cache
        path = cert_key_path()
        if os.path.exists(path):
            # um ficheiro que existe mas não lê bem NUNCA é substituído (perderia as provas assinadas com ele)
            with open(path, 'r', encoding='utf-8') as f:
                key = Ed25519PrivateKey.from_private_bytes(bytes.fromhex(json.load(f)['seed']))
        else:
            key = Ed25519PrivateKey.generate()
            seed = key.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())
            with open(path, 'w', encoding='utf-8') as f:
                json.dump({'seed': seed.hex(), 'created': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}, f)
            try:
                os.chmod(path, 0o600)
            except Exception:
                pass
        _cert_key_cache = key
        return key


def _cert_public_hex(create=False):
    from cryptography.hazmat.primitives import serialization
    if not create and not os.path.exists(cert_key_path()):
        return None
    return _cert_private_key().public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw).hex()


def cert_canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')


def cert_message(signed):
    return CERT_CONTEXT + hashlib.sha256(cert_canonical(signed)).digest()


def cert_sign(payload):
    signed = {"v": 1, "signed_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), "payload": payload}
    key = _cert_private_key()
    return {"v": 1, "signed_at": signed["signed_at"], "payload": payload, "public_key": _cert_public_hex(True),
            "sha256": hashlib.sha256(cert_canonical(signed)).hexdigest(), "signature": key.sign(cert_message(signed)).hex()}


def block_header_hash(h):
    """Hash do bloco calculado a partir do cabeçalho de 80 bytes (campos como a API da mempool.space os dá)."""
    try:
        import struct
        raw = (struct.pack('<I', int(h['version']) & 0xffffffff) + bytes.fromhex(h['previousblockhash'])[::-1] +
               bytes.fromhex(h['merkle_root'])[::-1] + struct.pack('<III', int(h['timestamp']), int(h['bits']), int(h['nonce'])))
        return hashlib.sha256(hashlib.sha256(raw).digest()).digest()[::-1].hex()
    except Exception:
        return None


def cert_verify(cert):
    res = {"signature_valid": False, "header_ok": None, "signer_is_this_install": False}
    try:
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
        signed = {"v": cert["v"], "signed_at": cert["signed_at"], "payload": cert["payload"]}
        Ed25519PublicKey.from_public_bytes(bytes.fromhex(cert["public_key"])).verify(bytes.fromhex(cert["signature"]), cert_message(signed))
        res["signature_valid"] = True
    except Exception:
        pass
    try:
        chain = (cert.get("payload") or {}).get("chain") or {}
        if isinstance(chain.get("header"), dict):
            res["header_ok"] = block_header_hash(chain["header"]) == chain.get("block_hash")
        res["signer_is_this_install"] = bool(cert.get("public_key")) and cert.get("public_key") == _cert_public_hex(False)
    except Exception:
        pass
    return res


def _do_download_and_launch_installer(url, name, silent, sig_url=None):
    global _update_install_state
    dest = None
    try:
        with _update_install_lock:
            _update_install_state = {"status": "downloading", "error": None}

        if not _update_url_ok(url) or not _update_url_ok(sig_url or ''):
            raise RuntimeError("endereço da atualização não é do GitHub (recusado)")
        name = os.path.basename(name or "CentroDeComando-Setup.exe")
        dest = os.path.join(update_download_dir(), name)
        req = urllib.request.Request(url, headers={'User-Agent': 'CentroDeComando-UpdateDownload'})
        total = 0
        h = hashlib.sha256()
        with _urlopen_https(req, timeout=15) as resp, open(dest, 'wb') as f:
            while True:
                chunk = resp.read(1024 * 256)
                if not chunk:
                    break
                total += len(chunk)
                if total > UPDATE_DOWNLOAD_MAX_BYTES:
                    raise RuntimeError("instalador excede o tamanho máximo esperado")
                h.update(chunk)
                f.write(chunk)

        with _update_install_lock:
            _update_install_state = {"status": "verifying", "error": None}
        sreq = urllib.request.Request(sig_url, headers={'User-Agent': 'CentroDeComando-UpdateDownload'})
        with _urlopen_https(sreq, timeout=15) as sresp:
            sig_hex = sresp.read(4096).decode('ascii', errors='ignore')
        if not verify_update_signature(h.digest(), sig_hex):
            try:
                os.remove(dest)
            except Exception:
                pass
            raise RuntimeError("assinatura inválida: o instalador foi apagado e NÃO foi executado")

        with _update_install_lock:
            _update_install_state = {"status": "launching", "error": None, "verified": True}

        args = [dest]
        if silent:
            args.append('/VERYSILENT')
        args.append('/SP-')
        subprocess.Popen(args, close_fds=True, shell=False)

        with _update_install_lock:
            _update_install_state = {"status": "done", "error": None, "verified": True}

        time.sleep(1.5)
        os._exit(0)
    except Exception as e:
        with _update_install_lock:
            _update_install_state = {"status": "error", "error": str(e)}


def start_update_install(silent=True):
    info = check_for_update(force=True)
    if not info.get("installer_url"):
        with _update_install_lock:
            _update_install_state_local = {
                "status": "error",
                "error": info.get("error") or "Não foi encontrado nenhum instalador (.exe) na última release.",
            }
        global _update_install_state
        with _update_install_lock:
            _update_install_state = _update_install_state_local
        return False, _update_install_state_local["error"]

    if not info.get("signature_url"):
        msg = "A release não tem o ficheiro de assinatura (.sig), por isso a atualização automática foi recusada. Descarrega o instalador manualmente."
        with _update_install_lock:
            _update_install_state = {"status": "error", "error": msg}
        return False, msg

    t = threading.Thread(
        target=_do_download_and_launch_installer,
        args=(info["installer_url"], info.get("installer_name"), silent, info["signature_url"]),
        daemon=True,
    )
    t.start()
    return True, None


# --- Notícias de Bitcoin (rodapé da dashboard) ---
# Junta várias fontes RSS (feito aqui no servidor porque o browser não consegue
# ler estes feeds diretamente por causa do CORS), tira repetidos e marca como
# "preocupantes" as notícias sobre ataques, roubos, proibições, quedas, etc.
BTC_NEWS_FEEDS = [
    ("Google Notícias", "https://news.google.com/rss/search?q=bitcoin&hl=pt-PT&gl=PT&ceid=PT:pt-150"),
    ("Cointelegraph", "https://cointelegraph.com/rss/tag/bitcoin"),
    ("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
    ("Bitcoin Magazine", "https://bitcoinmagazine.com/.rss/full/"),
]
BTC_NEWS_CACHE_SECONDS = 10 * 60
_btc_news_cache = {"ts": 0, "data": None}
_btc_news_cache_lock = threading.Lock()
_BTC_NEWS_WORRY = re.compile(
    r"hack|exploit|stolen|theft|drain|ban(?:s|ned)?\b|crackdown|lawsuit|sued|\bsec\b|crash|plung|plummet|tumbl|sell-?off|dump|"
    r"liquidat|outage|bug\b|vulnerab|fraud|scam|bankrupt|insolven|halt|frozen|freez|seiz|arrest|attack|51%|warning|fear|"
    r"queda|cai\b|caem|afunda|desaba|colapso|proib|ataque|roub|fraude|burla|fal[eê]ncia|apreen|multa|alerta|vulnerab|"
    r"pirat|golpe|investiga|detid|preso|medo|p[aâ]nico|recua|perde[mu]?\b|sa[ií]da|ameaç|guerra|sanç|evacu|"
    r"slide|slump|drop|below|outflow|ponzi|threat|\bwar\b|sanction",
    re.IGNORECASE)
_BTC_NEWS_BTC = re.compile(r"bitcoin|\bbtc\b|satoshi|minera|mining|miner|halving|hashrate", re.IGNORECASE)


def _btc_news_fetch_feed(source, url):
    import xml.etree.ElementTree as ET
    from email.utils import parsedate_to_datetime
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (CentroDeComando)", "Accept": "application/rss+xml, application/xml, text/xml"})
    with _urlopen_https(req, timeout=8) as resp:
        raw = resp.read()
    root = ET.fromstring(raw)
    out = []
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        if not title or not link.startswith("http"):
            continue
        src = source
        # O Google Notícias junta várias fontes: o título vem "Título - Fonte"
        src_el = item.find("source")
        if src_el is not None and (src_el.text or "").strip():
            src = src_el.text.strip()
            if title.endswith(" - " + src):
                title = title[: -len(" - " + src)].strip()
        ts = 0
        try:
            ts = int(parsedate_to_datetime(item.findtext("pubDate") or "").timestamp())
        except Exception:
            pass
        if source != "Google Notícias" and source != "Bitcoin Magazine" and source != "Cointelegraph":
            # feeds gerais de cripto: só ficam as notícias sobre Bitcoin
            if not _BTC_NEWS_BTC.search(title + " " + (item.findtext("description") or "")[:300]):
                continue
        out.append({"title": title, "link": link, "source": src, "ts": ts, "worry": bool(_BTC_NEWS_WORRY.search(title))})
    return out


def fetch_btc_news(force=False):
    with _btc_news_cache_lock:
        if not force and _btc_news_cache["data"] is not None and time.time() - _btc_news_cache["ts"] < BTC_NEWS_CACHE_SECONDS:
            return _btc_news_cache["data"]
    items, errors = [], []
    with ThreadPoolExecutor(max_workers=len(BTC_NEWS_FEEDS)) as ex:
        futs = {ex.submit(_btc_news_fetch_feed, s, u): s for s, u in BTC_NEWS_FEEDS}
        for fut in as_completed(futs):
            try:
                items.extend(fut.result())
            except Exception as e:
                errors.append(f"{futs[fut]}: {e}")
    # tira repetidos (mesmo título) e fica com as mais recentes das últimas 48 h
    seen, uniq = set(), []
    cutoff = time.time() - 48 * 3600
    for it in sorted(items, key=lambda x: x["ts"], reverse=True):
        key = re.sub(r"[^a-z0-9]+", "", it["title"].lower())[:80]
        if key in seen or (it["ts"] and it["ts"] < cutoff):
            continue
        seen.add(key)
        uniq.append(it)
    data = {"ts": int(time.time()), "items": uniq[:40], "errors": errors}
    with _btc_news_cache_lock:
        if uniq or _btc_news_cache["data"] is None:
            _btc_news_cache["ts"] = time.time()
            _btc_news_cache["data"] = data
        else:
            data = _btc_news_cache["data"]   # tudo falhou: mantém as últimas notícias boas
    return data


def fetch_binance_rates(force=False):
    with _rates_cache_lock:
        cached = _rates_cache["data"]
        age = time.time() - _rates_cache["ts"]
        if cached is not None and not force and age < BINANCE_RATES_CACHE_SECONDS:
            return cached

    result = {
        "btc_eur": None,
        "btc_usdt": None,
        "updated": None,
        "error": None,
    }
    try:
        api_url = "https://api.binance.com/api/v3/ticker/price?symbols=%5B%22BTCEUR%22%2C%22BTCUSDT%22%5D"
        req = urllib.request.Request(
            api_url,
            headers={'User-Agent': 'CentroDeComando-RatesCheck'}
        )
        with _urlopen_https(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8', errors='ignore'))

        for entry in data:
            sym = entry.get('symbol')
            price = entry.get('price')
            if sym == 'BTCEUR' and price is not None:
                result["btc_eur"] = float(price)
            elif sym == 'BTCUSDT' and price is not None:
                result["btc_usdt"] = float(price)

        if result["btc_eur"] is None or result["btc_usdt"] is None:
            result["error"] = "Resposta da Binance incompleta"
        else:
            result["updated"] = time.time()
    except Exception as e:
        result["error"] = str(e)

    with _rates_cache_lock:
        _rates_cache["ts"] = time.time()
        _rates_cache["data"] = result
    return result


def _parse_ckpool_hashrate_to_ths(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return None
    s = str(value).strip()
    if not s:
        return None
    multipliers = {'K': 1e-9, 'M': 1e-6, 'G': 1e-3, 'T': 1.0, 'P': 1e3, 'E': 1e6}
    suffix = s[-1].upper()
    try:
        if suffix in multipliers:
            return float(s[:-1]) * multipliers[suffix]
        return None
    except (ValueError, TypeError):
        return None


def _parse_difficulty_value(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    if not s:
        return None
    multipliers = {'K': 1e3, 'M': 1e6, 'G': 1e9, 'T': 1e12, 'P': 1e15, 'E': 1e18}
    suffix = s[-1].upper()
    try:
        if suffix in multipliers:
            return float(s[:-1]) * multipliers[suffix]
        return float(s)
    except (ValueError, TypeError):
        return None


def _try_json_get(url, timeout=6):
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'CentroDeComando-ParasiteCheck', 'Accept': 'application/json'}
    )
    try:
        with _urlopen_https(req, timeout=timeout) as resp:
            status = resp.status
            raw = resp.read().decode('utf-8', errors='ignore')
    except urllib.error.HTTPError as he:
        status = he.code
        raw = he.read().decode('utf-8', errors='ignore') if he.fp else ''
        return status, None, raw, None
    except urllib.error.URLError as ue:
        return None, None, '', str(ue.reason)
    except Exception as e:
        return None, None, '', str(e)

    try:
        data = json.loads(raw)
        return status, data, raw, None
    except json.JSONDecodeError:
        return status, None, raw, None



# --- Pools genéricas (Miningcore e semelhantes) -- Molepool e futuras --------
GENERIC_POOLS = {
    "molepool-btc1": {
        "label": "Molepool BTC1 (solo)",
        "coin": "BTC",
        "stats_url": "https://btc1.molepool.com/api/v1/stats",
        "blocks_url": "https://btc1.molepool.com/api/v1/blocks",
        "account_url": "https://btc1.molepool.com/api/v1/account/{address}",
    },
}
GENERIC_POOL_CACHE_SECONDS = 20
_generic_pool_cache = {}
_generic_pool_cache_lock = threading.Lock()


def _generic_pool_http_json(url, timeout=6):
    req = urllib.request.Request(url, headers={"User-Agent": "HashCommander/1.0", "Accept": "application/json"})
    with _urlopen_https(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


_generic_pool_account_cache = {}
_generic_pool_account_cache_lock = threading.Lock()


def fetch_generic_pool_account(pool_id, address):
    """Dados pessoais do minador numa pool (quando a pool tem account_url), ex.:
    melhor share (bestShare.share), hashrate e lista de workers deste endereço."""
    cfg = GENERIC_POOLS.get(pool_id)
    if not cfg or not address or not cfg.get("account_url"):
        return None
    cache_key = (pool_id, address)
    with _generic_pool_account_cache_lock:
        entry = _generic_pool_account_cache.get(cache_key)
        if entry and (time.time() - entry["ts"]) < GENERIC_POOL_CACHE_SECONDS:
            return entry["data"]
    try:
        url = cfg["account_url"].format(address=urllib.parse.quote(address))
        raw = _generic_pool_http_json(url)
        r = (raw.get("result") if isinstance(raw, dict) else None) or {}
        best = r.get("bestShare") or {}
        account = {
            "address": address,
            "current_hashrate": r.get("currentHashrate"),
            "average_hashrate": r.get("averageHashrate"),
            "balance": r.get("balance"),
            "pending": r.get("pending"),
            "immature": r.get("immature"),
            "blocks_found": r.get("blocksFound"),
            "best_share": best.get("share"),
            "best_share_ts": best.get("time"),
            "best_share_net_diff": best.get("netDiff"),
            "workers": [
                {"name": w.get("name"), "hashrate": w.get("currentHashrate"),
                 "best_share": w.get("bestShare"), "offline": w.get("offline")}
                for w in (r.get("workers") or [])
            ],
        }
    except Exception:
        with _generic_pool_account_cache_lock:
            entry = _generic_pool_account_cache.get(cache_key)
        return entry["data"] if entry else None
    with _generic_pool_account_cache_lock:
        _generic_pool_account_cache[cache_key] = {"ts": time.time(), "data": account}
    return account


def fetch_generic_pool(pool_id, address="", force=False):
    """Estado de uma pool Miningcore-like (configurada em GENERIC_POOLS): stats gerais
    da pool + lista de blocos recentes encontrados por qualquer pessoa, mais os dados
    pessoais do endereço (melhor share, hashrate) quando a pool os expõe."""
    cfg = GENERIC_POOLS.get(pool_id)
    if not cfg:
        return {"error": f"Pool desconhecida: {pool_id}"}
    cache_key = pool_id
    with _generic_pool_cache_lock:
        entry = _generic_pool_cache.get(cache_key)
        if entry and not force and (time.time() - entry["ts"]) < GENERIC_POOL_CACHE_SECONDS:
            data = entry["data"]
            return _generic_pool_mark_mine(data, address)
    try:
        stats = _generic_pool_http_json(cfg["stats_url"])
        blocks = _generic_pool_http_json(cfg["blocks_url"])
    except Exception as e:
        with _generic_pool_cache_lock:
            entry = _generic_pool_cache.get(cache_key)
        if entry:
            data = entry["data"]
            data = dict(data)
            data["stale"] = True
            data["error"] = str(e)
            return _generic_pool_mark_mine(data, address)
        return {"error": str(e), "label": cfg["label"], "coin": cfg["coin"]}

    s = (stats.get("result") if isinstance(stats, dict) else None) or {}
    raw_blocks = (blocks.get("result") if isinstance(blocks, dict) else None) or {}
    block_list = raw_blocks.get("blocks") or []
    candidates = raw_blocks.get("candidate") or []
    data = {
        "pool_id": pool_id,
        "label": cfg["label"],
        "coin": cfg["coin"],
        "total_miners": s.get("totalMiners"),
        "pool_hashrate": s.get("totalHashrate"),
        "network_hashrate": s.get("networkHashrate"),
        "network_difficulty": s.get("networkDifficulty"),
        "height": s.get("currentHeight"),
        "last_block_found": s.get("lastBlockFound"),
        "total_blocks": s.get("totalBlocks"),
        "fee_percent": s.get("fee"),
        "reward": s.get("reward"),
        "candidates": [
            {"height": c.get("height"), "hash": c.get("hash"), "miner": c.get("miner"),
             "diff": c.get("shareDiff"), "status": c.get("status"), "ts": c.get("timestamp")}
            for c in candidates
        ],
        "blocks": [
            {"height": b.get("height"), "hash": b.get("hash"), "miner": b.get("miner"),
             "diff": b.get("shareDiff"), "effort": b.get("effort"), "status": b.get("status"),
             "reward": b.get("reward"), "ts": b.get("timestamp")}
            for b in block_list[:100]
        ],
        "stale": False,
    }
    with _generic_pool_cache_lock:
        _generic_pool_cache[cache_key] = {"ts": time.time(), "data": data}
    return _generic_pool_mark_mine(data, address)


def _generic_pool_mark_mine(data, address):
    data = dict(data)
    address = (address or "").strip()
    if not address:
        return data
    data["blocks"] = [dict(b, mine=(b.get("miner") == address)) for b in data.get("blocks", [])]
    data["candidates"] = [dict(c, mine=(c.get("miner") == address)) for c in data.get("candidates", [])]
    data["account"] = fetch_generic_pool_account(data.get("pool_id", ""), address)
    return data


# Histórico da Parasite Pool para o gráfico "Hashrate e Difficulty": hashrate ao longo do tempo + melhores shares por bloco.
# A API deles não permite CORS, por isso o browser pede-o aqui.
PARASITE_HISTORY_CACHE_SECONDS = 60
_parasite_history_cache = {}
_parasite_history_cache_lock = threading.Lock()
_PARASITE_HISTORY_INTERVALS = {'24h': '5m', '3d': '5m', '7d': '1h', '30d': '1h'}


def fetch_parasite_history(address, period='3d'):
    address = (address or '').strip()
    if not re.fullmatch(r'[A-Za-z0-9]{20,100}', address):
        return {"error": "Endereço inválido"}
    if period not in _PARASITE_HISTORY_INTERVALS:
        period = '3d'
    key = (address, period)
    with _parasite_history_cache_lock:
        entry = _parasite_history_cache.get(key)
        if entry and (time.time() - entry["ts"]) < PARASITE_HISTORY_CACHE_SECONDS:
            return entry["data"]

    enc = urllib.parse.quote(address, safe='')
    interval = _PARASITE_HISTORY_INTERVALS[period]
    status, hist, raw, net_err = _try_json_get(
        f"{PARASITE_POOL_BASE_URL}/api/user/{enc}/historical?period={period}&interval={interval}", timeout=12)
    if not isinstance(hist, list):
        msg = net_err or (hist.get('error') if isinstance(hist, dict) else None) or f"HTTP {status}"
        return {"error": f"A Parasite Pool não devolveu o histórico ({msg})"}

    points = []
    for it in hist:
        if not isinstance(it, dict):
            continue
        ts = it.get('timestamp')
        try:
            if isinstance(ts, (int, float)):
                ms = int(ts * 1000) if ts < 1e12 else int(ts)
            else:
                import calendar
                ms = int(calendar.timegm(time.strptime(str(ts)[:19], '%Y-%m-%dT%H:%M:%S')) * 1000)
            h = float(it.get('hashrate'))
        except (TypeError, ValueError):
            continue
        points.append([ms, h])

    # melhor share de cada bloco (a API devolve no máximo 500, cerca de 3 dias)
    diffs = []
    st2, dl, raw2, err2 = _try_json_get(
        f"{PARASITE_POOL_BASE_URL}/api/highest-diff?address={enc}&type=user-diffs&limit=500", timeout=12)
    if isinstance(dl, list):
        for it in dl:
            try:
                diffs.append([int(it['block_timestamp']) * 1000, float(it['difficulty']), int(it.get('block_height') or 0)])
            except (KeyError, TypeError, ValueError):
                continue

    result = {"period": period, "interval": interval, "hashrate": points, "diffs": diffs, "error": None}
    with _parasite_history_cache_lock:
        _parasite_history_cache[key] = {"ts": time.time(), "data": result}
    return result


# Máquinas (workers) do teu endereço na Parasite Pool: quais estão ligadas, hashrate, melhor diff e última submissão.
PARASITE_WORKERS_CACHE_SECONDS = 20
_parasite_workers_cache = {}
_parasite_workers_cache_lock = threading.Lock()


def fetch_parasite_workers(address):
    address = (address or '').strip()
    if not re.fullmatch(r'[A-Za-z0-9]{20,100}', address):
        return {"error": "Endereço inválido", "workers": []}
    with _parasite_workers_cache_lock:
        entry = _parasite_workers_cache.get(address)
        if entry and (time.time() - entry["ts"]) < PARASITE_WORKERS_CACHE_SECONDS:
            return entry["data"]
    status, data, raw, net_err = _try_json_get(f"{PARASITE_POOL_BASE_URL}/api/user/{urllib.parse.quote(address, safe='')}", timeout=10)
    if not isinstance(data, dict) or not isinstance(data.get('workerData'), list):
        return {"error": net_err or f"A Parasite Pool não devolveu máquinas (HTTP {status})", "workers": []}
    workers = []
    for w in data['workerData']:
        if not isinstance(w, dict):
            continue
        try:
            hr = float(w.get('hashrate') or 0)
        except (TypeError, ValueError):
            hr = 0.0
        try:
            best = float(w.get('bestDifficulty') or 0)
        except (TypeError, ValueError):
            best = 0.0
        try:
            last = int(w.get('lastSubmission') or 0)
        except (TypeError, ValueError):
            last = 0
        name = str(w.get('name') or str(w.get('id') or '').split('.', 1)[-1] or '—')
        workers.append({"name": name, "hashrate_hs": hr, "best_diff": best, "last_submission": last})
    result = {"workers": workers, "total_hashrate_hs": float(data.get('hashrate') or 0), "now": int(time.time()), "error": None}
    with _parasite_workers_cache_lock:
        _parasite_workers_cache[address] = {"ts": time.time(), "data": result}
    return result


# Blocos achados pela Parasite Pool (por qualquer mineiro): o painel avisa quando aparece um novo.
PARASITE_BLOCKS_CACHE_SECONDS = 30
_parasite_blocks_cache = {"ts": 0, "data": None}
_parasite_blocks_cache_lock = threading.Lock()


def fetch_parasite_blocks():
    with _parasite_blocks_cache_lock:
        if _parasite_blocks_cache["data"] is not None and (time.time() - _parasite_blocks_cache["ts"]) < PARASITE_BLOCKS_CACHE_SECONDS:
            return _parasite_blocks_cache["data"]
    status, rounds, raw, net_err = _try_json_get(f"{PARASITE_POOL_BASE_URL}/api/rounds", timeout=10)
    if not isinstance(rounds, list):
        return {"blocks": [], "error": net_err or f"HTTP {status}"}
    blocks = []
    for it in rounds:
        if not isinstance(it, dict) or not it.get('block_hash') or not it.get('block_height'):
            continue
        try:
            blocks.append({
                "height": int(it['block_height']),
                "hash": str(it['block_hash']),
                "reward_sats": int(it['coinbase_value']) if it.get('coinbase_value') is not None else None,
                "diff": float(it['winner_diff']) if it.get('winner_diff') is not None else None,
                "winner": str(it.get('winner_username') or ''),
                "net_diff": float(it['network_difficulty']) if it.get('network_difficulty') is not None else None,
            })
        except (TypeError, ValueError):
            continue
    blocks.sort(key=lambda b: -b["height"])
    result = {"blocks": blocks, "error": None}
    with _parasite_blocks_cache_lock:
        _parasite_blocks_cache.update({"ts": time.time(), "data": result})
    return result


def fetch_parasite_stats(address, force=False, debug=False):
    address = (address or "").strip()
    if not address:
        return {"error": "Endereço em falta"}

    cache_key = address
    with _parasite_stats_cache_lock:
        entry = _parasite_stats_cache.get(cache_key)
        if entry and not force and not debug and (time.time() - entry["ts"]) < PARASITE_STATS_CACHE_SECONDS:
            return entry["data"]

    result = {
        "hashrate_ths": None,
        "hashrate_formatted": None,
        "best_difficulty": None,
        "best_difficulty_formatted": None,
        "workers_count": None,
        "rank": None,
        "pool_hashrate_phs": None,
        "pool_hashrate_formatted": None,
        "error": None,
    }

    encoded_addr = urllib.parse.quote(address, safe='')
    personal_candidates = [
        f"{PARASITE_POOL_BASE_URL}/api/{encoded_addr}",
        f"{PARASITE_POOL_BASE_URL}/api/users/{encoded_addr}",
        f"{PARASITE_POOL_BASE_URL}/api/miner/{encoded_addr}",
        f"{PARASITE_POOL_BASE_URL}/api/miners/{encoded_addr}",
        f"{PARASITE_POOL_BASE_URL}/api/user/{encoded_addr}",
        f"{PARASITE_POOL_BASE_URL}/api/address/{encoded_addr}",
        f"{PARASITE_POOL_BASE_URL}/api/stats/{encoded_addr}",
        f"{PARASITE_POOL_BASE_URL}/api/worker/{encoded_addr}",
    ]

    attempts_log = []
    merged = None
    matched_url = None

    for url in personal_candidates:
        status, data, raw, net_err = _try_json_get(url)
        if net_err:
            attempts_log.append(f"{url} -> falha de ligação: {net_err}")
            continue
        if data is None:
            attempts_log.append(f"{url} -> HTTP {status}, resposta não é JSON ({raw[:120]!r})")
            continue

        candidate_merged = {}
        if isinstance(data, dict):
            candidate_merged.update(data)
            for nested_key in ('data', 'result', 'miner', 'user'):
                nested = data.get(nested_key)
                if isinstance(nested, dict):
                    candidate_merged.update(nested)
        elif isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    candidate_merged.update(item)

        recognisable_keys = (
            'hashrate1hr', 'hashrate5m', 'hashrate1m', 'hashrate', 'hashRate',
            'bestshare', 'bestever', 'best_difficulty', 'bestDifficulty',
            'workers', 'Workers', 'worker_count', 'workerCount', 'rank'
        )
        matched_keys = [k for k in recognisable_keys if k in candidate_merged]
        if len(matched_keys) >= 2:
            merged = candidate_merged
            matched_url = url
            break
        attempts_log.append(f"{url} -> HTTP {status}, JSON válido mas com poucos campos reconhecidos ({matched_keys}): {str(data)[:150]}")

    if debug:
        result["debug_attempts"] = attempts_log
        result["debug_matched_url"] = matched_url
        result["debug_raw_merged"] = merged

    if merged is None:
        result["error"] = (
            "Não foi encontrada nenhuma rota de API válida para este endereço em "
            f"{PARASITE_POOL_BASE_URL}. Tentativas: " + " | ".join(attempts_log)
        )
        if not debug:
            with _parasite_stats_cache_lock:
                _parasite_stats_cache[cache_key] = {"ts": time.time(), "data": result}
        return result

    hashrate_raw = (
        merged.get('hashrate1hr') or merged.get('hashrate5m') or merged.get('hashrate1m')
        or merged.get('hashrate') or merged.get('hashRate')
    )
    hashrate_ths = _parse_ckpool_hashrate_to_ths(hashrate_raw)
    if hashrate_ths is None and isinstance(hashrate_raw, (int, float)) and hashrate_raw > 0:
        hashrate_ths = hashrate_raw / 1e12
    if hashrate_ths is not None:
        result["hashrate_ths"] = hashrate_ths
        result["hashrate_formatted"] = (
            f"{hashrate_ths / 1000:.2f} PH/s" if hashrate_ths >= 1000 else f"{hashrate_ths:.2f} TH/s"
        )

    best_share = merged.get('bestshare') or merged.get('bestever') or merged.get('best_difficulty') or merged.get('bestDifficulty')
    if best_share is not None:
        best_share_num = _parse_difficulty_value(best_share)
        if best_share_num is not None:
            result["best_difficulty"] = best_share_num
            result["best_difficulty_formatted"] = f"{best_share_num:,.0f}".replace(",", " ")

    workers = merged.get('Workers') or merged.get('workers') or merged.get('worker_count') or merged.get('workerCount')
    if workers is not None:
        try:
            result["workers_count"] = int(workers)
        except (ValueError, TypeError):
            pass

    rank = merged.get('rank')
    if rank is not None:
        try:
            result["rank"] = int(rank)
        except (ValueError, TypeError):
            pass

    pool_candidates = [
        f"{PARASITE_POOL_BASE_URL}/api/pool-stats",
        f"{PARASITE_POOL_BASE_URL}/api/pool",
        f"{PARASITE_POOL_BASE_URL}/api/stats",
        f"{PARASITE_POOL_BASE_URL}/api/hashrate",
        f"{PARASITE_POOL_BASE_URL}/api/leaderboard?type=difficulty&limit=99&round=current",
        f"{PARASITE_POOL_BASE_URL}/api/leaderboard",
        f"{PARASITE_POOL_BASE_URL}/api/pool/hashrate",
        f"{PARASITE_POOL_BASE_URL}/api/pool/info",
        f"{PARASITE_POOL_BASE_URL}/api/info",
        f"{PARASITE_POOL_BASE_URL}/api/summary",
        f"{PARASITE_POOL_BASE_URL}/api/overview",
        f"{PARASITE_POOL_BASE_URL}/api/miners",
        f"{PARASITE_POOL_BASE_URL}/api/top",
        f"{PARASITE_POOL_BASE_URL}/api/rankings",
        f"{PARASITE_POOL_BASE_URL}/api/network",
        f"{PARASITE_POOL_BASE_URL}/api/global",
        f"{PARASITE_POOL_BASE_URL}/api/pool/stats",
    ]
    pool_attempts_log = []
    pool_matched_url = None
    for url in pool_candidates:
        status, data, raw, net_err = _try_json_get(url, timeout=5)
        if net_err:
            pool_attempts_log.append(f"{url} -> falha de ligação: {net_err}")
            continue
        if data is None:
            pool_attempts_log.append(f"{url} -> HTTP {status}, resposta não é JSON")
            continue

        entries = None
        if isinstance(data, list):
            entries = [e for e in data if isinstance(e, dict)]
        elif isinstance(data, dict):
            for list_key in ('miners', 'workers', 'leaderboard', 'entries', 'data', 'results'):
                nested = data.get(list_key)
                if isinstance(nested, list):
                    entries = [e for e in nested if isinstance(e, dict)]
                    break

        if entries:
            addr_lower = address.lower()
            addr_prefix = addr_lower[:6]
            addr_suffix = addr_lower[-4:]

            def _entry_addr(e):
                return str(e.get('address') or e.get('id') or e.get('user') or '').lower()

            def _addr_matches(entry_addr):
                if not entry_addr:
                    return False
                if entry_addr == addr_lower:
                    return True
                if '...' in entry_addr:
                    pre, _, suf = entry_addr.partition('...')
                    return addr_prefix.startswith(pre) and addr_lower.endswith(suf)
                return False

            my_entry = next((e for e in entries if _addr_matches(_entry_addr(e))), None)
            if my_entry is not None:
                rank_val = my_entry.get('diff_rank') or my_entry.get('rank') or my_entry.get('loyalty_rank')
                if rank_val is not None:
                    try:
                        result["rank"] = int(rank_val)
                    except (ValueError, TypeError):
                        pass
                pool_matched_url = url
                break

            pool_attempts_log.append(
                f"{url} -> lista com {len(entries)} itens (formato leaderboard/diff_rank), "
                f"mas o endereço {addr_prefix}...{addr_suffix} não está nela."
            )
            if debug:
                result["debug_pool_raw_entries"] = entries
            continue

        pool_merged = data if isinstance(data, dict) else {}
        pool_hashrate_raw = (
            pool_merged.get('hashrate1hr') or pool_merged.get('hashrate5m')
            or pool_merged.get('hashrate') or pool_merged.get('poolHashrate')
        )
        pool_hashrate_ths = _parse_ckpool_hashrate_to_ths(pool_hashrate_raw)
        if pool_hashrate_ths is None and isinstance(pool_hashrate_raw, (int, float)) and pool_hashrate_raw > 0:
            pool_hashrate_ths = pool_hashrate_raw / 1e12
        if pool_hashrate_ths is not None:
            result["pool_hashrate_phs"] = pool_hashrate_ths / 1000
            result["pool_hashrate_formatted"] = (
                f"{pool_hashrate_ths / 1000:.2f} PH/s" if pool_hashrate_ths >= 1000 else f"{pool_hashrate_ths:.2f} TH/s"
            )
            pool_matched_url = url
            break
        pool_attempts_log.append(f"{url} -> HTTP {status}, JSON válido mas sem campos reconhecidos: {str(data)[:150]}")

    if debug:
        result["debug_pool_attempts"] = pool_attempts_log
        result["debug_pool_matched_url"] = pool_matched_url

    if not debug:
        with _parasite_stats_cache_lock:
            _parasite_stats_cache[cache_key] = {"ts": time.time(), "data": result}
    return result


def _format_compact_number(value, units=('', 'K', 'M', 'G', 'T', 'P', 'E', 'Z'), base=1000.0):
    if value is None:
        return None
    try:
        v = float(value)
    except (ValueError, TypeError):
        return None
    i = 0
    while v >= base and i < len(units) - 1:
        v /= base
        i += 1
    decimals = 0 if (v >= 100 or i == 0) else 1
    return f"{v:.{decimals}f}{units[i]}"


def _format_hash_days(raw):
    if raw is None:
        return None, None
    try:
        raw = float(raw)
    except (ValueError, TypeError):
        return None, None
    phd = raw / 1e15
    units = ['Hd', 'KHd', 'MHd', 'GHd', 'THd', 'PHd', 'EHd', 'ZHd']
    idx = 5
    v = phd
    while v >= 1000 and idx < len(units) - 1:
        v /= 1000
        idx += 1
    while 0 < v < 1 and idx > 0:
        v *= 1000
        idx -= 1
    decimals = 0 if v >= 100 else 2
    return v, f"{v:.{decimals}f} {units[idx]}"


def fetch_parasite_refinery_status(force=False, debug=False):
    with _parasite_refinery_status_cache_lock:
        cached = _parasite_refinery_status_cache
        if cached["data"] is not None and not force and not debug and (time.time() - cached["ts"]) < PARASITE_REFINERY_STATUS_CACHE_SECONDS:
            return cached["data"]

    out = {
        "capacity_ehd": None, "capacity_formatted": None,
        "used_phd": None, "used_formatted": None,
        "hashprice_sats_phd": None, "hashprice_formatted": None,
        "error": None,
    }
    url = f"{PARASITE_POOL_BASE_URL}/api/router/status"
    status, data, raw, net_err = _try_json_get(url)
    if debug:
        out["debug_matched_url"] = url
        out["debug_status"] = status
        out["debug_net_err"] = net_err
    if net_err:
        out["error"] = f"Falha de ligação a {url}: {net_err}"
        return out
    if not isinstance(data, dict):
        out["error"] = f"{url} -> HTTP {status}, resposta inesperada ({str(raw)[:150]!r})"
        return out

    cap_phd, cap_text = _format_hash_days(data.get('total_capacity_hash_days'))
    if cap_phd is not None:
        out["capacity_ehd"] = cap_phd / 1000.0
        out["capacity_formatted"] = cap_text

    used_phd, used_text = _format_hash_days(data.get('used_capacity_hash_days'))
    if used_phd is not None:
        out["used_phd"] = used_phd
        out["used_formatted"] = used_text

    hp = data.get('hash_price')
    if hp is not None:
        try:
            hp = float(hp)
            out["hashprice_sats_phd"] = hp
            out["hashprice_formatted"] = f"{hp:,.0f}".replace(",", " ") + " sats/PHd"
        except (ValueError, TypeError):
            pass

    if not debug:
        with _parasite_refinery_status_cache_lock:
            _parasite_refinery_status_cache["ts"] = time.time()
            _parasite_refinery_status_cache["data"] = out
    return out


def fetch_parasite_refinery(address=None, force=False, debug=False):
    address = (address or "").strip()
    cache_key = address or "__global__"
    with _parasite_refinery_cache_lock:
        entry = _parasite_refinery_cache.get(cache_key)
        if entry and not force and not debug and (time.time() - entry["ts"]) < PARASITE_REFINERY_CACHE_SECONDS:
            return entry["data"]

    result = {
        "capacity_ehd": None,
        "capacity_formatted": None,
        "used_phd": None,
        "used_formatted": None,
        "hashprice_sats_phd": None,
        "hashprice_formatted": None,
        "orders": [],
        "error": None,
    }

    if not address:
        result["error"] = "Endereço em falta."
        return result

    status_data = fetch_parasite_refinery_status(force=force, debug=debug)
    result["capacity_ehd"] = status_data.get("capacity_ehd")
    result["capacity_formatted"] = status_data.get("capacity_formatted")
    result["used_phd"] = status_data.get("used_phd")
    result["used_formatted"] = status_data.get("used_formatted")
    result["hashprice_sats_phd"] = status_data.get("hashprice_sats_phd")
    result["hashprice_formatted"] = status_data.get("hashprice_formatted")
    if debug:
        result["debug_status_endpoint"] = status_data

    encoded_addr = urllib.parse.quote(address, safe='')
    url = f"{PARASITE_POOL_BASE_URL}/api/router/orders?address={encoded_addr}"
    status, data, raw, net_err = _try_json_get(url)

    if debug:
        result["debug_matched_url"] = url
        result["debug_status"] = status
        result["debug_net_err"] = net_err
        result["debug_raw"] = raw[:2000] if isinstance(raw, str) else raw

    if net_err:
        result["error"] = f"Falha de ligação a {url}: {net_err}"
        return result
    if data is None:
        result["error"] = f"{url} -> HTTP {status}, resposta não é JSON ({str(raw)[:150]!r})"
        return result
    if not isinstance(data, list):
        result["error"] = f"{url} -> resposta JSON inesperada (esperava uma lista): {str(data)[:200]}"
        return result

    orders_out = []
    for o in data:
        if not isinstance(o, dict):
            continue
        requested_raw = o.get('requested_hash_days')
        delivered_raw = o.get('delivered_hash_days')
        _, req_text = _format_hash_days(requested_raw)

        status_str = str(o.get('status') or '').lower() or None
        if status_str == 'fulfilled':
            progress_pct = 100.0
        elif requested_raw and delivered_raw is not None:
            try:
                progress_pct = max(0.0, min(100.0, float(delivered_raw) / float(requested_raw) * 100.0))
            except (ValueError, TypeError, ZeroDivisionError):
                progress_pct = 0.0
        else:
            progress_pct = 0.0

        hashrate_val = o.get('hashrate')
        hashrate_text = f"{_format_compact_number(hashrate_val) or '0'} H/s" if hashrate_val is not None else '0 H/s'

        best_share_raw = o.get('best_share')
        best_share_text = _format_compact_number(best_share_raw) if best_share_raw is not None else None

        orders_out.append({
            "id": o.get('id'),
            "status": status_str,
            "requested_formatted": req_text,
            "hashrate": hashrate_text,
            "best_share": best_share_raw,
            "best_share_formatted": best_share_text,
            "progress_pct": progress_pct,
        })

    result["orders"] = orders_out

    if not debug:
        with _parasite_refinery_cache_lock:
            _parasite_refinery_cache[cache_key] = {"ts": time.time(), "data": result}
    return result


def writable_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


def power_config_path():
    return os.path.join(writable_dir(), POWER_CONFIG_FILENAME)


def legacy_power_config_path():
    return os.path.join(writable_dir(), LEGACY_POWER_CONFIG_FILENAME)


def load_power_config():
    path = power_config_path()
    migrating = False
    if not os.path.exists(path) and os.path.exists(legacy_power_config_path()):
        path = legacy_power_config_path()
        migrating = True
    try:
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception:
            # ficheiro estragado (ex.: a app foi fechada a meio de gravar): tenta a cópia da última gravação boa e guarda o estragado
            if not os.path.exists(path):
                raise
            try:
                import shutil
                shutil.copyfile(path, path + '.corrompido')
            except Exception:
                pass
            with open(path + '.bak', 'r', encoding='utf-8') as f:
                data = json.load(f)
            print("[config] config.json estava estragado: restaurado da cópia (.bak)", flush=True)
        cfg = copy.deepcopy(DEFAULT_POWER_CONFIG)
        cfg["mqtt"].update(data.get("mqtt", {}) or {})
        cfg["profiles"] = data.get("profiles", []) or []
        cfg["devices"] = data.get("devices", []) or []
        cfg["mrr"].update(data.get("mrr", {}) or {})
        cfg["alerts"].update(data.get("alerts", {}) or {})
        cfg["pools"].update(data.get("pools", {}) or {})
        cfg["coolant"].update(data.get("coolant", {}) or {})
        cfg["security"].update(data.get("security", {}) or {})
        if migrating:
            save_power_config(cfg)
            print(f"[config] migrado {LEGACY_POWER_CONFIG_FILENAME} -> {POWER_CONFIG_FILENAME}", flush=True)
        return cfg
    except Exception:
        return copy.deepcopy(DEFAULT_POWER_CONFIG)


def save_power_config(cfg):
    # grava num ficheiro à parte e só depois troca: se a app for fechada a meio (instalador, falha de luz) o config.json antigo
    # fica intacto, em vez de ficar cortado e a app voltar às definições de fábrica sem a lista de máquinas
    path = power_config_path()
    tmp = path + '.tmp'
    try:
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        if os.path.exists(path):
            try:
                import shutil
                shutil.copyfile(path, path + '.bak')
            except Exception:
                pass
        os.replace(tmp, path)
        return True
    except Exception:
        try:
            os.remove(tmp)
        except Exception:
            pass
        return False


power_config = load_power_config()


# --- Registo de atividade da conta (logins) --------------------------------
ACCOUNT_ACTIVITY_FILENAME = "account_activity.json"
ACCOUNT_ACTIVITY_MAX = 50
_account_activity_lock = threading.Lock()

# --- Contadores de utilizadores online/totais ---------------------------------
PRESENCE_FILENAME = "user_presence.json"
PRESENCE_TIMEOUT_SECONDS = 90
PRESENCE_CHECK_INTERVAL = 60
_user_presence_lock = threading.Lock()


def presence_path():
    return os.path.join(writable_dir(), PRESENCE_FILENAME)


def load_presence():
    try:
        with open(presence_path(), 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save_presence(data):
    try:
        with open(presence_path(), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False


def cleanup_stale_presence():
    """Remove entradas expiradas (offline) do ficheiro de presença."""
    cutoff = time.time() - PRESENCE_TIMEOUT_SECONDS
    with _user_presence_lock:
        data = load_presence()
        before = len(data)
        stale = [k for k, v in data.items() if not isinstance(v, dict) or v.get('ts', 0) < cutoff]
        for k in stale:
            data.pop(k, None)
        if stale:
            save_presence(data)
        return len(data), before - len(stale)


def record_presence(email):
    """Marca um utilizador como online. Devolve (online_count, total_registered)."""
    email = (email or '').strip().lower()
    if not email:
        return 0, 0
    with _user_presence_lock:
        data = load_presence()
        data[email] = {"ts": time.time()}
        save_presence(data)
        online = len(data)
    total = get_total_registered_users()
    return online, total


def get_online_count():
    cutoff = time.time() - PRESENCE_TIMEOUT_SECONDS
    with _user_presence_lock:
        data = load_presence()
        online = sum(1 for v in data.values() if isinstance(v, dict) and v.get('ts', 0) >= cutoff)
        return online


def get_total_registered_users():
    """Conta todos os utilizadores registados.
    Primeiro tenta a API admin accounts:query do Firebase; se falhar
    (sem service account, etc.), conta os emails únicos nos ficheiros
    de atividade e de presença."""
    # Tentativa 1: Firebase Identity Toolkit (accounts:query)
    if auth_enabled():
        total = 0
        next_page = None
        max_pages = 50
        for _ in range(max_pages):
            try:
                payload = {}
                if next_page:
                    payload["nextPageToken"] = next_page
                req = urllib.request.Request(
                    f"https://identitytoolkit.googleapis.com/v1/accounts:query?key={urllib.parse.quote(FIREBASE_API_KEY)}",
                    data=json.dumps(payload).encode('utf-8'),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with _urlopen_https(req, timeout=8) as resp:
                    result = json.loads(resp.read().decode('utf-8', errors='ignore'))
            except Exception:
                break
            users = result.get('userInfo') or []
            total += len(users)
            next_page = result.get('nextPageToken')
            if not next_page or not users:
                break
        if total > 0:
            return total

    # Tentativa 2: contar emails únicos no registo de atividade + presença
    emails = set()
    try:
        with _account_activity_lock:
            activity = load_account_activity()
        emails.update(k for k in activity if k.strip())
    except Exception:
        pass
    try:
        with _user_presence_lock:
            presence = load_presence()
        emails.update(k for k in presence if k.strip())
    except Exception:
        pass
    return len(emails)


def presence_cleanup_loop():
    """Thread de fundo que limpa entradas offline a cada 60s."""
    while True:
        time.sleep(PRESENCE_CHECK_INTERVAL)
        try:
            cleanup_stale_presence()
        except Exception:
            pass


def account_activity_path():
    return os.path.join(writable_dir(), ACCOUNT_ACTIVITY_FILENAME)


def load_account_activity():
    try:
        with open(account_activity_path(), 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save_account_activity(data):
    try:
        with open(account_activity_path(), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False


def record_account_activity(email, ip, event='login', user_agent=''):
    email = (email or '').strip().lower()
    if not email:
        return []
    entry = {
        "ts": int(time.time()),
        "ip": ip or '',
        "event": (event or 'login')[:40],
        "ua": (user_agent or '')[:200],
    }
    with _account_activity_lock:
        data = load_account_activity()
        lst = data.get(email) or []
        lst.insert(0, entry)
        data[email] = lst[:ACCOUNT_ACTIVITY_MAX]
        save_account_activity(data)
        return data[email]


def get_account_activity(email):
    email = (email or '').strip().lower()
    if not email:
        return []
    with _account_activity_lock:
        return (load_account_activity().get(email) or [])


def send_telegram_alert(bot_token, chat_id, message):
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = json.dumps({"chat_id": chat_id, "text": message}).encode('utf-8')
    req = urllib.request.Request(url, data=payload, method='POST', headers={'Content-Type': 'application/json'})
    with _urlopen_https(req, timeout=8) as resp:
        return json.loads(resp.read().decode('utf-8'))


def send_discord_alert(webhook_url, message):
    payload = json.dumps({"content": message}).encode('utf-8')
    req = urllib.request.Request(
        webhook_url,
        data=payload,
        method='POST',
        headers={
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; CentroDeComando/1.0)',
        },
    )
    with _urlopen_https(req, timeout=8) as resp:
        resp.read()
        return True


# --- diagnóstico do caminho: router, internet e DNS (para o mapa da rede) ---
_netcheck_cache = {"ts": 0, "data": None}
_netcheck_lock = threading.Lock()


def _ping_ms(host, timeout_ms=1500):
    """Tempo de resposta (ms) de um ping, ou None se não responder. Lê o 'tempo=12ms' em vários idiomas."""
    try:
        if os.name == 'nt':
            cmd, flags = ['ping', '-n', '1', '-w', str(timeout_ms), host], getattr(subprocess, 'CREATE_NO_WINDOW', 0)
        else:
            cmd, flags = ['ping', '-c', '1', '-W', str(max(1, timeout_ms // 1000)), host], 0
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_ms / 1000 + 2, creationflags=flags).stdout or ""
        m = re.search(r'(?:time|tempo|tiempo|temps|durée|zeit)\s*[=<]\s*([\d.,]+)', out, re.I)
        if m:
            return float(m.group(1).replace(',', '.'))
        return None
    except Exception:
        return None


def _tcp_ms(host, port, timeout=2.0):
    try:
        t0 = time.time()
        with socket.create_connection((host, port), timeout=timeout):
            return (time.time() - t0) * 1000
    except Exception:
        return None


def _local_gateway():
    """O router costuma ser o endereço .1 da rede do PC."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip.rsplit('.', 1)[0] + '.1'
    except Exception:
        return None


def netcheck(force=False):
    with _netcheck_lock:
        if not force and _netcheck_cache["data"] and time.time() - _netcheck_cache["ts"] < 15:
            return _netcheck_cache["data"]
    gw = _local_gateway()

    def internet():
        vals = [v for v in (_ping_ms("1.1.1.1"), _ping_ms("8.8.8.8")) if v is not None]
        if vals:
            return min(vals)
        return _tcp_ms("1.1.1.1", 443)

    def dns():
        try:
            t0 = time.time()
            socket.getaddrinfo("one.one.one.one", 443)
            return (time.time() - t0) * 1000
        except Exception:
            return None

    with ThreadPoolExecutor(max_workers=3) as ex:
        f_gw = ex.submit(lambda: (_ping_ms(gw) if gw else None))
        f_net, f_dns = ex.submit(internet), ex.submit(dns)
        gw_ms, net_ms, dns_ms = f_gw.result(), f_net.result(), f_dns.result()
    if gw and gw_ms is None:
        gw_ms = _tcp_ms(gw, 80, 1.0) or _tcp_ms(gw, 443, 1.0)
    data = {"gateway": {"ip": gw, "ms": gw_ms}, "internet": {"ms": net_ms}, "dns": {"ms": dns_ms}, "ts": time.time()}
    with _netcheck_lock:
        _netcheck_cache.update({"ts": time.time(), "data": data})
    return data


_plug_lock = threading.Lock()
_plug_busy = set()


def _plug_url_ok(url):
    """Só aceita http/https para um aparelho da rede local (IP privado ou nome sem domínio público)."""
    try:
        parts = urllib.parse.urlsplit(url)
        if parts.scheme not in ("http", "https") or not parts.hostname:
            return False
        host = parts.hostname
        try:
            ip = ipaddress.ip_address(host)
        except ValueError:
            ip = ipaddress.ip_address(socket.gethostbyname(host))
        return ip.is_private or ip.is_loopback or ip.is_link_local
    except Exception:
        return False


def plug_cycle(dev_ip):
    """Desliga a tomada, espera e volta a ligar. Devolve (ok, mensagem)."""
    with POWER_CONFIG_LOCK:
        dev = next((d for d in power_config.get("devices", []) if d.get("ip") == dev_ip), None)
    if not dev:
        return False, "máquina não encontrada"
    off_url, on_url = str(dev.get("plugOff") or ""), str(dev.get("plugOn") or "")
    wait = max(3, min(30, int(dev.get("plugWait") or 8)))
    if not off_url or not on_url:
        return False, "a tomada não está configurada"
    if not (_plug_url_ok(off_url) and _plug_url_ok(on_url)):
        return False, "os endereços da tomada têm de ser da rede local"
    with _plug_lock:
        if dev_ip in _plug_busy:
            return False, "já há um ciclo de energia em curso"
        _plug_busy.add(dev_ip)
    try:
        def call(url):
            req = urllib.request.Request(url, headers={'User-Agent': 'HashCommander-Plug'})
            with urllib.request.urlopen(req, timeout=6) as resp:
                return resp.status
        try:
            call(off_url)
        except Exception as e:
            return False, f"não foi possível desligar a tomada ({e})"
        time.sleep(wait)
        last = None
        for _ in range(3):
            try:
                call(on_url)
                return True, f"tomada desligada {wait} s e voltou a ligar"
            except Exception as e:
                last = e
                time.sleep(2)
        return False, f"A TOMADA FICOU DESLIGADA: não foi possível voltar a ligá-la ({last}). Ligue-a à mão."
    finally:
        with _plug_lock:
            _plug_busy.discard(dev_ip)


def send_custom_webhook(url, message):
    """Envia o alerta para um endereço à escolha. Para o ntfy manda texto simples; para os outros
    manda JSON com os campos mais comuns (message, text, content), que serve ao Home Assistant, Slack e Discord."""
    parts = urllib.parse.urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        raise ValueError("endereço inválido")
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; CentroDeComando/1.0)'}
    if "ntfy" in parts.netloc.lower():
        payload = message.encode('utf-8')
        headers.update({'Title': 'Centro de Comando', 'Content-Type': 'text/plain; charset=utf-8'})
    else:
        payload = json.dumps({"message": message, "text": message, "content": message, "source": "hash-commander"}).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=payload, method='POST', headers=headers)
    with _urlopen_https(req, timeout=8) as resp:
        resp.read()
        return True


def send_windows_toast(title, message):
    if not WINDOWS_TOAST_AVAILABLE:
        return
    try:
        icon_path = os.path.join(resource_dir(), TRAY_ICON_FILENAME)
        toast = _WinToastNotification(
            app_id="Centro de Comando",
            title=title,
            msg=message,
            icon=icon_path if os.path.exists(icon_path) else "",
            duration="short",
        )
        toast.show()
    except Exception as e:
        print(f"[toast] falha ao mostrar notificação: {e}", flush=True)


def broadcast_alert(message, title="🔔 Centro de Comando"):
    with POWER_CONFIG_LOCK:
        alerts_cfg = copy.deepcopy(power_config.get("alerts", {}) or {})

    errors = []
    bot_token = alerts_cfg.get("telegram_bot_token", "").strip()
    chat_id = alerts_cfg.get("telegram_chat_id", "").strip()
    if bot_token and chat_id:
        try:
            send_telegram_alert(bot_token, chat_id, message)
        except Exception as e:
            errors.append(f"Telegram: {e}")

    webhook_url = alerts_cfg.get("discord_webhook_url", "").strip()
    if webhook_url:
        try:
            send_discord_alert(webhook_url, message)
        except Exception as e:
            errors.append(f"Discord: {e}")

    custom = alerts_cfg.get("webhook_url", "").strip()
    if custom:
        try:
            send_custom_webhook(custom, message)
        except Exception as e:
            errors.append(f"Webhook: {e}")

    if alerts_cfg.get("notify_windows_toast", True):
        send_windows_toast(title, message)

    return errors


MRR_API_BASE = "https://www.miningrigrentals.com/api/v2"
MRR_NONCE_LOCK = threading.Lock()
_mrr_last_nonce = [0]


def mrr_next_nonce():
    with MRR_NONCE_LOCK:
        n = int(time.time() * 1000)
        if n <= _mrr_last_nonce[0]:
            n = _mrr_last_nonce[0] + 1
        _mrr_last_nonce[0] = n
        return str(n)


def mrr_request(endpoint, method='GET', params=None):
    api_key = (power_config.get("mrr", {}) or {}).get("api_key", "").strip()
    api_secret = (power_config.get("mrr", {}) or {}).get("api_secret", "").strip()
    if not api_key or not api_secret:
        raise Exception("Chave/segredo da MiningRigRentals não configurados")

    nonce = mrr_next_nonce()
    sign_string = f"{api_key}{nonce}{endpoint}"
    signature = hmac.new(api_secret.encode('utf-8'), sign_string.encode('utf-8'), hashlib.sha1).hexdigest()

    url = f"{MRR_API_BASE}{endpoint}"
    if params:
        url += "?" + urllib.parse.urlencode(params)

    req = urllib.request.Request(url, method=method, headers={
        'x-api-key': api_key,
        'x-api-sign': signature,
        'x-api-nonce': nonce,
        'User-Agent': 'NerdQaxeDashboard/1.0',
    })
    with _urlopen_https(req, timeout=10) as response:
        return json.loads(response.read().decode('utf-8'))


LATEST_READINGS = {}
LATEST_READINGS_LOCK = threading.Lock()
READING_MAX_AGE = 20


def cache_reading(ip, data):
    with LATEST_READINGS_LOCK:
        LATEST_READINGS[ip] = {"data": data, "ts": time.time()}
    try:
        best = data.get("bestSessionDiff") or data.get("bestDiff")
        record_diff_history(ip, best)
    except Exception:
        pass
    try:
        best = data.get("bestSessionDiff") or data.get("bestDiff")
        record_diff_bucket(ip, best)
    except Exception as e:
        try:
            with open(os.path.join(writable_dir(), 'diff_buckets_error.log'), 'a', encoding='utf-8') as f:
                f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} ip={ip} best={best!r} error={e!r}\n")
        except Exception:
            pass
    try:
        record_diff_event(ip, _record_source_value(data))
    except Exception:
        pass


def build_overlay_snapshot():
    with POWER_CONFIG_LOCK:
        registry = copy.deepcopy(power_config.get("devices", []))
    with LATEST_READINGS_LOCK:
        readings_snapshot = dict(LATEST_READINGS)

    now = time.time()
    machines = []
    total_hashrate_ghs = 0.0
    total_power_w = 0.0
    have_power = False
    temps = []
    best_all = 0.0
    blocks_total = 0
    online_count = 0

    for dev in registry:
        ip = dev.get('ip')
        name = dev.get('name') or ip
        cached = readings_snapshot.get(ip)
        online = bool(cached and (now - cached['ts']) <= READING_MAX_AGE)
        d = cached['data'] if cached else {}

        hashrate_ghs = float(d.get('hashRate') or d.get('hashrate') or 0) if online else 0.0
        temp = d.get('temp') if online else None
        power = d.get('power') if online else None
        best = float(d.get('bestSessionDiff') or d.get('bestDiff') or 0)
        blocks = int(d.get('blockFound') or d.get('blocksFound') or 0)

        algo = d.get('algorithm') or 'sha256'
        m_type = d.get('type') or 'asic_sha256'
        hr_disp = d.get('hashrate_display') or (f"{round(hashrate_ghs, 2)} GH/s" if hashrate_ghs else "—")

        efficiency = None
        if online and power and hashrate_ghs > 0:
            efficiency = power / (hashrate_ghs / 1000)

        machines.append({
            "name": name,
            "ip": ip,
            "online": online,
            "algorithm": algo,
            "type": m_type,
            "hashrate_ghs": round(hashrate_ghs, 2),
            "hashrate_display": hr_disp,
            "temp_c": round(temp, 1) if isinstance(temp, (int, float)) else None,
            "power_w": round(power, 1) if isinstance(power, (int, float)) else None,
            "efficiency_j_th": round(efficiency, 2) if efficiency is not None else None,
            "best_diff": best,
            "blocks_found": blocks,
        })

        if online:
            online_count += 1
            total_hashrate_ghs += hashrate_ghs
            if isinstance(temp, (int, float)):
                temps.append(temp)
            if isinstance(power, (int, float)) and power > 0:
                have_power = True
                total_power_w += power
        best_all = max(best_all, best)
        blocks_total += blocks

    farm_efficiency = (total_power_w / (total_hashrate_ghs / 1000)) if (have_power and total_hashrate_ghs > 0) else None

    farm = {
        "total_hashrate_ghs": round(total_hashrate_ghs, 2),
        "total_hashrate_ths": round(total_hashrate_ghs / 1000, 3),
        "total_power_w": round(total_power_w, 1) if have_power else None,
        "avg_temp_c": round(sum(temps) / len(temps), 1) if temps else None,
        "efficiency_j_th": round(farm_efficiency, 2) if farm_efficiency is not None else None,
        "best_diff": best_all,
        "blocks_found": blocks_total,
        "online_count": online_count,
        "total_count": len(registry),
    }
    return farm, machines


def parse_numeric_payload(payload):
    text = payload.decode('utf-8', errors='ignore').strip() if isinstance(payload, (bytes, bytearray)) else str(payload).strip()
    try:
        return float(text)
    except (TypeError, ValueError):
        pass
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            for key in ('state', 'value', 'val'):
                if key in data:
                    try:
                        return float(data[key])
                    except (TypeError, ValueError):
                        continue
    except Exception:
        pass
    return None


def evaluate_suggested_profile(profiles, solar, tariff):
    for profile in profiles:
        min_solar = profile.get("min_solar")
        max_tariff = profile.get("max_tariff")
        if min_solar not in (None, ""):
            if solar is None or solar < float(min_solar):
                continue
        if max_tariff not in (None, ""):
            if tariff is None or tariff > float(max_tariff):
                continue
        return profile
    return None


def stop_mqtt_client():
    client = mqtt_client_ref.get("client")
    if client:
        try:
            client.loop_stop()
            client.disconnect()
        except Exception:
            pass
    mqtt_client_ref["client"] = None
    with mqtt_state_lock:
        mqtt_state["connected"] = False


def start_mqtt_client(cfg):
    stop_mqtt_client()

    if not MQTT_AVAILABLE:
        with mqtt_state_lock:
            mqtt_state["error"] = "A biblioteca paho-mqtt não está instalada neste ambiente."
        return

    mqtt_cfg = cfg.get("mqtt", {})
    host = (mqtt_cfg.get("host") or "").strip()
    if not host:
        with mqtt_state_lock:
            mqtt_state["error"] = "Broker MQTT não configurado."
        return

    port = int(mqtt_cfg.get("port") or 1883)
    username = (mqtt_cfg.get("username") or "").strip() or None
    password = mqtt_cfg.get("password") or None
    topic_solar = (mqtt_cfg.get("topic_solar") or "").strip()
    topic_tariff = (mqtt_cfg.get("topic_tariff") or "").strip()

    def on_connect(client, userdata, flags, rc, properties=None):
        with mqtt_state_lock:
            mqtt_state["connected"] = (rc == 0)
            mqtt_state["error"] = None if rc == 0 else f"Falha na ligação MQTT (código {rc})"
        if rc == 0:
            if topic_solar:
                client.subscribe(topic_solar)
            if topic_tariff:
                client.subscribe(topic_tariff)

    def on_disconnect(client, userdata, rc, properties=None):
        with mqtt_state_lock:
            mqtt_state["connected"] = False

    def on_message(client, userdata, msg):
        value = parse_numeric_payload(msg.payload)
        if value is None:
            return
        with mqtt_state_lock:
            if topic_solar and msg.topic == topic_solar:
                mqtt_state["solar"] = value
                mqtt_state["last_update"] = time.time()
            elif topic_tariff and msg.topic == topic_tariff:
                mqtt_state["tariff"] = value
                mqtt_state["last_update"] = time.time()

    try:
        try:
            client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION1)
        except (AttributeError, TypeError):
            client = mqtt.Client()
        if username:
            client.username_pw_set(username, password)
        client.on_connect = on_connect
        client.on_disconnect = on_disconnect
        client.on_message = on_message
        client.connect_async(host, port, keepalive=30)
        client.loop_start()
        mqtt_client_ref["client"] = client
    except Exception as e:
        with mqtt_state_lock:
            mqtt_state["connected"] = False
            mqtt_state["error"] = str(e)


def resource_dir():
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip


def _known_device_ips():
    with POWER_CONFIG_LOCK:
        devices = power_config.get("devices", []) or []
    return {str(d.get("ip", "")).strip() for d in devices if d.get("ip")}


def is_proxy_target_allowed(ip):
    with POWER_CONFIG_LOCK:
        restrict = bool(power_config.get("security", {}).get("restrict_proxy_to_known_ips", True))
    if not restrict:
        return True
    return ip in _known_device_ips()


def diagnose_device(ip):
    """(tipo, motivo) de uma máquina aparecer offline. O painel mostra o motivo no cartão e no registo de eventos."""
    if not is_proxy_target_allowed(ip):
        return 'unknown_ip', "o servidor não tem este IP na lista de máquinas (a lista guardada no servidor ficou vazia ou desatualizada)"

    def is_open(p):
        try:
            socket.create_connection((ip, p), timeout=1.2).close()
            return True
        except Exception:
            return False
    with ThreadPoolExecutor(max_workers=2) as ex:
        f80, f4028 = ex.submit(is_open, 80), ex.submit(is_open, CGMINER_PORT)
        open80, open4028 = f80.result(), f4028.result()
    with endpoint_cache_lock:
        preferred = endpoint_cache.get(ip)
    if open4028 and (preferred in (None, 'cgminer') or not open80):
        return 'cgminer', cgminer_diagnose(ip)
    if open80:
        return 'http', "a porta 80 responde mas a API da máquina não (modo de configuração Wi-Fi, firmware sem API ou outro tipo de máquina)"
    return 'unreachable', "sem resposta nas portas 80 e 4028: máquina desligada, IP mudou ou está noutra rede"


TLS_CERT_FILENAME = "server_cert.pem"
TLS_KEY_FILENAME = "server_key.pem"


def _tls_cert_paths():
    return (
        os.path.join(writable_dir(), TLS_CERT_FILENAME),
        os.path.join(writable_dir(), TLS_KEY_FILENAME),
    )


def ensure_self_signed_cert():
    cert_path, key_path = _tls_cert_paths()
    if os.path.exists(cert_path) and os.path.exists(key_path):
        return cert_path, key_path

    try:
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.x509.oid import NameOID
        import datetime

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Centro de Comando (rede local)")])

        san_entries = [x509.DNSName("localhost")]
        for candidate_ip in ("127.0.0.1", "::1", get_local_ip()):
            try:
                san_entries.append(x509.IPAddress(ipaddress.ip_address(candidate_ip)))
            except Exception:
                pass

        now = datetime.datetime.utcnow()
        cert = (
            x509.CertificateBuilder()
            .subject_name(name)
            .issuer_name(name)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now - datetime.timedelta(days=1))
            .not_valid_after(now + datetime.timedelta(days=3650))
            .add_extension(x509.SubjectAlternativeName(san_entries), critical=False)
            .sign(key, hashes.SHA256())
        )

        with open(key_path, "wb") as f:
            f.write(key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            ))
        with open(cert_path, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))

        print(f"[tls] certificado autoassinado gerado em {cert_path}", flush=True)
        return cert_path, key_path
    except ModuleNotFoundError:
        print("[tls] pacote 'cryptography' não instalado - modo HTTPS indisponível "
              "(a app continua a funcionar normalmente em HTTP).", flush=True)
        return None
    except Exception as e:
        print(f"[tls] falha ao gerar certificado autoassinado: {e}", flush=True)
        return None


def dashboard_url_scheme():
    with POWER_CONFIG_LOCK:
        return "https" if power_config.get("security", {}).get("https_enabled") else "http"


# --- Acesso remoto seguro via Tailscale ------------------------------------
# O Tailscale cria uma rede privada entre os teus dispositivos: o telemóvel liga-se ao PC sem abrir portas no router.
# "tailscale serve" publica o painel em HTTPS só dentro dessa rede (nunca o Funnel, que seria a internet pública).
# O login do Hash Commander continua obrigatório em todas as rotas /api/.
def remote_keepalive():
    # HC_KEEPALIVE=1 (servidor sem ecrã, ex.: Raspberry): nunca se desliga sozinho
    if os.environ.get('HC_KEEPALIVE') == '1':
        return True
    with POWER_CONFIG_LOCK:
        return bool(power_config.get("security", {}).get("remote_keepalive"))


def find_tailscale():
    import shutil
    exe = shutil.which('tailscale')
    if exe:
        return exe
    for var in ('ProgramFiles', 'ProgramFiles(x86)', 'LOCALAPPDATA'):
        base = os.environ.get(var)
        if base:
            p = os.path.join(base, 'Tailscale', 'tailscale.exe')
            if os.path.isfile(p):
                return p
    return None


def _run_tailscale(args, timeout=8):
    exe = find_tailscale()
    if not exe:
        return None, 'tailscale não instalado'
    try:
        r = subprocess.run([exe] + args, capture_output=True, text=True, timeout=timeout,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0), encoding='utf-8', errors='replace')
        return r, None
    except subprocess.TimeoutExpired:
        return None, 'timeout'
    except Exception as e:
        return None, str(e)


def tailscale_status():
    out = {"installed": False, "running": False, "state": "", "ips": [], "dns": "", "tailnet": "", "peers_online": 0,
           "serve": False, "scheme": dashboard_url_scheme(), "port": PORT, "keepalive": remote_keepalive()}
    if not find_tailscale():
        return out
    out["installed"] = True
    r, err = _run_tailscale(['status', '--json'])
    if r is None or not (r.stdout or '').strip():
        out["error"] = err or ((r.stderr or '').strip() if r is not None else 'sem resposta')
        return out
    try:
        st = json.loads(r.stdout)
    except Exception:
        out["error"] = 'resposta inesperada do tailscale'
        return out
    me = st.get("Self") or {}
    out["state"] = st.get("BackendState", "")
    out["running"] = out["state"] == "Running"
    out["ips"] = list(st.get("TailscaleIPs") or me.get("TailscaleIPs") or [])
    out["dns"] = (me.get("DNSName") or "").rstrip('.')
    out["tailnet"] = (st.get("CurrentTailnet") or {}).get("Name", "")
    out["peers_online"] = sum(1 for p in (st.get("Peer") or {}).values() if p.get("Online"))
    r2, _ = _run_tailscale(['serve', 'status', '--json'], timeout=5)
    if r2 is not None and r2.returncode == 0:
        try:
            web = (json.loads(r2.stdout or '{}') or {}).get("Web") or {}
            out["serve"] = any(k.endswith(':443') for k in web)
        except Exception:
            pass
    return out


def tailscale_serve(enable):
    # publica (ou retira) o painel em https://<nome>.ts.net — só dentro da tua rede Tailscale
    exe = find_tailscale()
    if not exe:
        return {"ok": False, "error": "tailscale não instalado"}
    if not enable:
        args = ['serve', '--https=443', 'off']
    else:
        target = ('https+insecure://127.0.0.1:%d' if dashboard_url_scheme() == 'https' else 'http://127.0.0.1:%d') % PORT
        args = ['serve', '--bg', '--https=443', target]
    # lê a saída à medida que chega: se o Serve não estiver ativado na conta, o tailscale imprime o link e fica à espera
    try:
        p = subprocess.Popen([exe] + args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8',
                             errors='replace', creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except Exception as e:
        return {"ok": False, "error": str(e)}
    chunks = []

    def _read():
        try:
            for line in p.stdout:
                chunks.append(line)
        except Exception:
            pass
    threading.Thread(target=_read, daemon=True).start()
    end = time.time() + 20
    url = ''
    while time.time() < end and p.poll() is None:
        m = re.search(r'https://login\.tailscale\.com/\S+', ''.join(chunks))
        if m:
            url = m.group(0)
            break
        time.sleep(0.3)
    text = ''.join(chunks).strip()
    if p.poll() is None:
        try:
            p.kill()
        except Exception:
            pass
        return {"ok": False, "error": "" if url else text[-400:], "enable_url": url, "hint": "" if url else "timeout"}
    return {"ok": p.returncode == 0, "error": '' if p.returncode == 0 else text[-400:], "enable_url": ""}


def probe_ip(ip):
    for path in ('/api/system/info', '/api/system'):
        try:
            req = urllib.request.Request(
                f"http://{ip}{path}",
                headers={'User-Agent': 'NerdQaxeDashboard/1.0', 'Accept-Encoding': 'gzip, deflate'}
            )
            with _urlopen_https(req, timeout=SCAN_TIMEOUT) as resp:
                raw = resp.read()
                if resp.headers.get('Content-Encoding') == 'gzip' or raw[:2] == b'\x1f\x8b':
                    with gzip.GzipFile(fileobj=io.BytesIO(raw)) as gz:
                        raw = gz.read()
                data = json.loads(raw.decode('utf-8', errors='ignore'))
                if not isinstance(data, dict):
                    continue
                if not (set(data.keys()) & NERDQAXE_SIGNATURE_FIELDS):
                    continue
                return {
                    "ip": ip,
                    "hostname": data.get("hostname") or data.get("ASICModel") or ip,
                    "model": data.get("ASICModel", ""),
                    "protocol": "axeos-http",
                    "algorithm": "sha256",
                    "type": "asic_sha256",
                }
        except Exception:
            continue

    # Testa se é um ASIC via socket cgminer (Antminer SHA-256 ou Scrypt L3+/DG)
    result = probe_cgminer(ip)
    if result:
        return result

    # Testa se é uma Goldshell via interface HTTP
    result = probe_goldshell_http(ip)
    if result:
        return result

    # Testa se é uma ePIC (PowerPlay, HTTP na porta 4028)
    result = probe_epic(ip)
    if result:
        return result

    # Testa se é uma Rig GPU/CPU com SRBMiner-Multi
    result = probe_srbminer(ip)
    if result:
        return result

    # Testa se é uma Rig NVIDIA com T-Rex Miner
    result = probe_trex(ip)
    if result:
        return result

    return None


def scan_subnet(subnet):
    found = []
    with ThreadPoolExecutor(max_workers=SCAN_MAX_WORKERS) as executor:
        futures = {executor.submit(probe_ip, f"{subnet}.{i}"): i for i in range(1, 255)}
        for future in as_completed(futures):
            result = future.result()
            if result:
                found.append(result)
    found.sort(key=lambda d: tuple(int(p) for p in d["ip"].split(".")))
    return found


# --- Autenticação Firebase (login obrigatório) -----------------------------
# A API key de uma app web Firebase NÃO é secreta; a segurança vem de a conta
# ser validada no Firebase. Deixa vazia para desativar o login (modo antigo).
FIREBASE_API_KEY_INLINE = "AIzaSyDU-6ekXo7_8PhsbYPohW1rv0mkNsikWvg"  # <- COLA AQUI a API key web do Firebase, entre as aspas (ex.: "AIza...")


def _load_firebase_key():
    k = os.environ.get("FIREBASE_API_KEY", "").strip() or FIREBASE_API_KEY_INLINE.strip()
    if k:
        return k
    dirs = []
    if getattr(sys, 'frozen', False):
        dirs.append(os.path.dirname(sys.executable))
    dirs += [os.path.dirname(os.path.abspath(__file__)), os.getcwd()]
    for d in dirs:
        try:
            with open(os.path.join(d, "firebase_key.txt"), encoding="utf-8") as f:
                k = f.read().strip()
            if k:
                return k
        except Exception:
            continue
    return ""


FIREBASE_API_KEY = _load_firebase_key()
FIREBASE_PROJECT_ID = "dashboard-a07d4"
AUTH_REQUIRE_VERIFIED_EMAIL = False
AUTH_TOKEN_CACHE_SECONDS = 300
# Rotas /api/ que continuam abertas (login, keep-alive e overlays Rainmeter/OBS)
AUTH_EXEMPT_PATHS = {
    '/api/auth/config', '/api/heartbeat', '/api/version',
    '/api/overlay', '/api/overlay/rainmeter',
    '/api/user-counts',
}
_auth_cache = {}
_auth_cache_lock = threading.Lock()


def auth_enabled():
    return bool(FIREBASE_API_KEY)


AUTH_GRACE_SECONDS = 24 * 3600   # sem internet, aceita tokens já validados nas últimas 24 h
_auth_grace_lock = threading.Lock()


def _auth_grace_path():
    return os.path.join(os.path.dirname(account_activity_path()), "auth_grace.json")


def _auth_grace_load():
    try:
        with open(_auth_grace_path(), 'r', encoding='utf-8') as f:
            d = json.load(f)
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


def _auth_grace_store(key, user, now):
    with _auth_grace_lock:
        d = _auth_grace_load()
        d[key] = {"ts": now, "uid": user.get("uid", ""), "email": user.get("email", "")}
        for k in [k for k, v in d.items() if now - (v or {}).get("ts", 0) > AUTH_GRACE_SECONDS]:
            d.pop(k, None)
        if len(d) > 50:
            for k in sorted(d, key=lambda x: d[x].get("ts", 0))[:len(d) - 50]:
                d.pop(k, None)
        try:
            with open(_auth_grace_path(), 'w', encoding='utf-8') as f:
                json.dump(d, f)
        except Exception:
            pass


def _auth_grace_lookup(key, now):
    with _auth_grace_lock:
        v = _auth_grace_load().get(key)
    if v and now - v.get("ts", 0) <= AUTH_GRACE_SECONDS:
        return {"uid": v.get("uid", ""), "email": v.get("email", "")}
    return None


def verify_firebase_token(id_token):
    """Valida um ID token no Firebase (accounts:lookup) e devolve {uid, email}, ou None.
    Cache curta; se o Firebase estiver inacessível (sem internet), aceita tokens exatamente
    iguais a um já validado nas últimas 24 h, para o painel local não ficar bloqueado."""
    key = hashlib.sha256(id_token.encode('utf-8')).hexdigest()
    now = time.time()
    with _auth_cache_lock:
        hit = _auth_cache.get(key)
        if hit and hit["exp"] > now:
            return hit["user"]
        for k in [k for k, v in _auth_cache.items() if v["exp"] <= now]:
            _auth_cache.pop(k, None)
    try:
        req = urllib.request.Request(
            f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={urllib.parse.quote(FIREBASE_API_KEY)}",
            data=json.dumps({"idToken": id_token}).encode('utf-8'),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with _urlopen_https(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError:
        return None                      # o Firebase recusou o token (inválido/expirado)
    except Exception:
        return _auth_grace_lookup(key, now)   # sem ligação ao Firebase
    users = data.get("users") or []
    if not users or users[0].get("disabled"):
        return None
    if AUTH_REQUIRE_VERIFIED_EMAIL and not users[0].get("emailVerified"):
        return None
    user = {"uid": users[0].get("localId", ""), "email": users[0].get("email", "")}
    with _auth_cache_lock:
        _auth_cache[key] = {"exp": now + AUTH_TOKEN_CACHE_SECONDS, "user": user}
    _auth_grace_store(key, user, now)
    return user


class NerdQaxeProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=resource_dir(), **kwargs)

    def log_message(self, format, *args):
        pass

    def _is_local_request(self):
        # Pedido feito neste próprio PC e não reencaminhado por um proxy
        try:
            ip = self.client_address[0]
        except Exception:
            return False
        # o "tailscale serve" liga a partir de 127.0.0.1: os pedidos que ele reencaminha trazem estes cabeçalhos e NÃO são locais
        if self.headers.get('Tailscale-User-Login') or self.headers.get('Tailscale-Funnel-Request'):
            return False
        return (ip in ('::1', '::ffff:127.0.0.1') or ip.startswith('127.')) and not self.headers.get('X-Forwarded-For')

    def _send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _require_auth(self, path):
        if not auth_enabled() or not path.startswith('/api/') or path in AUTH_EXEMPT_PATHS:
            return True
        # O aviso de fecho (navigator.sendBeacon) não consegue enviar o token,
        # por isso fechar o servidor é permitido sem login só a partir deste PC.
        if path == '/api/close' and self._is_local_request():
            return True
        header = self.headers.get('Authorization', '')
        token = header[7:].strip() if header.lower().startswith('bearer ') else ''
        user = verify_firebase_token(token) if token else None
        if user:
            self._auth_user = user
            return True
        self.send_response(401)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps({"error": "auth_required"}).encode('utf-8'))
        return False

    def _auth_email(self, supplied):
        # Com login ativo usa SEMPRE o e-mail do token validado, nunca o que o cliente envia.
        u = getattr(self, '_auth_user', None)
        if auth_enabled() and u and u.get('email'):
            return u['email']
        return supplied if not auth_enabled() else ''

    def _client_ip(self):
        try:
            ip = self.client_address[0]
        except Exception:
            return ''
        xff = self.headers.get('X-Forwarded-For', '')
        # só confia no X-Forwarded-For se o pedido vier de um proxy local
        if xff and ip in ('127.0.0.1', '::1'):
            return xff.split(',')[0].strip()
        return ip

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        if path == '/api/auth/config':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({
                "enabled": auth_enabled(),
                "apiKey": FIREBASE_API_KEY,
                "projectId": FIREBASE_PROJECT_ID,
            }).encode('utf-8'))
            return

        if path == '/api/user-counts':
            online = get_online_count()
            total = get_total_registered_users()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"online": online, "total": total}).encode('utf-8'))
            return

        if not self._require_auth(path):
            return

        if path == '/api/account/activity':
            email = self._auth_email((query_params.get('email') or [''])[0])
            entries = get_account_activity(email)
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "entries": entries}, ensure_ascii=False).encode('utf-8'))
            return

        if path == '/api/proxy':
            ip_list = query_params.get('ip')
            if not ip_list or not ip_list[0].strip():
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "IP inválido ou ausente"}).encode('utf-8'))
                return

            target_ip = ip_list[0].strip()

            if not is_proxy_target_allowed(target_ip):
                self.send_response(403)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "error": "IP não reconhecido - adiciona esta máquina ao painel antes de a consultar"
                }).encode('utf-8'))
                return

            with endpoint_cache_lock:
                preferred = endpoint_cache.get(target_ip, 'info')
            
            candidate_methods = ('info', 'system', 'cgminer', 'goldshell-http', 'epic', 'srbminer-http', 'trex-http')
            order = [preferred] + [m for m in candidate_methods if m != preferred]

            last_error = None
            for method in order:
                try:
                    if method in ('info', 'system'):
                        path_suffix = '/api/system/info' if method == 'info' else '/api/system'
                        req = urllib.request.Request(
                            f"http://{target_ip}{path_suffix}",
                            headers={
                                'User-Agent': 'NerdQaxeDashboard/1.0',
                                'Accept-Encoding': 'gzip, deflate'
                            }
                        )
                        with _urlopen_https(req, timeout=1.8) as response:
                            raw_data = response.read()
                            if response.headers.get('Content-Encoding') == 'gzip' or raw_data[:2] == b'\x1f\x8b':
                                buffer = io.BytesIO(raw_data)
                                with gzip.GzipFile(fileobj=buffer) as gz:
                                    data = gz.read()
                            else:
                                data = raw_data

                            try:
                                parsed = json.loads(data.decode('utf-8'))
                            except Exception:
                                last_error = Exception(
                                    f"{method}: resposta não é JSON válido "
                                    "(máquina pode estar em modo de configuração WiFi/captive portal)"
                                )
                                continue
                            if not isinstance(parsed, dict) or not (set(parsed.keys()) & NERDQAXE_SIGNATURE_FIELDS):
                                last_error = Exception(
                                    f"{method}: resposta não parece ser da API da máquina "
                                    "(máquina pode estar em modo de configuração WiFi/captive portal)"
                                )
                                continue

                            # Normaliza chaves multi-algoritmo para AxeOS
                            if "algorithm" not in parsed:
                                parsed["algorithm"] = "sha256"
                            if "type" not in parsed:
                                parsed["type"] = "asic_sha256"
                            if "hashrate_display" not in parsed and "hashRate" in parsed:
                                try:
                                    hr = float(parsed["hashRate"] or 0)
                                    parsed["hashrate_display"] = f"{hr / 1000:.2f} TH/s" if hr >= 1000 else f"{hr:.2f} GH/s"
                                except (ValueError, TypeError):
                                    pass
                            if "hashrate_raw" not in parsed and "hashRate" in parsed:
                                try:
                                    parsed["hashrate_raw"] = float(parsed["hashRate"] or 0) * 1e9
                                except (ValueError, TypeError):
                                    pass

                            try:
                                cache_reading(target_ip, parsed)
                            except Exception:
                                pass

                            with endpoint_cache_lock:
                                endpoint_cache[target_ip] = method

                            self.send_response(200)
                            self.send_header('Access-Control-Allow-Origin', '*')
                            self.send_header('Content-Type', 'application/json; charset=utf-8')
                            self.end_headers()
                            self.wfile.write(json.dumps(parsed).encode('utf-8'))
                            return

                    elif method == 'goldshell-http':
                        goldshell_data = fetch_goldshell_http_full(target_ip)
                        if goldshell_data is not None:
                            cache_reading(target_ip, goldshell_data)
                            with endpoint_cache_lock:
                                endpoint_cache[target_ip] = 'goldshell-http'
                            self.send_response(200)
                            self.send_header('Access-Control-Allow-Origin', '*')
                            self.send_header('Content-Type', 'application/json; charset=utf-8')
                            self.end_headers()
                            self.wfile.write(json.dumps(goldshell_data).encode('utf-8'))
                            return
                        last_error = Exception("goldshell-http: sem resposta")

                    elif method == 'epic':
                        epic_data = fetch_epic_full(target_ip)
                        if epic_data is not None:
                            cache_reading(target_ip, epic_data)
                            with endpoint_cache_lock:
                                endpoint_cache[target_ip] = 'epic'
                            self.send_response(200)
                            self.send_header('Access-Control-Allow-Origin', '*')
                            self.send_header('Content-Type', 'application/json; charset=utf-8')
                            self.end_headers()
                            self.wfile.write(json.dumps(epic_data).encode('utf-8'))
                            return
                        last_error = Exception("epic: sem resposta")

                    elif method == 'srbminer-http':
                        srb_data = fetch_srbminer_full(target_ip)
                        if srb_data is not None:
                            cache_reading(target_ip, srb_data)
                            with endpoint_cache_lock:
                                endpoint_cache[target_ip] = 'srbminer-http'
                            self.send_response(200)
                            self.send_header('Access-Control-Allow-Origin', '*')
                            self.send_header('Content-Type', 'application/json; charset=utf-8')
                            self.end_headers()
                            self.wfile.write(json.dumps(srb_data).encode('utf-8'))
                            return
                        last_error = Exception("srbminer-http: sem resposta")

                    elif method == 'trex-http':
                        trex_data = fetch_trex_full(target_ip)
                        if trex_data is not None:
                            cache_reading(target_ip, trex_data)
                            with endpoint_cache_lock:
                                endpoint_cache[target_ip] = 'trex-http'
                            self.send_response(200)
                            self.send_header('Access-Control-Allow-Origin', '*')
                            self.send_header('Content-Type', 'application/json; charset=utf-8')
                            self.end_headers()
                            self.wfile.write(json.dumps(trex_data).encode('utf-8'))
                            return
                        last_error = Exception("trex-http: sem resposta")

                    else:  # cgminer
                        cgminer_data = fetch_cgminer_full(target_ip)
                        if cgminer_data is not None:
                            cache_reading(target_ip, cgminer_data)
                            with endpoint_cache_lock:
                                endpoint_cache[target_ip] = 'cgminer'
                            self.send_response(200)
                            self.send_header('Access-Control-Allow-Origin', '*')
                            self.send_header('Content-Type', 'application/json; charset=utf-8')
                            self.end_headers()
                            self.wfile.write(json.dumps(cgminer_data).encode('utf-8'))
                            return
                        last_error = Exception("cgminer: sem resposta")
                except Exception as e:
                    last_error = e
                    continue

            with endpoint_cache_lock:
                endpoint_cache.pop(target_ip, None)

            portal_mode = 'captive portal' in str(last_error)

            self.send_response(502)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({
                "error": str(last_error),
                "online": False,
                "portal_mode": portal_mode,
            }).encode('utf-8'))
            return

        if path == '/api/overlay':
            farm, machines = build_overlay_snapshot()
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"farm": farm, "machines": machines}, ensure_ascii=False).encode('utf-8'))
            return

        if path == '/api/overlay/rainmeter':
            farm, machines = build_overlay_snapshot()
            flat = {f"farm_{k}": v for k, v in farm.items()}
            MAX_SLOTS = 8
            for i in range(MAX_SLOTS):
                prefix = f"m{i + 1}_"
                if i < len(machines):
                    m = machines[i]
                    flat[prefix + "name"] = m["name"]
                    flat[prefix + "online"] = "1" if m["online"] else "0"
                    flat[prefix + "hashrate_ths"] = round(m["hashrate_ghs"] / 1000, 3)
                    flat[prefix + "temp_c"] = m["temp_c"] if m["temp_c"] is not None else ""
                    flat[prefix + "power_w"] = m["power_w"] if m["power_w"] is not None else ""
                    flat[prefix + "efficiency_j_th"] = m["efficiency_j_th"] if m["efficiency_j_th"] is not None else ""
                else:
                    flat[prefix + "name"] = ""
                    flat[prefix + "online"] = ""
                    flat[prefix + "hashrate_ths"] = ""
                    flat[prefix + "temp_c"] = ""
                    flat[prefix + "power_w"] = ""
                    flat[prefix + "efficiency_j_th"] = ""
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(flat, ensure_ascii=False).encode('utf-8'))
            return

        if path == '/api/scan':
            subnet_param = query_params.get('subnet')
            if subnet_param and subnet_param[0].strip():
                subnet = subnet_param[0].strip()
            else:
                local_ip = get_local_ip()
                subnet = '.'.join(local_ip.split('.')[:3])

            try:
                devices = scan_subnet(subnet)
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"subnet": subnet, "devices": devices}).encode('utf-8'))
                return
            except Exception as e:
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e), "subnet": subnet, "devices": []}).encode('utf-8'))
                return

        if path == '/api/netcheck':
            data = netcheck(force=query_params.get('force', ['0'])[0] == '1')
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode('utf-8'))
            return

        if path == '/api/btc-news':
            force = query_params.get('force', ['0'])[0] == '1'
            news = fetch_btc_news(force=force)
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(news, ensure_ascii=False).encode('utf-8'))
            return

        if path == '/api/rates':
            force = query_params.get('force', ['0'])[0] == '1'
            rates = fetch_binance_rates(force=force)
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(rates).encode('utf-8'))
            return

        if path == '/api/parasite-stats':
            address = query_params.get('address', [''])[0].strip()
            force = query_params.get('force', ['0'])[0] == '1'
            debug = query_params.get('debug', ['0'])[0] == '1'
            if not address:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Endereço em falta"}).encode('utf-8'))
                return
            result = fetch_parasite_stats(address, force=force, debug=debug)
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))
            return

        if path == '/api/parasite-workers':
            result = fetch_parasite_workers(query_params.get('address', [''])[0])
            self.send_response(400 if result.get("error") == "Endereço inválido" else 200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))
            return

        if path == '/api/parasite-blocks':
            result = fetch_parasite_blocks()
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))
            return

        if path == '/api/parasite-history':
            address = query_params.get('address', [''])[0].strip()
            period = query_params.get('period', ['3d'])[0].strip()
            result = fetch_parasite_history(address, period)
            self.send_response(400 if result.get("error") == "Endereço inválido" else 200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))
            return

        if path == '/api/parasite-refinery':
            address = query_params.get('address', [''])[0].strip()
            force = query_params.get('force', ['0'])[0] == '1'
            debug = query_params.get('debug', ['0'])[0] == '1'
            if not address:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Endereço em falta"}).encode('utf-8'))
                return
            result = fetch_parasite_refinery(address=address, force=force, debug=debug)
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))
            return

        if path == '/api/generic-pool':
            pool_id = query_params.get('pool', [''])[0].strip()
            address = query_params.get('address', [''])[0].strip()
            force = query_params.get('force', ['0'])[0] == '1'
            if not pool_id:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Pool em falta"}).encode('utf-8'))
                return
            result = fetch_generic_pool(pool_id, address=address, force=force)
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))
            return

        if path == '/api/generic-pools':
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({pid: {"label": c["label"], "coin": c["coin"]} for pid, c in GENERIC_POOLS.items()}).encode('utf-8'))
            return

        if path == '/api/power/config':
            with POWER_CONFIG_LOCK:
                cfg = copy.deepcopy(power_config)
            cfg["mqtt"]["password_set"] = bool(cfg["mqtt"].get("password"))
            cfg["mqtt"]["password"] = ""
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(cfg).encode('utf-8'))
            return

        if path == '/api/power/status':
            with mqtt_state_lock:
                state = dict(mqtt_state)
            with POWER_CONFIG_LOCK:
                profiles = power_config.get("profiles", [])
            state["suggested_profile"] = evaluate_suggested_profile(profiles, state.get("solar"), state.get("tariff"))
            state["mqtt_available"] = MQTT_AVAILABLE
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(state).encode('utf-8'))
            return

        if path == '/api/update/check':
            force = query_params.get('force', ['0'])[0] == '1'
            result = check_for_update(force=force)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))
            return

        if path == '/api/update/status':
            with _update_install_lock:
                state = dict(_update_install_state)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(state).encode('utf-8'))
            return

        if path == '/api/version':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"version": APP_VERSION}).encode('utf-8'))
            return

        if path == '/api/usage-count':
            counts = get_usage_count()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(counts).encode('utf-8'))
            return

        if path == '/api/diag/device':
            ip_q = (query_params.get('ip') or [''])[0].strip()
            if not ip_q or len(ip_q) > 64:
                self._send_json({"ok": False, "error": "IP inválido"}, 400)
                return
            kind, reason = diagnose_device(ip_q)
            self._send_json({"ok": True, "kind": kind, "reason": reason})
            return

        if path == '/api/remote/status':
            st = tailscale_status()
            st["local"] = self._is_local_request()
            self._send_json(st)
            return

        if path == '/api/devices':
            with POWER_CONFIG_LOCK:
                devices = copy.deepcopy(power_config.get("devices", []))
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"devices": devices}).encode('utf-8'))
            return

        if path == '/api/alerts/config':
            with POWER_CONFIG_LOCK:
                alerts_cfg = copy.deepcopy(power_config.get("alerts", {}) or {})
            alerts_cfg["toast_available"] = WINDOWS_TOAST_AVAILABLE
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(alerts_cfg, ensure_ascii=False).encode('utf-8'))
            return

        if path == '/api/security/config':
            with POWER_CONFIG_LOCK:
                security_cfg = copy.deepcopy(power_config.get("security", {}) or {})
            cert_path, key_path = _tls_cert_paths()
            security_cfg["cert_ready"] = os.path.exists(cert_path) and os.path.exists(key_path)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(security_cfg, ensure_ascii=False).encode('utf-8'))
            return

        if path == '/api/pools/catalog':
            force = query_params.get('force', ['0'])[0] == '1'
            catalog = get_pools_catalog_with_latency(force=force)
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"pools": catalog}).encode('utf-8'))
            return

        if path == '/api/pools/config':
            with POWER_CONFIG_LOCK:
                cfg = copy.deepcopy(power_config.get("pools", {}) or {})
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(cfg).encode('utf-8'))
            return

        if path == '/api/coolant/status':
            with POWER_CONFIG_LOCK:
                ccfg = copy.deepcopy(power_config.get("coolant", {}) or {})
            with coolant_lock:
                payload = {"config": ccfg, "reading": coolant_state["reading"], "ts": coolant_state["ts"],
                           "error": coolant_state["error"], "tripped": coolant_state["tripped"],
                           "trip_reason": coolant_state["trip_reason"], "trip_ts": coolant_state["trip_ts"],
                           "relay_result": coolant_state["relay_result"], "history": coolant_state["history"][-300:]}
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(payload, ensure_ascii=False).encode('utf-8'))
            return

        if path == '/api/pools/log':
            log = load_pool_log()
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"log": log}, ensure_ascii=False).encode('utf-8'))
            return

        if path == '/api/diff-history':
            ip_param = (query_params.get('ip') or [''])[0].strip()
            with _diff_history_lock:
                hist = load_diff_history()
                by_day = dict(hist.get(ip_param, {})) if ip_param else {}
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ip": ip_param, "history": by_day}).encode('utf-8'))
            return

        if path == '/api/diff-buckets':
            ip_param = (query_params.get('ip') or [''])[0].strip()
            range_param = (query_params.get('range') or ['24h'])[0].strip().lower()
            if range_param not in DIFF_BUCKETS_RANGES:
                range_param = '24h'
            if ip_param:
                buckets, peak = get_diff_buckets(ip_param, range_param)
            else:
                buckets, peak = [], 0
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({
                "ip": ip_param, "range": range_param, "buckets": buckets, "peak": peak,
            }).encode('utf-8'))
            return

        if path == '/api/diff-records':
            ip_param = (query_params.get('ip') or [''])[0].strip()
            range_param = (query_params.get('range') or ['24h'])[0].strip().lower()
            if range_param not in DIFF_BUCKETS_RANGES:
                range_param = '24h'
            events = get_diff_records(ip_param, range_param) if ip_param else []
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({
                "ip": ip_param, "range": range_param, "events": events,
            }).encode('utf-8'))
            return

        if path == '/api/mrr/status':
            with POWER_CONFIG_LOCK:
                mrr_cfg = copy.deepcopy(power_config.get("mrr", {}) or {})
            configured = bool(mrr_cfg.get("api_key")) and bool(mrr_cfg.get("api_secret"))
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({
                "configured": configured,
                "api_key": mrr_cfg.get("api_key", ""),
                "has_secret": bool(mrr_cfg.get("api_secret")),
            }).encode('utf-8'))
            return

        if path == '/api/mrr/rentals':
            try:
                result = mrr_request('/rental', params={'type': 'renter', 'history': '0'})
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.send_response(502)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False).encode('utf-8'))
            return

        if path == '/api/mrr/balance':
            try:
                result = mrr_request('/account/balance')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.send_response(502)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False).encode('utf-8'))
            return

        if self._try_serve_writable_asset(path):
            return
        super().do_GET()

    def _try_serve_writable_asset(self, path):
        rel = urllib.parse.unquote(path.lstrip('/'))
        if not rel or '..' in rel.split('/'):
            return False
        full_path = os.path.normpath(os.path.join(writable_dir(), rel))
        if not full_path.startswith(os.path.normpath(writable_dir()) + os.sep):
            return False
        if not os.path.isfile(full_path):
            return False
        try:
            ctype = self.guess_type(full_path)
            with open(full_path, 'rb') as f:
                data = f.read()
            self.send_response(200)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return True
        except Exception:
            return False

    def do_POST(self):
        global power_config
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        length = int(self.headers.get('Content-Length') or 0)
        raw_body = self.rfile.read(length) if length else b''
        try:
            body = json.loads(raw_body.decode('utf-8')) if raw_body else {}
        except Exception:
            body = {}

        if not self._require_auth(path):
            return

        if path == '/api/heartbeat':
            LAST_HEARTBEAT["ts"] = time.time()
            cancel_pending_close()
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}).encode('utf-8'))
            return

        if path == '/api/account/activity':
            email = self._auth_email(str(body.get('email') or '').strip())
            event = str(body.get('event') or 'login').strip() or 'login'
            entries = record_account_activity(email, self._client_ip(), event, self.headers.get('User-Agent', ''))
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "entries": entries}, ensure_ascii=False).encode('utf-8'))
            return

        if path == '/api/user-presence':
            email = self._auth_email(str(body.get('email') or '').strip())
            online, total = record_presence(email)
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "online": online, "total": total}).encode('utf-8'))
            return

        if path == '/api/close':
            ts = LAST_HEARTBEAT["ts"]
            if ts is not None and (time.time() - ts) < 1.5:
                print("[api/close] heartbeat muito recente já recebido (provável F5) - a ignorar pedido de fecho.", flush=True)
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "ignored": True}).encode('utf-8'))
                return
            print(f"[api/close] pedido de fecho recebido - a aguardar {CLOSE_GRACE_SECONDS}s por um heartbeat novo.", flush=True)
            try:
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True}).encode('utf-8'))
            except Exception:
                pass
            with _pending_close_lock:
                old_timer = _pending_close_timer["timer"]
                if old_timer is not None:
                    old_timer.cancel()
                t = threading.Timer(CLOSE_GRACE_SECONDS, _do_close_now)
                t.daemon = True
                _pending_close_timer["timer"] = t
                t.start()
            return

        if path == '/api/cert/sign':
            # assinar com a chave desta instalação só é permitido a partir deste PC (e com login), nunca pelo acesso remoto
            if not self._is_local_request():
                self._send_json({"ok": False, "error": "só é possível a partir do próprio PC"}, 403)
                return
            payload = body.get("payload")
            if not isinstance(payload, dict) or len(json.dumps(payload)) > CERT_MAX_PAYLOAD:
                self._send_json({"ok": False, "error": "dados inválidos"}, 400)
                return
            try:
                self._send_json({"ok": True, "certificate": cert_sign(payload)})
            except Exception as e:
                self._send_json({"ok": False, "error": "não foi possível assinar: " + str(e)}, 500)
            return

        if path == '/api/cert/verify':
            cert = body.get("certificate")
            if not isinstance(cert, dict):
                self._send_json({"ok": False, "error": "certificado inválido"}, 400)
                return
            self._send_json(dict(cert_verify(cert), ok=True))
            return

        if path == '/api/update/install':
            # instalar uma atualização só é permitido a partir deste PC (e com login), nunca pelo acesso remoto
            if not self._is_local_request():
                self._send_json({"ok": False, "error": "só é possível a partir do próprio PC"}, 403)
                return
            silent = bool(body.get("silent", True))
            with _update_install_lock:
                already_running = _update_install_state.get("status") in ("downloading", "launching")
            if already_running:
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "already_running": True}).encode('utf-8'))
                return
            ok, error = start_update_install(silent=silent)
            self.send_response(200 if ok else 500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": ok, "error": error}).encode('utf-8'))
            return

        if path == '/api/power/config':
            with POWER_CONFIG_LOCK:
                new_cfg = copy.deepcopy(power_config)
                incoming_mqtt = body.get("mqtt", {}) or {}
                for key in ("host", "username", "topic_solar", "topic_tariff"):
                    if key in incoming_mqtt:
                        new_cfg["mqtt"][key] = incoming_mqtt[key]
                if "port" in incoming_mqtt:
                    try:
                        new_cfg["mqtt"]["port"] = int(incoming_mqtt["port"])
                    except (TypeError, ValueError):
                        pass
                if incoming_mqtt.get("password"):
                    new_cfg["mqtt"]["password"] = incoming_mqtt["password"]
                if "profiles" in body:
                    new_cfg["profiles"] = body["profiles"]
                saved = save_power_config(new_cfg)
                if saved:
                    power_config = new_cfg
            if saved:
                start_mqtt_client(power_config)
            self.send_response(200 if saved else 500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": saved}).encode('utf-8'))
            return

        if path == '/api/devices':
            incoming = body.get("devices")
            if not isinstance(incoming, list):
                self.send_response(400)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "'devices' tem de ser uma lista"}).encode('utf-8'))
                return

            clean = []
            for d in incoming:
                if not isinstance(d, dict):
                    continue
                dev_id = str(d.get("id") or "").strip()
                name = str(d.get("name") or "").strip()
                ip = str(d.get("ip") or "").strip()
                if not dev_id or not ip:
                    continue
                item = {
                    "id": dev_id,
                    "name": name or ip,
                    "ip": ip,
                    "poolAuto": bool(d.get("poolAuto", False)),
                }
                group = str(d.get("group") or "").strip()[:24]
                note = str(d.get("note") or "").strip()[:300]
                if group:
                    item["group"] = group
                if note:
                    item["note"] = note
                if d.get("pin"):
                    item["pin"] = True
                try:
                    maint = int(d.get("maintMonths") or 0)
                except (TypeError, ValueError):
                    maint = 0
                if 1 <= maint <= 60:
                    item["maintMonths"] = maint
                for key in ("plugOff", "plugOn"):
                    u = str(d.get(key) or "").strip()[:300]
                    if u.lower().startswith(("http://", "https://")):
                        item[key] = u
                try:
                    pw = int(d.get("plugWait") or 0)
                except (TypeError, ValueError):
                    pw = 0
                if 3 <= pw <= 30:
                    item["plugWait"] = pw
                try:
                    expected = float(d.get("expected") or 0)
                except (TypeError, ValueError):
                    expected = 0
                if 0 < expected < 100000:
                    item["expected"] = round(expected, 3)
                try:
                    mute = int(d.get("mute") or 0)
                except (TypeError, ValueError):
                    mute = 0
                if mute > time.time() * 1000:
                    item["mute"] = mute
                clean.append(item)

            with POWER_CONFIG_LOCK:
                new_cfg = copy.deepcopy(power_config)
                new_cfg["devices"] = clean
                saved = save_power_config(new_cfg)
                if saved:
                    power_config = new_cfg

            self.send_response(200 if saved else 500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": saved, "devices": clean}).encode('utf-8'))
            return

        if path == '/api/coolant/config':
            with POWER_CONFIG_LOCK:
                new_cfg = copy.deepcopy(power_config)
                c = dict(new_cfg.get("coolant", {}) or {})
                for k in ("sensor_url", "relay_off_url", "relay_on_url"):
                    c[k] = str(body.get(k, c.get(k, ""))).strip()
                for k in ("enabled", "killswitch_enabled"):
                    c[k] = bool(body.get(k, c.get(k, False)))
                for k in ("min_flow_lpm", "grace_seconds", "max_coolant_out_c"):
                    try:
                        c[k] = float(body.get(k, c.get(k)))
                    except (TypeError, ValueError):
                        pass
                new_cfg["coolant"] = c
                saved = save_power_config(new_cfg)
                if saved:
                    power_config = new_cfg
            self.send_response(200 if saved else 500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": saved}).encode('utf-8'))
            return

        if path == '/api/coolant/reset':
            with POWER_CONFIG_LOCK:
                on_url = str((power_config.get("coolant", {}) or {}).get("relay_on_url") or "").strip()
            relay = ""
            if body.get("restore") and on_url:
                relay = coolant_call_relay(on_url)
            with coolant_lock:
                coolant_state.update(tripped=False, trip_reason="", trip_ts=0, low_since=None, relay_result=relay)
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "relay": relay}).encode('utf-8'))
            return

        if path == '/api/pools/config':
            with POWER_CONFIG_LOCK:
                new_cfg = copy.deepcopy(power_config)
                pools_cfg = dict(new_cfg.get("pools", {}) or {})
                pools_cfg["btc_address"] = str(body.get("btc_address", pools_cfg.get("btc_address", ""))).strip()
                pools_cfg["worker_suffix"] = str(body.get("worker_suffix", pools_cfg.get("worker_suffix", ""))).strip()
                try:
                    pools_cfg["min_gain_percent"] = float(body.get("min_gain_percent", pools_cfg.get("min_gain_percent", 5)))
                except (TypeError, ValueError):
                    pass
                try:
                    pools_cfg["eval_interval_minutes"] = float(body.get("eval_interval_minutes", pools_cfg.get("eval_interval_minutes", 15)))
                except (TypeError, ValueError):
                    pass
                new_cfg["pools"] = pools_cfg
                saved = save_power_config(new_cfg)
                if saved:
                    power_config = new_cfg

            self.send_response(200 if saved else 500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": saved}).encode('utf-8'))
            return

        if path == '/api/switch-pool':
            ip = str(body.get("ip") or "").strip()
            pool_id = str(body.get("poolId") or "").strip()
            pool = next((p for p in POOLS_CATALOG if p["id"] == pool_id), None)

            if not ip or not pool:
                self.send_response(400)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "message": "IP ou pool inválidos"}).encode('utf-8'))
                return

            with POWER_CONFIG_LOCK:
                pools_cfg = copy.deepcopy(power_config.get("pools", {}) or {})
                devices = copy.deepcopy(power_config.get("devices", []))
            dev_name = next((d.get("name") for d in devices if d.get("ip") == ip), ip)

            ok, message = switch_device_pool(
                ip, pool,
                pools_cfg.get("btc_address"),
                pools_cfg.get("worker_suffix"),
                dev_name,
            )
            append_pool_log(dev_name, pool["name"], ok, False, message)
            with endpoint_cache_lock:
                endpoint_cache.pop(ip, None)

            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": ok, "message": message}, ensure_ascii=False).encode('utf-8'))
            return

        if path == '/api/mrr/config':
            api_key = str(body.get("api_key") or "").strip()
            secret_provided = "api_secret" in body and str(body.get("api_secret") or "").strip() != ""
            with POWER_CONFIG_LOCK:
                new_cfg = copy.deepcopy(power_config)
                existing_secret = (new_cfg.get("mrr", {}) or {}).get("api_secret", "")
                new_secret = str(body.get("api_secret")).strip() if secret_provided else existing_secret
                new_cfg["mrr"] = {"api_key": api_key, "api_secret": new_secret}
                saved = save_power_config(new_cfg)
                if saved:
                    power_config = new_cfg

            self.send_response(200 if saved else 500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": saved}).encode('utf-8'))
            return

        if path == '/api/plug-cycle':
            ok, msg = plug_cycle(str(body.get("ip") or "").strip())
            self.send_response(200 if ok else 400)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": ok, "message": msg}, ensure_ascii=False).encode('utf-8'))
            return

        if path == '/api/alerts/config':
            with POWER_CONFIG_LOCK:
                existing = copy.deepcopy(power_config.get("alerts", {}) or {})

            def keep_or_update(key):
                if key in body and str(body.get(key) or "").strip() != "":
                    return str(body.get(key)).strip()
                return existing.get(key, "")

            new_alerts = {
                "telegram_bot_token": keep_or_update("telegram_bot_token"),
                "telegram_chat_id": str(body.get("telegram_chat_id", existing.get("telegram_chat_id", ""))).strip(),
                "discord_webhook_url": keep_or_update("discord_webhook_url"),
                "webhook_url": keep_or_update("webhook_url"),
                "hashrate_drop_pct": int(body.get("hashrate_drop_pct", existing.get("hashrate_drop_pct", 30)) or 30),
                "notify_offline": bool(body.get("notify_offline", existing.get("notify_offline", True))),
                "notify_record": bool(body.get("notify_record", existing.get("notify_record", True))),
                "notify_rental_ending": bool(body.get("notify_rental_ending", existing.get("notify_rental_ending", True))),
                "notify_hashrate_drop": bool(body.get("notify_hashrate_drop", existing.get("notify_hashrate_drop", True))),
                "notify_windows_toast": bool(body.get("notify_windows_toast", existing.get("notify_windows_toast", True))),
                "notify_health": bool(body.get("notify_health", existing.get("notify_health", True))),
                "notify_daily": bool(body.get("notify_daily", existing.get("notify_daily", False))),
                "daily_hour": max(0, min(23, int(body.get("daily_hour", existing.get("daily_hour", 21)) or 0))) if str(body.get("daily_hour", existing.get("daily_hour", 21))) != "" else 21,
            }

            with POWER_CONFIG_LOCK:
                new_cfg = copy.deepcopy(power_config)
                new_cfg["alerts"] = new_alerts
                saved = save_power_config(new_cfg)
                if saved:
                    power_config = new_cfg

            self.send_response(200 if saved else 500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": saved}).encode('utf-8'))
            return

        if path in ('/api/remote/serve', '/api/remote/keepalive'):
            # mexer na exposição do servidor só é permitido a partir deste PC (e com login)
            if not self._is_local_request():
                self._send_json({"ok": False, "error": "só é possível a partir do próprio PC"}, 403)
                return
            if path == '/api/remote/serve':
                self._send_json(tailscale_serve(bool(body.get("enable"))))
                return
            with POWER_CONFIG_LOCK:
                new_cfg = copy.deepcopy(power_config)
                new_cfg.setdefault("security", {})["remote_keepalive"] = bool(body.get("enable"))
                saved = save_power_config(new_cfg)
                if saved:
                    power_config = new_cfg
            self._send_json({"ok": saved, "keepalive": bool(body.get("enable")) if saved else remote_keepalive()}, 200 if saved else 500)
            return

        if path == '/api/security/config':
            with POWER_CONFIG_LOCK:
                existing = copy.deepcopy(power_config.get("security", {}) or {})

            https_enabled = bool(body.get("https_enabled", existing.get("https_enabled", False)))
            restrict = bool(body.get("restrict_proxy_to_known_ips", existing.get("restrict_proxy_to_known_ips", True)))

            cert_ok = True
            if https_enabled:
                cert_ok = ensure_self_signed_cert() is not None

            new_security = {
                "https_enabled": https_enabled and cert_ok,
                "restrict_proxy_to_known_ips": restrict,
                "remote_keepalive": bool(existing.get("remote_keepalive", False)),
            }

            with POWER_CONFIG_LOCK:
                new_cfg = copy.deepcopy(power_config)
                new_cfg["security"] = new_security
                saved = save_power_config(new_cfg)
                if saved:
                    power_config = new_cfg

            self.send_response(200 if saved else 500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({
                "ok": saved,
                "https_enabled": new_security["https_enabled"],
                "cert_ready": cert_ok,
                "restart_required": https_enabled != bool(existing.get("https_enabled", False)),
            }).encode('utf-8'))
            return

        if path == '/api/alerts/notify':
            message = str(body.get("message") or "").strip()
            if not message:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": "mensagem vazia"}).encode('utf-8'))
                return
            errors = broadcast_alert(message)
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": len(errors) == 0, "errors": errors}, ensure_ascii=False).encode('utf-8'))
            return

        if path == '/api/alerts/test':
            errors = broadcast_alert("🔔 Teste do Centro de Comando: os alertas estão a funcionar!")
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": len(errors) == 0, "errors": errors}, ensure_ascii=False).encode('utf-8'))
            return

        if path == '/api/apply-profile':
            target_ip = (body.get("ip") or "").strip()
            payload = {}
            if "frequency" in body:
                payload["frequency"] = body["frequency"]
            if "coreVoltage" in body:
                payload["coreVoltage"] = body["coreVoltage"]

            if not target_ip or not payload:
                self.send_response(400)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "IP ou parâmetros em falta"}).encode('utf-8'))
                return

            try:
                req = urllib.request.Request(
                    f"http://{target_ip}/api/system",
                    data=json.dumps(payload).encode('utf-8'),
                    headers={'User-Agent': 'NerdQaxeDashboard/1.0', 'Content-Type': 'application/json'},
                    method='PATCH'
                )
                with _urlopen_https(req, timeout=5) as resp:
                    resp.read()
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True}).encode('utf-8'))
            except Exception as e:
                self.send_response(502)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return

        if path == '/api/restart-machine':
            target_ip = (body.get("ip") or "").strip()
            if not target_ip:
                self.send_response(400)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "IP em falta"}).encode('utf-8'))
                return

            if not is_proxy_target_allowed(target_ip):
                self.send_response(403)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "error": "IP não reconhecido - adiciona esta máquina ao painel antes de a reiniciar"
                }).encode('utf-8'))
                return

            try:
                req = urllib.request.Request(
                    f"http://{target_ip}/api/system/restart",
                    data=b'',
                    headers={'User-Agent': 'NerdQaxeDashboard/1.0', 'Content-Type': 'application/json'},
                    method='POST'
                )
                with _urlopen_https(req, timeout=5) as resp:
                    resp.read()
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True}).encode('utf-8'))
            except Exception as e:
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "note": str(e)}).encode('utf-8'))
            return

        self.send_response(404)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        _p = str(getattr(self, 'path', '')).split('?')[0]
        if _p.endswith('.html'):
            self.send_header('Cache-Control', 'no-store')
        elif _p.endswith(('.js', '.css')):
            # a dashboard está dividida em ficheiros: o browser tem de os rever sempre,
            # senão uma atualização podia misturar páginas novas com scripts antigos
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


TRAY_ICON_FILENAME = "app_icon.ico"


def _load_tray_image():
    candidates = [
        os.path.join(resource_dir(), TRAY_ICON_FILENAME),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), TRAY_ICON_FILENAME),
    ]
    for path in candidates:
        if not path:
            continue
        try:
            if os.path.exists(path):
                return Image.open(path)
        except Exception:
            continue

    img = Image.new('RGB', (64, 64), color=(30, 30, 30))
    draw = ImageDraw.Draw(img)
    draw.ellipse((4, 4, 60, 60), fill=(247, 147, 26))
    draw.text((22, 18), "C", fill=(20, 20, 20))
    return img


def abrir_dashboard():
    """Abre a dashboard numa janela própria do Chrome (sem extensões, com o Modo Desempenho desligado e um perfil só para ela).
    Se o Chrome não estiver instalado, usa o navegador predefinido como antes."""
    url = f'{dashboard_url_scheme()}://localhost:{PORT}/nerdqaxe-dashboard.html'
    if sys.platform.startswith('linux') and not (os.environ.get('DISPLAY') or os.environ.get('WAYLAND_DISPLAY')):
        print(f"[info] servidor sem ecrã: abre {url} noutro dispositivo (ou pelo Tailscale).", flush=True)
        return
    try:
        candidatos = [os.path.join(os.environ.get(v, ''), *rel) for v, rel in (
            ('ProgramFiles', ('Google', 'Chrome', 'Application', 'chrome.exe')),
            ('ProgramFiles(x86)', ('Google', 'Chrome', 'Application', 'chrome.exe')),
            ('LOCALAPPDATA', ('Google', 'Chrome', 'Application', 'chrome.exe')))]
        chrome = next((c for c in candidatos if c and os.path.isfile(c)), None)
        if chrome:
            perfil = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'CentroDeComando', 'perfil-leve')
            subprocess.Popen([chrome, f'--user-data-dir={perfil}', '--disable-extensions', '--no-first-run',
                              '--no-default-browser-check', '--allow-insecure-localhost', f'--app={url}?leve=0'])
            return
    except Exception as e:
        print(f"[aviso] não consegui abrir o Chrome ({e}); a usar o navegador predefinido.", flush=True)
    webbrowser.open(url)


def _tray_abrir_painel(icon=None, item=None):
    abrir_dashboard()


def _tray_sair(icon=None, item=None):
    print("[tray] 'Sair' escolhido no ícone da bandeja - a fechar a app garantidamente.", flush=True)
    try:
        if icon is not None:
            icon.stop()
    except Exception:
        pass
    os._exit(0)


def start_tray_icon():
    if not TRAY_AVAILABLE:
        print("[tray] pystray/Pillow não disponíveis - ícone de bandeja desativado "
              "(a app continua a funcionar normalmente).", flush=True)
        return

    def _run():
        try:
            image = _load_tray_image()
            menu = pystray.Menu(
                pystray.MenuItem("Abrir painel", _tray_abrir_painel, default=True),
                pystray.MenuItem("Sair", _tray_sair),
            )
            icon = pystray.Icon("CentroDeComando", image, "Centro de Comando", menu)
            icon.run()
        except Exception as e:
            print(f"[tray] falha ao arrancar o ícone da bandeja: {e}", flush=True)

    tray_thread = threading.Thread(target=_run, daemon=True)
    tray_thread.start()


def port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0


class QuietThreadingTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def handle_error(self, request, client_address):
        exc_type = sys.exc_info()[0]
        if exc_type in (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            return
        super().handle_error(request, client_address)


def start_server():
    with QuietThreadingTCPServer(("", PORT), NerdQaxeProxyHandler) as httpd:
        with POWER_CONFIG_LOCK:
            https_wanted = bool(power_config.get("security", {}).get("https_enabled"))

        if https_wanted:
            cert_paths = ensure_self_signed_cert()
            if cert_paths:
                cert_path, key_path = cert_paths
                try:
                    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
                    ctx.load_cert_chain(certfile=cert_path, keyfile=key_path)
                    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
                    print("[tls] servidor a correr em HTTPS (certificado autoassinado).", flush=True)
                except Exception as e:
                    print(f"[tls] falha ao ativar HTTPS, a continuar em HTTP: {e}", flush=True)
            else:
                print("[tls] HTTPS pedido mas sem certificado disponível - a continuar em HTTP.", flush=True)

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


def main():
    print(f"[auth] login Firebase: {'ATIVO' if auth_enabled() else 'DESATIVADO (FIREBASE_API_KEY vazia)'} | app.py {APP_VERSION}", flush=True)
    if not port_in_use(PORT):
        server_thread = threading.Thread(target=start_server, daemon=True)
        server_thread.start()
        time.sleep(0.6)
        track_app_start()
        start_mqtt_client(power_config)

        watchdog_thread = threading.Thread(target=watchdog_loop, daemon=True)
        watchdog_thread.start()

        pool_autoswitch_thread = threading.Thread(target=pool_autoswitch_loop, daemon=True)
        pool_autoswitch_thread.start()

        presence_thread = threading.Thread(target=presence_cleanup_loop, daemon=True)
        presence_thread.start()

        coolant_thread = threading.Thread(target=coolant_loop, daemon=True)
        coolant_thread.start()

        start_tray_icon()

        abrir_dashboard()

        while True:
            time.sleep(3600)
    else:
        print(f"[aviso] a porta {PORT} já está ocupada por OUTRA instância da app (provavelmente a antiga, na bandeja/.exe). "
              "Este app.py NÃO arrancou - o browser vai mostrar a instância antiga. Fecha-a e volta a correr.", flush=True)
        abrir_dashboard()


if __name__ == '__main__':
    main()