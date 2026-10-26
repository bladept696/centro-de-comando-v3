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

function drawPingChart(svgId, rawVals, rawTs){
  const svg = $(svgId);
  const pts0 = [];
  (rawVals || []).forEach((v, i) => { if(v != null && isFinite(v)) pts0.push({ v: Number(v), t: rawTs && rawTs[i] ? rawTs[i] : null }); });
  const W = Math.max(360, Math.round(svg.clientWidth || (svg.parentElement && svg.parentElement.clientWidth) || 720)), H = 250;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet'); svg.style.height = 'auto';
  const setStats = (now, avg, mm, jit, p95) => { $('valPingNow').textContent = now; $('valPingAvg').textContent = avg; $('valPingMinMax').textContent = mm; if($('valPingJitter')) $('valPingJitter').textContent = jit; if($('valPingP95')) $('valPingP95').textContent = p95; };

  if(pts0.length < 2){
    svg.innerHTML = `<text x="${W / 2}" y="${H / 2}" fill="#4a6975" font-size="12" text-anchor="middle">${t('lt_wait')}</text>`;
    setStats('—', '—', '—', '—', '—');
    const b = $('pingDetailBadge'); if(b){ b.className = 'thermal-badge'; b.textContent = ''; }
    svg.onmousemove = svg.onmouseleave = null;
    return;
  }

  const vals = pts0.map(p => p.v), n = vals.length;
  const avg = vals.reduce((a, b) => a + b, 0) / n, min = Math.min(...vals), max = Math.max(...vals), latest = vals[n - 1];
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - avg) * (b - avg), 0) / n), sorted = [...vals].sort((a, b) => a - b), p95 = sorted[Math.min(n - 1, Math.floor(n * .95))];
  const q = pingQuality(latest), color = q.color;
  setStats(`${latest.toFixed(2)} ms`, `${avg.toFixed(2)} ms`, `${min.toFixed(2)} / ${max.toFixed(2)} ms`, `±${sd.toFixed(2)} ms`, `${p95.toFixed(2)} ms`);
  const bd = $('pingDetailBadge'); if(bd){ bd.className = 'thermal-badge ' + ({ great: 'status-normal', good: 'status-normal', warn: 'status-warning', bad: 'status-critical' })[q.k]; bd.textContent = q.label; }

  const L = 50, R = 16, T = 14, B = 28, pw = W - L - R, ph = H - T - B, hasT = pts0.every(p => p.t);
  const t0 = hasT ? pts0[0].t : 0, t1 = hasT ? pts0[n - 1].t : n - 1, span = Math.max(1, t1 - t0);
  let lo = Math.max(0, Math.min(min, avg) - (max - min) * .1 - 2), hi = max + (max - min) * .12 + 2;
  hi = Math.max(hi, Math.min(max * 1.1, 120)); if(hi - lo < 10) hi = lo + 10;
  const X = (p, i) => L + ((hasT ? p.t - t0 : i) / span) * pw, Y = v => T + (1 - (v - lo) / (hi - lo)) * ph;
  const win = Math.max(1, Math.round(n / 50));
  const sm = vals.map((_, i) => { let s = 0, c = 0; for(let k = Math.max(0, i - win); k <= Math.min(n - 1, i + win); k++){ s += vals[k]; c++; } return s / c; });
  const P = pts0.map((p, i) => ({ x: X(p, i), y: Y(sm[i]), raw: p.v, t: p.t }));
  const line = P.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join('');
  const rawLine = pts0.map((p, i) => (i ? 'L' : 'M') + X(p, i).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join('');
  const fmt = v => (hi - lo) < 20 ? v.toFixed(1) : v.toFixed(0);
  let g = '';
  // zonas de qualidade (100 ms e 250 ms)
  const zone = (a, b, col) => { const ya = Math.max(T, Math.min(T + ph, Y(b))), yb = Math.max(T, Math.min(T + ph, Y(a))); if(yb - ya > 0.5) g += `<rect x="${L}" y="${ya.toFixed(1)}" width="${pw}" height="${(yb - ya).toFixed(1)}" fill="${col}" opacity=".07"/>`; };
  zone(0, 100, '#21ffb0'); zone(100, 250, '#ffb020'); zone(250, 99999, '#ff5d5d');
  for(let k = 0; k <= 4; k++){ const v = lo + (hi - lo) * k / 4, y = Y(v); g += `<line x1="${L}" y1="${y.toFixed(1)}" x2="${W - R}" y2="${y.toFixed(1)}" stroke="#ffffff10"/><text x="${L - 8}" y="${(y + 3.5).toFixed(1)}" fill="#6b8794" font-size="10" text-anchor="end">${fmt(v)}</text>`; }
  g += `<text x="${L - 8}" y="${T - 3}" fill="#6b8794" font-size="9.5" text-anchor="end">ms</text>`;
  // eixo do tempo
  if(hasT){ for(let k = 0; k <= 4; k++){ const tt = t0 + span * k / 4; g += `<text x="${(L + pw * k / 4).toFixed(1)}" y="${H - 9}" fill="#6b8794" font-size="10" text-anchor="${k === 0 ? 'start' : k === 4 ? 'end' : 'middle'}">${new Date(tt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</text>`; } }
  // referências: média e limiares
  const ref = (v, col, label, dash) => { if(v < lo || v > hi) return ''; const y = Y(v); return `<line x1="${L}" y1="${y.toFixed(1)}" x2="${W - R}" y2="${y.toFixed(1)}" stroke="${col}" stroke-dasharray="${dash}" stroke-width="1" opacity=".85"/><text x="${W - R - 4}" y="${(y - 4).toFixed(1)}" fill="${col}" font-size="9.5" text-anchor="end">${label}</text>`; };
  g += ref(avg, '#4fd6ff', 'média ' + avg.toFixed(1), '5 4') + ref(100, '#ffb020', '100 ms', '2 4') + ref(250, '#ff5d5d', '250 ms', '2 4');
  // mínimo e máximo
  const imin = vals.indexOf(min), imax = vals.indexOf(max);
  const mark = (i, col, txt, dy) => `<circle cx="${P[i].x.toFixed(1)}" cy="${Y(vals[i]).toFixed(1)}" r="3.4" fill="${col}" stroke="#0d1a26" stroke-width="1.5"/><text x="${Math.min(W - R - 14, Math.max(L + 14, P[i].x)).toFixed(1)}" y="${(Y(vals[i]) + dy).toFixed(1)}" fill="${col}" font-size="9.5" text-anchor="middle">${txt}</text>`;
  const last = P[n - 1], gid = 'pg_' + svgId;
  svg.innerHTML = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".36"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>
      <filter id="${gid}f" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    ${g}
    <path d="${rawLine}" fill="none" stroke="${color}" stroke-width="1" opacity=".22" stroke-linejoin="round"/>
    <path d="${line}L${last.x.toFixed(1)} ${T + ph}L${P[0].x.toFixed(1)} ${T + ph}Z" fill="url(#${gid})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" filter="url(#${gid}f)"/>
    ${mark(imin, '#21ffb0', fmt(min), 14)}${max > min ? mark(imax, '#ff7b6b', fmt(max), -8) : ''}
    <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="5" fill="${color}" stroke="#0d1a26" stroke-width="2"/>
    <g id="tip_${svgId}" style="display:none;pointer-events:none;"><line y1="${T}" y2="${T + ph}" stroke="${color}88" stroke-dasharray="3 3"/><circle r="4.5" fill="${color}" stroke="#060d14" stroke-width="2"/><g class="bub"><rect rx="6" width="118" height="34" fill="#08121a" stroke="${color}88"/><text x="8" y="14" fill="#e8f6ff" font-size="11" font-weight="700"></text><text x="8" y="27" fill="#6b8794" font-size="9.5"></text></g></g>`;
  svg.onmousemove = e => {
    const r = svg.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width * W;
    let c = P[0], md = Infinity;
    for(const p of P){ const d = Math.abs(p.x - mx); if(d < md){ md = d; c = p; } }
    const tip = svg.querySelector('#tip_' + svgId);
    if(!tip) return;
    tip.style.display = 'block'; tip.setAttribute('transform', `translate(${c.x.toFixed(1)},0)`);
    tip.querySelector('circle').setAttribute('cy', c.y.toFixed(1));
    const bub = tip.querySelector('.bub'), bx = c.x > W - 140 ? -126 : 10;
    bub.setAttribute('transform', `translate(${bx},${Math.max(T, Math.min(T + ph - 36, c.y - 40))})`);
    const tx = bub.querySelectorAll('text'); tx[0].textContent = c.raw.toFixed(2) + ' ms'; tx[1].textContent = c.t ? new Date(c.t).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
    $('valPingNow').textContent = `${c.raw.toFixed(2)} ms`;
  };
  svg.onmouseleave = () => {
    const tip = svg.querySelector('#tip_' + svgId);
    if(tip) tip.style.display = 'none';
    $('valPingNow').textContent = `${latest.toFixed(2)} ms`;
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
          <small class="oc-delta" data-k="f"></small>
        </div>
        <div class="oc-field">
          <label data-i18n="corevoltage_mv">CoreVoltage (mV)</label>
          <input type="number" class="oc-volt-input" placeholder="ex: 1150" value="${r?.coreVoltage != null ? r.coreVoltage : ''}">
          <small class="oc-delta" data-k="v"></small>
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
    // diferença face ao valor atual, com aviso nos saltos grandes
    const showDelta = () => {
      const f0 = Number(r?.frequency), v0 = Number(r?.coreVoltage), f1 = Number(freqInput.value), v1 = Number(voltInput.value);
      const put = (k, txt, cls, tip) => { const el = card.querySelector('.oc-delta[data-k="' + k + '"]'); el.textContent = txt; el.className = 'oc-delta ' + cls; el.title = tip || ''; };
      if(f0 && freqInput.value && f1 !== f0){ const d = f1 - f0, pct = d / f0 * 100; put('f', `Δ ${d > 0 ? '+' : ''}${d} MHz (${pct > 0 ? '+' : ''}${pct.toFixed(1)}%)${pct > 12 ? ' ⚠' : ''}`, pct > 12 ? 'bad' : pct > 6 ? 'warn' : d > 0 ? 'up' : 'down', pct > 12 ? 'Salto grande de frequência: aumente aos poucos e vigie a temperatura.' : ''); } else put('f', '', '');
      if(v0 && voltInput.value && v1 !== v0){ const d = v1 - v0; put('v', `Δ ${d > 0 ? '+' : ''}${d} mV${d > 60 ? ' ⚠' : ''}`, d > 100 ? 'bad' : d > 40 ? 'warn' : d > 0 ? 'up' : 'down', d > 60 ? 'Subida grande de tensão: aquece mais e gasta mais energia.' : ''); } else put('v', '', '');
    };
    freqInput.addEventListener('input', showDelta); voltInput.addEventListener('input', showDelta);

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
      const days = forecast.daysToCrit != null ? forecast.daysToCrit : forecast.daysToWarn;
      if(days == null){
        fcClass = 'fc-stable';
        fcText = '🔮 Sem degradação — sem manutenção prevista';
      } else {
        const eta = formatForecastEta(days), crit = forecast.daysToCrit != null;
        fcClass = days <= 30 ? 'fc-crit' : days <= 120 ? 'fc-warn' : 'fc-stable';
        fcText = days > 365 ? `🔮 Sem risco no próximo ano (${eta.label})`
          : crit ? `🔮 Risco de throttle em ${eta.label} (${eta.date})` : `🔮 Limpeza recomendada em ${eta.label} (${eta.date})`;
      }
    }

    // indicador por zonas (normal / atenção / crítico) com o marcador na variação atual
    const gMax = THERMAL_CRIT_PCT * 1.5, gPos = health.changePct != null ? Math.max(0, Math.min(gMax, health.changePct)) / gMax * 100 : null;
    const gauge = health.status === 'collecting'
      ? (() => { const n = health.points.length, left = Math.max(0, THERMAL_MIN_BASELINE_SNAPSHOTS - n), pct = Math.min(100, n / THERMAL_MIN_BASELINE_SNAPSHOTS * 100);
          return `<div class="thermal-prog"><div class="bar"><i style="width:${pct.toFixed(0)}%"></i></div><span>${mct('th_samples', n, THERMAL_MIN_BASELINE_SNAPSHOTS, Math.ceil(left * THERMAL_SNAPSHOT_INTERVAL_MS / 3600000))}</span></div>`; })()
      : `<div class="thermal-gauge" title="${changeLabel}"><i class="z ok" style="width:${THERMAL_WARN_PCT / gMax * 100}%"></i><i class="z warn" style="width:${(THERMAL_CRIT_PCT - THERMAL_WARN_PCT) / gMax * 100}%"></i><i class="z crit"></i><b class="mk ${badgeClass}" style="left:${gPos.toFixed(1)}%"></b></div>`;
    const sparkColor = ({ normal: '#21ffb0', warning: '#ffb020', critical: '#ff5d5d' })[health.status] || '#4fd6ff';
    const spark2 = thermalSpark(health.points.map(p => p.effort), sparkColor);

    const card = document.createElement('div');
    card.className = 'thermal-card ' + badgeClass + (dev.id === thermalSelectedId ? ' selected' : '') + (!online ? ' offline' : '');
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
      ${gauge}
      ${spark2}
      <div class="thermal-stats-mini">
        <span>🌡 ${online && r.temp != null ? `${r.temp.toFixed(1)} °C` : '—'}</span>
        <span>🌀 ${online ? `${(r.fanSpeed || 0).toFixed(0)} rpm` : '—'}</span>
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
    ? `${soonestEta.days >= 365 ? '>1 ano' : Math.ceil(soonestEta.days) + 'd'} — ${soonestEta.dev.name}`
    : '—';
  const tone = (id, v) => { const el = $(id) && $(id).closest('.ping-summary-card'); if(el) el.dataset.tone = v; };
  tone('thermalAtRisk', !tracked ? 'none' : atRisk ? 'bad' : 'ok');
  tone('thermalWorst', worstPct === null ? 'none' : worstPct >= THERMAL_CRIT_PCT ? 'bad' : worstPct >= THERMAL_WARN_PCT ? 'warn' : 'ok');
  tone('thermalMinDays', 'none'); tone('thermalTracked', tracked ? 'ok' : 'none');
  tone('thermalNextEta', !soonestEta ? 'none' : soonestEta.days <= 30 ? 'bad' : soonestEta.days <= 120 ? 'warn' : 'ok');
  updateThermalShieldChip();

  if(!thermalSelectedId || !devices.find(d => d.id === thermalSelectedId)){
    thermalSelectedId = devices[0]?.id || null;
  }
  const selDev = devices.find(d => d.id === thermalSelectedId);
  if(selDev){
    const health = computeThermalHealth(selDev.id);
    $('thermalDetailName').textContent = `${selDev.name} (${selDev.ip})`;
    drawThermalChart('chartThermal', health.points, health.status, { health, devId: selDev.id });
    const db = $('thermalDetailBadge');
    if(db){ db.className = 'thermal-badge status-' + health.status; db.textContent = ({ normal: '✅ Normal', warning: '⚠️ Atenção', critical: '🔴 Crítico' })[health.status] || '🧬 A recolher dados'; }
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
  const tone = d => d == null ? 'none' : d <= 30 ? 'crit' : d <= 120 ? 'warn' : 'ok';
  const maxD = Math.max(60, Math.min(365, Math.max(forecast.daysToWarn || 0, forecast.daysToCrit || 0) * 1.2 || 90));
  const pos = d => Math.max(0, Math.min(100, d / maxD * 100));
  const mk = (d, cls, label, eta) => d == null ? '' : `<b class="fc-mk ${cls}" style="left:${pos(d).toFixed(1)}%"><em>${label}</em><span>${d > maxD ? '›' : ''}${eta ? eta.label : ''}</span></b>`;
  const timeline = `<div class="fc-timeline"><div class="fc-track"><b class="fc-mk now" style="left:0"><em>${t('th_today')}</em></b>${mk(forecast.daysToWarn, 'warn', t('th_clean'), warnEta)}${mk(forecast.daysToCrit, 'crit', t('th_throttle'), critEta)}</div>
      <div class="fc-scale"><span>0</span><span>+${Math.round(maxD / 2)} d</span><span>+${Math.round(maxD)} d${maxD >= 365 ? '+' : ''}</span></div></div>`;
  const far = e => e && e.days > 365 ? t('th_far') : null;

  body.innerHTML = `
    <div class="forecast-grid">
      <div class="forecast-eta-card tone-${tone(forecast.daysToWarn)}">
        <div class="forecast-eta-label">⚠️ Previsão — Limpeza Recomendada</div>
        <div class="forecast-eta-value">${warnEta ? (far(warnEta) || warnEta.label) : (forecast.daysToWarn === 0 ? 'já atingido' : 'sem previsão')}</div>
        <div class="forecast-eta-date">${warnEta ? `por volta de ${warnEta.date}` : 'sem tendência de degradação detetada'}</div>
      </div>
      <div class="forecast-eta-card tone-${tone(forecast.daysToCrit)}">
        <div class="forecast-eta-label">🔴 Previsão — Risco de Thermal Throttle</div>
        <div class="forecast-eta-value">${critEta ? (far(critEta) || critEta.label) : (forecast.daysToCrit === 0 ? 'já atingido' : 'sem previsão')}</div>
        <div class="forecast-eta-date">${critEta ? `por volta de ${critEta.date}` : 'sem tendência de degradação detetada'}</div>
      </div>
    </div>
    ${timeline}
    <div class="forecast-confidence">
      Tendência: <b>${trendLabel}</b> · Confiança: <b>${forecast.confidence}</b>
      (${forecast.daysRecorded} dias de dados, ajuste R²=${forecast.rSquared.toFixed(2)}) ·
      Baseline: <b>${forecast.baseline.toFixed(2)}</b> · Atual projetado: <b>${forecast.currentProjected.toFixed(2)}</b>
    </div>
  `;
}

// linha pequena e suave para os cartões (sem distorcer o traço)
function thermalSpark(vals, color){
  vals = (vals || []).filter(v => v != null && isFinite(v));
  if(vals.length < 3) return '<svg class="thermal-spark" viewBox="0 0 260 44"><text x="130" y="26" fill="#4a6975" font-size="9" text-anchor="middle">a recolher dados...</text></svg>';
  const w = 260, h = 44, pad = 4, win = Math.max(2, Math.round(vals.length / 30));
  const sm = vals.map((_, i) => { let s = 0, n = 0; for(let k = Math.max(0, i - win); k <= Math.min(vals.length - 1, i + win); k++){ s += vals[k]; n++; } return s / n; });
  const min = Math.min(...sm), max = Math.max(...sm), range = (max - min) || 1;
  const pts = sm.map((v, i) => [pad + i * ((w - pad * 2) / (sm.length - 1)), h - pad - ((v - min) / range) * (h - pad * 2)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  const id = 'sp' + Math.random().toString(36).slice(2, 7), last = pts[pts.length - 1];
  return `<svg class="thermal-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${line}L${pts[pts.length - 1][0].toFixed(1)} ${h}L${pts[0][0].toFixed(1)} ${h}Z" fill="url(#${id})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.6" fill="${color}"/></svg>`;
}

// gráfico da assinatura térmica: série suavizada, linha de base, zonas de atenção e crítico, eixos e manutenções
function drawThermalChart(svgId, points, status, extra){
  const svg = $(svgId);
  const pts0 = (points || []).filter(p => p.effort != null && isFinite(p.effort));
  const W = Math.max(360, Math.round(svg.clientWidth || (svg.parentElement && svg.parentElement.clientWidth) || 720)), H = 250;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet'); svg.style.height = 'auto';

  if(pts0.length < 2){
    svg.innerHTML = `<text x="${W / 2}" y="${H / 2 - 4}" fill="#4a6975" font-size="13" text-anchor="middle">A recolher dados térmicos...</text>
      <text x="${W / 2}" y="${H / 2 + 16}" fill="#4a6975" font-size="11" text-anchor="middle">são precisas algumas horas de funcionamento</text>`;
    $('valThermalNow').textContent = '—';
    svg.onmousemove = svg.onmouseleave = null;
    return;
  }

  const color = ({ normal: '#21ffb0', warning: '#ffb020', critical: '#ff5d5d', collecting: '#4fd6ff' })[status] || '#4fd6ff';
  const L = 54, R = 18, T = 16, B = 30, pw = W - L - R, ph = H - T - B;
  const t0 = pts0[0].t, t1 = pts0[pts0.length - 1].t, span = Math.max(1, t1 - t0), vals = pts0.map(p => p.effort);
  const win = Math.max(2, Math.round(vals.length / 36));
  const sm = vals.map((_, i) => { let s = 0, n = 0; for(let k = Math.max(0, i - win); k <= Math.min(vals.length - 1, i + win); k++){ s += vals[k]; n++; } return s / n; });
  const base = extra && extra.health && extra.health.baselineEffort, warnV = base ? base * (1 + THERMAL_WARN_PCT / 100) : null, critV = base ? base * (1 + THERMAL_CRIT_PCT / 100) : null;
  let min = Math.min(...vals, ...(base ? [base] : [])), max = Math.max(...vals, ...(critV ? [critV * 1.02] : []));
  const padV = (max - min) * .08 || 1; min -= padV; max += padV;
  const X = t => L + (t - t0) / span * pw, Y = v => T + (1 - (v - min) / (max - min)) * ph, fmt = v => (max - min) < 12 ? v.toFixed(2) : v.toFixed(0);
  const P = pts0.map((p, i) => ({ x: X(p.t), y: Y(sm[i]), raw: p.effort, t: p.t }));
  const line = P.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join('');
  const rawLine = pts0.map((p, i) => (i ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p.effort).toFixed(1)).join('');
  let g = '';
  // zonas
  if(warnV != null){
    const yw = Math.max(T, Math.min(T + ph, Y(warnV))), yc = Math.max(T, Math.min(T + ph, Y(critV)));
    g += `<rect x="${L}" y="${T}" width="${pw}" height="${yc - T}" fill="#ff5d5d" opacity=".07"/><rect x="${L}" y="${yc}" width="${pw}" height="${Math.max(0, yw - yc)}" fill="#ffb020" opacity=".07"/>`;
  }
  // grelha e eixo Y
  for(let k = 0; k <= 4; k++){ const v = min + (max - min) * k / 4, y = Y(v); g += `<line x1="${L}" y1="${y.toFixed(1)}" x2="${W - R}" y2="${y.toFixed(1)}" stroke="#ffffff10"/><text x="${L - 8}" y="${(y + 3.5).toFixed(1)}" fill="#6b8794" font-size="10" text-anchor="end">${fmt(v)}</text>`; }
  // eixo X (dias atrás)
  const days = span / 864e5, step = days <= 1.5 ? 0 : days <= 4 ? 1 : days <= 10 ? 2 : days <= 21 ? 5 : 10;
  if(step){ for(let d = Math.floor(days / step) * step; d >= 0; d -= step){ const x = X(t1 - d * 864e5); if(x < L - 1) continue; g += `<text x="${x.toFixed(1)}" y="${H - 10}" fill="#6b8794" font-size="10" text-anchor="${d === 0 ? 'end' : 'middle'}">${d === 0 ? t('th_now') : '-' + d + 'd'}</text>`; } }
  else { for(let k = 0; k <= 4; k++){ const tt = t0 + span * k / 4; g += `<text x="${X(tt).toFixed(1)}" y="${H - 10}" fill="#6b8794" font-size="10" text-anchor="${k === 0 ? 'start' : k === 4 ? 'end' : 'middle'}">${new Date(tt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</text>`; } }
  // linhas de referência
  const ref = (v, col, label, dash) => { if(v == null) return ''; const y = Y(v); if(y < T || y > T + ph) return ''; return `<line x1="${L}" y1="${y.toFixed(1)}" x2="${W - R}" y2="${y.toFixed(1)}" stroke="${col}" stroke-dasharray="${dash}" stroke-width="1" opacity=".85"/><text x="${W - R - 4}" y="${(y - 4).toFixed(1)}" fill="${col}" font-size="9.5" text-anchor="end">${label}</text>`; };
  g += ref(base, '#4fd6ff', t('th_base') + ' ' + fmt(base || 0), '5 4') + ref(warnV, '#ffb020', '+' + THERMAL_WARN_PCT + '%', '2 4') + ref(critV, '#ff5d5d', '+' + THERMAL_CRIT_PCT + '%', '2 4');
  // manutenções registadas
  const ml = (extra && extra.devId && maintenanceLog[extra.devId]) || [];
  ml.filter(m => m.t >= t0 && m.t <= t1).forEach(m => { const x = X(m.t); g += `<line x1="${x.toFixed(1)}" y1="${T}" x2="${x.toFixed(1)}" y2="${T + ph}" stroke="#b07cff" stroke-dasharray="3 3" opacity=".8"/><text x="${x.toFixed(1)}" y="${T - 3}" fill="#c9a7ff" font-size="9.5" text-anchor="middle">🔧 ${t('th_maint')}</text>`; });
  const last = P[P.length - 1], gid = 'tg_' + svgId;
  $('valThermalNow').textContent = vals[vals.length - 1].toFixed(2);
  svg.innerHTML = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".38"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>
      <filter id="${gid}f" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    ${g}
    <path d="${rawLine}" fill="none" stroke="${color}" stroke-width="1" opacity=".22" stroke-linejoin="round"/>
    <path d="${line}L${last.x.toFixed(1)} ${T + ph}L${P[0].x.toFixed(1)} ${T + ph}Z" fill="url(#${gid})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" filter="url(#${gid}f)"/>
    <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="5" fill="${color}" stroke="#0d1a26" stroke-width="2"/>
    <g id="tip_${svgId}" style="display:none;pointer-events:none;"><line y1="${T}" y2="${T + ph}" stroke="${color}88" stroke-dasharray="3 3"/><circle r="4.5" fill="${color}" stroke="#060d14" stroke-width="2"/><g class="bub"><rect rx="6" width="132" height="34" fill="#08121a" stroke="${color}88"/><text x="8" y="14" fill="#e8f6ff" font-size="11" font-weight="700"></text><text x="8" y="27" fill="#6b8794" font-size="9.5"></text></g></g>`;
  svg.onmousemove = e => {
    const r = svg.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width * W;
    let c = P[0], md = Infinity;
    for(const p of P){ const d = Math.abs(p.x - mx); if(d < md){ md = d; c = p; } }
    const tip = svg.querySelector('#tip_' + svgId);
    if(!tip) return;
    tip.style.display = 'block'; tip.setAttribute('transform', `translate(${c.x.toFixed(1)},0)`);
    tip.querySelector('circle').setAttribute('cy', c.y.toFixed(1));
    const bub = tip.querySelector('.bub'), bx = c.x > W - 160 ? -140 : 10;
    bub.setAttribute('transform', `translate(${bx},${Math.max(T, Math.min(T + ph - 36, c.y - 40))})`);
    const tx = bub.querySelectorAll('text'); tx[0].textContent = c.raw.toFixed(2) + ' rpm/TH/s'; tx[1].textContent = new Date(c.t).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    $('valThermalNow').textContent = c.raw.toFixed(2);
  };
  svg.onmouseleave = () => {
    const tip = svg.querySelector('#tip_' + svgId);
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
// Para não encher o ecrã de avisos: só avisa com 5 ocorrências num minuto e, depois de avisar,
// espera 1 hora por máquina e tipo de erro (a hora do último aviso fica guardada, por isso
// recarregar a página não repete o aviso).
const ANOMALY_HITS = 5, ANOMALY_COOLDOWN_MS = 60 * 60000, ANOMALY_KEY = 'nerdqaxe:anomaly_last';
const anomalyState = {};
let anomalyLast = {};
try { anomalyLast = JSON.parse(localStorage.getItem(ANOMALY_KEY) || '{}'); } catch(e) {}
function parseConsoleAnomaly(machineId, machineName, text) {
  if(!text || machineId === 'sys') return;
  for(const rule of ANOMALY_RULES) {
    if(!rule.re.test(text)) continue;
    const key = machineId + ':' + rule.id, now = Date.now();
    const st = anomalyState[key] || (anomalyState[key] = { hits: [], lastAlert: anomalyLast[key] || 0 });
    st.hits = st.hits.filter(t => now - t < 60000); st.hits.push(now);
    if(st.hits.length >= ANOMALY_HITS && now - st.lastAlert > ANOMALY_COOLDOWN_MS) {
      st.lastAlert = now;
      anomalyLast[key] = now;
      try { localStorage.setItem(ANOMALY_KEY, JSON.stringify(anomalyLast)); } catch(e) {}
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

