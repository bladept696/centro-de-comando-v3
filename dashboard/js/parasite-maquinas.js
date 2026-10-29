// ---------- Parasite Pool: que máquinas estão ligadas à pool ----------
// Tabela das máquinas (workers) do endereço guardado na aba: estado (ligada ou offline), hashrate, melhor diff e última submissão.
// Uma máquina conta como ligada se a pool recebeu um share nos últimos 10 minutos e o hashrate não é zero.
(function(){
  const LANGS = ['pt', 'en', 'es', 'fr'], ONLINE_S = 600;
  const TX = {
    title: ['Máquinas ligadas à pool', 'Machines connected to the pool', 'Máquinas conectadas al pool', 'Machines connectées au pool'],
    name: ['Nome', 'Name', 'Nombre', 'Nom'], state: ['Estado', 'Status', 'Estado', 'État'], hr: ['Hashrate', 'Hashrate', 'Hashrate', 'Hashrate'],
    best: ['Best Difficulty', 'Best Difficulty', 'Best Difficulty', 'Best Difficulty'], last: ['Última submissão', 'Last submission', 'Última envío', 'Dernière soumission'],
    on: ['Ligada', 'Online', 'Conectada', 'Connectée'], off: ['Offline', 'Offline', 'Offline', 'Hors ligne'],
    mine: ['No teu painel', 'In your panel', 'En tu panel', 'Dans votre tableau'],
    ago: ['há {0}', '{0} ago', 'hace {0}', 'il y a {0}'], summary: ['{0} de {1} ligadas · {2}', '{0} of {1} online · {2}', '{0} de {1} conectadas · {2}', '{0} sur {1} connectées · {2}'],
    none: ['Esta carteira não tem máquinas na Parasite Pool.', 'This wallet has no machines on Parasite Pool.', 'Esta cartera no tiene máquinas en Parasite Pool.', 'Ce portefeuille n’a aucune machine sur Parasite Pool.'],
    noaddr: ['Guarda o teu endereço Bitcoin acima para ver as máquinas.', 'Save your Bitcoin address above to see the machines.', 'Guarda tu dirección Bitcoin arriba para ver las máquinas.', 'Enregistrez votre adresse Bitcoin ci-dessus pour voir les machines.'],
    old: ['Esta versão do programa ainda não tem esta função. Instala a versão nova (ou reinicia o programa depois de atualizar) para ver as máquinas.', 'This version of the program does not have this feature yet. Install the new version (or restart after updating) to see the machines.', 'Esta versión del programa aún no tiene esta función. Instala la versión nueva (o reinicia tras actualizar) para ver las máquinas.', 'Cette version du programme n’a pas encore cette fonction. Installez la nouvelle version (ou redémarrez après la mise à jour) pour voir les machines.'],
    err: ['Não foi possível obter as máquinas', 'Could not load the machines', 'No se pudieron obtener las máquinas', 'Impossible de charger les machines'], loading: ['A carregar…', 'Loading…', 'Cargando…', 'Chargement…'],
    hint: ['Ligada = a pool recebeu um share nos últimos 10 minutos.', 'Online = the pool received a share in the last 10 minutes.', 'Conectada = el pool recibió un share en los últimos 10 minutos.', 'Connectée = le pool a reçu un share ces 10 dernières minutes.']
  };
  const lang = () => { try { const l = typeof currentLang !== 'undefined' ? currentLang : 'pt'; return LANGS.includes(l) ? l : 'pt'; } catch(e) { return 'pt'; } };
  const t = (k, ...a) => { let s = TX[k][LANGS.indexOf(lang())]; a.forEach((v, i) => { s = s.split('{' + i + '}').join(v); }); return s; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const addr = () => { try { return (loadParasiteAddress() || '').trim(); } catch(e) { return ''; } };
  const fd = n => { if(!(n > 0)) return '—'; try { const f = formatDiff(n); return f.value + f.unit; } catch(e) { return String(Math.round(n)); } };
  const fh = h => !(h > 0) ? '—' : h >= 1e15 ? (h / 1e15).toFixed(2) + ' PH/s' : h >= 1e12 ? (h / 1e12).toFixed(2) + ' TH/s' : h >= 1e9 ? (h / 1e9).toFixed(2) + ' GH/s' : (h / 1e6).toFixed(2) + ' MH/s';
  function since(s){ s = Math.max(0, s); const u = s < 60 ? s + ' s' : s < 3600 ? Math.floor(s / 60) + ' min' : s < 86400 ? Math.floor(s / 3600) + ' h' : Math.floor(s / 86400) + ' d'; return t('ago', u); }

  const S = { data: null, state: 'idle', sort: 'hr', dir: -1, at: 0, addr: '', busy: false };

  async function load(force){
    const a = addr();
    if(!a){ S.state = 'noaddr'; S.data = null; draw(); return; }
    if(S.busy) return;
    if(!force && S.addr === a && S.data && Date.now() - S.at < 18e3) return;
    S.busy = true; if(!S.data || S.addr !== a){ S.state = 'loading'; draw(); }
    try {
      const r = await fetch(API_BASE + '/api/parasite-workers?address=' + encodeURIComponent(a));
      // uma versão antiga do programa não conhece esta rota e responde com uma página HTML (404)
      if(!/json/i.test(r.headers.get('content-type') || '')){ S.state = 'old'; S.busy = false; S.data = null; draw(); return; }
      const j = await r.json();
      if(!r.ok || j.error) throw new Error(j.error || r.status);
      S.data = j; S.addr = a; S.at = Date.now(); S.state = 'ok';
    } catch(e) { S.state = 'err'; S.err = String(e.message || e); }
    S.busy = false; draw();
  }

  const isOn = (w, now) => w.hashrate_hs > 0 && w.last_submission > 0 && now - w.last_submission <= ONLINE_S;
  function mineNames(){ try { return new Set((devices || []).map(d => String(d.name || '').trim().toLowerCase()).filter(Boolean)); } catch(e) { return new Set(); } }

  function draw(){
    const host = document.getElementById('parasiteMachinesBody'); if(!host) return;
    const msg = k => { host.innerHTML = '<div class="pw-msg">' + esc(t(k)) + (k === 'err' && S.err ? ' (' + esc(S.err) + ')' : '') + '</div>'; };
    const sum = document.getElementById('parasiteMachinesSum');
    if(S.state === 'noaddr'){ if(sum) sum.textContent = ''; return msg('noaddr'); }
    if(S.state === 'old'){ if(sum) sum.textContent = ''; return msg('old'); }
    if(S.state === 'loading' && !S.data){ return msg('loading'); }
    if(S.state === 'err' && !S.data){ return msg('err'); }
    const d = S.data, now = d.now || Math.floor(Date.now() / 1000), ws = d.workers.slice();
    if(!ws.length){ if(sum) sum.textContent = ''; return msg('none'); }
    const key = { name: w => w.name.toLowerCase(), state: w => (isOn(w, now) ? 1 : 0), hr: w => w.hashrate_hs, best: w => w.best_diff, last: w => w.last_submission }[S.sort] || (w => w.hashrate_hs);
    ws.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * S.dir || b.hashrate_hs - a.hashrate_hs; });
    const on = ws.filter(w => isOn(w, now)).length, mine = mineNames();
    if(sum) sum.textContent = t('summary', on, ws.length, fh(d.total_hashrate_hs || ws.reduce((s, w) => s + w.hashrate_hs, 0)));
    const th = (k, label) => '<th data-s="' + k + '" class="pw-th' + (S.sort === k ? ' on' : '') + '" aria-sort="' + (S.sort === k ? (S.dir < 0 ? 'descending' : 'ascending') : 'none') + '">' + esc(label) + (S.sort === k ? ' <i>' + (S.dir < 0 ? '↓' : '↑') + '</i>' : '') + '</th>';
    host.innerHTML = '<div class="pw-scroll"><table class="pw-table"><thead><tr>' + th('name', t('name')) + th('state', t('state')) + th('hr', t('hr')) + th('best', t('best')) + th('last', t('last')) + '</tr></thead><tbody>' +
      ws.map(w => { const o = isOn(w, now), m = mine.has(w.name.toLowerCase());
        return '<tr class="' + (o ? 'on' : 'off') + '"><td><b>' + esc(w.name) + '</b>' + (m ? ' <span class="pw-mine" title="' + esc(t('mine')) + '">▣</span>' : '') + '</td>' +
          '<td><span class="pw-st ' + (o ? 'on' : 'off') + '"><i></i>' + esc(t(o ? 'on' : 'off')) + '</span></td><td>' + esc(o ? fh(w.hashrate_hs) : '—') + '</td><td>' + esc(fd(w.best_diff)) + '</td><td>' + (w.last_submission ? esc(since(now - w.last_submission)) : '—') + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
  }

  function build(){
    if(document.getElementById('parasiteMachines')) return;
    const anchor = document.getElementById('parasiteChart') || document.getElementById('parasiteErrorHint'); if(!anchor || !anchor.parentNode) return;
    const box = document.createElement('div'); box.id = 'parasiteMachines'; box.className = 'pw-card';
    box.innerHTML = '<div class="pw-head"><b id="parasiteMachinesTitle"></b><span id="parasiteMachinesSum" class="pw-sum"></span></div><div id="parasiteMachinesBody"></div><div class="pw-hint" id="parasiteMachinesHint"></div>';
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
    box.addEventListener('click', e => {
      const th = e.target.closest('[data-s]'); if(!th) return;
      if(S.sort === th.dataset.s) S.dir = -S.dir; else { S.sort = th.dataset.s; S.dir = th.dataset.s === 'name' ? 1 : -1; }
      draw();
    });
    label();
  }
  function label(){ const a = document.getElementById('parasiteMachinesTitle'); if(a) a.textContent = '🖥️ ' + t('title'); const h = document.getElementById('parasiteMachinesHint'); if(h) h.textContent = t('hint'); }

  function show(){ build(); label(); load(false); }
  if(typeof renderParasiteSection === 'function'){ const o = renderParasiteSection; window.renderParasiteSection = function(){ const r = o.apply(this, arguments); try { show(); } catch(e) {} return r; }; }
  if(typeof fetchParasiteStats === 'function'){ const o2 = fetchParasiteStats; window.fetchParasiteStats = function(forceUi){ const r = o2.apply(this, arguments); if(forceUi){ try { build(); load(true); } catch(e) {} } return r; }; }
  setInterval(() => { const tab = document.getElementById('tab-parasite'); if(tab && tab.classList.contains('active') && !document.hidden) load(false); }, 30000);
  setTimeout(build, 1600);
  window.hcParasiteWorkers = { load, state: () => S, draw };
})();
