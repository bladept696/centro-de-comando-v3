// --- Modo "Matrix" (chuva de código) na consola de logs -------------------
// Efeito visual tipo Matrix sobre a consola, mas em vez de puro ruído
// aleatório, de vez em quando uma coluna "materializa" um dado real (hashrate,
// best diff, shares, nome da máquina) tirado do estado atual das máquinas.
let matrixModeActive = false;
let matrixAnimId = null;
let matrixCols = [];
const MATRIX_FONT_SIZE = 14;
const MATRIX_CHARSET = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ$#@%&*+-/=<>[]{}アイウエオカキクケコサシスセソタチツテト';

function getMatrixRealSnippets(){
  const snippets = [];
  (devices || []).forEach(d => {
    const r = readings[d.id];
    if(!r) return;
    if(r.online){
      const hr = formatHashrate(r.hashrate);
      snippets.push(`${d.name}:${hr.value}${hr.unit}`);
      if(r.best > 0){
        const fmt = formatDiff(r.best);
        snippets.push(`BEST_DIFF:${fmt.value}${fmt.unit}`);
      }
      snippets.push(`ACCEPTED:${r.accepted || 0}`);
      if(r.temp != null) snippets.push(`TEMP:${r.temp.toFixed(1)}C`);
    } else {
      snippets.push(`${d.name}:OFFLINE`);
    }
  });
  if(snippets.length === 0) snippets.push('CENTRO_DE_COMANDO');
  return snippets;
}

function initMatrixCanvas(){
  const canvas = $('matrixCanvas');
  const screenEl = $('consoleScreen');
  if(!canvas || !screenEl) return false;
  const rect = screenEl.getBoundingClientRect();
  if(!rect.width || !rect.height) return false;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#020508';
  ctx.fillRect(0, 0, rect.width, rect.height);

  const colCount = Math.max(1, Math.floor(rect.width / MATRIX_FONT_SIZE));
  matrixCols = Array.from({ length: colCount }, () => ({
    y: Math.random() * rect.height,
    speed: 0.5 + Math.random() * 1.1,
    streamText: null,
    streamIdx: 0
  }));

  // desenha logo um frame cheio de caracteres, para haver feedback visual
  // imediato mesmo que, por algum motivo, o loop de animação seguinte falhe
  try {
    ctx.font = `${MATRIX_FONT_SIZE}px 'JetBrains Mono', monospace`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(33, 255, 176, 0.75)';
    matrixCols.forEach((col, i) => {
      const ch = MATRIX_CHARSET[Math.floor(Math.random() * MATRIX_CHARSET.length)];
      ctx.fillText(ch, i * MATRIX_FONT_SIZE, col.y);
    });
  } catch(e){ console.error('Matrix mode: erro no frame inicial', e); }

  return true;
}

function drawMatrixFrame(){
  if(!matrixModeActive) return;
  try {
    const canvas = $('matrixCanvas');
    if(!canvas){ matrixAnimId = null; return; }
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');

    // rasto semitransparente por cima do frame anterior — dá o efeito de
    // desvanecimento típico do Matrix, sem ter de limpar tudo a cada frame
    ctx.fillStyle = 'rgba(2, 5, 8, 0.14)';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.font = `${MATRIX_FONT_SIZE}px 'JetBrains Mono', monospace`;
    ctx.textBaseline = 'top';

    matrixCols.forEach((col, i) => {
      const x = i * MATRIX_FONT_SIZE;
      let ch;

      if(col.streamText && col.streamIdx < col.streamText.length){
        // a "materializar" um dado real desta mina, carácter a carácter
        ch = col.streamText[col.streamIdx];
        col.streamIdx++;
        ctx.fillStyle = '#eafff2';
        ctx.shadowColor = '#21ffb0';
        ctx.shadowBlur = 6;
      } else {
        if(col.streamText) col.streamText = null;
        ch = MATRIX_CHARSET[Math.floor(Math.random() * MATRIX_CHARSET.length)];
        ctx.fillStyle = 'rgba(33, 255, 176, 0.75)';
        ctx.shadowBlur = 0;
      }

      ctx.fillText(ch, x, col.y);
      ctx.shadowBlur = 0;

      col.y += MATRIX_FONT_SIZE * col.speed * 0.5;

      if(col.y > rect.height && Math.random() > 0.975){
        col.y = Math.random() * -100;
        col.speed = 0.5 + Math.random() * 1.1;
        // ~1 em cada 7 colunas que reinicia passa a "puxar" um dado real
        if(Math.random() < 0.14){
          const pool = getMatrixRealSnippets();
          col.streamText = pool[Math.floor(Math.random() * pool.length)] + '  ';
          col.streamIdx = 0;
        }
      }
    });
  } catch(e){
    console.error('Matrix mode: erro a desenhar frame, a parar animação', e);
    matrixModeActive = false;
    matrixAnimId = null;
    return;
  }

  matrixAnimId = requestAnimationFrame(drawMatrixFrame);
}

function toggleMatrixMode(){
  matrixModeActive = !matrixModeActive;
  const btn = $('matrixModeBtn');
  const canvas = $('matrixCanvas');
  const screenEl = $('consoleScreen');
  if(!btn || !canvas || !screenEl){
    console.error('Matrix mode: elementos em falta no DOM', { btn: !!btn, canvas: !!canvas, screenEl: !!screenEl });
    matrixModeActive = false;
    return;
  }

  if(matrixModeActive){
    btn.classList.add('active');
    canvas.style.display = 'block';
    screenEl.classList.add('matrix-mode');
    const ready = initMatrixCanvas();
    if(!ready){
      // a aba pode ainda não estar totalmente pintada (0×0) no instante do
      // clique — tenta de novo no próximo frame antes de desistir
      requestAnimationFrame(() => {
        if(matrixModeActive) initMatrixCanvas();
        if(matrixAnimId) cancelAnimationFrame(matrixAnimId);
        drawMatrixFrame();
      });
    } else {
      if(matrixAnimId) cancelAnimationFrame(matrixAnimId);
      drawMatrixFrame();
    }
  } else {
    btn.classList.remove('active');
    canvas.style.display = 'none';
    screenEl.classList.remove('matrix-mode');
    if(matrixAnimId){ cancelAnimationFrame(matrixAnimId); matrixAnimId = null; }
    if(autoScroll) screenEl.scrollTop = screenEl.scrollHeight;
  }
}

window.addEventListener('resize', () => { if(matrixModeActive) initMatrixCanvas(); });

// --- Efeito Matrix decorativo, sempre ativo, no rodapé da dashboard -------
// Versão mais lenta e discreta do "Modo Matrix" da consola: menos colunas,
// menos brilho e velocidade bem reduzida, para servir de fundo ambiente
// sem competir com o texto do rodapé (footerAlert / footerStamp).
let footerMatrixCols = [];
let footerMatrixAnimId = null;
let footerMatrixLastTs = 0;
const FOOTER_MATRIX_FONT_SIZE = 12;
const FOOTER_MATRIX_FRAME_INTERVAL = 90; // ms entre frames (a consola usa ~16ms via rAF puro)

function initFooterMatrix(){
  const canvas = $('footerMatrixCanvas');
  const wrap = $('footerBar');
  if(!canvas || !wrap) return false;
  const rect = wrap.getBoundingClientRect();
  if(!rect.width || !rect.height) return false;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0a1620';
  ctx.fillRect(0, 0, rect.width, rect.height);

  const colCount = Math.max(1, Math.floor(rect.width / FOOTER_MATRIX_FONT_SIZE));
  footerMatrixCols = Array.from({ length: colCount }, () => {
    const depth = Math.random();
    return {
      y: Math.random() * rect.height,
      speed: 0.15 + depth * 0.25, // bem mais lento que os 0.5-1.6 da consola
      depth,
      streamText: null,
      streamIdx: 0
    };
  });

  return true;
}

function drawFooterMatrixFrame(ts){
  const canvas = $('footerMatrixCanvas');
  if(!canvas){ footerMatrixAnimId = null; return; }

  if(!footerMatrixLastTs) footerMatrixLastTs = ts;
  if(hcPaused() || ts - footerMatrixLastTs < FOOTER_MATRIX_FRAME_INTERVAL){
    footerMatrixAnimId = requestAnimationFrame(drawFooterMatrixFrame);
    return;
  }
  footerMatrixLastTs = ts;

  try {
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(10, 22, 32, 0.16)';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.font = `${FOOTER_MATRIX_FONT_SIZE}px 'JetBrains Mono', monospace`;
    ctx.textBaseline = 'top';

    footerMatrixCols.forEach((col, i) => {
      const x = i * FOOTER_MATRIX_FONT_SIZE;
      let ch;

      if(col.streamText && col.streamIdx < col.streamText.length){
        ch = col.streamText[col.streamIdx];
        col.streamIdx++;
        ctx.fillStyle = '#eafff2';
        ctx.shadowColor = '#21ffb0';
        ctx.shadowBlur = 5;
      } else {
        if(col.streamText) col.streamText = null;
        ch = MATRIX_CHARSET[Math.floor(Math.random() * MATRIX_CHARSET.length)];
        ctx.fillStyle = `rgba(33, 255, 176, ${(0.28 + col.depth * 0.36).toFixed(2)})`;
        ctx.shadowBlur = 0;
      }

      ctx.fillText(ch, x, col.y);
      ctx.shadowBlur = 0;

      col.y += FOOTER_MATRIX_FONT_SIZE * col.speed;

      if(col.y > rect.height && Math.random() > 0.985){
        col.y = Math.random() * -80;
        col.depth = Math.random();
        col.speed = 0.15 + col.depth * 0.25;
        if(Math.random() < 0.1){
          const pool = getMatrixRealSnippets();
          col.streamText = pool[Math.floor(Math.random() * pool.length)] + '  ';
          col.streamIdx = 0;
        }
      }
    });
  } catch(e){
    console.error('Matrix rodapé: erro a desenhar frame, a parar', e);
    footerMatrixAnimId = null;
    return;
  }

  footerMatrixAnimId = requestAnimationFrame(drawFooterMatrixFrame);
}

function startFooterMatrix(){
  const ready = initFooterMatrix();
  if(footerMatrixAnimId) cancelAnimationFrame(footerMatrixAnimId);
  footerMatrixLastTs = 0;
  if(!ready){
    // o rodapé pode ainda não ter dimensões (0×0) no arranque da página
    requestAnimationFrame(() => {
      if(initFooterMatrix()) footerMatrixAnimId = requestAnimationFrame(drawFooterMatrixFrame);
    });
    return;
  }
  footerMatrixAnimId = requestAnimationFrame(drawFooterMatrixFrame);
}

// (o rodapé já não usa a chuva Matrix: ver hcMiningScene em 19-final.js)

// --- Fundo animado "low-poly" azul/dourado a cobrir toda a .frame (por
// trás de todo o conteúdo) — malha triangulada que "respira" lentamente,
// sombreada por uma luz que roda devagar, com algumas arestas em dourado.
// Substitui o antigo efeito de chuva Matrix, mantendo os mesmos nomes de
// função (initBodyMatrix / drawBodyMatrixFrame / startBodyMatrix) para não
// mexer nos pontos de chamada (resize, ResizeObserver, arranque).
let bodyMatrixAnimId = null;
let bodyMatrixLastTs = 0;
const BODY_POLY_CELL = 110;
let BODY_POLY_BLUE_DARK  = [8, 20, 40];
let BODY_POLY_BLUE_MID   = [18, 60, 110];
let BODY_POLY_BLUE_LIGHT = [40, 120, 170];
let BODY_POLY_GOLD = [212, 175, 90];
// Lê uma cor CSS (#rgb, #rrggbb, #rrggbbaa ou rgb()/rgba()) como [r, g, b]
function bodyPolyParse(c){
  c = String(c || '').trim();
  let m;
  if((m = c.match(/^#([0-9a-f]{3})$/i))) return [...m[1]].map(h => parseInt(h + h, 16));
  if((m = c.match(/^#([0-9a-f]{6})/i))) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  if((m = c.match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i))) return [+m[1], +m[2], +m[3]];
  return null;
}
// Cores dos polígonos a partir do tema atual; o tema Padrão mantém o azul e dourado originais
function bodyPolyApplyTheme(){
  const theme = document.body.dataset.theme || 'default';
  if(theme === 'default'){ BODY_POLY_BLUE_DARK = [8, 20, 40]; BODY_POLY_BLUE_MID = [18, 60, 110]; BODY_POLY_BLUE_LIGHT = [40, 120, 170]; BODY_POLY_GOLD = [212, 175, 90]; return; }
  const cs = getComputedStyle(document.body), v = n => bodyPolyParse(cs.getPropertyValue(n));
  const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
  const bg = v('--bg'), g1 = v('--glow-1'), ls = v('--line-strong'), tx = v('--text'), am = v('--amber');
  if(!bg || !g1 || !ls || !tx || !am) return;
  BODY_POLY_BLUE_DARK = mix(bg, g1, .35);
  BODY_POLY_BLUE_MID = mix(g1, ls, .6);
  BODY_POLY_BLUE_LIGHT = mix(BODY_POLY_BLUE_MID, tx, .22);
  BODY_POLY_GOLD = am;
}
let bodyPolyPoints = [];
let bodyPolyTriangles = [];
let bodyPolyW = 0, bodyPolyH = 0;
let bodyPolyStartTs = null;

function initBodyMatrix(){
  const canvas = $('bodyMatrixCanvas');
  const frame = $('mainFrame');
  if(!canvas || !frame) return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if(!w || !h) return false;

  const dpr = 1;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  bodyPolyW = w; bodyPolyH = h;
  const cols = Math.ceil(w / BODY_POLY_CELL) + 2;
  const rows = Math.ceil(h / BODY_POLY_CELL) + 2;

  bodyPolyPoints = [];
  for (let j = 0; j < rows; j++){
    bodyPolyPoints[j] = [];
    for (let i = 0; i < cols; i++){
      bodyPolyPoints[j][i] = {
        baseX: (i - 0.5) * BODY_POLY_CELL,
        baseY: (j - 0.5) * BODY_POLY_CELL,
        jx: (Math.random() - 0.5) * BODY_POLY_CELL * 0.7,
        jy: (Math.random() - 0.5) * BODY_POLY_CELL * 0.7,
        phase: Math.random() * Math.PI * 2,
        speed: 0.15 + Math.random() * 0.2
      };
    }
  }

  bodyPolyTriangles = [];
  for (let j = 0; j < rows - 1; j++){
    for (let i = 0; i < cols - 1; i++){
      const flip = Math.random() < 0.5;
      if (flip){
        bodyPolyTriangles.push([[j,i],[j,i+1],[j+1,i]]);
        bodyPolyTriangles.push([[j,i+1],[j+1,i+1],[j+1,i]]);
      } else {
        bodyPolyTriangles.push([[j,i],[j,i+1],[j+1,i+1]]);
        bodyPolyTriangles.push([[j,i],[j+1,i+1],[j+1,i]]);
      }
    }
  }

  return true;
}

function bodyPolyLerp(a, b, t){ return a + (b - a) * t; }
function bodyPolyLerpColor(c1, c2, t){
  return [bodyPolyLerp(c1[0],c2[0],t), bodyPolyLerp(c1[1],c2[1],t), bodyPolyLerp(c1[2],c2[2],t)];
}
function bodyPolyPos(t, p){
  const dx = Math.sin(t * p.speed + p.phase) * 6;
  const dy = Math.cos(t * p.speed * 0.8 + p.phase) * 6;
  return { x: p.baseX + p.jx + dx, y: p.baseY + p.jy + dy };
}

function drawBodyMatrixFrame(ts){
  const canvas = $('bodyMatrixCanvas');
  const frame = $('mainFrame');
  if(!canvas || !frame){ bodyMatrixAnimId = null; return; }

  if(!bodyMatrixLastTs) bodyMatrixLastTs = ts;
  if(hcPaused() || ts - bodyMatrixLastTs < 66){
    bodyMatrixAnimId = requestAnimationFrame(drawBodyMatrixFrame);
    return;
  }
  bodyMatrixLastTs = ts;
  if(bodyPolyStartTs == null) bodyPolyStartTs = ts;

  try {
    const ctx = canvas.getContext('2d');
    const w = bodyPolyW, h = bodyPolyH;
    const t = (ts - bodyPolyStartTs) / 1000;

    ctx.clearRect(0, 0, w, h);
    const lightAngle = t * 0.05;
    const lx = Math.cos(lightAngle), ly = Math.sin(lightAngle);

    for (const tri of bodyPolyTriangles){
      const pa = bodyPolyPos(t, bodyPolyPoints[tri[0][0]][tri[0][1]]);
      const pb = bodyPolyPos(t, bodyPolyPoints[tri[1][0]][tri[1][1]]);
      const pc = bodyPolyPos(t, bodyPolyPoints[tri[2][0]][tri[2][1]]);

      const cx = (pa.x + pb.x + pc.x) / 3;
      const cy = (pa.y + pb.y + pc.y) / 3;
      const nx = (cx / w - 0.5) * 2;
      const ny = (cy / h - 0.5) * 2;
      const dot = (nx * lx + ny * ly + 1) / 2;

      const area = Math.abs((pb.x - pa.x)*(pc.y - pa.y) - (pc.x - pa.x)*(pb.y - pa.y));
      const areaFactor = Math.min(1, area / (BODY_POLY_CELL * BODY_POLY_CELL));

      let base;
      if (dot < 0.5) base = bodyPolyLerpColor(BODY_POLY_BLUE_DARK, BODY_POLY_BLUE_MID, dot * 2);
      else base = bodyPolyLerpColor(BODY_POLY_BLUE_MID, BODY_POLY_BLUE_LIGHT, (dot - 0.5) * 2);
      const shade = 0.75 + areaFactor * 0.25;
      const r = base[0] * shade, g = base[1] * shade, b = base[2] * shade;

      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.lineTo(pc.x, pc.y);
      ctx.closePath();
      ctx.fillStyle = `rgb(${r|0}, ${g|0}, ${b|0})`;
      ctx.fill();

      const edgeHighlight = dot > 0.72 && areaFactor > 0.55;
      if (edgeHighlight){
        ctx.strokeStyle = `rgba(${BODY_POLY_GOLD[0]}, ${BODY_POLY_GOLD[1]}, ${BODY_POLY_GOLD[2]}, 0.5)`;
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = 'rgba(3, 10, 20, 0.5)';
        ctx.lineWidth = 0.7;
      }
      ctx.stroke();
    }
  } catch(e){
    console.error('Fundo low-poly: erro a desenhar frame, a parar', e);
    bodyMatrixAnimId = null;
    return;
  }

  bodyMatrixAnimId = requestAnimationFrame(drawBodyMatrixFrame);
}

function startBodyMatrix(){
  const ready = initBodyMatrix();
  if(bodyMatrixAnimId) cancelAnimationFrame(bodyMatrixAnimId);
  bodyMatrixLastTs = 0;
  bodyPolyStartTs = null;
  if(!ready){
    requestAnimationFrame(() => {
      if(initBodyMatrix()) bodyMatrixAnimId = requestAnimationFrame(drawBodyMatrixFrame);
    });
    return;
  }
  bodyMatrixAnimId = requestAnimationFrame(drawBodyMatrixFrame);
}

let _bodyPolyRz = null;
window.addEventListener('resize', () => { clearTimeout(_bodyPolyRz); _bodyPolyRz = setTimeout(initBodyMatrix, 200); });

// A altura da .frame muda com frequência (trocar de aba, adicionar/remover
// máquinas, expandir listas, etc.) — um ResizeObserver mantém o canvas
// sempre do tamanho certo sem depender só do resize da janela.
if(window.ResizeObserver){
  const frameEl = document.getElementById('mainFrame');
  if(frameEl){
    let resizeDebounce = null;
    new ResizeObserver(() => {
      clearTimeout(resizeDebounce);
      /* canvas agora é fixo ao viewport: não precisa de seguir a altura da página */
    }).observe(frameEl);
  }
}

function logEvent(msg, cls='', devName='', devId='sys'){
  const logContainer = $('eventLog');
  if(logContainer) {
    const el = document.createElement('div');
    let rowClass = 'event-row';
    if(cls === 'new') rowClass += ' is-new';
    if(cls === 'error' || cls === 'red') rowClass += ' is-error';

    el.className = rowClass + ' event-enter';
    el.innerHTML = `
      <div class="event-left">
        <span class="event-time">${nowStamp()}</span>
        ${devName ? `<span class="event-badge">${devName}</span>` : ''}
        <span class="event-text">${msg}</span>
      </div>
    `;
    logContainer.prepend(el);
    while(logContainer.children.length > 50) {
      logContainer.removeChild(logContainer.lastChild);
    }
  }
  addConsoleLine(devId, devName || 'Sistema', 'system', msg, cls === 'amber', cls === 'error');
}

const UPDATE_DISMISS_KEY = 'nerdqaxe:update-dismissed-version';

async function checkForUpdate(){
  try {
    const res = await fetch(`${API_BASE}/api/update/check`);
    const data = await res.json();
    if(!data.update_available || !data.latest_version) return;

    let dismissed = '';
    try { dismissed = localStorage.getItem(UPDATE_DISMISS_KEY) || ''; } catch(e){}
    if(dismissed === data.latest_version) return; // já fechou este aviso

    const banner = $('updateBanner');
    const text = $('updateBannerText');
    if(!banner || !text) return;

    text.innerHTML = `Está disponível a versão <b>v${data.latest_version}</b> ` +
      `(tens a v${data.current_version}). ` +
      `<a href="${data.release_url}" target="_blank" rel="noopener">Ver notas da versão</a>`;
    banner.classList.add('show');

    const installBtn = $('updateBannerInstall');
    if(installBtn) {
      // Só mostra o botão de atualização automática se a release tiver
      // mesmo um instalador (.exe) anexado - senão só resta o link manual.
      // e só se estiver assinada (ficheiro .sig): sem assinatura a app recusa instalar sozinha
      installBtn.style.display = (data.installer_url && data.signature_url) ? '' : 'none';
      if(data.installer_url && !data.signature_url) text.innerHTML += ' <b>(sem assinatura: descarrega o instalador manualmente)</b>';
      installBtn.disabled = false;
      installBtn.textContent = '⬇️ Atualizar agora';
      installBtn.onclick = () => startAutoUpdate(installBtn, text);
    }

    $('updateBannerClose').onclick = () => {
      banner.classList.remove('show');
      try { localStorage.setItem(UPDATE_DISMISS_KEY, data.latest_version); } catch(e){}
    };
  } catch(e) {
    // sem internet ou GitHub em baixo - falha silenciosamente
  }
}

async function startAutoUpdate(installBtn, text){
  installBtn.disabled = true;
  installBtn.textContent = 'A descarregar…';
  try {
    const res = await fetch(`${API_BASE}/api/update/install`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({silent: true})
    });
    const data = await res.json();
    if(!data.ok) {
      installBtn.disabled = false;
      installBtn.textContent = '⬇️ Atualizar agora';
      text.textContent = 'Falha ao descarregar a atualização: ' + (data.error || 'erro desconhecido') + '. Tenta pelo link manual acima.';
      return;
    }
    text.textContent = 'A descarregar e a verificar a assinatura… depois a app fecha-se sozinha e abre o instalador.';
    pollUpdateStatus(installBtn, text);
  } catch(e) {
    installBtn.disabled = false;
    installBtn.textContent = '⬇️ Atualizar agora';
    text.textContent = 'Não foi possível contactar o servidor local para atualizar.';
  }
}

function pollUpdateStatus(installBtn, text){
  const iv = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/update/status`);
      const data = await res.json();
      if(data.status === 'error') {
        clearInterval(iv);
        installBtn.disabled = false;
        installBtn.textContent = '⬇️ Atualizar agora';
        text.textContent = 'Falha na atualização: ' + (data.error || 'erro desconhecido');
      } else if(data.status === 'launching' || data.status === 'done') {
        clearInterval(iv);
        text.textContent = 'Instalador lançado. Se não aparecer nenhuma janela, o painel deixou de responder porque a app já fechou - normal, é só continuar no instalador.';
      }
      // 'downloading' - continua a mostrar o texto atual, só faz polling.
    } catch(e) {
      // a app pode já ter fechado (server desligado a meio do processo) -
      // isso é o comportamento esperado, por isso para o polling em silêncio.
      clearInterval(iv);
    }
  }, 1500);
}

function loadDevicesFromLocalStorage(){
  try {
    const res = localStorage.getItem(DEVICES_KEY);
    return res ? JSON.parse(res) : [];
  } catch(e) { return []; }
}

// As máquinas registadas ficam gravadas no servidor (config.json),
// para não se perderem se limpares o cache do browser ou abrires o painel
// noutro PC. Na primeira vez que o servidor não tem nada gravado, migra
// automaticamente o que já estava no localStorage deste browser.
async function loadDevices(){
  const localDevices = loadDevicesFromLocalStorage();
  let ok = false, done = false;
  // se ao fim de 8 s o pedido ainda não terminou, diz em que ponto está (login? configuração?)
  setTimeout(() => {
    if(done || typeof hcRemoteDbg !== 'function') return;
    let s = null, c = null; try { s = window.getCcSession && window.getCcSession(); c = window.getCcCfg && window.getCcCfg(); } catch(e) {}
    hcRemoteDbg('Lista de máquinas ainda à espera: login ' + (c && c.enabled ? 'ativo' : 'desligado/por saber') + ', sessão ' + (s ? 'sim' : 'não') + ', token ' + (s && s.idToken ? 'sim' : 'não'));
  }, 8000);
  // uma resposta de erro (login ainda a renovar, servidor a arrancar) não é "sem máquinas": tenta de novo antes de desistir
  let why = '';
  for(let i = 0; i < 4 && !ok; i++){
    try {
      const res = await fetch(`${API_BASE}/api/devices`);
      why = 'HTTP ' + res.status;
      const data = await res.json();
      if(res.ok && Array.isArray(data.devices)){
        const serverDevices = data.devices;
        if(serverDevices.length === 0 && localDevices.length > 0) {
          devices = localDevices;
          await saveDevices(); // migra para o servidor
        } else {
          devices = serverDevices;
        }
        ok = true;
      }
    } catch(e) { why = String(e && e.message || e); }
    if(!ok && i < 3) await new Promise(r => setTimeout(r, 1500));
  }
  done = true;
  if(!ok && typeof hcRemoteDbg === 'function') hcRemoteDbg('Lista de máquinas: FALHOU ' + why + ' em ' + API_BASE);
  else { const bar = document.getElementById('hcDbg'); if(bar && /ainda à espera/.test(bar.textContent)) bar.remove(); }
  if(!ok){
    // servidor indisponível - usa o que houver localmente como reserva e continua a tentar em segundo plano
    devices = localDevices;
    const bg = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/devices`);
        const data = await res.json();
        if(res.ok && Array.isArray(data.devices)){
          clearInterval(bg);
          devices = data.devices;
          devices.forEach(d => { if(!histories[d.id]) histories[d.id] = []; });
          if(typeof updateLogMachineDropdown === 'function') updateLogMachineDropdown();
          renderAll(); pollAll();
        }
      } catch(e) {}
    }, 5000);
  }
  devices.forEach(d => { if(!histories[d.id]) histories[d.id] = []; });
}

function saveDevices(){
  // grava sempre uma cópia local como reserva (funciona mesmo offline)
  try { localStorage.setItem(DEVICES_KEY, JSON.stringify(devices)); } catch(e){}
  return fetch(`${API_BASE}/api/devices`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({devices})
  }).catch(()=>{});
}

function addDevice(name, ip){
  const id = 'm_' + Math.random().toString(36).slice(2,9);
  const devName = name || `Máquina ${devices.length+1}`;
  devices.push({id, name: devName, ip: ip});
  histories[id] = [];
  thermalHistory[id] = [];
  saveDevices();
  if(!selectedId) selectedId = id;
  logEvent(`Máquina "${devName}" adicionada com sucesso.`, 'new', devName, id);
  updateLogMachineDropdown();
  renderAll();
  pollAll();
}

function removeDevice(id){
  const dev = devices.find(d => d.id === id);
  devices = devices.filter(d => d.id !== id);
  delete readings[id]; delete histories[id];
  delete thermalHistory[id]; delete thermalAlertState[id];
  delete baselineSeen[id];
  saveDevices();
  saveThermalHistory();
  if(selectedId === id) selectedId = devices[0]?.id || null;
  if(thermalSelectedId === id) thermalSelectedId = devices[0]?.id || null;
  updateThermalBadge();
  if(dev) logEvent(`Máquina "${dev.name}" removida.`, '', dev.name, id);
  updateLogMachineDropdown();
  renderAll();
}

let pollInProgress = false;
async function pollAll(){
  if(pollInProgress) return;
  pollInProgress = true;
  try {
    await Promise.all(devices.map(dev => pollOneDevice(dev)));
    renderAll();
  } finally {
    pollInProgress = false;
  }
}

function extractPoolPingLoss(d){
  // Nomes de campo conhecidos usados por diferentes versões do firmware ESP-Miner-NerdQAxePlus / AxeOS
  const pingKeys = ['responseTime','poolPing','pingAvg','avgPing','pingTimeAvg','stratumPing','pingMs','ping'];
  const lossKeys  = ['poolLoss','pingLoss','pingLossPercent','stratumLoss','loss'];

  const readFrom = (obj) => {
    let ping = null, loss = null;
    for(const k of pingKeys){ if(obj[k] != null && !isNaN(Number(obj[k]))){ ping = Number(obj[k]); break; } }
    for(const k of lossKeys){ if(obj[k] != null && !isNaN(Number(obj[k]))){ loss = Number(obj[k]); break; } }
    // Deteção defensiva por padrão de nome, caso o firmware use outra grafia
    if(ping == null){
      for(const k of Object.keys(obj)){
        if(/ping/i.test(k) && typeof obj[k] !== 'object' && !isNaN(Number(obj[k]))){ ping = Number(obj[k]); break; }
      }
    }
    if(loss == null){
      for(const k of Object.keys(obj)){
        if(/loss/i.test(k) && typeof obj[k] !== 'object' && !isNaN(Number(obj[k]))){ loss = Number(obj[k]); break; }
      }
    }
    return { ping, loss };
  };

  let result = readFrom(d);
  // Modo dual pool: os campos podem vir dentro de um array "pools"
  if((result.ping == null || result.loss == null) && Array.isArray(d.pools) && d.pools.length){
    const primary = d.pools.find(p => p && p.isUsingFallback === false) || d.pools[0];
    if(primary){
      const nested = readFrom(primary);
      result.ping = result.ping ?? nested.ping;
      result.loss = result.loss ?? nested.loss;
    }
  }
  return result;
}

function extractPoolInfo(d){
  // Deteta os dados da pool (principal e reserva/fallback) reportados pelo
  // firmware AxeOS / ESP-Miner-NerdQAxePlus. Diferentes versões usam nomes
  // de campo ligeiramente diferentes, por isso tentamos várias variantes.
  const pick = (obj, keys) => {
    for(const k of keys){ if(obj[k] != null && obj[k] !== '') return obj[k]; }
    return null;
  };

  // Modo "dual pool" (array pools[]): usa o primeiro como principal e o
  // seguinte (ou o marcado isUsingFallback:false ausente) como reserva.
  let primaryRaw = d, fallbackRaw = null, usingFallback = false;
  if(Array.isArray(d.pools) && d.pools.length){
    const primary = d.pools.find(p => p && p.isUsingFallback === false) || d.pools[0];
    const fallback = d.pools.find(p => p !== primary) || null;
    primaryRaw = primary || d;
    fallbackRaw = fallback;
    usingFallback = !!(d.pools.find(p => p && p.isUsingFallback === true));
  } else {
    usingFallback = !!(d.isUsingFallbackStratum ?? d.usingFallback ?? d.isUsingFallback ?? false);
  }

  const primary = {
    url: pick(primaryRaw, ['stratumURL','poolUrl','url','host']) ?? '—',
    port: pick(primaryRaw, ['stratumPort','poolPort','port']),
    user: pick(primaryRaw, ['stratumUser','poolUser','user']),
    difficulty: pick(primaryRaw, ['poolDifficulty','stratumDifficulty','stratumDiffFactor','difficulty','suggestedDiff'])
  };

  let fallback = null;
  const fbUrl = fallbackRaw
    ? pick(fallbackRaw, ['stratumURL','poolUrl','url','host'])
    : pick(d, ['fallbackStratumURL','fallbackPoolUrl','fallbackUrl','fallbackHost']);
  if(fbUrl){
    fallback = {
      url: fbUrl,
      port: fallbackRaw ? pick(fallbackRaw, ['stratumPort','poolPort','port']) : pick(d, ['fallbackStratumPort','fallbackPoolPort','fallbackPort']),
      user: fallbackRaw ? pick(fallbackRaw, ['stratumUser','poolUser','user']) : pick(d, ['fallbackStratumUser','fallbackPoolUser','fallbackUser']),
      difficulty: fallbackRaw ? pick(fallbackRaw, ['poolDifficulty','stratumDifficulty','stratumDiffFactor','difficulty']) : pick(d, ['fallbackPoolDifficulty','fallbackDifficulty'])
    };
  }

  return { primary, fallback, usingFallback };
}



// --- Mini janela flutuante -------------------------------------------------
// Usa a Document Picture-in-Picture API (Chrome/Edge 116+): uma janela pequena
// que fica SEMPRE POR CIMA das outras aplicações, mesmo com o browser minimizado.
// Noutros browsers abre uma janela normal pequena (não fica por cima).
// O refresco corre dentro da própria mini janela (setInterval dela), que não é
// travado em segundo plano; os dados vêm do `readings` que o polling já mantém.
let miniWin = null;
let miniTimer = null;
let miniIsPip = false;

function miniWindowRiskColor(temp){
  if(temp == null || isNaN(temp)) return 'var(--muted)';
  if(temp >= 75) return 'var(--red)';
  if(temp >= 65) return 'var(--amber)';
  return 'var(--green)';
}

function buildMiniWindowDoc(win){
  const d = win.document;
  d.title = 'Hash Commander';
  const cs = getComputedStyle(document.body);
  const g = n => (cs.getPropertyValue(n) || '').trim();
  const vars = ['--bg','--panel','--line-strong','--green','--amber','--red','--cyan','--text','--muted']
    .map(n => `${n}:${g(n) || getComputedStyle(document.documentElement).getPropertyValue(n).trim()};`).join('');
  // Tipos de letra: copia as folhas de estilo externas (Google Fonts) da página.
  document.querySelectorAll('link[rel="stylesheet"]').forEach(l => { try { d.head.appendChild(l.cloneNode()); } catch(_){} });
  const style = d.createElement('style');
  style.textContent = `
    :root{${vars}}
    *{box-sizing:border-box;}
    html,body{margin:0;height:100%;background:var(--bg);color:var(--text);
      font-family:'Space Grotesk',system-ui,sans-serif;overflow:hidden;}
    .wrap{height:100%;display:flex;flex-direction:column;padding:10px 12px;gap:8px;
      border:1px solid var(--line-strong);}
    .wrap.hot{border-color:var(--red);box-shadow:inset 0 0 14px #ff5d5d55;}
    .top{display:flex;align-items:baseline;justify-content:space-between;gap:8px;}
    .big{font-size:26px;font-weight:700;color:var(--green);line-height:1;}
    .big small{font-size:12px;color:var(--muted);margin-left:4px;font-weight:600;}
    .on{font-size:12px;color:var(--muted);white-space:nowrap;}
    .on b{color:var(--text);}
    .stats{display:flex;gap:14px;font-size:11px;color:var(--muted);}
    .stats b{display:block;font-size:14px;color:var(--text);margin-top:1px;}
    .list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:3px;
      border-top:1px solid var(--line-strong);padding-top:6px;}
    .row{display:grid;grid-template-columns:8px 1fr auto auto;align-items:center;gap:8px;font-size:12px;}
    .row .dot{width:8px;height:8px;border-radius:50%;background:var(--red);}
    .row.up .dot{background:var(--green);}
    .row .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .row .hr{color:var(--cyan);font-weight:600;}
    .row .tp{min-width:46px;text-align:right;font-weight:600;}
    .empty{font-size:12px;color:var(--muted);text-align:center;padding:10px 0;}
    .note{font-size:10px;color:var(--muted);line-height:1.3;}
  `;
  d.head.appendChild(style);
  d.body.innerHTML = `
    <div class="wrap" id="mw">
      <div class="top"><div class="big" id="mwHash">—</div><div class="on" id="mwOn"></div></div>
      <div class="stats">
        <div><span id="mwTempL"></span><b id="mwTemp">—</b></div>
        <div><span id="mwBestL"></span><b id="mwBest">—</b></div>
      </div>
      <div class="list" id="mwList"></div>
      <div class="note" id="mwNote" style="display:none;"></div>
    </div>`;
  if(!miniIsPip){
    const note = d.getElementById('mwNote');
    note.style.display = '';
    note.textContent = t('mini_popup_aviso');
  }
}

function updateMiniWindow(){
  const w = miniWin;
  if(!w || w.closed){ closeMiniWindow(); return; }
  const d = w.document;
  const $m = id => d.getElementById(id);
  if(!$m('mw')) return;

  const rows = devices.map(dev => ({ dev, r: readings[dev.id] || null }));
  const upRows = rows.filter(x => x.r && x.r.online !== false);
  const totalHash = upRows.reduce((a, x) => a + (Number(x.r.hashrate) || 0), 0);
  const temps = upRows.map(x => x.r.temp).filter(v => typeof v === 'number' && !isNaN(v));
  const maxTemp = temps.length ? Math.max(...temps) : null;
  const best = upRows.reduce((a, x) => Math.max(a, Number(x.r.best) || 0), 0);

  const hf = formatHashrate(totalHash);
  $m('mwHash').innerHTML = upRows.length ? `${hf.value}<small>${hf.unit}</small>` : '—';
  $m('mwOn').innerHTML = `<b>${upRows.length}</b>/${rows.length} ${t('mini_online')}`;
  $m('mwTempL').textContent = t('mini_temp_max');
  $m('mwBestL').textContent = t('melhor_dif');
  const tempEl = $m('mwTemp');
  tempEl.textContent = maxTemp != null ? `${maxTemp.toFixed(1)} °C` : '—';
  tempEl.style.color = miniWindowRiskColor(maxTemp);
  const bf = formatDiff(best);
  $m('mwBest').textContent = best > 0 ? `${bf.value}${bf.unit}` : '—';
  $m('mw').classList.toggle('hot', maxTemp != null && maxTemp >= 75);

  const list = $m('mwList');
  list.textContent = '';
  if(!rows.length){
    const e = d.createElement('div'); e.className = 'empty'; e.textContent = t('mini_sem_maquinas');
    list.appendChild(e);
    return;
  }
  rows.forEach(({ dev, r }) => {
    const up = !!(r && r.online !== false);
    const row = d.createElement('div'); row.className = 'row' + (up ? ' up' : '');
    const dot = d.createElement('span'); dot.className = 'dot';
    const nm = d.createElement('span'); nm.className = 'nm'; nm.textContent = dev.name;
    const hr = d.createElement('span'); hr.className = 'hr';
    const tp = d.createElement('span'); tp.className = 'tp';
    if(up){
      const f = formatHashrate(r.hashrate);
      hr.textContent = `${f.value} ${f.unit}`;
      const tv = typeof r.temp === 'number' ? r.temp : null;
      tp.textContent = tv != null ? `${tv.toFixed(1)}°` : '—';
      tp.style.color = miniWindowRiskColor(tv);
    } else {
      hr.textContent = t('offline');
      hr.style.color = 'var(--red)';
      tp.textContent = '—';
    }
    row.append(dot, nm, hr, tp);
    list.appendChild(row);
  });
}

function closeMiniWindow(){
  if(miniTimer){ try { miniWin && miniWin.clearInterval(miniTimer); } catch(_){} miniTimer = null; }
  const w = miniWin;
  miniWin = null;
  try { if(w && !w.closed) w.close(); } catch(_){}
  const btn = document.getElementById('miniWinBtn');
  if(btn) btn.setAttribute('aria-pressed', 'false');
}

async function toggleMiniWindow(){
  if(miniWin && !miniWin.closed){ closeMiniWindow(); return; }
  const height = Math.min(420, 130 + Math.max(devices.length, 1) * 22);
  let win = null;
  miniIsPip = false;
  try {
    if('documentPictureInPicture' in window){
      win = await window.documentPictureInPicture.requestWindow({ width: 320, height });
      miniIsPip = true;
    }
  } catch(err){ win = null; }
  if(!win){
    win = window.open('', 'hcMiniWin', `popup=yes,width=320,height=${height}`);
  }
  if(!win){
    addNotification('offline', t('mini_janela'), t('mini_bloqueada'), 'Hash Commander');
    return;
  }
  miniWin = win;
  buildMiniWindowDoc(win);
  updateMiniWindow();
  miniTimer = win.setInterval(updateMiniWindow, 2000);
  win.addEventListener('pagehide', () => { if(miniWin === win){ miniTimer = null; miniWin = null; const b = document.getElementById('miniWinBtn'); if(b) b.setAttribute('aria-pressed','false'); } });
  const btn = document.getElementById('miniWinBtn');
  if(btn) btn.setAttribute('aria-pressed', 'true');
}
window.addEventListener('pagehide', () => { try { if(miniWin && !miniWin.closed) miniWin.close(); } catch(_){} });




