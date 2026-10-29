// ---------- Hashrate real medido pelos shares ----------
// O hashrate que a máquina mostra é um número calculado por ela própria. A pool, por outro lado, só conta o trabalho que aceitou:
// cada share aceite vale (dificuldade × 2^32) hashes. Somando os shares aceites e dividindo pelo tempo, o painel obtém o hashrate
// que a pool realmente recebeu e compara-o com o mostrado. Como os shares chegam ao acaso (Poisson), o resultado tem uma margem
// de erro de ±1,96/√N (95%): só se avisa quando a diferença é maior do que essa margem.
(function(){
  const KEY = 'hc_hreal', LANGS = ['pt', 'en', 'es', 'fr'], H32 = 4294967296;
  const MAXAGE = 7 * 3600e3, STEP = 55e3, MINN = 30;
  const TX = {
    menu: ['Hashrate real', 'Real hashrate', 'Hashrate real', 'Hashrate réel'],
    intro: ['O hashrate que a máquina mostra é um número calculado por ela própria. Aqui o painel mede o trabalho que a pool realmente aceitou (shares × dificuldade) e compara. Se os dois divergem durante horas, algo não está a render o que parece: chip fraco, ligação instável ou firmware a inflacionar o valor.',
      'The hashrate a machine shows is a number it calculates itself. Here the panel measures the work the pool actually accepted (shares × difficulty) and compares. If the two diverge for hours, something is not delivering what it seems: a weak chip, an unstable link or firmware inflating the value.',
      'El hashrate que muestra la máquina lo calcula ella misma. Aquí el panel mide el trabajo que el pool aceptó de verdad (shares × dificultad) y lo compara. Si ambos divergen durante horas, algo no rinde lo que parece: chip débil, conexión inestable o firmware que infla el valor.',
      'Le hashrate affiché par la machine est calculé par elle-même. Ici le tableau de bord mesure le travail réellement accepté par le pool (shares × difficulté) et compare. Si les deux divergent pendant des heures, quelque chose ne rend pas ce qu’il semble : puce faible, liaison instable ou firmware qui gonfle la valeur.'],
    none: ['Sem máquinas online com dados de shares.', 'No online machines with share data.', 'No hay máquinas en línea con datos de shares.', 'Aucune machine en ligne avec des données de shares.'],
    shown: ['Mostrado pela máquina', 'Shown by the machine', 'Mostrado por la máquina', 'Affiché par la machine'],
    meas: ['Medido pelos shares', 'Measured from shares', 'Medido por los shares', 'Mesuré par les shares'],
    shares: ['shares aceites', 'accepted shares', 'shares aceptados', 'shares acceptés'],
    win: ['janela', 'window', 'ventana', 'fenêtre'],
    rej: ['rejeitados', 'rejected', 'rechazados', 'rejetés'],
    stab: ['Estabilidade do fluxo', 'Share flow stability', 'Estabilidad del flujo', 'Stabilité du flux'],
    chart: ['Últimas 6 h (blocos de 15 min)', 'Last 6 h (15 min blocks)', 'Últimas 6 h (bloques de 15 min)', '6 dernières h (blocs de 15 min)'],
    lgShown: ['mostrado', 'shown', 'mostrado', 'affiché'], lgMeas: ['medido', 'measured', 'medido', 'mesuré'],
    good: ['O hashrate mostrado bate certo com o trabalho aceite pela pool.', 'The hashrate shown matches the work accepted by the pool.', 'El hashrate mostrado coincide con el trabajo aceptado por el pool.', 'Le hashrate affiché correspond au travail accepté par le pool.'],
    warn: ['A pool só recebeu ~{0}% do hashrate mostrado. Pode haver um chip fraco, ligação instável ou firmware a inflacionar o valor.', 'The pool only received ~{0}% of the hashrate shown. There may be a weak chip, an unstable link or firmware inflating the value.', 'El pool solo recibió ~{0}% del hashrate mostrado. Puede haber un chip débil, conexión inestable o firmware que infla el valor.', 'Le pool n’a reçu que ~{0}% du hashrate affiché. Il peut y avoir une puce faible, une liaison instable ou un firmware qui gonfle la valeur.'],
    bad: ['A pool recebe só ~{0}% do hashrate mostrado: a máquina não está a entregar o que diz.', 'The pool receives only ~{0}% of the hashrate shown: the machine is not delivering what it claims.', 'El pool recibe solo ~{0}% del hashrate mostrado: la máquina no entrega lo que dice.', 'Le pool ne reçoit que ~{0}% du hashrate affiché : la machine ne livre pas ce qu’elle annonce.'],
    collect: ['A recolher dados: faltam shares ou tempo para medir ({0}/{1} shares).', 'Collecting data: not enough shares or time to measure yet ({0}/{1} shares).', 'Recopilando datos: faltan shares o tiempo para medir ({0}/{1} shares).', 'Collecte en cours : pas assez de shares ou de temps pour mesurer ({0}/{1} shares).'],
    sparse: ['Dificuldade alta: esperam-se só ~{0} shares por hora, poucos para medir com precisão. Resultado indicativo.', 'High difficulty: only ~{0} shares per hour are expected, too few to measure precisely. Indicative result.', 'Dificultad alta: se esperan solo ~{0} shares por hora, pocos para medir con precisión. Resultado orientativo.', 'Difficulté élevée : seulement ~{0} shares par heure attendus, trop peu pour mesurer précisément. Résultat indicatif.'],
    over: ['A pool recebe mais do que a máquina mostra (+{0}%): normalmente é só a média do firmware a atrasar-se.', 'The pool receives more than the machine shows (+{0}%): usually just the firmware’s average lagging.', 'El pool recibe más de lo que muestra la máquina (+{0}%): normalmente es solo el promedio del firmware que se retrasa.', 'Le pool reçoit plus que ce que la machine affiche (+{0}%) : en général c’est juste la moyenne du firmware qui traîne.'],
    unstable: ['Fluxo de shares irregular (índice {0}): a ligação à pool cai ou o ritmo vai aos soluços.', 'Irregular share flow (index {0}): the pool link drops or the rate comes in bursts.', 'Flujo de shares irregular (índice {0}): la conexión al pool se cae o el ritmo va a golpes.', 'Flux de shares irrégulier (indice {0}) : la liaison au pool tombe ou le rythme est saccadé.'],
    stabOk: ['regular', 'steady', 'regular', 'régulier'],
    hint: ['Compara com a aba Saúde dos chips e verifica o cabo, a Wi-Fi e a pool.', 'Compare with Chip health and check the cable, Wi-Fi and pool.', 'Compáralo con Salud de los chips y revisa el cable, el Wi-Fi y el pool.', 'Comparez avec Santé des puces et vérifiez le câble, le Wi-Fi et le pool.'],
    aShort: ['Pool recebe ~{0}% do hashrate mostrado', 'Pool gets ~{0}% of shown hashrate', 'El pool recibe ~{0}% del hashrate mostrado', 'Le pool reçoit ~{0}% du hashrate affiché'],
    aUnst: ['Fluxo de shares irregular', 'Irregular share flow', 'Flujo de shares irregular', 'Flux de shares irrégulier'],
    close: ['Fechar', 'Close', 'Cerrar', 'Fermer']
  };
  const lang = () => { try { const l = typeof currentLang !== 'undefined' ? currentLang : 'pt'; return LANGS.includes(l) ? l : 'pt'; } catch(e) { return 'pt'; } };
  const li = () => LANGS.indexOf(lang());
  const t = (k, ...a) => { let s = TX[k][li()]; a.forEach((v, i) => { s = s.split('{' + i + '}').join(v); }); return s; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtH = g => g >= 1000 ? (g / 1000).toFixed(2) + ' TH/s' : g.toFixed(0) + ' GH/s';

  // amostras por máquina: 1 por minuto, 7 h  {t, a: aceites, r: rejeitados, d: dificuldade, h: hashrate mostrado (GH/s), u: uptime}
  let S = {};
  try { S = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch(e) { S = {}; }
  const saveS = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e) {} };

  function reading(id){
    let rd = {}; try { rd = typeof readings !== 'undefined' ? readings : {}; } catch(e) {}
    return rd[id];
  }
  function diffOf(r){
    const d = Number(r.poolDifficulty) || Number(r.poolInfo && r.poolInfo.primary && r.poolInfo.primary.difficulty) || 0;
    return d > 0 ? d : 0;
  }
  function ok(r){ return r && r.online === true && Number.isFinite(Number(r.accepted)) && Number(r.hashrate) > 0 && diffOf(r) > 0; }

  let timer = null;
  function sample(){
    let devs = []; try { devs = typeof devices !== 'undefined' ? devices : []; } catch(e) {}
    const now = Date.now(); let changed = false;
    devs.forEach(d => {
      const r = reading(d.id); if(!ok(r)) return;
      const a = S[d.id] = S[d.id] || [], last = a[a.length - 1];
      if(!last || now - last.t >= STEP){ a.push({ t: now, a: Number(r.accepted), r: Number(r.rejected) || 0, d: diffOf(r), h: Number(r.hashrate), u: r.uptime != null ? Number(r.uptime) : null }); changed = true; }
      while(a.length && now - a[0].t > MAXAGE) a.shift();
    });
    if(changed) saveS();
  }
  timer = setInterval(sample, 20000); setTimeout(sample, 12000);

  // junta os intervalos entre amostras consecutivas, ignorando reinícios (o contador volta a zero) e falhas longas
  function pairs(arr, from, to){
    const out = [];
    for(let i = 1; i < arr.length; i++){
      const p = arr[i - 1], q = arr[i];
      if(q.t < from || q.t > to) continue;
      const dt = (q.t - p.t) / 1000, da = q.a - p.a, dr = q.r - p.r;
      if(dt <= 0 || dt > 360 || da < 0 || dr < 0 || (p.u != null && q.u != null && q.u < p.u)) continue;
      out.push({ t: q.t, dt, da, dr, d: (p.d + q.d) / 2, h: (p.h + q.h) / 2 });
    }
    return out;
  }
  function sum(ps){
    let work = 0, time = 0, N = 0, rj = 0, rep = 0;
    ps.forEach(p => { work += p.da * p.d * H32; time += p.dt; N += p.da; rj += p.dr; rep += p.h * p.dt; });
    return { work, time, N, rj, rep };
  }
  function calcWin(id, win, now){
    const arr = S[id] || [], ps = pairs(arr, now - win, now), s = sum(ps);
    if(s.time < 300) return null;
    const last = arr[arr.length - 1], dNow = last ? last.d : 1;
    const real = s.work / s.time / 1e9, rep = s.rep / s.time, expN = rep * 1e9 * s.time / (dNow * H32);
    const ratio = rep > 0 ? real / rep : 0, ci = 1.96 / Math.sqrt(Math.max(1, s.N));
    // dispersão do nº de shares por blocos de 5 min (≈1 se o fluxo é regular; muito mais se há quedas ou soluços)
    // Compara o trabalho de cada bloco de 5 min com o esperado para o TEMPO REALMENTE COBERTO nesse bloco (as leituras não são
    // perfeitamente regulares) e em unidades de trabalho (share × dificuldade), para uma mudança de dificuldade da pool não parecer
    // irregularidade. Se o fluxo é regular o índice fica perto de 1; muito mais alto = quedas ou soluços a sério.
    const bins = {}; ps.forEach(p => { const b = Math.floor(p.t / 300e3); const o = (bins[b] = bins[b] || { c: 0, w: 0, s: 0, n: 0 }); o.c += p.da; o.w += p.da * p.d; o.s += p.dt; o.n++; });
    const vb = Object.values(bins).filter(b => b.n >= 4 && b.s >= 150 && b.c > 0); let disp = null;
    if(vb.length >= 6){
      const W = vb.reduce((x, b) => x + b.w, 0), Ssum = vb.reduce((x, b) => x + b.s, 0), lam = W / Ssum;
      if(lam > 0 && vb.every(b => b.c > 0) && vb.reduce((x, b) => x + b.c, 0) / vb.length >= 5){
        let chi = 0; vb.forEach(b => { const e = lam * b.s, dbar = b.w / b.c; chi += (b.w - e) * (b.w - e) / (e * dbar); });
        disp = chi / (vb.length - 1);
      }
    }
    return { real, rep, ratio, ci, N: s.N, expN, time: s.time, win, rejPct: s.N + s.rj > 0 ? s.rj / (s.N + s.rj) * 100 : 0, disp };
  }
  function calc(id){
    const now = Date.now(); let r = calcWin(id, 3600e3, now);
    if(!r || r.N < MINN){ const r6 = calcWin(id, 6 * 3600e3, now); if(r6 && (!r || r6.N > r.N)) r = r6; }
    return r;
  }
  // veredicto: só se acusa quando a diferença é maior do que a margem de erro
  function verdict(res){
    if(!res || res.time < 600) return { k: 'collect', N: res ? Math.round(res.N) : 0 };
    if(res.expN < MINN && res.N < MINN) return { k: 'sparse' };
    const low = res.ratio * (1 + res.ci), high = res.ratio * (1 - res.ci);
    if(low < 0.75) return { k: 'bad', lvl: 'bad' };
    if(low < 0.9) return { k: 'warn', lvl: 'warn' };
    if(res.disp != null && res.disp > 5 && res.N >= 60) return { k: 'unstable', lvl: 'warn' };
    if(res.ratio > 1.25 && high > 1.12) return { k: 'over' };
    return { k: 'good' };
  }

  window.hcRealAlert = function(dev, r){
    try {
      if(!ok(r)) return null;
      const res = calc(dev.id), v = verdict(res); if(!v.lvl) return null;
      return { lvl: v.lvl, txt: '📐 ' + (v.k === 'unstable' ? t('aUnst') : t('aShort', Math.round(res.ratio * 100))) };
    } catch(e) { return null; }
  };

  // ---- janela ----
  function series(id){
    const now = Date.now(), W = 6 * 3600e3, B = 15 * 60e3, nb = 24, bk = Array.from({ length: nb }, () => ({ work: 0, time: 0, rep: 0 }));
    pairs(S[id] || [], now - W, now).forEach(p => {
      const i = Math.min(nb - 1, Math.floor((p.t - (now - W)) / B)); if(i < 0) return;
      bk[i].work += p.da * p.d * H32; bk[i].time += p.dt; bk[i].rep += p.h * p.dt;
    });
    return bk.map(b => b.time >= 300 ? { real: b.work / b.time / 1e9, rep: b.rep / b.time } : null);
  }
  function chart(id){
    const s = series(id), pts = s.filter(Boolean); if(pts.length < 3) return '';
    const mx = Math.max(...pts.map(p => Math.max(p.real, p.rep))) * 1.12 || 1, X = i => (i / (s.length - 1) * 240).toFixed(1), Y = v => (54 - v / mx * 50).toFixed(1);
    const path = key => { let d = '', pen = false; s.forEach((p, i) => { if(!p){ pen = false; return; } d += (pen ? 'L' : 'M') + X(i) + ' ' + Y(p[key]); pen = true; }); return d; };
    return '<div class="hc-hr-chart"><div class="hc-hr-ct">' + t('chart') + '<span><i class="a"></i>' + t('lgShown') + ' <i class="b"></i>' + t('lgMeas') + '</span></div>' +
      '<svg viewBox="0 0 240 56" preserveAspectRatio="none"><path class="a" d="' + path('rep') + '"/><path class="b" d="' + path('real') + '"/></svg></div>';
  }
  function gauge(res, lvl){
    const sc = 1.3, r = Math.max(0, Math.min(sc, res.ratio)) / sc * 100, lo = Math.max(0, res.ratio * (1 - res.ci)) / sc * 100, hi = Math.min(sc, res.ratio * (1 + res.ci)) / sc * 100;
    return '<div class="hc-hr-gauge ' + (lvl || '') + '"><div class="hc-hr-track"><b style="width:' + r.toFixed(1) + '%"></b><em style="left:' + Math.min(100, lo).toFixed(1) + '%;width:' + Math.max(1, Math.min(100, hi) - Math.min(100, lo)).toFixed(1) + '%"></em><u></u></div>' +
      '<div class="hc-hr-pct"><b>' + Math.round(res.ratio * 100) + '%</b><span>± ' + Math.round(res.ci * 100) + '% (95%)</span></div></div>';
  }
  function card(dev){
    const res = calc(dev.id), v = verdict(res);
    let head = '<div class="hc-ch-h"><b>' + esc(dev.name) + '</b><span>' + (res ? Math.round(res.N).toLocaleString() + ' ' + t('shares') + ' · ' + t('win') + ' ' + (res.win >= 7200e3 ? '6 h' : '1 h') : '') + '</span></div>';
    if(!res || v.k === 'collect') return '<div class="hc-ch-card">' + head + '<div class="hc-ch-v">' + t('collect', res ? Math.round(res.N) : 0, MINN) + '</div></div>';
    const stab = res.disp == null ? '—' : res.disp > 5 ? '<b class="bad">' + res.disp.toFixed(1) + '</b>' : '<b>' + t('stabOk') + '</b> (' + res.disp.toFixed(1) + ')';
    let msg;
    if(v.k === 'good') msg = '<div class="hc-ch-v good">✔ ' + t('good') + '</div>';
    else if(v.k === 'sparse') msg = '<div class="hc-ch-v">ℹ ' + t('sparse', Math.max(1, Math.round(res.expN / (res.time / 3600)))) + '</div>';
    else if(v.k === 'over') msg = '<div class="hc-ch-v">ℹ ' + t('over', Math.round((res.ratio - 1) * 100)) + '</div>';
    else if(v.k === 'unstable') msg = '<div class="hc-ch-v warn">⚠ ' + t('unstable', res.disp.toFixed(1)) + ' ' + t('hint') + '</div>';
    else msg = '<div class="hc-ch-v ' + v.lvl + '">' + (v.lvl === 'bad' ? '🚨 ' : '⚠ ') + t(v.k, Math.round(res.ratio * 100)) + ' ' + t('hint') + '</div>';
    return '<div class="hc-ch-card">' + head + gauge(res, v.lvl) +
      '<div class="hc-ch-row"><span>' + t('shown') + ' <b>' + fmtH(res.rep) + '</b></span><span>' + t('meas') + ' <b>' + fmtH(res.real) + '</b></span></div>' +
      '<div class="hc-ch-row"><span>' + t('rej') + ' <b>' + res.rejPct.toFixed(1) + '%</b></span><span>' + t('stab') + ' ' + stab + '</span></div>' +
      chart(dev.id) + msg + '</div>';
  }
  function body(){
    let devs = []; try { devs = typeof devices !== 'undefined' ? devices : []; } catch(e) {}
    const cards = devs.filter(d => ok(reading(d.id))).map(card).join('');
    return '<p class="hc-ch-intro">' + t('intro') + '</p>' + (cards || '<p class="hc-ch-none">' + t('none') + '</p>');
  }
  function close(){ const n = document.getElementById('hcHrModal'); if(n) n.remove(); }
  window.hcRealOpen = function(){
    close(); sample();
    const ov = document.createElement('div');
    ov.id = 'hcHrModal'; ov.className = 'hc-ch-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="hc-ch-box"><h2>📐 ' + t('menu') + '</h2><div id="hcHrBody">' + body() + '</div><div class="hc-ch-act"><button type="button" class="hc-ch-btn" data-a="x">' + t('close') + '</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if(e.target === ov || e.target.closest('[data-a="x"]')) close(); });
    document.addEventListener('keydown', function k(e){ if(e.key === 'Escape'){ close(); document.removeEventListener('keydown', k); } });
    const iv = setInterval(() => { const b = document.getElementById('hcHrBody'); if(!b){ clearInterval(iv); return; } b.innerHTML = body(); }, 5000);
  };
  window.hcRealLabel = () => '📐 ' + t('menu');
  window.hcReal = { calc, verdict, sample, hist: () => S, feed(id, arr){ S[id] = arr; } };   // diagnóstico na consola
})();
