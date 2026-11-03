// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Ecrã físico (LilyGO T-Display-S3) ----------
// Janela do menu ⚙ que instala o ecrã por USB: o servidor grava o programa com o esptool e manda o Wi-Fi, o endereço
// da dashboard e a chave própria do ecrã pela porta série. A palavra-passe do Wi-Fi só passa para o ecrã (não fica no PC).
(function(){
  const TX = {
    menu: { pt: 'Ecrã físico', en: 'Physical screen', es: 'Pantalla física', fr: 'Écran physique' },
    title: { pt: 'Ecrã físico (LilyGO T-Display-S3)', en: 'Physical screen (LilyGO T-Display-S3)', es: 'Pantalla física (LilyGO T-Display-S3)', fr: 'Écran physique (LilyGO T-Display-S3)' },
    close: { pt: 'Fechar', en: 'Close', es: 'Cerrar', fr: 'Fermer' },
    intro: { pt: 'Um ecrã pequeno ao lado das máquinas com o hashrate, as temperaturas e os recordes em 3D. Funciona sozinho ligado a qualquer carregador USB, na tua rede de casa.', en: 'A small screen next to your miners showing hashrate, temperatures and records in 3D. It runs on its own from any USB charger, on your home network.', es: 'Una pantalla pequeña junto a las máquinas con el hashrate, las temperaturas y los récords en 3D. Funciona sola con cualquier cargador USB, en tu red de casa.', fr: 'Un petit écran à côté des machines avec le hashrate, les températures et les records en 3D. Il fonctionne seul sur n\'importe quel chargeur USB, sur votre réseau domestique.' },
    s1: { pt: '1. Liga a LilyGO a este PC com um cabo USB-C de dados.', en: '1. Connect the LilyGO to this PC with a USB-C data cable.', es: '1. Conecta la LilyGO a este PC con un cable USB-C de datos.', fr: '1. Branchez la LilyGO à ce PC avec un câble USB-C de données.' },
    port: { pt: 'Porta USB', en: 'USB port', es: 'Puerto USB', fr: 'Port USB' },
    found: { pt: 'ESP32 encontrado', en: 'ESP32 found', es: 'ESP32 encontrado', fr: 'ESP32 trouvé' },
    noport: { pt: 'Nenhuma porta USB encontrada. Liga o cabo e carrega em Procurar.', en: 'No USB port found. Plug in the cable and press Search.', es: 'No se encontró ningún puerto USB. Conecta el cable y pulsa Buscar.', fr: 'Aucun port USB trouvé. Branchez le câble et cliquez sur Rechercher.' },
    search: { pt: 'Procurar', en: 'Search', es: 'Buscar', fr: 'Rechercher' },
    s2: { pt: '2. Rede Wi-Fi onde o ecrã vai ficar (tem de ser 2,4 GHz).', en: '2. Wi-Fi network the screen will use (must be 2.4 GHz).', es: '2. Red Wi-Fi que usará la pantalla (debe ser de 2,4 GHz).', fr: '2. Réseau Wi-Fi que l\'écran utilisera (2,4 GHz obligatoire).' },
    ssid: { pt: 'Nome da rede', en: 'Network name', es: 'Nombre de la red', fr: 'Nom du réseau' },
    pass: { pt: 'Palavra-passe', en: 'Password', es: 'Contraseña', fr: 'Mot de passe' },
    show: { pt: 'Mostrar', en: 'Show', es: 'Mostrar', fr: 'Afficher' },
    flash: { pt: 'Gravar o programa do ecrã (desliga para só mudar o Wi-Fi)', en: 'Write the screen program (turn off to only change the Wi-Fi)', es: 'Grabar el programa de la pantalla (desactiva para cambiar solo el Wi-Fi)', fr: 'Écrire le programme de l\'écran (désactiver pour changer seulement le Wi-Fi)' },
    install: { pt: 'Instalar', en: 'Install', es: 'Instalar', fr: 'Installer' },
    addr: { pt: 'O ecrã vai ler a dashboard em', en: 'The screen will read the dashboard at', es: 'La pantalla leerá el panel en', fr: 'L\'écran lira le tableau de bord à' },
    st_start: { pt: 'A preparar…', en: 'Preparing…', es: 'Preparando…', fr: 'Préparation…' },
    st_flash: { pt: 'A gravar o programa no ecrã… {0}%', en: 'Writing the program to the screen… {0}%', es: 'Grabando el programa en la pantalla… {0}%', fr: 'Écriture du programme sur l\'écran… {0}%' },
    st_config: { pt: 'A enviar o Wi-Fi para o ecrã…', en: 'Sending the Wi-Fi to the screen…', es: 'Enviando el Wi-Fi a la pantalla…', fr: 'Envoi du Wi-Fi à l\'écran…' },
    st_done: { pt: '✓ Pronto. O ecrã reiniciou e liga-se à dashboard. Já podes tirar o cabo do PC e ligar o ecrã a qualquer carregador USB.', en: '✓ Done. The screen restarted and is connecting to the dashboard. You can unplug the cable from the PC and power the screen from any USB charger.', es: '✓ Listo. La pantalla se reinició y se conecta al panel. Ya puedes quitar el cable del PC y conectar la pantalla a cualquier cargador USB.', fr: '✓ Terminé. L\'écran a redémarré et se connecte au tableau de bord. Vous pouvez retirer le câble du PC et brancher l\'écran sur n\'importe quel chargeur USB.' },
    st_error: { pt: 'Não foi possível: {0}', en: 'Could not do it: {0}', es: 'No fue posible: {0}', fr: 'Impossible : {0}' },
    nofw: { pt: 'Esta versão da app não traz o programa do ecrã. Atualiza a app.', en: 'This app version does not include the screen program. Update the app.', es: 'Esta versión de la app no incluye el programa de la pantalla. Actualiza la app.', fr: 'Cette version de l\'app n\'inclut pas le programme de l\'écran. Mettez l\'app à jour.' },
    remote: { pt: 'A instalação só se faz no próprio PC onde o ecrã está ligado por USB.', en: 'Installing only works on the PC where the screen is plugged in by USB.', es: 'La instalación solo se hace en el PC donde la pantalla está conectada por USB.', fr: 'L\'installation ne se fait que sur le PC où l\'écran est branché en USB.' },
    needssid: { pt: 'Escreve o nome da rede Wi-Fi.', en: 'Enter the Wi-Fi network name.', es: 'Escribe el nombre de la red Wi-Fi.', fr: 'Saisissez le nom du réseau Wi-Fi.' },
    needport: { pt: 'Escolhe a porta USB do ecrã.', en: 'Choose the screen\'s USB port.', es: 'Elige el puerto USB de la pantalla.', fr: 'Choisissez le port USB de l\'écran.' },
    tip: { pt: 'Se a gravação falhar: desliga o cabo, carrega no botão BOOT (o de baixo) e volta a ligar o cabo sem largar o botão; depois tenta outra vez. Botões do ecrã: o de baixo muda de página, o de cima muda o brilho.', en: 'If writing fails: unplug the cable, hold the BOOT button (the lower one) and plug the cable back in while holding it; then try again. Screen buttons: lower changes page, upper changes brightness.', es: 'Si la grabación falla: desconecta el cable, mantén pulsado el botón BOOT (el de abajo) y vuelve a conectar el cable sin soltarlo; luego inténtalo de nuevo. Botones de la pantalla: el de abajo cambia de página, el de arriba el brillo.', fr: 'Si l\'écriture échoue : débranchez le câble, maintenez le bouton BOOT (celui du bas) et rebranchez le câble en le maintenant ; puis réessayez. Boutons de l\'écran : celui du bas change de page, celui du haut la luminosité.' }
  };
  const lang = () => (typeof currentLang === 'string' && TX.menu[currentLang]) ? currentLang : 'pt';
  const x = (k, ...a) => { let s = TX[k][lang()] || TX[k].pt; a.forEach((v, i) => { s = s.replace('{' + i + '}', v); }); return s; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  window.hcScreenLabel = () => '📟 ' + x('menu');

  async function api(path, body){
    const r = await fetch(API_BASE + path, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  }

  function progress(m, inst){
    const box = m.querySelector('#hcsProg'); if(!box) return;
    if(!inst || !inst.step){ box.hidden = true; return; }
    box.hidden = false;
    const bar = box.querySelector('i'), txt = box.querySelector('span');
    let msg = '', pct = inst.pct || 0, cls = '';
    if(inst.step === 'start') msg = x('st_start');
    else if(inst.step === 'flash') msg = x('st_flash', pct);
    else if(inst.step === 'config'){ msg = x('st_config'); pct = 100; }
    else if(inst.step === 'done'){ msg = x('st_done'); pct = 100; cls = 'ok'; }
    else if(inst.step === 'error'){ msg = x('st_error', esc(inst.error || '?')); cls = 'bad'; }
    box.className = 'hcs-prog ' + cls;
    bar.style.width = pct + '%';
    txt.innerHTML = msg;
    const go = m.querySelector('[data-s="go"]'); if(go) go.disabled = !!inst.busy;
  }

  async function poll(m){
    clearTimeout(m._t);
    if(!document.body.contains(m)) return;
    let st; try { st = await api('/api/screen/status'); } catch(e) { return; }
    progress(m, st.install);
    if(st.install && st.install.busy) m._t = setTimeout(() => poll(m), 700);
  }

  function portsHtml(ports, keep){
    if(!ports.length) return '<p class="hcr-warn">' + x('noport') + '</p>';
    const pick = keep && ports.some(p => p.port === keep) ? keep : (ports.find(p => p.esp) || ports[0]).port;
    return '<select id="hcsPort">' + ports.map(p => '<option value="' + esc(p.port) + '"' + (p.port === pick ? ' selected' : '') + '>' +
      esc(p.port) + ' · ' + esc(p.esp ? '✓ ' + x('found') : p.desc || '') + '</option>').join('') + '</select>';
  }

  async function render(m){
    const body = m.querySelector('.hcs-body');
    let st; try { st = await api('/api/screen/status'); } catch(e) { body.innerHTML = '<p class="hcr-warn">' + x('st_error', esc(e && e.message || e)) + '</p>'; return; }
    let h = '<p class="hcr-intro">' + x('intro') + '</p>';
    if(!st.local) h += '<p class="hcr-warn">' + x('remote') + '</p>';
    else if(!st.fw) h += '<p class="hcr-warn">' + x('nofw') + '</p>';
    else {
      h += '<p><b>' + x('s1') + '</b></p><div class="hcs-row"><label>' + x('port') + '</label><div class="hcs-ports" id="hcsPorts">' + portsHtml(st.ports || []) + '</div><button type="button" data-s="search">' + x('search') + '</button></div>';
      h += '<p><b>' + x('s2') + '</b></p>' +
        '<div class="hcs-row"><label for="hcsSsid">' + x('ssid') + '</label><input id="hcsSsid" maxlength="32" autocomplete="off" spellcheck="false"></div>' +
        '<div class="hcs-row"><label for="hcsPass">' + x('pass') + '</label><input id="hcsPass" type="password" maxlength="64" autocomplete="new-password"><button type="button" data-s="show">' + x('show') + '</button></div>' +
        '<label class="hcr-row hcr-chk"><input type="checkbox" id="hcsFlash" checked><span>' + x('flash') + '</span></label>' +
        '<p class="hcs-err" id="hcsErr" hidden></p>' +
        '<div class="hcs-go"><button type="button" class="primary" data-s="go">' + x('install') + '</button></div>' +
        '<div class="hcs-prog" id="hcsProg" hidden><b><i></i></b><span></span></div>' +
        '<small class="hcr-why">' + x('addr') + ' <code>' + esc(st.url) + '</code></small>' +
        '<small class="hcr-why">' + x('tip') + '</small>';
    }
    body.innerHTML = h;
    progress(m, st.install);
    if(st.install && st.install.busy) poll(m);
  }

  window.hcScreenOpen = function(){
    const old = document.getElementById('hcScreen'); if(old) old.remove();
    const m = document.createElement('div');
    m.id = 'hcScreen'; m.className = 'mc-cmp';
    m.innerHTML = '<div class="mc-cmp-card mc-help hcr" role="dialog" aria-modal="true"><div class="mc-cmp-head"><b>📟 ' + x('title') + '</b><button type="button" data-cmp="close" aria-label="' + x('close') + '">✕</button></div><div class="hcr-body hcs-body"></div></div>';
    m.addEventListener('click', async e => {
      if(e.target === m || e.target.closest('[data-cmp="close"]')){ clearTimeout(m._t); m.remove(); return; }
      const b = e.target.closest('[data-s]'); if(!b) return;
      const k = b.dataset.s, err = m.querySelector('#hcsErr');
      if(k === 'show'){ const p = m.querySelector('#hcsPass'); p.type = p.type === 'password' ? 'text' : 'password'; }
      else if(k === 'search'){
        const keep = (m.querySelector('#hcsPort') || {}).value;
        try { const st = await api('/api/screen/status'); m.querySelector('#hcsPorts').innerHTML = portsHtml(st.ports || [], keep); } catch(e2) {}
      } else if(k === 'go'){
        const port = (m.querySelector('#hcsPort') || {}).value, ssid = m.querySelector('#hcsSsid').value.trim();
        const show = t => { err.textContent = t; err.hidden = !t; };
        if(!port){ show(x('needport')); return; }
        if(!ssid){ show(x('needssid')); m.querySelector('#hcsSsid').focus(); return; }
        show('');
        b.disabled = true;
        let r; try { r = await api('/api/screen/install', { port, ssid, password: m.querySelector('#hcsPass').value, flash: m.querySelector('#hcsFlash').checked }); } catch(e2) { r = { ok: false, error: String(e2) }; }
        if(!r.ok){ b.disabled = false; show(x('st_error', r.error || '?')); return; }
        m.querySelector('#hcsPass').value = '';
        poll(m);
      }
    });
    m.addEventListener('input', e => { if(e.target.id === 'hcsSsid' || e.target.id === 'hcsPass'){ const er = m.querySelector('#hcsErr'); if(er) er.hidden = true; } });
    document.body.appendChild(m);
    render(m);
  };
})();
