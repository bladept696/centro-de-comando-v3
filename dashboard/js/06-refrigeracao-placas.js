/* ===== Refrigeração líquida + VDroop ===== */
let coolTimer = null, coolFormLoaded = false;
function coolingStart(){ coolingStop(); coolFormLoaded = false; loadCoolingStatus(); renderVdroop(); coolTimer = setInterval(() => { loadCoolingStatus(); renderVdroop(); }, 3000); }
function coolingStop(){ if(coolTimer){ clearInterval(coolTimer); coolTimer = null; } }
// gráfico de linhas com eixos, grelha, área, referências e dica ao passar o rato
// series: [{vals, ts?, color, name?}]; opts: {unit, refs:[{v,color,label,dash}], dec}
function coolDrawLines(svgId, series, opts){
  const svg = $(svgId); if(!svg) return;
  opts = opts || {};
  const W = Math.max(320, Math.round(svg.clientWidth || (svg.parentElement && svg.parentElement.clientWidth) || 560)), H = 170;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet'); svg.style.height = 'auto';
  const all = series.flatMap(x => x.vals.filter(v => v != null && isFinite(v)));
  if(all.length < 2){ svg.innerHTML = `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#7f8ea3" font-size="12">${t('cl_nodata')}</text>`; svg.onmousemove = svg.onmouseleave = null; return; }
  const L = 46, R = 14, T = 12, B = 24, pw = W - L - R, ph = H - T - B, dec = opts.dec != null ? opts.dec : 1;
  const refVals = (opts.refs || []).map(r => r.v).filter(v => v != null && isFinite(v));
  let min = Math.min(...all, ...refVals), max = Math.max(...all, ...refVals);
  if(max - min < 1e-6){ max += 1; min -= 1; }
  const pad = (max - min) * .1; min -= pad; max += pad;
  const n = Math.max(...series.map(x => x.vals.length)), tsArr = (series[0] && series[0].ts) || null;
  const X = i => L + (n > 1 ? i / (n - 1) : 0) * pw, Y = v => T + (1 - (v - min) / (max - min)) * ph;
  let g = '';
  for(let k = 0; k <= 4; k++){ const v = min + (max - min) * k / 4, y = Y(v); g += `<line x1="${L}" y1="${y.toFixed(1)}" x2="${W - R}" y2="${y.toFixed(1)}" stroke="#ffffff10"/><text x="${L - 7}" y="${(y + 3.5).toFixed(1)}" fill="#6b8794" font-size="10" text-anchor="end">${v.toFixed(dec)}</text>`; }
  if(tsArr){ for(let k = 0; k <= 4; k++){ const idx = Math.round((n - 1) * k / 4), tt = tsArr[idx]; if(tt) g += `<text x="${X(idx).toFixed(1)}" y="${H - 7}" fill="#6b8794" font-size="10" text-anchor="${k === 0 ? 'start' : k === 4 ? 'end' : 'middle'}">${new Date(tt * 1000).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</text>`; } }
  (opts.refs || []).forEach(r => { if(r.v == null || r.v < min || r.v > max) return; const y = Y(r.v); g += `<line x1="${L}" y1="${y.toFixed(1)}" x2="${W - R}" y2="${y.toFixed(1)}" stroke="${r.color}" stroke-dasharray="${r.dash || '4 4'}" opacity=".85"/><text x="${W - R - 4}" y="${(y - 4).toFixed(1)}" fill="${r.color}" font-size="9.5" text-anchor="end">${r.label}</text>`; });
  const paths = series.map((x, si) => {
    const pts = [];
    x.vals.forEach((v, i) => { if(v != null && isFinite(v)) pts.push([X(i), Y(v), v]); });
    if(!pts.length) return '';
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    const gid = `${svgId}_g${si}`, last = pts[pts.length - 1];
    return `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${x.color}" stop-opacity="${series.length > 1 ? .16 : .34}"/><stop offset="1" stop-color="${x.color}" stop-opacity="0"/></linearGradient></defs>
      <path d="${line}L${last[0].toFixed(1)} ${T + ph}L${pts[0][0].toFixed(1)} ${T + ph}Z" fill="url(#${gid})"/>
      <path d="${line}" fill="none" stroke="${x.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4" fill="${x.color}" stroke="#0d1a26" stroke-width="2"/>`;
  }).join('');
  svg.innerHTML = g + paths + `<g class="tip" style="display:none;pointer-events:none;"><line y1="${T}" y2="${T + ph}" stroke="#ffffff55" stroke-dasharray="3 3"/><g class="bub"><rect rx="6" width="124" height="${12 + series.length * 14 + 14}" fill="#08121a" stroke="#4fd6ff66"/></g></g>`;
  svg.onmousemove = e => {
    const r = svg.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width * W, idx = Math.max(0, Math.min(n - 1, Math.round((mx - L) / pw * (n - 1))));
    const tip = svg.querySelector('.tip'); if(!tip) return;
    tip.style.display = 'block'; tip.setAttribute('transform', `translate(${X(idx).toFixed(1)},0)`);
    const bub = tip.querySelector('.bub'), bx = X(idx) > W - 150 ? -132 : 10;
    bub.setAttribute('transform', `translate(${bx},${T + 4})`);
    bub.querySelectorAll('text').forEach(t0 => t0.remove());
    const rows = series.map((x, si) => { const v = x.vals[idx]; return `<text x="8" y="${14 + si * 14}" fill="${x.color}" font-size="11" font-weight="700">${v == null ? '—' : v.toFixed(dec + (opts.unit === 'L/min' ? 1 : 0))} ${opts.unit || ''}${x.name ? ' · ' + x.name : ''}</text>`; }).join('');
    const when = tsArr && tsArr[idx] ? `<text x="8" y="${14 + series.length * 14}" fill="#6b8794" font-size="9.5">${new Date(tsArr[idx] * 1000).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</text>` : '';
    bub.insertAdjacentHTML('beforeend', rows + when);
  };
  svg.onmouseleave = () => { const tip = svg.querySelector('.tip'); if(tip) tip.style.display = 'none'; };
}
const coolPct = (v, a, b) => Math.max(0, Math.min(100, (v - a) / (b - a) * 100));
function coolTile(id, tone, bar, mk){
  const el = $(id); if(el) el.dataset.tone = tone;
  if(bar){ const b = $(bar.id); if(b){ b.style.width = bar.pct.toFixed(0) + '%'; } }
  if(mk && $(mk.id)) $(mk.id).style.left = mk.pct.toFixed(1) + '%';
}
async function loadCoolingStatus(){
  let d;
  try { d = await (await fetch(`${API_BASE}/api/coolant/status`)).json(); } catch(e){ return; }
  const c = d.config || {};
  if(!coolFormLoaded){
    coolFormLoaded = true;
    $('coolEnabled').checked = !!c.enabled; $('coolKs').checked = !!c.killswitch_enabled;
    $('coolUrl').value = c.sensor_url || ''; $('coolRelayOff').value = c.relay_off_url || ''; $('coolRelayOn').value = c.relay_on_url || '';
    $('coolMinFlow').value = c.min_flow_lpm ?? 1; $('coolGrace').value = c.grace_seconds ?? 5; $('coolMaxOut').value = c.max_coolant_out_c ?? 60;
  }
  const r = d.reading || {};
  const f = v => v == null ? '—' : v.toFixed(1);
  const minFlow = Number(c.min_flow_lpm ?? 1), maxOut = Number(c.max_coolant_out_c ?? 60);
  const delta = (r.coolant_in_c == null || r.coolant_out_c == null) ? null : r.coolant_out_c - r.coolant_in_c;
  $('coolFlow').textContent = r.flow_lpm == null ? '—' : r.flow_lpm.toFixed(2) + ' L/min';
  $('coolIn').textContent = r.coolant_in_c == null ? '—' : f(r.coolant_in_c) + ' °C';
  $('coolOut').textContent = r.coolant_out_c == null ? '—' : f(r.coolant_out_c) + ' °C';
  $('coolDelta').textContent = delta == null ? '—' : delta.toFixed(1) + ' °C';
  // mosaicos com tom e barra
  const fMax = Math.max(4, minFlow * 3);
  coolTile('coolTFlow', r.flow_lpm == null ? 'none' : r.flow_lpm < minFlow ? 'bad' : r.flow_lpm < minFlow * 1.3 ? 'warn' : 'ok', { id: 'coolFlowBar', pct: r.flow_lpm == null ? 0 : coolPct(r.flow_lpm, 0, fMax) }, { id: 'coolFlowMk', pct: coolPct(minFlow, 0, fMax) });
  $('coolFlowSub').textContent = mct('cl_sub_min', minFlow);
  coolTile('coolTIn', r.coolant_in_c == null ? 'none' : 'cold', { id: 'coolInBar', pct: r.coolant_in_c == null ? 0 : coolPct(r.coolant_in_c, 10, 60) });
  $('coolInSub').textContent = t('cl_sub_cold');
  coolTile('coolTOut', r.coolant_out_c == null ? 'none' : r.coolant_out_c >= maxOut ? 'bad' : r.coolant_out_c >= maxOut - 5 ? 'warn' : 'ok', { id: 'coolOutBar', pct: r.coolant_out_c == null ? 0 : coolPct(r.coolant_out_c, 10, maxOut * 1.1) }, { id: 'coolOutMk', pct: coolPct(maxOut, 10, maxOut * 1.1) });
  $('coolOutSub').textContent = mct('cl_sub_max', maxOut);
  coolTile('coolTDelta', delta == null ? 'none' : delta > 20 ? 'bad' : delta > 12 ? 'warn' : 'ok', { id: 'coolDeltaBar', pct: delta == null ? 0 : coolPct(delta, 0, 25) });
  $('coolDeltaSub').textContent = t('cl_sub_delta');

  const ban = $('coolBanner'), chip = $('coolChip'), loop = $('coolLoop');
  let state = 'ok';
  if(d.tripped){
    state = 'trip';
    ban.innerHTML = `<div class="cool-banner trip">🛑 <b>${t('cl_b_trip')}</b> — ${d.trip_reason} · relé: ${d.relay_result || '—'} <button class="config ghost" onclick="coolReset()">${t('cl_b_reset')}</button></div>`;
  } else if(c.enabled && d.error){
    state = 'warn';
    ban.innerHTML = `<div class="cool-banner warn">⚠️ ${mct('cl_b_noresp', d.error)}</div>`;
  } else if(!c.enabled){
    state = 'off';
    ban.innerHTML = `<div class="cool-banner off">${t('cl_b_off')}</div>`;
  } else ban.innerHTML = '';
  if(chip){ chip.className = 'th-chip ' + ({ ok: 'on', off: 'idle', warn: 'off', trip: 'trip' })[state]; chip.textContent = t({ ok: 'cl_chip_on', off: 'cl_chip_off', warn: 'cl_chip_warn', trip: 'cl_chip_trip' }[state]); }
  // circuito animado: a velocidade segue o fluxo
  if(loop){
    loop.dataset.state = state === 'ok' && (r.flow_lpm == null || r.flow_lpm <= 0.05) ? 'idle' : state;
    loop.style.setProperty('--fd', (r.flow_lpm > 0.05 ? Math.max(1.2, Math.min(9, 7 / r.flow_lpm)) : 0).toFixed(2) + 's');
    const tx = (id, v) => { const n = $(id); if(n) n.textContent = v; };
    tx('clvIn', r.coolant_in_c == null ? '—' : f(r.coolant_in_c) + ' °C'); tx('clvOut', r.coolant_out_c == null ? '—' : f(r.coolant_out_c) + ' °C'); tx('clvFlow', r.flow_lpm == null ? '—' : r.flow_lpm.toFixed(2) + ' L/min');
  }
  const h = d.history || [], ts = h.map(x => x.t);
  coolDrawLines('coolFlowChart', [{ vals: h.map(x => x.flow_lpm), ts, color: '#21ffb0' }], { unit: 'L/min', dec: 2, refs: [{ v: minFlow, color: '#ff5d5d', label: mct('cl_sub_min', minFlow) }] });
  coolDrawLines('coolTempChart', [{ vals: h.map(x => x.coolant_in_c), ts, color: '#4fd6ff', name: t('cl_leg_in') }, { vals: h.map(x => x.coolant_out_c), ts, color: '#ffb020', name: t('cl_leg_out') }], { unit: '°C', refs: [{ v: maxOut, color: '#ff5d5d', label: mct('cl_sub_max', maxOut) }] });
}
async function saveCoolingConfig(){
  const body = { enabled: $('coolEnabled').checked, killswitch_enabled: $('coolKs').checked, sensor_url: $('coolUrl').value, relay_off_url: $('coolRelayOff').value, relay_on_url: $('coolRelayOn').value, min_flow_lpm: $('coolMinFlow').value, grace_seconds: $('coolGrace').value, max_coolant_out_c: $('coolMaxOut').value };
  try { await fetch(`${API_BASE}/api/coolant/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch(e){ alert('Erro a guardar.'); return; }
  const sv = $('coolSaved'); if(sv){ sv.textContent = t('cl_saved'); setTimeout(() => { sv.textContent = ''; }, 2500); }
  loadCoolingStatus();
}
async function coolReset(){
  if(!confirm('Limpar o bloqueio do killswitch? Confirma primeiro que o circuito tem fluxo.')) return;
  const restore = !!$('coolRelayOn').value.trim() && confirm('Enviar também o comando para religar o relé?');
  try { await fetch(`${API_BASE}/api/coolant/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restore }) }); } catch(e){}
  loadCoolingStatus();
}
function renderVdroop(){
  const sel = $('vdSel'); if(!sel) return;
  if(sel.options.length !== devices.length) sel.innerHTML = devices.map(d => `<option value="${d.id}">${d.name || d.ip || d.id}</option>`).join('');
  const id = sel.value || (devices[0] && devices[0].id);
  const h = (histories[id] || []).filter(x => x.coreVoltage != null && x.coreVoltageActual != null && x.coreVoltageActual > 0);
  const set = (v, t0) => { $(v).textContent = t0; };
  const tone = (id2, v) => { const el = $(id2); if(el) el.dataset.tone = v; };
  const verdict = (cls, txt) => { const v = $('vdVerdict'); v.className = 'cool-verdict ' + cls; v.textContent = txt; };
  if(h.length < 2){ ['vdSetAct', 'vdNow', 'vdAvg', 'vdCv'].forEach(k => set(k, '—')); ['vdTSet', 'vdTNow', 'vdTAvg', 'vdTCv'].forEach(k => tone(k, 'none')); verdict('none', t('vd_nodata')); coolDrawLines('vdChart', [{ vals: [], color: '#ffb020' }]); return; }
  const droops = h.map(x => x.coreVoltage - x.coreVoltageActual);
  const last = h[h.length - 1], dNow = droops[droops.length - 1];
  const avg = droops.reduce((a, b) => a + b, 0) / droops.length, max = Math.max(...droops);
  const hr = h.map(x => x.hashrate).filter(v => v > 0);
  const m = hr.reduce((a, b) => a + b, 0) / (hr.length || 1);
  const cv = hr.length > 2 && m > 0 ? Math.sqrt(hr.reduce((a, b) => a + (b - m) ** 2, 0) / hr.length) / m * 100 : null;
  const pct = dNow / last.coreVoltage * 100;
  set('vdSetAct', `${Math.round(last.coreVoltage)} / ${Math.round(last.coreVoltageActual)} mV`);
  set('vdNow', `${dNow.toFixed(0)} mV (${pct.toFixed(1)}%)`);
  set('vdAvg', `${avg.toFixed(0)} / ${max.toFixed(0)} mV`);
  set('vdCv', cv == null ? '—' : cv.toFixed(1) + '%');
  tone('vdTSet', 'none'); tone('vdTNow', pct > 5 ? 'bad' : pct > 3 ? 'warn' : 'ok'); tone('vdTAvg', max / last.coreVoltage * 100 > 5 ? 'warn' : 'ok'); tone('vdTCv', cv == null ? 'none' : cv > 5 ? 'warn' : 'ok');
  const v = [];
  if(pct > 5) v.push(t('vd_w_droop'));
  if(cv != null && cv > 5) v.push(t('vd_w_cv'));
  verdict(v.length ? 'warn' : 'ok', v.length ? v.join(' · ') : t('vd_ok'));
  const stride = Math.max(1, Math.floor(droops.length / 300)), pick = a => a.filter((_, i) => i % stride === 0);
  coolDrawLines('vdChart', [{ vals: pick(droops), ts: pick(h.map(x => x.ts ? x.ts / 1000 : null)).every(Boolean) ? pick(h.map(x => x.ts / 1000)) : null, color: '#ffb020' }], { unit: 'mV', dec: 0, refs: [{ v: avg, color: '#4fd6ff', label: t('vd_avgref') + ' ' + avg.toFixed(0), dash: '5 4' }, { v: last.coreVoltage * 0.05, color: '#ff5d5d', label: t('vd_limit'), dash: '2 4' }] });
}

/* ===== Placas de hash: análise + alertas ===== */
function boardAnalyze(boards){
  const rates = boards.map(b => b.hashrate_ghs).filter(v => v != null).sort((a, b) => a - b);
  const med = rates.length ? rates[Math.floor(rates.length / 2)] : 0;
  const maxChips = Math.max(0, ...boards.map(b => b.chips || 0));
  return boards.map(b => {
    const issues = [];
    if(b.hashrate_ghs != null && (b.hashrate_ghs === 0 || (med > 0 && b.hashrate_ghs < med * 0.8))) issues.push('hashrate baixo');
    if(b.chips != null && maxChips > 0 && b.chips < maxChips) issues.push(`${maxChips - b.chips} chip(s) em falta`);
    if(b.tempChip != null && b.tempChip >= 85) issues.push('temperatura crítica');
    const level = issues.length ? 'bad' : (b.tempChip != null && b.tempChip >= 75 ? 'warn' : 'ok');
    return { b, issues, level };
  });
}
function renderBoards(){
  const sel = $('hbSel'); if(!sel) return;
  const list = devices.filter(d => readings[d.id] && readings[d.id].boards && readings[d.id].boards.length);
  if(sel.options.length !== list.length) sel.innerHTML = list.map(d => `<option value="${d.id}">${d.name || d.ip}</option>`).join('');
  const body = $('hbBody');
  if(!list.length){ body.innerHTML = '<tr><td colspan="7" class="hint">Sem dados por placa. Só máquinas LuxOS/Antminer (API cgminer) expõem esta informação.</td></tr>'; $('hbFans').textContent = ''; return; }
  const r = readings[sel.value || list[0].id];
  const f = (v, u, d = 1) => v == null ? '—' : Number(v).toFixed(d) + u;
  $('hbFans').textContent = r.fanList && r.fanList.length ? 'Ventoinhas do chassis (RPM): ' + r.fanList.map(Math.round).join(' · ') : '';
  body.innerHTML = boardAnalyze(r.boards).map(({ b, issues, level }) =>
    `<tr class="${level === 'ok' ? '' : 'hb-' + level}"><td>#${b.id}</td><td>${f(b.hashrate_ghs, ' GH/s', 0)}</td><td>${b.chips ?? '—'}</td><td>${f(b.tempChip, ' °C')}</td><td>${f(b.tempPcb, ' °C')}</td><td>${f(b.freq, ' MHz', 0)}</td><td>${issues.length ? '⚠️ ' + issues.join(', ') : '✅ OK'}</td></tr>`).join('');
}
const boardAlertState = {};
setInterval(() => {
  devices.forEach(d => {
    const r = readings[d.id]; if(!r || !r.online || !r.boards || !r.boards.length) return;
    boardAnalyze(r.boards).forEach(({ b, issues }) => {
      const key = d.id + ':' + b.id, st = boardAlertState[key] || (boardAlertState[key] = { n: 0, last: 0 });
      if(!issues.length){ st.n = 0; return; }
      st.n++;
      if(st.n >= 3 && Date.now() - st.last > 30 * 60000){
        st.last = Date.now();
        const nm = d.name || d.ip;
        addNotification('anomaly', 'Placa de hash com problema', `${nm} — placa #${b.id}: ${issues.join(', ')}`, nm);
      }
    });
  });
  if($('tab-boards') && $('tab-boards').classList.contains('active')) renderBoards();
}, 15000);

/* Parasite: flash quando um valor muda */
(function(){
  const ids = ['parasiteHashrate','parasiteBestDiff','parasiteWorkers','parasiteRank','parasitePoolHashrate','refineryCapacity','refineryUsed','refineryHashprice'];
  function arm(){
    if(!window.MutationObserver) return;
    ids.forEach(id => {
      const el = document.getElementById(id); if(!el) return;
      new MutationObserver(() => { el.classList.remove('pv-flash'); void el.offsetWidth; el.classList.add('pv-flash'); })
        .observe(el, { childList: true, characterData: true, subtree: true });
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arm); else arm();
})();

