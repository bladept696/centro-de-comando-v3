// ---------- Cartões que viram ----------
// Cada cartão de máquina tem um botão ⟳ no cabeçalho: o cartão roda em 3D e mostra no verso os dados técnicos e o
// histórico, sem abrir um painel por cima nem mexer no tamanho da grelha. Clicar em "Frente" (ou no ⟳) volta a rodar.
(function(){
  const TX = {
    flip: { pt: 'Virar o cartão: detalhes e histórico', en: 'Flip the card: details and history', es: 'Girar la tarjeta: detalles e historial', fr: 'Retourner la carte : détails et historique' },
    back: { pt: '↩ Frente', en: '↩ Front', es: '↩ Frente', fr: '↩ Face' },
    tech: { pt: 'Dados técnicos', en: 'Technical data', es: 'Datos técnicos', fr: 'Données techniques' },
  };
  const tx = k => (TX[k][typeof currentLang === 'string' ? currentLang : 'pt'] || TX[k].pt);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // acrescenta o botão e o verso a um cartão (também aos que já existiam quando este ficheiro carregou)
  function deco(el){
    if(el.querySelector('.mc-back')) return;
    const head = el.querySelector('.mc-head'), model = el.querySelector('.mc-model');
    if(head){
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mc-flipbtn'; b.dataset.a = 'flip'; b.textContent = '⟳';
      b.title = tx('flip'); b.setAttribute('aria-label', tx('flip'));
      head.insertBefore(b, model || null);
    }
    const back = document.createElement('div');
    back.className = 'mc-back';
    back.innerHTML = '<div class="mc-back-top"><b data-f="bname"></b><span class="mc-back-hash" data-f="bhash"></span><button type="button" class="mc-backbtn" data-a="unflip"></button></div><div class="mc-back-body"></div>';
    el.appendChild(back);
  }

  function fill(el){
    const dev = el._dev; if(!dev || !el.classList.contains('is-flipped')) return;
    const r = el._r, back = el.querySelector('.mc-back');
    const set = (f, v) => { const n = back.querySelector('[data-f="' + f + '"]'); if(n && n.textContent !== v) n.textContent = v; };
    set('bname', dev.name || dev.ip || '');
    const front = el.querySelector('[data-f="hash"]'), unit = el.querySelector('[data-f="unit"]');
    set('bhash', front ? (front.textContent + ' ' + (unit ? unit.textContent : '')).trim() : '');
    const bb = back.querySelector('.mc-backbtn'); if(bb.textContent !== tx('back')) bb.textContent = tx('back');
    const html = '<div class="mc-hist">' + mcHistoryHtml(dev) + '</div><div class="mc-back-h">' + tx('tech') + '</div><div class="mc-more-grid">' + mcMoreHtml(dev, r) + '</div>';
    const body = back.querySelector('.mc-back-body');
    if(body.dataset.s !== html){ const st = body.scrollTop; body.dataset.s = html; body.innerHTML = html; body.scrollTop = st; }
  }

  // guarda a máquina e a leitura de cada cartão (para o verso) e refresca-o enquanto está virado
  const baseUpdate = window.mcUpdateCard;
  window.mcUpdateCard = function(el, dev, r, st, i){
    deco(el);
    baseUpdate(el, dev, r, st, i);
    el._dev = dev; el._r = r;
    if(el.classList.contains('is-flipped')) fill(el);
  };

  function flip(el, to){
    const on = to === undefined ? !el.classList.contains('is-flipped') : to;
    if(on === el.classList.contains('is-flipped')) return;
    const swap = () => { el.classList.toggle('is-flipped', on); if(on) fill(el); };
    if(reduced() || !el.animate){ swap(); return; }
    el.classList.add('is-flipping');
    const p = 'perspective(1100px) ';
    el.animate([{ transform: p + 'rotateY(0deg)' }, { transform: p + 'rotateY(' + (on ? 90 : -90) + 'deg)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' }).finished.then(() => {
      swap();
      return el.animate([{ transform: p + 'rotateY(' + (on ? -90 : 90) + 'deg)' }, { transform: p + 'rotateY(0deg)' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1.2)' }).finished;
    }).catch(() => swap()).then(() => { el.getAnimations().forEach(a => a.cancel()); el.classList.remove('is-flipping'); });
  }
  window.mcFlipCard = flip;

  // clique em ⟳ / Frente (em captura, para o resto do painel não o tratar como seleção do cartão)
  document.addEventListener('click', e => {
    const b = e.target.closest('#mcBoard [data-a="flip"], #mcBoard [data-a="unflip"]');
    if(!b) return;
    e.stopPropagation(); e.stopImmediatePropagation();
    const el = b.closest('.mc-card'); if(el) flip(el);
  }, true);
  // Esc volta a pôr os cartões virados à frente
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape') document.querySelectorAll('#mcBoard .mc-card.is-flipped').forEach(c => flip(c, false));
  });
})();
