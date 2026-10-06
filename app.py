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
except ImportError:
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
APP_VERSION = "3.9.2"
GITHUB_REPO = "bladept696/centro-de-comando-v3"
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
        with urllib.request.urlopen(req, timeout=USAGE_COUNTER_TIMEOUT):
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
            with urllib.request.urlopen(req, timeout=USAGE_COUNTER_TIMEOUT) as resp:
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


def cgminer_command(ip, command, port=CGMINER_PORT, timeout=CGMINER_TIMEOUT, key=None):
    key = key or CGMINER_KEY_CACHE.get(ip, 'command')
    try:
        with socket.create_connection((ip, port), timeout=timeout) as sock:
            sock.settimeout(timeout)
            sock.sendall(json.dumps({key: command}).encode('utf-8'))
            chunks = []
            while True:
                try:
                    chunk = sock.recv(4096)
                except socket.timeout:
                    break
                if not chunk:
                    break
                chunks.append(chunk)
                if chunk.endswith(b'\x00'):
                    break
            raw = b''.join(chunks).rstrip(b'\x00').strip()
            if not raw:
                return None
            return json.loads(raw.decode('utf-8', errors='ignore'))
    except Exception:
        return None


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
    data = cgminer_summary(ip, port or CGMINER_PORT, timeout=CGMINER_SCAN_TIMEOUT)
    if not data:
        return None
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
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
        return json.loads(raw.decode('utf-8', errors='ignore'))
    except Exception:
        return None


# ---------------- VNish (Antminer) e ePIC ----------------
VNISH_PASSWORD = os.environ.get('VNISH_PASSWORD', 'admin')
VNISH_TOKEN_CACHE = {}


def _http_json(url, headers=None, data=None, timeout=1.5):
    req = urllib.request.Request(url, data=data, headers=dict({'User-Agent': 'HashCommander', 'Accept': 'application/json'}, **(headers or {})))
    with urllib.request.urlopen(req, timeout=timeout) as resp:
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
    data = fetch_goldshell_devs(ip, timeout=GOLDSHELL_HTTP_SCAN_TIMEOUT)
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
        with urllib.request.urlopen(req, timeout=timeout) as resp:
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
        with urllib.request.urlopen(req, timeout=timeout) as resp:
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
        with urllib.request.urlopen(req, timeout=5) as resp:
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
    with urllib.request.urlopen(req, timeout=3) as resp:
        d = json.loads(resp.read().decode('utf-8', 'replace'))
    return {
        "flow_lpm": _coolant_num(d, "flow_lpm", "flow", "lpm"),
        "coolant_in_c": _coolant_num(d, "coolant_in_c", "coolant_in", "temp_in", "in"),
        "coolant_out_c": _coolant_num(d, "coolant_out_c", "coolant_out", "temp_out", "out"),
    }


def coolant_call_relay(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'HashCommander-Coolant'})
        with urllib.request.urlopen(req, timeout=3) as resp:
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
        with urllib.request.urlopen(req, timeout=5) as resp:
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


def _do_download_and_launch_installer(url, name, silent):
    global _update_install_state
    try:
        with _update_install_lock:
            _update_install_state = {"status": "downloading", "error": None}

        dest = os.path.join(update_download_dir(), name or "CentroDeComando-Setup.exe")
        req = urllib.request.Request(url, headers={'User-Agent': 'CentroDeComando-UpdateDownload'})
        total = 0
        with urllib.request.urlopen(req, timeout=15) as resp, open(dest, 'wb') as f:
            while True:
                chunk = resp.read(1024 * 256)
                if not chunk:
                    break
                total += len(chunk)
                if total > UPDATE_DOWNLOAD_MAX_BYTES:
                    raise RuntimeError("instalador excede o tamanho máximo esperado")
                f.write(chunk)

        with _update_install_lock:
            _update_install_state = {"status": "launching", "error": None}

        args = [dest]
        if silent:
            args.append('/VERYSILENT')
        args.append('/SP-')
        subprocess.Popen(args, close_fds=True, shell=False)

        with _update_install_lock:
            _update_install_state = {"status": "done", "error": None}

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

    t = threading.Thread(
        target=_do_download_and_launch_installer,
        args=(info["installer_url"], info.get("installer_name"), silent),
        daemon=True,
    )
    t.start()
    return True, None


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
        with urllib.request.urlopen(req, timeout=5) as resp:
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
        with urllib.request.urlopen(req, timeout=timeout) as resp:
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
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
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
    try:
        with open(power_config_path(), 'w', encoding='utf-8') as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False


power_config = load_power_config()


# --- Registo de atividade da conta (logins) --------------------------------
ACCOUNT_ACTIVITY_FILENAME = "account_activity.json"
ACCOUNT_ACTIVITY_MAX = 50
_account_activity_lock = threading.Lock()


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
    with urllib.request.urlopen(req, timeout=8) as resp:
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
    with urllib.request.urlopen(req, timeout=8) as resp:
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
    with urllib.request.urlopen(req, timeout=10) as response:
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


def probe_ip(ip):
    for path in ('/api/system/info', '/api/system'):
        try:
            req = urllib.request.Request(
                f"http://{ip}{path}",
                headers={'User-Agent': 'NerdQaxeDashboard/1.0', 'Accept-Encoding': 'gzip, deflate'}
            )
            with urllib.request.urlopen(req, timeout=SCAN_TIMEOUT) as resp:
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
}
_auth_cache = {}
_auth_cache_lock = threading.Lock()


def auth_enabled():
    return bool(FIREBASE_API_KEY)


def verify_firebase_token(id_token):
    """Valida um ID token junto do Firebase (accounts:lookup). Com cache curta."""
    key = hashlib.sha256(id_token.encode('utf-8')).hexdigest()
    now = time.time()
    with _auth_cache_lock:
        hit = _auth_cache.get(key)
        if hit and hit > now:
            return True
        for k in [k for k, v in _auth_cache.items() if v <= now]:
            _auth_cache.pop(k, None)
    try:
        req = urllib.request.Request(
            f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={urllib.parse.quote(FIREBASE_API_KEY)}",
            data=json.dumps({"idToken": id_token}).encode('utf-8'),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        users = data.get("users") or []
        if not users or users[0].get("disabled"):
            return False
        if AUTH_REQUIRE_VERIFIED_EMAIL and not users[0].get("emailVerified"):
            return False
    except Exception:
        return False
    with _auth_cache_lock:
        _auth_cache[key] = now + AUTH_TOKEN_CACHE_SECONDS
    return True



class NerdQaxeProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=resource_dir(), **kwargs)

    def log_message(self, format, *args):
        pass

    def _require_auth(self, path):
        if not auth_enabled() or not path.startswith('/api/') or path in AUTH_EXEMPT_PATHS:
            return True
        header = self.headers.get('Authorization', '')
        token = header[7:].strip() if header.lower().startswith('bearer ') else ''
        if token and verify_firebase_token(token):
            return True
        self.send_response(401)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps({"error": "auth_required"}).encode('utf-8'))
        return False

    def _client_ip(self):
        xff = self.headers.get('X-Forwarded-For', '')
        if xff:
            return xff.split(',')[0].strip()
        try:
            return self.client_address[0]
        except Exception:
            return ''

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

        if not self._require_auth(path):
            return

        if path == '/api/account/activity':
            email = (query_params.get('email') or [''])[0]
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
                        with urllib.request.urlopen(req, timeout=1.8) as response:
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
            email = str(body.get('email') or '').strip()
            event = str(body.get('event') or 'login').strip() or 'login'
            entries = record_account_activity(email, self._client_ip(), event, self.headers.get('User-Agent', ''))
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "entries": entries}, ensure_ascii=False).encode('utf-8'))
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

        if path == '/api/update/install':
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
                clean.append({
                    "id": dev_id,
                    "name": name or ip,
                    "ip": ip,
                    "poolAuto": bool(d.get("poolAuto", False)),
                })

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
                "hashrate_drop_pct": int(body.get("hashrate_drop_pct", existing.get("hashrate_drop_pct", 30)) or 30),
                "notify_offline": bool(body.get("notify_offline", existing.get("notify_offline", True))),
                "notify_record": bool(body.get("notify_record", existing.get("notify_record", True))),
                "notify_rental_ending": bool(body.get("notify_rental_ending", existing.get("notify_rental_ending", True))),
                "notify_hashrate_drop": bool(body.get("notify_hashrate_drop", existing.get("notify_hashrate_drop", True))),
                "notify_windows_toast": bool(body.get("notify_windows_toast", existing.get("notify_windows_toast", True))),
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
                with urllib.request.urlopen(req, timeout=5) as resp:
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
                with urllib.request.urlopen(req, timeout=5) as resp:
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
        if str(getattr(self, 'path', '')).split('?')[0].endswith('.html'):
            self.send_header('Cache-Control', 'no-store')
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


def _tray_abrir_painel(icon=None, item=None):
    webbrowser.open(f'{dashboard_url_scheme()}://localhost:{PORT}/nerdqaxe-dashboard.html')


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

        coolant_thread = threading.Thread(target=coolant_loop, daemon=True)
        coolant_thread.start()

        start_tray_icon()

        webbrowser.open(f'{dashboard_url_scheme()}://localhost:{PORT}/nerdqaxe-dashboard.html')

        while True:
            time.sleep(3600)
    else:
        print(f"[aviso] a porta {PORT} já está ocupada por OUTRA instância da app (provavelmente a antiga, na bandeja/.exe). "
              "Este app.py NÃO arrancou - o browser vai mostrar a instância antiga. Fecha-a e volta a correr.", flush=True)
        webbrowser.open(f'{dashboard_url_scheme()}://localhost:{PORT}/nerdqaxe-dashboard.html')


if __name__ == '__main__':
    main()