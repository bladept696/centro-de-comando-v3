// ---------- Cartões: alertas de saúde, resumo do dia, reações a eventos e estado geral ----------
// Complementa o cartoes.js. O renderMachineCards chama o mcExtraRender a cada atualização.
const MC_STATS_KEY = 'nerdqaxe:daily_stats';
const MC_SENT_KEY = 'nerdqaxe:daily_sent';
const MC_PRICE_KEY = 'nerdqaxe:kwh_price';
Object.assign(mc, { health: {}, lastBest: {}, lastAcc: {}, lastDaily: 0, baseTitle: document.title });

// ---- 1. alertas de saúde (Telegram, Discord e aviso do Windows) ----
// Avisa quando uma máquina passa a ter um problema novo (temperatura, rejeições, Wi-Fi, pool, queda de
// hashrate) e quando volta ao normal. A primeira leitura não avisa; cada tipo tem 10 min de intervalo.
function mcHealthWatch(list){
  const on = typeof alertsConfig !== 'undefined' && alertsConfig.notify_health !== false && typeof sendAlert === 'function';
  list.forEach(dev => {
    const r = readings[dev.id], name = dev.name || dev.ip;
    if(!r || !r.online){ mc.health[dev.id] = []; return; }
    const items = mcAlertItems(dev, r, mcStateOf(r), mcTrendOf(dev)).filter(a => a.lvl === 'warn' || a.lvl === 'bad');
    const codes = items.map(a => a.code), prev = mc.health[dev.id];
    mc.health[dev.id] = codes;
    if(!on || prev === undefined) return;
    items.filter(a => !prev.includes(a.code)).forEach(a => sendAlert((a.lvl === 'bad' ? '🚨 ' : '⚠️ ') + name + ': ' + a.txt.replace(/^\S+\s/, ''), 'health-' + a.code + '-' + dev.id));
    if(prev.length && !codes.length) sendAlert('✅ ' + name + ': voltou ao normal.', 'healthok-' + dev.id);
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
      mcFlash(id, 'mc-flash', 2600);
      mcLogEvent((dev.name || dev.ip) + ': novo recorde de dificuldade', 'good', id);
    }
    if(mc.lastAcc[id] != null && acc > mc.lastAcc[id]) mcFlash(id, 'mc-ping', 900);
    mc.lastBest[id] = best; mc.lastAcc[id] = acc;
  });
}
// chamado pela celebração de bloco encontrado
function mcBlockFound(name){
  const dev = (devices || []).find(d => (d.name || d.ip) === name) || null;
  if(!dev) return;
  const el = mc.els.get(dev.id);
  mcLogEvent((dev.name || dev.ip) + ': BLOCO ENCONTRADO! 🎉', 'good', dev.id);
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
function mcStats(list){
  const now = Date.now(), cut = now - 24 * 3600e3, buckets = new Map();
  let kwh = 0, nowHash = 0, online = 0;
  list.forEach(dev => {
    const r = readings[dev.id];
    if(r && r.online){ online++; if(algoGroupOf(r) === 'sha256') nowHash += Number(r.hashrate) || 0; }
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
  return { online, total: list.length, nowHash, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, peak: vals.length ? Math.max(...vals) : 0, kwh, events: mc.log.length };
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
  const price = mcPrice(), d = y ? mcDelta(st.avg, y.avg) : null;
  return '📊 Resumo das últimas 24 h\n' +
    '⛏️ Máquinas online: ' + st.online + '/' + st.total + '\n' +
    '⚡ Hashrate médio: ' + mcFmtHash(st.avg) + (d != null ? ' (' + (d >= 0 ? '+' : '') + d.toFixed(1) + '% vs ontem)' : '') + '\n' +
    '📈 Pico: ' + mcFmtHash(st.peak) + '\n' +
    '🔌 Energia: ' + st.kwh.toFixed(2) + ' kWh' + (price ? ' (≈ ' + (st.kwh * price).toFixed(2) + ' €)' : '') + '\n' +
    '⚠️ Eventos hoje: ' + st.events;
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
      '<div class="mc-tile"><span>Agora</span><b data-f="now">—</b><small data-f="nowS"></small></div>' +
      '<div class="mc-tile"><span>Média 24 h</span><b data-f="avg">—</b><small data-f="avgS"></small></div>' +
      '<div class="mc-tile"><span>Pico 24 h</span><b data-f="peak">—</b><small data-f="peakS"></small></div>' +
      '<div class="mc-tile"><span>Energia 24 h</span><b data-f="kwh">—</b><small><label>€/kWh <input type="number" step="0.01" min="0" id="mcPrice" placeholder="0.20"></label> <i data-f="cost"></i></small></div>' +
      '<div class="mc-tile"><span>Eventos hoje</span><b data-f="ev">—</b><small data-f="evS"></small></div>';
    const inp = $('mcPrice'); inp.value = mcPrice() || '';
    inp.addEventListener('input', () => { try { localStorage.setItem(MC_PRICE_KEY, inp.value); } catch(e) {} mcRenderSummary(devices || []); });
  }
  const st = mcStats(list), y = mcStatsStore(st), set = (f, t) => { const n = box.querySelector('[data-f="' + f + '"]'); if(n && n.textContent !== t) n.textContent = t; return n; };
  box.hidden = !list.length;
  set('now', st.online + '/' + st.total + ' online'); set('nowS', mcFmtHash(st.nowHash));
  set('avg', mcFmtHash(st.avg));
  const d = y ? mcDelta(st.avg, y.avg) : null, dn = set('avgS', d != null ? (d >= 0 ? '▲ ' : '▼ ') + Math.abs(d).toFixed(1) + '% vs ontem' : 'sem dados de ontem');
  dn.className = d == null ? '' : d >= 0 ? 'up' : 'down';
  set('peak', mcFmtHash(st.peak)); set('peakS', st.peak && st.avg ? 'média ' + (st.avg / st.peak * 100).toFixed(0) + '% do pico' : '');
  set('kwh', st.kwh ? st.kwh.toFixed(2) + ' kWh' : '—');
  set('cost', mcPrice() && st.kwh ? '≈ ' + (st.kwh * mcPrice()).toFixed(2) + ' €' : '');
  set('ev', String(st.events)); set('evS', st.events ? 'ver "Eventos de hoje"' : 'tudo calmo');
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
  line.title = lvl === 'bad' ? bad + ' máquina(s) em falha' : lvl === 'warn' ? warn + ' máquina(s) com aviso' : lvl === 'ok' ? 'Tudo a funcionar' : '';
  document.title = (bad ? '🔴 ' + bad + ' · ' : warn ? '🟠 ' + warn + ' · ' : '') + mc.baseTitle;
}

function mcExtraRender(list, states){
  mcGlobalHealth(list, states);
  mcWatchEvents(list);
  mcHealthWatch(list);
  mcRenderSummary(list);
  if(Date.now() - mc.lastDaily > 60000){ mc.lastDaily = Date.now(); mcDailyCheck(list); }
}

renderMachineCards();
