// ---------- Cartões: experiências visuais (ligam-se e desligam-se em ⚙ > Experiências) ----------
// Ventoinha a girar, medidor de temperatura em arco, números que contam, cartões que deslizam, linha de pulso,
// onda de cor nas mudanças de estado, e duas vistas novas: mapa de calor e planta das máquinas.
const MC_XP_ALL = ['fan', 'arc', 'count', 'flip', 'ecg', 'wave', 'float', 'breathe', 'sheen', 'embers', 'confetti', 'draw', 'ripple', 'mapflow', 'mapzones'];
mc.prefs.xp = Object.assign({ fan: true, arc: true, count: true, flip: true, ecg: true, wave: true, float: true, breathe: true, sheen: true, embers: true, confetti: true, draw: true, ripple: true, mapflow: true, mapzones: true }, mc.prefs.xp || {});
function mcXp(k){
  let reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e) {}
  return !reduced && mc.prefs.xp[k] !== false;
}
function mcXpClasses(){ return MC_XP_ALL.filter(k => ['fan', 'arc', 'ecg', 'wave', 'breathe', 'sheen', 'embers', 'draw'].includes(k) && mcXp(k)).map(k => ' mc-xp-' + k).join(''); }

// ---- números que contam até ao valor novo ----
function mcNumSet(el, f, text){ const n = el.querySelector('[data-f="' + f + '"]'); if(n) mcNumTo(n, text); }
function mcNumTo(n, text){
  const m = mcXp('count') ? String(text).match(/^(-?\d+(?:\.\d+)?)(.*)$/) : null;
  if(!m){ n._v = null; if(n.textContent !== text) n.textContent = text; return; }
  const to = parseFloat(m[1]), suf = m[2], dec = (m[1].split('.')[1] || '').length, from = n._v;
  n._v = to;
  if(n._raf){ cancelAnimationFrame(n._raf); n._raf = 0; }
  clearTimeout(n._to);
  if(from == null || !isFinite(from) || from === to || n._sfx !== suf || Math.abs(to - from) > Math.max(Math.abs(from), 1) * 3){ n._sfx = suf; n.textContent = text; return; }
  n._sfx = suf;
  const t0 = performance.now(), dur = 500;
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    n.textContent = (from + (to - from) * e).toFixed(dec) + suf;
    if(k < 1) n._raf = requestAnimationFrame(step); else { n._raf = 0; n.textContent = text; }
  };
  n._raf = requestAnimationFrame(step);
  n._to = setTimeout(() => { if(n._raf) cancelAnimationFrame(n._raf); n._raf = 0; n.textContent = text; }, dur + 80);   // garante o valor final mesmo com o separador em segundo plano
}

// ---- ventoinha, arco da temperatura e linha de pulso (atualiza-se a cada leitura) ----
function mcXpUpdate(el, dev, r, on){
  // ventoinha: roda mais depressa com a velocidade
  const fm = el.querySelector('.mc-meter-fan');
  if(fm){
    const pct = on ? (r.fanPct != null ? Number(r.fanPct) : (r.fanSpeed ? Number(r.fanSpeed) / 60 : 0)) : 0;
    fm.style.setProperty('--fan-dur', pct > 2 ? (1.7 - 1.5 * Math.min(100, pct) / 100).toFixed(2) + 's' : '0s');
    fm.classList.toggle('stopped', !(pct > 2));
  }
  // arco da temperatura
  const arc = el.querySelector('[data-f="arc"]');
  if(arc){
    const temp = on ? Number(r.temp) : 0, pct = on && temp > 0 ? Math.max(0, Math.min(1, (temp - 25) / 60)) : 0;
    arc.style.strokeDashoffset = (100 * (1 - pct)).toFixed(1);
    arc.setAttribute('class', 'fg ' + (on ? mcTempLevel(temp) : 'ok'));
    const box = el.querySelector('.mc-meter-temp');
    if(box) box.classList.toggle('near', on && temp >= mc.th.tempHot - 3);
  }
  // linha de pulso: bate ao ritmo das partilhas; fica plana se não houver partilhas ou a máquina estiver presa
  const ecg = el.querySelector('.mc-ecg');
  if(ecg){
    const up = on ? Number(r.uptime) : 0, rate = up > 120 ? (Number(r.accepted) || 0) / (up / 60) : 0;
    const flat = !on || r.mcStuck || !(rate > 0.05);
    ecg.classList.toggle('flat', flat);
    if(!flat) ecg.style.setProperty('--ecg-dur', Math.max(0.9, Math.min(9, 120 / rate)).toFixed(2) + 's');
    ecg.style.setProperty('--mc-c', el.style.getPropertyValue('--mc-c'));
  }
}

// ---- onda de cor quando o estado muda ----
function mcWave(id, state){
  if(!mcXp('wave')) return;
  const el = mc.els.get(id), w = el && el.querySelector('.mc-wavefx');
  if(!w) return;
  w.style.setProperty('--wc', MC_STATUS[state].color);
  w.classList.remove('go'); void w.offsetWidth; w.classList.add('go');
}

// ---- cartões que deslizam para o novo lugar (técnica FLIP) ----
function mcFlipBefore(){
  if(!mcXp('flip') || mc.els.size > 60) return null;
  const m = new Map();
  mc.els.forEach((el, id) => { if(el.isConnected) m.set(id, el.getBoundingClientRect()); });
  return m;
}
function mcFlipAfter(first){
  if(!first || !first.size) return;
  mc.els.forEach((el, id) => {
    const a = first.get(id);
    if(!a || !el.animate) return;
    const b = el.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if(Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    el.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
  });
}

// ---- vista: mapa de calor ----
function mcHeatColor(metric, r, max){
  if(!r || !r.online) return null;
  let k;   // 0 = bom, 1 = mau
  if(metric === 'temp'){ const lo = mc.th.tempWarm - 18; k = (Number(r.temp) - lo) / (mc.th.tempHot - lo); }
  else if(metric === 'eff'){ k = r.efficiency > 0 ? (Number(r.efficiency) - 12) / 12 : null; }
  else { k = max > 0 ? 1 - (Number(r.hashrate) || 0) / max : null; }
  if(k == null || !isFinite(k)) return null;
  k = Math.max(0, Math.min(1, k));
  return 'hsl(' + Math.round(140 - 140 * k) + ',72%,' + (38 + 8 * (1 - k)) + '%)';
}
function mcHeatHtml(rows){
  const metric = mc.prefs.heatMetric || 'temp', max = Math.max(0, ...rows.map(x => x.r && x.r.online ? Number(x.r.hashrate) || 0 : 0));
  const btn = (k, l) => '<button type="button" data-hm="' + k + '" class="' + (metric === k ? 'on' : '') + '">' + l + '</button>';
  let h = '<div class="mc-heat-bar"><span>' + t('mc_hm_title') + '</span><div>' + btn('temp', t('mc_s_temp')) + btn('eff', t('mc_s_eff')) + btn('hash', 'Hashrate') + '</div></div><div class="mc-heat-grid">';
  rows.forEach(({ dev, r, st }) => {
    const col = mcHeatColor(metric, r, max), on = !!(r && r.online);
    const val = !on ? '—' : metric === 'temp' ? mcNum(r.temp, 1) + ' °C' : metric === 'eff' ? mcNum(r.efficiency, 1) + ' J/TH' : mcHashText(r).join(' ');
    h += '<div class="mc-hcell' + (selectedId === dev.id ? ' is-sel' : '') + '" data-id="' + escapeHtml(String(dev.id)) + '" style="--hc:' + (col || 'var(--line-strong)') + '" title="' + escapeHtml((dev.name || dev.ip) + ' · ' + MC_STATUS[st].label) + '">' +
      '<b>' + escapeHtml(dev.name || dev.ip || '') + '</b><span>' + escapeHtml(val) + '</span></div>';
  });
  return h + '</div><div class="mc-heat-legend"><i></i><small>' + t('mc_hm_good') + '</small><small>' + t('mc_hm_bad') + '</small></div>';
}

// ---- vista: planta (as máquinas arrastam-se para onde estão na realidade) ----
function mcPlanPos(rows){
  const pl = mc.prefs.plan = mc.prefs.plan || {}, cols = Math.max(2, Math.ceil(Math.sqrt(rows.length * 1.6)));
  rows.forEach((x, i) => { if(!pl[x.dev.id]) pl[x.dev.id] = { x: 6 + (i % cols) * (88 / cols), y: 8 + Math.floor(i / cols) * 24 }; });
  return pl;
}
function mcPlanHtml(rows){
  const pl = mcPlanPos(rows);
  let h = '<div class="mc-plan-bar"><span>' + t('mc_pl_hint') + '</span><button type="button" data-pl="reset">↺ ' + t('mc_pl_reset') + '</button></div><div class="mc-plan-area" id="mcPlanArea">';
  rows.forEach(({ dev, r, st }) => {
    const p = pl[dev.id], S = MC_STATUS[st], on = !!(r && r.online);
    h += '<div class="mc-ptile' + (selectedId === dev.id ? ' is-sel' : '') + '" data-id="' + escapeHtml(String(dev.id)) + '" style="left:' + p.x + '%;top:' + p.y + '%;--mc-c:' + S.color + '">' +
      '<span class="mc-dot"></span><div><b>' + escapeHtml(dev.name || dev.ip || '') + '</b><small>' + (on ? escapeHtml(mcHashText(r).join(' ')) + ' · ' + mcNum(r.temp, 0) + ' °C' : S.label) + '</small></div></div>';
  });
  return h + '</div>';
}
(function(){
  let drag = null;
  document.addEventListener('pointerdown', e => {
    const tile = e.target.closest('.mc-ptile'), area = $('mcPlanArea');
    if(!tile || !area || e.button !== 0) return;
    const r = tile.getBoundingClientRect();
    drag = { tile, id: tile.dataset.id, ox: e.clientX - r.left, oy: e.clientY - r.top, moved: false, sx: e.clientX, sy: e.clientY };
    mc.dragging = true;
  });
  window.addEventListener('pointermove', e => {
    if(!drag) return;
    if(!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
    drag.moved = true; drag.tile.classList.add('dragging');
    const a = $('mcPlanArea').getBoundingClientRect();
    const x = Math.max(0, Math.min(100 - (drag.tile.offsetWidth / a.width * 100), (e.clientX - drag.ox - a.left) / a.width * 100));
    const y = Math.max(0, Math.min(100 - (drag.tile.offsetHeight / a.height * 100), (e.clientY - drag.oy - a.top) / a.height * 100));
    drag.tile.style.left = x.toFixed(1) + '%'; drag.tile.style.top = y.toFixed(1) + '%';
    drag.pos = { x: +x.toFixed(1), y: +y.toFixed(1) };
  });
  window.addEventListener('pointerup', () => {
    if(!drag) return;
    if(drag.moved && drag.pos){ mc.prefs.plan[drag.id] = drag.pos; mcSavePrefs(); mc.justDragged = true; setTimeout(() => { mc.justDragged = false; }, 120); }
    drag.tile.classList.remove('dragging'); drag = null; mc.dragging = false;
  });
  document.addEventListener('click', e => {
    const hm = e.target.closest('[data-hm]');
    if(hm){ mc.prefs.heatMetric = hm.dataset.hm; mcSavePrefs(); renderMachineCards(); return; }
    if(e.target.closest('[data-pl="reset"]')){ mc.prefs.plan = {}; mcSavePrefs(); renderMachineCards(); }
  });
})();

// ---- janela "Experiências" ----
function mcXpOpen(){
  mcCompareClose();
  const m = document.createElement('div');
  m.id = 'mcCompare'; m.className = 'mc-cmp';
  m.innerHTML = '<div class="mc-cmp-card mc-help" role="dialog" aria-modal="true"><div class="mc-cmp-head"><b>✨ ' + t('mc_xp_title') + '</b><button type="button" data-cmp="close" aria-label="' + t('mc_cmp_close') + '">✕</button></div>' +
    '<div class="mc-th-form">' + MC_XP_ALL.map(k => '<label><span>' + t('mc_xp_' + k) + '</span><input type="checkbox" data-xp="' + k + '"' + (mc.prefs.xp[k] !== false ? ' checked' : '') + '></label>').join('') + '</div>' +
    '<div class="mc-cmp-note">' + t('mc_xp_note') + '</div></div>';
  m.addEventListener('click', e => { if(e.target === m || e.target.closest('[data-cmp="close"]')) m.remove(); });
  m.addEventListener('change', e => {
    const c = e.target.closest('[data-xp]');
    if(!c) return;
    mc.prefs.xp[c.dataset.xp] = c.checked; mcSavePrefs(); mc.lang = null; renderMachineCards();
    if(typeof renderNetworkMap === 'function') renderNetworkMap();
  });
  document.body.appendChild(m);
}

// ---- "+1" que sobe do cartão a cada partilha aceite ----
function mcFloat(id, delta, big){
  if(!mcXp('float')) return;
  const el = mc.els.get(id), hero = el && el.querySelector('.mc-hash');
  if(!hero || el.querySelectorAll('.mc-float').length > 3) return;
  const f = document.createElement('span');
  f.className = 'mc-float' + (big ? ' big' : '');
  f.textContent = big ? '🏆' : '+' + delta;
  f.style.left = (hero.offsetLeft + 20 + Math.random() * 70).toFixed(0) + 'px';
  f.style.top = (hero.offsetTop + 4) + 'px';
  el.appendChild(f);
  setTimeout(() => f.remove(), 1500);
}

// ---- confetti no cartão da meta, uma vez por dia, quando se chega aos 100% ----
function mcGoalConfetti(box){
  if(!mcXp('confetti')) return;
  const today = new Date().toDateString();
  try { if(localStorage.getItem('nerdqaxe:goal_done') === today) return; localStorage.setItem('nerdqaxe:goal_done', today); } catch(e) {}
  const tile = box.querySelector('[data-f="goal"]').closest('.mc-tile');
  const burst = document.createElement('div');
  burst.className = 'mc-burst';
  for(let i = 0; i < 26; i++){
    const p = document.createElement('i');
    p.style.setProperty('--a', (i / 26 * 360 + Math.random() * 12).toFixed(0) + 'deg');
    p.style.setProperty('--d', (50 + Math.random() * 80).toFixed(0) + 'px');
    p.style.background = ['#ffd34a', '#21ffb0', '#4fd6ff', '#ff5d5d', '#fff'][i % 5];
    burst.appendChild(p);
  }
  tile.appendChild(burst);
  setTimeout(() => burst.remove(), 2600);
  if(typeof mcLogEvent === 'function') mcLogEvent(t('mc_goal_done'), 'good');
}

// ---- onda que nasce no clique dos botões ----
document.addEventListener('pointerdown', e => {
  if(!mcXp('ripple')) return;
  const b = e.target.closest('.mc-actions button, .mc-fx-btn, .mc-fchip, .mc-views button, .mc-bulk button, .mc-heat-bar button');
  if(!b) return;
  const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2, rp = document.createElement('span');
  rp.className = 'mc-rip';
  rp.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
  b.appendChild(rp);
  setTimeout(() => rp.remove(), 650);
});
