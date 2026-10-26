// ---------- Cartões: contagem da rede (ajuste de dificuldade e halving) e chuva de shares ----------
// A contagem usa os dados da rede que o resumo já carrega (difficultyData) e atualiza-se a cada segundo.
// A chuva faz cair uma gota do cartão por cada share aceite (verde) ou rejeitada (vermelho).

// ---- contagem decrescente: dois anéis com o progresso e o tempo que falta ----
const MC_HALVING_EVERY = 210000;
const mcRain = { drops: [], cv: null, ctx: null, raf: 0, ctObj: null, ctAt: 0 };
function mcCountTile(){
  const ring = (k, label) => '<div class="mc-ct"><div class="mc-ring" data-f="' + k + 'R"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="bg" cx="32" cy="32" r="27"/><circle class="fg" data-f="' + k + 'Fg" cx="32" cy="32" r="27" pathLength="100"/></svg><b data-f="' + k + 'P">—</b></div>' +
    '<div class="mc-ct-txt"><em>' + label + '</em><b data-f="' + k + 'T">—</b><small data-f="' + k + 'S"></small></div></div>';
  return '<div class="mc-tile mc-count"><span>⏳ ' + t('mc_ct_title') + '</span><div class="mc-ct-row">' + ring('adj', t('mc_ct_adj')) + ring('hal', t('mc_ct_halv')) + '</div></div>';
}
function mcCountFmt(sec){
  if(!isFinite(sec) || sec < 0) return '—';
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = Math.floor(sec % 60), p = n => String(n).padStart(2, '0');
  return (d ? d + (d === 1 ? ' ' + t('mc_ct_day') : ' ' + t('mc_ct_days')) + ' ' : '') + p(h) + ':' + p(m) + ':' + p(s);
}
function mcCountTick(){
  const box = document.querySelector('#mcSummary .mc-count');
  if(!box || document.hidden || !box.offsetParent) return;
  const set = (f, v) => { const n = box.querySelector('[data-f="' + f + '"]'); if(n && n.textContent !== v) n.textContent = v; };
  const ring = (k, pct, soon) => { const fg = box.querySelector('[data-f="' + k + 'Fg"]'); if(fg) fg.style.strokeDashoffset = (100 - Math.max(0, Math.min(100, pct))).toFixed(2); box.querySelector('[data-f="' + k + 'R"]').classList.toggle('soon', !!soon); };
  const d = typeof difficultyData !== 'undefined' ? difficultyData : null;
  if(!d || !d.currentHeight){ const late = performance.now() > 60000; ['adj', 'hal'].forEach(k => { set(k + 'T', '—'); set(k + 'S', t(late ? 'mc_ct_fail' : 'mc_ct_wait')); set(k + 'P', '—'); }); return; }
  const loc = typeof mcLocale === 'function' ? mcLocale() : undefined;
  // próximo ajuste de dificuldade
  const left = d.estimatedRetargetDate ? (d.estimatedRetargetDate - Date.now()) / 1000 : NaN, pct = Number(d.progressPercent) || 0;
  set('adjT', mcCountFmt(left)); set('adjP', pct.toFixed(0) + '%');
  const ch = Number(d.difficultyChange);
  set('adjS', mct('mc_ct_blocks', Number(d.remainingBlocks || 0).toLocaleString(loc)) + (isFinite(ch) ? ' · ' + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%' : ''));
  ring('adj', pct, left > 0 && left < 3600);
  // próximo halving (10 min por bloco)
  const h = d.currentHeight, next = (Math.floor(h / MC_HALVING_EVERY) + 1) * MC_HALVING_EVERY, blocks = next - h, hp = (h % MC_HALVING_EVERY) / MC_HALVING_EVERY * 100;
  if(mcRain.ctObj !== d){ mcRain.ctObj = d; mcRain.ctAt = Date.now(); }
  const hs = Math.max(0, blocks * 600 - (Date.now() - mcRain.ctAt) / 1000);
  set('halT', mcCountFmt(hs)); set('halP', hp.toFixed(0) + '%');
  set('halS', mct('mc_ct_blocks', blocks.toLocaleString(loc)) + ' · ' + new Date(Date.now() + hs * 1000).toLocaleDateString(loc, { month: 'short', year: 'numeric' }));
  ring('hal', hp, false);
}
setInterval(mcCountTick, 1000);

// ---- chuva de shares ----
function mcRainCanvas(){
  if(mcRain.cv) return mcRain.cv;
  const cv = document.createElement('canvas');
  cv.className = 'mc-rain'; cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  mcRain.cv = cv; mcRain.ctx = cv.getContext('2d');
  return cv;
}
function mcRainSize(){
  const cv = mcRain.cv, dpr = Math.min(2, window.devicePixelRatio || 1);
  if(cv.width !== Math.round(innerWidth * dpr) || cv.height !== Math.round(innerHeight * dpr)){ cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px'; }
  mcRain.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function mcRainDrop(id, ok, bad){
  if(typeof mcXp !== 'function' || !mcXp('rain') || document.hidden) return;
  const el = mc.els.get(id);
  if(!el || !el.isConnected) return;
  const r = el.getBoundingClientRect();
  if(r.bottom < 0 || r.top > innerHeight) return;
  mcRainCanvas();
  const add = (n, bad2) => {
    for(let i = 0; i < Math.min(n, bad2 ? 4 : 6); i++){
      if(mcRain.drops.length > 90) return;
      mcRain.drops.push({ x: r.left + 14 + Math.random() * (r.width - 28), y: r.top + 8, vy: 30 + Math.random() * 40, end: Math.min(innerHeight - 4, r.top + r.height * (.55 + Math.random() * .4)),
        bad: bad2, delay: Math.random() * 1400, born: 0, splash: 0 });
    }
  };
  add(ok, false); add(bad, true);
  if(!mcRain.raf) mcRain.last = performance.now(), mcRain.raf = requestAnimationFrame(mcRainStep);
}
function mcRainStep(now){
  const dt = Math.min(.05, (now - mcRain.last) / 1000); mcRain.last = now;
  mcRainSize();
  const ctx = mcRain.ctx;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  mcRain.drops = mcRain.drops.filter(d => {
    if(d.delay > 0){ d.delay -= dt * 1000; return true; }
    const col = d.bad ? '255,93,93' : '33,255,176';
    if(d.splash){
      d.splash += dt; const k = d.splash / .45;
      if(k >= 1) return false;
      ctx.strokeStyle = 'rgba(' + col + ',' + (.7 * (1 - k)).toFixed(2) + ')'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(d.x, d.end, 3 + k * 11, 1.2 + k * 3.4, 0, 0, 7); ctx.stroke();
      return true;
    }
    d.vy += 900 * dt; d.y += d.vy * dt;
    if(d.y >= d.end){ d.y = d.end; d.splash = .001; return true; }
    const len = Math.min(16, d.vy * .035), g = ctx.createLinearGradient(d.x, d.y - len, d.x, d.y);
    g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(1, 'rgba(' + col + ',.95)');
    ctx.strokeStyle = g; ctx.lineWidth = d.bad ? 2.6 : 1.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(d.x, d.y - len); ctx.lineTo(d.x, d.y); ctx.stroke();
    return true;
  });
  if(mcRain.drops.length) mcRain.raf = requestAnimationFrame(mcRainStep);
  else { mcRain.raf = 0; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}
