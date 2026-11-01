// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Cenários dos blocos da mempool (estilos Sci-Fi e Cósmico) ----------
// Duas camadas em canvas dentro do painel dos blocos, por trás dos cubos (mempool-cenas.css):
//  · Sci-Fi: grelha hexagonal com varrimento, nuvem de partículas a rodar à volta do bloco a decorrer, faíscas na linha AGORA,
//    e dois gráficos por baixo (taxa dos próximos blocos e transações dos últimos blocos);
//  · Cósmico: estrelas, nebulosas e filamentos de luz entre os cubos, com clarões nos cantos.
// As posições dos cubos são lidas do DOM em cada frame, por isso acompanha o scroll e os blocos novos.
Object.assign(I18N_DICT, {
  sf_taxas: { pt: `Taxa dos próximos blocos (sat/vB)`, en: `Next blocks fee rate (sat/vB)`, es: `Tasa de los próximos bloques (sat/vB)`, fr: `Frais des prochains blocs (sat/vB)` },
  sf_txs: { pt: `Transações por bloco`, en: `Transactions per block`, es: `Transacciones por bloque`, fr: `Transactions par bloc` },
});

(function(){
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tr = k => (typeof t === 'function' ? t(k) : k);
  let box = null, bg = null, fx = null, bgx = null, fxx = null, charts = null, W = 0, H = 0, dpr = 1, raf = 0, last = 0, lastCharts = 0;
  let stars = [], dust = [], nebula = [], sparks = [], shoot = null;

  const modeNow = () => { const c = document.body.classList; return c.contains('mp-scifi') ? 'scifi' : c.contains('mp-cosmo') ? 'cosmo' : ''; };

  function setup(){
    box = document.querySelector('.blocks-container'); if(!box) return false;
    if(!bg){
      bg = document.createElement('canvas'); bg.className = 'mpc-bg';
      fx = document.createElement('canvas'); fx.className = 'mpc-fx';
      box.prepend(bg); box.appendChild(fx);
      bgx = bg.getContext('2d'); fxx = fx.getContext('2d');
      charts = document.createElement('div'); charts.className = 'sf-charts';
      charts.innerHTML = '<div class="sf-chart"><b data-k="sf_taxas"></b><canvas></canvas></div><div class="sf-chart"><b data-k="sf_txs"></b><canvas></canvas></div>';
      const sc = document.getElementById('blocksScroll');
      if(sc) sc.after(charts); else box.appendChild(charts);
      charts.querySelectorAll('canvas').forEach(c => c.addEventListener('mousemove', chartHover));
      new ResizeObserver(resize).observe(box);
      resize();
    }
    return true;
  }

  function resize(){
    if(!box) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = box.clientWidth; H = box.clientHeight;
    for(const c of [bg, fx]){ c.width = Math.max(1, W * dpr); c.height = Math.max(1, H * dpr); c.style.width = W + 'px'; c.style.height = H + 'px'; }
    const n = Math.round(W * H / 2600) + 60;
    stars = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() < .08 ? Math.random() * 1.4 + 1.1 : Math.random() * .9 + .25, p: Math.random() * 6.3, d: Math.random() * .6 + .2 }));
    dust = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: Math.random() * 12 + 4, r: Math.random() * 1.3 + .4, p: Math.random() * 6.3 }));
    nebula = [[.18, .5, '#2a5cc0'], [.82, .35, '#5a3ac0'], [.55, .85, '#1f7ab8']].map(([x, y, c]) => ({ x: x * W, y: y * H, r: Math.max(W, H) * .35, c, p: Math.random() * 6.3 }));
    lastCharts = 0;
  }

  // retângulo de um elemento relativo ao painel
  function rect(el, br){ const r = el.getBoundingClientRect(); return { x: r.left - br.left + r.width / 2, y: r.top - br.top + r.height / 2, w: r.width, h: r.height, l: r.left - br.left, r: r.right - br.left, t: r.top - br.top, b: r.bottom - br.top }; }
  function cubes(){
    const sc = document.getElementById('blocksScroll'), br = box.getBoundingClientRect();
    const vis = c => c.r > -60 && c.l < W + 60;
    const all = sc ? [...sc.querySelectorAll('.mp-block')].map(b => ({ el: b, c: rect(b.querySelector('.mp-cube'), br), next: b.classList.contains('mp-next'), tip: b.classList.contains('mp-tip'), conf: b.classList.contains('mp-confirmed') })) : [];
    const sep = sc && sc.querySelector('.mp-sep-line');
    return { all: all.filter(o => vis(o.c)), sep: sep ? rect(sep, br) : null, clip: sc ? rect(sc, br) : null };
  }
  function glow(ctx, x, y, r, rgb, a){
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(.25, `rgba(${rgb},${a * .85})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }

  /* ---------- 01 · Sci-Fi ---------- */
  function sfBg(s){
    // grelha hexagonal ténue
    const R = 22, hh = R * Math.sqrt(3);
    bgx.strokeStyle = 'rgba(60,220,255,.05)'; bgx.lineWidth = 1;
    for(let y = 0, row = 0; y < H + hh; y += hh / 2, row++){
      for(let x = (row % 2) * R * 1.5; x < W + R * 3; x += R * 3){
        bgx.beginPath(); for(let a = 0; a < 6; a++){ const an = Math.PI / 3 * a; const px = x + R * Math.cos(an), py = y + R * Math.sin(an); a ? bgx.lineTo(px, py) : bgx.moveTo(px, py); } bgx.closePath(); bgx.stroke();
      }
    }
    // varrimento horizontal
    if(!reduce){ const sy = (s * 60) % (H + 120) - 60; const g = bgx.createLinearGradient(0, sy - 50, 0, sy + 50);
      g.addColorStop(0, 'rgba(60,230,255,0)'); g.addColorStop(.5, 'rgba(60,230,255,.07)'); g.addColorStop(1, 'rgba(60,230,255,0)'); bgx.fillStyle = g; bgx.fillRect(0, sy - 50, W, 100); }
    // partículas a subir
    for(const d of dust){
      const y = ((d.y - (reduce ? 0 : s * d.v)) % H + H) % H, a = .25 + .35 * Math.sin(s * 2 + d.p);
      bgx.fillStyle = `rgba(110,240,255,${a})`; bgx.beginPath(); bgx.arc(d.x, y, d.r, 0, 7); bgx.fill();
    }
  }
  function sfFx(s, cs){
    const nx = cs.all.find(o => o.next);
    if(nx){   // nuvem de partículas em esfera a rodar à volta do bloco a decorrer
      const c = nx.c, R = Math.max(c.w, c.h) * .78, rot = reduce ? 0 : s * .5;
      for(let i = 0; i < 180; i++){
        const th = Math.acos(1 - 2 * ((i + .5) / 180)), ph = i * 2.39996 + rot;
        const x3 = Math.sin(th) * Math.cos(ph), z3 = Math.sin(th) * Math.sin(ph), y3 = Math.cos(th);
        const depth = (z3 + 1) / 2, px = c.x + x3 * R, py = c.y + y3 * R * .82;
        fxx.fillStyle = `rgba(${depth > .5 ? '140,250,255' : '60,170,220'},${.15 + depth * .75})`;
        fxx.beginPath(); fxx.arc(px, py, .6 + depth * 1.6, 0, 7); fxx.fill();
      }
      glow(fxx, c.x, c.y, c.w * .9, '60,230,255', .22);
    }
    if(cs.sep){   // faíscas a subir na linha AGORA
      if(!reduce && sparks.length < 40 && Math.random() < .6) sparks.push({ x: cs.sep.x + (Math.random() - .5) * 6, y: cs.sep.b, v: Math.random() * 50 + 30, l: 0, m: Math.random() * 2 + 1.2 });
      for(const p of sparks){ p.l += .033; p.y -= p.v * .033; p.x += Math.sin(p.l * 6) * .3; }
      sparks = sparks.filter(p => p.l < p.m && p.y > cs.sep.t);
      for(const p of sparks) glow(fxx, p.x, p.y, 4, '255,180,70', Math.sin(p.l / p.m * Math.PI) * .9);
      glow(fxx, cs.sep.x, cs.sep.t + 4, 14, '255,180,70', .7); glow(fxx, cs.sep.x, cs.sep.b - 4, 14, '255,180,70', .7);
    }
  }
  // gráficos de barras por baixo (desenhados uma vez por segundo)
  let chartData = [[], []];
  function sfCharts(){
    const cvs = charts.querySelectorAll('canvas'), lbl = charts.querySelectorAll('b');
    lbl.forEach(b => { const v = tr(b.dataset.k); if(b.textContent !== v) b.textContent = v; });
    const pend = (typeof mempoolBlocksData !== 'undefined' && Array.isArray(mempoolBlocksData)) ? mempoolBlocksData.slice(0, 8) : [];
    const conf = (typeof lastFetchedBlocks !== 'undefined' && Array.isArray(lastFetchedBlocks)) ? lastFetchedBlocks.slice(0, 15) : [];
    chartData = [
      pend.map((m, i) => ({ v: Number(m.medianFee) || 0, tip: `+${(i + 1) * 10} min · ~${(Number(m.medianFee) || 0).toFixed(1)} sat/vB · ${m.nTx} txs`, lab: `+${(i + 1) * 10}` })),
      conf.map(b => ({ v: Number(b.tx_count) || 0, tip: `#${b.height} · ${b.tx_count} txs`, lab: String(b.height).slice(-3) })),
    ];
    bars(cvs[0], chartData[0], ['#0f8f9a', '#5dffe0'], v => v < 10 ? v.toFixed(1) : Math.round(v));
    bars(cvs[1], chartData[1], ['#b8601a', '#ffc14d'], v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v);
  }
  function bars(cv, data, [c0, c1], fmt){
    const w = cv.clientWidth, h = cv.clientHeight; if(!w || !h) return;
    if(cv.width !== Math.round(w * dpr)){ cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    const base = h - 14, top = 12;
    x.strokeStyle = 'rgba(80,220,240,.1)'; x.lineWidth = 1;
    for(let i = 0; i <= 3; i++){ const y = top + (base - top) * i / 3; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
    if(!data.length) return;
    const max = Math.max(...data.map(d => d.v)) || 1, n = data.length, gap = 2, bw = Math.max(3, (w - gap * (n - 1)) / n);
    const imax = data.findIndex(d => d.v === max);
    data.forEach((d, i) => {
      const bh = Math.max(2, (base - top) * d.v / max), bx = i * (bw + gap), by = base - bh;
      const g = x.createLinearGradient(0, base, 0, top); g.addColorStop(0, c0); g.addColorStop(1, c1);
      x.fillStyle = g; x.shadowColor = c1; x.shadowBlur = 6;
      x.beginPath(); if(x.roundRect) x.roundRect(bx, by, bw, bh, [3, 3, 0, 0]); else x.rect(bx, by, bw, bh); x.fill(); x.shadowBlur = 0;
      x.fillStyle = 'rgba(160,210,220,.7)'; x.font = '600 8.5px "JetBrains Mono",monospace'; x.textAlign = 'center';
      if(n <= 10 || i % 3 === 0) x.fillText(d.lab, bx + bw / 2, h - 3);
      if(i === imax || i === 0){ x.fillStyle = '#e8fdff'; x.font = '700 9px "JetBrains Mono",monospace'; x.fillText(fmt(d.v), bx + bw / 2, by - 3); }
    });
    cv._bars = { n, bw, gap };
  }
  function chartHover(e){
    const cv = e.currentTarget, idx = [...charts.querySelectorAll('canvas')].indexOf(cv), m = cv._bars; if(!m) return;
    const i = Math.floor(e.offsetX / (m.bw + m.gap)), d = chartData[idx][i];
    cv.title = d ? d.tip : '';
  }

  /* ---------- 02 · Cósmico ---------- */
  function csBg(s){
    for(const nb of nebula){
      const x = nb.x + Math.sin(s * .05 + nb.p) * 30, y = nb.y + Math.cos(s * .04 + nb.p) * 20, g = bgx.createRadialGradient(x, y, 0, x, y, nb.r);
      g.addColorStop(0, nb.c + '48'); g.addColorStop(1, nb.c + '00'); bgx.fillStyle = g; bgx.fillRect(0, 0, W, H);
    }
    for(const st of stars){
      const tw = reduce ? .8 : .5 + .5 * Math.sin(s * (1 + st.d * 2) + st.p), x = ((st.x - (reduce ? 0 : s * st.d * 4)) % W + W) % W;
      bgx.fillStyle = `rgba(${st.r > 1 ? '220,235,255' : '170,200,255'},${.3 + tw * .7})`; bgx.beginPath(); bgx.arc(x, st.y, st.r, 0, 7); bgx.fill();
      if(st.r > 1.6) glow(bgx, x, st.y, st.r * 5, '160,200,255', .25 * tw);
    }
    // estrela cadente de vez em quando
    if(!reduce){
      if(!shoot && Math.random() < .004) shoot = { x: Math.random() * W * .8 + W * .2, y: Math.random() * H * .3, l: 0 };
      if(shoot){ shoot.l += .033; const x = shoot.x - shoot.l * 420, y = shoot.y + shoot.l * 160, g = bgx.createLinearGradient(x, y, x + 90, y - 34);
        g.addColorStop(0, 'rgba(230,240,255,.9)'); g.addColorStop(1, 'rgba(230,240,255,0)'); bgx.strokeStyle = g; bgx.lineWidth = 1.4;
        bgx.beginPath(); bgx.moveTo(x, y); bgx.lineTo(x + 90, y - 34); bgx.stroke(); if(shoot.l > .9) shoot = null; }
    }
  }
  function csFx(s, cs){
    const list = cs.all, wob = reduce ? 0 : s;
    const bundle = (ax, ay, bx, by, n, spread, i0) => {
      for(let k = 0; k < n; k++){
        const f = k / (n - 1) - .5, mx = (ax + bx) / 2, my = (ay + by) / 2 + f * spread + Math.sin(wob * .8 + k + i0) * 6;
        fxx.strokeStyle = `rgba(${k % 4 ? '150,200,255' : '230,240,255'},${.35 + (1 - Math.abs(f) * 2) * .4})`; fxx.lineWidth = 1;
        fxx.beginPath(); fxx.moveTo(ax, ay + f * 10); fxx.quadraticCurveTo(mx, my, bx, by + f * 10); fxx.stroke();
        if(k % 3 === 0){ const u = ((wob * .35 + k * .13 + i0 * .21) % 1), q = 1 - u;
          const px = q * q * ax + 2 * q * u * mx + u * u * bx, py = q * q * (ay + f * 10) + 2 * q * u * my + u * u * (by + f * 10);
          glow(fxx, px, py, 5, '170,215,255', .85); }
      }
    };
    fxx.shadowColor = '#8fc4ff'; fxx.shadowBlur = 6;
    for(let i = 0; i < list.length - 1; i++){ const a = list[i].c, b = list[i + 1].c; bundle(a.r - a.w * .12, a.y, b.l + b.w * .12, b.y, 12, a.h * .9, i); }
    // raios que saem do primeiro e do último cubo para fora do ecrã
    if(list.length){
      const f0 = list[0].c, fl = list[list.length - 1].c;
      for(let k = 0; k < 14; k++){
        const an = (k / 13 - .5) * 1.1;
        fxx.strokeStyle = `rgba(160,205,255,${.2 + Math.random() * .06})`; fxx.lineWidth = .8;
        fxx.beginPath(); fxx.moveTo(f0.l + 8, f0.y); fxx.lineTo(f0.l - 400 * Math.cos(an), f0.y + 400 * Math.sin(an)); fxx.stroke();
        fxx.beginPath(); fxx.moveTo(fl.r - 8, fl.y); fxx.lineTo(fl.r + 400 * Math.cos(an), fl.y + 400 * Math.sin(an)); fxx.stroke();
      }
    }
    fxx.shadowBlur = 0;
    // clarões nos cantos dos cubos e uma estrela-flare na aresta de entrada
    for(const o of list){
      const c = o.c, tw = .6 + .4 * Math.sin(wob * 2 + c.x * .01);
      for(const [x, y] of [[c.l + 6, c.t + 8], [c.r - 6, c.t + 4], [c.l + 4, c.b - 6], [c.r - 8, c.b - 10]]) glow(fxx, x, y, 10, '190,225,255', .5 * tw);
      const fx0 = c.l + 4, fy0 = c.y; glow(fxx, fx0, fy0, 22, '200,230,255', .7 * tw);
      fxx.strokeStyle = `rgba(230,242,255,${.55 * tw})`; fxx.lineWidth = 1;
      fxx.beginPath(); fxx.moveTo(fx0 - 26, fy0); fxx.lineTo(fx0 + 26, fy0); fxx.moveTo(fx0, fy0 - 18); fxx.lineTo(fx0, fy0 + 18); fxx.stroke();
    }
  }

  function frame(time){
    raf = 0;
    const mode = modeNow();
    if(!mode || !setup()) return;
    const visible = !document.hidden && box.offsetParent !== null;
    const scrolling = typeof hcScrolling !== 'undefined' && hcScrolling;   // pausa durante o scroll, como o resto do painel
    if(visible && !scrolling && time - last > 32){   // ~30 fps chega para isto
      last = time;
      if(W !== box.clientWidth || H !== box.clientHeight) resize();
      const s = time / 1000, cs = cubes();
      bgx.setTransform(dpr, 0, 0, dpr, 0, 0); bgx.clearRect(0, 0, W, H);
      fxx.setTransform(dpr, 0, 0, dpr, 0, 0); fxx.clearRect(0, 0, W, H);
      if(cs.clip){ fxx.save(); fxx.beginPath(); fxx.rect(cs.clip.l, cs.clip.t - 30, cs.clip.w, cs.clip.h + 40); fxx.clip(); }
      if(mode === 'scifi'){ sfBg(s); sfFx(s, cs); }
      else { csBg(s); csFx(s, cs); }
      if(cs.clip) fxx.restore();
      if(mode === 'scifi' && time - lastCharts > 1000){ lastCharts = time; sfCharts(); }
    }
    if(!reduce && !document.body.classList.contains('perf-mode')) raf = requestAnimationFrame(frame);
    else setTimeout(() => { if(!raf) raf = requestAnimationFrame(frame); }, 2000);
  }

  function kick(){ if(modeNow() && !raf) raf = requestAnimationFrame(frame); }
  // liga/desliga quando o estilo muda (classe no body)
  new MutationObserver(() => { lastCharts = 0; kick(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', kick);
  kick();
  window.hcMempoolCenas = { kick };
})();
