// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Aba "Carteira" (hc_wallet.py): carteira Lightning própria, sem custódia ----------
// As 12 palavras ficam neste computador. Depositar com QR de qualquer carteira, levantar para um endereço Lightning,
// e o Mercado de hashrate paga e recebe a partir daqui.
Object.assign(I18N_DICT, {
  cw_t: { pt: `Carteira`, en: `Wallet`, es: `Cartera`, fr: `Portefeuille` },
  ab_wallet: { pt: `A tua carteira Lightning: deposita, levanta e aluga hashrate com o saldo. Só tu controlas as chaves.`, en: `Your Lightning wallet: deposit, withdraw and rent hashrate with your balance. Only you hold the keys.` },
  cw_sub: { pt: `Lightning · sem custódia: as chaves ficam neste computador`, en: `Lightning · non-custodial: the keys stay on this computer` },
  cw_nokey: { pt: `A carteira ainda não está disponível nesta instalação.`, en: `The wallet is not available in this installation yet.` },
  cw_new_t: { pt: `Cria a tua carteira`, en: `Create your wallet` },
  cw_new_d: { pt: `Uma carteira Lightning só tua, para depositar, alugar hashrate e receber as tuas vendas. Ninguém, nem a app, consegue mexer no teu saldo.`, en: `A Lightning wallet of your own, to deposit, rent hashrate and receive your sales. Nobody, not even the app, can touch your balance.` },
  cw_create: { pt: `Criar carteira`, en: `Create wallet` },
  cw_restore: { pt: `Recuperar com 12 palavras`, en: `Restore with 12 words` },
  cw_words_t: { pt: `As tuas 12 palavras`, en: `Your 12 words` },
  cw_words_w: { pt: `Escreve estas 12 palavras num papel e guarda-o. São a única forma de recuperar o saldo se perderes o computador. Ninguém, nem a app, as consegue recuperar por ti.`, en: `Write these 12 words on paper and keep it safe. They are the only way to recover your balance if you lose this computer. Nobody, not even the app, can recover them for you.` },
  cw_words_ok: { pt: `Já as guardei`, en: `I saved them` },
  cw_check_t: { pt: `Confirma as palavras`, en: `Confirm the words` },
  cw_check_d: { pt: `Escreve as 12 palavras pela ordem, separadas por espaços.`, en: `Type the 12 words in order, separated by spaces.` },
  cw_check_go: { pt: `Confirmar`, en: `Confirm` },
  cw_rest_go: { pt: `Recuperar carteira`, en: `Restore wallet` },
  cw_back: { pt: `Voltar`, en: `Back` },
  cw_need_backup: { pt: `Confirma as 12 palavras antes de usar a carteira.`, en: `Confirm the 12 words before using the wallet.` },
  cw_bal: { pt: `sats`, en: `sats` },
  cw_avail: { pt: `disponível para alugar`, en: `available for renting` },
  cw_dep: { pt: `Depositar`, en: `Deposit` },
  cw_wd: { pt: `Levantar`, en: `Withdraw` },
  cw_hist: { pt: `MOVIMENTOS`, en: `ACTIVITY` },
  cw_none: { pt: `Ainda sem movimentos. Deposita para começar.`, en: `No activity yet. Deposit to get started.` },
  cw_addr_t: { pt: `O teu endereço Lightning`, en: `Your Lightning address` },
  cw_addr_d: { pt: `Escolhe um nome: recebes em nome@breez.tips de qualquer carteira e é aí que recebes as vendas de hashrate.`, en: `Pick a name: you receive at name@breez.tips from any wallet, and that is where your hashrate sales arrive.` },
  cw_addr_go: { pt: `Criar endereço`, en: `Create address` },
  cw_dep_t: { pt: `Depositar`, en: `Deposit` },
  cw_dep_d: { pt: `Paga este QR com qualquer carteira Lightning (Wallet of Satoshi, Phoenix, Blink…).`, en: `Pay this QR with any Lightning wallet (Wallet of Satoshi, Phoenix, Blink…).` },
  cw_amount: { pt: `Valor (sats)`, en: `Amount (sats)` },
  cw_make: { pt: `Criar QR`, en: `Create QR` },
  cw_copy: { pt: `Copiar fatura`, en: `Copy invoice` },
  cw_copied: { pt: `Copiado ✓`, en: `Copied ✓` },
  cw_or_addr: { pt: `ou envia para`, en: `or send to` },
  cw_got: { pt: `✓ Recebido · o saldo já está disponível`, en: `✓ Received · balance available` },
  cw_wd_t: { pt: `Levantar`, en: `Withdraw` },
  cw_wd_d: { pt: `Envia o saldo para outra carteira, por exemplo nome@walletofsatoshi.com.`, en: `Send your balance to another wallet, e.g. name@walletofsatoshi.com.` },
  cw_to: { pt: `Para (endereço Lightning)`, en: `To (Lightning address)` },
  cw_all: { pt: `tudo`, en: `all` },
  cw_fee: { pt: `Taxa estimada: {0} sats`, en: `Estimated fee: {0} sats` },
  cw_send: { pt: `Enviar`, en: `Send` },
  cw_sent: { pt: `✓ Enviado {0} sats`, en: `✓ Sent {0} sats` },
  cw_show: { pt: `Ver as 12 palavras`, en: `Show the 12 words` },
  cw_show_q: { pt: `Mostrar as 12 palavras? Quem as vir consegue gastar o teu saldo.`, en: `Show the 12 words? Anyone who sees them can spend your balance.` },
  cw_remote: { pt: `Estás a ver o painel por acesso remoto: a carteira só se gere no próprio computador.`, en: `You are viewing the dashboard remotely: the wallet can only be managed on the computer itself.` },
  cw_in: { pt: `Recebido`, en: `Received` }, cw_out: { pt: `Enviado`, en: `Sent` },
});

(function(){
  const S = { st: null, pay: [], view: 'home', words: '', inv: null, invSats: 0, msg: '', err: '', busy: false, fee: null };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (k, ...a) => a.reduce((s, v, i) => s.split('{' + i + '}').join(v), t(k));
  const loc = () => ({ pt: 'pt-PT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR' }[typeof currentLang !== 'undefined' ? currentLang : 'pt'] || 'pt-PT');
  const num = v => Number(v || 0).toLocaleString(loc());
  const tab = () => document.getElementById('tab-wallet');
  const active = () => { const el = tab(); return el && el.classList.contains('active'); };
  async function api(path, body){
    const r = await fetch(API_BASE + path, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    try { return await r.json(); } catch(e) { return { ok: false, error: 'resposta inválida do servidor' }; }
  }
  let qrLoading = null;
  function loadQr(){
    if(window.qrcode) return Promise.resolve();
    if(qrLoading) return qrLoading;
    qrLoading = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'; s.onload = ok; s.onerror = () => { qrLoading = null; no(); }; document.head.appendChild(s); });
    return qrLoading;
  }
  async function drawQr(){
    const box = document.getElementById('cwQr'); if(!box || !S.inv) return;
    try { await loadQr(); const q = window.qrcode(0, 'M'); q.addData(S.inv.toUpperCase()); q.make(); box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch(e) {}
  }

  async function load(){
    S.st = await api('/api/wallet/status');
    if(S.st && S.st.exists && S.st.backed_up){
      const p = await api('/api/wallet/payments?limit=30');
      S.pay = p.ok ? p.payments : [];
    }
    render();
  }

  function hist(){
    if(!S.pay.length) return '<p class="cw-mut">' + t('cw_none') + '</p>';
    return S.pay.map(p => '<div class="cw-row"><span>' + esc(p.desc || t(p.in ? 'cw_in' : 'cw_out')) + '<small>' + new Date(p.at * 1000).toLocaleString(loc()) + (p.status !== 'completed' ? ' · ' + esc(p.status) : '') + '</small></span><b class="' + (p.in ? 'in' : 'out') + '">' + (p.in ? '+' : '−') + num(p.sats) + '</b></div>').join('');
  }

  function body(){
    const st = S.st || {};
    if(!st.available) return '<p class="cw-mut">' + t('cw_nokey') + '</p>';
    if(st.local === false) return '<p class="cw-warn">' + t('cw_remote') + '</p>';
    if(S.view === 'words') return '<div class="cw-card"><b>' + t('cw_words_t') + '</b><div class="cw-words">' + S.words.split(' ').map((w, i) => '<span><i>' + (i + 1) + '</i>' + esc(w) + '</span>').join('') + '</div><p class="cw-warn">⚠️ ' + t('cw_words_w') + '</p><button class="hm-btn y" data-cw="towcheck">' + t('cw_words_ok') + '</button></div>';
    if(S.view === 'check' || (st.exists && !st.backed_up && S.view !== 'words')) return '<div class="cw-card"><b>' + t('cw_check_t') + '</b><p class="cw-mut">' + (st.exists && S.view !== 'check' ? t('cw_need_backup') + ' ' : '') + t('cw_check_d') + '</p><textarea id="cwWords" rows="3" spellcheck="false" autocomplete="off"></textarea><div class="cw-go"><button class="hm-btn y" data-cw="check">' + t('cw_check_go') + '</button>' + (st.exists ? ' <button class="hm-btn" data-cw="reveal">' + t('cw_show') + '</button>' : '') + '</div></div>';
    if(S.view === 'restore') return '<div class="cw-card"><b>' + t('cw_restore') + '</b><p class="cw-mut">' + t('cw_check_d') + '</p><textarea id="cwWords" rows="3" spellcheck="false" autocomplete="off"></textarea><div class="cw-go"><button class="hm-btn y" data-cw="dorestore">' + t('cw_rest_go') + '</button> <button class="hm-btn" data-cw="home">' + t('cw_back') + '</button></div></div>';
    if(!st.exists) return '<div class="cw-card"><b>' + t('cw_new_t') + '</b><p class="cw-mut">' + t('cw_new_d') + '</p><div class="cw-go"><button class="hm-btn y" data-cw="create">' + t('cw_create') + '</button> <button class="hm-btn" data-cw="restore">' + t('cw_restore') + '</button></div></div>';
    if(S.view === 'dep') return '<div class="cw-card"><b>' + t('cw_dep_t') + '</b><p class="cw-mut">' + t('cw_dep_d') + '</p>' +
      (S.inv ? '<div class="cw-qr" id="cwQr"></div><div class="cw-go c"><b>' + num(S.invSats) + ' sats</b> <button class="hm-btn" data-cw="copy">' + t('cw_copy') + '</button></div>'
             : '<label class="cw-lb">' + t('cw_amount') + '<input id="cwAmt" type="number" min="1" step="1" value="10000"></label><div class="cw-go"><button class="hm-btn y" data-cw="mkinv">' + t('cw_make') + '</button></div>') +
      (st.address ? '<p class="cw-mut c">' + t('cw_or_addr') + ' <b class="cw-addr">' + esc(st.address) + '</b></p>' : '') +
      '<div class="cw-go"><button class="hm-btn" data-cw="home">' + t('cw_back') + '</button></div></div>';
    if(S.view === 'wd') return '<div class="cw-card"><b>' + t('cw_wd_t') + '</b><p class="cw-mut">' + t('cw_wd_d') + '</p><label class="cw-lb">' + t('cw_to') + '<input id="cwTo" type="text" placeholder="nome@walletofsatoshi.com" autocomplete="off" spellcheck="false"></label>' +
      '<label class="cw-lb">' + t('cw_amount') + ' · <a href="#" data-cw="all">' + t('cw_all') + '</a><input id="cwWAmt" type="number" min="1" step="1"></label>' + (S.fee != null ? '<p class="cw-mut">' + fmt('cw_fee', num(S.fee)) + '</p>' : '') +
      '<div class="cw-go"><button class="hm-btn y" data-cw="send">' + t('cw_send') + '</button> <button class="hm-btn" data-cw="home">' + t('cw_back') + '</button></div></div>';
    return '<div class="cw-card"><div class="cw-bal">' + (st.balance == null ? '…' : num(st.balance)) + ' <small>' + t('cw_bal') + '</small></div><p class="cw-mut">' + t('cw_avail') + '</p>' +
      (st.address ? '<div class="cw-addr">' + esc(st.address) + '</div>' : '<div class="cw-sub"><b>' + t('cw_addr_t') + '</b><p class="cw-mut">' + t('cw_addr_d') + '</p><div class="cw-go"><input id="cwUser" type="text" placeholder="nome" autocomplete="off" spellcheck="false"><span class="cw-mut">@breez.tips</span> <button class="hm-btn" data-cw="addr">' + t('cw_addr_go') + '</button></div></div>') +
      '<div class="cw-go"><button class="hm-btn y" data-cw="dep">' + t('cw_dep') + '</button> <button class="hm-btn" data-cw="wd">' + t('cw_wd') + '</button> <button class="hm-btn" data-cw="reveal">' + t('cw_show') + '</button></div>' +
      (st.error ? '<p class="hm-err">' + esc(st.error) + '</p>' : '') +
      '<div class="cw-h">' + t('cw_hist') + '</div>' + hist() + '</div>';
  }

  function render(){
    const el = tab(); if(!el) return;
    let box = el.querySelector(':scope > .cw'); if(!box){ box = document.createElement('div'); box.className = 'hm cw'; el.appendChild(box); }
    const keep = { words: (document.getElementById('cwWords') || {}).value, to: (document.getElementById('cwTo') || {}).value, amt: (document.getElementById('cwWAmt') || {}).value };
    box.innerHTML = '<div class="cw-top"><b>⚡ ' + t('cw_t') + '</b><span class="cw-mut">' + t('cw_sub') + '</span></div>' +
      (S.msg ? '<p class="cw-ok">' + esc(S.msg) + '</p>' : '') + (S.err ? '<p class="hm-err">' + esc(S.err) + '</p>' : '') + body();
    if(keep.words && document.getElementById('cwWords')) document.getElementById('cwWords').value = keep.words;
    if(keep.to && document.getElementById('cwTo')) document.getElementById('cwTo').value = keep.to;
    if(keep.amt && document.getElementById('cwWAmt')) document.getElementById('cwWAmt').value = keep.amt;
    drawQr();
  }

  async function act(k, b){
    S.err = ''; S.msg = '';
    const v = id => (document.getElementById(id) || {}).value || '';
    let r;
    if(k === 'home'){ S.view = 'home'; S.inv = null; S.fee = null; return load(); }
    if(k === 'create'){ r = await api('/api/wallet/create', {}); if(r.ok){ S.words = r.words; S.view = 'words'; } }
    else if(k === 'towcheck'){ S.view = 'check'; S.words = ''; }
    else if(k === 'check'){ r = await api('/api/wallet/confirm', { words: v('cwWords') }); if(r.ok){ S.view = 'home'; return load(); } }
    else if(k === 'restore'){ S.view = 'restore'; }
    else if(k === 'dorestore'){ r = await api('/api/wallet/restore', { words: v('cwWords') }); if(r.ok){ S.view = 'home'; return load(); } }
    else if(k === 'reveal'){ if(!confirm(t('cw_show_q'))) return; r = await api('/api/wallet/words', {}); if(r.ok){ S.words = r.words; S.view = 'words'; } }
    else if(k === 'dep'){ S.view = 'dep'; S.inv = null; }
    else if(k === 'mkinv'){ const n = parseInt(v('cwAmt'), 10); r = await api('/api/wallet/receive', { sats: n }); if(r.ok){ S.inv = r.invoice; S.invSats = n; S.base = (S.st && S.st.balance) || 0; watchDeposit(); } }
    else if(k === 'copy'){ try { await navigator.clipboard.writeText(S.inv); b.textContent = t('cw_copied'); } catch(e) {} return; }
    else if(k === 'wd'){ S.view = 'wd'; S.fee = null; }
    else if(k === 'all'){ const i = document.getElementById('cwWAmt'); if(i) i.value = Math.max(0, ((S.st && S.st.balance) || 0) - 10); estimate(); return; }
    else if(k === 'send'){ const n = parseInt(v('cwWAmt'), 10); r = await api('/api/wallet/send', { to: v('cwTo').trim(), sats: n }); if(r.ok){ S.msg = fmt('cw_sent', num(r.sats)); S.view = 'home'; return load(); } }
    else if(k === 'addr'){ r = await api('/api/wallet/address', { username: v('cwUser').trim() }); if(r.ok) return load(); }
    if(r && !r.ok) S.err = r.error || '?';
    render();
  }

  // depósito: o saldo sobe quando o QR é pago
  let depTimer = null;
  function watchDeposit(){
    clearInterval(depTimer);
    depTimer = setInterval(async () => {
      if(!active() || S.view !== 'dep' || !S.inv){ clearInterval(depTimer); return; }
      const st = await api('/api/wallet/status');
      if(st && st.balance != null && st.balance > S.base){ clearInterval(depTimer); S.st = st; S.msg = t('cw_got'); S.view = 'home'; S.inv = null; load(); }
    }, 4000);
  }
  let feeT = null;
  function estimate(){
    clearTimeout(feeT);
    feeT = setTimeout(async () => {
      const to = ((document.getElementById('cwTo') || {}).value || '').trim(), n = parseInt((document.getElementById('cwWAmt') || {}).value, 10);
      if(!to || !(n > 0)) return;
      const r = await api('/api/wallet/fee', { to, sats: n }); S.fee = r.ok ? r.fee : null; render();
    }, 700);
  }

  document.addEventListener('click', e => { const b = e.target.closest('#tab-wallet [data-cw]'); if(!b) return; e.preventDefault(); if(S.busy) return; S.busy = true; act(b.dataset.cw, b).finally(() => { S.busy = false; }); });
  document.addEventListener('input', e => { if(e.target.closest('#tab-wallet') && (e.target.id === 'cwTo' || e.target.id === 'cwWAmt')) estimate(); });

  const el = tab();
  if(el && window.MutationObserver){
    new MutationObserver(() => { if(active()) load(); }).observe(el, { attributes: true, attributeFilter: ['class'] });
  }
  setInterval(() => { if(active() && S.view === 'home') load(); }, 30000);
})();
