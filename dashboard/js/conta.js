// ---------- Conta no cabeçalho ----------
// O email, "A minha conta", "Terminar sessão", "Eliminar conta" e o selo "online · registados" estavam como dois
// selos fixos no canto do ecrã, por cima do conteúdo. Agora é um avatar no cabeçalho que abre um menu.
(function(){
  const g = id => document.getElementById(id);
  const tg = g('acctToggle'), menu = g('acctMenu'), mail = g('authUserEmail');
  if(!tg || !menu || !mail) return;
  const hue = s => { let h = 0; for(const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  function sync(){
    const e = (mail.textContent || '').trim();
    g('acctInitial').textContent = e ? e[0].toUpperCase() : '?';
    tg.style.setProperty('--ah', hue(e));
    tg.title = e;
    g('acctOnline').textContent = (g('ucOnline').textContent || '0').trim();
  }
  const obs = new MutationObserver(sync);
  obs.observe(mail, { childList: true, characterData: true, subtree: true });
  obs.observe(g('ucOnline'), { childList: true, characterData: true, subtree: true });
  sync();
  const set = open => { menu.hidden = !open; tg.setAttribute('aria-expanded', open ? 'true' : 'false'); };
  tg.addEventListener('click', e => { e.stopPropagation(); set(menu.hidden); });
  menu.addEventListener('click', e => { if(e.target.closest('button')) set(false); });   // os botões de dentro continuam a fazer o que faziam
  document.addEventListener('click', e => { if(!menu.hidden && !g('authUserPill').contains(e.target)) set(false); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && !menu.hidden){ set(false); tg.focus(); } });
})();
