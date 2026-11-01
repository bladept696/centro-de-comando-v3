// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Banner "Hash Commander" em estilo cyberpunk / cinemático ----------
// Desenha no canvas do banner do topo (banner-cyber.css trata das letras e da moeda):
//  · placa de circuito escura com pistas de cobre e furos; impulsos de energia correm dos chips até à moeda;
//  · uma fila de chips ASIC em 3D em baixo, com o "hash" de cada um; acendem quando "encontram uma share";
//  · raios elétricos à volta da moeda, faíscas laranja a subir, fumo nos cantos e chuva de hashes em cima;
//  · ao centro, em baixo, a altura do último bloco real (quando o painel já a conhece).
// As letras inclinam devagar sozinhas e seguem o rato. Pára quando o banner sai do ecrã, durante o scroll e no Modo Desempenho.
(function(){
  const wrap = document.getElementById('hcBanner'), canvas = document.getElementById('hcBannerCanvas');
  const text = document.getElementById('hcBannerText');
  if(!wrap || !canvas || !text) return;
  const ctx = canvas.getContext('2d'), HEX = '0123456789abcdef';
  const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e) { return false; } })();
  const rnd = n => { let s = ''; for(let i = 0; i < n; i++) s += HEX[Math.floor(Math.random() * 16)]; return s; };
  let W = 0, H = 0, DPR = 1, traces = [], chips = [], pulses = [], embers = [], smoke = [], rain = [], bolts = [], boltT = 0, lastT = 0;
  let mx = 0, my = 0, tx = 0, ty = 0;

  const realHeight = () => {
    try { if(typeof seenBlockHeights !== 'undefined' && seenBlockHeights.size) return Math.max(...seenBlockHeights); } catch(e) {}
    try { if(typeof difficultyData !== 'undefined' && difficultyData && difficultyData.currentHeight) return difficultyData.currentHeight; } catch(e) {}
    return 0;
  };
  // centro e raio da moeda, relativos ao banner
  function coin(){
    const c = wrap.querySelector('.hc-bcoin'); if(!c) return { x: W / 2, y: H * .45, r: 20 };
    const a = c.getBoundingClientRect(), b = wrap.getBoundingClientRect();
    return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2, r: a.height / 2 };
  }

  // pista com curvas a 45°: sobe do ponto (x0,y0) até à altura yt e depois segue na horizontal até xt
  function route(x0, y0, xt, yt){
    const pts = [[x0, y0]], d = Math.min(Math.abs(xt - x0), Math.abs(y0 - yt)) * .5, dir = Math.sign(xt - x0) || 1;
    const ymid = yt + d;
    pts.push([x0, ymid + 0], [x0 + dir * d, yt], [xt, yt]);
    return pts;
  }
  function resize(){
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = wrap.clientWidth; H = wrap.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const c = coin(), small = W < 640;
    // chips em baixo, à esquerda e à direita, deixando o centro livre para a altura do bloco
    const cw = small ? 34 : 46, gap = small ? 8 : 14, free = small ? 120 : 220, side = (W - free) / 2 - 16;
    const per = Math.max(1, Math.floor((side + gap) / (cw + gap)));
    chips = [];
    for(let i = 0; i < per; i++){
      chips.push({ x: 16 + i * (cw + gap) + cw / 2, w: cw, id: '00' + rnd(4), lit: 0 });
      chips.push({ x: W - 16 - i * (cw + gap) - cw / 2, w: cw, id: '00' + rnd(4), lit: 0 });
    }
    const cy = H - (small ? 18 : 24);
    chips.forEach(ch => { ch.y = cy; });
    // pistas dos chips até à moeda (a altura de cada uma varia para não se sobreporem)
    traces = chips.map((ch, i) => {
      const yt = c.y + (i % 5 - 2) * (small ? 4 : 7), xt = ch.x < c.x ? c.x - c.r - 4 : c.x + c.r + 4;
      return { pts: route(ch.x, ch.y - 10, xt, yt), chip: ch, main: true };
    });
    // pistas de fundo, só decoração
    for(let k = 0; k < (small ? 10 : 22); k++){
      const x0 = Math.random() * W, y0 = Math.random() * H, len = 40 + Math.random() * 120, dir = Math.random() < .5 ? -1 : 1, up = Math.random() < .5 ? -1 : 1;
      const d = 14 + Math.random() * 24;
      traces.push({ pts: [[x0, y0], [x0 + dir * len * .5, y0], [x0 + dir * (len * .5 + d), y0 + up * d], [x0 + dir * (len + d), y0 + up * d]], main: false });
    }
    traces.forEach(t => { t.len = 0; for(let i = 1; i < t.pts.length; i++) t.len += Math.hypot(t.pts[i][0] - t.pts[i - 1][0], t.pts[i][1] - t.pts[i - 1][1]); });
    rain = Array.from({ length: small ? 6 : 14 }, (_, i) => {
      const left = i % 2 === 0, x = left ? 8 + Math.random() * W * .16 : W - 8 - Math.random() * W * .16;
      return { x, y: Math.random() * H, v: 14 + Math.random() * 22, s: rnd(10) };
    });
    smoke = Array.from({ length: 12 }, (_, i) => newSmoke(i % 2 === 0, true));
  }
  function newSmoke(left, scatter){
    return { left, x: left ? Math.random() * W * .15 : W - Math.random() * W * .15, y: H + 10 - (scatter ? Math.random() * H : 0), r: 30 + Math.random() * 40, vx: (left ? 1 : -1) * (2 + Math.random() * 5), vy: -(5 + Math.random() * 8), a: .05 + Math.random() * .07 };
  }
  function along(t, k){
    let d = t.len * k;
    for(let i = 1; i < t.pts.length; i++){ const p = t.pts[i - 1], q = t.pts[i], s = Math.hypot(q[0] - p[0], q[1] - p[1]); if(d <= s){ const u = s ? d / s : 0; return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]; } d -= s; }
    return t.pts[t.pts.length - 1];
  }
  function glow(x, y, r, rgb, a){
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,245,220,${a})`); g.addColorStop(.3, `rgba(${rgb},${a * .8})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  // raio elétrico: linha partida entre dois ângulos do anel à volta da moeda
  function makeBolt(c){
    const a0 = Math.random() * Math.PI * 2, span = .6 + Math.random() * 1.4, R = c.r * (1.18 + Math.random() * .25), n = 9, pts = [];
    for(let i = 0; i <= n; i++){ const a = a0 + span * i / n, j = (i && i < n) ? (Math.random() - .5) * c.r * .32 : 0; pts.push([Math.cos(a) * (R + j), Math.sin(a) * (R + j)]); }
    return { pts, life: 0, max: .12 + Math.random() * .2 };
  }

  function chipBox(ch){
    const w = ch.w, h = w * .5, d = 6, x = ch.x - w / 2, y = ch.y - h / 2, lit = ch.lit;
    // pinos dourados nos lados
    ctx.strokeStyle = '#a77a2a'; ctx.lineWidth = 1;
    for(let i = 0; i < 5; i++){ const py = y + 3 + i * (h - 6) / 4; ctx.beginPath(); ctx.moveTo(x - 3, py); ctx.lineTo(x, py); ctx.moveTo(x + w, py); ctx.lineTo(x + w + 3, py); ctx.stroke(); }
    // frente (espessura) e topo
    ctx.fillStyle = '#0b0c0e'; ctx.fillRect(x, y + h, w, d);
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#2a2e35'); g.addColorStop(1, '#14171b');
    ctx.save(); ctx.shadowColor = '#ff8a1a'; ctx.shadowBlur = 6 + lit * 18;
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.restore();
    ctx.strokeStyle = `rgba(255,${150 + lit * 90},${60 + lit * 120},${.45 + lit * .55})`; ctx.lineWidth = 1 + lit; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
    ctx.fillStyle = `rgba(255,${190 + lit * 60},${120 + lit * 100},${.65 + lit * .35})`;
    ctx.font = `600 ${Math.max(7, w * .17)}px "JetBrains Mono", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch.id, ch.x, ch.y + 1);
    glow(x + w - 4, y + 4, 4 + lit * 4, '255,150,40', .5 + lit * .5);   // LED
  }

  function frame(ts, still){
    const dt = still ? 0 : Math.min(.1, (ts - lastT) / 1000); lastT = ts;
    const s = ts / 1000, c = coin();
    ctx.clearRect(0, 0, W, H);
    // pistas de cobre e furos
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for(const t of traces){
      ctx.strokeStyle = t.main ? 'rgba(190,105,35,.6)' : 'rgba(160,90,30,.3)'; ctx.lineWidth = t.main ? 1.6 : 1.1;
      ctx.beginPath(); t.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      const e = t.pts[t.pts.length - 1];
      ctx.strokeStyle = t.main ? 'rgba(220,140,50,.55)' : 'rgba(170,100,40,.3)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(e[0], e[1], t.main ? 2.4 : 2, 0, 7); ctx.stroke();
    }
    // chuva de hashes nos cantos de cima
    ctx.font = '10px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for(const r of rain){
      r.y += r.v * dt;
      for(let k = 0; k < 7; k++){ const y = r.y - k * 12; if(y < -12 || y > H * .7) continue; const a = (1 - k / 7) * (1 - y / (H * .7));
        ctx.fillStyle = k === 0 ? `rgba(255,230,190,${a * .8})` : `rgba(255,150,50,${a * .45})`; ctx.fillText(r.s[k % r.s.length], r.x, y); }
      if(r.y - 84 > H * .7){ r.y = -10 - Math.random() * 40; r.s = rnd(10); }
    }
    // fumo nos cantos de baixo
    for(let i = 0; i < smoke.length; i++){
      const m = smoke[i]; m.x += m.vx * dt; m.y += m.vy * dt; m.r += 6 * dt;
      const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r); g.addColorStop(0, `rgba(170,165,160,${m.a})`); g.addColorStop(1, 'rgba(170,165,160,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 7); ctx.fill();
      if(m.y + m.r < H * .25 || m.r > 110) smoke[i] = newSmoke(m.left, false);
    }
    // um chip "encontra uma share" de vez em quando e manda um impulso pela pista até à moeda
    if(!still && Math.random() < dt * 2.6){ const t = traces[Math.floor(Math.random() * chips.length)]; if(t && t.main){ t.chip.lit = 1; pulses.push({ t, k: 0, v: .55 + Math.random() * .4 }); } }
    if(!still && Math.random() < dt * 1.2){ const bg = traces.filter(t => !t.main); const t = bg[Math.floor(Math.random() * bg.length)]; if(t) pulses.push({ t, k: 0, v: .35 + Math.random() * .3, dim: true }); }
    ctx.lineWidth = 2.2;
    for(let i = pulses.length - 1; i >= 0; i--){
      const p = pulses[i]; p.k += p.v * dt;
      if(p.k >= 1){ pulses.splice(i, 1); if(!p.dim && bolts.length < 6) bolts.push(makeBolt(c)); continue; }
      const a = along(p.t, p.k), b = along(p.t, Math.max(0, p.k - .1));
      ctx.save(); ctx.shadowColor = '#ff9a2e'; ctx.shadowBlur = 10; ctx.strokeStyle = p.dim ? 'rgba(255,150,60,.5)' : 'rgba(255,190,90,.95)';
      ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(a[0], a[1]); ctx.stroke(); ctx.restore();
      glow(a[0], a[1], p.dim ? 5 : 8, '255,150,40', p.dim ? .55 : .95);
    }
    // chips
    for(const ch of chips){ ch.lit = Math.max(0, ch.lit - dt * 1.4); chipBox(ch); }
    // altura do último bloco ao centro, em baixo
    const rh = realHeight();
    if(rh){ ctx.font = '600 10px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,190,110,.8)'; ctx.fillText('BLOCK #' + rh, W / 2, H - (W < 640 ? 14 : 18)); }
    // aura e raios elétricos à volta da moeda
    glow(c.x, c.y, c.r * 2.6, '255,120,20', .32 + .08 * Math.sin(s * 3));
    boltT -= dt; if(!still && boltT <= 0){ bolts.push(makeBolt(c)); boltT = .05 + Math.random() * .12; }
    if(still && !bolts.length) for(let i = 0; i < 3; i++) bolts.push(makeBolt(c));
    for(let i = bolts.length - 1; i >= 0; i--){
      const b = bolts[i]; b.life += dt; if(b.life > b.max){ bolts.splice(i, 1); continue; }
      const a = 1 - b.life / b.max;
      ctx.save(); ctx.translate(c.x, c.y); ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 12;
      ctx.strokeStyle = `rgba(255,${200 + Math.random() * 55},${140 + Math.random() * 100},${.9 * a})`; ctx.lineWidth = 1.4;
      ctx.beginPath(); b.pts.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.restore();
    }
    // faíscas a subir
    if(!still && embers.length < 70) for(let i = 0; i < 2; i++) embers.push({ x: Math.random() * W, y: H + 4, vx: (Math.random() - .5) * 14, vy: -(18 + Math.random() * 40), l: 0, m: 1.5 + Math.random() * 2.5, r: .6 + Math.random() * 1.3 });
    for(let i = embers.length - 1; i >= 0; i--){
      const e = embers[i]; e.l += dt; e.x += (e.vx + Math.sin(s * 3 + i) * 6) * dt; e.y += e.vy * dt;
      if(e.l > e.m){ embers.splice(i, 1); continue; }
      const a = Math.sin(e.l / e.m * Math.PI) * (.6 + .4 * Math.sin(s * 20 + i));
      ctx.fillStyle = `rgba(255,${150 + (i % 4) * 25},50,${a})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); ctx.fill();
    }
    // letras: balanço lento + seguir o rato
    tx += (mx - tx) * .08; ty += (my - ty) * .08;
    const rx = (still ? 0 : Math.sin(s * .5) * 4) + ty * -7, ry = (still ? 0 : Math.sin(s * .37) * 7) + tx * 10;
    text.style.transform = `translate(-50%,-50%) perspective(800px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
  }

  wrap.addEventListener('mousemove', e => { const r = wrap.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - .5; my = (e.clientY - r.top) / r.height - .5; });
  wrap.addEventListener('mouseleave', () => { mx = 0; my = 0; });
  try { new ResizeObserver(resize).observe(wrap); } catch(e) { window.addEventListener('resize', resize); }
  resize();
  try { document.fonts.ready.then(resize); } catch(e) {}   // a letra Orbitron muda o sítio da moeda quando acaba de carregar
  if(reduce){ frame(performance.now(), true); return; }
  let acc = 0, inView = true;
  try { new IntersectionObserver(es => { inView = es[0].isIntersecting; }).observe(wrap); } catch(e) {}
  const paused = () => (typeof hcPaused === 'function' ? hcPaused() : document.hidden);
  function loop(ts){
    ts = ts || performance.now();
    if(inView && !paused() && ts - acc >= 33){ acc = ts; frame(ts, false); }   // ~30 imagens por segundo
    else if(!inView || paused()) lastT = ts;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  window.hcBannerCyber = { resize };
})();
