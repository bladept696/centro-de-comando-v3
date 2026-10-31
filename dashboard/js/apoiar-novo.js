// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Aba "Apoiar / Doar" com visual novo (estilos em apoiar-novo.css) ----------
// Reorganiza o conteúdo que já existe no HTML (QR, endereços e botões, com os mesmos ids) em dois cartões: Lightning e On-Chain.
// Acrescenta uma moeda 3D a rodar, vantagens, botões "Abrir carteira" (lightning:/bitcoin:) e troca o alert() de "copiado"
// por um aviso no próprio botão.
Object.assign(I18N_DICT, {
  dn_desc: { pt: `Se este software te está a ser útil na monitorização dos teus ASICs, considera deixar um donativo. Cada sat ajuda a manter o Centro de Comando grátis e com novidades.`, en: `If this software is useful for monitoring your ASICs, consider leaving a donation. Every sat helps keep Centro de Comando free and improving.`, es: `Si este software te resulta útil para monitorizar tus ASICs, considera dejar una donación. Cada sat ayuda a mantener Centro de Comando gratis y con novedades.`, fr: `Si ce logiciel vous est utile pour surveiller vos ASICs, pensez à faire un don. Chaque sat aide à garder Centro de Comando gratuit et à jour.` },
  dn_p1: { pt: `Novas funções`, en: `New features`, es: `Nuevas funciones`, fr: `Nouvelles fonctions` },
  dn_p2: { pt: `Correções rápidas`, en: `Quick fixes`, es: `Correcciones rápidas`, fr: `Corrections rapides` },
  dn_p3: { pt: `Grátis para todos`, en: `Free for everyone`, es: `Gratis para todos`, fr: `Gratuit pour tous` },
  dn_ln_t: { pt: `Lightning`, en: `Lightning`, es: `Lightning`, fr: `Lightning` },
  dn_ln_s: { pt: `Instantâneo · taxas quase zero`, en: `Instant · near-zero fees`, es: `Instantáneo · comisiones casi nulas`, fr: `Instantané · frais quasi nuls` },
  dn_oc_t: { pt: `Bitcoin On-Chain`, en: `Bitcoin On-Chain`, es: `Bitcoin On-Chain`, fr: `Bitcoin On-Chain` },
  dn_oc_s: { pt: `Rede principal · ideal para valores maiores`, en: `Main network · best for larger amounts`, es: `Red principal · ideal para importes mayores`, fr: `Réseau principal · idéal pour les gros montants` },
  dn_open: { pt: `Abrir carteira`, en: `Open wallet`, es: `Abrir cartera`, fr: `Ouvrir le portefeuille` },
  dn_copied: { pt: `✓ Copiado!`, en: `✓ Copied!`, es: `✓ ¡Copiado!`, fr: `✓ Copié !` },
  dn_thanks: { pt: `Obrigado por apoiares quem mina em casa 🧡`, en: `Thanks for supporting home miners 🧡`, es: `Gracias por apoyar a quien mina en casa 🧡`, fr: `Merci de soutenir les mineurs à domicile 🧡` },
});

(function(){
  const LN = 'plainpen16@walletofsatoshi.com', BTC = 'bc1qffk82prrxn84e8y9l0z5yflsqclhyc9ptphgmf';
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = window.matchMedia && matchMedia('(hover: none)').matches;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; return e; };
  const i18n = (k, txt) => '<span data-i18n="' + k + '">' + (typeof t === 'function' ? t(k) : txt) + '</span>';

  function flash(btn, box){
    if(!btn) return;
    const label = btn.querySelector('span') || btn, old = label.textContent;
    btn.classList.add('dn-ok'); label.textContent = t('dn_copied');
    if(box){ box.classList.remove('dn-flash'); void box.offsetWidth; box.classList.add('dn-flash'); }
    setTimeout(() => { btn.classList.remove('dn-ok'); label.textContent = old; }, 1800);
  }
  async function copy(text, btn, box){
    try { await navigator.clipboard.writeText(text); flash(btn, box); }
    catch(e){ try { const ta = el('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); flash(btn, box); } catch(e2) {} }
  }
  // sem alert(): o próprio botão diz que copiou
  window.copyLightningAddress = function(){ copy(LN, document.querySelector('#tab-donate .dn-card.ln .donate-btn'), document.getElementById('lightningAddress')); };
  window.copyBtcAddress = function(){ copy(BTC, document.querySelector('#tab-donate .dn-card.oc .donate-btn'), document.getElementById('btcAddress')); };

  function tilt(card){
    if(reduce || touch) return;
    let raf = 0;
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        card.classList.add('dn-on');
        card.style.setProperty('--ry', ((px - .5) * 14).toFixed(2) + 'deg'); card.style.setProperty('--rx', ((.5 - py) * 12).toFixed(2) + 'deg');
        card.style.setProperty('--mx', (px * 100).toFixed(1) + '%'); card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
    });
    card.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); card.classList.remove('dn-on'); card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  }

  function build(){
    const box = document.querySelector('#tab-donate .donate-container');
    if(!box || box.classList.contains('dn')) return;
    const qr = box.querySelector('.donate-qr-wrap'), lnAddr = document.getElementById('lightningAddress'), btcAddr = document.getElementById('btcAddress');
    const btns = box.querySelectorAll('.donate-btn'), labels = box.querySelectorAll('.donate-label');
    if(!qr || !lnAddr || !btcAddr || btns.length < 2) return;
    box.classList.add('dn');

    // topo: moeda 3D a rodar com raios à volta
    const icons = box.querySelector('.donate-icons');
    const hero = el('div', 'dn-hero', '<div class="dn-coin" aria-hidden="true"><div class="dn-face f">₿</div><div class="dn-face b">⚡</div>' + [-3.5, -2.1, -0.7, 0.7, 2.1, 3.5].map(z => '<div class="dn-edge" style="--z:' + z + 'px"></div>').join('') + '</div>' +
      '<svg class="dn-bolt l" viewBox="0 0 24 48" aria-hidden="true"><path d="M14 0 2 27h8l-4 21L22 18h-9z"/></svg><svg class="dn-bolt r" viewBox="0 0 24 48" aria-hidden="true"><path d="M14 0 2 27h8l-4 21L22 18h-9z"/></svg>');
    if(icons) icons.replaceWith(hero); else box.prepend(hero);
    const desc = box.querySelector('.donate-desc'); if(desc) desc.innerHTML = i18n('dn_desc', desc.textContent);
    const perks = el('div', 'dn-perks', ['⚙️|dn_p1', '🐛|dn_p2', '🌍|dn_p3'].map(p => { const [ic, k] = p.split('|'); return '<span class="dn-perk"><b>' + ic + '</b>' + i18n(k) + '</span>'; }).join(''));
    if(desc) desc.after(perks);

    // dois cartões com os elementos que já existiam (mantêm ids, traduções e onclick)
    const grid = el('div', 'dn-grid');
    const card = (cls, ic, tk, sk, visual, label, addr, btn, uri) => {
      const c = el('div', 'dn-card ' + cls);
      c.appendChild(el('div', 'dn-card-head', '<span class="dn-ic">' + ic + '</span><div><b>' + i18n(tk) + '</b><small>' + i18n(sk) + '</small></div>'));
      c.appendChild(visual);
      if(label){ label.removeAttribute('style'); c.appendChild(label); }
      c.appendChild(addr);
      const row = el('div', 'dn-btns'); btn.removeAttribute('style'); row.appendChild(btn);
      row.appendChild(el('a', 'dn-open', i18n('dn_open'))); row.lastChild.href = uri;
      c.appendChild(row);
      c.appendChild(el('span', 'dn-glare'));
      tilt(c);
      return c;
    };
    const ocVisual = el('div', 'dn-emblem', '<div class="dn-ring"></div><div class="dn-big">₿</div>');
    grid.appendChild(card('ln', '⚡', 'dn_ln_t', 'dn_ln_s', qr, labels[0], lnAddr, btns[0], 'lightning:' + LN));
    grid.appendChild(card('oc', '₿', 'dn_oc_t', 'dn_oc_s', ocVisual, labels[1], btcAddr, btns[1], 'bitcoin:' + BTC));
    box.appendChild(grid);
    box.appendChild(el('div', 'dn-thanks', i18n('dn_thanks')));
    if(typeof applyTranslations === 'function') try { applyTranslations(); } catch(e) {}
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
