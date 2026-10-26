// --- Assistente (agente IA local, sem chave/API) -------------------------
// Responde a perguntas frequentes sobre as funcionalidades do painel a
// partir de uma base de conhecimento local, com correspondência simples
// por palavras-chave. Não faz chamadas externas nem precisa de ligação
// à internet.

const AI_KB = [
  { key: 'best_diff', kw: ['best diff','melhor dif','bestdiff','dificuldade','best share','best difficulty','efficiency record'],
    q: { pt: `O que é o Best Diff / Melhor Dif.?`, en: `What is Best Diff?`, es: `¿Qué es el Best Diff / Mejor Dif.?`, fr: `Qu'est-ce que le Best Diff ?` },
    a: { pt: `O "Melhor Dif." (Best Diff) é a maior dificuldade de share que a tua máquina já encontrou. Quanto mais alto, mais perto (em termos de sorte) estiveste de encontrar um bloco a solo. É um recorde acumulado desde que o ASIC arrancou.`,
         en: `"Best Diff" is the highest share difficulty your machine has ever found. The higher it is, the closer (in terms of luck) you have been to finding a solo block. It is a record that accumulates since the ASIC started.`,
         es: `El "Mejor Dif." (Best Diff) es la mayor dificultad de share que tu máquina ha encontrado. Cuanto más alto, más cerca (en términos de suerte) has estado de encontrar un bloque en solitario. Es un récord acumulado desde que el ASIC arrancó.`,
         fr: `Le « Best Diff » est la plus grande difficulté de share que ta machine ait jamais trouvée. Plus il est élevé, plus tu as été proche (en termes de chance) de trouver un bloc en solo. C'est un record cumulé depuis le démarrage de l'ASIC.` } },
  { key: 'eficiencia', kw: ['eficiencia','eficiência','j/th','joules','efficiency'],
    q: { pt: `O que significa Eficiência (J/Th)?`, en: `What does Efficiency (J/Th) mean?`, es: `¿Qué significa Eficiencia (J/Th)?`, fr: `Que signifie l'Efficacité (J/Th) ?` },
    a: { pt: `A eficiência em J/Th indica quantos Joules de energia a máquina gasta por cada Terahash de poder de processamento. Quanto MENOR o valor, mais eficiente é o ASIC (menos energia gasta pelo mesmo hashrate).`,
         en: `Efficiency in J/Th indicates how many Joules of energy the machine spends per Terahash of processing power. The LOWER the value, the more efficient the ASIC is (less energy spent for the same hashrate).`,
         es: `La eficiencia en J/Th indica cuántos Julios de energía gasta la máquina por cada Terahash de potencia de procesamiento. Cuanto MENOR sea el valor, más eficiente es el ASIC (menos energía gastada por el mismo hashrate).`,
         fr: `L'efficacité en J/Th indique combien de Joules d'énergie la machine consomme par Terahash de puissance de traitement. Plus la valeur est BASSE, plus l'ASIC est efficace (moins d'énergie dépensée pour le même hashrate).` } },
  { key: 'hashrate', kw: ['hashrate','hash rate','th/s'],
    q: { pt: `O que é o Hashrate?`, en: `What is Hashrate?`, es: `¿Qué es el Hashrate?`, fr: `Qu'est-ce que le Hashrate ?` },
    a: { pt: `O Hashrate mede quantos cálculos (hashes) o ASIC faz por segundo, normalmente em TH/s (terahashes por segundo). Quanto mais alto, maior a tua parte do poder computacional da rede.`,
         en: `Hashrate measures how many calculations (hashes) the ASIC performs per second, usually in TH/s (terahashes per second). The higher it is, the bigger your share of the network's computing power.`,
         es: `El Hashrate mide cuántos cálculos (hashes) realiza el ASIC por segundo, normalmente en TH/s (terahashes por segundo). Cuanto más alto, mayor es tu parte del poder computacional de la red.`,
         fr: `Le Hashrate mesure combien de calculs (hashes) l'ASIC effectue par seconde, généralement en TH/s (térahashes par seconde). Plus il est élevé, plus grande est ta part de puissance de calcul du réseau.` } },
  { key: 'frequencia_undervolt', kw: ['frequencia','frequência','undervolt','corevoltage','mhz','voltagem','voltage','frequency'],
    q: { pt: `Como funciona a Frequência e o Undervolt?`, en: `How do Frequency and Undervolt work?`, es: `¿Cómo funcionan la Frecuencia y el Undervolt?`, fr: `Comment fonctionnent la Fréquence et l'Undervolt ?` },
    a: { pt: `A Frequência (MHz) e a Voltagem do núcleo (coreVoltage) controlam o desempenho do chip ASIC: mais frequência = mais hashrate mas mais calor e consumo. O undervolt reduz a voltagem para poupar energia e baixar temperatura, geralmente à custa de algum hashrate.`,
         en: `Frequency (MHz) and core voltage (coreVoltage) control the ASIC chip's performance: more frequency means more hashrate but more heat and consumption. Undervolting lowers the voltage to save energy and reduce temperature, usually at the cost of some hashrate.`,
         es: `La Frecuencia (MHz) y el Voltaje del núcleo (coreVoltage) controlan el rendimiento del chip ASIC: más frecuencia significa más hashrate pero más calor y consumo. El undervolt reduce el voltaje para ahorrar energía y bajar la temperatura, normalmente a costa de algo de hashrate.`,
         fr: `La Fréquence (MHz) et la Tension du cœur (coreVoltage) contrôlent la performance de la puce ASIC : plus de fréquence signifie plus de hashrate mais plus de chaleur et de consommation. L'undervolt réduit la tension pour économiser l'énergie et baisser la température, généralement au prix d'un peu de hashrate.` } },
  { key: 'perfis_energia', kw: ['perfil de energia','perfis de energia','mqtt','home assistant','solar','tarifa','power profile'],
    q: { pt: `O que são os Perfis de Energia?`, en: `What are Power Profiles?`, es: `¿Qué son los Perfiles de Energía?`, fr: `Que sont les Profils d'Énergie ?` },
    a: { pt: `Os Perfis de Energia (separador "☀️ Perfis de Energia") ligam-se ao teu broker MQTT (ex: Home Assistant) para ler produção solar e tarifa elétrica. Com base nesses valores, o painel SUGERE um perfil de frequência/undervolt mais adequado — mas a aplicação é sempre manual, nunca automática.`,
         en: `Power Profiles (the "Power Profiles" tab) connect to your MQTT broker (e.g. Home Assistant) to read solar production and electricity rate. Based on those values, the dashboard SUGGESTS a more suitable frequency/undervolt profile - but applying it is always manual, never automatic.`,
         es: `Los Perfiles de Energía (pestaña "Perfiles de Energía") se conectan a tu broker MQTT (ej: Home Assistant) para leer la producción solar y la tarifa eléctrica. Según esos valores, el panel SUGIERE un perfil de frecuencia/undervolt más adecuado - pero la aplicación siempre es manual, nunca automática.`,
         fr: `Les Profils d'Énergie (onglet « Profils d'Énergie ») se connectent à ton broker MQTT (ex : Home Assistant) pour lire la production solaire et le tarif électrique. En fonction de ces valeurs, le panneau SUGGÈRE un profil de fréquence/undervolt plus adapté - mais l'application est toujours manuelle, jamais automatique.` } },
  { key: 'adicionar_maquina_faq', kw: ['adicionar maquina','adicionar máquina','registar maquina','novo asic','ip','add machine'],
    q: { pt: `Como adiciono uma máquina?`, en: `How do I add a machine?`, es: `¿Cómo añado una máquina?`, fr: `Comment ajouter une machine ?` },
    a: { pt: `No painel "Dashboard Geral", usa os campos "Apelido" e "IP" no topo do painel de Máquinas e clica em "Adicionar máquina". É preciso o servidor local (app.py / nerdqaxe_server.py) estar a correr em localhost:8765.`,
         en: `In the "General Dashboard" panel, use the "Nickname" and "IP" fields at the top of the Machines panel and click "Add machine". The local server (app.py / nerdqaxe_server.py) needs to be running on localhost:8765.`,
         es: `En el panel "Panel General", usa los campos "Apodo" e "IP" en la parte superior del panel de Máquinas y haz clic en "Añadir máquina". Es necesario que el servidor local (app.py / nerdqaxe_server.py) esté ejecutándose en localhost:8765.`,
         fr: `Dans le panneau « Tableau de Bord Général », utilise les champs « Surnom » et « IP » en haut du panneau des Machines et clique sur « Ajouter une machine ». Le serveur local (app.py / nerdqaxe_server.py) doit être actif sur localhost:8765.` } },
  { key: 'aceites_rejeitadas', kw: ['aceites','rejeitadas','shares','accepted','rejected'],
    q: { pt: `O que são Aceites/Rejeitadas?`, en: `What are Accepted/Rejected shares?`, es: `¿Qué son Aceptadas/Rechazadas?`, fr: `Que sont les shares Acceptées/Rejetées ?` },
    a: { pt: `São o número de shares (unidades de trabalho) que a tua pool aceitou vs. rejeitou. Uma taxa de rejeição alta pode indicar problemas de rede, latência ou instabilidade na ligação à pool.`,
         en: `These are the number of shares (units of work) your pool has accepted vs. rejected. A high rejection rate can indicate network problems, latency, or instability in the pool connection.`,
         es: `Son el número de shares (unidades de trabajo) que tu pool ha aceptado frente a las que ha rechazado. Una tasa de rechazo alta puede indicar problemas de red, latencia o inestabilidad en la conexión al pool.`,
         fr: `C'est le nombre de shares (unités de travail) que ton pool a acceptées vs rejetées. Un taux de rejet élevé peut indiquer des problèmes réseau, de latence ou une instabilité de la connexion au pool.` } },
  { key: 'distribuicao_hashrate_faq', kw: ['distribuicao','distribuição','donut','distribution'],
    q: { pt: `O que é a Distribuição de Hashrate?`, en: `What is the Hashrate Distribution?`, es: `¿Qué es la Distribución de Hashrate?`, fr: `Qu'est-ce que la Répartition du Hashrate ?` },
    a: { pt: `É um gráfico que mostra a fatia de hashrate total que cada máquina está a contribuir, para veres rapidamente se alguma está com desempenho abaixo do esperado.`,
         en: `It is a chart that shows the slice of total hashrate each machine is contributing, so you can quickly see if any of them is underperforming.`,
         es: `Es un gráfico que muestra la parte del hashrate total que aporta cada máquina, para que veas rápidamente si alguna tiene un rendimiento por debajo de lo esperado.`,
         fr: `C'est un graphique qui montre la part du hashrate total que chaque machine apporte, pour repérer rapidement si l'une d'elles est sous-performante.` } },
  { key: 'latencia_faq', kw: ['latencia','latência','ping','perda','latency'],
    q: { pt: `O que é a Latência / Ping ao Pool?`, en: `What is Latency / Pool Ping?`, es: `¿Qué es la Latencia / Ping al Pool?`, fr: `Qu'est-ce que la Latence / le Ping au Pool ?` },
    a: { pt: `"Ping ao Pool" mede o tempo de resposta entre a tua máquina e o servidor da pool de mineração — valores altos ou perda de pacotes podem causar mais shares rejeitadas. "Latência Local" mede a resposta do próprio ASIC na tua rede.`,
         en: `"Pool Ping" measures the response time between your machine and the mining pool server - high values or packet loss can cause more rejected shares. "Local Latency" measures the response of the ASIC itself on your network.`,
         es: `"Ping al Pool" mide el tiempo de respuesta entre tu máquina y el servidor del pool de minería - valores altos o pérdida de paquetes pueden causar más shares rechazadas. "Latencia Local" mide la respuesta del propio ASIC en tu red.`,
         fr: `« Ping au Pool » mesure le temps de réponse entre ta machine et le serveur du pool de minage - des valeurs élevées ou une perte de paquets peuvent causer plus de shares rejetées. « Latence Locale » mesure la réponse de l'ASIC lui-même sur ton réseau.` } },
  { key: 'saude_termica_faq', kw: ['termica','térmica','temperatura','saude','saúde','sobreaquecimento','thermal'],
    q: { pt: `O que faz a saúde térmica preditiva?`, en: `What does predictive thermal health do?`, es: `¿Qué hace la salud térmica predictiva?`, fr: `À quoi sert la santé thermique prédictive ?` },
    a: { pt: `A funcionalidade de saúde térmica acompanha o histórico de temperatura de cada máquina e tenta prever tendências de sobreaquecimento antes que aconteçam, permitindo agir com antecedência (ex: aplicar undervolt).`,
         en: `The thermal health feature tracks each machine's temperature history and tries to predict overheating trends before they happen, letting you act ahead of time (e.g. applying undervolt).`,
         es: `La función de salud térmica sigue el historial de temperatura de cada máquina e intenta predecir tendencias de sobrecalentamiento antes de que ocurran, permitiéndote actuar con antelación (ej: aplicar undervolt).`,
         fr: `La fonctionnalité de santé thermique suit l'historique de température de chaque machine et essaie de prédire les tendances de surchauffe avant qu'elles ne surviennent, te permettant d'agir à l'avance (ex : appliquer un undervolt).` } },
  { key: 'simulador_faq', kw: ['simulador','bloco','probabilidade','ajuste de dificuldade','simulator'],
    q: { pt: `Como funciona o simulador de bloco?`, en: `How does the block simulator work?`, es: `¿Cómo funciona el simulador de bloque?`, fr: `Comment fonctionne le simulateur de bloc ?` },
    a: { pt: `O simulador cruza o teu hashrate atual com os dados em tempo real da rede Bitcoin para estimar o impacto do próximo ajuste de dificuldade (a cada 2016 blocos) na tua probabilidade teórica de encontrar um bloco a solo.`,
         en: `The simulator combines your current hashrate with real-time Bitcoin network data to estimate the impact of the next difficulty adjustment (every 2016 blocks) on your theoretical probability of finding a solo block.`,
         es: `El simulador cruza tu hashrate actual con los datos en tiempo real de la red Bitcoin para estimar el impacto del próximo ajuste de dificultad (cada 2016 bloques) en tu probabilidad teórica de encontrar un bloque en solitario.`,
         fr: `Le simulateur croise ton hashrate actuel avec les données en temps réel du réseau Bitcoin pour estimer l'impact du prochain ajustement de difficulté (tous les 2016 blocs) sur ta probabilité théorique de trouver un bloc en solo.` } },
  { key: 'configuracao_faq', kw: ['configuracao','configuração','ficheiro','config.json','power_profiles','gravar','guardar','config file'],
    q: { pt: `Onde fica guardada a configuração?`, en: `Where is the configuration stored?`, es: `¿Dónde se guarda la configuración?`, fr: `Où est stockée la configuration ?` },
    a: { pt: `Tudo o que interessa manter entre atualizações - MQTT, IPs/nomes das máquinas, perfis de energia e alertas - fica gravado em config.json, ao lado do executável (não dentro dele), por isso sobrevive a reinstalações. Versões antigas usavam o nome power_profiles.json; é migrado automaticamente na primeira vez que abres a nova versão. O browser guarda só uma cópia de reserva no localStorage, para o painel continuar a funcionar mesmo que o servidor esteja indisponível.`,
         en: `Everything worth keeping across updates - MQTT, machine IPs/names, power profiles and alerts - is saved to config.json, next to the executable (not inside it), so it survives reinstalls. Older versions used the name power_profiles.json; it's migrated automatically the first time you open the new version. The browser only keeps a backup copy in localStorage, so the panel keeps working even if the server is unavailable.`,
         es: `Todo lo que interesa mantener entre actualizaciones - MQTT, IPs/nombres de las máquinas, perfiles de energía y alertas - se guarda en config.json, junto al ejecutable (no dentro de él), por lo que sobrevive a reinstalaciones. Las versiones antiguas usaban el nombre power_profiles.json; se migra automáticamente la primera vez que abres la nueva versión. El navegador solo guarda una copia de reserva en localStorage.`,
         fr: `Tout ce qu'il vaut la peine de conserver entre les mises à jour - MQTT, IP/noms des machines, profils d'énergie et alertes - est enregistré dans config.json, à côté de l'exécutable (pas à l'intérieur), donc ça survit aux réinstallations. Les anciennes versions utilisaient le nom power_profiles.json ; il est migré automatiquement à la première ouverture de la nouvelle version. Le navigateur ne garde qu'une copie de secours dans le localStorage.` } },
];

function getAiGreeting() { return '🤖 Agente ligado. Posso responder, alterar o painel e executar ações autorizadas. Escreve, por exemplo: “muda para Matrix”, “abre Saúde Térmica”, “aplica o perfil Eco à Máquina 1” ou “liga o modo autónomo”.'; }
function getAiFallback() { return 'Não reconheci esse pedido. Experimenta pedir uma alteração concreta (tema, aba, layout, máquina, perfil, frequência/voltagem) ou pergunta pelo estado das máquinas.'; }

function aiNormalize(str){
  return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function aiFindAnswer(question){
  const norm = aiNormalize(question);
  let best = null, bestScore = 0;
  for(const entry of AI_KB){
    let score = 0;
    for(const kw of entry.kw){
      if(norm.includes(aiNormalize(kw))) score += kw.length;
    }
    if(score > bestScore){ bestScore = score; best = entry; }
  }
  return best ? (best.a[currentLang] || best.a.pt) : getAiFallback();
}

const AI_AGENT_KEY = 'nerdqaxe:ai-agent';
let aiAgentConfig = {
  autonomous: false,
  intervalMs: 10000,
  allowProfiles: true,
  allowRestart: false,
  safetyTemp: 75
};
let aiAgentTimer = null;
let aiAgentBusy = false;
let aiAgentLastActions = {};

function aiAgentLoadConfig(){
  try{
    const raw = JSON.parse(localStorage.getItem(AI_AGENT_KEY) || 'null');
    if(raw && typeof raw === 'object') aiAgentConfig = { ...aiAgentConfig, ...raw };
  }catch(e){}
  aiAgentConfig.intervalMs = Math.max(5000, Math.min(120000, Number(aiAgentConfig.intervalMs) || 10000));
  aiAgentConfig.safetyTemp = Math.max(50, Math.min(95, Number(aiAgentConfig.safetyTemp) || 75));
  const modeBtn = $('aiAutonomousBtn');
  const intSel = $('aiIntervalSelect');
  const prof = $('aiAllowProfilesCheck');
  const restart = $('aiAllowRestartCheck');
  const temp = $('aiSafetyTemp');
  if(intSel) intSel.value = String(aiAgentConfig.intervalMs);
  if(prof) prof.checked = !!aiAgentConfig.allowProfiles;
  if(restart) restart.checked = !!aiAgentConfig.allowRestart;
  if(temp) temp.value = aiAgentConfig.safetyTemp;
  aiAgentUpdateUI();
}

function aiAgentSaveConfig(){
  try { localStorage.setItem(AI_AGENT_KEY, JSON.stringify(aiAgentConfig)); } catch(e){}
}

function aiAgentUpdateUI(){
  const btn = $('aiAutonomousBtn');
  const dot = $('aiAgentStatusDot');
  const label = $('aiAgentStatusText');
  if(btn){
    btn.classList.toggle('active', aiAgentConfig.autonomous);
    btn.textContent = aiAgentConfig.autonomous ? '⚡ Modo autónomo: ON' : '⚡ Modo autónomo: OFF';
  }
  if(dot) dot.className = 'ai-agent-status-dot ' + (aiAgentBusy ? 'busy' : (aiAgentConfig.autonomous ? 'online' : ''));
  if(label) label.textContent = aiAgentBusy ? 'A analisar' : (aiAgentConfig.autonomous ? 'Autónomo' : 'Manual');
}

function aiAppendMsg(text, who='bot'){
  const log = $('aiChatLog');
  if(!log) return;
  const div = document.createElement('div');
  div.className = `ai-msg ${who}`;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function aiClearChat(){
  const log = $('aiChatLog');
  if(log) log.innerHTML = '';
  aiAppendMsg(getAiGreeting(), 'bot');
}

function aiFindDevice(text){
  const norm = aiNormalize(text);
  let best = null, bestScore = -1;
  (devices || []).forEach((d, i) => {
    const n = aiNormalize(d.name || '');
    const ip = aiNormalize(d.ip || '');
    let score = 0;
    if(n && norm.includes(n)) score = Math.max(score, 100 + n.length);
    if(ip && norm.includes(ip)) score = Math.max(score, 90 + ip.length);
    if(new RegExp(`\\b(maquina|máquina|rig|asic)\\s*0*${i+1}\\b`, 'i').test(text)) score = Math.max(score, 80);
    if(score > bestScore){ best = d; bestScore = score; }
  });
  return best;
}

function aiFindProfile(text){
  const norm = aiNormalize(text);
  const exact = (powerProfiles || []).find(p => p.name && norm.includes(aiNormalize(p.name)));
  if(exact) return exact;
  if(/eco|segur|safe|conserv/.test(norm)) return (powerProfiles || []).find(p => /eco|segur|safe|conserv/i.test(p.name || '')) || null;
  if(/turbo|max|performance|desempenho/.test(norm)) return (powerProfiles || []).find(p => /turbo|max|performance|desempenho/i.test(p.name || '')) || null;
  return null;
}

function aiFindTab(text){
  const n = aiNormalize(text);
  const aliases = {
    dashboard:['dashboard','painel geral','inicio','maquinas'], logs:['logs','consola'], notifications:['notificacoes','notificações','avisos'], simulator:['simulador'], latency:['latencia','latência','ping'], parasite:['parasite'], thermal:['termica','térmica','temperatura','saude termica','saúde térmica'], oc:['overclock','undervolt','oc'], converter:['conversor','btc'], donate:['doar','apoio'], supporters:['apoiantes'], support:['suporte'], renting:['renting','rental'], alerts:['alertas','telegram','discord'],
  };
  for(const [tab, words] of Object.entries(aliases)) if(words.some(w => n.includes(aiNormalize(w)))) return tab;
  return null;
}

function aiMoveLayoutBlock(blockId, groupSelector, toTop=true){
  const container=document.querySelector(groupSelector);
  if(!container) return false;
  const el=container.querySelector(`[data-layout-id="${blockId}"]`);
  if(!el) return false;
  if(toTop) container.insertBefore(el, container.firstElementChild);
  else container.appendChild(el);
  const group=LAYOUT_GROUPS.find(g=>g.selector===groupSelector);
  if(group) saveLayoutOrder(container, group.key);
  return true;
}

function aiFindLayoutBlock(text){
  const n=aiNormalize(text);
  if(/assistente|ia|agente/.test(n)) return {id:'gauge-ai',group:'.sidebar'};
  if(/maquinas|maquinas principais|rigs/.test(n)) return {id:'main-machines',group:'.main'};
  if(/graficos|graficos|charts/.test(n)) return {id:'main-charts',group:'.charts'};
  if(/temperatura|termica/.test(n)) return {id:'gauge-temp',group:'.sidebar'};
  if(/hashrate/.test(n)) return {id:'gauge-hash',group:'.sidebar'};
  return null;
}

function aiSwitchTo(tab){
  const btn = document.querySelector(`.tab-btn[onclick*="'${tab}'"]`);
  if(!btn) return false;
  switchTab(tab, btn);
  return true;
}

function aiStatusSummary(){
  const all = (devices || []).map(d => {
    const r = readings[d.id] || {};
    return `${d.name}: ${r.online ? 'online' : 'offline'}${r.hashrate != null ? ', ' + formatHashrate(r.hashrate).value + ' ' + formatHashrate(r.hashrate).unit : ''}${r.temp != null ? ', ' + Number(r.temp).toFixed(1) + '°C' : ''}`;
  });
  if(!all.length) return 'Ainda não há máquinas registadas.';
  const online = devices.filter(d => readings[d.id]?.online).length;
  return `Estado: ${online}/${devices.length} online.\n${all.join('\n')}`;
}

function aiSafeProfileFor(dev){
  if(!aiAgentConfig.allowProfiles) return null;
  const profiles = (powerProfiles || []).filter(p => p && p.name);
  if(!profiles.length) return null;
  const current = readings[dev.id] || {};
  const safeNamed = profiles.filter(p => /eco|safe|segur|conserv/i.test(p.name));
  const pool = safeNamed.length ? safeNamed : profiles;
  const candidates = pool.filter(p => {
    const fOk = p.frequency === '' || p.frequency == null || current.frequency == null || Number(p.frequency) <= Number(current.frequency);
    const vOk = p.coreVoltage === '' || p.coreVoltage == null || current.coreVoltage == null || Number(p.coreVoltage) <= Number(current.coreVoltage);
    return fOk && vOk;
  });
  candidates.sort((a,b) => {
    const fa = a.frequency === '' || a.frequency == null ? Infinity : Number(a.frequency);
    const fb = b.frequency === '' || b.frequency == null ? Infinity : Number(b.frequency);
    return fa - fb;
  });
  return candidates[0] || null;
}

async function aiApplyProfile(profile, dev){
  if(!profile || !dev) return { ok:false, error:'perfil ou máquina inválido' };
  const payload = { ip: dev.ip };
  if(profile.frequency !== '' && profile.frequency != null) payload.frequency = Number(profile.frequency);
  if(profile.coreVoltage !== '' && profile.coreVoltage != null) payload.coreVoltage = Number(profile.coreVoltage);
  if(!Object.keys(payload).some(k => k !== 'ip')) return { ok:false, error:'perfil sem frequência/voltagem' };
  try{
    const resp = await fetch(`${API_BASE}/api/apply-profile`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    const data = await resp.json();
    if(!resp.ok || data.error) throw new Error(data.error || `HTTP ${resp.status}`);
    logEvent(`🤖 IA: perfil "${profile.name}" aplicado em "${dev.name}".`, 'edit', dev.name, dev.id);
    return { ok:true };
  }catch(e){
    logEvent(`🤖 IA: falha ao aplicar "${profile.name}" em "${dev.name}": ${e.message}`, 'error', dev.name, dev.id);
    return { ok:false, error:e.message };
  }
}

async function aiRestartDevice(dev, opts={}){
  if(!dev) return {ok:false,error:'máquina não encontrada'};
  if(opts.auto && !aiAgentConfig.allowRestart) return {ok:false,error:'reinício automático desativado nas proteções'};
  try{
    const resp = await fetch(`${API_BASE}/api/restart-machine`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ip:dev.ip}) });
    const data = await resp.json();
    if(!resp.ok || data.error) throw new Error(data.error || `HTTP ${resp.status}`);
    logEvent(`🤖 IA: reinício enviado para "${dev.name}".`, 'edit', dev.name, dev.id);
    return {ok:true};
  }catch(e){ return {ok:false,error:e.message}; }
}

async function aiExecuteCommand(question, opts={}){
  const q = String(question || '').trim();
  const n = aiNormalize(q);
  const auto = !!opts.auto;

  if(/(modo autonomo|modo automático|modo automatico|autonomo|autónomo|modo agente)/i.test(q) && /(liga|ativa|ativa|on|sim|começa|comeca)/i.test(q)){
    aiSetAutonomous(true); return '⚡ Modo autónomo ligado.';
  }
  if(/(modo autonomo|modo automático|modo automatico|autonomo|autónomo|modo agente)/i.test(q) && /(desliga|desativa|off|para|parar)/i.test(q)){
    aiSetAutonomous(false); return '🛑 Modo autónomo desligado.';
  }

  const themeMap = [['cyberpunk',['cyberpunk','cyber punk']],['matrix',['matrix']],['oled',['oled']],['glass',['glass','vidro']],['default',['default','padrao','padrão','normal']]];
  for(const [theme, words] of themeMap){
    if(words.some(w => n.includes(aiNormalize(w))) && /(tema|theme|muda|mude|usa|usar|fica|coloca)/i.test(q)){
      setTheme(theme); logEvent(`🤖 IA: tema alterado para ${theme}.`, 'edit', 'Sistema', 'sys'); return `🎨 Tema alterado para ${theme}.`;
    }
  }

  if(/kiosk|quiosque|ecrã inteiro|tela inteira|fullscreen/i.test(q) && /(liga|ativa|entra|usa|on)/i.test(q)){
    enterKioskMode(true); return '🖥️ Modo kiosk ativado.';
  }
  if(/kiosk|quiosque|ecrã inteiro|tela inteira|fullscreen/i.test(q) && /(desliga|sai|exit|off)/i.test(q)){
    exitKioskMode(); return '🖥️ Modo kiosk desativado.';
  }
  if(/(coloca|põe|poe|move|mover|leva|levar|mete|meter)/i.test(q) && /(topo|primeiro|cima|inicio|início)/i.test(q)){
    const block=aiFindLayoutBlock(q);
    if(block && aiMoveLayoutBlock(block.id, block.group, true)){
      logEvent(`🤖 IA: bloco "${block.id}" movido para o topo.`, 'edit', 'Sistema', 'sys');
      renderAll();
      return `🧩 ${block.id} movido para o topo.`;
    }
  }

  const tab = aiFindTab(q);
  if(tab && /(abre|abrir|vai|ir|mostra|mostrar|entra|navega|muda para|mudar para)/i.test(q)){
    return aiSwitchTo(tab) ? `📂 Aberto: ${getTabLabel(tab)}.` : 'Não encontrei essa aba.';
  }

  if(/(estado|status|como est[aáo]|quantas.*online|maquinas.*online|máquinas.*online)/i.test(q)) return aiStatusSummary();

  if(/(adiciona|adicionar|regista|registrar).*(maquina|máquina|rig|asic)/i.test(q)){
    const ipMatch = q.match(/(?:ip\s*[:=]?\s*)?(\d{1,3}(?:\.\d{1,3}){3})/i);
    const ip = ipMatch ? ipMatch[1] : '';
    const nameMatch = q.match(/(?:maquina|máquina|rig|asic)\s*["']?([^"']+?)["']?\s+(?:ip\s*)?\d{1,3}(?:\.\d{1,3}){3}/i);
    const name = nameMatch ? nameMatch[1].trim() : '';
    if(!ip) return 'Preciso do IP para adicionar a máquina, por exemplo: “adiciona Máquina 2 com IP 192.168.1.20”.';
    addDevice(name.replace(/^(com|ip)$/i,''), ip);
    return `✅ Máquina ${name || ip} adicionada.`;
  }

  const dev = aiFindDevice(q);
  const profile = aiFindProfile(q);
  if(profile && /(aplica|aplicar|usa|usar|mete|coloca|ativa)/i.test(q)){
    const targets = /todas|todos|all/i.test(q) ? devices : (dev ? [dev] : []);
    if(!targets.length) return `Encontrei o perfil "${profile.name}", mas não identifiquei a máquina. Diz, por exemplo, “aplica ${profile.name} na Máquina 1” ou “aplica ${profile.name} em todas”.`;
    const results=[];
    for(const d of targets) results.push({d, res:await aiApplyProfile(profile,d)});
    const ok=results.filter(x=>x.res.ok).length;
    return `⚡ Perfil "${profile.name}": ${ok}/${targets.length} aplicação(ões) concluída(s).`;
  }

  const freqMatch = q.match(/(?:frequ[eê]ncia|freq)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:mhz)?/i);
  const voltMatch = q.match(/(?:voltagem|voltage|corevoltage|core voltage)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:mv)?/i);
  if(dev && (freqMatch || voltMatch) && /(define|definir|muda|mudar|ajusta|ajustar|coloca|set|usa)/i.test(q)){
    const payload={ip:dev.ip};
    if(freqMatch) payload.frequency=Number(freqMatch[1]);
    if(voltMatch) payload.coreVoltage=Number(voltMatch[1]);
    try{
      const resp=await fetch(`${API_BASE}/api/apply-profile`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await resp.json();
      if(!resp.ok || data.error) throw new Error(data.error || `HTTP ${resp.status}`);
      logEvent(`🤖 IA: definições manuais aplicadas em "${dev.name}".`, 'edit', dev.name, dev.id);
      return `🔧 Alterações enviadas para ${dev.name}.`;
    }catch(e){ return `❌ Não consegui aplicar em ${dev.name}: ${e.message}`; }
  }

  if(dev && /(reinicia|reiniciar|restart|reboot)/i.test(q)){
    const r = await aiRestartDevice(dev);
    return r.ok ? `🔄 Reinício enviado para ${dev.name}.` : `❌ Não consegui reiniciar ${dev.name}: ${r.error}`;
  }

  if(auto) return null;
  return aiFindAnswer(q);
}

async function aiAutonomousCycle(){
  if(!aiAgentConfig.autonomous || aiAgentBusy) return;
  aiAgentBusy = true; aiAgentUpdateUI();
  try{
    if(typeof loadPowerConfig === 'function' && !powerConfigLoaded) await loadPowerConfig();
    const now = Date.now();
    let actions = [];
    for(const dev of (devices || [])){
      const r = readings[dev.id];
      if(!r || !r.online) continue;
      const temp = Number(r.temp);
      if(Number.isFinite(temp) && temp >= aiAgentConfig.safetyTemp){
        const safe = aiSafeProfileFor(dev);
        const key = `${dev.id}:hot:${safe?.name || 'none'}`;
        if(safe && key !== aiAgentLastActions[dev.id] && now - Number(aiAgentLastActions[key] || 0) > 60000){
          const res = await aiApplyProfile(safe, dev);
          aiAgentLastActions[dev.id] = key;
          aiAgentLastActions[key] = now;
          actions.push(res.ok ? `🛡️ ${dev.name}: temperatura ${temp.toFixed(1)}°C → perfil seguro "${safe.name}".` : `⚠️ ${dev.name}: não consegui aplicar o perfil seguro.`);
        }
        const criticalState = thermalCriticalState?.[dev.id];
        const restartKey = `${dev.id}:critical-restart`;
        if(aiAgentConfig.allowRestart && thermalProtectionSettings?.enabled && criticalState?.alarmed && now - Number(aiAgentLastActions[restartKey] || 0) > 15*60*1000){
          const rr = await aiRestartDevice(dev, {auto:true});
          aiAgentLastActions[restartKey] = now;
          actions.push(rr.ok ? `🔄 ${dev.name}: alerta térmico crítico confirmado → reinício automático enviado.` : `⚠️ ${dev.name}: reinício automático falhou.`);
        }
        continue;
      }

      // Nunca aumenta frequência/voltagem por iniciativa própria.
      // O agente só aplica automaticamente um perfil conservador já criado pelo utilizador.
      const safe = aiSafeProfileFor(dev);
      if(safe && aiAgentConfig.allowProfiles){
        const currentFreq = Number(r.frequency);
        const profileFreq = Number(safe.frequency);
        const currentVolt = Number(r.coreVoltage);
        const profileVolt = Number(safe.coreVoltage);
        const isLower = (Number.isFinite(profileFreq) && Number.isFinite(currentFreq) && profileFreq < currentFreq) || (Number.isFinite(profileVolt) && Number.isFinite(currentVolt) && profileVolt < currentVolt);
        const key=`${dev.id}:safe:${safe.name}`;
        if(isLower && key !== aiAgentLastActions[dev.id] && now - Number(aiAgentLastActions[key] || 0) > 5*60*1000){
          const res=await aiApplyProfile(safe,dev);
          aiAgentLastActions[dev.id]=key; aiAgentLastActions[key]=now;
          if(res.ok) actions.push(`⚙️ ${dev.name}: perfil conservador "${safe.name}" aplicado.`);
        }
      }
    }
    if(actions.length) aiAppendMsg('🤖 AUTONOMIA:\n' + actions.join('\n'), 'bot');
  }catch(e){
    aiAppendMsg(`⚠️ Agente autónomo: ${e.message}`, 'bot');
  }finally{
    aiAgentBusy=false; aiAgentUpdateUI();
  }
}

function aiSetAutonomous(on){
  aiAgentConfig.autonomous=!!on;
  aiAgentSaveConfig();
  if(aiAgentTimer){clearInterval(aiAgentTimer); aiAgentTimer=null;}
  if(aiAgentConfig.autonomous){
    aiAgentTimer=setInterval(aiAutonomousCycle, aiAgentConfig.intervalMs);
    setTimeout(aiAutonomousCycle, 300);
  }
  aiAgentUpdateUI();
  logEvent(`🤖 Modo autónomo ${aiAgentConfig.autonomous ? 'ativado' : 'desativado'}.`, 'edit', 'Sistema', 'sys');
}

function aiRenderSuggestions(){
  const box=$('aiSuggestions'); if(!box) return; box.innerHTML='';
  const samples=[
    'Mostra o estado das máquinas',
    'Muda o tema para Matrix',
    'Abre Saúde Térmica',
    powerProfiles?.length ? `Aplica ${powerProfiles.find(p=>p?.name)?.name || 'o perfil Eco'} em todas as máquinas` : 'Liga o modo autónomo'
  ];
  samples.forEach(q=>{const btn=document.createElement('button');btn.className='ai-chip';btn.textContent=q;btn.onclick=()=>aiAsk(q);box.appendChild(btn);});
}

async function aiAsk(question){
  const q=(question||'').trim(); if(!q) return;
  aiAppendMsg(q,'user');
  aiAgentBusy=true; aiAgentUpdateUI();
  try{
    const answer=await aiExecuteCommand(q,{auto:false});
    if(answer) aiAppendMsg(answer,'bot');
  }catch(e){ aiAppendMsg(`❌ ${e.message}`,'bot'); }
  finally{ aiAgentBusy=false; aiAgentUpdateUI(); }
}

function initAiAgent(){
  aiAgentLoadConfig();
  aiAppendMsg(getAiGreeting(),'bot');
  aiRenderSuggestions();
  $('aiSendBtn').onclick=()=>{const input=$('aiInput');aiAsk(input.value);input.value='';};
  $('aiInput').addEventListener('keydown',e=>{if(e.key==='Enter'){const input=$('aiInput');aiAsk(input.value);input.value='';}});
  $('aiAutonomousBtn').onclick=()=>aiSetAutonomous(!aiAgentConfig.autonomous);
  $('aiClearBtn').onclick=aiClearChat;
  $('aiIntervalSelect').onchange=()=>{aiAgentConfig.intervalMs=Number($('aiIntervalSelect').value)||10000;aiAgentSaveConfig();if(aiAgentConfig.autonomous)aiSetAutonomous(true);};
  $('aiAllowProfilesCheck').onchange=()=>{aiAgentConfig.allowProfiles=$('aiAllowProfilesCheck').checked;aiAgentSaveConfig();};
  $('aiAllowRestartCheck').onchange=()=>{aiAgentConfig.allowRestart=$('aiAllowRestartCheck').checked;aiAgentSaveConfig();};
  $('aiSafetyTemp').onchange=()=>{aiAgentConfig.safetyTemp=Math.max(50,Math.min(95,Number($('aiSafetyTemp').value)||75));aiAgentSaveConfig();};
  if(aiAgentConfig.autonomous) aiSetAutonomous(true);
}

$('addBtn').onclick = () => { 
  const ip = $('ipInput').value.trim();
  if(ip) {
    addDevice($('nameInput').value.trim(), ip);
    $('ipInput').value = '';
    $('nameInput').value = '';
  }
};

