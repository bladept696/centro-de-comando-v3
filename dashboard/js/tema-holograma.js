// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Tema "Holograma": acrescenta a opção ao seletor de temas (os estilos estão em tema-holograma.css) ----------
Object.assign(I18N_DICT, {
  tema_holo: { pt: `🔷 Holograma`, en: `🔷 Hologram`, es: `🔷 Holograma`, fr: `🔷 Hologramme` },
});
(function(){
  function add(){
    const sel = document.getElementById('themeSelect');
    if(!sel || sel.querySelector('option[value="holo"]')) return;
    const o = document.createElement('option');
    o.value = 'holo'; o.setAttribute('data-i18n', 'tema_holo'); o.textContent = typeof t === 'function' ? t('tema_holo') : '🔷 Holograma';
    sel.insertBefore(o, sel.children[1] || null);
    // se o tema guardado for este, o seletor só o mostra depois de a opção existir
    if(document.body.dataset.theme === 'holo') sel.value = 'holo';
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
