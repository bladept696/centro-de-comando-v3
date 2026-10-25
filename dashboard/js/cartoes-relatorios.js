// ---------- Cartões: comparar máquinas, relatório imprimível e ajuda de atalhos ----------

// ---- comparar as máquinas selecionadas lado a lado ----
function mcCompareClose(){ const m = $('mcCompare'); if(m) m.remove(); }
function mcCompareOpen(){
  mcCompareClose();
  const devs = (devices || []).filter(d => mc.picked.has(d.id)).slice(0, 6);
  if(devs.length < 2) return;
  const info = devs.map(d => {
    const r = readings[d.id] || {}, on = !!r.online, sh = (r.accepted || 0) + (r.rejected || 0);
    const eco = typeof mcEconomics === 'function' && on ? mcEconomics(algoGroupOf(r) === 'sha256' ? Number(r.hashrate) || 0 : 0, Number(r.power) || 0) : null;
    const av = typeof mcAvail === 'function' ? mcAvail(d.id, 7) : null;
    return { d, r, on, v: {
      hash: on ? Number(r.hashrate) || 0 : null, temp: on && r.temp > 0 ? Number(r.temp) : null, power: on && r.power > 0 ? Number(r.power) : null,
      eff: on && r.efficiency > 0 ? Number(r.efficiency) : null, rej: on && sh > 20 ? r.rejected / sh * 100 : null, rssi: on && r.rssi != null ? Number(r.rssi) : null,
      ping: on && r.poolPing != null ? Number(r.poolPing) : null, up: on && r.uptime > 0 ? Number(r.uptime) : null, profit: eco ? eco.profit : null, avail: av } };
  });
  // [chave, rótulo, melhor = 'max' ou 'min', formatação]
  const ROWS = [
    ['hash', t('mc_s_hash'), 'max', v => { const f = formatHashrate(v); return f.value + ' ' + f.unit; }], ['temp', t('mc_m_temp'), 'min', v => v.toFixed(1) + ' °C'],
    ['power', t('mc_k_power'), 'min', v => v.toFixed(1) + ' W'], ['eff', t('mc_k_eff'), 'min', v => v.toFixed(1) + ' J/TH'],
    ['rej', t('mc_cmp_rej'), 'min', v => v.toFixed(1) + '%'], ['rssi', 'Wi-Fi', 'max', v => v + ' dBm'], ['ping', t('mc_k_ping'), 'min', v => Math.round(v) + ' ms'],
    ['up', 'Uptime', 'max', v => formatUptime(v).text], ['profit', t('mc_k_profit'), 'max', v => (v >= 0 ? '+' : '') + v.toFixed(2) + ' €'], ['avail', t('mc_d_avail').replace(/\s*\(.*$/, '') + ' (7 d)', 'max', v => v.toFixed(1) + '%']
  ];
  let h = '<div class="mc-cmp-card" role="dialog" aria-modal="true"><div class="mc-cmp-head"><b>⚖ ' + t('mc_cmp_title') + '</b><button type="button" data-cmp="close" aria-label="' + t('mc_cmp_close') + '">✕</button></div>' +
    '<div class="mc-cmp-scroll"><table class="mc-cmp-table"><thead><tr><th></th>' + info.map(x => '<th><b>' + escapeHtml(x.d.name || x.d.ip) + '</b><small>' + escapeHtml(x.d.ip || '') + '</small></th>').join('') + '</tr></thead><tbody>';
  ROWS.forEach(([k, label, best, fmt]) => {
    const vals = info.map(x => x.v[k]), ok = vals.filter(v => v != null && isFinite(v));
    if(!ok.length) return;
    const target = ok.length > 1 && Math.max(...ok) !== Math.min(...ok) ? (best === 'max' ? Math.max(...ok) : Math.min(...ok)) : null;   // sem destaque quando são todos iguais
    h += '<tr><th>' + label + '</th>' + vals.map(v => '<td class="' + (v != null && v === target ? 'best' : '') + '">' + (v == null || !isFinite(v) ? '—' : fmt(v)) + '</td>').join('') + '</tr>';
  });
  h += '</tbody></table></div><div class="mc-cmp-note">' + t('mc_cmp_note') + '</div></div>';
  const m = document.createElement('div');
  m.id = 'mcCompare'; m.className = 'mc-cmp'; m.innerHTML = h;
  m.addEventListener('click', e => { if(e.target === m || e.target.closest('[data-cmp="close"]')) mcCompareClose(); });
  document.body.appendChild(m);
}

// ---- relatório imprimível (abre numa janela nova: Imprimir ou Guardar como PDF) ----
function mcReportOpen(){
  const list = devices || [], st = typeof mcStats === 'function' ? mcStats(list) : null;
  let days = {};
  try { days = JSON.parse(localStorage.getItem(MC_STATS_KEY) || '{}'); } catch(e) {}
  const esc = escapeHtml, fm = gh => { const f = formatHashrate(gh); return gh ? f.value + ' ' + f.unit : '—'; };
  const price = typeof mcPrice === 'function' ? mcPrice() : 0, loc = mcLocale();
  const dayRows = Object.keys(days).sort().slice(-7).reverse().map(k => {
    const d = days[k];
    return '<tr><td>' + new Date(k + 'T12:00:00').toLocaleDateString(loc, { weekday: 'short', day: '2-digit', month: '2-digit' }) + '</td><td>' + fm(d.avg) + '</td><td>' + fm(d.peak) + '</td><td>' + Number(d.kwh).toFixed(2) + ' kWh' + (price ? ' · ' + (d.kwh * price).toFixed(2) + ' €' : '') + '</td><td>' + (d.events || 0) + '</td></tr>';
  }).join('');
  const macRows = list.map(d => {
    const r = readings[d.id] || {}, on = !!r.online, sh = on ? (r.accepted || 0) + (r.rejected || 0) : 0, S = MC_STATUS[mcStateOf(readings[d.id])];
    const [hv, hu] = mcHashText(readings[d.id]), av7 = mcAvail(d.id, 7), av30 = mcAvail(d.id, 30), f = v => v == null ? '—' : v.toFixed(1) + '%';
    return '<tr><td><b>' + esc(d.name || '') + '</b><br><small>' + esc(d.ip || '') + '</small></td><td>' + esc(d.group || '—') + '</td><td>' + S.label + '</td><td>' + esc(hv + ' ' + hu) + '</td><td>' + (on ? mcNum(r.temp, 1) + ' °C' : '—') + '</td><td>' + (on ? mcNum(r.power, 1) + ' W' : '—') + '</td><td>' + (on ? mcNum(r.efficiency, 1) : '—') + '</td><td>' + (sh > 20 ? (r.rejected / sh * 100).toFixed(1) + '%' : '—') + '</td><td>' + f(av7) + ' · ' + f(av30) + '</td></tr>';
  }).join('');
  const evRows = mc.log.slice(-30).reverse().map(e => '<li><time>' + new Date(e.t).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }) + '</time> ' + esc(e.text) + '</li>').join('');
  const css = 'body{font:13px/1.45 system-ui,Segoe UI,Arial,sans-serif;color:#111;margin:28px;max-width:980px}h1{font-size:22px;margin:0}h2{font-size:14px;margin:22px 0 6px;border-bottom:2px solid #111;padding-bottom:3px}' +
    '.sub{color:#666;margin:2px 0 14px}.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.tile{border:1px solid #ccc;border-radius:8px;padding:8px 10px}.tile span{display:block;font-size:10px;text-transform:uppercase;color:#666}.tile b{font-size:17px}' +
    'table{width:100%;border-collapse:collapse;font-size:12px}th,td{border-bottom:1px solid #ddd;padding:5px 6px;text-align:left}th{font-size:10px;text-transform:uppercase;color:#555}small{color:#777}ul{padding-left:18px;margin:4px 0}li{margin:1px 0}time{color:#777}' +
    'button{font:inherit;padding:7px 14px;border:1px solid #111;border-radius:7px;background:#111;color:#fff;cursor:pointer}@media print{button{display:none}body{margin:12mm}}';
  const html = '<!doctype html><html lang="' + loc + '"><head><meta charset="utf-8"><title>' + esc(t('mc_rp_title')) + '</title><style>' + css + '</style></head><body>' +
    '<button onclick="window.print()">🖨 ' + esc(t('mc_rp_print')) + '</button><h1>' + esc(t('mc_rp_title')) + '</h1><div class="sub">' + new Date().toLocaleString(loc) + '</div>' +
    (st ? '<div class="tiles"><div class="tile"><span>' + esc(t('mc_s_now')) + '</span><b>' + st.online + '/' + st.total + ' online</b></div><div class="tile"><span>' + esc(t('mc_s_avg')) + '</span><b>' + fm(st.avg) + '</b></div><div class="tile"><span>' + esc(t('mc_s_peak')) + '</span><b>' + fm(st.peak) + '</b></div><div class="tile"><span>' + esc(t('mc_s_energy')) + '</span><b>' + st.kwh.toFixed(2) + ' kWh' + (price ? ' · ' + (st.kwh * price).toFixed(2) + ' €' : '') + '</b></div></div>' : '') +
    '<h2>' + esc(t('mc_rp_days')) + '</h2>' + (dayRows ? '<table><thead><tr><th>' + esc(t('mc_rp_day')) + '</th><th>' + esc(t('mc_h_avg')) + '</th><th>' + esc(t('mc_s_peak')) + '</th><th>' + esc(t('mc_s_energy')) + '</th><th>' + esc(t('mc_s_events')) + '</th></tr></thead><tbody>' + dayRows + '</tbody></table>' : '<p><small>' + esc(t('mc_rp_nodays')) + '</small></p>') +
    '<h2>' + esc(t('mc_rp_machines')) + '</h2><table><thead><tr><th>' + esc(t('mc_t_machine')) + '</th><th>' + esc(t('mc_e_group')) + '</th><th>' + esc(t('mc_t_state')) + '</th><th>Hashrate</th><th>' + esc(t('mc_m_temp')) + '</th><th>' + esc(t('mc_k_power')) + '</th><th>' + esc(t('mc_t_eff')) + '</th><th>' + esc(t('mc_t_rej')) + '</th><th>' + esc(t('mc_d_avail')) + '</th></tr></thead><tbody>' + macRows + '</tbody></table>' +
    '<h2>' + esc(t('mc_log_title').replace(/^\S+\s/, '')) + '</h2>' + (evRows ? '<ul>' + evRows + '</ul>' : '<p><small>' + esc(t('mc_l_none')) + '</small></p>') + '</body></html>';
  const w = window.open('', '_blank');
  if(!w){ setQuickActionStatus(t('mc_rp_blocked')); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

// ---- ajuda dos atalhos de teclado ----
function mcHelpToggle(){
  const old = $('mcHelp');
  if(old){ old.remove(); return; }
  const m = document.createElement('div');
  m.id = 'mcHelp'; m.className = 'mc-cmp';
  m.innerHTML = '<div class="mc-cmp-card mc-help" role="dialog" aria-modal="true"><div class="mc-cmp-head"><b>⌨ ' + t('mc_m_help').replace(/^\S+\s/, '') + '</b><button type="button" data-cmp="close" aria-label="' + t('mc_cmp_close') + '">✕</button></div>' +
    '<ul>' + t('mc_help_list').split('|').map(l => { const i = l.indexOf(' '); return '<li><kbd>' + escapeHtml(l.slice(0, i)) + '</kbd><span>' + escapeHtml(l.slice(i + 1)) + '</span></li>'; }).join('') + '</ul></div>';
  m.addEventListener('click', e => { if(e.target === m || e.target.closest('[data-cmp="close"]')) m.remove(); });
  document.body.appendChild(m);
}
document.addEventListener('keydown', e => {
  if(e.key === 'Escape'){ mcCompareClose(); const h = $('mcHelp'); if(h) h.remove(); return; }
  if(e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
  const t0 = e.target;
  if(t0 && (t0.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t0.tagName))) return;
  const tab = $('mcBoard') && $('mcBoard').closest('.tab-content');
  if(tab && tab.classList.contains('active')) mcHelpToggle();
});

// ---- limites de alerta ----
const MC_TH_FIELDS = [['tempWarm', 'mc_th_tempwarm', 30, 120, 1], ['tempHot', 'mc_th_temphot', 30, 130, 1], ['vrHot', 'mc_th_vr', 30, 150, 1], ['rej', 'mc_th_rej', 0.1, 50, 0.1], ['wifi', 'mc_th_wifi', -100, -40, 1], ['ping', 'mc_th_ping', 50, 5000, 10], ['stuckMin', 'mc_th_stuck', 3, 120, 1]];
function mcLimitsOpen(){
  mcCompareClose();
  const m = document.createElement('div');
  m.id = 'mcCompare'; m.className = 'mc-cmp';
  m.innerHTML = '<div class="mc-cmp-card mc-help" role="dialog" aria-modal="true"><div class="mc-cmp-head"><b>🎚 ' + t('mc_th_title') + '</b><button type="button" data-cmp="close" aria-label="' + t('mc_cmp_close') + '">✕</button></div>' +
    '<div class="mc-th-form">' + MC_TH_FIELDS.map(([k, key, min, max, step]) => '<label><span>' + t(key) + '</span><input type="number" data-th="' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + mc.th[k] + '"></label>').join('') + '</div>' +
    '<div class="mc-cmp-note">' + t('mc_th_note') + '</div><div class="mc-th-actions"><button type="button" data-th-act="reset">' + t('mc_th_reset') + '</button><button type="button" data-th-act="save" class="primary">' + t('mc_th_save') + '</button></div></div>';
  m.addEventListener('click', e => {
    if(e.target === m || e.target.closest('[data-cmp="close"]')){ m.remove(); return; }
    const a = e.target.closest('[data-th-act]');
    if(!a) return;
    if(a.dataset.thAct === 'reset'){ m.querySelectorAll('[data-th]').forEach(i => { i.value = MC_TH_DEFAULT[i.dataset.th]; }); return; }
    const v = {};
    for(const [k, , min, max] of MC_TH_FIELDS){
      const n = parseFloat(m.querySelector('[data-th="' + k + '"]').value);
      if(!isFinite(n) || n < min || n > max){ alert(t('mc_th_bad')); return; }
      v[k] = n;
    }
    if(v.tempWarm >= v.tempHot){ alert(t('mc_th_bad')); return; }
    mc.th = v;
    try { localStorage.setItem(MC_TH_KEY, JSON.stringify(v)); } catch(e2) {}
    m.remove(); renderAll();
    setQuickActionStatus(t('mc_th_saved'));
  });
  document.body.appendChild(m);
}
