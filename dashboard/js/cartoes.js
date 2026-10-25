// ---------- Cartões das máquinas ----------
// Um cartão por máquina, com o que interessa à primeira vista: estado, hashrate com mini-gráfico e
// tendência, avisos (temperatura, Wi-Fi, rejeições, pool...), medidores e ações. Há filtros por estado,
// pesquisa, ordenação e três vistas (cartões, compacto e tabela). Os cartões são atualizados no lugar
// (sem os refazer), por isso as barras animam e o rato não perde o foco.
const MC_KEY = 'nerdqaxe:cards_prefs';
const MC_LOG_KEY = 'nerdqaxe:cards_log';
const MC_STATUS = {
  ok:     { label: 'A trabalhar',   color: 'var(--green)', rank: 5 },
  warn:   { label: 'Atenção',       color: 'var(--amber)', rank: 4 },
  warm:   { label: 'Quente',        color: 'var(--amber)', rank: 3 },
  hot:    { label: 'Alarme',        color: 'var(--red)',   rank: 0 },
  off:    { label: 'Offline',       color: 'var(--red)',   rank: 1 },
  portal: { label: 'Config. Wi-Fi', color: 'var(--cyan)',  rank: 2 },
  idle:   { label: 'À espera',      color: 'var(--muted)', rank: 6 }
};
const MC_FILTERS = [['all', 'Todas'], ['ok', 'A trabalhar'], ['warn', 'Atenção'], ['hot', 'Alarme'], ['off', 'Offline']];
const MC_SORTS = [['status', 'Problemas primeiro'], ['name', 'Nome'], ['hash', 'Hashrate'], ['temp', 'Temperatura'], ['eff', 'Eficiência']];
const mc = { prefs: { filter: 'all', sort: 'status', view: 'cards', q: '', fx: 'auto' }, els: new Map(), open: new Set(), prev: {}, since: {}, log: [], ready: false };
try { Object.assign(mc.prefs, JSON.parse(localStorage.getItem(MC_KEY) || '{}')); } catch(e) {}
try { mc.log = JSON.parse(localStorage.getItem(MC_LOG_KEY) || '[]').filter(e => new Date(e.t).toDateString() === new Date().toDateString()); } catch(e) { mc.log = []; }

// efeitos 3D (inclinação, profundidade, reflexo): desligam-se no modo Desempenho e com "reduzir movimento"
function mcFxOn(){
  let reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e) {}
  if(reduced || mc.prefs.fx === false) return false;
  if(mc.prefs.fx === true) return true;   // escolha explícita do botão: ganha ao modo Desempenho
  return !(typeof hcPerfMode !== 'undefined' && hcPerfMode);
}
function mcStateOf(r){
  if(!r) return 'idle';
  if(!r.online) return r.portalMode ? 'portal' : 'off';
  const temp = Number(r.temp);
  if(temp >= 75 || (r.vrTemp != null && r.vrTemp >= 85)) return 'hot';
  if(temp >= 65) return 'warm';
  const shares = (r.accepted || 0) + (r.rejected || 0);
  if((shares > 20 && r.rejected / shares > 0.02) || (r.rssi != null && r.rssi <= -80) || (r.poolPing != null && r.poolPing > 400)) return 'warn';
  return 'ok';
}
function mcFilterOf(st){ return st === 'warm' ? 'warn' : st === 'portal' ? 'off' : st; }
function mcModelOf(dev, r){
  const s = (dev.name + ' ' + (r?.deviceModel || '') + ' ' + (r?.asicModel || '')).toLowerCase();
  if(r?.type === 'gpu_rig') return ['GPU', '🎮'];
  if(/antminer|whatsminer|avalon|innosilicon|goldshell|elphapex|\b(l3|l7|l9|s9|s19|s21|t21)\b/.test(s) || (r?.algorithm || '').toLowerCase() === 'scrypt') return ['ASIC', '📦'];
  if(/nerd|qaxe|octaxe/.test(s)) return ['NerdQAxe', '⛏️'];
  return ['Bitaxe', '🔹'];
}
function mcHashText(r){
  if(!r || !r.online) return ['—', ''];
  if(r.hashrate_display){ const m = String(r.hashrate_display).match(/^([\d.,]+)\s*(.*)$/); return m ? [m[1], m[2]] : [r.hashrate_display, '']; }
  const f = formatHashrate(r.hashrate);
  return [f.value, f.unit];
}
const mcNum = (v, d) => (v != null && isFinite(v) && Number(v) !== 0) ? Number(v).toFixed(d) : '—';
const mcSignal = rssi => rssi == null ? 0 : rssi >= -55 ? 4 : rssi >= -65 ? 3 : rssi >= -75 ? 2 : rssi >= -85 ? 1 : 0;
function mcTempLevel(t){ return t >= 75 ? 'bad' : t >= 65 ? 'warn' : 'ok'; }

// série de hashrate recente da máquina (do histórico que a dashboard já guarda)
function mcSeries(id){
  const h = (histories[id] || []).filter(x => x && x.hashrate != null && isFinite(x.hashrate));
  return h.slice(-48).map(x => Number(x.hashrate));
}
function mcTrend(vals){
  if(vals.length < 8) return null;
  const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  const now = avg(vals.slice(-3)), before = avg(vals.slice(0, -3));
  return before > 0 ? (now - before) / before * 100 : null;
}
function mcSpark(vals){
  if(vals.length < 3) return { line: '', area: '', x: -9, y: -9 };
  const min = Math.min(...vals), max = Math.max(...vals), span = (max - min) || Math.max(max * .1, 1e-9);
  const pts = vals.map((v, i) => [i / (vals.length - 1) * 120, 32 - (v - min) / span * 28]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  return { line, area: line + 'L120 36L0 36Z', x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] };
}

// avisos legíveis para cada máquina
function mcAlerts(dev, r, st, trend){
  const out = [];
  const add = (lvl, txt) => out.push('<span class="mc-chip ' + lvl + '">' + txt + '</span>');
  if(!r){ add('muted', '⏳ À espera de dados'); return out; }
  if(!r.online){
    if(r.portalMode) add('info', '📶 Em modo de configuração Wi-Fi');
    else { const s = mc.since[dev.id]; add('bad', '🔌 Offline' + (s ? ' há ' + mcAgo(Date.now() - s) : '')); }
    return out;
  }
  if(r.temp >= 75) add('bad', '🔥 Temperatura crítica ' + Number(r.temp).toFixed(0) + ' °C');
  else if(r.temp >= 65) add('warn', '🌡️ Quente ' + Number(r.temp).toFixed(0) + ' °C');
  if(r.vrTemp != null && r.vrTemp >= 85) add('bad', '⚡ VR a ' + Number(r.vrTemp).toFixed(0) + ' °C');
  const sh = (r.accepted || 0) + (r.rejected || 0);
  if(sh > 20 && r.rejected / sh > 0.02) add('warn', '⚠️ Rejeições ' + (r.rejected / sh * 100).toFixed(1) + '%');
  if(r.rssi != null && r.rssi <= -80) add('warn', '📶 Wi-Fi fraco ' + r.rssi + ' dBm');
  if(r.poolPing != null && r.poolPing > 400) add('warn', '🐢 Pool lenta ' + Math.round(r.poolPing) + ' ms');
  if(r.poolInfo && r.poolInfo.usingFallback) add('info', '↪ A usar a pool de reserva');
  if(trend != null && trend <= -30) add('warn', '📉 Hashrate em queda ' + Math.abs(trend).toFixed(0) + '%');
  if(!out.length) add('good', '✓ Tudo normal');
  return out;
}
function mcAgo(ms){
  const m = Math.max(1, Math.round(ms / 60000));
  return m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' d';
}

// ---- construção dos cartões ----
function mcMeter(f, label){
  return '<div class="mc-meter"><div class="mc-meter-top"><span>' + label + '</span><b data-f="' + f + 'V">—</b></div><div class="mc-bar"><i data-f="' + f + 'B"></i></div></div>';
}
function mcCardEl(dev){
  const el = document.createElement('article');
  el.className = 'mc-card';
  el.dataset.id = dev.id;
  el.innerHTML =
    '<header class="mc-head"><span class="mc-dot" data-f="dot"></span>' +
      '<div class="mc-title"><b data-f="name"></b><small data-f="ip"></small></div>' +
      '<span class="mc-model" data-f="model"></span></header>' +
    '<div class="mc-status-row"><span class="mc-status" data-f="status"></span><span class="mc-algo" data-f="algo"></span></div>' +
    '<div class="mc-hero"><div class="mc-hash"><b data-f="hash">—</b><small data-f="unit"></small><i class="mc-trend" data-f="trend"></i></div>' +
      '<svg class="mc-spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><path class="area" data-f="area"/><path class="line" data-f="line"/><circle class="live" data-f="live" r="2.6"/></svg></div>' +
    '<div class="mc-alerts" data-f="alerts"></div>' +
    '<div class="mc-meters">' + mcMeter('temp', 'Temp.') + mcMeter('fan', 'Ventoinha') +
      '<div class="mc-meter"><div class="mc-meter-top"><span>Wi-Fi</span><b data-f="wifiV">—</b></div><div class="mc-sig" data-f="sig"><i></i><i></i><i></i><i></i></div></div></div>' +
    '<div class="mc-facts">' +
      '<div><span>Consumo</span><b data-f="power">—</b></div><div><span>Eficiência</span><b data-f="eff">—</b></div>' +
      '<div><span>Aceites / rej.</span><b data-f="shares">—</b></div><div><span>Melhor dif.</span><b data-f="best">—</b></div>' +
      '<div><span>Uptime</span><b data-f="uptime">—</b></div><div><span>Ping pool</span><b data-f="ping">—</b></div></div>' +
    '<div class="mc-pool"><span>Pool</span><b data-f="pool">—</b></div>' +
    '<div class="mc-more" data-f="more"></div>' +
    '<footer class="mc-actions">' +
      '<button type="button" data-a="web" title="Abrir a interface da máquina (AxeOS)">↗ AxeOS</button>' +
      '<button type="button" data-a="eco" title="Aplicar o perfil Eco">🌿</button><button type="button" data-a="turbo" title="Aplicar o perfil Turbo">🚀</button>' +
      '<button type="button" data-a="restart" title="Reiniciar a máquina">⟲</button>' +
      '<button type="button" data-a="more" title="Mostrar todos os detalhes">⋯ Detalhes</button>' +
      '<button type="button" data-a="remove" class="mc-danger" title="Remover a máquina">✕</button></footer>';
  return el;
}
function mcSet(el, f, text){
  const n = el.querySelector('[data-f="' + f + '"]');
  if(n && n.textContent !== text) n.textContent = text;
  return n;
}
function mcBar(el, f, pct, lvl){
  const n = el.querySelector('[data-f="' + f + '"]');
  if(!n) return;
  n.style.width = Math.max(0, Math.min(100, pct)).toFixed(0) + '%';
  n.className = lvl;
}
function mcMoreHtml(dev, r){
  const row = (l, v) => '<div><span>' + l + '</span><b>' + escapeHtml(String(v)) + '</b></div>';
  const inParts = [];
  if(r && r.online && r.inputV != null) inParts.push(r.inputV.toFixed(2) + ' V');
  if(r && r.online && r.inputA != null) inParts.push(r.inputA.toFixed(2) + ' A');
  const last = typeof getLastMaintenanceTime === 'function' ? getLastMaintenanceTime(dev.id) : null;
  return '<div class="mc-more-grid">' +
    row('Temp. VR', r && r.online ? mcNum(r.vrTemp, 1) + ' °C' : '—') + row('Frequência', r && r.online ? mcNum(r.frequency, 0) + ' MHz' : '—') +
    row('Entrada', inParts.length ? inParts.join(' · ') : '—') + row('Latência local', r && r.online ? mcNum(r.localLatency, 0) + ' ms' : '—') +
    row('Firmware', r && r.online && r.firmware ? r.firmware : '—') + row('Modelo', r && (r.asicModel || r.deviceModel) ? (r.asicModel || r.deviceModel) : '—') +
    row('Algoritmo', r && r.algorithm ? String(r.algorithm).toUpperCase() : 'SHA256') + row('Última manutenção', last && typeof formatMaintDate === 'function' ? formatMaintDate(last) : 'nunca registada') +
    '</div>';
}

// ---- atualização de um cartão ----
function mcUpdateCard(el, dev, r, st, i){
  const S = MC_STATUS[st], on = !!(r && r.online);
  const [model, icon] = mcModelOf(dev, r);
  el.style.setProperty('--mc-c', S.color);
  el.dataset.state = st;
  el.classList.toggle('is-sel', selectedId === dev.id);
  el.classList.toggle('is-open', mc.open.has(dev.id));
  el.classList.toggle('is-off', !on);
  mcSet(el, 'name', dev.name || ('Máquina ' + (i + 1)));
  mcSet(el, 'ip', dev.ip || '');
  mcSet(el, 'model', icon + ' ' + model);
  mcSet(el, 'status', S.label);
  const grp = r ? algoGroupOf(r) : 'sha256';
  mcSet(el, 'algo', grp === 'gpu' || grp === 'other' || grp === 'scrypt' ? String(r.algorithm || '').toUpperCase() : 'SHA-256');
  const [hv, hu] = mcHashText(r);
  mcSet(el, 'hash', hv); mcSet(el, 'unit', hu);
  const vals = on ? mcSeries(dev.id) : [];
  const trend = on ? mcTrend(vals) : null;
  const tr = el.querySelector('[data-f="trend"]');
  tr.textContent = trend != null && Math.abs(trend) >= 1 ? (trend > 0 ? '▲ ' : '▼ ') + Math.abs(trend).toFixed(1) + '%' : '';
  tr.className = 'mc-trend ' + (trend != null && trend > 0 ? 'up' : 'down');
  const sp = mcSpark(vals);
  el.querySelector('[data-f="line"]').setAttribute('d', sp.line);
  el.querySelector('[data-f="area"]').setAttribute('d', sp.area);
  const lv = el.querySelector('[data-f="live"]'); lv.setAttribute('cx', sp.x.toFixed(1)); lv.setAttribute('cy', sp.y.toFixed(1));
  const al = mcAlerts(dev, r, st, trend).join('');
  const aln = el.querySelector('[data-f="alerts"]');
  if(aln.dataset.s !== al){ aln.dataset.s = al; aln.innerHTML = al; }
  // medidores
  if(on){
    mcSet(el, 'tempV', mcNum(r.temp, 1) + ' °C'); mcBar(el, 'tempB', (r.temp - 25) / 60 * 100, mcTempLevel(r.temp));
    const fan = r.fanPct != null ? Math.round(r.fanPct) : null;
    mcSet(el, 'fanV', fan != null ? fan + '%' : (r.fanSpeed ? r.fanSpeed + ' rpm' : '—')); mcBar(el, 'fanB', fan != null ? fan : 0, fan != null && fan >= 90 ? 'warn' : 'ok');
    mcSet(el, 'wifiV', r.rssi != null ? r.rssi + ' dBm' : '—');
    const sig = mcSignal(r.rssi);
    el.querySelectorAll('[data-f="sig"] i').forEach((b, k) => b.classList.toggle('on', k < sig));
    el.querySelector('[data-f="sig"]').className = 'mc-sig ' + (sig <= 1 ? 'bad' : sig === 2 ? 'warn' : 'ok');
    mcSet(el, 'power', mcNum(r.power, 1) + ' W'); mcSet(el, 'eff', mcNum(r.efficiency, 1) + ' J/TH');
    const sh = (r.accepted || 0) + (r.rejected || 0), rej = sh ? r.rejected / sh * 100 : 0;
    mcSet(el, 'shares', (r.accepted || 0) + ' / ' + (r.rejected || 0) + (sh > 20 ? ' (' + rej.toFixed(1) + '%)' : ''));
    el.querySelector('[data-f="shares"]').className = sh > 20 && rej > 2 ? 'warn' : '';
    let best = '—'; if(r.best){ const f = formatDiff(r.best); best = f.value + ' ' + f.unit; }
    mcSet(el, 'best', best); mcSet(el, 'uptime', formatUptime(r.uptime).text);
    mcSet(el, 'ping', r.poolPing != null ? Math.round(r.poolPing) + ' ms' : '—');
    mcSet(el, 'pool', r.pool ? String(r.pool).replace(/^[a-z+]+:\/\//, '') : '—');
  } else {
    ['tempV', 'fanV', 'wifiV', 'power', 'eff', 'shares', 'best', 'uptime', 'ping', 'pool'].forEach(f => mcSet(el, f, '—'));
    ['tempB', 'fanB'].forEach(f => mcBar(el, f, 0, 'ok'));
    el.querySelectorAll('[data-f="sig"] i').forEach(b => b.classList.remove('on'));
  }
  // detalhes extra (só se estiver aberto)
  const more = el.querySelector('[data-f="more"]');
  if(mc.open.has(dev.id)){ const h = mcMoreHtml(dev, r); if(more.dataset.s !== h){ more.dataset.s = h; more.innerHTML = h; } }
  else if(more.firstChild){ more.innerHTML = ''; more.dataset.s = ''; }
  el.querySelector('[data-a="more"]').textContent = mc.open.has(dev.id) ? '▴ Menos' : '⋯ Detalhes';
  // atalhos de perfis só aparecem se existirem
  ['eco', 'turbo'].forEach(slot => {
    const b = el.querySelector('[data-a="' + slot + '"]'), prof = typeof getQuickSlot === 'function' ? getQuickSlot(slot) : null;
    if(b){ b.hidden = !prof || !on; if(prof) b.title = 'Aplicar "' + prof.name + '"'; }
  });
  el.querySelector('[data-a="web"]').hidden = !dev.ip;
}

// ---- tabela ----
function mcTableHtml(rows){
  const th = h => '<th>' + h + '</th>';
  let html = '<table class="mc-table"><thead><tr>' + ['', 'Máquina', 'Estado', 'Hashrate', 'Temp.', 'Consumo', 'Efic.', 'Wi-Fi', 'Ping', 'Rej.', 'Uptime', ''].map(th).join('') + '</tr></thead><tbody>';
  rows.forEach(({ dev, r, st }) => {
    const on = !!(r && r.online), S = MC_STATUS[st], [hv, hu] = mcHashText(r);
    const sh = on ? (r.accepted || 0) + (r.rejected || 0) : 0, rej = sh ? r.rejected / sh * 100 : 0;
    html += '<tr data-id="' + escapeHtml(String(dev.id)) + '" class="' + (selectedId === dev.id ? 'is-sel' : '') + '">' +
      '<td><span class="mc-dot" style="--mc-c:' + S.color + '"></span></td>' +
      '<td><b>' + escapeHtml(dev.name || '') + '</b><small>' + escapeHtml(dev.ip || '') + '</small></td>' +
      '<td style="color:' + S.color + '">' + S.label + '</td>' +
      '<td><b>' + escapeHtml(hv) + '</b> <small>' + escapeHtml(hu) + '</small></td>' +
      '<td class="' + (on ? mcTempLevel(r.temp) : '') + '">' + (on ? mcNum(r.temp, 1) + ' °C' : '—') + '</td>' +
      '<td>' + (on ? mcNum(r.power, 1) + ' W' : '—') + '</td><td>' + (on ? mcNum(r.efficiency, 1) : '—') + '</td>' +
      '<td>' + (on && r.rssi != null ? r.rssi + ' dBm' : '—') + '</td><td>' + (on && r.poolPing != null ? Math.round(r.poolPing) + ' ms' : '—') + '</td>' +
      '<td class="' + (sh > 20 && rej > 2 ? 'warn' : '') + '">' + (sh > 20 ? rej.toFixed(1) + '%' : '—') + '</td>' +
      '<td>' + (on ? formatUptime(r.uptime).text : '—') + '</td>' +
      '<td class="mc-tact"><button type="button" data-a="web" title="Abrir AxeOS"' + (dev.ip ? '' : ' hidden') + '>↗</button><button type="button" data-a="restart" title="Reiniciar">⟲</button><button type="button" data-a="remove" class="mc-danger" title="Remover">✕</button></td></tr>';
  });
  return html + '</tbody></table>';
}

// ---- barra de ferramentas, registo e render principal ----
function mcSavePrefs(){ try { localStorage.setItem(MC_KEY, JSON.stringify(mc.prefs)); } catch(e) {} }
function mcBuildToolbar(){
  const tb = $('mcToolbar');
  if(!tb || tb.dataset.ready) return;
  tb.dataset.ready = '1';
  tb.innerHTML =
    '<div class="mc-chips" id="mcChips"></div>' +
    '<div class="mc-tools"><input type="search" id="mcSearch" placeholder="Pesquisar nome, IP ou pool" aria-label="Pesquisar máquinas">' +
    '<select id="mcSort" aria-label="Ordenar por">' + MC_SORTS.map(([k, l]) => '<option value="' + k + '">' + l + '</option>').join('') + '</select>' +
    '<button type="button" class="mc-fx-btn" id="mcFx" title="Efeitos 3D nos cartões">✨ 3D</button><div class="mc-views" id="mcViews"><button type="button" data-v="cards" title="Cartões">▦</button><button type="button" data-v="compact" title="Compacto">▥</button><button type="button" data-v="table" title="Tabela">☰</button></div></div>';
  $('mcSearch').value = mc.prefs.q || '';
  $('mcFx').addEventListener('click', () => { mc.prefs.fx = !mcFxOn(); mcSavePrefs(); renderMachineCards(); });
  $('mcSort').value = mc.prefs.sort;
  $('mcSearch').addEventListener('input', e => { mc.prefs.q = e.target.value; mcSavePrefs(); renderMachineCards(); });
  $('mcSort').addEventListener('change', e => { mc.prefs.sort = e.target.value; mcSavePrefs(); renderMachineCards(); });
  $('mcViews').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if(!b) return; mc.prefs.view = b.dataset.v; mcSavePrefs(); renderMachineCards(); });
  $('mcChips').addEventListener('click', e => { const b = e.target.closest('[data-flt]'); if(!b) return; mc.prefs.filter = b.dataset.flt; mcSavePrefs(); renderMachineCards(); });
}
function mcLogEvent(text, kind, id){
  mc.log.push({ t: Date.now(), text, kind, id });
  if(mc.log.length > 60) mc.log = mc.log.slice(-60);
  try { localStorage.setItem(MC_LOG_KEY, JSON.stringify(mc.log)); } catch(e) {}
}
function mcTrackStates(list, states){
  list.forEach(dev => {
    const id = dev.id, st = states[id], was = mc.prev[id], r = readings[id];
    if(r && r.online) delete mc.since[id]; else if(r && !mc.since[id]) mc.since[id] = Date.now();
    if(was && was !== st){
      const name = dev.name || dev.ip;
      if(st === 'hot') mcLogEvent(name + ': alarme' + (r && r.temp ? ' (' + Number(r.temp).toFixed(0) + ' °C)' : ''), 'bad', id);
      else if(st === 'off') mcLogEvent(name + ': ficou offline', 'bad', id);
      else if(st === 'portal') mcLogEvent(name + ': modo de configuração Wi-Fi', 'info', id);
      else if(st === 'warm' || st === 'warn') mcLogEvent(name + ': ' + MC_STATUS[st].label.toLowerCase(), 'warn', id);
      else if(st === 'ok') mcLogEvent(name + ': voltou ao normal', 'good', id);
    }
    mc.prev[id] = st;
  });
}
function mcRenderLog(){
  const ul = $('mcLog');
  if(!ul) return;
  const items = mc.log.slice(-40).reverse(), sig = items.length + ':' + (items[0] ? items[0].t : 0);
  if($('mcLogN')) $('mcLogN').textContent = mc.log.length;
  if(ul.dataset.sig === sig) return;
  ul.dataset.sig = sig;
  ul.innerHTML = items.length ? items.map(e => '<li class="' + e.kind + '"' + (e.id != null ? ' data-jump="' + escapeHtml(String(e.id)) + '"' : '') + '><time>' +
    new Date(e.t).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) + '</time><span>' + escapeHtml(e.text) + '</span></li>').join('') : '<li class="muted"><span>Sem eventos hoje. Tudo calmo.</span></li>';
}

function renderMachineCards(){
  const board = $('mcBoard');
  if(!board) return;
  mcBuildToolbar();
  const list = Array.isArray(devices) ? devices : [];
  const states = {};
  list.forEach(d => { states[d.id] = mcStateOf(readings[d.id]); });
  mcTrackStates(list, states);
  if($('mcCount')) $('mcCount').textContent = list.length + ' máquina' + (list.length === 1 ? '' : 's');

  // filtros com contagens
  const counts = { all: list.length, ok: 0, warn: 0, hot: 0, off: 0 };
  list.forEach(d => { const f = mcFilterOf(states[d.id]); if(counts[f] != null) counts[f]++; });
  const chips = $('mcChips');
  if(chips){
    const html = MC_FILTERS.map(([k, l]) => '<button type="button" data-flt="' + k + '" class="mc-fchip ' + k + (mc.prefs.filter === k ? ' active' : '') + (counts[k] ? '' : ' zero') + '">' + l + ' <b>' + counts[k] + '</b></button>').join('');
    if(chips.dataset.s !== html){ chips.dataset.s = html; chips.innerHTML = html; }
  }
  if($('mcFx')){
    const on = mcFxOn(), perf = typeof hcPerfMode !== 'undefined' && hcPerfMode;
    $('mcFx').classList.toggle('active', on);
    $('mcFx').title = on ? 'Desligar os efeitos 3D' : perf && mc.prefs.fx === 'auto' ? 'O modo Desempenho está ativo. Clique para ligar os efeitos 3D mesmo assim' : 'Ligar os efeitos 3D';
  }
  $('mcViews') && $('mcViews').querySelectorAll('[data-v]').forEach(b => b.classList.toggle('active', b.dataset.v === mc.prefs.view));

  // filtrar, pesquisar e ordenar
  const q = (mc.prefs.q || '').trim().toLowerCase();
  let rows = list.map(dev => ({ dev, r: readings[dev.id], st: states[dev.id] }));
  if(mc.prefs.filter !== 'all') rows = rows.filter(x => mcFilterOf(x.st) === mc.prefs.filter);
  if(q) rows = rows.filter(x => ((x.dev.name || '') + ' ' + (x.dev.ip || '') + ' ' + ((x.r && x.r.pool) || '')).toLowerCase().includes(q));
  const byNum = (f, desc) => (a, b) => ((b.r && b.r.online ? Number(f(b.r)) || 0 : -1) - (a.r && a.r.online ? Number(f(a.r)) || 0 : -1)) * (desc ? 1 : -1);
  const cmp = {
    status: (a, b) => MC_STATUS[a.st].rank - MC_STATUS[b.st].rank || (a.dev.name || '').localeCompare(b.dev.name || ''),
    name: (a, b) => (a.dev.name || '').localeCompare(b.dev.name || '', 'pt', { numeric: true }),
    hash: byNum(r => r.hashrate_raw || (r.hashrate ? r.hashrate * 1e9 : 0), true),
    temp: byNum(r => r.temp, true),
    eff: (a, b) => ((a.r && a.r.online && a.r.efficiency > 0 ? a.r.efficiency : 1e9) - (b.r && b.r.online && b.r.efficiency > 0 ? b.r.efficiency : 1e9))
  }[mc.prefs.sort] || (() => 0);
  rows.sort(cmp);

  board.dataset.view = mc.prefs.view;
  if(!list.length){
    board.className = 'mc-board mc-empty';
    board.innerHTML = '<div class="mc-hint">Ainda não há máquinas. Adicione uma no painel acima ou use <b>Localizar máquinas na rede</b>.</div>';
    mc.els.clear(); mcRenderLog(); return;
  }
  if(!rows.length){
    board.className = 'mc-board mc-empty';
    board.innerHTML = '<div class="mc-hint">Nenhuma máquina corresponde ao filtro ou à pesquisa.</div>';
    mc.els.clear(); mcRenderLog(); return;
  }
  if(mc.prefs.view === 'table'){
    board.className = 'mc-board mc-tablewrap';
    board.innerHTML = mcTableHtml(rows);
    mc.els.clear(); mcRenderLog(); return;
  }
  board.className = 'mc-board mc-grid' + (mc.prefs.view === 'compact' ? ' compact' : '') + (mcFxOn() ? ' mc-fx' : '');
  if(board.querySelector('.mc-hint, table')) board.innerHTML = '';
  const keep = new Set(rows.map(x => x.dev.id));
  mc.els.forEach((el, id) => { if(!keep.has(id)){ el.remove(); mc.els.delete(id); } });
  rows.forEach(({ dev, r, st }, i) => {
    let el = mc.els.get(dev.id);
    if(!el){ el = mcCardEl(dev); mc.els.set(dev.id, el); }
    mcUpdateCard(el, dev, r, st, list.indexOf(dev));
    el.style.setProperty('--i', Math.min(i, 8));
    if(board.children[i] !== el) board.insertBefore(el, board.children[i] || null);
  });
  mcRenderLog();
}

// ---- inclinação em 3D que segue o rato ----
(function(){
  const board = $('mcBoard');
  if(!board) return;
  let cur = null, raf = 0, leaveT = 0;
  const apply = (el, e) => {
    const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', ((.5 - py) * 9).toFixed(2) + 'deg');
    el.style.setProperty('--ry', ((px - .5) * 11).toFixed(2) + 'deg');
    el.style.setProperty('--gx', (px * 100).toFixed(0) + '%');
    el.style.setProperty('--gy', (py * 100).toFixed(0) + '%');
  };
  const reset = el => {
    el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
    clearTimeout(leaveT);
    leaveT = setTimeout(() => { if(cur !== el) el.classList.remove('is-tilt'); }, 320);   // volta a ficar plano (texto nítido)
  };
  board.addEventListener('pointermove', e => {
    if(e.pointerType !== 'mouse' || !board.classList.contains('mc-fx')) return;
    const el = e.target.closest('.mc-card');
    if(el !== cur){ if(cur) reset(cur); cur = el; if(el){ clearTimeout(leaveT); el.classList.add('is-tilt'); } }
    if(!el || raf) return;
    raf = requestAnimationFrame(() => { raf = 0; if(cur) apply(cur, e); });
  });
  board.addEventListener('pointerleave', () => { if(cur){ const el = cur; cur = null; reset(el); } });
})();

// ---- cliques (cartões e tabela) ----
(function(){
  const board = $('mcBoard'), log = $('mcLog');
  const find = id => (devices || []).find(d => String(d.id) === String(id));
  if(board) board.addEventListener('click', async e => {
    const host = e.target.closest('[data-id]');
    const dev = host && find(host.dataset.id);
    if(!dev) return;
    const a = e.target.closest('[data-a]');
    const label = dev.name || dev.ip;
    if(!a){ if(selectedId !== dev.id){ selectedId = dev.id; renderAll(); } return; }
    e.stopPropagation();
    const act = a.dataset.a;
    if(act === 'web' && dev.ip) window.open('http://' + dev.ip, '_blank', 'noopener');
    else if(act === 'more'){ mc.open.has(dev.id) ? mc.open.delete(dev.id) : mc.open.add(dev.id); renderMachineCards(); }
    else if(act === 'remove'){ if(confirm('Remover a máquina "' + label + '"?')) removeDevice(dev.id); }
    else if(act === 'restart'){
      if(!confirm('Reiniciar ' + label + '? A mineração será interrompida temporariamente.')) return;
      const res = await aiRestartDevice(dev);
      setQuickActionStatus(res && res.ok ? '✓ Reinício enviado a ' + label + '.' : '✗ Falhou em ' + label + '.');
    } else if(act === 'eco' || act === 'turbo'){
      const prof = getQuickSlot(act);
      if(!prof || !confirm('Aplicar "' + prof.name + '" (' + qpDescribe(prof) + ') a ' + label + '?')) return;
      const res = await aiApplyProfile(prof, dev);
      setQuickActionStatus(res && res.ok ? '✓ "' + prof.name + '" aplicado a ' + label + '.' : '✗ Falhou em ' + label + '.');
      renderAll();
    }
  });
  if(log) log.addEventListener('click', e => {
    const li = e.target.closest('[data-jump]'), dev = li && find(li.dataset.jump);
    if(!dev) return;
    selectedId = dev.id; mc.prefs.filter = 'all'; mc.prefs.q = ''; if($('mcSearch')) $('mcSearch').value = '';
    renderAll();
    const el = mc.els.get(dev.id);
    if(el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
})();

renderMachineCards();
