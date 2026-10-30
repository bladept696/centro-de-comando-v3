// ---------- Aviso quando encontras um bloco na Molepool BTC1 ----------
// Corre em segundo plano enquanto o painel estiver aberto (não precisa de estar na aba Pools). Lê os blocos da API pública da Molepool
// e avisa quando o vencedor é o endereço guardado na aba Pools. Os blocos já vistos ficam guardados: na primeira vez só se regista o estado atual, sem avisar de blocos antigos.
(function(){
  const KEY = 'hc_mp_seen', EVERY = 60e3, POOL = 'molepool-btc1', BASE = 'https://btc1.molepool.com', LANGS = ['pt', 'en', 'es', 'fr'];
  const TX = {
    mine: ['Bloco encontrado na Molepool BTC1: é teu! 🎉', 'Block found on Molepool BTC1: it is yours! 🎉', 'Bloque encontrado en Molepool BTC1: ¡es tuyo! 🎉', 'Bloc trouvé sur Molepool BTC1 : c’est le vôtre ! 🎉'],
    height: ['altura', 'height', 'altura', 'hauteur'], share: ['melhor share', 'best share', 'mejor share', 'meilleur share'], reward: ['recompensa', 'reward', 'recompensa', 'récompense']
  };
  const lang = () => { try { const l = typeof currentLang !== 'undefined' ? currentLang : 'pt'; return LANGS.includes(l) ? l : 'pt'; } catch(e) { return 'pt'; } };
  const t = k => TX[k][LANGS.indexOf(lang())];
  const fd = n => { try { const f = formatDiff(n); return f.value + f.unit; } catch(e) { return String(Math.round(n)); } };
  const myAddr = () => { try { return (gpLoadAddr(POOL) || '').trim().toLowerCase(); } catch(e) { return ''; } };

  let seen = null;   // null = ainda nunca registámos o estado da pool
  try { const a = JSON.parse(localStorage.getItem(KEY) || 'null'); if(Array.isArray(a)) seen = new Set(a); } catch(e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...seen].slice(-100))); } catch(e) {} };

  let busy = false;
  async function check(){
    if(busy || typeof addNotification !== 'function') return;
    busy = true;
    try {
      const j = await (await fetch(BASE + '/api/v1/blocks')).json();
      const res = (j && j.result) || {}, blocks = [...(res.candidate || []), ...(res.blocks || [])].filter(b => b && b.hash); if(!blocks.length) return;
      const first = seen === null; if(first) seen = new Set();
      const fresh = blocks.filter(b => !seen.has(b.hash)).sort((a, b) => a.height - b.height);
      fresh.forEach(b => seen.add(b.hash)); save();
      if(first || !fresh.length) return;
      const me = myAddr(); if(!me) return;
      fresh.filter(b => String(b.miner).toLowerCase() === me).forEach(b => {
        const parts = [t('height') + ' ' + b.height];
        if(b.shareDiff) parts.push(t('share') + ' ' + fd(b.shareDiff));
        if(b.reward) parts.push(t('reward') + ' ' + Number(b.reward).toFixed(4) + ' BTC1');
        addNotification('block', t('mine'), parts.join(' · '), 'Molepool BTC1', { diff: b.shareDiff });
      });
    } catch(e) { /* sem ligação: tenta no próximo ciclo */ }
    finally { busy = false; }
  }
  setTimeout(check, 9000);
  setInterval(() => { if(!document.hidden) check(); }, EVERY);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) check(); });
  window.hcMoleBlocks = { check, seen: () => seen, reset(){ seen = null; try { localStorage.removeItem(KEY); } catch(e) {} } };   // diagnóstico na consola
})();
