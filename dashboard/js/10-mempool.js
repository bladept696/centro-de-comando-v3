// --- Cadeia ao estilo mempool.space ------------------------------------
// À esquerda: blocos PENDENTES (projeção da mempool, tracejados); ao centro:
// a linha do "agora"; à direita: blocos CONFIRMADOS (o mais recente junto
// à linha). O enchimento de cada cubo = quão cheio está o bloco, e a cor =
// taxas (verde-água = baratas, vermelho = caras).
let mempoolBlocksData = null;
let mpRenderTimer = null;
let mpFirstScrollDone = false;

function mpFeeColor(fee, alpha) {
  const f = Math.max(1, Number(fee) || 1);
  const x = Math.min(1, Math.log(f) / Math.log(300));
  const hue = Math.round(172 - 147 * x);   // verde-água → verde → amarelo → laranja
  return `hsl(${hue} 72% 56% / ${alpha === undefined ? 1 : alpha})`;
}
function mpNum(n) {
  n = Number(n);
  if (!isFinite(n)) return '—';
  return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10);
}
function mpFillBg(lo, med, hi) {
  return `linear-gradient(to top, ${mpFeeColor(lo, .14)}, ${mpFeeColor(med, .24)} 60%, ${mpFeeColor(hi, .36)})`;
}
function mpEsc(v) {
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// --- Os teus shares nos blocos ------------------------------------------
// Fonte: /api/diff-buckets (melhor share por bucket de ~15 min, por máquina).
// Para cada bloco, a janela é (bloco anterior -> este bloco]; mostramos o melhor
// share de cada máquina cujo bucket cai nessa janela. É aproximado: os buckets
// são de 15 min e os blocos têm ~10 min, por isso um bucket pode tocar em dois
// blocos vizinhos (nesse caso o ponto aparece oco).
const MP_DOT_COLORS = ['#21ffb0', '#ffb020', '#ff5de6', '#4fd6ff', '#b69cff', '#ffe45e'];
let myShareBuckets = {};   // devId -> { buckets:[{ts,value}], width }
let myShareFetchedAt = 0;

function mpIsSha(devId) {
  const r = (typeof readings !== 'undefined') ? readings[devId] : null;
  return algoGroupOf(r) === 'sha256';
}

function mpCurrentBest(devId) {
  const r = (typeof readings !== 'undefined') ? readings[devId] : null;
  const v = r ? Number(r.best) : 0;
  return isFinite(v) ? v : 0;
}

function mpDotColor(devId) {
  const i = Math.max(0, (devices || []).findIndex(d => String(d.id) === String(devId)));
  return MP_DOT_COLORS[i % MP_DOT_COLORS.length];
}

async function fetchMyShares(force) {
  if (!force && Date.now() - myShareFetchedAt < 45000) return;
  myShareFetchedAt = Date.now();
  const list = (devices || []).filter(d => d && d.ip && mpIsSha(d.id));
  await Promise.all(list.map(async d => {
    try {
      // Preferido: momentos exatos em que a máquina bateu um novo recorde (app.py novo)
      const rr = await fetch(`${API_BASE}/api/diff-records?ip=${encodeURIComponent(d.ip)}&range=24h`);
      if (rr.ok) {
        const dj = await rr.json();
        if (Array.isArray(dj.events)) {
          myShareBuckets[d.id] = { events: dj.events
            .map(e => ({ ts: Number(e.ts), value: Number(e.value) }))
            .filter(e => isFinite(e.ts) && isFinite(e.value) && e.value > 0) };
          return;
        }
      }
    } catch (e) { /* cai para os buckets */ }
    try {
      const res = await fetch(`${API_BASE}/api/diff-buckets?ip=${encodeURIComponent(d.ip)}&range=24h`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const bs = (data.buckets || [])
        .map(b => ({ ts: Number(b.ts), value: Number(b.value) }))
        .filter(b => isFinite(b.ts) && isFinite(b.value) && b.value > 0)
        .sort((a, b) => a.ts - b.ts);
      let width = 900;
      for (let i = 1; i < bs.length; i++) {
        const dt = bs[i].ts - bs[i - 1].ts;
        if (dt > 0 && dt < width) width = dt;
      }
      myShareBuckets[d.id] = { buckets: bs, width };
    } catch (e) { /* sem backend / sem dados: simplesmente não há pontos */ }
  }));
  renderMpLegend();
}

function renderMpLegend() {
  const el = $('mpLegend');
  if (!el) return;
  const items = (devices || []).filter(d => { const i = myShareBuckets[d.id]; return i && ((i.events && i.events.length) || (i.buckets && i.buckets.length) || (i.events && mpCurrentBest(d.id) > 0)); });
  const usesEvents = items.some(d => myShareBuckets[d.id].events && myShareBuckets[d.id].events.length);
  el.innerHTML = items.map(d => `<span style="--dot-c:${mpDotColor(d.id)}"><i></i>${mpEsc(d.name || d.ip)}</span>`).join('')
    + (usesEvents ? `<span style="opacity:.75">${mpEsc(t('mp_nota_recordes'))}</span>` : '');
}

// Melhor share de cada máquina dentro de uma janela [start, end] (segundos unix).
function mpSharesInWindow(start, end, allWindows) {
  const out = [];
  (devices || []).forEach(d => {
    if (!mpIsSha(d.id)) return;
    const info = myShareBuckets[d.id];
    if (!info) return;
    if (info.events) {
      // Recordes com hora exata: entram só no bloco em cujo intervalo aconteceram
      let bestEv = null;
      info.events.forEach(ev => { if (ev.ts > start && ev.ts <= end && (!bestEv || ev.value > bestEv.value)) bestEv = ev; });
      if (bestEv) out.push({ devId: d.id, name: d.name || d.ip, value: bestEv.value, shared: false, record: true });
      else if (!info.events.length && allWindows[0] && start === allWindows[0][0] && end === allWindows[0][1]) {
        const cur = mpCurrentBest(d.id);
        if (cur > 0) out.push({ devId: d.id, name: d.name || d.ip, value: cur, shared: true });
      }
      return;
    }
    let best = null;
    (info.buckets || []).forEach(b => {
      const bEnd = b.ts + info.width;
      if (b.ts < end && bEnd > start && (!best || b.value > best.value)) best = { ...b, bEnd };
    });
    if (!best) return;
    const touching = allWindows.filter(w => best.ts < w[1] && best.bEnd > w[0]).length;
    out.push({ devId: d.id, name: d.name || d.ip, value: best.value, shared: touching > 1 });
  });
  return out;
}

function mpPct(share, netDiff) {
  const p = (share / netDiff) * 100;
  if (!isFinite(p) || p <= 0) return '—';
  return p < 0.001 ? p.toExponential(1) + '%' : p.toPrecision(2) + '%';
}

function mpGaugeHtml(list, netDiff) {
  const logNet = Math.log10(Math.max(10, netDiff));
  const dots = list.map((it, i) => {
    const pos = Math.max(2, Math.min(98, (Math.log10(Math.max(1, it.value)) / logNet) * 100));
    const f = formatDiff(it.value);
    const tip = `${it.name}: ${f.value}${f.unit} (${mpPct(it.value, netDiff)} ${t('mp_da_dif')})` + (it.shared ? ` — ${t('mp_partilhado')}` : '') + (it.record ? ` — ${t('mp_recorde')}` : '');
    return `<span class="mp-dot${it.shared ? ' mp-dot-shared' : ''}" style="--dot-c:${mpDotColor(it.devId)};bottom:${pos.toFixed(1)}%;left:${2 + (i % 3) * 5}px" title="${mpEsc(tip)}"></span>`;
  }).join('');
  return `<div class="mp-gauge">${dots}</div>`;
}

function mpBestChip(list) {
  if (!list.length) return '<div class="mp-mybest"></div>';
  const top = list.reduce((a, b) => (b.value > a.value ? b : a));
  const f = formatDiff(top.value);
  return `<div class="mp-mybest" title="${mpEsc(t('mp_meu_best'))}">🎯 ${f.value}${f.unit}</div>`;
}

async function fetchMempoolBlocks() {
  try {
    const res = await fetch('https://mempool.space/api/v1/fees/mempool-blocks');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    mempoolBlocksData = await res.json();
  } catch (e) {
    console.warn('Erro ao obter blocos da mempool:', e);
  }
}

// O WebSocket empurra a mempool com muita frequência: agrupamos em 1 render / 5s.
function scheduleMempoolRender() {
  if (mpRenderTimer || !lastFetchedBlocks) return;
  mpRenderTimer = setTimeout(() => {
    mpRenderTimer = null;
    renderRecentBlocks(lastFetchedBlocks);
  }, 5000);
}

function renderRecentBlocks(blocks) {
  const container = $('blocksScroll');
  if (!container) return;
  if (!blocks || !blocks.length) {
    container.innerHTML = `<div class="blocks-empty">${t('blocos_sem_blocos')}</div>`;
    return;
  }
  container.classList.add('mp-chain');
  const prevScroll = container.scrollLeft;
  const isFirstRender = seenBlockHeights.size === 0;

  // Janelas de tempo: bloco a decorrer + cada bloco confirmado
  const nowSec = Math.floor(Date.now() / 1000);
  const mpWindows = [[blocks[0].timestamp, nowSec]];
  blocks.forEach((b, i) => mpWindows.push([blocks[i + 1] ? blocks[i + 1].timestamp : b.timestamp - 600, b.timestamp]));
  const mpNetFallback = (difficultyData && difficultyData.currentDifficulty) || 1e14;
  const mpTipDiff = blocks[0].difficulty || mpNetFallback;

  // Pendentes (o "próximo bloco" fica junto à linha, por isso invertemos)
  const nowList = mpSharesInWindow(mpWindows[0][0], mpWindows[0][1], mpWindows);
  const pendingHtml = (mempoolBlocksData || []).slice(0, 6).map((m, i) => {
    const fr = (Array.isArray(m.feeRange) && m.feeRange.length) ? m.feeRange : [m.medianFee, m.medianFee];
    const lo = fr[0], hi = fr[fr.length - 1], med = m.medianFee;
    const pct = Math.max(4, Math.min(100, ((m.blockVSize || 0) / 1e6) * 100));
    const tip = `${m.nTx} txs · ${mpNum(lo)}–${mpNum(hi)} sat/vB · ${(m.totalFees / 1e8).toFixed(3)} BTC`;
    const fillStyle = isFirstRender ? `--fill-h:0%` : `--fill-h:${pct}%`;
    return `
      <div class="mp-block mp-pending${i === 0 ? ' mp-next' : ''}" title="${mpEsc(tip)}">
        <div class="mp-cube" style="${fillStyle};--liq:${mpFeeColor(med)}"${isFirstRender ? ` data-fill="${pct.toFixed(1)}"` : ''}>
          <div class="mp-fill" style="--fill-bg:${mpFillBg(lo, med, hi)}"></div>
          <div class="mp-face${i === 0 ? ' mp-has-gauge' : ''}">
            <span class="mp-fee" style="color:${mpFeeColor(med)}">~${mpNum(med)} sat/vB</span>
            <span class="mp-range">${mpNum(lo)} - ${mpNum(hi)} sat/vB</span>
            <span class="mp-tx">${m.nTx} txs</span>
          </div>
          ${i === 0 ? mpGaugeHtml(nowList, mpTipDiff) : ''}
        </div>
        <div class="mp-foot">${i === 0 ? mpEsc(t('mp_a_decorrer')) + ' · ' : ''}~${(i + 1) * 10} min</div>${i === 0 ? mpBestChip(nowList) : ''}
      </div>`;
  }).reverse().join('');

  const sepHtml = `
    <div class="mp-sep">
      <span class="mp-sep-lbl">${t('mp_agora')}</span>
      <div class="mp-sep-line"></div>
      <span class="mp-sep-lbl mp-sep-time">${timeAgoPt(blocks[0].timestamp)}</span>
    </div>`;

  // Confirmados
  const confirmedHtml = blocks.map((b, idx) => {
    const ex = b.extras || {};
    const pool = ex.pool || { name: t('pool_desconhecida'), slug: 'unknown' };
    const med = (ex.medianFee !== undefined && ex.medianFee !== null) ? ex.medianFee : ex.avgFeeRate;
    const fr = (Array.isArray(ex.feeRange) && ex.feeRange.length) ? ex.feeRange : [med, med];
    const lo = fr[0], hi = fr[fr.length - 1];
    const weight = b.weight || (b.size ? b.size * 4 : 0);
    const pct = Math.max(4, Math.min(100, (weight / 4e6) * 100));
    const isNew = !isFirstRender && !seenBlockHeights.has(b.height);
    const animate = isFirstRender || isNew;
    const logoUrl = `https://mempool.space/resources/mining-pools/${pool.slug}.svg`;
    const myList = mpSharesInWindow(mpWindows[idx + 1][0], mpWindows[idx + 1][1], mpWindows);
    const netDiff = b.difficulty || mpNetFallback;
    const fees = ex.totalFees ? ` · ${(ex.totalFees / 1e8).toFixed(3)} BTC` : '';
    const tip = `${b.height} · ${b.tx_count} txs · ${(weight / 1e6).toFixed(2)} MWU · ${mpNum(lo)}–${mpNum(hi)} sat/vB${fees}`;
    const fillStyle = animate ? `--fill-h:0%` : `--fill-h:${pct}%`;
    return `
      <div class="mp-block mp-confirmed${idx === 0 ? ' mp-tip' : ''}${isNew ? ' mp-new' : ''}" data-height="${b.height}" title="${mpEsc(tip)}">
        <div class="mp-cube" style="${fillStyle};--liq:${mpFeeColor(med)}"${animate ? ` data-fill="${pct.toFixed(1)}"` : ''}>
          <div class="mp-fill" style="--fill-bg:${mpFillBg(lo, med, hi)}"></div>
          <div class="mp-face mp-has-gauge">
            <span class="mp-h">${b.height}</span>
            <span class="mp-fee" style="color:${mpFeeColor(med)}">~${mpNum(med)} sat/vB</span>
            <span class="mp-range">${mpNum(lo)} - ${mpNum(hi)} sat/vB</span>
            <span class="mp-tx" data-txcount="${b.tx_count}">${isNew ? '0 txs' : b.tx_count + ' txs'}</span>
          </div>
          ${mpGaugeHtml(myList, netDiff)}
        </div>
        <div class="mp-foot">
          <img src="${logoUrl}" alt="" onerror="this.style.display='none'">
          <span class="mp-pool" title="${mpEsc(pool.name)}">${mpEsc(pool.name)}</span>
        </div>
        <div class="mp-time">${timeAgoPt(b.timestamp)}</div>
        ${mpBestChip(myList)}
      </div>`;
  }).join('');

  container.innerHTML = pendingHtml + sepHtml + confirmedHtml;
  blocks.forEach(b => seenBlockHeights.add(b.height));

  // Enchimento: arranca a 0% e sobe até ao valor real (só 1º render / bloco novo)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    container.querySelectorAll('.mp-cube[data-fill]').forEach(el => {
      el.style.setProperty('--fill-h', el.dataset.fill + '%');
    });
  }));
  container.querySelectorAll('.mp-block.mp-new .mp-tx').forEach(el => {
    _animateTxCountFromZero(el, parseInt(el.dataset.txcount, 10) || 0);
  });

  // 1ª vez: centra a linha do "agora"; depois mantém a posição do scroll
  const sepEl = container.querySelector('.mp-sep');
  if (!mpFirstScrollDone && sepEl && container.clientWidth > 0) {
    container.scrollLeft = Math.max(0, sepEl.offsetLeft - container.clientWidth * 0.4);
    mpFirstScrollDone = true;
  } else {
    container.scrollLeft = prevScroll;
  }
  try { nmOnBlocks(); } catch(e) {}
}

// --- Blocos em tempo real (WebSocket) -----------------------------------
// O poll a cada 60s (via Web Worker, acima) garante que os blocos nunca
// ficam "presos" com a aba em segundo plano, mas continua a ter até 60s
// de atraso. Para mostrar um bloco novo no instante em que a rede o
// confirma, ligamos também ao WebSocket público do mempool.space, que
// empurra o bloco assim que é minado - sem termos de esperar pelo
// próximo tick do poll.
let blocksSocket = null;
let blocksSocketRetryMs = 2000;
let blocksSocketRetryTimer = null;

function connectBlocksWebSocket() {
  if (blocksSocketRetryTimer) { clearTimeout(blocksSocketRetryTimer); blocksSocketRetryTimer = null; }
  try {
    if (blocksSocket) {
      try { blocksSocket.onclose = null; blocksSocket.close(); } catch(e) {}
    }
    blocksSocket = new WebSocket('wss://mempool.space/api/v1/ws');
    blocksSocket.onopen = () => {
      blocksSocketRetryMs = 2000; // repõe o backoff assim que liga com sucesso
      try { blocksSocket.send(JSON.stringify({ action: 'want', data: ['blocks', 'mempool-blocks'] })); } catch(e) {}
    };
    blocksSocket.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch(e) { return; }
      if (msg && msg.block) onNewBlockPushed(msg.block);
      if (msg && Array.isArray(msg['mempool-blocks'])) { mempoolBlocksData = msg['mempool-blocks']; scheduleMempoolRender(); }
    };
    blocksSocket.onerror = () => {};
    blocksSocket.onclose = scheduleBlocksWebSocketReconnect;
  } catch(e) {
    scheduleBlocksWebSocketReconnect();
  }
}

function scheduleBlocksWebSocketReconnect() {
  if (blocksSocketRetryTimer) return;
  blocksSocketRetryTimer = setTimeout(() => {
    blocksSocketRetryTimer = null;
    connectBlocksWebSocket();
  }, blocksSocketRetryMs);
  blocksSocketRetryMs = Math.min(blocksSocketRetryMs * 2, 30000); // backoff até 30s
}

function onNewBlockPushed(block) {
  if (!lastFetchedBlocks) { fetchRecentBlocks(); return; }
  if (lastFetchedBlocks.some(b => b.height === block.height)) return; // já o tínhamos
  const maxLen = lastFetchedBlocks.length || 15;
  lastFetchedBlocks = [block, ...lastFetchedBlocks].slice(0, maxLen);
  renderRecentBlocks(lastFetchedBlocks);
  const hint = $('blocksRefreshHint');
  if (hint) {
    const localeMap = { pt: 'pt-PT', en: 'en-US', es: 'es-ES', fr: 'fr-FR' };
    hint.textContent = t('blocos_atualizado_em') + ' ' + new Date().toLocaleTimeString(localeMap[currentLang] || 'pt-PT');
  }
  // O bloco empurrado pelo WebSocket pode ainda não trazer todos os campos
  // (ex: taxa média/pool) tão afinados como o endpoint REST. Poucos
  // segundos depois, confirmamos/corrigimos com um fetch normal.
  setTimeout(fetchRecentBlocks, 4000);
}

let difficultyData = null;
let simRefreshTimer = null;

function startSimAutoRefresh() {
  stopSimAutoRefresh();
  simRefreshTimer = setInterval(fetchDifficultyData, 300000);
}
function stopSimAutoRefresh() {
  if(simRefreshTimer) { clearInterval(simRefreshTimer); simRefreshTimer = null; }
}

async function fetchDifficultyData() {
  const hint = $('simHint');
  // cada pedido é independente: se o da hashrate falhar, a dificuldade e a altura vêm da lista de blocos
  const get = async (url, asText) => { try { const r = await fetch(url); if(!r.ok) return null; return asText ? await r.text() : await r.json(); } catch(e) { return null; } };
  try {
    const [adj, hr, heightText] = await Promise.all([
      get('https://mempool.space/api/v1/difficulty-adjustment'),
      get('https://mempool.space/api/v1/mining/hashrate/3d'),
      get('https://mempool.space/api/blocks/tip/height', true)
    ]);
    if(!adj) throw new Error('HTTP error');
    let currentDifficulty = hr && hr.currentDifficulty, currentHeight = parseInt(heightText, 10);
    if(!currentDifficulty || !isFinite(currentHeight)){
      const blocks = await get('https://mempool.space/api/v1/blocks');
      if(blocks && blocks[0]){ if(!currentDifficulty) currentDifficulty = blocks[0].difficulty; if(!isFinite(currentHeight)) currentHeight = blocks[0].height; }
    }
    if(!currentDifficulty || !isFinite(currentHeight)) throw new Error('sem dificuldade');

    difficultyData = {
      progressPercent: adj.progressPercent,
      difficultyChange: adj.difficultyChange,
      remainingBlocks: adj.remainingBlocks,
      estimatedRetargetDate: adj.estimatedRetargetDate,
      timeAvg: adj.timeAvg,
      currentDifficulty,
      currentHeight
    };
    renderSimulator();
  } catch(e) {
    console.error('Erro ao obter dados de dificuldade:', e);
    if(hint) hint.textContent = 'Não foi possível obter os dados da rede. Verifica a ligação à internet.';
  }
}

function formatDurationPt(seconds) {
  if(!isFinite(seconds) || seconds <= 0) return '—';
  const YEAR = 365.25 * 86400;
  if(seconds >= YEAR) return `${(seconds / YEAR).toFixed(1)} anos`;
  const DAY = 86400;
  if(seconds >= DAY) return `${(seconds / DAY).toFixed(1)} dias`;
  const HOUR = 3600;
  if(seconds >= HOUR) return `${(seconds / HOUR).toFixed(1)} horas`;
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function renderSimulator() {
  if(!difficultyData) return;

  const active = devices.map(d => readings[d.id]).filter(r => r && r.online);
  const totalHashGHs = active.reduce((s, r) => s + (r.hashrate || 0), 0);
  const userHashHs = totalHashGHs * 1e9;

  const diff = difficultyData.currentDifficulty;
  const change = difficultyData.difficultyChange;

  $('simDifficulty').textContent = diff ? Math.round(diff).toLocaleString('pt-PT') : '—';

  const changeEl = $('simDifficultyChange');
  changeEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
  changeEl.className = 'sim-value ' + (change >= 0 ? 'sim-bad' : 'sim-good');

  $('simRemainingBlocks').textContent = difficultyData.remainingBlocks.toLocaleString('pt-PT');
  $('simRetargetDate').textContent = new Date(difficultyData.estimatedRetargetDate * 1000).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  $('simProgress').textContent = difficultyData.progressPercent.toFixed(1) + '%';
  $('simProgressBar').style.width = Math.min(100, Math.max(0, difficultyData.progressPercent)) + '%';

  const HALVING_INTERVAL = 210000;
  const height = difficultyData.currentHeight;
  if(height && !isNaN(height)) {
    const currentEpoch = Math.floor(height / HALVING_INTERVAL);
    const nextHalvingHeight = (currentEpoch + 1) * HALVING_INTERVAL;
    const blocksUntilHalving = nextHalvingHeight - height;
    const currentReward = 50 / Math.pow(2, currentEpoch);
    const avgBlockTimeSec = difficultyData.timeAvg ? difficultyData.timeAvg / 1000 : 600;
    const secondsUntilHalving = blocksUntilHalving * avgBlockTimeSec;
    const halvingDate = new Date(Date.now() + secondsUntilHalving * 1000);
    const halvingProgressPercent = ((height % HALVING_INTERVAL) / HALVING_INTERVAL) * 100;

    $('simCurrentHeight').textContent = height.toLocaleString('pt-PT');
    $('simCurrentReward').textContent = `${currentReward} BTC`;
    $('simHalvingBlocks').textContent = blocksUntilHalving.toLocaleString('pt-PT');
    $('simHalvingDate').textContent = halvingDate.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
    $('simHalvingProgress').textContent = halvingProgressPercent.toFixed(2) + '%';
    $('simHalvingProgressBar').style.width = halvingProgressPercent + '%';
  }

  const hrFmt = formatHashrate(totalHashGHs);
  $('simYourHashrate').textContent = totalHashGHs > 0 ? `${hrFmt.value} ${hrFmt.unit}` : 'Sem máquinas online';

  const POW32 = Math.pow(2, 32);
  const expectedSecondsNow = userHashHs > 0 ? (diff * POW32) / userHashHs : Infinity;
  const projectedDiff = diff * (1 + change / 100);
  const expectedSecondsProjected = userHashHs > 0 ? (projectedDiff * POW32) / userHashHs : Infinity;

  $('simTimeNow').textContent = userHashHs > 0 ? formatDurationPt(expectedSecondsNow) : '—';
  $('simTimeProjected').textContent = userHashHs > 0 ? formatDurationPt(expectedSecondsProjected) : '—';

  const deltaEl = $('simTimeDelta');
  if(userHashHs > 0 && isFinite(expectedSecondsNow) && isFinite(expectedSecondsProjected)) {
    const deltaSeconds = expectedSecondsProjected - expectedSecondsNow;
    const sign = deltaSeconds >= 0 ? '+' : '−';
    deltaEl.textContent = `${sign}${formatDurationPt(Math.abs(deltaSeconds))}`;
    deltaEl.className = 'sim-value ' + (deltaSeconds > 0 ? 'sim-bad' : (deltaSeconds < 0 ? 'sim-good' : ''));
  } else {
    deltaEl.textContent = '—';
    deltaEl.className = 'sim-value';
  }

  const blockProbability = (periodSeconds) => {
    if(!(userHashHs > 0) || !isFinite(expectedSecondsNow) || expectedSecondsNow <= 0) return null;
    return 1 - Math.exp(-periodSeconds / expectedSecondsNow);
  };

  const formatProb = (p) => {
    if(p == null) return '—';
    const pct = p * 100;
    if(pct >= 0.01) return `${pct.toFixed(2)}%`;
    if(pct === 0) return '0%';
    return `${pct.toExponential(2)}%`;
  };

  const DAY_S = 86400;
  $('simProb1d').textContent = formatProb(blockProbability(1 * DAY_S));
  $('simProb7d').textContent = formatProb(blockProbability(7 * DAY_S));
  $('simProb30d').textContent = formatProb(blockProbability(30 * DAY_S));
  $('simProb1y').textContent = formatProb(blockProbability(365.25 * DAY_S));
}

function copyLightningAddress() {
  const address = 'plainpen16@walletofsatoshi.com';
  navigator.clipboard.writeText(address).then(() => {
    alert('Endereço Lightning copiado!');
  }).catch(err => {
    console.error('Erro ao copiar:', err);
  });
}

function copyBtcAddress() {
  const address = 'bc1qffk82prrxn84e8y9l0z5yflsqclhyc9ptphgmf';
  navigator.clipboard.writeText(address).then(() => {
    alert('Endereço Bitcoin On-Chain copiado!');
  }).catch(err => {
    console.error('Erro ao copiar:', err);
  });
}

