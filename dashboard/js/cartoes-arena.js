// ---------- Cartões: Arena de hashes ----------
// Cada máquina é uma torre ao fundo e cada share aceite é um disparo para cima, numa escala logarítmica da
// dificuldade: do nível da pool (em baixo) até à "parede" do bloco (em cima, a dificuldade da rede).
// O que é real: a dificuldade da rede, a dificuldade da pool (calculada pelo ritmo das shares), o número de
// shares aceites e rejeitadas, e os recordes (linha dourada = melhor share de cada máquina). A altura dos
// disparos normais é uma amostra da distribuição estatística real das shares, por isso é ilustrativa.
const mcArena = { cv: null, ctx: null, shots: [], parts: [], raf: 0, rows: [], last: 0, hover: -1, mouse: null, boom: 0, poolD: {}, lay: null };
const MC_ARENA_COL = { ok: '#21ffb0', warn: '#ffb84a', warm: '#ffb84a', hot: '#ff5d5d', off: '#ff5d5d', portal: '#4fd6ff', idle: '#8a97a8' };
const MC_ARENA_H = 440;

function mcArenaNet(){ const d = typeof difficultyData !== 'undefined' && difficultyData && difficultyData.currentDifficulty; return d > 1e6 ? d : 1e14; }
// dificuldade da pool: a do cartão, se existir; senão calcula-se pelo ritmo das shares (hashrate = shares/s × dificuldade × 2^32)
function mcArenaPool(id, r){
  const own = Number(r && (r.poolDifficulty || r.stratumDifficulty));
  if(own > 0) return (mcArena.poolD[id] = own);
  const up = Number(r && r.uptime), acc = Number(r && r.accepted), gh = Number(r && r.hashrate);
  if(r && r.online && up > 180 && acc >= 4 && gh > 0) mcArena.poolD[id] = Math.max(16, gh * 1e9 / (acc / up) / 4294967296);
  return mcArena.poolD[id] || 4096;
}
function mcArenaLayout(){
  const W = mcArena.cv.clientWidth, H = MC_ARENA_H, L = { W, H, left: 58, right: 14, top: 46, bottom: 66 };
  L.plotH = H - L.top - L.bottom; L.plotW = W - L.left - L.right;
  const n = Math.max(1, mcArena.rows.length); L.lane = L.plotW / n;
  const pools = mcArena.rows.map(x => mcArenaPool(x.dev.id, x.r));
  L.lo = Math.floor(Math.log10(Math.max(10, Math.min(...(pools.length ? pools : [4096])) / 4)));
  L.hi = Math.log10(mcArenaNet());
  L.y = d => L.top + (1 - (Math.log10(Math.max(1, d)) - L.lo) / (L.hi - L.lo)) * L.plotH;
  L.x = i => L.left + (i + .5) * L.lane;
  return (mcArena.lay = L);
}
function mcArenaRender(board, rows){
  if(!board.querySelector('.mc-arena') || board.dataset.alang !== currentLang){
    board.dataset.alang = currentLang;
    board.innerHTML = '<div class="mc-arena"><div class="mc-arena-bar"><b>🎯 ' + t('mc_ar_title') + '</b><span class="lg ok">' + t('mc_ar_ok') + '</span><span class="lg bad">' + t('mc_ar_bad') + '</span><span class="lg gold">' + t('mc_ar_rec') + '</span></div>' +
      '<canvas class="mc-arena-cv" height="' + MC_ARENA_H + '"></canvas><div class="mc-arena-note">' + t('mc_ar_note') + '</div></div>';
    mcArena.cv = board.querySelector('.mc-arena-cv'); mcArena.ctx = mcArena.cv.getContext('2d'); mcArena.shots = []; mcArena.parts = [];
    mcArena.cv.addEventListener('pointermove', e => { const b = mcArena.cv.getBoundingClientRect(); mcArena.mouse = { x: e.clientX - b.left, y: e.clientY - b.top }; });
    mcArena.cv.addEventListener('pointerleave', () => { mcArena.mouse = null; });
    mcArena.cv.addEventListener('click', () => { const row = mcArena.rows[mcArena.hover]; if(row){ selectedId = row.dev.id; if(typeof renderAll === 'function') renderAll(); } });
  }
  mcArena.rows = rows;
  if(!mcArena.raf){ mcArena.last = performance.now(); mcArena.raf = requestAnimationFrame(mcArenaStep); }
}

// disparo de uma máquina: ok = shares aceites novas, bad = rejeitadas, rec = melhor share nova (real)
function mcArenaShot(id, ok, bad, rec){
  if(!mcArena.cv || !mcArena.cv.isConnected || document.hidden) return;
  const i = mcArena.rows.findIndex(x => x.dev.id === id);
  if(i < 0) return;
  const r = mcArena.rows[i].r, pool = mcArenaPool(id, r), best = Number(r && r.best) || 0;
  const add = (kind, d) => { if(mcArena.shots.length < 160) mcArena.shots.push({ i, kind, d, delay: Math.random() * 1600, t: 0, dur: 0, hit: false }); };
  for(let k = 0; k < Math.min(ok, 8); k++){
    let d = pool * Math.pow(10, -Math.log10(Math.random() || .5));   // amostra da distribuição real das shares (Pareto)
    if(best > pool) d = Math.min(d, best * .98);
    add('ok', d);
  }
  for(let k = 0; k < Math.min(bad, 3); k++) add('bad', pool * 1.6);
  if(rec) add('rec', best);
  if(!mcArena.raf){ mcArena.last = performance.now(); mcArena.raf = requestAnimationFrame(mcArenaStep); }
}
function mcArenaBoom(){ mcArena.boom = performance.now(); }

function mcArenaBurst(x, y, col, n, speed){
  for(let k = 0; k < n && mcArena.parts.length < 400; k++){ const a = Math.random() * 6.283, v = speed * (.3 + Math.random()); mcArena.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * .2, life: 0, max: .5 + Math.random() * .6, col }); }
}
function mcArenaStep(now){
  const dt = Math.min(.05, (now - mcArena.last) / 1000); mcArena.last = now;
  const cv = mcArena.cv;
  if(!cv || !cv.isConnected || !document.body.contains(cv)){ mcArena.raf = 0; return; }
  if(document.hidden){ mcArena.raf = requestAnimationFrame(mcArenaStep); return; }
  const dpr = Math.min(2, window.devicePixelRatio || 1), cw = cv.clientWidth;
  if(cv.width !== Math.round(cw * dpr)){ cv.width = Math.round(cw * dpr); cv.height = Math.round(MC_ARENA_H * dpr); }
  const ctx = mcArena.ctx; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const L = mcArenaLayout(), rows = mcArena.rows;
  ctx.clearRect(0, 0, L.W, L.H);
  // fundo
  const bg = ctx.createLinearGradient(0, 0, 0, L.H); bg.addColorStop(0, '#0a1a22'); bg.addColorStop(1, '#050b10');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, L.W, L.H);
  // grelha por décadas
  ctx.font = '10px "JetBrains Mono",monospace'; ctx.textBaseline = 'middle';
  const suf = ['', 'K', 'M', 'G', 'T', 'P', 'E'];
  for(let e = L.lo; e <= Math.floor(L.hi); e++){
    const y = L.y(Math.pow(10, e));
    ctx.strokeStyle = 'rgba(120,170,190,.10)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L.left, y); ctx.lineTo(L.W - L.right, y); ctx.stroke();
    ctx.fillStyle = 'rgba(150,185,200,.55)'; ctx.textAlign = 'right'; ctx.fillText('1' + '0'.repeat(e % 3) + (suf[Math.floor(e / 3)] || ''), L.left - 8, y);
  }
  // parede do bloco
  const wy = L.top - 6, boom = Math.max(0, 1 - (now - mcArena.boom) / 2600);
  const wg = ctx.createLinearGradient(0, 8, 0, wy + 6); wg.addColorStop(0, boom ? '#ffd34a' : '#3a2a0a'); wg.addColorStop(1, boom ? '#ff9b21' : '#6b4a12');
  ctx.fillStyle = wg; ctx.fillRect(L.left, 10, L.plotW, wy - 4);
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1;
  for(let r = 0; r < 3; r++){ const y = 10 + r * ((wy - 4) / 3); ctx.beginPath(); ctx.moveTo(L.left, y); ctx.lineTo(L.left + L.plotW, y); ctx.stroke();
    for(let x = L.left + (r % 2 ? 0 : 22); x < L.left + L.plotW; x += 44){ ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + (wy - 4) / 3); ctx.stroke(); } }
  ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'center'; ctx.font = '700 11px "Space Grotesk",sans-serif';
  ctx.fillText('⛓ ' + t('mc_ar_wall') + ' · ' + (() => { const f = formatDiff(mcArenaNet()); return f.value + ' ' + f.unit; })(), L.left + L.plotW / 2, 10 + (wy - 4) / 2);
  if(boom){ ctx.fillStyle = 'rgba(255,211,74,' + (.35 * boom).toFixed(2) + ')'; ctx.fillRect(0, 0, L.W, L.H); }
  // faixas, torres e recordes
  mcArena.hover = -1;
  if(mcArena.mouse && mcArena.mouse.x >= L.left && mcArena.mouse.x <= L.W - L.right) mcArena.hover = Math.min(rows.length - 1, Math.floor((mcArena.mouse.x - L.left) / L.lane));
  let closest = -1, closestBest = 0;
  rows.forEach((x, i) => {
    const r = x.r, on = !!(r && r.online), col = MC_ARENA_COL[x.st] || '#8a97a8', cx = L.x(i), best = on ? Number(r.best) || 0 : 0;
    if(best > closestBest){ closestBest = best; closest = i; }
    if(i === mcArena.hover){ ctx.fillStyle = 'rgba(79,214,255,.07)'; ctx.fillRect(L.left + i * L.lane, L.top, L.lane, L.plotH + 12); }
    if(i) { ctx.strokeStyle = 'rgba(120,170,190,.06)'; ctx.beginPath(); ctx.moveTo(L.left + i * L.lane, L.top); ctx.lineTo(L.left + i * L.lane, L.top + L.plotH); ctx.stroke(); }
    // torre
    const by = L.top + L.plotH + 6, tw = Math.min(26, L.lane * .5);
    ctx.globalAlpha = on ? 1 : .35;
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = on ? 10 : 0;
    ctx.beginPath(); ctx.moveTo(cx - tw / 2, by + 14); ctx.lineTo(cx + tw / 2, by + 14); ctx.lineTo(cx + tw / 5, by + 2); ctx.lineTo(cx - tw / 5, by + 2); ctx.closePath(); ctx.fill();
    ctx.fillRect(cx - 2, by - 6, 4, 9); ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(210,230,240,.85)'; ctx.font = '600 10px "Space Grotesk",sans-serif'; ctx.textAlign = 'center';
    const nm = String(x.dev.name || x.dev.ip || ''); ctx.fillText(nm.length > Math.max(5, L.lane / 6.5) ? nm.slice(0, Math.max(4, Math.floor(L.lane / 6.5) - 1)) + '…' : nm, cx, by + 28);
    ctx.fillStyle = 'rgba(150,185,200,.7)'; ctx.font = '10px "JetBrains Mono",monospace';
    ctx.fillText(on ? mcHashText(r).join(' ') : '—', cx, by + 42);
    // recorde real
    if(best > mcArenaPool(x.dev.id, r)){
      const y = L.y(best); ctx.strokeStyle = '#ffd34a'; ctx.lineWidth = 2; ctx.shadowColor = '#ffd34a'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.moveTo(cx - L.lane * .36, y); ctx.lineTo(cx + L.lane * .36, y); ctx.stroke(); ctx.shadowBlur = 0;
      if(L.lane > 46){ const f = formatDiff(best); ctx.fillStyle = '#ffe9a8'; ctx.font = '10px "JetBrains Mono",monospace'; ctx.fillText(f.value + ' ' + f.unit, cx, y - 8); }
    }
  });
  // disparos
  mcArena.shots = mcArena.shots.filter(s => {
    if(s.delay > 0){ s.delay -= dt * 1000; return true; }
    const L2 = L, cx = L2.x(s.i), y0 = L2.top + L2.plotH, col = s.kind === 'bad' ? '255,93,93' : s.kind === 'rec' ? '255,211,74' : '33,255,176';
    const peak = Math.max(L2.top, L2.y(s.d));
    if(!s.dur) s.dur = .5 + Math.min(1.4, (y0 - peak) / L2.plotH * 2.2) + (s.kind === 'rec' ? .5 : 0);
    s.t += dt / s.dur;
    if(s.t < 1){
      const e = 1 - Math.pow(1 - s.t, 3), y = y0 + (peak - y0) * e, tail = Math.min(46, (y0 - y) * .6);
      const g = ctx.createLinearGradient(cx, y + tail, cx, y); g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(1, 'rgba(' + col + ',.95)');
      ctx.strokeStyle = g; ctx.lineWidth = s.kind === 'rec' ? 3.2 : s.kind === 'bad' ? 2.4 : 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx + (s.kind === 'ok' ? Math.sin(s.i * 7 + s.d) * 5 : 0), y + tail); ctx.lineTo(cx + (s.kind === 'ok' ? Math.sin(s.i * 7 + s.d) * 5 : 0), y); ctx.stroke();
      return true;
    }
    if(!s.hit){ s.hit = true; const bx = cx + (s.kind === 'ok' ? Math.sin(s.i * 7 + s.d) * 5 : 0); mcArenaBurst(bx, peak, s.kind === 'bad' ? '#ff5d5d' : s.kind === 'rec' ? '#ffd34a' : '#21ffb0', s.kind === 'rec' ? 26 : s.kind === 'bad' ? 9 : 5, s.kind === 'rec' ? 130 : 60); }
    return false;
  });
  // partículas
  mcArena.parts = mcArena.parts.filter(p => {
    p.life += dt; if(p.life >= p.max) return false;
    p.vy += 160 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    ctx.globalAlpha = 1 - p.life / p.max; ctx.fillStyle = p.col; ctx.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4); ctx.globalAlpha = 1;
    return true;
  });
  if(boom && Math.random() < .5) mcArenaBurst(L.left + Math.random() * L.plotW, wy, '#ffd34a', 3, 90);
  // mais perto do bloco
  if(closest >= 0 && closestBest > 1){
    const pct = Math.min(100, Math.log10(closestBest) / Math.log10(mcArenaNet()) * 100), f = formatDiff(closestBest);
    ctx.fillStyle = 'rgba(255,233,168,.9)'; ctx.font = '700 10.5px "Space Grotesk",sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(mct('mc_ar_closest', rows[closest].dev.name || rows[closest].dev.ip, f.value + ' ' + f.unit, pct.toFixed(0)), L.W - L.right - 4, L.top + 10);
  }
  // dica ao passar o rato
  if(mcArena.hover >= 0 && mcArena.mouse){
    const x = rows[mcArena.hover], r = x.r, on = !!(r && r.online), pd = mcArenaPool(x.dev.id, r), fp = formatDiff(pd), lines = [String(x.dev.name || x.dev.ip || ''), on ? mcHashText(r).join(' ') + ' · ' + mcNum(r.temp, 0) + ' °C' : MC_STATUS[x.st].label, mct('mc_ar_pool', fp.value + ' ' + fp.unit)];
    if(on && r.best){ const fb = formatDiff(Number(r.best)); lines.push(mct('mc_ar_best', fb.value + ' ' + fb.unit)); }
    ctx.font = '11px "JetBrains Mono",monospace'; const w = Math.max(...lines.map(s => ctx.measureText(s).width)) + 16, h = lines.length * 16 + 10;
    let tx = mcArena.mouse.x + 14, ty = mcArena.mouse.y + 10; if(tx + w > L.W - 4) tx = mcArena.mouse.x - w - 10; if(ty + h > L.H - 4) ty = L.H - h - 4;
    ctx.fillStyle = 'rgba(8,18,26,.94)'; ctx.strokeStyle = 'rgba(79,214,255,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(tx, ty, w, h, 8) : ctx.rect(tx, ty, w, h); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8f6ff'; ctx.textAlign = 'left'; lines.forEach((s, k) => ctx.fillText(s, tx + 8, ty + 13 + k * 16));
  }
  mcArena.raf = requestAnimationFrame(mcArenaStep);
}
