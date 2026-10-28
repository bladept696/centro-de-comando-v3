// ---------- Estilo visual dos blocos da mempool ----------
// Cinco estilos, escolhidos no botão 🎨 da barra dos blocos: Módulo 3D (módulo técnico escuro em 3D), Holograma (vidro luminoso 3D), Reator (mostradores circulares), Módulo (HUD plano) e Clássico (o original).
// A escolha fica guardada neste navegador.
(function(){
  const KEY = 'hc_mp_style', ST = ['mod3d', 'holo', 'dial', 'hud', 'classic'], LANGS = ['pt', 'en', 'es', 'fr'];
  const NAMES = { mod3d: ['Módulo 3D', 'Module 3D', 'Módulo 3D', 'Module 3D'], holo: ['Holograma', 'Hologram', 'Holograma', 'Hologramme'], dial: ['Reator', 'Reactor', 'Reactor', 'Réacteur'], hud: ['Módulo', 'Module', 'Módulo', 'Module'], classic: ['Clássico', 'Classic', 'Clásico', 'Classique'] };
  const TIP = ['Mudar o estilo dos blocos', 'Change block style', 'Cambiar el estilo de los bloques', 'Changer le style des blocs'];
  const lang = () => { try { const l = typeof currentLang !== 'undefined' ? currentLang : 'pt'; return LANGS.includes(l) ? l : 'pt'; } catch(e) { return 'pt'; } };
  let cur = 'mod3d';
  try { const v = localStorage.getItem(KEY); if(ST.includes(v)) cur = v; } catch(e) {}

  function apply(){
    document.body.classList.remove('mp-holo', 'mp-mod3d', 'mp-dial', 'mp-hud');
    if(cur === 'mod3d') document.body.classList.add('mp-holo', 'mp-mod3d');   // usa a geometria do Holograma com as cores escuras por cima
    else if(cur === 'holo') document.body.classList.add('mp-holo');
    else if(cur === 'dial') document.body.classList.add('mp-dial');
    else if(cur === 'hud') document.body.classList.add('mp-hud');
    const b = document.getElementById('mpStyleBtn');
    if(b){ b.textContent = '🎨 ' + NAMES[cur][LANGS.indexOf(lang())]; b.title = TIP[LANGS.indexOf(lang())]; }
  }
  document.addEventListener('click', e => {
    if(!e.target.closest('#mpStyleBtn')) return;
    cur = ST[(ST.indexOf(cur) + 1) % ST.length];
    try { localStorage.setItem(KEY, cur); } catch(x) {}
    apply();
  });
  apply();
  setInterval(() => { const b = document.getElementById('mpStyleBtn'); if(b && !b.textContent.includes(NAMES[cur][LANGS.indexOf(lang())])) apply(); }, 2000);   // acompanha a mudança de idioma
})();
