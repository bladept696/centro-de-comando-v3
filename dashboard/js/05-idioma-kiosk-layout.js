// --- Idioma / i18n ------------------------------------------------------
// Dicionário completo em /home/claude/i18n/i18n_dict.js (INSERIDO ABAIXO).
// t(key) devolve o texto no idioma atual - usar sempre que uma string for
// gerada dinamicamente em JS (logEvent, alert, toasts, etc.) para além do
// que já é tratado automaticamente pelos atributos data-i18n no HTML.
const LANG_KEY = 'centro_comando_lang';
let currentLang = 'pt';

function t(key) {
  const entry = I18N_DICT[key];
  if (!entry) return key; // chave desconhecida - mostra a própria chave para ser fácil de detetar
  return entry[currentLang] || entry.pt || key;
}

// Os botões do menu já têm o seu próprio ícone animado num <span class="tab-icon">
// separado - por isso, ao aplicar a tradução, tira-se qualquer emoji que a
// própria string traduzida ainda traga à frente, para não aparecer duplicado.
function stripLeadingIcon(text) {
  return text.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, '');
}

function applyTranslations() {
  document.documentElement.lang = currentLang === 'pt' ? 'pt-PT' : currentLang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const text = t(key);
    el.textContent = el.closest('.tab-btn') ? stripLeadingIcon(text) : text;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.title = t(key);
  });
  // Reaplica textos gerados dinamicamente que não usam data-i18n (dependem
  // do estado atual, não só de uma troca de idioma simples).
  const activeTabBtn = document.querySelector('.tab-btn.active');
  if (activeTabBtn) {
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab) {
      const tabName = activeTab.id.replace('tab-', '');
      const label = $('navMenuLabel');
      if (label) label.textContent = getTabLabel(tabName);
    }
  }
  // Chips de sugestão do assistente de IA (perguntas rápidas) - regenera-os
  // no novo idioma. As mensagens já escritas no histórico do chat ficam
  // como estavam (não traduzimos conversas passadas).
  if (typeof aiRenderSuggestions === 'function') aiRenderSuggestions();
  const hcRangeLabel = $('hashrateRangeLabel');
  if (hcRangeLabel) hcRangeLabel.textContent = t(HASHRATE_RANGE_LABEL_KEY[_hashrateRangeState.range] || '60_min');
  if (lastFetchedBlocks) renderRecentBlocks(lastFetchedBlocks);
  if (typeof renderAll === 'function') renderAll();
}

function setLanguage(lang) {
  if (!['pt', 'en', 'es', 'fr'].includes(lang)) lang = 'pt';
  currentLang = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch(e){}
  const sel = $('langSelect');
  if (sel && sel.value !== lang) sel.value = lang;
  applyTranslations();
}

function loadLanguage(){
  let lang = 'pt';
  try { lang = localStorage.getItem(LANG_KEY) || 'pt'; } catch(e){}
  currentLang = lang;
  const sel = $('langSelect');
  if (sel) sel.value = lang;
  applyTranslations();
}

// --- Modo Kiosk (ecrã grande / TV dedicada) ------------------------------
// Pensado para um ecrã fixo (TV na sala de mineração): esconde tudo o que
// serve para editar/navegar e aumenta os números principais. Fica guardado
// em localStorage para sobreviver a um refresh/reboot do dispositivo, e
// também pode ser ativado diretamente por URL (?kiosk=1) - útil para um
// atalho/favorito apontado logo para o modo kiosk num browser dedicado.
const KIOSK_KEY = 'centro_comando_kiosk';
const KIOSK_ROTATE_KEY = 'centro_comando_kiosk_rotate';
const KIOSK_ROTATE_TABS = ['dashboard', 'thermal', 'latency'];
const KIOSK_ROTATE_INTERVAL_MS = 20000;
let kioskActive = false;
let kioskRotateTimer = null;
let kioskFloatHideTimer = null;
let kioskRotateIndex = 0;
let kioskClockTimer = null;

function enterKioskMode(persist) {
  kioskActive = true;
  document.body.classList.add('kiosk-active');
  if (persist !== false) { try { localStorage.setItem(KIOSK_KEY, '1'); } catch(e){} }
  // Garante que arranca sempre no dashboard, mesmo que o utilizador tivesse
  // outro separador aberto antes de ativar o kiosk.
  const dashBtn = document.querySelector('.tab-btn[onclick*="\'dashboard\'"]');
  if (dashBtn) switchTab('dashboard', dashBtn);
  let rotateOn = false;
  try { rotateOn = localStorage.getItem(KIOSK_ROTATE_KEY) === '1'; } catch(e){}
  const rotateCheck = $('kioskRotateCheck');
  if (rotateCheck) rotateCheck.checked = rotateOn;
  setKioskAutoRotate(rotateOn, false);
  startKioskClock();
  if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
  showKioskFloatBar();
}

function exitKioskMode() {
  kioskActive = false;
  document.body.classList.remove('kiosk-active');
  try { localStorage.removeItem(KIOSK_KEY); } catch(e){}
  setKioskAutoRotate(false, false);
  stopKioskClock();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

function toggleKioskMode() {
  if (kioskActive) exitKioskMode(); else enterKioskMode(true);
}

function setKioskAutoRotate(on, persist) {
  if (kioskRotateTimer) { clearInterval(kioskRotateTimer); kioskRotateTimer = null; }
  if (persist !== false) { try { localStorage.setItem(KIOSK_ROTATE_KEY, on ? '1' : '0'); } catch(e){} }
  if (!on) return;
  kioskRotateIndex = 0;
  kioskRotateTimer = setInterval(() => {
    kioskRotateIndex = (kioskRotateIndex + 1) % KIOSK_ROTATE_TABS.length;
    const tabName = KIOSK_ROTATE_TABS[kioskRotateIndex];
    const btn = document.querySelector(`.tab-btn[onclick*="'${tabName}'"]`);
    if (btn) switchTab(tabName, btn);
  }, KIOSK_ROTATE_INTERVAL_MS);
}

function startKioskClock() {
  const el = $('kioskClock');
  if (!el) return;
  const tick = () => { el.textContent = new Date().toLocaleTimeString(currentLang === 'pt' ? 'pt-PT' : currentLang); };
  tick();
  if (kioskClockTimer) clearInterval(kioskClockTimer);
  kioskClockTimer = setInterval(tick, 1000);
}
function stopKioskClock() {
  if (kioskClockTimer) { clearInterval(kioskClockTimer); kioskClockTimer = null; }
}

function showKioskFloatBar() {
  const bar = $('kioskFloatBar');
  if (!bar || !kioskActive) return;
  bar.classList.add('visible');
  if (kioskFloatHideTimer) clearTimeout(kioskFloatHideTimer);
  kioskFloatHideTimer = setTimeout(() => { bar.classList.remove('visible'); }, 4000);
}

['mousemove', 'touchstart', 'click'].forEach(evt => {
  document.addEventListener(evt, () => { if (kioskActive) showKioskFloatBar(); }, { passive: true });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && kioskActive) exitKioskMode();
});

// --- Editor de layout (arrastar e reordenar painéis) -----------------
// Marca-se cada painel/card reordenável no HTML com data-layout-id="...".
// Dentro de cada "grupo" (um contentor direto, ex: .sidebar, .main,
// .charts) os filhos marcados podem ser arrastados entre si. A ordem
// final é gravada por grupo no localStorage (mesmo padrão já usado para
// tema/idioma/kiosk) e reaplicada no arranque seguinte. Nada disto toca
// em dados - é só a ordem visual dos blocos.
const LAYOUT_GROUPS = [
  { key: 'nerdqaxe:layout-sidebar', selector: '.sidebar' },
  { key: 'nerdqaxe:layout-main', selector: '.main' },
  { key: 'nerdqaxe:layout-charts', selector: '.charts' },
];
let _layoutDragEl = null;

function layoutGroupItems(container){
  return [...container.children].filter(el => el.dataset && el.dataset.layoutId);
}

function applySavedLayoutOrder(container, storageKey){
  let saved;
  try { saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch(e){ saved = null; }
  if(!Array.isArray(saved) || !saved.length) return;
  const map = new Map(layoutGroupItems(container).map(el => [el.dataset.layoutId, el]));
  saved.forEach(id => { const el = map.get(id); if(el) container.appendChild(el); });
}

function saveLayoutOrder(container, storageKey){
  const ids = layoutGroupItems(container).map(el => el.dataset.layoutId);
  try { localStorage.setItem(storageKey, JSON.stringify(ids)); } catch(e){}
}

function layoutElementAfterPoint(container, x, y){
  // Escolhe, de entre os blocos do grupo (exceto o que está a ser
  // arrastado), qual deve ficar IMEDIATAMENTE A SEGUIR ao ponto onde o
  // rato/dedo está agora - baseado no centro vertical de cada bloco.
  // Funciona bem para os grupos verticais (.sidebar, .main); em .charts
  // (grid 2 colunas) o resultado é uma aproximação razoável.
  const els = layoutGroupItems(container).filter(el => el !== _layoutDragEl);
  let closest = { offset: -Infinity, element: null };
  for(const el of els){
    const box = el.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if(offset < 0 && offset > closest.offset){
      closest = { offset, element: el };
    }
  }
  return closest.element;
}

function wireLayoutGroup(container, storageKey){
  container.addEventListener('dragstart', (e) => {
    if(!document.body.classList.contains('layout-edit-mode')) { e.preventDefault(); return; }
    const item = e.target.closest('[data-layout-id]');
    if(!item || item.parentElement !== container) return;
    _layoutDragEl = item;
    item.classList.add('layout-dragging');
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.dataset.layoutId); } catch(err){}
  });

  container.addEventListener('dragend', () => {
    if(_layoutDragEl) _layoutDragEl.classList.remove('layout-dragging');
    container.querySelectorAll('.layout-drop-target').forEach(el => el.classList.remove('layout-drop-target'));
    _layoutDragEl = null;
    saveLayoutOrder(container, storageKey);
  });

  container.addEventListener('dragover', (e) => {
    if(!_layoutDragEl || _layoutDragEl.parentElement !== container) return;
    e.preventDefault();
    const after = layoutElementAfterPoint(container, e.clientX, e.clientY);
    container.querySelectorAll('.layout-drop-target').forEach(el => el.classList.remove('layout-drop-target'));
    if(after){
      after.classList.add('layout-drop-target');
      container.insertBefore(_layoutDragEl, after);
    } else {
      container.appendChild(_layoutDragEl);
    }
  });
}

function initLayoutEditor(){
  LAYOUT_GROUPS.forEach(g => {
    const container = document.querySelector(g.selector);
    if(!container) return;
    applySavedLayoutOrder(container, g.key);
    wireLayoutGroup(container, g.key);
  });
}

function toggleLayoutEditMode(){
  const on = document.body.classList.toggle('layout-edit-mode');
  document.querySelectorAll('[data-layout-id]').forEach(el => {
    el.setAttribute('draggable', on ? 'true' : 'false');
  });
  const btn = $('layoutEditBtn');
  if(btn) btn.classList.toggle('active', on);
  if(on) logEvent(t('layout_edicao_ativada'), '', 'Sistema', 'sys');
}

function resetLayout(){
  if(!confirm(t('confirm_repor_layout'))) return;
  LAYOUT_GROUPS.forEach(g => { try { localStorage.removeItem(g.key); } catch(e){} });
  location.reload();
}

function initKioskMode() {
  let urlKiosk = false;
  try { urlKiosk = new URLSearchParams(window.location.search).get('kiosk') === '1'; } catch(e){}
  let storedKiosk = false;
  try { storedKiosk = localStorage.getItem(KIOSK_KEY) === '1'; } catch(e){}
  if (urlKiosk || storedKiosk) enterKioskMode(urlKiosk || storedKiosk);
}

const TAB_LABEL_KEYS = {
  dashboard: 'dashboard_geral',
  logs: 'logs_das_maquinas',
  notifications: 'notificacoes_block_best_diff',
  simulator: 'simulador',
  latency: 'latencia',
  pool: 'aba_pool',
  parasite: 'aba_parasite',
  thermal: 'saude_termica',
  oc: 'overclock',
  converter: 'conversor',
  donate: 'apoiar_doar',
  supporters: 'apoiantes',
  support: 'suporte',
  renting: 'renting',
  alerts: 'alertas',
  cooling: 'refrigeracao',
  boards: 'placas_hash',
  genpools: 'gp_titulo_tab'
};

const GP_SPOTLIGHT_POOL = 'molepool-btc1';
function getTabLabel(tabName) {
  const key = TAB_LABEL_KEYS[tabName];
  return key ? t(key) : tabName;
}

function toggleNavMenu() {
  const menu = $('navMenu');
  menu.classList.toggle('open');
  $('navMenuBtn')?.setAttribute('aria-expanded', menu.classList.contains('open') ? 'true' : 'false');
}

function closeNavMenu() {
  $('navMenu').classList.remove('open');
  $('navMenuBtn')?.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', (e) => {
  const menu = $('navMenu');
  if(menu && !menu.contains(e.target)) closeNavMenu();
});

