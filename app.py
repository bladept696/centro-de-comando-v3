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

NERDQAXE_SIGNATURE_FIELDS = {
    'ASICModel', 'hashRate', 'bestDiff', 'bestSessionDiff',
    'stratumURL', 'hostname', 'boardVersion'
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
    "profiles": []
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

                        self.send_response(200)
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.send_header('Content-Type', 'application/json; charset=utf-8')
                        self.end_headers()
                        self.wfile.write(data_alt)
                        return
                except Exception as e2:
                    self.send_response(502)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": str(e2), "online": False}).encode('utf-8'))
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

        super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        length = int(self.headers.get('Content-Length') or 0)
        raw_body = self.rfile.read(length) if length else b''
        try:
            body = json.loads(raw_body.decode('utf-8')) if raw_body else {}
        except Exception:
            body = {}

        if path == '/api/power/config':
            global power_config
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

    webbrowser.open(f'http://localhost:{PORT}/nerdqaxe-dashboard.html')

    # Mantém o processo vivo enquanto o servidor corre em background
    while True:
        time.sleep(3600)


if __name__ == '__main__':
    main()
