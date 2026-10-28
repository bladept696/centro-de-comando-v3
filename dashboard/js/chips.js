// ---------- Saúde dos chips (máquinas com vários chips, como a NerdQAxe) ----------
// A firmware (testada: NerdQAxe++ v1.1.0) NÃO envia o hashrate nem os erros de cada chip: só o total, o número de chips,
// o nº de núcleos por chip, a frequência e, em algumas versões, a temperatura de cada chip (aqui vem a zero).
// Por isso o painel ESTIMA: compara o hashrate real com o teórico (chips × núcleos × frequência) e com o que a própria
// máquina costuma render àquela frequência. Se a eficiência cai ~1/N, é provável que um dos N chips esteja a falhar.
(function(){
  const KEY = 'hc_chips', LANGS = ['pt', 'en', 'es', 'fr'];
  const TX = {
    menu: ['Saúde dos chips', 'Chip health', 'Salud de los chips', 'Santé des puces'],
    title: ['Saúde dos chips', 'Chip health', 'Salud de los chips', 'Santé des puces'],
    intro: ['A máquina só envia o hashrate total, por isso os valores por chip são uma estimativa: o painel compara o que a máquina rende com o teórico (chips × núcleos × frequência) e com o que ela própria costuma render.', 'The machine only reports total hashrate, so per-chip values are an estimate: the panel compares what it delivers with the theoretical (chips × cores × frequency) and with what it usually delivers.', 'La máquina solo envía el hashrate total, así que los valores por chip son una estimación: el panel compara lo que rinde con el teórico (chips × núcleos × frecuencia) y con lo que suele rendir.', 'La machine n’envoie que le hashrate total, donc les valeurs par puce sont une estimation : le tableau de bord compare le rendement au théorique (puces × cœurs × fréquence) et à son rendement habituel.'],
    none: ['Sem máquinas com vários chips online.', 'No online machines with several chips.', 'No hay máquinas con varios chips en línea.', 'Aucune machine multi-puces en ligne.'],
    eff: ['do teórico', 'of theoretical', 'del teórico', 'du théorique'],
    usual: ['o habitual', 'usual', 'lo habitual', 'habituel'],
    real: ['Real', 'Actual', 'Real', 'Réel'], theo: ['Teórico', 'Theoretical', 'Teórico', 'Théorique'],
    chips: ['chips efetivos', 'effective chips', 'chips efectivos', 'puces effectives'],
    temps: ['Temperatura por chip', 'Temperature per chip', 'Temperatura por chip', 'Température par puce'],
    notemps: ['A firmware não envia a temperatura de cada chip.', 'The firmware does not report each chip’s temperature.', 'El firmware no envía la temperatura de cada chip.', 'Le firmware n’envoie pas la température de chaque puce.'],
    dup: ['Nonces duplicados (erros de hardware)', 'Duplicate nonces (hardware errors)', 'Nonces duplicados (errores de hardware)', 'Nonces dupliqués (erreurs matérielles)'],
    ok: ['Sem sinais de chip fraco.', 'No signs of a weak chip.', 'Sin señales de chip débil.', 'Aucun signe de puce faible.'],
    warnLost: ['⚠ Possível chip fraco: a render como ~{0} de {1} chips.', '⚠ Possible weak chip: performing like ~{0} of {1} chips.', '⚠ Posible chip débil: rinde como ~{0} de {1} chips.', '⚠ Puce faible possible : rend comme ~{0} puces sur {1}.'],
    warnLow: ['⚠ Rendimento a {0}% do teórico à frequência atual.', '⚠ Running at {0}% of theoretical at the current frequency.', '⚠ Rinde al {0}% del teórico a la frecuencia actual.', '⚠ Rendement à {0}% du théorique à la fréquence actuelle.'],
    hint: ['Se isto continuar, baixa a frequência ou a voltagem e vê se a eficiência sobe.', 'If this continues, lower the frequency or voltage and see if efficiency improves.', 'Si continúa, baja la frecuencia o el voltaje y mira si mejora la eficiencia.', 'Si cela continue, baissez la fréquence ou la tension et vérifiez l’efficacité.'],
    close: ['Fechar', 'Close', 'Cerrar', 'Fermer']
  };
  const lang = () => { try { const l = typeof currentLang !== 'undefined' ? currentLang : 'pt'; return LANGS.includes(l) ? l : 'pt'; } catch(e) { return 'pt'; } };
  const li = () => LANGS.indexOf(lang());
  const t = (k, ...a) => { let s = TX[k][li()]; a.forEach((v, i) => { s = s.split('{' + i + '}').join(v); }); return s; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // histórico de eficiência por máquina (1 amostra a cada ~4 min, 26 h)
  let H = {};
  try { H = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch(e) { H = {}; }
  const saveH = () => { try { localStorage.setItem(KEY, JSON.stringify(H)); } catch(e) {} };
  const median = a => { if(!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  function measure(r){
    if(!r || r.online !== true) return null;
    const n = Number(r.asicCount), cores = Number(r.smallCores), f = Number(r.frequency), hr = Number(r.hashrate);
    if(!(n >= 2 && cores > 0 && f > 0 && hr > 0)) return null;
    const theo = n * cores * f / 1000;            // GH/s
    return { n, cores, f, hr, theo, eff: hr / theo };
  }
  function baseline(id, m){
    const now = Date.now(), a = (H[id] || []).filter(s => now - s.t > 20 * 60e3 && Math.abs(s.f - m.f) / m.f < 0.01).map(s => s.e);
    return a.length >= 10 ? median(a) : 0;
  }
  function info(dev, r){
    const m = measure(r); if(!m) return null;
    const base = baseline(dev.id, m), drop = base ? (base - m.eff) / base : 0, lost = Math.max(0, drop * m.n);
    let level = '';
    if(base && lost >= 0.6) level = lost >= 0.9 ? 'bad' : 'warn';
    else if(m.eff < 0.7) level = 'warn';
    const temps = Array.isArray(r.asicTemps) ? r.asicTemps.map(Number).filter(v => isFinite(v)) : [];
    return Object.assign({ base, drop, lost, level, chips: m.eff * m.n, temps: temps.some(v => v > 0) ? temps : null, dup: r.dupNonces }, m);
  }

  // ---- amostragem ----
  const lastDup = {};
  function sample(){
    let devs = [], rd = {};
    try { devs = typeof devices !== 'undefined' ? devices : []; rd = typeof readings !== 'undefined' ? readings : {}; } catch(e) {}
    const now = Date.now(); let changed = false;
    devs.forEach(d => {
      const m = measure(rd[d.id]); if(!m) return;
      const a = H[d.id] = H[d.id] || [], last = a[a.length - 1];
      if(!last || now - last.t > 4 * 60e3){ a.push({ t: now, e: Number(m.eff.toFixed(4)), f: m.f }); changed = true; }
      while(a.length && now - a[0].t > 26 * 3600e3) a.shift();
    });
    if(changed) saveH();
  }
  setInterval(sample, 60000); setTimeout(sample, 15000);

  // ---- aviso nos cartões das máquinas ----
  window.hcChipAlert = function(dev, r){
    try {
      const i = info(dev, r); if(!i || !i.level) return null;
      const txt = i.base && i.lost >= 0.6 ? t('warnLost', (i.n - i.lost).toFixed(1), i.n) : t('warnLow', Math.round(i.eff * 100));
      return { lvl: i.level, txt: '🧩 ' + txt.replace(/^⚠\s*/, '') };
    } catch(e) { return null; }
  };

  // ---- janela ----
  const spark = a => {
    if(a.length < 3) return '';
    const v = a.map(s => s.e), lo = Math.min(...v), hi = Math.max(...v), sp = (hi - lo) || 0.02;
    return '<svg viewBox="0 0 120 28" preserveAspectRatio="none" class="hc-ch-spark"><path d="' + v.map((x, k) => (k ? 'L' : 'M') + (k / (v.length - 1) * 120).toFixed(1) + ' ' + (26 - (x - lo) / sp * 24).toFixed(1)).join('') + '"/></svg>';
  };
  function card(dev, r){
    const i = info(dev, r), fmt = g => g >= 1000 ? (g / 1000).toFixed(2) + ' TH/s' : g.toFixed(0) + ' GH/s';
    let blocks = '';
    for(let k = 0; k < i.n; k++){ const f = Math.max(0, Math.min(1, i.chips - k)); blocks += '<i style="--f:' + f.toFixed(2) + '"></i>'; }
    let tmp = '<div class="hc-ch-note">' + t('notemps') + '</div>';
    if(i.temps){
      const med = median(i.temps.filter(v => v > 0));
      tmp = '<div class="hc-ch-temps">' + i.temps.map((v, k) => '<span class="' + (v > 0 && v > med + 8 ? 'hot' : '') + '">#' + (k + 1) + ' <b>' + (v > 0 ? v.toFixed(0) + '°' : '—') + '</b></span>').join('') + '</div>';
    }
    const dup = i.dup != null ? '<div class="hc-ch-dup">' + t('dup') + ': <b>' + Number(i.dup).toLocaleString() + '</b></div>' : '';
    const verdict = i.level ? '<div class="hc-ch-v ' + i.level + '">' + esc(window.hcChipAlert(dev, r).txt) + ' ' + t('hint') + '</div>' : '<div class="hc-ch-v good">✔ ' + t('ok') + '</div>';
    return '<div class="hc-ch-card"><div class="hc-ch-h"><b>' + esc(dev.name) + '</b><span>' + esc(r.model || r.deviceModel || '') + ' · ' + i.n + ' chips · ' + Math.round(i.f) + ' MHz</span></div>' +
      '<div class="hc-ch-blocks">' + blocks + '</div>' +
      '<div class="hc-ch-row"><span><b>' + i.chips.toFixed(1) + '</b> / ' + i.n + ' ' + t('chips') + '</span><span><b>' + Math.round(i.eff * 100) + '%</b> ' + t('eff') + (i.base ? ' · ' + t('usual') + ' ' + Math.round(i.base * 100) + '%' : '') + '</span></div>' +
      '<div class="hc-ch-row"><span>' + t('real') + ' <b>' + fmt(i.hr) + '</b></span><span>' + t('theo') + ' <b>' + fmt(i.theo) + '</b></span></div>' +
      spark(H[dev.id] || []) + tmp + dup + verdict + '</div>';
  }
  function body(){
    let devs = [], rd = {};
    try { devs = typeof devices !== 'undefined' ? devices : []; rd = typeof readings !== 'undefined' ? readings : {}; } catch(e) {}
    const cards = devs.filter(d => measure(rd[d.id])).map(d => card(d, rd[d.id])).join('');
    return '<p class="hc-ch-intro">' + t('intro') + '</p>' + (cards || '<p class="hc-ch-none">' + t('none') + '</p>');
  }
  function close(){ const n = document.getElementById('hcChModal'); if(n) n.remove(); }
  window.hcChipsOpen = function(){
    close(); sample();
    const ov = document.createElement('div');
    ov.id = 'hcChModal'; ov.className = 'hc-ch-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="hc-ch-box"><h2>🧩 ' + t('title') + '</h2><div id="hcChBody">' + body() + '</div><div class="hc-ch-act"><button type="button" class="hc-ch-btn" data-a="x">' + t('close') + '</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if(e.target === ov || e.target.closest('[data-a="x"]')) close(); });
    document.addEventListener('keydown', function k(e){ if(e.key === 'Escape'){ close(); document.removeEventListener('keydown', k); } });
    const iv = setInterval(() => { const b = document.getElementById('hcChBody'); if(!b){ clearInterval(iv); return; } b.innerHTML = body(); }, 5000);
  };
  window.hcChipsLabel = () => '🧩 ' + t('menu');
  window.hcChips = { info, measure, hist: () => H };   // diagnóstico na consola
})();
