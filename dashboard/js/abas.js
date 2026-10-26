// ---------- Abas: cabeçalho comum, textos longos recolhidos e tabelas arrumadas ----------
// Aplica-se a todas as abas menos o Dashboard Geral. Não muda dados nem lógica: só a apresentação.
Object.assign(I18N_DICT, {
  ab_logs: { pt: `A consola em direto de todas as máquinas: filtre, pause, apague ou descarregue.`, en: `The live console of all your machines: filter, pause, clear or download.`, es: `La consola en vivo de todas sus máquinas: filtre, pause, borre o descargue.`, fr: `La console en direct de toutes vos machines : filtrez, mettez en pause, effacez ou téléchargez.` },
  ab_notifications: { pt: `Blocos encontrados, melhores shares e avisos térmicos, num só histórico.`, en: `Blocks found, best shares and thermal warnings in a single history.`, es: `Bloques encontrados, mejores shares y avisos térmicos en un único historial.`, fr: `Blocs trouvés, meilleurs shares et alertes thermiques dans un seul historique.` },
  ab_thermal: { pt: `Proteção térmica, diagnóstico por máquina e previsão de desgaste.`, en: `Thermal protection, per-machine diagnosis and wear forecast.`, es: `Protección térmica, diagnóstico por máquina y previsión de desgaste.`, fr: `Protection thermique, diagnostic par machine et prévision d'usure.` },
  ab_power: { pt: `Perfis de frequência e tensão, ligação ao MQTT e sugestões automáticas.`, en: `Frequency and voltage profiles, MQTT link and automatic suggestions.`, es: `Perfiles de frecuencia y tensión, enlace MQTT y sugerencias automáticas.`, fr: `Profils de fréquence et de tension, lien MQTT et suggestions automatiques.` },
  ab_oc: { pt: `Ajuste a frequência e a tensão de cada máquina e aplique em segurança.`, en: `Tune each machine's frequency and voltage and apply it safely.`, es: `Ajuste la frecuencia y la tensión de cada máquina y aplíquelo con seguridad.`, fr: `Réglez la fréquence et la tension de chaque machine et appliquez-les en sécurité.` },
  ab_parasite: { pt: `Estatísticas da pool Parasite, a sua posição e a refinaria de hashrate.`, en: `Parasite pool statistics, your rank and the hashrate refinery.`, es: `Estadísticas del pool Parasite, su posición y la refinería de hashrate.`, fr: `Statistiques du pool Parasite, votre rang et la raffinerie de hashrate.` },
  ab_latency: { pt: `Ping ao pool em tempo real, perda de pacotes e qualidade da ligação.`, en: `Live ping to the pool, packet loss and connection quality.`, es: `Ping al pool en tiempo real, pérdida de paquetes y calidad de la conexión.`, fr: `Ping vers le pool en direct, perte de paquets et qualité de la connexion.` },
  ab_cooling: { pt: `Circuito de refrigeração líquida, killswitch e o droop do VRM.`, en: `Liquid cooling loop, killswitch and VRM droop.`, es: `Circuito de refrigeración líquida, killswitch y el droop del VRM.`, fr: `Circuit de refroidissement liquide, killswitch et droop du VRM.` },
  ab_genpools: { pt: `As pools que conhece, com dificuldade, esforço e estado de cada uma.`, en: `The pools you know, with difficulty, effort and status for each.`, es: `Los pools que conoce, con dificultad, esfuerzo y estado de cada uno.`, fr: `Les pools que vous connaissez, avec difficulté, effort et état de chacun.` },
  ab_boards: { pt: `Análise por placa de hash: hashrate, chips e temperaturas.`, en: `Per-hashboard analysis: hashrate, chips and temperatures.`, es: `Análisis por placa de hash: hashrate, chips y temperaturas.`, fr: `Analyse par carte de hash : hashrate, puces et températures.` },
  ab_renting: { pt: `Alugue o seu hashrate e acompanhe as ordens e os ganhos.`, en: `Rent out your hashrate and follow orders and earnings.`, es: `Alquile su hashrate y siga las órdenes y las ganancias.`, fr: `Louez votre hashrate et suivez les ordres et les gains.` },
  ab_alerts: { pt: `Telegram, Discord e webhooks: escolha quando e como ser avisado.`, en: `Telegram, Discord and webhooks: choose when and how to be alerted.`, es: `Telegram, Discord y webhooks: elija cuándo y cómo recibir avisos.`, fr: `Telegram, Discord et webhooks : choisissez quand et comment être alerté.` },
  ab_simulator: { pt: `Cruze o seu hashrate com a rede Bitcoin e simule o próximo ajuste e o halving.`, en: `Cross your hashrate with the Bitcoin network and simulate the next adjustment and halving.`, es: `Cruce su hashrate con la red Bitcoin y simule el próximo ajuste y el halving.`, fr: `Croisez votre hashrate avec le réseau Bitcoin et simulez le prochain ajustement et le halving.` },
  ab_converter: { pt: `Converta entre BTC, satoshis e moedas ao câmbio do momento.`, en: `Convert between BTC, satoshis and currencies at the current rate.`, es: `Convierta entre BTC, satoshis y monedas al cambio actual.`, fr: `Convertissez entre BTC, satoshis et devises au taux du moment.` },
  ab_donate: { pt: `Apoie o projeto com uma doação em Lightning ou on-chain.`, en: `Support the project with a Lightning or on-chain donation.`, es: `Apoye el proyecto con una donación por Lightning o on-chain.`, fr: `Soutenez le projet avec un don Lightning ou on-chain.` },
  ab_supporters: { pt: `Os canais e a comunidade que apoiam o projeto.`, en: `The channels and the community that back the project.`, es: `Los canales y la comunidad que apoyan el proyecto.`, fr: `Les chaînes et la communauté qui soutiennent le projet.` },
  ab_support: { pt: `Ajuda, contactos e ligações úteis.`, en: `Help, contacts and useful links.`, es: `Ayuda, contactos y enlaces útiles.`, fr: `Aide, contacts et liens utiles.` }
});
const AB_COLORS = { logs: '#4fd6ff', notifications: '#ffb020', thermal: '#ff7b5d', power: '#21ffb0', oc: '#b07cff', parasite: '#ff6b9d', latency: '#4fd6ff', cooling: '#4fd6ff', genpools: '#ffb020', boards: '#21ffb0', renting: '#b07cff', alerts: '#ff5d5d', simulator: '#ffd34a', converter: '#21ffb0', donate: '#ffd34a', supporters: '#ff6b9d', support: '#4fd6ff' };

function abHeroSync(){
  document.querySelectorAll('.tab-content').forEach(tab => {
    const name = tab.id.replace('tab-', '');
    if(name === 'dashboard') return;
    let hero = tab.querySelector(':scope > .tab-hero');
    const btn = [...document.querySelectorAll('.tab-btn')].find(b => (b.getAttribute('onclick') || '').includes("'" + name + "'"));
    if(!hero){
      hero = document.createElement('div');
      hero.className = 'tab-hero';
      hero.innerHTML = '<span class="th-ico" aria-hidden="true"></span><div class="th-txt"><h2></h2><p></p></div>';
      hero.style.setProperty('--hero', AB_COLORS[name] || '#4fd6ff');
      tab.insertBefore(hero, tab.firstChild);
    }
    const icon = btn && btn.querySelector('.tab-icon'), label = btn ? [...btn.childNodes].filter(n => !(n.classList && n.classList.contains('tab-icon'))).map(n => n.textContent).join('').trim() : name;
    const ico = hero.querySelector('.th-ico'), h2 = hero.querySelector('h2'), p = hero.querySelector('p');
    const ic = icon ? icon.textContent.trim() : '•';
    if(ico.textContent !== ic) ico.textContent = ic;
    const lab = label.replace(/\s*\d+\s*$/, '');
    if(h2.textContent !== lab) h2.textContent = lab;
    const desc = I18N_DICT['ab_' + name] ? t('ab_' + name) : '';
    if(p.textContent !== desc) p.textContent = desc;
    p.hidden = !desc;
  });
}

// textos longos (as explicações) passam a recolher-se em "ℹ Como funciona"
function abFoldHints(){
  document.querySelectorAll('.tab-content:not(#tab-dashboard) .hint').forEach(h => {
    if(h.closest('details') || h.id || h.dataset.abDone || h.querySelector('input,button,select,textarea')) return;
    h.dataset.abDone = '1';
    if((h.textContent || '').trim().length < 150) return;
    const d = document.createElement('details');
    d.className = 'th-info';
    d.innerHTML = '<summary><span data-i18n="th_info">' + t('th_info') + '</span></summary>';
    h.parentNode.insertBefore(d, h);
    h.style.marginBottom = '4px';
    d.appendChild(h);
  });
}

// tabelas simples ficam dentro de uma moldura com scroll horizontal
function abWrapTables(){
  document.querySelectorAll('.tab-content:not(#tab-dashboard) table').forEach(tb => {
    if(tb.closest('.tbl-wrap') || tb.dataset.abDone) return;
    tb.dataset.abDone = '1';
    const w = document.createElement('div');
    w.className = 'tbl-wrap';
    tb.parentNode.insertBefore(w, tb);
    w.appendChild(tb);
  });
}

// caixas de seleção viram interruptores (menos as que já têm desenho próprio)
function abSwitches(){
  document.querySelectorAll('.tab-content:not(#tab-dashboard) input[type=checkbox]:not(.ab-sw)').forEach(cb => {
    if(cb.closest('.cool-sw, .protection-toggle, .tbl-wrap')) return;
    cb.classList.add('ab-sw'); cb.style.width = ''; cb.style.height = '';
  });
}
function abInit(){ abHeroSync(); abFoldHints(); abWrapTables(); abSwitches(); }
abInit();
setInterval(abInit, 3000);
(function(){
  const ol = window.setLanguage;
  if(typeof ol === 'function') window.setLanguage = function(){ const r = ol.apply(this, arguments); try { abInit(); } catch(e) {} return r; };
  const orig = window.switchTab;
  if(typeof orig === 'function') window.switchTab = function(){ const r = orig.apply(this, arguments); try { abInit(); } catch(e) {} return r; };
})();
