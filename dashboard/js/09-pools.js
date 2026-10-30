Object.assign(I18N_DICT, {
  "gp_s_addr_ph": { pt: `O teu endereço nesta pool`, en: `Your address on this pool`, es: `Tu dirección en este pool`, fr: `Votre adresse sur ce pool` },
  "gp_s_addr": { pt: `endereço`, en: `address`, es: `dirección`, fr: `adresse` },
  "gp_s_best": { pt: `O teu melhor diff (pool)`, en: `Your best diff (pool)`, es: `Tu mejor diff (pool)`, fr: `Votre meilleur diff (pool)` },
  "gp_s_net": { pt: `Dif. para o bloco`, en: `Diff to the block`, es: `Dif. para el bloque`, fr: `Diff pour le bloc` },
  "gp_s_prog": { pt: `Progresso até ao bloco`, en: `Progress to the block`, es: `Progreso hasta el bloque`, fr: `Progression vers le bloc` },
  "gp_n_conn": { pt: `Sem ligação ao servidor local.`, en: `No connection to the local server.`, es: `Sin conexión con el servidor local.`, fr: `Pas de connexion au serveur local.` },
  "gp_n_err": { pt: `Erro a obter dados da pool: `, en: `Error getting pool data: `, es: `Error al obtener datos del pool: `, fr: `Erreur de lecture des données du pool : ` },
  "gp_n_stale": { pt: `Últimos dados conhecidos (a pool não respondeu agora).`, en: `Last known data (the pool did not answer just now).`, es: `Últimos datos conocidos (el pool no respondió ahora).`, fr: `Dernières données connues (le pool n’a pas répondu à l’instant).` },
  "gp_l_miners": { pt: `Mineradores`, en: `Miners`, es: `Mineros`, fr: `Mineurs` },
  "gp_l_phash": { pt: `Hashrate da pool`, en: `Pool hashrate`, es: `Hashrate del pool`, fr: `Hashrate du pool` },
  "gp_l_nhash": { pt: `Hashrate da rede`, en: `Network hashrate`, es: `Hashrate de la red`, fr: `Hashrate du réseau` },
  "gp_l_height": { pt: `Altura`, en: `Height`, es: `Altura`, fr: `Hauteur` },
  "gp_l_ndiff": { pt: `Dif. da rede`, en: `Network diff.`, es: `Dif. de la red`, fr: `Diff. du réseau` },
  "gp_l_last": { pt: `Último bloco`, en: `Last block`, es: `Último bloque`, fr: `Dernier bloc` },
  "gp_l_fee": { pt: `Comissão`, en: `Fee`, es: `Comisión`, fr: `Frais` },
  "gp_a_best": { pt: `⭐ O teu melhor diff`, en: `⭐ Your best diff`, es: `⭐ Tu mejor diff`, fr: `⭐ Votre meilleur diff` },
  "gp_a_hash": { pt: `O teu hashrate`, en: `Your hashrate`, es: `Tu hashrate`, fr: `Votre hashrate` },
  "gp_a_workers": { pt: `Máquinas`, en: `Workers`, es: `Máquinas`, fr: `Machines` },
  "gp_offline": { pt: `offline`, en: `offline`, es: `sin conexión`, fr: `hors ligne` },
  "gp_you": { pt: `⭐ Tu`, en: `⭐ You`, es: `⭐ Tú`, fr: `⭐ Vous` },
  "gp_noblocks": { pt: `Sem blocos recentes.`, en: `No recent blocks.`, es: `Sin bloques recientes.`, fr: `Aucun bloc récent.` },
  "gp_nt_found": { pt: `Bloco encontrado! 🎉`, en: `Block found! 🎉`, es: `¡Bloque encontrado! 🎉`, fr: `Bloc trouvé ! 🎉` },
  "gp_nt_new": { pt: `Novo bloco na pool`, en: `New block on the pool`, es: `Nuevo bloque en el pool`, fr: `Nouveau bloc sur le pool` },
  "gp_nt_desc": { pt: `{0} — altura {1}, dificuldade {2}`, en: `{0} — height {1}, difficulty {2}`, es: `{0} — altura {1}, dificultad {2}`, fr: `{0} — hauteur {1}, difficulté {2}` }
});

/* ===== Destaque da pool na página principal ===== */
function gpSpotSaveAddress(){
  const inp = $('gpSpotAddrInput'); if(!inp) return;
  const addr = inp.value.trim(); if(!addr) return;
  try { localStorage.setItem(gpAddrKey(GP_SPOTLIGHT_POOL), addr); } catch(e){}
  if(GP_STATE.current === GP_SPOTLIGHT_POOL && $('gpAddress')) $('gpAddress').value = addr;
  gpSpotRender();
}
async function gpSpotRender(){
  const el = $('gpSpotlight'); if(!el) return;
  const addr = gpLoadAddr(GP_SPOTLIGHT_POOL);
  if(!addr){
    el.style.display = '';
    el.innerHTML = `<div class="gp-spot-empty gp-spot-setup">🪙 Molepool —
      <input type="text" id="gpSpotAddrInput" placeholder="${t('gp_s_addr_ph')}">
      <button class="power-save-btn" onclick="gpSpotSaveAddress()">${t('gp_guardar')}</button>
    </div>`;
    const inp = $('gpSpotAddrInput');
    if(inp) inp.addEventListener('keydown', e => { if(e.key === 'Enter') gpSpotSaveAddress(); });
    return;
  }
  let data;
  try { data = await (await fetch(`${API_BASE}/api/generic-pool?pool=${GP_SPOTLIGHT_POOL}&address=${encodeURIComponent(addr)}`)).json(); }
  catch(e){ return; }
  if(!data || data.network_difficulty == null){ return; }
  // O melhor diff vem da própria pool (bestShare.share da conta), não das máquinas --
  // é o valor que a pool reconhece oficialmente, pode diferir do que o firmware mostra.
  const acc = data.account || {};
  const best = Number(acc.best_share) || 0;
  const netDiff = Number(data.network_difficulty);
  const pct = netDiff > 0 ? Math.min(100, best / netDiff * 100) : 0;
  const short = addr.length > 14 ? addr.slice(0, 8) + '…' + addr.slice(-6) : addr;
  el.style.display = '';
  el.innerHTML = `
    <div class="gp-spot-item"><span class="lbl">🪙 Molepool — ${t('gp_s_addr')}</span><span class="val addr" title="${mpEsc(addr)}" onclick="navigator.clipboard?.writeText('${mpEsc(addr)}')">${mpEsc(short)}</span></div>
    <div class="gp-spot-item"><span class="lbl">${t('gp_s_best')}</span><span class="val">${best > 0 ? formatDiff(best).value + formatDiff(best).unit : '—'}</span></div>
    <div class="gp-spot-item"><span class="lbl">${t('gp_s_net')}</span><span class="val">${formatDiff(netDiff).value}${formatDiff(netDiff).unit}</span></div>
    <div class="gp-spot-bar">
      <div class="lbl">${t('gp_s_prog')}</div>
      <div class="gp-spot-track"><div class="gp-spot-fill" style="width:${pct.toFixed(4)}%"></div></div>
      <div class="gp-spot-pct">${pct < 0.01 ? pct.toFixed(6) : pct.toFixed(2)}%</div>
    </div>`;
}
let gpSpotTimer = null;
function gpSpotStart(){ gpSpotRender(); if(!gpSpotTimer) gpSpotTimer = setInterval(gpSpotRender, 15000); }
(function(){
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', gpSpotStart); else gpSpotStart();
})();

/* ===== Pools genéricas (Miningcore e semelhantes) ===== */
const GP_STATE = { pools: {}, current: '', timer: null, seenBlocks: new Set() };
function gpAddrKey(id){ return 'hc_gp_addr_' + id; }
function gpLoadAddr(id){ try { return localStorage.getItem(gpAddrKey(id)) || ''; } catch(e){ return ''; } }
function gpSaveAddress(){
  if(!GP_STATE.current) return;
  try { localStorage.setItem(gpAddrKey(GP_STATE.current), $('gpAddress').value.trim()); } catch(e){}
  gpFetch(true);
  if(GP_STATE.current === GP_SPOTLIGHT_POOL) gpSpotRender();
}
async function gpLoadPoolList(){
  const sel = $('gpSelect'); if(!sel || sel.options.length) return;
  try {
    const list = await (await fetch(`${API_BASE}/api/generic-pools`)).json();
    GP_STATE.pools = list || {};
    sel.innerHTML = Object.entries(GP_STATE.pools).map(([id, p]) => `<option value="${id}">${mpEsc(p.label)} (${mpEsc(p.coin)})</option>`).join('');
    if(sel.options.length) GP_STATE.current = sel.value;
  } catch(e){}
}
function gpSwitchPool(){
  GP_STATE.current = $('gpSelect').value;
  $('gpAddress').value = gpLoadAddr(GP_STATE.current);
  GP_STATE.seenBlocks.clear();
  gpFetch(true);
}
function gpTimeAgo(ts){
  if(!ts) return '—';
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if(s < 60) return s + 's';
  if(s < 3600) return Math.floor(s / 60) + 'm';
  if(s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}
async function gpFetch(first){
  if(!GP_STATE.current) return;
  const addr = $('gpAddress').value.trim();
  let data;
  try { data = await (await fetch(`${API_BASE}/api/generic-pool?pool=${encodeURIComponent(GP_STATE.current)}&address=${encodeURIComponent(addr)}`)).json(); }
  catch(e){ $('gpNote').textContent = t('gp_n_conn'); return; }
  if(data.error && !data.total_miners){ $('gpNote').textContent = t('gp_n_err') + data.error; return; }
  $('gpNote').textContent = data.stale ? t('gp_n_stale') : '';
  const stats = $('gpStats');
  const fmtDiff = v => { if(v == null || isNaN(v)) return '—'; const f = formatDiff(v); return f.value + f.unit; };
  const fmtHash = v => { if(v == null || isNaN(v)) return '—'; const f = formatDiff(v); return f.value + f.unit + 'H/s'; };
  stats.innerHTML = [
    [t('gp_l_miners'), data.total_miners ?? '—'],
    [t('gp_l_phash'), fmtHash(data.pool_hashrate)],
    [t('gp_l_nhash'), fmtHash(data.network_hashrate)],
    [t('gp_l_height'), data.height ?? '—'],
    [t('gp_l_ndiff'), fmtDiff(data.network_difficulty)],
    [t('gp_l_last'), gpTimeAgo(data.last_block_found)],
    [t('gp_l_fee'), (data.fee_percent != null ? data.fee_percent + '%' : '—')],
  ].map(([l, v]) => `<div class="gp-stat"><div class="lbl">${l}</div><div class="val">${v}</div></div>`).join('');
  const accEl = $('gpAccount');
  if(data.account){
    const acc = data.account;
    accEl.style.display = '';
    const workers = (acc.workers || []).map(w => `${mpEsc(w.name)}: ${fmtHash(w.hashrate)}${w.offline ? ' (' + t('gp_offline') + ')' : ''}`).join(' · ') || '—';
    accEl.innerHTML = [
      [t('gp_a_best'), fmtDiff(acc.best_share)],
      [t('gp_a_hash'), fmtHash(acc.current_hashrate)],
      [t('gp_a_workers'), workers],
    ].map(([l, v]) => `<div class="gp-stat"><div class="lbl">${l}</div><div class="val">${v}</div></div>`).join('');
  } else { accEl.style.display = 'none'; accEl.innerHTML = ''; }
  const rows = [...(data.candidates || []), ...(data.blocks || [])];
  $('gpBlocksBody').innerHTML = rows.map(b => {
    const who = b.mine ? t('gp_you') : (b.miner ? b.miner.slice(0, 6) + '…' + b.miner.slice(-4) : '—');
    const st = b.status || '—', stClass = (st === 'confirmed') ? 'confirmed' : (st === 'pending' || st === 'immature') ? 'pending' : '';
    return `<tr class="${b.mine ? 'gp-mine' : ''}"><td>${b.height ?? '—'}</td><td>${mpEsc(who)}</td><td>${fmtDiff(b.diff)}</td><td>${b.effort != null ? (b.effort * 100).toFixed(0) + '%' : '—'}</td><td><span class="gp-badge ${stClass}">${mpEsc(st)}</span></td><td>${gpTimeAgo(b.ts)}</td></tr>`;
  }).join('') || '<tr><td colspan="6" class="hint">' + t('gp_noblocks') + '</td></tr>';
  if(first) { (data.blocks || []).forEach(b => GP_STATE.seenBlocks.add(b.hash)); return; }
  [...(data.candidates || []), ...(data.blocks || [])].forEach(b => {
    if(!b.hash || GP_STATE.seenBlocks.has(b.hash)) return;
    GP_STATE.seenBlocks.add(b.hash);
    const poolLabel = (GP_STATE.pools[GP_STATE.current] || {}).label || GP_STATE.current;
    if(b.mine){
      addNotification('block', t('gp_nt_found'), t('gp_nt_desc').replace('{0}', poolLabel).replace('{1}', b.height).replace('{2}', (f => f.value + f.unit)(formatDiff(b.diff))), poolLabel);
    } else {
      addNotification('best', t('gp_nt_new'), t('gp_nt_desc').replace('{0}', poolLabel).replace('{1}', b.height).replace('{2}', (f => f.value + f.unit)(formatDiff(b.diff))), poolLabel);
    }
  });
}
async function gpStart(){
  gpStop();
  await gpLoadPoolList();
  if(!GP_STATE.current) return;
  $('gpAddress').value = gpLoadAddr(GP_STATE.current);
  await gpFetch(true);
  GP_STATE.timer = setInterval(() => gpFetch(false), 20000);
}
function gpStop(){ if(GP_STATE.timer){ clearInterval(GP_STATE.timer); GP_STATE.timer = null; } }

function switchTab(tabName, btnEl) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => { el.classList.remove('active'); el.setAttribute('aria-selected', 'false'); });
  $(`tab-${tabName}`).classList.add('active');
  btnEl.classList.add('active');
  btnEl.setAttribute('aria-selected', 'true');
  $('navMenuLabel').textContent = getTabLabel(tabName);
  closeNavMenu();

  if(tabName === 'logs') {
    updateLogMachineDropdown();
    renderConsoleLogs();
  }
  if(tabName === 'notifications') {
    unreadNotifs = 0;
    updateNotifBadge();
    renderNotifications();
  }
  if(tabName === 'simulator') {
    fetchDifficultyData();
    startSimAutoRefresh();
  } else {
    stopSimAutoRefresh();
  }
  if(tabName === 'latency') {
    renderPingTab();
  }
  if(tabName === 'parasite') {
    renderParasiteSection();
  }
  if(tabName === 'thermal') {
    renderThermalTab();
  }
  if(tabName === 'oc') {
    renderOcTab();
  }
  if(tabName === 'converter') {
    initConverterTab();
  } else {
    stopRatesAutoRefresh();
  }
  if(tabName === 'support') {
    renderSupportDiagBox();
  }
  if(tabName === 'renting') {
    initRentingTab();
  } else {
    stopRentingAutoRefresh();
  }
  if(tabName === 'alerts') {
    loadAlertsConfig();
  }
  if(tabName === 'cooling') coolingStart(); else coolingStop();
  if(tabName === 'boards') renderBoards();
  if(tabName === 'genpools') gpStart(); else gpStop();
}

let blocksRefreshTimer = null;
function startBlocksAutoRefresh() {
  stopBlocksAutoRefresh();
  blocksRefreshTimer = setInterval(fetchRecentBlocks, 60000);
}
function stopBlocksAutoRefresh() {
  if(blocksRefreshTimer) { clearInterval(blocksRefreshTimer); blocksRefreshTimer = null; }
}

function timeAgoPt(unixSeconds) {
  const diffSec = Math.max(0, Math.floor(Date.now()/1000) - unixSeconds);
  if(diffSec < 60) return t('tempo_seg_atras').replace('{n}', diffSec);
  const diffMin = Math.floor(diffSec/60);
  if(diffMin < 60) return t('tempo_min_atras').replace('{n}', diffMin);
  const diffH = Math.floor(diffMin/60);
  if(diffH < 24) return t('tempo_h_atras').replace('{n}', diffH);
  return t('tempo_d_atras').replace('{n}', Math.floor(diffH/24));
}

let lastFetchedBlocks = null;
let seenBlockHeights = new Set();

async function fetchRecentBlocks() {
  const hint = $('blocksRefreshHint');
  const container = $('blocksScroll');
  if(hint) hint.textContent = t('blocos_a_atualizar');
  try {
    const [res] = await Promise.all([fetch('https://mempool.space/api/v1/blocks'), fetchMempoolBlocks(), fetchMyShares(true)]);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const blocks = await res.json();
    lastFetchedBlocks = blocks;
    renderRecentBlocks(blocks);
    const localeMap = { pt: 'pt-PT', en: 'en-US', es: 'es-ES', fr: 'fr-FR' };
    if(hint) hint.textContent = t('blocos_atualizado_em') + ' ' + new Date().toLocaleTimeString(localeMap[currentLang] || 'pt-PT');
  } catch(e) {
    console.error('Erro ao obter blocos:', e);
    if(hint) hint.textContent = t('blocos_falha_atualizar');
    if(container && container.children.length === 0) {
      container.innerHTML = `<div class="blocks-empty">${t('blocos_erro_carregar')}</div>`;
    }
  }
}

// Conta de 0 até ao valor final (ease-out), só usado nos cartões de blocos
// que acabaram de aparecer pela primeira vez - blocos já vistos não voltam
// a animar o número em cada refresh de 60s.
function _animateTxCountFromZero(el, target){
  const duration = 900;
  const start = performance.now();
  function step(now){
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = `${Math.round(target * eased)} txs`;
    if(p < 1) requestAnimationFrame(step);
    else el.textContent = `${target} txs`;
  }
  requestAnimationFrame(step);
}

