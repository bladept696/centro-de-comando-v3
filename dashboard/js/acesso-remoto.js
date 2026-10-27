// ---------- Acesso remoto seguro (Tailscale) ----------
// O Tailscale liga os teus dispositivos numa rede privada: o telemóvel abre o painel do PC sem abrir portas no router
// nem expor nada à internet. Aqui vês o estado, ativas o HTTPS privado ("tailscale serve") e manténs o servidor ligado
// quando fechas a janela. Só o próprio PC pode alterar isto; o login do Hash Commander continua obrigatório.
(function(){
  const TX = {
    menu: { pt: 'Acesso remoto', en: 'Remote access', es: 'Acceso remoto', fr: 'Accès à distance' },
    title: { pt: 'Acesso remoto seguro (Tailscale)', en: 'Secure remote access (Tailscale)', es: 'Acceso remoto seguro (Tailscale)', fr: 'Accès à distance sécurisé (Tailscale)' },
    close: { pt: 'Fechar', en: 'Close', es: 'Cerrar', fr: 'Fermer' },
    loading: { pt: 'A verificar o Tailscale…', en: 'Checking Tailscale…', es: 'Comprobando Tailscale…', fr: 'Vérification de Tailscale…' },
    intro: { pt: 'Vê o painel do telemóvel ou de outro PC, de qualquer lado, por uma rede privada só tua. Nada fica aberto na internet e o login do painel continua obrigatório.', en: 'See the dashboard from your phone or another PC, from anywhere, over a private network that is only yours. Nothing is exposed to the internet and the dashboard login is still required.', es: 'Mira el panel desde el móvil u otro PC, desde cualquier lugar, por una red privada solo tuya. Nada queda abierto en internet y el inicio de sesión del panel sigue siendo obligatorio.', fr: 'Consultez le tableau de bord depuis votre téléphone ou un autre PC, de n\'importe où, via un réseau privé qui n\'est qu\'à vous. Rien n\'est exposé sur Internet et la connexion au tableau de bord reste obligatoire.' },
    s1: { pt: '1. Instala o Tailscale neste PC e no telemóvel (gratuito) e entra com a mesma conta nos dois.', en: '1. Install Tailscale on this PC and on your phone (free) and sign in with the same account on both.', es: '1. Instala Tailscale en este PC y en el móvil (gratis) e inicia sesión con la misma cuenta en ambos.', fr: '1. Installez Tailscale sur ce PC et sur votre téléphone (gratuit) et connectez-vous avec le même compte.' },
    dl: { pt: 'Descarregar o Tailscale', en: 'Download Tailscale', es: 'Descargar Tailscale', fr: 'Télécharger Tailscale' },
    recheck: { pt: 'Verificar de novo', en: 'Check again', es: 'Comprobar de nuevo', fr: 'Vérifier à nouveau' },
    notinst: { pt: 'O Tailscale não está instalado neste PC.', en: 'Tailscale is not installed on this PC.', es: 'Tailscale no está instalado en este PC.', fr: 'Tailscale n\'est pas installé sur ce PC.' },
    notrun: { pt: 'O Tailscale está instalado mas sem sessão iniciada ou desligado. Abre o Tailscale na bandeja do Windows e liga-o.', en: 'Tailscale is installed but signed out or off. Open Tailscale from the Windows tray and turn it on.', es: 'Tailscale está instalado pero sin sesión o apagado. Ábrelo desde la bandeja de Windows y enciéndelo.', fr: 'Tailscale est installé mais déconnecté ou arrêté. Ouvrez-le depuis la barre des tâches Windows et activez-le.' },
    on: { pt: 'Tailscale ligado', en: 'Tailscale connected', es: 'Tailscale conectado', fr: 'Tailscale connecté' },
    devs: { pt: '{0} outro(s) dispositivo(s) online na tua rede', en: '{0} other device(s) online in your network', es: '{0} otro(s) dispositivo(s) en línea en tu red', fr: '{0} autre(s) appareil(s) en ligne sur votre réseau' },
    addr: { pt: 'Endereço para abrir no telemóvel', en: 'Address to open on your phone', es: 'Dirección para abrir en el móvil', fr: 'Adresse à ouvrir sur le téléphone' },
    copy: { pt: 'Copiar', en: 'Copy', es: 'Copiar', fr: 'Copier' },
    copied: { pt: 'Copiado ✓', en: 'Copied ✓', es: 'Copiado ✓', fr: 'Copié ✓' },
    qr: { pt: 'Lê com a câmara do telemóvel (com o Tailscale ligado).', en: 'Scan with your phone camera (with Tailscale on).', es: 'Escanea con la cámara del móvil (con Tailscale activado).', fr: 'Scannez avec l\'appareil photo du téléphone (Tailscale activé).' },
    httpsOn: { pt: '🔒 HTTPS privado ativo', en: '🔒 Private HTTPS on', es: '🔒 HTTPS privado activo', fr: '🔒 HTTPS privé actif' },
    httpsOff: { pt: 'HTTPS privado desligado', en: 'Private HTTPS off', es: 'HTTPS privado apagado', fr: 'HTTPS privé désactivé' },
    httpsEnable: { pt: 'Ativar HTTPS privado', en: 'Turn on private HTTPS', es: 'Activar HTTPS privado', fr: 'Activer le HTTPS privé' },
    httpsDisable: { pt: 'Desativar', en: 'Turn off', es: 'Desactivar', fr: 'Désactiver' },
    httpsWhy: { pt: 'Recomendado: o endereço fica https://… (cifrado) e não depende da firewall do Windows.', en: 'Recommended: the address becomes https://… (encrypted) and does not depend on the Windows firewall.', es: 'Recomendado: la dirección pasa a https://… (cifrada) y no depende del firewall de Windows.', fr: 'Recommandé : l\'adresse devient https://… (chiffrée) et ne dépend pas du pare-feu Windows.' },
    keep: { pt: 'Manter o servidor ligado quando fecho a janela', en: 'Keep the server running when I close the window', es: 'Mantener el servidor encendido al cerrar la ventana', fr: 'Garder le serveur actif quand je ferme la fenêtre' },
    keepWhy: { pt: 'Sem isto o servidor desliga-se ao fechares a janela e deixas de o alcançar de fora. Para sair de vez, usa "Sair" no ícone da bandeja.', en: 'Without this the server stops when you close the window and you can\'t reach it remotely. To quit for good, use "Exit" on the tray icon.', es: 'Sin esto el servidor se apaga al cerrar la ventana y no podrás llegar a él desde fuera. Para salir del todo, usa "Salir" en el icono de la bandeja.', fr: 'Sans cela le serveur s\'arrête à la fermeture de la fenêtre et vous ne pouvez plus l\'atteindre à distance. Pour quitter, utilisez « Quitter » dans l\'icône de la barre.' },
    remoteNote: { pt: 'Estás a ver o painel por acesso remoto. As opções de rede só se alteram no próprio PC.', en: 'You are viewing the dashboard remotely. Network options can only be changed on the PC itself.', es: 'Estás viendo el panel de forma remota. Las opciones de red solo se cambian en el propio PC.', fr: 'Vous consultez le tableau de bord à distance. Les options réseau ne se modifient que sur le PC lui-même.' },
    enableUrl: { pt: '1) Abre esta página e ativa o Serve na tua conta Tailscale (uma única vez). 2) Volta aqui e carrega outra vez em "Ativar HTTPS privado".', en: '1) Open this page and enable Serve on your Tailscale account (one time only). 2) Come back and press "Turn on private HTTPS" again.', es: '1) Abre esta página y activa Serve en tu cuenta de Tailscale (solo una vez). 2) Vuelve y pulsa otra vez "Activar HTTPS privado".', fr: '1) Ouvrez cette page et activez Serve sur votre compte Tailscale (une seule fois). 2) Revenez et cliquez de nouveau sur « Activer le HTTPS privé ».' },
    timeout: { pt: 'O Tailscale demorou a responder. Se pediu uma ativação no navegador, conclui-a e tenta de novo.', en: 'Tailscale took too long to answer. If it asked for activation in the browser, finish it and try again.', es: 'Tailscale tardó en responder. Si pidió una activación en el navegador, complétala e inténtalo de nuevo.', fr: 'Tailscale a mis trop de temps à répondre. S\'il a demandé une activation dans le navigateur, terminez-la et réessayez.' },
    fail: { pt: 'Não foi possível: ', en: 'Could not do it: ', es: 'No fue posible: ', fr: 'Impossible : ' },
    noaddr: { pt: 'Ainda não há endereço Tailscale neste PC.', en: 'There is no Tailscale address on this PC yet.', es: 'Aún no hay dirección de Tailscale en este PC.', fr: 'Aucune adresse Tailscale sur ce PC pour l\'instant.' },
    fw: { pt: 'Sem HTTPS privado, o Windows pode pedir-te para permitir a ligação na firewall.', en: 'Without private HTTPS, Windows may ask you to allow the connection in the firewall.', es: 'Sin HTTPS privado, Windows puede pedirte que permitas la conexión en el firewall.', fr: 'Sans HTTPS privé, Windows peut demander d\'autoriser la connexion dans le pare-feu.' },
  };
  const lang = () => (typeof currentLang === 'string' && TX.menu[currentLang]) ? currentLang : 'pt';
  const x = (k, ...a) => { let s = TX[k][lang()] || TX[k].pt; a.forEach((v, i) => { s = s.replace('{' + i + '}', v); }); return s; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const isLocal = () => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname);
  window.hcRemoteLabel = () => '🌐 ' + x('menu');

  let qrLoading = null;
  function loadQr(){
    if(window.qrcode) return Promise.resolve();
    if(qrLoading) return qrLoading;
    qrLoading = new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
      s.onload = ok; s.onerror = () => { qrLoading = null; no(); };
      document.head.appendChild(s);
    });
    return qrLoading;
  }
  async function drawQr(box, url){
    try {
      await loadQr();
      const q = window.qrcode(0, 'M'); q.addData(url); q.make();
      let svg;
      try { svg = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch(e) { svg = q.createImgTag(4, 8); }
      box.innerHTML = svg;
    } catch(e) { box.hidden = true; }
  }

  function urls(st){
    const ip = (st.ips || []).find(a => a.indexOf(':') < 0) || (st.ips || [])[0] || '';
    const host = st.dns || ip, sch = st.scheme || 'http';
    const direct = host ? sch + '://' + host + ':' + st.port + '/nerdqaxe-dashboard.html' : '';
    const secure = st.dns && st.serve ? 'https://' + st.dns + '/nerdqaxe-dashboard.html' : '';
    return { best: secure || direct, secure, direct };
  }

  async function api(path, body){
    const r = await fetch(API_BASE + path, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  }

  function view(m, st, msg){
    const card = m.querySelector('.hcr-body'), local = isLocal() && st.local !== false;
    let h = '<p class="hcr-intro">' + x('intro') + '</p>';
    if(!st.installed){
      h += '<p class="hcr-warn">' + x('notinst') + '</p><p>' + x('s1') + '</p><div class="mc-th-actions"><a class="hcr-link" href="https://tailscale.com/download" target="_blank" rel="noopener">' + x('dl') + '</a><button type="button" data-r="refresh">' + x('recheck') + '</button></div>';
    } else if(!st.running){
      h += '<p class="hcr-warn">' + x('notrun') + '</p><div class="mc-th-actions"><button type="button" data-r="refresh">' + x('recheck') + '</button></div>';
    } else {
      const u = urls(st);
      h += '<p class="hcr-ok">● ' + x('on') + (st.tailnet ? ' · ' + esc(st.tailnet) : '') + ' · ' + x('devs', st.peers_online) + '</p>';
      if(!u.best) h += '<p class="hcr-warn">' + x('noaddr') + '</p>';
      else h += '<div class="hcr-addr"><div><b>' + x('addr') + '</b><code id="hcrUrl">' + esc(u.best) + '</code><button type="button" data-r="copy">' + x('copy') + '</button><small>' + x('qr') + '</small></div><div class="hcr-qr" id="hcrQr"></div></div>';
      if(local){
        h += '<div class="hcr-row"><span>' + (st.serve ? x('httpsOn') : x('httpsOff')) + '</span><button type="button" data-r="serve" data-on="' + (st.serve ? 0 : 1) + '" class="' + (st.serve ? '' : 'primary') + '">' + (st.serve ? x('httpsDisable') : x('httpsEnable')) + '</button></div><small class="hcr-why">' + x('httpsWhy') + (st.serve ? '' : ' ' + x('fw')) + '</small>';
        h += '<label class="hcr-row hcr-chk"><input type="checkbox" data-r="keep"' + (st.keepalive ? ' checked' : '') + '><span>' + x('keep') + '</span></label><small class="hcr-why">' + x('keepWhy') + '</small>';
      } else h += '<p class="hcr-note">' + x('remoteNote') + '</p>';
    }
    if(msg) h += '<p class="hcr-msg">' + msg + '</p>';
    card.innerHTML = h;
    const qr = card.querySelector('#hcrQr'), u2 = urls(st).best;
    if(qr && u2) drawQr(qr, u2);
  }

  async function refresh(m, msg){
    const card = m.querySelector('.hcr-body');
    if(!m.dataset.ready) card.innerHTML = '<p class="hcr-intro">' + x('loading') + '</p>';
    try { m._st = await api('/api/remote/status'); m.dataset.ready = '1'; view(m, m._st, msg); }
    catch(e) { card.innerHTML = '<p class="hcr-warn">' + x('fail') + esc(e && e.message || e) + '</p>'; }
  }

  window.hcRemoteOpen = function(){
    const old = document.getElementById('hcRemote'); if(old) old.remove();
    const m = document.createElement('div');
    m.id = 'hcRemote'; m.className = 'mc-cmp';
    m.innerHTML = '<div class="mc-cmp-card mc-help hcr" role="dialog" aria-modal="true"><div class="mc-cmp-head"><b>🌐 ' + x('title') + '</b><button type="button" data-cmp="close" aria-label="' + x('close') + '">✕</button></div><div class="hcr-body"></div></div>';
    m.addEventListener('click', async e => {
      if(e.target === m || e.target.closest('[data-cmp="close"]')){ m.remove(); return; }
      const b = e.target.closest('[data-r]'); if(!b) return;
      const k = b.dataset.r;
      if(k === 'refresh') refresh(m);
      else if(k === 'copy'){
        const t0 = (m.querySelector('#hcrUrl') || {}).textContent || '';
        try { await navigator.clipboard.writeText(t0); b.textContent = x('copied'); setTimeout(() => { b.textContent = x('copy'); }, 1500); } catch(err) {}
      } else if(k === 'serve'){
        b.disabled = true;
        let r; try { r = await api('/api/remote/serve', { enable: b.dataset.on === '1' }); } catch(err) { r = { ok: false, error: String(err) }; }
        let msg = '';
        if(!r.ok){
          if(r.enable_url) msg = '<a class="hcr-link" href="' + esc(r.enable_url) + '" target="_blank" rel="noopener">' + x('enableUrl') + '</a>';
          else msg = r.hint === 'timeout' ? x('timeout') : x('fail') + esc(r.error || '');
        }
        refresh(m, msg);
      }
    });
    m.addEventListener('change', async e => {
      const c = e.target.closest('[data-r="keep"]'); if(!c) return;
      let r; try { r = await api('/api/remote/keepalive', { enable: c.checked }); } catch(err) { r = { ok: false, error: String(err) }; }
      refresh(m, r.ok ? '' : x('fail') + esc(r.error || ''));
    });
    document.body.appendChild(m);
    refresh(m);
  };
})();
