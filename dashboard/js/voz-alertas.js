// ---------- Alertas por voz ----------
// O painel diz em voz alta o que acontece nas máquinas ("bitaxe ficou offline"), para quem não está a olhar para o ecrã.
// Usa a voz do próprio navegador (speechSynthesis), por isso não envia nada para fora. Vem desligado; liga-se no menu ⚙ › Alertas por voz.
// Eventos: ficou offline / voltou, temperatura crítica, bloco encontrado, novo recorde. Vários ao mesmo tempo juntam-se numa só frase.
(function(){
  const KEY = 'hc_voice_alerts';
  const LANGS = ['pt', 'en', 'es', 'fr'], VLANG = { pt: 'pt-PT', en: 'en-US', es: 'es-ES', fr: 'fr-FR' };
  const KINDS = ['offline', 'online', 'critical', 'block', 'best'];
  const DEF = { on: false, vol: 1, kinds: { offline: true, online: true, critical: true, block: true, best: false }, dnd: false, from: '23:00', to: '07:00' };
  const TX = {
    menu: ['Alertas por voz', 'Voice alerts', 'Alertas por voz', 'Alertes vocales'],
    title: ['Alertas por voz', 'Voice alerts', 'Alertas por voz', 'Alertes vocales'],
    intro: ['O painel diz em voz alta o que acontece nas máquinas. Só funciona com esta página aberta e com o som do computador ou telemóvel ligado.', 'The panel speaks out loud what happens on your machines. It only works while this page is open and the device sound is on.', 'El panel dice en voz alta lo que pasa en las máquinas. Solo funciona con esta página abierta y con el sonido activado.', 'Le tableau de bord annonce à voix haute ce qui se passe sur les machines. Il ne fonctionne que page ouverte et son activé.'],
    on: ['Ativar alertas por voz', 'Enable voice alerts', 'Activar alertas por voz', 'Activer les alertes vocales'],
    what: ['O que anunciar', 'What to announce', 'Qué anunciar', 'Quoi annoncer'],
    offline: ['Máquina ficou offline', 'Machine went offline', 'Máquina sin conexión', 'Machine hors ligne'],
    online: ['Máquina voltou a ficar online', 'Machine back online', 'Máquina de nuevo en línea', 'Machine de retour en ligne'],
    critical: ['Temperatura crítica', 'Critical temperature', 'Temperatura crítica', 'Température critique'],
    block: ['Bloco encontrado', 'Block found', 'Bloque encontrado', 'Bloc trouvé'],
    best: ['Novo recorde de dificuldade', 'New difficulty record', 'Nuevo récord de dificultad', 'Nouveau record de difficulté'],
    vol: ['Volume', 'Volume', 'Volumen', 'Volume'],
    dnd: ['Não incomodar (só avisos críticos falam)', 'Do not disturb (only critical alerts speak)', 'No molestar (solo hablan los críticos)', 'Ne pas déranger (seules les alertes critiques parlent)'],
    to: ['até', 'to', 'hasta', 'à'],
    test: ['Testar voz', 'Test voice', 'Probar voz', 'Tester la voix'],
    close: ['Fechar', 'Close', 'Cerrar', 'Fermer'],
    nov: ['Este navegador não tem voz sintetizada.', 'This browser has no speech synthesis.', 'Este navegador no tiene voz sintetizada.', "Ce navigateur n'a pas de synthèse vocale."],
    testSay: ['Alertas por voz ativados. Máquina de teste ficou offline.', 'Voice alerts on. Test machine went offline.', 'Alertas por voz activados. La máquina de prueba se quedó sin conexión.', 'Alertes vocales activées. La machine de test est hors ligne.']
  };
  const SAY = {
    offline: [n => n + ' ficou offline.', n => n + ' went offline.', n => n + ' se quedó sin conexión.', n => n + ' est hors ligne.'],
    online: [n => n + ' voltou a ficar online.', n => n + ' is back online.', n => n + ' volvió a estar en línea.', n => n + ' est de retour en ligne.'],
    critical: [n => 'Atenção! Temperatura crítica em ' + n + '.', n => 'Warning! Critical temperature on ' + n + '.', n => '¡Atención! Temperatura crítica en ' + n + '.', n => 'Attention ! Température critique sur ' + n + '.'],
    block: [n => 'Bloco encontrado por ' + n + '!', n => 'Block found by ' + n + '!', n => '¡Bloque encontrado por ' + n + '!', n => 'Bloc trouvé par ' + n + ' !'],
    best: [n => 'Novo recorde de dificuldade em ' + n + '.', n => 'New difficulty record on ' + n + '.', n => 'Nuevo récord de dificultad en ' + n + '.', n => 'Nouveau record de difficulté sur ' + n + '.']
  };
  const MANY = {
    offline: [c => c + ' máquinas ficaram offline.', c => c + ' machines went offline.', c => c + ' máquinas se quedaron sin conexión.', c => c + ' machines sont hors ligne.'],
    online: [c => c + ' máquinas voltaram a ficar online.', c => c + ' machines are back online.', c => c + ' máquinas volvieron a estar en línea.', c => c + ' machines sont de retour en ligne.'],
    critical: [c => 'Atenção! Temperatura crítica em ' + c + ' máquinas.', c => 'Warning! Critical temperature on ' + c + ' machines.', c => '¡Atención! Temperatura crítica en ' + c + ' máquinas.', c => 'Attention ! Température critique sur ' + c + ' machines.'],
    block: [c => c + ' blocos encontrados!', c => c + ' blocks found!', c => '¡' + c + ' bloques encontrados!', c => c + ' blocs trouvés !'],
    best: [c => c + ' novos recordes de dificuldade.', c => c + ' new difficulty records.', c => c + ' nuevos récords de dificultad.', c => c + ' nouveaux records de difficulté.']
  };
  const lang = () => { try { const l = typeof currentLang !== 'undefined' ? currentLang : 'pt'; return LANGS.includes(l) ? l : 'pt'; } catch(e) { return 'pt'; } };
  const li = () => LANGS.indexOf(lang());
  const t = k => TX[k][li()];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hasTTS = () => 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

  let cfg = load();
  function load(){
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null') || {};
      return { on: !!s.on, vol: s.vol >= 0 && s.vol <= 1 ? s.vol : 1, kinds: Object.assign({}, DEF.kinds, s.kinds || {}), dnd: !!s.dnd, from: s.from || DEF.from, to: s.to || DEF.to };
    } catch(e) { return JSON.parse(JSON.stringify(DEF)); }
  }
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch(e) {} }

  function inQuiet(){
    if(!cfg.dnd) return false;
    const m = s => { const p = String(s).split(':'); return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0); };
    const now = new Date(), cur = now.getHours() * 60 + now.getMinutes(), a = m(cfg.from), b = m(cfg.to);
    return a <= b ? (cur >= a && cur < b) : (cur >= a || cur < b);
  }

  // ---- fala ----
  function speak(text){
    if(!hasTTS() || !text) return;
    try {
      const u = new SpeechSynthesisUtterance(text), L = VLANG[lang()];
      u.lang = L; u.rate = 1.02; u.volume = cfg.vol;
      const vs = speechSynthesis.getVoices();
      const v = vs.find(x => x.lang === L) || vs.find(x => x.lang && x.lang.slice(0, 2) === L.slice(0, 2));
      if(v) u.voice = v;
      speechSynthesis.speak(u);
    } catch(e) {}
  }
  // os navegadores só deixam falar depois de o utilizador interagir uma vez com a página
  let unlocked = false;
  function unlock(){
    if(unlocked || !hasTTS()) return; unlocked = true;
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch(e) {}
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, unlock, { once: true, passive: true }));

  // ---- fila: junta eventos que chegam quase ao mesmo tempo ----
  const pend = {}; let timer = null;
  function push(kind, name){
    if(!cfg.on || !cfg.kinds[kind] || !hasTTS()) return;
    if(inQuiet() && kind !== 'critical') return;
    (pend[kind] = pend[kind] || []).push(String(name || '?'));
    if(!timer) timer = setTimeout(flush, 2200);
  }
  function flush(){
    timer = null;
    const out = [];
    KINDS.forEach(k => {
      const a = pend[k]; if(!a || !a.length) return;
      const uniq = [...new Set(a)];
      out.push(uniq.length > 2 ? MANY[k][li()](uniq.length) : uniq.map(n => SAY[k][li()](n)).join(' '));
      delete pend[k];
    });
    out.slice(0, 4).forEach(speak);
  }

  // ---- fontes dos eventos ----
  // 1) notificações que o painel já cria (temperatura crítica, bloco, recorde)
  const MAP = { critical: 'critical', block: 'block', best: 'best' };
  if(typeof window.addNotification === 'function'){
    const orig = window.addNotification;
    window.addNotification = function(type, title, desc, machineName){
      const r = orig.apply(this, arguments);
      try { if(MAP[type]) push(MAP[type], machineName); } catch(e) {}
      return r;
    };
  }
  // 2) offline / voltou: acompanha o estado de cada máquina (já só passa a offline após várias falhas seguidas)
  const seen = {};
  setInterval(() => {
    if(!cfg.on) return;
    try {
      (typeof devices !== 'undefined' ? devices : []).forEach(d => {
        const r = (typeof readings !== 'undefined' ? readings : {})[d.id];
        if(!r || typeof r.online !== 'boolean') return;
        const prev = seen[d.id]; seen[d.id] = r.online;
        if(prev === undefined) return;
        if(prev && !r.online) push('offline', d.name);
        else if(!prev && r.online) push('online', d.name);
      });
    } catch(e) {}
  }, 4000);

  // ---- janela de definições ----
  function close(){ const n = document.getElementById('hcVaModal'); if(n) n.remove(); }
  function open(){
    close();
    const ov = document.createElement('div');
    ov.id = 'hcVaModal'; ov.className = 'hc-va-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    const kinds = KINDS.map(k => '<label class="hc-va-row"><input type="checkbox" data-k="' + k + '"' + (cfg.kinds[k] ? ' checked' : '') + '> <span>' + t(k) + '</span></label>').join('');
    ov.innerHTML = '<div class="hc-va-box"><h2>🔊 ' + t('title') + '</h2><p class="hc-va-intro">' + t('intro') + '</p>' +
      (hasTTS() ? '' : '<p class="hc-va-warn">' + t('nov') + '</p>') +
      '<label class="hc-va-row hc-va-main"><input type="checkbox" id="hcVaOn"' + (cfg.on ? ' checked' : '') + '> <span>' + t('on') + '</span></label>' +
      '<div class="hc-va-sec">' + t('what') + '</div>' + kinds +
      '<div class="hc-va-sec">' + t('vol') + '</div><input type="range" id="hcVaVol" min="0" max="1" step="0.1" value="' + cfg.vol + '">' +
      '<label class="hc-va-row"><input type="checkbox" id="hcVaDnd"' + (cfg.dnd ? ' checked' : '') + '> <span>' + t('dnd') + '</span></label>' +
      '<div class="hc-va-time"><input type="time" id="hcVaFrom" value="' + esc(cfg.from) + '"> <span>' + t('to') + '</span> <input type="time" id="hcVaTo" value="' + esc(cfg.to) + '"></div>' +
      '<div class="hc-va-act"><button type="button" class="hc-va-btn ghost" data-a="test">' + t('test') + '</button><button type="button" class="hc-va-btn" data-a="x">' + t('close') + '</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => {
      if(e.target === ov) return close();
      const b = e.target.closest('[data-a]'); if(!b) return;
      if(b.dataset.a === 'x') return close();
      if(b.dataset.a === 'test'){ unlocked = true; try { speechSynthesis.cancel(); } catch(x) {} speak(t('testSay')); }
    });
    ov.addEventListener('change', e => {
      const el = e.target;
      if(el.id === 'hcVaOn'){ cfg.on = el.checked; if(cfg.on){ unlocked = true; speak(t('testSay')); } }
      else if(el.dataset.k) cfg.kinds[el.dataset.k] = el.checked;
      else if(el.id === 'hcVaDnd') cfg.dnd = el.checked;
      else if(el.id === 'hcVaFrom') cfg.from = el.value || DEF.from;
      else if(el.id === 'hcVaTo') cfg.to = el.value || DEF.to;
      save();
    });
    ov.querySelector('#hcVaVol').addEventListener('input', e => { cfg.vol = Number(e.target.value); save(); });
    document.addEventListener('keydown', function esc2(e){ if(e.key === 'Escape'){ close(); document.removeEventListener('keydown', esc2); } });
  }

  window.hcVoiceAlertsOpen = open;
  window.hcVoiceAlertsLabel = () => (cfg.on ? '🔊 ' : '🔈 ') + t('menu');
  window.hcVoiceAlertsSay = push;   // para outros módulos: hcVoiceAlertsSay('offline', 'nome')
})();
