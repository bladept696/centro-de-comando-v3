// ---------- Cargos com nome colorido (DEV, ADMIN, MOD…) ----------
// Cada cargo é uma etiqueta colorida ao lado do nome, no chat, na lista de online e no ranking da comunidade.
// Os cargos vêm de dois sítios: a lista fixa BASE aqui em baixo (o dono do projeto) e o nó chat/roles/<uid> do Firebase,
// que os administradores gerem no próprio chat com:  /cargo @nick NOME [#cor]   e   /cargo @nick -  (remove).
(function(){
  const PRESET = { DEV: '#ff4d6d', ADMIN: '#ffb84a', MOD: '#4fd6ff', MENTOR: '#b57bff', VIP: '#ffd34a', APOIO: '#21ffb0' };
  const BASE = { 'jz4zc6p6DkNwmyZYfvc4k8iaZXU2': { name: 'DEV', color: PRESET.DEV } };
  const NAME_RE = /^[\p{L}\p{N}_.\- ]{1,10}$/u, COLOR_RE = /^#[0-9a-fA-F]{6}$/;
  let fb = {};
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clean = r => (r && NAME_RE.test(String(r.name || '')) && COLOR_RE.test(String(r.color || ''))) ? { name: String(r.name).toUpperCase(), color: String(r.color) } : null;

  window.hcRole = uid => (uid && (clean(BASE[uid]) || clean(fb[uid]))) || null;
  window.hcRoleColor = uid => { const r = window.hcRole(uid); return r ? r.color : ''; };
  window.hcRoleTag = uid => { const r = window.hcRole(uid); return r ? ' <span class="hc-role" style="--rc:' + r.color + '">' + esc(r.name) + '</span>' : ''; };

  function listen(){
    const f = window.hcFb;
    if(!f || !f.db || listen.on) return;
    listen.on = true;
    f.db.ref('chat/roles').on('value', snap => { fb = snap.val() || {}; document.dispatchEvent(new Event('hc-roles')); }, () => {});
  }
  document.addEventListener('hc-chat-ready', listen);
  setTimeout(listen, 3000); setInterval(listen, 8000);

  // /cargo @nick NOME [#cor]  |  /cargo @nick -     (só administradores; o Firebase também o exige nas regras)
  window.hcRoleCommand = async function(cmd, ctx){
    const say = ctx.note;
    if(!ctx.admin){ say('Só os administradores podem dar cargos.'); return true; }
    const m = cmd.trim().match(/^\/cargo\s+@?(\S+)\s+(.+)$/i);
    if(!m){ say('Uso: /cargo @nick NOME [#cor]   ·   /cargo @nick -   ·   nomes prontos: ' + Object.keys(PRESET).join(', ')); return true; }
    const nick = m[1].toLowerCase();
    let uid = '';
    Object.values(ctx.online || {}).forEach(u => { if(u && u.uid && String(u.nick || '').toLowerCase() === nick) uid = u.uid; });
    if(!uid) ctx.msgs.forEach(x => { if(x && x.uid && String(x.author || '').toLowerCase() === nick) uid = x.uid; });
    const f = window.hcFb;
    if(!f || !f.db){ say('Chat ainda a ligar, tenta daqui a pouco.'); return true; }
    // versões mais antigas do painel não enviam o identificador no chat: procura no registo de utilizadores (chat/users)
    if(!uid && nick.startsWith('uid:')) uid = m[1].slice(4);   // /cargo uid:IDENTIFICADOR NOME  (o identificador está em Firebase › Authentication)
    for(const node of ['users', 'community']){
      if(uid) break;
      try {
        const all = (await f.db.ref('chat/' + node).once('value')).val() || {};
        Object.keys(all).forEach(k => { if(all[k] && String(all[k].nick || '').toLowerCase() === nick) uid = k; });
      } catch(e) {}
    }
    for(const node of ['records', 'blocks']){
      if(uid) break;
      try {
        const all = (await f.db.ref('chat/' + node).limitToLast(200).once('value')).val() || {};
        Object.values(all).forEach(v => { if(v && v.uid && String(v.nick || '').toLowerCase() === nick) uid = v.uid; });
      } catch(e) {}
    }
    if(!uid){ say('Não encontrei "' + m[1] + '" no chat. A versão dele talvez seja antiga. Alternativa: /cargo uid:IDENTIFICADOR NOME (o identificador vê-se no Firebase › Authentication › Utilizadores).'); return true; }
    const rest = m[2].trim();
    try {
      if(rest === '-'){ await f.db.ref('chat/roles/' + uid).remove(); say('Cargo de ' + m[1] + ' removido.'); return true; }
      const cm = rest.match(/\s(#[0-9a-fA-F]{6})$/), color = cm ? cm[1] : '', name = (cm ? rest.slice(0, -cm[0].length) : rest).trim().toUpperCase();
      const role = { name, color: color || PRESET[name] || '#21ffb0' };
      if(!clean(role)){ say('Nome inválido (até 10 letras ou números) ou cor inválida (ex.: #ff4d6d).'); return true; }
      await f.db.ref('chat/roles/' + uid).set(role);
      say('Cargo ' + role.name + ' dado a ' + m[1] + '.');
    } catch(e){ say('O Firebase recusou (as regras ainda não têm "roles", ou não és administrador lá).'); }
    return true;
  };
})();
