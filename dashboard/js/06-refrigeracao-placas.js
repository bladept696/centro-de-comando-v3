/* ===== Refrigeração líquida + VDroop ===== */
let coolTimer = null, coolFormLoaded = false;
function coolingStart(){ coolingStop(); coolFormLoaded = false; loadCoolingStatus(); renderVdroop(); coolTimer = setInterval(() => { loadCoolingStatus(); renderVdroop(); }, 3000); }
function coolingStop(){ if(coolTimer){ clearInterval(coolTimer); coolTimer = null; } }
function coolDrawLines(svgId, series){
  const svg = $(svgId); if(!svg) return;
  const all = series.flatMap(x => x.vals.filter(v => v != null));
  if(all.length < 2){ svg.innerHTML = '<text x="300" y="65" text-anchor="middle" fill="#7f8ea3" font-size="12">Sem dados</text>'; return; }
  let min = Math.min(...all), max = Math.max(...all);
  if(max - min < 1e-6){ max += 1; min -= 1; }
  const pad = (max - min) * 0.1; min -= pad; max += pad;
  const W = 600, H = 120;
  let out = `<text x="4" y="12" fill="#7f8ea3" font-size="10">${max.toFixed(2)}</text><text x="4" y="${H-4}" fill="#7f8ea3" font-size="10">${min.toFixed(2)}</text>`;
  for(const x of series){
    const n = x.vals.length - 1;
    const pts = x.vals.map((v, i) => v == null ? null : `${(i / n * W).toFixed(1)},${(H - (v - min) / (max - min) * H).toFixed(1)}`).filter(Boolean).join(' ');
    out += `<polyline fill="none" stroke="${x.color}" stroke-width="1.6" points="${pts}"/>`;
  }
  svg.innerHTML = out;
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
  $('coolFlow').textContent = r.flow_lpm == null ? '—' : r.flow_lpm.toFixed(2) + ' L/min';
  $('coolIn').textContent = r.coolant_in_c == null ? '—' : f(r.coolant_in_c) + ' °C';
  $('coolOut').textContent = r.coolant_out_c == null ? '—' : f(r.coolant_out_c) + ' °C';
  $('coolDelta').textContent = (r.coolant_in_c == null || r.coolant_out_c == null) ? '—' : (r.coolant_out_c - r.coolant_in_c).toFixed(1) + ' °C';
  const ban = $('coolBanner');
  if(d.tripped){
    ban.innerHTML = `<div class="cool-banner trip">🛑 <b>KILLSWITCH ACIONADO</b> — ${d.trip_reason} · relé: ${d.relay_result || '—'} <button class="config ghost" onclick="coolReset()">Limpar bloqueio</button></div>`;
  } else if(c.enabled && d.error){
    ban.innerHTML = `<div class="cool-banner warn">⚠️ Sensor sem resposta: ${d.error}. O killswitch não consegue atuar sem leituras.</div>`;
  } else if(!c.enabled){
    ban.innerHTML = '<div class="cool-banner warn">Monitorização desativada.</div>';
  } else ban.innerHTML = '';
  const h = d.history || [];
  coolDrawLines('coolFlowChart', [{ vals: h.map(x => x.flow_lpm), color: '#21ffb0' }]);
  coolDrawLines('coolTempChart', [{ vals: h.map(x => x.coolant_in_c), color: '#4fd6ff' }, { vals: h.map(x => x.coolant_out_c), color: '#ffb020' }]);
}
async function saveCoolingConfig(){
  const body = { enabled: $('coolEnabled').checked, killswitch_enabled: $('coolKs').checked, sensor_url: $('coolUrl').value, relay_off_url: $('coolRelayOff').value, relay_on_url: $('coolRelayOn').value, min_flow_lpm: $('coolMinFlow').value, grace_seconds: $('coolGrace').value, max_coolant_out_c: $('coolMaxOut').value };
  try { await fetch(`${API_BASE}/api/coolant/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch(e){ alert('Erro a guardar.'); return; }
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
  const set = (v, t) => { $(v).textContent = t; };
  if(h.length < 2){ ['vdSetAct','vdNow','vdAvg','vdCv'].forEach(k => set(k, '—')); $('vdVerdict').textContent = 'Sem leituras de coreVoltageActual (a máquina precisa de expor este campo no firmware).'; coolDrawLines('vdChart', [{ vals: [], color: '#ffb020' }]); return; }
  const droops = h.map(x => x.coreVoltage - x.coreVoltageActual);
  const last = h[h.length - 1], dNow = droops[droops.length - 1];
  const avg = droops.reduce((a, b) => a + b, 0) / droops.length, max = Math.max(...droops);
  const hr = h.map(x => x.hashrate).filter(v => v > 0);
  const m = hr.reduce((a, b) => a + b, 0) / (hr.length || 1);
  const cv = hr.length > 2 && m > 0 ? Math.sqrt(hr.reduce((a, b) => a + (b - m) ** 2, 0) / hr.length) / m * 100 : null;
  set('vdSetAct', `${Math.round(last.coreVoltage)} / ${Math.round(last.coreVoltageActual)} mV`);
  set('vdNow', `${dNow.toFixed(0)} mV (${(dNow / last.coreVoltage * 100).toFixed(1)}%)`);
  set('vdAvg', `${avg.toFixed(0)} / ${max.toFixed(0)} mV`);
  set('vdCv', cv == null ? '—' : cv.toFixed(1) + '%');
  const pct = dNow / last.coreVoltage * 100, v = [];
  if(pct > 5) v.push('⚠️ droop acima de 5% da tensão definida — o VRM pode estar no limite');
  if(cv != null && cv > 5) v.push('⚠️ hashrate instável (variação > 5%)');
  $('vdVerdict').textContent = v.length ? v.join(' · ') : '✅ Droop e hashrate estáveis na janela atual.';
  const stride = Math.max(1, Math.floor(droops.length / 300));
  coolDrawLines('vdChart', [{ vals: droops.filter((_, i) => i % stride === 0), color: '#ffb020' }]);
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

