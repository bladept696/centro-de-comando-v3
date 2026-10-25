// ---------- Cartões: regras "se… então…" ----------
// Cada regra liga uma condição (ex.: temperatura acima de 72 °C durante 3 min) a uma ação (avisar, perfil Eco/Turbo,
// reiniciar ou ciclo da tomada). Corre enquanto a dashboard está aberta; cada regra só volta a agir na mesma
// máquina 30 min depois, e máquinas silenciadas ficam de fora. Edita-se em ⚙ > Regras.
const MC_RULES_KEY = 'nerdqaxe:rules';
const MC_RULE_METRICS = {
  temp:    { key: 'mc_ru_m_temp',  unit: '°C',   get: r => r.temp },
  vr:      { key: 'mc_ru_m_vr',    unit: '°C',   get: r => r.vrTemp },
  fan:     { key: 'mc_ru_m_fan',   unit: '%',    get: r => r.fanPct },
  power:   { key: 'mc_ru_m_power', unit: 'W',    get: r => r.power },
  hash:    { key: 'mc_ru_m_hash',  unit: 'TH/s', get: r => algoGroupOf(r) === 'sha256' ? Number(r.hashrate) / 1000 : null },
  rej:     { key: 'mc_ru_m_rej',   unit: '%',    get: r => { const sh = (r.accepted || 0) + (r.rejected || 0); return sh > 20 ? r.rejected / sh * 100 : null; } },
  wifi:    { key: 'mc_ru_m_wifi',  unit: 'dBm',  get: r => r.rssi },
  ping:    { key: 'mc_ru_m_ping',  unit: 'ms',   get: r => r.poolPing },
  offline: { key: 'mc_ru_m_off',   unit: '',     get: null }
};
const MC_RULE_ACTIONS = [['notify', 'mc_ru_a_notify'], ['eco', 'mc_ru_a_eco'], ['turbo', 'mc_ru_a_turbo'], ['restart', 'mc_ru_a_restart'], ['plug', 'mc_ru_a_plug']];
mc.rules = (() => { try { const a = JSON.parse(localStorage.getItem(MC_RULES_KEY) || '[]'); return Array.isArray(a) ? a.filter(mcRuleOk) : []; } catch(e) { return []; } })();
mc.ruleSince = {}; mc.ruleLast = {}; mc.ruleTick = 0;
function mcRuleOk(r){ return r && MC_RULE_METRICS[r.m] && ['>', '<'].includes(r.op) && MC_RULE_ACTIONS.some(a => a[0] === r.act) && typeof r.id === 'string'; }
function mcRulesSave(){ try { localStorage.setItem(MC_RULES_KEY, JSON.stringify(mc.rules)); } catch(e) {} }
function mcRulesImport(list){
  if(!Array.isArray(list)) return;
  mc.rules = list.filter(mcRuleOk).map(r => ({ id: String(r.id).slice(0, 12), on: r.on !== false, m: r.m, op: r.op, v: Number(r.v) || 0, mins: Math.max(0, Math.min(1440, Number(r.mins) || 0)), scope: String(r.scope || 'all'), act: r.act }));
  mcRulesSave();
}
function mcRuleText(r){
  const M = MC_RULE_METRICS[r.m], cond = r.m === 'offline' ? t(M.key) : t(M.key) + ' ' + r.op + ' ' + r.v + ' ' + M.unit;
  return mct('mc_ru_text', cond, r.mins ? ' ' + t('mc_ru_for') + ' ' + r.mins + ' min' : '', t(MC_RULE_ACTIONS.find(a => a[0] === r.act)[1]), mcSchedTargetLabel(r.scope));
}
function mcRuleMet(r, rd){
  if(r.m === 'offline') return !rd || !rd.online;
  if(!rd || !rd.online) return false;
  const v = Number(MC_RULE_METRICS[r.m].get(rd));
  if(!isFinite(v)) return false;
  return r.op === '>' ? v > r.v : v < r.v;
}
function mcRuleScope(r, dev){ return r.scope === 'all' || (r.scope.startsWith('g:') && dev.group === r.scope.slice(2)) || r.scope === 'd:' + dev.id; }

async function mcRuleFire(r, dev){
  const name = dev.name || dev.ip, txt = mct('mc_ru_fired', name, mcRuleText(r));
  mcLogEvent(txt, 'warn', dev.id);
  let res = null;
  try {
    if(r.act === 'eco' || r.act === 'turbo'){
      const prof = typeof getQuickSlot === 'function' ? getQuickSlot(r.act) : null;
      if(!prof){ mcLogEvent(mct('mc_sc_noprof_run', r.act), 'bad', dev.id); return; }
      res = await aiApplyProfile(prof, dev);
    } else if(r.act === 'restart'){
      res = await aiRestartDevice(dev);
    } else if(r.act === 'plug'){
      if(!dev.plugOff || !dev.plugOn){ mcLogEvent(mct('mc_ru_noplug', name), 'bad', dev.id); return; }
      await mcPlugCycle(dev, true);
    }
  } catch(e) { res = { ok: false }; }
  if(res && res.ok === false) mcLogEvent(mct('mc_c_fail', name), 'bad', dev.id);
  if(typeof sendAlert === 'function') sendAlert(txt, 'rule-' + r.id + '-' + dev.id);
  renderAll();
}
function mcRulesTick(list){
  const now = Date.now();
  if(now - mc.ruleTick < 10000 || !mc.rules.length) return;
  mc.ruleTick = now;
  mc.rules.forEach(r => {
    if(!r.on) return;
    list.forEach(dev => {
      const key = r.id + '|' + dev.id;
      if(!mcRuleScope(r, dev) || !mcRuleMet(r, readings[dev.id])){ delete mc.ruleSince[key]; return; }
      if(!mc.ruleSince[key]) mc.ruleSince[key] = now;
      if(now - mc.ruleSince[key] < (r.mins || 0) * 60000 || now - (mc.ruleLast[key] || 0) < 30 * 60000 || dev.mute > now) return;
      mc.ruleLast[key] = now;
      mcRuleFire(r, dev);
    });
  });
}

// ---- janela das regras ----
function mcRulesOpen(){
  mcCompareClose();
  const m = document.createElement('div');
  m.id = 'mcCompare'; m.className = 'mc-cmp';
  m.innerHTML = '<div class="mc-cmp-card mc-help mc-ru" role="dialog" aria-modal="true"><div class="mc-cmp-head"><b>🤖 ' + t('mc_ru_title') + '</b><button type="button" data-cmp="close" aria-label="' + t('mc_cmp_close') + '">✕</button></div>' +
    '<div class="mc-ru-list" id="mcRuList"></div>' +
    '<div class="mc-ru-form"><span class="mc-ru-if">' + t('mc_ru_if') + '</span><select id="mcRuM">' + Object.keys(MC_RULE_METRICS).map(k => '<option value="' + k + '">' + t(MC_RULE_METRICS[k].key) + '</option>').join('') + '</select>' +
    '<select id="mcRuOp"><option value=">">&gt;</option><option value="<">&lt;</option></select><input type="number" id="mcRuV" step="any" value="72"><em id="mcRuU">°C</em>' +
    '<span>' + t('mc_ru_for') + '</span><input type="number" id="mcRuMin" min="0" max="1440" step="1" value="3"><em>min</em>' +
    '<span>' + t('mc_ru_in') + '</span><select id="mcRuS"></select><span>' + t('mc_ru_do') + '</span><select id="mcRuA">' + MC_RULE_ACTIONS.map(a => '<option value="' + a[0] + '">' + t(a[1]) + '</option>').join('') + '</select>' +
    '<button type="button" id="mcRuAdd" class="primary">' + t('mc_ru_add') + '</button></div>' +
    '<div class="mc-cmp-note">' + t('mc_ru_note') + '</div><div class="mc-th-actions"><button type="button" data-ru="examples">' + t('mc_ru_examples') + '</button></div></div>';
  document.body.appendChild(m);
  $('mcRuS').innerHTML = '<option value="all">' + t('mc_sc_all') + '</option>' + mcGroupsOf(devices || []).map(g => '<option value="g:' + escapeHtml(g) + '">🗂 ' + escapeHtml(g) + '</option>').join('') + (devices || []).map(d => '<option value="d:' + escapeHtml(String(d.id)) + '">' + escapeHtml(d.name || d.ip) + '</option>').join('');
  const draw = () => {
    $('mcRuList').innerHTML = mc.rules.length ? mc.rules.map(r => '<div class="mc-ru-item' + (r.on ? '' : ' off') + '"><span>' + escapeHtml(mcRuleText(r)) + '</span>' +
      '<button type="button" data-ru="tog" data-id="' + r.id + '">' + t(r.on ? 'mc_sc_on' : 'mc_sc_off') + '</button><button type="button" data-ru="del" data-id="' + r.id + '" class="mc-danger" title="' + t('mc_remove_g') + '">✕</button></div>').join('')
      : '<div class="mc-sc-empty">' + t('mc_ru_empty') + '</div>';
    const M = MC_RULE_METRICS[$('mcRuM').value], off = $('mcRuM').value === 'offline';
    $('mcRuU').textContent = M.unit; $('mcRuOp').hidden = $('mcRuV').hidden = $('mcRuU').hidden = off;
  };
  draw();
  m.addEventListener('change', e => { if(e.target.id === 'mcRuM') draw(); });
  m.addEventListener('click', e => {
    if(e.target === m || e.target.closest('[data-cmp="close"]')){ m.remove(); return; }
    if(e.target.closest('#mcRuAdd')){
      const k = $('mcRuM').value, v = parseFloat($('mcRuV').value);
      if(k !== 'offline' && !isFinite(v)){ setQuickActionStatus(t('mc_sc_incomplete')); return; }
      mc.rules.push({ id: Math.random().toString(36).slice(2, 8), on: true, m: k, op: $('mcRuOp').value, v: k === 'offline' ? 0 : v, mins: Math.max(0, Math.min(1440, parseInt($('mcRuMin').value, 10) || 0)), scope: $('mcRuS').value, act: $('mcRuA').value });
      mcRulesSave(); draw(); return;
    }
    const b = e.target.closest('[data-ru]');
    if(!b) return;
    const r = mc.rules.find(x => x.id === b.dataset.id);
    if(b.dataset.ru === 'del') mc.rules = mc.rules.filter(x => x.id !== b.dataset.id);
    else if(b.dataset.ru === 'tog' && r) r.on = !r.on;
    else if(b.dataset.ru === 'examples'){
      mc.rules.push({ id: Math.random().toString(36).slice(2, 8), on: true, m: 'temp', op: '>', v: 72, mins: 3, scope: 'all', act: 'eco' },
        { id: Math.random().toString(36).slice(2, 8), on: true, m: 'offline', op: '>', v: 0, mins: 10, scope: 'all', act: 'notify' });
    }
    mcRulesSave(); draw();
  });
}
