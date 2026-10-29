// ---------- Cartões das máquinas ----------
// Um cartão por máquina, com o que interessa à primeira vista: estado, hashrate com mini-gráfico e
// tendência, avisos (temperatura, Wi-Fi, rejeições, pool...), medidores e ações. Há filtros por estado,
// pesquisa, ordenação e três vistas (cartões, compacto e tabela). Os cartões são atualizados no lugar
// (sem os refazer), por isso as barras animam e o rato não perde o foco.
const MC_KEY = 'nerdqaxe:cards_prefs';
const MC_LOG_KEY = 'nerdqaxe:cards_log';
const MC_STATUS = {
  ok:     { get label(){ return t('mc_st_ok'); },     color: 'var(--green)', rank: 5 },
  warn:   { get label(){ return t('mc_st_warn'); },   color: 'var(--amber)', rank: 4 },
  warm:   { get label(){ return t('mc_st_warm'); },   color: 'var(--amber)', rank: 3 },
  hot:    { get label(){ return t('mc_st_hot'); },    color: 'var(--red)',   rank: 0 },
  off:    { get label(){ return t('mc_st_off'); },    color: 'var(--red)',   rank: 1 },
  portal: { get label(){ return t('mc_st_portal'); }, color: 'var(--cyan)',  rank: 2 },
  idle:   { get label(){ return t('mc_st_idle'); },   color: 'var(--muted)', rank: 6 }
};
const MC_FILTERS = [['all', 'mc_f_all'], ['ok', 'mc_st_ok'], ['warn', 'mc_st_warn'], ['hot', 'mc_st_hot'], ['off', 'mc_st_off']];
const MC_SORTS = [['status', 'mc_s_status'], ['name', 'mc_s_name'], ['hash', 'mc_s_hash'], ['temp', 'mc_s_temp'], ['eff', 'mc_s_eff']];
const mc = { prefs: { filter: 'all', sort: 'status', view: 'cards', q: '', fx: 'auto', group: '', groupBy: false, range: 24 }, els: new Map(), heads: new Map(), open: new Set(), picked: new Set(), collapsed: new Set(), visible: [],
  prev: {}, since: {}, log: [], recordUntil: {}, rank: {}, acc: {} };
try { Object.assign(mc.prefs, JSON.parse(localStorage.getItem(MC_KEY) || '{}')); } catch(e) {}
try { mc.log = JSON.parse(localStorage.getItem(MC_LOG_KEY) || '[]').filter(e => new Date(e.t).toDateString() === new Date().toDateString()); } catch(e) { mc.log = []; }

// limites que decidem o estado e os avisos (configuráveis no menu ⚙ > Limites de alerta)
const MC_TH_KEY = 'nerdqaxe:thresholds';
const MC_TH_DEFAULT = { tempWarm: 65, tempHot: 75, vrHot: 85, rej: 2, wifi: -80, ping: 400, stuckMin: 10 };
mc.th = Object.assign({}, MC_TH_DEFAULT);
try { Object.assign(mc.th, JSON.parse(localStorage.getItem(MC_TH_KEY) || '{}')); } catch(e) {}

// efeitos 3D (inclinação, profundidade, reflexo): desligam-se no modo Desempenho e com "reduzir movimento"
function mcFxOn(){
  let reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e) {}
  if(reduced || mc.prefs.fx === false) return false;
  if(mc.prefs.fx === true) return true;   // escolha explícita do botão: ganha ao modo Desempenho
  return !(typeof hcPerfMode !== 'undefined' && hcPerfMode);
}
// Máquina "presa": online, mas sem novas partilhas aceites há MC_STUCK_MIN minutos, ou com o hashrate a zero.
// O aviso fica na própria leitura (r.mcStuck, em minutos) para o estado e os alertas o verem.
const MC_ZERO_MIN = 3;
function mcStuckWatch(list){
  const now = Date.now();
  list.forEach(dev => {
    const r = readings[dev.id];
    if(!r || !r.online){ delete mc.acc[dev.id]; return; }
    const a = mc.acc[dev.id] || (mc.acc[dev.id] = { v: null, t: now, z: null });
    const acc = Number(r.accepted);
    const hash = Number(r.hashrate_raw != null ? r.hashrate_raw : r.hashrate);
    if(isFinite(acc)){
      if(a.v == null || acc !== a.v){
        if(a.v != null && acc > a.v){ (a.gaps = a.gaps || []).push((now - a.t) / 60000); if(a.gaps.length > 8) a.gaps.shift(); }   // minutos entre partilhas aceites
        a.v = acc; a.t = now;
      }   // contador mudou (ou voltou a zero num reinício)
    }
    if(isFinite(hash) && hash <= 0){ if(a.z == null) a.z = now; } else a.z = null;
    // máquinas lentas com dificuldade alta ficam normalmente mais de 10 min sem partilha: o limite sobe para 4x o intervalo esperado
    // (dificuldade x 2^32 / hashrate) ou 2,5x o maior intervalo visto, para não avisar "atenção" a cada partilha que demora
    const diff = Number(r.poolDifficulty || r.stratumDifficulty), expMin = diff > 0 && hash > 0 ? diff * 4294967296 / hash / 60 : 0;
    const SM = Math.max(mc.th.stuckMin, expMin * 4, (a.gaps && a.gaps.length ? Math.max(...a.gaps) : 0) * 2.5), boot = Number(r.uptime) > 0 && Number(r.uptime) < SM * 60;       // acabou de arrancar: ainda é cedo
    const idleMin = (now - a.t) / 60000, zeroMin = a.z ? (now - a.z) / 60000 : 0;
    if(!boot && isFinite(acc) && idleMin >= SM) r.mcStuck = { kind: 'shares', min: Math.round(idleMin) };
    else if(zeroMin >= MC_ZERO_MIN) r.mcStuck = { kind: 'zero', min: Math.round(zeroMin) };
    else delete r.mcStuck;
  });
}
function mcStateOf(r){
  if(!r) return 'idle';
  if(!r.online) return r.portalMode ? 'portal' : 'off';
  const temp = Number(r.temp);
  if(temp >= mc.th.tempHot || (r.vrTemp != null && r.vrTemp >= mc.th.vrHot)) return 'hot';
  if(temp >= mc.th.tempWarm) return 'warm';
  if(r.mcStuck) return 'warn';
  const shares = (r.accepted || 0) + (r.rejected || 0);
  if((shares > 20 && r.rejected / shares > mc.th.rej / 100) || (r.rssi != null && r.rssi <= mc.th.wifi) || (r.poolPing != null && r.poolPing > mc.th.ping)) return 'warn';
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
function mcOsName(model){ return model === 'NerdQAxe' ? 'NerdOS' : model === 'Bitaxe' ? 'AxeOS' : t('mc_interface'); }
function mcHashText(r){
  if(!r || !r.online) return ['—', ''];
  if(r.hashrate_display){ const m = String(r.hashrate_display).match(/^([\d.,]+)\s*(.*)$/); return m ? [m[1], m[2]] : [r.hashrate_display, '']; }
  const f = formatHashrate(r.hashrate);
  return [f.value, f.unit];
}
const mcNum = (v, d) => (v != null && isFinite(v) && Number(v) !== 0) ? Number(v).toFixed(d) : '—';
const mcSignal = rssi => rssi == null ? 0 : rssi >= -55 ? 4 : rssi >= -65 ? 3 : rssi >= -75 ? 2 : rssi >= -85 ? 1 : 0;
function mcTempLevel(t){ return t >= mc.th.tempHot ? 'bad' : t >= mc.th.tempWarm ? 'warn' : 'ok'; }

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

// gráfico grande e discreto no fundo do cartão: hashrate (área) e temperatura (tracejado) das últimas leituras
function mcBgChart(el, dev, on){
  const bga = el.querySelector('[data-f="bga"]'), bgl = el.querySelector('[data-f="bgl"]'), bgt = el.querySelector('[data-f="bgt"]'), dot = el.querySelector('[data-f="bgdot"]');
  if(!bga) return;
  const h = on ? (histories[dev.id] || []).filter(x => x && x.hashrate != null && isFinite(x.hashrate)).slice(-90) : [];
  if(h.length < 4){ [bga, bgl, bgt].forEach(n => n.setAttribute('d', '')); dot.style.opacity = 0; return; }
  const hv = h.map(x => Number(x.hashrate)), min = Math.min(...hv), max = Math.max(...hv), span = (max - min) || Math.max(max * .1, 1e-9);
  const X = i => i / (h.length - 1) * 200, Y = v => 92 - (v - min) / span * 52;
  const line = hv.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('');
  bgl.setAttribute('d', line); bga.setAttribute('d', line + 'L200 100L0 100Z');
  const tp = h.map((x, i) => isFinite(x.temp) && x.temp > 0 ? 'L' + X(i).toFixed(1) + ' ' + (96 - (Math.min(90, Math.max(30, x.temp)) - 30) / 60 * 70).toFixed(1) : '').join('');
  bgt.setAttribute('d', tp.replace(/^L/, 'M'));
  dot.style.opacity = 1; dot.style.top = Y(hv[hv.length - 1]).toFixed(1) + '%';
}

// avisos legíveis para cada máquina (cada um com um código, usado pelos alertas)
function mcAlertItems(dev, r, st, trend){
  const out = [];
  const add = (lvl, txt, code) => out.push({ lvl, txt, code });
  if(!r){ add('muted', t('mc_a_wait'), 'wait'); return out; }
  if(!r.online){
    if(r.portalMode) add('info', t('mc_a_portal'), 'portal');
    else { const s = mc.since[dev.id]; add('bad', s ? mct('mc_a_offsince', mcAgo(Date.now() - s)) : t('mc_a_off'), 'off'); }
    return out;
  }
  if(mc.recordUntil[dev.id] > Date.now()) add('gold', t('mc_a_record'), 'record');
  const n0 = out.length;
  if(r.mcStuck) add('bad', mct(r.mcStuck.kind === 'zero' ? 'mc_a_zero' : 'mc_a_stuck', r.mcStuck.min + ' ' + t('mc_u_min')), 'stuck');
  if(dev.expected > 0){
    const sv = mcSeries(dev.id).slice(-5);
    if(sv.length >= 3){ const pct = sv.reduce((a, b) => a + b, 0) / sv.length / (dev.expected * 1000) * 100; if(pct < 85) add('warn', mct('mc_a_below', pct.toFixed(0)), 'below'); }
  }
  if(dev.maintMonths > 0 && typeof getLastMaintenanceTime === 'function'){
    const lm = getLastMaintenanceTime(dev.id);
    if(!lm) add('info', t('mc_a_maint_none'), 'maintnone');
    else if(Date.now() - lm > dev.maintMonths * 30 * 86400e3) add('warn', mct('mc_a_maint', mcAgo(Date.now() - lm - dev.maintMonths * 30 * 86400e3)), 'maint');
  }
  if(dev.mute > Date.now()) add('info', mct('mc_a_muted', new Date(dev.mute).toLocaleTimeString(mcLocale(), { hour: '2-digit', minute: '2-digit' })), 'mute');
  if(r.temp >= mc.th.tempHot) add('bad', mct('mc_a_tempcrit', Number(r.temp).toFixed(0)), 'temp');
  else if(r.temp >= mc.th.tempWarm) add('warn', mct('mc_a_warm', Number(r.temp).toFixed(0)), 'temp');
  if(r.vrTemp != null && r.vrTemp >= mc.th.vrHot) add('bad', mct('mc_a_vr', Number(r.vrTemp).toFixed(0)), 'vr');
  const sh = (r.accepted || 0) + (r.rejected || 0);
  if(sh > 20 && r.rejected / sh > mc.th.rej / 100) add('warn', mct('mc_a_rej', (r.rejected / sh * 100).toFixed(1)), 'rej');
  if(typeof hcChipAlert === 'function'){ const ca = hcChipAlert(dev, r); if(ca) add(ca.lvl, ca.txt, 'chips'); }
  if(typeof hcRealAlert === 'function'){ const ra = hcRealAlert(dev, r); if(ra) add(ra.lvl, ra.txt, 'hreal'); }
  if(r.rssi != null && r.rssi <= mc.th.wifi) add('warn', mct('mc_a_wifi', r.rssi), 'wifi');
  if(r.poolPing != null && r.poolPing > mc.th.ping) add('warn', mct('mc_a_ping', Math.round(r.poolPing)), 'ping');
  if(r.poolInfo && r.poolInfo.usingFallback) add('info', t('mc_a_fallback'), 'fallback');
  if(trend != null && trend <= -30) add('warn', mct('mc_a_drop', Math.abs(trend).toFixed(0)), 'drop');
  if(out.length === n0) add('good', t('mc_a_ok'), 'ok');
  return out;
}
function mcAlerts(dev, r, st, trend){
  return mcAlertItems(dev, r, st, trend).map(a => '<span class="mc-chip ' + a.lvl + '">' + a.txt + '</span>');
}
function mcAgo(ms){
  const m = Math.max(1, Math.round(ms / 60000));
  return m < 60 ? m + ' ' + t('mc_u_min') : m < 1440 ? Math.round(m / 60) + ' ' + t('mc_u_h') : Math.round(m / 1440) + ' ' + t('mc_u_d');
}

// ---- construção dos cartões ----
function mcMeter(f, label){
  const ico = f === 'fan' ? '<svg class="mc-fanico" viewBox="0 0 24 24" aria-hidden="true"><g class="blades"><path d="M12 12C12 6 8 3 5 5c-2 2 1 6 7 7z"/><path d="M12 12c6 0 9-4 7-7-2-2-6 1-7 7z"/><path d="M12 12c0 6 4 9 7 7 2-2-1-6-7-7z"/><path d="M12 12c-6 0-9 4-7 7 2 2 6-1 7-7z"/></g><circle cx="12" cy="12" r="2"/></svg>' : '';
  const arc = f === 'temp' ? '<svg class="mc-arc" viewBox="0 0 64 38" aria-hidden="true"><path class="bg" d="M6 34A26 26 0 0 1 58 34" pathLength="100"/><path class="fg ok" data-f="arc" d="M6 34A26 26 0 0 1 58 34" pathLength="100"/></svg>' : '';
  return '<div class="mc-meter mc-meter-' + f + '"><div class="mc-meter-top"><span>' + ico + label + '</span><b data-f="' + f + 'V">—</b></div><div class="mc-bar"><i data-f="' + f + 'B"></i></div>' + arc + '</div>';
}
function mcCardEl(dev){
  const el = document.createElement('article');
  el.className = 'mc-card';
  el.dataset.id = dev.id;
  el.innerHTML =
    '<svg class="mc-bgchart" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true"><path class="bga" data-f="bga"/><path class="bgt" data-f="bgt"/><path class="bgl" data-f="bgl"/></svg><i class="mc-bgscan" aria-hidden="true"></i><i class="mc-bgdot" data-f="bgdot" aria-hidden="true"></i>' +
    '<header class="mc-head"><label class="mc-pick" title="' + t('mc_pick_t') + '"><input type="checkbox" data-a="pick" aria-label="' + t('mc_pick_a') + '"></label><span class="mc-dot" data-f="dot"></span>' +
      '<div class="mc-title"><b data-f="name"></b><small data-f="ip" data-a="copyip" title="' + t('mc_copyip') + '"></small></div>' +
      '<button type="button" class="mc-star" data-a="pin" title="' + t('mc_pin') + '" aria-label="' + t('mc_pin') + '">☆</button>' +
      '<span class="mc-model" data-f="model"></span></header>' +
    '<div class="mc-status-row"><span class="mc-status" data-f="status"></span><span class="mc-algo" data-f="algo"></span><span class="mc-gchip" data-f="group" hidden></span><span class="mc-notechip" data-f="notechip" hidden>📝</span></div>' +
    '<div class="mc-hero"><div class="mc-hash"><b data-f="hash">—</b><small data-f="unit"></small><i class="mc-trend" data-f="trend"></i></div>' +
      '<svg class="mc-spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><path class="area" data-f="area"/><path class="line" data-f="line"/><circle class="live" data-f="live" r="2.6"/></svg></div>' +
    '<div class="mc-alerts" data-f="alerts"></div>' +
    '<div class="mc-ecg flat" aria-hidden="true"><div class="mc-ecg-run"><svg viewBox="0 0 400 20" preserveAspectRatio="none"><path d="M0 10h30l6 0l4-8l4 16l4-8h52h30l6 0l4-8l4 16l4-8h52h30l6 0l4-8l4 16l4-8h52h30l6 0l4-8l4 16l4-8h52"/></svg></div></div>' +
    '<div class="mc-meters">' + mcMeter('temp', t('mc_m_temp')) + mcMeter('fan', t('mc_m_fan')) +
      '<div class="mc-meter"><div class="mc-meter-top"><span>Wi-Fi</span><b data-f="wifiV">—</b></div><div class="mc-sig" data-f="sig"><i></i><i></i><i></i><i></i></div></div></div>' +
    '<div class="mc-facts">' +
      '<div><span>' + t('mc_k_power') + '</span><b data-f="power">—</b></div><div><span>' + t('mc_k_eff') + '</span><b data-f="eff">—</b></div>' +
      '<div><span>' + t('mc_k_shares') + '</span><b data-f="shares">—</b></div><div><span>' + t('mc_k_best') + '</span><b data-f="best">—</b></div>' +
      '<div><span>Uptime</span><b data-f="uptime">—</b></div><div><span>' + t('mc_k_ping') + '</span><b data-f="ping">—</b></div>' +
      '<div><span>' + t('mc_k_profit') + '</span><b data-f="profit" title="' + t('mc_prof_tip') + '">—</b></div><div><span>' + t('mc_k_block') + '</span><b data-f="block">—</b></div></div>' +
    '<div class="mc-pool"><span>Pool</span><b data-f="pool">—</b></div>' +
    '<div class="mc-more" data-f="more"></div>' +
    '<footer class="mc-actions">' +
      '<button type="button" data-a="web" title="' + t('mc_web_g') + '">↗ AxeOS</button>' +
      '<button type="button" data-a="eco" title="' + t('mc_eco_t') + '">🌿</button><button type="button" data-a="turbo" title="' + t('mc_turbo_t') + '">🚀</button>' +
      '<button type="button" data-a="restart" title="' + t('mc_restart_t') + '">⟲</button><button type="button" data-a="plug" title="' + t('mc_plug_t') + '" hidden>⚡</button>' +
      '<button type="button" data-a="more" title="' + t('mc_more_t') + '">' + t('mc_more') + '</button>' +
      '<button type="button" data-a="remove" class="mc-danger" title="' + t('mc_remove_t') + '">✕</button></footer><i class="mc-wavefx"></i><i class="mc-glowfx"></i><i class="mc-sheenfx"></i><i class="mc-embers"><b></b><b></b><b></b><b></b><b></b><b></b></i>';
  const ln = el.querySelector('.mc-spark .line');
  ln.classList.add('draw'); setTimeout(() => ln.classList.remove('draw'), 1600);   // o traço desenha-se quando o cartão aparece
  return el;
}
const mcSetN = (el, f, text) => typeof mcNumSet === 'function' ? mcNumSet(el, f, text) : mcSet(el, f, text);
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
  return row(t('mc_d_vr'), r && r.online ? mcNum(r.vrTemp, 1) + ' °C' : '—') + row(t('mc_d_freq'), r && r.online ? mcNum(r.frequency, 0) + ' MHz' : '—') +
    row(t('mc_d_input'), inParts.length ? inParts.join(' · ') : '—') + row(t('mc_d_lat'), r && r.online ? mcNum(r.localLatency, 0) + ' ms' : '—') +
    row('Firmware', r && r.online && r.firmware ? r.firmware : '—') + row(t('mc_d_model'), r && (r.asicModel || r.deviceModel) ? (r.asicModel || r.deviceModel) : '—') +
    row(t('mc_d_algo'), r && r.algorithm ? String(r.algorithm).toUpperCase() : 'SHA256') + row(t('mc_d_maint'), last && typeof formatMaintDate === 'function' ? formatMaintDate(last) : t('mc_d_never')) +
    row(t('mc_d_avail'), typeof mcAvailText === 'function' ? mcAvailText(dev.id) : '—');
}
// histórico (hashrate e temperatura) da máquina nas últimas 1, 6 ou 24 horas
function mcHistoryHtml(dev){
  const hrs = mc.prefs.range || 24, cutoff = Date.now() - hrs * 3600e3;
  const btns = [1, 6, 24].map(n => '<button type="button" data-a="range" data-r="' + n + '" class="' + (hrs === n ? 'on' : '') + '">' + n + ' h</button>').join('');
  const head = '<div class="mc-hist-head"><span>' + t('mc_h_title') + '</span><div>' + btns + '</div></div>';
  const h = (histories[dev.id] || []).filter(x => x && x.ts >= cutoff && x.hashrate != null && isFinite(x.hashrate));
  if(h.length < 4) return head + '<div class="mc-hist-empty">' + t('mc_h_wait') + '</div>';
  const W = 300, H = 90, t0 = h[0].ts, span = Math.max(1, h[h.length - 1].ts - t0);
  const hv = h.map(x => Number(x.hashrate)), hmax = Math.max(...hv), hmin = Math.min(...hv), hs = (hmax - hmin) || hmax * .1 || 1;
  const X = x => ((x.ts - t0) / span * W).toFixed(1);
  const hp = h.map((x, i) => (i ? 'L' : 'M') + X(x) + ' ' + (H - 6 - (Number(x.hashrate) - hmin) / hs * (H - 16)).toFixed(1)).join('');
  const tp = h.filter(x => isFinite(x.temp) && x.temp > 0).map((x, i) => (i ? 'L' : 'M') + X(x) + ' ' + (H - 4 - (Math.min(90, Math.max(30, x.temp)) - 30) / 60 * (H - 12)).toFixed(1)).join('');
  const temps = h.map(x => Number(x.temp)).filter(v => isFinite(v) && v > 0);
  const avg = hv.reduce((a, b) => a + b, 0) / hv.length, fm = v => { const f = formatHashrate(v); return f.value + ' ' + f.unit; };
  const tm = ts => new Date(ts).toLocaleTimeString(mcLocale(), { hour: '2-digit', minute: '2-digit' });
  return head + '<svg class="mc-hist-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
    [.25, .5, .75].map(g => '<line x1="0" x2="' + W + '" y1="' + (H * g).toFixed(0) + '" y2="' + (H * g).toFixed(0) + '"/>').join('') +
    '<path class="harea" d="' + hp + 'L' + W + ' ' + H + 'L0 ' + H + 'Z"/><path class="hline" d="' + hp + '"/>' + (tp ? '<path class="tline" d="' + tp + '"/>' : '') + '</svg>' +
    '<div class="mc-hist-axis"><span>' + tm(t0) + '</span><span>' + tm(h[h.length - 1].ts) + '</span></div>' +
    '<div class="mc-hist-stats"><span>' + t('mc_h_avg') + ' <b>' + fm(avg) + '</b></span><span>' + t('mc_h_max') + ' <b>' + fm(hmax) + '</b></span><span>' + t('mc_h_min') + ' <b>' + fm(hmin) + '</b></span>' +
    (temps.length ? '<span class="t">' + t('mc_h_tmax') + ' <b>' + Math.max(...temps).toFixed(0) + ' °C</b></span>' : '') + '</div>';
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
  const star = el.querySelector('[data-a="pin"]');
  star.textContent = dev.pin ? '★' : '☆'; star.classList.toggle('on', !!dev.pin); star.title = dev.pin ? t('mc_unpin') : t('mc_pin');
  el.classList.toggle('is-pinned', !!dev.pin);
  const nc = el.querySelector('[data-f="notechip"]');
  nc.hidden = !dev.note; nc.title = dev.note || '';
  const gc = el.querySelector('[data-f="group"]');
  gc.hidden = !dev.group; mcSet(el, 'group', dev.group ? '🗂 ' + dev.group : '');
  mcSet(el, 'name', dev.name || mct('mc_machine', i + 1));
  mcSet(el, 'ip', dev.ip || '');
  mcSet(el, 'model', icon + ' ' + model);
  mcSet(el, 'status', S.label);
  const grp = r ? algoGroupOf(r) : 'sha256';
  mcSet(el, 'algo', grp === 'gpu' || grp === 'other' || grp === 'scrypt' ? String(r.algorithm || '').toUpperCase() : 'SHA-256');
  const [hv, hu] = mcHashText(r);
  mcSetN(el, 'hash', hv); mcSet(el, 'unit', hu);
  const vals = on ? mcSeries(dev.id) : [];
  const trend = on ? mcTrend(vals) : null;
  const tr = el.querySelector('[data-f="trend"]');
  tr.textContent = trend != null && Math.abs(trend) >= 1 ? (trend > 0 ? '▲ ' : '▼ ') + Math.abs(trend).toFixed(1) + '%' : '';
  tr.className = 'mc-trend ' + (trend != null && trend > 0 ? 'up' : 'down');
  const sp = mcSpark(vals);
  el.querySelector('[data-f="line"]').setAttribute('d', sp.line);
  el.querySelector('[data-f="area"]').setAttribute('d', sp.area);
  const lv = el.querySelector('[data-f="live"]'); lv.setAttribute('cx', sp.x.toFixed(1)); lv.setAttribute('cy', sp.y.toFixed(1));
  mcBgChart(el, dev, on);
  const al = mcAlerts(dev, r, st, trend).join('') + (mc.rank[dev.id] || []).map(tx => '<span class="mc-chip rank">' + tx + '</span>').join('');
  const aln = el.querySelector('[data-f="alerts"]');
  if(aln.dataset.s !== al){ aln.dataset.s = al; aln.innerHTML = al; }
  // medidores
  if(on){
    mcSetN(el, 'tempV', mcNum(r.temp, 1) + ' °C'); mcBar(el, 'tempB', (r.temp - 25) / 60 * 100, mcTempLevel(r.temp));
    const fan = r.fanPct != null ? Math.round(r.fanPct) : null;
    mcSet(el, 'fanV', fan != null ? fan + '%' : (r.fanSpeed ? r.fanSpeed + ' rpm' : '—')); mcBar(el, 'fanB', fan != null ? fan : 0, fan != null && fan >= 90 ? 'warn' : 'ok');
    mcSet(el, 'wifiV', r.rssi != null ? r.rssi + ' dBm' : '—');
    const sig = mcSignal(r.rssi);
    el.querySelectorAll('[data-f="sig"] i').forEach((b, k) => b.classList.toggle('on', k < sig));
    el.querySelector('[data-f="sig"]').className = 'mc-sig ' + (sig <= 1 ? 'bad' : sig === 2 ? 'warn' : 'ok');
    mcSetN(el, 'power', mcNum(r.power, 1) + ' W'); mcSetN(el, 'eff', mcNum(r.efficiency, 1) + ' J/TH');
    const sh = (r.accepted || 0) + (r.rejected || 0), rej = sh ? r.rejected / sh * 100 : 0;
    mcSet(el, 'shares', (r.accepted || 0) + ' / ' + (r.rejected || 0) + (sh > 20 ? ' (' + rej.toFixed(1) + '%)' : ''));
    el.querySelector('[data-f="shares"]').className = sh > 20 && rej > mc.th.rej ? 'warn' : '';
    let best = '—'; if(r.best){ const f = formatDiff(r.best); best = f.value + ' ' + f.unit; }
    mcSet(el, 'best', best); mcSet(el, 'uptime', formatUptime(r.uptime).text);
    mcSet(el, 'ping', r.poolPing != null ? Math.round(r.poolPing) + ' ms' : '—');
    mcSet(el, 'pool', r.pool ? String(r.pool).replace(/^[a-z+]+:\/\//, '') : '—');
    const eco = typeof mcEconomics === 'function' ? mcEconomics(algoGroupOf(r) === 'sha256' ? Number(r.hashrate) || 0 : 0, Number(r.power) || 0) : null;
    mcSet(el, 'profit', eco ? (eco.profit >= 0 ? '+' : '') + eco.profit.toFixed(2) + ' €' : '—');
    mcSet(el, 'block', eco ? mcBlockText(eco) : '—');
  } else {
    ['tempV', 'fanV', 'wifiV', 'power', 'eff', 'shares', 'best', 'uptime', 'ping', 'pool', 'profit', 'block'].forEach(f => mcSet(el, f, '—'));
    ['tempB', 'fanB'].forEach(f => mcBar(el, f, 0, 'ok'));
    el.querySelectorAll('[data-f="sig"] i').forEach(b => b.classList.remove('on'));
  }
  // detalhes extra (só se estiver aberto): histórico, dados técnicos e grupo
  const more = el.querySelector('[data-f="more"]');
  const setHtml = (n, h) => { if(n && n.dataset.s !== h){ n.dataset.s = h; n.innerHTML = h; } };
  if(mc.open.has(dev.id)){
    if(!more.dataset.shell){
      more.innerHTML = '<div class="mc-hist"></div><div class="mc-tl"></div><div class="mc-tune"></div><div class="mc-more-grid"></div>' +
        '<div class="mc-edit"><label class="mc-grp"><span>' + t('mc_e_name') + '</span><input type="text" data-a="name" maxlength="40"></label><label class="mc-grp"><span>IP</span><input type="text" data-a="ip" maxlength="60" inputmode="decimal"></label></div>' +
        '<label class="mc-grp"><span>' + t('mc_e_expected') + '</span><input type="number" step="0.1" min="0" data-a="expected" placeholder="TH/s"></label>' +
        '<label class="mc-grp"><span>' + t('mc_e_mute') + '</span><select data-a="mute"></select></label>' +
        '<label class="mc-grp"><span>' + t('mc_e_maint') + '</span><input type="number" min="0" max="60" step="1" data-a="maintMonths" placeholder="6"></label>' +
        '<label class="mc-grp"><span>' + t('mc_e_plugoff') + '</span><input type="text" data-a="plugOff" maxlength="300" placeholder="http://192.168.1.60/relay/0?turn=off"></label>' +
        '<label class="mc-grp"><span>' + t('mc_e_plugon') + '</span><input type="text" data-a="plugOn" maxlength="300" placeholder="http://192.168.1.60/relay/0?turn=on"></label>' +
        '<label class="mc-grp"><span>' + t('mc_e_group') + '</span><input type="text" list="mcGroupList" data-a="group" placeholder="' + t('mc_e_nogroup') + '" maxlength="24"></label>' +
        '<label class="mc-grp mc-noteedit"><span>' + t('mc_e_note') + '</span><textarea data-a="note" rows="2" maxlength="300" placeholder="' + t('mc_e_noteph') + '"></textarea></label>';
      more.dataset.shell = '1';
    }
    setHtml(more.querySelector('.mc-hist'), mcHistoryHtml(dev));
    setHtml(more.querySelector('.mc-tl'), typeof mcTimelineHtml === 'function' ? mcTimelineHtml(dev.id) : '');
    setHtml(more.querySelector('.mc-tune'), typeof mcTuneHint === 'function' ? mcTuneHint(dev.id) : '');
    setHtml(more.querySelector('.mc-more-grid'), mcMoreHtml(dev, r));
    const ms = more.querySelector('[data-a="mute"]');
    const muted = dev.mute > Date.now(), mh = (muted ? '<option value="cur" selected>' + mct('mc_a_muted', new Date(dev.mute).toLocaleTimeString(mcLocale(), { hour: '2-digit', minute: '2-digit' })) + '</option>' : '') +
      '<option value="0"' + (muted ? '' : ' selected') + '>' + t(muted ? 'mc_mute_off' : 'mc_mute_0') + '</option><option value="60">' + t('mc_mute_1') + '</option><option value="240">' + t('mc_mute_4') + '</option><option value="1440">' + t('mc_mute_24') + '</option>';
    if(document.activeElement !== ms && ms.dataset.s !== mh){ ms.dataset.s = mh; ms.innerHTML = mh; }
    [['group', dev.group], ['name', dev.name], ['ip', dev.ip], ['note', dev.note], ['expected', dev.expected], ['plugOff', dev.plugOff], ['plugOn', dev.plugOn], ['maintMonths', dev.maintMonths]].forEach(([k, v]) => {
      const inp = more.querySelector('[data-a="' + k + '"]');
      if(inp && document.activeElement !== inp) inp.value = v || '';
    });
  } else if(more.dataset.shell){ more.innerHTML = ''; delete more.dataset.shell; }
  el.querySelector('[data-a="more"]').textContent = mc.open.has(dev.id) ? t('mc_less') : t('mc_more');
  // atalhos de perfis só aparecem se existirem
  ['eco', 'turbo'].forEach(slot => {
    const b = el.querySelector('[data-a="' + slot + '"]'), prof = typeof getQuickSlot === 'function' ? getQuickSlot(slot) : null;
    if(b){ b.hidden = !prof || !on; if(prof) b.title = mct('mc_apply_t', prof.name); }
  });
  el.querySelector('[data-a="plug"]').hidden = !(dev.plugOff && dev.plugOn) || !on;
  const web = el.querySelector('[data-a="web"]'), os = mcOsName(model);
  web.hidden = !dev.ip; web.textContent = '↗ ' + os; web.title = mct('mc_web_t', os);
  if(typeof mcXpUpdate === 'function') mcXpUpdate(el, dev, r, on);
}

// ---- tabela ----
function mcTableHtml(rows){
  const th = h => '<th>' + h + '</th>';
  let html = '<table class="mc-table"><thead><tr>' + ['', '', t('mc_t_machine'), t('mc_e_group'), t('mc_t_state'), 'Hashrate', t('mc_m_temp'), t('mc_k_power'), t('mc_t_eff'), 'Wi-Fi', 'Ping', t('mc_t_rej'), 'Uptime', ''].map(th).join('') + '</tr></thead><tbody>';
  rows.forEach(({ dev, r, st }) => {
    const on = !!(r && r.online), S = MC_STATUS[st], [hv, hu] = mcHashText(r);
    const sh = on ? (r.accepted || 0) + (r.rejected || 0) : 0, rej = sh ? r.rejected / sh * 100 : 0;
    html += '<tr data-id="' + escapeHtml(String(dev.id)) + '" class="' + (selectedId === dev.id ? 'is-sel' : '') + '">' +
      '<td><input type="checkbox" data-a="pick"' + (mc.picked.has(dev.id) ? ' checked' : '') + ' aria-label="' + t('mc_select') + '"></td>' +
      '<td><span class="mc-dot" style="--mc-c:' + S.color + '"></span></td>' +
      '<td><b>' + escapeHtml(dev.name || '') + '</b><small>' + escapeHtml(dev.ip || '') + '</small></td>' +
      '<td>' + (dev.group ? '<span class="mc-gchip">🗂 ' + escapeHtml(dev.group) + '</span>' : '<small>—</small>') + '</td>' +
      '<td style="color:' + S.color + '">' + S.label + '</td>' +
      '<td><b>' + escapeHtml(hv) + '</b> <small>' + escapeHtml(hu) + '</small></td>' +
      '<td class="' + (on ? mcTempLevel(r.temp) : '') + '">' + (on ? mcNum(r.temp, 1) + ' °C' : '—') + '</td>' +
      '<td>' + (on ? mcNum(r.power, 1) + ' W' : '—') + '</td><td>' + (on ? mcNum(r.efficiency, 1) : '—') + '</td>' +
      '<td>' + (on && r.rssi != null ? r.rssi + ' dBm' : '—') + '</td><td>' + (on && r.poolPing != null ? Math.round(r.poolPing) + ' ms' : '—') + '</td>' +
      '<td class="' + (sh > 20 && rej > mc.th.rej ? 'warn' : '') + '">' + (sh > 20 ? rej.toFixed(1) + '%' : '—') + '</td>' +
      '<td>' + (on ? formatUptime(r.uptime).text : '—') + '</td>' +
      '<td class="mc-tact"><button type="button" data-a="web" title="' + t('mc_web_g') + '"' + (dev.ip ? '' : ' hidden') + '>↗</button><button type="button" data-a="restart" title="' + t('mc_restart_g') + '">⟲</button><button type="button" data-a="remove" class="mc-danger" title="' + t('mc_remove_g') + '">✕</button></td></tr>';
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
    '<div class="mc-tools"><input type="search" id="mcSearch" placeholder="' + t('mc_search') + '" aria-label="' + t('mc_search_a') + '">' +
    '<select id="mcGroup" aria-label="' + t('mc_group_a') + '"></select>' +
    '<select id="mcSort" aria-label="' + t('mc_sort_a') + '">' + MC_SORTS.map(([k, l]) => '<option value="' + k + '">' + t(l) + '</option>').join('') + '</select>' +
    '<button type="button" class="mc-fx-btn" id="mcExport" title="' + t('mc_export_t') + '">' + t('mc_export') + '</button>' +
    '<button type="button" class="mc-fx-btn" id="mcGroupBy" title="' + t('mc_groupby_t') + '">' + t('mc_groupby') + '</button>' +
    '<button type="button" class="mc-fx-btn" id="mcFx" title="' + t('mc_fx_on') + '">✨ 3D</button><div class="mc-views" id="mcViews"><button type="button" data-v="cards" title="' + t('mc_v_cards') + '">▦</button><button type="button" data-v="compact" title="' + t('mc_v_compact') + '">▥</button><button type="button" data-v="table" title="' + t('mc_v_table') + '">☰</button><button type="button" data-v="heat" title="' + t('mc_v_heat') + '">🌡</button><button type="button" data-v="plan" title="' + t('mc_v_plan') + '">🗺</button><button type="button" data-v="arena" title="' + t('mc_v_arena') + '">🎯</button></div><button type="button" class="mc-fx-btn" id="mcVoiceBtn" title="' + t('mc_vo_btn') + '">🎤</button></div>';
  $('mcSearch').value = mc.prefs.q || '';
  $('mcFx').addEventListener('click', () => { mc.prefs.fx = !mcFxOn(); mcSavePrefs(); renderMachineCards(); });
  $('mcExport').addEventListener('click', () => { if(typeof mcExportCsv === 'function') mcExportCsv(); });
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
    if(was && was !== 'idle' && was !== st){   // de 'idle' (ainda sem leitura, ao abrir a página) para 'ok' não é recuperar de nada
      if(typeof mcWave === 'function') mcWave(id, st);
      const name = dev.name || dev.ip;
      if(st === 'hot') mcLogEvent(mct('mc_l_alarm', name, r && r.temp ? ' (' + Number(r.temp).toFixed(0) + ' °C)' : ''), 'bad', id);
      else if(st === 'off') mcLogEvent(mct('mc_l_off', name), 'bad', id);
      else if(st === 'portal') mcLogEvent(mct('mc_l_portal', name), 'info', id);
      else if(st === 'warm' || st === 'warn') mcLogEvent(mct('mc_l_state', name, MC_STATUS[st].label.toLowerCase()), 'warn', id);
      else if(st === 'ok') mcLogEvent(mct('mc_l_ok', name), 'good', id);
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
    new Date(e.t).toLocaleTimeString(mcLocale(), { hour: '2-digit', minute: '2-digit' }) + '</time><span>' + escapeHtml(e.text) + '</span></li>').join('') : '<li class="muted"><span>' + t('mc_l_none') + '</span></li>';
}

// ---- selos: a mais rápida e a mais eficiente (só com 3 ou mais máquinas SHA-256 online) ----
function mcRanks(list){
  mc.rank = {};
  const on = list.filter(d => { const r = readings[d.id]; return r && r.online && algoGroupOf(r) === 'sha256'; });
  if(on.length < 3) return;
  const fast = on.reduce((a, b) => (Number(readings[b.id].hashrate) || 0) > (Number(readings[a.id].hashrate) || 0) ? b : a);
  const eff = on.filter(d => readings[d.id].efficiency > 0).reduce((a, b) => !a || readings[b.id].efficiency < readings[a.id].efficiency ? b : a, null);
  (mc.rank[fast.id] = mc.rank[fast.id] || []).push(t('mc_rank_fast'));
  if(eff) (mc.rank[eff.id] = mc.rank[eff.id] || []).push(t('mc_rank_eff'));
}

// ---- grupos ----
function mcGroupsOf(list){ return [...new Set(list.map(d => d.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, mcLocale())); }
function mcFillGroups(list){
  const gs = mcGroupsOf(list), sel = $('mcGroup'), dl = $('mcGroupList');
  if(dl){ const h = gs.map(g => '<option value="' + escapeHtml(g) + '">').join(''); if(dl.dataset.s !== h){ dl.dataset.s = h; dl.innerHTML = h; } }
  if(!sel) return;
  if(mc.prefs.group && mc.prefs.group !== '__none' && !gs.includes(mc.prefs.group)) mc.prefs.group = '';
  const h = '<option value="">' + t('mc_g_all') + '</option>' + gs.map(g => '<option value="' + escapeHtml(g) + '">🗂 ' + escapeHtml(g) + '</option>').join('') + (gs.length ? '<option value="__none">' + t('mc_g_none') + '</option>' : '');
  if(sel.dataset.s !== h){ sel.dataset.s = h; sel.innerHTML = h; }
  sel.value = mc.prefs.group || '';
  sel.hidden = !gs.length;
  if($('mcGroupBy')) { $('mcGroupBy').hidden = !gs.length; $('mcGroupBy').classList.toggle('active', !!mc.prefs.groupBy && gs.length > 0); }
}
function mcGroupHead(name, items){
  let el = mc.heads.get(name);
  if(!el){
    el = document.createElement('div'); el.className = 'mc-ghead'; el.dataset.g = name;
    el.innerHTML = '<button type="button" data-a="gtoggle" class="mc-gtoggle" aria-label="' + t('mc_g_toggle') + '">▾</button><b></b><span class="mc-gstats"></span>';
    mc.heads.set(name, el);
  }
  const online = items.filter(x => x.r && x.r.online), gh = online.reduce((s, x) => s + (algoGroupOf(x.r) === 'sha256' ? Number(x.r.hashrate) || 0 : 0), 0);
  const bad = items.filter(x => x.st === 'hot' || x.st === 'off').length, warn = items.filter(x => x.st === 'warm' || x.st === 'warn').length;
  const f = formatHashrate(gh);
  el.classList.toggle('closed', mc.collapsed.has(name));
  el.querySelector('b').textContent = name ? '🗂 ' + name : t('mc_g_none');
  el.querySelector('.mc-gstats').innerHTML = mct(items.length === 1 ? 'mc_n_machine' : 'mc_n_machines', items.length) + ' · ' + mct('mc_g_online', online.length) + (gh ? ' · <i>' + f.value + ' ' + f.unit + '</i>' : '') +
    (bad ? ' · <i class="bad">' + mct('mc_g_fail', bad) + '</i>' : '') + (warn ? ' · <i class="warn">' + mct('mc_g_warn', warn) + '</i>' : '');
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
  const html = '<b>' + mct(n === 1 ? 'mc_b_sel1' : 'mc_b_seln', n) + '</b>' +
    (q('eco') ? '<button type="button" data-b="eco">🌿 ' + escapeHtml(q('eco')) + '</button>' : '') + (q('turbo') ? '<button type="button" data-b="turbo">🚀 ' + escapeHtml(q('turbo')) + '</button>' : '') +
    (n >= 2 && n <= 6 ? '<button type="button" data-b="compare">' + t('mc_b_compare') + '</button>' : '') +
    '<button type="button" data-b="restart">' + t('mc_b_restart') + '</button><button type="button" data-b="group">' + t('mc_b_group') + '</button>' +
    '<span class="mc-bulk-sp"></span><button type="button" data-b="all">' + t('mc_b_all') + '</button><button type="button" data-b="clear">' + t('mc_b_clear') + '</button>';
  if(bar.dataset.s !== html){ bar.dataset.s = html; bar.innerHTML = html; }
}
async function mcBulkRun(kind){
  if(mc.locked && kind !== 'clear' && kind !== 'all' && kind !== 'compare') return;
  const devs = (devices || []).filter(d => mc.picked.has(d.id));
  if(!devs.length) return;
  if(kind === 'clear'){ mc.picked.clear(); renderMachineCards(); return; }
  if(kind === 'compare'){ if(typeof mcCompareOpen === 'function') mcCompareOpen(); return; }
  if(kind === 'all'){ (mc.visible || []).forEach(id => mc.picked.add(id)); renderMachineCards(); return; }
  if(kind === 'group'){
    const g = prompt(mct('mc_b_prompt', devs.length), devs[0].group || '');
    if(g === null) return;
    devs.forEach(d => { if(g.trim()) d.group = g.trim().slice(0, 24); else delete d.group; });
    saveDevices(); mc.picked.clear(); renderAll(); return;
  }
  const names = devs.map(d => d.name || d.ip).join(', ');
  if(kind === 'restart'){
    if(!confirm(mct('mc_b_confirm_restart', devs.length, names))) return;
    let ok = 0;
    for(const d of devs){ setQuickActionStatus(mct('mc_b_restarting', d.name || d.ip)); const res = await aiRestartDevice(d); if(res && res.ok) ok++; }
    setQuickActionStatus(mct('mc_b_restarted', ok, devs.length));
    return;
  }
  const prof = getQuickSlot(kind);
  if(!prof) return;
  if(!confirm(mct('mc_b_confirm_apply', prof.name, qpDescribe(prof), devs.length, names))) return;
  let ok = 0;
  for(const d of devs){ if(!(readings[d.id] && readings[d.id].online)) continue; setQuickActionStatus(mct('mc_b_applying', d.name || d.ip)); const res = await aiApplyProfile(prof, d); if(res && res.ok) ok++; }
  setQuickActionStatus(mct('mc_b_applied', prof.name, ok, devs.length));
  renderAll();
}

function mcResetUi(){
  ['mcSummary', 'mcBulk', 'mcGroupList'].forEach(id => { const n = $(id); if(n) n.remove(); });
  const tb = $('mcToolbar');
  if(tb){ tb.innerHTML = ''; delete tb.dataset.ready; }
  mc.els.forEach(el => el.remove()); mc.els.clear();
  mc.heads.forEach(el => el.remove()); mc.heads.clear();
  const log = $('mcLog'); if(log) delete log.dataset.sig;
}

function renderMachineCards(){
  const board = $('mcBoard');
  if(!board) return;
  if(mc.lang !== currentLang){ mc.lang = currentLang; mcResetUi(); }
  mcBuildToolbar();
  const list = Array.isArray(devices) ? devices : [];
  mcStuckWatch(list);
  const states = {};
  list.forEach(d => { states[d.id] = mcStateOf(readings[d.id]); });
  mcTrackStates(list, states);
  [...mc.picked].forEach(id => { if(!list.some(d => d.id === id)) mc.picked.delete(id); });
  if($('mcCount')) $('mcCount').textContent = mct(list.length === 1 ? 'mc_n_machine' : 'mc_n_machines', list.length);
  mcFillGroups(list);
  mcRanks(list);
  if(typeof mcExtraRender === 'function') mcExtraRender(list, states);

  // filtros com contagens
  const counts = { all: list.length, ok: 0, warn: 0, hot: 0, off: 0 };
  list.forEach(d => { const f = mcFilterOf(states[d.id]); if(counts[f] != null) counts[f]++; });
  const chips = $('mcChips');
  if(chips){
    const html = MC_FILTERS.map(([k, l]) => '<button type="button" data-flt="' + k + '" class="mc-fchip ' + k + (mc.prefs.filter === k ? ' active' : '') + (counts[k] ? '' : ' zero') + '">' + t(l) + ' <b>' + counts[k] + '</b></button>').join('');
    if(chips.dataset.s !== html){ chips.dataset.s = html; chips.innerHTML = html; }
  }
  if($('mcFx')) {
    const on = mcFxOn(), perf = typeof hcPerfMode !== 'undefined' && hcPerfMode;
    $('mcFx').classList.toggle('active', on);
    $('mcFx').title = on ? t('mc_fx_off') : perf && mc.prefs.fx === 'auto' ? t('mc_fx_perf') : t('mc_fx_on');
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
    name: (a, b) => (a.dev.name || '').localeCompare(b.dev.name || '', mcLocale(), { numeric: true }),
    hash: byNum(r => r.hashrate_raw || (r.hashrate ? r.hashrate * 1e9 : 0), true),
    temp: byNum(r => r.temp, true),
    eff: (a, b) => ((a.r && a.r.online && a.r.efficiency > 0 ? a.r.efficiency : 1e9) - (b.r && b.r.online && b.r.efficiency > 0 ? b.r.efficiency : 1e9))
  }[mc.prefs.sort] || (() => 0);
  rows.sort((a, b) => (b.dev.pin ? 1 : 0) - (a.dev.pin ? 1 : 0) || cmp(a, b));
  mc.visible = rows.map(x => x.dev.id);

  board.dataset.view = mc.prefs.view;
  mcRenderBulk();
  if(!list.length){
    board.className = 'mc-board mc-empty';
    board.innerHTML = '<div class="mc-hint">' + t('mc_empty') + '</div>';
    mc.els.clear(); mc.heads.clear(); mcRenderLog(); return;
  }
  if(!rows.length){
    board.className = 'mc-board mc-empty';
    board.innerHTML = '<div class="mc-hint">' + t('mc_nomatch') + '</div>';
    mc.els.clear(); mc.heads.clear(); mcRenderLog(); return;
  }
  if(mc.prefs.view === 'arena'){
    board.className = 'mc-board mc-arenawrap'; delete board.dataset.s2; delete board.dataset.hk;
    mc.els.clear(); mc.heads.clear(); mcArenaRender(board, rows); mcRenderLog(); return;
  }
  if(mc.prefs.view === 'heat' || mc.prefs.view === 'plan'){
    if(mc.dragging) return;
    board.className = 'mc-board ' + (mc.prefs.view === 'heat' ? 'mc-heatwrap' : 'mc-planwrap');
    if(mc.prefs.view === 'heat'){
      if(!mcHeatPatch(board, rows)){ board.innerHTML = mcHeatHtml(rows); delete board.dataset.s2; }
    } else {
      delete board.dataset.hk;
      const h = mcPlanHtml(rows);
      if(board.dataset.s2 !== h){ board.dataset.s2 = h; board.innerHTML = h; }
    }
    mc.els.clear(); mc.heads.clear(); mcRenderLog(); return;
  }
  delete board.dataset.s2; delete board.dataset.hk;
  if(mc.prefs.view === 'table'){
    board.className = 'mc-board mc-tablewrap' + (mc.picked.size ? ' has-pick' : '');
    board.innerHTML = mcTableHtml(rows);
    mc.els.clear(); mc.heads.clear(); mcRenderLog(); return;
  }
  board.className = 'mc-board mc-grid' + (mc.prefs.view === 'compact' ? ' compact' : '') + (mcFxOn() ? ' mc-fx' : '') + (mc.picked.size ? ' has-pick' : '') + (typeof mcXpClasses === 'function' ? mcXpClasses() : '');
  if(board.querySelector('.mc-hint, table, .mc-heat-grid, .mc-plan-area, .mc-arena')) board.innerHTML = '';

  // ordem final dos nós: cartões, ou cabeçalhos de grupo com os respetivos cartões
  const nodes = [], useHeads = new Set();
  if(mc.prefs.groupBy && mcGroupsOf(list).length){
    const groups = new Map();
    rows.forEach(x => { const g = x.dev.group || ''; if(!groups.has(g)) groups.set(g, []); groups.get(g).push(x); });
    [...groups.keys()].sort((a, b) => a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, mcLocale())).forEach(g => {
      useHeads.add(g); nodes.push(mcGroupHead(g, groups.get(g)));
      if(!mc.collapsed.has(g)) groups.get(g).forEach(x => nodes.push(x));
    });
  } else rows.forEach(x => nodes.push(x));
  mc.heads.forEach((el, g) => { if(!useHeads.has(g)){ el.remove(); mc.heads.delete(g); } });
  const keep = new Set(nodes.filter(n => n.dev).map(n => n.dev.id));
  mc.els.forEach((el, id) => { if(!keep.has(id)){ el.remove(); mc.els.delete(id); } });
  const flipFirst = typeof mcFlipBefore === 'function' ? mcFlipBefore() : null;
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
  if(flipFirst && typeof mcFlipAfter === 'function') mcFlipAfter(flipFirst);
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
    if(mc.justDragged) return;
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
    if(!a){ if(e.target.closest('.mc-pick, .mc-grp, .mc-edit, .mc-hist')) return; if(selectedId !== dev.id){ selectedId = dev.id; renderAll(); } return; }
    const act = a.dataset.a;
    if(['group', 'name', 'ip', 'note', 'expected', 'mute', 'plugOff', 'plugOn', 'maintMonths'].includes(act)) return;
    if(mc.locked && ['remove', 'restart', 'eco', 'turbo', 'plug', 'pin', 'pick'].includes(act)) return;
    e.stopPropagation();
    if(act === 'pin'){ if(dev.pin) delete dev.pin; else dev.pin = true; saveDevices(); renderMachineCards(); return; }
    if(act === 'copyip'){
      try { await navigator.clipboard.writeText(dev.ip); setQuickActionStatus(mct('mc_c_copied', dev.ip)); } catch(err) { setQuickActionStatus(t('mc_c_copyfail')); }
      return;
    }
    if(act === 'pick'){
      a.checked ? mc.picked.add(dev.id) : mc.picked.delete(dev.id);
      const card = mc.els.get(dev.id); if(card) card.classList.toggle('is-pick', a.checked);
      mcRenderBulk(); return;
    }
    if(act === 'range'){ mc.prefs.range = Number(a.dataset.r) || 24; mcSavePrefs(); renderMachineCards(); return; }
    if(act === 'web' && dev.ip) window.open('http://' + dev.ip, '_blank', 'noopener');
    else if(act === 'more'){ mc.open.has(dev.id) ? mc.open.delete(dev.id) : mc.open.add(dev.id); renderMachineCards(); }
    else if(act === 'remove'){ if(confirm(mct('mc_c_remove', label))) removeDevice(dev.id); }
    else if(act === 'plug'){
      if(!confirm(mct('mc_plug_confirm', label))) return;
      if(typeof mcPlugCycle === 'function') mcPlugCycle(dev, false);
    }
    else if(act === 'restart'){
      if(!confirm(mct('mc_c_restart', label))) return;
      const res = await aiRestartDevice(dev);
      setQuickActionStatus(res && res.ok ? mct('mc_c_restart_ok', label) : mct('mc_c_fail', label));
    } else if(act === 'eco' || act === 'turbo'){
      const prof = getQuickSlot(act);
      if(!prof || !confirm(mct('mc_c_apply', prof.name, qpDescribe(prof), label))) return;
      const res = await aiApplyProfile(prof, dev);
      setQuickActionStatus(res && res.ok ? mct('mc_c_apply_ok', prof.name, label) : mct('mc_c_fail', label));
      renderAll();
    }
  });
  // nome, IP, grupo e nota guardam-se ao sair do campo ou com Enter
  if(board) board.addEventListener('change', e => {
    const inp = e.target.closest('[data-a="group"],[data-a="name"],[data-a="ip"],[data-a="note"],[data-a="expected"],[data-a="mute"],[data-a="plugOff"],[data-a="plugOn"],[data-a="maintMonths"]');
    if(mc.locked){ if(inp) mc.lockedEdit = true; return; }
    const host = inp && inp.closest('[data-id]');
    const dev = host && find(host.dataset.id);
    if(!dev) return;
    const k = inp.dataset.a, v = inp.value.trim();
    if(k === 'group'){ if(v) dev.group = v.slice(0, 24); else delete dev.group; }
    else if(k === 'note'){ if(v) dev.note = v.slice(0, 300); else delete dev.note; }
    else if(k === 'plugOff' || k === 'plugOn'){
      if(!v) delete dev[k];
      else if(/^https?:\/\/\S+$/i.test(v)) dev[k] = v.slice(0, 300);
      else { inp.value = dev[k] || ''; setQuickActionStatus(t('mc_plug_badurl')); return; }
    }
    else if(k === 'maintMonths'){ const x = parseInt(v, 10); if(x > 0 && x <= 60) dev.maintMonths = x; else delete dev.maintMonths; }
    else if(k === 'expected'){ const x = parseFloat(v.replace(',', '.')); if(x > 0) dev.expected = Math.round(x * 1000) / 1000; else delete dev.expected; }
    else if(k === 'mute'){ const m = parseInt(inp.value, 10); if(m > 0) dev.mute = Date.now() + m * 60000; else if(inp.value === '0') delete dev.mute; else return; }
    else if(k === 'name'){ if(!v){ inp.value = dev.name; return; } dev.name = v.slice(0, 40); }
    else if(k === 'ip'){
      if(!/^[A-Za-z0-9.\-:]{3,60}$/.test(v)){ inp.value = dev.ip; setQuickActionStatus(t('mc_c_ipbad')); return; }
      if(devices.some(d => d !== dev && d.ip === v)){ inp.value = dev.ip; setQuickActionStatus(t('mc_c_ipdup')); return; }
      dev.ip = v;
    }
    saveDevices(); renderAll();
    if(k === 'ip' && typeof pollAll === 'function') pollAll();
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
