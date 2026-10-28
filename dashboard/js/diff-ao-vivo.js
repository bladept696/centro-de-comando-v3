// ---------- Best Diff ao vivo, versão completa ----------
// Antes o painel só registava os recordes. Agora acompanha tudo o que cada máquina faz: as shares aceites (com a
// dificuldade da pool), as rejeitadas, o melhor da sessão e o melhor de sempre, e o ritmo de shares por minuto.
// As máquinas não enviam a dificuldade de cada share, por isso cada poll compara os contadores (shares aceites,
// rejeitadas, best diff) com o poll anterior e regista a diferença.
(function(){
  const DX = {
    m: {},            // devId -> estado da máquina
    ev: [],           // eventos de shares (aceites / rejeitadas)
    kind: 'all',      // all | rec | share | rej
    max: 400,
  };
  window.bdxState = DX;
  const TX = {
    title:{pt:'Best Diff ao Vivo',en:'Live Best Diff',es:'Best Diff en Vivo',fr:'Best Diff en Direct'},
    best:{pt:'Melhor da sessão',en:'Session best',es:'Mejor de la sesión',fr:'Meilleur de la session'},
    all:{pt:'Melhor de sempre',en:'All-time best',es:'Mejor de siempre',fr:'Meilleur de tous les temps'},
    rate:{pt:'Shares / min',en:'Shares / min',es:'Shares / min',fr:'Shares / min'},
    acc:{pt:'Aceitação',en:'Acceptance',es:'Aceptación',fr:'Acceptation'},
    k_all:{pt:'Tudo',en:'All',es:'Todo',fr:'Tout'},
    k_rec:{pt:'Recordes',en:'Records',es:'Récords',fr:'Records'},
    k_share:{pt:'Shares',en:'Shares',es:'Shares',fr:'Shares'},
    k_rej:{pt:'Rejeitadas',en:'Rejected',es:'Rechazadas',fr:'Rejetées'},
    pool:{pt:'diff da pool',en:'pool diff',es:'diff del pool',fr:'diff du pool'},
    sh:{pt:'shares aceites',en:'shares accepted',es:'shares aceptadas',fr:'shares acceptées'},
    shr:{pt:'shares rejeitadas',en:'shares rejected',es:'shares rechazadas',fr:'shares rejetées'},
    from:{pt:'de',en:'from',es:'de',fr:'de'},
    record:{pt:'Novo recorde',en:'New record',es:'Nuevo récord',fr:'Nouveau record'},
    empty:{pt:'A aguardar atividade das máquinas…',en:'Waiting for machine activity…',es:'Esperando actividad de las máquinas…',fr:'En attente d’activité des machines…'},
    work:{pt:'trabalho',en:'work',es:'trabajo',fr:'travail'},
    viewall:{pt:'Ver tudo',en:'View all',es:'Ver todo',fr:'Tout voir'},
  };
  const L = () => (typeof currentLang === 'string' && currentLang) || 'pt';
  const x = k => (TX[k] && (TX[k][L()] || TX[k].pt)) || k;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fd = n => { if(!(n > 0)) return '—'; const f = formatDiff(n); return f.value + f.unit; };
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };

  // ---------- recordes guardados ----------
  // Cada best diff novo de cada máquina fica na lista (com o valor anterior) e sobrevive a atualizar a página.
  const RK = 'hc_bd_records';
  const saveRecs = () => { try { localStorage.setItem(RK, JSON.stringify(bestDiffLive.feed.slice(-300))); } catch(e) {} };
  try {
    const old = JSON.parse(localStorage.getItem(RK) || '[]');
    if(Array.isArray(old) && !bestDiffLive.feed.length) bestDiffLive.feed.push(...old.filter(i => i && i.machine && i.diffText && i.ts));
  } catch(e) {}
  if(typeof window.recordBestDiffEvent === 'function'){
    const origRec = window.recordBestDiffEvent;
    window.recordBestDiffEvent = function(dev, cur, ts){
      const prev = (DX.m[dev.id] || {}).prevBest || (bestDiffLive.perMachine[dev.id] || {}).best || 0;
      origRec.apply(this, arguments);
      const last = bestDiffLive.feed[bestDiffLive.feed.length - 1];
      if(last && last.machineId === dev.id){ last.diff = cur; if(prev > 0 && prev < cur) last.prev = prev; saveRecs(); }
    };
  }

  // ---------- dados ----------
  window.bdTrack = function(dev, d){
    if(!dev || !d) return;
    const now = Date.now();
    const acc = num(d.sharesAccepted ?? d.accepted ?? d.shares_accepted);
    const rej = num(d.sharesRejected ?? d.rejected ?? d.shares_rejected);
    const pd = num(d.poolDifficulty ?? d.stratumDifficulty ?? d.pool_difficulty ?? d.difficulty);
    let s = DX.m[dev.id];
    if(!s) s = DX.m[dev.id] = { name: dev.name, pd: 0, acc: 0, rej: 0, series: [], base: false };
    s.name = dev.name;
    s.pd = pd || s.pd;
    const nb = num(d.bestSessionDiff);
    if(s.best && nb > s.best) s.prevBest = s.best;   // para mostrar "▲ de X" no recorde
    s.best = nb;
    s.bestAll = num(d.bestDiff);
    if(!s.best && !s.bestAll) s.best = num(d.bestSessionDiff ?? d.bestDiff);
    s.seen = now;
    if(s.base){
      const dA = acc - s.acc, dR = rej - s.rej;
      if(dA > 0 && dA < 100000) DX.ev.push({ k: 'share', id: dev.id, m: dev.name, n: dA, pd: s.pd, ts: now });
      if(dR > 0 && dR < 100000) DX.ev.push({ k: 'rej', id: dev.id, m: dev.name, n: dR, ts: now });
      if(DX.ev.length > DX.max) DX.ev.splice(0, DX.ev.length - DX.max);
      if(dA < 0 || dR < 0) s.series.length = 0;   // contadores a zero (a máquina reiniciou)
    }
    s.acc = acc; s.rej = rej; s.base = true;
    s.series.push({ t: now, a: acc });
    const cut = now - 5 * 60e3;
    while(s.series.length > 2 && s.series[0].t < cut) s.series.shift();
    if(bestDiffLive.panelOpen || bestDiffLive.fullModalOpen) bdxRender();
  };
  const rateOf = s => {
    const a = s.series; if(a.length < 2) return 0;
    const dt = (a[a.length - 1].t - a[0].t) / 60e3, da = a[a.length - 1].a - a[0].a;
    return dt > 0.2 && da >= 0 ? da / dt : 0;
  };
  const list = () => {
    const f = bestDiffLive.filterMachineId || 'all';
    return Object.entries(DX.m).filter(([id]) => f === 'all' || String(id) === String(f)).map(([id, s]) => Object.assign({ id }, s));
  };

  // ---------- visual ----------
  function bdxBuild(){
    const p = document.getElementById('bdPanel');
    if(!p || p.dataset.bdx) return;
    p.dataset.bdx = '1';
    p.classList.add('bdx');
    p.innerHTML = `
      <div class="bd-panel-header">
        <div class="bd-panel-title"><span class="bd-dot"></span><span id="bdxTitle"></span></div>
        <button class="bd-panel-close" onclick="toggleBestDiffPanel(false)" aria-label="Fechar">✕</button>
      </div>
      <div class="bdx-hero">
        <div class="bdx-k"><span id="bdxBestL"></span><b id="bdStatBest">—</b></div>
        <div class="bdx-k"><span id="bdxAllL"></span><b id="bdxAll">—</b></div>
        <div class="bdx-k"><span id="bdxRateL"></span><b id="bdxRate">—</b></div>
        <div class="bdx-k"><span id="bdxAccL"></span><b id="bdxAcc">—</b></div>
      </div>
      <div class="ls-filter-row">
        <select class="ls-filter-select" id="bdMachineFilter" onchange="onBestDiffFilterChange(this.value)"></select>
        <button class="ls-viewall-btn" id="bdxViewAll" onclick="openBestDiffFullModal()"></button>
      </div>
      <div class="bdx-chips" id="bdxChips"></div>
      <div class="bdx-body">
        <div class="bdx-ms" id="bdxMs"></div>
        <div class="bdx-feed" id="bdFeed"></div>
      </div>`;
    p.addEventListener('click', e => {
      const c = e.target.closest('[data-bdk]');
      if(c){ DX.kind = c.dataset.bdk; bdxRender(); }
    });
    const m = document.getElementById('bdFullModal');
    if(m) m.querySelector('.ls-full-card').classList.add('bdx-full');
  }

  const chipsHtml = () => ['all', 'rec', 'share', 'rej'].map(k => `<button type="button" class="${DX.kind === k ? 'on' : ''}" data-bdk="${k}">${x('k_' + k)}</button>`).join('');

  function machinesHtml(items){
    if(!items.length) return '';
    const maxBest = Math.max(1, ...items.map(s => Math.max(s.best || 0, s.bestAll || 0)));
    return items.map(s => {
      const tot = s.acc + s.rej, pct = tot ? s.acc / tot * 100 : 100;
      const w1 = Math.max(2, (s.best || 0) / maxBest * 100), w2 = Math.max(2, (s.bestAll || 0) / maxBest * 100);
      const stale = Date.now() - (s.seen || 0) > 30e3;
      return `<div class="bdx-m${stale ? ' off' : ''}">
        <div class="bdx-mh"><b>${esc(s.name)}</b><span class="bdx-pd">${x('pool')} <i>${fd(s.pd)}</i></span></div>
        <div class="bdx-bars"><div class="bdx-bar all" style="width:${w2}%"></div><div class="bdx-bar" style="width:${w1}%"></div></div>
        <div class="bdx-ms2">
          <span>🏆 <i>${fd(s.best)}</i></span>
          <span>👑 <i>${fd(s.bestAll)}</i></span>
          <span class="g">✓ ${s.acc.toLocaleString()}</span>
          <span class="${s.rej ? 'r' : ''}">✗ ${s.rej.toLocaleString()}</span>
          <span>${pct.toFixed(pct >= 99.95 ? 0 : 1)}%</span>
          <span>${rateOf(s).toFixed(1)}/min</span>
        </div>
      </div>`;
    }).join('');
  }

  function feedItems(){
    const f = bestDiffLive.filterMachineId || 'all';
    const ok = id => f === 'all' || String(id) === String(f);
    const out = [];
    if(DX.kind === 'all' || DX.kind === 'rec')
      bestDiffLive.feed.filter(i => ok(i.machineId)).forEach(i => out.push({ k: 'rec', m: i.machine, text: `${x('record')}: <b>${esc(i.diffText)}</b>${i.prev ? ` <i>▲ ${x('from')} ${fd(i.prev)}</i>` : ''}`, ts: i.ts }));
    DX.ev.filter(e => ok(e.id)).forEach(e => {
      if(e.k === 'share' && (DX.kind === 'all' || DX.kind === 'share'))
        out.push({ k: 'share', m: e.m, text: `+${e.n} shares <i>@ ${fd(e.pd)}</i>${e.pd ? ` ≈ <b>${fd(e.n * e.pd)}</b>` : ''}`, ts: e.ts });
      if(e.k === 'rej' && (DX.kind === 'all' || DX.kind === 'rej'))
        out.push({ k: 'rej', m: e.m, text: `+${e.n} ${x('k_rej').toLowerCase()}`, ts: e.ts });
    });
    return out.sort((a, b) => b.ts - a.ts);
  }
  const ICON = { rec: '🏆', share: '⛏', rej: '✗' };
  const feedHtml = items => !items.length ? `<div class="ls-feed-empty">${x('empty')}</div>` :
    items.map(i => `<div class="bdx-ev ${i.k}"><span class="ic">${ICON[i.k]}</span><span class="mn">${esc(i.m)}</span><span class="tx">${i.text}</span><span class="tm">${new Date(i.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></div>`).join('');

  // na vista "Tudo" os recordes ficam sempre no topo, para não se perderem no meio das shares
  const withRecs = (items, n, cap) => {
    if(DX.kind !== 'all') return items.slice(0, cap);
    const recs = items.filter(i => i.k === 'rec').slice(0, n);
    return recs.concat(items.filter(i => !recs.includes(i))).slice(0, cap);
  };

  function bdxRender(){
    if(!document.getElementById('bdPanel')) return;
    bdxBuild();
    const set = (id, v) => { const e = document.getElementById(id); if(e && e.textContent !== v) e.textContent = v; };
    set('bdxTitle', x('title')); set('bdxBestL', x('best')); set('bdxAllL', x('all')); set('bdxRateL', x('rate')); set('bdxAccL', x('acc')); set('bdxViewAll', x('viewall'));
    const items = list();
    const best = Math.max(0, ...items.map(s => s.best || 0)), all = Math.max(0, ...items.map(s => s.bestAll || 0));
    const acc = items.reduce((a, s) => a + s.acc, 0), rej = items.reduce((a, s) => a + s.rej, 0);
    set('bdStatBest', fd(best || bestDiffLive.globalBest));
    set('bdxAll', fd(all));
    set('bdxRate', items.reduce((a, s) => a + rateOf(s), 0).toFixed(1));
    set('bdxAcc', acc + rej ? (acc / (acc + rej) * 100).toFixed(acc / (acc + rej) > .9995 ? 0 : 1) + '%' : '—');
    const ch = chipsHtml();
    const chips = document.getElementById('bdxChips'); if(chips.innerHTML !== ch) chips.innerHTML = ch;
    const mh = machinesHtml(items);
    const ms = document.getElementById('bdxMs'); if(ms.innerHTML !== mh) ms.innerHTML = mh;
    const feed = feedItems();
    document.getElementById('bdFeed').innerHTML = feedHtml(withRecs(feed, 3, 5));
    const full = document.getElementById('bdFullList');
    if(full && bestDiffLive.fullModalOpen) full.innerHTML = `<div class="bdx-chips">${ch}</div><div class="bdx-ms">${mh}</div><div class="bdx-feed">${feedHtml(withRecs(feed, 20, 300))}</div>`;
  }
  // substitui as funções do painel antigo (04-widgets-shares.js)
  window.renderBestDiffPanel = bdxRender;
  window.renderBestDiffFullModal = bdxRender;
  document.addEventListener('click', e => {
    const c = e.target.closest('#bdFullList [data-bdk]');
    if(c){ DX.kind = c.dataset.bdk; bdxRender(); }
  });
  setInterval(() => { if(bestDiffLive.panelOpen || bestDiffLive.fullModalOpen) bdxRender(); }, 5000);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bdxBuild); else bdxBuild();
})();
