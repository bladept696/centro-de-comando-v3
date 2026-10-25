// --- Localizar máquinas na rede (scan de subrede) ---
let scanInFlight = false;

function openScanModal(isOnboarding){
  $('scanModalOverlay').classList.add('open');
  const welcome = $('scanModalWelcome');
  if(welcome) welcome.style.display = isOnboarding ? 'block' : 'none';
  runNetworkScan();
}

function closeScanModal(){
  $('scanModalOverlay').classList.remove('open');
}

async function runNetworkScan(){
  if(scanInFlight) return;
  scanInFlight = true;
  const body = $('scanModalBody');
  const status = $('scanStatus');
  const addAllBtn = $('scanAddAllBtn');
  const subnetInput = $('scanSubnetInput');
  addAllBtn.style.display = 'none';
  body.innerHTML = `
    <div class="scan-radar-wrap">
      <div class="scan-radar">
        <div class="scan-radar-cross"></div>
        <div class="scan-radar-ring r1"></div>
        <div class="scan-radar-ring r2"></div>
        <div class="scan-radar-ring r3"></div>
        <div class="scan-radar-dot d1"></div>
        <div class="scan-radar-dot d2"></div>
        <div class="scan-radar-dot d3"></div>
        <div class="scan-radar-sweep"></div>
      </div>
      <div class="scan-radar-text">
        <span data-i18n="a_procurar_maquinas_na_rede">A procurar máquinas na rede local</span><span class="scan-dots"><span>.</span><span>.</span><span>.</span></span>
      </div>
    </div>`;
  if(typeof applyTranslations === 'function') applyTranslations();
  status.textContent = '';
  $('scanBtn').disabled = true;
  $('scanRescanBtn').disabled = true;

  try {
    // Se o campo já tiver algo escrito (o utilizador editou-o, ou é um
    // novo pedido de pesquisa), usa isso; senão deixa o backend detetar
    // sozinho a sub-rede deste computador (comportamento original).
    const customSubnet = subnetInput.value.trim();
    // URL absoluto (API_BASE): só assim o fetch embrulhado junta o token de login
    const url = customSubnet ? `${API_BASE}/api/scan?subnet=${encodeURIComponent(customSubnet)}` : `${API_BASE}/api/scan`;
    const resp = await fetch(url);
    if(!resp.ok) throw new Error('scan failed');
    const data = await resp.json();
    // Preenche o campo com a sub-rede que foi de facto usada (útil na
    // primeira pesquisa, quando o campo ainda estava vazio e o backend
    // é quem escolheu automaticamente).
    if(!customSubnet && data.subnet) subnetInput.value = data.subnet;
    renderScanResults(data.devices || [], data.subnet || '');
  } catch(e){
    body.innerHTML = `<div class="scan-error" data-i18n="erro_ao_procurar_maquinas_na_rede">Não foi possível concluir o scan da rede. Confirma que o servidor local está a correr.</div>`;
    if(typeof applyTranslations === 'function') applyTranslations();
  } finally {
    scanInFlight = false;
    $('scanBtn').disabled = false;
    $('scanRescanBtn').disabled = false;
  }
}

function renderScanResults(found, subnet){
  const body = $('scanModalBody');
  const status = $('scanStatus');
  const addAllBtn = $('scanAddAllBtn');
  const existingIps = new Set(devices.map(d => d.ip));
  const newOnes = found.filter(d => !existingIps.has(d.ip));

  status.textContent = subnet ? `${subnet}.0/24` : '';

  if(found.length === 0){
    body.innerHTML = `<div class="scan-empty" data-i18n="nenhuma_maquina_encontrada_na_rede">Nenhuma máquina encontrada na rede local.</div>`;
    if(typeof applyTranslations === 'function') applyTranslations();
    addAllBtn.style.display = 'none';
    return;
  }

  body.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'scan-device-list';

  found.forEach((dev, i) => {
    const already = existingIps.has(dev.ip);
    const row = document.createElement('div');
    row.className = 'scan-device-row';
    row.style.setProperty('--row-i', i);
    const meta = [dev.model, dev.protocol === 'cgminer' ? 'cgminer/LuxOS' : null].filter(Boolean).join(' · ');
    row.innerHTML = `
      <div class="scan-device-info">
        <div class="scan-device-name"><span class="scan-live-dot"></span>${escapeHtml(dev.hostname || dev.ip)}</div>
        <div class="scan-device-meta">${escapeHtml(dev.ip)}${meta ? ' · ' + escapeHtml(meta) : ''}</div>
      </div>
    `;
    if(already){
      const tag = document.createElement('span');
      tag.className = 'scan-device-added';
      tag.textContent = '✓ já adicionada';
      row.appendChild(tag);
    } else {
      const btn = document.createElement('button');
      btn.className = 'scan-device-add-btn';
      btn.textContent = 'Adicionar';
      btn.onclick = () => {
        addDevice(dev.hostname && dev.hostname !== dev.ip ? dev.hostname : '', dev.ip);
        existingIps.add(dev.ip);
        renderScanResults(found, subnet);
      };
      row.appendChild(btn);
    }
    list.appendChild(row);
  });

  body.appendChild(list);
  if(typeof applyTranslations === 'function') applyTranslations();
  addAllBtn.style.display = newOnes.length > 0 ? 'inline-block' : 'none';
  addAllBtn.onclick = () => {
    newOnes.forEach(dev => {
      addDevice(dev.hostname && dev.hostname !== dev.ip ? dev.hostname : '', dev.ip);
    });
    renderScanResults(found, subnet);
  };
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}


// --- Scanner de rede 2.0: filtros, resumo e metadados ---------------------
let scanResultsCache = [];
let scanResultsSubnet = '';
let scanFilterText = '';
let scanFilterMode = 'all';

function scanDeviceCompatible(dev){
  return /cgminer|luxos|nerdqaxe|asic|minera/i.test(`${dev?.protocol||''} ${dev?.model||''} ${dev?.hostname||''}`);
}

function applyScanFilters(){
  const rows = document.querySelectorAll('.scan-device-row');
  const q = aiNormalize(scanFilterText || '');
  const currentIps = new Set(devices.map(d => d.ip));
  let visible = 0;
  rows.forEach(row => {
    const dev = scanResultsCache[Number(row.dataset.scanIndex || 0)];
    if(!dev) return;
    const already = currentIps.has(dev.ip);
    const text = aiNormalize(`${dev.hostname||''} ${dev.ip||''} ${dev.model||''} ${dev.protocol||''}`);
    let ok = !q || text.includes(q);
    if(scanFilterMode === 'new') ok = ok && !already;
    if(scanFilterMode === 'added') ok = ok && already;
    if(scanFilterMode === 'compatible') ok = ok && scanDeviceCompatible(dev);
    row.classList.toggle('scan-hidden', !ok);
    if(ok) visible++;
  });
  const status = $('scanStatus');
  if(status) status.textContent = `${visible}/${scanResultsCache.length} visíveis${scanResultsSubnet ? ' · '+scanResultsSubnet+'.0/24' : ''}`;
}

// Sobrescreve a versão simples do scanner criada originalmente, mantendo o
// mesmo endpoint /api/scan mas tornando os resultados muito mais úteis.
function renderScanResults(found, subnet){
  const body = $('scanModalBody');
  const status = $('scanStatus');
  const addAllBtn = $('scanAddAllBtn');
  if(!body || !status || !addAllBtn) return;

  scanResultsCache = Array.isArray(found) ? found.slice() : [];
  scanResultsSubnet = subnet || '';
  scanFilterText = $('scanFilterInput')?.value || '';
  scanFilterMode = $('scanFilterSelect')?.value || 'all';

  body.innerHTML = '';
  if(!scanResultsCache.length){
    body.innerHTML = '<div class="scan-empty">Nenhuma máquina encontrada na rede local.</div>';
    status.textContent = scanResultsSubnet ? `${scanResultsSubnet}.0/24 · 0 encontrados` : '0 encontrados';
    addAllBtn.style.display = 'none';
    return;
  }

  const existingIps = new Set(devices.map(d => d.ip));
  const newCount = scanResultsCache.filter(d => !existingIps.has(d.ip)).length;
  const compatibleCount = scanResultsCache.filter(scanDeviceCompatible).length;
  const summary = document.createElement('div');
  summary.className = 'scan-summary-bar';
  summary.innerHTML = `<div class="scan-summary-main"><b>${scanResultsCache.length}</b> encontrados · <b>${newCount}</b> novos · <b>${compatibleCount}</b> compatíveis</div><div style="font-size:9px;color:var(--muted-2)">${escapeHtml(scanResultsSubnet ? scanResultsSubnet+'.0/24' : 'sub-rede automática')}</div>`;
  body.appendChild(summary);

  const list = document.createElement('div');
  list.className = 'scan-device-list';
  scanResultsCache.forEach((dev, i) => {
    const already = existingIps.has(dev.ip);
    const host = dev.hostname || dev.ip || 'dispositivo';
    const model = dev.model || 'modelo não identificado';
    const protocol = dev.protocol || 'protocolo desconhecido';
    const latency = dev.latency ?? dev.ping ?? dev.response_ms ?? null;
    const row = document.createElement('div');
    row.className = 'scan-device-row';
    row.dataset.scanIndex = String(i);
    row.style.setProperty('--row-i', i);
    const meta = document.createElement('div');
    meta.className = 'scan-device-info';
    meta.innerHTML = `<div class="scan-device-name"><span class="scan-live-dot"></span>${escapeHtml(host)}</div><div class="scan-device-meta">${escapeHtml(dev.ip || '—')}</div><div class="scan-result-extra"><span class="scan-tag protocol">${escapeHtml(protocol)}</span><span class="scan-tag">${escapeHtml(model)}</span>${latency != null ? `<span class="scan-tag">${escapeHtml(String(latency))} ms</span>` : ''}${scanDeviceCompatible(dev) ? '<span class="scan-tag compat">compatível</span>' : ''}${already ? '<span class="scan-tag added">já adicionada</span>' : ''}</div>`;
    row.appendChild(meta);
    if(already){
      const tag = document.createElement('span');
      tag.className = 'scan-device-added';
      tag.textContent = '✓ já adicionada';
      row.appendChild(tag);
    } else {
      const btn = document.createElement('button');
      btn.className = 'scan-device-add-btn';
      btn.textContent = scanDeviceCompatible(dev) ? 'Adicionar' : 'Adicionar mesmo assim';
      btn.onclick = () => {
        addDevice(host !== dev.ip ? host : '', dev.ip);
        renderScanResults(scanResultsCache, scanResultsSubnet);
      };
      row.appendChild(btn);
    }
    list.appendChild(row);
  });
  body.appendChild(list);

  const newOnes = scanResultsCache.filter(dev => !existingIps.has(dev.ip));
  addAllBtn.style.display = newOnes.length ? 'inline-block' : 'none';
  addAllBtn.onclick = () => {
    newOnes.forEach(dev => addDevice(dev.hostname && dev.hostname !== dev.ip ? dev.hostname : '', dev.ip));
    renderScanResults(scanResultsCache, scanResultsSubnet);
    renderNetworkMap();
  };
  status.textContent = `${scanResultsCache.length}/${scanResultsCache.length} visíveis${scanResultsSubnet ? ' · '+scanResultsSubnet+'.0/24' : ''}`;
  applyScanFilters();
}

$('scanFilterInput')?.addEventListener('input', e => { scanFilterText = e.target.value; applyScanFilters(); });
$('scanFilterSelect')?.addEventListener('change', e => { scanFilterMode = e.target.value; applyScanFilters(); });

// --- Mapa visual da rede (v2) ---------------------------------------------
// Camadas: Centro de Comando -> Router/Wi-Fi -> máquinas -> pools -> rede Bitcoin.
// Atualiza os nós "no sítio" (sem redesenhar tudo), desenha as ligações em
// curvas, anima shares/blocos a viajar pelas linhas, deixa arrastar os nós
// (posições guardadas) e abre um menu de ações com clique direito/toque longo.
let networkMapAuto = true;
let networkMapResizeObserver = null;
let networkMapMode = 'status';
let nmPos = {};
const nmNodes = new Map();
const nmEdges = new Map();
const nmLastSeen = {};
const nmLastAccepted = {};
let nmLastBlockHeight = null;
let nmRenderRaf = 0;
let nmJustDragged = false;
let nmMenuEl = null;
let nmPulseCount = 0;
const NM_POS_KEY = 'networkMapPositions_v2';   // v2: disposição compacta em colunas
const NM_MODE_KEY = 'networkMapMode_v1';
try { nmPos = JSON.parse(localStorage.getItem(NM_POS_KEY) || '{}') || {}; } catch(e) { nmPos = {}; }
try { const m = localStorage.getItem(NM_MODE_KEY); if (['status','temp','eff','link'].includes(m)) networkMapMode = m; } catch(e) {}

const NM_COL = { good:'var(--green)', ok:'var(--amber)', bad:'var(--red)', none:'var(--muted)' };
const NM_LEGENDS = {
  status: [['var(--cyan)','Centro de comando'],['var(--green)','Online'],['var(--red)','Offline']],
  temp:   [['var(--green)','< 55 °C'],['#d4e157','55–65 °C'],['var(--amber)','65–75 °C'],['var(--red)','≥ 75 °C']],
  eff:    [['var(--green)','Mais eficiente'],['var(--amber)','Intermédia'],['var(--red)','Menos eficiente']],
  link:   [['var(--green)','Ligação boa'],['var(--amber)','Razoável'],['var(--red)','Fraca'],['var(--muted)','Sem dados']]
};
const NM_TPL = {
  center: '<div class="network-node-head"><div class="network-node-name">🖥️ Centro de Comando</div><span class="network-node-status online"></span></div><div class="network-node-meta">Servidor local · :8765</div><div class="network-node-stats"><div class="network-node-stat"><span>Máquinas</span><b data-f="n"></b></div><div class="network-node-stat"><span>Online</span><b data-f="on"></b></div><div class="network-node-stat"><span>Hashrate</span><b data-f="hash"></b></div><div class="network-node-stat"><span>Potência</span><b data-f="pow"></b></div></div>',
  router: '<div class="network-node-head"><div class="network-node-name">📡 Router / Wi-Fi</div><span class="network-node-status online" data-f="dot"></span></div><div class="network-node-meta">Média das ligações às máquinas</div><div class="network-node-stats"><div class="network-node-stat"><span>Ligadas</span><b data-f="conn"></b></div><div class="network-node-stat"><span>Latência</span><b data-f="lat"></b></div><div class="network-node-stat"><span>Sinal Wi-Fi</span><b data-f="rssi"></b></div><div class="network-node-stat"><span>Pior ligação</span><b data-f="worst"></b></div></div>',
  machine: '<div class="network-node-head"><div class="network-node-name" data-f="name"></div><span class="network-node-status" data-f="dot"></span></div><div class="network-node-meta" data-f="meta"></div><div class="network-node-stats"><div class="network-node-stat"><span>Hashrate</span><b data-f="hash"></b></div><div class="network-node-stat"><span>Temp</span><b data-f="temp"></b></div><div class="network-node-stat"><span>Ligação</span><b data-f="link"></b></div><div class="network-node-stat"><span>Ping pool</span><b data-f="ping"></b></div></div>',
  pool: '<div class="network-node-head"><div class="network-node-name" data-f="name"></div><span class="network-node-status online"></span></div><div class="network-node-meta" data-f="meta"></div><div class="network-node-stats"><div class="network-node-stat"><span>Máquinas</span><b data-f="n"></b></div><div class="network-node-stat"><span>Ping médio</span><b data-f="ping"></b></div></div>',
  net: '<div class="network-node-head"><div class="network-node-name">₿ Rede Bitcoin</div><span class="network-node-status online"></span></div><div class="network-node-meta" data-f="meta"></div><div class="network-node-stats"><div class="network-node-stat"><span>Altura</span><b data-f="h"></b></div><div class="network-node-stat"><span>Próx. bloco</span><b data-f="fee"></b></div></div>',
  ghost: '<div class="network-node-head"><div class="network-node-name" data-f="name"></div><span class="network-node-status offline"></span></div><div class="network-node-meta" data-f="meta"></div><button class="nm-add" type="button">+ Adicionar</button>'
};

function nmSafe(fn, fb){ try { const v = fn(); return v === undefined ? fb : v; } catch(e) { return fb; } }
function nmReduced(){ return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
function nmSavePos(){ try { localStorage.setItem(NM_POS_KEY, JSON.stringify(nmPos)); } catch(e) {} }
function nmSet(el, f, v){ const n = el.querySelector('[data-f="' + f + '"]'); const t = String(v); if (n && n.textContent !== t) n.textContent = t; }
function nmMs(v){ return (v == null || !isFinite(v)) ? '—' : Math.round(v) + ' ms'; }
function nmAgo(ms){
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'há instantes';
  if (s < 3600) return 'há ' + Math.round(s / 60) + ' min';
  if (s < 86400) return 'há ' + Math.round(s / 3600) + ' h';
  return 'há ' + Math.round(s / 86400) + ' d';
}
function nmIsSha(r){ return algoGroupOf(r) === 'sha256'; }
// Totais por algoritmo (SHA-256 em GH/s, Scrypt e GPU em MH/s); com mais de um algoritmo mostra "Multi-algo".
function nmAlgoTotals(onlineList){
  let sha = 0, scrypt = 0; const gpu = {}, oth = {};
  onlineList.forEach(d => {
    const r = readings[d.id], algo = (r.algorithm || 'sha256').toLowerCase();
    const raw = Number(r.hashrate_raw || (r.hashrate ? r.hashrate * 1e9 : 0));
    const g = algoGroupOf(r);
    if (g === 'scrypt') scrypt += raw / 1e6;
    else if (g === 'gpu') gpu[algo] = (gpu[algo] || 0) + raw / 1e6;
    else if (g === 'other') oth[algo] = (oth[algo] || 0) + raw / 1e6;
    else sha += raw / 1e9;
  });
  const parts = [];
  if (sha > 0) parts.push({ v: sha >= 1000 ? (sha / 1000).toFixed(2) + ' TH/s' : sha.toFixed(1) + ' GH/s', tag: 'BTC' });
  if (scrypt > 0) parts.push({ v: scrypt.toFixed(1) + ' MH/s', tag: 'LTC' });
  Object.keys(gpu).forEach(a => parts.push({ v: gpu[a].toFixed(1) + ' MH/s', tag: a.toUpperCase() }));
  Object.keys(oth).forEach(a => parts.push({ v: oth[a] >= 1e6 ? (oth[a] / 1e6).toFixed(2) + ' TH/s' : oth[a] >= 1e3 ? (oth[a] / 1e3).toFixed(2) + ' GH/s' : oth[a].toFixed(1) + ' MH/s', tag: a.toUpperCase() }));
  if (!parts.length) return { text: '—', title: '' };
  if (parts.length === 1) return { text: parts[0].v, title: '' };
  return { text: 'Multi-algo', title: parts.map(x => x.v + ' ' + x.tag).join('\n') };
}
function nmLink(r){
  const rssi = (r && r.rssi != null && isFinite(r.rssi)) ? Number(r.rssi) : null;
  const lat = (r && r.localLatency != null && isFinite(r.localLatency)) ? Number(r.localLatency) : null;
  const qr = rssi == null ? -1 : (rssi >= -60 ? 0 : rssi >= -72 ? 1 : 2);
  const ql = lat == null ? -1 : (lat < 250 ? 0 : lat < 700 ? 1 : 2);
  const w = Math.max(qr, ql);
  const parts = [];
  if (rssi != null) parts.push(Math.round(rssi) + ' dBm');
  if (lat != null) parts.push(Math.round(lat) + ' ms');
  return { q: w < 0 ? 'none' : ['good','ok','bad'][w], rssi, lat, text: parts.join(' · ') || '—' };
}
function nmTempCol(t){
  if (t == null || !isFinite(t)) return 'var(--muted)';
  return t >= 75 ? 'var(--red)' : t >= 65 ? 'var(--amber)' : t >= 55 ? '#d4e157' : 'var(--green)';
}
function nmAccent(mode, r, link, effRank){
  if (!r || !r.online) return 'var(--red)';
  if (mode === 'temp') return nmTempCol(Number(r.temp));
  if (mode === 'eff') return effRank == null ? 'var(--muted)' : (effRank < 0.34 ? 'var(--green)' : effRank < 0.67 ? 'var(--amber)' : 'var(--red)');
  if (mode === 'link') return NM_COL[link.q];
  return 'var(--green)';
}

// Grelha simples: quantos cabem por linha, em que linha/coluna fica o nó idx.
function nmGrid(count, idx, W, nodeW){
  const perRow = Math.max(1, Math.min(5, Math.floor((W - 24) / (nodeW + 18))));
  const row = Math.floor(idx / perRow);
  const inRow = Math.min(perRow, count - row * perRow);
  const col = idx - row * perRow;
  const span = inRow <= 1 ? 0 : Math.min(0.86 - nodeW / W, (inRow - 1) * (nodeW + 18) / W);
  const x = inRow <= 1 ? 0.5 : 0.5 - span / 2 + col * (span / (inRow - 1));
  return { row, x, perRow, rows: Math.ceil(count / perRow) };
}

// Disposição compacta da esquerda para a direita, em colunas:
// centro → router → máquinas → pools → rede Bitcoin. A altura só cresce
// com a coluna mais comprida. Em ecrãs estreitos usa a disposição vertical.
function nmLayout(W, list, pools, ghosts){
  const ROW = 118, TOP = 66, pos = {};   // cartões com ~106 px de altura
  const machines = list.map(d => 'm:' + d.id).concat(ghosts.map(g => 'g:' + g.ip));
  const mCols = machines.length > 12 ? 3 : machines.length > 6 ? 2 : 1;
  // sem largura para colunas de pelo menos 200 px, volta à disposição vertical
  if (W < 190 + (4 + (mCols - 1) * 0.75) * 200) return nmLayoutVertical(W, list, pools, ghosts);
  const mRows = Math.max(1, Math.ceil(machines.length / mCols));
  const pRows = Math.max(1, pools.length);
  const rows = Math.max(2, mRows, pRows);
  const H = TOP * 2 + (rows - 1) * ROW;
  const mid = H / 2;
  // colunas em px, convertidas para fração da largura
  const colGap = Math.min(230, (W - 190) / (4 + (mCols - 1) * 0.75));
  const xCenter = 100, xRouter = xCenter + colGap, xM0 = xRouter + colGap;
  const xPool = xM0 + (mCols - 1) * colGap * 0.75 + colGap, xNet = Math.min(W - 95, xPool + colGap);
  const fx = px => px / W;
  pos['center'] = { x: fx(xCenter), y: mid };
  pos['router'] = { x: fx(xRouter), y: mid };
  machines.forEach((id, i) => {
    const col = Math.floor(i / mRows), row = i % mRows, inCol = Math.min(mRows, machines.length - col * mRows);
    pos[id] = { x: fx(xM0 + col * colGap * 0.75), y: mid + (row - (inCol - 1) / 2) * ROW };
  });
  pools.forEach((p, i) => { pos['p:' + p.key] = { x: fx(xPool), y: mid + (i - (pools.length - 1) / 2) * ROW }; });
  pos['net'] = { x: fx(xNet), y: mid };
  return { pos, H, cols: true };
}
function nmLayoutVertical(W, list, pools, ghosts){
  const ROW = 150, pos = {};
  pos['center'] = { x: 0.5, y: 64 };
  pos['router'] = { x: 0.5, y: 194 };
  const M0 = 340;
  list.forEach((d, i) => { const g = nmGrid(list.length, i, W, 150); pos['m:' + d.id] = { x: g.x, y: M0 + g.row * ROW }; });
  const mRows = list.length ? nmGrid(list.length, 0, W, 150).rows : 1;
  let lastY = M0 + (mRows - 1) * ROW;
  if (pools.length) {
    const poolY = lastY + 160;
    const perRow = nmGrid(pools.length, 0, W, 160).perRow;
    if (pools.length <= perRow) {
      const arr = pools.map(p => ({ key: p.key, x: p.devs.reduce((a, d) => a + pos['m:' + d.id].x, 0) / p.devs.length }));
      arr.sort((a, b) => a.x - b.x);
      const gap = (160 + 16) / W;
      for (let i = 1; i < arr.length; i++) if (arr[i].x - arr[i - 1].x < gap) arr[i].x = arr[i - 1].x + gap;
      const over = arr[arr.length - 1].x - 0.91;
      if (over > 0) arr.forEach(a => { a.x -= over; });
      arr.forEach(a => { pos['p:' + a.key] = { x: Math.max(0.09, a.x), y: poolY }; });
      lastY = poolY;
    } else {
      pools.forEach((p, i) => { const g = nmGrid(pools.length, i, W, 160); pos['p:' + p.key] = { x: g.x, y: poolY + g.row * 110 }; });
      lastY = poolY + (nmGrid(pools.length, 0, W, 160).rows - 1) * 110;
    }
  }
  const netY = lastY + (pools.length ? 130 : 160);
  pos['net'] = { x: 0.5, y: netY };
  let endY = netY;
  if (ghosts.length) {
    const gy = netY + 140;
    ghosts.forEach((g, i) => { const gg = nmGrid(ghosts.length, i, W, 150); pos['g:' + g.ip] = { x: gg.x, y: gy + gg.row * 120 }; });
    endY = gy + (nmGrid(ghosts.length, 0, W, 150).rows - 1) * 120;
  }
  return { pos, H: Math.max(560, endY + 90) };
}

function nmBox(id, W, H){
  const n = nmNodes.get(id); if (!n) return null;
  const el = n.el;
  return { x: parseFloat(el.style.left) / 100 * W, y: parseFloat(el.style.top) / 100 * H, w: el.offsetWidth, h: el.offsetHeight };
}
function nmPath(a, b){
  const dy = b.y - a.y, dx = b.x - a.x;
  if (Math.abs(dy) >= (a.h + b.h) / 2 * 0.6) {
    const sy = dy > 0 ? a.y + a.h / 2 : a.y - a.h / 2;
    const ey = dy > 0 ? b.y - b.h / 2 : b.y + b.h / 2;
    const my = (sy + ey) / 2;
    return 'M' + a.x + ',' + sy + ' C' + a.x + ',' + my + ' ' + b.x + ',' + my + ' ' + b.x + ',' + ey;
  }
  const sx = dx > 0 ? a.x + a.w / 2 : a.x - a.w / 2;
  const ex = dx > 0 ? b.x - b.w / 2 : b.x + b.w / 2;
  const mx = (sx + ex) / 2;
  return 'M' + sx + ',' + a.y + ' C' + mx + ',' + a.y + ' ' + mx + ',' + b.y + ' ' + ex + ',' + b.y;
}
function nmUpdateEdgeGeometry(){
  const wrap = $('networkMapWrap'), svg = $('networkMapSvg');
  if (!wrap || !svg) return;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  nmEdges.forEach(e => {
    const a = nmBox(e.from, W, H), b = nmBox(e.to, W, H);
    if (a && b) e.el.setAttribute('d', nmPath(a, b));
  });
}

function nmPulse(key, color, reverse, dur){
  if (nmReduced() || nmPulseCount > 24) return;
  const e = nmEdges.get(key), svg = $('networkMapSvg');
  if (!e || !svg || typeof e.el.getTotalLength !== 'function') return;
  let len = 0;
  try { len = e.el.getTotalLength(); } catch(_) { return; }
  if (!len) return;
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('r', '3.4'); c.setAttribute('class', 'nm-pulse');
  c.style.fill = color || 'var(--cyan)'; c.style.color = color || 'var(--cyan)';
  svg.appendChild(c); nmPulseCount++;
  const t0 = performance.now(), D = dur || 1000;
  const step = now => {
    const t = Math.min(1, (now - t0) / D);
    const u = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    let p;
    try { p = e.el.getPointAtLength((reverse ? 1 - u : u) * len); } catch(_) { c.remove(); nmPulseCount--; return; }
    c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
    if (t < 1 && c.isConnected) requestAnimationFrame(step); else { c.remove(); nmPulseCount--; }
  };
  requestAnimationFrame(step);
}

function nmSelect(dev){
  selectedId = dev.id; renderAll();
  const room = typeof officeEls !== 'undefined' && officeEls[dev.id];
  if (room) room.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function nmCloseMenu(){ if (nmMenuEl) { nmMenuEl.remove(); nmMenuEl = null; } }
function nmOpenMenu(el, cx, cy){
  nmCloseMenu();
  const wrap = $('networkMapWrap'); if (!wrap) return;
  const id = el.dataset.mapId;
  const dev = (devices || []).find(d => d.id === el.dataset.devId);
  const label = dev ? (dev.name || dev.ip) : '';
  const items = [];
  if (el.dataset.type === 'machine' && dev) {
    items.push(['🎯 Selecionar', () => nmSelect(dev)]);
    if (dev.ip) items.push(['↗ Abrir AxeOS', () => window.open('http://' + dev.ip, '_blank', 'noopener')]);
    if (dev.ip) items.push(['⧉ Copiar IP', () => { try { navigator.clipboard.writeText(dev.ip); } catch(e) {} }]);
    [['eco', '🌿'], ['turbo', '🚀']].forEach(([slot, icon]) => {
      const prof = nmSafe(() => getQuickSlot(slot), null);
      if (!prof) return;
      items.push([icon + ' Aplicar ' + prof.name, async () => {
        if (!confirm('Aplicar "' + prof.name + '" (' + nmSafe(() => qpDescribe(prof), '') + ') a ' + label + '?')) return;
        const res = await aiApplyProfile(prof, dev);
        setQuickActionStatus(res && res.ok ? '✓ "' + prof.name + '" aplicado a ' + label + '.' : '✗ Falhou em ' + label + '.');
        renderAll();
      }]);
    });
    items.push(['⟲ Reiniciar', async () => {
      if (!confirm('Reiniciar ' + label + '? A mineração será interrompida temporariamente.')) return;
      const res = await aiRestartDevice(dev);
      setQuickActionStatus(res && res.ok ? '✓ Reinício enviado a ' + label + '.' : '✗ Falhou em ' + label + '.');
    }]);
  }
  if (nmPos[id]) items.push(['↺ Repor posição', () => { delete nmPos[id]; nmSavePos(); renderNetworkMap(); }]);
  if (!items.length) return;
  const menu = document.createElement('div');
  menu.className = 'nm-menu';
  items.forEach(([txt, fn]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = txt;
    b.addEventListener('click', ev => { ev.stopPropagation(); nmCloseMenu(); fn(); });
    menu.appendChild(b);
  });
  const r = wrap.getBoundingClientRect();
  menu.style.left = Math.max(4, Math.min(cx - r.left, r.width - 200)) + 'px';
  menu.style.top = Math.max(4, Math.min(cy - r.top, r.height - 40 * items.length)) + 'px';
  wrap.appendChild(menu);
  nmMenuEl = menu;
}

function nmBindNode(el){
  let st = null, lp = null;
  el.addEventListener('pointerdown', e => {
    if (e.target.closest && e.target.closest('button')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    st = { id: el.dataset.mapId, x: e.clientX, y: e.clientY, moved: false, pid: e.pointerId };
    if (e.pointerType !== 'mouse') {
      const cx = e.clientX, cy = e.clientY;
      lp = setTimeout(() => { if (st && !st.moved) { st = null; nmOpenMenu(el, cx, cy); } }, 550);
    }
  });
  el.addEventListener('pointermove', e => {
    if (!st) return;
    if (!st.moved) {
      if (Math.hypot(e.clientX - st.x, e.clientY - st.y) < 5) return;
      st.moved = true; clearTimeout(lp); nmCloseMenu();
      el.classList.add('dragging');
      try { el.setPointerCapture(st.pid); } catch(_) {}
    }
    const r = $('networkMapWrap').getBoundingClientRect();
    const fx = Math.min(0.94, Math.max(0.06, (e.clientX - r.left) / r.width));
    const fy = Math.min(0.97, Math.max(0.04, (e.clientY - r.top) / r.height));
    nmPos[st.id] = { x: fx, y: fy };
    el.style.left = (fx * 100) + '%'; el.style.top = (fy * 100) + '%';
    nmUpdateEdgeGeometry();
  });
  const end = () => {
    clearTimeout(lp);
    if (st && st.moved) {
      el.classList.remove('dragging'); nmSavePos();
      nmJustDragged = true; setTimeout(() => { nmJustDragged = false; }, 80);
    }
    st = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('click', () => {
    if (nmJustDragged || el.dataset.type !== 'machine') return;
    const dev = (devices || []).find(d => d.id === el.dataset.devId);
    if (dev) nmSelect(dev);
  });
  el.addEventListener('contextmenu', e => {
    if (el.dataset.type !== 'machine' && !nmPos[el.dataset.mapId]) return;
    e.preventDefault(); nmOpenMenu(el, e.clientX, e.clientY);
  });
}

function nmEnsureNode(id, type, devId){
  let n = nmNodes.get(id);
  if (n) return n.el;
  const el = document.createElement('div');
  el.className = 'network-node nm-' + type + ((type === 'center' || type === 'router') ? ' wide' : '');
  el.dataset.mapId = id; el.dataset.type = type;
  if (devId) el.dataset.devId = devId;
  el.innerHTML = NM_TPL[type];
  if (type === 'ghost') {
    el.querySelector('.nm-add').addEventListener('click', () => { addDevice(el.dataset.host, el.dataset.ip); });
  }
  nmBindNode(el);
  $('networkMapNodes').appendChild(el);
  nmNodes.set(id, { el, type });
  return el;
}
function nmEnsureEdge(key, from, to, cls){
  let e = nmEdges.get(key);
  if (!e) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    $('networkMapSvg').appendChild(el);
    e = { el, from, to };
    nmEdges.set(key, e);
  }
  e.from = from; e.to = to;
  const c = 'nm-edge ' + cls;
  if (e.el.getAttribute('class') !== c) e.el.setAttribute('class', c);
}
function nmSetAccent(el, color){
  el.classList.add('acc');
  if (el.style.getPropertyValue('--nm-accent') !== color) el.style.setProperty('--nm-accent', color);
}

function nmScheduleRender(){
  if (nmRenderRaf) return;
  nmRenderRaf = requestAnimationFrame(() => { nmRenderRaf = 0; renderNetworkMap(); });
}
function nmOnBlocks(){ if (networkMapAuto) nmScheduleRender(); }

function renderNetworkMap(){
  const wrap = $('networkMapWrap'), nodesEl = $('networkMapNodes'), svg = $('networkMapSvg');
  if (!wrap || !nodesEl || !svg) return;
  const countEl = $('networkMapCount'), footL = $('networkMapFootLeft'), footR = $('networkMapFootRight');
  const list = Array.isArray(devices) ? devices : [];
  const onlineList = list.filter(d => readings[d.id] && readings[d.id].online);
  if (countEl) countEl.textContent = list.length + ' dispositivo' + (list.length === 1 ? '' : 's') + ' · ' + onlineList.length + ' online';

  const legend = $('networkMapLegend');
  if (legend) {
    const lg = NM_LEGENDS[networkMapMode] || NM_LEGENDS.status;
    const sig = networkMapMode;
    if (legend.dataset.sig !== sig) {
      legend.dataset.sig = sig;
      legend.innerHTML = lg.map(([c, l]) => '<span><i class="network-map-dot" style="background:' + c + ';box-shadow:0 0 7px ' + c + '"></i> ' + l + '</span>').join('');
    }
  }
  const modeSel = $('networkMapMode');
  if (modeSel && modeSel.value !== networkMapMode) modeSel.value = networkMapMode;

  if (!list.length) {
    nmNodes.clear(); nmEdges.clear(); svg.innerHTML = '';
    nodesEl.innerHTML = '<div class="network-map-empty">Nenhuma máquina registada.<br>Adiciona máquinas para construir o mapa da rede.</div>';
    wrap.style.height = ''; wrap.style.minHeight = '';
    if (footL) footL.textContent = 'Sem dispositivos.';
    if (footR) footR.textContent = '—';
    return;
  }
  const emptyMsg = nodesEl.querySelector('.network-map-empty'); if (emptyMsg) emptyMsg.remove();
  const W = wrap.clientWidth;
  if (W < 80) return;   // separador escondido: o ResizeObserver volta a chamar quando aparecer

  const now = Date.now();
  list.forEach(d => { if (readings[d.id] && readings[d.id].online) nmLastSeen[d.id] = now; });
  const links = {};
  list.forEach(d => { links[d.id] = nmLink(readings[d.id]); });

  // Pools (só máquinas online com pool conhecida)
  const poolsMap = new Map();
  list.forEach(d => {
    const r = readings[d.id];
    if (!r || !r.online || !r.pool) return;
    const k = String(r.pool);
    if (!poolsMap.has(k)) poolsMap.set(k, { key: k, devs: [], pings: [], fb: false });
    const p = poolsMap.get(k);
    p.devs.push(d);
    if (r.poolPing != null && isFinite(r.poolPing)) p.pings.push(Number(r.poolPing));
    if (r.poolInfo && r.poolInfo.usingFallback) p.fb = true;
  });
  const pools = [...poolsMap.values()].slice(0, 8);
  const poolKeyOf = d => { const r = readings[d.id]; return (r && r.online && r.pool) ? String(r.pool) : null; };

  // Dispositivos descobertos no scan e ainda não adicionados
  const known = new Set(list.map(d => d.ip));
  const ghosts = nmSafe(() => scanResultsCache.filter(x => x && x.ip && !known.has(x.ip)).slice(0, 6), []);

  const tip = nmSafe(() => (lastFetchedBlocks && lastFetchedBlocks[0]) || null, null);
  const nextFee = nmSafe(() => mempoolBlocksData && mempoolBlocksData[0] && mempoolBlocksData[0].medianFee, null);

  // Eficiência relativa (menor J/TH = melhor) para o modo de cor "eficiência"
  const effGroups = {};
  onlineList.forEach(d => {
    const r = readings[d.id], v = Number(r.efficiency);
    if (!(v > 0)) return;
    const g = (r.type === 'gpu_rig' ? 'gpu:' : '') + (r.algorithm || 'sha256');
    (effGroups[g] = effGroups[g] || []).push({ id: d.id, v });
  });
  const effRank = {};
  Object.values(effGroups).forEach(arr => {
    arr.sort((a, b) => a.v - b.v);
    arr.forEach((x, i) => { effRank[x.id] = arr.length > 1 ? i / (arr.length - 1) : 0; });
  });
  const hasSha = list.some(d => nmIsSha(readings[d.id]));

  const L = nmLayout(W, list, pools, ghosts);
  wrap.classList.toggle('nm-cols', !!L.cols);
  const H = L.H;
  wrap.style.minHeight = '0';
  wrap.style.height = H + 'px';
  const place = (id, el) => {
    const c = nmPos[id] || { x: L.pos[id].x, y: L.pos[id].y / H };
    el.style.left = (c.x * 100) + '%';
    el.style.top = (c.y * 100) + '%';
  };

  const wanted = new Set();
  const useNode = (id, type, devId) => { wanted.add(id); const el = nmEnsureNode(id, type, devId); place(id, el); return el; };

  // Centro
  {
    const el = useNode('center', 'center');
    const totalPow = onlineList.reduce((a, d) => a + (readings[d.id].power || 0), 0);
    const tot = nmAlgoTotals(onlineList);
    nmSet(el, 'n', list.length); nmSet(el, 'on', onlineList.length + '/' + list.length);
    nmSet(el, 'hash', tot.text);
    el.title = tot.title;
    nmSet(el, 'pow', totalPow > 0 ? Math.round(totalPow) + ' W' : '—');
    nmSetAccent(el, 'var(--cyan)');
  }

  // Router / Wi-Fi (agregado das ligações das máquinas online)
  {
    const el = useNode('router', 'router');
    const lats = onlineList.map(d => links[d.id].lat).filter(v => v != null);
    const rssis = onlineList.map(d => links[d.id].rssi).filter(v => v != null);
    const order = { good: 0, ok: 1, bad: 2 };
    let worstQ = 'none', worstName = '—';
    onlineList.forEach(d => {
      const q = links[d.id].q;
      if (q !== 'none' && (worstQ === 'none' || order[q] > order[worstQ])) { worstQ = q; worstName = d.name || d.ip || '—'; }
    });
    const qTxt = { good: 'Boa', ok: 'Razoável', bad: 'Fraca', none: '—' };
    nmSet(el, 'conn', onlineList.length + '/' + list.length);
    nmSet(el, 'lat', lats.length ? nmMs(lats.reduce((a, b) => a + b, 0) / lats.length) : '—');
    nmSet(el, 'rssi', rssis.length ? Math.round(rssis.reduce((a, b) => a + b, 0) / rssis.length) + ' dBm' : '—');
    nmSet(el, 'worst', worstQ === 'none' ? '—' : qTxt[worstQ]);
    el.title = worstQ === 'none' ? 'Sem dados de ligação' : 'Pior ligação: ' + worstName + ' (' + qTxt[worstQ] + ')';
    const dot = el.querySelector('[data-f="dot"]');
    if (dot) { dot.classList.toggle('online', onlineList.length > 0); dot.classList.toggle('offline', onlineList.length === 0); }
    nmSetAccent(el, onlineList.length ? NM_COL[worstQ] : 'var(--red)');
  }

  // Máquinas
  list.forEach(d => {
    const r = readings[d.id] || {};
    const on = !!r.online;
    const el = useNode('m:' + d.id, 'machine', d.id);
    const lk = links[d.id];
    const fb = on && r.poolInfo && r.poolInfo.usingFallback;
    nmSet(el, 'name', d.name || d.ip || 'Máquina');
    let meta = d.ip || '—';
    if (on && fb) meta += ' · ⚠ pool de reserva';
    if (!on) meta += nmLastSeen[d.id] ? ' · offline ' + nmAgo(nmLastSeen[d.id]) : ' · sem resposta';
    nmSet(el, 'meta', meta);
    const hr = on && r.hashrate != null ? formatHashrate(r.hashrate) : null;
    const hrTxt = on ? (r.hashrate_display || (hr ? hr.value + ' ' + hr.unit : '—')) : '—';
    nmSet(el, 'hash', hrTxt);
    nmSet(el, 'temp', on && r.temp != null && isFinite(r.temp) ? Number(r.temp).toFixed(1) + '°C' : '—');
    nmSet(el, 'link', on ? lk.text : '—');
    nmSet(el, 'ping', on && r.poolPing != null && isFinite(r.poolPing) ? Math.round(r.poolPing) + ' ms' : '—');
    const dot = el.querySelector('[data-f="dot"]');
    if (dot) { dot.classList.toggle('online', on); dot.classList.toggle('offline', !on); }
    el.classList.toggle('offline', !on);
    el.classList.toggle('selected', selectedId === d.id);
    nmSetAccent(el, nmAccent(networkMapMode, r, lk, effRank[d.id]));
    el.title = [d.name, d.ip, on ? hrTxt : 'offline', on && r.temp != null ? 'Temp ' + Number(r.temp).toFixed(1) + '°C' : '',
      on && r.efficiency && nmIsSha(r) ? Number(r.efficiency).toFixed(1) + ' J/TH' : '', on && r.power ? Math.round(r.power) + ' W' : '', r.firmware || '',
      r.pool || '', on ? 'Ligação: ' + lk.text : ''].filter(Boolean).join('\n');
    el.dataset.ip = d.ip || '';
  });

  // Pools
  pools.forEach(p => {
    const id = 'p:' + p.key;
    const el = useNode(id, 'pool');
    nmSet(el, 'name', '🔌 ' + p.key.replace(/^[a-z+]+:\/\//i, ''));
    nmSet(el, 'meta', p.fb ? '⚠ reserva em uso' : 'Pool ativa');
    nmSet(el, 'n', p.devs.length);
    nmSet(el, 'ping', p.pings.length ? nmMs(p.pings.reduce((a, b) => a + b, 0) / p.pings.length) : '—');
    nmSetAccent(el, p.fb ? 'var(--amber)' : 'var(--cyan)');
    el.title = p.key;
  });

  // Rede Bitcoin (só faz sentido se houver máquinas SHA-256)
  if (hasSha) {
    const el = useNode('net', 'net');
    nmSet(el, 'meta', tip ? '#' + tip.height + ' · ' + timeAgoPt(tip.timestamp) : 'a aguardar blocos…');
    nmSet(el, 'h', tip ? tip.height : '—');
    nmSet(el, 'fee', nextFee != null ? '~' + mpNum(nextFee) + ' sat/vB' : '—');
    nmSetAccent(el, 'var(--amber)');
  }

  // Descobertos no scan
  ghosts.forEach(g => {
    const el = useNode('g:' + g.ip, 'ghost');
    const host = g.hostname || g.ip;
    el.dataset.host = host; el.dataset.ip = g.ip;
    nmSet(el, 'name', '➕ ' + host);
    nmSet(el, 'meta', g.ip + ' · descoberto no scan');
    nmSetAccent(el, 'var(--muted)');
  });

  // Remove nós que já não existem
  nmNodes.forEach((n, id) => { if (!wanted.has(id)) { n.el.remove(); nmNodes.delete(id); } });

  // Ligações
  const wantedE = new Set();
  const useEdge = (key, from, to, cls) => { wantedE.add(key); nmEnsureEdge(key, from, to, cls); };
  useEdge('center>router', 'center', 'router', 'lan' + (onlineList.length ? ' q-good' : ' off'));
  list.forEach(d => {
    const on = !!(readings[d.id] && readings[d.id].online);
    useEdge('router>m:' + d.id, 'router', 'm:' + d.id, on ? 'lan q-' + links[d.id].q : 'lan off');
  });
  pools.forEach(p => {
    p.devs.forEach(d => {
      const fbd = readings[d.id].poolInfo && readings[d.id].poolInfo.usingFallback;
      useEdge('m:' + d.id + '>p:' + p.key, 'm:' + d.id, 'p:' + p.key, 'pool' + (fbd ? ' fb' : ''));
    });
    if (p.devs.some(d => nmIsSha(readings[d.id]))) useEdge('p:' + p.key + '>net', 'p:' + p.key, 'net', 'netlink');
  });
  nmEdges.forEach((e, key) => { if (!wantedE.has(key)) { e.el.remove(); nmEdges.delete(key); } });
  nmUpdateEdgeGeometry();

  // Pulsos: share aceite -> pool; bloco novo -> rede
  if (!nmReduced() && !document.hidden && wrap.offsetParent !== null) {
    list.forEach(d => {
      const r = readings[d.id], k = poolKeyOf(d);
      if (!r || !r.online || !k) return;
      const prev = nmLastAccepted[d.id];
      if (prev != null && r.accepted > prev) {
        const n = Math.min(3, r.accepted - prev);
        for (let i = 0; i < n; i++) setTimeout(() => nmPulse('m:' + d.id + '>p:' + k, 'var(--cyan)', false, 1000), i * 260);
      }
    });
    if (tip && nmLastBlockHeight != null && tip.height !== nmLastBlockHeight) {
      pools.forEach(p => nmPulse('p:' + p.key + '>net', 'var(--amber)', false, 1500));
      const netEl = nmNodes.get('net');
      if (netEl) { netEl.el.classList.remove('nm-flash'); void netEl.el.offsetWidth; netEl.el.classList.add('nm-flash'); setTimeout(() => netEl.el.classList.remove('nm-flash'), 1700); }
    }
  }
  list.forEach(d => { const r = readings[d.id]; if (r && r.online) nmLastAccepted[d.id] = r.accepted; });
  if (tip) nmLastBlockHeight = tip.height;

  if (footL) footL.textContent = onlineList.length + '/' + list.length + ' online · arrasta os nós para reorganizar · clique direito (ou toque longo) para ações.';
  if (footR) footR.textContent = (pools.length ? pools.length + ' pool' + (pools.length === 1 ? '' : 's') + ' detetada' + (pools.length === 1 ? '' : 's') : 'Pool não identificada') + (tip ? ' · bloco #' + tip.height : '');
}

function initNetworkMap(){
  $('networkMapRefreshBtn')?.addEventListener('click', renderNetworkMap);
  $('networkMapAutoBtn')?.addEventListener('click', () => {
    networkMapAuto = !networkMapAuto;
    $('networkMapAutoBtn').classList.toggle('active', networkMapAuto);
    if (networkMapAuto) renderNetworkMap();
  });
  $('networkMapResetBtn')?.addEventListener('click', () => { nmPos = {}; nmSavePos(); renderNetworkMap(); });
  const sel = $('networkMapMode');
  if (sel) {
    sel.value = networkMapMode;
    sel.addEventListener('change', () => {
      networkMapMode = sel.value;
      try { localStorage.setItem(NM_MODE_KEY, networkMapMode); } catch(e) {}
      renderNetworkMap();
    });
  }
  if (window.ResizeObserver) {
    const wrap = $('networkMapWrap');
    if (wrap) { networkMapResizeObserver = new ResizeObserver(() => { if (networkMapAuto) nmScheduleRender(); }); networkMapResizeObserver.observe(wrap); }
  } else window.addEventListener('resize', () => { if (networkMapAuto) nmScheduleRender(); });
  document.addEventListener('click', e => { if (nmMenuEl && !nmMenuEl.contains(e.target)) nmCloseMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') nmCloseMenu(); });
}

// --- Ações rápidas -------------------------------------------------------
function setQuickActionStatus(msg){ const el=$('quickActionStatus'); if(el) el.textContent=msg; }
async function quickRefreshAll(){
  setQuickActionStatus('A atualizar dados…');
  await Promise.allSettled([pollAll(),pollPowerStatus(),fetchRecentBlocks()]);
  renderAll(); setQuickActionStatus('✓ Dados atualizados.');
}
function findQuickProfile(name){
  const n=aiNormalize(name);
  return (powerProfiles||[]).find(p=>aiNormalize(p?.name||'')===n) || (powerProfiles||[]).find(p=>aiNormalize(p?.name||'').includes(n)) || null;
}
// Cada botão (Eco/Turbo) tem um perfil escolhido e guardado por ti (localStorage).
// Se ainda não há perfil, o clique abre a janela para escolher/criar um.
const QUICK_PROFILE_KEY = 'quickProfiles_v1';
const QUICK_SLOT_META = { eco: { label: 'Eco', icon: '🌿', btn: 'quickEcoBtn', edit: 'quickEcoEdit' }, turbo: { label: 'Turbo', icon: '🚀', btn: 'quickTurboBtn', edit: 'quickTurboEdit' } };
let quickPickerSlot = null;
let qpListCache = [];

function qpEsc(v){ return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
function loadQuickProfiles(){ try{ return JSON.parse(localStorage.getItem(QUICK_PROFILE_KEY) || '{}') || {}; }catch(e){ return {}; } }
function saveQuickProfiles(o){ try{ localStorage.setItem(QUICK_PROFILE_KEY, JSON.stringify(o)); }catch(e){} }
function qpHasValue(x){ return x !== '' && x != null && Number(x) > 0; }
function qpHasValues(p){ return !!p && (qpHasValue(p.frequency) || qpHasValue(p.coreVoltage)); }
function qpDescribe(p){
  const a = [];
  if(qpHasValue(p.frequency)) a.push(`${p.frequency} MHz`);
  if(qpHasValue(p.coreVoltage)) a.push(`${p.coreVoltage} mV`);
  return a.join(' / ') || '—';
}
function getQuickSlot(slot){
  const p = loadQuickProfiles()[slot];
  if(!p) return null;
  if(p.source === 'power'){
    // perfil escolhido da lista de Perfis de Energia: segue as alterações feitas lá
    const live = (powerProfiles || []).find(x => x && x.name === p.name && qpHasValues(x));
    if(live) return { ...p, frequency: live.frequency, coreVoltage: live.coreVoltage };
  }
  return qpHasValues(p) ? p : null;
}
function updateQuickButtons(){
  Object.keys(QUICK_SLOT_META).forEach(slot => {
    const m = QUICK_SLOT_META[slot];
    const btn = $(m.btn), ed = $(m.edit);
    const p = getQuickSlot(slot);
    if(btn){
      btn.classList.toggle('qp-unset', !p);
      btn.title = p ? `${p.name} — ${qpDescribe(p)} (aplica a todas as máquinas)` : 'Ainda sem perfil: clica para escolher';
    }
    if(ed) ed.title = `Escolher / alterar o perfil ${m.label}`;
  });
}

async function quickApplyProfileToAll(slot){
  const profile = getQuickSlot(slot);
  if(!profile){ openQuickProfilePicker(slot); return; }
  if(!devices.length){ setQuickActionStatus('Nenhuma máquina registada.'); return; }
  setQuickActionStatus(`A aplicar "${profile.name}"…`);
  let ok = 0;
  for(const dev of devices){ const res = await aiApplyProfile(profile, dev); if(res.ok) ok++; }
  setQuickActionStatus(`✓ "${profile.name}": ${ok}/${devices.length} aplicadas.`);
  renderAll();
}

async function openQuickProfilePicker(slot){
  if(!QUICK_SLOT_META[slot]) return;
  quickPickerSlot = slot;
  if(!powerConfigLoaded){ try{ await loadPowerConfig(); }catch(e){} }
  renderQuickProfilePicker();
  $('quickProfileOverlay').classList.add('open');
}
function closeQuickProfilePicker(){
  $('quickProfileOverlay').classList.remove('open');
  quickPickerSlot = null;
}
function renderQuickProfilePicker(){
  const slot = quickPickerSlot; if(!slot) return;
  const meta = QUICK_SLOT_META[slot];
  const cur = getQuickSlot(slot);
  $('qpTitle').textContent = `${meta.icon} Perfil ${meta.label} · todas`;
  qpListCache = (powerProfiles || []).filter(p => p && p.name);
  $('qpList').innerHTML = qpListCache.length
    ? qpListCache.map((p, i) => {
        const ok = qpHasValues(p);
        const sel = !!cur && cur.name === p.name;
        return `<button class="qp-row${sel ? ' selected' : ''}" data-idx="${i}" ${ok ? '' : 'disabled'}>
          <span class="qp-name">${qpEsc(p.name)}</span>
          <span class="qp-vals">${ok ? qpEsc(qpDescribe(p)) : 'sem frequência/voltagem'}</span>
          <span class="qp-pick">${sel ? '✓ em uso' : 'Escolher'}</span>
        </button>`;
      }).join('')
    : '<div class="hint">Ainda não tens perfis em "Perfis de Energia". Cria um novo aqui em baixo.</div>';
  const custom = cur && cur.source === 'custom' ? cur : null;
  $('qpName').value = custom ? custom.name : meta.label;
  $('qpFreq').value = custom && qpHasValue(custom.frequency) ? custom.frequency : '';
  $('qpVolt').value = custom && qpHasValue(custom.coreVoltage) ? custom.coreVoltage : '';
  $('qpError').textContent = '';
}
function qpAssign(profile){
  const slot = quickPickerSlot; if(!slot) return;
  const meta = QUICK_SLOT_META[slot];
  const all = loadQuickProfiles();
  all[slot] = profile;
  saveQuickProfiles(all);
  closeQuickProfilePicker();
  updateQuickButtons();
  setQuickActionStatus(`✓ ${meta.label}: "${profile.name}" (${qpDescribe(profile)}) guardado. Clica no botão para aplicar a todas.`);
  logEvent(`Perfil rápido ${meta.label} guardado: "${profile.name}" (${qpDescribe(profile)}).`, 'new', 'Sistema', 'sys');
}
function qpReadForm(){
  const slot = quickPickerSlot; if(!slot) return null;
  const err = $('qpError');
  const name = $('qpName').value.trim() || QUICK_SLOT_META[slot].label;
  const fRaw = $('qpFreq').value.trim(), vRaw = $('qpVolt').value.trim();
  const f = fRaw === '' ? '' : Number(fRaw), v = vRaw === '' ? '' : Number(vRaw);
  if(f === '' && v === ''){ err.textContent = 'Indica a frequência e/ou a voltagem.'; return null; }
  if(f !== '' && !(f >= 100 && f <= 1500)){ err.textContent = 'Frequência fora do intervalo (100–1500 MHz).'; return null; }
  if(v !== '' && !(v >= 600 && v <= 1500)){ err.textContent = 'CoreVoltage fora do intervalo (600–1500 mV).'; return null; }
  err.textContent = '';
  return { name, frequency: f, coreVoltage: v, source: 'custom' };
}
function initQuickProfilePicker(){
  $('qpCloseBtn')?.addEventListener('click', closeQuickProfilePicker);
  $('quickProfileOverlay')?.addEventListener('click', e => { if(e.target === $('quickProfileOverlay')) closeQuickProfilePicker(); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && quickPickerSlot) closeQuickProfilePicker(); });
  $('qpList')?.addEventListener('click', e => {
    const row = e.target.closest('.qp-row');
    if(!row || row.disabled) return;
    const p = qpListCache[Number(row.dataset.idx)];
    if(!p) return;
    qpAssign({ name: p.name, frequency: p.frequency ?? '', coreVoltage: p.coreVoltage ?? '', source: 'power' });
  });
  $('qpSaveBtn')?.addEventListener('click', () => { const prof = qpReadForm(); if(prof) qpAssign(prof); });
  $('qpSaveApplyBtn')?.addEventListener('click', () => {
    const slot = quickPickerSlot;
    const prof = qpReadForm(); if(!prof) return;
    if(!devices.length){ $('qpError').textContent = 'Nenhuma máquina registada para aplicar.'; return; }
    if(!confirm(`Aplicar "${prof.name}" (${qpDescribe(prof)}) às ${devices.length} máquinas agora?`)) return;
    qpAssign(prof);
    quickApplyProfileToAll(slot);
  });
  $('qpClearBtn')?.addEventListener('click', () => {
    const slot = quickPickerSlot; if(!slot) return;
    const all = loadQuickProfiles(); delete all[slot]; saveQuickProfiles(all);
    closeQuickProfilePicker(); updateQuickButtons();
    setQuickActionStatus(`Perfil ${QUICK_SLOT_META[slot].label} removido.`);
  });
  Object.keys(QUICK_SLOT_META).forEach(slot => $(QUICK_SLOT_META[slot].edit)?.addEventListener('click', () => openQuickProfilePicker(slot)));
  updateQuickButtons();
}
async function quickRestartAll(){
  if(!devices.length){setQuickActionStatus('Nenhuma máquina registada.');return;}
  if(!confirm(`Reiniciar as ${devices.length} máquinas? A mineração será interrompida temporariamente.`)) return;
  setQuickActionStatus('A reiniciar máquinas…');
  let ok=0;
  for(const dev of devices){const res=await aiRestartDevice(dev);if(res.ok)ok++;}
  setQuickActionStatus(`✓ Reinícios enviados: ${ok}/${devices.length}.`);
  renderAll();
}
function initQuickActions(){
  $('quickRefreshBtn')?.addEventListener('click',quickRefreshAll);
  $('quickScanBtn')?.addEventListener('click',()=>openScanModal(false));
  $('quickOcBtn')?.addEventListener('click',()=>{const btn=document.querySelector('.tab-btn[onclick*="\'oc\'"]');if(btn)switchTab('oc',btn);});
  $('quickEcoBtn')?.addEventListener('click',()=>quickApplyProfileToAll('eco'));
  $('quickTurboBtn')?.addEventListener('click',()=>quickApplyProfileToAll('turbo'));
  $('quickRestartBtn')?.addEventListener('click',quickRestartAll);
  initQuickProfilePicker();
}


$('scanBtn').onclick = () => openScanModal(false);
$('scanModalCloseBtn').onclick = closeScanModal;
$('scanRescanBtn').onclick = () => {
  // aceita que a pessoa escreva "192.168.25", "192.168.25.0" ou
  // "192.168.25.0/24" - normaliza tudo para o formato "192.168.25" que
  // o backend espera (só os 3 primeiros números, sem barra nem 4º número)
  const raw = $('scanSubnetInput').value.trim().replace(/\/\d+$/, '');
  const parts = raw.split('.').filter(p => p !== '');
  const cleaned = (parts.length > 3 ? parts.slice(0, 3) : parts).join('.');
  $('scanSubnetInput').value = cleaned;
  runNetworkScan();
};
$('scanSubnetInput').addEventListener('keydown', (e) => {
  if(e.key === 'Enter') { e.preventDefault(); $('scanRescanBtn').click(); }
});
$('scanModalOverlay').addEventListener('click', (e) => {
  if(e.target === $('scanModalOverlay')) closeScanModal();
});

$('ratesRefreshBtn').onclick = () => fetchRates(true);

$('clearLogBtn').onclick = () => { 
  $('eventLog').innerHTML = ''; 
  logEvent('Log limpo.', '', 'Sistema', 'sys');
};

// --- Holofote que segue o rato pelo painel principal + ripple nos botões
// --- para o painel parecer mais reativo ao toque/rato. --------------------
(function(){
  const frameEl = document.querySelector('.frame');
  if(frameEl){
    frameEl.addEventListener('mousemove', (e) => {
      const r = frameEl.getBoundingClientRect();
      frameEl.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      frameEl.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    }, { passive: true });
  }

  const RIPPLE_SELECTOR = 'button, .tab-btn, .scan-device-add-btn, .btc-unit-btn';
  document.addEventListener('click', (e) => {
    const btn = e.target.closest ? e.target.closest(RIPPLE_SELECTOR) : null;
    if(!btn) return;
    const cs = getComputedStyle(btn);
    if(cs.position === 'static') btn.style.position = 'relative';
    const prevOverflow = btn.style.overflow;
    btn.style.overflow = 'hidden';
    const r = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(r.width, r.height) * 1.4;
    ripple.className = 'ui-ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - r.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - r.top - size / 2) + 'px';
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => {
      ripple.remove();
      btn.style.overflow = prevOverflow;
    });
  });
})();

