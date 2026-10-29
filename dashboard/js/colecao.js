// ---------- Modo coleção: a vitrine de troféus do best diff ----------
// Guarda, para cada máquina, o melhor diff de sempre com a data, a pool e o modelo, mais o historial de recordes.
// Cada recorde ganha uma medalha pela dificuldade (bronze → lendário) e mostra que fração da dificuldade da rede representa.
// Usa o mesmo tracker que o Best Diff ao vivo (bdTrack) e arranca com os recordes que o painel já tinha guardado.
(function(){
  const KEY = 'hc_colecao', LANGS = ['pt', 'en', 'es', 'fr'], MAXHIST = 40;
  const TIERS = [
    { min: 1e12, ic: '🌌', k: 't_leg' }, { min: 1e11, ic: '👑', k: 't_crown' }, { min: 1e10, ic: '💎', k: 't_dia' },
    { min: 1e9, ic: '🥇', k: 't_gold' }, { min: 1e8, ic: '🥈', k: 't_silver' }, { min: 1e6, ic: '🥉', k: 't_bronze' }, { min: 0, ic: '🔹', k: 't_start' }
  ];
  const TX = {
    menu: ['Coleção de troféus', 'Trophy collection', 'Colección de trofeos', 'Collection de trophées'],
    intro: ['Cada recorde de best diff das tuas máquinas fica guardado aqui, com a data e a pool. Quanto maior o diff, melhor a medalha.',
      'Every best diff record from your machines is kept here, with the date and pool. The higher the diff, the better the medal.',
      'Cada récord de best diff de tus máquinas queda guardado aquí, con la fecha y el pool. Cuanto mayor el diff, mejor la medalla.',
      'Chaque record de best diff de vos machines est conservé ici, avec la date et le pool. Plus le diff est grand, meilleure est la médaille.'],
    none: ['Ainda sem recordes guardados. Deixa as máquinas a minerar: o painel regista cada novo best diff.', 'No records saved yet. Leave the machines mining: the panel records every new best diff.', 'Aún no hay récords guardados. Deja las máquinas minando: el panel registra cada nuevo best diff.', 'Aucun record enregistré. Laissez les machines miner : le tableau de bord note chaque nouveau best diff.'],
    t_leg: ['Lendário', 'Legendary', 'Legendario', 'Légendaire'], t_crown: ['Rei', 'King', 'Rey', 'Roi'], t_dia: ['Diamante', 'Diamond', 'Diamante', 'Diamant'],
    t_gold: ['Ouro', 'Gold', 'Oro', 'Or'], t_silver: ['Prata', 'Silver', 'Plata', 'Argent'], t_bronze: ['Bronze', 'Bronze', 'Bronce', 'Bronze'], t_start: ['Início', 'Starter', 'Inicio', 'Début'],
    best: ['Melhor de sempre', 'All-time best', 'Mejor de siempre', 'Meilleur de tous les temps'],
    on: ['em', 'on', 'el', 'le'],
    seen: ['visto pela 1.ª vez em', 'first seen on', 'visto por 1.ª vez el', 'vu pour la 1re fois le'],
    pool: ['Pool', 'Pool', 'Pool', 'Pool'],
    net: ['da dificuldade da rede', 'of network difficulty', 'de la dificultad de la red', 'de la difficulté du réseau'],
    far: ['Faltou ~{0}× para um bloco', 'Needed ~{0}× more for a block', 'Faltó ~{0}× para un bloque', 'Il manquait ~{0}× pour un bloc'],
    hist: ['Historial de recordes', 'Record history', 'Historial de récords', 'Historique des records'],
    hall: ['Sala da fama', 'Hall of fame', 'Sala de la fama', 'Panthéon'],
    count: ['{0} recorde(s)', '{0} record(s)', '{0} récord(s)', '{0} record(s)'],
    exp: ['Exportar', 'Export', 'Exportar', 'Exporter'], close: ['Fechar', 'Close', 'Cerrar', 'Fermer'],
    toast: ['🏆 Novo recorde de {0}: {1} ({2})', '🏆 New record for {0}: {1} ({2})', '🏆 Nuevo récord de {0}: {1} ({2})', '🏆 Nouveau record de {0} : {1} ({2})']
  };
  const lang = () => { try { const l = typeof currentLang !== 'undefined' ? currentLang : 'pt'; return LANGS.includes(l) ? l : 'pt'; } catch(e) { return 'pt'; } };
  const li = () => LANGS.indexOf(lang());
  const t = (k, ...a) => { let s = TX[k][li()]; a.forEach((v, i) => { s = s.split('{' + i + '}').join(v); }); return s; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
  const fd = n => { if(!(n > 0)) return '—'; try { const f = formatDiff(n); return f.value + f.unit; } catch(e) { return String(Math.round(n)); } };
  const tier = d => TIERS.find(x => d >= x.min) || TIERS[TIERS.length - 1];
  const fmtDate = ts => { try { return new Date(ts).toLocaleDateString(lang() === 'pt' ? 'pt-PT' : lang(), { day: '2-digit', month: 'short', year: 'numeric' }); } catch(e) { return ''; } };

  let S = { v: 1, tr: {} };
  try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if(o && o.tr) S = o; } catch(e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e) {} };

  // dificuldade da rede (para a percentagem): vem da mempool.space, uma vez por hora
  let netDiff = 0, netAt = 0;
  async function loadNet(){
    if(netDiff && Date.now() - netAt < 3600e3) return;
    netAt = Date.now();
    try {
      const r = await fetch('https://mempool.space/api/v1/mining/hashrate/3d'); const j = await r.json();
      if(j && Number(j.currentDifficulty) > 0) netDiff = Number(j.currentDifficulty);
    } catch(e) {}
  }

  function entry(dev){
    return S.tr[dev.id] = S.tr[dev.id] || { name: dev.name, model: '', pool: '', best: 0, t: 0, first: false, hist: [] };
  }
  function poolOf(dev){
    let r = null; try { r = readings[dev.id]; } catch(e) {}
    let p = r && (r.pool || (r.poolInfo && r.poolInfo.primary && r.poolInfo.primary.url)) || '';
    return String(p).replace(/^[a-z+]+:\/\//i, '').replace(/\/.*$/, '').slice(0, 60);
  }
  function modelOf(dev){ let r = null; try { r = readings[dev.id]; } catch(e) {} return r ? String(r.model || r.deviceModel || r.asicModel || '').slice(0, 40) : ''; }

  function note(dev, v, first){
    const e = entry(dev);
    e.name = dev.name; e.model = modelOf(dev) || e.model; e.pool = poolOf(dev) || e.pool;
    if(!(v > e.best)) return;
    const prev = e.best; e.best = v; e.t = Date.now(); e.first = !!first;
    e.hist.push({ t: e.t, d: v, p: e.pool, f: first ? 1 : 0 });
    if(e.hist.length > MAXHIST) e.hist.splice(0, e.hist.length - MAXHIST);
    save();
    if(!first && prev > 0){
      try { if(typeof addNotification === 'function') addNotification('record', t('toast', dev.name, fd(v), t(tier(v).k)), ''); } catch(e2) {}
    }
  }

  // acompanha o tracker do Best Diff ao vivo
  function hook(){
    if(typeof window.bdTrack !== 'function' || window.bdTrack.__col) return false;
    const orig = window.bdTrack;
    window.bdTrack = function(dev, d){
      try { orig.apply(this, arguments); } finally {
        try { if(dev && d){ const v = Math.max(num(d.bestDiff), num(d.bestSessionDiff)); if(v > 0) note(dev, v, !S.tr[dev.id] || !S.tr[dev.id].best); } } catch(e) {}
      }
    };
    window.bdTrack.__col = true; return true;
  }
  hook();
  setTimeout(hook, 1500);

  // recordes antigos que o painel já guardava (por nome de máquina)
  (function seed(){
    try {
      const old = JSON.parse(localStorage.getItem('hc_bd_records') || '[]'); if(!Array.isArray(old)) return;
      const byName = {}; Object.keys(S.tr).forEach(id => { byName[S.tr[id].name] = id; });
      let changed = false;
      old.forEach(i => {
        const d = num(i && i.diff); if(!(d > 0) || !i.machine) return;
        const id = byName[i.machine] || ('old:' + i.machine);
        const e = S.tr[id] = S.tr[id] || { name: i.machine, model: '', pool: '', best: 0, t: 0, first: false, hist: [] };
        byName[i.machine] = id;
        if(e.hist.some(h => h.t === i.ts)) return;
        e.hist.push({ t: Number(i.ts) || Date.now(), d, p: '', f: 0 });
        if(d > e.best){ e.best = d; e.t = Number(i.ts) || e.t; }
        changed = true;
      });
      Object.values(S.tr).forEach(e => e.hist.sort((a, b) => a.t - b.t));
      if(changed) save();
    } catch(e) {}
  })();

  // ---- vitrine ----
  function trophy(e, rank){
    const T = tier(e.best), pct = netDiff > 0 ? e.best / netDiff * 100 : 0;
    const hist = e.hist.slice().reverse().slice(0, 6).map(h => '<li><b>' + fd(h.d) + '</b><span>' + fmtDate(h.t) + (h.p ? ' · ' + esc(h.p) : '') + '</span></li>').join('');
    return '<div class="hc-co-card tier-' + T.k + '">' +
      '<div class="hc-co-medal">' + T.ic + (rank != null ? '<em>' + rank + '</em>' : '') + '</div>' +
      '<div class="hc-co-main"><div class="hc-co-name">' + esc(e.name) + (e.model ? ' <small>' + esc(e.model) + '</small>' : '') + '</div>' +
      '<div class="hc-co-val">' + fd(e.best) + '</div>' +
      '<div class="hc-co-sub">' + t(T.k) + ' · ' + (e.first ? t('seen') : t('on')) + ' ' + fmtDate(e.t) + (e.pool ? ' · ' + t('pool') + ' ' + esc(e.pool) : '') + '</div>' +
      (pct > 0 ? '<div class="hc-co-net"><span style="width:' + Math.min(100, Math.max(0.6, Math.log10(pct * 1e6) / 8 * 100)).toFixed(1) + '%"></span></div><div class="hc-co-sub">' + (pct >= 0.01 ? pct.toFixed(2) : pct.toFixed(Math.min(8, 1 - Math.floor(Math.log10(pct))))) + '% ' + t('net') + ' · ' + t('far', Math.max(1, Math.round(netDiff / e.best)).toLocaleString()) + '</div>' : '') +
      (hist ? '<details class="hc-co-h"><summary>' + t('hist') + ' (' + e.hist.length + ')</summary><ul>' + hist + '</ul></details>' : '') + '</div></div>';
  }
  function body(){
    const list = Object.values(S.tr).filter(e => e.best > 0).sort((a, b) => b.best - a.best);
    if(!list.length) return '<p class="hc-ch-intro">' + t('intro') + '</p><p class="hc-ch-none">' + t('none') + '</p>';
    const top = list[0], T = tier(top.best);
    return '<p class="hc-ch-intro">' + t('intro') + '</p>' +
      '<div class="hc-co-hall"><span>' + T.ic + ' ' + t('hall') + '</span><b>' + fd(top.best) + '</b><small>' + esc(top.name) + ' · ' + t('count', top.hist.length) + '</small></div>' +
      list.map((e, i) => trophy(e, i + 1)).join('');
  }
  function exportJson(){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'hash-commander-colecao', date: new Date().toISOString(), trophies: S.tr }, null, 2)], { type: 'application/json' }));
    a.download = 'colecao-best-diff-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function close(){ const n = document.getElementById('hcCoModal'); if(n) n.remove(); }
  window.hcCollectionOpen = function(){
    close(); loadNet().then(() => { const b = document.getElementById('hcCoBody'); if(b) b.innerHTML = body(); });
    const ov = document.createElement('div');
    ov.id = 'hcCoModal'; ov.className = 'hc-ch-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="hc-ch-box hc-co-box"><h2>🏆 ' + t('menu') + '</h2><div id="hcCoBody">' + body() + '</div>' +
      '<div class="hc-ch-act"><button type="button" class="hc-co-sec" data-a="e">' + t('exp') + '</button><button type="button" class="hc-ch-btn" data-a="x">' + t('close') + '</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if(e.target === ov || e.target.closest('[data-a="x"]')) close(); else if(e.target.closest('[data-a="e"]')) exportJson(); });
    document.addEventListener('keydown', function k(e){ if(e.key === 'Escape'){ close(); document.removeEventListener('keydown', k); } });
  };
  window.hcCollectionLabel = () => '🏆 ' + t('menu');
  window.hcColecao = { state: () => S, note, tier, reset(){ S = { v: 1, tr: {} }; save(); } };   // diagnóstico na consola
})();
