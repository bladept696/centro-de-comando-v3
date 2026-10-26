// --- Sinais extra do firmware AxeOS/NerdQAxe: VR, Wi-Fi e entrada de energia ---
// Aceita vários nomes de campo (variam entre firmwares) e devolve null quando
// o campo não existe, para a linha do cartão ficar escondida em vez de "0".
function pickNum(...vals){
  for(const v of vals){
    if(v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if(Number.isFinite(n)) return n;
  }
  return null;
}
// O AxeOS manda a tensão de entrada em mV e a corrente em mA; alguns forks
// mandam já em V/A. Valores grandes => unidades pequenas, converte.
function normInputVolts(v){ if(v == null || v <= 0) return null; return v > 100 ? v / 1000 : v; }
function normInputAmps(a){ if(a == null || a < 0) return null; return a > 100 ? a / 1000 : a; }

// --- Ajuda contextual: botão "?" ao lado de cada métrica ---
let _helpPop = null;
let _helpOwner = null;
function closeHelpPopover(){
  if(_helpPop) _helpPop.hidden = true;
  _helpOwner = null;
}
function openHelpPopover(btn){
  const key = btn.getAttribute('data-help');
  if(!_helpPop){
    _helpPop = document.createElement('div');
    _helpPop.className = 'help-popover';
    _helpPop.setAttribute('role', 'tooltip');
    document.body.appendChild(_helpPop);
  }
  if(_helpOwner === btn && !_helpPop.hidden){ closeHelpPopover(); return; }
  _helpOwner = btn;
  const title = btn.closest('.metric-label')?.textContent.replace('?', '').trim() || '';
  _helpPop.innerHTML = `<b></b><span></span>`;
  _helpPop.querySelector('b').textContent = title;
  _helpPop.querySelector('span').textContent = t('help_' + key);
  _helpPop.hidden = false;
  const r = btn.getBoundingClientRect();
  const w = _helpPop.offsetWidth, h = _helpPop.offsetHeight;
  let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
  let top = r.bottom + 8;
  if(top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
  _helpPop.style.left = left + 'px';
  _helpPop.style.top = top + 'px';
}
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.help-dot');
  if(btn){ e.stopPropagation(); openHelpPopover(btn); return; }
  if(_helpPop && !_helpPop.hidden && !e.target.closest('.help-popover')) closeHelpPopover();
}, true);
document.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeHelpPopover(); });
window.addEventListener('scroll', closeHelpPopover, true);

async function pollOneDevice(dev){
  const pingStart = performance.now();
  try {
    const controller = new AbortController();
    // 5.5s: dá margem ao backend para tentar os 3 métodos possíveis
    // (info/system/cgminer) sem que o frontend desista primeiro. Com a
    // cache de endpoint no backend, o caso normal (endpoint já conhecido)
    // responde bem mais rápido do que isto - este limite só é atingido
    // quando a máquina está mesmo a falhar em todos os métodos.
    const timeoutId = setTimeout(() => controller.abort(), 5500);

    const res = await fetch(`${API_BASE}/api/proxy?ip=${encodeURIComponent(dev.ip)}`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if(!res.ok) {
      // Lê o corpo do erro (quando existe) para saber se a causa é a
      // máquina estar em modo de configuração WiFi/captive portal, em vez
      // de simplesmente marcar "offline" sem mais informação.
      let portalMode = false;
      try {
        const errBody = await res.json();
        portalMode = !!errBody.portal_mode;
      } catch(_) { /* corpo não veio em JSON - ignora */ }
      const err = new Error();
      err.portalMode = portalMode;
      throw err;
    }
    const d = await res.json();
    const localLatencyMs = Math.round(performance.now() - pingStart);
    const { ping: poolPingVal, loss: poolLossVal } = extractPoolPingLoss(d);

    addConsoleLine(dev.id, dev.name, 'API_JSON', JSON.stringify(d));

    const fanVal = d.fanrpm ?? d.fanSpeed ?? d.fanspeed ?? 0;
    const acceptedVal = d.sharesAccepted ?? d.accepted ?? 0;
    const rejectedVal = d.sharesRejected ?? d.rejected ?? 0;
    const powerVal = d.power ?? 0;

    const hashrateVal = d.hashRate ?? d.hashrate ?? 0;

    let efficiencyVal = 0;
    if (powerVal > 0 && hashrateVal > 0) {
      const hashrateTH = hashrateVal / 1000;
      if(hashrateTH > 0) efficiencyVal = powerVal / hashrateTH;
    }

    const firmwareVal = d.firmwareVersion ?? d.version ?? d.axeOSVersion ?? (d.protocol === 'cgminer' ? d.ASICModel : null) ?? '—';

    const poolUrlVal = d.stratumURL ?? d.poolUrl ?? '—';
    const currentBest = Number(d.bestSessionDiff ?? d.bestDiff ?? 0);
    const blocksFoundVal = Number(d.blockFound ?? d.blocksFound ?? 0);
    const uptimeVal = d.uptimeSeconds ?? d.uptime ?? null;

    const reading = {
      hashrate: hashrateVal,
      hashrate_raw: d.hashrate_raw ?? (hashrateVal * 1e9),
      hashrate_display: d.hashrate_display ?? null,
      algorithm: (d.algorithm || 'sha256').toLowerCase(),
      type: d.type || 'asic_sha256',
      best: currentBest,
      temp: d.temp ?? d.temperature,
      fanSpeed: Number(fanVal) || 0,
      power: Number(powerVal) || 0,
      frequency: d.frequency ?? 0,
      coreVoltage: d.coreVoltage ?? null,
      boards: Array.isArray(d.boards) ? d.boards : null,
      fanList: Array.isArray(d.fanList) ? d.fanList : null,
      coreVoltageActual: pickNum(d.coreVoltageActual, d.coreVoltageActualMv, d.vcoreActual),
      accepted: Number(acceptedVal) || 0,
      rejected: Number(rejectedVal) || 0,
      efficiency: Number(efficiencyVal) || 0,
      pool: poolUrlVal,
      firmware: firmwareVal,
      poolInfo: extractPoolInfo(d),
      blocksFound: blocksFoundVal,
      poolPing: poolPingVal,
      poolLoss: poolLossVal,
      localLatency: localLatencyMs,
      uptime: uptimeVal != null ? Number(uptimeVal) : null,
      vrTemp: pickNum(d.vrTemp, d.VrTemp, d.vr_temp, d.vrTemperature),
      rssi: pickNum(d.wifiRSSI, d.wifiRssi, d.rssi, d.wifi_rssi),
      inputV: normInputVolts(pickNum(d.voltage, d.inputVoltage, d.input_voltage)),
      inputA: normInputAmps(pickNum(d.current, d.inputCurrent, d.input_current)),
      deviceModel: String(d.deviceModel ?? d.boardVersion ?? ''),
      asicModel: String(d.ASICModel ?? d.asicModel ?? ''),
      poolPort: pickNum(d.stratumPort, d.poolPort),
      bestAll: Number(d.bestDiff ?? 0),
      fanPct: pickNum(d.fanspeed, d.fanSpeedPercent),
      fanAuto: d.autofanspeed != null ? !!Number(d.autofanspeed) : null,
      online: true
    };

    const oldReading = readings[dev.id];
    const oldBest = oldReading?.best || 0;
    const oldBlocks = oldReading?.blocksFound || 0;
    const oldPoolPing = oldReading?.poolPing;
    const hasBaseline = !!baselineSeen[dev.id];

    if(oldReading?.uptime != null && reading.uptime != null && reading.uptime < oldReading.uptime - 30) {
      logEvent(`Reinício detetado — uptime voltou a zero.`, 'error', dev.name, dev.id);
    }


    if(reading.vrTemp != null && reading.vrTemp >= 85 && !(oldReading?.vrTemp >= 85)) {
      logEvent(`Regulador de tensão (VR) muito quente: ${reading.vrTemp.toFixed(1)} °C.`, 'error', dev.name, dev.id);
    }
    if(reading.rssi != null && reading.rssi <= -80 && !(oldReading?.rssi != null && oldReading.rssi <= -80)) {
      logEvent(`Sinal Wi-Fi fraco: ${reading.rssi} dBm — pode causar quedas e shares rejeitadas.`, 'error', dev.name, dev.id);
    }

    if(oldPoolPing != null && poolPingVal != null && poolPingVal > 400 && poolPingVal > oldPoolPing * 2) {
      logEvent(`Ping ao pool elevado: ${poolPingVal.toFixed(0)} ms.`, 'error', dev.name, dev.id);
    }

    if(hasBaseline && currentBest > oldBest) {
      const fmt = formatDiff(currentBest);
      logEvent(`Novo recorde de dificuldade! ${fmt.value} ${fmt.unit}`, 'new', dev.name, dev.id);
      addNotification('best', `Novo Recorde de Dificuldade: ${fmt.value} ${fmt.unit}`, `A máquina alcançou um novo best diff de ${currentBest.toLocaleString()} na sessão.`, dev.name);
      recordBestDiffEvent(dev, currentBest, Date.now());
      if(alertsConfig.notify_record){
        sendAlert(`🏆 ${dev.name} bateu um novo recorde: ${fmt.value} ${fmt.unit}`);
      }
    }

    if(hasBaseline && blocksFoundVal > oldBlocks) {
      logEvent(`Bloco encontrado com sucesso! 🎉`, 'new', dev.name, dev.id);
      addNotification('block', `Bloco Encontrado com Sucesso!`, `Total de blocos encontrados por esta máquina atualizado para ${blocksFoundVal}.`, dev.name, { diff: currentBest });
      celebrateBlockFound(dev.name, currentBest);
    }

    // Alerta de queda de hashrate: compara a leitura atual com a média das
    // últimas amostras ANTES desta (por isso lido com o array antes de lhe
    // adicionar a leitura atual). Só dispara com histórico suficiente para
    // não reagir a uma única flutuação normal.
    if(hasBaseline && alertsConfig.notify_hashrate_drop && reading.hashrate > 0){
      const prevHistory = (histories[dev.id] || []).filter(h => h.hashrate > 0);
      if(prevHistory.length >= 6){
        const recentSamples = prevHistory.slice(-12);
        const avgHashrate = recentSamples.reduce((sum, h) => sum + h.hashrate, 0) / recentSamples.length;
        const dropPct = alertsConfig.hashrate_drop_pct || 30;
        if(avgHashrate > 0 && reading.hashrate < avgHashrate * (1 - dropPct / 100)){
          const pctDrop = Math.round((1 - reading.hashrate / avgHashrate) * 100);
          sendAlert(`📉 ${dev.name}: hashrate caiu ${pctDrop}% face à média recente (agora ${reading.hashrate.toFixed(1)} GH/s).`, `hashdrop-${dev.id}`);
        }
      }
    }

    consecutiveFails[dev.id] = 0;
    baselineSeen[dev.id] = true;
    try { hcShareFlow(dev.id, readings[dev.id], reading); } catch(e){}
    readings[dev.id] = reading;
    if(reading.ts == null) reading.ts = Date.now();
    histories[dev.id] = (histories[dev.id] || []).concat(reading).slice(-MAX_POINTS);
    recordThermalSnapshot(dev, reading);
    evaluateThermalProtection(dev, reading);

  } catch(e) {
    // Só marca offline ao fim de 2 falhas de poll seguidas (~10s). Um
    // único timeout/blip de rede não é motivo suficiente - isso é o que
    // fazia máquinas saudáveis mas um pouco mais lentas a responder
    // aparecerem constantemente como "offline".
    const fails = (consecutiveFails[dev.id] || 0) + 1;
    consecutiveFails[dev.id] = fails;
    if(fails < 2) return;

    const wasOnline = readings[dev.id]?.online;
    readings[dev.id] = { ...(readings[dev.id] || {}), online: false, portalMode: !!e.portalMode };
    if(wasOnline !== false) {
      if(e.portalMode) {
        logEvent(`Máquina caiu para o modo de configuração WiFi (captive portal) - verifica a ligação WiFi.`, 'error', dev.name, dev.id);
        addNotification('offline', `Máquina em Modo de Configuração`, `${dev.name} caiu para o modo captive portal (WiFi) e precisa de reconfiguração.`, dev.name);
        if(alertsConfig.notify_offline){
          sendAlert(`⚙️ ${dev.name} caiu para o modo de configuração WiFi (captive portal) - verifica a ligação.`, `offline-${dev.id}`);
        }
      } else {
        logEvent(`Falha de comunicação com o dispositivo.`, 'error', dev.name, dev.id);
        addNotification('offline', `Máquina Offline`, `${dev.name} ficou offline (falha de comunicação).`, dev.name);
        if(alertsConfig.notify_offline){
          sendAlert(`⚠️ ${dev.name} ficou offline (falha de comunicação).`, `offline-${dev.id}`);
        }
      }
    }
    if(thermalCriticalState[dev.id]){
      thermalCriticalState[dev.id] = { since: null, alarmed: false };
      updateCriticalAlarmUI();
    }
  }
}

// --- Animação "ao vivo" de valores numéricos ------------------------------
// Anima suavemente um elemento de um valor antigo para o novo (em vez de
// trocar o texto instantaneamente), e dá um pequeno "flash" no fim, para o
// painel parecer vivo a cada poll. Cancela qualquer animação anterior ainda
// a decorrer no mesmo elemento.
function animateNumberTo(el, newVal, formatterFn, fallbackText){
  if(!el) return;
  if(newVal == null || isNaN(newVal)){
    if(el._rafId) cancelAnimationFrame(el._rafId);
    delete el.dataset.rawVal;
    el.textContent = fallbackText != null ? fallbackText : '—';
    return;
  }

  const prevRaw = el.dataset.rawVal;
  const prev = prevRaw !== undefined ? parseFloat(prevRaw) : newVal;
  el.dataset.rawVal = newVal;

  if(el._rafId) cancelAnimationFrame(el._rafId);

  if(!isFinite(prev) || prev === newVal){
    el.textContent = formatterFn(newVal);
    return;
  }

  const duration = 700;
  const start = performance.now();
  function step(now){
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3); // ease-out cúbico
    const cur = prev + (newVal - prev) * eased;
    el.textContent = formatterFn(cur);
    if(p < 1){
      el._rafId = requestAnimationFrame(step);
    } else {
      el.textContent = formatterFn(newVal);
      el._rafId = null;
      flashValue(el);
    }
  }
  el._rafId = requestAnimationFrame(step);
}

// Faz o elemento "brilhar" por um instante — usado quando um valor muda,
// tenha sido animado numericamente ou não (texto, strings, badges...).
function flashValue(el){
  if(!el) return;
  el.classList.remove('value-flash');
  void el.offsetWidth; // força reflow para reiniciar a animação CSS
  el.classList.add('value-flash');

  // Também dá um breve destaque à linha inteira (fundo), não só ao número,
  // para o painel parecer mais vivo quando os dados chegam.
  const row = el.closest('.metric-row');
  if(row){
    row.classList.remove('row-flash');
    void row.offsetWidth;
    row.classList.add('row-flash');
  }
}

// Troca o texto (ou HTML) de um elemento só se o valor mudou de facto, e
// dá o "flash" de destaque nesse caso — evita animar quando nada mudou.
function setTextWithFlash(el, newContent, useHTML){
  if(!el) return;
  const prop = useHTML ? 'innerHTML' : 'textContent';
  if(el[prop] === newContent) return;
  el[prop] = newContent;
  flashValue(el);
}

// Deriva uma cor de destaque estável (matiz HSL) a partir do id/nome da
// máquina, evitando a zona do vermelho (reservada para "offline"). A
// mesma máquina fica sempre com a mesma cor entre refreshes/sessões.
function machineAccentColor(seed){
  let hash = 0;
  const str = String(seed);
  for(let i = 0; i < str.length; i++){
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  const hue = 30 + (hash % 271); // 30..300, fora do vermelho (0-30 e 300-360)
  return {
    accent: `hsl(${hue}, 85%, 62%)`,
    glow: `hsla(${hue}, 85%, 62%, 0.45)`
  };
}

// Preenche o anel radial (SVG) de um gauge com uma animação suave, dado
// um rácio 0-1. Usado para os gauges de Temperatura e Fans no topo.
const RING_CIRCUMFERENCE = 2 * Math.PI * 18;
function setRingProgress(svgId, ratio, color){
  const ring = $(svgId);
  if(!ring) return;
  const clamped = Math.max(0, Math.min(1, ratio || 0));
  ring.style.strokeDashoffset = (RING_CIRCUMFERENCE * (1 - clamped)).toFixed(2);
  if(color) ring.style.stroke = color;
}

function renderAll(){
  const active = devices.map(d => readings[d.id]).filter(r => r && r.online);
  let sha256Ghs = 0, scryptMhs = 0, gpuTotals = {}, otherTotals = {};
  const bestAll = Math.max(0, ...devices.map(d => readings[d.id]?.best || 0));

  active.forEach(r => {
    const algo = (r.algorithm || 'sha256').toLowerCase();
    const rawHps = Number(r.hashrate_raw || (r.hashrate ? r.hashrate * 1e9 : 0));
    const grp = algoGroupOf(r);
    if (grp === 'scrypt') {
      scryptMhs += (rawHps / 1e6);
    } else if (grp === 'gpu') {
      gpuTotals[algo] = (gpuTotals[algo] || 0) + (rawHps / 1e6);
    } else if (grp === 'other') {
      otherTotals[algo] = (otherTotals[algo] || 0) + rawHps;
    } else {
      sha256Ghs += (rawHps / 1e9);
    }
  });

  const fmtHps = (h) => h >= 1e12 ? `${(h / 1e12).toFixed(2)} TH/s` : h >= 1e9 ? `${(h / 1e9).toFixed(2)} GH/s` : h >= 1e6 ? `${(h / 1e6).toFixed(1)} MH/s` : `${(h / 1e3).toFixed(1)} kH/s`;
  const elHash = $('sHashrate');
  const elUnit = $('sHashrateUnit');
  const otherKeys = Object.keys(otherTotals);
  const groupCount = (sha256Ghs > 0 ? 1 : 0) + (scryptMhs > 0 ? 1 : 0) + (Object.keys(gpuTotals).length > 0 ? 1 : 0) + (otherKeys.length > 0 ? 1 : 0);
  const showList = groupCount > 1 || otherKeys.length > 0;

  if (showList) {
    elUnit.textContent = (groupCount > 1 || otherKeys.length > 1) ? "MULTI-ALGO" : otherKeys[0].toUpperCase();
    elHash.style.fontSize = "13px";
    elHash.style.lineHeight = "1.3";
    let html = '';
    if (sha256Ghs > 0) {
      const btcStr = sha256Ghs >= 1000 ? `${(sha256Ghs / 1000).toFixed(2)} TH/s` : `${sha256Ghs.toFixed(1)} GH/s`;
      html += `<div>⚡ ${btcStr} <span style="font-size:9px;color:var(--amber);">BTC</span></div>`;
    }
    if (scryptMhs > 0) {
      html += `<div>⚡ ${scryptMhs.toFixed(1)} MH/s <span style="font-size:9px;color:var(--cyan);">LTC</span></div>`;
    }
    for (const [gAlgo, val] of Object.entries(gpuTotals)) {
      html += `<div>🎮 ${val.toFixed(1)} MH/s <span style="font-size:9px;color:var(--green);">${escapeHtml(gAlgo.toUpperCase())}</span></div>`;
    }
    for (const [oAlgo, val] of Object.entries(otherTotals)) {
      html += `<div>⚡ ${fmtHps(val)} <span style="font-size:9px;color:var(--muted);">${escapeHtml(oAlgo.toUpperCase())}</span></div>`;
    }
    elHash.innerHTML = html;
  } else if (scryptMhs > 0) {
    elHash.style.fontSize = "22px";
    elHash.style.lineHeight = "";
    elUnit.textContent = "MH/s";
    animateNumberTo(elHash, scryptMhs, (v) => v.toFixed(2));
  } else {
    elHash.style.fontSize = "22px";
    elHash.style.lineHeight = "";
    const isThs = sha256Ghs >= 1000;
    elUnit.textContent = isThs ? "TH/s" : "GH/s";
    animateNumberTo(elHash, active.length ? (isThs ? sha256Ghs / 1000 : sha256Ghs) : null, (v) => v.toFixed(2));
  }

  const df = formatDiff(bestAll);
  animateNumberTo($('sBest'), bestAll, (v) => formatDiff(v).value);
  $('sBestUnit').textContent = df.unit + ' Global';

  const maxTemp = active.length ? Math.max(...active.map(r=>r.temp)) : null;
  const tempElem = $('sTemp');
  animateNumberTo(tempElem, maxTemp, (v) => v.toFixed(1), '—');
  tempElem.className = 'value ' + getTempRiskClass(maxTemp);
  setRingProgress('ringTemp', maxTemp != null ? (maxTemp - 20) / (90 - 20) : 0,
    maxTemp != null && maxTemp >= 75 ? 'var(--red)' : (maxTemp != null && maxTemp >= 65 ? 'var(--amber)' : 'var(--cyan)'));

  const avgFan = active.length ? Math.round(active.reduce((s,r) => s + (r.fanSpeed || 0), 0) / active.length) : null;
  setTextWithFlash($('sFan'), avgFan != null ? String(avgFan) : '—');
  setRingProgress('ringFan', avgFan != null ? avgFan / 100 : 0, 'var(--cyan)');

  const totalPower = active.length ? active.reduce((s,r) => s + r.power, 0) : null;
  animateNumberTo($('sPower'), totalPower, (v) => v.toFixed(1), '—');
  $('sCount').textContent = devices.length;

  if(typeof networkMapAuto !== 'undefined' && networkMapAuto) renderNetworkMap();
  if(typeof renderMachineCards === 'function') renderMachineCards();
  renderHashrateDonut(devices);
  renderSimulator();

  const selDev = devices.find(d => d.id === selectedId);
  if(selDev){
    const rangeMs = _hashrateRangeState.rangeMs;
    const cutoff = Date.now() - rangeMs;
    const hist = (histories[selDev.id] || []).filter(x => x && (x.ts == null || x.ts >= cutoff));
    drawAmberChart('chartHashrate', hist.map(x=>x?.hashrate), (val) => formatHashrate(val), true);
    updatePeakDiffPanel(selDev);
  } else {
    $('chartHashrate').innerHTML = '';
    $('chartPeakDiff').innerHTML = '';
    $('valHashrate').textContent = '—';
    $('valPeak').textContent = '—';
    $('valAvg').textContent = '—';
    $('valPeakDiffBig').textContent = '—';
    _peakDiffState.ip = null;
  }

  const latTab = $('tab-latency');
  if(latTab && latTab.classList.contains('active')) renderPingTab();

  const thermalTab = $('tab-thermal');
  if(thermalTab && thermalTab.classList.contains('active')) renderThermalTab();
}

// Anima um valor de texto a "contar" suavemente entre o antigo e o novo,
// em vez de trocar instantaneamente — dá a sensação de dado vivo a mexer.
function _animateChartValue(el, value, unit, sep = ' '){
  if(!el) return;
  const prevNum = parseFloat(el.dataset.rawVal);
  const nextNum = parseFloat(String(value).replace(',', '.'));
  el.dataset.rawVal = value;

  const decimals = (String(value).split('.')[1] || '').length;
  const render = (n) => `${n.toFixed(decimals)}${sep}${unit}`;

  if(isNaN(prevNum) || isNaN(nextNum) || prevNum === nextNum){
    el.textContent = render(isNaN(nextNum) ? value : nextNum);
  } else {
    if(el._chartValRaf) cancelAnimationFrame(el._chartValRaf);
    const dur = 500, start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = render(prevNum + (nextNum - prevNum) * eased);
      if(t < 1) el._chartValRaf = requestAnimationFrame(step);
    };
    el._chartValRaf = requestAnimationFrame(step);
  }
  el.classList.remove('chart-val-pulse');
  void el.offsetWidth;
  el.classList.add('chart-val-pulse');
}

function drawAmberChart(svgId, vals, formatter, isHashrate = true){
  const svg = $(svgId);
  vals = (vals || []).filter(v => v != null);
  
  if(vals.length < 2){ 
    svg.innerHTML = '<text x="50%" y="50%" fill="#4a6975" font-size="11" text-anchor="middle">A aguardar dados em tempo real...</text>'; 
    return; 
  }
  
  let min = Math.min(...vals), max = Math.max(...vals), range = (max-min)||1;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const latest = vals[vals.length - 1];
  
  const latFmt = formatter(latest);
  const peakFmt = formatter(max);
  const avgFmt = formatter(avg);

  _animateChartValue($('valHashrate'), latFmt.value, latFmt.unit);
  $('valPeak').textContent = `${peakFmt.value} ${peakFmt.unit}`;
  $('valAvg').textContent = `${avgFmt.value} ${avgFmt.unit}`;
  if(svgId === 'chartHashrate' && hc3dTry('chartHashrate', vals)) return;
  
  const paddingY = 16;
  const w = 300, h = 130;
  const usableH = h - (paddingY * 2);
  
  const pts = vals.map((v, i) => {
    const x = 10 + i * ((w - 20) / (vals.length - 1));
    const y = h - paddingY - ((v - min) / range) * usableH;
    return {x, y, val: v};
  });
  
  const ptsString = pts.map(p => `${p.x},${p.y}`).join(' L');
  const avgY = h - paddingY - ((avg - min) / range) * usableH;
  const lastPt = pts[pts.length - 1];

  // Grade horizontal subtil (topo, meio, fundo da faixa de valores) — dá
  // profundidade e um ponto de referência visual sem poluir o gráfico.
  const gridYs = [paddingY, h / 2, h - paddingY];
  const gridLines = gridYs.map((gy, i) => `<line class="chart-grid-line" x1="10" y1="${gy}" x2="290" y2="${gy}" stroke="#4a6975" stroke-width="1" style="animation-delay:${i*0.12}s, ${0.8 + i*0.12}s"/>`).join('');

  // Pontos ao longo da linha, a aparecer em sequência da esquerda para a
  // direita — reforça a ideia de série temporal a "chegar" em tempo real.
  const pointDots = pts.map((p, i) => {
    const isLast = i === pts.length - 1;
    if(isLast) return '';
    const delay = (i / pts.length) * 0.6;
    return `<circle class="chart-point" cx="${p.x}" cy="${p.y}" r="2" fill="#ffb020" fill-opacity="0.7" style="animation-delay:${delay}s"/>`;
  }).join('');
  
  svg.innerHTML = `
    <defs>
      <linearGradient id="amber_grad_${svgId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffb020" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#ffb020" stop-opacity="0.0"/>
      </linearGradient>
      <filter id="glow_${svgId}" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" result="glow" />
        <feComposite in="SourceGraphic" in2="glow" operator="over" />
      </filter>
    </defs>

    ${gridLines}
    <line x1="10" y1="${avgY}" x2="290" y2="${avgY}" stroke="#ffb02066" stroke-dasharray="4,4" stroke-width="1"/>
    <path class="chart-area-fill" d="M${pts[0].x},${h} L${ptsString} L${pts[pts.length-1].x},${h} Z" fill="url(#amber_grad_${svgId})"></path>
    <path class="chart-line-draw" fill="none" stroke="#ffb020" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" filter="url(#glow_${svgId})" d="M${ptsString}"></path>
    <path class="chart-flow-overlay" fill="none" stroke="#fff6de" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="0.5 16" d="M${ptsString}"></path>
    ${pointDots}

    <circle class="chart-comet" r="2.6" fill="#fff6de">
      <animateMotion dur="3.2s" repeatCount="indefinite" path="M${ptsString}" rotate="auto"/>
      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.9;1" dur="3.2s" repeatCount="indefinite"/>
    </circle>

    <circle class="chart-end-ring" cx="${lastPt.x}" cy="${lastPt.y}" r="5" fill="none" stroke="#ffb020" stroke-width="1.5"/>
    <circle class="chart-end-dot" cx="${lastPt.x}" cy="${lastPt.y}" r="4.5" fill="#ffb020" stroke="#0d1a26" stroke-width="2"/>

    <g id="tooltip_${svgId}" style="display:none;">
      <line x1="0" y1="0" x2="0" y2="${h}" stroke="#ffb02088" stroke-dasharray="3,3" stroke-width="1"></line>
      <circle r="4" fill="#ffb020" stroke="#060d14" stroke-width="2"></circle>
    </g>
  `;

  const linePath = svg.querySelector('.chart-line-draw');
  if(linePath){
    try{
      const len = linePath.getTotalLength();
      linePath.style.strokeDasharray = len;
      linePath.style.strokeDashoffset = len;
      linePath.getBoundingClientRect(); // força reflow para a transição arrancar
      linePath.style.transition = 'stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)';
      requestAnimationFrame(() => { linePath.style.strokeDashoffset = '0'; });
    } catch(e){}
  }
  
  svg.onmousemove = (e) => {
    const rect = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * w;
    
    let closest = pts[0];
    let minDist = Infinity;
    for(const p of pts){
      const dist = Math.abs(p.x - mouseX);
      if(dist < minDist){ minDist = dist; closest = p; }
    }
    
    const tip = svg.querySelector(`#tooltip_${svgId}`);
    if(tip){
      tip.style.display = 'block';
      tip.setAttribute('transform', `translate(${closest.x}, 0)`);
      tip.querySelector('circle').setAttribute('cy', closest.y);
      
      const res = formatter(closest.val);
      $('valHashrate').textContent = `${res.value} ${res.unit}`;
    }
  };
  
  svg.onmouseleave = () => {
    const tip = svg.querySelector(`#tooltip_${svgId}`);
    if(tip) tip.style.display = 'none';
    const res = formatter(vals[vals.length - 1]);
    $('valHashrate').textContent = `${res.value} ${res.unit}`;
  };
}

// --- Botões de intervalo do gráfico "Hashrate" (1H/3H/24H) ---------------
// Filtra o histórico já guardado em memória (histories[id], até 24h a
// ~12s/leitura) pelo timestamp de cada leitura — sem pedir nada ao backend.
const _hashrateRangeState = { range: '1h', rangeMs: 60 * 60 * 1000 };
const HASHRATE_RANGE_MS = { '1h': 60 * 60 * 1000, '3h': 3 * 60 * 60 * 1000, '24h': 24 * 60 * 60 * 1000 };
const HASHRATE_RANGE_LABEL_KEY = { '1h': '60_min', '3h': '3_horas', '24h': '24_horas' };

function setupHashrateRangeButtons(){
  const wrap = $('hashrateRangeButtons');
  if(!wrap) return;
  wrap.querySelectorAll('.time-btn').forEach(btn => {
    btn.onclick = () => {
      const range = btn.dataset.range;
      if(range === _hashrateRangeState.range) return;
      wrap.querySelectorAll('.time-btn').forEach(b => b.classList.toggle('active', b === btn));
      _hashrateRangeState.range = range;
      _hashrateRangeState.rangeMs = HASHRATE_RANGE_MS[range] || HASHRATE_RANGE_MS['1h'];
      const labelEl = $('hashrateRangeLabel');
      if(labelEl) labelEl.textContent = t(HASHRATE_RANGE_LABEL_KEY[range] || '60_min');
      renderAll();
    };
  });
}

// --- Painel "Peak Share Difficulty" (barras, escala log, 24H/3D/7D) -------
// Substitui o antigo gráfico de linha "Best Share Histórico". Os dados vêm
// do backend (/api/diff-buckets), que guarda o melhor "best diff" visto por
// bucket de 15 min (agregado em janelas maiores para 3D/7D) — ver app.py.
const _peakDiffState = { ip: null, range: '24h', lastFetchAt: 0, lastKey: null };

function setupPeakDiffRangeButtons(){
  const wrap = $('peakDiffRangeButtons');
  if(!wrap) return;
  wrap.querySelectorAll('.time-btn').forEach(btn => {
    btn.onclick = () => {
      const range = btn.dataset.range;
      if(range === _peakDiffState.range) return;
      wrap.querySelectorAll('.time-btn').forEach(b => b.classList.toggle('active', b === btn));
      _peakDiffState.range = range;
      fetchAndRenderPeakDiff(_peakDiffState.ip, range, true);
    };
  });
}

function updatePeakDiffPanel(selDev){
  if(!selDev || !selDev.ip) return;
  _peakDiffState.ip = selDev.ip;
  const now = Date.now();
  // evita martelar o backend a cada poll (12s) — refresca no máx. a cada 30s,
  // ou de imediato se a máquina selecionada mudou.
  const key = `${selDev.ip}|${_peakDiffState.range}`;
  const force = key !== _peakDiffState.lastKey;
  if(force || (now - _peakDiffState.lastFetchAt) >= 30000){
    fetchAndRenderPeakDiff(selDev.ip, _peakDiffState.range, force);
  }
}

async function fetchAndRenderPeakDiff(ip, range, force){
  if(!ip) return;
  const key = `${ip}|${range}`;
  _peakDiffState.lastFetchAt = Date.now();
  _peakDiffState.lastKey = key;
  try{
    const res = await fetch(`${API_BASE}/api/diff-buckets?ip=${encodeURIComponent(ip)}&range=${encodeURIComponent(range)}`);
    const data = await res.json();
    // ignora respostas atrasadas de um pedido antigo (máquina/aba já trocou)
    if(_peakDiffState.lastKey !== key) return;
    drawPeakDiffBarChart(data.buckets || [], data.peak || 0, range);
  } catch(e){
    if(force) $('chartPeakDiff').innerHTML = '<text x="50%" y="50%" fill="#5a7482" font-size="15" text-anchor="middle">—</text>';
  }
}

function drawPeakDiffBarChart(buckets, peak, range){
  const svg = $('chartPeakDiff');
  const bigEl = $('valPeakDiffBig');
  if(!svg) return;

  if(!buckets || buckets.length === 0){
    svg.innerHTML = '<text x="50%" y="50%" fill="#5a7482" font-size="15" text-anchor="middle">A recolher amostras (aparece em breve)...</text>';
    if(bigEl) bigEl.textContent = '—';
    return;
  }

  const rangeLabel = { '24h': '24h', '3d': '3d', '7d': '7d' }[range] || range;
  if(bigEl){
    const peakFmt = formatDiff(peak);
    const bestWord = t('peak_diff_best_of');
    bigEl.innerHTML = `${peakFmt.value}${peakFmt.unit} <span class="peak-diff-unit">${bestWord} · ${rangeLabel}</span>`;
  }
  if(hc3dTry('chartPeakDiff', { buckets, range })) return;

  const w = 600, h = 170;
  const padL = 46, padR = 8, padT = 10, padB = 22;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  // escala logarítmica no eixo Y (os best diffs variam facilmente por 2-3
  // ordens de grandeza entre barras vizinhas)
  const values = buckets.map(b => Math.max(1, b.value));
  const maxV = Math.max(...values);
  const minV = Math.min(...values);
  const logMax = Math.log10(maxV * 1.15);
  const logMin = Math.log10(Math.max(1, minV) / 3);
  const logRange = (logMax - logMin) || 1;

  const yForVal = (v) => padT + plotH - ((Math.log10(Math.max(1, v)) - logMin) / logRange) * plotH;

  // ~5 linhas de grade / labels do eixo Y, espaçadas uniformemente na escala log
  const tickCount = 5;
  const gridLines = [];
  const yLabels = [];
  for(let i = 0; i < tickCount; i++){
    const logV = logMin + (logRange * i / (tickCount - 1));
    const v = Math.pow(10, logV);
    const y = yForVal(v);
    const fmt = formatDiff(v);
    gridLines.push(`<line x1="${padL}" y1="${y}" x2="${w-padR}" y2="${y}" stroke="#1c2b38" stroke-width="1"/>`);
    yLabels.push(`<text x="${padL-6}" y="${y+3}" fill="#5a7482" font-size="9" text-anchor="end">${fmt.value}${fmt.unit}</text>`);
  }

  const barW = buckets.length === 1 ? plotW * 0.12 : Math.max(1.5, (plotW / buckets.length) * 0.62);
  const step = plotW / buckets.length;
  const bars = buckets.map((b, i) => {
    const x = padL + i * step + (step - barW) / 2;
    const y = yForVal(b.value);
    const barH = Math.max(1, (padT + plotH) - y);
    const fmt = formatDiff(b.value);
    const valueLabel = `${fmt.value}${fmt.unit}`;
    // título nativo do SVG: aparece ao passar o rato mesmo sem JS de tooltip
    const titleEl = `<title>${valueLabel}</title>`;
    // label de texto só quando a barra é larga o suficiente para caber sem
    // se sobrepor às vizinhas; caso contrário fica só no <title> (hover)
    const canFitLabel = barW >= 26;
    const labelY = Math.max(padT + 9, y - 4);
    const labelEl = canFitLabel
      ? `<text x="${(x + barW/2).toFixed(1)}" y="${labelY.toFixed(1)}" fill="#ffd27a" font-size="9.5" font-weight="600" text-anchor="middle">${valueLabel}</text>`
      : '';
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" fill="#ffb020" fill-opacity="0.85" rx="1">${titleEl}</rect>${labelEl}`;
  }).join('');

  // labels de hora no eixo X — só ~6 para não sobrepor
  const xLabelCount = Math.min(6, buckets.length);
  const xLabels = [];
  for(let i = 0; i < xLabelCount; i++){
    const idx = xLabelCount > 1 ? Math.round(i * (buckets.length - 1) / (xLabelCount - 1)) : 0;
    const b = buckets[idx];
    const d = new Date(b.ts * 1000);
    const label = range === '24h'
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit' });
    const x = padL + idx * step + step / 2;
    xLabels.push(`<text x="${x.toFixed(1)}" y="${h-6}" fill="#5a7482" font-size="9" text-anchor="middle">${label}</text>`);
  }

  svg.innerHTML = `
    ${gridLines.join('')}
    ${yLabels.join('')}
    ${bars}
    ${xLabels.join('')}
  `;

  svg.onmousemove = null;
  svg.onmouseleave = null;
}

