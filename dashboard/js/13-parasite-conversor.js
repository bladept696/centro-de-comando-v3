// --- Parasite Pool (parasite.wtf / parasite.space) — dados oficiais --------
// Mostra o hashrate, dificuldade e ranking reportados pela própria pool para
// o endereço Bitcoin configurado, cruzados com o hashrate lido localmente
// das máquinas (elemento #sHashrate do Dashboard Geral). O pedido HTTP é
// feito ao endpoint local /api/parasite-stats (implementado em app.py), que
// por sua vez consulta a API pública da Parasite Pool — isto evita problemas
// de CORS ao chamar parasite.space diretamente a partir do browser.
const PARASITE_ADDRESS_KEY = 'nerdqaxe:parasite-address';
let parasiteStatsTimer = null;

function loadParasiteAddress(){
  try { return localStorage.getItem(PARASITE_ADDRESS_KEY) || ''; } catch(e){ return ''; }
}

function saveParasiteAddress(){
  const input = $('parasiteAddressInput');
  if(!input) return;
  const addr = input.value.trim();
  try { localStorage.setItem(PARASITE_ADDRESS_KEY, addr); } catch(e){}
  fetchParasiteStats(true);
  fetchParasiteRefinery(true);
}

function renderParasiteSection(){
  const input = $('parasiteAddressInput');
  const addr = loadParasiteAddress();
  if(input && !input.value) input.value = addr;
  fetchParasiteStats(false);
  fetchParasiteRefinery(false);
  if(!parasiteStatsTimer){
    parasiteStatsTimer = setInterval(() => { fetchParasiteStats(false); fetchParasiteRefinery(false); }, 60000);
  }
}

async function fetchParasiteStats(forceUi){
  const addr = loadParasiteAddress();
  const emptyHint = $('parasiteEmptyHint');
  const statsRow = $('parasiteStatsRow');
  const compareHint = $('parasiteCompareHint');
  const errorHint = $('parasiteErrorHint');
  if(!emptyHint || !statsRow) return;

  if(!addr){
    emptyHint.style.display = '';
    statsRow.style.display = 'none';
    compareHint.style.display = 'none';
    errorHint.style.display = 'none';
    return;
  }

  emptyHint.style.display = 'none';
  errorHint.style.display = 'none';
  if(forceUi){
    statsRow.style.display = 'none';
    errorHint.style.display = '';
    errorHint.style.color = 'var(--muted)';
    errorHint.textContent = t('parasite_a_carregar');
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    let res;
    try {
      res = await fetch(`${API_BASE}/api/parasite-stats?address=${encodeURIComponent(addr)}`, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    if(!res.ok) throw new Error('bad status');
    const data = await res.json();
    if(data.error) throw new Error(data.error);

    $('parasiteHashrate').textContent = data.hashrate_formatted || (data.hashrate_ths != null ? `${data.hashrate_ths.toFixed(2)} TH/s` : '—');
    $('parasiteBestDiff').textContent = (data.best_difficulty != null ? (() => { const fmt = formatDiff(data.best_difficulty); return `${fmt.value}${fmt.unit}`; })() : (data.best_difficulty_formatted || '—'));
    $('parasiteWorkers').textContent = data.workers_count != null ? data.workers_count : '—';
    $('parasiteRank').textContent = data.rank != null ? `#${data.rank}` : '—';
    $('parasitePoolHashrate').textContent = data.pool_hashrate_formatted || (data.pool_hashrate_phs != null ? `${data.pool_hashrate_phs.toFixed(2)} PH/s` : '—');
    $('parasiteUpdatedAt').textContent = `${t('atualizado_as')} ${new Date().toLocaleTimeString()}`;

    const localHashText = ($('sHashrate')?.textContent || '').trim();
    const localUnit = ($('sHashrateUnit')?.textContent || '').trim();
    if(localHashText && localHashText !== '—'){
      compareHint.style.display = '';
      compareHint.textContent = `${t('parasite_comparacao')} ${localHashText} ${localUnit}`;
    } else {
      compareHint.style.display = 'none';
    }

    statsRow.style.display = '';
    errorHint.style.display = 'none';
  } catch(e){
    statsRow.style.display = 'none';
    compareHint.style.display = 'none';
    errorHint.style.display = '';
    errorHint.style.color = 'var(--red)';
    if(e.name === 'AbortError'){
      errorHint.textContent = t('parasite_erro_timeout');
    } else if(e.message && e.message !== 'bad status'){
      errorHint.textContent = `${t('parasite_erro')} — ${e.message}`;
    } else {
      errorHint.textContent = t('parasite_erro');
    }
  }
}

// --- Refinery (mercado de aluguer de hashrate da Parasite Pool, beta) ------
function refineryStatusClass(status){
  const s = (status || '').toLowerCase();
  if(s === 'fulfilled') return 'status-fulfilled';
  if(s === 'expired') return 'status-expired';
  if(s === 'active' || s === 'pending' || s === 'open') return 'status-active';
  return '';
}

function renderRefineryOrders(orders){
  const body = $('refineryOrdersBody');
  const emptyOrdersHint = $('refineryEmptyOrdersHint');
  if(!body) return;
  body.innerHTML = '';
  if(!orders || orders.length === 0){
    if(emptyOrdersHint) emptyOrdersHint.style.display = '';
    return;
  }
  if(emptyOrdersHint) emptyOrdersHint.style.display = 'none';

  orders.forEach(o => {
    const tr = document.createElement('tr');
    const pct = (o.progress_pct != null) ? Math.max(0, Math.min(100, o.progress_pct)) : 0;
    const statusClass = refineryStatusClass(o.status);
    tr.innerHTML = `
      <td>${o.id != null ? o.id : '—'}</td>
      <td><span class="refinery-status ${statusClass}">${o.status || '—'}</span></td>
      <td>${o.requested_formatted || '—'}</td>
      <td>${o.hashrate || '0 H/s'}</td>
      <td>${o.best_share_formatted || '—'}</td>
      <td>
        <div class="refinery-progress-track">
          <div class="refinery-progress-fill" style="width:${pct}%;"></div>
        </div>
      </td>
    `;
    body.appendChild(tr);
  });
}

async function fetchParasiteRefinery(forceUi){
  const addr = loadParasiteAddress();
  const emptyHint = $('refineryEmptyHint');
  const content = $('refineryContent');
  const errorHint = $('refineryErrorHint');
  if(!emptyHint || !content) return;

  if(!addr){
    emptyHint.style.display = '';
    content.style.display = 'none';
    errorHint.style.display = 'none';
    return;
  }

  emptyHint.style.display = 'none';
  errorHint.style.display = 'none';
  if(forceUi){
    errorHint.style.display = '';
    errorHint.style.color = 'var(--muted)';
    errorHint.textContent = t('parasite_a_carregar');
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    let res;
    try {
      res = await fetch(`${API_BASE}/api/parasite-refinery?address=${encodeURIComponent(addr)}${forceUi ? '&force=1' : ''}`, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    if(!res.ok) throw new Error('bad status');
    const data = await res.json();
    if(data.error) throw new Error(data.error);

    $('refineryCapacity').textContent = data.capacity_formatted || (data.capacity_ehd != null ? `${data.capacity_ehd.toFixed(2)} EHd` : '—');
    $('refineryUsed').textContent = data.used_formatted || (data.used_phd != null ? `${data.used_phd.toFixed(1)} PHd` : '—');
    $('refineryHashprice').textContent = data.hashprice_formatted || '—';
    $('refineryUpdatedAt').textContent = `${t('atualizado_as')} ${new Date().toLocaleTimeString()}`;
    renderRefineryOrders(data.orders);

    content.style.display = '';
    errorHint.style.display = 'none';
  } catch(e){
    content.style.display = 'none';
    errorHint.style.display = '';
    errorHint.style.color = 'var(--red)';
    if(e.name === 'AbortError'){
      errorHint.textContent = t('parasite_erro_timeout');
    } else if(e.message && e.message !== 'bad status'){
      errorHint.textContent = `${t('parasite_erro')} — ${e.message}`;
    } else {
      errorHint.textContent = t('parasite_erro');
    }
  }
}

function drawPingChart(svgId, vals){
  const svg = $(svgId);
  vals = (vals || []).filter(v => v != null);

  if(vals.length < 2){
    svg.innerHTML = '<text x="50%" y="50%" fill="#4a6975" font-size="11" text-anchor="middle">A aguardar dados em tempo real (ou este pool não reporta ping)...</text>';
    $('valPingNow').textContent = '—';
    $('valPingAvg').textContent = '—';
    $('valPingMinMax').textContent = '—';
    return;
  }

  let min = Math.min(...vals), max = Math.max(...vals), range = (max-min) || 1;
  const avg = vals.reduce((a,b) => a+b, 0) / vals.length;
  const latest = vals[vals.length - 1];

  $('valPingNow').textContent = `${latest.toFixed(2)} ms`;
  $('valPingAvg').textContent = `${avg.toFixed(2)} ms`;
  $('valPingMinMax').textContent = `${min.toFixed(2)} / ${max.toFixed(2)} ms`;

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

  svg.innerHTML = `
    <defs>
      <linearGradient id="cyan_grad_${svgId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4fd6ff" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#4fd6ff" stop-opacity="0.0"/>
      </linearGradient>
      <filter id="glow_${svgId}" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" result="glow" />
        <feComposite in="SourceGraphic" in2="glow" operator="over" />
      </filter>
    </defs>

    <line x1="10" y1="${avgY}" x2="290" y2="${avgY}" stroke="#4fd6ff66" stroke-dasharray="4,4" stroke-width="1"/>
    <path d="M${pts[0].x},${h} L${ptsString} L${pts[pts.length-1].x},${h} Z" fill="url(#cyan_grad_${svgId})"></path>
    <path fill="none" stroke="#4fd6ff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" filter="url(#glow_${svgId})" d="M${ptsString}"></path>
    <circle cx="${lastPt.x}" cy="${lastPt.y}" r="4.5" fill="#4fd6ff" stroke="#0d1a26" stroke-width="2"/>

    <g id="tooltip_${svgId}" style="display:none;">
      <line x1="0" y1="0" x2="0" y2="${h}" stroke="#4fd6ff88" stroke-dasharray="3,3" stroke-width="1"></line>
      <circle r="4" fill="#4fd6ff" stroke="#060d14" stroke-width="2"></circle>
    </g>
  `;

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
      const res = closest.val;
      $('valPingNow').textContent = `${res.toFixed(2)} ms`;
    }
  };

  svg.onmouseleave = () => {
    const tip = svg.querySelector(`#tooltip_${svgId}`);
    if(tip) tip.style.display = 'none';
    $('valPingNow').textContent = `${vals[vals.length - 1].toFixed(2)} ms`;
  };
}

function renderOcTab(){
  const grid = $('ocGrid');
  if(!grid) return;

  if(!devices.length){
    grid.innerHTML = '<div class="oc-empty" data-i18n="nenhuma_maquina_registada_dashboard">Nenhuma máquina registada. Adiciona uma máquina no separador "Dashboard Geral".</div>';
    if(typeof applyTranslations === 'function') applyTranslations();
    return;
  }

  grid.innerHTML = '';
  devices.forEach(dev => {
    const r = readings[dev.id];
    const online = !!(r && r.online);
    const curFreq = r?.frequency ? `${r.frequency} MHz` : '—';
    const curVolt = r?.coreVoltage != null ? `${r.coreVoltage} mV` : '—';

    const card = document.createElement('div');
    card.className = 'oc-card' + (online ? '' : ' offline');
    card.innerHTML = `
      <div class="oc-card-head">
        <div>
          <div class="name">${escapeHtml(dev.name)}</div>
          <div class="ip">${escapeHtml(dev.ip)}</div>
        </div>
        <div class="oc-card-current">
          <div><span data-i18n="atual_freq">atual:</span> <b>${curFreq}</b></div>
          <div><span data-i18n="atual_volt">atual:</span> <b>${curVolt}</b></div>
        </div>
      </div>
      <div class="oc-field-row">
        <div class="oc-field">
          <label data-i18n="frequencia_mhz">Frequência (MHz)</label>
          <input type="number" class="oc-freq-input" placeholder="ex: 550" value="${r?.frequency ? r.frequency : ''}">
        </div>
        <div class="oc-field">
          <label data-i18n="corevoltage_mv">CoreVoltage (mV)</label>
          <input type="number" class="oc-volt-input" placeholder="ex: 1150" value="${r?.coreVoltage != null ? r.coreVoltage : ''}">
        </div>
      </div>
      <div class="oc-card-actions">
        <button class="oc-btn-save" data-i18n="guardar">Guardar</button>
        <button class="oc-btn-restart" data-i18n="reiniciar">Reiniciar</button>
      </div>
      <div class="oc-card-status"></div>
    `;

    const freqInput = card.querySelector('.oc-freq-input');
    const voltInput = card.querySelector('.oc-volt-input');
    const saveBtn = card.querySelector('.oc-btn-save');
    const restartBtn = card.querySelector('.oc-btn-restart');
    const statusEl = card.querySelector('.oc-card-status');

    saveBtn.onclick = async () => {
      const freq = freqInput.value.trim();
      const volt = voltInput.value.trim();
      if(!freq && !volt){
        statusEl.className = 'oc-card-status err';
        statusEl.textContent = t('indica_pelo_menos_um_valor');
        return;
      }
      saveBtn.disabled = true; restartBtn.disabled = true;
      statusEl.className = 'oc-card-status';
      statusEl.textContent = t('a_guardar') + '...';
      const payload = { ip: dev.ip };
      if(freq) payload.frequency = Number(freq);
      if(volt) payload.coreVoltage = Number(volt);
      try {
        const resp = await fetch(`${API_BASE}/api/apply-profile`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if(!resp.ok || data.error) throw new Error(data.error || 'falha');
        statusEl.className = 'oc-card-status ok';
        statusEl.textContent = t('definicoes_aplicadas');
        logEvent(`Novas definições OC aplicadas em "${dev.name}".`, 'edit', dev.name, dev.id);
      } catch(e){
        statusEl.className = 'oc-card-status err';
        statusEl.textContent = t('erro_ao_aplicar_definicoes') + (e.message ? ` (${e.message})` : '');
      } finally {
        saveBtn.disabled = false; restartBtn.disabled = false;
      }
    };

    restartBtn.onclick = async () => {
      saveBtn.disabled = true; restartBtn.disabled = true;
      statusEl.className = 'oc-card-status';
      statusEl.textContent = t('a_reiniciar') + '...';
      try {
        const resp = await fetch(`${API_BASE}/api/restart-machine`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ ip: dev.ip })
        });
        const data = await resp.json();
        if(!resp.ok || data.error) throw new Error(data.error || 'falha');
        statusEl.className = 'oc-card-status ok';
        statusEl.textContent = t('maquina_a_reiniciar');
        logEvent(`Reinício enviado para "${dev.name}".`, 'edit', dev.name, dev.id);
      } catch(e){
        statusEl.className = 'oc-card-status err';
        statusEl.textContent = t('erro_ao_reiniciar') + (e.message ? ` (${e.message})` : '');
      } finally {
        saveBtn.disabled = false; restartBtn.disabled = false;
      }
    };

    grid.appendChild(card);
  });

  if(typeof applyTranslations === 'function') applyTranslations();
}

// --- Conversor de moedas (BTC/EUR/USDT via Binance) ---
let currentRates = { btc_eur: null, btc_usdt: null, updated: null };
let ratesRefreshTimer = null;
let converterListenersWired = false;
let convertingLock = false;
let btcUnit = 'btc'; // 'btc' ou 'sats'
let btcCanonical = null; // valor em BTC "cheio", independente da unidade mostrada

function fmtCurrency(v, decimals){
  return Number(v).toLocaleString('pt-PT', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
}

function renderRates(){
  $('rateBtcEur').textContent = currentRates.btc_eur != null ? `${fmtCurrency(currentRates.btc_eur, 2)} €` : '—';
  $('rateBtcUsdt').textContent = currentRates.btc_usdt != null ? `${fmtCurrency(currentRates.btc_usdt, 2)} $` : '—';
  if(currentRates.btc_eur && currentRates.btc_usdt){
    const eurUsdt = currentRates.btc_usdt / currentRates.btc_eur;
    $('rateEurUsdt').textContent = `${fmtCurrency(eurUsdt, 4)} $`;
  } else {
    $('rateEurUsdt').textContent = '—';
  }
  const upd = $('ratesUpdatedAt');
  if(upd){
    upd.textContent = currentRates.updated
      ? `${t('atualizado_as')} ${new Date(currentRates.updated * 1000).toLocaleTimeString('pt-PT')}`
      : '';
  }
}

async function fetchRates(force){
  const errEl = $('converterError');
  try {
    const res = await fetch(`${API_BASE}/api/rates${force ? '?force=1' : ''}`);
    const data = await res.json();
    if(data.btc_eur == null || data.btc_usdt == null){
      errEl.textContent = t('erro_ao_obter_cotacoes') + (data.error ? ` (${data.error})` : '');
      return;
    }
    errEl.textContent = '';
    currentRates = data;
    renderRates();
  } catch(e){
    errEl.textContent = t('erro_de_ligacao_cotacoes') + (e.message ? ` (${e.message})` : '');
  }
}

function startRatesAutoRefresh(){
  stopRatesAutoRefresh();
  ratesRefreshTimer = setInterval(() => fetchRates(false), 30000);
  // Mesmo sem novos recordes, atualiza o "há Xm" do último recorde no painel Best Diff.
  setInterval(renderBestDiffPanel, 5000);
}
function stopRatesAutoRefresh(){
  if(ratesRefreshTimer){ clearInterval(ratesRefreshTimer); ratesRefreshTimer = null; }
}

function wireConverterInputs(){
  if(converterListenersWired) return;
  converterListenersWired = true;
  const btcEl = $('convBtcInput'), eurEl = $('convEurInput'), usdtEl = $('convUsdtInput');

  const formatBtcForDisplay = (amount) => {
    if(amount == null || isNaN(amount)) return '';
    return btcUnit === 'sats' ? String(Math.round(amount * 1e8)) : amount.toFixed(8);
  };
  const parseBtcFromInput = (value) => {
    if(value === '' || value == null) return null;
    const num = parseFloat(value);
    if(isNaN(num)) return null;
    return btcUnit === 'sats' ? num / 1e8 : num;
  };

  btcEl.addEventListener('input', () => {
    if(convertingLock) return;
    const btc = parseBtcFromInput(btcEl.value);
    btcCanonical = btc;
    if(!currentRates.btc_eur || !currentRates.btc_usdt) return;
    convertingLock = true;
    if(btc != null){
      eurEl.value = (btc * currentRates.btc_eur).toFixed(2);
      usdtEl.value = (btc * currentRates.btc_usdt).toFixed(2);
    } else {
      eurEl.value = ''; usdtEl.value = '';
    }
    convertingLock = false;
  });

  eurEl.addEventListener('input', () => {
    if(convertingLock || !currentRates.btc_eur || !currentRates.btc_usdt) return;
    convertingLock = true;
    const eur = parseFloat(eurEl.value);
    if(!isNaN(eur)){
      const btc = eur / currentRates.btc_eur;
      btcCanonical = btc;
      btcEl.value = formatBtcForDisplay(btc);
      usdtEl.value = (btc * currentRates.btc_usdt).toFixed(2);
    } else {
      btcCanonical = null;
      btcEl.value = ''; usdtEl.value = '';
    }
    convertingLock = false;
  });

  usdtEl.addEventListener('input', () => {
    if(convertingLock || !currentRates.btc_eur || !currentRates.btc_usdt) return;
    convertingLock = true;
    const usdt = parseFloat(usdtEl.value);
    if(!isNaN(usdt)){
      const btc = usdt / currentRates.btc_usdt;
      btcCanonical = btc;
      btcEl.value = formatBtcForDisplay(btc);
      eurEl.value = (btc * currentRates.btc_eur).toFixed(2);
    } else {
      btcCanonical = null;
      btcEl.value = ''; eurEl.value = '';
    }
    convertingLock = false;
  });

  document.querySelectorAll('.btc-unit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newUnit = btn.dataset.unit;
      if(newUnit === btcUnit) return;
      btcUnit = newUnit;
      document.querySelectorAll('.btc-unit-btn').forEach(b => b.classList.toggle('active', b === btn));
      $('btcUnitLabel').textContent = btcUnit === 'sats' ? 'SATS' : 'BTC';
      btcEl.placeholder = btcUnit === 'sats' ? '0' : '0.00000000';
      convertingLock = true;
      btcEl.value = formatBtcForDisplay(btcCanonical);
      convertingLock = false;
    });
  });
}

function initConverterTab(){
  wireConverterInputs();
  fetchRates(false);
  startRatesAutoRefresh();
}

function renderThermalTab(){
  const grid = $('thermalGrid');
  if(!grid) return;

  if(!devices.length){
    grid.innerHTML = '<div class="ping-empty">Nenhuma máquina registada. Adiciona uma máquina no separador "Dashboard Geral".</div>';
    $('thermalAtRisk').textContent = '—';
    $('thermalWorst').textContent = '—';
    $('thermalMinDays').textContent = '—';
    $('thermalTracked').textContent = '—';
    $('thermalDetailName').textContent = '—';
    $('chartThermal').innerHTML = '';
    $('valThermalNow').textContent = '—';
    $('valThermalBaseline').textContent = '—';
    $('valThermalChange').textContent = '—';
    $('valThermalDays').textContent = '—';
    renderMaintenancePanel(null);
    return;
  }

  grid.innerHTML = '';
  let atRisk = 0, worstPct = null, minDays = null, tracked = 0, soonestEta = null;

  devices.forEach(dev => {
    const health = computeThermalHealth(dev.id);
    const forecast = computeThermalForecast(dev.id);
    const r = readings[dev.id];
    const online = !!(r && r.online);

    if(health.status !== 'collecting'){
      tracked++;
      if(health.status === 'warning' || health.status === 'critical') atRisk++;
      if(worstPct === null || health.changePct > worstPct) worstPct = health.changePct;
    }
    if(health.points.length){
      if(minDays === null || health.daysRecorded < minDays) minDays = health.daysRecorded;
    }
    if(forecast.status === 'ok'){
      const eta = forecast.daysToCrit != null ? forecast.daysToCrit : forecast.daysToWarn;
      if(eta != null && (soonestEta === null || eta < soonestEta.days)){
        soonestEta = { days: eta, dev, critical: forecast.daysToCrit != null };
      }
    }

    let badgeClass = 'status-collecting', badgeLabel = '🧬 A recolher dados';
    if(health.status === 'normal'){ badgeClass = 'status-normal'; badgeLabel = '✅ Normal'; }
    else if(health.status === 'warning'){ badgeClass = 'status-warning'; badgeLabel = '⚠️ Atenção'; }
    else if(health.status === 'critical'){ badgeClass = 'status-critical'; badgeLabel = '🔴 Crítico'; }

    const changeLabel = health.changePct != null ? `${health.changePct >= 0 ? '+' : ''}${health.changePct.toFixed(1)}%` : '—';
    const spark = miniSparklineSVG(health.points.map(p => p.effort));

    // Linha de previsão (ETA para limiar de atenção/crítico) mostrada em cada cartão.
    let fcClass = 'fc-collecting', fcText = '🔮 A recolher dados para previsão...';
    if(forecast.status === 'insufficient'){
      fcText = '🔮 Ainda sem dias suficientes para tendência';
    } else if(forecast.status === 'ok'){
      if(forecast.daysToCrit != null){
        fcClass = 'fc-crit';
        const eta = formatForecastEta(forecast.daysToCrit);
        fcText = `🔮 Risco de throttle em ${eta.label} (${eta.date})`;
      } else if(forecast.daysToWarn != null){
        fcClass = 'fc-warn';
        const eta = formatForecastEta(forecast.daysToWarn);
        fcText = `🔮 Limpeza recomendada em ${eta.label} (${eta.date})`;
      } else {
        fcClass = 'fc-stable';
        fcText = '🔮 Sem degradação — sem manutenção prevista';
      }
    }

    const card = document.createElement('div');
    card.className = 'thermal-card' + (dev.id === thermalSelectedId ? ' selected' : '') + (!online ? ' offline' : '');
    card.innerHTML = `
      <div class="thermal-card-head">
        <div>
          <div class="name">${dev.name}</div>
          <div class="ip">${dev.ip}</div>
        </div>
        <div class="thermal-badge ${badgeClass}">${badgeLabel}</div>
      </div>
      <div class="thermal-value-row">
        <span class="thermal-value ${badgeClass}">${changeLabel}</span>
        <span class="thermal-unit">vs baseline histórico</span>
      </div>
      ${spark}
      <div class="thermal-stats-mini">
        <span>${online && r.temp != null ? `Temp: ${r.temp.toFixed(1)}°C` : 'Temp: —'}</span>
        <span>${online ? `Ventoinha: ${(r.fanSpeed || 0).toFixed(0)}` : 'Ventoinha: —'}</span>
      </div>
      <div class="thermal-forecast-line ${fcClass}">${fcText}</div>
    `;
    card.onclick = () => { thermalSelectedId = dev.id; renderThermalTab(); };
    grid.appendChild(card);
  });

  $('thermalAtRisk').textContent = tracked ? `${atRisk} / ${tracked}` : '—';
  $('thermalWorst').textContent = worstPct !== null ? `${worstPct >= 0 ? '+' : ''}${worstPct.toFixed(1)}%` : '—';
  $('thermalMinDays').textContent = minDays !== null ? `${minDays.toFixed(1)} dias` : '—';
  $('thermalTracked').textContent = `${tracked} / ${devices.length}`;
  $('thermalNextEta').textContent = soonestEta
    ? `${Math.ceil(soonestEta.days)}d — ${soonestEta.dev.name}`
    : '—';

  if(!thermalSelectedId || !devices.find(d => d.id === thermalSelectedId)){
    thermalSelectedId = devices[0]?.id || null;
  }
  const selDev = devices.find(d => d.id === thermalSelectedId);
  if(selDev){
    const health = computeThermalHealth(selDev.id);
    $('thermalDetailName').textContent = `${selDev.name} (${selDev.ip})`;
    drawThermalChart('chartThermal', health.points, health.status);
    $('valThermalBaseline').textContent = health.baselineEffort != null ? health.baselineEffort.toFixed(2) : '—';
    $('valThermalChange').textContent = health.changePct != null ? `${health.changePct >= 0 ? '+' : ''}${health.changePct.toFixed(1)}%` : '—';
    $('valThermalDays').textContent = health.points.length ? `${health.daysRecorded.toFixed(1)} dias (${health.points.length} amostras)` : '—';
    renderMaintenancePanel(selDev.id);
  } else {
    $('thermalDetailName').textContent = '—';
    $('chartThermal').innerHTML = '';
    $('valThermalNow').textContent = '—';
    $('valThermalBaseline').textContent = '—';
    $('valThermalChange').textContent = '—';
    $('valThermalDays').textContent = '—';
    renderMaintenancePanel(null);
  }

  renderForecastBody(selDev);
}

function renderForecastBody(selDev){
  const body = $('forecastBody');
  if(!body) return;

  if(!selDev){
    body.innerHTML = '<div class="ping-empty">Sem máquina selecionada.</div>';
    return;
  }

  const forecast = computeThermalForecast(selDev.id);

  if(forecast.status === 'collecting'){
    body.innerHTML = `<div class="ping-empty">🔮 A recolher amostras de ${selDev.name}... a previsão fica disponível assim que houver dados suficientes para um diagnóstico inicial (~12h de funcionamento).</div>`;
    return;
  }
  if(forecast.status === 'insufficient'){
    body.innerHTML = `<div class="ping-empty">🔮 ${selDev.name} tem ${forecast.daysRecorded.toFixed(1)} dia(s) de dados. São precisos pelo menos ${THERMAL_FORECAST_MIN_DAYS} dias civis distintos para ajustar uma tendência fiável.</div>`;
    return;
  }

  const warnEta = formatForecastEta(forecast.daysToWarn);
  const critEta = formatForecastEta(forecast.daysToCrit);
  const trendLabel = forecast.slope > 0.0001
    ? `+${forecast.slope.toFixed(3)} / dia (a degradar)`
    : (forecast.slope < -0.0001 ? `${forecast.slope.toFixed(3)} / dia (a melhorar)` : 'estável');

  body.innerHTML = `
    <div class="forecast-grid">
      <div class="forecast-eta-card ${warnEta ? 'fc-warn' : ''}">
        <div class="forecast-eta-label">⚠️ Previsão — Limpeza Recomendada</div>
        <div class="forecast-eta-value">${warnEta ? warnEta.label : (forecast.daysToWarn === 0 ? 'já atingido' : 'sem previsão')}</div>
        <div class="forecast-eta-date">${warnEta ? `por volta de ${warnEta.date}` : 'sem tendência de degradação detetada'}</div>
      </div>
      <div class="forecast-eta-card ${critEta ? 'fc-crit' : ''}">
        <div class="forecast-eta-label">🔴 Previsão — Risco de Thermal Throttle</div>
        <div class="forecast-eta-value">${critEta ? critEta.label : (forecast.daysToCrit === 0 ? 'já atingido' : 'sem previsão')}</div>
        <div class="forecast-eta-date">${critEta ? `por volta de ${critEta.date}` : 'sem tendência de degradação detetada'}</div>
      </div>
    </div>
    <div class="forecast-confidence">
      Tendência: <b>${trendLabel}</b> · Confiança: <b>${forecast.confidence}</b>
      (${forecast.daysRecorded} dias de dados, ajuste R²=${forecast.rSquared.toFixed(2)}) ·
      Baseline: <b>${forecast.baseline.toFixed(2)}</b> · Atual projetado: <b>${forecast.currentProjected.toFixed(2)}</b>
    </div>
  `;
}

function drawThermalChart(svgId, points, status){
  const svg = $(svgId);
  const vals = (points || []).map(p => p.effort).filter(v => v != null && isFinite(v));

  if(vals.length < 2){
    svg.innerHTML = `
      <text x="150" y="58" fill="#4a6975" font-size="11" text-anchor="middle">A recolher dados térmicos...</text>
      <text x="150" y="76" fill="#4a6975" font-size="9.5" text-anchor="middle">são precisas algumas horas de funcionamento</text>
    `;
    $('valThermalNow').textContent = '—';
    return;
  }

  const colorMap = { normal: '#21ffb0', warning: '#ffb020', critical: '#ff5d5d', collecting: '#4fd6ff' };
  const color = colorMap[status] || '#4fd6ff';

  let min = Math.min(...vals), max = Math.max(...vals), range = (max-min) || 1;
  const avg = vals.reduce((a,b) => a+b, 0) / vals.length;
  const latest = vals[vals.length - 1];

  $('valThermalNow').textContent = latest.toFixed(2);

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

  svg.innerHTML = `
    <defs>
      <linearGradient id="thermal_grad_${svgId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.0"/>
      </linearGradient>
      <filter id="thermal_glow_${svgId}" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" result="glow" />
        <feComposite in="SourceGraphic" in2="glow" operator="over" />
      </filter>
    </defs>

    <line x1="10" y1="${avgY}" x2="290" y2="${avgY}" stroke="${color}66" stroke-dasharray="4,4" stroke-width="1"/>
    <path d="M${pts[0].x},${h} L${ptsString} L${pts[pts.length-1].x},${h} Z" fill="url(#thermal_grad_${svgId})"></path>
    <path fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" filter="url(#thermal_glow_${svgId})" d="M${ptsString}"></path>
    <circle cx="${lastPt.x}" cy="${lastPt.y}" r="4.5" fill="${color}" stroke="#0d1a26" stroke-width="2"/>

    <g id="tooltip_${svgId}" style="display:none;">
      <line x1="0" y1="0" x2="0" y2="${h}" stroke="${color}88" stroke-dasharray="3,3" stroke-width="1"></line>
      <circle r="4" fill="${color}" stroke="#060d14" stroke-width="2"></circle>
    </g>
  `;

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
      $('valThermalNow').textContent = closest.val.toFixed(2);
    }
  };

  svg.onmouseleave = () => {
    const tip = svg.querySelector(`#tooltip_${svgId}`);
    if(tip) tip.style.display = 'none';
    $('valThermalNow').textContent = vals[vals.length - 1].toFixed(2);
  };
}

function nowStamp(){ return new Date().toLocaleTimeString('pt-BR', {hour12:false}); }

/* Parser de erros da consola: padrões recorrentes -> alerta legível */
const ANOMALY_RULES = [
  { id: 'i2c',    re: /i2c|twi[_ ]?(?:error|timeout)|smbus/i,                          msg: n => `Falha de comunicação I2C (sensor de temperatura/regulador) na ${n}` },
  { id: 'socket', re: /(?:stratum|socket|connect|tcp|tls|ssl)[^\n]{0,40}(?:fail|error|reset|refused|timeout|timed out|closed)|errno\s*\d+|getaddrinfo|dns[^\n]{0,20}fail/i, msg: n => `Erro de ligação à pool (socket/stratum) na ${n}` },
  { id: 'asic',   re: /asic[^\n]{0,40}(?:timeout|not respond|no response|fail|error)|chip[^\n]{0,20}(?:timeout|fail)|uart[^\n]{0,20}(?:timeout|error)|job timeout/i, msg: n => `Time-out de comunicação com o ASIC na ${n}` },
  { id: 'wifi',   re: /wifi[^\n]{0,30}(?:disconnect|lost|fail|error)|beacon timeout|deauth/i, msg: n => `Instabilidade de Wi-Fi na ${n}` },
  { id: 'wdt',    re: /watchdog|brownout|guru meditation|panic|rebooting|stack overflow/i, msg: n => `Reinício/falha de firmware (watchdog/brownout) na ${n}` },
  { id: 'psu',    re: /(?:overcurrent|overvoltage|undervoltage|power fault|vr[_ ]?fault)/i, msg: n => `Falha de alimentação/regulador (VR) na ${n}` },
];
const anomalyState = {};
function parseConsoleAnomaly(machineId, machineName, text) {
  if(!text || machineId === 'sys') return;
  for(const rule of ANOMALY_RULES) {
    if(!rule.re.test(text)) continue;
    const key = machineId + ':' + rule.id, now = Date.now();
    const st = anomalyState[key] || (anomalyState[key] = { hits: [], lastAlert: 0 });
    st.hits = st.hits.filter(t => now - t < 60000); st.hits.push(now);
    if(st.hits.length >= 3 && now - st.lastAlert > 10 * 60000) {
      st.lastAlert = now;
      const m = rule.msg(machineName);
      addNotification('anomaly', 'Anomalia Detetada', `${m} (${st.hits.length} ocorrências no último minuto). Última linha: ${String(text).slice(0, 120)}`, machineName);
      logEvent(`🔧 ${m}`, 'error', machineName, machineId);
    }
    return;
  }
}

function addConsoleLine(machineId, machineName, tag, text, isAmber = false, isRed = false) {
  try { if(tag !== 'system') parseConsoleAnomaly(machineId, machineName, text); } catch(e){}
  const frameId = Math.floor(Math.random() * 9000000) + 1000000;
  const lineObj = { machineId, machineName, frame: frameId, tag, text, isAmber, isRed, time: nowStamp() };
  consoleLogs.push(lineObj);
  if(consoleLogs.length > 600) consoleLogs.shift();
  
  if(realtimeActive) {
    appendLineToDOM(lineObj);
  }
}

function matchesFilters(item) {
  const selectedMachine = $('logMachineSelect')?.value || 'all';
  const filterText = ($('filterLogsInput')?.value || '').toLowerCase();
  const filterTag = ($('filterTagsInput')?.value || '').toLowerCase();

  if(selectedMachine !== 'all' && item.machineId !== selectedMachine) return false;
  if(filterText && !item.text.toLowerCase().includes(filterText) && !item.tag.toLowerCase().includes(filterText) && !item.machineName.toLowerCase().includes(filterText)) return false;
  if(filterTag && !item.tag.toLowerCase().includes(filterTag)) return false;
  return true;
}

function appendLineToDOM(item) {
  const screen = $('consoleScreen');
  if(!screen) return;
  if(!matchesFilters(item)) return;

  const div = document.createElement('div');
  div.className = 'console-line';
  let tagClass = 'log-tag';
  if(item.isRed) tagClass = 'log-tag-red';
  else if(item.isAmber) tagClass = 'log-tag-amber';

  div.innerHTML = `<span class="log-id">[#${item.frame}]</span><span class="log-time">${item.time}</span><span class="log-machine">[${item.machineName}]</span><span class="${tagClass}">${item.tag}:</span> ${item.text}`;
  screen.appendChild(div);
  
  if(autoScroll) {
    screen.scrollTop = screen.scrollHeight;
  }
}

function renderConsoleLogs() {
  const screen = $('consoleScreen');
  if(!screen) return;
  screen.innerHTML = '';
  
  consoleLogs.forEach(item => {
    if(!matchesFilters(item)) return;
    
    const div = document.createElement('div');
    div.className = 'console-line';
    let tagClass = 'log-tag';
    if(item.isRed) tagClass = 'log-tag-red';
    else if(item.isAmber) tagClass = 'log-tag-amber';

    div.innerHTML = `<span class="log-id">[#${item.frame}]</span><span class="log-time">${item.time}</span><span class="log-machine">[${item.machineName}]</span><span class="${tagClass}">${item.tag}:</span> ${item.text}`;
    screen.appendChild(div);
  });
  
  if(autoScroll) {
    screen.scrollTop = screen.scrollHeight;
  }
}

function toggleRealtimeLogs() {
  realtimeActive = !realtimeActive;
  const btn = $('toggleRealtimeBtn');
  if(realtimeActive) {
    btn.textContent = '🟢 Realtime Logs';
    btn.style.borderColor = '#21ffb055';
    btn.style.color = 'var(--green)';
  } else {
    btn.textContent = '⏸ Paused Logs';
    btn.style.borderColor = '#ffb02055';
    btn.style.color = 'var(--amber)';
  }
}

function toggleScrollLock() {
  autoScroll = !autoScroll;
  const btn = $('scrollLockBtn');
  if(autoScroll) {
    btn.textContent = '📌 Stop Scroll';
    btn.style.color = 'var(--amber)';
  } else {
    btn.textContent = '📍 Resume Scroll';
    btn.style.color = 'var(--green)';
  }
}

function clearConsoleView() {
  const screen = $('consoleScreen');
  if(screen) screen.innerHTML = '';
}

function wipeConsoleLogs() {
  consoleLogs = [];
  $('filterLogsInput').value = '';
  $('filterTagsInput').value = '';
  clearConsoleView();
}

function downloadLogs() {
  const selectedMachine = $('logMachineSelect')?.value || 'all';
  const filtered = consoleLogs.filter(l => selectedMachine === 'all' || l.machineId === selectedMachine);
  const content = filtered.map(l => `[#${l.frame}] [${l.time}] [${l.machineName}] ${l.tag}: ${l.text}`).join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `centro_comando_logs_${selectedMachine}_${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

