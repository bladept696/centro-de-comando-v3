// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Aba "Hash Commander OS" (firmware próprio para a NerdQAxe++, hc_os.py) ----------
// Mostra que firmware tem cada máquina, instala o HC OS pela rede (uma máquina de cada vez, com confirmação de que volta a
// minerar), mostra os dados ao vivo que a máquina empurra (1 ponto por segundo) e o registo de shares guardado na máquina.
Object.assign(I18N_DICT, {
  hco_t: { pt: `Hash Commander OS`, en: `Hash Commander OS`, es: `Hash Commander OS`, fr: `Hash Commander OS` },
  ab_hcos: { pt: `Firmware próprio para a NerdQAxe++: dados ao vivo, registo de shares e atualizações seguras.`, en: `Own firmware for the NerdQAxe++: live data, share log and safe updates.`, es: `Firmware propio para la NerdQAxe++: datos en vivo, registro de shares y actualizaciones seguras.`, fr: `Firmware maison pour la NerdQAxe++ : données en direct, journal des shares et mises à jour sûres.` },
  hco_sub: { pt: `Firmware próprio para a NerdQAxe++: a máquina envia os dados ao vivo para a dashboard, guarda o registo das shares e atualiza-se em conjunto com as outras. Continua a funcionar com o AxeOS e com as outras apps.`, en: `Own firmware for the NerdQAxe++: the miner pushes live data to the dashboard, keeps a log of its shares and updates together with the others. AxeOS and other apps keep working.` },
  hco_base: { pt: `baseado no firmware NerdQAxe++`, en: `based on the NerdQAxe++ firmware` },
  hco_open: { pt: `código aberto · GPL-3.0`, en: `open source · GPL-3.0` },
  hco_c_m: { pt: `Máquina`, en: `Miner` }, hco_c_fw: { pt: `Firmware`, en: `Firmware` }, hco_c_link: { pt: `Ligação`, en: `Connection` }, hco_c_sh: { pt: `Shares registadas`, en: `Logged shares` },
  hco_live: { pt: `ao vivo`, en: `live` }, hco_live_d: { pt: `atualiza a cada segundo`, en: `updates every second` },
  hco_poll: { pt: `a perguntar 5 s`, en: `polling 5 s` }, hco_poll_d: { pt: `como hoje`, en: `as today` },
  hco_off: { pt: `sem resposta`, en: `no answer` },
  hco_official: { pt: `firmware oficial`, en: `official firmware` },
  hco_only_hc: { pt: `— só com HC OS`, en: `— only with HC OS` }, hco_unsup: { pt: `— ainda não suportada`, en: `— not supported yet` },
  hco_only_nqa: { pt: `Só NerdQAxe++`, en: `NerdQAxe++ only` },
  hco_install: { pt: `Instalar HC OS`, en: `Install HC OS` }, hco_log: { pt: `Ver registo`, en: `View log` }, hco_back: { pt: `Voltar à anterior`, en: `Previous version` },
  hco_best: { pt: `melhor {0} · {1} rejeitadas`, en: `best {0} · {1} rejected` },
  hco_scan: { pt: `A procurar as máquinas…`, en: `Looking for miners…` }, hco_none: { pt: `Ainda não tens máquinas no painel.`, en: `You have no miners on the dashboard yet.` },
  hco_new: { pt: `Nova versão disponível: HC OS {0}`, en: `New version available: HC OS {0}` },
  hco_new_d: { pt: `Atualiza as máquinas uma a uma. Se uma não voltar a minerar, volta ao firmware anterior e as outras não são tocadas.`, en: `Updates the miners one by one. If one does not mine again it goes back to the previous firmware and the others are left alone.` },
  hco_all: { pt: `Atualizar todas ({0})`, en: `Update all ({0})` },
  hco_norel: { pt: `Ainda não há nenhuma versão do HC OS publicada. Quando houver, aparece aqui.`, en: `No HC OS version has been published yet. It will show up here.` },
  hco_i_t: { pt: `Instalar HC OS na {0}`, en: `Install HC OS on {0}` },
  hco_i_sub: { pt: `A instalação é feita pela rede, como uma atualização normal do AxeOS.`, en: `Installed over the network, like a normal AxeOS update.` },
  hco_i_model: { pt: `Modelo`, en: `Model` }, hco_i_cur: { pt: `Firmware atual`, en: `Current firmware` }, hco_i_new: { pt: `Versão a instalar`, en: `Version to install` },
  hco_i_signed: { pt: `assinada ✓`, en: `signed ✓` }, hco_i_set: { pt: `Definições`, en: `Settings` }, hco_i_set_v: { pt: `pool, Wi-Fi e frequência mantidas`, en: `pool, Wi-Fi and frequency kept` },
  hco_i_back: { pt: `↩️ Se a máquina não voltar a minerar, regressa ao firmware anterior. Podes também voltar à versão anterior quando quiseres, no botão "Voltar à anterior".`, en: `↩️ If the miner does not mine again it goes back to the previous firmware. You can also go back to the previous version any time with "Previous version".` },
  hco_i_warn: { pt: `<b>Firmware não oficial.</b> Em casos raros pode ser preciso reinstalar por cabo USB. Pode afetar a garantia do fabricante.`, en: `<b>Unofficial firmware.</b> In rare cases a reinstall over USB may be needed. It may affect the manufacturer's warranty.` },
  hco_i_otp: { pt: `Código OTP (só se ativaste a proteção OTP na máquina)`, en: `OTP code (only if you enabled OTP on the miner)` },
  hco_i_ok: { pt: `Percebi os riscos e quero instalar nesta máquina.`, en: `I understand the risks and want to install on this miner.` },
  hco_i_go: { pt: `Instalar`, en: `Install` }, hco_cancel: { pt: `Cancelar`, en: `Cancel` }, hco_close: { pt: `Fechar`, en: `Close` },
  hco_s1: { pt: `Modelo compatível confirmado`, en: `Compatible model confirmed` },
  hco_s2: { pt: `Firmware descarregado e assinatura verificada`, en: `Firmware downloaded and signature checked` },
  hco_s3: { pt: `A enviar o firmware`, en: `Sending the firmware` },
  hco_s4: { pt: `A reiniciar a máquina`, en: `Restarting the miner` },
  hco_s5: { pt: `A confirmar que volta a minerar`, en: `Checking it mines again` },
  hco_s5_d: { pt: `até 7 min`, en: `up to 7 min` },
  hco_up: { pt: `A atualizar {0}`, en: `Updating {0}` },
  hco_lv_hr: { pt: `Hashrate agora`, en: `Hashrate now` }, hco_lv_t: { pt: `Temperatura`, en: `Temperature` }, hco_lv_sh: { pt: `Última share`, en: `Last share` },
  hco_lv_d: { pt: `A máquina envia os dados assim que mudam: vês logo uma queda de hashrate ou um pico de temperatura.`, en: `The miner sends data as soon as it changes: you see a hashrate drop or a temperature spike right away.` },
  hco_lv_wait: { pt: `À espera dos dados ao vivo…`, en: `Waiting for live data…` },
  hco_ago: { pt: `há {0}`, en: `{0} ago` },
  hco_lg_t: { pt: `Registo de shares · {0}`, en: `Share log · {0}` },
  hco_f_all: { pt: `Todas`, en: `All` }, hco_f_ok: { pt: `Só aceites`, en: `Accepted only` }, hco_f_bad: { pt: `Só rejeitadas`, en: `Rejected only` }, hco_f_big: { pt: `Acima de 1 M`, en: `Above 1 M` },
  hco_h_time: { pt: `Hora`, en: `Time` }, hco_h_diff: { pt: `Dificuldade`, en: `Difficulty` }, hco_h_pool: { pt: `Pool`, en: `Pool` }, hco_h_res: { pt: `Resultado`, en: `Result` },
  hco_st1: { pt: `aceite`, en: `accepted` }, hco_st2: { pt: `rejeitada`, en: `rejected` }, hco_st3: { pt: `sem resposta`, en: `no answer` }, hco_st0: { pt: `à espera`, en: `waiting` },
  hco_pri: { pt: `principal`, en: `primary` }, hco_sec: { pt: `reserva`, en: `fallback` },
  hco_lg_n: { pt: `{0} shares desde que a máquina arrancou · guarda as últimas 10 000`, en: `{0} shares since the miner started · keeps the last 10 000` },
  hco_csv: { pt: `Exportar CSV`, en: `Export CSV` },
  hco_lg_d: { pt: `Cada share fica registada na própria máquina, mesmo com o PC desligado. Serve para provar o trabalho feito num aluguer e para descobrir rejeições.`, en: `Every share is logged on the miner itself, even with the PC off. Useful to prove the work done in a rental and to find rejections.` },
  hco_back_q: { pt: `Voltar ao firmware que estava instalado antes desta versão na {0}? A máquina reinicia.`, en: `Go back to the firmware installed before this version on {0}? The miner restarts.` },
  hco_back_ok: { pt: `A máquina está a voltar ao firmware anterior e vai reiniciar.`, en: `The miner is going back to the previous firmware and will restart.` },
  hco_e_old: { pt: `O servidor da app que está a correr é de uma versão anterior. Fecha a app (ícone na bandeja → Sair) e abre-a de novo.`, en: `The running app server is an older version. Quit the app (tray icon → Exit) and open it again.` },
});

(function(){
  const S = { scan: null, live: {}, jobs: [], hist: {}, sel: null, view: 'live', modal: null, log: null, filter: 'all', err: '', busy: false };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (k, ...a) => a.reduce((s, v, i) => s.split('{' + i + '}').join(v), t(k));
  const loc = () => ({ pt: 'pt-PT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR' }[typeof currentLang !== 'undefined' ? currentLang : 'pt'] || 'pt-PT');
  const num = (v, d) => Number(v).toLocaleString(loc(), { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const si = v => { v = Number(v) || 0; const u = ['', 'k', 'M', 'G', 'T', 'P']; let i = 0; while(v >= 1000 && i < u.length - 1){ v /= 1000; i++; } return (i ? num(v, 1) : num(v, 0)) + (u[i] ? ' ' + u[i] : ''); };
  const ths = gh => num((Number(gh) || 0) / 1000, 2) + ' TH/s';
  const tab = () => document.getElementById('tab-hcos');
  const active = () => { const el = tab(); return el && el.classList.contains('active'); };
  const nameOf = ip => { try { const d = (devices || []).find(x => x.ip === ip); return (d && (d.name || d.alias)) || ip; } catch(e) { return ip; } };
  async function api(path, body){
    const r = await fetch(API_BASE + path, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const txt = await r.text();
    try { return JSON.parse(txt); } catch(e) { throw new Error(t('hco_e_old')); }
  }
  const ips = () => { try { return [...new Set((devices || []).map(d => d.ip).filter(Boolean))]; } catch(e) { return []; } };
  const hcIps = () => ((S.scan && S.scan.machines) || []).filter(m => m.hcos).map(m => m.ip);
  const rel = () => (S.scan && S.scan.release) || {};
  const jobOf = ip => S.jobs.find(j => j.ip === ip);
  const newer = (a, b) => { const p = s => String(s || '').split('.').map(n => parseInt(n, 10) || 0); const x = p(a), y = p(b); for(let i = 0; i < 3; i++){ if((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

  // ------------------------------------------------------------ desenho
  function rowHtml(m){
    const hc = m.hcos, lv = S.live[m.ip], j = jobOf(m.ip), r = rel();
    const fw = hc ? '<span class="hco-pill pur">HC OS ' + esc(hc.hcos) + '</span><small>' + esc(m.version) + '</small>'
                  : '<span class="hco-pill blu">' + esc(m.version ? 'AxeOS ' + m.version : '?') + '</span><small>' + t('hco_official') + '</small>';
    const link = hc ? (lv && lv.connected ? '<span class="hco-pill grn"><i class="hco-dot"></i>' + t('hco_live') + '</span><small>' + t('hco_live_d') + '</small>'
                                          : '<span class="hco-pill amb">' + t('hco_off') + '</span>')
                    : '<span class="hco-pill amb">' + t('hco_poll') + '</span><small>' + t('hco_poll_d') + '</small>';
    const st = lv && lv.state;
    const shares = hc ? '<b>' + num((hc.shareLog || {}).total || 0) + '</b><small>' + fmt('hco_best', si(st ? st.bestDiff : 0), num(st ? st.rejected : 0)) + '</small>'
                      : '<span class="hco-mut">' + t(m.model === S.scan.board ? 'hco_only_hc' : 'hco_unsup') + '</span>';
    let act;
    if(j && !['done', 'failed', 'rolled_back'].includes(j.state)) act = '<span class="hco-pill amb">' + esc(j.step) + (j.state === 'upload' ? ' · ' + j.progress + '%' : '') + '</span>';
    else if(hc) act = '<button type="button" class="hm-btn" data-hco="sel" data-ip="' + esc(m.ip) + '">' + t('hco_log') + '</button> <button type="button" class="hm-btn red" data-hco="back" data-ip="' + esc(m.ip) + '">' + t('hco_back') + '</button>';
    else if(m.model === S.scan.board) act = '<button type="button" class="hm-btn y" data-hco="inst" data-ip="' + esc(m.ip) + '"' + (r.ok ? '' : ' disabled title="' + esc(t('hco_norel')) + '"') + '>' + t('hco_install') + '</button>';
    else act = '<button type="button" class="hm-btn" disabled>' + t('hco_only_nqa') + '</button>';
    const jmsg = j && ['done', 'failed', 'rolled_back'].includes(j.state) ? '<div class="hco-jmsg ' + (j.state === 'done' ? 'ok' : 'bad') + '">' + esc(j.step) + '</div>' : '';
    return '<div class="hco-row' + (S.sel === m.ip ? ' on' : '') + '"><span><b>' + esc(nameOf(m.ip)) + '</b><small>' + esc(m.model) + ' · ' + esc(m.ip) + '</small></span><span>' + fw + '</span><span>' + link + '</span><span>' + shares + '</span><span class="hco-act">' + act + '</span></div>' + jmsg;
  }
  function footHtml(){
    const r = rel(); if(!r.ok) return '<div class="hco-foot"><div><small>' + t('hco_norel') + '</small></div></div>';
    const old = ((S.scan && S.scan.machines) || []).filter(m => m.hcos && newer(r.version, m.hcos.hcos));
    const run = S.jobs.find(j => !['done', 'failed', 'rolled_back', 'queued'].includes(j.state));
    let h = '';
    if(old.length) h += '<div class="hco-foot"><div><b>' + fmt('hco_new', esc(r.version)) + '</b><small>' + t('hco_new_d') + '</small></div><button type="button" class="hm-btn y" data-hco="all">' + fmt('hco_all', old.length) + '</button></div>';
    if(run) h += '<div class="hco-foot"><div><b>' + fmt('hco_up', esc(nameOf(run.ip))) + (run.version ? ' · ' + esc(run.version) : '') + '</b><small>' + esc(run.step) + '</small><div class="hco-bar"><i style="width:' + (run.state === 'upload' ? run.progress : run.state === 'mining_check' ? 100 : 50) + '%"></i></div></div><span class="hco-pill amb">' + (run.state === 'upload' ? run.progress + '%' : '…') + '</span></div>';
    return h;
  }
  function spark(ip){
    const h = S.hist[ip] || []; if(h.length < 2) return '';
    const W = 440, H = 120, max = Math.max(...h) * 1.1 || 1, min = Math.min(...h) * 0.9;
    const pts = h.map((v, i) => [(i / (h.length - 1)) * W, H - ((v - min) / ((max - min) || 1)) * (H - 10) - 5]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    return '<svg class="hco-spark" viewBox="0 0 ' + W + ' ' + (H + 4) + '" preserveAspectRatio="none"><path d="' + d + ' L' + W + ' ' + H + ' L0 ' + H + ' Z" class="a"/><path d="' + d + '" class="l"/></svg>';
  }
  function liveHtml(){
    const ip = S.sel; if(!ip) return '';
    const lv = S.live[ip] || {}, st = lv.state, sh = (lv.shares || []).slice(-1)[0];
    const lastAgo = sh && st ? Math.max(0, st.up - sh.up) : null;
    return '<div class="hco-card"><div class="hco-hd"><b>' + esc(nameOf(ip)) + '</b>' + (lv.connected ? '<span class="hco-pill grn"><i class="hco-dot"></i>' + t('hco_live') + '</span>' : '<span class="hco-pill amb">' + t('hco_off') + '</span>') + '</div>' +
      (st ? '<div class="hco-big"><div>' + t('hco_lv_hr') + '<b class="g">' + ths(st.hashRate) + '</b></div><div>' + t('hco_lv_t') + '<b>' + num(st.temp, 1) + ' °C</b></div><div>' + t('hco_lv_sh') + '<b class="a">' + (lastAgo == null ? '—' : fmt('hco_ago', lastAgo + ' s')) + '</b></div></div>' + spark(ip)
          : '<div class="hco-mut">' + t('hco_lv_wait') + '</div>') +
      '<p class="hco-sub">' + t('hco_lv_d') + '</p></div>';
  }
  function logHtml(){
    const ip = S.sel; if(!ip) return '';
    const L = S.log && S.log.ip === ip ? S.log : null, items = L ? L.items.slice().reverse() : [];
    const f = S.filter, rows = items.filter(x => f === 'all' || (f === 'ok' && x[7] === 1) || (f === 'bad' && x[7] === 2) || (f === 'big' && x[3] >= 1e6));
    const best = items.reduce((b, x) => x[3] > b ? x[3] : b, 0);
    const when = x => x[1] ? new Date(x[1] * 1000).toLocaleTimeString(loc()) : '+' + x[2] + ' s';
    return '<div class="hco-card"><div class="hco-hd"><b>' + fmt('hco_lg_t', esc(nameOf(ip))) + '</b></div>' +
      '<div class="hco-flt">' + ['all', 'ok', 'bad', 'big'].map(k => '<button type="button" data-hco="flt" data-f="' + k + '" class="' + (f === k ? 'on' : '') + '">' + t('hco_f_' + k) + '</button>').join('') + '</div>' +
      '<div class="hco-tbl"><div class="hco-tr hd"><span>' + t('hco_h_time') + '</span><span>' + t('hco_h_diff') + '</span><span>' + t('hco_h_pool') + '</span><span>' + t('hco_h_res') + '</span></div>' +
      (L ? rows.slice(0, 200).map(x => '<div class="hco-tr' + (x[3] === best && best ? ' best' : '') + '"><span>' + when(x) + '</span><span>' + si(x[3]) + (x[3] === best && best ? ' ★' : '') + '</span><span>' + t(x[5] ? 'hco_sec' : 'hco_pri') + '</span><span class="st' + x[7] + '">' + t('hco_st' + x[7]) + '</span></div>').join('') : '<div class="hco-mut">' + t('hco_scan') + '</div>') + '</div>' +
      '<div class="hco-go"><small>' + fmt('hco_lg_n', num(L ? L.last : 0)) + '</small><button type="button" class="hm-btn" data-hco="csv"' + (L && items.length ? '' : ' disabled') + '>' + t('hco_csv') + '</button></div>' +
      '<p class="hco-sub">' + t('hco_lg_d') + '</p></div>';
  }
  function modalHtml(){
    const ip = S.modal; if(!ip) return '';
    const m = ((S.scan && S.scan.machines) || []).find(x => x.ip === ip) || {}, r = rel(), j = jobOf(ip);
    const order = ['checking', 'download', 'upload', 'rebooting', 'mining_check'], at = j ? order.indexOf(j.state) : -1, done = j && j.state === 'done';
    const step = (i, k, extra) => { const cls = done || at > i ? 'ok' : at === i ? 'now' : ''; return '<div class="hco-st ' + cls + '"><i>' + (cls === 'ok' ? '✓' : cls === 'now' ? '⏳' : '○') + '</i>' + t(k) + (extra ? '<em>' + extra + '</em>' : '') + '</div>'; };
    return '<div class="hco-modal-bg"><div class="hco-modal"><div class="hco-hd"><b>' + fmt('hco_i_t', esc(nameOf(ip))) + '</b></div><p class="hco-sub">' + t('hco_i_sub') + '</p>' +
      '<div class="hco-kv"><div>' + t('hco_i_model') + '<b>' + esc(m.model) + ' ✓</b></div><div>' + t('hco_i_cur') + '<b>' + (m.hcos ? 'HC OS ' + esc(m.hcos.hcos) : 'AxeOS ' + esc(m.version)) + '</b></div><div>' + t('hco_i_new') + '<b>HC OS ' + esc(r.version || '?') + ' · ' + t('hco_i_signed') + '</b></div><div>' + t('hco_i_set') + '<b>' + t('hco_i_set_v') + '</b></div></div>' +
      (j ? step(0, 'hco_s1') + step(1, 'hco_s2') + step(2, 'hco_s3', j.state === 'upload' ? j.progress + '%' : '') + step(3, 'hco_s4') + step(4, 'hco_s5', t('hco_s5_d')) +
           (['failed', 'rolled_back'].includes(j.state) ? '<div class="hco-warn">' + esc(j.step) + '</div>' : done ? '<div class="hco-info">✅ ' + esc(j.step) + '</div>' : '')
         : '<div class="hco-info">' + t('hco_i_back') + '</div><div class="hco-warn">⚠️ ' + t('hco_i_warn') + '</div>' +
           '<label class="hco-otp">' + t('hco_i_otp') + '<input id="hcoOtp" type="text" inputmode="numeric" maxlength="8" autocomplete="one-time-code"></label>' +
           '<label class="hco-chk"><input type="checkbox" id="hcoOk"> ' + t('hco_i_ok') + '</label>') +
      '<p class="hm-err" id="hcoErr" hidden></p>' +
      '<div class="hco-go end">' + (j ? '<button type="button" class="hm-btn" data-hco="mx">' + t('hco_close') + '</button>'
                                      : '<button type="button" class="hm-btn" data-hco="mx">' + t('hco_cancel') + '</button> <button type="button" class="hm-btn y" data-hco="go" disabled>' + t('hco_i_go') + '</button>') + '</div></div></div>';
  }
  function render(){
    const el = tab(); if(!el) return;
    const ms = (S.scan && S.scan.machines) || [];
    const keepOtp = (document.getElementById('hcoOtp') || {}).value, keepOk = (document.getElementById('hcoOk') || {}).checked;
    const keepScroll = (el.querySelector('.hco-tbl') || {}).scrollTop || 0;
    // só se mexe na própria caixa: o título da aba (.tab-hero, do abas.js) fica onde está
    let box = el.querySelector(':scope > .hco'); if(!box){ box = document.createElement('div'); box.className = 'hm hco'; el.appendChild(box); }
    box.innerHTML = '<div class="hco-top"><b>🧬 Hash Commander OS</b><span class="hco-pill pur">' + (rel().ok ? 'v' + esc(rel().version) + ' · ' : '') + t('hco_base') + '</span><a class="hco-pill blu" href="https://github.com/bladept696/hash-commander-os" target="_blank" rel="noopener">' + t('hco_open') + '</a></div>' +
      '<p class="hco-sub">' + t('hco_sub') + '</p>' +
      (S.err ? '<p class="hm-err">' + esc(S.err) + '</p>' : '') +
      (!S.scan ? '<div class="hco-mut">' + t('hco_scan') + '</div>' : !ms.length ? '<div class="hco-mut">' + t('hco_none') + '</div>' :
        '<div class="hco-row hd"><span>' + t('hco_c_m') + '</span><span>' + t('hco_c_fw') + '</span><span>' + t('hco_c_link') + '</span><span>' + t('hco_c_sh') + '</span><span></span></div>' + ms.map(rowHtml).join('') + footHtml()) +
      (S.sel ? '<div class="hco-cols">' + liveHtml() + logHtml() + '</div>' : '');
    // a janela de instalação fica no <body>: dentro da aba era cortada pelo contentor do painel
    let mr = document.getElementById('hcoModalRoot');
    if(!mr){ mr = document.createElement('div'); mr.id = 'hcoModalRoot'; document.body.appendChild(mr); }
    mr.innerHTML = active() ? modalHtml() : '';
    if(keepScroll && el.querySelector('.hco-tbl')) el.querySelector('.hco-tbl').scrollTop = keepScroll;
    if(keepOtp && document.getElementById('hcoOtp')) document.getElementById('hcoOtp').value = keepOtp;
    if(keepOk && document.getElementById('hcoOk')){ document.getElementById('hcoOk').checked = true; const g = mr.querySelector('[data-hco="go"]'); if(g) g.disabled = false; }
  }

  // ------------------------------------------------------------ dados
  async function scan(){
    try { S.scan = await api('/api/hcos/scan?ips=' + encodeURIComponent(ips().join(','))); S.err = ''; }
    catch(e) { S.err = e.message; }
    if(S.sel && !hcIps().includes(S.sel)) S.sel = null;
    render();
  }
  async function loadLog(){
    if(!S.sel) return;
    try { const r = await api('/api/hcos/shares?ip=' + encodeURIComponent(S.sel) + '&limit=500'); if(r.ok) S.log = { ip: S.sel, items: r.items || [], last: r.last || 0 }; } catch(e) {}
    render();
  }
  let timer = null, tick = 0;
  async function poll(){
    if(!active()){ timer = null; const mr = document.getElementById('hcoModalRoot'); if(mr) mr.innerHTML = ''; return; }
    try {
      const r = await api('/api/hcos/live?ips=' + encodeURIComponent(hcIps().join(',')));
      if(r.ok){
        const wasRunning = S.jobs.some(j => !['done', 'failed', 'rolled_back'].includes(j.state));
        S.live = r.live || {}; S.jobs = r.jobs || [];
        Object.entries(S.live).forEach(([ip, v]) => { if(v.state){ const h = S.hist[ip] = S.hist[ip] || []; if(!h.lastAt || h.lastAt !== v.state.up){ h.push(v.state.hashRate); h.lastAt = v.state.up; if(h.length > 120) h.shift(); } } });
        if(wasRunning && !S.jobs.some(j => !['done', 'failed', 'rolled_back'].includes(j.state))) scan();
      }
    } catch(e) {}
    if(++tick % 15 === 0 && S.sel) loadLog();
    // não redesenha por baixo de quem está a escrever o código OTP
    if(!(S.modal && document.activeElement && document.activeElement.id === 'hcoOtp')) render();
    timer = setTimeout(poll, 1000);
  }
  function startPoll(){ if(!timer) timer = setTimeout(poll, 300); }

  // ------------------------------------------------------------ ações
  document.addEventListener('click', async e => {
    const b = e.target.closest('#tab-hcos [data-hco], #hcoModalRoot [data-hco]'); if(!b) return;
    const k = b.dataset.hco, ip = b.dataset.ip;
    if(k === 'sel'){ S.sel = S.sel === ip ? null : ip; S.log = null; render(); loadLog(); }
    else if(k === 'flt'){ S.filter = b.dataset.f; render(); }
    else if(k === 'inst'){ S.modal = ip; S.jobs = S.jobs.filter(j => j.ip !== ip || !['done', 'failed', 'rolled_back'].includes(j.state)); render(); }
    else if(k === 'mx'){ S.modal = null; render(); }
    else if(k === 'go'){
      b.disabled = true;
      let r; try { r = await api('/api/hcos/install', { ips: [S.modal], otp: (document.getElementById('hcoOtp') || {}).value || '' }); } catch(err) { r = { ok: false, error: err.message }; }
      if(!r.ok){ const p = document.getElementById('hcoErr'); if(p){ p.textContent = r.error || '?'; p.hidden = false; } b.disabled = false; return; }
      startPoll();
    }
    else if(k === 'all'){
      const r = rel(), list = ((S.scan && S.scan.machines) || []).filter(m => m.hcos && newer(r.version, m.hcos.hcos)).map(m => m.ip);
      if(!list.length) return;
      b.disabled = true; try { await api('/api/hcos/install', { ips: list }); } catch(err) { S.err = err.message; } startPoll();
    }
    else if(k === 'back'){
      if(!confirm(fmt('hco_back_q', nameOf(ip)))) return;
      const otp = prompt(t('hco_i_otp')) || '';
      b.disabled = true;
      let r; try { r = await api('/api/hcos/rollback', { ip, otp }); } catch(err) { r = { ok: false, error: err.message }; }
      alert(r.ok ? t('hco_back_ok') : (r.error || '?'));
      setTimeout(scan, 60000);
    }
    else if(k === 'csv'){
      const L = S.log; if(!L) return;
      const st = s => ['pending', 'accepted', 'rejected', 'no answer'][s] || s;
      const csv = 'seq,time,uptime_s,difficulty,pool_difficulty,pool,asic,result\n' + L.items.map(x => [x[0], x[1] ? new Date(x[1] * 1000).toISOString() : '', x[2], x[3], x[4], x[5] ? 'fallback' : 'primary', x[6], st(x[7])].join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'shares-' + nameOf(L.ip).replace(/[^\w.-]+/g, '_') + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  });
  document.addEventListener('change', e => {
    if(e.target.id === 'hcoOk'){ const g = document.querySelector('#hcoModalRoot [data-hco="go"]'); if(g) g.disabled = !e.target.checked; }
  });

  const el = tab();
  if(el && window.MutationObserver){
    new MutationObserver(() => { if(active()){ if(!el.dataset.hcoInit){ el.dataset.hcoInit = '1'; render(); scan(); } else scan(); startPoll(); } })
      .observe(el, { attributes: true, attributeFilter: ['class'] });
  }
  window.hcOs = { render, scan };
})();
