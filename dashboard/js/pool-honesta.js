// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Pool honesta (aba Pools) ----------
// O servidor (/api/pool-honesty) liga-se à pool de cada máquina, lê a transação da recompensa do bloco que a pool
// manda minerar e diz para que endereços iria. Aqui mostra-se máquina a máquina se o bloco seria teu, se a pool
// paga uma parte diretamente na recompensa ou se o teu endereço nem aparece (alarme numa pool solo).
// Verifica ao abrir e de 10 em 10 minutos; se uma pool que pagava ao teu endereço deixar de o fazer, avisa.
(function(){
  const TX = {
    title: { pt: 'Pool honesta', en: 'Honest pool', es: 'Pool honesta', fr: 'Pool honnête' },
    hint: { pt: 'Confirma, pelo trabalho que a pool manda minerar, para quem iria a recompensa se saísse um bloco agora.', en: 'Checks, from the work the pool sends, who would get the reward if a block were found now.', es: 'Comprueba, por el trabajo que envía la pool, para quién iría la recompensa si saliera un bloque ahora.', fr: 'Vérifie, d\'après le travail envoyé par la pool, qui recevrait la récompense si un bloc était trouvé maintenant.' },
    checked: { pt: 'verificado {0}', en: 'checked {0}', es: 'comprobado {0}', fr: 'vérifié {0}' },
    now: { pt: 'Verificar agora', en: 'Check now', es: 'Comprobar ahora', fr: 'Vérifier' },
    checking: { pt: 'A verificar as pools…', en: 'Checking the pools…', es: 'Comprobando las pools…', fr: 'Vérification des pools…' },
    none: { pt: 'Ainda não há máquinas no painel.', en: 'No machines in the dashboard yet.', es: 'Aún no hay máquinas en el panel.', fr: 'Aucune machine dans le tableau de bord.' },
    reserve: { pt: 'reserva', en: 'fallback', es: 'reserva', fr: 'secours' },
    m_solo: { pt: 'Solo', en: 'Solo', es: 'Solo', fr: 'Solo' },
    m_direct: { pt: 'Pagamento direto', en: 'Direct payout', es: 'Pago directo', fr: 'Paiement direct' },
    m_shared: { pt: 'Partilhada', en: 'Shared', es: 'Compartida', fr: 'Partagée' },
    ok: { pt: '✓ O bloco seria teu', en: '✓ The block would be yours', es: '✓ El bloque sería tuyo', fr: '✓ Le bloc serait à vous' },
    ok_d: { pt: '{0} recebe {1}% · pool {2}%', en: '{0} gets {1}% · pool {2}%', es: '{0} recibe {1}% · pool {2}%', fr: '{0} reçoit {1}% · pool {2}%' },
    ok_all: { pt: '{0} recebe tudo (100%)', en: '{0} gets everything (100%)', es: '{0} recibe todo (100%)', fr: '{0} reçoit tout (100%)' },
    part: { pt: '◐ Recebes {0}% diretamente', en: '◐ You get {0}% directly', es: '◐ Recibes {0}% directamente', fr: '◐ Vous recevez {0}% directement' },
    part_d: { pt: 'Se esta pool encontrar um bloco, {0} recebe ~{1} BTC{2} na própria recompensa. Não é solo: o resto vai para outros mineiros.', en: 'If this pool finds a block, {0} gets ~{1} BTC{2} in the reward itself. Not solo: the rest goes to other miners.', es: 'Si esta pool encuentra un bloque, {0} recibe ~{1} BTC{2} en la propia recompensa. No es solo: el resto va a otros mineros.', fr: 'Si cette pool trouve un bloc, {0} reçoit ~{1} BTC{2} dans la récompense. Pas solo : le reste va aux autres mineurs.' },
    part_solo: { pt: '⚠ Pool solo, mas só recebes {0}%', en: '⚠ Solo pool, but you only get {0}%', es: '⚠ Pool solo, pero solo recibes {0}%', fr: '⚠ Pool solo, mais vous ne recevez que {0}%' },
    bad: { pt: '⚠ O teu endereço não aparece', en: '⚠ Your address is missing', es: '⚠ Tu dirección no aparece', fr: '⚠ Votre adresse n\'apparaît pas' },
    bad_d: { pt: 'Numa pool solo isto é um alarme: a recompensa iria para {0}, não para {1}.', en: 'On a solo pool this is an alarm: the reward would go to {0}, not {1}.', es: 'En una pool solo es una alarma: la recompensa iría a {0}, no a {1}.', fr: 'Sur une pool solo c\'est une alarme : la récompense irait à {0}, pas à {1}.' },
    other: { pt: 'ℹ A recompensa vai para a pool', en: 'ℹ The reward goes to the pool', es: 'ℹ La recompensa va a la pool', fr: 'ℹ La récompense va à la pool' },
    other_d: { pt: 'Normal numa pool partilhada, que reparte depois. Se esta pool for solo, é um alarme.', en: 'Normal on a shared pool, which pays out later. If this pool is solo, it\'s an alarm.', es: 'Normal en una pool compartida, que reparte después. Si esta pool es solo, es una alarma.', fr: 'Normal sur une pool partagée, qui répartit ensuite. Si cette pool est solo, c\'est une alarme.' },
    shared: { pt: 'ℹ Normal: paga a pool', en: 'ℹ Normal: the pool gets paid', es: 'ℹ Normal: cobra la pool', fr: 'ℹ Normal : la pool est payée' },
    shared_d: { pt: 'O utilizador é um nome de conta, não um endereço: a pool recebe e reparte depois pelos mineiros.', en: 'The user is an account name, not an address: the pool gets paid and pays miners later.', es: 'El usuario es un nombre de cuenta, no una dirección: la pool cobra y reparte después.', fr: 'L\'utilisateur est un nom de compte, pas une adresse : la pool est payée et répartit ensuite.' },
    err: { pt: 'Não foi possível verificar', en: 'Could not check', es: 'No se pudo comprobar', fr: 'Vérification impossible' },
    unsup: { pt: 'Esta máquina não diz que pool usa', en: 'This machine doesn\'t report its pool', es: 'Esta máquina no indica qué pool usa', fr: 'Cette machine n\'indique pas sa pool' },
    outs: { pt: 'Para quem vai a recompensa', en: 'Who gets the reward', es: 'Para quién va la recompensa', fr: 'Qui reçoit la récompense' },
    you: { pt: 'tu', en: 'you', es: 'tú', fr: 'vous' },
    n_title: { pt: 'Pool deixou de pagar ao teu endereço', en: 'Pool stopped paying your address', es: 'La pool dejó de pagar a tu dirección', fr: 'La pool ne paie plus votre adresse' },
    n_body: { pt: '{0} ({1}): o teu endereço deixou de aparecer na recompensa do bloco.', en: '{0} ({1}): your address no longer appears in the block reward.', es: '{0} ({1}): tu dirección ya no aparece en la recompensa del bloque.', fr: '{0} ({1}) : votre adresse n\'apparaît plus dans la récompense du bloc.' },
    limit: { pt: 'A verificação vê o trabalho que a pool manda a esta ligação; uma pool desonesta poderia, em teoria, mandar outro às máquinas.', en: 'The check sees the work the pool sends to this connection; a dishonest pool could, in theory, send different work to the miners.', es: 'La comprobación ve el trabajo que la pool envía a esta conexión; una pool deshonesta podría, en teoría, enviar otro a las máquinas.', fr: 'La vérification voit le travail envoyé à cette connexion ; une pool malhonnête pourrait, en théorie, en envoyer un autre aux machines.' }
  };
  const lang = () => (typeof currentLang === 'string' && TX.title[currentLang]) ? currentLang : 'pt';
  const x = (k, ...a) => { let s = TX[k][lang()] || TX[k].pt; a.forEach((v, i) => { s = s.split('{' + i + '}').join(v); }); return s; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const loc = () => ({ pt: 'pt-PT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR' }[lang()]);
  const num = (v, d) => Number(v).toLocaleString(loc(), { minimumFractionDigits: d, maximumFractionDigits: d });
  const LKEY = 'hc_pool_honest_last';
  let data = null, at = 0, busy = false;

  function ensure(){
    let el = document.getElementById('phPanel'); if(el) return el;
    const box = document.querySelector('#tab-genpools .blocks-container'); if(!box) return null;
    el = document.createElement('div'); el.id = 'phPanel'; el.className = 'panel ph';
    box.insertBefore(el, box.firstChild);
    el.addEventListener('click', e => {
      if(e.target.closest('[data-ph="now"]')) load(true);
      const row = e.target.closest('.ph-row[data-i]'); if(row && !e.target.closest('button')) row.classList.toggle('open');
    });
    return el;
  }

  function ago(ts){
    const s = Math.max(0, Date.now() / 1000 - ts);
    const r = typeof Intl.RelativeTimeFormat === 'function' ? new Intl.RelativeTimeFormat(loc(), { numeric: 'auto' }) : null;
    if(!r) return '';
    return s < 60 ? r.format(0, 'second') : s < 3600 ? r.format(-Math.round(s / 60), 'minute') : r.format(-Math.round(s / 3600), 'hour');
  }

  function rowHtml(m, i){
    const rate = (() => { try { return Number(currentRates && currentRates.btc_eur) || 0; } catch(e) { return 0; } })();
    let mode = '', pill = '', pcls = 'mute', detail = '';
    const fee = m.pct != null ? num(Math.max(0, 100 - m.pct), m.pct > 99 ? 1 : 0) : '';
    if(m.status === 'ok'){
      mode = 'solo'; pill = x('ok'); pcls = 'good';
      detail = m.pct >= 99.95 ? x('ok_all', esc(m.addr)) : x('ok_d', esc(m.addr), num(m.pct, m.pct % 1 ? 1 : 0), fee);
    }
    else if(m.status === 'partial'){
      const btc = m.total_sats * m.pct / 100 / 1e8, eur = rate ? ' (≈ ' + (btc * rate).toLocaleString(loc(), { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) + ')' : '';
      if(m.solo_host){ mode = 'solo'; pill = x('part_solo', num(m.pct, 2)); pcls = 'warn'; }
      else { mode = 'direct'; pill = x('part', num(m.pct, m.pct < 1 ? 2 : 1)); pcls = 'info'; }
      detail = x('part_d', esc(m.addr), num(btc, btc < 0.1 ? 4 : 3), eur);
    } else if(m.status === 'other'){
      const top = (m.outputs || [])[0];
      if(m.solo_host){ mode = 'solo'; pill = x('bad'); pcls = 'bad'; detail = x('bad_d', esc(top ? top.addr : '?'), esc(m.addr)); }
      else { mode = 'shared'; pill = x('other'); detail = x('other_d'); }
    } else if(m.status === 'shared'){ mode = 'shared'; pill = x('shared'); detail = x('shared_d'); }
    else if(m.status === 'error'){ pill = x('err'); pcls = 'warn'; detail = esc(m.error || ''); }
    else { pill = x('unsup'); }
    const modeTxt = mode === 'solo' ? x('m_solo') : mode === 'direct' ? x('m_direct') : mode === 'shared' ? x('m_shared') : '';
    const outs = (m.outputs || []).map(o => '<div class="ph-out' + (o.mine ? ' me' : '') + '"><span>' + (o.addr ? esc(o.addr) : 'OP_RETURN') + (o.mine ? ' · ' + x('you') : '') + '</span><b><i style="width:' + Math.min(100, o.pct) + '%"></i></b><em>' + num(o.pct, o.pct < 1 ? 2 : 1) + '%</em></div>').join('');
    return '<div class="ph-row' + (outs ? ' has' : '') + '" data-i="' + i + '">' +
      '<div class="ph-m"><b>' + esc(m.name) + '</b><small>' + esc(m.host ? m.host + ':' + m.port : '—') + (m.fallback ? ' · ' + x('reserve') : '') + '</small></div>' +
      '<div class="ph-mode">' + (modeTxt ? '<span class="ph-tag ' + mode + '">' + modeTxt + '</span>' : '') + '</div>' +
      '<div class="ph-st"><span class="ph-pill ' + pcls + '">' + pill + '</span><small>' + detail + '</small></div>' +
      (outs ? '<div class="ph-outs"><div class="ph-outs-t">' + x('outs') + '</div>' + outs + '</div>' : '') +
      '</div>';
  }

  function render(){
    const el = ensure(); if(!el) return;
    const head = '<div class="panel-title ph-head"><span>🛡️ ' + x('title') + '</span><span class="ph-when">' + (at ? x('checked', ago(at)) : '') +
      '<button type="button" data-ph="now"' + (busy ? ' disabled' : '') + '>' + x('now') + '</button></span></div><div class="hint ph-hint">' + x('hint') + '</div>';
    let body;
    if(busy && !data) body = '<div class="ph-empty">' + x('checking') + '</div>';
    else if(!data || !data.length) body = '<div class="ph-empty">' + x('none') + '</div>';
    else body = data.map(rowHtml).join('');
    el.innerHTML = head + body + '<div class="ph-limit">' + x('limit') + '</div>';
  }

  // aviso: uma pool que pagava ao teu endereço (ok/partial) passou a não o incluir
  function alarms(list){
    let last = {}; try { last = JSON.parse(localStorage.getItem(LKEY) || '{}') || {}; } catch(e) {}
    const now = {};
    list.forEach(m => {
      if(!m.host || m.status === 'error' || m.status === 'unsupported') return;
      const k = m.name + '|' + m.host;
      now[k] = m.status;
      const was = last[k];
      if((was === 'ok' || was === 'partial') && m.status === 'other' && typeof addNotification === 'function')
        try { addNotification('anomaly', x('n_title'), x('n_body', m.name, m.host), 'Pool honesta'); } catch(e) {}
    });
    try { localStorage.setItem(LKEY, JSON.stringify(Object.assign(last, now))); } catch(e) {}
  }

  async function load(force){
    if(busy) return;
    busy = true; render();
    // cada pool pode demorar até ~12 s a responder; ao fim de 45 s desiste (o painel nunca fica preso)
    let tm;
    try {
      const j = await Promise.race([
        fetch(API_BASE + '/api/pool-honesty' + (force ? '?force=1' : '')).then(r => r.json()),
        new Promise((_, no) => { tm = setTimeout(() => no(new Error('timeout')), 45000); })
      ]);
      if(Array.isArray(j.machines)){ data = j.machines; at = Date.now() / 1000; alarms(data); }
    } catch(e) {}
    clearTimeout(tm);
    busy = false; render();
  }

  window.hcPoolHonesty = { load, render };
  setTimeout(() => load(false), 6000);
  setInterval(() => load(false), 10 * 60e3);
  setInterval(() => { if(document.getElementById('phPanel') && at) render(); }, 60e3);
})();
