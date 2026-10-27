
(function(){
  const LS_KEY = 'cc_auth_session';
  const nativeFetch = window.fetch.bind(window);
  const apiOrigin = /\.ts\.net$/.test(location.hostname) ? location.origin : `${location.protocol}//${location.hostname}:8765`;
  const BYPASS = ['/api/auth/config', '/api/heartbeat'];
  let cfg = { enabled: false, apiKey: '' };
  let session = null;               // { refreshToken, idToken, expiresAt, email }
  let mode = 'login';               // login | signup | reset
  let readyResolve; const authReady = new Promise(r => readyResolve = r);
  // sabe-se se o login está ativo só depois de /api/auth/config responder; os pedidos à API esperam por isso
  // (ligações lentas, como o telemóvel, mandavam o primeiro pedido sem token e a lista de máquinas ficava vazia)
  let cfgResolve; const cfgReady = new Promise(r => cfgResolve = r);
  setTimeout(() => cfgResolve(), 20000);   // servidor sem resposta: não deixa os pedidos à espera para sempre

  const $ = id => document.getElementById(id);
  const gate = $('authGate'), msg = $('agMsg');

  const ERR = {
    EMAIL_EXISTS: 'Já existe uma conta com este email.',
    INVALID_EMAIL: 'Email inválido.',
    WEAK_PASSWORD: 'Password demasiado fraca (mínimo 6 caracteres).',
    EMAIL_NOT_FOUND: 'Email ou password incorretos.',
    INVALID_PASSWORD: 'Email ou password incorretos.',
    INVALID_LOGIN_CREDENTIALS: 'Email ou password incorretos.',
    USER_DISABLED: 'Esta conta foi desativada.',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Demasiadas tentativas. Tenta novamente mais tarde.',
    OPERATION_NOT_ALLOWED: 'Login por email/password não está ativado no Firebase (Authentication → Sign-in method).',
    MISSING_PASSWORD: 'Indica a password.',
    MISSING_EMAIL: 'Indica o email.',
    CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'Por segurança, inicia sessão novamente antes de eliminar a conta.',
    TOKEN_EXPIRED: 'Sessão expirada. Inicia sessão novamente.',
    USER_NOT_FOUND: 'Esta conta já não existe.'
  };
  function errText(e){ const c = String((e && e.message) || e || '').split(' ')[0]; return ERR[c] || ('Erro: ' + c); }
  function setMsg(t, ok){ msg.textContent = t || ''; msg.className = 'ag-msg ' + (t ? (ok ? 'ok' : 'err') : ''); }

  async function idt(endpoint, body){
    const r = await nativeFetch(`https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${encodeURIComponent(cfg.apiKey)}`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
    });
    const d = await r.json();
    if (!r.ok) throw new Error((d.error && d.error.message) || 'UNKNOWN');
    return d;
  }
  function saveSession(s){
    session = s;
    try { localStorage.setItem(LS_KEY, JSON.stringify({ refreshToken: s.refreshToken, email: s.email })); } catch(e){}
  }
  function fromAuthResponse(d, email){
    return { idToken: d.idToken, refreshToken: d.refreshToken, email: d.email || email,
             expiresAt: Date.now() + (parseInt(d.expiresIn, 10) || 3600) * 1000 };
  }
  async function refresh(){
    const rt = session && session.refreshToken;
    if (!rt) throw new Error('NO_SESSION');
    const r = await nativeFetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(cfg.apiKey)}`, {
      method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(rt)
    });
    const d = await r.json();
    if (!r.ok) throw new Error((d.error && d.error.message) || 'REFRESH_FAILED');
    saveSession({ idToken: d.id_token, refreshToken: d.refresh_token, email: session.email,
                  expiresAt: Date.now() + (parseInt(d.expires_in, 10) || 3600) * 1000 });
  }
  async function getToken(){
    if (!session) throw new Error('NO_SESSION');
    if (session.expiresAt - Date.now() < 60000) await refresh();
    return session.idToken;
  }

  function showGate(){ gate.classList.remove('hidden'); $('authUserPill').style.display = 'none'; $('userCountsBar').style.display = 'none'; if(_presenceInterval){ clearInterval(_presenceInterval); _presenceInterval=null; } }
  function loggedIn(){
    gate.classList.add('hidden');
    $('authUserEmail').textContent = session.email || '';
    $('authUserPill').style.display = 'flex';
    readyResolve();
    recordLogin();
    checkVerifyBanner();
    startPresenceHeartbeat();
    fetchUserCounts();
    $('userCountsBar').style.display = 'flex';
  }

  // Expose session getter for chat and other modules outside this IIFE
  window.getCcSession = function(){ return session; };
  window.getCcCfg = function(){ return cfg; };
  window.authReady = authReady;
  function setMode(m){
    mode = m; setMsg('');
    $('agPassWrap').style.display = m === 'reset' ? 'none' : '';
    $('agSubmit').textContent = m === 'signup' ? 'Criar conta' : m === 'reset' ? 'Enviar email de recuperação' : 'Entrar';
    $('agSub').textContent = m === 'signup' ? 'Cria a tua conta para usar o painel.' : m === 'reset' ? 'Enviamos-te um link para definir nova password.' : 'Inicia sessão para aceder ao painel.';
    $('agToggle').textContent = m === 'signup' ? 'Já tenho conta' : 'Criar conta';
    $('agPass').autocomplete = m === 'signup' ? 'new-password' : 'current-password';
  }
  async function submit(){
    const email = $('agEmail').value.trim(), pass = $('agPass').value;
    $('agSubmit').disabled = true; setMsg('');
    try {
      if (mode === 'reset') {
        await idt('sendOobCode', { requestType: 'PASSWORD_RESET', email });
        setMsg('Email enviado. Verifica a caixa de entrada (e o spam).', true);
      } else {
        const d = await idt(mode === 'signup' ? 'signUp' : 'signInWithPassword', { email, password: pass, returnSecureToken: true });
        saveSession(fromAuthResponse(d, email));
        try { window.hcFbInit(cfg.apiKey); await Promise.race([firebase.auth().signInWithEmailAndPassword(email, pass).catch(() => {}), new Promise(r => setTimeout(r, 6000))]); } catch(e){}
        $('agPass').value = '';
        loggedIn();
      }
    } catch(e){ setMsg(errText(e)); }
    $('agSubmit').disabled = false;
  }
  async function logout(){
    try { localStorage.removeItem(LS_KEY); } catch(e){}
    session = null;
    try { await Promise.race([firebase.auth().signOut(), new Promise(r => setTimeout(r, 800))]); } catch(e){}
    location.reload();
  }

  // --- Eliminar conta -------------------------------------------------------
  const delModal = $('authDeleteModal'), delMsg = $('admMsg');
  function openDelete(){
    if (!session){ return; }
    $('admPass').value = ''; delMsg.textContent = '';
    $('admConfirm').disabled = false; $('admCancel').disabled = false;
    delModal.classList.add('open');
    setTimeout(() => $('admPass').focus(), 50);
  }
  function closeDelete(){ delModal.classList.remove('open'); }
  async function deleteAccount(){
    const pass = $('admPass').value;
    if (!pass){ delMsg.textContent = 'Indica a password para confirmar.'; return; }
    $('admConfirm').disabled = true; $('admCancel').disabled = true; delMsg.textContent = '';
    try {
      // Reautentica para obter um idToken recente (evita CREDENTIAL_TOO_OLD).
      const r = await idt('signInWithPassword', { email: session.email, password: pass, returnSecureToken: true });
      await idt('delete', { idToken: r.idToken });
      try { localStorage.removeItem(LS_KEY); } catch(e){}
      session = null;
      closeDelete();
      alert('A tua conta foi eliminada com sucesso.');
      location.reload();
    } catch(e){
      delMsg.textContent = errText(e);
      $('admConfirm').disabled = false; $('admCancel').disabled = false;
    }
  }

  // --- Perfil / Conta -------------------------------------------------------
  const profModal = $('authProfileModal');
  function fmtDate(ms){
    const n = parseInt(ms, 10);
    if (!n) return '—';
    try { return new Date(n).toLocaleString(); } catch(e){ return '—'; }
  }
  async function lookupUser(){
    const token = await getToken();
    const d = await idt('lookup', { idToken: token });
    return (d.users && d.users[0]) || null;
  }
  function renderVerifyRow(u){
    const row = $('apmVerifyRow');
    if (u && u.emailVerified){
      row.innerHTML = '<span class="apm-badge ver">Verificado</span>';
    } else {
      row.innerHTML = '<span class="apm-badge unver">Não verificado</span> ' +
        '<button type="button" class="apm-btn" id="apmResendBtn" style="margin-top:0;margin-left:8px;padding:6px 12px">Reenviar email de verificação</button>' +
        '<div class="apm-rowmsg" id="apmResendMsg"></div>';
      $('apmResendBtn').onclick = resendVerification;
    }
  }
  async function resendVerification(){
    const btn = $('apmResendBtn'), m = $('apmResendMsg');
    if (btn) btn.disabled = true;
    try {
      const token = await getToken();
      await idt('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: token });
      if (m){ m.className = 'apm-rowmsg ok'; m.textContent = 'Email de verificação enviado. Verifica a caixa de entrada (e o spam).'; }
    } catch(e){
      if (m){ m.className = 'apm-rowmsg err'; m.textContent = errText(e); }
    }
    if (btn) btn.disabled = false;
  }
  async function loadActivity(){
    const box = $('apmActivity');
    try {
      const r = await window.fetch(apiOrigin + '/api/account/activity?email=' + encodeURIComponent(session.email || ''));
      const d = await r.json();
      const rows = (d.entries || []).map(e =>
        '<tr><td>' + fmtDate((e.ts||0)*1000) + '</td><td>' + (e.event||'login') + '</td><td>' + (e.ip||'—') + '</td></tr>'
      ).join('');
      box.innerHTML = rows
        ? '<table class="apm-act"><thead><tr><th>Data</th><th>Evento</th><th>IP</th></tr></thead><tbody>' + rows + '</tbody></table>'
        : '<div class="apm-meta">Sem atividade registada ainda.</div>';
    } catch(e){
      box.innerHTML = '<div class="apm-meta">Não foi possível carregar o registo de atividade.</div>';
    }
  }
  async function openProfile(){
    if (!session) return;
    ['apmEmail','apmEmailPass','apmCurPass','apmNewPass'].forEach(id => { const el=$(id); if(el) el.value=''; });
    ['apmEmailMsg','apmPassMsg'].forEach(id => { const el=$(id); if(el){ el.textContent=''; el.className='apm-rowmsg'; } });
    $('apmMeta').textContent = 'A carregar…';
    $('apmVerifyRow').innerHTML = '';
    $('apmActivity').innerHTML = '<div class="apm-meta">A carregar…</div>';
    profModal.classList.add('open');
    try {
      const u = await lookupUser();
      $('apmEmail').value = (u && u.email) || session.email || '';
      $('apmMeta').innerHTML =
        'Email: <b>' + ((u && u.email) || session.email || '—') + '</b><br>' +
        'Conta criada: <b>' + fmtDate(u && u.createdAt) + '</b><br>' +
        'Último início de sessão: <b>' + fmtDate(u && u.lastLoginAt) + '</b>';
      renderVerifyRow(u);
    } catch(e){
      $('apmMeta').textContent = 'Não foi possível carregar os dados da conta.';
    }
    loadActivity();
  }
  function closeProfile(){ profModal.classList.remove('open'); }
  async function changeEmail(){
    const newEmail = $('apmEmail').value.trim(), pass = $('apmEmailPass').value;
    const m = $('apmEmailMsg');
    if (!newEmail){ m.className='apm-rowmsg err'; m.textContent='Indica o novo email.'; return; }
    if (!pass){ m.className='apm-rowmsg err'; m.textContent='Confirma a password atual.'; return; }
    $('apmEmailBtn').disabled = true; m.textContent=''; m.className='apm-rowmsg';
    try {
      const r = await idt('signInWithPassword', { email: session.email, password: pass, returnSecureToken: true });
      const d = await idt('update', { idToken: r.idToken, email: newEmail, returnSecureToken: true });
      saveSession({ idToken: d.idToken || r.idToken, refreshToken: d.refreshToken || session.refreshToken,
                    email: d.email || newEmail, expiresAt: Date.now() + 3600000 });
      $('authUserEmail').textContent = session.email;
      m.className='apm-rowmsg ok'; m.textContent='Email atualizado com sucesso.';
      $('apmEmailPass').value='';
    } catch(e){ m.className='apm-rowmsg err'; m.textContent=errText(e); }
    $('apmEmailBtn').disabled = false;
  }
  async function changePassword(){
    const cur = $('apmCurPass').value, nw = $('apmNewPass').value;
    const m = $('apmPassMsg');
    if (!cur){ m.className='apm-rowmsg err'; m.textContent='Confirma a password atual.'; return; }
    if (!nw || nw.length < 6){ m.className='apm-rowmsg err'; m.textContent='A nova password tem de ter pelo menos 6 caracteres.'; return; }
    $('apmPassBtn').disabled = true; m.textContent=''; m.className='apm-rowmsg';
    try {
      const r = await idt('signInWithPassword', { email: session.email, password: cur, returnSecureToken: true });
      const d = await idt('update', { idToken: r.idToken, password: nw, returnSecureToken: true });
      saveSession({ idToken: d.idToken || r.idToken, refreshToken: d.refreshToken || session.refreshToken,
                    email: session.email, expiresAt: Date.now() + 3600000 });
      m.className='apm-rowmsg ok'; m.textContent='Password atualizada com sucesso.';
      $('apmCurPass').value=''; $('apmNewPass').value='';
    } catch(e){ m.className='apm-rowmsg err'; m.textContent=errText(e); }
    $('apmPassBtn').disabled = false;
  }
  async function checkVerifyBanner(){
    try {
      const u = await lookupUser();
      if (u && !u.emailVerified){ $('authVerifyBanner').classList.add('show'); }
    } catch(e){}
  }
  async function recordLogin(){
    try {
      await window.fetch(apiOrigin + '/api/account/activity', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email: session.email, event: 'login' })
      });
    } catch(e){}
  }

  // --- Presença / contadores de utilizadores ---------------------------------
  let _presenceInterval = null;
  async function sendPresence(){
    try {
      const r = await window.fetch(apiOrigin + '/api/user-presence', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email: session.email })
      });
      const d = await r.json();
      if (d.ok) updateUserCountsUI(d.online, d.total);
    } catch(e){}
  }
  async function fetchUserCounts(){
    try {
      const r = await window.fetch(apiOrigin + '/api/user-counts');
      const d = await r.json();
      updateUserCountsUI(d.online, d.total);
    } catch(e){}
  }
  // os números do servidor local só conhecem quem passou por esta máquina; quando o chat (Firebase) está ligado,
  // os números da comunidade (window.hcFbCounts) têm prioridade
  let _srvCounts = { online: null, total: null };
  window.hcRefreshCounts = function(){ updateUserCountsUI(_srvCounts.online, _srvCounts.total, true); };
  function updateUserCountsUI(online, total, fromFb){
    if(!fromFb) _srvCounts = { online, total };
    const fb = window.hcFbCounts;
    if(fb && typeof fb.online === 'number'){ online = fb.online; if(typeof fb.total === 'number') total = Math.max(fb.total, fb.online); }
    const on = $('ucOnline'), tot = $('ucTotal');
    if (on) on.textContent = (typeof online === 'number') ? online : '—';
    if (tot) tot.textContent = (typeof total === 'number') ? total : '—';
  }
  function startPresenceHeartbeat(){
    if (_presenceInterval) clearInterval(_presenceInterval);
    sendPresence();
    _presenceInterval = setInterval(() => {
      sendPresence();
      fetchUserCounts();
    }, 30000);
  }

  // fetch embrulhado: espera pelo login e junta o token aos pedidos à API local
  window.fetch = async function(input, init){
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!url.startsWith(apiOrigin + '/api/') || BYPASS.some(p => url.startsWith(apiOrigin + p))) return nativeFetch(input, init);
    await cfgReady;
    if (!cfg.enabled) return nativeFetch(input, init);
    await authReady;
    const send = async () => {
      const token = await getToken();
      const headers = new Headers((init && init.headers) || (typeof input !== 'string' && input.headers) || {});
      headers.set('Authorization', 'Bearer ' + token);
      return nativeFetch(input, Object.assign({}, init, { headers }));
    };
    let res = await send();
    if (res.status === 401) {
      try { await refresh(); res = await send(); } catch(e){}
      if (res.status === 401) { try { localStorage.removeItem(LS_KEY); } catch(e){} session = null; location.reload(); }
    }
    return res;
  };

  $('agSubmit').onclick = submit;
  $('agToggle').onclick = () => setMode(mode === 'signup' ? 'login' : 'signup');
  $('agReset').onclick = () => setMode('reset');
  $('authLogout').onclick = logout;
  $('authDelete').onclick = openDelete;
  $('authAccount').onclick = openProfile;
  $('apmClose').onclick = closeProfile;
  $('apmEmailBtn').onclick = changeEmail;
  $('apmPassBtn').onclick = changePassword;
  profModal.addEventListener('click', e => { if (e.target === profModal) closeProfile(); });
  profModal.addEventListener('keydown', e => { if (e.key === 'Escape') closeProfile(); });
  $('avbResend').onclick = async () => {
    const b = $('avbResend'); b.disabled = true;
    try { const token = await getToken(); await idt('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: token }); b.textContent = 'Enviado ✓'; }
    catch(e){ b.textContent = 'Erro'; b.disabled = false; }
  };
  $('avbClose').onclick = () => $('authVerifyBanner').classList.remove('show');
  $('admCancel').onclick = closeDelete;
  $('admConfirm').onclick = deleteAccount;
  delModal.addEventListener('click', e => { if (e.target === delModal) closeDelete(); });
  delModal.addEventListener('keydown', e => { if (e.key === 'Enter') deleteAccount(); if (e.key === 'Escape') closeDelete(); });
  gate.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

  (async function init(){
    // um único pedido falhado (ligação lenta ao abrir de fora do PC) NÃO pode significar "login desligado":
    // sem token todos os pedidos seguintes davam 401. Repete antes de desistir.
    let got = null, lastErr = '';
    for (let i = 0; i < 6 && !got; i++) {
      try {
        const r = await nativeFetch(apiOrigin + '/api/auth/config', { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        got = await r.json();
      } catch(e){ lastErr = String((e && e.message) || e); if (i < 5) await new Promise(r => setTimeout(r, 1200)); }
    }
    if (!got && typeof hcRemoteDbg === 'function') hcRemoteDbg('Configuração de login indisponível: ' + lastErr);
    cfg = got || { enabled: false };
    cfgResolve();
    if (!cfg.enabled) { readyResolve(); return; }
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch(e){}
    if (saved && saved.refreshToken) {
      session = { refreshToken: saved.refreshToken, email: saved.email, idToken: '', expiresAt: 0 };
      try {
        await refresh(); loggedIn();
        try { window.hcFbInit(cfg.apiKey); if(!firebase.auth().currentUser) await firebase.auth().signInWithCustomToken ? null : null; } catch(_){}
        return;
      } catch(e){ session = null; }
    }
    showGate();
  })();
})();
