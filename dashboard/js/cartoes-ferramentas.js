// ---------- Cartões: menu ⚙ (backup e restauro, procura de máquinas novas) e agendamentos ----------
// Tudo corre no browser enquanto a dashboard está aberta. Complementa cartoes.js e cartoes-extra.js.
const MC_SCHED_KEY = 'nerdqaxe:schedules';
const MC_IGN_KEY = 'nerdqaxe:scan_ignored';
const MC_BACKUP_APP = 'hash-commander-backup';
mc.found = [];
mc.sched = (() => { try { const a = JSON.parse(localStorage.getItem(MC_SCHED_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch(e) { return []; } })();
mc.ignored = (() => { try { return new Set(JSON.parse(localStorage.getItem(MC_IGN_KEY) || '[]')); } catch(e) { return new Set(); } })();
const mcToday = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

// ---------------- menu ⚙: grupos com mosaicos (ícone grande + nome curto) ----------------
const MC_MENU_GROUPS = [
  ['data', ['export', 'import']],
  ['alerts', ['pause', 'sched', 'rules', 'limits', 'valerts', 'tariff']],
  ['net', ['scan', 'remote', 'lock']],
  ['panel', ['report', 'xp', 'chips', 'level', 'help']]
];
const MC_MENU_GTX = {
  data: ['Dados e cópias', 'Data & backups', 'Datos y copias', 'Données et sauvegardes'],
  alerts: ['Alertas e regras', 'Alerts & rules', 'Alertas y reglas', 'Alertes et règles'],
  net: ['Rede e acesso', 'Network & access', 'Red y acceso', 'Réseau et accès'],
  panel: ['Painel e extras', 'Panel & extras', 'Panel y extras', 'Tableau et extras']
};
function mcMenuLabel(k){
  switch(k){
    case 'export': return t('mc_m_export'); case 'import': return t('mc_m_import');
    case 'scan': return (mc.prefs.autoScan ? '✅ ' : '⬜ ') + t('mc_m_scan').replace(/^[☑☐]\s*/, '');
    case 'sched': return t('mc_m_sched'); case 'rules': return t('mc_m_rules'); case 'xp': return t('mc_m_xp');
    case 'tariff': return t('mc_m_tariff'); case 'limits': return t('mc_m_limits');
    case 'lock': return t(mc.locked ? 'mc_m_unlock' : 'mc_m_lock'); case 'report': return t('mc_m_report');
    case 'remote': return typeof hcRemoteLabel === 'function' ? hcRemoteLabel() : '🌐 Acesso remoto';
    case 'chips': return typeof hcChipsLabel === 'function' ? hcChipsLabel() : '🧩 Saúde dos chips';
    case 'level': return typeof hcLvlLabel === 'function' ? hcLvlLabel() : '🏅 Nível e missões';
    case 'valerts': return typeof hcVoiceAlertsLabel === 'function' ? hcVoiceAlertsLabel() : '🔊 Alertas por voz';
    case 'help': return t('mc_m_help');
  }
  return k;
}
function mcMenuTile(k){
  const raw = String(mcMenuLabel(k)).trim(), m = raw.match(/^((?:\p{Extended_Pictographic}|[\uFE0F\u200D])+)\s*(.*)$/u);
  const ic = m ? m[1] : '•', tx = m ? m[2] : raw;
  return '<button type="button" class="mc-tile' + (k === 'scan' && mc.prefs.autoScan ? ' on' : '') + '" data-m="' + k + '" title="' + String(tx).replace(/"/g, '&quot;') + '"><i>' + ic + '</i><span>' + tx + '</span></button>';
}
function mcMenuHtml(){
  const li = Math.max(0, ['pt', 'en', 'es', 'fr'].indexOf(typeof currentLang !== 'undefined' ? currentLang : 'pt'));
  return MC_MENU_GROUPS.map(([g, ks]) =>
    '<div class="mc-mg"><div class="mc-mgt">' + MC_MENU_GTX[g][li] + '</div><div class="mc-mgrid">' +
    ks.map(k => k === 'pause'
      ? '<div class="mc-menu-row"><span>' + t('mc_m_pause') + '</span><button type="button" data-m="pause60">1 h</button><button type="button" data-m="pause240">4 h</button><button type="button" data-m="pause720">12 h</button></div>'
      : mcMenuTile(k)).join('') + '</div></div>').join('');
}


// ---------------- menu ⚙ ----------------
function mcCloseMenu(){ const m = $('mcMenu'); if(m) m.remove(); }
function mcToggleMenu(){
  if($('mcMenu')){ mcCloseMenu(); return; }
  const btn = $('mcMenuBtn');
  if(!btn) return;
  const m = document.createElement('div');
  m.id = 'mcMenu'; m.className = 'mc-menu';
  m.classList.add('mc-menu2');
  m.innerHTML = mcMenuHtml();
  if(mc.locked){
    m.querySelectorAll('[data-m]').forEach(b => { if(!['export', 'report', 'help', 'lock'].includes(b.dataset.m)) b.remove(); });
    m.querySelectorAll('.mc-menu-row').forEach(r => r.remove());
    m.querySelectorAll('.mc-mg').forEach(g => { if(!g.querySelector('[data-m]')) g.remove(); });
  }
  const br = btn.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, side = vw >= 900 && br.left < vw / 2;
  m.style.position = 'fixed'; m.style.zIndex = '10050'; m.style.right = 'auto';
  if(side){
    // aba lateral esquerda: o menu abre ao lado do botão
    m.style.left = Math.min(br.right + 8, vw - 360) + 'px';
    m.style.maxHeight = Math.max(280, Math.min(640, vh - 16)) + 'px';
    document.body.appendChild(m);
    m.style.top = Math.max(8, Math.min(br.top, vh - m.getBoundingClientRect().height - 8)) + 'px';
  } else {
    m.style.top = (br.bottom + 6) + 'px';
    m.style.maxHeight = Math.max(240, Math.min(620, vh - br.bottom - 20)) + 'px';
    document.body.appendChild(m);
    m.style.left = Math.max(8, Math.min(br.left, vw - m.getBoundingClientRect().width - 8)) + 'px';
  }
}
window.addEventListener('scroll', () => mcCloseMenu(), { passive: true });
document.addEventListener('click', e => {
  if(e.target.closest('#mcMenuBtn')){ mcToggleMenu(); return; }
  const it = e.target.closest('#mcMenu [data-m]');
  if(!it){ if(!e.target.closest('#mcMenu')) mcCloseMenu(); return; }
  const k = it.dataset.m;
  mcCloseMenu();
  if(k === 'export') mcBackupExport();
  else if(k === 'import') mcBackupPick();
  else if(k === 'scan'){ mc.prefs.autoScan = !mc.prefs.autoScan; mcSavePrefs(); if(mc.prefs.autoScan){ setQuickActionStatus(t('mc_sc_scanning')); mcScanNow(true); } else { mc.found = []; mcNewRender(); } }
  else if(k.startsWith('pause')){ mcPauseAlerts(Number(k.slice(5))); }
  else if(k === 'rules'){ if(typeof mcRulesOpen === 'function') mcRulesOpen(); }
  else if(k === 'xp'){ if(typeof mcXpOpen === 'function') mcXpOpen(); }
  else if(k === 'tariff'){ if(typeof mcTariffOpen === 'function') mcTariffOpen(); }
  else if(k === 'limits'){ if(typeof mcLimitsOpen === 'function') mcLimitsOpen(); }
  else if(k === 'lock'){ mcLockToggle(); }
  else if(k === 'report'){ if(typeof mcReportOpen === 'function') mcReportOpen(); }
  else if(k === 'remote'){ if(typeof hcRemoteOpen === 'function') hcRemoteOpen(); }
  else if(k === 'chips'){ if(typeof hcChipsOpen === 'function') hcChipsOpen(); }
  else if(k === 'level'){ if(typeof hcLvlOpen === 'function') hcLvlOpen(); }
  else if(k === 'valerts'){ if(typeof hcVoiceAlertsOpen === 'function') hcVoiceAlertsOpen(); }
  else if(k === 'help'){ if(typeof mcHelpToggle === 'function') mcHelpToggle(); }
  else if(k === 'sched'){ const d = $('mcSched'); if(d){ d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }
});

// ---------------- backup e restauro ----------------
function mcBackupExport(){
  const keep = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  const data = {
    app: MC_BACKUP_APP, version: 1, date: new Date().toISOString(),
    devices: (devices || []).map(d => keep({ name: d.name, ip: d.ip, group: d.group, note: d.note, expected: d.expected, pin: d.pin })),
    prefs: mc.prefs, thresholds: mc.th, kwhPrice: mcPrice() || null, tariff: mcTariff(), schedules: mc.sched, rules: typeof mc.rules !== 'undefined' ? mc.rules : [],
    quickProfiles: (() => { try { return JSON.parse(localStorage.getItem(QUICK_PROFILE_KEY) || '{}'); } catch(e) { return {}; } })()
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = 'hash-commander-backup-' + mcToday() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  setQuickActionStatus(mct('mc_bk_exported', data.devices.length));
}
function mcBackupPick(){
  let inp = $('mcImportFile');
  if(!inp){
    inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json'; inp.id = 'mcImportFile'; inp.hidden = true;
    inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; inp.value = ''; if(f) mcBackupImport(f); });
    document.body.appendChild(inp);
  }
  inp.click();
}
function mcBackupImport(file){
  const rd = new FileReader();
  rd.onload = () => {
    let o;
    try { o = JSON.parse(String(rd.result)); } catch(e) { alert(t('mc_bk_bad')); return; }
    if(!o || o.app !== MC_BACKUP_APP || !Array.isArray(o.devices)){ alert(t('mc_bk_bad')); return; }
    if(!confirm(mct('mc_bk_confirm', o.devices.length))) return;
    let added = 0, updated = 0;
    o.devices.forEach(d => {
      const ip = d && String(d.ip || '').trim();
      if(!ip || !/^[A-Za-z0-9.\-:]{3,60}$/.test(ip)) return;
      const f = {};
      if(d.name) f.name = String(d.name).slice(0, 40);
      if(d.group) f.group = String(d.group).slice(0, 24);
      if(d.note) f.note = String(d.note).slice(0, 300);
      if(Number(d.expected) > 0) f.expected = Math.round(Number(d.expected) * 1000) / 1000;
      if(d.pin) f.pin = true;
      const cur = devices.find(x => x.ip === ip);
      if(cur){ Object.assign(cur, f); updated++; }
      else { const id = 'm_' + Math.random().toString(36).slice(2, 9); devices.push(Object.assign({ id, name: f.name || ip, ip }, f)); histories[id] = []; added++; }
    });
    if(o.prefs && typeof o.prefs === 'object') ['filter', 'sort', 'view', 'groupBy', 'range', 'fx', 'autoScan'].forEach(k => { if(k in o.prefs) mc.prefs[k] = o.prefs[k]; });
    if(o.thresholds && typeof o.thresholds === 'object'){ Object.keys(MC_TH_DEFAULT).forEach(k => { if(isFinite(Number(o.thresholds[k]))) mc.th[k] = Number(o.thresholds[k]); }); try { localStorage.setItem(MC_TH_KEY, JSON.stringify(mc.th)); } catch(e) {} }
    if(o.tariff && typeof o.tariff === 'object'){ try { localStorage.setItem(MC_TARIFF_KEY, JSON.stringify(o.tariff)); } catch(e) {} }
    if(Number(o.kwhPrice) > 0){ try { localStorage.setItem(MC_PRICE_KEY, String(o.kwhPrice)); } catch(e) {} }
    if(o.quickProfiles && typeof o.quickProfiles === 'object'){ try { localStorage.setItem(QUICK_PROFILE_KEY, JSON.stringify(o.quickProfiles)); } catch(e) {} }
    if(Array.isArray(o.schedules)){ mc.sched = o.schedules.filter(r => r && /^\d\d:\d\d$/.test(r.time) && Array.isArray(r.days) && ['eco', 'turbo'].includes(r.slot)).map(r => ({ id: String(r.id || Math.random().toString(36).slice(2, 8)), time: r.time, days: r.days.map(Number).filter(n => n >= 0 && n <= 6), slot: r.slot, target: String(r.target || 'all'), on: r.on !== false, last: '' })); mcSchedSave(); }
    if(Array.isArray(o.rules) && typeof mcRulesImport === 'function') mcRulesImport(o.rules);
    mcSavePrefs(); saveDevices();
    mc.lang = null;   // refaz a interface com os valores novos
    renderAll();
    setQuickActionStatus(mct('mc_bk_done', added, updated));
    if(typeof pollAll === 'function') pollAll();
  };
  rd.readAsText(file);
}

// ---------------- máquinas novas na rede ----------------
let mcScanBusy = false;
async function mcScanNow(force){
  if(mcScanBusy || (!force && (document.hidden || !mc.prefs.autoScan))) return;
  mcScanBusy = true;
  try {
    if(window.authReady) await window.authReady;
    const resp = await fetch(`${API_BASE}/api/scan`);
    if(!resp.ok) throw new Error('scan');
    const data = await resp.json();
    const known = new Set((devices || []).map(d => d.ip));
    try { scanResultsCache = (data.devices || []).slice(); if(data.subnet) scanResultsSubnet = data.subnet; } catch(e2) {}   // também aparecem no mapa da rede
    mc.found = (data.devices || []).filter(d => d && d.ip && !known.has(d.ip) && !mc.ignored.has(d.ip));
    if(force) setQuickActionStatus(mc.found.length ? mct('mc_nf_found', mc.found.length) : t('mc_nf_none'));
  } catch(e) { if(force) setQuickActionStatus(t('mc_nf_err')); }
  mcScanBusy = false;
  mcNewRender();
  try { if(typeof renderNetworkMap === 'function') renderNetworkMap(); } catch(e3) {}
}
function mcNewRender(){
  const box = $('mcNew');
  if(!box) return;
  const known = new Set((devices || []).map(d => d.ip));
  mc.found = mc.found.filter(d => !known.has(d.ip));
  box.hidden = !mc.found.length;
  if(!mc.found.length){ box.innerHTML = ''; return; }
  const list = mc.found.slice(0, 4).map(d => '<b>' + escapeHtml(d.ip) + '</b>' + (d.hostname && d.hostname !== d.ip ? ' (' + escapeHtml(d.hostname) + ')' : '')).join(', ') + (mc.found.length > 4 ? '…' : '');
  const h = '<span>🔎 ' + mct(mc.found.length === 1 ? 'mc_nf_one' : 'mc_nf_many', mc.found.length) + ' ' + list + '</span><button type="button" data-n="add">' + t('mc_nf_add') + '</button><button type="button" data-n="ignore">' + t('mc_nf_ignore') + '</button>';
  if(box.dataset.s !== h){ box.dataset.s = h; box.innerHTML = h; }
}
document.addEventListener('click', e => {
  const b = e.target.closest('#mcNew [data-n]');
  if(!b) return;
  if(b.dataset.n === 'add') mc.found.forEach(d => addDevice(d.hostname && d.hostname !== d.ip ? d.hostname : '', d.ip));
  else { mc.found.forEach(d => mc.ignored.add(d.ip)); try { localStorage.setItem(MC_IGN_KEY, JSON.stringify([...mc.ignored])); } catch(e2) {} }
  mc.found = []; mcNewRender();
});
setTimeout(() => mcScanNow(false), 25000);
setInterval(() => mcScanNow(false), 30 * 60000);

// ---------------- agendamentos (Eco/Turbo a uma hora) ----------------
function mcSchedSave(){ try { localStorage.setItem(MC_SCHED_KEY, JSON.stringify(mc.sched)); } catch(e) {} }
function mcSchedTargetLabel(tg){
  if(tg === 'all') return t('mc_sc_all');
  if(tg.startsWith('g:')) return '🗂 ' + tg.slice(2);
  const d = (devices || []).find(x => 'd:' + x.id === tg);
  return d ? (d.name || d.ip) : '?';
}
function mcSchedDays(days){
  if(days.length === 7) return t('mc_sc_everyday');
  return [...days].sort().map(d => new Date(2024, 0, 7 + d).toLocaleDateString(mcLocale(), { weekday: 'short' })).join(' ');
}
function mcSchedRender(){
  const body = $('mcSchedBody');
  if(!body) return;
  if($('mcSchedN')) $('mcSchedN').textContent = mc.sched.length;
  if(body.dataset.lang !== currentLang){
    body.dataset.lang = currentLang;
    const dayBoxes = [1, 2, 3, 4, 5, 6, 0].map(d => '<label><input type="checkbox" data-d="' + d + '" checked> ' + new Date(2024, 0, 7 + d).toLocaleDateString(mcLocale(), { weekday: 'short' }) + '</label>').join('');
    body.innerHTML = '<div id="mcSchedList"></div><div class="mc-sched-form"><input type="time" id="mcScTime" value="22:00"><div class="mc-sc-days">' + dayBoxes + '</div>' +
      '<select id="mcScSlot"></select><select id="mcScTarget"></select><button type="button" id="mcScAdd">' + t('mc_sc_add') + '</button></div><div class="mc-sched-note">' + t('mc_sc_note') + '</div>';
    $('mcScAdd').addEventListener('click', () => {
      const days = [...body.querySelectorAll('[data-d]')].filter(x => x.checked).map(x => Number(x.dataset.d));
      const slot = $('mcScSlot').value, time = $('mcScTime').value;
      if(!time || !days.length || !slot){ setQuickActionStatus(t('mc_sc_incomplete')); return; }
      mc.sched.push({ id: Math.random().toString(36).slice(2, 8), time, days, slot, target: $('mcScTarget').value, on: true, last: '' });
      mcSchedSave(); mcSchedRender();
    });
    body.addEventListener('click', e => {
      const b = e.target.closest('[data-sc]');
      if(!b) return;
      const r = mc.sched.find(x => x.id === b.dataset.id);
      if(b.dataset.sc === 'del') mc.sched = mc.sched.filter(x => x.id !== b.dataset.id);
      else if(r) r.on = !r.on;
      mcSchedSave(); mcSchedRender();
    });
  }
  // opções de perfil e de alvo (dependem das máquinas e dos perfis guardados)
  const slots = ['eco', 'turbo'].map(s => [s, typeof getQuickSlot === 'function' ? getQuickSlot(s) : null]).filter(x => x[1]);
  const so = slots.length ? slots.map(([s, p]) => '<option value="' + s + '">' + (s === 'eco' ? '🌿 ' : '🚀 ') + escapeHtml(p.name) + '</option>').join('') : '<option value="">' + t('mc_sc_noprof') + '</option>';
  const to = '<option value="all">' + t('mc_sc_all') + '</option>' + mcGroupsOf(devices || []).map(g => '<option value="g:' + escapeHtml(g) + '">🗂 ' + escapeHtml(g) + '</option>').join('') + (devices || []).map(d => '<option value="d:' + escapeHtml(String(d.id)) + '">' + escapeHtml(d.name || d.ip) + '</option>').join('');
  [['mcScSlot', so], ['mcScTarget', to]].forEach(([id, h]) => { const n = $(id); if(n && n.dataset.s !== h && document.activeElement !== n){ const v = n.value; n.dataset.s = h; n.innerHTML = h; if(v) n.value = v; } });
  const list = $('mcSchedList'), lh = mc.sched.length ? mc.sched.map(r => {
    const p = typeof getQuickSlot === 'function' ? getQuickSlot(r.slot) : null;
    return '<div class="mc-sc-item' + (r.on ? '' : ' off') + '"><b>⏰ ' + r.time + '</b><span>' + mcSchedDays(r.days) + '</span><span>' + (r.slot === 'eco' ? '🌿 ' : '🚀 ') + escapeHtml(p ? p.name : r.slot) + '</span><span>→ ' + escapeHtml(mcSchedTargetLabel(r.target)) + '</span>' +
      '<button type="button" data-sc="tog" data-id="' + r.id + '">' + t(r.on ? 'mc_sc_on' : 'mc_sc_off') + '</button><button type="button" data-sc="del" data-id="' + r.id + '" class="mc-danger" title="' + t('mc_remove_g') + '">✕</button></div>';
  }).join('') : '<div class="mc-sc-empty">' + t('mc_sc_empty') + '</div>';
  if(list && list.dataset.s !== lh){ list.dataset.s = lh; list.innerHTML = lh; }
}
async function mcSchedRun(r){
  const prof = typeof getQuickSlot === 'function' ? getQuickSlot(r.slot) : null;
  const label = r.time + ' ' + (prof ? prof.name : r.slot);
  if(!prof){ mcLogEvent(mct('mc_sc_noprof_run', label), 'bad'); return; }
  const devs = (devices || []).filter(d => (r.target === 'all' || (r.target.startsWith('g:') && d.group === r.target.slice(2)) || r.target === 'd:' + d.id) && readings[d.id] && readings[d.id].online && !(d.mute > Date.now()));
  let ok = 0;
  for(const d of devs){ const res = await aiApplyProfile(prof, d); if(res && res.ok) ok++; }
  const msg = mct('mc_sc_done', label, ok, devs.length);
  mcLogEvent(msg, ok === devs.length ? 'info' : 'warn');
  if(typeof sendAlert === 'function') sendAlert(msg, 'sched-' + r.id + '-' + mcToday());
  renderAll();
}
function mcSchedTick(){
  if(!mc.sched.length) return;
  const now = new Date(), today = mcToday(), mins = now.getHours() * 60 + now.getMinutes();
  mc.sched.forEach(r => {
    if(!r.on || r.last === today || !r.days.includes(now.getDay())) return;
    const [h, m] = r.time.split(':').map(Number), diff = mins - (h * 60 + m);
    if(diff < 0 || diff >= 10) return;       // só corre nos 10 minutos a seguir à hora marcada
    r.last = today; mcSchedSave();
    mcSchedRun(r);
  });
}
setInterval(mcSchedTick, 30000);

// atualiza o que depende do idioma e das máquinas
function mcToolsRender(){ mcSchedRender(); mcNewRender(); }

// ---------------- bloqueio das ações (PIN) ----------------
// Esconde os botões que mexem nas máquinas (reiniciar, remover, perfis, tomada...) e deixa só ver. Protege de
// cliques acidentais e de quem olha para o ecrã; não é uma segurança forte, porque quem tiver acesso ao PC contorna-o.
const MC_LOCK_KEY = 'nerdqaxe:lock_pin';
mc.locked = (() => { try { return !!localStorage.getItem(MC_LOCK_KEY) && localStorage.getItem('nerdqaxe:locked') === '1'; } catch(e) { return false; } })();
async function mcPinHash(pin){
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hc:' + pin));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function mcLockToggle(){
  if(mc.locked){
    const pin = prompt(t('mc_lock_ask'));
    if(pin === null) return;
    let ok = false;
    try { ok = (await mcPinHash(pin.trim())) === localStorage.getItem(MC_LOCK_KEY); } catch(e) {}
    if(!ok){ alert(t('mc_lock_bad')); return; }
    mc.locked = false; try { localStorage.setItem('nerdqaxe:locked', '0'); } catch(e) {}
  } else {
    let stored = null; try { stored = localStorage.getItem(MC_LOCK_KEY); } catch(e) {}
    if(!stored){
      const pin = prompt(t('mc_lock_set'));
      if(pin === null) return;
      if(!/^\d{4,8}$/.test(pin.trim())){ alert(t('mc_lock_short')); return; }
      try { localStorage.setItem(MC_LOCK_KEY, await mcPinHash(pin.trim())); } catch(e) { return; }
    }
    mc.locked = true; try { localStorage.setItem('nerdqaxe:locked', '1'); } catch(e) {}
  }
  mcLockRender(); renderMachineCards();
}
function mcLockRender(){
  document.body.classList.toggle('mc-locked', !!mc.locked);
  const bar = $('mcLockBar');
  if(!bar) return;
  bar.hidden = !mc.locked;
  if(mc.locked){ const h = '<span>' + t('mc_lock_banner') + '</span><button type="button" data-lk="off">' + t('mc_m_unlock') + '</button>'; if(bar.dataset.s !== h){ bar.dataset.s = h; bar.innerHTML = h; } }
}
document.addEventListener('click', e => { if(e.target.closest('#mcLockBar [data-lk="off"]')) mcLockToggle(); });
