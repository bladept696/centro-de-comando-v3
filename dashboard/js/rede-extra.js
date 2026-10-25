// ---------- Mapa da rede: partículas, zonas por grupo, diagnóstico do caminho, radar, exportar e ecrã inteiro ----------
// Acrescenta-se ao 18-rede.js sem o alterar: embrulha as funções que desenham o mapa.
const NMX = { diag: null, diagAt: 0, flowSig: '' };
const nmxSvg = tag => document.createElementNS('http://www.w3.org/2000/svg', tag);

// ---- cores extra: Wi-Fi, rejeições e hashrate ----
const NMX_MODES = ['wifi', 'rej', 'hash'];
(function(){
  const base = nmAccent;
  nmAccent = function(mode, r, link, effRank){
    if(!NMX_MODES.includes(mode) || !r || !r.online) return base(mode, r, link, effRank);
    if(mode === 'wifi'){ const v = Number(r.rssi); if(!isFinite(v)) return 'var(--muted)'; return v >= -60 ? 'var(--green)' : v >= -72 ? 'var(--amber)' : 'var(--red)'; }
    if(mode === 'rej'){
      const sh = (r.accepted || 0) + (r.rejected || 0);
      if(sh < 20) return 'var(--muted)';
      const p = r.rejected / sh * 100; return p < mc.th.rej / 2 ? 'var(--green)' : p < mc.th.rej ? 'var(--amber)' : 'var(--red)';
    }
    const max = Math.max(0, ...(devices || []).map(d => readings[d.id] && readings[d.id].online ? Number(readings[d.id].hashrate) || 0 : 0));
    const k = max > 0 ? (Number(r.hashrate) || 0) / max : 0;
    return k >= 0.75 ? 'var(--green)' : k >= 0.4 ? 'var(--amber)' : 'var(--red)';
  };
  NM_LEGENDS.wifi = [['var(--green)', 'mc_nx_wifi_good'], ['var(--amber)', 'mc_nx_wifi_ok'], ['var(--red)', 'mc_nx_wifi_bad'], ['var(--muted)', 'mc_nx_nodata']].map(x => [x[0], t(x[1])]);
  NM_LEGENDS.rej = [['var(--green)', 'mc_nx_rej_good'], ['var(--amber)', 'mc_nx_rej_ok'], ['var(--red)', 'mc_nx_rej_bad'], ['var(--muted)', 'mc_nx_nodata']].map(x => [x[0], t(x[1])]);
  NM_LEGENDS.hash = [['var(--green)', 'mc_nx_hash_good'], ['var(--amber)', 'mc_nx_hash_ok'], ['var(--red)', 'mc_nx_hash_bad']].map(x => [x[0], t(x[1])]);
})();

// ---- partículas a correr nas ligações e espessura pelo hashrate ----
function nmxHashRel(id){
  const r = readings[id];
  if(!r || !r.online) return 0;
  const max = Math.max(1e-9, ...(devices || []).map(d => readings[d.id] && readings[d.id].online ? Number(readings[d.id].hashrate) || 0 : 0));
  return Math.min(1, (Number(r.hashrate) || 0) / max);
}
function nmxFlow(){
  const svg = $('networkMapSvg');
  if(!svg) return;
  let g = svg.querySelector('.nm-flows');
  if(!mcXp('mapflow') || document.hidden){ if(g) g.remove(); NMX.flowSig = ''; nmEdges.forEach(e => { e.el.style.strokeWidth = ''; }); return; }
  const parts = [];
  let i = 0;
  nmEdges.forEach((e, key) => {
    const cls = e.el.getAttribute('class') || '';
    e.el.id = e.el.id || 'nmE' + (++nmxFlow.n);
    let rel = 0.5, dur = 4.6, color = 'var(--cyan)', n = 2;
    const mm = key.match(/m:([^>]+)/);
    if(key.indexOf('>p:') > 0 && mm){ rel = nmxHashRel(mm[1]); dur = 5.4 - 3.8 * rel; e.el.style.strokeWidth = (1.4 + 2.4 * rel).toFixed(2); }
    else if(key.startsWith('router>m:') && mm){ rel = nmxHashRel(mm[1]); dur = 6.2 - 3 * rel; color = 'var(--green)'; e.el.style.strokeWidth = (1.2 + 1.8 * rel).toFixed(2); }
    else if(key.endsWith('>net')){ dur = 7; color = 'var(--amber)'; n = 1; }
    else if(key === 'center>router'){ dur = 4; color = 'var(--green)'; }
    if(/\boff\b/.test(cls)) return;   // ligação em baixo: sem partículas
    for(let k = 0; k < n; k++) parts.push([e.el.id, dur.toFixed(2), (-(dur * k / n)).toFixed(2), color, i++]);
  });
  const sig = parts.map(p => p.join(':')).join('|');
  if(sig === NMX.flowSig && g) return;
  NMX.flowSig = sig;
  if(g) g.remove();
  g = nmxSvg('g'); g.setAttribute('class', 'nm-flows'); g.setAttribute('pointer-events', 'none');
  parts.forEach(([id, dur, begin, color]) => {
    const c = nmxSvg('circle'); c.setAttribute('r', '2.6'); c.setAttribute('class', 'nm-particle'); c.style.fill = color; c.style.color = color;
    const a = nmxSvg('animateMotion'); a.setAttribute('dur', dur + 's'); a.setAttribute('begin', begin + 's'); a.setAttribute('repeatCount', 'indefinite');
    const m = nmxSvg('mpath'); m.setAttribute('href', '#' + id); a.appendChild(m); c.appendChild(a); g.appendChild(c);
  });
  svg.appendChild(g);
}
nmxFlow.n = 0;

// ---- zonas por grupo, marcas de ligação em baixo e de pool de reserva ----
function nmxDecor(){
  const svg = $('networkMapSvg'), wrap = $('networkMapWrap');
  if(!svg || !wrap) return;
  svg.querySelectorAll('.nm-zones, .nm-marks').forEach(n => n.remove());
  const W = wrap.clientWidth, H = parseFloat(wrap.style.height) || wrap.clientHeight, flat = wrap.classList.contains('nm-3d');
  // zonas
  if(mcXp('mapzones')){
    const groups = {};
    (devices || []).forEach(d => { if(d.group){ const b = nmBox('m:' + d.id, W, H); if(b) (groups[d.group] = groups[d.group] || []).push(b); } });
    const names = Object.keys(groups).sort(), z = nmxSvg('g');
    z.setAttribute('class', 'nm-zones'); z.setAttribute('pointer-events', 'none');
    names.forEach((name, gi) => {
      const bs = groups[name], padX = flat ? 100 : 36, padY = flat ? 80 : 36, up = flat ? 64 : 12;
      const x0 = Math.min(...bs.map(b => b.x - b.w / 2)) - padX, x1 = Math.max(...bs.map(b => b.x + b.w / 2)) + padX;
      const y0 = Math.min(...bs.map(b => b.y - b.h / 2)) - padY - up, y1 = Math.max(...bs.map(b => b.y + b.h / 2)) + padY;
      const hue = (gi * 67 + 170) % 360, r = nmxSvg('rect');
      r.setAttribute('x', x0); r.setAttribute('y', y0); r.setAttribute('width', x1 - x0); r.setAttribute('height', y1 - y0); r.setAttribute('rx', 18);
      r.style.fill = 'hsla(' + hue + ',70%,55%,.07)'; r.style.stroke = 'hsla(' + hue + ',70%,60%,.55)'; r.setAttribute('class', 'nm-zone');
      const tx = nmxSvg('text'); tx.setAttribute('x', x0 + 14); tx.setAttribute('y', y0 + 20); tx.setAttribute('class', 'nm-zone-label'); tx.style.fill = 'hsl(' + hue + ',75%,70%)';
      tx.textContent = '🗂 ' + name;
      z.appendChild(r); z.appendChild(tx);
    });
    if(names.length) svg.insertBefore(z, svg.firstChild);
  }
  // marcas sobre as ligações
  const marks = nmxSvg('g');
  marks.setAttribute('class', 'nm-marks'); marks.setAttribute('pointer-events', 'none');
  nmEdges.forEach((e, key) => {
    const cls = e.el.getAttribute('class') || '';
    let txt = '', col = '';
    if(key.startsWith('router>m:') && /\boff\b/.test(cls)){ txt = '✕'; col = 'var(--red)'; }
    else if(/\bfb\b/.test(cls)){ txt = '⚠ ' + t('mc_nx_backup'); col = 'var(--amber)'; }
    if(!txt || typeof e.el.getTotalLength !== 'function') return;
    let p; try { p = e.el.getPointAtLength(e.el.getTotalLength() / 2); } catch(_) { return; }
    const tx = nmxSvg('text'); tx.setAttribute('x', p.x); tx.setAttribute('y', p.y + 4); tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('class', 'nm-mark'); tx.style.fill = col; tx.textContent = txt;
    marks.appendChild(tx);
  });
  svg.appendChild(marks);
}

// ---- destaque do que está ligado à máquina escolhida ----
function nmxSelection(){
  const wrap = $('networkMapWrap');
  if(!wrap) return;
  const id = typeof selectedId !== 'undefined' ? selectedId : null, dev = id != null && (devices || []).find(d => d.id === id);
  wrap.classList.toggle('has-sel', !!dev);
  const rel = new Set();
  if(dev){
    rel.add('m:' + dev.id); rel.add('router'); rel.add('center');
    const k = readings[dev.id] && readings[dev.id].pool;
    if(k){ rel.add('p:' + k); rel.add('net'); }
  }
  nmNodes.forEach((n, nid) => n.el.classList.toggle('rel', rel.has(nid)));
  nmEdges.forEach((e, key) => {
    const on = !!dev && (key.indexOf('m:' + dev.id) >= 0 || (key === 'center>router') || (key.startsWith('p:') && rel.has(key.split('>')[0])));
    e.el.classList.toggle('hl', on);
  });
}

// ---- diagnóstico do caminho: router, internet e DNS ----
async function nmxDiag(force){
  const box = $('nmDiag');
  if(!box) return;
  box.hidden = false;
  box.classList.add('busy');
  try {
    if(window.authReady) await window.authReady;
    const r = await fetch(`${API_BASE}/api/netcheck${force ? '?force=1' : ''}`);
    NMX.diag = await r.json();
    NMX.diagAt = Date.now();
  } catch(e) { NMX.diag = null; }
  box.classList.remove('busy');
  nmxDiagRender();
  nmxEdgeDiag();
}
function nmxLevel(ms, good, ok){ return ms == null ? 'bad' : ms < good ? 'good' : ms < ok ? 'ok' : 'bad'; }
function nmxDiagRender(){
  const box = $('nmDiag');
  if(!box) return;
  const d = NMX.diag;
  if(!d){ box.innerHTML = '<span class="nm-dg-title">🩺 ' + t('mc_dg_title') + '</span><span class="nm-dg-verdict bad">' + t('mc_dg_err') + '</span><button type="button" data-dg="run">' + t('mc_dg_run') + '</button>'; return; }
  const ms = v => v == null ? '—' : Math.round(v) + ' ms';
  const gl = nmxLevel(d.gateway.ms, 30, 100), il = nmxLevel(d.internet.ms, 60, 150), dl = nmxLevel(d.dns.ms, 80, 250);
  const weak = (devices || []).filter(x => readings[x.id] && readings[x.id].online && readings[x.id].rssi != null && readings[x.id].rssi <= mc.th.wifi).map(x => x.name || x.ip);
  const slow = (devices || []).filter(x => readings[x.id] && readings[x.id].online && readings[x.id].poolPing != null && readings[x.id].poolPing > mc.th.ping).map(x => x.name || x.ip);
  let v, lvl = 'bad';
  if(d.gateway.ms == null && d.internet.ms == null) v = t('mc_dg_v_local');
  else if(d.internet.ms == null) v = t('mc_dg_v_nonet');
  else if(d.dns.ms == null) v = t('mc_dg_v_dns');
  else if(il === 'bad') v = t('mc_dg_v_slow');
  else if(weak.length){ v = mct('mc_dg_v_wifi', weak.join(', ')); lvl = 'ok'; }
  else if(slow.length){ v = mct('mc_dg_v_pool', slow.join(', ')); lvl = 'ok'; }
  else { v = t('mc_dg_v_ok'); lvl = 'good'; }
  box.innerHTML = '<span class="nm-dg-title">🩺 ' + t('mc_dg_title') + '</span>' +
    '<span class="nm-dg-pill ' + gl + '">📡 ' + t('mc_dg_router') + ' <b>' + ms(d.gateway.ms) + '</b></span>' +
    '<span class="nm-dg-pill ' + il + '">🌐 ' + t('mc_dg_net') + ' <b>' + ms(d.internet.ms) + '</b></span>' +
    '<span class="nm-dg-pill ' + dl + '">🔎 DNS <b>' + ms(d.dns.ms) + '</b></span>' +
    '<span class="nm-dg-verdict ' + lvl + '">' + escapeHtml(v) + '</span><button type="button" data-dg="run">' + t('mc_dg_run') + '</button>';
}
// pinta os troços do mapa conforme o diagnóstico
function nmxEdgeDiag(){
  const d = NMX.diag;
  nmEdges.forEach((e, key) => {
    let bad = false;
    if(d){
      if(key === 'center>router') bad = d.gateway.ms == null;
      else if(key.indexOf('>p:') > 0 || key.endsWith('>net')) bad = d.internet.ms == null;
    }
    e.el.classList.toggle('diag-bad', bad);
  });
}
document.addEventListener('click', e => {
  if(e.target.closest('[data-dg="run"]')) nmxDiag(true);
});

// ---- exportar o mapa como imagem PNG (desenho plano do mapa) ----
function nmxExport(){
  const wrap = $('networkMapWrap');
  if(!wrap) return;
  const W = wrap.clientWidth, H = parseFloat(wrap.style.height) || wrap.clientHeight, S = 2, cs = getComputedStyle(document.body);
  const col = v => { const m = String(v).match(/var\((--[\w-]+)\)/); return m ? cs.getPropertyValue(m[1]).trim() || '#888' : v || '#888'; };
  const cv = document.createElement('canvas');
  cv.width = W * S; cv.height = (H + 56) * S;
  const g = cv.getContext('2d');
  g.scale(S, S);
  g.fillStyle = cs.getPropertyValue('--bg').trim() || '#0a1118'; g.fillRect(0, 0, W, H + 56);
  g.fillStyle = cs.getPropertyValue('--text').trim() || '#fff'; g.font = '700 15px system-ui,sans-serif'; g.fillText('🌐 ' + t('mc_nx_title') + ' · ' + new Date().toLocaleString(mcLocale()), 16, 28);
  g.translate(0, 48);
  g.lineWidth = 1.6;
  nmEdges.forEach(e => {
    const st = getComputedStyle(e.el), d = e.el.getAttribute('d');
    if(!d) return;
    g.strokeStyle = st.stroke && st.stroke !== 'none' ? st.stroke : '#556'; g.lineWidth = parseFloat(st.strokeWidth) || 1.6;
    g.setLineDash(st.strokeDasharray && st.strokeDasharray !== 'none' ? st.strokeDasharray.split(/[ ,]+/).map(parseFloat).filter(isFinite) : []);
    g.stroke(new Path2D(d));
  });
  g.setLineDash([]);
  nmNodes.forEach(n => {
    const el = n.el, w = 150, hh = 58, x = parseFloat(el.style.left) / 100 * W - w / 2, y = parseFloat(el.style.top) / 100 * H - hh / 2;
    const acc = col(getComputedStyle(el).getPropertyValue('--nm-accent'));
    g.fillStyle = cs.getPropertyValue('--panel-2').trim() || '#14202b'; g.strokeStyle = acc; g.lineWidth = 1.6;
    g.beginPath(); g.roundRect ? g.roundRect(x, y, w, hh, 9) : g.rect(x, y, w, hh); g.fill(); g.stroke();
    g.fillStyle = cs.getPropertyValue('--text').trim() || '#fff'; g.font = '700 12px system-ui,sans-serif';
    const name = (el.querySelector('.network-node-name') || {}).textContent || '', meta = (el.querySelector('.network-node-meta') || {}).textContent || '';
    g.fillText(name.slice(0, 22), x + 9, y + 20);
    g.fillStyle = cs.getPropertyValue('--muted').trim() || '#99a'; g.font = '10.5px system-ui,sans-serif'; g.fillText(meta.slice(0, 30), x + 9, y + 35);
    const vals = [...el.querySelectorAll('.network-node-stat b')].slice(0, 2).map(b => b.textContent).join('  ·  ');
    g.fillStyle = acc; g.fillText(vals.slice(0, 34), x + 9, y + 50);
  });
  cv.toBlob(b => {
    if(!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'mapa-da-rede-' + new Date().toISOString().slice(0, 10) + '.png';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    if(typeof setQuickActionStatus === 'function') setQuickActionStatus(t('mc_nx_exported'));
  });
}

// ---- ecrã inteiro (o mapa ocupa a janela) ----
function nmxFull(){
  const panel = document.querySelector('.network-map-panel');
  if(!panel) return;
  // o painel passa para o <body> enquanto está em ecrã inteiro: dentro da página há elementos com
  // animação e overflow que o prendem e o deixariam cortado ou invisível
  let on;
  if(panel.classList.contains('nm-full')){
    on = false; panel.classList.remove('nm-full');
    if(NMX.ph && NMX.ph.parentNode) NMX.ph.replaceWith(panel);
    NMX.ph = null;
  } else {
    on = true; NMX.ph = document.createComment('nm-placeholder');
    panel.parentNode.insertBefore(NMX.ph, panel);
    document.body.appendChild(panel); panel.classList.add('nm-full');
  }
  document.body.classList.toggle('nm-full-open', on);
  const b = $('nmxFullBtn'); if(b) b.textContent = on ? '✕ ' + t('mc_nx_exit') : '⛶ ' + t('mc_nx_full');
  setTimeout(() => { if(typeof renderNetworkMap === 'function') renderNetworkMap(); }, 60);
}
document.addEventListener('keydown', e => { if(e.key === 'Escape' && document.querySelector('.network-map-panel.nm-full')) nmxFull(); });

// ---- radar: varredura enquanto procura máquinas novas ----
async function nmxRadar(){
  const wrap = $('networkMapWrap');
  if(!wrap) return;
  wrap.classList.add('nm-radar');
  try {
    if(typeof mcScanNow === 'function') await mcScanNow(true);
    else if(typeof openScanModal === 'function') openScanModal(false);
  } finally { setTimeout(() => wrap.classList.remove('nm-radar'), 800); }
}

// ---- liga tudo ao desenho do mapa ----
(function(){
  const baseRender = renderNetworkMap, baseGeo = nmUpdateEdgeGeometry;
  renderNetworkMap = function(){
    baseRender.apply(this, arguments);
    try {
      const wrap = $('networkMapWrap');
      if(wrap && typeof mcScanBusy !== 'undefined') wrap.classList.toggle('nm-radar', !!mcScanBusy || !!scanInFlight);
      nmxSelection(); nmxDecor(); nmxEdgeDiag(); nmxFlow();
    } catch(e) { console.warn('mapa extra:', e); }
  };
  nmUpdateEdgeGeometry = function(){
    baseGeo.apply(this, arguments);
    try { nmxDecor(); } catch(e) {}
  };
})();

// ---- botões, caixa do diagnóstico e novas opções de cor ----
function nmxInit(){
  const ctr = document.querySelector('.network-map-controls'), tb = document.querySelector('.network-map-toolbar');
  if(!ctr || !tb || $('nmxFullBtn')) return;
  const mk = (id, txt, fn, title) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'network-map-btn'; b.id = id; b.textContent = txt; if(title) b.title = title; b.addEventListener('click', fn); ctr.appendChild(b); return b; };
  mk('nmxDiagBtn', '🩺 ' + t('mc_dg_title'), () => nmxDiag(true), t('mc_dg_tip'));
  mk('nmxRadarBtn', '📡 ' + t('mc_nx_radar'), nmxRadar, t('mc_nx_radar_tip'));
  mk('nmxPngBtn', '🖼 PNG', nmxExport, t('mc_nx_png_tip'));
  mk('nmxFullBtn', '⛶ ' + t('mc_nx_full'), nmxFull);
  const box = document.createElement('div');
  box.id = 'nmDiag'; box.className = 'nm-diag'; box.hidden = true;
  tb.insertAdjacentElement('afterend', box);
  // cores novas
  const sel = $('networkMapMode');
  if(sel){
    [['wifi', 'mc_nx_c_wifi'], ['rej', 'mc_nx_c_rej'], ['hash', 'mc_nx_c_hash']].forEach(([v, k]) => { const o = document.createElement('option'); o.value = v; o.textContent = t(k); sel.appendChild(o); });
    try { const m = localStorage.getItem(NM_MODE_KEY); if(NMX_MODES.includes(m)){ networkMapMode = m; sel.value = m; } } catch(e) {}
  }
  setTimeout(() => nmxDiag(false), 4000);
  setInterval(() => { if(!document.hidden && $('networkMapWrap') && $('networkMapWrap').offsetParent) nmxDiag(false); }, 5 * 60000);
}
nmxInit();
