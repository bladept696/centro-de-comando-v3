// ---------- Nível e XP do mineiro + missões diárias ----------
// Ganhas XP com tempo online, recordes de best diff, blocos e dias seguidos, e sobes de nível (Aprendiz → Mestre → Lenda).
// Todos os dias há 3 missões novas (ex.: "mantém 12 horas online", "bate o teu best diff de ontem") que dão XP extra.
// O progresso fica neste navegador. O teu nível também é partilhado (chat/levels/<uid>) para aparecer ao lado do nome no chat
// e no ranking, ao lado do cargo, mas só se as regras do Firebase tiverem o nó "levels" (se não tiverem, nada se estraga).
(function(){
  const KEY = 'hc_lvl', LANGS = ['pt', 'en', 'es', 'fr'];
  const TIERS = [
    [1, 'Aprendiz', 'Apprentice', 'Aprendiz', 'Apprenti'], [5, 'Mineiro', 'Miner', 'Minero', 'Mineur'], [10, 'Operador', 'Operator', 'Operador', 'Opérateur'],
    [15, 'Veterano', 'Veteran', 'Veterano', 'Vétéran'], [20, 'Especialista', 'Specialist', 'Especialista', 'Spécialiste'],
    [30, 'Mestre', 'Master', 'Maestro', 'Maître'], [40, 'Lenda', 'Legend', 'Leyenda', 'Légende']
  ];
  const TX = {
    menu: ['Nível e missões', 'Level & missions', 'Nivel y misiones', 'Niveau et missions'],
    lvl: ['Nível', 'Level', 'Nivel', 'Niveau'], xp: ['XP', 'XP', 'XP', 'XP'],
    next: ['para o nível {0}', 'to level {0}', 'para el nivel {0}', 'pour le niveau {0}'],
    streak: ['dias seguidos', 'day streak', 'días seguidos', 'jours de suite'], best: ['melhor', 'best', 'mejor', 'meilleur'],
    missions: ['Missões de hoje', "Today's missions", 'Misiones de hoy', "Missions d'aujourd'hui"],
    stats: ['Totais', 'Totals', 'Totales', 'Totaux'],
    hours: ['horas online', 'hours online', 'horas en línea', 'heures en ligne'], recs: ['recordes', 'records', 'récords', 'records'],
    blocks: ['blocos', 'blocks', 'bloques', 'blocs'], shares: ['shares', 'shares', 'shares', 'shares'],
    titles: ['Títulos', 'Titles', 'Títulos', 'Titres'],
    how: ['Como ganhar XP: tempo online (só conta com o painel aberto), recordes de best diff, blocos, dias seguidos (1 h online por dia) e missões.', 'How to earn XP: time online (only counts while the panel is open), best diff records, blocks, day streaks (1 h online per day) and missions.', 'Cómo ganar XP: tiempo en línea (solo cuenta con el panel abierto), récords de best diff, bloques, días seguidos (1 h en línea al día) y misiones.', "Comment gagner de l'XP : temps en ligne (seulement panneau ouvert), records de best diff, blocs, jours de suite (1 h en ligne par jour) et missions."],
    close: ['Fechar', 'Close', 'Cerrar', 'Fermer'],
    up: ['Subiste para o nível {0} · {1}', 'You reached level {0} · {1}', 'Subiste al nivel {0} · {1}', 'Niveau {0} atteint · {1}'],
    done: ['Missão cumprida: {0} (+{1} XP)', 'Mission complete: {0} (+{1} XP)', 'Misión cumplida: {0} (+{1} XP)', 'Mission accomplie : {0} (+{1} XP)'],
    stk: ['Dia {0} seguido! +{1} XP', 'Day {0} in a row! +{1} XP', '¡Día {0} seguido! +{1} XP', 'Jour {0} de suite ! +{1} XP'],
    rec: ['Novo recorde! +{0} XP', 'New record! +{0} XP', '¡Nuevo récord! +{0} XP', 'Nouveau record ! +{0} XP'],
    blk: ['Bloco encontrado! +{0} XP', 'Block found! +{0} XP', '¡Bloque encontrado! +{0} XP', 'Bloc trouvé ! +{0} XP']
  };
  const MIS = {
    online6: { reward: 60, target: 360, t: ['Mantém 6 horas online', 'Keep 6 hours online', 'Mantén 6 horas en línea', 'Reste 6 heures en ligne'], unit: 'min' },
    online12: { reward: 120, target: 720, t: ['Mantém 12 horas online', 'Keep 12 hours online', 'Mantén 12 horas en línea', 'Reste 12 heures en ligne'], unit: 'min' },
    rec2: { reward: 80, target: 2, t: ['Faz 2 recordes de best diff', 'Set 2 best diff records', 'Haz 2 récords de best diff', 'Fais 2 records de best diff'], unit: '' },
    shares: { reward: 70, target: 5000, t: ['Aceita 5000 shares', 'Get 5000 shares accepted', 'Acepta 5000 shares', 'Fais accepter 5000 shares'], unit: '' },
    cool: { reward: 60, target: 240, t: ['Máquinas abaixo de 60 °C durante 4 horas', 'Machines under 60 °C for 4 hours', 'Máquinas bajo 60 °C durante 4 horas', 'Machines sous 60 °C pendant 4 heures'], unit: 'min' },
    beat: { reward: 100, target: 1, t: ['Bate o teu best diff de ontem', "Beat yesterday's best diff", 'Supera tu best diff de ayer', 'Bats ton best diff de la veille'], unit: '' }
  };
  const DAY_TIME_XP = 400, DAY_REC_XP = 250, REC_XP = 25, BLOCK_XP = 1000;
  const lang = () => { try { const l = typeof currentLang !== 'undefined' ? currentLang : 'pt'; return LANGS.includes(l) ? l : 'pt'; } catch(e) { return 'pt'; } };
  const li = () => LANGS.indexOf(lang());
  const t = (k, ...a) => { let s = TX[k][li()]; a.forEach((v, i) => { s = s.split('{' + i + '}').join(v); }); return s; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---- níveis ----
  const need = n => Math.round(100 * Math.pow(Math.max(0, n - 1), 1.7));      // XP total para chegar ao nível n
  const levelOf = xp => { let n = 1; while(n < 99 && need(n + 1) <= xp) n++; return n; };
  const tierIdx = lv => { let k = 0; TIERS.forEach((x, i) => { if(lv >= x[0]) k = i; }); return k; };
  const titleOf = lv => TIERS[tierIdx(lv)][1 + li()];

  // ---- estado ----
  const pad = n => String(n).padStart(2, '0');
  const keyOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => keyOf(new Date());
  const prevKey = k => { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() - 1); return keyOf(d); };
  let S = load();
  function load(){
    let s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch(e) {}
    return { xp: Number(s.xp) || 0, tot: Object.assign({ min: 0, rec: 0, blk: 0, sh: 0 }, s.tot || {}), streak: Number(s.streak) || 0, bestStreak: Number(s.bestStreak) || 0, last: s.last || '', days: s.days || {} };
  }
  function save(){
    const ks = Object.keys(S.days).sort();
    while(ks.length > 4) delete S.days[ks.shift()];
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e) {}
  }
  const hash = s => { let h = 7; for(let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  function pickMissions(k, yBest){
    let h = hash(k); const rnd = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
    const pool = ['rec2', 'shares', 'cool'].concat(yBest > 0 ? ['beat'] : []);
    for(let i = pool.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return [rnd() < 0.5 ? 'online6' : 'online12', pool[0], pool[1]];
  }
  function day(k){
    k = k || today();
    if(!S.days[k]){
      const yb = (S.days[prevKey(k)] || {}).best || 0;
      S.days[k] = { min: 0, cool: 0, sh: 0, rec: 0, best: 0, xpt: 0, xpr: 0, yb, m: pickMissions(k, yb), done: {}, stk: false };
    }
    return S.days[k];
  }
  const progOf = (id, D) => id === 'online6' || id === 'online12' ? D.min : id === 'rec2' ? D.rec : id === 'shares' ? D.sh : id === 'cool' ? D.cool : id === 'beat' ? (D.yb > 0 && D.best > D.yb ? 1 : 0) : 0;

  // ---- avisos ----
  function toast(text, big){
    try {
      let box = document.getElementById('hcLvToasts');
      if(!box){ box = document.createElement('div'); box.id = 'hcLvToasts'; document.body.appendChild(box); }
      const el = document.createElement('div'); el.className = 'hc-lv-toast' + (big ? ' big' : ''); el.textContent = text; box.appendChild(el);
      setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, big ? 6000 : 4000);
    } catch(e) {}
  }
  function addXp(n, why){
    n = Math.round(n); if(!(n > 0)) return;
    const before = levelOf(S.xp); S.xp += n; const after = levelOf(S.xp);
    if(after > before){ toast('🎉 ' + t('up', after, titleOf(after)), true); publish(); }
    save();
    if(why) toast(why);
  }

  // ---- motor (1 vez por minuto) ----
  let lastTick = Date.now(); const lastAcc = {};
  function tick(){
    const now = Date.now(), el = Math.min(3, Math.max(0, (now - lastTick) / 60000)); lastTick = now;
    let devs = [], rd = {};
    try { devs = typeof devices !== 'undefined' ? devices : []; rd = typeof readings !== 'undefined' ? readings : {}; } catch(e) {}
    const k = today(), D = day(k), on = devs.filter(d => rd[d.id] && rd[d.id].online === true);
    let hot = 0;
    on.forEach(d => {
      const r = rd[d.id], tp = Number(r.temp) || 0; if(tp > hot) hot = tp;
      const acc = Number(r.accepted) || 0, prev = lastAcc[d.id]; lastAcc[d.id] = acc;
      if(prev != null && acc > prev && acc - prev < 1e6){ D.sh += acc - prev; S.tot.sh += acc - prev; }
      const b = Number(r.best) || 0; if(b > D.best) D.best = b;
    });
    if(on.length){
      D.min += el; S.tot.min += el;
      if(hot < 60) D.cool += el;
      const gain = Math.min(el * 0.5, DAY_TIME_XP - D.xpt); if(gain > 0){ D.xpt += gain; S.xp += gain; }
      if(D.min >= 60 && !D.stk){
        D.stk = true; S.streak = S.last === prevKey(k) ? S.streak + 1 : 1; S.last = k; S.bestStreak = Math.max(S.bestStreak, S.streak);
        const bonus = 15 + 5 * Math.min(S.streak, 30); addXp(bonus, '🔥 ' + t('stk', S.streak, bonus));
      }
    }
    D.m.forEach(id => {
      if(D.done[id]) return;
      if(progOf(id, D) >= MIS[id].target){ D.done[id] = true; addXp(MIS[id].reward, '✅ ' + t('done', MIS[id].t[li()], MIS[id].reward)); }
    });
    save(); refresh();
  }

  // ---- eventos do painel ----
  if(typeof window.recordBestDiffEvent === 'function'){
    const orig = window.recordBestDiffEvent;
    window.recordBestDiffEvent = function(){
      const r = orig.apply(this, arguments);
      try { const D = day(); D.rec++; S.tot.rec++; if(D.xpr < DAY_REC_XP){ const g = Math.min(REC_XP, DAY_REC_XP - D.xpr); D.xpr += g; addXp(g, '🏆 ' + t('rec', g)); } else save(); refresh(); } catch(e) {}
      return r;
    };
  }
  if(typeof window.addNotification === 'function'){
    const origN = window.addNotification;
    window.addNotification = function(type){
      const r = origN.apply(this, arguments);
      try { if(type === 'block'){ S.tot.blk++; addXp(BLOCK_XP, '⛏ ' + t('blk', BLOCK_XP)); } } catch(e) {}
      return r;
    };
  }

  // ---- partilha com a comunidade (ao lado do nome) ----
  let others = {}, listening = false;
  const myUid = () => { try { return firebase.auth().currentUser.uid; } catch(e) { return ''; } };
  function publish(){
    try {
      const f = window.hcFb, u = myUid(); if(!f || !f.db || !u) return;
      f.db.ref('chat/levels/' + u).set({ lv: levelOf(S.xp) }).catch(() => {});
    } catch(e) {}
  }
  function listen(){
    const f = window.hcFb;
    if(!f || !f.db || listening) return; listening = true;
    f.db.ref('chat/levels').on('value', snap => { others = snap.val() || {}; document.dispatchEvent(new Event('hc-roles')); }, () => {});
  }
  document.addEventListener('hc-chat-ready', () => { listen(); setTimeout(publish, 2000); });
  setTimeout(listen, 4000); setInterval(listen, 9000);
  setInterval(publish, 600000);

  window.hcLvlTag = uid => {
    if(!uid) return '';
    const lv = uid === myUid() ? levelOf(S.xp) : Number((others[uid] || {}).lv) || 0;
    if(!(lv > 0)) return '';
    return ' <span class="hc-lv t' + tierIdx(lv) + '" title="' + esc(titleOf(lv)) + '">' + (lang() === 'pt' ? 'Nv ' : 'Lv ') + lv + '</span>';
  };

  // ---- janela ----
  const streakNow = () => (S.last === today() || S.last === prevKey(today())) ? S.streak : 0;
  const fmtMin = m => { m = Math.floor(m); return Math.floor(m / 60) + 'h' + pad(m % 60); };
  function body(){
    const lv = levelOf(S.xp), a = need(lv), b = need(lv + 1), pct = Math.max(0, Math.min(100, (S.xp - a) / (b - a) * 100)), D = day();
    const ms = D.m.map(id => {
      const M = MIS[id], p = Math.min(progOf(id, D), M.target), ok = !!D.done[id];
      const txt = M.unit === 'min' ? fmtMin(p) + ' / ' + fmtMin(M.target) : Math.floor(p) + ' / ' + M.target;
      return '<div class="hc-lv-m' + (ok ? ' ok' : '') + '"><div class="hc-lv-mh"><span>' + (ok ? '✅ ' : '🎯 ') + esc(M.t[li()]) + '</span><b>+' + M.reward + ' XP</b></div>' +
        '<div class="hc-lv-bar"><i style="width:' + (p / M.target * 100) + '%"></i></div><div class="hc-lv-mp">' + txt + '</div></div>';
    }).join('');
    const ladder = TIERS.map((x, i) => '<span class="hc-lv t' + i + (lv >= x[0] ? '' : ' off') + '">' + (lang() === 'pt' ? 'Nv ' : 'Lv ') + x[0] + ' · ' + x[1 + li()] + '</span>').join(' ');
    return '<div class="hc-lv-hero"><div class="hc-lv-n t' + tierIdx(lv) + '">' + lv + '</div><div><div class="hc-lv-title">' + esc(titleOf(lv)) + '</div><div class="hc-lv-xp">' + Math.floor(S.xp) + ' XP · ' + t('next', lv + 1) + ': ' + Math.max(0, Math.ceil(b - S.xp)) + '</div></div></div>' +
      '<div class="hc-lv-bar big"><i style="width:' + pct + '%"></i></div>' +
      '<div class="hc-lv-chips"><span>🔥 ' + streakNow() + ' ' + t('streak') + '</span><span>🏅 ' + t('best') + ': ' + S.bestStreak + '</span></div>' +
      '<div class="hc-lv-sec">' + t('missions') + '</div>' + ms +
      '<div class="hc-lv-sec">' + t('stats') + '</div><div class="hc-lv-tot"><span><b>' + Math.floor(S.tot.min / 60) + '</b> ' + t('hours') + '</span><span><b>' + S.tot.rec + '</b> ' + t('recs') + '</span><span><b>' + S.tot.blk + '</b> ' + t('blocks') + '</span><span><b>' + Math.floor(S.tot.sh).toLocaleString() + '</b> ' + t('shares') + '</span></div>' +
      '<div class="hc-lv-sec">' + t('titles') + '</div><div class="hc-lv-ladder">' + ladder + '</div><p class="hc-lv-how">' + t('how') + '</p>';
  }
  // ---- na conta (círculo com a inicial, no cabeçalho): selo com o nível + cartão no menu ----
  function paintAcct(){
    const av = document.getElementById('acctToggle'), card = document.getElementById('acctLevel'), badge = document.getElementById('acctLvl');
    if(!av) return;
    const lv = levelOf(S.xp), a = need(lv), b = need(lv + 1), pct = Math.max(0, Math.min(100, (S.xp - a) / (b - a) * 100));
    if(badge){ badge.textContent = lv; badge.className = 't' + tierIdx(lv); badge.title = (lang() === 'pt' ? 'Nível ' : 'Level ') + lv + ' · ' + titleOf(lv); }
    if(card) card.innerHTML = '<span class="n t' + tierIdx(lv) + '">' + lv + '</span><span class="tx"><b>' + esc(titleOf(lv)) + '</b><small>' + Math.floor(S.xp) + ' XP · 🔥 ' + streakNow() + '</small><span class="bar"><i style="width:' + pct + '%"></i></span></span>';
  }
  function hookAcct(){
    const av = document.getElementById('acctToggle'), menu = document.getElementById('acctMenu');
    if(!av || !menu) return false;
    if(!document.getElementById('acctLvl')){ const i = document.createElement('i'); i.id = 'acctLvl'; av.appendChild(i); }
    if(!document.getElementById('acctLevel')){
      const bt = document.createElement('button'); bt.type = 'button'; bt.id = 'acctLevel'; bt.className = 'acct-lvlcard';
      menu.insertBefore(bt, document.getElementById('authAccount') || menu.firstChild);
      bt.addEventListener('click', () => { menu.hidden = true; av.setAttribute('aria-expanded', 'false'); open(); });
    }
    paintAcct(); return true;
  }
  (function waitAcct(n){ if(!hookAcct() && n < 60) setTimeout(() => waitAcct(n + 1), 500); })(0);

  function refresh(){ const n = document.getElementById('hcLvBody'); if(n) n.innerHTML = body(); paintAcct(); }
  function close(){ const n = document.getElementById('hcLvModal'); if(n) n.remove(); }
  function open(){
    close(); tick();
    const ov = document.createElement('div');
    ov.id = 'hcLvModal'; ov.className = 'hc-lv-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="hc-lv-box"><h2>🏅 ' + t('menu') + '</h2><div id="hcLvBody">' + body() + '</div><div class="hc-lv-act"><button type="button" class="hc-lv-btn" data-a="x">' + t('close') + '</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if(e.target === ov || e.target.closest('[data-a="x"]')) close(); });
    document.addEventListener('keydown', function esc2(e){ if(e.key === 'Escape'){ close(); document.removeEventListener('keydown', esc2); } });
  }

  window.hcLvlOpen = open;
  window.hcLvlLabel = () => '🏅 ' + (lang() === 'pt' ? 'Nv ' : 'Lv ') + levelOf(S.xp) + ' · ' + titleOf(levelOf(S.xp));
  window.hcLvl = { state: () => S, levelOf, need, tick, day };   // para diagnóstico na consola

  setInterval(tick, 60000);
  setTimeout(tick, 8000);
})();
