// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Estilo visual dos blocos da mempool ----------
// Estilos escolhidos no botão 🎨 da barra dos blocos: Isométrico (cubos escuros vistos de cima com circuitos laranja), Sci-Fi (ecrã holográfico
// curvo com gráficos), Cósmico (cubos de vidro no espaço com filamentos de luz) — os três com cenário em mempool-cenas.js — e Clássico (o original).
// A escolha fica guardada neste navegador; quem tinha um estilo que já não existe passa para o Isométrico.
(function(){
  const KEY = 'hc_mp_style', ST = ['iso', 'scifi', 'cosmo', 'classic'], LANGS = ['pt', 'en', 'es', 'fr'];
  const NAMES = { iso: ['Isométrico', 'Isometric', 'Isométrico', 'Isométrique'], scifi: ['Sci-Fi', 'Sci-Fi', 'Sci-Fi', 'Sci-Fi'], cosmo: ['Cósmico', 'Cosmic', 'Cósmico', 'Cosmique'], classic: ['Clássico', 'Classic', 'Clásico', 'Classique'] };
  const TIP = ['Mudar o estilo dos blocos', 'Change block style', 'Cambiar el estilo de los bloques', 'Changer le style des blocs'];
  const lang = () => { try { const l = typeof currentLang !== 'undefined' ? currentLang : 'pt'; return LANGS.includes(l) ? l : 'pt'; } catch(e) { return 'pt'; } };
  let cur = 'iso';
  try {
    // o Isométrico passa a ser o estilo de origem uma vez, mesmo para quem já tinha escolhido outro; depois fica a escolha da pessoa
    if(!localStorage.getItem('hc_mp_style_iso')){ localStorage.setItem('hc_mp_style_iso', '1'); localStorage.setItem(KEY, 'iso'); }
    const v = localStorage.getItem(KEY); if(ST.includes(v)) cur = v;
  } catch(e) {}

  function apply(){
    document.body.classList.remove('mp-holo', 'mp-iso', 'mp-scifi', 'mp-cosmo');
    if(cur === 'iso') document.body.classList.add('mp-holo', 'mp-iso');        // geometria 3D dos cubos (mempool-holo.css), vista de cima
    else if(cur === 'cosmo') document.body.classList.add('mp-holo', 'mp-cosmo');
    else if(cur === 'scifi') document.body.classList.add('mp-scifi');           // cartões planos num ecrã holográfico
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
