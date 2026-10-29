// ---------- Assistente: o motor que estuda as máquinas ----------
// Corre sozinho, com ou sem o modo autónomo ligado. De minuto a minuto regista como cada máquina se comporta em
// cada combinação de frequência e tensão (consumo, hashrate, temperatura, rejeições), aprende o que é "normal"
// para cada uma, vai à net buscar a previsão do tempo (Open-Meteo, sem chave) e o preço/dificuldade do Bitcoin,
// e transforma isso em estudos, sugestões e avisos. Tudo fica neste navegador; nada sobre as máquinas sai daqui.
// Autonomia: só PROTEGE sozinho (baixa a frequência/tensão quando há risco) e só SUGERE o resto, que só se aplica
// quando o utilizador aceita. Depois de qualquer alteração verifica sozinho, uns minutos depois, se melhorou.
const AS_KEY = 'nerdqaxe:ai_study', AS_DIARY_KEY = 'nerdqaxe:ai_diary', AS_DISMISS_KEY = 'nerdqaxe:ai_dismissed';
const AS_TX = {
  learning: ['A aprender: {0} pontos de funcionamento, {1} de dados', 'Learning: {0} operating points, {1} of data', 'Aprendiendo: {0} puntos de funcionamiento, {1} de datos', 'Apprentissage : {0} points de fonctionnement, {1} de données'],
  offline: ['{0} está offline.', '{0} is offline.', '{0} está sin conexión.', '{0} est hors ligne.'],
  better_t: ['{0}: há um ponto de funcionamento melhor', '{0}: there is a better operating point', '{0}: hay un punto de funcionamiento mejor', '{0} : il existe un meilleur point de fonctionnement'],
  better_d: ['{0} MHz / {1} mV gastou {2} J/TH ({3}% menos que os {4} atuais) com {5} °C de média, em {6} de dados e hashrate estável.', '{0} MHz / {1} mV used {2} J/TH ({3}% less than the current {4}) at {5} °C average, over {6} of data with stable hashrate.', '{0} MHz / {1} mV gastó {2} J/TH ({3}% menos que los {4} actuales) con {5} °C de media, en {6} de datos y hashrate estable.', '{0} MHz / {1} mV a consommé {2} J/TH ({3}% de moins que les {4} actuels) à {5} °C de moyenne, sur {6} de données avec un hashrate stable.'],
  under_t: ['{0}: experimente baixar a tensão {1} mV', '{0}: try lowering the voltage by {1} mV', '{0}: pruebe a bajar la tensión {1} mV', '{0} : essayez de baisser la tension de {1} mV'],
  under_d: ['Há margem: {0} °C de média (limite {1} °C), {2}% de rejeições e hashrate estável há {3}. Um passo pequeno costuma poupar 2% a 4% de energia. Depois de aplicar, verifico sozinho e aviso se piorar.', 'There is headroom: {0} °C average (limit {1} °C), {2}% rejects and stable hashrate for {3}. A small step usually saves 2% to 4% of power. After applying, I check on my own and warn if it gets worse.', 'Hay margen: {0} °C de media (límite {1} °C), {2}% de rechazos y hashrate estable desde hace {3}. Un paso pequeño suele ahorrar entre un 2% y un 4% de energía. Tras aplicarlo, verifico solo y aviso si empeora.', "Il y a de la marge : {0} °C de moyenne (limite {1} °C), {2}% de rejets et hashrate stable depuis {3}. Un petit pas économise souvent 2% à 4% d'énergie. Après application, je vérifie seul et je prévois si ça empire."],
  heat_t: ['{0}: o calor previsto pode levá-la a ~{1} °C', '{0}: the forecast heat may push it to ~{1} °C', '{0}: el calor previsto puede llevarla a ~{1} °C', '{0} : la chaleur prévue peut la porter à ~{1} °C'],
  heat_d: ['Previsão para {0}: {1} °C às {2} (agora {3} °C). Pelo que aprendi desta máquina, cada grau lá fora dá ~{4} °C nela. O limite que definiu é {5} °C.', 'Forecast for {0}: {1} °C at {2} (now {3} °C). From what I learned about this machine, each degree outside adds ~{4} °C to it. Your limit is {5} °C.', 'Previsión para {0}: {1} °C a las {2} (ahora {3} °C). Por lo que aprendí de esta máquina, cada grado de fuera le suma ~{4} °C. Su límite es {5} °C.', 'Prévision pour {0} : {1} °C à {2} (maintenant {3} °C). D\'après ce que j\'ai appris de cette machine, chaque degré dehors ajoute ~{4} °C. Votre limite est {5} °C.'],
  low_t: ['{0}: hashrate {1}% abaixo do normal', '{0}: hashrate {1}% below normal', '{0}: hashrate {1}% por debajo de lo normal', '{0} : hashrate {1}% sous la normale'],
  low_d: ['Está em {0} quando o normal desta máquina (mediana de 24 h) é {1}, há {2}. Pode ser calor, Wi-Fi, pool ou uma falha: veja o estudo ou reinicie.', 'It is at {0} while this machine\'s normal (24 h median) is {1}, for {2}. It could be heat, Wi-Fi, the pool or a fault: check the study or restart.', 'Está en {0} cuando lo normal de esta máquina (mediana de 24 h) es {1}, desde hace {2}. Puede ser calor, Wi-Fi, pool o una avería: vea el estudio o reinicie.', 'Elle est à {0} alors que la normale de cette machine (médiane sur 24 h) est {1}, depuis {2}. Chaleur, Wi-Fi, pool ou panne : voyez l\'étude ou redémarrez.'],
  wifi_t: ['{0}: sinal Wi-Fi fraco ({1} dBm)', '{0}: weak Wi-Fi signal ({1} dBm)', '{0}: señal Wi-Fi débil ({1} dBm)', '{0} : signal Wi-Fi faible ({1} dBm)'],
  wifi_d: ['Com este sinal costumam aparecer quedas e shares rejeitadas. Aproxime a máquina do router ou use uma antena/repetidor.', 'With this signal, drops and rejected shares are common. Move the machine closer to the router or use an antenna/repeater.', 'Con esta señal suelen aparecer caídas y shares rechazados. Acerque la máquina al router o use una antena/repetidor.', 'Avec ce signal, coupures et shares rejetés sont fréquents. Rapprochez la machine du routeur ou utilisez une antenne/répéteur.'],
  ping_t: ['{0}: ping ao pool alto ({1} ms)', '{0}: high ping to the pool ({1} ms)', '{0}: ping alto al pool ({1} ms)', '{0} : ping élevé vers le pool ({1} ms)'],
  ping_d: ['Um ping alto aumenta as rejeições. Veja a aba Latência e considere uma pool mais próxima.', 'High ping raises rejects. See the Latency tab and consider a closer pool.', 'Un ping alto aumenta los rechazos. Vea la pestaña Latencia y considere un pool más cercano.', 'Un ping élevé augmente les rejets. Voyez l\'onglet Latence et envisagez un pool plus proche.'],
  loss_t: ['{0}: não rende o que gasta ({1} €/dia)', '{0}: it does not earn what it costs ({1} €/day)', '{0}: no rinde lo que gasta ({1} €/día)', '{0} : elle ne rapporte pas ce qu\'elle coûte ({1} €/jour)'],
  loss_d: ['Com o Bitcoin a {0} € e a dificuldade atual, o ganho esperado não cobre a eletricidade. Se minera por prazer ou a solo pelo bilhete de lotaria, é normal.', 'With Bitcoin at {0} € and the current difficulty, the expected earnings do not cover electricity. If you mine for fun or solo for the lottery ticket, that is normal.', 'Con Bitcoin a {0} € y la dificultad actual, la ganancia esperada no cubre la electricidad. Si mina por gusto o en solitario por el boleto de lotería, es normal.', 'Avec le Bitcoin à {0} € et la difficulté actuelle, le gain attendu ne couvre pas l\'électricité. Si vous minez pour le plaisir ou en solo pour le ticket de loterie, c\'est normal.'],
  vr_t: ['{0}: regulador de tensão (VR) quente ({1} °C)', '{0}: voltage regulator (VR) hot ({1} °C)', '{0}: regulador de tensión (VR) caliente ({1} °C)', '{0} : régulateur de tension (VR) chaud ({1} °C)'],
  vr_d: ['Perto do limite de {0} °C. Melhore a ventilação do VR ou baixe a frequência.', 'Near the {0} °C limit. Improve VR airflow or lower the frequency.', 'Cerca del límite de {0} °C. Mejore la ventilación del VR o baje la frecuencia.', 'Près de la limite de {0} °C. Améliorez la ventilation du VR ou baissez la fréquence.'],
  apply: ['Aplicar', 'Apply', 'Aplicar', 'Appliquer'], restart: ['Reiniciar', 'Restart', 'Reiniciar', 'Redémarrer'], dismiss: ['Ignorar', 'Dismiss', 'Ignorar', 'Ignorer'], open_tab: ['Abrir', 'Open', 'Abrir', 'Ouvrir'],
  d_prot: ['🛡️ {0}: {1} °C → perfil seguro "{2}" aplicado.', '🛡️ {0}: {1} °C → safe profile "{2}" applied.', '🛡️ {0}: {1} °C → perfil seguro "{2}" aplicado.', '🛡️ {0} : {1} °C → profil sûr « {2} » appliqué.'],
  d_prot_vr: ['🛡️ {0}: VR a {1} °C → perfil seguro "{2}" aplicado.', '🛡️ {0}: VR at {1} °C → safe profile "{2}" applied.', '🛡️ {0}: VR a {1} °C → perfil seguro "{2}" aplicado.', '🛡️ {0} : VR à {1} °C → profil sûr « {2} » appliqué.'],
  d_prev: ['🌡️ {0}: calor previsto (~{1} °C) → perfil seguro "{2}" aplicado de forma preventiva.', '🌡️ {0}: forecast heat (~{1} °C) → safe profile "{2}" applied preventively.', '🌡️ {0}: calor previsto (~{1} °C) → perfil seguro "{2}" aplicado de forma preventiva.', '🌡️ {0} : chaleur prévue (~{1} °C) → profil sûr « {2} » appliqué par précaution.'],
  d_applied: ['✅ {0}: {1} MHz / {2} mV aplicado (a sua decisão). Vou verificar daqui a uns minutos.', '✅ {0}: {1} MHz / {2} mV applied (your decision). I will check in a few minutes.', '✅ {0}: {1} MHz / {2} mV aplicado (su decisión). Verificaré en unos minutos.', '✅ {0} : {1} MHz / {2} mV appliqué (votre décision). Je vérifierai dans quelques minutes.'],
  d_ok: ['🔎 Verificado em {0}: consumo {1}%, hashrate {2}%, temperatura {3} °C. Correu bem.', '🔎 Checked on {0}: power {1}%, hashrate {2}%, temperature {3} °C. It went well.', '🔎 Verificado en {0}: consumo {1}%, hashrate {2}%, temperatura {3} °C. Salió bien.', '🔎 Vérifié sur {0} : consommation {1}%, hashrate {2}%, température {3} °C. Ça s\'est bien passé.'],
  d_bad: ['⚠️ Verificado em {0}: consumo {1}%, hashrate {2}%, temperatura {3} °C. Não melhorou: sugiro voltar atrás.', '⚠️ Checked on {0}: power {1}%, hashrate {2}%, temperature {3} °C. It did not improve: I suggest going back.', '⚠️ Verificado en {0}: consumo {1}%, hashrate {2}%, temperatura {3} °C. No mejoró: sugiero volver atrás.', '⚠️ Vérifié sur {0} : consommation {1}%, hashrate {2}%, température {3} °C. Pas d\'amélioration : je suggère de revenir en arrière.'],
  d_prot_ok: ['🔎 Verificado em {0}: a temperatura desceu para {1} °C.', '🔎 Checked on {0}: the temperature dropped to {1} °C.', '🔎 Verificado en {0}: la temperatura bajó a {1} °C.', '🔎 Vérifié sur {0} : la température est descendue à {1} °C.'],
  d_prot_bad: ['⚠️ Verificado em {0}: continua a {1} °C mesmo com o perfil seguro. Convém ver a ventilação.', '⚠️ Checked on {0}: still at {1} °C even with the safe profile. Check the airflow.', '⚠️ Verificado en {0}: sigue a {1} °C incluso con el perfil seguro. Conviene revisar la ventilación.', '⚠️ Vérifié sur {0} : toujours à {1} °C même avec le profil sûr. Vérifiez la ventilation.'],
  d_start: ['🧠 Estudo ligado: vou aprender com {0} máquina(s).', '🧠 Study on: I will learn from {0} machine(s).', '🧠 Estudio activado: aprenderé de {0} máquina(s).', '🧠 Étude activée : j\'apprendrai de {0} machine(s).'],
  d_revert: ['↩️ Reverter {0} para {1} MHz / {2} mV', '↩️ Revert {0} to {1} MHz / {2} mV', '↩️ Revertir {0} a {1} MHz / {2} mV', '↩️ Revenir {0} à {1} MHz / {2} mV'],
  d_revert_d: ['O ponto anterior era melhor medido por mim. Aplica-se só se aceitar.', 'The previous point measured better. It is only applied if you accept.', 'El punto anterior medía mejor. Solo se aplica si acepta.', 'Le point précédent mesurait mieux. Il ne s\'applique que si vous acceptez.'],
  time_h: ['{0} h {1} min', '{0} h {1} min', '{0} h {1} min', '{0} h {1} min'], time_m: ['{0} min', '{0} min', '{0} min', '{0} min'],
  profile_name: ['{0} MHz / {1} mV', '{0} MHz / {1} mV', '{0} MHz / {1} mV', '{0} MHz / {1} mV']
};
const asLang = () => { const i = ['pt', 'en', 'es', 'fr'].indexOf(typeof currentLang !== 'undefined' ? currentLang : 'pt'); return i < 0 ? 0 : i; };
function AT(k, ...a){ let s = (AS_TX[k] || ['', '', '', ''])[asLang()]; a.forEach((v, i) => { s = s.split('{' + i + '}').join(v); }); return s; }
const asDur = ms => { const m = Math.round(ms / 60000); return m >= 60 ? AT('time_h', Math.floor(m / 60), m % 60) : AT('time_m', Math.max(1, m)); };
const asFmtHash = ghs => { try { const f = formatHashrate(ghs); return f.value + ' ' + f.unit; } catch(e) { return ghs.toFixed(0) + ' GH/s'; } };
const asLs = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch(e) { return d; } };
const asSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} };

const AS = { data: asLs(AS_KEY, {}), diary: asLs(AS_DIARY_KEY, []), dismissed: asLs(AS_DISMISS_KEY, {}), sugg: [], pending: [], last: {}, forecast: null, forecastAt: 0, netAt: { wx: 0, fc: 0 }, scores: {}, insights: {}, started: false, lastSave: 0, lastProt: {}, prevDay: asLs('nerdqaxe:ai_prev', {}), tick: 0 };

// ---------------- registo e diário ----------------
function asDiary(text, kind){
  AS.diary.unshift({ t: Date.now(), text, kind: kind || 'info' });
  if(AS.diary.length > 120) AS.diary.length = 120;
  asSet(AS_DIARY_KEY, AS.diary);
  if(typeof aifRender === 'function') aifRender();
}
function asSave(force){
  if(!force && Date.now() - AS.lastSave < 30000) return;
  AS.lastSave = Date.now();
  // guarda no máximo 40 pontos de funcionamento por máquina (os mais usados)
  Object.keys(AS.data).forEach(id => {
    const st = AS.data[id].settings, keys = Object.keys(st);
    if(keys.length > 40){ keys.sort((a, b) => st[b].n - st[a].n).slice(40).forEach(k => delete st[k]); }
  });
  asSet(AS_KEY, AS.data);
}

// ---------------- recolha ----------------
function asAmbient(){ try { const v = WX && WX.data && WX.data.temperature_2m; return typeof v === 'number' ? v : null; } catch(e) { return null; } }
function asSample(){
  const now = Date.now(), amb = asAmbient();
  (devices || []).forEach(dev => {
    const r = readings[dev.id];
    if(!r || !r.online || !(Number(r.frequency) > 0) || r.coreVoltage == null) return;
    if(typeof algoGroupOf === 'function' && algoGroupOf(r) !== 'sha256') return;
    const last = AS.last[dev.id];
    if(last && now - last.t < 55000) return;
    const d = AS.data[dev.id] || (AS.data[dev.id] = { settings: {}, since: now });
    const key = Math.round(r.frequency) + '|' + Math.round(r.coreVoltage);
    const s = d.settings[key] || (d.settings[key] = { f: Math.round(r.frequency), v: Math.round(r.coreVoltage), n: 0, sh: 0, sh2: 0, sp: 0, st: 0, mx: 0, sv: 0, nv: 0, acc: 0, rej: 0, na: 0, sa: 0, saa: 0, sat: 0, stt: 0, first: now, last: now });
    const h = Number(r.hashrate) || 0, p = Number(r.power) || 0, tp = Number(r.temp);
    if(!(h > 0) || !isFinite(tp)) return;
    s.n++; s.sh += h; s.sh2 += h * h; s.sp += p; s.st += tp; s.mx = Math.max(s.mx, tp); s.last = now;
    if(r.vrTemp != null && isFinite(r.vrTemp)){ s.sv += Number(r.vrTemp); s.nv++; }
    if(last && last.key === key){
      const da = (Number(r.accepted) || 0) - last.acc, dr = (Number(r.rejected) || 0) - last.rej;
      if(da >= 0 && dr >= 0){ s.acc += da; s.rej += dr; }
    }
    if(amb != null){ s.na++; s.sa += amb; s.saa += amb * amb; s.sat += amb * tp; s.stt += tp; }
    AS.last[dev.id] = { t: now, key, acc: Number(r.accepted) || 0, rej: Number(r.rejected) || 0, h, p, tp, f: s.f, v: s.v };
    (AS.recent = AS.recent || {})[dev.id] = (AS.recent[dev.id] || []).concat([{ t: now, h, p, tp, key, rej: s.rej, acc: s.acc }]).slice(-40);
  });
}
const asStat = s => {
  const n = s.n, h = s.sh / n, p = s.sp / n, sd = Math.sqrt(Math.max(0, s.sh2 / n - h * h));
  return { f: s.f, v: s.v, n, h, p, t: s.st / n, mx: s.mx, vr: s.nv ? s.sv / s.nv : null, eff: h > 0 ? p / (h / 1000) : null, cv: h > 0 ? sd / h * 100 : 0, rejPct: (s.acc + s.rej) > 30 ? s.rej / (s.acc + s.rej) * 100 : 0, span: (s.last - s.first), key: s.f + '|' + s.v };
};
function asSlope(s){
  if(s.na < 30) return null;
  const n = s.na, den = n * s.saa - s.sa * s.sa;
  if(den < n * 1.5) return null;                         // a temperatura de fora quase não variou: ainda não dá para aprender
  return Math.max(0, Math.min(1.5, (n * s.sat - s.sa * s.stt) / den));
}

// ---------------- net: previsão do tempo ----------------
async function asFetchForecast(){
  const l = (typeof WX !== 'undefined') && WX.loc;
  if(!l || l.lat == null) return;
  if(Date.now() - AS.forecastAt < 30 * 60000) return;
  AS.forecastAt = Date.now();
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${l.lat}&longitude=${l.lon}&hourly=temperature_2m&forecast_days=2&timezone=auto`);
    const j = await r.json();
    if(j && j.hourly && j.hourly.time) AS.forecast = { time: j.hourly.time, temp: j.hourly.temperature_2m, place: l.name || '' };
    AS.netAt.fc = Date.now();
  } catch(e) { /* sem ligação: tenta noutra altura */ }
}
function asForecastPeak(hours){
  const f = AS.forecast;
  if(!f) return null;
  const now = Date.now(); let best = null;
  f.time.forEach((ts, i) => { const t = new Date(ts).getTime(); if(t >= now - 3600e3 && t <= now + hours * 3600e3 && (best == null || f.temp[i] > best.temp)) best = { t, temp: f.temp[i] }; });
  return best;
}

// ---------------- análise ----------------
function asMedian24(devId){
  const h = (histories[devId] || []).filter(x => x && x.hashrate > 0).map(x => Number(x.hashrate)).sort((a, b) => a - b);
  return h.length >= 20 ? h[Math.floor(h.length / 2)] : null;
}
function asAnalyze(){
  const th = (typeof mc !== 'undefined' && mc.th) ? mc.th : { vrHot: 85 }, safetyTemp = (typeof aiAgentConfig !== 'undefined' && aiAgentConfig.safetyTemp) || 75;
  const out = [], now = Date.now(), amb = asAmbient();
  AS.insights = {}; AS.scores = {};
  (devices || []).forEach(dev => {
    const r = readings[dev.id], name = dev.name || dev.ip, d = AS.data[dev.id], on = !!(r && r.online);
    const ins = AS.insights[dev.id] = { points: 0, span: 0, best: null, cur: null, slope: null, notes: [] };
    if(!on){ AS.scores[dev.id] = 0; ins.notes.push({ k: 'bad', t: AT('offline', name) }); return; }
    let score = 100;
    const temp = Number(r.temp), vr = Number(r.vrTemp), rej = (Number(r.accepted) || 0) + (Number(r.rejected) || 0) > 30 ? Number(r.rejected) / (Number(r.accepted) + Number(r.rejected)) * 100 : 0;
    if(isFinite(temp)) score -= Math.max(0, Math.min(35, (temp - (safetyTemp - 20)) * 2.3));
    if(isFinite(vr) && vr > th.vrHot - 15) score -= Math.min(15, (vr - (th.vrHot - 15)) * 1.5);
    score -= Math.min(15, rej * 5);
    if(r.rssi != null && r.rssi < -75) score -= Math.min(10, (-75 - r.rssi));
    if(r.poolPing != null && r.poolPing > 200) score -= Math.min(8, (r.poolPing - 200) / 40);
    const med = asMedian24(dev.id), h = Number(r.hashrate) || 0;
    if(med && h < med * .85){ const pct = Math.round((1 - h / med) * 100); score -= Math.min(25, pct); const dur = AS.recent && AS.recent[dev.id] ? AS.recent[dev.id].filter(x => x.h < med * .85).length * 60000 : 0;
      if((AS.recent && AS.recent[dev.id] || []).slice(-8).filter(x => x.h < med * .85).length >= 8) out.push({ id: dev.id + ':low', devId: dev.id, kind: 'low', sev: 'warn', title: AT('low_t', name, pct), detail: AT('low_d', asFmtHash(h), asFmtHash(med), asDur(Math.max(dur, 8 * 60000))), action: { type: 'restart' } }); }
    // estudo dos pontos de funcionamento
    if(d){
      const sets = Object.values(d.settings).map(asStat).filter(x => x.n >= 20), cur = d.settings[Math.round(r.frequency) + '|' + Math.round(r.coreVoltage)];
      ins.points = Object.keys(d.settings).length; ins.span = now - d.since;
      if(cur && cur.n >= 5){ const cs = asStat(cur); ins.cur = cs; ins.slope = asSlope(cur); }
      const curS = ins.cur;
      if(curS && curS.n >= 20 && curS.eff){
        const better = sets.filter(x => x.key !== curS.key && x.eff && x.cv < 5 && x.rejPct <= Math.max(2, curS.rejPct + .5) && x.mx < safetyTemp - 3 && x.h >= curS.h * .93 && x.eff < curS.eff * .95).sort((a, b) => a.eff - b.eff)[0];
        if(better){ ins.best = better; const gain = Math.round((1 - better.eff / curS.eff) * 100), [f, v] = better.key.split('|').map(Number);
          out.push({ id: dev.id + ':better:' + better.key, devId: dev.id, kind: 'better', sev: 'good', title: AT('better_t', name), detail: AT('better_d', f, v, better.eff.toFixed(1), gain, curS.eff.toFixed(1), better.t.toFixed(0), asDur(better.span)), action: { type: 'profile', f, v } }); }
        // experiência: um passo pequeno para baixo na tensão, só com margem de sobra
        const cooled = AS.dismissed[dev.id + ':under'] && now - AS.dismissed[dev.id + ':under'] < 24 * 3600e3;
        if(!better && !cooled && curS.span >= 2 * 3600e3 && curS.n >= 90 && curS.t <= safetyTemp - 10 && curS.mx <= safetyTemp - 5 && curS.cv < 4 && curS.rejPct < 2 && (curS.vr == null || curS.vr < th.vrHot - 12) && curS.key.split('|')[1] >= 1060){
          const [f, v] = curS.key.split('|').map(Number);
          out.push({ id: dev.id + ':under:' + (v - 10), devId: dev.id, kind: 'under', sev: 'info', title: AT('under_t', name, 10), detail: AT('under_d', curS.t.toFixed(0), safetyTemp, curS.rejPct.toFixed(1), asDur(curS.span)), action: { type: 'profile', f, v: v - 10 } }); }
      }
    }
    // previsão do tempo
    const peak = asForecastPeak(12);
    if(peak && amb != null && isFinite(temp)){
      const slope = ins.slope != null ? ins.slope : .5, predicted = temp + slope * (peak.temp - amb);
      ins.predicted = predicted; ins.peak = peak;
      if(predicted >= safetyTemp - 2 && peak.temp > amb + 2){
        const when = new Date(peak.t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        out.push({ id: dev.id + ':heat', devId: dev.id, kind: 'heat', sev: 'warn', title: AT('heat_t', name, Math.round(predicted)), detail: AT('heat_d', AS.forecast.place || '—', Math.round(peak.temp), when, Math.round(amb), slope.toFixed(2), safetyTemp), action: { type: 'safe' } });
        score -= 4;
      }
    }
    if(r.rssi != null && r.rssi <= -80) out.push({ id: dev.id + ':wifi', devId: dev.id, kind: 'wifi', sev: 'warn', title: AT('wifi_t', name, r.rssi), detail: AT('wifi_d') });
    if(r.poolPing != null && r.poolPing > 400) out.push({ id: dev.id + ':ping', devId: dev.id, kind: 'ping', sev: 'info', title: AT('ping_t', name, Math.round(r.poolPing)), detail: AT('ping_d'), action: { type: 'tab', tab: 'latency' } });
    if(isFinite(vr) && vr >= th.vrHot - 5) out.push({ id: dev.id + ':vr', devId: dev.id, kind: 'vr', sev: 'warn', title: AT('vr_t', name, vr.toFixed(0)), detail: AT('vr_d', th.vrHot), action: { type: 'safe' } });
    if(typeof mcEconomics === 'function' && typeof currentRates !== 'undefined' && currentRates && currentRates.btc_eur){
      const eco = mcEconomics(h, Number(r.power) || 0);
      if(eco && eco.hasEur && typeof mcEffPrice === 'function' && mcEffPrice() && eco.profit < -0.02) out.push({ id: dev.id + ':loss', devId: dev.id, kind: 'loss', sev: 'info', title: AT('loss_t', name, eco.profit.toFixed(2)), detail: AT('loss_d', Math.round(currentRates.btc_eur)) });
    }
    AS.scores[dev.id] = Math.max(0, Math.min(100, Math.round(score)));
  });
  // junta com o que o utilizador já ignorou nas últimas 24 h
  AS.sugg = out.filter(s => !(AS.dismissed[s.id] && now - AS.dismissed[s.id] < 24 * 3600e3));
  AS.revert = (AS.revert || []).filter(s => !(AS.dismissed[s.id] && now - AS.dismissed[s.id] < 24 * 3600e3));
}
const asAllSuggestions = () => [...(AS.revert || []), ...AS.sugg];

// ---------------- ações e verificação ----------------
function asRecentAvg(devId, n){
  const a = (AS.recent && AS.recent[devId] || []).slice(-(n || 4)); if(!a.length) return null;
  const m = k => a.reduce((s, x) => s + x[k], 0) / a.length;
  return { h: m('h'), p: m('p'), tp: m('tp'), n: a.length };
}
function asWatch(devId, kind, label, prev){
  const before = asRecentAvg(devId, 5) || null;
  AS.pending.push({ devId, kind, label, prev, before, at: Date.now(), checkAt: Date.now() + 7 * 60000 });
  asSet('nerdqaxe:ai_pending', AS.pending);
}
async function asApplySuggestion(id){
  const s = asAllSuggestions().find(x => x.id === id);
  if(!s) return;
  const dev = (devices || []).find(d => d.id === s.devId), name = dev ? (dev.name || dev.ip) : '';
  if(s.action && s.action.type === 'profile' && dev){
    const r = readings[dev.id] || {}, prev = { f: Math.round(r.frequency), v: Math.round(r.coreVoltage) };
    const res = await aiApplyProfile({ name: AT('profile_name', s.action.f, s.action.v), frequency: s.action.f, coreVoltage: s.action.v }, dev);
    if(res.ok){ asDiary(AT('d_applied', name, s.action.f, s.action.v), 'action'); asWatch(dev.id, 'tune', name, prev); AS.dismissed[s.id] = Date.now(); asSet(AS_DISMISS_KEY, AS.dismissed); }
    else asDiary('⚠️ ' + name + ': ' + (res.error || ''), 'warn');
  } else if(s.action && s.action.type === 'safe' && dev){
    const safe = aiSafeProfileFor(dev);
    if(safe){ const r = readings[dev.id] || {}, res = await aiApplyProfile(safe, dev); if(res.ok){ asDiary(AT('d_prot', name, Number(r.temp || 0).toFixed(0), safe.name), 'action'); asWatch(dev.id, 'prot', name, null); } }
  } else if(s.action && s.action.type === 'restart' && dev){
    if(confirm(name + ': ' + AT('restart') + '?')) await aiRestartDevice(dev);
  } else if(s.action && s.action.type === 'tab' && typeof aiSwitchTo === 'function'){ aiSwitchTo(s.action.tab); }
  asAnalyze(); if(typeof aifRender === 'function') aifRender();
}
function asDismiss(id){
  AS.dismissed[id] = Date.now();
  const s = asAllSuggestions().find(x => x.id === id); if(s && s.kind === 'under') AS.dismissed[s.devId + ':under'] = Date.now();
  asSet(AS_DISMISS_KEY, AS.dismissed); asAnalyze(); if(typeof aifRender === 'function') aifRender();
}
function asVerify(){
  const now = Date.now();
  AS.pending = AS.pending.filter(p => {
    if(now < p.checkAt) return true;
    const after = asRecentAvg(p.devId, 4);
    if(!after || !p.before){ return false; }
    if(p.kind === 'prot'){
      asDiary(after.tp < p.before.tp - 1 ? AT('d_prot_ok', p.label, after.tp.toFixed(0)) : AT('d_prot_bad', p.label, after.tp.toFixed(0)), after.tp < p.before.tp - 1 ? 'ok' : 'warn');
      return false;
    }
    const dP = (after.p / p.before.p - 1) * 100, dH = (after.h / p.before.h - 1) * 100, rejNow = asRecentRej(p.devId);
    const good = dH > -4 && after.tp <= p.before.tp + 2 && rejNow < 3;
    asDiary(AT(good ? 'd_ok' : 'd_bad', p.label, dP.toFixed(0), dH.toFixed(0), after.tp.toFixed(0)), good ? 'ok' : 'warn');
    if(!good && p.prev){
      (AS.revert = AS.revert || []).push({ id: p.devId + ':revert:' + p.prev.f + '|' + p.prev.v, devId: p.devId, kind: 'revert', sev: 'warn', title: AT('d_revert', p.label, p.prev.f, p.prev.v), detail: AT('d_revert_d'), action: { type: 'profile', f: p.prev.f, v: p.prev.v } });
    }
    return false;
  });
  asSet('nerdqaxe:ai_pending', AS.pending);
}
function asRecentRej(devId){
  const a = (AS.recent && AS.recent[devId] || []).slice(-6); if(a.length < 2) return 0;
  const acc = a[a.length - 1].acc - a[0].acc, rej = a[a.length - 1].rej - a[0].rej;
  return acc + rej > 10 ? rej / (acc + rej) * 100 : 0;
}

// ---------------- proteção autónoma (só desce, nunca sobe) ----------------
async function asProtect(){
  if(typeof aiAgentConfig === 'undefined' || !aiAgentConfig.autonomous || !aiAgentConfig.allowProfiles) return;
  const now = Date.now(), th = (typeof mc !== 'undefined' && mc.th) ? mc.th : { vrHot: 85 };
  for(const dev of (devices || [])){
    const r = readings[dev.id]; if(!r || !r.online || dev.mute > now) continue;
    const name = dev.name || dev.ip, vr = Number(r.vrTemp), ins = AS.insights[dev.id] || {};
    const cool = AS.lastProt[dev.id] || 0;
    if(now - cool < 10 * 60000) continue;
    let why = null;
    if(isFinite(vr) && vr >= th.vrHot) why = { k: 'vr', v: vr };
    else if(aiAgentConfig.preventive !== false && ins.predicted != null && ins.predicted >= aiAgentConfig.safetyTemp && ins.peak && ins.peak.t - now < 2.5 * 3600e3 && !AS.prevDay[dev.id + ':' + new Date().toDateString()]) why = { k: 'prev', v: ins.predicted };
    if(!why) continue;
    const safe = aiSafeProfileFor(dev);
    if(!safe) continue;
    const res = await aiApplyProfile(safe, dev);
    AS.lastProt[dev.id] = now;
    if(res.ok){
      if(why.k === 'prev'){ AS.prevDay[dev.id + ':' + new Date().toDateString()] = 1; asSet('nerdqaxe:ai_prev', AS.prevDay); }
      asDiary(why.k === 'vr' ? AT('d_prot_vr', name, why.v.toFixed(0), safe.name) : AT('d_prev', name, Math.round(why.v), safe.name), 'action');
      asWatch(dev.id, 'prot', name, null);
      if(typeof aiAppendMsg === 'function') aiAppendMsg('🤖 ' + (why.k === 'vr' ? AT('d_prot_vr', name, why.v.toFixed(0), safe.name) : AT('d_prev', name, Math.round(why.v), safe.name)), 'bot');
    }
  }
}

// ---------------- relógio do motor ----------------
async function asTick(){
  try {
    AS.tick++;
    if(!AS.diary.length && (devices || []).length) asDiary(AT('d_start', devices.length), 'info');
    asSample();
    if(AS.tick % 3 === 0){ asAnalyze(); asVerify(); await asProtect(); asFetchForecast(); }
    asSave();
    if(typeof aifRender === 'function' && AS.tick % 3 === 0) aifRender();
    if(typeof aifBadge === 'function') aifBadge();
  } catch(e) { console.warn('[assistente] ciclo:', e); }
}
function asStart(){
  if(AS.started) return; AS.started = true;
  AS.pending = asLs('nerdqaxe:ai_pending', []);
  setInterval(asTick, 20000);
  setTimeout(asTick, 4000);
}
setTimeout(asStart, 3000);
window.addEventListener('beforeunload', () => { try { asSave(true); } catch(e) {} });

// ---------------- respostas para a conversa ----------------
function asTextStudy(dev){
  const name = dev.name || dev.ip, d = AS.data[dev.id], ins = AS.insights[dev.id], sc = AS.scores[dev.id];
  if(!d || !ins) return name + ': ' + AT('learning', 0, '0 min');
  const lines = [`🧠 ${name} — ${sc}/100`, AT('learning', ins.points, asDur(ins.span))];
  if(ins.cur) lines.push(`${ins.cur.key.replace('|', ' MHz / ')} mV: ${ins.cur.eff ? ins.cur.eff.toFixed(1) + ' J/TH, ' : ''}${ins.cur.t.toFixed(0)} °C, ±${ins.cur.cv.toFixed(1)}%`);
  const s = asAllSuggestions().filter(x => x.devId === dev.id);
  s.forEach(x => lines.push('• ' + x.title));
  return lines.join('\n');
}
function asTextSuggestions(){
  const all = asAllSuggestions();
  if(!all.length) return '✅ ' + ({ pt: 'Por agora não tenho nada a sugerir: as máquinas estão dentro do normal.', en: 'Nothing to suggest right now: the machines are within normal.', es: 'Por ahora no tengo nada que sugerir: las máquinas están dentro de lo normal.', fr: 'Rien à suggérer pour l\'instant : les machines sont dans la normale.' })[['pt', 'en', 'es', 'fr'][asLang()]];
  return all.map(s => '• ' + s.title + '\n  ' + s.detail).join('\n');
}
