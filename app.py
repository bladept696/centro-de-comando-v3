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
import json
import gzip
import io
import copy
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    mqtt = None
    MQTT_AVAILABLE = False

PORT = 8765
SCAN_TIMEOUT = 0.6
SCAN_MAX_WORKERS = 60

# --- Versão da app / auto-update -------------------------------------------
# Atualiza este número a cada release publicada no GitHub (a tag da release
# deve começar por "v", ex: "v3.1" -> APP_VERSION = "3.1").
APP_VERSION = "3.0"
GITHUB_REPO = "bladept696/centro-de-comando-v3"
UPDATE_CHECK_CACHE_SECONDS = 60 * 30  # não martela a API do GitHub
_update_cache = {"ts": 0, "data": None}
_update_cache_lock = threading.Lock()

# --- Fecho total automático ------------------------------------------------
# O painel corre no browser predefinido (não é uma janela nativa), por isso
# o Python não sabe diretamente quando o utilizador fecha o separador/janela
# com o "X". Para resolver isto, o painel (JS) envia um "heartbeat" periódico
# a este servidor. Se o heartbeat parar de chegar (separador/janela fechado,
# browser fechado, PC a desligar, etc.) durante mais de HEARTBEAT_TIMEOUT
# segundos, o watchdog abaixo desliga o processo por completo.
#
# NOTA: quando a janela/separador é minimizado ou fica em segundo plano, os
# browsers atrasam (throttle) ou pausam os setInterval() da página para
# poupar energia — isto pode facilmente ultrapassar poucos segundos. Por
# isso o timeout tem de ser generoso, ou o watchdog mata o servidor por
# engano mesmo com o painel só minimizado (não fechado).
LAST_HEARTBEAT = {"ts": None}
HEARTBEAT_TIMEOUT = 90      # segs sem heartbeat até se considerar "fechado"
HEARTBEAT_GRACE = 20        # segs de tolerância no arranque antes de vigiar


def watchdog_loop():
    """Fecha o processo por completo assim que o painel deixar de responder."""
    started = time.time()
    while True:
        time.sleep(1)
        ts = LAST_HEARTBEAT["ts"]
        if ts is None:
            # o painel ainda não enviou nenhum heartbeat - só força fecho
            # se isto se arrastar demasiado tempo logo no arranque, para não
            # matar a app por engano se o utilizador ainda estiver a abrir
            # o browser.
            continue
        if time.time() - ts > HEARTBEAT_TIMEOUT:
            os._exit(0)

NERDQAXE_SIGNATURE_FIELDS = {
    'ASICModel', 'hashRate', 'bestDiff', 'bestSessionDiff',
    'stratumURL', 'hostname', 'boardVersion'
}

# --- Suporte a máquinas LuxOS / Antminer (API cgminer) --------------------
# Ao contrário das NerdQAxe++ (API REST em HTTP), os Antminers com LuxOS
# (e outros firmwares derivados do cgminer/BMMiner, ex: stock, Braiins OS)
# expõem os dados através de um socket TCP simples na porta 4028, ao qual
# se enviam comandos JSON como {"command":"summary"}. As funções abaixo
# consultam essa API e normalizam a resposta para o mesmo formato que o
# painel já espera das NerdQAxe++, para que o resto do código (frontend
# incluído) não precise de saber a diferença entre os dois tipos de máquina.

CGMINER_PORT = 4028
CGMINER_TIMEOUT = 2.5
CGMINER_SCAN_TIMEOUT = 0.6


def cgminer_command(ip, command, port=CGMINER_PORT, timeout=CGMINER_TIMEOUT):
    """Envia um comando à API cgminer/LuxOS via socket TCP e devolve o
    JSON de resposta (ou None em caso de falha/timeout/porta fechada)."""
    try:
        with socket.create_connection((ip, port), timeout=timeout) as sock:
            sock.settimeout(timeout)
            sock.sendall(json.dumps({"command": command}).encode('utf-8'))
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
    """Procura defensivamente por campos cujo nome contenha o padrão dado
    (ex: 'temp', 'fan', 'freq') dentro de uma entrada de STATS, ignorando
    zeros (sensores desligados/não usados) e devolvendo os valores válidos.
    Os nomes destes campos variam bastante entre modelos/firmwares."""
    import re
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
    """Como _cgminer_scan_numeric_fields, mas percorre recursivamente dicts
    e listas aninhadas. Necessário porque, ao contrário de temp/fan/freq
    (que costumam vir "soltos" na entrada de STATS), a potência em Watts
    em firmwares LuxOS/Antminer aparece frequentemente dentro de blocos
    aninhados (ex: resposta do comando 'power', ou sub-blocos por placa em
    'estats'), com nomes de campo que variam bastante entre modelos."""
    import re
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


def probe_cgminer(ip, port=None):
    """Testa se o IP responde à API cgminer/LuxOS (porta 4028 por omissão).
    Usado no scan de rede para identificar Antminers/LuxOS, tal como
    probe_ip faz para as NerdQAxe++."""
    data = cgminer_command(ip, 'summary', port=port or CGMINER_PORT, timeout=CGMINER_SCAN_TIMEOUT)
    if not data or 'SUMMARY' not in data:
        return None
    summary = (data.get('SUMMARY') or [{}])[0]
    version_desc = ''
    try:
        version_desc = (data.get('STATUS') or [{}])[0].get('Description', '')
    except Exception:
        pass
    return {
        "ip": ip,
        "hostname": ip,
        "model": version_desc or "LuxOS / cgminer",
        "protocol": "cgminer",
    }


def fetch_cgminer_full(ip, port=None):
    """Consulta summary/pools/stats via API cgminer/LuxOS e normaliza os
    dados para o mesmo formato JSON que as NerdQAxe++ devolvem, para que
    o painel (e o resto do backend) os processem sem alterações."""
    port = port or CGMINER_PORT
    summary_data = cgminer_command(ip, 'summary', port=port)
    if not summary_data or 'SUMMARY' not in summary_data:
        return None

    summary = (summary_data.get('SUMMARY') or [{}])[0]
    pools_data = cgminer_command(ip, 'pools', port=port) or {}
    pool_entry = (pools_data.get('POOLS') or [{}])
    pool_entry = pool_entry[0] if pool_entry else {}
    stats_data = cgminer_command(ip, 'stats', port=port) or {}
    stats_entries = stats_data.get('STATS') or []
    # a primeira entrada de STATS é normalmente um resumo genérico; os
    # dados por chip/placa (temp, fan, freq) costumam vir na 2ª entrada
    stats_entry = stats_entries[1] if len(stats_entries) > 1 else (stats_entries[0] if stats_entries else {})

    temps = _cgminer_scan_numeric_fields(stats_entry, r'temp')
    fans = _cgminer_scan_numeric_fields(stats_entry, r'fan')
    freqs = _cgminer_scan_numeric_fields(stats_entry, r'freq')

    # --- Potência (Watts) --------------------------------------------------
    # Ao contrário de temp/fan/freq, a API 'stats' de muitos firmwares
    # LuxOS/Antminer NÃO expõe watts (era o caso que causava 0.00 J/Th no
    # painel). A potência real costuma vir noutro lado consoante o
    # firmware/modelo, por isso tentamos várias fontes, por ordem de
    # confiança, e ficamos com a primeira que der um valor válido:
    #   1) comando dedicado 'power' (LuxOS)
    #   2) 'estats' (stats "estendido", tem mais campos que 'stats')
    #   3) SUMMARY (alguns firmwares expõem 'Power' aqui)
    #   4) STATS normal (fallback já existente, alguns firmwares expõem)
    #   5) calculado a partir de tensão × corrente, se ambos existirem
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
        # último recurso: estimar a partir de tensão (V) × corrente (A),
        # se a entrada de stats/estats tiver ambos os campos
        volt_vals = _cgminer_scan_numeric_fields(stats_entry, r'^volt|voltage')
        amp_vals = _cgminer_scan_numeric_fields(stats_entry, r'^amp|current(?!.?power)')
        if volt_vals and amp_vals:
            power_vals = [max(volt_vals) * max(amp_vals)]

    try:
        hashrate_ghs = float(summary.get('GHS 5s') or summary.get('GHS av') or 0)
    except (TypeError, ValueError):
        hashrate_ghs = 0

    version_desc = ''
    try:
        version_desc = (summary_data.get('STATUS') or [{}])[0].get('Description', '')
    except Exception:
        pass

    pool_url = pool_entry.get('URL') or pool_entry.get('Stratum URL') or '—'

    return {
        "hostname": ip,
        "ASICModel": version_desc or "LuxOS / Antminer",
        "hashRate": hashrate_ghs,
        "temp": max(temps) if temps else None,
        "fanrpm": max(fans) if fans else 0,
        "frequency": (sum(freqs) / len(freqs)) if freqs else 0,
        "power": max(power_vals) if power_vals else None,
        "sharesAccepted": summary.get('Accepted', 0),
        "sharesRejected": summary.get('Rejected', 0),
        "bestDiff": summary.get('Best Share', 0),
        "bestSessionDiff": summary.get('Best Share', 0),
        "stratumURL": pool_url,
        "uptimeSeconds": summary.get('Elapsed', 0),
        "protocol": "cgminer",
    }

# --- Gestão Dinâmica de Perfil de Alimentação (MQTT / Home Assistant) -----
# Cruza dados de produção solar / tarifa dinâmica (via MQTT, tipicamente
# publicados pelo Home Assistant) com perfis de frequência/undervolt para
# os ASICs. Por desenho, esta funcionalidade é apenas de SUGESTÃO: nunca
# aplica automaticamente nenhuma alteração ao hardware — quem decide
# aplicar (ou não) o perfil sugerido é sempre a pessoa, a partir do painel.

POWER_CONFIG_FILENAME = 'power_profiles.json'
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
    "devices": []   # lista de máquinas registadas: {id, name, ip}
}

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
    """Converte 'v3.10.2' ou '3.10.2' em (3, 10, 2) para comparação numérica."""
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
    """Consulta a última release pública no GitHub e compara com APP_VERSION.
    Faz cache em memória durante UPDATE_CHECK_CACHE_SECONDS para não exceder
    o limite de pedidos não-autenticados da API do GitHub."""
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
        result["release_notes"] = notes[:2000]  # evita respostas gigantes
        result["update_available"] = _parse_version(tag) > _parse_version(APP_VERSION)
    except Exception as e:
        result["error"] = str(e)

    with _update_cache_lock:
        _update_cache["ts"] = time.time()
        _update_cache["data"] = result
    return result


def writable_dir():
    """Pasta onde a app pode gravar configuração de forma persistente.
    Ao contrário de resource_dir(), que em modo .exe aponta para uma
    pasta temporária (_MEIPASS) que é apagada a cada arranque, esta
    pasta fica ao lado do .exe (ou do script, em modo de desenvolvimento)."""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


def power_config_path():
    return os.path.join(writable_dir(), POWER_CONFIG_FILENAME)


def load_power_config():
    try:
        with open(power_config_path(), 'r', encoding='utf-8') as f:
            data = json.load(f)
        cfg = copy.deepcopy(DEFAULT_POWER_CONFIG)
        cfg["mqtt"].update(data.get("mqtt", {}) or {})
        cfg["profiles"] = data.get("profiles", []) or []
        cfg["devices"] = data.get("devices", []) or []
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


# --- Integrações externas (Rainmeter / OBS) --------------------------------
# A lista de máquinas já vive em power_config["devices"] (ver /api/devices).
# Para servir um "resumo" pronto a consumir por ferramentas externas
# (Rainmeter, overlay do OBS), cruzamos essa lista com a última leitura
# conhecida de cada IP, guardada em memória sempre que /api/proxy é usado.
LATEST_READINGS = {}          # ip -> {"data": dict, "ts": float}
LATEST_READINGS_LOCK = threading.Lock()
READING_MAX_AGE = 20  # segs - acima disto consideramos a leitura desatualizada (offline)


def cache_reading(ip, data):
    with LATEST_READINGS_LOCK:
        LATEST_READINGS[ip] = {"data": data, "ts": time.time()}


def build_overlay_snapshot():
    """Junta a lista de máquinas registadas (power_config["devices"]) com a
    última leitura conhecida de cada uma, calculando também os totais da
    'farm' inteira. Usado por /api/overlay e /api/overlay/rainmeter."""
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

        efficiency = None
        if online and power and hashrate_ghs > 0:
            efficiency = power / (hashrate_ghs / 1000)

        machines.append({
            "name": name,
            "ip": ip,
            "online": online,
            "hashrate_ghs": round(hashrate_ghs, 2),
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
    """Extrai um número de uma mensagem MQTT, aceitando tanto um valor
    simples (ex: "3.42") como um JSON do Home Assistant (ex: {"state": 3.42})."""
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
    """Devolve o primeiro perfil cujas condições sejam cumpridas pelos
    valores atuais de solar (W) e tarifa (€/kWh). A ordem da lista define
    a prioridade — o primeiro perfil compatível vence. Um perfil sem
    condições funciona como perfil por omissão (apanha tudo o resto)."""
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
    """(Re)inicia a ligação MQTT em background com a configuração atual.
    Chamado no arranque da app e sempre que a configuração é gravada."""
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
    """Devolve a pasta onde estão os recursos (html/png), tanto em modo
    normal (script .py) como compilado num .exe pelo PyInstaller."""
    if getattr(sys, 'frozen', False):
        # Quando compilado com --onefile, os ficheiros extra vao para uma
        # pasta temporaria apontada por sys._MEIPASS
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
                }
        except Exception:
            continue
    # Não é uma NerdQAxe++ (ou similar baseada em HTTP) — tenta a API
    # cgminer/LuxOS (Antminer e derivados) antes de desistir deste IP.
    return probe_cgminer(ip)


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


class NerdQaxeProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=resource_dir(), **kwargs)

    def log_message(self, format, *args):
        pass  # silencia o log no terminal

    def handle_error(self, request, client_address):
        """Chamado pelo socketserver quando uma exceção não tratada ocorre
        a processar um pedido. Ligações abortadas pelo cliente (browser
        fechou o separador, deu F5 a meio de um pedido, página em segundo
        plano cancelou o fetch, etc.) são normais e inofensivas - o
        servidor continua a correr na mesma. Silenciamo-las para não
        encher o terminal de tracebacks; qualquer outro erro continua a
        ser impresso normalmente para se poder diagnosticar.
        """
        exc_type = sys.exc_info()[0]
        if exc_type in (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            return
        super().handle_error(request, client_address)

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        if path == '/api/proxy':
            ip_list = query_params.get('ip')
            if not ip_list or not ip_list[0].strip():
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "IP inválido ou ausente"}).encode('utf-8'))
                return

            target_ip = ip_list[0].strip()
            target_url = f"http://{target_ip}/api/system/info"

            try:
                req = urllib.request.Request(
                    target_url,
                    headers={
                        'User-Agent': 'NerdQaxeDashboard/1.0',
                        'Accept-Encoding': 'gzip, deflate'
                    }
                )
                with urllib.request.urlopen(req, timeout=3) as response:
                    raw_data = response.read()
                    if response.headers.get('Content-Encoding') == 'gzip' or raw_data[:2] == b'\x1f\x8b':
                        buffer = io.BytesIO(raw_data)
                        with gzip.GzipFile(fileobj=buffer) as gz:
                            data = gz.read()
                    else:
                        data = raw_data

                    try:
                        cache_reading(target_ip, json.loads(data.decode('utf-8')))
                    except Exception:
                        pass

                    self.send_response(200)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(data)
                    return
            except Exception:
                try:
                    alt_url = f"http://{target_ip}/api/system"
                    req_alt = urllib.request.Request(alt_url, headers={'User-Agent': 'NerdQaxeDashboard/1.0', 'Accept-Encoding': 'gzip, deflate'})
                    with urllib.request.urlopen(req_alt, timeout=3) as resp_alt:
                        raw_alt = resp_alt.read()
                        if resp_alt.headers.get('Content-Encoding') == 'gzip' or raw_alt[:2] == b'\x1f\x8b':
                            buf_alt = io.BytesIO(raw_alt)
                            with gzip.GzipFile(fileobj=buf_alt) as gz_alt:
                                data_alt = gz_alt.read()
                        else:
                            data_alt = raw_alt

                        try:
                            cache_reading(target_ip, json.loads(data_alt.decode('utf-8')))
                        except Exception:
                            pass

                        self.send_response(200)
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.send_header('Content-Type', 'application/json; charset=utf-8')
                        self.end_headers()
                        self.wfile.write(data_alt)
                        return
                except Exception as e2:
                    # Não respondeu como NerdQAxe++ (HTTP) — tenta a API
                    # cgminer/LuxOS (Antminer e derivados) na porta 4028
                    # antes de reportar a máquina como offline.
                    cgminer_data = fetch_cgminer_full(target_ip)
                    if cgminer_data is not None:
                        cache_reading(target_ip, cgminer_data)
                        self.send_response(200)
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.send_header('Content-Type', 'application/json; charset=utf-8')
                        self.end_headers()
                        self.wfile.write(json.dumps(cgminer_data).encode('utf-8'))
                        return

                    self.send_response(502)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": str(e2), "online": False}).encode('utf-8'))
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
            # Versão "achatada" (sem objetos/arrays aninhados) pensada para
            # o plugin WebParser do Rainmeter, que só sabe extrair valores
            # com expressões regulares simples sobre o texto recebido.
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

        if path == '/api/devices':
            with POWER_CONFIG_LOCK:
                devices = copy.deepcopy(power_config.get("devices", []))
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"devices": devices}).encode('utf-8'))
            return

        super().do_GET()

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

        if path == '/api/heartbeat':
            LAST_HEARTBEAT["ts"] = time.time()
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}).encode('utf-8'))
            return

        if path == '/api/close':
            # Avisado pelo painel (evento pagehide/beforeunload) quando o
            # separador é mesmo fechado - ao contrário da falta de
            # heartbeat, isto é um sinal explícito e imediato, por isso
            # desligamos logo, sem esperar pelo HEARTBEAT_TIMEOUT (que
            # existe só para aguentar a janela minimizada/em segundo
            # plano, não para detetar um fecho real).
            try:
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True}).encode('utf-8'))
            except Exception:
                pass
            threading.Timer(0.2, lambda: os._exit(0)).start()
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
                # só substitui a password se vier uma nova (o painel nunca
                # reenvia a password guardada de volta para o servidor)
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
                clean.append({"id": dev_id, "name": name or ip, "ip": ip})

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
                self.send_response(502)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return

        self.send_response(404)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()


def port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0


def start_server():
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    socketserver.ThreadingTCPServer.daemon_threads = True
    with socketserver.ThreadingTCPServer(("", PORT), NerdQaxeProxyHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


def main():
    # Se o servidor já estiver a correr (ex: o utilizador já tinha aberto
    # o painel), não arranca outro - só abre o browser.
    if not port_in_use(PORT):
        server_thread = threading.Thread(target=start_server, daemon=True)
        server_thread.start()
        time.sleep(0.6)  # pequena pausa para o servidor arrancar
        start_mqtt_client(power_config)

        # Este processo é o "dono" do servidor - vigia o painel e desliga
        # tudo (fecho total) assim que o utilizador fechar o separador/janela.
        watchdog_thread = threading.Thread(target=watchdog_loop, daemon=True)
        watchdog_thread.start()

        webbrowser.open(f'http://localhost:{PORT}/nerdqaxe-dashboard.html')

        # Mantém o processo vivo enquanto o servidor corre em background
        # (o watchdog acima é quem trata do fecho total quando for preciso)
        while True:
            time.sleep(3600)
    else:
        # Já há um servidor a correr (outra instância já aberta) - só
        # reaproveita esse servidor e abre mais um separador. Este processo
        # não é dono de nada, por isso não deve ficar escondido em segundo
        # plano depois disto.
        webbrowser.open(f'http://localhost:{PORT}/nerdqaxe-dashboard.html')


if __name__ == '__main__':
    main()
