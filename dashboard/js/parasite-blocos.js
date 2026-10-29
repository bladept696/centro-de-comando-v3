// ---------- Aviso quando a Parasite Pool acha um bloco ----------
// Avisa de qualquer bloco achado na pool, não só dos teus. Corre em segundo plano enquanto o painel estiver aberto
// (não precisa de estar na aba Parasite). Se o vencedor for o endereço guardado na aba Parasite, o aviso é de "bloco teu".
// Os blocos já vistos ficam guardados: na primeira vez só se regista o estado atual, sem avisar de blocos antigos.
(function(){
  const KEY = 'hc_pp_seen', EVERY = 90e3, LANGS = ['pt', 'en', 'es', 'fr'];
  const TX = {
    other: ['Bloco na Parasite Pool', 'Block on Parasite Pool', 'Bloque en Parasite Pool', 'Bloc sur Parasite Pool'],
    mine: ['Bloco encontrado na Parasite Pool: é teu! 🎉', 'Block found on Parasite Pool: it is yours! 🎉', 'Bloque encontrado en Parasite Pool: ¡es tuyo! 🎉', 'Bloc trouvé sur Parasite Pool : c’est le vôtre ! 🎉'],
    height: ['altura', 'height', 'altura', 'hauteur'], share: ['melhor share', 'best share', 'mejor share', 'meilleur share'], reward: ['recompensa', 'reward', 'recompensa', 'récompense'],
    winner: ['achado por', 'found by', 'encontrado por', 'trouvé par'],
    many: ['{0} novos blocos na Parasite Pool', '{0} new blocks on Parasite Pool', '{0} nuevos bloques en Parasite Pool', '{0} nouveaux blocs sur Parasite Pool']
  };
  const lang = () => { try { const l = typeof currentLang !== 'undefined' ? currentLang : 'pt'; return LANGS.includes(l) ? l : 'pt'; } catch(e) { return 'pt'; } };
  const t = (k, ...a) => { let s = TX[k][LANGS.indexOf(lang())]; a.forEach((v, i) => { s = s.split('{' + i + '}').join(v); }); return s; };
  const fd = n => { try { const f = formatDiff(n); return f.value + f.unit; } catch(e) { return String(Math.round(n)); } };
  const short = a => a && a.length > 14 ? a.slice(0, 6) + '…' + a.slice(-4) : (a || '—');
  const myAddr = () => { try { return (loadParasiteAddress() || '').trim().toLowerCase(); } catch(e) { return ''; } };

  let seen = null;   // null = ainda nunca registámos o estado da pool
  try { const a = JSON.parse(localStorage.getItem(KEY) || 'null'); if(Array.isArray(a)) seen = new Set(a); } catch(e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...seen].slice(-100))); } catch(e) {} };

  function describe(b){
    const parts = [t('height') + ' ' + b.height];
    if(b.diff) parts.push(t('share') + ' ' + fd(b.diff));
    if(b.reward_sats) parts.push(t('reward') + ' ' + (b.reward_sats / 1e8).toFixed(4) + ' BTC');
    if(b.winner) parts.push(t('winner') + ' ' + short(b.winner));
    return parts.join(' · ');
  }

  let busy = false;
  async function check(){
    if(busy || typeof addNotification !== 'function') return;
    busy = true;
    try {
      const r = await fetch(API_BASE + '/api/parasite-blocks'); const j = await r.json();
      const blocks = (j && j.blocks) || []; if(!blocks.length) return;
      const first = seen === null; if(first) seen = new Set();
      const fresh = blocks.filter(b => !seen.has(b.hash)).sort((a, b) => a.height - b.height);
      fresh.forEach(b => seen.add(b.hash)); save();
      if(first || !fresh.length) return;
      const me = myAddr(), mine = fresh.filter(b => me && String(b.winner).toLowerCase() === me), others = fresh.filter(b => !mine.includes(b));
      // aviso em ecrã inteiro (só do bloco mais recente; desligado se o "Visual" da aba Parasite estiver desligado)
      try { const last = fresh[fresh.length - 1]; if(window.hcParasiteVisual) hcParasiteVisual.flash({ height: last.height, mine: mine.includes(last), diff: last.diff, reward_sats: last.reward_sats, winner: last.winner }); } catch(e) {}
      mine.forEach(b => addNotification('block', t('mine'), describe(b), 'Parasite Pool', { diff: b.diff }));
      if(others.length > 3) addNotification('best', '🧱 ' + t('many', others.length), describe(others[others.length - 1]), 'Parasite Pool');
      else others.forEach(b => addNotification('best', '🧱 ' + t('other'), describe(b), 'Parasite Pool', { diff: b.diff }));
    } catch(e) { /* sem ligação ao servidor local: tenta no próximo ciclo */ }
    finally { busy = false; }
  }
  setTimeout(check, 8000);
  setInterval(() => { if(!document.hidden) check(); }, EVERY);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) check(); });
  window.hcParasiteBlocks = { check, seen: () => seen, reset(){ seen = null; try { localStorage.removeItem(KEY); } catch(e) {} } };   // diagnóstico na consola
})();
