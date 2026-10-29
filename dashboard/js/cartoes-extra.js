// ---------- Cartões: alertas de saúde, resumo do dia, reações a eventos e estado geral ----------
// Complementa o cartoes.js. O renderMachineCards chama o mcExtraRender a cada atualização.
const MC_STATS_KEY = 'nerdqaxe:daily_stats';
const MC_SENT_KEY = 'nerdqaxe:daily_sent';
const MC_PRICE_KEY = 'nerdqaxe:kwh_price';
Object.assign(mc, { health: {}, lastBest: {}, lastAcc: {}, lastDaily: 0, baseTitle: document.title });

// ---- 1. alertas de saúde (Telegram, Discord e aviso do Windows) ----
// Avisa quando uma máquina passa a ter um problema novo (temperatura, rejeições, Wi-Fi, pool, queda de
// hashrate) e quando volta ao normal. A primeira leitura não avisa; cada tipo tem 10 min de intervalo.
// Reinicia sozinha uma máquina presa, no máximo uma vez por 30 min, e só se estiver ligada a opção
// "permitir reinício automático crítico" das proteções do assistente.
async function mcAutoRestart(dev){
  if(dev.mute > Date.now()) return;
  if(typeof aiAgentConfig === 'undefined' || !aiAgentConfig.allowRestart || typeof aiRestartDevice !== 'function') return;
  mc.autoAt = mc.autoAt || {};
  if(Date.now() - (mc.autoAt[dev.id] || 0) < 30 * 60000) return;
  mc.autoAt[dev.id] = Date.now();
  const res = await aiRestartDevice(dev, { auto: true });
  mcLogEvent(mct(res && res.ok ? 'mc_l_autorestart' : 'mc_l_autofail', dev.name || dev.ip), res && res.ok ? 'warn' : 'bad', dev.id);
  if(res && res.ok && typeof sendAlert === 'function') sendAlert(mct('mc_l_autorestart', dev.name || dev.ip), 'autorestart-' + dev.id);
}
// ---- ciclo de energia pela tomada inteligente (desliga, espera e volta a ligar) ----
mc.plugAt = {}; mc.stuckAt = {};
async function mcPlugCycle(dev, auto){
  const name = dev.name || dev.ip;
  setQuickActionStatus(mct('mc_plug_running', name));
  try {
    if(window.authReady) await window.authReady;
    const resp = await fetch(`${API_BASE}/api/plug-cycle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip: dev.ip }) });
    const data = await resp.json();
    const msg = mct(data.ok ? 'mc_plug_ok' : 'mc_plug_fail', name, data.message || '');
    setQuickActionStatus(msg);
    mcLogEvent(msg, data.ok ? 'warn' : 'bad', dev.id);
    if(typeof sendAlert === 'function' && (auto || !data.ok)) sendAlert(msg, 'plug-' + dev.id);
  } catch(e) { setQuickActionStatus(mct('mc_plug_fail', name, e.message || '')); }
}
// se uma máquina continua presa 25 min depois, e a tomada está configurada, faz o ciclo de energia (no máximo de 2 em 2 horas)
function mcAutoPlug(list){
  const now = Date.now();
  list.forEach(dev => {
    const stuck = (mc.health[dev.id] || []).includes('stuck');
    if(!stuck){ delete mc.stuckAt[dev.id]; return; }
    if(!mc.stuckAt[dev.id]) mc.stuckAt[dev.id] = now;
    if(now - mc.stuckAt[dev.id] < 25 * 60000 || now - (mc.plugAt[dev.id] || 0) < 2 * 3600e3) return;
    if(!dev.plugOff || !dev.plugOn || dev.mute > now) return;
    if(typeof aiAgentConfig === 'undefined' || !aiAgentConfig.allowRestart) return;
    mc.plugAt[dev.id] = now;
    mcPlugCycle(dev, true);
  });
}
function mcHealthWatch(list){
  const on = typeof alertsConfig !== 'undefined' && alertsConfig.notify_health !== false && typeof sendAlert === 'function';
  list.forEach(dev => {
    const r = readings[dev.id], name = dev.name || dev.ip;
    if(!r || !r.online){ mc.health[dev.id] = []; return; }
    const items = mcAlertItems(dev, r, mcStateOf(r), mcTrendOf(dev)).filter(a => a.lvl === 'warn' || a.lvl === 'bad');
    const codes = items.map(a => a.code), prev = mc.health[dev.id];
    mc.health[dev.id] = codes;
    if(!on || prev === undefined || dev.mute > Date.now()) return;
    if(codes.includes('stuck') && !prev.includes('stuck')) mcAutoRestart(dev);
    items.filter(a => !prev.includes(a.code)).forEach(a => sendAlert((a.lvl === 'bad' ? '🚨 ' : '⚠️ ') + name + ': ' + a.txt.replace(/^\S+\s/, ''), 'health-' + a.code + '-' + dev.id));
    if(prev.length && !codes.length) sendAlert(mct('mc_h_back', name), 'healthok-' + dev.id);
  });
}

// ---- 2. reações a eventos nos cartões ----
function mcFlash(id, cls, ms){
  const el = mc.els.get(id);
  if(!el) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}
function mcWatchEvents(list){
  list.forEach(dev => {
    const r = readings[dev.id];
    if(!r || !r.online) return;
    const id = dev.id, best = Number(r.best) || 0, acc = Number(r.accepted) || 0;
    if(mc.lastBest[id] != null && best > mc.lastBest[id] * 1.0001){
      mc.recordUntil[id] = Date.now() + 90000;
      if(typeof mcArenaShot === 'function') mcArenaShot(id, 0, 0, true);
      mcFlash(id, 'mc-flash', 2600);
      if(typeof mcFloat === 'function') mcFloat(id, 1, true);
      mcLogEvent(mct('mc_l_record', dev.name || dev.ip), 'good', id);
      if(best >= 1e9 && typeof mcComRecord === 'function') mcComRecord(dev.name || dev.ip, best);
      if(best >= 1e9 && typeof hcChatAnnounce === 'function'){ const f = formatDiff(best); hcChatAnnounce('record', dev.name || dev.ip, f.value + ' ' + f.unit); }
    }
    const rej = Number(r.rejected) || 0;
    mc.lastRej = mc.lastRej || {};
    if((mc.lastAcc[id] != null && acc > mc.lastAcc[id]) || (mc.lastRej[id] != null && rej > mc.lastRej[id])){
      const dA = Math.max(0, acc - (mc.lastAcc[id] || acc)), dR = Math.max(0, rej - (mc.lastRej[id] || rej));
      if(typeof mcRainDrop === 'function') mcRainDrop(id, dA, dR);
      if(typeof mcArenaShot === 'function') mcArenaShot(id, dA, dR, false);
      if(typeof mcMapOwnShare === 'function' && dA) mcMapOwnShare(dA);
    }
    mc.lastRej[id] = rej;
    if(mc.lastAcc[id] != null && acc > mc.lastAcc[id]){ mcFlash(id, 'mc-ping', 900); if(typeof mcFloat === 'function') mcFloat(id, acc - mc.lastAcc[id], false); }
    mc.lastBest[id] = best; mc.lastAcc[id] = acc;
  });
}
// chamado pela celebração de bloco encontrado
function mcBlockFound(name){
  mcLuckBlock();
  if(typeof mcComBlock === 'function') mcComBlock(name);
  if(typeof hcChatAnnounce === 'function') hcChatAnnounce('block', name);
  const dev = (devices || []).find(d => (d.name || d.ip) === name) || null;
  if(!dev) return;
  const el = mc.els.get(dev.id);
  mcLogEvent(mct('mc_l_block', dev.name || dev.ip), 'good', dev.id);
  if(!el) return;
  mcFlash(dev.id, 'mc-gold', 9000);
  const burst = document.createElement('div');
  burst.className = 'mc-burst';
  for(let i = 0; i < 22; i++){
    const p = document.createElement('i');
    p.style.setProperty('--a', (i / 22 * 360 + Math.random() * 12).toFixed(0) + 'deg');
    p.style.setProperty('--d', (60 + Math.random() * 70).toFixed(0) + 'px');
    p.style.background = ['#ffd34a', '#21ffb0', '#4fd6ff', '#ff5d5d', '#fff'][i % 5];
    burst.appendChild(p);
  }
  el.appendChild(burst);
  setTimeout(() => burst.remove(), 2600);
}

// ---- 3. resumo do dia (últimas 24 h, com a comparação com ontem) ----
function mcPrice(){ try { const v = parseFloat(localStorage.getItem(MC_PRICE_KEY)); return isFinite(v) && v > 0 ? v : 0; } catch(e) { return 0; } }
// tarifa bi-horária (opcional): preço no vazio e horas do vazio; o preço usado nas contas é a média ponderada pelas horas
const MC_TARIFF_KEY = 'nerdqaxe:tariff';
const MC_GOAL_KEY = 'nerdqaxe:goal_ths';
function mcGoal(){ try { const v = parseFloat(localStorage.getItem(MC_GOAL_KEY)); return isFinite(v) && v > 0 ? v : 0; } catch(e) { return 0; } }
function mcTariff(){ try { const o = JSON.parse(localStorage.getItem(MC_TARIFF_KEY) || '{}'); return { off: Number(o.off) > 0 ? Number(o.off) : 0, from: Number.isInteger(o.from) ? o.from : 22, to: Number.isInteger(o.to) ? o.to : 8 }; } catch(e) { return { off: 0, from: 22, to: 8 }; } }
function mcEffPrice(){
  const full = mcPrice(), tf = mcTariff();
  if(!full || !(tf.off > 0)) return full;
  const offH = tf.from === tf.to ? 0 : (tf.to - tf.from + 24) % 24;
  return (full * (24 - offH) + tf.off * offH) / 24;
}
function mcStats(list){
  const now = Date.now(), cut = now - 24 * 3600e3, buckets = new Map();
  let kwh = 0, nowHash = 0, online = 0, watts = 0;
  list.forEach(dev => {
    const r = readings[dev.id];
    if(r && r.online){ online++; watts += Number(r.power) || 0; if(algoGroupOf(r) === 'sha256') nowHash += Number(r.hashrate) || 0; }
    const h = (histories[dev.id] || []).filter(x => x && x.ts >= cut);
    if(h.length < 2) return;
    const pw = h.map(x => Number(x.power)).filter(v => isFinite(v) && v > 0);
    if(pw.length) kwh += pw.reduce((a, b) => a + b, 0) / pw.length / 1000 * Math.min(24, (h[h.length - 1].ts - h[0].ts) / 3600e3);
    if(!h.some(x => algoGroupOf(x) === 'sha256')) return;
    const per = new Map();
    h.forEach(x => { const k = Math.floor(x.ts / 600000), a = per.get(k) || { s: 0, n: 0 }; a.s += Number(x.hashrate) || 0; a.n++; per.set(k, a); });
    per.forEach((a, k) => buckets.set(k, (buckets.get(k) || 0) + a.s / a.n));
  });
  const vals = [...buckets.values()];
  return { online, total: list.length, nowHash, watts, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, peak: vals.length ? Math.max(...vals) : 0, kwh, events: mc.log.length };
}
const mcDay = t => new Date(t).toISOString().slice(0, 10);
function mcStatsStore(st){
  let all = {};
  try { all = JSON.parse(localStorage.getItem(MC_STATS_KEY) || '{}'); } catch(e) {}
  const today = mcDay(Date.now() - new Date().getTimezoneOffset() * 60000), yest = mcDay(Date.now() - 86400e3 - new Date().getTimezoneOffset() * 60000);
  if(st && st.avg){ all[today] = { avg: st.avg, peak: st.peak, kwh: st.kwh, events: st.events }; Object.keys(all).sort().slice(0, -14).forEach(k => delete all[k]); try { localStorage.setItem(MC_STATS_KEY, JSON.stringify(all)); } catch(e) {} }
  return all[yest] || null;
}
const mcFmtHash = gh => { const f = formatHashrate(gh); return gh ? f.value + ' ' + f.unit : '—'; };
const mcDelta = (a, b) => (b > 0 && a > 0) ? (a - b) / b * 100 : null;
function mcSummaryText(st, y){
  const price = mcEffPrice(), d = y ? mcDelta(st.avg, y.avg) : null;
  return t('mc_d_head') + '\n' +
    mct('mc_d_online', st.online, st.total) + '\n' +
    mct('mc_d_avg', mcFmtHash(st.avg), d != null ? mct('mc_d_vs', d >= 0 ? '+' : '', d.toFixed(1)) : '') + '\n' +
    mct('mc_d_peak', mcFmtHash(st.peak)) + '\n' +
    mct('mc_d_energy', st.kwh.toFixed(2), price ? ' (≈ ' + (st.kwh * price).toFixed(2) + ' €)' : '') + '\n' +
    mct('mc_d_events', st.events);
}
function mcSendSummaryNow(){
  const st = mcStats(devices || []);
  if(typeof sendAlert === 'function') sendAlert(mcSummaryText(st, mcStatsStore(null)));
}
function mcDailyCheck(list){
  if(typeof alertsConfig === 'undefined' || !alertsConfig.notify_daily || !list.length) return;
  const now = new Date(), today = mcDay(now.getTime() - now.getTimezoneOffset() * 60000);
  if(now.getHours() < (alertsConfig.daily_hour != null ? alertsConfig.daily_hour : 21)) return;
  let sent = ''; try { sent = localStorage.getItem(MC_SENT_KEY) || ''; } catch(e) {}
  if(sent === today) return;
  try { localStorage.setItem(MC_SENT_KEY, today); } catch(e) {}
  mcSendSummaryNow();
}
function mcRenderSummary(list){
  const box = $('mcSummary');
  if(!box) return;
  if(!box.dataset.ready){
    box.dataset.ready = '1';
    box.innerHTML =
      '<div class="mc-tile"><span>' + t('mc_s_now') + '</span><b data-f="now">—</b><small data-f="nowS"></small></div>' +
      '<div class="mc-tile"><span>' + t('mc_s_avg') + '</span><b data-f="avg">—</b><small data-f="avgS"></small></div>' +
      '<div class="mc-tile"><span>' + t('mc_s_peak') + '</span><b data-f="peak">—</b><small data-f="peakS"></small></div>' +
      '<div class="mc-tile"><span>' + t('mc_s_energy') + '</span><b data-f="kwh">—</b><small><label>€/kWh <input type="number" step="0.01" min="0" id="mcPrice" placeholder="0.20"></label> <i data-f="cost"></i></small></div>' +
      '<div class="mc-tile"><span>' + t('mc_s_profit') + '</span><b data-f="profit">—</b><small data-f="profitS"></small></div>' +
      '<div class="mc-tile"><span>' + t('mc_s_chance') + '</span><b data-f="chance">—</b><small data-f="chanceS"></small></div>' +
      '<div class="mc-tile"><span>' + t('mc_s_goal') + '</span><b data-f="goal">—</b><div class="mc-goalbar"><i data-f="goalB"></i></div><small><label>TH/s <input type="number" step="0.1" min="0" id="mcGoal" placeholder="10"></label> <em data-f="goalS"></em></small></div>' +
      '<div class="mc-tile"><span>' + t('mc_s_events') + '</span><b data-f="ev">—</b><small data-f="evS"></small></div>' +
      (typeof mcCountTile === 'function' ? mcCountTile() : '') +
      '<div class="mc-tile mc-luck" data-f="luckBox"><span>🍀 ' + t('mc_lk_title') + '</span><b data-f="luck">—</b><div class="mc-luckbar"><i data-f="luckB"></i></div><small data-f="luckS"></small><small data-f="luckS2"></small></div>';
    const gi = $('mcGoal'); gi.value = mcGoal() || '';
    gi.addEventListener('input', () => { try { localStorage.setItem(MC_GOAL_KEY, gi.value); } catch(e) {} mcRenderSummary(devices || []); });
    const inp = $('mcPrice'); inp.value = mcPrice() || '';
    inp.addEventListener('input', () => { try { localStorage.setItem(MC_PRICE_KEY, inp.value); } catch(e) {} mcRenderSummary(devices || []); });
  }
  const st = mcStats(list), y = mcStatsStore(st), set = (f, t) => { const n = box.querySelector('[data-f="' + f + '"]'); if(n){ if(['avg', 'peak', 'kwh'].includes(f) && typeof mcNumTo === 'function') mcNumTo(n, t); else if(n.textContent !== t) n.textContent = t; } return n; };
  box.hidden = !list.length;
  set('now', mct('mc_g_online', st.online + '/' + st.total)); set('nowS', mcFmtHash(st.nowHash));
  set('avg', mcFmtHash(st.avg));
  const d = y ? mcDelta(st.avg, y.avg) : null, dn = set('avgS', d != null ? mct('mc_s_delta', d >= 0 ? '▲' : '▼', Math.abs(d).toFixed(1)) : t('mc_s_noy'));
  dn.className = d == null ? '' : d >= 0 ? 'up' : 'down';
  set('peak', mcFmtHash(st.peak)); set('peakS', st.peak && st.avg ? mct('mc_s_pct', (st.avg / st.peak * 100).toFixed(0)) : '');
  set('kwh', st.kwh ? st.kwh.toFixed(2) + ' kWh' : '—');
  set('cost', mcEffPrice() && st.kwh ? '≈ ' + (st.kwh * mcEffPrice()).toFixed(2) + ' €' : '');
  const eco = mcEconomics(st.nowHash, st.watts);
  if(!eco){ set('profit', '—'); set('profitS', t('mc_s_nodata')); set('chance', '—'); set('chanceS', t('mc_s_nodata')); }
  else {
    set('profit', (eco.profit >= 0 ? '+' : '') + eco.profit.toFixed(2) + ' €');
    set('profitS', eco.hasEur ? (mcEffPrice() ? mct('mc_s_revenue', eco.revenue.toFixed(2)) : t('mc_s_noprice')) : t('mc_s_nodata'));
    set('chance', mcBlockText(eco)); set('chanceS', eco.pYear >= 0.01 ? t('mc_s_peryear') : mct('mc_s_peryearpct', (eco.pYear * 100).toFixed(4)));
  }
  const goal = mcGoal(), pct = goal ? st.nowHash / (goal * 1000) * 100 : 0, gb = box.querySelector('[data-f="goalB"]');
  set('goal', goal ? pct.toFixed(0) + '%' : '—'); set('goalS', goal ? (pct >= 100 ? '✓' : mct('mc_s_goal_s', mcFmtHash(Math.max(0, goal * 1000 - st.nowHash)))) : t('mc_s_goal_none'));
  if(gb){ gb.style.width = Math.min(100, pct).toFixed(0) + '%'; gb.className = pct >= 100 ? '' : pct >= 80 ? 'warn' : 'bad'; }
  if(goal && pct >= 100 && typeof mcGoalConfetti === 'function') mcGoalConfetti(box);
  set('ev', String(st.events)); set('evS', st.events ? t('mc_s_seelog') : t('mc_s_calm'));
  mcLuckRender(box, set, eco);
}

// ---- sorte e blocos: esforço acumulado, distância do melhor share ao bloco e contador de blocos ----
// O esforço soma os hashes feitos enquanto a dashboard está aberta, a comparar com o trabalho esperado de um bloco
// (dificuldade × 2^32); passa dos 100% quando se tem azar e volta a zero quando se encontra um bloco.
const MC_LUCK_KEY = 'nerdqaxe:luck';
mc.luck = (() => { try { return Object.assign({ h: 0, n: 0, b: 0, since: Date.now() }, JSON.parse(localStorage.getItem(MC_LUCK_KEY) || '{}')); } catch(e) { return { h: 0, n: 0, b: 0, since: Date.now() }; } })();
mc.luckTick = 0; mc.luckSaved = 0;
function mcLuckSave(){ mc.luckSaved = Date.now(); try { localStorage.setItem(MC_LUCK_KEY, JSON.stringify(mc.luck)); } catch(e) {} }
function mcLuckTrack(list){
  const now = Date.now(), dt = mc.luckTick ? Math.min(now - mc.luckTick, 60000) / 1000 : 0;
  mc.luckTick = now;
  list.forEach(dev => {
    const r = readings[dev.id];
    if(!r || !r.online) return;
    if(dt && algoGroupOf(r) === 'sha256') mc.luck.h += (Number(r.hashrate) || 0) * 1e9 * dt;
    const b = Number(r.best);
    if(isFinite(b) && b > mc.luck.b) mc.luck.b = b;
  });
  if(now - mc.luckSaved > 30000) mcLuckSave();
}
function mcLuckBlock(){
  if(typeof mcArenaBoom === 'function') mcArenaBoom();
  mc.luck.n++; mc.luck.h = 0; mc.luck.since = Date.now(); mcLuckSave();
  const box = document.querySelector('#mcSummary .mc-luck');
  if(!box) return;
  box.classList.remove('won'); void box.offsetWidth; box.classList.add('won');
  setTimeout(() => box.classList.remove('won'), 9000);
  if(typeof mcXp === 'function' && !mcXp('confetti')) return;
  const burst = document.createElement('div');
  burst.className = 'mc-burst';
  for(let i = 0; i < 30; i++){
    const p = document.createElement('i');
    p.style.setProperty('--a', (i / 30 * 360 + Math.random() * 12).toFixed(0) + 'deg');
    p.style.setProperty('--d', (60 + Math.random() * 90).toFixed(0) + 'px');
    p.style.background = ['#ffd34a', '#21ffb0', '#4fd6ff', '#ff5d5d', '#fff'][i % 5];
    burst.appendChild(p);
  }
  box.appendChild(burst);
  setTimeout(() => burst.remove(), 2600);
}
function mcLuckRender(box, set, eco){
  const diff = typeof difficultyData !== 'undefined' && difficultyData && difficultyData.currentDifficulty;
  if(!diff){ set('luck', '—'); set('luckS', t('mc_s_nodata')); set('luckS2', ''); return; }
  const effort = mc.luck.h / (diff * 4294967296) * 100, best = mc.luck.b;
  const way = best > 1 ? Math.min(100, Math.log10(best) / Math.log10(diff) * 100) : 0, f = best > 0 ? formatDiff(best) : null;
  set('luck', effort >= 1 ? effort.toFixed(1) + ' %' : effort >= 0.001 ? effort.toFixed(3) + ' %' : effort.toExponential(1) + ' %');
  set('luckS', f ? mct('mc_lk_best', f.value + ' ' + f.unit, way.toFixed(0)) : t('mc_lk_nobest'));
  set('luckS2', mct('mc_lk_blocks', mc.luck.n) + (eco ? ' · ' + mcBlockText(eco) : ''));
  const bar = box.querySelector('[data-f="luckB"]');
  if(bar) bar.style.width = way.toFixed(1) + '%';
}

// ---- 4. estado geral: linha no topo e contagem no título do separador ----
function mcGlobalHealth(list, states){
  let bad = 0, warn = 0;
  list.forEach(d => { const s = states[d.id]; if(s === 'hot' || s === 'off') bad++; else if(s === 'warm' || s === 'warn' || s === 'portal') warn++; });
  const lvl = !list.length ? 'none' : bad ? 'bad' : warn ? 'warn' : 'ok';
  document.body.dataset.health = lvl;
  let line = $('healthLine');
  if(!line){
    const fr = $('mainFrame');
    if(!fr) return;
    line = document.createElement('div'); line.id = 'healthLine'; line.className = 'health-line';
    fr.insertBefore(line, fr.firstChild);
  }
  line.title = lvl === 'bad' ? mct('mc_gh_bad', bad) : lvl === 'warn' ? mct('mc_gh_warn', warn) : lvl === 'ok' ? t('mc_gh_ok') : '';
  document.title = (bad ? '🔴 ' + bad + ' · ' : warn ? '🟠 ' + warn + ' · ' : '') + mc.baseTitle;
}

// ---- exportar as máquinas e as leituras atuais para CSV (abre no Excel) ----
function mcExportCsv(){
  const cols = t('mc_x_cols').split('|');
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = (devices || []).map(d => {
    const r = readings[d.id] || {};
    return [d.name, d.ip, d.group, MC_STATUS[mcStateOf(readings[d.id])].label, r.online ? r.hashrate : '', r.temp, r.vrTemp, r.power, r.efficiency, r.fanPct, r.rssi, r.poolPing, r.pool, r.accepted, r.rejected, r.best, r.uptime, r.firmware, d.note].map(q).join(';');
  });
  const blob = new Blob(['\ufeff' + cols.map(q).join(';') + '\r\n' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'maquinas-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  if(typeof setQuickActionStatus === 'function') setQuickActionStatus(mct('mc_x_done', rows.length));
}

// ---- atalhos de teclado (só com o Dashboard Geral aberto e fora dos campos de texto) ----
document.addEventListener('keydown', e => {
  if(e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  const tab = $('mcBoard') && $('mcBoard').closest('.tab-content');
  if(!tab || !tab.classList.contains('active')) return;
  if(e.key === 'Escape'){
    if(typing && t.id === 'mcSearch'){ t.value = ''; mc.prefs.q = ''; mcSavePrefs(); renderMachineCards(); t.blur(); }
    else if(mc.picked.size){ mc.picked.clear(); renderMachineCards(); }
    return;
  }
  if(typing) return;
  const k = e.key.toLowerCase(), flt = { 1: 'all', 2: 'ok', 3: 'warn', 4: 'hot', 5: 'off' }[k];
  if(k === '/'){ e.preventDefault(); const s = $('mcSearch'); if(s){ s.scrollIntoView({ block: 'center', behavior: 'smooth' }); s.focus(); } }
  else if(flt){ mc.prefs.filter = flt; mcSavePrefs(); renderMachineCards(); }
  else if(k === 'g'){ mc.prefs.groupBy = !mc.prefs.groupBy; mcSavePrefs(); renderMachineCards(); }
  else if(k === 'v'){ const v = ['cards', 'compact', 'table', 'heat', 'plan']; mc.prefs.view = v[(v.indexOf(mc.prefs.view) + 1) % v.length]; mcSavePrefs(); renderMachineCards(); }
  else if(k === 'f'){ mc.prefs.fx = !mcFxOn(); mcSavePrefs(); renderMachineCards(); }
  else if(k === 'e'){ mcExportCsv(); }
});

// ---- lucro e chance de bloco (valor esperado; usa a dificuldade da rede e o preço do BTC) ----
const MC_REWARD_BTC = 3.125;
function mcEconomics(ghs, watts, inf){
  // inf (opcional): moeda da máquina. Sem ela assume Bitcoin, como antes.
  const coin = inf && inf.coin && typeof hcCoin !== 'undefined' ? inf.coin : 'BTC';
  const diff = coin === 'BTC' ? (typeof difficultyData !== 'undefined' && difficultyData && difficultyData.currentDifficulty) : hcCoin.netDiff(coin);
  const eur = coin === 'BTC' ? (typeof currentRates !== 'undefined' && currentRates && currentRates.btc_eur) : hcCoin.priceEur(coin);   // preço de 1 moeda em euros
  if(!(ghs > 0) || !diff || (coin !== 'BTC' && !hcCoin.algoOk(coin))) return null;
  const perDay = ghs * 1e9 * 86400 / (diff * 4294967296);          // blocos esperados por dia
  const revenue = eur ? perDay * (coin === 'BTC' ? MC_REWARD_BTC : hcCoin.reward(coin)) * eur : 0, price = mcEffPrice(), cost = price ? (watts || 0) / 1000 * 24 * price : 0;
  return { perDay, yearsPerBlock: perDay > 0 ? 1 / (perDay * 365) : Infinity, pYear: 1 - Math.exp(-perDay * 365), revenue, cost, profit: revenue - cost, hasEur: !!eur };
}
function mcBlockText(eco){
  if(eco.pYear >= 0.01) return (eco.pYear * 100).toFixed(1) + ' %';
  return mct('mc_block_1in', eco.yearsPerBlock >= 100 ? Math.round(eco.yearsPerBlock).toLocaleString(mcLocale()) : eco.yearsPerBlock.toFixed(1));
}

// ---- disponibilidade (percentagem do tempo online; conta enquanto a dashboard está aberta) ----
const MC_UP_KEY = 'nerdqaxe:uptime_days';
mc.up = (() => { try { return JSON.parse(localStorage.getItem(MC_UP_KEY) || '{}'); } catch(e) { return {}; } })();
mc.upTick = 0; mc.upSaved = 0;
function mcUptimeTrack(list){
  const now = Date.now(), dt = mc.upTick ? Math.min(now - mc.upTick, 60000) : 0;
  mc.upTick = now;
  if(!dt) return;
  const day = mcDay(now - new Date().getTimezoneOffset() * 60000);
  list.forEach(dev => {
    const r = readings[dev.id];
    if(!r) return;
    const rec = (mc.up[dev.id] = mc.up[dev.id] || {}), d = (rec[day] = rec[day] || [0, 0]);
    d[1] += dt; if(r.online) d[0] += dt;
  });
  if(now - mc.upSaved > 30000){
    mc.upSaved = now;
    const old = mcDay(now - 35 * 86400e3);
    Object.values(mc.up).forEach(rec => Object.keys(rec).forEach(k => { if(k < old) delete rec[k]; }));
    try { localStorage.setItem(MC_UP_KEY, JSON.stringify(mc.up)); } catch(e) {}
  }
}
function mcAvail(id, days){
  const rec = mc.up[id] || {}, from = mcDay(Date.now() - days * 86400e3);
  let on = 0, tot = 0;
  Object.keys(rec).forEach(k => { if(k >= from){ on += rec[k][0]; tot += rec[k][1]; } });
  return tot > 10 * 60000 ? on / tot * 100 : null;
}
function mcAvailText(id){
  const f = v => v == null ? '—' : v.toFixed(v >= 99.95 ? 0 : 1) + '%';
  return f(mcAvail(id, 7)) + ' · ' + f(mcAvail(id, 30));
}

// ---- notificações do navegador (neste PC), para além do Telegram e do Discord ----
const MC_BN_KEY = 'nerdqaxe:browser_notify';
function mcBrowserNotify(msg){
  try {
    if(localStorage.getItem(MC_BN_KEY) !== '1' || !('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification('Hash Commander', { body: String(msg).slice(0, 220) });
  } catch(e) {}
}
function mcToggleBrowserNotify(box){
  if(!box.checked){ try { localStorage.setItem(MC_BN_KEY, '0'); } catch(e) {} return; }
  if(!('Notification' in window)){ box.checked = false; return; }
  const ok = () => { try { localStorage.setItem(MC_BN_KEY, '1'); } catch(e) {} };
  if(Notification.permission === 'granted') return ok();
  Notification.requestPermission().then(p => { if(p === 'granted') ok(); else { box.checked = false; alert(t('mc_al_browser_denied')); } });
}
(function(){
  const box = $('alNotifyBrowser');
  if(!box) return;
  try { box.checked = localStorage.getItem(MC_BN_KEY) === '1' && 'Notification' in window && Notification.permission === 'granted'; } catch(e) {}
})();

// os dados da rede (dificuldade e preço do BTC) precisam de estar carregados para o lucro e a chance de bloco
function mcLoadNetwork(){
  if(document.hidden) return;
  try { if(typeof fetchDifficultyData === 'function') fetchDifficultyData(); } catch(e) {}
  try { if(typeof fetchRates === 'function') fetchRates(false); } catch(e) {}
}
setTimeout(mcLoadNetwork, 3000);
setInterval(mcLoadNetwork, 10 * 60000);
// enquanto não houver dados, tenta de novo a cada 20 s e assim que a janela volta a ser visível
const mcNetReady = () => typeof difficultyData !== 'undefined' && difficultyData && difficultyData.currentDifficulty;
setInterval(() => { if(!mcNetReady()) mcLoadNetwork(); }, 20000);
document.addEventListener('visibilitychange', () => { if(!document.hidden && !mcNetReady()) mcLoadNetwork(); });

// ---- linha do tempo do estado nas últimas 24 h (só guarda as mudanças) ----
const MC_TL_KEY = 'nerdqaxe:timeline';
mc.tl = (() => { try { return JSON.parse(localStorage.getItem(MC_TL_KEY) || '{}'); } catch(e) { return {}; } })();
mc.tlSaved = 0;
function mcTimelineTrack(list, states){
  const now = Date.now(), cut = now - 24 * 3600e3;
  list.forEach(dev => {
    const arr = mc.tl[dev.id] = mc.tl[dev.id] || [], st = states[dev.id];
    if(!arr.length || arr[arr.length - 1].s !== st) arr.push({ t: now, s: st });
    while(arr.length > 1 && arr[1].t < cut) arr.shift();      // fica uma entrada anterior às 24 h para o início da barra
  });
  if(now - mc.tlSaved > 30000){ mc.tlSaved = now; try { localStorage.setItem(MC_TL_KEY, JSON.stringify(mc.tl)); } catch(e) {} }
}
function mcTimelineHtml(id){
  const arr = mc.tl[id];
  if(!arr || !arr.length) return '';
  const now = Date.now(), from = now - 24 * 3600e3, W = now - from, tm = ts => new Date(ts).toLocaleTimeString(mcLocale(), { hour: '2-digit', minute: '2-digit' });
  let segs = '';
  if(arr[0].t > from) segs += '<i style="width:' + ((arr[0].t - from) / W * 100).toFixed(2) + '%;background:var(--line-strong);opacity:.4" title="' + t('mc_tl_none') + '"></i>';
  arr.forEach((e, i) => {
    const a = Math.max(e.t, from), b = i + 1 < arr.length ? arr[i + 1].t : now;
    if(b <= a) return;
    segs += '<i style="width:' + ((b - a) / W * 100).toFixed(2) + '%;background:' + MC_STATUS[e.s].color + '" title="' + MC_STATUS[e.s].label + ' · ' + tm(a) + ' → ' + tm(b) + '"></i>';
  });
  return '<div class="mc-hist-head"><span>' + t('mc_tl_title') + '</span></div><div class="mc-tl-bar">' + segs + '</div><div class="mc-hist-axis"><span>' + t('mc_tl_ago') + '</span><span>' + t('mc_tl_now') + '</span></div>';
}

// ---- sugestão de afinação: compara a eficiência (J/TH) observada em cada frequência nas últimas 24 h ----
function mcTuneHint(id){
  const h = (histories[id] || []).filter(x => x && x.ts >= Date.now() - 24 * 3600e3 && Number(x.frequency) > 0 && Number(x.hashrate) > 0 && Number(x.power) > 0);
  if(h.length < 16) return '';
  const g = {};
  h.forEach(x => {
    const f = Math.round(Number(x.frequency) / 5) * 5, e = (g[f] = g[f] || { n: 0, eff: 0 });
    e.n++; e.eff += Number(x.efficiency) > 0 ? Number(x.efficiency) : Number(x.power) / (Number(x.hashrate) / 1000);
  });
  const rows = Object.keys(g).map(f => ({ f: Number(f), n: g[f].n, eff: g[f].eff / g[f].n })).filter(r => r.n >= 8);
  if(rows.length < 2) return '';
  const cur = Math.round(Number(h[h.length - 1].frequency) / 5) * 5, now = rows.find(r => r.f === cur), best = rows.reduce((a, b) => b.eff < a.eff ? b : a);
  if(!now || best.f === now.f || best.eff > now.eff * 0.97) return '';
  return '<div class="mc-hint-tune">' + mct('mc_tune_better', best.f, best.eff.toFixed(1), now.f, now.eff.toFixed(1)) + '</div>';
}

// ---- pausa global dos alertas e queda de rede ----
const MC_PAUSE_KEY = 'nerdqaxe:alerts_pause_until';
mc.netDown = false;
function mcPausedUntil(){ try { const v = Number(localStorage.getItem(MC_PAUSE_KEY)) || 0; return v > Date.now() ? v : 0; } catch(e) { return 0; } }
// devolve false para os alertas que não devem sair: tudo durante a pausa e os avisos de cada máquina durante uma queda de rede
function mcAlertFilter(message, key){
  if(mcPausedUntil()) return false;
  if(mc.netDown && /^(offline|health|healthok|hashdrop|portal|autorestart)/.test(String(key || ''))) return false;
  return true;
}
function mcPauseAlerts(minutes){
  try { if(minutes > 0) localStorage.setItem(MC_PAUSE_KEY, String(Date.now() + minutes * 60000)); else localStorage.removeItem(MC_PAUSE_KEY); } catch(e) {}
  mcPausedRender();
}
function mcPausedRender(){
  const box = $('mcPaused');
  if(!box) return;
  const u = mcPausedUntil();
  box.hidden = !u;
  if(!u){ box.innerHTML = ''; return; }
  const h = '<span>' + mct('mc_paused_until', new Date(u).toLocaleTimeString(mcLocale(), { hour: '2-digit', minute: '2-digit' })) + '</span><button type="button" data-p="resume">' + t('mc_resume') + '</button>';
  if(box.dataset.s !== h){ box.dataset.s = h; box.innerHTML = h; }
}
document.addEventListener('click', e => { if(e.target.closest('#mcPaused [data-p="resume"]')) mcPauseAlerts(0); });
function mcNetWatch(list, states){
  const n = list.length;
  if(n < 2) { mc.netDown = false; return; }
  const off = list.filter(d => states[d.id] === 'off' || states[d.id] === 'idle').length;
  const was = list.filter(d => mc.wasOnline && mc.wasOnline[d.id]).length;
  const down = off >= Math.max(2, Math.ceil(n * 0.8));
  if(down && !mc.netDown && was >= 2){
    mc.netDown = true;
    mcLogEvent(mct('mc_net_down', off), 'bad');
    if(typeof sendAlert === 'function') sendAlert(mct('mc_net_down', off), 'netdown');
  } else if(mc.netDown && off < Math.max(2, Math.ceil(n * 0.8))){
    mc.netDown = false;
    mcLogEvent(t('mc_net_up'), 'good');
    if(typeof sendAlert === 'function') sendAlert(t('mc_net_up'), 'netup');
  }
  mc.wasOnline = mc.wasOnline || {};
  list.forEach(d => { mc.wasOnline[d.id] = states[d.id] !== 'off' && states[d.id] !== 'idle'; });
}

function mcExtraRender(list, states){
  if(typeof mcLockRender === 'function') mcLockRender();
  mcPausedRender();
  mcAutoPlug(list);
  mcNetWatch(list, states);
  mcTimelineTrack(list, states);
  mcUptimeTrack(list);
  mcLuckTrack(list);
  if(typeof mcRulesTick === 'function') mcRulesTick(list);
  if(typeof mcToolsRender === 'function') mcToolsRender();
  mcGlobalHealth(list, states);
  mcWatchEvents(list);
  mcHealthWatch(list);
  mcRenderSummary(list);
  if(typeof mcComEnsure === 'function') mcComEnsure();
  if(Date.now() - mc.lastDaily > 60000){ mc.lastDaily = Date.now(); mcDailyCheck(list); }
}

renderMachineCards();
