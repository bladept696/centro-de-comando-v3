// ---------- Cartões: falar com a farm (voz) ----------
// Prime 🎤 e pergunte ("como estão as máquinas?", "qual a mais quente?") ou mande ("põe a máquina 2 em eco").
// Usa o reconhecimento de voz e a voz sintetizada do próprio navegador (nada vai para servidores nossos).
// As ordens que mudam alguma coisa pedem confirmação ("sim"). Sem reconhecimento de voz, escreve-se o comando.
const MC_VOICE_LANG = { pt: 'pt-PT', en: 'en-US', es: 'es-ES', fr: 'fr-FR' };
const mcVoice = { rec: null, on: false, pending: null, panel: null, speak: (() => { try { return localStorage.getItem('nerdqaxe:voice_speak') !== '0'; } catch(e) { return true; } })() };
const MC_VT = {
  help: ['Pode perguntar: como estão as máquinas, qual a mais quente, quais estão offline, o hashrate, o consumo, o lucro, o preço do bitcoin, o próximo ajuste ou halving, e o melhor share. E mandar: pôr a máquina 2 em eco, turbo em todas, reiniciar a máquina 3.',
    'You can ask: how are the machines, which is the hottest, which are offline, the hashrate, power use, profit, the bitcoin price, the next adjustment or halving, and the best share. And command: put machine 2 in eco, turbo on all, restart machine 3.',
    'Puede preguntar: cómo están las máquinas, cuál es la más caliente, cuáles están sin conexión, el hashrate, el consumo, el beneficio, el precio del bitcoin, el próximo ajuste o halving y el mejor share. Y ordenar: poner la máquina 2 en eco, turbo en todas, reiniciar la máquina 3.',
    "Vous pouvez demander : comment vont les machines, laquelle est la plus chaude, lesquelles sont hors ligne, le hashrate, la consommation, le bénéfice, le prix du bitcoin, le prochain ajustement ou halving, et le meilleur share. Et ordonner : mettre la machine 2 en éco, turbo sur toutes, redémarrer la machine 3."],
  none: ['Ainda não há máquinas.', 'There are no machines yet.', 'Aún no hay máquinas.', "Il n'y a pas encore de machines."],
  over: ['{0} de {1} máquinas ligadas, com {2} no total. {3}', '{0} of {1} machines online, {2} in total. {3}', '{0} de {1} máquinas conectadas, {2} en total. {3}', '{0} machines sur {1} en ligne, {2} au total. {3}'],
  allok: ['Está tudo normal.', 'Everything is normal.', 'Todo está normal.', 'Tout est normal.'],
  warn: ['{0} com avisos; a mais quente é a {1}, a {2} graus.', '{0} with warnings; the hottest is {1}, at {2} degrees.', '{0} con avisos; la más caliente es {1}, a {2} grados.', '{0} avec des alertes ; la plus chaude est {1}, à {2} degrés.'],
  hash_all: ['O hashrate total é {0}.', 'The total hashrate is {0}.', 'El hashrate total es {0}.', 'Le hashrate total est de {0}.'],
  hash_one: ['{0} está a fazer {1}.', '{0} is doing {1}.', '{0} está haciendo {1}.', '{0} fait {1}.'],
  off_one: ['{0} está offline.', '{0} is offline.', '{0} está sin conexión.', '{0} est hors ligne.'],
  temp_hot: ['A mais quente é a {0}, a {1} graus.', 'The hottest is {0}, at {1} degrees.', 'La más caliente es {0}, a {1} grados.', 'La plus chaude est {0}, à {1} degrés.'],
  temp_one: ['{0} está a {1} graus.', '{0} is at {1} degrees.', '{0} está a {1} grados.', '{0} est à {1} degrés.'],
  off_list: ['Estão offline: {0}.', 'Offline: {0}.', 'Sin conexión: {0}.', 'Hors ligne : {0}.'],
  off_none: ['Todas as máquinas estão ligadas.', 'All machines are online.', 'Todas las máquinas están conectadas.', 'Toutes les machines sont en ligne.'],
  power: ['O consumo total é de {0} watts{1}.', 'Total power draw is {0} watts{1}.', 'El consumo total es de {0} vatios{1}.', 'La consommation totale est de {0} watts{1}.'],
  power_cost: [', cerca de {0} euros por dia', ', about {0} euros per day', ', unos {0} euros al día', ', environ {0} euros par jour'],
  profit: ['O lucro estimado é de {0} euros por dia.', 'The estimated profit is {0} euros per day.', 'El beneficio estimado es de {0} euros al día.', 'Le bénéfice estimé est de {0} euros par jour.'],
  no_data: ['Ainda não tenho esses dados da rede.', "I don't have that network data yet.", 'Aún no tengo esos datos de la red.', "Je n'ai pas encore ces données du réseau."],
  best: ['O melhor share é da {0}: {1}, a {2} por cento do caminho até um bloco.', 'The best share is from {0}: {1}, {2} percent of the way to a block.', 'El mejor share es de {0}: {1}, al {2} por ciento del camino hasta un bloque.', 'Le meilleur share est de {0} : {1}, à {2} pour cent du chemin vers un bloc.'],
  price: ['O Bitcoin está a {0} euros.', 'Bitcoin is at {0} euros.', 'Bitcoin está a {0} euros.', 'Le Bitcoin est à {0} euros.'],
  adjust: ['O próximo ajuste de dificuldade é daqui a {0}, previsto em {1} por cento.', 'The next difficulty adjustment is in {0}, expected at {1} percent.', 'El próximo ajuste de dificultad es dentro de {0}, previsto en {1} por ciento.', "Le prochain ajustement de difficulté est dans {0}, prévu à {1} pour cent."],
  halving: ['O próximo halving é daqui a {0}.', 'The next halving is in {0}.', 'El próximo halving es dentro de {0}.', 'Le prochain halving est dans {0}.'],
  dur: ['{0} dias e {1} horas', '{0} days and {1} hours', '{0} días y {1} horas', '{0} jours et {1} heures'],
  dur_h: ['{0} horas e {1} minutos', '{0} hours and {1} minutes', '{0} horas y {1} minutos', '{0} heures et {1} minutes'],
  ask_prof: ['Aplicar o perfil {0} a {1}? Diga sim para confirmar.', 'Apply the {0} profile to {1}? Say yes to confirm.', '¿Aplicar el perfil {0} a {1}? Diga sí para confirmar.', 'Appliquer le profil {0} à {1} ? Dites oui pour confirmer.'],
  ask_restart: ['Reiniciar {0}? Diga sim para confirmar.', 'Restart {0}? Say yes to confirm.', '¿Reiniciar {0}? Diga sí para confirmar.', 'Redémarrer {0} ? Dites oui pour confirmer.'],
  done: ['Feito ({0} de {1}).', 'Done ({0} of {1}).', 'Hecho ({0} de {1}).', 'Fait ({0} sur {1}).'],
  fail: ['Algumas falharam ({0} de {1}).', 'Some failed ({0} of {1}).', 'Algunas fallaron ({0} de {1}).', 'Certaines ont échoué ({0} sur {1}).'],
  cancel: ['Cancelado.', 'Cancelled.', 'Cancelado.', 'Annulé.'],
  no_prof: ['Não tem o perfil {0} guardado.', "You don't have the {0} profile saved.", 'No tiene guardado el perfil {0}.', "Vous n'avez pas enregistré le profil {0}."],
  locked: ['As ações estão bloqueadas pelo PIN.', 'Actions are locked by the PIN.', 'Las acciones están bloqueadas por el PIN.', 'Les actions sont verrouillées par le PIN.'],
  nomach: ['Não encontrei essa máquina.', "I couldn't find that machine.", 'No encontré esa máquina.', "Je n'ai pas trouvé cette machine."],
  noon: ['Nenhuma máquina ligada para isso.', 'No online machine for that.', 'Ninguna máquina conectada para eso.', 'Aucune machine en ligne pour cela.'],
  all: ['todas as máquinas', 'all machines', 'todas las máquinas', 'toutes les machines'],
  unknown: ['Não percebi. Diga ajuda para ver o que posso fazer.', "I didn't get that. Say help to see what I can do.", 'No entendí. Diga ayuda para ver lo que puedo hacer.', "Je n'ai pas compris. Dites aide pour voir ce que je peux faire."],
  title: ['Falar com a farm', 'Talk to the farm', 'Hablar con la granja', 'Parler à la ferme'],
  listen: ['A ouvir…', 'Listening…', 'Escuchando…', 'À l’écoute…'],
  ph: ['Escreva ou diga um comando…', 'Type or say a command…', 'Escriba o diga un comando…', 'Écrivez ou dites une commande…'],
  nosr: ['Este navegador não tem reconhecimento de voz: escreva o comando.', 'This browser has no speech recognition: type the command.', 'Este navegador no tiene reconocimiento de voz: escriba el comando.', "Ce navigateur n'a pas de reconnaissance vocale : écrivez la commande."],
  denied: ['Sem permissão para o microfone: escreva o comando.', 'No microphone permission: type the command.', 'Sin permiso para el micrófono: escriba el comando.', "Pas d'autorisation pour le micro : écrivez la commande."],
  sound: ['Voz de resposta', 'Spoken answers', 'Respuesta por voz', 'Réponse vocale'],
  you: ['Você', 'You', 'Usted', 'Vous'],
  btn: ['Falar com a farm (voz)', 'Talk to the farm (voice)', 'Hablar con la granja (voz)', 'Parler à la ferme (voix)']
};
const mcVL = () => ['pt', 'en', 'es', 'fr'].indexOf(currentLang) < 0 ? 0 : ['pt', 'en', 'es', 'fr'].indexOf(currentLang);
function VX(k, ...a){ let s = MC_VT[k][mcVL()]; a.forEach((v, i) => { s = s.split('{' + i + '}').join(v); }); return s; }

const mcNorm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const MC_SPOKEN = { 'TH/s': ['terahash por segundo', 'terahashes per second', 'terahashes por segundo', 'térahashs par seconde'], 'GH/s': ['gigahash por segundo', 'gigahashes per second', 'gigahashes por segundo', 'gigahashs par seconde'],
  'MH/s': ['megahash por segundo', 'megahashes per second', 'megahashes por segundo', 'mégahashs par seconde'], 'PH/s': ['petahash por segundo', 'petahashes per second', 'petahashes por segundo', 'pétahashs par seconde'] };
const mcSpoken = s => Object.keys(MC_SPOKEN).reduce((out, k) => out.split(k).join(MC_SPOKEN[k][mcVL()]), String(s));
function mcVoiceDur(sec){
  if(!isFinite(sec) || sec <= 0) return '—';
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
  return d >= 1 ? VX('dur', d, h) : VX('dur_h', h, m);
}
// máquina referida na frase: pelo nome (a mais comprida) ou pelo número ("máquina 2")
function mcVoiceMachine(norm){
  const list = devices || [];
  let best = null;
  list.forEach(d => { const n = mcNorm(d.name || ''); if(n.length >= 2 && (' ' + norm + ' ').includes(' ' + n + ' ') && (!best || n.length > mcNorm(best.name).length)) best = d; });
  if(best) return best;
  const m = norm.match(/(?:maquina|machine|miner|nr|numero|number|no|n)\s*(\d{1,2})\b/);
  if(m && list[Number(m[1]) - 1]) return list[Number(m[1]) - 1];
  return null;
}
const mcVHash = r => { const f = formatHashrate(Number(r.hashrate) || 0); return f.value + ' ' + f.unit; };

// devolve { say, pending? }; "pending" é uma ação que espera pelo "sim"
function mcVoiceAnswer(text){
  const n = mcNorm(text), words = n.split(' ').filter(Boolean), list = devices || [];
  if(mcVoice.pending && Date.now() < mcVoice.pending.until){
    const p = mcVoice.pending; mcVoice.pending = null;
    if(/^(sim|confirmo|confirma|claro|pode|yes|yep|ok|okay|si|vale|oui|d accord|vai|faz)\b/.test(n)) return { run: p.run };
    return { say: VX('cancel') };
  }
  mcVoice.pending = null;
  if(!n) return { say: VX('unknown') };
  if(/\b(ajuda|ajudar|help|ayuda|aide)\b/.test(n) || /o que (podes|consegues|sabes)|what can|que puedes|que peux/.test(n)) return { say: VX('help') };
  if(!list.length) return { say: VX('none') };
  const mach = mcVoiceMachine(n), all = /\b(todas|todos|all|every|toda|toutes|tous|todos)\b/.test(n), rd = d => readings[d.id], onl = list.filter(d => rd(d) && rd(d).online);
  const nameOf = d => d.name || d.ip;
  // ordens (precisam de confirmação)
  const act = /(reinici|restart|reboot|redemarr)/.test(n) ? 'restart' : /\b(eco|economi\w*|poupa\w*|ahorr\w*|economique)\b/.test(n) ? 'eco' : /(turbo|boost|maxim\w*|rapid\w*)/.test(n) ? 'turbo' : '';
  if(act){
    if(mc.locked) return { say: VX('locked') };
    if(!mach && !all) return { say: VX('nomach') };
    const targets = (mach ? [mach] : list).filter(d => rd(d) && rd(d).online);
    if(!targets.length) return { say: VX('noon') };
    const label = mach ? nameOf(mach) : VX('all');
    if(act !== 'restart'){
      const prof = typeof getQuickSlot === 'function' ? getQuickSlot(act) : null;
      if(!prof) return { say: VX('no_prof', act) };
      return { say: VX('ask_prof', prof.name, label), pending: { until: Date.now() + 20000, run: async () => {
        let ok = 0; for(const d of targets){ const r = await aiApplyProfile(prof, d); if(r && r.ok) ok++; mcLogEvent('🎤 ' + prof.name + ' → ' + nameOf(d), r && r.ok ? 'info' : 'bad', d.id); }
        renderAll(); return ok === targets.length ? VX('done', ok, targets.length) : VX('fail', ok, targets.length); } } };
    }
    return { say: VX('ask_restart', label), pending: { until: Date.now() + 20000, run: async () => {
      let ok = 0; for(const d of targets){ const r = await aiRestartDevice(d); if(r && r.ok) ok++; mcLogEvent('🎤 ⟲ ' + nameOf(d), r && r.ok ? 'warn' : 'bad', d.id); }
      return ok === targets.length ? VX('done', ok, targets.length) : VX('fail', ok, targets.length); } } };
  }
  // perguntas
  if(/halving|halve/.test(n)){
    const d = typeof difficultyData !== 'undefined' ? difficultyData : null;
    if(!d || !d.currentHeight) return { say: VX('no_data') };
    return { say: VX('halving', mcVoiceDur((Math.floor(d.currentHeight / 210000) + 1) * 210000 * 600 - d.currentHeight * 600)) };
  }
  if(/(ajuste|adjust|ajustement|dificuldade|difficulty|dificultad|difficulte|retarget)/.test(n)){
    const d = typeof difficultyData !== 'undefined' ? difficultyData : null;
    if(!d || !d.estimatedRetargetDate) return { say: VX('no_data') };
    return { say: VX('adjust', mcVoiceDur((d.estimatedRetargetDate - Date.now()) / 1000), Number(d.difficultyChange).toFixed(1)) };
  }
  if(/(bitcoin|btc|preco|price|precio|prix|cotacao|cotizacion|cours)/.test(n)){
    const eur = typeof currentRates !== 'undefined' && currentRates && currentRates.btc_eur;
    return { say: eur ? VX('price', Math.round(eur).toLocaleString(mcLocale())) : VX('no_data') };
  }
  if(/(melhor|recorde|best|record|mejor|meilleur|share)/.test(n)){
    let top = null; onl.forEach(d => { if(!top || Number(rd(d).best) > Number(rd(top).best)) top = d; });
    if(!top || !(Number(rd(top).best) > 0)) return { say: VX('no_data') };
    const f = formatDiff(Number(rd(top).best)), pct = Math.min(100, Math.log10(Number(rd(top).best)) / Math.log10(mcArenaNet()) * 100);
    return { say: VX('best', nameOf(top), f.value + ' ' + f.unit, pct.toFixed(0)) };
  }
  if(/(lucro|profit|ganancia|benefice|rentab)/.test(n)){
    const st = mcStats(list), eco = mcEconomics(st.nowHash, st.watts);
    return { say: eco && eco.hasEur ? VX('profit', eco.profit.toFixed(2)) : VX('no_data') };
  }
  if(/(consumo|energia|watts?|power|consumption|electric|eletric|consommation|electricidad|corrente)/.test(n)){
    const w = onl.reduce((s, d) => s + (Number(rd(d).power) || 0), 0), price = mcEffPrice();
    return { say: VX('power', Math.round(w), price ? VX('power_cost', (w / 1000 * 24 * price).toFixed(2)) : '') };
  }
  if(/(offline|off line|desligad|parad|caiu|cairam|down|apagad|hors|caid)/.test(n)){
    if(mach) return { say: rd(mach) && rd(mach).online ? VX('hash_one', nameOf(mach), mcVHash(rd(mach))) : VX('off_one', nameOf(mach)) };
    const off = list.filter(d => !(rd(d) && rd(d).online));
    return { say: off.length ? VX('off_list', off.map(nameOf).join(', ')) : VX('off_none') };
  }
  if(/(temperatura|quente|calor|hot|temperature|caliente|chaud|aquec|overheat|sobreaquec|graus|grados|degres)/.test(n)){
    if(mach){ const r = rd(mach); return { say: r && r.online ? VX('temp_one', nameOf(mach), Math.round(Number(r.temp) || 0)) : VX('off_one', nameOf(mach)) }; }
    let hot = null; onl.forEach(d => { if(!hot || Number(rd(d).temp) > Number(rd(hot).temp)) hot = d; });
    return { say: hot ? VX('temp_hot', nameOf(hot), Math.round(Number(rd(hot).temp) || 0)) : VX('off_none') };
  }
  if(/(hashrate|hash rate|velocidade|speed|vitesse|velocidad|rendimento|desempenho)/.test(n)){
    if(mach){ const r = rd(mach); return { say: r && r.online ? VX('hash_one', nameOf(mach), mcVHash(r)) : VX('off_one', nameOf(mach)) }; }
    const gh = onl.reduce((s, d) => s + (algoGroupOf(rd(d)) === 'sha256' ? Number(rd(d).hashrate) || 0 : 0), 0), f = formatHashrate(gh);
    return { say: VX('hash_all', f.value + ' ' + f.unit) };
  }
  if(mach){ const r = rd(mach); return { say: r && r.online ? VX('hash_one', nameOf(mach), mcVHash(r)) + ' ' + VX('temp_one', nameOf(mach), Math.round(Number(r.temp) || 0)) : VX('off_one', nameOf(mach)) }; }
  if(/(como|estado|status|resumo|resume|summary|how|comment|etat|bilan|quantas|cuantas|combien|tudo|everything|todo)/.test(n) || words.length <= 2){
    const gh = onl.reduce((s, d) => s + (algoGroupOf(rd(d)) === 'sha256' ? Number(rd(d).hashrate) || 0 : 0), 0), f = formatHashrate(gh);
    let hot = null; onl.forEach(d => { if(!hot || Number(rd(d).temp) > Number(rd(hot).temp)) hot = d; });
    const warn = list.filter(d => ['warm', 'hot', 'warn', 'off'].includes(mcStateOf(rd(d)))).length;
    return { say: VX('over', onl.length, list.length, f.value + ' ' + f.unit, warn && hot ? VX('warn', warn, nameOf(hot), Math.round(Number(rd(hot).temp) || 0)) : VX('allok')) };
  }
  return { say: VX('unknown') };
}

// ---- voz sintetizada ----
function mcVoiceSay(text, then){
  const out = $('mcVoiceOut');
  if(out) out.textContent = text;
  if(!mcVoice.speak || !('speechSynthesis' in window)){ if(then) then(); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(mcSpoken(text)), lang = MC_VOICE_LANG[currentLang] || 'pt-PT';
    u.lang = lang; u.rate = 1.03;
    const v = speechSynthesis.getVoices().find(x => x.lang === lang) || speechSynthesis.getVoices().find(x => x.lang && x.lang.slice(0, 2) === lang.slice(0, 2));
    if(v) u.voice = v;
    u.onend = u.onerror = () => { if(then) then(); };
    speechSynthesis.speak(u);
  } catch(e) { if(then) then(); }
}
async function mcVoiceHandle(text){
  const line = $('mcVoiceIn');
  if(line) line.textContent = '🗣 ' + text;
  let res;
  try { res = mcVoiceAnswer(text); } catch(e) { console.warn('[voz]', e); res = { say: VX('unknown') }; }
  if(res.run){ res = { say: await res.run() }; }
  if(res.pending) mcVoice.pending = res.pending;
  mcVoiceSay(res.say, () => { if(mcVoice.pending && mcVoice.rec === null && mcVoiceSR()) mcVoiceListen(); });
}

// ---- reconhecimento de voz e painel ----
const mcVoiceSR = () => window.SpeechRecognition || window.webkitSpeechRecognition;
function mcVoiceStop(){ try { if(mcVoice.rec) mcVoice.rec.abort(); } catch(e) {} mcVoice.rec = null; mcVoice.on = false; if($('mcVoicePanel')) $('mcVoicePanel').classList.remove('live'); }
function mcVoiceListen(){
  const SR = mcVoiceSR();
  if(!SR){ mcVoiceSay(VX('nosr')); return; }
  mcVoiceStop();
  try { speechSynthesis.cancel(); } catch(e) {}
  const rec = new SR();
  rec.lang = MC_VOICE_LANG[currentLang] || 'pt-PT'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  mcVoice.rec = rec; mcVoice.on = true;
  const panel = $('mcVoicePanel'), line = $('mcVoiceIn');
  if(panel) panel.classList.add('live');
  if(line) line.textContent = '🎤 ' + VX('listen');
  let final = '';
  rec.onresult = e => {
    let txt = '', fin = false;
    for(const r of e.results){ txt += r[0].transcript; if(r.isFinal) fin = true; }
    if(line) line.textContent = '🗣 ' + txt;
    if(fin) final = txt;
  };
  rec.onerror = e => { if(e.error === 'not-allowed' || e.error === 'service-not-allowed') mcVoiceSay(VX('denied')); };
  rec.onend = () => { mcVoice.rec = null; mcVoice.on = false; if(panel) panel.classList.remove('live'); if(final) mcVoiceHandle(final); };
  try { rec.start(); } catch(e) { mcVoice.rec = null; mcVoice.on = false; }
}
function mcVoiceOpen(){
  let p = $('mcVoicePanel');
  if(p){ p.remove(); mcVoiceStop(); try { speechSynthesis.cancel(); } catch(e) {} return; }
  p = document.createElement('div');
  p.id = 'mcVoicePanel'; p.className = 'mc-voice';
  p.innerHTML = '<div class="mc-vo-head"><b>🎤 ' + VX('title') + '</b><label title="' + VX('sound') + '"><input type="checkbox" id="mcVoiceSnd"' + (mcVoice.speak ? ' checked' : '') + '> 🔊</label><button type="button" data-vo="close" aria-label="✕">✕</button></div>' +
    '<div class="mc-vo-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
    '<div class="mc-vo-in" id="mcVoiceIn"></div><div class="mc-vo-out" id="mcVoiceOut"></div>' +
    '<form class="mc-vo-form" id="mcVoiceForm"><button type="button" data-vo="mic" aria-label="🎤">🎤</button><input type="text" id="mcVoiceTxt" placeholder="' + VX('ph') + '" autocomplete="off"><button type="submit">➤</button></form>';
  document.body.appendChild(p);
  p.addEventListener('click', e => {
    const b = e.target.closest('[data-vo]');
    if(!b) return;
    if(b.dataset.vo === 'close') mcVoiceOpen();
    else if(b.dataset.vo === 'mic') mcVoice.on ? mcVoiceStop() : mcVoiceListen();
  });
  $('mcVoiceSnd').addEventListener('change', e => { mcVoice.speak = e.target.checked; try { localStorage.setItem('nerdqaxe:voice_speak', mcVoice.speak ? '1' : '0'); } catch(x) {} if(!mcVoice.speak) try { speechSynthesis.cancel(); } catch(x) {} });
  $('mcVoiceForm').addEventListener('submit', e => { e.preventDefault(); const i = $('mcVoiceTxt'), v = i.value.trim(); if(v){ i.value = ''; mcVoiceHandle(v); } });
  if(mcVoiceSR()) mcVoiceListen(); else { $('mcVoiceOut').textContent = VX('nosr'); $('mcVoiceTxt').focus(); }
}
document.addEventListener('click', e => { if(e.target.closest('#mcVoiceBtn')) mcVoiceOpen(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape' && $('mcVoicePanel')) mcVoiceOpen(); });
