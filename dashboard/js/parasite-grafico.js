// ---------- Parasite Pool: gráfico "Hashrate e Difficulty" ----------
// Linha do hashrate (eixo da esquerda) e, a vermelho, os melhores shares por bloco (eixo da direita, escala logarítmica).
// Os dados vêm de /api/parasite-history (app.py), que pede o histórico à Parasite Pool para o endereço guardado na aba.
// Arrastar sobre o gráfico faz zoom; duplo clique ou o botão repõe.
(function(){
  const LANGS = ['pt', 'en', 'es', 'fr'], PKEY = 'hc_pg_period', PERIODS = ['24h', '3d'];   // a Parasite Pool só guarda ~3 dias de melhores shares: períodos maiores ficariam sem pontos vermelhos
  const TX = {
    title: ['Hashrate e Difficulty', 'Hashrate & Difficulty', 'Hashrate y Difficulty', 'Hashrate et Difficulty'],
    hr: ['Hashrate', 'Hashrate', 'Hashrate', 'Hashrate'], bd: ['Best Diff', 'Best Diff', 'Best Diff', 'Best Diff'],
    reset: ['Repor zoom', 'Reset zoom', 'Restablecer zoom', 'Réinitialiser le zoom'],
    loading: ['A carregar o histórico…', 'Loading history…', 'Cargando el historial…', 'Chargement de l’historique…'],
    noaddr: ['Guarda o teu endereço Bitcoin acima para ver o gráfico.', 'Save your Bitcoin address above to see the chart.', 'Guarda tu dirección Bitcoin arriba para ver el gráfico.', 'Enregistrez votre adresse Bitcoin ci-dessus pour voir le graphique.'],
    old: ['Esta versão do programa ainda não tem esta função. Instala a versão nova (ou reinicia o programa depois de atualizar) para ver o gráfico.', 'This version of the program does not have this feature yet. Install the new version (or restart after updating) to see the chart.', 'Esta versión del programa aún no tiene esta función. Instala la versión nueva (o reinicia tras actualizar) para ver el gráfico.', 'Cette version du programme n’a pas encore cette fonction. Installez la nouvelle version (ou redémarrez après la mise à jour) pour voir le graphique.'],
    err: ['Não foi possível obter o histórico', 'Could not load the history', 'No se pudo obtener el historial', 'Impossible de charger l’historique'],
    empty: ['Sem dados neste período.', 'No data in this period.', 'Sin datos en este período.', 'Pas de données sur cette période.'],
    hint: ['Arrasta sobre o gráfico para ampliar. Os pontos vermelhos são os 9 melhores shares do período.', 'Drag over the chart to zoom. The red dots are the 9 best shares of the period.', 'Arrastra sobre el gráfico para ampliar. Los puntos rojos son los 9 mejores shares del período.', 'Faites glisser sur le graphique pour zoomer. Les points rouges sont les 9 meilleurs shares de la période.'],
    table: ['Tabela dos melhores shares', 'Best shares table', 'Tabla de los mejores shares', 'Tableau des meilleurs shares'], when: ['Quando', 'When', 'Cuándo', 'Quand'], blk: ['Bloco', 'Block', 'Bloque', 'Bloc']
  };
  const lang = () => { try { const l = typeof currentLang !== 'undefined' ? currentLang : 'pt'; return LANGS.includes(l) ? l : 'pt'; } catch(e) { return 'pt'; } };
  const t = k => TX[k][LANGS.indexOf(lang())];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtTime = ms => { try { return new Date(ms).toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }); } catch(e) { return ''; } };
  const fd = n => { try { const f = formatDiff(n); return f.value + f.unit; } catch(e) { return String(Math.round(n)); } };
  const addr = () => { try { return (loadParasiteAddress() || '').trim(); } catch(e) { return ''; } };

  const S = { period: '3d', data: null, state: 'idle', zoom: null, at: 0, addr: '', busy: false, w: 0 };
  try { const p = localStorage.getItem(PKEY); if(PERIODS.includes(p)) S.period = p; } catch(e) {}

  function unitFor(max){ return max >= 1e15 ? ['PH/s', 1e15] : max >= 1e12 ? ['TH/s', 1e12] : max >= 1e9 ? ['GH/s', 1e9] : ['MH/s', 1e6]; }
  function niceTicks(lo, hi, n){
    const span = hi - lo || 1, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0))), f = step0 / mag;
    const step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * mag, out = [];
    for(let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(v);
    return out;
  }
  const fmtAxis = v => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)).replace(/\.?0+$/, m => m.includes('.') ? '' : m);

  async function load(force){
    const a = addr();
    if(!a){ S.state = 'noaddr'; S.data = null; draw(); return; }
    if(S.busy) return;
    if(!force && S.addr === a && S.data && Date.now() - S.at < 55e3) return;
    S.busy = true; if(!S.data || S.addr !== a){ S.state = 'loading'; draw(); }
    try {
      const r = await fetch(API_BASE + '/api/parasite-history?address=' + encodeURIComponent(a) + '&period=' + S.period);
      if(!/json/i.test(r.headers.get('content-type') || '')){ S.state = 'old'; S.busy = false; S.data = null; draw(); return; }   // versão antiga do programa: rota inexistente
      const j = await r.json();
      if(!r.ok || j.error) throw new Error(j.error || r.status);
      S.data = j; S.addr = a; S.at = Date.now(); S.state = 'ok'; S.zoom = null;
    } catch(e) { S.state = 'err'; S.err = String(e.message || e); }
    S.busy = false; draw();
  }

  function view(){
    const d = S.data; if(!d || !d.hashrate.length) return null;
    const all = d.hashrate, t0 = S.zoom ? S.zoom[0] : all[0][0], t1 = S.zoom ? S.zoom[1] : all[all.length - 1][0];
    const pts = all.filter(p => p[0] >= t0 && p[0] <= t1);
    if(pts.length < 2) return null;
    // os 9 melhores shares da janela visível, como no site da pool
    const dots = d.diffs.filter(x => x[0] >= t0 && x[0] <= t1).sort((a, b) => b[1] - a[1]).slice(0, 9).sort((a, b) => a[0] - b[0]);
    return { t0, t1, pts, dots };
  }

  function draw(){
    const host = document.getElementById('parasiteChartBody'); if(!host) return;
    const W = Math.max(280, host.clientWidth || 800), H = W < 520 ? 260 : 320, P = { l: W < 520 ? 58 : 72, r: W < 520 ? 44 : 56, t: 14, b: 30 };
    const msg = k => { host.innerHTML = '<div class="pg-msg">' + esc(t(k)) + (k === 'err' && S.err ? ' (' + esc(S.err) + ')' : '') + '</div>'; };
    if(S.state === 'noaddr') return msg('noaddr');
    if(S.state === 'old') return msg('old');
    if(S.state === 'loading' && !S.data) return msg('loading');
    if(S.state === 'err' && !S.data) return msg('err');
    const v = view(); if(!v) return msg('empty');
    const iw = W - P.l - P.r, ih = H - P.t - P.b;
    const hs = v.pts.map(p => p[1]), hmax = Math.max(...hs), hmin = Math.min(...hs), [uName, uDiv] = unitFor(hmax);
    const lo = Math.max(0, hmin - (hmax - hmin) * 0.12) / uDiv, hi = (hmax + (hmax - hmin) * 0.12 || hmax * 1.1) / uDiv;
    const X = ms => P.l + (ms - v.t0) / (v.t1 - v.t0 || 1) * iw, Y = h => P.t + (1 - (h / uDiv - lo) / (hi - lo || 1)) * ih;
    const yt = niceTicks(lo, hi, 5);
    let dMin = 0, dMax = 0, DY = () => 0, rt = [];
    if(v.dots.length){
      const ds = v.dots.map(x => x[1]); let a = Math.floor(Math.log10(Math.min(...ds))), b = Math.ceil(Math.log10(Math.max(...ds)));
      if(b <= a) b = a + 1; dMin = a; dMax = b;
      DY = d => P.t + (1 - (Math.log10(d) - a) / (b - a)) * ih;
      for(let e = a; e <= b; e++) rt.push(e);
    }
    const xt = []; const nx = Math.max(3, Math.min(8, Math.floor(iw / 120)));
    for(let i = 0; i <= nx; i++) xt.push(v.t0 + (v.t1 - v.t0) * i / nx);
    let path = ''; v.pts.forEach((p, i) => { path += (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); });
    const grid = yt.map(y => '<line class="pg-grid" x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + Y(y * uDiv).toFixed(1) + '" y2="' + Y(y * uDiv).toFixed(1) + '"/><text class="pg-ax" x="' + (P.l - 8) + '" y="' + (Y(y * uDiv) + 4).toFixed(1) + '" text-anchor="end">' + fmtAxis(y) + ' ' + uName + '</text>').join('');
    const decade = e => { const u = ['', 'K', 'M', 'G', 'T', 'P'], k = Math.min(5, Math.floor(e / 3)), m = Math.pow(10, e - k * 3); return m + u[k]; };   // 10M, 100M, 1G...
    const rax = rt.map(e => '<text class="pg-ax pg-axr" x="' + (W - P.r + 8) + '" y="' + (DY(Math.pow(10, e)) + 4).toFixed(1) + '">' + decade(e) + '</text>').join('');
    const xax = xt.map((ms, i) => '<text class="pg-ax" x="' + X(ms).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + (i === 0 ? 'start' : i === xt.length - 1 ? 'end' : 'middle') + '">' + esc(fmtTime(ms)) + '</text>').join('');
    const dots = v.dots.map(x => '<circle class="pg-dot" cx="' + X(x[0]).toFixed(1) + '" cy="' + DY(x[1]).toFixed(1) + '" r="5"/>').join('');
    const zoomed = !!S.zoom;
    host.innerHTML = '<div class="pg-wrap"><svg class="pg-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t('title')) + '">' +
      grid + rax + xax + '<path class="pg-line" d="' + path + '"/>' + dots +
      '<line class="pg-cross" y1="' + P.t + '" y2="' + (H - P.b) + '" x1="0" x2="0" hidden/><circle class="pg-pt" r="4" hidden/><rect class="pg-sel" y="' + P.t + '" height="' + ih + '" hidden/>' +
      '<rect class="pg-hit" x="' + P.l + '" y="' + P.t + '" width="' + iw + '" height="' + ih + '"/></svg><div class="pg-tip" hidden></div></div>';
    const svg = host.querySelector('svg'), hit = svg.querySelector('.pg-hit'), cross = svg.querySelector('.pg-cross'), pt = svg.querySelector('.pg-pt'), sel = svg.querySelector('.pg-sel'), tip = host.querySelector('.pg-tip');
    const tAt = px => v.t0 + (px - P.l) / iw * (v.t1 - v.t0);
    const near = ms => { let lo2 = 0, hi2 = v.pts.length - 1; while(hi2 - lo2 > 1){ const m = (lo2 + hi2) >> 1; if(v.pts[m][0] < ms) lo2 = m; else hi2 = m; } return Math.abs(v.pts[lo2][0] - ms) < Math.abs(v.pts[hi2][0] - ms) ? v.pts[lo2] : v.pts[hi2]; };
    const px = e => { const r = svg.getBoundingClientRect(); return (e.clientX - r.left) * (W / r.width); };
    let drag = null;
    hit.addEventListener('pointermove', e => {
      const x = px(e), p = near(tAt(x)), cx = X(p[0]), cy = Y(p[1]);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.hidden = false; pt.setAttribute('cx', cx); pt.setAttribute('cy', cy); pt.hidden = false;
      const dd = v.dots.find(d => Math.abs(X(d[0]) - x) < 9 && Math.abs(DY(d[1]) - (e.clientY - svg.getBoundingClientRect().top) * (H / svg.getBoundingClientRect().height)) < 12);
      tip.innerHTML = '<b>' + esc(fmtTime(p[0])) + '</b><br><i class="pg-k a"></i>' + esc(t('hr')) + ': ' + (p[1] / uDiv).toFixed(2) + ' ' + uName + (dd ? '<br><i class="pg-k b"></i>' + esc(t('bd')) + ': ' + fd(dd[1]) + ' (#' + dd[2] + ')' : '');
      tip.hidden = false; const tw = tip.offsetWidth; tip.style.left = Math.max(4, Math.min(W - tw - 4, cx + 12)) + 'px'; tip.style.top = Math.max(4, cy - 52) + 'px';
      if(drag){ drag.x1 = x; const a = Math.min(drag.x0, x), b = Math.max(drag.x0, x); sel.setAttribute('x', a); sel.setAttribute('width', b - a); sel.hidden = false; }
    });
    hit.addEventListener('pointerleave', () => { cross.hidden = true; pt.hidden = true; tip.hidden = true; });
    hit.addEventListener('pointerdown', e => { drag = { x0: px(e), x1: px(e) }; try { hit.setPointerCapture(e.pointerId); } catch(e2) {} });
    hit.addEventListener('pointerup', () => {
      if(!drag) return; const a = Math.min(drag.x0, drag.x1), b = Math.max(drag.x0, drag.x1); drag = null; sel.hidden = true;
      if(b - a > 14){ S.zoom = [tAt(a), tAt(b)]; draw(); updateBar(); }
    });
    hit.addEventListener('dblclick', () => { if(S.zoom){ S.zoom = null; draw(); updateBar(); } });
    // tabela alternativa (acessibilidade)
    const tb = document.getElementById('parasiteChartTable');
    if(tb) tb.innerHTML = v.dots.length ? '<details><summary>' + esc(t('table')) + '</summary><table><thead><tr><th>' + esc(t('when')) + '</th><th>' + esc(t('bd')) + '</th><th>' + esc(t('blk')) + '</th></tr></thead><tbody>' +
      v.dots.slice().sort((a, b) => b[1] - a[1]).map(d => '<tr><td>' + esc(fmtTime(d[0])) + '</td><td>' + esc(fd(d[1])) + '</td><td>#' + d[2] + '</td></tr>').join('') + '</tbody></table></details>' : '';
  }

  function updateBar(){
    const bar = document.getElementById('parasiteChartBar'); if(!bar) return;
    bar.innerHTML = PERIODS.map(p => '<button type="button" class="pg-btn' + (p === S.period ? ' on' : '') + '" data-p="' + p + '">' + p + '</button>').join('') +
      (S.zoom ? '<button type="button" class="pg-btn pg-reset" data-p="reset">' + esc(t('reset')) + '</button>' : '');
    const tt = document.getElementById('parasiteChartTitle'); if(tt) tt.textContent = '↗ ' + t('title');
    const lg = document.getElementById('parasiteChartLegend'); if(lg) lg.innerHTML = '<span><i class="pg-k a"></i>' + esc(t('hr')) + '</span><span><i class="pg-k b"></i>' + esc(t('bd')) + '</span>';
    const h = document.getElementById('parasiteChartHint'); if(h) h.textContent = t('hint');
  }

  function build(){
    const tab = document.getElementById('tab-parasite'); if(!tab || document.getElementById('parasiteChart')) return;
    const anchor = document.getElementById('parasiteErrorHint'); if(!anchor || !anchor.parentNode) return;
    const box = document.createElement('div'); box.id = 'parasiteChart'; box.className = 'pg-card';
    box.innerHTML = '<div class="pg-head"><b id="parasiteChartTitle"></b><div class="pg-bar" id="parasiteChartBar"></div></div><div id="parasiteChartBody"></div><div class="pg-legend" id="parasiteChartLegend"></div><div id="parasiteChartTable" class="pg-table"></div><div class="pg-hint" id="parasiteChartHint"></div>';
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
    box.querySelector('#parasiteChartBar').addEventListener('click', e => {
      const b = e.target.closest('[data-p]'); if(!b) return; const p = b.dataset.p;
      if(p === 'reset'){ S.zoom = null; draw(); updateBar(); return; }
      if(p === S.period) return; S.period = p; S.zoom = null; try { localStorage.setItem(PKEY, p); } catch(e2) {}
      updateBar(); load(true);
    });
    updateBar();
    if(window.ResizeObserver) new ResizeObserver(() => { const w = document.getElementById('parasiteChartBody'); if(w && Math.abs(w.clientWidth - S.w) > 8 && S.w){ S.w = w.clientWidth; draw(); } else if(w && !S.w) S.w = w.clientWidth; }).observe(box);
  }

  function show(){ build(); updateBar(); load(false); }
  // arranca quando a aba é aberta e sempre que o endereço é guardado
  if(typeof renderParasiteSection === 'function'){ const o = renderParasiteSection; window.renderParasiteSection = function(){ const r = o.apply(this, arguments); try { show(); } catch(e) {} return r; }; }
  if(typeof fetchParasiteStats === 'function'){ const o2 = fetchParasiteStats; window.fetchParasiteStats = function(forceUi){ const r = o2.apply(this, arguments); if(forceUi){ try { build(); load(true); } catch(e) {} } return r; }; }
  setInterval(() => { const tab = document.getElementById('tab-parasite'); if(tab && tab.classList.contains('active') && !document.hidden) load(false); }, 60000);
  setTimeout(build, 1500);
  window.hcParasiteChart = { load, state: () => S, draw };
})();
