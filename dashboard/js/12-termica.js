// ---------- Proteção Térmica / Alerta Crítico Contínuo ----------

function loadThermalProtectionSettings(){
  try {
    const res = localStorage.getItem(THERMAL_PROTECTION_KEY);
    if(res) thermalProtectionSettings = { ...thermalProtectionSettings, ...JSON.parse(res) };
  } catch(e){}
  const enabledEl = $('thermalProtectionEnabled');
  const tempEl = $('thermalProtectionTemp');
  const sustainEl = $('thermalProtectionSustain');
  if(enabledEl) enabledEl.checked = thermalProtectionSettings.enabled;
  if(tempEl) tempEl.value = thermalProtectionSettings.criticalTemp;
  if(sustainEl) sustainEl.value = thermalProtectionSettings.sustainSec;
}

function updateThermalShieldChip(){
  const chip = $('thermalShieldChip');
  if(!chip) return;
  const sp = thermalProtectionSettings;
  chip.className = 'th-chip ' + (sp.enabled ? 'on' : 'off');
  chip.textContent = sp.enabled ? mct('th_shield_on', sp.criticalTemp, sp.sustainSec) : t('th_shield_off');
}

function saveThermalProtectionSettings(){
  thermalProtectionSettings = {
    enabled: $('thermalProtectionEnabled').checked,
    criticalTemp: Number($('thermalProtectionTemp').value) || 90,
    sustainSec: Math.max(5, Number($('thermalProtectionSustain').value) || 45)
  };
  try { localStorage.setItem(THERMAL_PROTECTION_KEY, JSON.stringify(thermalProtectionSettings)); } catch(e){}
  updateThermalShieldChip();
  if(!thermalProtectionSettings.enabled){
    Object.keys(thermalCriticalState).forEach(id => { thermalCriticalState[id] = { since: null, alarmed: false }; });
    updateCriticalAlarmUI();
  }
}

function evaluateThermalProtection(dev, reading){
  if(!thermalCriticalState[dev.id]) thermalCriticalState[dev.id] = { since: null, alarmed: false };
  const state = thermalCriticalState[dev.id];
  const temp = reading.temp;

  if(!thermalProtectionSettings.enabled || temp == null || isNaN(temp)){
    state.since = null;
    if(state.alarmed){ state.alarmed = false; updateCriticalAlarmUI(); }
    return;
  }

  if(temp >= thermalProtectionSettings.criticalTemp){
    if(state.since == null) state.since = Date.now();
    const elapsedSec = (Date.now() - state.since) / 1000;
    if(elapsedSec >= thermalProtectionSettings.sustainSec && !state.alarmed){
      state.alarmed = true;
      criticalAlarmSilenced = false;
      logEvent(`🛡️🔥 CRÍTICO: temperatura sustentada em ${temp.toFixed(1)}°C durante ${Math.round(elapsedSec)}s — possível overheating.`, 'error', dev.name, dev.id);
      addNotification('critical', 'Overheating Crítico Detetado', `${dev.name} manteve-se a ${temp.toFixed(1)}°C (limite: ${thermalProtectionSettings.criticalTemp}°C) durante mais de ${thermalProtectionSettings.sustainSec}s. Verifica ventilação, pasta térmica e fluxo de ar.`, dev.name);
      updateCriticalAlarmUI();
    }
  } else {
    state.since = null;
    if(state.alarmed){
      state.alarmed = false;
      logEvent(`Temperatura normalizada (${temp.toFixed(1)}°C) — alerta crítico resolvido.`, 'new', dev.name, dev.id);
      updateCriticalAlarmUI();
    }
  }
}

function getActiveCriticalDevices(){
  return devices.filter(d => thermalCriticalState[d.id]?.alarmed);
}

function updateCriticalAlarmUI(){
  const active = getActiveCriticalDevices();
  const banner = $('criticalAlarmBanner');
  if(!banner) return;

  if(active.length === 0){
    banner.style.display = 'none';
    stopCriticalAlarmLoop();
    return;
  }

  const names = active.map(d => d.name).join(', ');
  $('criticalAlarmText').textContent =
    `TEMPERATURA CRÍTICA — ${names} acima de ${thermalProtectionSettings.criticalTemp}°C de forma contínua. Possível overheating.`;
  banner.style.display = 'flex';

  if(!criticalAlarmSilenced) startCriticalAlarmLoop();
}

function startCriticalAlarmLoop(){
  if(criticalAlarmIntervalId) return;
  playSound('critical');
  criticalAlarmIntervalId = setInterval(() => playSound('critical'), CRITICAL_ALARM_INTERVAL_MS);
}

function stopCriticalAlarmLoop(){
  if(criticalAlarmIntervalId){
    clearInterval(criticalAlarmIntervalId);
    criticalAlarmIntervalId = null;
  }
}

function silenceCriticalAlarm(){
  criticalAlarmSilenced = true;
  stopCriticalAlarmLoop();
}

// ---------- Impressão Digital Térmica / Manutenção Preditiva ----------

function loadThermalHistory(){
  try {
    const res = localStorage.getItem(THERMAL_KEY);
    if(res) thermalHistory = JSON.parse(res);
  } catch(e) { thermalHistory = {}; }
}

function saveThermalHistory(){
  try { localStorage.setItem(THERMAL_KEY, JSON.stringify(thermalHistory)); } catch(e){}
}

// ---------- Registo de Manutenções (limpeza / pasta térmica / troca de ventoinha) ----------
// Guarda, por máquina, um histórico de manutenções físicas feitas. Ao registar uma
// manutenção, o diagnóstico de saúde térmica e a previsão de desgaste passam a
// considerar apenas as amostras recolhidas depois dessa data, para que o baseline
// reflita o estado "pós-manutenção" em vez de misturar dados de antes e depois da limpeza.

function loadMaintenanceLog(){
  try {
    const res = localStorage.getItem(THERMAL_MAINT_KEY);
    if(res) maintenanceLog = JSON.parse(res);
  } catch(e) { maintenanceLog = {}; }
}

function saveMaintenanceLog(){
  try { localStorage.setItem(THERMAL_MAINT_KEY, JSON.stringify(maintenanceLog)); } catch(e){}
}

function getLastMaintenanceTime(devId){
  const arr = maintenanceLog[devId];
  if(!arr || !arr.length) return null;
  return arr[arr.length - 1].t;
}

function registerMaintenance(){
  const dev = devices.find(d => d.id === thermalSelectedId);
  if(!dev) return;

  const note = prompt(t('prompt_nota_manutencao'), t('nota_manutencao_default'));
  if(note === null) return; // utilizador cancelou o prompt

  const arr = maintenanceLog[dev.id] || (maintenanceLog[dev.id] = []);
  arr.push({ t: Date.now(), note: (note || '').trim() || t('nota_manutencao_default') });
  saveMaintenanceLog();

  logEvent(`🔧 Manutenção registada: ${arr[arr.length - 1].note}`, 'new', dev.name, dev.id);
  thermalAlertState[dev.id] = 'normal';
  renderThermalTab();
}

function removeMaintenanceEntry(devId, index){
  const arr = maintenanceLog[devId];
  if(!arr || !arr[index]) return;
  arr.splice(index, 1);
  saveMaintenanceLog();
  renderThermalTab();
}

function formatMaintDate(ts){
  const d = new Date(ts);
  const dateStr = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const today = new Date();
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  let suffix = '';
  if(d.toDateString() === today.toDateString()) suffix = ` (${t('hoje')})`;
  else if(d.toDateString() === yest.toDateString()) suffix = ` (${t('ontem')})`;
  return dateStr + suffix;
}

function renderMaintenancePanel(devId){
  const badgeWrap = $('maintLastBadgeWrap');
  const listEl = $('maintHistoryList');
  const countEl = $('maintHistoryCount');
  const btn = $('btnRegisterMaint');
  if(!badgeWrap || !listEl || !countEl) return;

  if(btn) btn.disabled = !devId;

  const arr = (devId && maintenanceLog[devId]) || [];

  if(!arr.length){
    badgeWrap.innerHTML = '';
    countEl.textContent = '0';
    listEl.innerHTML = `<div class="maint-history-empty">${t('sem_manutencoes_registadas')}</div>`;
    return;
  }

  const last = arr[arr.length - 1];
  badgeWrap.innerHTML = `<div class="maint-lastbadge">🔧 <span data-i18n="ultima_manutencao">${t('ultima_manutencao')}</span>: ${formatMaintDate(last.t)}</div>`;
  countEl.textContent = arr.length;

  listEl.innerHTML = arr.slice().reverse().map((entry) => {
    const realIndex = arr.indexOf(entry);
    return `
      <div class="maint-history-item">
        <span class="maint-date">${formatMaintDate(entry.t)}</span>
        <span class="maint-note">${entry.note}</span>
        <button class="btn-maint-remove" onclick="removeMaintenanceEntry('${devId}', ${realIndex})"><span data-i18n="remover">${t('remover')}</span></button>
      </div>
    `;
  }).join('');
}

// Regista periodicamente uma amostra de quanto "esforço" de ventilação (RPM por TH/s)
// a máquina precisou para manter o hashrate atual. É esta série ao longo de vários dias
// que permite detetar degradação de pasta térmica, pó nos dissipadores ou desgaste da ventoinha.
function recordThermalSnapshot(dev, reading){
  const hashTH = (reading.hashrate || 0) / 1000;
  if(hashTH <= 0 || reading.temp == null || isNaN(reading.temp)) return;

  const arr = thermalHistory[dev.id] || (thermalHistory[dev.id] = []);
  const now = Date.now();
  const last = arr[arr.length - 1];
  if(last && (now - last.t) < THERMAL_SNAPSHOT_INTERVAL_MS) return;

  const fanVal = reading.fanSpeed || 0;
  const effort = fanVal / hashTH; // "esforço de arrefecimento": ventoinha necessária por TH/s

  arr.push({ t: now, temp: reading.temp, fan: fanVal, hash: reading.hashrate, effort });
  if(arr.length > THERMAL_MAX_SNAPSHOTS) arr.splice(0, arr.length - THERMAL_MAX_SNAPSHOTS);
  saveThermalHistory();

  evaluateThermalHealth(dev);
  evaluateThermalForecast(dev, computeThermalForecast(dev.id));
}

// Compara o esforço de arrefecimento recente (últimas 24h) com a média histórica
// registada nos dias anteriores, para o mesmo dispositivo.
function computeThermalHealth(devId){
  const lastMaint = getLastMaintenanceTime(devId);
  const arr = (thermalHistory[devId] || []).filter(s => s.effort > 0 && isFinite(s.effort) && (!lastMaint || s.t > lastMaint));

  if(arr.length < THERMAL_MIN_BASELINE_SNAPSHOTS){
    return {
      status: 'collecting', changePct: null, baselineEffort: null, recentEffort: null,
      daysRecorded: arr.length ? (Date.now() - arr[0].t) / 86400000 : 0, points: arr
    };
  }

  const now = Date.now();
  const recent = arr.filter(s => (now - s.t) <= THERMAL_RECENT_WINDOW_MS);
  const baseline = arr.filter(s => (now - s.t) > THERMAL_RECENT_WINDOW_MS && (now - s.t) <= THERMAL_BASELINE_WINDOW_MS);

  // Se ainda não há histórico com mais de 24h, usa a 1ª metade das amostras como baseline
  // e a 2ª metade como "recente" (para começar a dar sinal mesmo no primeiro dia).
  const baseSet = baseline.length >= 8 ? baseline : arr.slice(0, Math.floor(arr.length / 2));
  const recentSet = recent.length >= 4 ? recent : arr.slice(Math.floor(arr.length / 2));

  const avg = list => list.reduce((s, x) => s + x.effort, 0) / list.length;
  const baselineEffort = avg(baseSet);
  const recentEffort = avg(recentSet);
  const changePct = ((recentEffort - baselineEffort) / baselineEffort) * 100;

  let status = 'normal';
  if(changePct >= THERMAL_CRIT_PCT) status = 'critical';
  else if(changePct >= THERMAL_WARN_PCT) status = 'warning';

  return { status, changePct, baselineEffort, recentEffort, daysRecorded: (now - arr[0].t) / 86400000, points: arr };
}

// Dispara notificação/alerta de manutenção preditiva apenas quando o estado piora
// (evita spam repetido a cada amostra enquanto o estado se mantém).
function evaluateThermalHealth(dev){
  const health = computeThermalHealth(dev.id);
  const prevStatus = thermalAlertState[dev.id] || 'normal';

  if(health.status !== prevStatus && (health.status === 'warning' || health.status === 'critical')){
    const pct = health.changePct.toFixed(0);
    const isCritical = health.status === 'critical';
    addNotification(
      isCritical ? 'thermal' : 'thermal-warning',
      `Manutenção Preditiva${isCritical ? ' — CRÍTICO' : ''}: possível degradação térmica`,
      `A ventilação necessária para manter o hashrate desta máquina subiu ${pct}% face à média histórica registada. Isto costuma indicar pasta térmica degradada, acumulação de pó no dissipador ou desgaste da ventoinha. Recomenda-se inspeção física antes de a máquina entrar em thermal throttling.`,
      dev.name
    );
    logEvent(`Alerta térmico preditivo${isCritical ? ' (crítico)' : ''}: ventilação +${pct}% vs histórico.`, isCritical ? 'error' : 'amber', dev.name, dev.id);
  }
  thermalAlertState[dev.id] = health.status;
  updateThermalBadge();
  return health;
}

// --- Simulador Preditivo de Desgaste e Thermal Throttle ---
// Ajusta uma reta de tendência (regressão linear pelos mínimos quadrados) à média
// diária do "esforço de arrefecimento" (ventoinha por TH/s) e projeta-a no tempo,
// para estimar com quantos dias de antecedência a máquina deverá atingir os limiares
// de "Atenção" e "Crítico" já usados no diagnóstico em tempo real, permitindo agendar
// limpeza/manutenção antes de o ASIC entrar em thermal throttling inesperado.
function computeThermalForecast(devId){
  const lastMaint = getLastMaintenanceTime(devId);
  const arr = (thermalHistory[devId] || []).filter(s => s.effort > 0 && isFinite(s.effort) && (!lastMaint || s.t > lastMaint));
  if(arr.length < THERMAL_MIN_BASELINE_SNAPSHOTS){
    return { status: 'collecting' };
  }

  // Agrupa por dia civil para suavizar o ciclo diário de temperatura ambiente/carga
  // e não deixar que o ruído de uma amostra isolada distorça a tendência.
  const dayMap = {};
  arr.forEach(s => {
    const dayKey = new Date(s.t).toDateString();
    (dayMap[dayKey] || (dayMap[dayKey] = [])).push(s.effort);
  });
  const dayKeys = Object.keys(dayMap).sort((a, b) => new Date(a) - new Date(b));
  if(dayKeys.length < THERMAL_FORECAST_MIN_DAYS){
    return { status: 'insufficient', daysRecorded: (Date.now() - arr[0].t) / 86400000 };
  }

  const firstDayTime = new Date(dayKeys[0]).getTime();
  const daily = dayKeys.map(k => {
    const vals = dayMap[k];
    return {
      dayIndex: (new Date(k).getTime() - firstDayTime) / 86400000,
      avg: vals.reduce((s, v) => s + v, 0) / vals.length
    };
  });

  const n = daily.length;
  const sumX = daily.reduce((s, d) => s + d.dayIndex, 0);
  const sumY = daily.reduce((s, d) => s + d.avg, 0);
  const sumXY = daily.reduce((s, d) => s + d.dayIndex * d.avg, 0);
  const sumXX = daily.reduce((s, d) => s + d.dayIndex * d.dayIndex, 0);
  const denom = (n * sumXX - sumX * sumX);
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;   // variação de esforço por dia
  const intercept = (sumY - slope * sumX) / n;

  // R² como medida de o quão bem a reta explica os dados diários (confiança da previsão).
  const meanY = sumY / n;
  let ssTot = 0, ssRes = 0;
  daily.forEach(d => {
    const predicted = slope * d.dayIndex + intercept;
    ssTot += (d.avg - meanY) ** 2;
    ssRes += (d.avg - predicted) ** 2;
  });
  const rSquared = ssTot > 0 ? Math.max(0, 1 - (ssRes / ssTot)) : 0;

  const health = computeThermalHealth(devId);
  const baseline = health.baselineEffort || daily[0].avg;
  const warnThreshold = baseline * (1 + THERMAL_WARN_PCT / 100);
  const critThreshold = baseline * (1 + THERMAL_CRIT_PCT / 100);

  const lastDayIndex = daily[daily.length - 1].dayIndex;
  const currentProjected = slope * lastDayIndex + intercept;

  let confidence = 'baixa';
  if(n >= 10 && rSquared >= 0.4) confidence = 'alta';
  else if(n >= 5) confidence = 'moderada';

  const daysUntil = (threshold) => {
    if(slope <= 0.0001) return null;               // sem tendência de degradação -> sem ETA
    if(currentProjected >= threshold) return 0;      // já ultrapassado
    return (threshold - currentProjected) / slope;
  };

  return {
    status: 'ok',
    slope, rSquared, confidence, daysRecorded: n, spanDays: lastDayIndex,
    baseline, warnThreshold, critThreshold, currentProjected,
    daysToWarn: daysUntil(warnThreshold),
    daysToCrit: daysUntil(critThreshold)
  };
}

function formatForecastEta(days){
  if(days == null) return null;
  const date = new Date(Date.now() + days * 86400000);
  return { days, label: days <= 0 ? 'agora' : days >= 365 ? `~${(days / 365).toFixed(1).replace('.', ',')} anos` : `~${Math.ceil(days)} dias`, date: date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) };
}

// Dispara (uma única vez por transição) uma notificação preditiva quando a janela
// de risco de throttle entra em THERMAL_FORECAST_ALERT_WINDOW dias, dando tempo
// para agendar a limpeza/manutenção com antecedência.
function evaluateThermalForecast(dev, forecast){
  const prev = thermalForecastAlertState[dev.id] || 'none';
  let level = 'none';
  if(forecast.status === 'ok'){
    if(forecast.daysToCrit != null && forecast.daysToCrit <= THERMAL_FORECAST_ALERT_WINDOW) level = 'crit';
    else if(forecast.daysToWarn != null && forecast.daysToWarn <= THERMAL_FORECAST_ALERT_WINDOW) level = 'warn';
  }

  if(level !== 'none' && level !== prev){
    const isCrit = level === 'crit';
    const eta = formatForecastEta(isCrit ? forecast.daysToCrit : forecast.daysToWarn);
    addNotification(
      isCrit ? 'thermal' : 'thermal-warning',
      `🔮 Previsão de Desgaste${isCrit ? ' — RISCO DE THROTTLE' : ''}`,
      `Ao ritmo atual de degradação térmica, esta máquina deverá atingir o limiar ${isCrit ? 'crítico (risco de thermal throttle)' : 'de atenção (recomenda-se limpeza)'} dentro de ${eta.label} (previsto para ${eta.date}). Considera agendar limpeza do dissipador/renovação da pasta térmica antes dessa data.`,
      dev.name
    );
    logEvent(`Previsão de desgaste: risco de ${isCrit ? 'throttle' : 'manutenção'} em ${eta.label} (${eta.date}).`, isCrit ? 'error' : 'amber', dev.name, dev.id);
  }
  thermalForecastAlertState[dev.id] = level;
}

function updateThermalBadge(){
  const badge = $('thermalBadge');
  const mini = $('thermalBadgeMini');
  const atRisk = devices.filter(d => {
    const s = thermalAlertState[d.id];
    return s === 'warning' || s === 'critical';
  }).length;
  if(atRisk > 0){
    if(badge){ badge.textContent = atRisk; badge.style.display = 'inline-block'; bumpBadge(badge, atRisk); }
    if(mini){ mini.textContent = atRisk; mini.style.display = 'inline-block'; bumpBadge(mini, atRisk); }
  } else {
    if(badge) badge.style.display = 'none';
    if(mini) mini.style.display = 'none';
  }
}

function miniSparklineSVG(vals){
  vals = (vals || []).filter(v => v != null);
  if(vals.length < 2){
    return '<svg class="ping-sparkline" viewBox="0 0 260 36"><text x="130" y="21" fill="#4a6975" font-size="9" text-anchor="middle">a recolher dados...</text></svg>';
  }
  const w = 260, h = 36, pad = 4;
  const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1;
  const pts = vals.map((v, i) => {
    const x = pad + i * ((w - pad*2) / (vals.length - 1));
    const y = h - pad - ((v - min) / range) * (h - pad*2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = pts[pts.length - 1].split(',');
  return `<svg class="ping-sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polyline points="${pts.join(' ')}" fill="none" stroke="#4fd6ff" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="3" fill="#4fd6ff" stroke="#0d1a26" stroke-width="1.5"/>
  </svg>`;
}

// qualidade da ligação ao pool: cor, etiqueta e classe
function pingQuality(ms){
  if(ms == null || isNaN(ms)) return { k: 'none', label: '—', color: '#4fd6ff' };
  if(ms < 50) return { k: 'great', label: t('lt_great'), color: '#21ffb0' };
  if(ms < 100) return { k: 'good', label: t('lt_good'), color: '#21ffb0' };
  if(ms < 250) return { k: 'warn', label: t('lt_warn'), color: '#ffb020' };
  return { k: 'bad', label: t('lt_bad'), color: '#ff5d5d' };
}

function renderPingTab(){
  const grid = $('pingGrid');
  if(!grid) return;

  if(!devices.length){
    grid.innerHTML = '<div class="ping-empty">Nenhuma máquina registada. Adiciona uma máquina no separador "Dashboard Geral".</div>';
    $('pingAvgAll').textContent = '—';
    $('pingBestAll').textContent = '—';
    $('pingWorstAll').textContent = '—';
    $('pingOnlineCount').textContent = '—';
    $('pingDetailName').textContent = '—';
    $('chartPing').innerHTML = '';
    $('valPingNow').textContent = '—';
    $('valPingAvg').textContent = '—';
    $('valPingMinMax').textContent = '—';
    return;
  }

  const livePings = [];
  grid.innerHTML = '';
  const withPing = devices.filter(d => readings[d.id] && readings[d.id].online && readings[d.id].poolPing != null).sort((a, b) => readings[a.id].poolPing - readings[b.id].poolPing);
  const rank = withPing.length >= 2 ? { fast: withPing[0].id, slow: withPing[withPing.length - 1].id } : {};

  devices.forEach(dev => {
    const r = readings[dev.id];
    const online = !!(r && r.online);
    const poolPing = online ? r.poolPing : null;
    const poolLoss = online ? r.poolLoss : null;
    const localLat = online ? r.localLatency : null;
    if(online && poolPing != null) livePings.push(poolPing);

    const q = pingQuality(online ? poolPing : null);
    const card = document.createElement('div');
    card.className = 'ping-card q-' + (online ? q.k : 'down') + (dev.id === selectedId ? ' selected' : '') + (!online ? ' offline' : '');

    const riskClass = online && poolPing != null ? getLatencyRiskClass(poolPing) : (online ? '' : 'risk-red');
    const valueHtml = online && poolPing != null ? poolPing.toFixed(2) : (online ? t('lt_nd') : '—');
    const series = (histories[dev.id] || []).map(x => x && x.poolPing).filter(v => v != null && isFinite(v)).slice(-80);
    const spark = thermalSpark(series, q.color);
    const rng = series.length > 3 ? mct('lt_range', Math.min(...series).toFixed(0), Math.max(...series).toFixed(0)) : '';
    const lossCls = poolLoss == null ? '' : poolLoss >= 2 ? 'bad' : poolLoss >= 0.5 ? 'warn' : 'ok';
    const gaugeHtml = online && poolPing != null
      ? `<div class="thermal-gauge ping-gauge"><i class="z ok" style="width:${100 / 300 * 100}%"></i><i class="z warn" style="width:${150 / 300 * 100}%"></i><i class="z crit"></i><b class="mk q-${q.k}" style="left:${(Math.min(300, poolPing) / 300 * 100).toFixed(1)}%"></b></div>` : '';

    card.innerHTML = `
      <div class="ping-card-head">
        <div>
          <div class="name">${dev.name}</div>
          <div class="ip">${dev.ip}</div>
        </div>
        <div class="ping-status ${online ? 'up' : 'down'}">
          <span class="pdot"></span>${online ? 'Online' : 'Offline'}
        </div>
      </div>
      <div class="ping-value-row">
        <span class="ping-value ${riskClass}">${valueHtml}</span>
        <span class="ping-unit">${online && poolPing != null ? t('lt_unit') : ''}</span>
        ${online && poolPing != null ? `<span class="ping-q q-${q.k}">${q.label}</span>` : ''}
      </div>
      ${gaugeHtml}
      ${spark}
      <div class="ping-range">${rng}</div>
      <div class="ping-stats-mini">
        <span class="ping-loss ${lossCls}">${t('lt_loss')}: ${online && poolLoss != null ? poolLoss.toFixed(2) + '%' : '—'}</span>
        <span>${t('lt_local')}: ${online && localLat != null ? localLat + ' ms' : '—'}</span>
      </div>
      ${rank.fast === dev.id ? `<div class="ping-tag fast">${t('lt_fast')}</div>` : rank.slow === dev.id ? `<div class="ping-tag slow">${t('lt_slow')}</div>` : ''}
    `;
    card.onclick = () => { selectedId = dev.id; renderPingTab(); renderAll(); };
    grid.appendChild(card);
  });

  if(livePings.length){
    const avg = livePings.reduce((a,b) => a+b, 0) / livePings.length;
    $('pingAvgAll').textContent = `${avg.toFixed(2)} ms`;
    $('pingBestAll').textContent = `${Math.min(...livePings).toFixed(2)} ms`;
    $('pingWorstAll').textContent = `${Math.max(...livePings).toFixed(2)} ms`;
  } else {
    $('pingAvgAll').textContent = '—';
    $('pingBestAll').textContent = '—';
    $('pingWorstAll').textContent = '—';
  }
  $('pingOnlineCount').textContent = `${devices.filter(d => readings[d.id]?.online).length} / ${devices.length}`;
  const tone = (id, v) => { const el = $(id) && $(id).closest('.ping-summary-card'); if(el) el.dataset.tone = v; };
  const tn = ms => ms == null ? 'none' : ms < 100 ? 'ok' : ms < 250 ? 'warn' : 'bad';
  tone('pingAvgAll', livePings.length ? tn(livePings.reduce((a, b) => a + b, 0) / livePings.length) : 'none');
  tone('pingBestAll', livePings.length ? tn(Math.min(...livePings)) : 'none');
  tone('pingWorstAll', livePings.length ? tn(Math.max(...livePings)) : 'none');
  const onl = devices.filter(d => readings[d.id]?.online).length;
  tone('pingOnlineCount', !devices.length ? 'none' : onl === devices.length ? 'ok' : onl ? 'warn' : 'bad');

  const selDev = devices.find(d => d.id === selectedId) || devices[0];
  if(selDev){
    $('pingDetailName').textContent = `${selDev.name} (${selDev.ip})`;
    drawPingChart('chartPing', (histories[selDev.id] || []).map(x => x && x.poolPing), (histories[selDev.id] || []).map(x => x && x.ts));
  } else {
    $('pingDetailName').textContent = '—';
    $('chartPing').innerHTML = '';
  }
}

