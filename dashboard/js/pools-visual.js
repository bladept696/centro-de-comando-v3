// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Aba Pools com visual novo ----------
// Depois de cada atualização de gpFetch (09-pools.js), arruma o que foi desenhado: cabeçalho com o nome da pool e o estado,
// títulos das secções, ícone e cor em cada cartão, as máquinas em etiquetas, a parte no PPLNS com uma barra e o prémio
// "Se este bloco for nosso, levas" em destaque dourado (pools-visual.css). Os dados e o cálculo continuam no 09-pools.js.
Object.assign(I18N_DICT, {
  gpv_pool: { pt: `Pool`, en: `Pool`, es: `Pool`, fr: `Pool` },
  gpv_conta: { pt: `A tua conta`, en: `Your account`, es: `Tu cuenta`, fr: `Votre compte` },
  gpv_blocos: { pt: `Blocos encontrados`, en: `Blocks found`, es: `Bloques encontrados`, fr: `Blocs trouvés` },
  gpv_vivo: { pt: `ao vivo`, en: `live`, es: `en vivo`, fr: `en direct` },
  gpv_atraso: { pt: `dados atrasados`, en: `stale data`, es: `datos atrasados`, fr: `données en retard` },
  gpv_atual: { pt: `Atualizado às {0} · atualiza a cada 20 s`, en: `Updated at {0} · refreshes every 20 s`, es: `Actualizado a las {0} · se actualiza cada 20 s`, fr: `Mis à jour à {0} · actualisé toutes les 20 s` },
});

(function(){
  if(typeof gpFetch !== 'function') return;
  const tr = k => (typeof t === 'function' ? t(k) : k);
  const STAT_KEYS = ['miners', 'phash', 'nhash', 'height', 'ndiff', 'last', 'fee'];
  const ICONS = { miners: '⛏️', phash: '🌊', nhash: '🌐', height: '📏', ndiff: '🎯', last: '🕒', fee: '💸', best: '⭐', hash: '⚡', workers: '🖥️', pplns: '🥧', prize: '🏆' };
  const COIN = { BTC: '₿', BTC1: '₿', BCH: '₿', LTC: 'Ł', DOGE: 'Ð' };
  const lang = () => (typeof currentLang !== 'undefined' ? currentLang : 'pt');

  function card(el, k){
    el.dataset.k = k;
    const lbl = el.querySelector('.lbl');
    if(lbl) lbl.textContent = lbl.textContent.replace(/^\s*⭐\s*/, '');
    if(!el.querySelector('.gpv-ico')){ const i = document.createElement('span'); i.className = 'gpv-ico'; i.textContent = ICONS[k] || '•'; el.prepend(i); }
  }
  function section(id, key, before){
    let s = document.getElementById(id);
    if(!s){ s = document.createElement('div'); s.id = id; s.className = 'gpv-sec'; before.parentNode.insertBefore(s, before); }
    s.textContent = tr(key);
    return s;
  }
  function hero(){
    const stats = document.getElementById('gpStats'); if(!stats) return;
    let h = document.getElementById('gpvHero');
    if(!h){ h = document.createElement('div'); h.id = 'gpvHero'; h.className = 'gpv-hero'; const row = document.querySelector('#tab-genpools .gp-select-row'); (row || stats).after(h); }
    const cur = typeof GP_STATE !== 'undefined' ? GP_STATE.current : '', p = (GP_STATE.pools || {})[cur] || {};
    const label = String(p.label || cur || '—'), coin = String(p.coin || '').toUpperCase();
    const kind = (label.match(/\((PPLNS|PPS\+?|FPPS|PROP|SOLO)\)/i) || [])[1] || (/solo/i.test(label) ? 'SOLO' : '');
    let host = ''; try { if(p.base_url) host = new URL(p.base_url).host; } catch(e) {}
    const stale = (document.getElementById('gpNote') || {}).textContent;
    const time = new Date().toLocaleTimeString({ pt: 'pt-PT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR' }[lang()] || 'pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    h.innerHTML = '<div class="gpv-logo">' + (COIN[coin] || '⛏') + '</div>' +
      '<div class="gpv-name"><b>' + esc(label.replace(/\s*\((PPLNS|PPS\+?|FPPS|PROP|SOLO)\)\s*/i, ' ').trim()) + '</b><small>' + esc(host ? host + ' · ' : '') + esc(tr('gpv_atual').replace('{0}', time)) + '</small></div>' +
      '<div class="gpv-tags">' + (coin ? '<span class="gpv-tag gold">' + esc(coin) + '</span>' : '') + (kind ? '<span class="gpv-tag">' + esc(kind.toUpperCase()) + '</span>' : '') +
      (stale ? '<span class="gpv-tag warn">⚠ ' + esc(tr('gpv_atraso')) + '</span>' : '<span class="gpv-tag live">' + esc(tr('gpv_vivo')) + '</span>') + '</div>';
  }
  function workers(el){
    const v = el.querySelector('.val'); if(!v || v.querySelector('.gpv-chips')) return;
    const txt = v.textContent.trim(); if(!txt || txt === '—') return;
    const chips = txt.split(' · ').map(s => {
      const i = s.lastIndexOf(': '), name = i > 0 ? s.slice(0, i) : s, rest = i > 0 ? s.slice(i + 2) : '';
      const off = /\(/.test(rest), hs = rest.replace(/\s*\(.*\)\s*$/, '');
      const c = document.createElement('span'); c.className = 'gpv-chip' + (off ? ' off' : '');
      c.innerHTML = '<i></i>'; c.append(name + ' '); if(hs){ const b = document.createElement('b'); b.textContent = hs; c.append(b); }
      return c;
    });
    const box = document.createElement('div'); box.className = 'gpv-chips'; chips.forEach(c => box.append(c));
    v.textContent = ''; v.append(box);
  }
  function pplns(el){
    if(el.querySelector('.gpv-bar')) return;
    const pct = parseFloat((el.querySelector('.val') || {}).textContent);
    if(!(pct >= 0)) return;
    // escala logarítmica: 0,001% fica no início e 100% no fim, para uma parte pequena ainda se ver
    const w = pct <= 0 ? 0 : Math.max(2, Math.min(100, (Math.log10(pct) + 3) / 5 * 100));
    const bar = document.createElement('div'); bar.className = 'gpv-bar'; bar.title = pct + '%'; bar.innerHTML = '<i style="width:0"></i>';
    el.append(bar); requestAnimationFrame(() => requestAnimationFrame(() => { bar.firstChild.style.width = w.toFixed(1) + '%'; }));
  }
  function prize(el){
    const v = el.querySelector('.val'); if(!v || v.dataset.gpv) return;
    v.dataset.gpv = '1';
    const note = v.querySelector('span'); if(note) note.remove();
    const [sats, fiat] = v.textContent.split('≈');
    v.textContent = (sats || '').trim();
    if(fiat){ const f = document.createElement('div'); f.className = 'gpv-fiat'; fiat.split('·').map(s => s.trim()).filter(Boolean).forEach(s => { const sp = document.createElement('span'); sp.textContent = s; f.append(sp); }); el.append(f); }
    if(note){ note.style.display = 'block'; note.style.marginTop = '6px'; note.style.color = '#e8c48a'; el.append(note); }
    if(!el.querySelector('.gpv-shine')){ const s = document.createElement('span'); s.className = 'gpv-shine'; el.append(s); }
  }

  function decorate(){
    const stats = document.getElementById('gpStats'), acc = document.getElementById('gpAccount'), table = document.querySelector('#tab-genpools .gp-table');
    if(!stats) return;
    hero();
    section('gpvSecPool', 'gpv_pool', stats);
    [...stats.children].forEach((el, i) => card(el, STAT_KEYS[i] || 'x'));
    if(acc){
      const s = section('gpvSecAcc', 'gpv_conta', acc); s.style.display = acc.style.display === 'none' ? 'none' : '';
      const map = { [tr('gp_a_best')]: 'best', [tr('gp_a_hash')]: 'hash', [tr('gp_a_workers')]: 'workers', [tr('gp_a_pplns')]: 'pplns', [tr('gp_a_prize')]: 'prize' };
      [...acc.children].forEach(el => {
        const lbl = (el.querySelector('.lbl') || {}).textContent || '', k = map[lbl] || map[lbl.trim()] || 'x';
        card(el, k);
        if(k === 'workers') workers(el); else if(k === 'pplns') pplns(el); else if(k === 'prize') prize(el);
      });
    }
    if(table) section('gpvSecBlk', 'gpv_blocos', table);
  }

  const orig = gpFetch;
  window.gpFetch = async function(){ const r = await orig.apply(this, arguments); try { decorate(); } catch(e) {} return r; };
})();
