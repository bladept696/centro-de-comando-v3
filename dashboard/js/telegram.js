// ---------- Janela do Telegram, como a do chat da comunidade ----------
// Botão redondo ✈️ no canto (por cima do do chat) que abre uma janela flutuante com o Telegram Web lá dentro.
// O Telegram Web recusa ser aberto dentro de outras páginas; a extensão "extensao-telegram" (Chrome/Edge) tira essa recusa só quando o
// pedido vem do painel e põe a marca data-hc-telegram na página. Sem a marca, a janela mostra os passos para a instalar.
// Não há janela à parte: o Telegram só aparece aqui dentro. A moldura fica viva ao fechar a janela (a sessão do Telegram não volta a carregar). Tamanhos como no chat: normal, largo e ecrã inteiro.
Object.assign(I18N_DICT, {
  telegram_t: { pt: `Telegram`, en: `Telegram`, es: `Telegram`, fr: `Telegram` }
});

(function(){
  const LANGS = ['pt', 'en', 'es', 'fr'], URL = 'https://web.telegram.org/k/', SK = 'hc_tg_size', SIZES = ['normal', 'wide', 'full'];
  const TX = {
    why: ['O Telegram Web não deixa ser aberto dentro de outras páginas. Para o teres aqui, instala uma só vez a extensão do Chrome/Edge que vem com o programa. Só atua quando o Telegram é aberto a partir deste painel e não lê as tuas conversas.',
      'Telegram Web refuses to open inside other pages. To have it here, install once the Chrome/Edge extension that comes with the program. It only acts when Telegram is opened from this panel and does not read your chats.',
      'Telegram Web no deja abrirse dentro de otras páginas. Para tenerlo aquí, instala una vez la extensión de Chrome/Edge que viene con el programa. Solo actúa cuando Telegram se abre desde este panel y no lee tus chats.',
      'Telegram Web refuse de s’ouvrir dans d’autres pages. Pour l’avoir ici, installez une fois l’extension Chrome/Edge fournie avec le programme. Elle n’agit que lorsque Telegram est ouvert depuis ce tableau de bord et ne lit pas vos discussions.'],
    s1: ['Clica em «Abrir a página de extensões» (abre no Chrome do painel).', 'Click “Open the extensions page” (opens in the panel’s Chrome).', 'Haz clic en «Abrir la página de extensiones» (se abre en el Chrome del panel).', 'Cliquez sur « Ouvrir la page des extensions » (s’ouvre dans le Chrome du tableau de bord).'],
    s2: ['Nessa página, liga o «Modo de programador» (canto superior direito).', 'On that page, turn on “Developer mode” (top right).', 'En esa página, activa el «Modo de desarrollador» (arriba a la derecha).', 'Sur cette page, activez le « Mode développeur » (en haut à droite).'],
    s3: ['Clica em «Carregar expandida» (ou «Carregar sem pacote») e escolhe esta pasta:', 'Click “Load unpacked” and choose this folder:', 'Haz clic en «Cargar descomprimida» y elige esta carpeta:', 'Cliquez sur « Charger l’extension non empaquetée » et choisissez ce dossier :'],
    s4: ['Fecha o painel e abre-o outra vez, abre esta janela e entra com o código QR: Telegram no telemóvel › Definições › Dispositivos › Ligar dispositivo.', 'Close the panel and open it again, open this window and sign in with the QR code: Telegram on your phone › Settings › Devices › Link device.', 'Cierra el panel y ábrelo otra vez, abre esta ventana y entra con el código QR: Telegram en el móvil › Ajustes › Dispositivos › Vincular dispositivo.', 'Fermez le tableau de bord et rouvrez-le, ouvrez cette fenêtre et connectez-vous avec le code QR : Telegram sur le téléphone › Paramètres › Appareils › Associer un appareil.'],
    openExt: ['Abrir a página de extensões', 'Open the extensions page', 'Abrir la página de extensiones', 'Ouvrir la page des extensions'],
    copy: ['Copiar caminho', 'Copy path', 'Copiar ruta', 'Copier le chemin'], copied: ['Copiado!', 'Copied!', '¡Copiado!', 'Copié !'],
    noFolder: ['A pasta da extensão não foi encontrada ao lado do programa. Instala a versão mais recente do Centro de Comando.', 'The extension folder was not found next to the program. Install the latest version of Centro de Comando.', 'No se encontró la carpeta de la extensión junto al programa. Instala la última versión de Centro de Comando.', 'Le dossier de l’extension est introuvable à côté du programme. Installez la dernière version de Centro de Comando.'],
    opened: ['Aberto: segue os passos na janela do Chrome que apareceu.', 'Opened: follow the steps in the Chrome window that appeared.', 'Abierto: sigue los pasos en la ventana de Chrome que apareció.', 'Ouvert : suivez les étapes dans la fenêtre Chrome qui est apparue.'],
    failed: ['Não consegui abrir o Chrome.', 'Could not open Chrome.', 'No pude abrir Chrome.', 'Impossible d’ouvrir Chrome.'],
    reload: ['Recarregar', 'Reload', 'Recargar', 'Recharger'], size: ['Tamanho', 'Size', 'Tamaño', 'Taille'], close: ['Fechar', 'Close', 'Cerrar', 'Fermer'],
    remote: ['Só funciona neste PC, com o painel aberto em localhost:8765 (não pelo acesso remoto).', 'Only works on this PC, with the panel open at localhost:8765 (not through remote access).', 'Solo funciona en este PC, con el panel abierto en localhost:8765 (no por acceso remoto).', 'Ne fonctionne que sur ce PC, avec le tableau de bord ouvert sur localhost:8765 (pas via l’accès distant).']
  };
  const lang = () => { try { const l = typeof currentLang !== 'undefined' ? currentLang : 'pt'; return LANGS.includes(l) ? l : 'pt'; } catch(e) { return 'pt'; } };
  const t = k => TX[k][LANGS.indexOf(lang())];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hasExt = () => document.documentElement.getAttribute('data-hc-telegram') === '1';
  let size = 'normal'; try { const s = localStorage.getItem(SK); if(SIZES.includes(s)) size = s; } catch(e) {}

  function build(){
    if(document.getElementById('tgPanel')) return;
    const fab = document.createElement('div');
    fab.id = 'tgFab'; fab.className = 'chat-fab tg-fab'; fab.setAttribute('role', 'button'); fab.setAttribute('tabindex', '0'); fab.title = 'Telegram'; fab.textContent = '✈️';
    const p = document.createElement('div');
    p.id = 'tgPanel'; p.className = 'chat-panel tg-panel';
    p.innerHTML = '<div class="chat-header"><div class="chat-header-left"><span class="chat-header-icon">✈️</span><span class="chat-header-title">TELEGRAM</span></div>' +
      '<div class="chat-header-actions"><button type="button" class="chat-close-btn" data-a="reload">↻</button><button type="button" class="chat-close-btn" data-a="size">⤢</button><button type="button" class="chat-close-btn" data-a="close">✕</button></div></div>' +
      '<div class="tg-body" id="tgBody"></div>';
    document.body.appendChild(fab); document.body.appendChild(p);
    fab.addEventListener('click', toggle);
    fab.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggle(); } });
    p.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if(!b) return; const a = b.dataset.a;
      if(a === 'close') toggle(false); else if(a === 'size') cycle();
      else if(a === 'ext') openExt(b);
      else if(a === 'copy') copyPath(b);
      else if(a === 'reload'){ const f = document.getElementById('tgFrame'); if(f) f.src = URL; else fill(); }
    });
    labels(); applySize();
    // o botão só aparece depois do login, tal como o do chat
    const sync = () => { const cf = document.getElementById('chatFab'); fab.style.display = cf && cf.style.display === 'flex' ? 'flex' : 'none'; if(fab.style.display === 'none') p.classList.remove('open'); };
    sync(); setInterval(sync, 1500);
  }
  function labels(){
    const p = document.getElementById('tgPanel'); if(!p) return;
    const set = (a, k) => { const b = p.querySelector('[data-a="' + a + '"]'); if(b){ b.title = t(k); b.setAttribute('aria-label', t(k)); } };
    set('reload', 'reload'); set('size', 'size'); set('close', 'close');
  }
  function applySize(){ const p = document.getElementById('tgPanel'); if(!p) return; p.classList.toggle('wide', size === 'wide'); p.classList.toggle('full', size === 'full'); }
  function cycle(){ size = SIZES[(SIZES.indexOf(size) + 1) % SIZES.length]; try { localStorage.setItem(SK, size); } catch(e) {} applySize(); }

  function fill(){
    const body = document.getElementById('tgBody'); if(!body) return;
    if(hasExt()){
      if(!body.querySelector('iframe')){
        body.dataset.mode = 'frame';
        body.innerHTML = '<iframe id="tgFrame" class="tg-frame" src="' + URL + '" title="Telegram Web" allow="clipboard-read; clipboard-write; microphone; camera; autoplay; fullscreen; display-capture" referrerpolicy="origin"></iframe>';
      }
    } else if(body.dataset.mode !== 'setup' || body.dataset.lang !== lang()){
      body.dataset.mode = 'setup'; body.dataset.lang = lang();
      body.innerHTML = '<div class="tg-setup"><p>' + esc(t('why')) + '</p><div id="tgSetupBody"></div></div>';
      setupInfo();
    }
  }
  let _info = null;
  async function setupInfo(){
    const box = document.getElementById('tgSetupBody'); if(!box) return;
    try { if(!_info){ const r = await fetch(API_BASE + '/api/telegram/info'); _info = await r.json(); } } catch(e) { _info = { ok: false }; }
    if(!_info.local){ box.innerHTML = '<small>' + esc(t('remote')) + '</small>'; return; }
    if(!_info.path){ box.innerHTML = '<small>' + esc(t('noFolder')) + '</small>'; return; }
    box.innerHTML = '<ol><li>' + esc(t('s1')) + '<br><button type="button" class="tg-btn" data-a="ext">' + esc(t('openExt')) + '</button></li><li>' + esc(t('s2')) + '</li>' +
      '<li>' + esc(t('s3')) + '<br><code class="tg-path">' + esc(_info.path) + '</code> <button type="button" class="tg-btn" data-a="copy">' + esc(t('copy')) + '</button></li><li>' + esc(t('s4')) + '</li></ol><small id="tgMsg"></small>';
  }
  async function openExt(btn){
    const m = document.getElementById('tgMsg');
    try { const r = await fetch(API_BASE + '/api/telegram/abrir-extensoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); const j = await r.json(); if(m) m.textContent = j.ok ? t('opened') : (j.error || t('failed')); }
    catch(e) { if(m) m.textContent = t('failed'); }
  }
  async function copyPath(btn){
    try { await navigator.clipboard.writeText(_info && _info.path || ''); const o = btn.textContent; btn.textContent = t('copied'); setTimeout(() => { btn.textContent = o; }, 1500); } catch(e) {}
  }
  function toggle(force){
    const p = document.getElementById('tgPanel'); if(!p) return;
    const open = typeof force === 'boolean' ? force : !p.classList.contains('open');
    p.classList.toggle('open', open);
    if(open){ labels(); fill(); }
  }

  if(document.body) build(); else document.addEventListener('DOMContentLoaded', build);
  window.hcTelegram = { toggle, hasExt, build };
})();
