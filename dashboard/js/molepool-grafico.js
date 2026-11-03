// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Molepool e DeFi Surfers: gráfico "Hashrate e Difficulty" (igual ao da Parasite Pool) ----------
// Linha do hashrate (eixo da esquerda) e, a vermelho, o teu melhor share e os blocos que encontraste (eixo da direita, escala logarítmica).
// Os dados vêm direto da API pública de cada pool para o endereço guardado na aba Pools:
//   Molepool (Miningcore): /api/v1/account e /api/v1/blocks, cerca de 12 horas;
//   DeFi Surfers (API do public-pool): /api/client/<endereço>/chart (de 10 em 10 min, 24 horas), /api/client e /api/info.
// Arrastar sobre o gráfico faz zoom; duplo clique ou o botão repõe.
(function(){
  const LANGS = ['pt', 'en', 'es', 'fr'];
  const TX = {
    title: ['Hashrate e Difficulty', 'Hashrate & Difficulty', 'Hashrate y Difficulty', 'Hashrate et Difficulty'],
    hr: ['Hashrate', 'Hashrate', 'Hashrate', 'Hashrate'], bd: ['Best Diff', 'Best Diff', 'Best Diff', 'Best Diff'],
    reset: ['Repor zoom', 'Reset zoom', 'Restablecer zoom', 'Réinitialiser le zoom'],
    loading: ['A carregar o histórico…', 'Loading history…', 'Cargando el historial…', 'Chargement de l’historique…'],
    noaddr: ['Guarda o teu endereço da {p} acima para ver o gráfico.', 'Save your {p} address above to see the chart.', 'Guarda tu dirección de {p} arriba para ver el gráfico.', 'Enregistrez votre adresse {p} ci-dessus pour voir le graphique.'],
    old: ['Esta versão do programa ainda não tem esta função. Instala a versão nova (ou reinicia o programa depois de atualizar) para ver o gráfico.', 'This version of the program does not have this feature yet. Install the new version (or restart after updating) to see the chart.', 'Esta versión del programa aún no tiene esta función. Instala la versión nueva (o reinicia tras actualizar) para ver el gráfico.', 'Cette version du programme n’a pas encore cette fonction. Installez la nouvelle version (ou redémarrez après la mise à jour) pour voir le graphique.'],
    err: ['Não foi possível obter o histórico', 'Could not load the history', 'No se pudo obtener el historial', 'Impossible de charger l’historique'],
    empty: ['Sem dados neste período.', 'No data in this period.', 'Sin datos en este período.', 'Pas de données sur cette période.'],
    hint: ['Arrasta sobre o gráfico para ampliar. Os pontos vermelhos são os melhores shares de cada máquina (cada vez que batem o recorde) e os blocos que encontraste.', 'Drag over the chart to zoom. The red dots are best shares of each machine (every time it sets a new record) and the blocks you found.', 'Arrastra sobre el gráfico para ampliar. Los puntos rojos son los mejores shares de cada máquina (cada vez que bate su récord) y los bloques que encontraste.', 'Faites glisser sur le graphique pour zoomer. Les points rouges sont les meilleurs shares de chaque machine (à chaque nouveau record) et les blocs trouvés.'],
    table: ['Tabela dos melhores shares', 'Best shares table', 'Tabla de los mejores shares', 'Tableau des meilleurs shares'], when: ['Quando', 'When', 'Cuándo', 'Quand'], blk: ['Bloco', 'Block', 'Bloque', 'Bloc']
  };
  const lang = () => { try { const l = typeof currentLang !== 'undefined' ? currentLang : 'pt'; return LANGS.includes(l) ? l : 'pt'; } catch(e) { return 'pt'; } };
  const t = k => TX[k][LANGS.indexOf(lang())];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtTime = ms => { try { return new Date(ms).toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }); } catch(e) { return ''; } };
  const fd = n => { try { const f = formatDiff(n); return f.value + f.unit; } catch(e) { return String(Math.round(n)); } };
  const getJson = u => fetch(u).then(r => r.json());

  function unitFor(max){ return max >= 1e15 ? ['PH/s', 1e15] : max >= 1e12 ? ['TH/s', 1e12] : max >= 1e9 ? ['GH/s', 1e9] : ['MH/s', 1e6]; }
  function niceTicks(lo, hi, n){
    const span = hi - lo || 1, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0))), f = step0 / mag;
    const step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * mag, out = [];
    for(let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(v);
    return out;
  }
  const fmtAxis = v => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)).replace(/\.?0+$/, m => m.includes('.') ? '' : m);

  // Cada pool devolve: hashrate [[ms, H/s]...], best {share, ms, worker} (opcional), workers [{name, best}], blocks [[ms, diff, altura]]
  const SOURCES = {
    // Molepool BTC1 (Miningcore)
    mole: async a => {
      const BASE = 'https://btc1.molepool.com';
      const [ja, jb] = await Promise.all([getJson(BASE + '/api/v1/account/' + encodeURIComponent(a)), getJson(BASE + '/api/v1/blocks').catch(() => null)]);
      if(!ja || !ja.status || !ja.result) throw new Error('sem dados');
      const res = ja.result, workers = (res.workers || []).map(w => ({ name: w.name || '', best: Number(w.bestShare) || 0 }));
      let best = null;
      if(res.bestShare && res.bestShare.share && res.bestShare.time){
        const s = Number(res.bestShare.share), wk = workers.find(w => Math.abs(w.best - s) / s < 1e-9);
        best = { share: s, ms: res.bestShare.time * 1000, worker: wk ? wk.name : '' };
      }
      const blocks = (jb && jb.result && jb.result.blocks || []).filter(x => x.miner === a && x.shareDiff).map(x => [x.timestamp * 1000, Number(x.shareDiff), Number(x.height) || 0]);
      return { hashrate: (res.chart || []).map(p => [p.t * 1000, Number(p.c) || 0]), best, workers, blocks };
    },
    // DeFi Surfers (API do public-pool)
    ds: async a => {
      const BASE = 'https://pool.defisurfers.xyz', ea = encodeURIComponent(a);
      const [chart, client, info] = await Promise.all([getJson(BASE + '/api/client/' + ea + '/chart'), getJson(BASE + '/api/client/' + ea).catch(() => null), getJson(BASE + '/api/info').catch(() => null)]);
      if(!Array.isArray(chart)) throw new Error('sem dados');
      const workers = (client && client.workers || []).map(w => ({ name: w.name || '', best: Number(w.bestDifficulty) || 0 }));
      const blocks = (info && info.blockData || []).filter(b => (b.minerAddress || b.address) === a).map(b => [Date.parse(b.timestamp || b.created || b.createdAt) || Date.now(), Number(b.difficulty || b.shareDiff) || 0, Number(b.height) || 0]).filter(b => b[1] > 0);
      return { hashrate: chart.map(p => [Date.parse(p.label), Number(p.data) || 0]).filter(p => isFinite(p[0])), best: null, workers, blocks };
    }
  };

  function makeChart(P){
    const addr = () => { try { const i = document.getElementById('gpAddress'); return ((i && GP_STATE.current === P.pool ? i.value : gpLoadAddr(P.pool)) || '').trim(); } catch(e) { return ''; } };
    const el = s => document.getElementById(P.id + s);
    const S = { period: P.period, data: null, state: 'idle', zoom: null, at: 0, addr: '', busy: false, w: 0 };

    const HK = a => P.hk + a;
    function histLoad(a){ try { const h = JSON.parse(localStorage.getItem(HK(a)) || 'null'); if(h && Array.isArray(h.pts)) return h; } catch(e) {} return { pts: [] }; }
    function histSave(a, h){ try { localStorage.setItem(HK(a), JSON.stringify(h)); } catch(e) {} }

    async function load(force){
      const a = addr();
      if(!a){ S.state = 'noaddr'; S.data = null; draw(); return; }
      if(S.busy) return;
      if(!force && S.addr === a && S.data && Date.now() - S.at < 55e3) return;
      S.busy = true; if(!S.data || S.addr !== a){ S.state = 'loading'; draw(); }
      try {
        const r = await SOURCES[P.src](a), hashrate = r.hashrate.sort((x, y) => x[0] - y[0]), diffs = [];
        if(!hashrate.length) throw new Error('sem histórico');
        // as pools não publicam a lista de shares: guardamos aqui cada novo melhor share de cada máquina (e o melhor da conta, com a hora exata) para o gráfico os mostrar todos
        const hist = histLoad(a), seen = d => hist.pts.some(q => Math.abs(q[1] - d) / d < 1e-9);
        if(r.best && !seen(r.best.share)) hist.pts.push([r.best.ms, r.best.share, 0, r.best.worker]);
        r.workers.forEach(w => { if(w.best > 0 && !seen(w.best)) hist.pts.push([Math.min(Date.now(), hashrate[hashrate.length - 1][0]), w.best, 0, w.name]); });
        hist.pts.sort((x, y) => x[0] - y[0]); if(hist.pts.length > 400) hist.pts = hist.pts.slice(-400); histSave(a, hist);
        hist.pts.forEach(q => diffs.push(q.slice()));
        r.blocks.forEach(b => diffs.push(b));
        const t0 = hashrate[0][0]; S.data = { hashrate, diffs: diffs.filter(x => x[0] >= t0) };
        S.addr = a; S.at = Date.now(); S.state = 'ok'; S.zoom = null;
      } catch(e) { S.state = 'err'; S.err = String(e.message || e); }
      S.busy = false; draw();
    }

    function view(){
      const d = S.data; if(!d || !d.hashrate.length) return null;
      const all = d.hashrate, t0 = S.zoom ? S.zoom[0] : all[0][0], t1 = S.zoom ? S.zoom[1] : all[all.length - 1][0];
      const pts = all.filter(p => p[0] >= t0 && p[0] <= t1);
      if(pts.length < 2) return null;
      const dots = d.diffs.filter(x => x[0] >= t0 && x[0] <= t1).sort((a, b) => a[0] - b[0]);
      return { t0, t1, pts, dots };
    }

    function draw(){
      const host = el('Body'); if(!host) return;
      const W = Math.max(280, host.clientWidth || 800), H = W < 520 ? 260 : 320, P2 = { l: W < 520 ? 58 : 72, r: W < 520 ? 44 : 56, t: 14, b: 30 };
      const msg = k => { host.innerHTML = '<div class="pg-msg">' + esc(t(k).replace('{p}', P.name)) + (k === 'err' && S.err ? ' (' + esc(S.err) + ')' : '') + '</div>'; };
      if(S.state === 'noaddr') return msg('noaddr');
      if(S.state === 'old') return msg('old');
      if(S.state === 'loading' && !S.data) return msg('loading');
      if(S.state === 'err' && !S.data) return msg('err');
      const v = view(); if(!v) return msg('empty');
      const iw = W - P2.l - P2.r, ih = H - P2.t - P2.b;
      const hs = v.pts.map(p => p[1]), hmax = Math.max(...hs), hmin = Math.min(...hs), [uName, uDiv] = unitFor(hmax);
      const lo = Math.max(0, hmin - (hmax - hmin) * 0.12) / uDiv, hi = (hmax + (hmax - hmin) * 0.12 || hmax * 1.1 || 1) / uDiv;
      const X = ms => P2.l + (ms - v.t0) / (v.t1 - v.t0 || 1) * iw, Y = h => P2.t + (1 - (h / uDiv - lo) / (hi - lo || 1)) * ih;
      const yt = niceTicks(lo, hi, 5);
      let DY = () => 0, rt = [];
      if(v.dots.length){
        const ds = v.dots.map(x => x[1]); let a = Math.floor(Math.log10(Math.min(...ds))), b = Math.ceil(Math.log10(Math.max(...ds)));
        if(b <= a) b = a + 1;
        DY = d => P2.t + (1 - (Math.log10(d) - a) / (b - a)) * ih;
        for(let e = a; e <= b; e++) rt.push(e);
      }
      const xt = []; const nx = Math.max(3, Math.min(8, Math.floor(iw / 120)));
      for(let i = 0; i <= nx; i++) xt.push(v.t0 + (v.t1 - v.t0) * i / nx);
      let path = ''; v.pts.forEach((p, i) => { path += (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); });
      const grid = yt.map(y => '<line class="pg-grid" x1="' + P2.l + '" x2="' + (W - P2.r) + '" y1="' + Y(y * uDiv).toFixed(1) + '" y2="' + Y(y * uDiv).toFixed(1) + '"/><text class="pg-ax" x="' + (P2.l - 8) + '" y="' + (Y(y * uDiv) + 4).toFixed(1) + '" text-anchor="end">' + fmtAxis(y) + ' ' + uName + '</text>').join('');
      const decade = e => { const u = ['', 'K', 'M', 'G', 'T', 'P'], k = Math.min(5, Math.floor(e / 3)), m = Math.pow(10, e - k * 3); return m + u[k]; };   // 10M, 100M, 1G...
      const rax = rt.map(e => '<text class="pg-ax pg-axr" x="' + (W - P2.r + 8) + '" y="' + (DY(Math.pow(10, e)) + 4).toFixed(1) + '">' + decade(e) + '</text>').join('');
      const xax = xt.map((ms, i) => '<text class="pg-ax" x="' + X(ms).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + (i === 0 ? 'start' : i === xt.length - 1 ? 'end' : 'middle') + '">' + esc(fmtTime(ms)) + '</text>').join('');
      const dots = v.dots.map(x => '<circle class="pg-dot" cx="' + X(x[0]).toFixed(1) + '" cy="' + DY(x[1]).toFixed(1) + '" r="5"/>').join('');
      host.innerHTML = '<div class="pg-wrap"><svg class="pg-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t('title')) + '">' +
        grid + rax + xax + '<path class="pg-line" d="' + path + '"/>' + dots +
        '<line class="pg-cross" y1="' + P2.t + '" y2="' + (H - P2.b) + '" x1="0" x2="0" hidden/><circle class="pg-pt" r="4" hidden/><rect class="pg-sel" y="' + P2.t + '" height="' + ih + '" hidden/>' +
        '<rect class="pg-hit" x="' + P2.l + '" y="' + P2.t + '" width="' + iw + '" height="' + ih + '"/></svg><div class="pg-tip" hidden></div></div>';
      const svg = host.querySelector('svg'), hit = svg.querySelector('.pg-hit'), cross = svg.querySelector('.pg-cross'), pt = svg.querySelector('.pg-pt'), sel = svg.querySelector('.pg-sel'), tip = host.querySelector('.pg-tip');
      const tAt = px => v.t0 + (px - P2.l) / iw * (v.t1 - v.t0);
      const near = ms => { let lo2 = 0, hi2 = v.pts.length - 1; while(hi2 - lo2 > 1){ const m = (lo2 + hi2) >> 1; if(v.pts[m][0] < ms) lo2 = m; else hi2 = m; } return Math.abs(v.pts[lo2][0] - ms) < Math.abs(v.pts[hi2][0] - ms) ? v.pts[lo2] : v.pts[hi2]; };
      const px = e => { const r = svg.getBoundingClientRect(); return (e.clientX - r.left) * (W / r.width); };
      let drag = null;
      hit.addEventListener('pointermove', e => {
        const x = px(e), p = near(tAt(x)), cx = X(p[0]), cy = Y(p[1]);
        cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.hidden = false; pt.setAttribute('cx', cx); pt.setAttribute('cy', cy); pt.hidden = false;
        const dd = v.dots.find(d => Math.abs(X(d[0]) - x) < 9 && Math.abs(DY(d[1]) - (e.clientY - svg.getBoundingClientRect().top) * (H / svg.getBoundingClientRect().height)) < 12);
        tip.innerHTML = '<b>' + esc(fmtTime(p[0])) + '</b><br><i class="pg-k a"></i>' + esc(t('hr')) + ': ' + (p[1] / uDiv).toFixed(2) + ' ' + uName + (dd ? '<br><i class="pg-k b"></i>' + esc(t('bd')) + ': ' + fd(dd[1]) + (dd[3] ? ' (' + esc(dd[3]) + ')' : '') + (dd[2] ? ' #' + dd[2] : '') : '');
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
      const tb = el('Table');
      if(tb) tb.innerHTML = v.dots.length ? '<details><summary>' + esc(t('table')) + '</summary><table><thead><tr><th>' + esc(t('when')) + '</th><th>' + esc(t('bd')) + '</th><th>' + esc(t('blk')) + '</th></tr></thead><tbody>' +
        v.dots.slice().sort((a, b) => b[1] - a[1]).map(d => '<tr><td>' + esc(fmtTime(d[0])) + '</td><td>' + esc(fd(d[1])) + '</td><td>' + esc(d[3] || '') + (d[2] ? ' #' + d[2] : '') + '</td></tr>').join('') + '</tbody></table></details>' : '';
    }

    function updateBar(){
      const bar = el('Bar'); if(!bar) return;
      bar.innerHTML = '<button type="button" class="pg-btn on" data-p="' + S.period + '">' + S.period + '</button>' +
        (S.zoom ? '<button type="button" class="pg-btn pg-reset" data-p="reset">' + esc(t('reset')) + '</button>' : '');
      const tt = el('Title'); if(tt) tt.textContent = '↗ ' + t('title');
      const lg = el('Legend'); if(lg) lg.innerHTML = '<span><i class="pg-k a"></i>' + esc(t('hr')) + '</span><span><i class="pg-k b"></i>' + esc(t('bd')) + '</span>';
      const h = el('Hint'); if(h) h.textContent = t('hint');
    }

    function build(){
      if(document.getElementById(P.id)) return;
      const anchor = document.getElementById('gpAccount'); if(!anchor || !anchor.parentNode) return;
      const box = document.createElement('div'); box.id = P.id; box.className = 'pg-card'; box.style.display = 'none';
      box.innerHTML = '<div class="pg-head"><b id="' + P.id + 'Title"></b><div class="pg-bar" id="' + P.id + 'Bar"></div></div><div id="' + P.id + 'Body"></div><div class="pg-legend" id="' + P.id + 'Legend"></div><div id="' + P.id + 'Table" class="pg-table"></div><div class="pg-hint" id="' + P.id + 'Hint"></div>';
      anchor.parentNode.insertBefore(box, anchor.nextSibling);
      box.querySelector('#' + P.id + 'Bar').addEventListener('click', e => {
        const b = e.target.closest('[data-p]'); if(b && b.dataset.p === 'reset'){ S.zoom = null; draw(); updateBar(); }
      });
      updateBar();
      if(window.ResizeObserver) new ResizeObserver(() => { const w = el('Body'); if(w && Math.abs(w.clientWidth - S.w) > 8 && S.w){ S.w = w.clientWidth; draw(); } else if(w && !S.w) S.w = w.clientWidth; }).observe(box);
    }

    const onPool = () => { try { return GP_STATE.current === P.pool; } catch(e) { return false; } };
    function show(){ build(); const b = document.getElementById(P.id); if(!b) return; b.style.display = onPool() ? '' : 'none'; if(!onPool()) return; updateBar(); load(false); }
    // arranca quando a aba Pools carrega os dados e sempre que o endereço é guardado
    if(typeof gpFetch === 'function'){ const o = gpFetch; window.gpFetch = function(first){ const r = o.apply(this, arguments); try { show(); } catch(e) {} return r; }; }
    setInterval(() => { const b = document.getElementById(P.id); if(b && b.offsetParent && !document.hidden){ b.style.display = onPool() ? '' : 'none'; if(onPool()) load(false); } }, 60000);
    return { load, state: () => S, draw };
  }

  window.hcMoleChart = makeChart({ pool: 'molepool-btc1', id: 'moleChart', name: 'Molepool', period: '12h', hk: 'hc_mg_hist_', src: 'mole' });
  window.hcDsChart = makeChart({ pool: 'defisurfers', id: 'dsChart', name: 'DeFi Surfers', period: '24h', hk: 'hc_ds_hist_', src: 'ds' });
})();
