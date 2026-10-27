// ---------- Assistente flutuante ----------
// Sai da coluna lateral e passa a "andar" pela dashboard: um botão redondo que se arrasta para onde quiser e que
// abre uma janela por cima de qualquer aba (também se arrasta e se redimensiona). A posição, o tamanho e o separador
// ficam guardados. A conversa é a mesma de sempre; o resto vem do motor de estudo (assistente-estudo.js).
const AF_KEY = 'nerdqaxe:ai_float';
const AF_TX = {
  title: ['Assistente', 'Assistant', 'Asistente', 'Assistant'],
  st_auto: ['Autónomo · a estudar', 'Autonomous · studying', 'Autónomo · estudiando', 'Autonome · à l\'étude'],
  st_manual: ['Manual · a estudar', 'Manual · studying', 'Manual · estudiando', 'Manuel · à l\'étude'],
  st_busy: ['A analisar…', 'Analysing…', 'Analizando…', 'Analyse…'],
  t_chat: ['Conversa', 'Chat', 'Conversación', 'Discussion'], t_study: ['Estudo', 'Study', 'Estudio', 'Étude'], t_sugg: ['Sugestões', 'Suggestions', 'Sugerencias', 'Suggestions'], t_diary: ['Diário', 'Diary', 'Diario', 'Journal'],
  min: ['Minimizar', 'Minimise', 'Minimizar', 'Réduire'], size: ['Maior / menor', 'Bigger / smaller', 'Mayor / menor', 'Plus grand / petit'], open: ['Abrir o assistente (arraste para o mover)', 'Open the assistant (drag to move)', 'Abrir el asistente (arrastre para moverlo)', 'Ouvrir l\'assistant (glisser pour le déplacer)'],
  no_dev: ['Ainda não há máquinas para estudar. Adicione uma no Dashboard Geral.', 'There are no machines to study yet. Add one on the main dashboard.', 'Aún no hay máquinas que estudiar. Añada una en el panel principal.', 'Aucune machine à étudier pour l\'instant. Ajoutez-en une sur le tableau de bord.'],
  no_sugg: ['Nada a sugerir por agora: as máquinas estão dentro do normal. Continuo a estudar.', 'Nothing to suggest for now: the machines are within normal. I keep studying.', 'Nada que sugerir por ahora: las máquinas están dentro de lo normal. Sigo estudiando.', 'Rien à suggérer pour l\'instant : les machines sont dans la normale. Je continue d\'étudier.'],
  no_diary: ['O diário ainda está vazio.', 'The diary is still empty.', 'El diario aún está vacío.', 'Le journal est encore vide.'],
  score: ['saúde', 'health', 'salud', 'santé'],
  net_wx: ['Meteo', 'Weather', 'Tiempo', 'Météo'], net_btc: ['Preço BTC', 'BTC price', 'Precio BTC', 'Prix BTC'], net_diff: ['Rede', 'Network', 'Red', 'Réseau'],
  net_title: ['Ligado à net para estudar: previsão do tempo, preço e dificuldade. As máquinas ficam só neste PC.', 'Online to study: weather forecast, price and difficulty. Your machines stay on this PC only.', 'Conectado a la red para estudiar: previsión del tiempo, precio y dificultad. Sus máquinas se quedan solo en este PC.', 'En ligne pour étudier : météo, prix et difficulté. Vos machines restent sur ce PC uniquement.'],
  prot: ['Só protege sozinho (baixa, nunca sobe) e só sugere o resto', 'It only protects on its own (lowers, never raises) and only suggests the rest', 'Solo protege por sí solo (baja, nunca sube) y solo sugiere el resto', 'Il ne protège que seul (baisse, jamais ne monte) et ne fait que suggérer le reste'],
  prev: ['Proteção preventiva pela previsão do tempo', 'Preventive protection from the weather forecast', 'Protección preventiva por la previsión del tiempo', 'Protection préventive selon la météo'],
  cur: ['Agora', 'Now', 'Ahora', 'Maintenant'], jth: ['J/TH', 'J/TH', 'J/TH', 'J/TH'],
  new_sug: ['{0} sugestão(ões) nova(s)', '{0} new suggestion(s)', '{0} sugerencia(s) nueva(s)', '{0} nouvelle(s) suggestion(s)']
};
const afI = () => { const i = ['pt', 'en', 'es', 'fr'].indexOf(typeof currentLang !== 'undefined' ? currentLang : 'pt'); return i < 0 ? 0 : i; };
const AF = (k, ...a) => { let s = (AF_TX[k] || ['', '', '', ''])[afI()]; a.forEach((v, i) => { s = s.split('{' + i + '}').join(v); }); return s; };
const afEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let afSt = Object.assign({ x: null, y: null, w: 410, h: 580, min: true, tab: 'chat', bx: null, by: null, seenSugg: 0 }, (() => { try { return JSON.parse(localStorage.getItem(AF_KEY) || '{}'); } catch(e) { return {}; } })());
const afSave = () => { try { localStorage.setItem(AF_KEY, JSON.stringify(afSt)); } catch(e) {} };
const afClamp = (v, a, b) => Math.max(a, Math.min(b, v));

function afBuild(){
  if(document.getElementById('aiRoot')) return;
  const root = document.createElement('div');
  root.id = 'aiRoot'; root.className = 'aif-root';
  root.innerHTML =
    '<button type="button" id="aiBubble" class="aif-bubble" aria-label=""><span class="aif-av">🤖</span><i class="aif-pulse"></i><b class="aif-badge" id="aifBadge" hidden></b></button>' +
    '<section id="aiFloat" class="aif" role="dialog" aria-label="Assistente" hidden>' +
      '<header class="aif-head" id="aifHead"><span class="aif-av">🤖</span><div class="aif-ttl"><b id="aifTitle"></b><small><i class="aif-sd" id="aifSd"></i><span id="aifStatus"></span></small></div>' +
        '<button type="button" data-a="size" id="aifSize">⤢</button><button type="button" data-a="min" id="aifMin">–</button></header>' +
      '<nav class="aif-tabs" id="aifTabs"></nav>' +
      '<div class="aif-body"><div class="aif-pane" data-p="chat"></div><div class="aif-pane" data-p="study" hidden></div><div class="aif-pane" data-p="sugg" hidden></div><div class="aif-pane" data-p="diary" hidden></div></div>' +
      '<footer class="aif-net" id="aifNet"></footer><i class="aif-grip" id="aifGrip"></i>' +
    '</section>';
  document.body.appendChild(root);
  // a conversa de sempre passa para dentro da janela
  const panel = document.querySelector('.ai-agent-panel');
  if(panel) root.querySelector('[data-p="chat"]').appendChild(panel);
  // opções novas junto das proteções
  const safety = document.querySelector('.ai-agent-safety');
  if(safety && !document.getElementById('aiPreventiveCheck')){
    const l = document.createElement('label');
    l.innerHTML = '<input type="checkbox" id="aiPreventiveCheck"> <span id="aifPrevLbl"></span>';
    safety.appendChild(l);
    const cb = l.querySelector('input');
    cb.checked = typeof aiAgentConfig !== 'undefined' ? aiAgentConfig.preventive !== false : true;
    cb.onchange = () => { aiAgentConfig.preventive = cb.checked; if(typeof aiAgentSaveConfig === 'function') aiAgentSaveConfig(); };
  }
  afWire(root);
  afText(); afApply();
}

function afText(){
  const g = id => document.getElementById(id);
  if(!g('aiBubble')) return;
  g('aiBubble').title = AF('open'); g('aiBubble').setAttribute('aria-label', AF('open'));
  g('aifTitle').textContent = AF('title'); g('aifMin').title = AF('min'); g('aifSize').title = AF('size');
  const p = g('aifPrevLbl'); if(p) p.textContent = AF('prev');
  const tabs = [['chat', '💬', 't_chat'], ['study', '🧠', 't_study'], ['sugg', '💡', 't_sugg'], ['diary', '📜', 't_diary']];
  if(g('aifTabs').dataset.l === String(afI()) && g('aifTabs').children.length) { afSync(); return; }   // só refaz os separadores quando o idioma muda
  g('aifTabs').dataset.l = String(afI());
  g('aifTabs').innerHTML = tabs.map(([k, ic, key]) => '<button type="button" data-t="' + k + '" class="' + (afSt.tab === k ? 'on' : '') + '">' + ic + ' ' + AF(key) + '<b data-b="' + k + '" hidden></b></button>').join('');
  afSync();
}
function afSync(){
  const st = document.getElementById('aifStatus'), sd = document.getElementById('aifSd');
  if(!st) return;
  const busy = typeof aiAgentBusy !== 'undefined' && aiAgentBusy, auto = typeof aiAgentConfig !== 'undefined' && aiAgentConfig.autonomous;
  st.textContent = busy ? AF('st_busy') : auto ? AF('st_auto') : AF('st_manual');
  sd.className = 'aif-sd' + (busy ? ' busy' : auto ? ' on' : '');
  const b = document.getElementById('aiBubble'); if(b){ b.classList.toggle('auto', !!auto); b.classList.toggle('busy', !!busy); }
}
function afApply(){
  const f = document.getElementById('aiFloat'), b = document.getElementById('aiBubble');
  if(!f || !b) return;
  const vw = innerWidth, vh = innerHeight;
  afSt.w = afClamp(afSt.w, 320, Math.max(320, vw - 16)); afSt.h = afClamp(afSt.h, 360, Math.max(360, vh - 16));
  if(afSt.x == null){ afSt.x = Math.max(8, vw - afSt.w - 18); afSt.y = Math.max(8, vh - afSt.h - 100); }
  if(afSt.bx == null){ afSt.bx = vw - 66; afSt.by = vh - 170; }
  afSt.x = afClamp(afSt.x, 4, Math.max(4, vw - afSt.w - 4)); afSt.y = afClamp(afSt.y, 4, Math.max(4, vh - 60));
  afSt.bx = afClamp(afSt.bx, 4, vw - 56); afSt.by = afClamp(afSt.by, 4, vh - 56);
  f.style.cssText = 'left:' + afSt.x + 'px;top:' + afSt.y + 'px;width:' + afSt.w + 'px;height:' + Math.min(afSt.h, vh - afSt.y - 4) + 'px';
  b.style.left = afSt.bx + 'px'; b.style.top = afSt.by + 'px';
  f.hidden = afSt.min; b.hidden = !afSt.min;
  document.querySelectorAll('#aiFloat .aif-pane').forEach(p => { p.hidden = p.dataset.p !== afSt.tab; });
  document.querySelectorAll('#aifTabs button').forEach(t => t.classList.toggle('on', t.dataset.t === afSt.tab));
  if(!afSt.min) aifRender();
}
function afSetMin(min){ afSt.min = min; if(!min) afSt.seenSugg = (typeof asAllSuggestions === 'function' ? asAllSuggestions().length : 0); afSave(); afApply(); aifBadge(); if(!min){ const l = document.getElementById('aiChatLog'); if(l) l.scrollTop = l.scrollHeight; } }

function afWire(root){
  const f = root.querySelector('#aiFloat'), b = root.querySelector('#aiBubble'), head = root.querySelector('#aifHead'), grip = root.querySelector('#aifGrip');
  // arrastar a janela pelo cabeçalho
  let drag = null;
  head.addEventListener('pointerdown', e => { if(e.target.closest('button')) return; drag = { sx: e.clientX, sy: e.clientY, x: afSt.x, y: afSt.y }; head.setPointerCapture(e.pointerId); f.classList.add('moving'); });
  head.addEventListener('pointermove', e => { if(!drag) return; afSt.x = drag.x + e.clientX - drag.sx; afSt.y = drag.y + e.clientY - drag.sy; afApply(); });
  head.addEventListener('pointerup', () => { if(drag){ drag = null; f.classList.remove('moving'); afSave(); } });
  head.addEventListener('dblclick', e => { if(!e.target.closest('button')) afSetMin(true); });
  // redimensionar
  let rs = null;
  grip.addEventListener('pointerdown', e => { rs = { sx: e.clientX, sy: e.clientY, w: afSt.w, h: afSt.h }; grip.setPointerCapture(e.pointerId); e.preventDefault(); });
  grip.addEventListener('pointermove', e => { if(!rs) return; afSt.w = rs.w + e.clientX - rs.sx; afSt.h = rs.h + e.clientY - rs.sy; afApply(); });
  grip.addEventListener('pointerup', () => { if(rs){ rs = null; afSave(); } });
  // o botão redondo também se arrasta: um clique abre, um arrasto muda-o de sítio
  let bd = null, moved = false;
  b.addEventListener('pointerdown', e => { bd = { sx: e.clientX, sy: e.clientY, x: afSt.bx, y: afSt.by }; moved = false; b.setPointerCapture(e.pointerId); });
  b.addEventListener('pointermove', e => { if(!bd) return; const dx = e.clientX - bd.sx, dy = e.clientY - bd.sy; if(Math.abs(dx) + Math.abs(dy) > 5) moved = true; if(moved){ afSt.bx = bd.x + dx; afSt.by = bd.y + dy; afApply(); b.classList.add('moving'); } });
  b.addEventListener('pointerup', () => {
    if(!bd) return; bd = null; b.classList.remove('moving');
    if(moved){ const mid = afSt.bx + 26 < innerWidth / 2; afSt.bx = mid ? 12 : innerWidth - 68; afSave(); afApply(); }   // cola-se ao lado mais próximo
    else afSetMin(false);
  });
  b.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); afSetMin(false); } });
  root.addEventListener('click', e => {
    const a = e.target.closest('[data-a]');
    if(a){ if(a.dataset.a === 'min') afSetMin(true); else if(a.dataset.a === 'size'){ const big = afSt.w < 500; afSt.w = big ? 560 : 410; afSt.h = big ? Math.min(760, innerHeight - 20) : 580; afSave(); afApply(); } return; }
    const t = e.target.closest('#aifTabs [data-t]');
    if(t){ afSt.tab = t.dataset.t; afSave(); afApply(); return; }
    const act = e.target.closest('[data-sg]');
    if(act){ const id = act.dataset.id; if(act.dataset.sg === 'apply' && typeof asApplySuggestion === 'function') asApplySuggestion(id); else if(act.dataset.sg === 'dismiss' && typeof asDismiss === 'function') asDismiss(id); }
  });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && !afSt.min && f.contains(document.activeElement)) afSetMin(true); });
  window.addEventListener('resize', afApply);
}

// ---------------- conteúdo dos separadores ----------------
function aifRender(){
  const root = document.getElementById('aiRoot');
  if(!root || afSt.min) { aifNet(); return; }
  const set = (p, html) => { const el = root.querySelector('[data-p="' + p + '"]'); if(el && el.dataset.h !== html){ el.dataset.h = html; el.innerHTML = html; } };
  if(afSt.tab === 'study') set('study', afStudyHtml());
  else if(afSt.tab === 'sugg') set('sugg', afSuggHtml());
  else if(afSt.tab === 'diary') set('diary', afDiaryHtml());
  aifNet(); aifBadge();
}
function afStudyHtml(){
  if(typeof AS === 'undefined' || !(devices || []).length) return '<div class="aif-empty">' + AF('no_dev') + '</div>';
  return (devices || []).map(dev => {
    const name = dev.name || dev.ip, sc = AS.scores[dev.id], ins = AS.insights[dev.id] || {}, d = AS.data[dev.id];
    const tone = sc == null ? 'none' : sc >= 80 ? 'ok' : sc >= 55 ? 'warn' : 'bad';
    const cur = ins.cur;
    const lines = [];
    lines.push('<span class="aif-l">🧠 ' + afEsc(AT('learning', ins.points || 0, asDur(ins.span || 0))) + '</span>');
    if(cur) lines.push('<span class="aif-l">⚙ ' + cur.f + ' MHz / ' + cur.v + ' mV' + (cur.eff ? ' · ' + cur.eff.toFixed(1) + ' J/TH' : '') + ' · ' + cur.t.toFixed(0) + ' °C · ±' + cur.cv.toFixed(1) + '%</span>');
    if(ins.slope != null) lines.push('<span class="aif-l">🌦 +1 °C → +' + ins.slope.toFixed(2) + ' °C</span>');
    if(ins.predicted != null && ins.peak) lines.push('<span class="aif-l">📈 ~' + Math.round(ins.predicted) + ' °C ' + new Date(ins.peak.t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) + '</span>');
    (ins.notes || []).forEach(n => lines.push('<span class="aif-l bad">' + afEsc(n.t) + '</span>'));
    const pts = d ? Object.values(d.settings).filter(s => s.n >= 20).map(asStat).sort((a, b) => (a.eff || 99) - (b.eff || 99)).slice(0, 4) : [];
    const table = pts.length ? '<div class="aif-pts">' + pts.map(p => '<span class="' + (cur && p.key === cur.key ? 'cur' : '') + '"><b>' + p.key.replace('|', '/') + '</b>' + (p.eff ? p.eff.toFixed(1) : '—') + ' J/TH · ' + p.t.toFixed(0) + '°</span>').join('') + '</div>' : '';
    return '<article class="aif-dev"><div class="aif-ring ' + tone + '" style="--p:' + (sc || 0) + '"><b>' + (sc == null ? '—' : sc) + '</b></div><div class="aif-dtx"><b>' + afEsc(name) + '</b><small>' + AF('score') + '</small>' + lines.join('') + table + '</div></article>';
  }).join('');
}
function afSuggHtml(){
  const all = typeof asAllSuggestions === 'function' ? asAllSuggestions() : [];
  if(!all.length) return '<div class="aif-empty">💡 ' + AF('no_sugg') + '</div>';
  const order = { warn: 0, good: 1, info: 2 };
  return all.slice().sort((a, b) => (order[a.sev] ?? 3) - (order[b.sev] ?? 3)).map(s => {
    const a = s.action || {}, btn = a.type === 'profile' ? 'apply' : a.type === 'safe' ? 'apply' : a.type === 'restart' ? 'restart' : a.type === 'tab' ? 'open_tab' : null;
    return '<article class="aif-sg ' + s.sev + '"><b>' + afEsc(s.title) + '</b><p>' + afEsc(s.detail) + '</p><div>' +
      (btn ? '<button type="button" class="go" data-sg="apply" data-id="' + afEsc(s.id) + '">' + AT(btn) + (a.type === 'profile' ? ' · ' + a.f + '/' + a.v : '') + '</button>' : '') +
      '<button type="button" data-sg="dismiss" data-id="' + afEsc(s.id) + '">' + AT('dismiss') + '</button></div></article>';
  }).join('');
}
function afDiaryHtml(){
  if(typeof AS === 'undefined' || !AS.diary.length) return '<div class="aif-empty">' + AF('no_diary') + '</div>';
  return '<ul class="aif-diary">' + AS.diary.slice(0, 60).map(e => '<li class="' + e.kind + '"><time>' + new Date(e.t).toLocaleString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</time>' + afEsc(e.text) + '</li>').join('') + '</ul>';
}
function aifNet(){
  const el = document.getElementById('aifNet');
  if(!el) return;
  const wx = typeof AS !== 'undefined' && AS.forecast && Date.now() - AS.netAt.fc < 3 * 3600e3, btc = typeof currentRates !== 'undefined' && currentRates && currentRates.btc_eur, df = typeof difficultyData !== 'undefined' && difficultyData && difficultyData.currentDifficulty;
  const chip = (ok, ic, lb) => '<span class="' + (ok ? 'ok' : '') + '">' + ic + ' ' + lb + ' ' + (ok ? '✓' : '…') + '</span>';
  const html = chip(wx, '🌦', AF('net_wx')) + chip(btc, '₿', AF('net_btc')) + chip(df, '⛓', AF('net_diff'));
  if(el.dataset.h !== html + afI()){ el.dataset.h = html + afI(); el.innerHTML = html; el.title = AF('net_title'); }
}
function aifBadge(){
  const n = typeof asAllSuggestions === 'function' ? asAllSuggestions().length : 0, warn = typeof asAllSuggestions === 'function' && asAllSuggestions().some(s => s.sev === 'warn');
  const fresh = Math.max(0, n - (afSt.min ? afSt.seenSugg : n));
  const b = document.getElementById('aifBadge'), sb = document.querySelector('#aifTabs [data-b="sugg"]'), bub = document.getElementById('aiBubble');
  if(b){ b.hidden = !(afSt.min && n); b.textContent = n; b.title = AF('new_sug', fresh || n); }
  if(sb){ sb.hidden = !n; sb.textContent = n; }
  if(bub) bub.classList.toggle('warn', !!warn);
  if(!afSt.min) afSt.seenSugg = n;
}
function aifSync(){ afSync(); }

// ---------------- arranque ----------------
function afInit(){
  afBuild();
  setInterval(() => { if(document.getElementById('aiRoot')){ afText(); afSync(); aifNet(); aifBadge(); } }, 2500);
  // mensagens novas na conversa com a janela fechada acendem o botão
  const log = document.getElementById('aiChatLog');
  if(log && window.MutationObserver) new MutationObserver(() => { const b = document.getElementById('aiBubble'); if(b && afSt.min) { b.classList.add('talk'); setTimeout(() => b.classList.remove('talk'), 2500); } }).observe(log, { childList: true });
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', afInit); else afInit();
