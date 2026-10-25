// --- Best Diff ao vivo (widget flutuante) -----------------------------------
const BD_FEED_MAX = 150;
const BD_FEED_RENDER_MAX = 5;
let bestDiffLive = {
  feed: [],              // { id, machineId, machine, diff, ts }
  perMachine: {},         // devId -> { name, best, count, lastTs }
  globalBest: 0,
  globalCount: 0,
  globalLastTs: null,
  panelOpen: false,
  fullModalOpen: false,
  unseenCount: 0,
  filterMachineId: 'all',
};

function toggleBestDiffPanel(force){
  const panel = document.getElementById('bdPanel');
  if(!panel) return;
  const shouldOpen = (typeof force === 'boolean') ? force : !bestDiffLive.panelOpen;
  bestDiffLive.panelOpen = shouldOpen;
  panel.classList.toggle('open', shouldOpen);
  if(shouldOpen){
    bestDiffLive.unseenCount = 0;
    const badge = document.getElementById('bdFabBadge');
    if(badge){ badge.classList.remove('show'); badge.textContent = '0'; }
    populateBestDiffFilterSelects();
    renderBestDiffPanel();
  }
}

function populateBestDiffFilterSelects(){
  const selects = [document.getElementById('bdMachineFilter'), document.getElementById('bdMachineFilterFull')].filter(Boolean);
  selects.forEach(sel => {
    const current = sel.value || bestDiffLive.filterMachineId || 'all';
    const options = [`<option value="all">${t('todas_as_maquinas')}</option>`]
      .concat(devices.map(d => `<option value="${d.id}">${d.name}</option>`));
    sel.innerHTML = options.join('');
    const stillExists = current === 'all' || devices.some(d => String(d.id) === String(current));
    sel.value = stillExists ? current : 'all';
  });
  bestDiffLive.filterMachineId = selects[0] ? selects[0].value : 'all';
}

function onBestDiffFilterChange(value){
  bestDiffLive.filterMachineId = value || 'all';
  const selects = [document.getElementById('bdMachineFilter'), document.getElementById('bdMachineFilterFull')].filter(Boolean);
  selects.forEach(sel => { sel.value = bestDiffLive.filterMachineId; });
  renderBestDiffPanel();
  if(bestDiffLive.fullModalOpen) renderBestDiffFullModal();
}

function openBestDiffFullModal(){
  bestDiffLive.fullModalOpen = true;
  populateBestDiffFilterSelects();
  document.getElementById('bdFullModal')?.classList.add('open');
  renderBestDiffFullModal();
}

function closeBestDiffFullModal(){
  bestDiffLive.fullModalOpen = false;
  document.getElementById('bdFullModal')?.classList.remove('open');
}

// Chamada a partir do pollOneDevice, só quando a máquina bate um novo
// recorde de dificuldade da sessão (hasBaseline && currentBest > oldBest).
// Fica "parado" no último valor até haver de facto um recorde diferente.
function recordBestDiffEvent(dev, currentBest, ts){
  if(!bestDiffLive.perMachine[dev.id]) bestDiffLive.perMachine[dev.id] = { name: dev.name, best: 0, count: 0, lastTs: null };
  const pm = bestDiffLive.perMachine[dev.id];
  pm.name = dev.name;
  pm.best = currentBest;
  pm.count += 1;
  pm.lastTs = ts;

  if(currentBest > bestDiffLive.globalBest) bestDiffLive.globalBest = currentBest;
  bestDiffLive.globalCount += 1;
  bestDiffLive.globalLastTs = ts;

  const fmt = formatDiff(currentBest);
  bestDiffLive.feed.push({
    id: `${dev.id}-${ts}-${Math.random().toString(36).slice(2,7)}`,
    machineId: dev.id, machine: dev.name,
    diffText: `${fmt.value} ${fmt.unit}`, ts
  });
  if(bestDiffLive.feed.length > BD_FEED_MAX) bestDiffLive.feed.splice(0, bestDiffLive.feed.length - BD_FEED_MAX);

  if(!bestDiffLive.panelOpen){
    bestDiffLive.unseenCount++;
    const badge = document.getElementById('bdFabBadge');
    if(badge){ badge.classList.add('show'); badge.textContent = bestDiffLive.unseenCount > 99 ? '99+' : String(bestDiffLive.unseenCount); }
  }
  const fab = document.getElementById('bdFab');
  if(fab){ fab.classList.remove('pulse'); void fab.offsetWidth; fab.classList.add('pulse'); }

  renderBestDiffPanel();
  if(bestDiffLive.fullModalOpen) renderBestDiffFullModal();
}

function getFilteredBestDiffFeed(){
  if(bestDiffLive.filterMachineId === 'all') return bestDiffLive.feed;
  return bestDiffLive.feed.filter(item => String(item.machineId) === String(bestDiffLive.filterMachineId));
}

function relativeTimeFromNow(ts){
  if(!ts) return '—';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if(diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if(diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  return `${diffH}h`;
}

function renderBestDiffFeedItemsHtml(items){
  return items.map(item => {
    const time = new Date(item.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `<div class="bd-feed-item">
      <span class="bd-feed-icon">🏆</span>
      <span class="bd-feed-machine">${item.machine}</span>
      <span class="bd-feed-text">${t('melhor_diff')}: <b>${item.diffText}</b></span>
      <span class="bd-feed-time">${time}</span>
    </div>`;
  }).join('');
}

function renderBestDiffPanel(){
  const filterId = bestDiffLive.filterMachineId || 'all';
  const isAll = filterId === 'all';
  const pm = !isAll ? bestDiffLive.perMachine[filterId] : null;
  const best = isAll ? bestDiffLive.globalBest : (pm?.best || 0);
  const count = isAll ? bestDiffLive.globalCount : (pm?.count || 0);
  const lastTs = isAll ? bestDiffLive.globalLastTs : (pm?.lastTs || null);

  const elBest = document.getElementById('bdStatBest');
  const elCount = document.getElementById('bdStatCount');
  const elLast = document.getElementById('bdStatLast');
  if(elBest){
    if(best > 0){ const fmt = formatDiff(best); elBest.textContent = `${fmt.value}${fmt.unit}`; }
    else elBest.textContent = '—';
  }
  if(elCount) elCount.textContent = count.toLocaleString();
  if(elLast) elLast.textContent = lastTs ? relativeTimeFromNow(lastTs) : '—';

  const feedEl = document.getElementById('bdFeed');
  if(!feedEl) return;
  const filtered = getFilteredBestDiffFeed();
  if(filtered.length === 0){
    feedEl.innerHTML = `<div class="ls-feed-empty">${t('bd_a_aguardar')}</div>`;
    return;
  }
  feedEl.innerHTML = renderBestDiffFeedItemsHtml(filtered.slice(-BD_FEED_RENDER_MAX));
}

function renderBestDiffFullModal(){
  const listEl = document.getElementById('bdFullList');
  if(!listEl) return;
  const filtered = getFilteredBestDiffFeed();
  if(filtered.length === 0){
    listEl.innerHTML = `<div class="ls-feed-empty">${t('bd_a_aguardar')}</div>`;
    return;
  }
  listEl.innerHTML = renderBestDiffFeedItemsHtml(filtered);
}


let thermalHistory = {};
let maintenanceLog = {}; // { [devId]: [{ t: timestamp, note: string }] }, mais recente no fim
let thermalAlertState = {};
let thermalForecastAlertState = {};
let thermalSelectedId = null;

let thermalProtectionSettings = { enabled: true, criticalTemp: 90, sustainSec: 45 };
let thermalCriticalState = {};   // por dispositivo: { since, alarmed }
let criticalAlarmSilenced = false;
let criticalAlarmIntervalId = null;

let consoleLogs = [];
let notifications = [];
let unreadNotifs = 0;

let realtimeActive = true;
let autoScroll = true;
let soundEnabled = true;

let audioCtx = null;
function initAudio() {
  if(!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if(audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSound(type) {
  if(!soundEnabled) return;
  try {
    initAudio();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if(type === 'block') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.1);
      osc.frequency.setValueAtTime(1174.66, now + 0.2);
      
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      
      osc.start(now);
      osc.stop(now + 0.5);
    } else if(type === 'best') {
      // "Moeda a tilintar" — arpejo rápido tipo coin de jogo retro.
      osc.type = 'square';
      osc.frequency.setValueAtTime(988, now);
      osc.frequency.setValueAtTime(1319, now + 0.08);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.start(now);
      osc.stop(now + 0.28);

      // Segunda "moeda" a cair logo a seguir, para dar sensação de tilintar.
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(1175, now + 0.09);
      osc2.frequency.setValueAtTime(1568, now + 0.17);
      gain2.gain.setValueAtTime(0.14, now + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.4);
    } else if(type === 'offline') {
      // Alarme grave e lento — só para máquina offline, para se distinguir
      // claramente dos outros avisos (mais agudos/rápidos).
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.setValueAtTime(98, now + 0.35);
      osc.frequency.setValueAtTime(110, now + 0.7);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.setValueAtTime(0.22, now + 0.9);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

      osc.start(now);
      osc.stop(now + 1.0);
    } else if(type === 'thermal' || type === 'thermal-warning') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(type === 'thermal' ? 300 : 380, now);
      osc.frequency.setValueAtTime(type === 'thermal' ? 220 : 300, now + 0.15);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.start(now);
      osc.stop(now + 0.45);
    } else if(type === 'critical') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(660, now + 0.15);
      osc.frequency.setValueAtTime(880, now + 0.3);
      osc.frequency.setValueAtTime(660, now + 0.45);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.setValueAtTime(0.28, now + 0.55);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.start(now);
      osc.stop(now + 0.6);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch(e) {
    console.error('Erro ao reproduzir som:', e);
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  const btn = $('soundToggleBtn');
  if(soundEnabled) {
    btn.className = 'sound-toggle-btn';
    btn.innerHTML = t('som_ativo');
    playSound('best');
  } else {
    btn.className = 'sound-toggle-btn muted';
    btn.innerHTML = t('som_mudo');
  }
}

function setTheme(themeName){
  document.body.dataset.theme = themeName;
  try { localStorage.setItem(THEME_KEY, themeName); } catch(e){}
  if(typeof bodyPolyApplyTheme === 'function') bodyPolyApplyTheme();
  const sel = $('themeSelect');
  if(sel && sel.value !== themeName) sel.value = themeName;
}

function loadTheme(){
  let theme = 'default';
  try { theme = localStorage.getItem(THEME_KEY) || 'default'; } catch(e){}
  document.body.dataset.theme = theme;
  if(typeof bodyPolyApplyTheme === 'function') bodyPolyApplyTheme();
  const sel = $('themeSelect');
  if(sel) sel.value = theme;
}

