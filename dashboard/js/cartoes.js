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
const mc = { prefs: { filter: 'all', sort: 'status', view: 'cards', q: '', fx: 'auto', group: '', groupBy: false, range: 24 }, els: new Map(), heads: new Map(), open: new Set(), picked: new Set(), collapsed: new Set(), visible: [],
  prev: {}, since: {}, log: [], recordUntil: {} };
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
// nome da interface web de cada tipo de máquina
function mcOsName(model){ return model === 'NerdQAxe' ? 'NerdOS' : model === 'Bitaxe' ? 'AxeOS' : 'Interface'; }
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
function mcTrendOf(dev){ return mcTrend(mcSeries(dev.id)); }
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

// avisos legíveis para cada máquina (cada um com um código, usado pelos alertas)
function mcAlertItems(dev, r, st, trend){
  const out = [];
  const add = (lvl, txt, code) => out.push({ lvl, txt, code });
  if(!r){ add('muted', '⏳ À espera de dados', 'wait'); return out; }
  if(!r.online){
    if(r.portalMode) add('info', '📶 Em modo de configuração Wi-Fi', 'portal');
    else { const s = mc.since[dev.id]; add('bad', '🔌 Offline' + (s ? ' há ' + mcAgo(Date.now() - s) : ''), 'off'); }
    return out;
  }
  if(mc.recordUntil[dev.id] > Date.now()) add('gold', '🏆 Novo recorde de dificuldade', 'record');
  const n0 = out.length;
  if(r.temp >= 75) add('bad', '🔥 Temperatura crítica ' + Number(r.temp).toFixed(0) + ' °C', 'temp');
  else if(r.temp >= 65) add('warn', '🌡️ Quente ' + Number(r.temp).toFixed(0) + ' °C', 'temp');
  if(r.vrTemp != null && r.vrTemp >= 85) add('bad', '⚡ VR a ' + Number(r.vrTemp).toFixed(0) + ' °C', 'vr');
  const sh = (r.accepted || 0) + (r.rejected || 0);
  if(sh > 20 && r.rejected / sh > 0.02) add('warn', '⚠️ Rejeições ' + (r.rejected / sh * 100).toFixed(1) + '%', 'rej');
  if(r.rssi != null && r.rssi <= -80) add('warn', '📶 Wi-Fi fraco ' + r.rssi + ' dBm', 'wifi');
  if(r.poolPing != null && r.poolPing > 400) add('warn', '🐢 Pool lenta ' + Math.round(r.poolPing) + ' ms', 'ping');
  if(r.poolInfo && r.poolInfo.usingFallback) add('info', '↪ A usar a pool de reserva', 'fallback');
  if(trend != null && trend <= -30) add('warn', '📉 Hashrate em queda ' + Math.abs(trend).toFixed(0) + '%', 'drop');
  if(out.length === n0) add('good', '✓ Tudo normal', 'ok');
  return out;
}
function mcAlerts(dev, r, st, trend){
  return mcAlertItems(dev, r, st, trend).map(a => '<span class="mc-chip ' + a.lvl + '">' + a.txt + '</span>');
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
    '<header class="mc-head"><label class="mc-pick" title="Selecionar para ações em grupo"><input type="checkbox" data-a="pick" aria-label="Selecionar máquina"></label><span class="mc-dot" data-f="dot"></span>' +
      '<div class="mc-title"><b data-f="name"></b><small data-f="ip"></small></div>' +
      '<span class="mc-model" data-f="model"></span></header>' +
    '<div class="mc-status-row"><span class="mc-status" data-f="status"></span><span class="mc-algo" data-f="algo"></span><span class="mc-gchip" data-f="group" hidden></span></div>' +
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
  return row('Temp. VR', r && r.online ? mcNum(r.vrTemp, 1) + ' °C' : '—') + row('Frequência', r && r.online ? mcNum(r.frequency, 0) + ' MHz' : '—') +
    row('Entrada', inParts.length ? inParts.join(' · ') : '—') + row('Latência local', r && r.online ? mcNum(r.localLatency, 0) + ' ms' : '—') +
    row('Firmware', r && r.online && r.firmware ? r.firmware : '—') + row('Modelo', r && (r.asicModel || r.deviceModel) ? (r.asicModel || r.deviceModel) : '—') +
    row('Algoritmo', r && r.algorithm ? String(r.algorithm).toUpperCase() : 'SHA256') + row('Última manutenção', last && typeof formatMaintDate === 'function' ? formatMaintDate(last) : 'nunca registada');
}
// histórico (hashrate e temperatura) da máquina nas últimas 1, 6 ou 24 horas
function mcHistoryHtml(dev){
  const hrs = mc.prefs.range || 24, cutoff = Date.now() - hrs * 3600e3;
  const btns = [1, 6, 24].map(n => '<button type="button" data-a="range" data-r="' + n + '" class="' + (hrs === n ? 'on' : '') + '">' + n + ' h</button>').join('');
  const head = '<div class="mc-hist-head"><span>Histórico</span><div>' + btns + '</div></div>';
  const h = (histories[dev.id] || []).filter(x => x && x.ts >= cutoff && x.hashrate != null && isFinite(x.hashrate));
  if(h.length < 4) return head + '<div class="mc-hist-empty">A recolher dados… o gráfico aparece passados alguns minutos (a dashboard guarda até 24 h enquanto está aberta).</div>';
  const W = 300, H = 90, t0 = h[0].ts, span = Math.max(1, h[h.length - 1].ts - t0);
  const hv = h.map(x => Number(x.hashrate)), hmax = Math.max(...hv), hmin = Math.min(...hv), hs = (hmax - hmin) || hmax * .1 || 1;
  const X = x => ((x.ts - t0) / span * W).toFixed(1);
  const hp = h.map((x, i) => (i ? 'L' : 'M') + X(x) + ' ' + (H - 6 - (Number(x.hashrate) - hmin) / hs * (H - 16)).toFixed(1)).join('');
  const tp = h.filter(x => isFinite(x.temp) && x.temp > 0).map((x, i) => (i ? 'L' : 'M') + X(x) + ' ' + (H - 4 - (Math.min(90, Math.max(30, x.temp)) - 30) / 60 * (H - 12)).toFixed(1)).join('');
  const temps = h.map(x => Number(x.temp)).filter(v => isFinite(v) && v > 0);
  const avg = hv.reduce((a, b) => a + b, 0) / hv.length, fm = v => { const f = formatHashrate(v); return f.value + ' ' + f.unit; };
  const tm = t => new Date(t).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  return head + '<svg class="mc-hist-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
    [.25, .5, .75].map(g => '<line x1="0" x2="' + W + '" y1="' + (H * g).toFixed(0) + '" y2="' + (H * g).toFixed(0) + '"/>').join('') +
    '<path class="harea" d="' + hp + 'L' + W + ' ' + H + 'L0 ' + H + 'Z"/><path class="hline" d="' + hp + '"/>' + (tp ? '<path class="tline" d="' + tp + '"/>' : '') + '</svg>' +
    '<div class="mc-hist-axis"><span>' + tm(t0) + '</span><span>' + tm(h[h.length - 1].ts) + '</span></div>' +
    '<div class="mc-hist-stats"><span>Média <b>' + fm(avg) + '</b></span><span>Máx. <b>' + fm(hmax) + '</b></span><span>Mín. <b>' + fm(hmin) + '</b></span>' +
    (temps.length ? '<span class="t">Temp. máx. <b>' + Math.max(...temps).toFixed(0) + ' °C</b></span>' : '') + '</div>';
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
  const pk = el.querySelector('[data-a="pick"]');
  if(pk){ pk.checked = mc.picked.has(dev.id); el.classList.toggle('is-pick', pk.checked); }
  const gc = el.querySelector('[data-f="group"]');
  gc.hidden = !dev.group; mcSet(el, 'group', dev.group ? '🗂 ' + dev.group : '');
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
  // detalhes extra (só se estiver aberto): histórico, dados técnicos e grupo
  const more = el.querySelector('[data-f="more"]');
  const setHtml = (n, h) => { if(n && n.dataset.s !== h){ n.dataset.s = h; n.innerHTML = h; } };
  if(mc.open.has(dev.id)){
    if(!more.dataset.shell){
      more.innerHTML = '<div class="mc-hist"></div><div class="mc-more-grid"></div><label class="mc-grp"><span>Grupo</span><input type="text" list="mcGroupList" data-a="group" placeholder="sem grupo" maxlength="24"></label>';
      more.dataset.shell = '1';
    }
    setHtml(more.querySelector('.mc-hist'), mcHistoryHtml(dev));
    setHtml(more.querySelector('.mc-more-grid'), mcMoreHtml(dev, r));
    const gi = more.querySelector('[data-a="group"]');
    if(document.activeElement !== gi) gi.value = dev.group || '';
  } else if(more.dataset.shell){ more.innerHTML = ''; delete more.dataset.shell; }
  el.querySelector('[data-a="more"]').textContent = mc.open.has(dev.id) ? '▴ Menos' : '⋯ Detalhes';
  // atalhos de perfis só aparecem se existirem
  ['eco', 'turbo'].forEach(slot => {
    const b = el.querySelector('[data-a="' + slot + '"]'), prof = typeof getQuickSlot === 'function' ? getQuickSlot(slot) : null;
    if(b){ b.hidden = !prof || !on; if(prof) b.title = 'Aplicar "' + prof.name + '"'; }
  });
  const web = el.querySelector('[data-a="web"]'), os = mcOsName(model);
  web.hidden = !dev.ip; web.textContent = '↗ ' + os; web.title = 'Abrir a interface da máquina (' + os + ')';
}

// ---- tabela ----
function mcTableHtml(rows){
  const th = h => '<th>' + h + '</th>';
  let html = '<table class="mc-table"><thead><tr>' + ['', '', 'Máquina', 'Grupo', 'Estado', 'Hashrate', 'Temp.', 'Consumo', 'Efic.', 'Wi-Fi', 'Ping', 'Rej.', 'Uptime', ''].map(th).join('') + '</tr></thead><tbody>';
  rows.forEach(({ dev, r, st }) => {
    const on = !!(r && r.online), S = MC_STATUS[st], [hv, hu] = mcHashText(r);
    const sh = on ? (r.accepted || 0) + (r.rejected || 0) : 0, rej = sh ? r.rejected / sh * 100 : 0;
    html += '<tr data-id="' + escapeHtml(String(dev.id)) + '" class="' + (selectedId === dev.id ? 'is-sel' : '') + '">' +
      '<td><input type="checkbox" data-a="pick"' + (mc.picked.has(dev.id) ? ' checked' : '') + ' aria-label="Selecionar"></td>' +
      '<td><span class="mc-dot" style="--mc-c:' + S.color + '"></span></td>' +
      '<td><b>' + escapeHtml(dev.name || '') + '</b><small>' + escapeHtml(dev.ip || '') + '</small></td>' +
      '<td>' + (dev.group ? '<span class="mc-gchip">🗂 ' + escapeHtml(dev.group) + '</span>' : '<small>—</small>') + '</td>' +
      '<td style="color:' + S.color + '">' + S.label + '</td>' +
      '<td><b>' + escapeHtml(hv) + '</b> <small>' + escapeHtml(hu) + '</small></td>' +
      '<td class="' + (on ? mcTempLevel(r.temp) : '') + '">' + (on ? mcNum(r.temp, 1) + ' °C' : '—') + '</td>' +
      '<td>' + (on ? mcNum(r.power, 1) + ' W' : '—') + '</td><td>' + (on ? mcNum(r.efficiency, 1) : '—') + '</td>' +
      '<td>' + (on && r.rssi != null ? r.rssi + ' dBm' : '—') + '</td><td>' + (on && r.poolPing != null ? Math.round(r.poolPing) + ' ms' : '—') + '</td>' +
      '<td class="' + (sh > 20 && rej > 2 ? 'warn' : '') + '">' + (sh > 20 ? rej.toFixed(1) + '%' : '—') + '</td>' +
      '<td>' + (on ? formatUptime(r.uptime).text : '—') + '</td>' +
      '<td class="mc-tact"><button type="button" data-a="web" title="Abrir a interface da máquina"' + (dev.ip ? '' : ' hidden') + '>↗</button><button type="button" data-a="restart" title="Reiniciar">⟲</button><button type="button" data-a="remove" class="mc-danger" title="Remover">✕</button></td></tr>';
  });
  return html + '</tbody></table>';
}

// ---- barra de ferramentas, registo e render principal ----
function mcSavePrefs(){ try { localStorage.setItem(MC_KEY, JSON.stringify(mc.prefs)); } catch(e) {} }
function mcBuildToolbar(){
  const tb = $('mcToolbar');
  if(!tb || tb.dataset.ready) return;
  tb.dataset.ready = '1';
  tb.insertAdjacentHTML('beforebegin', '<div class="mc-summary" id="mcSummary"></div>');
  tb.insertAdjacentHTML('afterend', '<div class="mc-bulk" id="mcBulk" hidden></div><datalist id="mcGroupList"></datalist>');
  tb.innerHTML =
    '<div class="mc-chips" id="mcChips"></div>' +
    '<div class="mc-tools"><input type="search" id="mcSearch" placeholder="Pesquisar nome, IP ou pool" aria-label="Pesquisar máquinas">' +
    '<select id="mcGroup" aria-label="Filtrar por grupo"></select>' +
    '<select id="mcSort" aria-label="Ordenar por">' + MC_SORTS.map(([k, l]) => '<option value="' + k + '">' + l + '</option>').join('') + '</select>' +
    '<button type="button" class="mc-fx-btn" id="mcGroupBy" title="Mostrar as máquinas separadas por grupo">🗂 Agrupar</button>' +
    '<button type="button" class="mc-fx-btn" id="mcFx" title="Efeitos 3D nos cartões">✨ 3D</button><div class="mc-views" id="mcViews"><button type="button" data-v="cards" title="Cartões">▦</button><button type="button" data-v="compact" title="Compacto">▥</button><button type="button" data-v="table" title="Tabela">☰</button></div></div>';
  $('mcSearch').value = mc.prefs.q || '';
  $('mcFx').addEventListener('click', () => { mc.prefs.fx = !mcFxOn(); mcSavePrefs(); renderMachineCards(); });
  $('mcGroupBy').addEventListener('click', () => { mc.prefs.groupBy = !mc.prefs.groupBy; mcSavePrefs(); renderMachineCards(); });
  $('mcSort').value = mc.prefs.sort;
  $('mcSearch').addEventListener('input', e => { mc.prefs.q = e.target.value; mcSavePrefs(); renderMachineCards(); });
  $('mcSort').addEventListener('change', e => { mc.prefs.sort = e.target.value; mcSavePrefs(); renderMachineCards(); });
  $('mcGroup').addEventListener('change', e => { mc.prefs.group = e.target.value; mcSavePrefs(); renderMachineCards(); });
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

// ---- grupos ----
function mcGroupsOf(list){ return [...new Set(list.map(d => d.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt')); }
function mcFillGroups(list){
  const gs = mcGroupsOf(list), sel = $('mcGroup'), dl = $('mcGroupList');
  if(dl){ const h = gs.map(g => '<option value="' + escapeHtml(g) + '">').join(''); if(dl.dataset.s !== h){ dl.dataset.s = h; dl.innerHTML = h; } }
  if(!sel) return;
  if(mc.prefs.group && mc.prefs.group !== '__none' && !gs.includes(mc.prefs.group)) mc.prefs.group = '';
  const h = '<option value="">Todos os grupos</option>' + gs.map(g => '<option value="' + escapeHtml(g) + '">🗂 ' + escapeHtml(g) + '</option>').join('') + (gs.length ? '<option value="__none">Sem grupo</option>' : '');
  if(sel.dataset.s !== h){ sel.dataset.s = h; sel.innerHTML = h; }
  sel.value = mc.prefs.group || '';
  sel.hidden = !gs.length;
  if($('mcGroupBy')) { $('mcGroupBy').hidden = !gs.length; $('mcGroupBy').classList.toggle('active', !!mc.prefs.groupBy && gs.length > 0); }
}
function mcGroupHead(name, items){
  let el = mc.heads.get(name);
  if(!el){
    el = document.createElement('div'); el.className = 'mc-ghead'; el.dataset.g = name;
    el.innerHTML = '<button type="button" data-a="gtoggle" class="mc-gtoggle" aria-label="Abrir ou fechar o grupo">▾</button><b></b><span class="mc-gstats"></span>';
    mc.heads.set(name, el);
  }
  const online = items.filter(x => x.r && x.r.online), gh = online.reduce((s, x) => s + (algoGroupOf(x.r) === 'sha256' ? Number(x.r.hashrate) || 0 : 0), 0);
  const bad = items.filter(x => x.st === 'hot' || x.st === 'off').length, warn = items.filter(x => x.st === 'warm' || x.st === 'warn').length;
  const f = formatHashrate(gh);
  el.classList.toggle('closed', mc.collapsed.has(name));
  el.querySelector('b').textContent = name ? '🗂 ' + name : 'Sem grupo';
  el.querySelector('.mc-gstats').innerHTML = items.length + ' máquina' + (items.length === 1 ? '' : 's') + ' · ' + online.length + ' online' + (gh ? ' · <i>' + f.value + ' ' + f.unit + '</i>' : '') +
    (bad ? ' · <i class="bad">' + bad + ' em falha</i>' : '') + (warn ? ' · <i class="warn">' + warn + ' com aviso</i>' : '');
  return el;
}

// ---- seleção e ações em grupo ----
function mcRenderBulk(){
  const bar = $('mcBulk'), board = $('mcBoard');
  if(!bar) return;
  const n = mc.picked.size;
  board.classList.toggle('has-pick', n > 0);
  bar.hidden = n === 0;
  if(!n){ bar.innerHTML = ''; return; }
  const q = slot => { const p = typeof getQuickSlot === 'function' ? getQuickSlot(slot) : null; return p ? p.name : null; };
  const html = '<b>✓ ' + n + ' selecionada' + (n === 1 ? '' : 's') + '</b>' +
    (q('eco') ? '<button type="button" data-b="eco">🌿 ' + escapeHtml(q('eco')) + '</button>' : '') + (q('turbo') ? '<button type="button" data-b="turbo">🚀 ' + escapeHtml(q('turbo')) + '</button>' : '') +
    '<button type="button" data-b="restart">⟲ Reiniciar</button><button type="button" data-b="group">🗂 Pôr num grupo…</button>' +
    '<span class="mc-bulk-sp"></span><button type="button" data-b="all">Selecionar as visíveis</button><button type="button" data-b="clear">Limpar</button>';
  if(bar.dataset.s !== html){ bar.dataset.s = html; bar.innerHTML = html; }
}
async function mcBulkRun(kind){
  const devs = (devices || []).filter(d => mc.picked.has(d.id));
  if(!devs.length) return;
  if(kind === 'clear'){ mc.picked.clear(); renderMachineCards(); return; }
  if(kind === 'all'){ (mc.visible || []).forEach(id => mc.picked.add(id)); renderMachineCards(); return; }
  if(kind === 'group'){
    const g = prompt('Nome do grupo para as ' + devs.length + ' máquinas (deixe vazio para as tirar do grupo):', devs[0].group || '');
    if(g === null) return;
    devs.forEach(d => { if(g.trim()) d.group = g.trim().slice(0, 24); else delete d.group; });
    saveDevices(); mc.picked.clear(); renderAll(); return;
  }
  const names = devs.map(d => d.name || d.ip).join(', ');
  if(kind === 'restart'){
    if(!confirm('Reiniciar ' + devs.length + ' máquina(s)?\n' + names + '\nA mineração será interrompida temporariamente.')) return;
    let ok = 0;
    for(const d of devs){ setQuickActionStatus('⟲ A reiniciar ' + (d.name || d.ip) + '…'); const res = await aiRestartDevice(d); if(res && res.ok) ok++; }
    setQuickActionStatus('✓ Reinício enviado a ' + ok + ' de ' + devs.length + ' máquinas.');
    return;
  }
  const prof = getQuickSlot(kind);
  if(!prof) return;
  if(!confirm('Aplicar "' + prof.name + '" (' + qpDescribe(prof) + ') a ' + devs.length + ' máquina(s)?\n' + names)) return;
  let ok = 0;
  for(const d of devs){ if(!(readings[d.id] && readings[d.id].online)) continue; setQuickActionStatus('⚙ A aplicar a ' + (d.name || d.ip) + '…'); const res = await aiApplyProfile(prof, d); if(res && res.ok) ok++; }
  setQuickActionStatus('✓ "' + prof.name + '" aplicado a ' + ok + ' de ' + devs.length + ' máquinas.');
  renderAll();
}

function renderMachineCards(){
  const board = $('mcBoard');
  if(!board) return;
  mcBuildToolbar();
  const list = Array.isArray(devices) ? devices : [];
  const states = {};
  list.forEach(d => { states[d.id] = mcStateOf(readings[d.id]); });
  mcTrackStates(list, states);
  [...mc.picked].forEach(id => { if(!list.some(d => d.id === id)) mc.picked.delete(id); });
  if($('mcCount')) $('mcCount').textContent = list.length + ' máquina' + (list.length === 1 ? '' : 's');
  mcFillGroups(list);
  if(typeof mcExtraRender === 'function') mcExtraRender(list, states);

  // filtros com contagens
  const counts = { all: list.length, ok: 0, warn: 0, hot: 0, off: 0 };
  list.forEach(d => { const f = mcFilterOf(states[d.id]); if(counts[f] != null) counts[f]++; });
  const chips = $('mcChips');
  if(chips){
    const html = MC_FILTERS.map(([k, l]) => '<button type="button" data-flt="' + k + '" class="mc-fchip ' + k + (mc.prefs.filter === k ? ' active' : '') + (counts[k] ? '' : ' zero') + '">' + l + ' <b>' + counts[k] + '</b></button>').join('');
    if(chips.dataset.s !== html){ chips.dataset.s = html; chips.innerHTML = html; }
  }
  if($('mcFx')) {
    const on = mcFxOn(), perf = typeof hcPerfMode !== 'undefined' && hcPerfMode;
    $('mcFx').classList.toggle('active', on);
    $('mcFx').title = on ? 'Desligar os efeitos 3D' : perf && mc.prefs.fx === 'auto' ? 'O modo Desempenho está ativo. Clique para ligar os efeitos 3D mesmo assim' : 'Ligar os efeitos 3D';
  }
  $('mcViews') && $('mcViews').querySelectorAll('[data-v]').forEach(b => b.classList.toggle('active', b.dataset.v === mc.prefs.view));

  // filtrar, pesquisar e ordenar
  const q = (mc.prefs.q || '').trim().toLowerCase();
  let rows = list.map(dev => ({ dev, r: readings[dev.id], st: states[dev.id] }));
  if(mc.prefs.filter !== 'all') rows = rows.filter(x => mcFilterOf(x.st) === mc.prefs.filter);
  if(mc.prefs.group === '__none') rows = rows.filter(x => !x.dev.group);
  else if(mc.prefs.group) rows = rows.filter(x => x.dev.group === mc.prefs.group);
  if(q) rows = rows.filter(x => ((x.dev.name || '') + ' ' + (x.dev.ip || '') + ' ' + (x.dev.group || '') + ' ' + ((x.r && x.r.pool) || '')).toLowerCase().includes(q));
  const byNum = (f, desc) => (a, b) => ((b.r && b.r.online ? Number(f(b.r)) || 0 : -1) - (a.r && a.r.online ? Number(f(a.r)) || 0 : -1)) * (desc ? 1 : -1);
  const cmp = {
    status: (a, b) => MC_STATUS[a.st].rank - MC_STATUS[b.st].rank || (a.dev.name || '').localeCompare(b.dev.name || ''),
    name: (a, b) => (a.dev.name || '').localeCompare(b.dev.name || '', 'pt', { numeric: true }),
    hash: byNum(r => r.hashrate_raw || (r.hashrate ? r.hashrate * 1e9 : 0), true),
    temp: byNum(r => r.temp, true),
    eff: (a, b) => ((a.r && a.r.online && a.r.efficiency > 0 ? a.r.efficiency : 1e9) - (b.r && b.r.online && b.r.efficiency > 0 ? b.r.efficiency : 1e9))
  }[mc.prefs.sort] || (() => 0);
  rows.sort(cmp);
  mc.visible = rows.map(x => x.dev.id);

  board.dataset.view = mc.prefs.view;
  mcRenderBulk();
  if(!list.length){
    board.className = 'mc-board mc-empty';
    board.innerHTML = '<div class="mc-hint">Ainda não há máquinas. Adicione uma no painel acima ou use <b>Localizar máquinas na rede</b>.</div>';
    mc.els.clear(); mc.heads.clear(); mcRenderLog(); return;
  }
  if(!rows.length){
    board.className = 'mc-board mc-empty';
    board.innerHTML = '<div class="mc-hint">Nenhuma máquina corresponde ao filtro ou à pesquisa.</div>';
    mc.els.clear(); mc.heads.clear(); mcRenderLog(); return;
  }
  if(mc.prefs.view === 'table'){
    board.className = 'mc-board mc-tablewrap' + (mc.picked.size ? ' has-pick' : '');
    board.innerHTML = mcTableHtml(rows);
    mc.els.clear(); mc.heads.clear(); mcRenderLog(); return;
  }
  board.className = 'mc-board mc-grid' + (mc.prefs.view === 'compact' ? ' compact' : '') + (mcFxOn() ? ' mc-fx' : '') + (mc.picked.size ? ' has-pick' : '');
  if(board.querySelector('.mc-hint, table')) board.innerHTML = '';

  // ordem final dos nós: cartões, ou cabeçalhos de grupo com os respetivos cartões
  const nodes = [], useHeads = new Set();
  if(mc.prefs.groupBy && mcGroupsOf(list).length){
    const groups = new Map();
    rows.forEach(x => { const g = x.dev.group || ''; if(!groups.has(g)) groups.set(g, []); groups.get(g).push(x); });
    [...groups.keys()].sort((a, b) => a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'pt')).forEach(g => {
      useHeads.add(g); nodes.push(mcGroupHead(g, groups.get(g)));
      if(!mc.collapsed.has(g)) groups.get(g).forEach(x => nodes.push(x));
    });
  } else rows.forEach(x => nodes.push(x));
  mc.heads.forEach((el, g) => { if(!useHeads.has(g)){ el.remove(); mc.heads.delete(g); } });
  const keep = new Set(nodes.filter(n => n.dev).map(n => n.dev.id));
  mc.els.forEach((el, id) => { if(!keep.has(id)){ el.remove(); mc.els.delete(id); } });
  let ci = 0;
  nodes.forEach((n, i) => {
    let el = n;
    if(n.dev){
      const { dev, r, st } = n;
      el = mc.els.get(dev.id);
      if(!el){ el = mcCardEl(dev); mc.els.set(dev.id, el); }
      mcUpdateCard(el, dev, r, st, list.indexOf(dev));
      el.style.setProperty('--i', Math.min(ci++, 8));
    }
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

// ---- cliques (cartões, tabela, grupos e barra de seleção) ----
(function(){
  const board = $('mcBoard'), log = $('mcLog');
  const find = id => (devices || []).find(d => String(d.id) === String(id));
  if(board) board.addEventListener('click', async e => {
    const gh = e.target.closest('.mc-ghead');
    if(gh){
      const g = gh.dataset.g;
      mc.collapsed.has(g) ? mc.collapsed.delete(g) : mc.collapsed.add(g);
      renderMachineCards(); return;
    }
    const host = e.target.closest('[data-id]');
    const dev = host && find(host.dataset.id);
    if(!dev) return;
    const a = e.target.closest('[data-a]');
    const label = dev.name || dev.ip;
    if(!a){ if(e.target.closest('.mc-pick, .mc-grp, .mc-hist')) return; if(selectedId !== dev.id){ selectedId = dev.id; renderAll(); } return; }
    const act = a.dataset.a;
    if(act === 'group') return;
    e.stopPropagation();
    if(act === 'pick'){
      a.checked ? mc.picked.add(dev.id) : mc.picked.delete(dev.id);
      const card = mc.els.get(dev.id); if(card) card.classList.toggle('is-pick', a.checked);
      mcRenderBulk(); return;
    }
    if(act === 'range'){ mc.prefs.range = Number(a.dataset.r) || 24; mcSavePrefs(); renderMachineCards(); return; }
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
  // o grupo de uma máquina guarda-se ao sair do campo ou com Enter
  if(board) board.addEventListener('change', e => {
    const inp = e.target.closest('[data-a="group"]');
    const host = inp && inp.closest('[data-id]');
    const dev = host && find(host.dataset.id);
    if(!dev) return;
    const g = inp.value.trim().slice(0, 24);
    if(g) dev.group = g; else delete dev.group;
    saveDevices(); renderAll();
  });
  const bulk = $('mcBulk') || document.body;
  document.addEventListener('click', e => {
    const b = e.target.closest('#mcBulk [data-b]');
    if(b) mcBulkRun(b.dataset.b);
  });
  if(log) log.addEventListener('click', e => {
    const li = e.target.closest('[data-jump]'), dev = li && find(li.dataset.jump);
    if(!dev) return;
    selectedId = dev.id; mc.prefs.filter = 'all'; mc.prefs.q = ''; mc.prefs.group = ''; if($('mcSearch')) $('mcSearch').value = '';
    renderAll();
    const el = mc.els.get(dev.id);
    if(el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
})();

renderMachineCards();
