// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Topo do Dashboard Geral em 3D: painel do relógio/tempo e destaque da Molepool (estilos em topo-3d.css) ----------
// Não mexe no conteúdo: acrescenta camadas (estrelas, anel dos segundos, moeda) e inclina os painéis com o rato.
// O destaque da Molepool é redesenhado de 15 em 15 s por gpSpotRender (09-pools.js); um MutationObserver volta a pôr a moeda.
(function(){
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = window.matchMedia && matchMedia('(hover: none)').matches;
  const mk = (tag, cls, html) => { const e = document.createElement(tag); e.className = cls; if(html) e.innerHTML = html; e.setAttribute('aria-hidden', 'true'); return e; };

  function tilt(el, maxX, maxY){
    if(reduce || touch || el.dataset.t3dTilt) return; el.dataset.t3dTilt = '1';
    let raf = 0;
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.classList.add('t3d-on');
        el.style.setProperty('--ry', ((px - .5) * maxY).toFixed(2) + 'deg'); el.style.setProperty('--rx', ((.5 - py) * maxX).toFixed(2) + 'deg');
        el.style.setProperty('--px', (px - .5).toFixed(3)); el.style.setProperty('--py', (py - .5).toFixed(3));
        el.style.setProperty('--mx', (px * 100).toFixed(1) + '%'); el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
    });
    el.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); el.classList.remove('t3d-on'); ['--rx', '--ry'].forEach(k => el.style.setProperty(k, '0deg')); ['--px', '--py'].forEach(k => el.style.setProperty(k, '0')); });
  }

  // ---- relógio e tempo ----
  function sky(){ const h = new Date().getHours(); return h >= 7 && h < 18 ? 'day' : h >= 18 && h < 21 ? 'dusk' : h >= 5 && h < 7 ? 'dawn' : 'night'; }
  function setupWx(){
    const p = document.getElementById('wxPanel'); if(!p || p.classList.contains('t3d')) return;
    p.classList.add('t3d'); p.dataset.sky = sky();
    const stars = mk('div', 't3d-stars');
    for(let i = 0; i < 60; i++){ const s = document.createElement('i'); s.style.left = (Math.random() * 100).toFixed(1) + '%'; s.style.top = (Math.random() * 100).toFixed(1) + '%';
      s.style.setProperty('--s', (Math.random() * 1.8 + .6).toFixed(1) + 'px'); s.style.setProperty('--d', (2 + Math.random() * 4).toFixed(1) + 's'); s.style.animationDelay = (-Math.random() * 5).toFixed(1) + 's'; stars.appendChild(s); }
    p.prepend(stars, mk('div', 't3d-sweep'));
    const g = document.getElementById('wxGlobe');
    if(g){
      const ring = mk('div', 't3d-orbit', '<i></i>');
      const sec = mk('div', 't3d-secring', '<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" class="bg"/><circle cx="60" cy="60" r="56" class="fg"/></svg>');
      g.append(ring, sec);
    }
    tilt(p, 7, 9);
    const fg = p.querySelector('.t3d-secring .fg'), C = 2 * Math.PI * 56;
    const tick = () => { if(fg){ const s = new Date().getSeconds() + new Date().getMilliseconds() / 1000; fg.style.strokeDasharray = (C * s / 60).toFixed(1) + ' ' + C.toFixed(1); } };
    tick(); setInterval(tick, 1000);
    setInterval(() => { p.dataset.sky = sky(); }, 60000);
  }

  // ---- destaque da Molepool ----
  function decorateSpot(){
    const s = document.getElementById('gpSpotlight'); if(!s) return;
    s.classList.add('t3d');
    if(!s.querySelector('.gp-spot-item')) return;   // ainda sem dados (ou a pedir o endereço)
    if(!s.querySelector('.t3d-coin')) s.prepend(mk('div', 't3d-coin', '<div class="f">⛏</div><div class="b">₿</div>' + [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map(z => '<div class="e" style="--z:' + z + 'px"></div>').join('')));   // várias camadas = espessura: de lado vê-se a borda em vez de desaparecer
    if(!s.querySelector('.t3d-edge')) s.prepend(mk('div', 't3d-edge'));
    const fill = s.querySelector('.gp-spot-fill');
    if(fill && !fill.querySelector('.t3d-head')) fill.appendChild(mk('span', 't3d-head'));
  }
  function setupSpot(){
    const s = document.getElementById('gpSpotlight'); if(!s || s.dataset.t3dObs) return;
    s.dataset.t3dObs = '1';
    decorateSpot(); tilt(s, 8, 6);
    new MutationObserver(() => { if(!s.querySelector('.t3d-coin') || (s.querySelector('.gp-spot-fill') && !s.querySelector('.t3d-head'))) decorateSpot(); }).observe(s, { childList: true });
  }

  function init(){ setupWx(); setupSpot(); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  setTimeout(init, 2000);
})();

// ---------- Indicadores do lado (hashrate, melhor share, temperatura, ventoinhas, potência, máquinas) em 3D ----------
// Cada um ganha ícone, cor própria e uma barra com o valor em relação ao máximo (fixo para temperatura e ventoinhas,
// o maior visto nesta sessão para hashrate e potência). Os números continuam a ser escritos pelo código de sempre.
(function(){
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = window.matchMedia && matchMedia('(hover: none)').matches;
  const G = {
    'gauge-hashrate': { ic: '⚡', c: '#21ffb0', max: 'peak' },
    'gauge-best': { ic: '🎯', c: '#ffb020' },
    'gauge-temp': { ic: '🌡️', c: '#4fd6ff', max: 85 },
    'gauge-fan': { ic: '🌀', c: '#7aa8ff', max: 7000 },
    'gauge-power': { ic: '🔌', c: '#3dffc2', max: 'peak' },
    'gauge-count': { ic: '🖥️', c: '#b48cff' },
  };
  const peak = {};
  function setup(){
    document.querySelectorAll('.gauge[data-layout-id]').forEach(g => {
      const cfg = G[g.dataset.layoutId]; if(!cfg || g.classList.contains('g3d')) return;
      g.classList.add('g3d'); g.style.setProperty('--gc', cfg.c);
      const ic = document.createElement('div'); ic.className = 'g3d-ic'; ic.textContent = cfg.ic; ic.setAttribute('aria-hidden', 'true');
      g.prepend(ic);
      if(cfg.max){ const m = document.createElement('div'); m.className = 'g3d-meter'; m.innerHTML = '<i></i>'; m.setAttribute('aria-hidden', 'true'); g.appendChild(m); }
      if(!reduce && !touch){
        g.addEventListener('pointermove', e => { const r = g.getBoundingClientRect(); g.style.setProperty('--ry', (((e.clientX - r.left) / r.width - .5) * 16).toFixed(1) + 'deg'); g.style.setProperty('--rx', ((.5 - (e.clientY - r.top) / r.height) * 14).toFixed(1) + 'deg'); g.classList.add('g3d-on'); });
        g.addEventListener('pointerleave', () => { g.style.setProperty('--rx', '0deg'); g.style.setProperty('--ry', '0deg'); g.classList.remove('g3d-on'); });
      }
    });
  }
  function meters(){
    document.querySelectorAll('.gauge.g3d').forEach(g => {
      const cfg = G[g.dataset.layoutId], bar = g.querySelector('.g3d-meter i'), val = g.querySelector('.value');
      if(!cfg || !val) return;
      // cor do número (a temperatura fica vermelha quando aquece): o brilho do cartão acompanha
      g.dataset.hot = val.classList.contains('red') ? '1' : '';
      if(!bar) return;
      const n = parseFloat(String(val.textContent).replace(/[^\d.,-]/g, '').replace(',', '.'));
      if(!isFinite(n)) return;
      const id = g.dataset.layoutId;
      if(cfg.max === 'peak'){ peak[id] = Math.max(peak[id] || 0, n); }
      const max = cfg.max === 'peak' ? peak[id] : cfg.max;
      bar.style.width = Math.max(2, Math.min(100, max ? n / max * 100 : 0)).toFixed(1) + '%';
    });
  }
  function init(){ setup(); meters(); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  setTimeout(init, 2000);
  setInterval(meters, 2000);
})();

// ---------- Cartões de resumo (Agora, Média 24 h, Pico, Energia, Lucro, Chance, Meta, Eventos, Contagem, Sorte) em 3D ----------
(function(){
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = window.matchMedia && matchMedia('(hover: none)').matches;
  const T = { now: ['📡', '#4fd6ff'], avg: ['📊', '#3dffc2'], peak: ['⛰️', '#b48cff'], kwh: ['🔋', '#ffd23f'], profit: ['💶', '#21ffb0'],
    chance: ['🎲', '#ffb020'], goal: ['🎯', '#ff7ab6'], ev: ['📋', '#7aa8ff'], count: ['⏳', '#4fd6ff'], luck: ['🍀', '#21ffb0'] };
  function decorate(){
    const box = document.getElementById('mcSummary'); if(!box) return;
    box.querySelectorAll(':scope > .mc-tile').forEach(tile => {
      const k = tile.classList.contains('mc-count') ? 'count' : tile.classList.contains('mc-luck') ? 'luck' : (tile.querySelector(':scope > b[data-f]') || {}).dataset ? tile.querySelector(':scope > b[data-f]').dataset.f : null;
      const cfg = T[k];
      if(!cfg) return;
      if(k === 'profit'){ const b = tile.querySelector('[data-f="profit"]'); tile.style.setProperty('--sc', b && /^-/.test(b.textContent.trim()) ? '#ff5d6c' : cfg[1]); }
      if(tile.classList.contains('s3d')) return;
      tile.classList.add('s3d'); tile.dataset.s3d = k; tile.style.setProperty('--sc', cfg[1]);
      const lbl = tile.querySelector(':scope > span');
      if(lbl){ lbl.textContent = lbl.textContent.replace(/^[\p{Extended_Pictographic}️‍]+\s*/u, ''); }   // o ícone passa para a pastilha
      const ic = document.createElement('i'); ic.className = 's3d-ic'; ic.textContent = cfg[0]; ic.setAttribute('aria-hidden', 'true');
      tile.prepend(ic);
      if(!reduce && !touch){
        tile.addEventListener('pointermove', e => { const r = tile.getBoundingClientRect(); tile.style.setProperty('--ry', (((e.clientX - r.left) / r.width - .5) * 14).toFixed(1) + 'deg'); tile.style.setProperty('--rx', ((.5 - (e.clientY - r.top) / r.height) * 12).toFixed(1) + 'deg'); tile.classList.add('s3d-on'); });
        tile.addEventListener('pointerleave', () => { tile.style.setProperty('--rx', '0deg'); tile.style.setProperty('--ry', '0deg'); tile.classList.remove('s3d-on'); });
      }
    });
  }
  setTimeout(decorate, 1500);
  setInterval(decorate, 3000);
})();

// ---------- Distribuição de hashrate: cada máquina da legenda ganha uma barra com a sua percentagem ----------
// renderHashrateDonut (11-suporte-toasts.js) redesenha a legenda; aqui só se lê a % e a cor de cada linha e se passam ao CSS.
(function(){
  function bars(){
    const row = document.getElementById('hashrateDonutRow'); if(!row) return;
    row.classList.add('d3d');
    row.querySelectorAll('.donut-legend-item').forEach(it => {
      const pct = parseFloat((it.querySelector('.donut-legend-pct') || {}).textContent) || 0;
      const sw = it.querySelector('.donut-legend-swatch');
      it.style.setProperty('--p', Math.max(2, Math.min(100, pct)).toFixed(1) + '%');
      if(sw) it.style.setProperty('--c', sw.style.background || sw.style.color);
    });
  }
  function init(){
    const row = document.getElementById('hashrateDonutRow'); if(!row || row.dataset.d3d) return;
    row.dataset.d3d = '1'; bars();
    new MutationObserver(bars).observe(row, { childList: true, subtree: true });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  setTimeout(init, 2000);
})();

// ---------- Simulador em 3D: cada secção com a sua cor e cada cartão com ícone ----------
(function(){
  const SECT = [
    { c: '#4fd6ff', ic: ['🧱', '📉', '⏳', '📅'] },   // rede Bitcoin
    { c: '#ffb020', ic: ['🔢', '🪙', '⏳', '📅'] },   // halving
    { c: '#21ffb0', ic: ['⚡', '⏱️', '⏱️', '🎯'] },   // a tua rig
    { c: '#b48cff', ic: ['🎲', '🎲', '🎲', '🎲'] },   // probabilidade de bloco
  ];
  function deco(){
    const tab = document.getElementById('tab-simulator'); if(!tab) return;
    tab.querySelectorAll('.sim-grid').forEach((g, gi) => {
      const s = SECT[gi] || SECT[0];
      g.classList.add('s3dg'); g.style.setProperty('--sc', s.c);
      g.querySelectorAll('.sim-card').forEach((c, ci) => {
        if(c.querySelector('.s3d-ic')) return;
        const i = document.createElement('i'); i.className = 's3d-ic'; i.textContent = s.ic[ci] || s.ic[0]; i.setAttribute('aria-hidden', 'true');
        c.prepend(i);
      });
    });
    // a cor da secção passa para o rótulo e para a barra que vêm antes de cada grelha
    let gi = -1;
    tab.querySelectorAll('.sim-section-label, .sim-grid, .sim-progress-wrap').forEach(el => {
      if(el.classList.contains('sim-section-label')) gi++;
      if(gi >= 0) el.style.setProperty('--sc', (SECT[gi] || SECT[0]).c);
      if(el.classList.contains('sim-section-label') || el.classList.contains('sim-progress-wrap')) el.classList.add('s3dl');
    });
  }
  setTimeout(deco, 1500); setInterval(deco, 4000);
})();
