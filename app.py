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
import hmac
import hashlib
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

PORT = 8765
SCAN_TIMEOUT = 0.6
SCAN_MAX_WORKERS = 60

# --- Versão da app / auto-update -------------------------------------------
# Atualiza este número a cada release publicada no GitHub (a tag da release
# deve começar por "v", ex: "v3.1" -> APP_VERSION = "3.1").
APP_VERSION = "3.5.1"
GITHUB_REPO = "bladept696/centro-de-comando-v3"
UPDATE_CHECK_CACHE_SECONDS = 60 * 30  # não martela a API do GitHub
_update_cache = {"ts": 0, "data": None}
_update_cache_lock = threading.Lock()

BINANCE_RATES_CACHE_SECONDS = 20  # não martela a API da Binance
_rates_cache = {"ts": 0, "data": None}
_rates_cache_lock = threading.Lock()

# --- Contador de utilizadores (nº de arranques da app) ----------------------
# Serviço gratuito e sem registo (countapi.xyz): cada arranque da app soma
# +1 a um contador identificado por namespace/key. Não identifica pessoas
# nem máquinas, é só um total global de vezes que a app foi aberta.
# --- Contador de utilizadores (nº de arranques da app) ----------------------
# Serviço gratuito e sem registo (countapi.mileshilliard.com - sucessor do
# antigo countapi.xyz, que deixou de responder): cada arranque da app soma
# +1 a um contador identificado por uma chave única. Não identifica pessoas
# nem máquinas, é só um total global de vezes que a app foi aberta/instalada.
USAGE_COUNTER_BASE = "https://countapi.mileshilliard.com/api/v1"
USAGE_COUNTER_PREFIX = "centro-de-comando-v3-" + GITHUB_REPO.split("/")[0]
USAGE_COUNTER_KEY = f"{USAGE_COUNTER_PREFIX}-app-starts"
USAGE_COUNTER_TIMEOUT = 4
UNIQUE_INSTALL_KEY = f"{USAGE_COUNTER_PREFIX}-unique-installs"
UNIQUE_INSTALL_MARKER_FILENAME = ".install_id"


def _usage_counter_hit(key):
    """Soma +1 a um contador countapi (fire-and-forget, nunca falha de
    forma visível - sem internet ou com o serviço em baixo, só não conta)."""
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
    """Verifica (e cria, se não existir) o ficheiro-marcador local que
    identifica se esta é a primeira vez que a app corre nesta pasta/PC.
    Só devolve True uma única vez por instalação."""
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
    """Dispara os pings de contagem numa thread separada, para não atrasar
    o arranque do servidor/browser caso a rede esteja lenta:
    - 'app-starts': soma sempre, a cada arranque (atividade total).
    - 'unique-installs': soma só na primeira vez que corre nesta máquina
      (aproximação a "quantos utilizadores diferentes")."""
    def _run():
        _usage_counter_hit(USAGE_COUNTER_KEY)
        if _is_first_run_on_this_machine():
            _usage_counter_hit(UNIQUE_INSTALL_KEY)
    threading.Thread(target=_run, daemon=True).start()


def get_usage_count():
    """Lê os valores atuais dos contadores (sem os incrementar). Devolve
    None em cada um se não for possível consultar (sem internet, etc.)."""
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

# --- Fecho total automático ------------------------------------------------
# O painel corre no browser predefinido (não é uma janela nativa), por isso
# o Python não sabe diretamente quando o utilizador fecha o separador/janela
# com o "X". Para resolver isto, o painel (JS) envia um "heartbeat" periódico
# a este servidor, e o fecho real acontece via /api/close (evento pagehide)
# ou pelo botão "Desligar" do painel.
#
# O antigo watchdog por timeout curto (matar o processo se não chegasse
# heartbeat há pouco tempo) foi DESATIVADO a pedido do utilizador - causou
# demasiados falsos positivos (poupança de energia do browser/Windows a
# suspender o Worker mesmo com a página em primeiro plano, corridas com o
# F5, etc.), desligando o servidor sem o utilizador ter fechado nada.
#
# Em vez disso, o fecho normal acontece via /api/close (pagehide) ou pelo
# botão "Desligar" do painel. Fica só uma REDE DE SEGURANÇA por trás: um
# timeout muito mais longo (ver SAFETY_NET_TIMEOUT_SECONDS abaixo) que só
# atua se não chegar NENHUM heartbeat durante esse tempo todo - o que só
# acontece em cenários de "processo verdadeiramente zombie" (browser
# crashou sem disparar pagehide, PC foi abaixo sem desligar a app, etc.),
# nunca em suspensões normais de alguns segundos/minutos.
LAST_HEARTBEAT = {"ts": None}
HEARTBEAT_TIMEOUT = None    # desativado - nunca fecha por falta de heartbeat a curto prazo
HEARTBEAT_GRACE = 20        # (sem efeito enquanto HEARTBEAT_TIMEOUT = None)

# Rede de segurança: se não chegar UM ÚNICO heartbeat durante este intervalo
# (30 minutos), o processo é considerado zombie e fecha-se sozinho. É longo
# de propósito para nunca disparar por engano - só serve para limpar
# processos verdadeiramente abandonados que de outra forma ficariam a
# correr para sempre em segundo plano.
SAFETY_NET_TIMEOUT_SECONDS = 30 * 60
SERVER_START_TS = time.time()

# Temporizador de fecho pendente, criado por /api/close. Fica cancelável
# durante CLOSE_GRACE_SECONDS: se chegar um heartbeat novo nesse intervalo
# (ex: o "fecho" foi só um F5/recarregar, que dispara o mesmo evento
# pagehide que um fecho real de separador), o fecho é abortado e o
# servidor continua a correr normalmente.
#
# IMPORTANTE: este valor tem de ser MAIOR do que o intervalo do heartbeat
# do Web Worker (3s). O sendBeacon('/api/close') da página antiga (disparado
# no pagehide) não tem ordem garantida em relação ao primeiro heartbeat da
# página nova - por vezes o beacon "antigo" só chega ao servidor DEPOIS
# desse primeiro heartbeat já ter sido processado. Nesse caso, o próximo
# heartbeat capaz de cancelar o fecho só chega ~3s depois (o intervalo do
# Worker). Com CLOSE_GRACE_SECONDS a 2.5s isso fazia o F5 matar o servidor
# sempre que essa ordem "trocada" acontecia - mesmo com a página nova a
# correr normalmente. Por isso a margem tem de cobrir pelo menos um ciclo
# completo do heartbeat, com folga extra para máquinas mais lentas a
# recarregar a página.
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
    """Rede de segurança: NÃO é o antigo watchdog de timeout curto (esse
    continua desativado). Isto só fecha o processo se não chegar nenhum
    heartbeat durante SAFETY_NET_TIMEOUT_SECONDS (30 min) - tempo mais que
    suficiente para nunca confundir uma suspensão normal do browser com um
    fecho real. Existe só para limpar processos verdadeiramente
    abandonados (crash do browser sem pagehide, etc.) que de outra forma
    ficavam a correr para sempre em segundo plano.
    """
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
        "firmwareVersion": version_desc or None,
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

# --- Troca Automática de Pool (fee + latência) ------------------------------
# Catálogo estático das pools SHA-256 mais conhecidas (não é preciso o
# utilizador andar a configurar isto à mão). fee_percent é aproximado e
# meramente indicativo - cada pool pode ter esquemas de fee diferentes
# (PPS, PPLNS, FPPS) que este valor não capta na totalidade.
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
    """Mede o tempo de um handshake TCP simples (connect) em ms. Devolve
    None se a pool não responder dentro do timeout."""
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
    """Score simples: fee% + penalização por latência. Quanto menor, melhor.
    Pools sem resposta ficam sempre no fim (score muito alto)."""
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
    """Aplica a troca de pool à máquina em 'ip', detetando o protocolo pelo
    endpoint_cache (preenchido pelo /api/proxy). Devolve (ok, message)."""
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

    # AxeOS (NerdQAxe/Bitaxe): PATCH /api/system com os campos da stratum.
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


def pool_autoswitch_loop():
    """Corre em background: a cada eval_interval_minutes, avalia as
    máquinas com poolAuto=true e troca-as para a melhor pool do catálogo
    se o ganho ultrapassar min_gain_percent (histerese - evita "flapping"
    por diferenças insignificantes de fee/latência)."""
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
                        # score é "quanto menor melhor"; convertemos numa
                        # noção grosseira de ganho percentual sobre a fee
                        # para comparar com min_gain_percent.
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
                        endpoint_cache.pop(ip, None)  # força re-detetar protocolo/endpoint no próximo poll

        time.sleep(max(60, interval_min * 60))


# --- Histórico de Melhor Dif. (heatmap estilo GitHub) -----------------------
# Guarda, por IP e por dia (AAAA-MM-DD, hora local), o maior "best diff"
# visto nesse dia. Atualizado a cada leitura bem-sucedida via cache_reading().
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
    "devices": [],   # lista de máquinas registadas: {id, name, ip}
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
    },
    "pools": {
        "btc_address": "",
        "worker_suffix": "",
        "min_gain_percent": 5,
        "eval_interval_minutes": 15,
    },
}

# Cache do endpoint que funcionou da última vez para cada IP ('info',
# 'system' ou 'cgminer'). Evita repetir toda a cadeia de fallback
# (info -> system -> cgminer, que no pior caso pode demorar ~8.5s) em
# cada poll de 5s para máquinas que não respondem ao endpoint
# primário 'info' - isso fazia essas máquinas serem abortadas pelo
# timeout de 3.5s do frontend e aparecerem como offline quase sempre,
# mesmo estando online.
endpoint_cache_lock = threading.Lock()
endpoint_cache = {}  # ip -> 'info' | 'system' | 'cgminer'


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


def fetch_binance_rates(force=False):
    """Consulta a Binance (API pública, sem autenticação) para BTC/EUR e
    BTC/USDT. Faz cache em memória durante BINANCE_RATES_CACHE_SECONDS
    para não exceder o limite de pedidos da API."""
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
        cfg["mrr"].update(data.get("mrr", {}) or {})
        cfg["alerts"].update(data.get("alerts", {}) or {})
        cfg["pools"].update(data.get("pools", {}) or {})
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


# --- Alertas (Telegram / Discord) -------------------------------------------
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
            # O Discord bloqueia (403) pedidos com o User-Agent padrão do
            # urllib ("Python-urllib/3.x"); um User-Agent "normal" resolve.
            'User-Agent': 'Mozilla/5.0 (compatible; CentroDeComando/1.0)',
        },
    )
    with urllib.request.urlopen(req, timeout=8) as resp:
        resp.read()
        return True


def broadcast_alert(message):
    """Envia a mesma mensagem a todos os canais configurados. Devolve uma
    lista de erros (vazia se tudo correu bem ou nada estiver configurado)."""
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

    return errors


# --- MiningRigRentals (aba "Renting") --------------------------------------
# A API da MRR exige autenticação por API Key + API Secret (não é possível
# usar apenas o email) com assinatura HMAC-SHA1 por pedido:
# https://www.miningrigrentals.com/apidocv2
MRR_API_BASE = "https://www.miningrigrentals.com/api/v2"
MRR_NONCE_LOCK = threading.Lock()
_mrr_last_nonce = [0]


def mrr_next_nonce():
    # O nonce tem de ser sempre crescente entre pedidos; usar millis desde
    # epoch chega, mas se dois pedidos caírem no mesmo milissegundo
    # garantimos incremento manual.
    with MRR_NONCE_LOCK:
        n = int(time.time() * 1000)
        if n <= _mrr_last_nonce[0]:
            n = _mrr_last_nonce[0] + 1
        _mrr_last_nonce[0] = n
        return str(n)


def mrr_request(endpoint, method='GET', params=None):
    """Chama a API v2 da MiningRigRentals com assinatura HMAC-SHA1.
    endpoint deve começar por '/' e não ter barra final, ex: '/whoami'."""
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
    try:
        best = data.get("bestSessionDiff") or data.get("bestDiff")
        record_diff_history(ip, best)
    except Exception:
        pass


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

            # Tenta primeiro o endpoint que se sabe (de um pedido anterior)
            # que esta máquina usa, para não perder tempo a sondar os
            # outros dois em cada poll de 5s. Isto é o que evita que uma
            # máquina que só responde em 'system' (não em 'info') seja
            # sempre abortada pelo timeout de 3.5s do frontend antes de o
            # backend sequer lá chegar.
            with endpoint_cache_lock:
                preferred = endpoint_cache.get(target_ip, 'info')
            order = [preferred] + [m for m in ('info', 'system', 'cgminer') if m != preferred]

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
                        # Timeout mais curto (1.8s) por tentativa: com o
                        # cache de endpoint, a tentativa preferida costuma
                        # acertar à primeira, e isto mantém o pior caso
                        # (3 tentativas) sob o limite de 3.5s do frontend.
                        with urllib.request.urlopen(req, timeout=1.8) as response:
                            raw_data = response.read()
                            if response.headers.get('Content-Encoding') == 'gzip' or raw_data[:2] == b'\x1f\x8b':
                                buffer = io.BytesIO(raw_data)
                                with gzip.GzipFile(fileobj=buffer) as gz:
                                    data = gz.read()
                            else:
                                data = raw_data

                            # Confirma que a resposta é mesmo JSON válido da
                            # API da máquina antes de a aceitar como sucesso.
                            # Firmwares AxeOS (NerdQaxe/Bitaxe) por vezes
                            # respondem com HTTP 200 mas devolvem a página do
                            # captive portal (index.html) em vez de JSON -
                            # normalmente quando a máquina perdeu a ligação
                            # WiFi normal e caiu de volta para o modo de
                            # configuração. Sem esta verificação, isto era
                            # aceite como "sucesso", ficava em cache como o
                            # endpoint bom, e o frontend recebia HTML em vez
                            # de dados - a máquina ficava presa em "offline"
                            # sem nunca se corrigir sozinha.
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
                            self.wfile.write(data)
                            return
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

            # Nenhum dos três métodos respondeu (ou só devolveram dados
            # inválidos): limpa a preferência em cache (pode ter mudado de
            # firmware/tipo) e reporta offline.
            with endpoint_cache_lock:
                endpoint_cache.pop(target_ip, None)

            # Sinaliza ao frontend, de forma explícita (sem ter de andar a
            # interpretar a mensagem de erro), quando a causa mais provável é
            # a máquina estar em modo de configuração WiFi/captive portal,
            # para se poder mostrar um aviso mais útil do que "offline".
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

        if path == '/api/rates':
            force = query_params.get('force', ['0'])[0] == '1'
            rates = fetch_binance_rates(force=force)
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(rates).encode('utf-8'))
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

        if path == '/api/version':
            # Endpoint simples e sem dependência de internet, só para o
            # frontend mostrar a versão instalada (ao contrário de
            # /api/update/check, que consulta o GitHub).
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"version": APP_VERSION}).encode('utf-8'))
            return

        if path == '/api/usage-count':
            # Consulta os totais de utilização registados no contador
            # global (countapi.xyz): arranques totais e instalações
            # únicas. Valores a None se não houver internet/serviço.
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
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(alerts_cfg, ensure_ascii=False).encode('utf-8'))
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

        if path == '/api/mrr/status':
            with POWER_CONFIG_LOCK:
                mrr_cfg = copy.deepcopy(power_config.get("mrr", {}) or {})
            configured = bool(mrr_cfg.get("api_key")) and bool(mrr_cfg.get("api_secret"))
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            # devolve a api_key (não o secret) para se poder pré-preencher o
            # campo no browser - assim não parece que "não gravou" só por o
            # campo aparecer vazio ao reabrir a aba.
            self.wfile.write(json.dumps({
                "configured": configured,
                "api_key": mrr_cfg.get("api_key", ""),
                "has_secret": bool(mrr_cfg.get("api_secret")),
            }).encode('utf-8'))
            return

        if path == '/api/mrr/rentals':
            try:
                # type=renter -> rentals que TU alugaste (não as tuas rigs
                # alugadas a outros); history=0 -> só as ativas, não
                # o histórico (usamos '0'/'1' em vez de 'true'/'false' em
                # texto, já que muitas APIs em PHP tratam a string "false"
                # como verdadeira por não estar vazia).
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
            # Um heartbeat novo cancela qualquer fecho pendente - isto é o
            # que trata o caso de F5/recarregar: a página antiga pede para
            # fechar (pagehide), mas a página nova já carregou e voltou a
            # mandar heartbeat dentro da janela de graça, por isso o fecho
            # é abortado e o servidor continua vivo.
            cancel_pending_close()
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}).encode('utf-8'))
            return

        if path == '/api/close':
            # Se já chegou um heartbeat muito recente (ex: a página nova de
            # um F5 já mandou o seu primeiro heartbeat antes deste beacon
            # "antigo" ter chegado), isso já prova que há uma página viva
            # agora mesmo - nem vale a pena agendar o fecho.
            ts = LAST_HEARTBEAT["ts"]
            if ts is not None and (time.time() - ts) < 1.5:
                print("[api/close] heartbeat muito recente já recebido (provável F5) - a ignorar pedido de fecho.", flush=True)
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "ignored": True}).encode('utf-8'))
                return
            print(f"[api/close] pedido de fecho recebido - a aguardar {CLOSE_GRACE_SECONDS}s por um heartbeat novo (pode ser só um F5).", flush=True)
            # Avisado pelo painel (evento pagehide/beforeunload). Isto
            # dispara tanto num fecho real do separador como num simples
            # F5/recarregar, por isso não desligamos já - agenda-se o fecho
            # e dá-se uma pequena janela de graça para a página seguinte
            # (se for só um reload) voltar a mandar heartbeat e cancelar.
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
            # Se o secret não vier no pedido (campo deixado em branco no
            # frontend para "manter o atual"), preserva o que já estava
            # guardado em vez de o apagar - bug anterior sobrescrevia
            # sempre com string vazia e desfazia a ligação sem avisar.
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

            # Mesmo tratamento que a MRR: campos de segredo (bot token,
            # webhook) só são substituídos se vierem preenchidos - deixados
            # em branco no formulário significa "manter o atual".
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
                # A máquina reinicia mesmo assim assim que recebe o pedido;
                # timeouts/conexão cortada a meio da resposta são normais
                # (o dispositivo desliga o Wi-Fi antes de conseguir responder).
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
        super().end_headers()


# --- Ícone na bandeja do sistema (system tray) ------------------------------
# Dá ao utilizador uma forma sempre visível e garantida de fechar a app por
# completo, mesmo que o browser tenha sido fechado sem disparar o pagehide
# (ex: fechado à força, crash, etc.) e a rede de segurança acima ainda não
# tenha disparado. O botão "Sair" do menu do ícone chama sempre os._exit(0)
# diretamente - não depende de heartbeats, janelas de graça, nem de nada
# que possa falhar; é o "botão de pânico" garantido.
TRAY_ICON_FILENAME = "app_icon.ico"


def _load_tray_image():
    """Tenta carregar o .ico da app (o mesmo usado no executável). Se não
    existir ou não for possível ler, gera um ícone simples de reserva para
    a bandeja nunca ficar sem ícone."""
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

    # Reserva: um quadrado laranja simples com "C" - nunca falha.
    img = Image.new('RGB', (64, 64), color=(30, 30, 30))
    draw = ImageDraw.Draw(img)
    draw.ellipse((4, 4, 60, 60), fill=(247, 147, 26))
    draw.text((22, 18), "C", fill=(20, 20, 20))
    return img


def _tray_abrir_painel(icon=None, item=None):
    webbrowser.open(f'http://localhost:{PORT}/nerdqaxe-dashboard.html')


def _tray_sair(icon=None, item=None):
    print("[tray] 'Sair' escolhido no ícone da bandeja - a fechar a app garantidamente.", flush=True)
    try:
        if icon is not None:
            icon.stop()
    except Exception:
        pass
    os._exit(0)


def start_tray_icon():
    """Cria e corre o ícone da bandeja numa thread dedicada (pystray precisa
    do seu próprio loop). Se a biblioteca não estiver disponível, não faz
    nada - a rede de segurança acima continua a garantir que a app não
    fica presa para sempre."""
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
    """ThreadingTCPServer que não enche o terminal de tracebacks quando um
    pedido é abortado pelo cliente (browser fechou o separador, deu F5 a
    meio de um pedido, página em segundo plano cancelou o fetch, etc.) -
    isto é normal e inofensivo, o servidor continua a correr na mesma.
    Qualquer outro erro continua a ser impresso normalmente para se poder
    diagnosticar. NOTA: este hook pertence ao servidor (quem o chama é
    process_request_thread), não ao RequestHandler - definir handle_error
    no handler não tem qualquer efeito.
    """
    allow_reuse_address = True
    daemon_threads = True

    def handle_error(self, request, client_address):
        exc_type = sys.exc_info()[0]
        if exc_type in (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            return
        super().handle_error(request, client_address)


def start_server():
    with QuietThreadingTCPServer(("", PORT), NerdQaxeProxyHandler) as httpd:
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
        track_app_start()
        start_mqtt_client(power_config)

        # Este processo é o "dono" do servidor - vigia o painel e desliga
        # tudo (fecho total) assim que o utilizador fechar o separador/janela.
        watchdog_thread = threading.Thread(target=watchdog_loop, daemon=True)
        watchdog_thread.start()

        pool_autoswitch_thread = threading.Thread(target=pool_autoswitch_loop, daemon=True)
        pool_autoswitch_thread.start()

        # Ícone na bandeja com "Sair" garantido - fecha sempre a app, mesmo
        # que o browser já não esteja a responder ou tenha sido fechado
        # sem disparar o pagehide.
        start_tray_icon()

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
