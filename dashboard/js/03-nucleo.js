const $ = id => document.getElementById(id);
const DEVICES_KEY = 'nerdqaxe:devices';
const NOTIF_KEY = 'nerdqaxe:notifications';
const THEME_KEY = 'nerdqaxe:theme';
// MAX_POINTS cobre 24h de histórico em memória (poll a cada ~12s = 7200
// pontos). Só existe enquanto a página estiver aberta (não é persistido).
const MAX_POINTS = 7200;

const THERMAL_KEY = 'nerdqaxe:thermal_history';
const THERMAL_MAINT_KEY = 'nerdqaxe:thermal_maintenance';
const THERMAL_SNAPSHOT_INTERVAL_MS = 20 * 60 * 1000;   // regista 1 amostra a cada 20 min
const THERMAL_MAX_SNAPSHOTS = 504;                     // ~7 dias de amostras por máquina
const THERMAL_MIN_BASELINE_SNAPSHOTS = 36;              // ~12h antes de emitir diagnóstico
const THERMAL_RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;   // janela "recente": últimas 24h
const THERMAL_BASELINE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // janela de comparação: até 7 dias
const THERMAL_WARN_PCT = 15;   // +15% de ventilação necessária vs baseline -> Atenção
const THERMAL_CRIT_PCT = 30;   // +30% -> Crítico

const THERMAL_FORECAST_MIN_DAYS = 2;      // mínimo de dias civis distintos para tentar uma tendência
const THERMAL_FORECAST_ALERT_WINDOW = 7;  // avisa quando faltarem <= 7 dias para o risco de throttle

const THERMAL_PROTECTION_KEY = 'nerdqaxe:thermal_protection';
const CRITICAL_ALARM_INTERVAL_MS = 1200; // intervalo entre "bips" do alarme sonoro contínuo

// Base do servidor local (app.py). Usa o mesmo protocolo/host com que esta
// página foi aberta em vez de "http://localhost" fixo, para funcionar tanto
// em HTTP normal como no modo HTTPS opcional (certificado autoassinado) -
// sem isto, uma página aberta em https:// teria estes pedidos bloqueados
// pelo browser como "conteúdo misto".
// atrás do HTTPS do Tailscale (nome.ts.net, porta 443) a API está na mesma origem, sem :8765
const API_BASE = /\.ts\.net$/.test(location.hostname) ? location.origin : `${location.protocol}//${location.hostname}:8765`;

let devices = [];
let appVersion = '';
function algoGroupOf(r) {
  if (!r) return 'sha256';
  const algo = (r.algorithm || 'sha256').toLowerCase();
  const type = r.type || 'asic_sha256';
  if (type === 'gpu_rig' || algo === 'kawpow' || algo === 'autolykos2') return 'gpu';
  if (algo === 'scrypt' || type === 'asic_scrypt') return 'scrypt';
  if (algo === 'sha256' || type === 'asic_sha256') return 'sha256';
  return 'other';
}

let readings = {};
let histories = {};
let selectedId = null;

// Marca, por dispositivo, se já recebemos pelo menos uma leitura nesta
// sessão do painel. Serve para não disparar notificações de "novo recorde"
// / "bloco encontrado" logo na primeira leitura (que só está a carregar os
// valores já existentes na máquina, não é um evento novo).
let baselineSeen = {};
let consecutiveFails = {}; // dev.id -> nº de falhas de poll seguidas (só marca offline ao fim de 2, para não "flapar" com um blip isolado)

