// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Painel "Comunidade Hash Commander" em estilo cyberpunk / cinemático ----------
// Troca o desenho do mapa (cartoes-mapa-terra.js / cartoes-mapa.js) por um mapa néon: oceano escuro com grelha azul,
// continentes azuis com textura de pontos e costa a brilhar, luzes das cidades em laranja, e arcos laranja com pontos de
// luz a correr de cada mineiro para cidades do mundo (sem mineiros com local, liga cidades entre si). Também põe os cantos
// acesos na moldura e um mini-gráfico do hashrate da comunidade no Top mineiros (comunidade-cyber.css trata do resto).
(function(){
  if(typeof mcMapBase !== 'function' || typeof mcMapDraw !== 'function') return;
  const cache = { cv: null, key: '' };

  // ---- camada de base do mapa (desenha-se uma vez por tamanho e por minuto, como a original) ----
  window.mcMapBase = function(W, H, dpr, sunLon, dec){
    const key = [W, H, dpr, Math.round(sunLon * 4)].join('|');
    if(cache.key === key && cache.cv) return cache.cv;
    const cv = cache.cv || document.createElement('canvas');
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const X = lon => (lon + 180) / 360 * W, Y = lat => (80 - lat) / 138 * H, toR = Math.PI / 180;
    // oceano escuro com um brilho azul ao centro
    c.fillStyle = '#020a12'; c.fillRect(0, 0, W, H);
    const gl = c.createRadialGradient(W * .5, H * .5, 0, W * .5, H * .5, W * .62); gl.addColorStop(0, 'rgba(30,140,190,.2)'); gl.addColorStop(1, 'rgba(30,140,190,0)');
    c.fillStyle = gl; c.fillRect(0, 0, W, H);
    // grelha em aramado
    const step = Math.max(14, Math.round(W / 60));
    c.strokeStyle = 'rgba(60,200,240,.09)'; c.lineWidth = 1; c.beginPath();
    for(let x = 0; x <= W; x += step){ c.moveTo(x + .5, 0); c.lineTo(x + .5, H); }
    for(let y = 0; y <= H; y += step){ c.moveTo(0, y + .5); c.lineTo(W, y + .5); }
    c.stroke();
    c.strokeStyle = 'rgba(60,200,240,.2)'; c.beginPath();
    for(let lo = -180; lo <= 180; lo += 30){ c.moveTo(X(lo), 0); c.lineTo(X(lo), H); }
    for(let la = -60; la <= 80; la += 20){ c.moveTo(0, Y(la)); c.lineTo(W, Y(la)); }
    c.stroke();
    // continentes
    const land = new Path2D();
    for(const r of MC_LAND_RINGS){
      let lo = r[0] / 10, la = r[1] / 10; land.moveTo(X(lo), Y(la));
      for(let i = 2; i < r.length; i += 2){ lo += r[i] / 10; la += r[i + 1] / 10; land.lineTo(X(lo), Y(la)); }
      land.closePath();
    }
    const lg = c.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, 'rgba(40,150,175,.62)'); lg.addColorStop(.55, 'rgba(30,125,150,.55)'); lg.addColorStop(1, 'rgba(25,100,125,.5)');
    c.fillStyle = lg; c.fill(land);
    // lado da noite um pouco mais escuro (terminador pela posição real do sol)
    const night = new Path2D(), south = dec < 0, d0 = dec || 1e-6;
    for(let i = 0; i <= 180; i++){ const lon = -180 + i * 2, hh = (lon - sunLon) * toR, la = Math.atan(-Math.cos(hh) / Math.tan(d0)) / toR; i ? night.lineTo(X(lon), Y(la)) : night.moveTo(X(lon), Y(la)); }
    night.lineTo(X(180), south ? -2 : H + 2); night.lineTo(X(-180), south ? -2 : H + 2); night.closePath();
    c.save(); c.clip(night); c.fillStyle = 'rgba(2,12,22,.35)'; c.fill(land); c.restore();
    // textura de pontos claros dentro da terra
    c.save(); c.clip(land);
    const st = Math.max(3, Math.round(W / 260));
    c.fillStyle = 'rgba(150,240,255,.22)';
    for(let y = 0; y < H; y += st) for(let x = (y / st & 1) * st / 2; x < W; x += st){ c.beginPath(); c.arc(x, y, st * .18, 0, 7); c.fill(); }
    c.restore();
    // costa a brilhar
    c.save(); c.lineJoin = 'round'; c.shadowColor = 'rgba(79,224,255,.9)'; c.shadowBlur = 9; c.strokeStyle = 'rgba(170,240,255,.85)'; c.lineWidth = 1; c.stroke(land); c.restore();
    // luzes das cidades em laranja (mais fortes onde é de noite)
    c.save(); c.globalCompositeOperation = 'lighter';
    for(const [lo, la] of MC_CITIES){
      const lat = la * toR, hh = (lo - sunLon) * toR, cz = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hh);
      const a = cz > .05 ? .55 : 1, g = c.createRadialGradient(X(lo), Y(la), 0, X(lo), Y(la), 9);
      g.addColorStop(0, `rgba(255,236,190,${.95 * a})`); g.addColorStop(.25, `rgba(255,170,60,${.8 * a})`); g.addColorStop(1, 'rgba(255,140,30,0)');
      c.fillStyle = g; c.beginPath(); c.arc(X(lo), Y(la), 9, 0, 7); c.fill();
    }
    c.restore();
    cache.cv = cv; cache.key = key;
    return cv;
  };

  // ---- arcos laranja com pontos de luz, desenhados por cima de cada imagem do mapa ----
  const FALLBACK = [[-9.1, 38.7, -74, 40.7], [-0.1, 51.5, -79.4, 43.7], [2.3, 48.9, -46.6, -23.5], [13.4, 52.5, 37.6, 55.8], [-9.1, 38.7, 139.7, 35.7], [-74, 40.7, -118.2, 34]];
  function arcList(W, H){
    const pts = (mcMap.pts || []), out = [];
    if(pts.length){
      pts.forEach(p => {
        const h = mcHash(p.uid);
        for(let k = 0; k < 4; k++){ const ci = MC_CITIES[(h + k * 7) % MC_CITIES.length]; const [x, y] = mcMapXY(ci[1], ci[0], W, H); if(Math.hypot(x - p.x, y - p.y) > 30) out.push([p.x, p.y, x, y, (h % 97) / 97 + k * .23]); }
      });
      for(let i = 1; i < pts.length; i++) out.push([pts[0].x, pts[0].y, pts[i].x, pts[i].y, i * .31]);
    } else {
      FALLBACK.forEach((f, i) => { const a = mcMapXY(f[1], f[0], W, H), b = mcMapXY(f[3], f[2], W, H); out.push([a[0], a[1], b[0], b[1], i * .19]); });
    }
    return out;
  }
  const origDraw = mcMapDraw;
  window.mcMapDraw = function(dt){
    origDraw(dt);
    const cv = mcMap.cv, ctx = mcMap.ctx; if(!cv || !ctx) return;
    const W = cv.clientWidth, H = cv.clientHeight, t = mcMap.t || 0;
    if(!W || !H) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for(const [x0, y0, x1, y1, ph] of arcList(W, H)){
      const d = Math.hypot(x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = Math.min(y0, y1) - d * .32;
      const q = s => { const u = 1 - s; return [u * u * x0 + 2 * u * s * mx + s * s * x1, u * u * y0 + 2 * u * s * my + s * s * y1]; };
      ctx.strokeStyle = 'rgba(255,150,50,.38)'; ctx.lineWidth = 1.3; ctx.shadowColor = '#ff9a2e'; ctx.shadowBlur = 8;
      ctx.beginPath(); for(let s = 0; s <= 1.0001; s += .04){ const p = q(s); s ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.stroke();
      // ponto de luz a correr, com rasto
      const k = ((t * .28 + ph) % 1);
      ctx.strokeStyle = 'rgba(255,215,140,.95)'; ctx.lineWidth = 2;
      ctx.beginPath(); for(let s = Math.max(0, k - .14); s <= k; s += .02){ const p = q(s); s === Math.max(0, k - .14) ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); } ctx.stroke();
      ctx.shadowBlur = 0;
      const p = q(k), g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 7);
      g.addColorStop(0, 'rgba(255,245,215,1)'); g.addColorStop(.3, 'rgba(255,170,60,.85)'); g.addColorStop(1, 'rgba(255,140,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, 7); ctx.fill();
    }
    // varrimento de radar a passar pelo mapa
    const sx = ((t * 60) % (W + 200)) - 100, sg = ctx.createLinearGradient(sx - 80, 0, sx, 0);
    sg.addColorStop(0, 'rgba(60,210,255,0)'); sg.addColorStop(1, 'rgba(60,210,255,.08)');
    ctx.fillStyle = sg; ctx.fillRect(sx - 80, 0, 80, H);
    ctx.restore();
  };

  // ---- cantos acesos e mini-gráfico no Top mineiros ----
  const HKEY = 'hc_cmc_hist';
  let hist = [];
  try { hist = JSON.parse(localStorage.getItem(HKEY) || '[]').filter(p => Array.isArray(p) && Date.now() - p[0] < 6 * 3600e3); } catch(e) { hist = []; }
  function total(){
    let s = 0;
    try { Object.values(mcCom.list || {}).forEach(e => { if(mcComFresh(e)) s += Number(e.ghs) || 0; }); } catch(e) {}
    if(!s && typeof mcComShare === 'function' && mcComShare() && typeof mcComMine === 'function') s = mcComMine().ghs;
    return s;
  }
  function sample(){
    const v = total(); if(!(v > 0)) return;
    const last = hist[hist.length - 1];
    if(last && Date.now() - last[0] < 30000) return;
    hist.push([Date.now(), v]); if(hist.length > 120) hist = hist.slice(-120);
    try { localStorage.setItem(HKEY, JSON.stringify(hist)); } catch(e) {}
  }
  function spark(cv){
    const w = cv.clientWidth, h = cv.clientHeight; if(!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if(cv.width !== Math.round(w * dpr)){ cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    x.strokeStyle = 'rgba(60,200,240,.12)'; x.lineWidth = 1;
    for(let i = 1; i < 4; i++){ const y = Math.round(h * i / 4) + .5; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
    const data = hist.length > 1 ? hist.map(p => p[1]) : [total(), total()];
    const mn = Math.min(...data), mx = Math.max(...data), span = (mx - mn) || mx || 1;
    const pts = data.map((v, i) => [i / (data.length - 1) * (w - 4) + 2, h - 6 - ((v - mn) / span) * (h - 14) - (mx === mn ? (h - 14) / 2 : 0)]);
    const fill = x.createLinearGradient(0, 0, 0, h); fill.addColorStop(0, 'rgba(255,77,138,.32)'); fill.addColorStop(1, 'rgba(255,77,138,0)');
    x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.lineTo(pts[pts.length - 1][0], h); x.lineTo(pts[0][0], h); x.closePath(); x.fillStyle = fill; x.fill();
    const ln = x.createLinearGradient(0, 0, w, 0); ln.addColorStop(0, '#3fd8ff'); ln.addColorStop(1, '#ff4d8a');
    x.strokeStyle = ln; x.lineWidth = 2; x.shadowColor = '#ff4d8a'; x.shadowBlur = 8; x.lineJoin = 'round';
    x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); x.shadowBlur = 0;
    const lp = pts[pts.length - 1]; x.fillStyle = '#ffd0e0'; x.beginPath(); x.arc(lp[0], lp[1], 2.6, 0, 7); x.fill();
    cv.title = hist.length > 1 ? (() => { const f = formatHashrate(data[data.length - 1]); return f.value + ' ' + f.unit; })() : '';
  }
  function decorate(){
    const el = document.getElementById('mcCom'); if(!el) return;
    // o mapa está inclinado e ampliado (CSS): converte a posição do rato para as coordenadas do canvas, para o cartão do mineiro aparecer no ponto certo
    const mcv = document.getElementById('mcCmMap');
    if(mcv && !mcv.dataset.cmcMouse){
      mcv.dataset.cmcMouse = '1';
      mcv.addEventListener('pointermove', e => { const b = mcv.getBoundingClientRect(); if(b.width && b.height) mcMap.mouse = { x: (e.clientX - b.left) * mcv.clientWidth / b.width, y: (e.clientY - b.top) * mcv.clientHeight / b.height }; });
    }
    if(!el.querySelector('.cmc-corner')) ['tl', 'tr', 'bl', 'br'].forEach(k => { const i = document.createElement('i'); i.className = 'cmc-corner ' + k; i.setAttribute('aria-hidden', 'true'); el.appendChild(i); });
    const col = el.querySelector('.mc-cm-col'); if(!col) return;
    let cv = col.querySelector('.cmc-spark');
    if(!cv){ cv = document.createElement('canvas'); cv.className = 'cmc-spark'; const h4 = col.querySelector('h4'); h4 ? h4.after(cv) : col.prepend(cv); }
    sample(); spark(cv);
  }
  if(typeof mcComRender === 'function'){
    const orig = mcComRender;
    window.mcComRender = function(){ const r = orig.apply(this, arguments); try { decorate(); } catch(e) {} return r; };
  }
  setInterval(() => { if(!document.hidden) try { decorate(); } catch(e) {} }, 30000);
  setTimeout(decorate, 1500);
})();
