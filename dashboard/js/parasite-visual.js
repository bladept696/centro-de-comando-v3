// ---------- Parasite Pool: visual com a imagem da estação ----------
// Sempre ativo na aba Parasite: banner com a imagem, fundo suave nos cartões, estados vazios sobre a imagem e o aviso de bloco
// em ecrã inteiro (chamado por parasite-blocos.js quando a pool acha um bloco).
(function(){
  const IMG = '/dashboard/img/parasite-bg.jpg', LANGS = ['pt', 'en', 'es', 'fr'];
  const TX = {
    blk: ['BLOCO NA PARASITE POOL', 'BLOCK ON PARASITE POOL', 'BLOQUE EN PARASITE POOL', 'BLOC SUR PARASITE POOL'], mine: ['É TEU! 🎉', 'IT IS YOURS! 🎉', '¡ES TUYO! 🎉', 'C’EST LE VÔTRE ! 🎉'],
    height: ['Altura', 'Height', 'Altura', 'Hauteur'], reward: ['Recompensa', 'Reward', 'Recompensa', 'Récompense'], by: ['Achado por', 'Found by', 'Encontrado por', 'Trouvé par'],
    close: ['clica para fechar', 'click to close', 'clic para cerrar', 'cliquez pour fermer']
  };
  const lang = () => { try { const l = typeof currentLang !== 'undefined' ? currentLang : 'pt'; return LANGS.includes(l) ? l : 'pt'; } catch(e) { return 'pt'; } };
  const t = k => TX[k][LANGS.indexOf(lang())];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const short = a => a && a.length > 14 ? a.slice(0, 6) + '…' + a.slice(-4) : (a || '');

  // o visual está sempre ligado (apaga a escolha antiga dos botões que já não existem)
  try { localStorage.removeItem('hc_pv_on'); } catch(e) {}
  function apply(){
    const tb = document.getElementById('tab-parasite'); if(!tb) return;
    tb.classList.add('pv-on');
    tb.style.setProperty('--pv-img', 'url("' + IMG + '")');
  }
  apply(); setTimeout(apply, 1200);

  // ---- aviso de bloco em ecrã inteiro ----
  let flashTimer = null;
  function closeFlash(){ const n = document.getElementById('pvFlash'); if(n){ n.classList.add('out'); setTimeout(() => n.remove(), 400); } if(flashTimer){ clearTimeout(flashTimer); flashTimer = null; } }
  function flash(b){
    closeFlash();
    const ov = document.createElement('div'); ov.id = 'pvFlash'; ov.className = 'pvx-flash' + (b.mine ? ' mine' : '');
    ov.setAttribute('role', 'alert');
    ov.style.setProperty('--pv-img', 'url("' + IMG + '")');
    const rows = [t('height') + ' ' + b.height];
    if(b.reward_sats) rows.push(t('reward') + ' ' + (b.reward_sats / 1e8).toFixed(4) + ' BTC');
    if(b.winner) rows.push(t('by') + ' ' + short(b.winner));
    ov.innerHTML = '<div class="pvx-flash-in"><div class="pvx-flash-ic">🧱</div><h2>' + esc(t('blk')) + '</h2>' + (b.mine ? '<h3>' + esc(t('mine')) + '</h3>' : '') + '<p>' + esc(rows.join(' · ')) + '</p><small>' + esc(t('close')) + '</small></div>';
    ov.addEventListener('click', closeFlash);
    document.body.appendChild(ov);
    flashTimer = setTimeout(closeFlash, b.mine ? 12000 : 7000);
  }
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeFlash(); });

  // flash() também serve para testar na consola: hcParasiteVisual.flash({ height: 1, mine: false, reward_sats: 313e6, winner: 'bc1q…' })
  window.hcParasiteVisual = { flash, isOn: () => true };
})();
