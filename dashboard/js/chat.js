
/* ===== Chat da comunidade em tempo real (Firebase RTDB) - balão flutuante =====
   Mensagens com respostas, reações, edição e apagar, menções, links e imagens, "a escrever…", não lidas,
   som e notificações, partilha de máquinas, comandos (/hash, /btc), anúncios de blocos e recordes,
   pesquisa, mensagens antigas, painel redimensionável e proteções contra spam.
   As funções que escrevem em sítios novos da base (reações, "a escrever…", editar, apagar) precisam das
   regras do Firebase descritas em firebase-chat-rules.json; sem elas o chat continua a funcionar como antes. */
(function(){
  const TX = {
    today: ['Hoje', 'Today', 'Hoy', "Aujourd'hui"], yesterday: ['Ontem', 'Yesterday', 'Ayer', 'Hier'],
    new_msgs: ['Novas mensagens', 'New messages', 'Mensajes nuevos', 'Nouveaux messages'],
    older: ['Carregar mensagens mais antigas', 'Load older messages', 'Cargar mensajes anteriores', 'Charger les messages précédents'],
    reply: ['Responder', 'Reply', 'Responder', 'Répondre'], react: ['Reagir', 'React', 'Reaccionar', 'Réagir'],
    edit: ['Editar', 'Edit', 'Editar', 'Modifier'], del: ['Apagar', 'Delete', 'Borrar', 'Supprimer'], mute: ['Silenciar', 'Mute', 'Silenciar', 'Masquer'],
    replying: ['A responder a {0}', 'Replying to {0}', 'Respondiendo a {0}', 'Réponse à {0}'],
    editing: ['A editar a mensagem', 'Editing the message', 'Editando el mensaje', 'Modification du message'],
    edited: ['(editada)', '(edited)', '(editado)', '(modifié)'],
    typing1: ['{0} está a escrever…', '{0} is typing…', '{0} está escribiendo…', '{0} écrit…'],
    typing2: ['{0} e {1} estão a escrever…', '{0} and {1} are typing…', '{0} y {1} están escribiendo…', '{0} et {1} écrivent…'],
    typingN: ['Várias pessoas estão a escrever…', 'Several people are typing…', 'Varias personas están escribiendo…', 'Plusieurs personnes écrivent…'],
    del_confirm: ['Apagar esta mensagem?', 'Delete this message?', '¿Borrar este mensaje?', 'Supprimer ce message ?'],
    muted_note: ['{0} foi silenciado. Pode reverter no ⚙.', '{0} was muted. You can undo it in ⚙.', '{0} fue silenciado. Puede revertirlo en ⚙.', '{0} a été masqué. Annulable dans ⚙.'],
    rate: ['Está a enviar mensagens depressa de mais. Espere um pouco.', 'You are sending messages too fast. Wait a moment.', 'Está enviando mensajes demasiado rápido. Espere un poco.', 'Vous envoyez trop vite. Patientez un peu.'],
    links: ['Demasiados links na mesma mensagem.', 'Too many links in one message.', 'Demasiados enlaces en un mismo mensaje.', 'Trop de liens dans un même message.'],
    dup: ['Mensagem repetida.', 'Repeated message.', 'Mensaje repetido.', 'Message répété.'],
    blocked: ['A mensagem tem palavras bloqueadas.', 'The message has blocked words.', 'El mensaje tiene palabras bloqueadas.', 'Le message contient des mots bloqués.'],
    search_ph: ['Pesquisar nas mensagens…', 'Search messages…', 'Buscar en los mensajes…', 'Rechercher dans les messages…'],
    search_info: ['{0} resultados', '{0} results', '{0} resultados', '{0} résultats'],
    set_sound: ['Som nas mensagens novas', 'Sound on new messages', 'Sonido en mensajes nuevos', 'Son pour les nouveaux messages'],
    set_notif: ['Notificações do navegador', 'Browser notifications', 'Notificaciones del navegador', 'Notifications du navigateur'],
    set_announce: ['Anunciar os meus blocos e recordes no chat', 'Announce my blocks and records in the chat', 'Anunciar mis bloques y récords en el chat', 'Annoncer mes blocs et records dans le chat'],
    set_previews: ['Pré-visualizar imagens', 'Preview images', 'Previsualizar imágenes', 'Aperçu des images'],
    set_words: ['Palavras bloqueadas (separadas por vírgula)', 'Blocked words (comma separated)', 'Palabras bloqueadas (separadas por comas)', 'Mots bloqués (séparés par des virgules)'],
    set_muted: ['Silenciados: {0}', 'Muted: {0}', 'Silenciados: {0}', 'Masqués : {0}'],
    set_unmute: ['Reativar todos', 'Unmute all', 'Reactivar todos', 'Tout réactiver'],
    set_rules: ['Reações, edição, apagar e «a escrever…» precisam das regras do Firebase (ver firebase-chat-rules.json).', 'Reactions, editing, deleting and "typing…" need the Firebase rules (see firebase-chat-rules.json).', 'Reacciones, edición, borrar y «escribiendo…» necesitan las reglas de Firebase (ver firebase-chat-rules.json).', 'Réactions, modification, suppression et « écrit… » demandent les règles Firebase (voir firebase-chat-rules.json).'],
    perm: ['Esta função precisa das regras novas do Firebase (ver firebase-chat-rules.json).', 'This feature needs the new Firebase rules (see firebase-chat-rules.json).', 'Esta función necesita las reglas nuevas de Firebase (ver firebase-chat-rules.json).', 'Cette fonction demande les nouvelles règles Firebase (voir firebase-chat-rules.json).'],
    share_title: ['Partilhar uma máquina', 'Share a machine', 'Compartir una máquina', 'Partager une machine'],
    share_none: ['Ainda não há máquinas.', 'No machines yet.', 'Aún no hay máquinas.', 'Pas encore de machines.'],
    cmd_help: ['Comandos: /hash partilha o seu hashrate · /btc preço e dificuldade · /ajuda esta lista', 'Commands: /hash shares your hashrate · /btc price and difficulty · /help this list', 'Comandos: /hash comparte su hashrate · /btc precio y dificultad · /ayuda esta lista', 'Commandes : /hash partage votre hashrate · /btc prix et difficulté · /aide cette liste'],
    cmd_btc_wait: ['Os dados do Bitcoin ainda estão a carregar.', 'Bitcoin data is still loading.', 'Los datos de Bitcoin aún se están cargando.', 'Les données Bitcoin sont en cours de chargement.'],
    cmd_hash_none: ['Não há máquinas ligadas para partilhar.', 'No machines online to share.', 'No hay máquinas conectadas para compartir.', 'Aucune machine en ligne à partager.'],
    cmd_hash: ['⛏️ {0} · {1}/{2} online · {3} W', '⛏️ {0} · {1}/{2} online · {3} W', '⛏️ {0} · {1}/{2} en línea · {3} W', '⛏️ {0} · {1}/{2} en ligne · {3} W'],
    cmd_btc: ['₿ {0} € · dificuldade {1}{2}', '₿ {0} € · difficulty {1}{2}', '₿ {0} € · dificultad {1}{2}', '₿ {0} € · difficulté {1}{2}'],
    block_ann: ['🏆 {0} encontrou um BLOCO com {1}!', '🏆 {0} found a BLOCK with {1}!', '🏆 {0} encontró un BLOQUE con {1}!', '🏆 {0} a trouvé un BLOC avec {1} !'],
    record_ann: ['🎯 {0} bateu o seu recorde de dificuldade com {1}!', '🎯 {0} broke their difficulty record with {1}!', '🎯 {0} batió su récord de dificultad con {1}!', '🎯 {0} a battu son record de difficulté avec {1} !'],
    me: ['eu', 'me', 'yo', 'moi'], admin: ['admin', 'admin', 'admin', 'admin'],
    t_search: ['Pesquisar', 'Search', 'Buscar', 'Rechercher'], t_settings: ['Definições do chat', 'Chat settings', 'Ajustes del chat', 'Réglages du chat'],
    t_size: ['Mudar o tamanho', 'Change size', 'Cambiar el tamaño', 'Changer la taille'], t_close: ['Fechar', 'Close', 'Cerrar', 'Fermer'],
    t_share: ['Partilhar uma máquina', 'Share a machine', 'Compartir una máquina', 'Partager une machine'], t_emoji: ['Emojis', 'Emojis', 'Emojis', 'Emojis'],
    cancel: ['Cancelar', 'Cancel', 'Cancelar', 'Annuler'], load_fail: ['Não foi possível carregar mais mensagens.', 'Could not load more messages.', 'No se pudieron cargar más mensajes.', 'Impossible de charger plus de messages.'],
    send_fail: ['Não foi possível enviar: sem permissão ou sem ligação.', 'Could not send: no permission or no connection.', 'No se pudo enviar: sin permiso o sin conexión.', "Envoi impossible : pas d'autorisation ou pas de connexion."],
    no_session: ['Sem sessão segura ainda — tente outra vez dentro de instantes ou termine a sessão e volte a entrar.', 'No secure session yet — try again in a moment or sign out and back in.', 'Aún no hay sesión segura — inténtelo de nuevo en un momento o cierre sesión y vuelva a entrar.', "Pas encore de session sécurisée — réessayez dans un instant ou reconnectez-vous."]
  };
  const LANGS = ['pt', 'en', 'es', 'fr'];
  const lang = () => { try { const l = typeof currentLang !== 'undefined' ? currentLang : 'pt'; return LANGS.includes(l) ? l : 'pt'; } catch(e) { return 'pt'; } };
  function T(key, ...args){
    let s;
    if(TX[key]) s = TX[key][LANGS.indexOf(lang())];
    else { try { const e = I18N_DICT[key]; s = e ? (e[lang()] || e.pt) : key; } catch(x) { s = key; } }
    args.forEach((a, i) => { s = s.split('{' + i + '}').join(a); });
    return s;
  }

  const QUICK = ['👍', '🔥', '⛏️', '😂', '🚀', '❤️'];
  const CHAT_EMOJIS = ['😀','😂','🥳','🔥','⚡','⛏️','🪙','💰','📈','🚀','🌙','❤️','👍','👏','🙌','💪','🎯','💎','🏆','🤝','😎','🤔','💡','🛠️','🛡️','☕','🎉','✅','🌍'];
  const PAGE = 100;
  const CID = (() => { try { let v = localStorage.getItem('hc_chat_cid'); if(!v){ v = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('hc_chat_cid', v); } return v; } catch(e){ return 'a' + Math.random().toString(36).slice(2); } })();
  const _c$ = id => document.getElementById(id);
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch(e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} };

  const S = {
    msgs: new Map(), reacts: {}, typing: {}, typingSeen: {}, online: {}, local: 0,
    live: false, hasMore: true, loadingOlder: false, open: false, unread: 0, mention: false,
    lastRead: lsGet('hc_chat_lastread', 0), firstUnreadKey: null, replyTo: null, editKey: null, search: '', stick: true, keepScroll: null,
    admin: false, uid: null, sent: [], lastTypingSet: 0, typingTimer: 0, denied: false,
    prefs: Object.assign({ sound: true, notif: false, announce: true, previews: true, words: '', size: 'normal', w: 0, h: 0 }, lsGet('hc_chat_prefs', {})),
    muted: new Set(lsGet('hc_chat_muted', [])), annAt: {}
  };
  const savePrefs = () => lsSet('hc_chat_prefs', S.prefs);
  const saveMuted = () => lsSet('hc_chat_muted', [...S.muted]);

  let _db = null, _presRef = null, _msgRef = null, _reactRef = null, _typRef = null, _inited = false, _connecting = false, _uiWired = false, _ac = null;

  function _ccEmail(){ try{ const s = window.getCcSession && window.getCcSession(); return (s && s.email) ? s.email : ''; }catch(e){ return ''; } }
  function _ccCfg(){ try{ return window.getCcCfg && window.getCcCfg(); }catch(e){ return {}; } }
  function emailToNick(email){ try{ return email.split('@')[0]; }catch(e){ return email || 'Anónimo'; } }
  const myNick = () => emailToNick(_ccEmail() || 'Anónimo');
  function escHtml(s){ const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function fmtTime(ts){
    const loc = { pt: 'pt-PT', en: 'en-US', es: 'es-ES', fr: 'fr-FR' }[lang()];
    return new Date(ts).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  }
  function dayLabel(ts){
    const d = new Date(ts), n = new Date(), y = new Date(Date.now() - 864e5);
    if(d.toDateString() === n.toDateString()) return T('today');
    if(d.toDateString() === y.toDateString()) return T('yesterday');
    return d.toLocaleDateString({ pt: 'pt-PT', en: 'en-US', es: 'es-ES', fr: 'fr-FR' }[lang()], { day: 'numeric', month: 'long', year: d.getFullYear() === n.getFullYear() ? undefined : 'numeric' });
  }
  const hue = nick => { let h = 0; for(const c of String(nick)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const initials = nick => (String(nick).replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2) || '?').toUpperCase();
  const avatarHtml = nick => '<span class="chat-av" style="--h:' + hue(nick) + '">' + escHtml(initials(nick)) + '</span>';

  /* ---- mensagens locais (avisos que só o próprio vê) ---- */
  function note(text){
    const k = 'local-' + (++S.local);
    S.msgs.set(k, { key: k, type: 'system', text, ts: Date.now(), local: true });
    S.stick = true; queueRender();
  }
  function denied(){ if(!S.denied){ S.denied = true; note(T('perm')); } }

  /* ---- texto: links, imagens, menções e palavras bloqueadas ---- */
  const blockedWords = () => String(S.prefs.words || '').split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
  function maskWords(txt){
    let out = txt;
    blockedWords().forEach(w => { out = out.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => '•'.repeat(m.length)); });
    return out;
  }
  const IMG_RE = /\.(png|jpe?g|gif|webp)(\?[^\s]*)?$/i;
  function richText(raw){
    const txt = maskWords(String(raw || ''));
    const urls = txt.match(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g) || [];
    let html = escHtml(txt)
      .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g, u => '<a href="' + u + '" target="_blank" rel="noopener noreferrer nofollow">' + u + '</a>')
      .replace(/(^|\s)@([\p{L}\p{N}_.\-]{2,24})/gu, (m, pre, nick) => pre + '<span class="chat-mention' + (nick.toLowerCase() === myNick().toLowerCase() ? ' me' : '') + '">@' + nick + '</span>');
    const img = S.prefs.previews ? urls.find(u => /^https:\/\//i.test(u) && IMG_RE.test(u)) : null;
    if(img){ const a = document.createElement('a'); a.href = img; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow'; a.className = 'chat-img';
      const im = document.createElement('img'); im.loading = 'lazy'; im.referrerPolicy = 'no-referrer'; im.alt = ''; im.src = img; a.appendChild(im); html += a.outerHTML; }
    return html;
  }
  const mentionsMe = txt => new RegExp('(^|\\s)@' + myNick().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}_])', 'iu').test(String(txt || ''));

  /* ---- desenho da lista de mensagens (refaz tudo; são poucas centenas) ---- */
  let _rq = 0;
  function queueRender(){ if(_rq) return; _rq = requestAnimationFrame(() => { _rq = 0; render(); }); }
  const isSelfMsg = m => m.cid === CID || (S.uid && m.uid === S.uid);
  function visible(m){
    if(m.type !== 'system' && m.author && S.muted.has(String(m.author).toLowerCase()) && !isSelfMsg(m)) return false;
    const q = S.search.trim().toLowerCase();
    if(q) return m.type !== 'system' && (String(m.text || '') + ' ' + String(m.author || '')).toLowerCase().includes(q);
    return true;
  }
  function cardHtml(c){
    const row = (l, v) => '<span>' + escHtml(l) + '</span><b>' + escHtml(String(v)) + '</b>';
    return '<div class="chat-card ' + escHtml(String(c.s || 'ok')) + '"><div class="chat-card-h">⛏️ ' + escHtml(String(c.n || '')) + '</div><div class="chat-card-g">' +
      row('Hashrate', c.h || '—') + row('°C', c.t != null ? c.t : '—') + row('J/TH', c.e != null ? c.e : '—') + row('W', c.p != null ? c.p : '—') + '</div></div>';
  }
  function reactsHtml(key){
    const r = S.reacts[key];
    if(!r) return '';
    const chips = Object.keys(r).map(e => { const ids = Object.keys(r[e] || {}); return ids.length ? '<button type="button" class="chat-react' + (ids.includes(CID) ? ' mine' : '') + '" data-act="toggle" data-emo="' + escHtml(e) + '">' + escHtml(e) + ' <b>' + ids.length + '</b></button>' : ''; }).join('');
    return chips ? '<div class="chat-reacts">' + chips + '</div>' : '';
  }
  function msgEl(m, prev){
    const self = isSelfMsg(m);
    if(m.type === 'system'){
      const d = document.createElement('div'); d.className = 'chat-msg chat-msg-sys'; d.textContent = m.text; return d;
    }
    if(m.type === 'event'){
      const d = document.createElement('div'); d.className = 'chat-event'; d.dataset.k = m.key;
      d.innerHTML = '<span>' + escHtml(maskWords(m.text || '')) + '</span><time>' + fmtTime(m.ts) + '</time>'; return d;
    }
    const grouped = prev && prev.type !== 'system' && prev.type !== 'event' && prev.author === m.author && m.ts - prev.ts < 180000 && !m.reply;
    const mention = !self && mentionsMe(m.text);
    const row = document.createElement('div');
    row.className = 'chat-row ' + (self ? 'self' : 'other') + (grouped ? ' grouped' : '') + (mention ? ' mention' : '');
    row.dataset.k = m.key;
    const canEdit = self && !m.local, canDel = (self || S.admin) && !m.local;
    const tools = '<div class="chat-tools"><button type="button" data-act="reply" title="' + T('reply') + '" aria-label="' + T('reply') + '">↩</button>' +
      '<button type="button" data-act="react" title="' + T('react') + '" aria-label="' + T('react') + '">😊</button>' +
      (canEdit && !m.card ? '<button type="button" data-act="edit" title="' + T('edit') + '" aria-label="' + T('edit') + '">✎</button>' : '') +
      (canDel ? '<button type="button" data-act="del" title="' + T('del') + '" aria-label="' + T('del') + '">🗑</button>' : '') +
      (!self ? '<button type="button" data-act="mute" title="' + T('mute') + '" aria-label="' + T('mute') + '">🔇</button>' : '') + '</div>';
    const reply = m.reply ? '<div class="chat-reply" data-act="jump" data-rk="' + escHtml(String(m.reply.k || '')) + '"><b>' + escHtml(String(m.reply.a || '')) + '</b> ' + escHtml(maskWords(String(m.reply.t || ''))) + '</div>' : '';
    row.innerHTML = (self ? '' : (grouped ? '<span class="chat-av ghost"></span>' : avatarHtml(m.author))) +
      '<div class="chat-msg ' + (self ? 'chat-msg-self' : 'chat-msg-other') + '">' +
      (grouped || self ? '' : '<div class="chat-msg-author" style="--h:' + hue(m.author) + '">' + escHtml(String(m.author || '???')) + '</div>') + reply +
      '<div class="chat-msg-text">' + richText(m.text) + '</div>' + (m.card ? cardHtml(m.card) : '') +
      '<div class="chat-msg-time">' + (m.edited ? T('edited') + ' ' : '') + fmtTime(m.ts) + '</div>' + reactsHtml(m.key) + '</div>' + tools;
    return row;
  }
  function render(){
    const box = _c$('chatMessages');
    if(!box) return;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 70, prevH = box.scrollHeight, prevTop = box.scrollTop;
    const list = [...S.msgs.values()].filter(visible).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const frag = document.createDocumentFragment();
    if(!list.length){
      const e = document.createElement('div'); e.className = 'chat-empty'; e.id = 'chatEmpty';
      e.innerHTML = '<span class="chat-empty-icon">💬</span><span class="chat-empty-text">' + escHtml(T('chat_vazio')) + '</span>'; frag.appendChild(e);
    } else {
      if(S.hasMore && !S.search){ const b = document.createElement('button'); b.type = 'button'; b.className = 'chat-more'; b.dataset.act = 'older'; b.textContent = T('older'); frag.appendChild(b); }
      let day = '', prev = null;
      list.forEach(m => {
        const d = new Date(m.ts || Date.now()).toDateString();
        if(d !== day){ day = d; prev = null; const s = document.createElement('div'); s.className = 'chat-day'; s.textContent = dayLabel(m.ts || Date.now()); frag.appendChild(s); }
        if(m.key === S.firstUnreadKey){ const u = document.createElement('div'); u.className = 'chat-unread-line'; u.textContent = T('new_msgs'); frag.appendChild(u); }
        frag.appendChild(msgEl(m, prev));
        prev = m;
      });
    }
    box.replaceChildren(frag);
    if(S.keepScroll){ box.scrollTop = box.scrollHeight - S.keepScroll + prevTop; S.keepScroll = null; }
    else if(S.stick || nearBottom){ box.scrollTop = box.scrollHeight; S.stick = false; }
    else box.scrollTop = prevTop;
    const info = _c$('chatSearchInfo');
    if(info) info.textContent = S.search.trim() ? T('search_info', list.length) : '';
  }

  /* ---- não lidas, som e notificações ---- */
  function updateBadge(){
    const b = _c$('chatBadge');
    if(!b) return;
    b.textContent = S.unread > 0 ? (S.mention ? '@' + S.unread : S.unread) : '';
    b.classList.toggle('mention', S.mention);
  }
  function beep(strong){
    if(!S.prefs.sound) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return;
      _ac = _ac || new AC();
      const o = _ac.createOscillator(), g = _ac.createGain(), t0 = _ac.currentTime;
      o.type = 'sine'; o.frequency.value = strong ? 880 : 640;
      g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.07, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + .26);
      o.connect(g); g.connect(_ac.destination); o.start(t0); o.stop(t0 + .27);
    } catch(e) {}
  }
  function desktopNote(m, strong){
    if(!S.prefs.notif || !('Notification' in window) || Notification.permission !== 'granted') return;
    try { new Notification((strong ? '@ ' : '💬 ') + (m.author || ''), { body: String(m.text || '').slice(0, 140), tag: 'hc-chat' }); } catch(e) {}
  }
  function onIncoming(m){
    if(isSelfMsg(m) || S.muted.has(String(m.author || '').toLowerCase())) return;
    const strong = mentionsMe(m.text), away = !S.open || document.hidden;
    if(away){
      S.unread++; if(strong) S.mention = true; updateBadge();
      beep(strong); desktopNote(m, strong);
    } else beep(false);
  }
  function markRead(){
    const last = [...S.msgs.values()].reduce((mx, m) => m.local ? mx : Math.max(mx, m.ts || 0), 0);
    S.lastRead = Math.max(S.lastRead, last, Date.now() - 1000); lsSet('hc_chat_lastread', S.lastRead);
  }

  /* ---- ligação à base de dados ---- */
  function addMsg(snap){
    const d = snap.val(); if(!d || typeof d !== 'object') return;
    const m = Object.assign({ author: '???', text: '', ts: Date.now(), type: 'msg' }, d, { key: snap.key });
    if(typeof m.ts !== 'number') m.ts = Date.now();
    const isNew = !S.msgs.has(snap.key);
    S.msgs.set(snap.key, m);
    if(S.live && isNew && m.type !== 'system'){ onIncoming(m); if(S.open) S.stick = true; }
    queueRender();
  }
  function listenMessages(){
    const q = _msgRef.orderByChild('ts').limitToLast(PAGE);
    q.on('child_added', addMsg);
    q.on('child_changed', addMsg);
    q.on('child_removed', snap => {
      // com limitToLast, as mais antigas também "saem" da janela quando chegam novas: só apaga se já não existir
      _msgRef.child(snap.key).once('value').then(s => { if(!s.exists()){ S.msgs.delete(snap.key); queueRender(); } }).catch(() => {});
    });
    q.once('value').then(s => {
      S.hasMore = s.numChildren() >= PAGE; S.live = true;
      if(!S.lastRead){ S.lastRead = Date.now(); lsSet('hc_chat_lastread', S.lastRead); }
      S.unread = [...S.msgs.values()].filter(m => !m.local && m.ts > S.lastRead && !isSelfMsg(m) && !S.muted.has(String(m.author || '').toLowerCase())).length;
      S.mention = [...S.msgs.values()].some(m => !m.local && m.ts > S.lastRead && !isSelfMsg(m) && mentionsMe(m.text));
      updateBadge(); S.stick = true; queueRender();
    }).catch(() => { S.live = true; });
  }
  async function loadOlder(){
    if(S.loadingOlder || !_msgRef) return;
    const real = [...S.msgs.values()].filter(m => !m.local);
    if(!real.length) return;
    S.loadingOlder = true;
    const oldest = Math.min(...real.map(m => m.ts || Infinity));
    try {
      const s = await _msgRef.orderByChild('ts').endAt(oldest - 1).limitToLast(PAGE).once('value');
      const box = _c$('chatMessages'); S.keepScroll = box ? box.scrollHeight : null;
      s.forEach(c => { const d = c.val(); if(d && typeof d === 'object' && !S.msgs.has(c.key)) S.msgs.set(c.key, Object.assign({ author: '???', text: '', ts: 0, type: 'msg' }, d, { key: c.key })); });
      S.hasMore = s.numChildren() >= PAGE;
      queueRender();
    } catch(e) { note(T('load_fail')); }
    S.loadingOlder = false;
  }
  function listenReactions(){
    const q = _reactRef.orderByKey().limitToLast(300);
    const up = snap => { S.reacts[snap.key] = snap.val() || {}; queueRender(); };
    q.on('child_added', up); q.on('child_changed', up);
    q.on('child_removed', snap => { delete S.reacts[snap.key]; queueRender(); }, () => {});
  }
  function listenTyping(){
    _typRef.on('value', snap => {
      const v = snap.val() || {}, now = Date.now();
      Object.keys(v).forEach(cid => { if(cid !== CID && (!S.typing[cid] || S.typing[cid].ts !== v[cid].ts)) S.typingSeen[cid] = now; });
      S.typing = v; renderTyping();
    }, () => {});
  }
  function renderTyping(){
    const el = _c$('chatTyping');
    if(!el) return;
    const now = Date.now();
    const names = Object.keys(S.typing).filter(cid => cid !== CID && now - (S.typingSeen[cid] || 0) < 6000).map(cid => S.typing[cid].nick || '?').filter(n => !S.muted.has(String(n).toLowerCase()));
    el.textContent = !names.length ? '' : names.length === 1 ? T('typing1', names[0]) : names.length === 2 ? T('typing2', names[0], names[1]) : T('typingN');
  }
  function listenPresence(){
    const myEmail = _ccEmail(); if(!myEmail) return;
    const mine = _presRef.child(CID);
    mine.onDisconnect().remove();
    const beat = () => mine.set({ nick: emailToNick(myEmail), ts: firebase.database.ServerValue.TIMESTAMP });
    beat(); setInterval(beat, 25000);
    _presRef.on('value', snap => {
      S.online = snap.val() || {};
      const users = Object.values(S.online), cnt = _c$('chatOnlineCount'), list = _c$('chatOnlineUsers');
      if(cnt) cnt.textContent = users.length;
      if(list){
        list.replaceChildren();
        users.forEach(u => {
          const el = document.createElement('div'); el.className = 'chat-sidebar-user';
          el.innerHTML = avatarHtml(u.nick || '?') + '<span>' + escHtml(u.nick || '???') + (String(u.nick) === myNick() ? ' <em>(' + T('me') + ')</em>' : '') + '</span>';
          list.appendChild(el);
        });
      }
    });
  }
  async function connectChatDb(){
    if(_inited || _connecting) return;
    if(!_ccEmail()){ note(T('chat_sem_auth')); return; }
    _connecting = true;
    let dbUrl = 'https://dashboard-a07d4-default-rtdb.firebaseio.com';
    const c = _ccCfg();
    if(c && c.databaseURL) dbUrl = c.databaseURL;
    try {
      window.hcFbInit((c && c.apiKey) ? c.apiKey : '', dbUrl);
      const fbUser = await Promise.race([
        new Promise(res => { const off = firebase.auth().onAuthStateChanged(u => { off(); res(u); }); }),
        new Promise(res => setTimeout(() => res(firebase.auth().currentUser || null), 6000))
      ]);
      if(!fbUser){ note(T('no_session')); return; }
      S.uid = fbUser.uid;
      _db = firebase.database();
      _presRef = _db.ref('chat/presence'); _msgRef = _db.ref('chat/messages'); _reactRef = _db.ref('chat/reactions'); _typRef = _db.ref('chat/typing');
      listenMessages(); listenPresence(); listenReactions(); listenTyping();
      const admins = c && Array.isArray(c.adminEmails) ? c.adminEmails.map(x => String(x).toLowerCase()) : [];
      S.admin = admins.includes(String(_ccEmail()).toLowerCase());
      _db.ref('chat/admins/' + S.uid).once('value').then(s => { if(s.val() === true){ S.admin = true; queueRender(); } }).catch(() => {});
      _inited = true;
    } catch(e){
      console.warn('[chat] Firebase RTDB init failed:', e);
      note(T('chat_db_off'));
    } finally { _connecting = false; }
  }

  /* ---- enviar, editar, apagar e reagir ---- */
  const deny = e => /permission|PERMISSION/.test(String(e && (e.code || e.message))) ;
  function spamCheck(txt){
    const now = Date.now();
    S.sent = S.sent.filter(x => now - x.t < 20000);
    if(S.sent.length >= 5) return T('rate');
    if((txt.match(/https?:\/\//gi) || []).length > 2) return T('links');
    if(S.sent.some(x => x.txt === txt && now - x.t < 30000)) return T('dup');
    const low = txt.toLowerCase();
    if(blockedWords().some(w => low.includes(w))) return T('blocked');
    return '';
  }
  async function pushMessage(base, extra){
    const full = Object.assign({}, base, extra || {});
    try { await _msgRef.push(full); return true; }
    catch(e){
      if(Object.keys(extra || {}).length){ try { await _msgRef.push(base); return true; } catch(e2) { e = e2; } }
      console.warn('[chat] send error', e); note(T('send_fail')); return false;
    }
  }
  function baseMsg(text){ return { author: myNick(), text, ts: firebase.database.ServerValue.TIMESTAMP, cid: CID }; }
  function stateOf(r){ return !r || !r.online ? 'off' : Number(r.temp) >= 75 ? 'hot' : Number(r.temp) >= 65 ? 'warm' : 'ok'; }
  function totals(){
    let ghs = 0, on = 0, w = 0;
    (typeof devices !== 'undefined' ? devices : []).forEach(d => { const r = typeof readings !== 'undefined' ? readings[d.id] : null; if(r && r.online){ on++; w += Number(r.power) || 0; if(typeof algoGroupOf !== 'function' || algoGroupOf(r) === 'sha256') ghs += Number(r.hashrate) || 0; } });
    return { ghs, on, total: (typeof devices !== 'undefined' ? devices : []).length, w };
  }
  const fmtHash = ghs => { try { const f = formatHashrate(ghs); return f.value + ' ' + f.unit; } catch(e) { return ghs.toFixed(1) + ' GH/s'; } };
  async function runCommand(cmd){
    const c = cmd.toLowerCase().split(/\s+/)[0];
    if(['/ajuda', '/help', '/aide', '/ayuda', '/?'].includes(c)){ note(T('cmd_help')); return true; }
    if(c === '/hash'){
      const t = totals();
      if(!t.on){ note(T('cmd_hash_none')); return true; }
      await pushMessage(baseMsg(T('cmd_hash', fmtHash(t.ghs), t.on, t.total, Math.round(t.w))), S.uid ? { uid: S.uid } : {});
      return true;
    }
    if(c === '/btc'){
      const eur = typeof currentRates !== 'undefined' && currentRates && currentRates.btc_eur, dd = typeof difficultyData !== 'undefined' && difficultyData;
      if(!eur || !dd || !dd.currentDifficulty){ note(T('cmd_btc_wait')); return true; }
      let df = String(dd.currentDifficulty);
      try { const f = formatDiff(dd.currentDifficulty); df = f.value + ' ' + f.unit; } catch(e) {}
      const ch = isFinite(dd.difficultyChange) ? ' (' + (dd.difficultyChange >= 0 ? '+' : '') + Number(dd.difficultyChange).toFixed(2) + '%)' : '';
      await pushMessage(baseMsg(T('cmd_btc', Math.round(eur).toLocaleString(), df, ch)), S.uid ? { uid: S.uid } : {});
      return true;
    }
    return false;
  }
  async function sendMessage(){
    const inp = _c$('chatInput'); if(!inp) return;
    const txt = inp.value.trim(); if(!txt) return;
    if(!_msgRef){ note(T('chat_sem_auth')); return; }
    if(txt.startsWith('/') && await runCommand(txt)){ inp.value = ''; updateSendBtn(); return; }
    if(S.editKey){
      const key = S.editKey; cancelCompose(); inp.value = '';
      try { await _msgRef.child(key).update({ text: txt, edited: firebase.database.ServerValue.TIMESTAMP }); }
      catch(e){ deny(e) ? denied() : note(T('send_fail')); }
      updateSendBtn(); return;
    }
    const bad = spamCheck(txt);
    if(bad){ note(bad); return; }
    S.sent.push({ t: Date.now(), txt });
    inp.value = ''; updateSendBtn(); clearTyping();
    const extra = {};
    if(S.uid) extra.uid = S.uid;
    if(S.replyTo) extra.reply = { k: S.replyTo.key, a: S.replyTo.author, t: String(S.replyTo.text || '').slice(0, 90) };
    cancelCompose();
    S.stick = true;
    await pushMessage(baseMsg(txt), extra);
  }
  async function shareMachine(id){
    const dev = (typeof devices !== 'undefined' ? devices : []).find(d => String(d.id) === String(id)), r = dev && readings[dev.id];
    closeShare();
    if(!dev || !_msgRef) return;
    const on = !!(r && r.online);
    const card = { n: dev.name || dev.ip || '', h: on ? fmtHash(Number(r.hashrate) || 0) : '—', t: on && r.temp ? Math.round(Number(r.temp) * 10) / 10 : null, e: on && r.efficiency ? Math.round(Number(r.efficiency) * 10) / 10 : null, p: on && r.power ? Math.round(Number(r.power)) : null, s: stateOf(r) };
    const extra = { card }; if(S.uid) extra.uid = S.uid;
    S.stick = true;
    await pushMessage(baseMsg('⛏️ ' + card.n + ': ' + card.h + (card.t != null ? ' · ' + card.t + ' °C' : '')), extra);
  }
  async function toggleReact(key, emo){
    if(!_reactRef) return;
    const mine = !!(S.reacts[key] && S.reacts[key][emo] && S.reacts[key][emo][CID]);
    const ref = _reactRef.child(key).child(emo).child(CID);
    S.reacts[key] = S.reacts[key] || {}; S.reacts[key][emo] = S.reacts[key][emo] || {};
    if(mine) delete S.reacts[key][emo][CID]; else S.reacts[key][emo][CID] = true;
    queueRender();
    try { await (mine ? ref.remove() : ref.set(true)); }
    catch(e){ if(mine) S.reacts[key][emo][CID] = true; else delete S.reacts[key][emo][CID]; queueRender(); deny(e) ? denied() : 0; }
  }
  async function deleteMsg(key){
    if(!_msgRef || !confirm(T('del_confirm'))) return;
    try { await _msgRef.child(key).remove(); S.msgs.delete(key); queueRender(); _reactRef && _reactRef.child(key).remove().catch(() => {}); }
    catch(e){ deny(e) ? denied() : note(T('send_fail')); }
  }

  /* ---- "a escrever…" ---- */
  function clearTyping(){ clearTimeout(S.typingTimer); S.lastTypingSet = 0; if(_typRef) _typRef.child(CID).remove().catch(() => {}); }
  function pingTyping(){
    if(!_typRef) return;
    const now = Date.now();
    if(now - S.lastTypingSet > 2500){
      S.lastTypingSet = now;
      const r = _typRef.child(CID);
      r.onDisconnect().remove();
      r.set({ nick: myNick(), ts: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
    }
    clearTimeout(S.typingTimer); S.typingTimer = setTimeout(clearTyping, 4000);
  }

  /* ---- compor: resposta, edição, menções e partilha ---- */
  function composeBar(){
    const bar = _c$('chatReplyBar');
    if(!bar) return;
    const m = S.editKey ? S.msgs.get(S.editKey) : S.replyTo;
    bar.hidden = !m;
    if(!m){ bar.replaceChildren(); return; }
    bar.innerHTML = '<span>' + escHtml(S.editKey ? T('editing') : T('replying', m.author || '')) + ' <em>' + escHtml(String(m.text || '').slice(0, 70)) + '</em></span><button type="button" data-act="cancel" aria-label="' + T('cancel') + '">✕</button>';
  }
  function cancelCompose(){ S.replyTo = null; S.editKey = null; composeBar(); }
  function updateSendBtn(){ const inp = _c$('chatInput'), btn = _c$('chatSendBtn'); if(btn) btn.disabled = !(inp && inp.value.trim()); }
  function mentionList(){
    const box = _c$('chatMentions'), inp = _c$('chatInput');
    if(!box || !inp) return;
    const m = inp.value.slice(0, inp.selectionStart == null ? inp.value.length : inp.selectionStart).match(/(^|\s)@([^\s@]{0,24})$/);
    if(!m){ box.hidden = true; return; }
    const q = m[2].toLowerCase(), names = new Set();
    Object.values(S.online).forEach(u => u && u.nick && names.add(u.nick));
    S.msgs.forEach(x => { if(x.author && x.type === 'msg') names.add(x.author); });
    const list = [...names].filter(n => n.toLowerCase().startsWith(q) && n !== myNick()).slice(0, 6);
    box.hidden = !list.length;
    box.innerHTML = list.map(n => '<button type="button" data-nick="' + escHtml(n) + '">' + avatarHtml(n) + '@' + escHtml(n) + '</button>').join('');
  }
  function pickMention(nick){
    const inp = _c$('chatInput');
    if(!inp) return;
    const pos = inp.selectionStart == null ? inp.value.length : inp.selectionStart;
    const head = inp.value.slice(0, pos).replace(/@[^\s@]{0,24}$/, '@' + nick + ' ');
    inp.value = head + inp.value.slice(pos); inp.focus(); inp.setSelectionRange(head.length, head.length);
    _c$('chatMentions').hidden = true; updateSendBtn();
  }
  function openShare(){
    const box = _c$('chatShare');
    if(!box) return;
    if(!box.hidden){ closeShare(); return; }
    const list = typeof devices !== 'undefined' ? devices : [];
    box.innerHTML = '<div class="chat-pop-title">' + escHtml(T('share_title')) + '</div>' + (list.length ? list.map(d => {
      const r = readings[d.id], on = !!(r && r.online);
      return '<button type="button" data-share="' + escHtml(String(d.id)) + '"><i class="' + stateOf(r) + '"></i><b>' + escHtml(d.name || d.ip || '') + '</b><span>' + (on ? escHtml(fmtHash(Number(r.hashrate) || 0)) : '—') + '</span></button>';
    }).join('') : '<div class="chat-pop-empty">' + escHtml(T('share_none')) + '</div>');
    box.hidden = false;
  }
  function closeShare(){ const b = _c$('chatShare'); if(b) b.hidden = true; }

  /* ---- definições e pesquisa ---- */
  function settingsHtml(){
    const ck = (k, label) => '<label><input type="checkbox" data-set="' + k + '"' + (S.prefs[k] ? ' checked' : '') + '><span>' + escHtml(T(label)) + '</span></label>';
    return ck('sound', 'set_sound') + ck('notif', 'set_notif') + ck('announce', 'set_announce') + ck('previews', 'set_previews') +
      '<label class="col"><span>' + escHtml(T('set_words')) + '</span><input type="text" data-set="words" value="' + escHtml(S.prefs.words || '') + '" maxlength="200"></label>' +
      '<div class="chat-set-row"><span>' + escHtml(T('set_muted', S.muted.size)) + '</span>' + (S.muted.size ? '<button type="button" data-set-act="unmute">' + escHtml(T('set_unmute')) + '</button>' : '') + '</div>' +
      '<div class="chat-set-note">' + escHtml(T('set_rules')) + '</div>';
  }
  function toggleSettings(){
    const p = _c$('chatSettings');
    if(!p) return;
    p.hidden = !p.hidden;
    if(!p.hidden) p.innerHTML = settingsHtml();
  }
  function toggleSearch(force){
    const s = _c$('chatSearch'), i = _c$('chatSearchInput');
    if(!s) return;
    s.hidden = force != null ? !force : !s.hidden;
    if(s.hidden){ S.search = ''; if(i) i.value = ''; queueRender(); } else if(i) i.focus();
  }

  /* ---- tamanho do painel ---- */
  function applySize(){
    const p = _c$('chatPanel');
    if(!p) return;
    p.classList.toggle('wide', S.prefs.size === 'wide'); p.classList.toggle('full', S.prefs.size === 'full');
    if(S.prefs.size === 'normal' && S.prefs.w && S.prefs.h){ p.style.width = S.prefs.w + 'px'; p.style.height = S.prefs.h + 'px'; }
    else { p.style.width = ''; p.style.height = ''; }
  }
  function wireGrip(){
    const g = _c$('chatGrip'), p = _c$('chatPanel');
    if(!g || !p) return;
    let st = null;
    g.addEventListener('pointerdown', e => { if(S.prefs.size !== 'normal') return; const r = p.getBoundingClientRect(); st = { x: e.clientX, y: e.clientY, w: r.width, h: r.height }; g.setPointerCapture(e.pointerId); e.preventDefault(); });
    g.addEventListener('pointermove', e => {
      if(!st) return;
      S.prefs.w = Math.round(Math.max(300, Math.min(window.innerWidth - 16, st.w + (st.x - e.clientX))));
      S.prefs.h = Math.round(Math.max(340, Math.min(window.innerHeight - 150, st.h + (st.y - e.clientY))));
      applySize();
    });
    g.addEventListener('pointerup', () => { if(st){ st = null; savePrefs(); } });
    g.addEventListener('dblclick', () => { S.prefs.w = S.prefs.h = 0; savePrefs(); applySize(); });
  }

  /* ---- texto fixo do painel (muda com o idioma) ---- */
  let _lastLang = '';
  function applyTexts(){
    _lastLang = lang();
    const set = (id, k) => { const n = _c$(id); if(n){ n.title = T(k); n.setAttribute('aria-label', T(k)); } };
    set('chatSearchBtn', 't_search'); set('chatSetBtn', 't_settings'); set('chatSizeBtn', 't_size'); set('chatCloseBtn', 't_close'); set('chatShareBtn', 't_share'); set('chatEmojiBtn', 't_emoji');
    const inp = _c$('chatInput'); if(inp) inp.placeholder = T('chat_placeholder');
    const si = _c$('chatSearchInput'); if(si) si.placeholder = T('search_ph');
    const fab = _c$('chatFab'); if(fab) fab.title = T('chat_titulo');
    const sp = _c$('chatSettings'); if(sp && !sp.hidden) sp.innerHTML = settingsHtml();
    renderTyping(); queueRender();
  }

  /* ---- abrir, fechar e ligar os botões ---- */
  function togglePanel(){
    const panel = _c$('chatPanel');
    if(!panel) return;
    S.open = !S.open;
    panel.classList.toggle('open', S.open);
    if(S.open){
      S.firstUnreadKey = ([...S.msgs.values()].filter(m => !m.local && m.ts > S.lastRead && !isSelfMsg(m)).sort((a, b) => a.ts - b.ts)[0] || {}).key || null;
      S.unread = 0; S.mention = false; updateBadge();
      connectChatDb(); S.stick = true; queueRender();
      setTimeout(() => { const i = _c$('chatInput'); if(i) i.focus(); }, 100);
    } else { markRead(); S.firstUnreadKey = null; closeShare(); const sp = _c$('chatSettings'); if(sp) sp.hidden = true; clearTyping(); }
  }
  function wireUI(){
    if(_uiWired) return; _uiWired = true;
    const p = _c$('chatEmojiPicker');
    if(p){ CHAT_EMOJIS.forEach(em => { const b = document.createElement('button'); b.className = 'chat-emoji-pick'; b.textContent = em; b.onclick = () => { const i = _c$('chatInput'); if(i){ i.value += em; i.focus(); updateSendBtn(); } p.classList.remove('open'); }; p.appendChild(b); }); }
    applyTexts(); applySize(); wireGrip();
    _c$('chatFab')?.addEventListener('click', togglePanel);
    _c$('chatCloseBtn')?.addEventListener('click', togglePanel);
    _c$('chatEmojiBtn')?.addEventListener('click', () => { closeShare(); _c$('chatEmojiPicker')?.classList.toggle('open'); });
    _c$('chatSendBtn')?.addEventListener('click', sendMessage);
    _c$('chatShareBtn')?.addEventListener('click', () => { _c$('chatEmojiPicker')?.classList.remove('open'); openShare(); });
    _c$('chatSearchBtn')?.addEventListener('click', () => toggleSearch());
    _c$('chatSetBtn')?.addEventListener('click', toggleSettings);
    _c$('chatSizeBtn')?.addEventListener('click', () => { S.prefs.size = S.prefs.size === 'normal' ? 'wide' : S.prefs.size === 'wide' ? 'full' : 'normal'; savePrefs(); applySize(); S.stick = true; queueRender(); });
    _c$('chatSearchInput')?.addEventListener('input', e => { S.search = e.target.value; queueRender(); });
    const inp = _c$('chatInput');
    if(inp){
      inp.addEventListener('keydown', e => {
        if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }
        else if(e.key === 'Escape'){ if(S.editKey) inp.value = ''; cancelCompose(); _c$('chatMentions').hidden = true; updateSendBtn(); }
        else if(e.key === 'Tab' && !_c$('chatMentions').hidden){ const b = _c$('chatMentions').querySelector('button'); if(b){ e.preventDefault(); pickMention(b.dataset.nick); } }
        else if(e.key === 'ArrowUp' && !inp.value){ const mine = [...S.msgs.values()].filter(m => isSelfMsg(m) && !m.local && !m.card && m.type === 'msg').sort((a, b) => b.ts - a.ts)[0]; if(mine){ e.preventDefault(); startEdit(mine.key); } }
      });
      inp.addEventListener('input', () => { updateSendBtn(); mentionList(); if(inp.value.trim() && !inp.value.startsWith('/')) pingTyping(); });
    }
    _c$('chatMentions')?.addEventListener('click', e => { const b = e.target.closest('[data-nick]'); if(b) pickMention(b.dataset.nick); });
    _c$('chatShare')?.addEventListener('click', e => { const b = e.target.closest('[data-share]'); if(b) shareMachine(b.dataset.share); });
    _c$('chatReplyBar')?.addEventListener('click', e => { if(e.target.closest('[data-act="cancel"]')){ const i = _c$('chatInput'); if(i && S.editKey) i.value = ''; cancelCompose(); if(i){ i.focus(); updateSendBtn(); } } });
    _c$('chatSettings')?.addEventListener('change', e => {
      const k = e.target.dataset.set;
      if(!k) return;
      if(k === 'words'){ S.prefs.words = e.target.value; }
      else {
        S.prefs[k] = e.target.checked;
        if(k === 'notif' && e.target.checked){
          if(!('Notification' in window)){ S.prefs.notif = false; e.target.checked = false; }
          else if(Notification.permission !== 'granted') Notification.requestPermission().then(r => { if(r !== 'granted'){ S.prefs.notif = false; e.target.checked = false; savePrefs(); } });
        }
      }
      savePrefs(); queueRender();
    });
    _c$('chatSettings')?.addEventListener('click', e => { if(e.target.closest('[data-set-act="unmute"]')){ S.muted.clear(); saveMuted(); toggleSettings(); toggleSettings(); queueRender(); } });
    // ações nas mensagens (responder, reagir, editar, apagar, silenciar, saltar para a citada, carregar antigas)
    _c$('chatMessages')?.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if(!b) return;
      const row = b.closest('[data-k]'), key = row && row.dataset.k, m = key && S.msgs.get(key), act = b.dataset.act;
      if(act === 'older'){ loadOlder(); return; }
      if(act === 'jump'){ const t = _c$('chatMessages').querySelector('[data-k="' + CSS.escape(b.dataset.rk) + '"]'); if(t){ t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1600); } return; }
      if(!m) return;
      if(act === 'reply'){ S.editKey = null; S.replyTo = m; composeBar(); _c$('chatInput')?.focus(); }
      else if(act === 'react'){ pickReaction(row, key); }
      else if(act === 'toggle'){ toggleReact(key, b.dataset.emo); }
      else if(act === 'edit'){ startEdit(key); }
      else if(act === 'del'){ deleteMsg(key); }
      else if(act === 'mute'){ S.muted.add(String(m.author).toLowerCase()); saveMuted(); note(T('muted_note', m.author)); }
      else if(act === 'quick'){ toggleReact(key, b.dataset.emo); }
    });
    _c$('chatMessages')?.addEventListener('dblclick', e => { if(e.target.closest('.chat-tools,.chat-react,a')) return; const row = e.target.closest('.chat-row'); if(row){ pickReaction(row, row.dataset.k); } });
    document.addEventListener('click', e => {
      const pk = _c$('chatEmojiPicker'), b = _c$('chatEmojiBtn');
      if(pk && b && !pk.contains(e.target) && e.target !== b) pk.classList.remove('open');
      const sh = _c$('chatShare'), sb = _c$('chatShareBtn');
      if(sh && !sh.hidden && !sh.contains(e.target) && !sb.contains(e.target)) closeShare();
      const qk = document.querySelector('.chat-quick');
      if(qk && !qk.contains(e.target) && !e.target.closest('[data-act="react"]')) qk.remove();
    });
    document.addEventListener('keydown', e => { if(e.key === 'Escape' && S.open){ closeShare(); const qk = document.querySelector('.chat-quick'); if(qk) qk.remove(); } });
    setInterval(() => { if(lang() !== _lastLang) applyTexts(); if(S.open) renderTyping(); }, 1500);
    document.addEventListener('visibilitychange', () => { if(!document.hidden && S.open){ S.unread = 0; S.mention = false; updateBadge(); } });
  }
  function startEdit(key){
    const m = S.msgs.get(key), inp = _c$('chatInput');
    if(!m || !inp) return;
    S.replyTo = null; S.editKey = key; inp.value = m.text || ''; composeBar(); updateSendBtn(); inp.focus();
  }
  function pickReaction(row, key){
    document.querySelectorAll('.chat-quick').forEach(n => n.remove());
    const q = document.createElement('div'); q.className = 'chat-quick';
    q.innerHTML = QUICK.map(e => '<button type="button" data-act="quick" data-emo="' + e + '">' + e + '</button>').join('');
    q.addEventListener('click', ev => { const b = ev.target.closest('[data-emo]'); if(b){ toggleReact(key, b.dataset.emo); q.remove(); } });
    row.appendChild(q);
  }

  /* ---- anúncios automáticos (blocos e recordes), usados pelos cartões ---- */
  window.hcChatAnnounce = function(kind, machine, extra){
    try {
      if(!S.prefs.announce || !_msgRef || !_ccEmail()) return;
      const now = Date.now();
      if(now - (S.annAt[kind] || 0) < 10 * 60000) return;
      S.annAt[kind] = now;
      const text = T(kind === 'block' ? 'block_ann' : 'record_ann', myNick(), kind === 'block' ? machine : (extra || machine));
      const base = { type: 'event', author: myNick(), text, ts: firebase.database.ServerValue.TIMESTAMP, cid: CID };
      _msgRef.push(S.uid ? Object.assign(base, { uid: S.uid }) : base).catch(() => _msgRef.push(base).catch(() => {}));
    } catch(e) {}
  };

  /* Mostra o balão assim que a sessão existe, liga os botões já, e tenta a ligação à base em segundo plano */
  function autoInit(){
    if(!_ccEmail()) return;
    const fab = _c$('chatFab'); if(fab) fab.style.display = 'flex';
    wireUI();
    connectChatDb();
  }
  if(typeof window.authReady !== 'undefined'){
    window.authReady.then(() => setTimeout(autoInit, 500));
  } else {
    let pollT = setInterval(() => {
      if(_ccEmail()){ clearInterval(pollT); autoInit(); }
      if(pollT && Date.now() - (window._chatPollStart || 0) > 10000){ clearInterval(pollT); }
    }, 500);
    window._chatPollStart = Date.now();
  }
})();
