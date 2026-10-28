// ---------- Regras e código de conduta do chat ----------
// A primeira vez que se abre o chat (e sempre que RULES_VERSION sobe) aparece esta janela; só se entra depois de "Li e aceito".
// A aceitação fica guardada neste navegador. O comando /regras volta a mostrá-las.
(function(){
  const RULES_VERSION = 1, KEY = 'hc_rules_ok';
  const LANGS = ['pt', 'en', 'es', 'fr'];
  const TX = {
    title: ['Regras da comunidade', 'Community rules', 'Reglas de la comunidad', 'Règles de la communauté'],
    intro: ['Antes de entrares no chat, lê com atenção. Aqui toda a gente está a aprender e a ajudar.', 'Before joining the chat, please read this. Everyone here is learning and helping each other.', 'Antes de entrar en el chat, lee esto con atención. Aquí todos aprendemos y nos ayudamos.', 'Avant de rejoindre le chat, lisez ceci. Ici, tout le monde apprend et s\'entraide.'],
    r1: ['Respeito acima de tudo', 'Respect above all', 'Respeto ante todo', 'Le respect avant tout'],
    r1d: ['Sem insultos, assédio, discriminação nem ataques pessoais. Discordar é normal, ofender não.', 'No insults, harassment, discrimination or personal attacks. Disagreeing is fine, offending is not.', 'Sin insultos, acoso, discriminación ni ataques personales. Discrepar está bien, ofender no.', 'Pas d\'insultes, de harcèlement, de discrimination ni d\'attaques personnelles. Être en désaccord est normal, offenser non.'],
    r2: ['Nunca partilhes dados privados', 'Never share private data', 'Nunca compartas datos privados', 'Ne partagez jamais de données privées'],
    r2d: ['Não publiques chaves, palavras-passe, frases de recuperação da carteira nem endereços da tua casa. Ninguém da equipa os vai pedir.', 'Do not post keys, passwords, wallet seed phrases or your home address. The team will never ask for them.', 'No publiques claves, contraseñas, frases de recuperación de la cartera ni tu dirección. El equipo nunca las pedirá.', 'Ne publiez pas de clés, mots de passe, phrases de récupération de portefeuille ni votre adresse. L\'équipe ne les demandera jamais.'],
    r3: ['Sem burlas nem spam', 'No scams or spam', 'Sin estafas ni spam', 'Pas d\'arnaques ni de spam'],
    r3d: ['Nada de esquemas de "lucro garantido", links suspeitos, publicidade repetida ou pedidos de dinheiro.', 'No "guaranteed profit" schemes, suspicious links, repeated advertising or requests for money.', 'Nada de esquemas de "ganancia garantizada", enlaces sospechosos, publicidad repetida ni peticiones de dinero.', 'Pas de systèmes de « gains garantis », de liens suspects, de publicité répétée ni de demandes d\'argent.'],
    r4: ['Ajuda com paciência', 'Help with patience', 'Ayuda con paciencia', 'Aidez avec patience'],
    r4d: ['Todos fomos principiantes. Responde com calma e explica o porquê. Pergunta no canal certo.', 'We were all beginners once. Answer calmly and explain why. Ask in the right channel.', 'Todos fuimos principiantes. Responde con calma y explica el porqué. Pregunta en el canal adecuado.', 'Nous avons tous été débutants. Répondez calmement et expliquez pourquoi. Posez vos questions dans le bon canal.'],
    r5: ['Não é aconselhamento financeiro', 'This is not financial advice', 'No es asesoramiento financiero', 'Ce n\'est pas un conseil financier'],
    r5d: ['As opiniões são pessoais. Minerar tem custos e riscos; decide sempre por ti.', 'Opinions are personal. Mining has costs and risks; always decide for yourself.', 'Las opiniones son personales. Minar tiene costes y riesgos; decide siempre por ti.', 'Les avis sont personnels. Le minage a des coûts et des risques ; décidez toujours par vous-même.'],
    r6: ['Respeita os moderadores e os cargos','Respect moderators and roles', 'Respeta a moderadores y cargos', 'Respectez les modérateurs et les rôles'],
    r6d: ['Os administradores podem apagar mensagens e remover quem não cumprir as regras. Se achares que foi um erro, fala com eles com respeito.', 'Admins may delete messages and remove anyone who breaks the rules. If you think it was a mistake, talk to them respectfully.', 'Los administradores pueden borrar mensajes y expulsar a quien incumpla las reglas. Si crees que fue un error, habla con ellos con respeto.', 'Les administrateurs peuvent supprimer des messages et exclure ceux qui enfreignent les règles. Si vous pensez à une erreur, parlez-leur avec respect.'],
    chk: ['Li e aceito as regras', 'I have read and accept the rules', 'He leído y acepto las reglas', 'J\'ai lu et j\'accepte les règles'],
    ok: ['Entrar no chat', 'Enter the chat', 'Entrar al chat', 'Entrer dans le chat'],
    cancel: ['Agora não', 'Not now', 'Ahora no', 'Pas maintenant'],
    close: ['Fechar', 'Close', 'Cerrar', 'Fermer'],
    saved: ['Já aceitaste estas regras.', 'You have already accepted these rules.', 'Ya aceptaste estas reglas.', 'Vous avez déjà accepté ces règles.']
  };
  const lang = () => { try { const l = typeof currentLang !== 'undefined' ? currentLang : 'pt'; return LANGS.includes(l) ? l : 'pt'; } catch(e) { return 'pt'; } };
  const t = k => TX[k][LANGS.indexOf(lang())];
  const accepted = () => { try { return Number(localStorage.getItem(KEY)) >= RULES_VERSION; } catch(e) { return false; } };

  function close(){ const n = document.getElementById('hcRulesModal'); if(n) n.remove(); }

  // readOnly: mostra as regras sem pedir aceitação (comando /regras). onAccept: corre depois do "Li e aceito".
  function show(onAccept, readOnly){
    close();
    const ov = document.createElement('div');
    ov.id = 'hcRulesModal'; ov.className = 'hc-rules-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    const items = [1, 2, 3, 4, 5, 6].map(i => '<li><b>' + t('r' + i) + '</b><span>' + t('r' + i + 'd') + '</span></li>').join('');
    ov.innerHTML = '<div class="hc-rules-box"><h2>📜 ' + t('title') + '</h2><p class="hc-rules-intro">' + t('intro') + '</p><ol class="hc-rules-list">' + items + '</ol>' +
      (readOnly
        ? '<div class="hc-rules-act"><button type="button" class="hc-rules-btn" data-a="x">' + t('close') + '</button></div>'
        : '<label class="hc-rules-chk"><input type="checkbox" id="hcRulesChk"> <span>' + t('chk') + '</span></label>' +
          '<div class="hc-rules-act"><button type="button" class="hc-rules-btn ghost" data-a="x">' + t('cancel') + '</button><button type="button" class="hc-rules-btn" id="hcRulesOk" data-a="ok" disabled>' + t('ok') + '</button></div>') + '</div>';
    document.body.appendChild(ov);
    const chk = ov.querySelector('#hcRulesChk'), ok = ov.querySelector('#hcRulesOk');
    if(chk) chk.addEventListener('change', () => { ok.disabled = !chk.checked; });
    ov.addEventListener('click', e => {
      if(e.target === ov) return close();
      const b = e.target.closest('[data-a]'); if(!b) return;
      if(b.dataset.a === 'x') return close();
      if(b.dataset.a === 'ok' && chk && chk.checked){
        try { localStorage.setItem(KEY, String(RULES_VERSION)); } catch(e) {}
        close();
        if(typeof onAccept === 'function') onAccept();
      }
    });
    document.addEventListener('keydown', function esc(e){ if(e.key === 'Escape'){ close(); document.removeEventListener('keydown', esc); } });
    setTimeout(() => { const f = ov.querySelector(chk ? '#hcRulesChk' : '[data-a]'); if(f) f.focus(); }, 50);
  }

  // O chat chama isto antes de abrir: true = já aceitou, pode abrir; false = mostrou a janela (abre sozinho depois de aceitar).
  window.hcRulesGate = function(onAccept){
    if(accepted()) return true;
    show(onAccept, false);
    return false;
  };
  window.hcRulesShow = function(){ show(null, true); };
})();
