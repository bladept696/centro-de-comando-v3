// ---------- Fundo do Mapa da Rede: "colmeia de dados" ----------
// Uma grelha hexagonal onde um radar roda a partir do centro (o hub da rede): cada hexágono acende quando o feixe passa
// e pacotes de dados correm pelas arestas da grelha. Tudo em canvas 2D, a ~30 imagens/s, e só enquanto está visível.
// Desliga-se com o Modo Desempenho; com "reduzir movimento" fica uma imagem parada.
(function(){
  const cv = document.getElementById('nmBgCanvas');
  if(!cv || !cv.getContext) return;
  const ctx = cv.getContext('2d');
  const host = cv.parentElement;
  const R = 22, SQ3 = Math.sqrt(3);
  const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e) { return false; } })();
  let W = 0, H = 0, DPR = 1, grid = null, hexes = [], verts = new Map(), keys = [], lit = [], packets = [];
  let sweep = Math.random() * Math.PI * 2, last = 0, visible = true, t = 0;

  const rgba = (c, a) => 'rgba(' + c + ',' + a.toFixed(3) + ')';
  const CY = '79,214,255', GR = '33,255,176', AM = '255,176,32';

  function build(){
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = host.clientWidth; H = host.clientHeight;
    if(W < 40 || H < 40) return false;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    hexes = []; verts = new Map(); keys = [];
    const w = SQ3 * R, cols = Math.ceil(W / w) + 2, rows = Math.ceil(H / (1.5 * R)) + 2;
    const vk = (x, y) => Math.round(x * 2) + ':' + Math.round(y * 2);
    for(let r = -1; r < rows; r++) for(let c = -1; c < cols; c++){
      const cx = c * w + (r & 1 ? w / 2 : 0), cy = r * 1.5 * R;
      hexes.push({ cx, cy, ang: Math.atan2(cy - H / 2, cx - W / 2), d: Math.hypot(cx - W / 2, cy - H / 2) });
      const pts = [];
      for(let k = 0; k < 6; k++){ const a = Math.PI / 6 + k * Math.PI / 3; pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
      for(let k = 0; k < 6; k++){
        const p = pts[k], q = pts[(k + 1) % 6], kp = vk(p[0], p[1]), kq = vk(q[0], q[1]);
        if(!verts.has(kp)) verts.set(kp, { x: p[0], y: p[1], n: new Set() });
        if(!verts.has(kq)) verts.set(kq, { x: q[0], y: q[1], n: new Set() });
        verts.get(kp).n.add(kq); verts.get(kq).n.add(kp);
      }
    }
    keys = [...verts.keys()].filter(k => { const v = verts.get(k); return v.x > 0 && v.x < W && v.y > 0 && v.y < H; });
    // grelha estática numa imagem à parte (só se redesenha quando o tamanho muda)
    grid = document.createElement('canvas'); grid.width = cv.width; grid.height = cv.height;
    const g = grid.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.strokeStyle = rgba(CY, 0.085); g.lineWidth = 1; g.beginPath();
    verts.forEach((v, k) => v.n.forEach(nk => { if(k < nk){ const u = verts.get(nk); g.moveTo(v.x, v.y); g.lineTo(u.x, u.y); } }));
    g.stroke();
    g.fillStyle = rgba(CY, 0.16);
    keys.forEach((k, i) => { if(i % 5 === 0){ const v = verts.get(k); g.fillRect(v.x - 1, v.y - 1, 2, 2); } });
    packets = []; lit = [];
    for(let i = 0; i < Math.max(6, Math.min(18, Math.round(W * H / 24000))); i++) packets.push(newPacket());
    return true;
  }

  function newPacket(){
    const k = keys[(Math.random() * keys.length) | 0];
    return { k, prev: null, next: null, p: 1, trail: [], col: Math.random() < 0.2 ? GR : Math.random() < 0.1 ? AM : CY, spd: 0.07 + Math.random() * 0.07 };
  }
  function stepPacket(p){
    p.p += p.spd;
    if(p.p >= 1){
      const cur = p.next || p.k, v = verts.get(cur); if(!v){ Object.assign(p, newPacket()); return; }
      p.k = cur; const opts = [...v.n].filter(n => n !== p.prev && verts.get(n).x > -R && verts.get(n).x < W + R && verts.get(n).y > -R && verts.get(n).y < H + R);
      if(!opts.length){ Object.assign(p, newPacket()); return; }
      p.prev = cur; p.next = opts[(Math.random() * opts.length) | 0]; p.p = 0;
    }
  }
  const posOf = p => { const a = verts.get(p.k), b = verts.get(p.next || p.k); if(!a || !b) return null; return [a.x + (b.x - a.x) * p.p, a.y + (b.y - a.y) * p.p]; };

  function hexPath(cx, cy, r){ ctx.beginPath(); for(let k = 0; k < 6; k++){ const a = Math.PI / 6 + k * Math.PI / 3; k ? ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)) : ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); } ctx.closePath(); }

  function frame(animate){
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(grid, 0, 0, W, H);
    const cx = W / 2, cy = H / 2, maxD = Math.hypot(W, H) / 2;
    const TAU = Math.PI * 2, step = 0.022;

    if(animate){
      // o feixe do radar acende os hexágonos por onde passa
      const a0 = sweep, a1 = sweep + step;
      hexes.forEach(h => {
        if(h.d < 24 || h.d > maxD) return;
        let d = (a1 - h.ang) % TAU; if(d < 0) d += TAU;
        if(d < step + 0.002 && Math.random() < 0.55) lit.push({ cx: h.cx, cy: h.cy, age: 0, life: 70 + Math.random() * 50, col: Math.random() < 0.15 ? GR : CY });
      });
      if(Math.random() < 0.07){ const h = hexes[(Math.random() * hexes.length) | 0]; lit.push({ cx: h.cx, cy: h.cy, age: 0, life: 40 + Math.random() * 30, col: AM }); }
      sweep = a1 % TAU;
      if(lit.length > 160) lit.splice(0, lit.length - 160);
    }
    // hexágonos acesos
    for(let i = lit.length - 1; i >= 0; i--){
      const l = lit[i]; if(animate) l.age++;
      const f = 1 - l.age / l.life; if(f <= 0){ lit.splice(i, 1); continue; }
      hexPath(l.cx, l.cy, R - 1.5);
      ctx.fillStyle = rgba(l.col, 0.16 * f); ctx.fill();
      ctx.strokeStyle = rgba(l.col, 0.7 * f); ctx.lineWidth = 1; ctx.stroke();
    }
    // feixe (cone com cauda) + linha do radar
    if(ctx.createConicGradient){
      const g = ctx.createConicGradient(sweep - 1.15, cx, cy);
      g.addColorStop(0, rgba(CY, 0)); g.addColorStop(0.17, rgba(CY, 0.20)); g.addColorStop(0.18, rgba(CY, 0)); g.addColorStop(1, rgba(CY, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, maxD, sweep - 1.15, sweep + 0.02); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = rgba(CY, 0.55); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sweep) * maxD, cy + Math.sin(sweep) * maxD); ctx.stroke();
    // anéis de alcance
    ctx.strokeStyle = rgba(CY, 0.10); ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach(f => { ctx.beginPath(); ctx.arc(cx, cy, maxD * f * 0.7, 0, TAU); ctx.stroke(); });
    // pacotes de dados nas arestas
    packets.forEach(p => {
      if(animate) stepPacket(p);
      const pos = posOf(p); if(!pos) return;
      if(animate){ p.trail.push(pos); if(p.trail.length > 7) p.trail.shift(); }
      p.trail.forEach((q, i) => { ctx.fillStyle = rgba(p.col, 0.35 * (i + 1) / p.trail.length); ctx.fillRect(q[0] - 1, q[1] - 1, 2, 2); });
      ctx.fillStyle = rgba(p.col, 0.95); ctx.shadowColor = 'rgb(' + p.col + ')'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(pos[0], pos[1], 2, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    });
    // pulso no centro (o hub)
    const pr = 5 + 3 * Math.sin(t * 0.08);
    ctx.fillStyle = rgba(CY, 0.12); ctx.beginPath(); ctx.arc(cx, cy, pr * 3, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba(CY, 0.8); ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TAU); ctx.fill();
  }

  function paused(){
    if(document.hidden || !visible) return true;
    if(document.body.classList.contains('perf-mode')) return true;
    try { if(typeof hcPaused === 'function' && hcPaused()) return true; } catch(e) {}
    return false;
  }
  function loop(ts){
    requestAnimationFrame(loop);
    ts = ts || performance.now();
    if(paused() || ts - last < 33) return;
    last = ts; t++;
    if(!grid || W !== host.clientWidth || H !== host.clientHeight){ if(!build()) return; }
    frame(true);
  }

  try { new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host); } catch(e) {}
  if(window.ResizeObserver) new ResizeObserver(() => { if(host.clientWidth !== W || host.clientHeight !== H) grid = null; }).observe(host);
  if(reduce){ if(build()) frame(false); window.addEventListener('resize', () => { if(build()) frame(false); }); return; }
  requestAnimationFrame(loop);
})();
