// --- Easter eggs sazonais -------------------------------------------
// Puramente cosmético: consoante a data de hoje, junta um pequeno ícone
// ao título e (se a pessoa não pediu movimento reduzido) uma camada de
// partículas suaves a flutuar pelo ecrã. Não altera dados, não guarda
// nada, não faz pedidos ao servidor - é só um sorriso escondido para
// quem tiver o painel aberto numa data especial.
function initSeasonalEasterEggs(){
  try{
    const now = new Date();
    const m = now.getMonth() + 1; // 1-12
    const d = now.getDate();
    const reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let icon = '';
    let particle = null; // { emoji, count, cls }

    if((m === 12) || (m === 1 && d <= 6)){
      // Época natalícia / passagem de ano - floquinhos de neve a cair
      icon = '🎄';
      particle = { emoji: '❄', count: 16, cls: 'seasonal-snow' };
    } else if(m === 10 && d >= 24){
      // Halloween - morcegos a pairar
      icon = '🎃';
      particle = { emoji: '🦇', count: 6, cls: 'seasonal-bat' };
    } else if(m === 5 && d === 22){
      // Bitcoin Pizza Day - 22 mai 2010, os famosos 10.000 BTC por 2 pizzas.
      // Homenagem óbvia num painel de mineração :)
      icon = '🍕';
      particle = { emoji: '🍕', count: 10, cls: 'seasonal-pizza' };
    } else if(m === 6 && d >= 10 && d <= 24){
      // Santos Populares - só o ícone, sem partículas
      icon = '🎉';
    } else if(m === 4 && d === 1){
      // Dia das mentiras - piscadela de olho, sem nenhuma funcionalidade falsa
      icon = '🤖';
    }

    if(icon && !$('seasonalIcon')){
      const h1 = document.querySelector('header h1');
      if(h1){
        const span = document.createElement('span');
        span.id = 'seasonalIcon';
        span.style.marginLeft = '8px';
        span.textContent = icon;
        h1.appendChild(span);
      }
    }

    if(particle && !reduceMotion){
      const layer = document.createElement('div');
      layer.className = 'seasonal-particle-layer';
      layer.setAttribute('aria-hidden', 'true');
      for(let i = 0; i < particle.count; i++){
        const p = document.createElement('span');
        p.className = 'seasonal-particle ' + particle.cls;
        p.textContent = particle.emoji;
        p.style.left = (Math.random() * 100).toFixed(1) + '%';
        p.style.top = (Math.random() * 20).toFixed(1) + '%';
        // Paralaxe: floco "mais perto" (maior) cai mais depressa, mais opaco
        // e oscila mais com o vento; "mais longe" (menor) é mais lento, mais
        // ténue e quase não oscila - imita profundidade real de neve a cair.
        const depth = Math.random(); // 0 = longe, 1 = perto
        const size = 9 + depth * 12;
        p.style.fontSize = size.toFixed(0) + 'px';
        p.style.opacity = (0.18 + depth * 0.42).toFixed(2);
        if(particle.cls === 'seasonal-snow'){
          p.style.setProperty('--sway', (10 + depth * 36).toFixed(0) + 'px');
          p.style.animationDuration = (21 - depth * 11 + Math.random() * 3).toFixed(1) + 's';
        } else {
          p.style.animationDuration = (10 + Math.random() * 12).toFixed(1) + 's';
        }
        p.style.animationDelay = (Math.random() * 12).toFixed(1) + 's';
        layer.appendChild(p);
      }
      document.body.appendChild(layer);
    }
  }catch(e){
    // Falha silenciosa - isto é só decoração, nunca deve quebrar o painel.
  }
}

loadTheme();
loadLanguage();
initKioskMode();
initLayoutEditor();
initSeasonalEasterEggs();
setupHashrateRangeButtons();
setupPeakDiffRangeButtons();
// o rodapé passou a usar a cena de mineração (hcMiningScene)
startBodyMatrix();
initNetworkMap();
initQuickActions();
(async () => {
  await loadDevices();
  loadNotifications();
  updateToastToggleBtn();
  loadThermalHistory();
  loadMaintenanceLog();
  loadThermalProtectionSettings();
  try { localStorage.removeItem('nerdqaxe:achievements'); } catch(e){}
  try { localStorage.removeItem('nerdqaxe:diag-chat'); localStorage.removeItem('nerdqaxe:diag-voice-enabled'); } catch(e){}
  devices.forEach(d => { thermalAlertState[d.id] = computeThermalHealth(d.id).status; });
  updateThermalBadge();
  updateNotifBadge();
  updateLogMachineDropdown();
  renderAll();
  checkForUpdate();

  // Assistente de primeira execução: se ainda não há nenhuma máquina
  // registada e nunca mostrámos isto antes neste browser, abre a
  // pesquisa de rede sozinha em vez de esperar que a pessoa descubra o
  // botão "Localizar máquinas na rede" por conta própria. Marca a flag
  // já aqui (antes de sequer abrir) para nunca voltar a insistir sozinho
  // depois desta vez - continua sempre disponível à mão pelo botão normal.
  try {
    // só no próprio PC: a pesquisa de rede de quem abre o painel de longe (telemóvel) não faz sentido
    if(devices.length === 0 && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && !localStorage.getItem('nerdqaxe:onboarding_scan_done')){
      localStorage.setItem('nerdqaxe:onboarding_scan_done', '1');
      setTimeout(() => openScanModal(true), 900);
    }
  } catch(e) { /* localStorage indisponível - sem assistente, sem drama */ }
})();
logEvent(t('painel_iniciado_com_alertas'), 'new', 'Sistema', 'sys');
// pollAll(), pollPowerStatus() e fetchRecentBlocks() já não têm setInterval
// próprio aqui - são despoletados pelo Web Worker do heartbeat (ver abaixo),
// para não sofrerem o throttling de abas em segundo plano.
pollAll();
fetchRecentBlocks();
connectBlocksWebSocket();

loadPowerConfig();
pollPowerStatus();
loadAlertsConfig();

initAiAgent();

// --- Fecho total automático -------------------------------------------
// Avisa o servidor local (app.py) de que este separador/janela continua
// aberto. Se isto parar de chegar (X premido, browser fechado, etc.), o
// backend desliga-se por completo ao fim de algum tempo.
//
// IMPORTANTE: os browsers "atrasam" (throttle) de propósito os
// setInterval() de uma página quando a janela é minimizada, quando outra
// aba fica em foco, ou quando o browser descarta/congela abas em segundo
// plano para poupar bateria/memória ("Memory Saver"/"Efficiency mode").
// Isto fazia o heartbeat parar de chegar mesmo com o painel só minimizado
// (não fechado), levando o servidor a desligar-se por engano. Um Web
// Worker corre num thread à parte e não sofre este throttling da mesma
// forma, por isso o heartbeat é enviado a partir dele em vez do thread
// principal da página.
function sendHeartbeat() {
  fetch('/api/heartbeat', { method: 'POST' }).catch(() => {});
}

// IMPORTANTE (continuação): o mesmo throttling que afetava o heartbeat
// também afeta QUALQUER setInterval() no thread principal da página -
// incluindo o pollAll() que atualiza os dados das máquinas. Descobrimos
// isto pelos logs: mesmo com o heartbeat a salvo no worker, o polling das
// máquinas continuava a saltar para ~60s de intervalo (throttling
// "intensivo" do Chrome) sempre que a janela ficava em segundo plano
// durante uns minutos, e a certa altura parava por completo durante
// dezenas de minutos até a aba "acordar". Por isso o pollAll() (e o
// pollPowerStatus()) passam também a ser despoletados a partir do worker,
// tal como o heartbeat - só assim as máquinas continuam a atualizar-se
// mesmo com o painel minimizado ou noutro separador.
let _heartbeatWorker = null;
try {
  const workerCode = `
    setInterval(() => { postMessage('heartbeat'); }, 3000);
    setInterval(() => { postMessage('poll'); }, 5000);
    setInterval(() => { postMessage('blocks'); }, 60000);
  `;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  _heartbeatWorker = new Worker(URL.createObjectURL(blob));
  _heartbeatWorker.onmessage = (e) => {
    if (e.data === 'heartbeat') sendHeartbeat();
    else if (e.data === 'poll') { pollAll(); pollPowerStatus(); }
    else if (e.data === 'blocks') fetchRecentBlocks();
  };
} catch (e) {
  // Fallback (browsers muito antigos/sem suporte a Worker): pelo menos o
  // heartbeat, pollAll, pollPowerStatus e fetchRecentBlocks normais
  // continuam a funcionar enquanto a aba estiver em primeiro plano.
  setInterval(sendHeartbeat, 3000);
  setInterval(pollAll, 5000);
  setInterval(pollPowerStatus, 5000);
  startBlocksAutoRefresh();
}

// Também manda logo um heartbeat sempre que a aba volta a ficar visível,
// para "recuperar" imediatamente sem esperar pelo próximo tick do worker.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    sendHeartbeat();
    // O portátil pode ter suspendido a ligação WebSocket enquanto a aba
    // esteve em segundo plano (ex: PC foi para hibernação) - ao voltar,
    // religa se necessário e faz logo um fetch normal para apanhar
    // qualquer bloco que tenha passado ao lado enquanto isso.
    if (!blocksSocket || blocksSocket.readyState === WebSocket.CLOSED || blocksSocket.readyState === WebSocket.CLOSING) {
      connectBlocksWebSocket();
    }
    fetchRecentBlocks();
  }
});

sendHeartbeat();

// Ao fechar mesmo o separador/janela (não apenas minimizar ou trocar de
// separador), avisa o servidor de imediato para ele se desligar logo,
// em vez de esperar até 90s sem heartbeat. sendBeacon é usado porque
// continua a funcionar mesmo durante o descarregamento da página
// (um fetch normal seria cancelado nesse momento).
window.addEventListener('pagehide', (event) => {
  if (event.persisted) return; // página só foi para bfcache, não fechou
  try { navigator.sendBeacon('/api/close'); } catch (e) {}
});

// Mostra a versão instalada (independente de internet, ao contrário da
// verificação de atualizações que consulta o GitHub).
(async () => {
  try {
    const res = await fetch(`${API_BASE}/api/version`);
    const data = await res.json();
    const tag = $('versionTag');
    if (data.version) appVersion = data.version;
    if (tag && data.version) tag.textContent = `· v${data.version}`;
  } catch (e) {}
})();

// --- Ajuda / FAQ ------------------------------------------------------------
function openHelpModal(){
  document.getElementById('helpModal')?.classList.add('open');
}
function closeHelpModal(){
  document.getElementById('helpModal')?.classList.remove('open');
}

// --- Tour guiado (primeira utilização) --------------------------------------
// Percorre os botões/áreas principais do cabeçalho com um spotlight + balão
// de texto. Corre automaticamente na primeira visita (flag em localStorage)
// e pode ser relançado a qualquer momento a partir do modal de Ajuda.
const TOUR_DONE_KEY = 'nerdqaxe:tour-done';

const TOUR_STEPS = [
  { selector: '#navMenu', titleKey: 'tour_nav_titulo', textKey: 'tour_nav_texto' },
  { selector: '#langSelect', titleKey: 'tour_lang_titulo', textKey: 'tour_lang_texto' },
  { selector: '#themeSelect', titleKey: 'tour_tema_titulo', textKey: 'tour_tema_texto' },
  { selector: '#kioskToggleBtn', titleKey: 'tour_kiosk_titulo', textKey: 'tour_kiosk_texto' },
  { selector: '#wgBtn', titleKey: 'tour_layout_titulo', textKey: 'tour_layout_texto' },
  { selector: '#helpBtn', titleKey: 'tour_ajuda_titulo', textKey: 'tour_ajuda_texto' },
  { selector: '#statusDot', titleKey: 'tour_status_titulo', textKey: 'tour_status_texto' },
];

let tourStepIndex = 0;
let tourResizeHandlerBound = false;

function positionTourStep(){
  const step = TOUR_STEPS[tourStepIndex];
  if (!step) { endTour(); return; }
  const target = document.querySelector(step.selector);
  if (!target || target.offsetParent === null) { nextTourStep(); return; }

  const highlight = document.getElementById('tourHighlight');
  const tooltip = document.getElementById('tourTooltip');
  const rect = target.getBoundingClientRect();
  const pad = 6;

  highlight.style.left = Math.max(4, rect.left - pad) + 'px';
  highlight.style.top = Math.max(4, rect.top - pad) + 'px';
  highlight.style.width = (rect.width + pad * 2) + 'px';
  highlight.style.height = (rect.height + pad * 2) + 'px';

  document.getElementById('tourTitle').textContent = t(step.titleKey);
  document.getElementById('tourText').textContent = t(step.textKey);
  document.getElementById('tourCounter').textContent = (tourStepIndex + 1) + ' / ' + TOUR_STEPS.length;
  document.getElementById('tourNextBtn').textContent = (tourStepIndex === TOUR_STEPS.length - 1) ? t('tour_concluir') : t('tour_seguinte');

  const tw = tooltip.offsetWidth || 280;
  let top = rect.bottom + 14;
  let left = rect.left;
  if (left + tw > window.innerWidth - 12) left = window.innerWidth - tw - 12;
  if (left < 12) left = 12;
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
  const th = tooltip.offsetHeight || 140;
  if (top + th > window.innerHeight - 12) {
    top = rect.top - th - 14;
    if (top < 12) top = 12;
    tooltip.style.top = top + 'px';
  }

  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function startTour(){
  tourStepIndex = 0;
  const layer = document.getElementById('tourLayer');
  if (!layer) return;
  layer.style.display = 'block';
  if (!tourResizeHandlerBound) {
    window.addEventListener('resize', positionTourStep);
    tourResizeHandlerBound = true;
  }
  setTimeout(positionTourStep, 260);
}

function nextTourStep(){
  tourStepIndex++;
  if (tourStepIndex >= TOUR_STEPS.length) { endTour(); return; }
  positionTourStep();
}

function skipTour(){ endTour(); }

function endTour(){
  const layer = document.getElementById('tourLayer');
  if (layer) layer.style.display = 'none';
  try { localStorage.setItem(TOUR_DONE_KEY, '1'); } catch(e){}
}

function maybeAutoStartTour(){
  let done = false;
  try { done = localStorage.getItem(TOUR_DONE_KEY) === '1'; } catch(e){}
  if (!done) setTimeout(startTour, 900);
}
maybeAutoStartTour();

// Fecho garantido e imediato, independente de qualquer comportamento do
// browser ao fechar separador/janela (que por vezes não dispara a tempo,
// deixando o servidor a correr até 90s em segundo plano). Este botão
// chama /api/close diretamente, sem depender do evento pagehide.
function shutdownServer() {
  if (!confirm(t('confirm_desligar_servidor'))) return;
  if (_heartbeatWorker) _heartbeatWorker.terminate(); // para não cancelar o próprio pedido de fecho
  // URL absoluto (API_BASE): assim o fetch embrulhado junta o token de login
  fetch(`${API_BASE}/api/close`, { method: 'POST' }).catch(() => {});
  document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:JetBrains Mono,monospace;color:var(--muted);font-size:14px;">${t('servidor_desligado_msg')}</div>`;
}

/* ===== Banner "Hash Commander": cena de mineração =====
   Chuva de hashes (alguns começam por zeros, como uma prova de trabalho válida), uma cadeia de blocos em baixo
   e faíscas quando um bloco "é minerado". Se a dashboard já conhece a altura real do último bloco, é essa que
   aparece no bloco mais recente e a cadeia avança quando chega um bloco novo de verdade. */
function hcMiningScene(wrap, canvas){
  if (!wrap || !canvas) return;
  const ctx = canvas.getContext('2d');
  const HEX = '0123456789abcdef', STEP = 58, BS = 30;
  let W = 0, H = 0, DPR = 1, cols = [], chain = [], sparks = [], shift = 0, lastReal = 0, nextFake = 30 + Math.random() * 25, t0 = performance.now(), lastT = 0;
  const rnd = n => { let s = ''; for(let i = 0; i < n; i++) s += HEX[Math.floor(Math.random() * 16)]; return s; };
  const realHeight = () => {
    try { if(typeof seenBlockHeights !== 'undefined' && seenBlockHeights.size) return Math.max(...seenBlockHeights); } catch(e) {}
    try { if(typeof difficultyData !== 'undefined' && difficultyData && difficultyData.currentHeight) return difficultyData.currentHeight; } catch(e) {}
    return 0;
  };
  const newBlock = x => ({ x, id: '00' + rnd(4), born: performance.now(), fresh: 0 });

  function resize(){
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = wrap.clientWidth; H = wrap.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cols = Array.from({ length: Math.max(8, Math.floor(W / 22)) }, (_, i) => ({ x: i * 22 + 11, y: -Math.random() * H * 1.5, v: 16 + Math.random() * 30, len: 5 + Math.floor(Math.random() * 7), s: rnd(16), win: false }));
    chain = []; for(let x = W + STEP; x > -STEP; x -= STEP) chain.unshift(newBlock(x));
  }
  window.addEventListener('resize', resize);
  resize();

  function burst(x, y, n){
    for(let i = 0; i < n && sparks.length < 90; i++){ const a = -Math.PI * (.15 + Math.random() * .7), v = 30 + Math.random() * 70; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: .5 + Math.random() * .6 }); }
  }
  function mine(real){
    const last = chain[chain.length - 1], nb = newBlock(last.x + STEP);
    nb.fresh = 1; if(real) nb.real = real;
    chain.push(nb); shift += STEP; burst(nb.x, H - BS - 6, 18);
  }

  function frame(ts, still){
    const dt = Math.min(.1, still ? 0 : (ts - lastT) / 1000); lastT = ts;
    ctx.clearRect(0, 0, W, H);
    // chuva de hashes
    ctx.font = '11px "JetBrains Mono", monospace'; ctx.textBaseline = 'top';
    for(const col of cols){
      col.y += col.v * dt;
      for(let k = 0; k < col.len; k++){
        const y = col.y - k * 13; if(y < -13 || y > H) continue;
        const ch = col.s[k % col.s.length], a = (1 - k / col.len);
        if(col.win && k < 4) ctx.fillStyle = `rgba(255,205,90,${(.35 + a * .6).toFixed(2)})`;
        else ctx.fillStyle = k === 0 ? 'rgba(245,232,205,.85)' : `rgba(225,165,85,${(a * .5).toFixed(2)})`;
        ctx.fillText(col.win && k < 4 ? '0' : ch, col.x, y);
      }
      if(col.y - col.len * 13 > H){
        if(col.win) burst(col.x, H - BS - 6, 8);
        col.y = -20 - Math.random() * 60; col.s = rnd(16); col.win = Math.random() < .08; col.v = 16 + Math.random() * 30;
      }
    }
    // cadeia de blocos
    const rh = realHeight();
    if(rh && lastReal && rh > lastReal) mine(rh);
    if(rh) lastReal = rh;
    if(!rh && !still && (ts - t0) / 1000 > nextFake){ mine(0); nextFake = (ts - t0) / 1000 + 40 + Math.random() * 40; }
    if(shift > 0){ const d = Math.min(shift, 40 * dt + shift * .08); shift -= d; chain.forEach(b => { b.x -= d; }); }
    while(chain.length > 2 && chain[0].x < -STEP) chain.shift();
    const by = H - BS - 6;
    for(let i = 0; i < chain.length; i++){
      const b = chain[i];
      if(i) { ctx.strokeStyle = 'rgba(255,170,60,.35)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(chain[i - 1].x + BS / 2, by + BS / 2); ctx.lineTo(b.x - BS / 2, by + BS / 2); ctx.stroke(); }
      const age = Math.max(0, 1 - (performance.now() - b.born) / 4000), glow = b.fresh ? age : 0, last = i === chain.length - 1;
      const g = ctx.createLinearGradient(0, by, 0, by + BS);
      g.addColorStop(0, `rgba(${90 + glow * 160},${50 + glow * 120},12,.92)`); g.addColorStop(1, `rgba(${40 + glow * 80},${24 + glow * 50},8,.92)`);
      ctx.save(); ctx.shadowColor = '#ffb020'; ctx.shadowBlur = 4 + glow * 18;
      ctx.fillStyle = g; ctx.strokeStyle = glow ? '#ffe08a' : 'rgba(255,170,60,.55)'; ctx.lineWidth = glow ? 1.6 : 1;
      const r = 5, x = b.x - BS / 2;
      ctx.beginPath(); ctx.moveTo(x + r, by); ctx.arcTo(x + BS, by, x + BS, by + BS, r); ctx.arcTo(x + BS, by + BS, x, by + BS, r); ctx.arcTo(x, by + BS, x, by, r); ctx.arcTo(x, by, x + BS, by, r); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.font = '8.5px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = last && rh ? '#ffe9a8' : 'rgba(255,200,120,.75)';
      ctx.fillText(last && rh ? '#' + (b.real || rh) : b.id, b.x, by + BS / 2); ctx.textAlign = 'left';
    }
    // faíscas
    for(let i = sparks.length - 1; i >= 0; i--){
      const p = sparks[i]; p.life += dt; if(p.life > p.max){ sparks.splice(i, 1); continue; }
      p.vy += 140 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalAlpha = 1 - p.life / p.max; ctx.fillStyle = Math.random() < .5 ? '#ffd45a' : '#ff8a1c'; ctx.fillRect(p.x - 1, p.y - 1, 2.2, 2.2); ctx.globalAlpha = 1;
    }
  }

  const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e) { return false; } })();
  if(reduce){ frame(performance.now(), true); window.addEventListener('resize', () => frame(performance.now(), true)); return; }
  let acc = 0, inView = true;
  // só anima quando a cena está no ecrã (o rodapé fica fora de vista quase sempre) e a 25 imagens por segundo
  try { new IntersectionObserver(es => { inView = es[0].isIntersecting; }).observe(wrap); } catch(e) {}
  function loop(ts){
    ts = ts || performance.now();
    if(!inView || hcPaused() || ts - acc < 40){ requestAnimationFrame(loop); return; }
    acc = ts;
    frame(ts, false);
    requestAnimationFrame(loop);
  }
  loop();
}
window.hcMiningScene = hcMiningScene;
hcMiningScene(document.getElementById('hcBanner'), document.getElementById('hcBannerCanvas'));
// o rodapé usa a mesma cena de mineração (antes tinha a chuva verde do Matrix)
hcMiningScene(document.getElementById('footerBar'), document.getElementById('footerMatrixCanvas'));

/* ===== Fundo animado de partículas em onda (Máquinas, gráficos e log) ===== */
(function initWaveBackgrounds(){
  const canvases = Array.from(document.querySelectorAll('[data-wave-bg]'));
  if (!canvases.length) return;

  function colorForHeight(h){
    const stops = [
      { t: -1.0, c: [50, 110, 255] },
      { t: -0.3, c: [70, 190, 255] },
      { t: 0.1,  c: [160, 100, 255] },
      { t: 0.5,  c: [255, 80, 220] },
      { t: 1.0,  c: [255, 210, 100] }
    ];
    let c0 = stops[0], c1 = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++){
      if (h >= stops[i].t && h <= stops[i + 1].t){ c0 = stops[i]; c1 = stops[i + 1]; break; }
    }
    const span = (c1.t - c0.t) || 1;
    const f = Math.max(0, Math.min(1, (h - c0.t) / span));
    return [
      c0.c[0] + (c1.c[0] - c0.c[0]) * f,
      c0.c[1] + (c1.c[1] - c0.c[1]) * f,
      c0.c[2] + (c1.c[2] - c0.c[2]) * f
    ];
  }

  const instances = canvases.map(canvas => {
    const host = canvas.closest('.wave-bg-host, .panel[data-layout-id="main-machines"]') || canvas.parentElement;
    const ctx = canvas.getContext('2d');
    const inst = {
      canvas, host, ctx,
      W: 0, H: 0, DPR: 1, time: Math.random() * 10,
      cols: 40, rows: 16
    };
    function resize(){
      inst.DPR = Math.min(window.devicePixelRatio || 1, 1.5);
      inst.W = host.clientWidth;
      inst.H = host.clientHeight;
      if (inst.W <= 0 || inst.H <= 0) return;
      canvas.width = inst.W * inst.DPR;
      canvas.height = inst.H * inst.DPR;
      ctx.setTransform(inst.DPR, 0, 0, inst.DPR, 0, 0);
      // menos colunas/linhas em caixas pequenas para manter o desempenho
      const area = inst.W * inst.H;
      inst.cols = Math.max(18, Math.min(32, Math.round(area / 3600)));
      inst.rows = Math.max(8, Math.min(14, Math.round(area / 9000)));
    }
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();
    return inst;
  });

  function isTabActive(){
    const tab = document.getElementById('tab-dashboard');
    return tab && tab.classList.contains('active');
  }

  function drawInstance(inst){
    const { ctx, W, H, time } = inst;
    if (W <= 0 || H <= 0) return;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const horizonY = H * 0.1;
    const ROWS = inst.rows, COLS = inst.cols;
    for (let row = 0; row < ROWS; row++){
      const depth = row / (ROWS - 1);
      const easedDepth = Math.pow(depth, 1.7);
      const y = horizonY + easedDepth * (H - horizonY);
      const scale = 0.15 + easedDepth * 1.4;
      const dotBase = 0.7 + easedDepth * 2.6;

      for (let col = 0; col < COLS; col++){
        const nx = col / COLS;
        const wx = nx * 10;
        const wave =
          Math.sin(wx * 1.3 + time * 1.1 + depth * 3) * 0.5 +
          Math.sin(wx * 2.7 - time * 0.8 + depth * 5) * 0.3 +
          Math.sin(wx * 0.6 + time * 0.5 - depth * 2) * 0.4;
        const heightVal = wave / 1.2;

        const centerPull = (nx - 0.5) * scale;
        const x = W * 0.5 + centerPull * W * 1.15;
        const yOffset = heightVal * (8 + easedDepth * 32);
        const py = y - yOffset;

        if (x > -10 && x < W + 10 && py > -10 && py < H + 10){
          const [r, g, b] = colorForHeight(heightVal);
          const alpha = 0.45 + easedDepth * 0.55;
          const size = Math.max(0.6, dotBase * (0.6 + heightVal * 0.3));
          ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${alpha})`;
          ctx.beginPath();
          ctx.arc(x, py, size, 0, Math.PI * 2);
          ctx.fill();

          if (heightVal > 0.5 && easedDepth > 0.4){
            ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${alpha * 0.3})`;
            ctx.beginPath();
            ctx.arc(x, py, size * 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    ctx.restore();
  }

  instances.forEach(i => { i.visible = true; });
  if (window.IntersectionObserver){
    const io = new IntersectionObserver(es => es.forEach(e => {
      const i = instances.find(x => x.host === e.target); if (i) i.visible = e.isIntersecting;
    }));
    instances.forEach(i => io.observe(i.host));
  }
  let lastT = 0;
  function draw(ts){
    ts = ts || performance.now();
    if (hcPaused() || ts - lastT < 33){ requestAnimationFrame(draw); return; }
    lastT = ts;
    if (isTabActive()){
      for (const inst of instances){
        inst.time += 0.014;
        if (inst.visible) drawInstance(inst);
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();
