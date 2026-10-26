// ---------- Cartões: comunidade como um só mineiro ----------
// Quem quiser (opcional) partilha o hashrate total, o número de máquinas e o melhor share. O painel junta toda a
// comunidade Hash Commander ao vivo: hashrate combinado, a chance de bloco como se fosse um só mineiro, um ranking
// e um mural de blocos e recordes. Quando QUALQUER utilizador encontra um bloco, o ecrã de todos celebra ao mesmo tempo.
// Usa o Firebase do chat (nós chat/community, chat/blocks e chat/records; as regras estão em firebase-chat-rules.json).
const MC_COM_KEY = 'nerdqaxe:community_share';
const mcCom = { db: null, uid: '', nick: '', list: {}, feed: { blocks: {}, records: {} }, ready: false, started: false, timer: 0, sentAt: {}, shown: new Set() };
const mcComShare = () => { try { return localStorage.getItem(MC_COM_KEY) === '1'; } catch(e) { return false; } };
const mcComFresh = e => e && (e.ts == null || Date.now() - Number(e.ts) < 4 * 60000);

// o chat avisa quando a ligação ao Firebase está pronta
function mcComStart(){
  const fb = window.hcFb;
  if(mcCom.started || !fb || !fb.db) return;
  mcCom.started = true; mcCom.db = fb.db; mcCom.uid = fb.uid; mcCom.nick = fb.nick;
  const db = mcCom.db;
  db.ref('chat/community').on('value', snap => { mcCom.list = snap.val() || {}; if(typeof mcMapUpdate === 'function') mcMapUpdate(mcCom.list); mcComRender(); }, () => {});
  const feed = (kind, celebrate) => {
    const q = db.ref('chat/' + kind).orderByChild('ts').limitToLast(12);
    q.on('child_added', snap => {
      const v = snap.val();
      if(!v || typeof v !== 'object') return;
      mcCom.feed[kind][snap.key] = v;
      if(celebrate && mcCom.ready && !mcCom.shown.has(snap.key) && Date.now() - Number(v.ts || 0) < 90000) mcComCelebrate(v);
      mcCom.shown.add(snap.key); mcComRender();
    }, () => {});
    q.on('child_removed', snap => { delete mcCom.feed[kind][snap.key]; mcComRender(); }, () => {});
    q.once('value').then(() => { mcCom.ready = true; }).catch(() => { mcCom.ready = true; });
  };
  feed('blocks', true); feed('records', false);
  mcComPublish();
  clearInterval(mcCom.timer); mcCom.timer = setInterval(mcComPublish, 60000);
}
document.addEventListener('hc-chat-ready', mcComStart);
setTimeout(mcComStart, 4000); setInterval(mcComStart, 8000);

function mcComMine(){
  let ghs = 0, n = 0, best = 0, sh = 0;
  (devices || []).forEach(d => {
    const r = readings[d.id];
    if(!r || !r.online) return;
    n++; sh += Number(r.accepted) || 0; if(algoGroupOf(r) === 'sha256') ghs += Number(r.hashrate) || 0;
    best = Math.max(best, Number(r.best) || 0);
  });
  return { ghs, n, best, sh };
}
function mcComPublish(){
  if(!mcCom.db || !mcCom.uid) return;
  const ref = mcCom.db.ref('chat/community/' + mcCom.uid);
  if(!mcComShare()){ ref.remove().catch(() => {}); return; }
  const m = mcComMine();
  ref.onDisconnect().remove();
  const loc = typeof mcMapMyLoc === 'function' ? mcMapMyLoc(mcCom.uid) : null, extra = loc ? { cc: loc.cc, lat: loc.lat, lon: loc.lon } : {};
  ref.set(Object.assign({ nick: mcCom.nick, ghs: Math.round(m.ghs * 100) / 100, n: m.n, best: m.best, sh: m.sh, ts: firebase.database.ServerValue.TIMESTAMP }, extra)).catch(() => { mcCom.denied = true; mcComRender(); });
}
function mcComSetShare(on){
  try { localStorage.setItem(MC_COM_KEY, on ? '1' : '0'); } catch(e) {}
  mcCom.denied = false; mcComPublish();
  if(!on){ const l = mcCom.list; delete l[mcCom.uid]; }
  mcComRender();
}
// blocos e recordes próprios vão para o mural (só se estiver a partilhar; no máximo um de 10 em 10 min)
function mcComBlock(machine){
  if(!mcCom.db || !mcComShare() || Date.now() - (mcCom.sentAt.block || 0) < 10 * 60000) return;
  mcCom.sentAt.block = Date.now();
  mcCom.db.ref('chat/blocks').push({ nick: mcCom.nick, uid: mcCom.uid, machine: String(machine || '').slice(0, 60), ts: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
}
function mcComRecord(machine, best){
  if(!mcCom.db || !mcComShare() || Date.now() - (mcCom.sentAt.record || 0) < 10 * 60000) return;
  mcCom.sentAt.record = Date.now();
  mcCom.db.ref('chat/records').push({ nick: mcCom.nick, uid: mcCom.uid, machine: String(machine || '').slice(0, 60), best: Number(best) || 0, ts: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
}

// ---- celebração para todos ----
function mcComCelebrate(v){
  document.querySelectorAll('.mc-com-boom').forEach(n => n.remove());
  const el = document.createElement('div');
  el.className = 'mc-com-boom'; el.setAttribute('role', 'status');
  el.innerHTML = '<div class="mc-cb-card"><div class="mc-cb-ico">🏆</div><b>' + t('mc_cm_boom') + '</b><span>' + escapeHtml(mct('mc_cm_boom_by', v.nick || '?', v.machine || '—')) + '</span><button type="button" aria-label="✕">✕</button></div>';
  for(let i = 0; i < 60; i++){
    const p = document.createElement('i');
    p.style.setProperty('--x', (Math.random() * 100).toFixed(1) + 'vw'); p.style.setProperty('--d', (2.4 + Math.random() * 2.6).toFixed(2) + 's'); p.style.setProperty('--w', (Math.random() * 1.6).toFixed(2) + 's');
    p.style.setProperty('--r', Math.round(Math.random() * 720) + 'deg'); p.style.background = ['#ffd34a', '#21ffb0', '#4fd6ff', '#ff6b9d', '#fff'][i % 5];
    el.appendChild(p);
  }
  document.body.appendChild(el);
  el.querySelector('button').addEventListener('click', () => el.remove());
  setTimeout(() => el.remove(), 9000);
  if(typeof mcArenaBoom === 'function') mcArenaBoom();
  if(typeof mcMapBurst === 'function') mcMapBurst(v.uid);
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if(AC && typeof mcXp === 'function' && mcXp('confetti')){ const ac = new AC(); [523, 659, 784, 1047].forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + i * .13; o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.08, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + .4); o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + .42); }); }
  } catch(e) {}
}

// ---- painel ----
function mcComEnsure(){
  if($('mcCom')) return;
  const sum = $('mcSummary');
  if(!sum) return;
  const el = document.createElement('section');
  el.id = 'mcCom'; el.className = 'mc-com';
  el.innerHTML = '<div id="mcCmHead"></div><div class="mc-cm-mapwrap" id="mcCmMapWrap"><canvas id="mcCmMap"></canvas><button type="button" class="mc-cm-full" data-cm="mapfull">⛶</button><div class="mc-cm-maplbl" id="mcCmMapLbl"></div></div><div id="mcCmBody"></div>';
  sum.parentNode.insertBefore(el, sum);
  el.addEventListener('change', e => { const s = e.target.closest('[data-cm-loc]'); if(s) mcMapSetCountry(s.value); });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-cm]');
    if(!b) return;
    if(b.dataset.cm === 'share') mcComSetShare(true);
    else if(b.dataset.cm === 'stop') mcComSetShare(false);
    else if(b.dataset.cm === 'mapfull'){ const w = $('mcCmMapWrap'); try { document.fullscreenElement ? document.exitFullscreen() : w.requestFullscreen(); } catch(x) {} }
    else if(b.dataset.cm === 'hide'){ mc.prefs.comHidden = !mc.prefs.comHidden; mcSavePrefs(); mcComRender(); }
  });
  mcComRender();
}
function mcComRender(){
  const el = $('mcCom');
  if(!el) return;
  const on = mc.prefs.xp.community !== false;
  el.hidden = !on;
  if(!on) return;
  const hidden = !!mc.prefs.comHidden, sharing = mcComShare(), loc = typeof mcLocale === 'function' ? mcLocale() : undefined;
  const entries = Object.entries(mcCom.list).filter(([, e]) => mcComFresh(e) && Number(e.ghs) >= 0);
  const mine = sharing ? mcComMine() : null;
  if(mine && mcCom.uid && !mcCom.list[mcCom.uid]) entries.push([mcCom.uid, { nick: mcCom.nick, ghs: mine.ghs, n: mine.n, best: mine.best }]);
  const totalGhs = entries.reduce((s, [, e]) => s + Number(e.ghs || 0), 0), machines = entries.reduce((s, [, e]) => s + Number(e.n || 0), 0);
  const diff = typeof mcArenaNet === 'function' ? mcArenaNet() : 1e14, perDay = totalGhs * 1e9 * 86400 / (diff * 4294967296);
  const f = formatHashrate(totalGhs), fh = totalGhs ? f.value + ' ' + f.unit : '—';
  const days = perDay > 0 ? 1 / perDay : Infinity;
  const oddsTxt = !isFinite(days) ? '—' : days < 1 ? mct('mc_cm_odds_h', Math.max(1, Math.round(days * 24))) : days < 730 ? mct('mc_cm_odds_d', days < 10 ? days.toFixed(1) : Math.round(days).toLocaleString(loc)) : mct('mc_cm_odds_y', (days / 365).toFixed(1));
  const top = entries.sort((a, b) => Number(b[1].ghs) - Number(a[1].ghs)).slice(0, 5);
  const rank = top.map(([id, e], i) => { const h = formatHashrate(Number(e.ghs) || 0); return '<li class="' + (id === mcCom.uid ? 'me' : '') + '"><em>' + (i + 1) + '</em><span>' + escapeHtml(String(e.nick || '?')) + (id === mcCom.uid ? ' <small>(' + t('mc_cm_you') + ')</small>' : '') + '</span><b>' + h.value + ' ' + h.unit + '</b><small>' + (Number(e.n) || 0) + ' ⛏</small></li>'; }).join('');
  const feed = [...Object.values(mcCom.feed.blocks).map(v => Object.assign({ k: 'b' }, v)), ...Object.values(mcCom.feed.records).map(v => Object.assign({ k: 'r' }, v))].sort((a, b) => Number(b.ts) - Number(a.ts)).slice(0, 6);
  const mural = feed.map(v => { const ago = mcAgo(Math.max(0, Date.now() - Number(v.ts || Date.now()))); const bf = v.k === 'r' && v.best ? formatDiff(Number(v.best)) : null;
    return '<li class="' + v.k + '"><i>' + (v.k === 'b' ? '🏆' : '🎯') + '</i><span>' + escapeHtml(v.k === 'b' ? mct('mc_cm_m_block', v.nick || '?', v.machine || '—') : mct('mc_cm_m_rec', v.nick || '?', bf ? bf.value + ' ' + bf.unit : '—')) + '</span><small>' + ago + '</small></li>'; }).join('');
  const action = sharing
    ? '<div class="mc-cm-share on">✓ ' + t('mc_cm_sharing') + ' <button type="button" data-cm="stop">' + t('mc_cm_stop') + '</button><label class="mc-cm-loc" title="' + t('mc_cm_map_privacy') + '">📍 <select data-cm-loc>' + (typeof mcMapOptions === 'function' ? mcMapOptions() : '') + '</select></label>' + (mcCom.denied ? '<em>' + t('mc_cm_denied') + '</em>' : '') + '</div>'
    : '<div class="mc-cm-share"><button type="button" class="join" data-cm="share">🌐 ' + t('mc_cm_join') + '</button><small>' + t('mc_cm_privacy') + '</small></div>';
  const headHtml = '<div class="mc-cm-head"><b>🌐 ' + t('mc_cm_title') + '</b><span class="mc-cm-live"><i></i>' + (window.hcFbCounts ? mct('mc_cm_online', window.hcFbCounts.online) : '') + '</span><button type="button" data-cm="hide" title="' + t(hidden ? 'mc_ls_show' : 'mc_ls_hide') + '">' + (hidden ? '▸' : '▾') + '</button></div>';
  const bodyHtml = (hidden ? '' : '<div class="mc-cm-body"><div class="mc-cm-big"><span>' + t('mc_cm_total') + '</span><b id="mcCmBig">—</b><small>' + mct('mc_cm_miners', entries.length, machines) + '</small><div class="mc-cm-odds"><span>' + t('mc_cm_odds') + '</span><b>' + oddsTxt + '</b></div></div>' +
      '<div class="mc-cm-col"><h4>' + t('mc_cm_rank') + '</h4><ol class="mc-cm-rank">' + (rank || '<li class="empty">' + t('mc_cm_empty') + '</li>') + '</ol></div>' +
      '<div class="mc-cm-col"><h4>' + t('mc_cm_mural') + '</h4><ul class="mc-cm-mural">' + (mural || '<li class="empty">' + t('mc_cm_mural_empty') + '</li>') + '</ul></div></div>' + action);
  el.classList.toggle('collapsed', hidden);
  const sel = el.querySelector('[data-cm-loc]'), busy = sel && document.activeElement === sel;
  if(!busy && el.dataset.s !== headHtml + bodyHtml){ el.dataset.s = headHtml + bodyHtml; $('mcCmHead').innerHTML = headHtml; $('mcCmBody').innerHTML = bodyHtml; }
  const withLoc = entries.filter(([, e]) => typeof e.lat === 'number'), countries = new Set(withLoc.map(([, e]) => e.cc).filter(Boolean));
  const lbl = $('mcCmMapLbl'); if(lbl){ const txt = mct('mc_cm_map_lbl', withLoc.length, countries.size); if(lbl.textContent !== txt) lbl.textContent = txt; }
  if(typeof mcMapEnsure === 'function') mcMapEnsure();
  const big = $('mcCmBig');
  if(big){ if(typeof mcNumTo === 'function') mcNumTo(big, fh); else big.textContent = fh; }
}
setInterval(() => { if($('mcCom') && !document.hidden) mcComRender(); }, 20000);
