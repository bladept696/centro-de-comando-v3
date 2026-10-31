// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Apoiantes em 3D: cartões que inclinam com o rato, reflexo de luz e partículas (estilos em apoiantes-3d.css) ----------
// Não mexe no HTML dos cartões: só acrescenta a sombra no chão e as partículas, e atualiza variáveis CSS ao mover o rato.
(function(){
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = window.matchMedia && matchMedia('(hover: none)').matches;
  const COLORS = ['#21ffb0', '#4fd6ff', '#b06bff', '#ffb547'];

  function sparks(box){
    if(reduce || box.querySelector('.ap3-sparks')) return;
    const wrap = document.createElement('div'); wrap.className = 'ap3-sparks'; wrap.setAttribute('aria-hidden', 'true');
    for(let i = 0; i < 26; i++){
      const s = document.createElement('i');
      s.style.left = (Math.random() * 100).toFixed(1) + '%';
      s.style.setProperty('--s', (2 + Math.random() * 4).toFixed(1) + 'px');
      s.style.setProperty('--c', COLORS[i % COLORS.length]);
      s.style.setProperty('--d', (7 + Math.random() * 8).toFixed(1) + 's');
      s.style.setProperty('--w', (-Math.random() * 12).toFixed(1) + 's');
      s.style.setProperty('--x', ((Math.random() - .5) * 120).toFixed(0) + 'px');
      wrap.appendChild(s);
    }
    box.prepend(wrap);
  }

  function tilt(card){
    if(card.dataset.ap3) return; card.dataset.ap3 = '1';
    if(!card.querySelector('.ap3-shadow')){ const sh = document.createElement('span'); sh.className = 'ap3-shadow'; sh.setAttribute('aria-hidden', 'true'); card.appendChild(sh); }
    if(reduce || touch) return;
    let raf = 0;
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        card.classList.add('ap3-on');
        card.style.setProperty('--ry', ((px - .5) * 22).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((.5 - py) * 18).toFixed(2) + 'deg');
        card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      card.classList.remove('ap3-on');
      card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg');
    });
  }

  function init(){
    const tab = document.getElementById('tab-supporters'); if(!tab) return;
    const box = tab.querySelector('.supporters-container'); if(box) sparks(box);
    tab.querySelectorAll('.channel-card').forEach(tilt);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
