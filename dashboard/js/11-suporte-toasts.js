// --- Aba de Suporte -----------------------------------------------------
const GITHUB_REPO_URL = 'https://github.com/bladept696/centro-de-comando-v3';

function buildDiagnosticInfo() {
  const lines = [
    `Versão: v${appVersion || '—'}`,
    `Idioma: ${currentLang}`,
    `Tema: ${document.body.dataset.theme || 'default'}`,
    `Máquinas registadas: ${devices.length}`,
    `Navegador: ${navigator.userAgent}`,
    `Plataforma: ${navigator.platform || '—'}`,
    `Resolução: ${window.screen.width}x${window.screen.height}`,
    `URL: ${window.location.href}`,
  ];
  return lines.join('\n');
}

function renderSupportDiagBox() {
  const box = $('supportDiagBox');
  if(box) box.textContent = buildDiagnosticInfo();
}

function copyDiagnosticInfo() {
  const info = buildDiagnosticInfo();
  navigator.clipboard.writeText(info).then(() => {
    alert(t('diagnostico_copiado'));
  }).catch(err => {
    console.error('Erro ao copiar:', err);
  });
}

function reportBugOnGithub() {
  const title = encodeURIComponent('[Bug] ');
  const body = encodeURIComponent(
    `**Descrição do problema:**\n\n\n**Passos para reproduzir:**\n1. \n2. \n3. \n\n**Comportamento esperado:**\n\n\n**Informação de diagnóstico:**\n\`\`\`\n${buildDiagnosticInfo()}\n\`\`\`\n`
  );
  window.open(`${GITHUB_REPO_URL}/issues/new?labels=bug&title=${title}&body=${body}`, '_blank', 'noopener');
}

function suggestFeatureOnGithub() {
  const title = encodeURIComponent('[Sugestão] ');
  const body = encodeURIComponent(
    `**Descrição da funcionalidade:**\n\n\n**Porque seria útil:**\n\n\n**Informação de diagnóstico:**\n\`\`\`\n${buildDiagnosticInfo()}\n\`\`\`\n`
  );
  window.open(`${GITHUB_REPO_URL}/issues/new?labels=enhancement&title=${title}&body=${body}`, '_blank', 'noopener');
}

function goToAssistant() {
  const dashBtn = document.querySelector('.tab-btn[onclick*="dashboard"]');
  if(dashBtn) switchTab('dashboard', dashBtn);
  setTimeout(() => {
    const input = $('aiInput');
    if(input) input.focus();
  }, 100);
}

function bumpBadge(el, val){
  if(!el) return;
  if(el.dataset.prevVal !== String(val)){
    el.classList.remove('badge-pop');
    void el.offsetWidth;
    el.classList.add('badge-pop');
    el.dataset.prevVal = String(val);
  }
}

function updateNotifBadge() {
  const badge = $('notifBadge');
  const mini = $('notifBadgeMini');
  if(unreadNotifs > 0) {
    if(badge){ badge.textContent = unreadNotifs; badge.style.display = 'inline-block'; bumpBadge(badge, unreadNotifs); }
    if(mini){ mini.textContent = unreadNotifs; mini.style.display = 'inline-block'; bumpBadge(mini, unreadNotifs); }
  } else {
    if(badge) badge.style.display = 'none';
    if(mini) mini.style.display = 'none';
  }
}

// --- Celebração especial: bloco encontrado ----------------------------
const BLOCK_CONFETTI_COLORS = ['#ffb020', '#21ffb0', '#4fd6ff', '#ff5d5d', '#ffffff'];

function celebrateBlockFound(machineName, diffVal) {
  const overlay = $('blockCelebration');
  const layer = $('blockConfettiLayer');
  const machineLabel = $('blockCelebrationMachine');
  if(!overlay || !layer) return;

  window._lastBlockShare = { machineName: machineName || 'Máquina', diff: Number(diffVal) || 0, date: new Date() };

  if(machineLabel) machineLabel.textContent = machineName ? `${machineName} — bloco minerado com sucesso!` : 'Bloco minerado com sucesso!';

  layer.innerHTML = '';
  const pieceCount = 130;
  for(let i = 0; i < pieceCount; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const left = Math.random() * 100;
    const delay = Math.random() * 0.9;
    const duration = 2.6 + Math.random() * 1.8;
    const drift = (Math.random() * 220 - 110) + 'px';
    const spin = (360 + Math.random() * 720) + 'deg';
    const color = BLOCK_CONFETTI_COLORS[Math.floor(Math.random() * BLOCK_CONFETTI_COLORS.length)];
    piece.style.left = left + 'vw';
    piece.style.background = color;
    piece.style.setProperty('--drift', drift);
    piece.style.setProperty('--spin', spin);
    piece.style.animationDelay = delay + 's';
    piece.style.animationDuration = duration + 's';
    if(Math.random() > 0.5) piece.style.borderRadius = '50%';
    layer.appendChild(piece);
  }

  overlay.classList.remove('active');
  // força reflow para poder reiniciar a animação em disparos consecutivos
  void overlay.offsetWidth;
  overlay.classList.add('active');

  clearTimeout(overlay._celebTimer);
  overlay._celebTimer = setTimeout(() => {
    overlay.classList.remove('active');
    layer.innerHTML = '';
  }, 4300);
}

// --- Imagem de partilha (bloco encontrado) -----------------------------
function _blockShareToast(msg) {
  let t = document.querySelector('.block-share-toast');
  if(!t) {
    t = document.createElement('div');
    t.className = 'block-share-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function _wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(' ');
  let line = '';
  const lines = [];
  for(let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' ';
    if(ctx.measureText(test).width > maxWidth && line !== '') {
      lines.push(line.trim());
      line = words[i] + ' ';
    } else {
      line = test;
    }
  }
  lines.push(line.trim());
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return lines.length;
}

function generateBlockShareCanvas(machineName, diffVal, dateObj) {
  const W = 1200, H = 675;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // fundo
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#060d14');
  bg.addColorStop(1, '#0a1620');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // brilho radial
  const glow = ctx.createRadialGradient(W/2, H*0.38, 40, W/2, H*0.38, 620);
  glow.addColorStop(0, 'rgba(255,176,32,0.22)');
  glow.addColorStop(1, 'rgba(255,176,32,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // confetti decorativo
  const confColors = ['#ffb020', '#21ffb0', '#4fd6ff', '#ff5d5d', '#ffffff'];
  for(let i = 0; i < 60; i++) {
    ctx.save();
    const cx = Math.random() * W;
    const cy = Math.random() * H;
    ctx.globalAlpha = 0.15 + Math.random() * 0.25;
    ctx.fillStyle = confColors[Math.floor(Math.random() * confColors.length)];
    ctx.translate(cx, cy);
    ctx.rotate(Math.random() * Math.PI);
    ctx.fillRect(-4, -7, 8, 14);
    ctx.restore();
  }

  // moldura
  ctx.strokeStyle = 'rgba(255,176,32,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  // emoji / foguete
  ctx.textAlign = 'center';
  ctx.font = '80px sans-serif';
  ctx.fillText('🚀', W/2, 160);

  // titulo
  ctx.fillStyle = '#ffb020';
  ctx.font = "700 56px 'Space Grotesk', sans-serif";
  ctx.shadowColor = 'rgba(255,176,32,0.6)';
  ctx.shadowBlur = 22;
  ctx.fillText('BLOCO ENCONTRADO!', W/2, 245);
  ctx.shadowBlur = 0;

  // nome da máquina
  ctx.fillStyle = '#eaf6f7';
  ctx.font = "600 30px 'Space Grotesk', sans-serif";
  _wrapCanvasText(ctx, machineName || 'Máquina', W/2, 305, W - 160, 38);

  // caixa best diff
  const boxY = 370, boxH = 150, boxW = 640, boxX = (W - boxW) / 2;
  ctx.fillStyle = 'rgba(13,26,38,0.9)';
  ctx.strokeStyle = 'rgba(33,255,176,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(boxX, boxY, boxW, boxH, 16) : ctx.rect(boxX, boxY, boxW, boxH);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#6f95a3';
  ctx.font = "600 14px 'Space Grotesk', sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText('BEST DIFF DA SESSÃO', W/2, boxY + 34);

  const fmt = (typeof formatDiff === 'function') ? formatDiff(diffVal) : { value: diffVal, unit: '' };
  ctx.fillStyle = '#21ffb0';
  ctx.font = "700 52px 'Space Grotesk', sans-serif";
  ctx.shadowColor = 'rgba(33,255,176,0.5)';
  ctx.shadowBlur = 16;
  ctx.fillText(`${fmt.value}${fmt.unit}`, W/2, boxY + 100);
  ctx.shadowBlur = 0;

  // data
  const dstr = (dateObj instanceof Date ? dateObj : new Date(dateObj || Date.now()))
    .toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  ctx.fillStyle = '#6f95a3';
  ctx.font = "13px 'Space Grotesk', sans-serif";
  ctx.fillText(dstr, W/2, 570);

  // rodapé / branding
  ctx.fillStyle = '#4fd6ff';
  ctx.font = "600 16px 'Space Grotesk', sans-serif";
  ctx.fillText('⛏️ Hash Commander — Mineração Bitcoin', W/2, 615);

  return canvas;
}

async function _downloadOrShareCanvas(canvas, filenameBase) {
  canvas.toBlob(async (blob) => {
    if(!blob) { _blockShareToast('Falha ao gerar imagem.'); return; }
    const file = new File([blob], `${filenameBase}.png`, { type: 'image/png' });

    if(navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Bloco Encontrado! 🚀',
          text: 'Bloco minerado com sucesso — Hash Commander'
        });
        return;
      } catch(e) {
        // utilizador cancelou ou partilha falhou — cai para download
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    _blockShareToast('📥 Imagem guardada — pronta a partilhar!');
  }, 'image/png');
}

function shareBlockImage(machineName, diffVal, tsOrDate) {
  const canvas = generateBlockShareCanvas(machineName, diffVal, tsOrDate ? new Date(tsOrDate) : new Date());
  const safeName = (machineName || 'bloco').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  _downloadOrShareCanvas(canvas, `bloco-encontrado-${safeName || 'bloco'}`);
}

function shareLastBlockImage() {
  const last = window._lastBlockShare;
  if(!last) { _blockShareToast('Sem dados de bloco recentes.'); return; }
  shareBlockImage(last.machineName, last.diff, last.date);
}

function addNotification(type, title, description, machineName, extra) {
  const item = {
    id: 'notif_' + Math.random().toString(36).slice(2, 9),
    type,
    title,
    description,
    machineName,
    time: nowStamp(),
    dateStr: new Date().toLocaleString('pt-BR'),
    ts: Date.now(),
    ...(extra || {})
  };
  notifications.unshift(item);
  if(notifications.length > 100) notifications.pop();
  saveNotifications();

  playSound(type);
  showToast(item);

  if(!$('tab-notifications').classList.contains('active')) {
    unreadNotifs++;
    updateNotifBadge();
  } else {
    renderNotifications();
  }
}

// --- Toasts (pop-ups no canto do ecrã) -------------------------------------
const TOAST_DURATION_MS = 7000;
const TOAST_STYLES = {
  block:             { itemClass: 'type-block',            icon: '🚀' },
  best:              { itemClass: 'type-best',              icon: '🏆' },
  thermal:           { itemClass: 'type-thermal',            icon: '🧬' },
  'thermal-warning': { itemClass: 'type-thermal-warning',    icon: '🧬' },
  critical:          { itemClass: 'type-critical',           icon: '🛡️' },
  offline:           { itemClass: 'type-offline',             icon: '⚠️' },
  anomaly:           { itemClass: 'type-offline',             icon: '🔧' },
};

function toastsEnabled() {
  try { return localStorage.getItem('nerdqaxe:toasts-enabled') !== 'off'; } catch(e) { return true; }
}

function setToastsEnabled(on) {
  try { localStorage.setItem('nerdqaxe:toasts-enabled', on ? 'on' : 'off'); } catch(e) {}
}

function showToast(item) {
  if(!toastsEnabled()) return;
  const stack = $('toastStack');
  if(!stack) return;

  const style = TOAST_STYLES[item.type] || TOAST_STYLES.best;
  const el = document.createElement('div');
  el.className = `toast-item ${style.itemClass}`;
  el.innerHTML = `
    <div class="toast-icon">${style.icon}</div>
    <div class="toast-body">
      <div class="toast-title">[${item.machineName}] ${item.title}</div>
      <div class="toast-text">${item.description}</div>
    </div>
    <button class="toast-close" onclick="event.stopPropagation(); dismissToast(this.closest('.toast-item'))">✕</button>
    <div class="toast-progress" style="animation-duration:${TOAST_DURATION_MS}ms;"></div>
  `;

  // Clicar no toast leva diretamente à aba de notificações
  el.addEventListener('click', () => {
    dismissToast(el);
    const notifTabBtn = document.querySelector('.tab-btn[onclick*="notifications"]');
    if(notifTabBtn) switchTab('notifications', notifTabBtn);
  });

  stack.appendChild(el);

  // Limita a 4 toasts visíveis ao mesmo tempo, para não tapar o ecrã
  while(stack.children.length > 4) {
    stack.removeChild(stack.firstChild);
  }

  const timer = setTimeout(() => dismissToast(el), TOAST_DURATION_MS);
  el._toastTimer = timer;
}

function dismissToast(el) {
  if(!el || el.classList.contains('leaving')) return;
  if(el._toastTimer) clearTimeout(el._toastTimer);
  el.classList.add('leaving');
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

function updateToastToggleBtn() {
  const btn = $('toastToggleBtn');
  if(!btn) return;
  const on = toastsEnabled();
  btn.textContent = on ? '🔔 Pop-ups: ON' : '🔕 Pop-ups: OFF';
  btn.style.color = on ? 'var(--green)' : 'var(--muted)';
}

function toggleToastSetting() {
  setToastsEnabled(!toastsEnabled());
  updateToastToggleBtn();
}

function triggerTestNotifications() {
  const sampleMachines = devices.length > 0 ? devices : [{ name: 'Máquina Teste 01', id: 'test_m1' }];
  const randomMachine = sampleMachines[Math.floor(Math.random() * sampleMachines.length)];
  
  addNotification('best', 'Novo Recorde de Dificuldade: 45.2M', 'A máquina alcançou um novo best diff de 45,230,100 na sessão de teste.', randomMachine.name);
  setTimeout(() => {
    addNotification('block', 'Bloco Encontrado com Sucesso! (TESTE)', 'Simulação de bloco minerado com sucesso na rede.', randomMachine.name, { diff: 45230100 });
    celebrateBlockFound(randomMachine.name, 45230100);
  }, 600);
  setTimeout(() => {
    addNotification('offline', 'Máquina Offline (TESTE)', `${randomMachine.name} ficou offline (falha de comunicação) - simulação.`, randomMachine.name);
  }, 1300);

  logEvent('Notificações de teste geradas com som.', 'new', randomMachine.name, randomMachine.id || 'sys');
}

function loadNotifications() {
  try {
    const data = localStorage.getItem(NOTIF_KEY);
    if(data) notifications = JSON.parse(data);
  } catch(e) { notifications = []; }
}

function saveNotifications() {
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications)); } catch(e){}
}

function clearNotifications() {
  notifications = [];
  saveNotifications();
  renderNotifications();
}

function renderNotifications() {
  const list = $('notifList');
  if(!list) return;
  if(notifications.length === 0) {
    list.innerHTML = '<div style="text-align:center; color: var(--muted); font-size: 12px; padding: 30px;">Ainda não existem notificações registadas.</div>';
    return;
  }
  
  const NOTIF_STYLES = {
    block:            { itemClass: 'type-block',            tagClass: 'block',            label: '🚀 Bloco Encontrado!' },
    best:             { itemClass: 'type-best',              tagClass: 'best',              label: '🏆 Recorde de Dificuldade' },
    thermal:          { itemClass: 'type-thermal',            tagClass: 'thermal-critical',  label: '🧬 Manutenção Preditiva' },
    'thermal-warning':{ itemClass: 'type-thermal-warning',    tagClass: 'thermal-warning',   label: '🧬 Manutenção Preditiva' },
    critical:         { itemClass: 'type-thermal',            tagClass: 'thermal-critical',  label: '🛡️ Overheating Crítico' },
    anomaly:          { itemClass: 'type-offline',              tagClass: 'offline',           label: '🔧 Anomalia Detetada' },
    offline:          { itemClass: 'type-offline',              tagClass: 'offline',           label: '⚠️ Máquina Offline' },
  };

  list.innerHTML = '';
  notifications.forEach(n => {
    const el = document.createElement('div');
    const style = NOTIF_STYLES[n.type] || NOTIF_STYLES.best;
    el.className = `notif-item ${style.itemClass}`;
    const shareBtnHtml = n.type === 'block'
      ? `<button type="button" class="notif-share-btn" title="Gerar imagem para partilhar" onclick="event.stopPropagation(); shareBlockImage('${(n.machineName||'').replace(/'/g,"\\'")}', ${Number(n.diff)||0}, ${n.ts || Date.now()})">📤</button>`
      : '';
    el.innerHTML = `
      <div class="notif-info">
        <div class="notif-header-line">
          <span class="notif-tag ${style.tagClass}">${style.label}</span>
          <span class="notif-machine">[${n.machineName}]</span>
        </div>
        <div class="notif-text" style="font-weight: 600; color: var(--text);">${n.title}</div>
        <div class="notif-text">${n.description}</div>
      </div>
      <div class="notif-time">${n.dateStr}${shareBtnHtml}</div>
    `;
    list.appendChild(el);
  });
}

function updateLogMachineDropdown() {
  const select = $('logMachineSelect');
  if(!select) return;
  const currentVal = select.value;
  select.innerHTML = '<option value="all">🌐 Todas as Máquinas</option>';
  devices.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `💻 ${d.name} (${d.ip})`;
    select.appendChild(opt);
  });
  select.value = currentVal;
}

function formatNumber(val, units, base = 1000){
  if(val == null || isNaN(val)) return {value:'—', unit:''};
  let v = val;
  let i = 0;
  while(v >= base && i < units.length-1){ v /= base; i++; }
  return { value: v.toFixed(v >= 100 || i === 0 ? 0 : 2), unit: units[i] };
}

function formatHashrate(val){
  if(val == null || isNaN(val)) return {value:'—', unit:''};
  let v = val;
  let unit = 'GH/s';

  if(v >= 1000) {
    v = v / 1000;
    unit = 'TH/s';
  }

  return { value: v.toFixed(2), unit: unit };
}

function formatDiff(diff){
  return formatNumber(diff, ['','K','M','G','T','P'], 1000);
}

function formatUptime(seconds){
  if(seconds == null || isNaN(seconds) || seconds < 0) return { text: '—', cls: '' };
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  let text;
  if(d > 0) text = `${d}d ${h}h ${m}m`;
  else if(h > 0) text = `${h}h ${m}m`;
  else text = `${m}m`;

  let cls = 'highlight-green';
  if(seconds < 600) cls = 'highlight-amber';
  return { text, cls };
}

const DONUT_COLORS = ['#21ffb0', '#4fd6ff', '#ffb020', '#ff5d5d', '#9b6bff', '#ff6b9b', '#6bffda', '#ffd166'];

function renderHashrateDonut(devicesList){
  const row = $('hashrateDonutRow');
  if(!row) return;

  const slices = devicesList
    .map(dev => ({ dev, r: readings[dev.id] }))
    .filter(x => x.r && x.r.online && (x.r.hashrate || 0) > 0);

  if(slices.length === 0){
    row.innerHTML = '<div class="donut-empty">Sem máquinas online.</div>';
    return;
  }

  const total = slices.reduce((s, x) => s + x.r.hashrate, 0);
  const R = 70, CX = 80, CY = 80, STROKE = 22;
  const circumference = 2 * Math.PI * R;

  let offset = 0;
  const arcs = slices.map((x, i) => {
    const pct = x.r.hashrate / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const rotation = (offset / circumference) * 360 - 90;
    offset += dash;
    const colorIdx = devicesList.indexOf(x.dev) % DONUT_COLORS.length;
    const color = DONUT_COLORS[colorIdx];
    return `<circle class="donut-arc" cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${color}"
      stroke-width="${STROKE}" stroke-dasharray="${dash} ${gap}"
      transform="rotate(${rotation} ${CX} ${CY})" stroke-linecap="butt"
      style="color:${color}; --dash:${dash.toFixed(2)}px; animation-delay:${i * 90}ms" />`;
  }).join('');

  const totalFmt = formatHashrate(total);

  const legend = slices
    .sort((a, b) => b.r.hashrate - a.r.hashrate)
    .map(x => {
      const pct = ((x.r.hashrate / total) * 100).toFixed(1);
      const colorIdx = devicesList.indexOf(x.dev) % DONUT_COLORS.length;
      const hf = formatHashrate(x.r.hashrate);
      return `
        <div class="donut-legend-item">
          <span class="donut-legend-swatch" style="background:${DONUT_COLORS[colorIdx]}; color:${DONUT_COLORS[colorIdx]}"></span>
          <span class="donut-legend-name">${x.dev.name}</span>
          <span class="donut-legend-sub">${hf.value} ${hf.unit}</span>
          <span class="donut-legend-pct">${pct}%</span>
        </div>`;
    }).join('');

  row.innerHTML = `
    <div class="donut-svg-wrap">
      <svg viewBox="0 0 160 160"><g class="donut-ring">${arcs}</g></svg>
      <div class="donut-center-label">
        <div class="val">${totalFmt.value}</div>
        <div class="unit">${totalFmt.unit}</div>
      </div>
    </div>
    <div class="donut-legend">${legend}</div>
  `;
}


function getTempRiskClass(temp){
  if(temp == null || isNaN(temp)) return '';
  if(temp >= 75) return 'risk-red';
  if(temp >= 65) return 'risk-amber';
  return 'risk-green';
}

function getLatencyRiskClass(ms){
  if(ms == null || isNaN(ms)) return '';
  if(ms >= 250) return 'risk-red';
  if(ms >= 100) return 'risk-amber';
  return 'risk-green';
}

