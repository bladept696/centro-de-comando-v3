
/* ===== Chat em Tempo Real (Firebase RTDB) - Balao Flutuante ===== */
(function(){
  const CHAT_EMOJIS = ['😀','😂','🥳','🔥','⚡','⛏️','🪙','💰','📈','🚀','🌙','❤️','👍','👏','🙌','💪','🎯','💎','🏆','🤝','😎','🤔','💡','🛠️','🛡️','☕','🎉','✅','🌍'];
  let _chatInited = false, _chatDb = null, _chatPresRef = null, _chatMsgRef = null, _chatOpen = false;
  let _unreadCount = 0;
  const CID = (() => { try { let v = localStorage.getItem('hc_chat_cid'); if(!v){ v = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('hc_chat_cid', v); } return v; } catch(e){ return 'a' + Math.random().toString(36).slice(2); } })();
  const _c$ = id => document.getElementById(id);

  function _ccEmail(){ try{ const s = window.getCcSession && window.getCcSession(); return (s && s.email) ? s.email : ''; }catch(e){ return ''; } }
  function _ccCfg(){ try{ return window.getCcCfg && window.getCcCfg(); }catch(e){ return {}; } }

  function chatT(key){ try{ const e = I18N_DICT[key]; if(!e) return key; const l = (typeof currentLang !== 'undefined') ? currentLang : 'pt'; return e[l] || e.pt || key; }catch(x){ return key; } }

  function formatTime(ts){
    const d = new Date(ts);
    const locMap = {pt:'pt-PT',en:'en-US',es:'es-ES',fr:'fr-FR'};
    const loc = locMap[(typeof currentLang !== 'undefined' ? currentLang : 'pt')] || 'pt-PT';
    return d.toLocaleTimeString(loc, {hour:'2-digit',minute:'2-digit'});
  }

  function emailToNick(email){ try{ return email.split('@')[0]; }catch(e){ return email || 'Anónimo'; } }
  function escHtml(s){ const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  /* Botões do chat ligados sempre (uma só vez), independentemente de a ligação ao Firebase já estar pronta */
  let _uiWired = false;
  function buildEmojiPicker(){
    const p = _c$('chatEmojiPicker'); if(!p) return;
    p.innerHTML = '';
    CHAT_EMOJIS.forEach(em => {
      const b = document.createElement('button');
      b.className = 'chat-emoji-pick';
      b.textContent = em;
      b.onclick = () => { const inp = _c$('chatInput'); if(inp){ inp.value += em; inp.focus(); _updateSendBtn(); } p.classList.remove('open'); };
      p.appendChild(b);
    });
  }

  function _updateSendBtn(){
    const inp = _c$('chatInput'), btn = _c$('chatSendBtn');
    if(btn) btn.disabled = !(inp && inp.value.trim());
  }

  function wireChatUI(){
    if(_uiWired) return; _uiWired = true;
    buildEmojiPicker();
    const inp = _c$('chatInput');
    if(inp) inp.placeholder = chatT('chat_placeholder');
    _c$('chatFab')?.addEventListener('click', toggleChatPanel);
    _c$('chatCloseBtn')?.addEventListener('click', toggleChatPanel);
    _c$('chatEmojiBtn')?.addEventListener('click', () => { _c$('chatEmojiPicker')?.classList.toggle('open'); });
    _c$('chatSendBtn')?.addEventListener('click', sendMessage);
    if(inp){ inp.addEventListener('keydown', e => { if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); } }); inp.addEventListener('input', _updateSendBtn); }
    document.addEventListener('click', e => { const p = _c$('chatEmojiPicker'), b = _c$('chatEmojiBtn'); if(p && b && !p.contains(e.target) && e.target !== b) p.classList.remove('open'); });
  }

  /* Toggle panel open/close */
  function toggleChatPanel(){
    const panel = _c$('chatPanel');
    if(!panel) return;
    _chatOpen = !_chatOpen;
    panel.classList.toggle('open', _chatOpen);
    if(_chatOpen){
      _unreadCount = 0;
      updateBadge();
      connectChatDb();
      setTimeout(() => { const inp = _c$('chatInput'); if(inp) inp.focus(); }, 100);
    }
  }

  function updateBadge(){
    const badge = _c$('chatBadge');
    if(badge) badge.textContent = _unreadCount > 0 ? _unreadCount : '';
  }

  function addMsgEl(data, isSelf){
    const empty = _c$('chatEmpty'); if(empty) empty.remove();
    const box = _c$('chatMessages'); if(!box) return;
    const div = document.createElement('div');
    if(data.type === 'system'){
      div.className = 'chat-msg chat-msg-sys';
      div.textContent = data.text;
    } else {
      div.className = 'chat-msg ' + (isSelf ? 'chat-msg-self' : 'chat-msg-other');
      const authorDiv = document.createElement('div');
      authorDiv.className = 'chat-msg-author';
      authorDiv.textContent = data.author;
      const textDiv = document.createElement('div');
      textDiv.className = 'chat-msg-text';
      textDiv.textContent = data.text;
      const timeDiv = document.createElement('div');
      timeDiv.className = 'chat-msg-time';
      timeDiv.textContent = formatTime(data.ts);
      div.appendChild(authorDiv); div.appendChild(textDiv); div.appendChild(timeDiv);
    }
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    if(!_chatOpen && data.type !== 'system'){
      _unreadCount++;
      updateBadge();
    }
  }

  async function sendMessage(){
    const inp = _c$('chatInput'); if(!inp) return;
    const txt = inp.value.trim(); if(!txt) return;
    if(!_chatMsgRef){ addMsgEl({ type: 'system', text: chatT('chat_sem_auth') }, false); return; }
    inp.value = ''; _updateSendBtn();
    const email = _ccEmail() || 'Anónimo';
    try { await _chatMsgRef.push({ author: emailToNick(email), text: txt, ts: firebase.database.ServerValue.TIMESTAMP, cid: CID }); }
    catch(e){ console.warn('[chat] send error', e); addMsgEl({ type: 'system', text: 'Não foi possível enviar: sem permissão ou sem ligação.' }, false); }
  }

  function listenMessages(){
    if(!_chatMsgRef) return;
    _chatMsgRef.orderByChild('ts').limitToLast(200).on('child_added', snap => {
      const d = snap.val(); if(!d) return;
      const isSelf = d.cid === CID;
      addMsgEl({ author: d.author || '???', text: d.text || '', ts: d.ts || Date.now(), type: d.type || 'msg' }, isSelf);
    });
  }

  function listenPresence(){
    if(!_chatPresRef) return;
    const myEmail = _ccEmail(); if(!myEmail) return;
    const myKey = CID;
    const myPresRef = _chatPresRef.child(myKey);
    myPresRef.onDisconnect().remove();
    myPresRef.set({ nick: emailToNick(myEmail), ts: firebase.database.ServerValue.TIMESTAMP });
    setInterval(() => { myPresRef.set({ nick: emailToNick(myEmail), ts: firebase.database.ServerValue.TIMESTAMP }); }, 25000);
    _chatPresRef.on('value', snap => {
      const d = snap.val() || {};
      const list = _c$('chatOnlineUsers');
      const cnt = _c$('chatOnlineCount');
      const users = Object.values(d);
      if(cnt) cnt.textContent = users.length;
      if(list){ list.innerHTML = ''; users.forEach(u => {
        const el = document.createElement('div'); el.className = 'chat-sidebar-user';
        const dot = document.createElement('span'); dot.className = 'chat-sidebar-dot';
        const name = document.createElement('span'); name.textContent = u.nick || '???';
        el.appendChild(dot); el.appendChild(name);
        list.appendChild(el);
      }); }
    });
  }

  function showChatFab(){
    const fab = _c$('chatFab');
    if(fab) fab.style.display = 'flex';
  }

  /* Liga à base de dados do chat. Pode falhar (sem internet, sessão Firebase
     ainda a validar) sem impedir o botão de abrir o painel; tenta de novo
     sempre que o painel é aberto enquanto não estiver ligado. */
  let _chatConnecting = false;
  async function connectChatDb(){
    if(_chatInited || _chatConnecting) return;
    if(!_ccEmail()){ addMsgEl({ type: 'system', text: chatT('chat_sem_auth') }, false); return; }
    _chatConnecting = true;
    let dbUrl = 'https://dashboard-a07d4-default-rtdb.firebaseio.com';
    const c = _ccCfg();
    if(c && c.databaseURL) dbUrl = c.databaseURL;
    try {
      window.hcFbInit((c && c.apiKey) ? c.apiKey : '', dbUrl);
      const fbUser = await Promise.race([
        new Promise(res => { const off = firebase.auth().onAuthStateChanged(u => { off(); res(u); }); }),
        new Promise(res => setTimeout(() => res(firebase.auth().currentUser || null), 6000)),
      ]);
      if(!fbUser){ addMsgEl({ type: 'system', text: 'Sem sessão segura ainda — tenta outra vez dentro de instantes ou termina a sessão e volta a entrar.' }, false); return; }
      _chatDb = firebase.database();
      _chatPresRef = _chatDb.ref('chat/presence');
      _chatMsgRef = _chatDb.ref('chat/messages');
      listenMessages();
      listenPresence();
      _chatInited = true;
    } catch(e){
      console.warn('[chat] Firebase RTDB init failed:', e);
      addMsgEl({ type: 'system', text: chatT('chat_db_off') }, false);
    } finally {
      _chatConnecting = false;
    }
  }

  /* Mostra o balão assim que a sessão existe, liga os botões já, e tenta a
     ligação à base de dados em segundo plano (sem bloquear o clique). */
  function autoInitChat(){
    if(!_ccEmail()) return;
    showChatFab();
    wireChatUI();
    connectChatDb();
  }

  if(typeof window.authReady !== 'undefined'){
    window.authReady.then(() => setTimeout(autoInitChat, 500));
  } else {
    let pollT = setInterval(() => {
      if(_ccEmail()){ clearInterval(pollT); autoInitChat(); }
      if(pollT && Date.now() - (window._chatPollStart || 0) > 10000){ clearInterval(pollT); }
    }, 500);
    window._chatPollStart = Date.now();
  }

})();
