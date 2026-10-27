// ---------- Gestor de widgets: escolher o que aparece no Dashboard Geral e por que ordem ----------
// Uma janela com um interruptor por bloco (relógio, mempool, indicadores, assistente, cartões, mapa, gráficos,
// registo, e as partes dos cartões como a comunidade e o resumo), setas para subir e descer onde o bloco se pode
// mover, e três predefinições (Completo, Essencial e Só máquinas). Só esconde ou reordena o que se vê; os dados
// e os avisos continuam a funcionar. Fica guardado neste navegador.
Object.assign(I18N_DICT, {
  wg_btn: { pt: `🧩 Widgets`, en: `🧩 Widgets`, es: `🧩 Widgets`, fr: `🧩 Widgets` },
  wg_btn_t: { pt: `Escolher o que aparece no Dashboard Geral`, en: `Choose what shows on the main dashboard`, es: `Elegir qué aparece en el panel principal`, fr: `Choisir ce qui s'affiche sur le tableau de bord` },
  wg_title: { pt: `Gestor de widgets`, en: `Widget manager`, es: `Gestor de widgets`, fr: `Gestionnaire de widgets` },
  wg_hint: { pt: `Ligue ou desligue cada bloco da página principal e use as setas para mudar a ordem. Os dados e os avisos continuam a funcionar nos blocos escondidos.`, en: `Turn each block of the main page on or off and use the arrows to change the order. Data and alerts keep working in hidden blocks.`, es: `Active o desactive cada bloque de la página principal y use las flechas para cambiar el orden. Los datos y los avisos siguen funcionando en los bloques ocultos.`, fr: `Activez ou désactivez chaque bloc de la page principale et utilisez les flèches pour changer l'ordre. Les données et les alertes continuent de fonctionner dans les blocs masqués.` },
  wg_g_top: { pt: `Topo da página`, en: `Top of the page`, es: `Parte superior`, fr: `Haut de la page` },
  wg_g_side: { pt: `Indicadores e assistente`, en: `Indicators and assistant`, es: `Indicadores y asistente`, fr: `Indicateurs et assistant` },
  wg_g_main: { pt: `Blocos principais`, en: `Main blocks`, es: `Bloques principales`, fr: `Blocs principaux` },
  wg_g_charts: { pt: `Gráficos`, en: `Charts`, es: `Gráficos`, fr: `Graphiques` },
  wg_g_cards: { pt: `Dentro das máquinas`, en: `Inside the machines`, es: `Dentro de las máquinas`, fr: `Dans les machines` },
  wg_wx: { pt: `Relógio e tempo`, en: `Clock and weather`, es: `Reloj y tiempo`, fr: `Horloge et météo` },
  wg_spot: { pt: `Destaque da pool`, en: `Pool spotlight`, es: `Destacado del pool`, fr: `Mise en avant du pool` },
  wg_blocks: { pt: `Blocos do mempool`, en: `Mempool blocks`, es: `Bloques del mempool`, fr: `Blocs du mempool` },
  wg_hash: { pt: `Indicador: hashrate`, en: `Indicator: hashrate`, es: `Indicador: hashrate`, fr: `Indicateur : hashrate` },
  wg_best: { pt: `Indicador: melhor share`, en: `Indicator: best share`, es: `Indicador: mejor share`, fr: `Indicateur : meilleur share` },
  wg_temp: { pt: `Indicador: temperatura`, en: `Indicator: temperature`, es: `Indicador: temperatura`, fr: `Indicateur : température` },
  wg_fan: { pt: `Indicador: ventoinhas`, en: `Indicator: fans`, es: `Indicador: ventiladores`, fr: `Indicateur : ventilateurs` },
  wg_power: { pt: `Indicador: potência`, en: `Indicator: power`, es: `Indicador: potencia`, fr: `Indicateur : puissance` },
  wg_count: { pt: `Indicador: máquinas`, en: `Indicator: machines`, es: `Indicador: máquinas`, fr: `Indicateur : machines` },
  wg_ai: { pt: `Assistente`, en: `Assistant`, es: `Asistente`, fr: `Assistant` },
  wg_quick: { pt: `Ações rápidas (As suas máquinas)`, en: `Quick actions (Your machines)`, es: `Acciones rápidas (Sus máquinas)`, fr: `Actions rapides (Vos machines)` },
  wg_cards: { pt: `Cartões das máquinas`, en: `Machine cards`, es: `Tarjetas de las máquinas`, fr: `Cartes des machines` },
  wg_map: { pt: `Mapa da rede`, en: `Network map`, es: `Mapa de la red`, fr: `Carte du réseau` },
  wg_charts: { pt: `Gráficos (todos)`, en: `Charts (all)`, es: `Gráficos (todos)`, fr: `Graphiques (tous)` },
  wg_log: { pt: `Registo de eventos`, en: `Event log`, es: `Registro de eventos`, fr: `Journal des événements` },
  wg_c_hash: { pt: `Gráfico: hashrate`, en: `Chart: hashrate`, es: `Gráfico: hashrate`, fr: `Graphique : hashrate` },
  wg_c_best: { pt: `Gráfico: melhor share`, en: `Chart: best share`, es: `Gráfico: mejor share`, fr: `Graphique : meilleur share` },
  wg_c_donut: { pt: `Gráfico: distribuição`, en: `Chart: distribution`, es: `Gráfico: distribución`, fr: `Graphique : répartition` },
  wg_com: { pt: `Comunidade (mapa, ranking e mural)`, en: `Community (map, ranking and wall)`, es: `Comunidad (mapa, ranking y mural)`, fr: `Communauté (carte, classement et mur)` },
  wg_sum: { pt: `Resumo dos cartões (mosaicos)`, en: `Cards summary (tiles)`, es: `Resumen de las tarjetas (mosaicos)`, fr: `Résumé des cartes (tuiles)` },
  wg_sched: { pt: `Agendamentos`, en: `Schedules`, es: `Programaciones`, fr: `Planifications` },
  wg_evt: { pt: `Eventos de hoje`, en: `Today's events`, es: `Eventos de hoy`, fr: `Événements du jour` },
  wg_p_all: { pt: `Completo`, en: `Full`, es: `Completo`, fr: `Complet` },
  wg_p_ess: { pt: `Essencial`, en: `Essential`, es: `Esencial`, fr: `Essentiel` },
  wg_p_mach: { pt: `Só máquinas`, en: `Machines only`, es: `Solo máquinas`, fr: `Machines seulement` },
  wg_p_t: { pt: `Predefinições`, en: `Presets`, es: `Preajustes`, fr: `Préréglages` },
  wg_hidden: { pt: `{0} escondidos`, en: `{0} hidden`, es: `{0} ocultos`, fr: `{0} masqués` },
  wg_up: { pt: `Subir`, en: `Move up`, es: `Subir`, fr: `Monter` },
  wg_down: { pt: `Descer`, en: `Move down`, es: `Bajar`, fr: `Descendre` },
  wg_close: { pt: `Fechar`, en: `Close`, es: `Cerrar`, fr: `Fermer` },
  wg_reset_order: { pt: `Repor a ordem original`, en: `Restore the original order`, es: `Restaurar el orden original`, fr: `Rétablir l'ordre d'origine` }
});

const WG_KEY = 'nerdqaxe:widgets_hidden';
// grupo: top (sem ordem), side/main/charts (têm ordem; ligados aos contentores do editor de layout), cards (partes dos cartões)
const WG_ITEMS = [
  { id: 'wx', k: 'wg_wx', g: 'top', find: () => document.getElementById('wxPanel') },
  { id: 'spot', k: 'wg_spot', g: 'top', find: () => document.getElementById('gpSpotlight') },
  { id: 'blocks', k: 'wg_blocks', g: 'top', find: () => document.querySelector('#tab-dashboard .blocks-container') },
  { id: 'gauge-hashrate', k: 'wg_hash', g: 'side', lay: true }, { id: 'gauge-best', k: 'wg_best', g: 'side', lay: true },
  { id: 'gauge-temp', k: 'wg_temp', g: 'side', lay: true }, { id: 'gauge-fan', k: 'wg_fan', g: 'side', lay: true },
  { id: 'gauge-power', k: 'wg_power', g: 'side', lay: true }, { id: 'gauge-count', k: 'wg_count', g: 'side', lay: true },
  { id: 'gauge-ai', k: 'wg_ai', g: 'side', find: () => document.getElementById('aiRoot') },
  { id: 'main-machines', k: 'wg_quick', g: 'main', lay: true }, { id: 'machine-cards', k: 'wg_cards', g: 'main', lay: true },
  { id: 'network-map', k: 'wg_map', g: 'main', lay: true }, { id: 'main-charts', k: 'wg_charts', g: 'main', lay: true }, { id: 'main-eventlog', k: 'wg_log', g: 'main', lay: true },
  { id: 'chart-hashrate', k: 'wg_c_hash', g: 'charts', lay: true }, { id: 'chart-best', k: 'wg_c_best', g: 'charts', lay: true }, { id: 'chart-donut', k: 'wg_c_donut', g: 'charts', lay: true },
  { id: 'com', k: 'wg_com', g: 'cards', find: () => document.getElementById('mcCom') },
  { id: 'sum', k: 'wg_sum', g: 'cards', find: () => document.getElementById('mcSummary') },
  { id: 'sched', k: 'wg_sched', g: 'cards', find: () => document.getElementById('mcSched') },
  { id: 'evt', k: 'wg_evt', g: 'cards', find: () => document.querySelector('#tab-dashboard details.mc-log') }
];
const WG_GROUPS = [['top', 'wg_g_top'], ['side', 'wg_g_side'], ['main', 'wg_g_main'], ['charts', 'wg_g_charts'], ['cards', 'wg_g_cards']];
const WG_PRESETS = {
  all: [],
  ess: ['wx', 'spot', 'blocks', 'gauge-best', 'gauge-fan', 'gauge-ai', 'main-machines', 'network-map', 'main-charts', 'chart-hashrate', 'chart-best', 'chart-donut', 'main-eventlog', 'com', 'sched', 'evt'],
  mach: ['wx', 'spot', 'blocks', 'gauge-hashrate', 'gauge-best', 'gauge-temp', 'gauge-fan', 'gauge-power', 'gauge-count', 'gauge-ai', 'main-machines', 'network-map', 'main-charts', 'main-eventlog', 'com', 'sched', 'evt']
};
let wgHidden = (() => { try { const a = JSON.parse(localStorage.getItem(WG_KEY) || '[]'); return new Set(Array.isArray(a) ? a : []); } catch(e) { return new Set(); } })();
function wgSave(){ try { localStorage.setItem(WG_KEY, JSON.stringify([...wgHidden])); } catch(e) {} }
function wgEl(it){
  if(it.find) return it.find();
  return document.querySelector('#tab-dashboard [data-layout-id="' + it.id + '"]');
}
// aplica o que está escondido (corre também de tempos a tempos, porque alguns blocos só aparecem depois)
function wgApply(){
  WG_ITEMS.forEach(it => { const el = wgEl(it); if(el) el.classList.toggle('wg-off', wgHidden.has(it.id)); });
}
function wgGroupOf(it){
  const el = wgEl(it);
  if(!el || !it.lay || typeof LAYOUT_GROUPS === 'undefined') return null;
  const g = LAYOUT_GROUPS.find(x => el.parentElement && el.parentElement.matches(x.selector));
  return g ? { container: el.parentElement, key: g.key } : null;
}
function wgMove(id, dir){
  const it = WG_ITEMS.find(x => x.id === id), el = it && wgEl(it), gr = it && wgGroupOf(it);
  if(!el || !gr) return;
  const items = layoutGroupItems(gr.container), i = items.indexOf(el), j = i + dir;
  if(j < 0 || j >= items.length) return;
  if(dir < 0) gr.container.insertBefore(el, items[j]); else gr.container.insertBefore(items[j], el);
  saveLayoutOrder(gr.container, gr.key);
  wgRender();
}
function wgRender(){
  const body = document.getElementById('wgList');
  if(!body) return;
  const sorted = id => { const it = WG_ITEMS.find(x => x.id === id), el = it && wgEl(it); return el && el.parentElement ? [...el.parentElement.children].indexOf(el) : 0; };
  body.innerHTML = WG_GROUPS.map(([g, key]) => {
    const rows = WG_ITEMS.filter(it => it.g === g).sort((a, b) => g === 'top' || g === 'cards' ? 0 : sorted(a.id) - sorted(b.id));
    return '<div class="wg-grp"><h4>' + t(key) + '</h4>' + rows.map(it => {
      const on = !wgHidden.has(it.id), gr = wgGroupOf(it), el = wgEl(it), items = gr ? layoutGroupItems(gr.container) : [], idx = el ? items.indexOf(el) : -1;
      return '<div class="wg-row' + (on ? '' : ' off') + '"><label><input type="checkbox" data-wg="' + it.id + '"' + (on ? ' checked' : '') + '><span>' + t(it.k) + '</span></label>' +
        (gr ? '<div class="wg-mv"><button type="button" data-wg-mv="-1" data-id="' + it.id + '" title="' + t('wg_up') + '" aria-label="' + t('wg_up') + '"' + (idx <= 0 ? ' disabled' : '') + '>▲</button><button type="button" data-wg-mv="1" data-id="' + it.id + '" title="' + t('wg_down') + '" aria-label="' + t('wg_down') + '"' + (idx >= items.length - 1 ? ' disabled' : '') + '>▼</button></div>' : '') + '</div>';
    }).join('') + '</div>';
  }).join('');
  const n = document.getElementById('wgCount'); if(n) n.textContent = mct('wg_hidden', wgHidden.size);
}
function wgOpen(){
  const old = document.getElementById('wgModal');
  if(old){ old.remove(); return; }
  const m = document.createElement('div');
  m.id = 'wgModal'; m.className = 'wg-modal';
  m.innerHTML = '<div class="wg-card" role="dialog" aria-modal="true"><div class="wg-head"><b>🧩 ' + t('wg_title') + '</b><span id="wgCount"></span><button type="button" data-wg-act="close" aria-label="' + t('wg_close') + '">✕</button></div>' +
    '<div class="wg-presets"><span>' + t('wg_p_t') + '</span><button type="button" data-wg-pre="all">' + t('wg_p_all') + '</button><button type="button" data-wg-pre="ess">' + t('wg_p_ess') + '</button><button type="button" data-wg-pre="mach">' + t('wg_p_mach') + '</button></div>' +
    '<div class="wg-hint">' + t('wg_hint') + '</div><div class="wg-list" id="wgList"></div>' +
    '<div class="wg-foot"><button type="button" data-wg-act="reset">↺ ' + t('wg_reset_order') + '</button></div></div>';
  document.body.appendChild(m);
  m.addEventListener('click', e => {
    if(e.target === m || e.target.closest('[data-wg-act="close"]')){ m.remove(); return; }
    if(e.target.closest('[data-wg-act="reset"]')){ if(typeof LAYOUT_GROUPS !== 'undefined'){ LAYOUT_GROUPS.forEach(g => { try { localStorage.removeItem(g.key); } catch(x) {} }); location.reload(); } return; }
    const pre = e.target.closest('[data-wg-pre]');
    if(pre){ wgHidden = new Set(WG_PRESETS[pre.dataset.wgPre]); wgSave(); wgApply(); wgRender(); return; }
    const mv = e.target.closest('[data-wg-mv]');
    if(mv) wgMove(mv.dataset.id, Number(mv.dataset.wgMv));
  });
  m.addEventListener('change', e => {
    const c = e.target.closest('[data-wg]');
    if(!c) return;
    if(c.checked) wgHidden.delete(c.dataset.wg); else wgHidden.add(c.dataset.wg);
    wgSave(); wgApply(); wgRender();
  });
  wgRender();
}
document.addEventListener('keydown', e => { if(e.key === 'Escape'){ const m = document.getElementById('wgModal'); if(m) m.remove(); } });
function wgInit(){
  // botão ao lado do "Editar Layout"
  const lb = document.getElementById('kioskToggleBtn');
  if(lb && !document.getElementById('wgBtn')){
    const b = document.createElement('button');
    b.id = 'wgBtn'; b.className = 'layout-edit-toggle-btn'; b.type = 'button'; b.onclick = wgOpen;
    b.title = t('wg_btn_t'); b.setAttribute('aria-label', t('wg_btn_t'));
    b.innerHTML = '<span data-i18n="wg_btn">' + t('wg_btn') + '</span>';
    lb.insertAdjacentElement('afterend', b);
  }
  wgApply();
}
wgInit();
setInterval(wgApply, 2500);
