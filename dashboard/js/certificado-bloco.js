// ---------- Certificado de bloco ----------
// Quando uma máquina (ou a pool) acusa um bloco encontrado, o painel guarda logo as provas locais (hora, máquina, share, endereço de
// recompensa) e pede ao servidor para as assinar com a chave Ed25519 DESTA instalação. Depois vai à blockchain (mempool.space) buscar
// a transação coinbase que paga a esse endereço, junta o cabeçalho do bloco e volta a assinar: o certificado final.
// A prova de que o bloco existe é a blockchain (altura, hash e transação confirmam-se em qualquer explorador); a assinatura garante que
// o certificado não foi alterado depois de criado. O ficheiro verificar_certificado.py confirma tudo sem precisar da app.
(function(){
  const KEY = 'hc_blockcerts', LANGS = ['pt', 'en', 'es', 'fr'], MEMPOOL = 'https://mempool.space/api';
  const TX = {
    menu: ['Certificados de bloco', 'Block certificates', 'Certificados de bloque', 'Certificats de bloc'],
    intro: ['Quando encontras um bloco, o painel guarda as provas e assina-as com a chave desta instalação. Depois confirma na blockchain a transação de recompensa e o cabeçalho do bloco. Fica um documento que podes guardar ou partilhar.',
      'When you find a block, the panel keeps the evidence and signs it with this installation’s key. It then confirms the reward transaction and the block header on the blockchain. You get a document you can keep or share.',
      'Cuando encuentras un bloque, el panel guarda las pruebas y las firma con la clave de esta instalación. Después confirma en la blockchain la transacción de recompensa y la cabecera del bloque. Queda un documento que puedes guardar o compartir.',
      'Quand vous trouvez un bloc, le tableau de bord conserve les preuves et les signe avec la clé de cette installation. Il confirme ensuite sur la blockchain la transaction de récompense et l’en-tête du bloc. Vous obtenez un document à conserver ou partager.'],
    trust: ['A prova de que o bloco existe é a blockchain (confirma a altura, o hash e a transação num explorador). A assinatura prova que este certificado não foi alterado desde que foi criado.',
      'The proof that the block exists is the blockchain (check height, hash and transaction on an explorer). The signature proves this certificate has not been altered since it was created.',
      'La prueba de que el bloque existe es la blockchain (comprueba altura, hash y transacción en un explorador). La firma prueba que este certificado no se alteró desde su creación.',
      'La preuve que le bloc existe, c’est la blockchain (vérifiez hauteur, hash et transaction sur un explorateur). La signature prouve que ce certificat n’a pas été modifié depuis sa création.'],
    test: ['Gerar certificado de teste', 'Create test certificate', 'Generar certificado de prueba', 'Créer un certificat de test'],
    none: ['Ainda não há certificados. Quando um bloco for encontrado, aparece aqui.', 'No certificates yet. When a block is found it shows up here.', 'Aún no hay certificados. Cuando se encuentre un bloque aparecerá aquí.', 'Pas encore de certificats. Quand un bloc sera trouvé, il apparaîtra ici.'],
    sConf: ['Confirmado na blockchain', 'Confirmed on the blockchain', 'Confirmado en la blockchain', 'Confirmé sur la blockchain'],
    sPend: ['A aguardar o bloco na blockchain', 'Waiting for the block on the blockchain', 'Esperando el bloque en la blockchain', 'En attente du bloc sur la blockchain'],
    sTest: ['Teste (não é um bloco real)', 'Test (not a real block)', 'Prueba (no es un bloque real)', 'Test (pas un vrai bloc)'],
    sOut: ['Não encontrado na blockchain em 48 h', 'Not found on the blockchain within 48 h', 'No encontrado en la blockchain en 48 h', 'Introuvable sur la blockchain en 48 h'],
    sBad: ['Cabeçalho não confere, não confiar', 'Header does not match, do not trust', 'La cabecera no coincide, no confiar', 'L’en-tête ne correspond pas, ne pas se fier'],
    unsigned: ['sem assinatura (só o PC onde corre a app assina)', 'unsigned (only the PC running the app can sign)', 'sin firma (solo el PC donde corre la app firma)', 'non signé (seul le PC qui exécute l’app signe)'],
    block: ['Bloco', 'Block', 'Bloque', 'Bloc'], found: ['Bloco encontrado', 'Block found', 'Bloque encontrado', 'Bloc trouvé'],
    machine: ['Máquina', 'Machine', 'Máquina', 'Machine'], when: ['Detetado em', 'Detected at', 'Detectado el', 'Détecté le'],
    reward: ['Recompensa', 'Reward', 'Recompensa', 'Récompense'], share: ['Dificuldade do share vencedor', 'Winning share difficulty', 'Dificultad del share ganador', 'Difficulté du share gagnant'],
    addr: ['Endereço de pagamento', 'Payout address', 'Dirección de pago', 'Adresse de paiement'], bh: ['Hash do bloco', 'Block hash', 'Hash del bloque', 'Hash du bloc'],
    ctx: ['Transação coinbase', 'Coinbase transaction', 'Transacción coinbase', 'Transaction coinbase'],
    dl: ['Descarregar (.json)', 'Download (.json)', 'Descargar (.json)', 'Télécharger (.json)'], pr: ['Versão para imprimir', 'Printable version', 'Versión para imprimir', 'Version imprimable'],
    ver: ['Verificar', 'Verify', 'Verificar', 'Vérifier'], del: ['Apagar', 'Delete', 'Borrar', 'Supprimer'], close: ['Fechar', 'Close', 'Cerrar', 'Fermer'],
    vOk: ['✔ assinatura válida', '✔ valid signature', '✔ firma válida', '✔ signature valide'], vBad: ['✖ assinatura INVÁLIDA', '✖ INVALID signature', '✖ firma INVÁLIDA', '✖ signature INVALIDE'],
    vHdr: ['cabeçalho confere com o hash do bloco', 'header matches the block hash', 'la cabecera coincide con el hash del bloque', 'l’en-tête correspond au hash du bloc'],
    vHdrBad: ['✖ cabeçalho NÃO confere', '✖ header does NOT match', '✖ la cabecera NO coincide', '✖ l’en-tête ne correspond PAS'],
    vMine: ['assinado por esta instalação', 'signed by this installation', 'firmado por esta instalación', 'signé par cette installation'],
    vOther: ['assinado por outra instalação', 'signed by another installation', 'firmado por otra instalación', 'signé par une autre installation'],
    vErr: ['Não foi possível verificar (servidor indisponível).', 'Could not verify (server unavailable).', 'No se pudo verificar (servidor no disponible).', 'Vérification impossible (serveur indisponible).'],
    how: ['Como verificar fora da app', 'How to verify outside the app', 'Cómo verificar fuera de la app', 'Comment vérifier hors de l’app'],
    howTx: ['1) Abre o hash do bloco e a transação coinbase num explorador (mempool.space). 2) Corre «python verificar_certificado.py ficheiro.json» para confirmar a assinatura e o hash do cabeçalho.',
      '1) Open the block hash and the coinbase transaction on an explorer (mempool.space). 2) Run “python verificar_certificado.py file.json” to confirm the signature and the header hash.',
      '1) Abre el hash del bloque y la transacción coinbase en un explorador (mempool.space). 2) Ejecuta «python verificar_certificado.py archivo.json» para confirmar la firma y el hash de la cabecera.',
      '1) Ouvrez le hash du bloc et la transaction coinbase sur un explorateur (mempool.space). 2) Lancez « python verificar_certificado.py fichier.json » pour confirmer la signature et le hash de l’en-tête.'],
    key: ['Chave pública', 'Public key', 'Clave pública', 'Clé publique'],
    toastNew: ['📜 Provas do bloco guardadas e assinadas', '📜 Block evidence saved and signed', '📜 Pruebas del bloque guardadas y firmadas', '📜 Preuves du bloc enregistrées et signées'],
    toastNewU: ['📜 Provas do bloco guardadas (sem assinatura)', '📜 Block evidence saved (unsigned)', '📜 Pruebas del bloque guardadas (sin firma)', '📜 Preuves du bloc enregistrées (non signées)'],
    toastConf: ['🏆 Bloco #{0} confirmado na blockchain: certificado final pronto', '🏆 Block #{0} confirmed on the blockchain: final certificate ready', '🏆 Bloque #{0} confirmado en la blockchain: certificado final listo', '🏆 Bloc #{0} confirmé sur la blockchain : certificat final prêt'],
    delQ: ['Apagar este certificado do painel? O ficheiro que descarregaste não é afetado.', 'Delete this certificate from the panel? Files you downloaded are not affected.', '¿Borrar este certificado del panel? Los archivos descargados no se ven afectados.', 'Supprimer ce certificat du tableau de bord ? Les fichiers téléchargés ne sont pas affectés.']
  };
  const lang = () => { try { const l = typeof currentLang !== 'undefined' ? currentLang : 'pt'; return LANGS.includes(l) ? l : 'pt'; } catch(e) { return 'pt'; } };
  const li = () => LANGS.indexOf(lang());
  const t = (k, ...a) => { let s = TX[k][li()]; a.forEach((v, i) => { s = s.split('{' + i + '}').join(v); }); return s; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const api = p => (typeof API_BASE !== 'undefined' ? API_BASE : '') + p;
  const ADDR = /^(bc1[a-z0-9]{20,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/;
  const dt = ms => new Date(ms).toLocaleString(lang() === 'pt' ? 'pt-PT' : lang());

  let R = [];
  try { R = JSON.parse(localStorage.getItem(KEY) || '[]'); if(!Array.isArray(R)) R = []; } catch(e) { R = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(R.slice(0, 50))); } catch(e) {} };
  const cert = r => r.final || r.provisional || null;
  const pay = r => (r.final && r.final.payload) || r.payload;

  function toast(text){
    try {
      let box = document.getElementById('hcBcToasts');
      if(!box){ box = document.createElement('div'); box.id = 'hcBcToasts'; document.body.appendChild(box); }
      const el = document.createElement('div'); el.className = 'hc-bc-toast'; el.textContent = text; box.appendChild(el);
      setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 7000);
    } catch(e) {}
  }
  async function jget(url){
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 15000);
    try { const r = await fetch(url, { signal: ac.signal }); if(!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(to); }
  }
  async function signPayload(payload){
    try {
      const r = await fetch(api('/api/cert/sign'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload }) });
      const j = await r.json(); return r.ok && j.ok ? j.certificate : null;
    } catch(e) { return null; }
  }

  // ---- recolher as provas ----
  function gather(machineName, extra, test){
    let devs = [], rd = {}; try { devs = typeof devices !== 'undefined' ? devices : []; rd = typeof readings !== 'undefined' ? readings : {}; } catch(e) {}
    const dev = devs.find(d => d.name === machineName), r = dev ? rd[dev.id] : null, now = Date.now();
    const pi = r && r.poolInfo, p = pi ? ((pi.usingFallback && pi.fallback) || pi.primary) : null;
    const user = p && p.user ? String(p.user).split('.')[0].trim() : '';
    const n = v => (Number.isFinite(Number(v)) ? Number(v) : null);
    return {
      kind: 'hash-commander-block-certificate', schema: 1, test: !!test, detected_at: new Date(now).toISOString(), detected_ts: now,
      machine: { name: machineName || null, model: r ? (r.model || r.deviceModel || null) : null, firmware: r && r.firmware !== '—' ? r.firmware : null, hashrate_ghs: r ? n(r.hashrate) : null,
        power_w: r ? n(r.power) : null, frequency_mhz: r ? n(r.frequency) : null, temp_c: r ? n(r.temp) : null, uptime_s: r ? n(r.uptime) : null, blocks_found_counter: r ? n(r.blocksFound) : null },
      share: { winning_share_difficulty: extra && extra.diff != null ? n(extra.diff) : (r ? n(r.best) : null), best_difficulty_all_time: r ? n(r.bestAll) : null, pool_difficulty: r ? n(r.poolDifficulty) : null },
      payout: { address: ADDR.test(user) ? user : null, pool: p ? { url: p.url || null, port: p.port || null } : null },
      chain: null
    };
  }
  async function capture(machineName, extra, isTest){
    const now = Date.now();
    if(!isTest && R.some(x => !x.test && now - x.ts < 30 * 60e3)) return;   // o mesmo bloco pode vir da máquina e da pool
    const payload = gather(machineName, extra, isTest);
    const rec = { id: 'bc_' + now.toString(36), ts: now, test: !!isTest, state: isTest ? 'test' : 'pending', payload, provisional: null, final: null, last: 0 };
    R.unshift(rec); save();
    rec.provisional = await signPayload(payload); save();
    toast(rec.provisional ? t('toastNew') : t('toastNewU'));
    if(!isTest) setTimeout(() => confirm(rec), 20000);
  }

  // ---- confirmar na blockchain ----
  async function confirm(rec){
    if(rec.state !== 'pending') return;
    if(Date.now() - rec.ts > 48 * 3600e3){ rec.state = 'timeout'; save(); return; }
    const addr = rec.payload.payout && rec.payload.payout.address; if(!addr){ return; }
    rec.last = Date.now();
    try {
      const txs = await jget(MEMPOOL + '/address/' + addr + '/txs');
      const hit = (txs || []).filter(x => x.vin && x.vin[0] && x.vin[0].is_coinbase && x.status && x.status.confirmed && x.status.block_time >= rec.ts / 1000 - 3600)
        .sort((a, b) => a.status.block_time - b.status.block_time)[0];
      if(!hit) return;
      const [blk, tipTxt] = await Promise.all([jget(MEMPOOL + '/block/' + hit.status.block_hash), fetch(MEMPOOL + '/blocks/tip/height').then(r => r.text())]);
      const tip = parseInt(tipTxt, 10) || hit.status.block_height;
      const chain = {
        network: 'mainnet', height: hit.status.block_height, block_hash: blk.id, block_time: blk.timestamp, difficulty: blk.difficulty,
        coinbase_txid: hit.txid, reward_sats: hit.vout.filter(o => o.scriptpubkey_address === addr).reduce((s, o) => s + o.value, 0),
        confirmations_when_signed: Math.max(1, tip - hit.status.block_height + 1),
        header: { version: blk.version, previousblockhash: blk.previousblockhash, merkle_root: blk.merkle_root, timestamp: blk.timestamp, bits: blk.bits, nonce: blk.nonce },
        explorer: { block: 'https://mempool.space/block/' + blk.id, tx: 'https://mempool.space/tx/' + hit.txid }
      };
      const payload = Object.assign({}, rec.payload, { chain, confirmed_at: new Date().toISOString(), provisional_sha256: rec.provisional ? rec.provisional.sha256 : null });
      const signed = await signPayload(payload);
      if(signed){
        const v = await verifyCert(signed);
        if(v && v.header_ok === false){ rec.state = 'bad'; rec.final = signed; save(); return; }
        rec.final = signed;
      }
      rec.payload = payload; rec.state = 'confirmed'; save();
      toast(t('toastConf', chain.height));
      if(document.getElementById('hcBcBody')) render();
    } catch(e) { /* tenta outra vez mais tarde */ }
  }
  setInterval(() => { R.filter(x => x.state === 'pending' && Date.now() - x.last > 110e3).forEach(confirm); }, 60000);
  setTimeout(() => R.filter(x => x.state === 'pending').forEach(confirm), 25000);

  async function verifyCert(c){
    try {
      const r = await fetch(api('/api/cert/verify'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ certificate: c }) });
      const j = await r.json(); return r.ok && j.ok ? j : null;
    } catch(e) { return null; }
  }

  // ---- exportar ----
  function exportObj(rec){ return cert(rec) || { v: 1, unsigned: true, payload: pay(rec) }; }
  function fileName(rec){ const ch = pay(rec).chain; return 'certificado-bloco-' + (ch ? ch.height : new Date(rec.ts).toISOString().slice(0, 10)) + (rec.test ? '-teste' : '') + '.json'; }
  function download(rec){
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(exportObj(rec), null, 2)], { type: 'application/json' }));
    a.download = fileName(rec); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function printable(rec){
    const p = pay(rec), c = cert(rec), ch = p.chain || {}, line = (k, v) => v == null || v === '' ? '' : '<tr><th>' + esc(k) + '</th><td>' + v + '</td></tr>';
    const sats = ch.reward_sats != null ? (ch.reward_sats / 1e8).toFixed(8) + ' BTC' : null;
    const html = '<!doctype html><meta charset="utf-8"><title>' + esc(t('menu')) + '</title><style>body{font:14px system-ui,Segoe UI,sans-serif;max-width:760px;margin:30px auto;padding:0 20px;color:#111}h1{font-size:24px;margin:0 0 4px}.sub{color:#555;margin-bottom:18px}table{border-collapse:collapse;width:100%}th{width:34%;text-align:left;vertical-align:top;color:#555;padding:7px 10px 7px 0;font-weight:600}td{padding:7px 0;word-break:break-all;font-family:Consolas,monospace;font-size:12.5px}tr{border-bottom:1px solid #ddd}.t{display:inline-block;background:#fde68a;border-radius:6px;padding:3px 9px;font-weight:700;margin-bottom:12px}.n{margin-top:20px;font-size:12px;color:#555}@media print{button{display:none}}</style>' +
      '<button onclick="print()">🖨 Imprimir</button><h1>📜 ' + esc(rec.test ? t('sTest') : t('found')) + '</h1><div class="sub">Hash Commander · ' + esc(dt(rec.ts)) + '</div>' + (rec.test ? '<div class="t">' + esc(t('sTest')) + '</div>' : '') +
      '<table>' + line(t('machine'), esc(p.machine && p.machine.name)) + line(t('when'), esc(p.detected_at)) + line(t('share'), p.share && p.share.winning_share_difficulty != null ? esc(Number(p.share.winning_share_difficulty).toExponential(3)) : null) +
      line(t('block'), ch.height != null ? '#' + esc(ch.height) : null) + line(t('bh'), esc(ch.block_hash)) + line(t('ctx'), esc(ch.coinbase_txid)) + line(t('reward'), esc(sats)) + line(t('addr'), esc(p.payout && p.payout.address)) +
      line(t('key'), c ? esc(c.public_key) : null) + line('SHA-256', c ? esc(c.sha256) : null) + line('Ed25519', c ? esc(c.signature) : esc(t('unsigned'))) + '</table>' +
      '<p class="n">' + esc(t('trust')) + '<br>' + esc(t('howTx')) + (ch.explorer ? '<br>' + esc(ch.explorer.tx) : '') + '</p>';
    const w = window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank'); if(!w) toast('⚠ pop-up bloqueado');
  }

  // ---- janela ----
  const LBL = { confirmed: 'sConf', pending: 'sPend', test: 'sTest', timeout: 'sOut', bad: 'sBad' };
  function card(rec){
    const p = pay(rec), ch = p.chain, c = cert(rec), cls = rec.state;
    const row = (k, v, mono) => v == null || v === '' ? '' : '<div class="hc-bc-r"><span>' + esc(k) + '</span><b' + (mono ? ' class="m"' : '') + '>' + v + '</b></div>';
    const link = (u, txt) => '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(txt) + '</a>';
    return '<div class="hc-bc-card ' + cls + '" data-id="' + esc(rec.id) + '"><div class="hc-bc-h"><b>' + (ch ? '🏆 ' + t('block') + ' #' + esc(ch.height) : '📜 ' + esc(t('found'))) + '</b><span class="hc-bc-chip ' + cls + '">' + esc(t(LBL[cls] || 'sPend')) + '</span></div>' +
      row(t('when'), esc(dt(rec.ts))) + row(t('machine'), esc(p.machine && p.machine.name)) +
      row(t('share'), p.share && p.share.winning_share_difficulty != null ? esc(Number(p.share.winning_share_difficulty).toExponential(3)) : null) +
      row(t('reward'), ch && ch.reward_sats != null ? esc((ch.reward_sats / 1e8).toFixed(8)) + ' BTC' : null) +
      row(t('addr'), esc(p.payout && p.payout.address), true) +
      (ch ? row(t('bh'), link(ch.explorer.block, ch.block_hash), true) + row(t('ctx'), link(ch.explorer.tx, ch.coinbase_txid), true) : '') +
      (c ? '' : '<div class="hc-bc-warn">' + esc(t('unsigned')) + '</div>') +
      '<div class="hc-bc-vr" data-vr></div><div class="hc-bc-act"><button data-a="dl">' + esc(t('dl')) + '</button><button data-a="pr">' + esc(t('pr')) + '</button>' + (c ? '<button data-a="vf">' + esc(t('ver')) + '</button>' : '') + '<button data-a="rm" class="del">' + esc(t('del')) + '</button></div></div>';
  }
  function render(){
    const b = document.getElementById('hcBcBody'); if(!b) return;
    const keep = {}; b.querySelectorAll('[data-vr]').forEach(n => { if(n.textContent) keep[n.closest('.hc-bc-card').dataset.id] = n.innerHTML; });
    const pub = R.map(cert).find(Boolean);
    b.innerHTML = '<p class="hc-bc-intro">' + esc(t('intro')) + '</p><p class="hc-bc-trust">🔎 ' + esc(t('trust')) + '</p>' +
      '<div class="hc-bc-top"><button data-a="test">🧪 ' + esc(t('test')) + '</button></div>' +
      (R.length ? R.map(card).join('') : '<p class="hc-bc-none">' + esc(t('none')) + '</p>') +
      '<details class="hc-bc-how"><summary>' + esc(t('how')) + '</summary><p>' + esc(t('howTx')) + '</p>' + (pub ? '<p>' + esc(t('key')) + ': <code>' + esc(pub.public_key) + '</code></p>' : '') + '</details>';
    Object.keys(keep).forEach(id => { const n = b.querySelector('[data-id="' + id + '"] [data-vr]'); if(n) n.innerHTML = keep[id]; });
  }
  async function doVerify(rec, box){
    box.textContent = '…'; const v = await verifyCert(cert(rec));
    if(!v){ box.innerHTML = '<span class="bad">' + esc(t('vErr')) + '</span>'; return; }
    const parts = [v.signature_valid ? '<span class="ok">' + esc(t('vOk')) + '</span>' : '<span class="bad">' + esc(t('vBad')) + '</span>'];
    if(v.header_ok === true) parts.push('<span class="ok">✔ ' + esc(t('vHdr')) + '</span>'); else if(v.header_ok === false) parts.push('<span class="bad">' + esc(t('vHdrBad')) + '</span>');
    parts.push('<span>' + esc(t(v.signer_is_this_install ? 'vMine' : 'vOther')) + '</span>');
    box.innerHTML = parts.join(' · ');
  }
  function close(){ const n = document.getElementById('hcBcModal'); if(n) n.remove(); }
  window.hcCertOpen = function(){
    close();
    const ov = document.createElement('div');
    ov.id = 'hcBcModal'; ov.className = 'hc-bc-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="hc-bc-box"><h2>📜 ' + esc(t('menu')) + '</h2><div id="hcBcBody"></div><div class="hc-bc-foot"><button class="hc-bc-close" data-a="x">' + esc(t('close')) + '</button></div></div>';
    document.body.appendChild(ov); render();
    ov.addEventListener('click', e => {
      if(e.target === ov) return close();
      const btn = e.target.closest('[data-a]'); if(!btn) return;
      const a = btn.dataset.a, cardEl = btn.closest('.hc-bc-card'), rec = cardEl ? R.find(x => x.id === cardEl.dataset.id) : null;
      if(a === 'x') close();
      else if(a === 'test') capture('Teste', { diff: 1.2e14 }, true).then(render);
      else if(a === 'dl' && rec) download(rec);
      else if(a === 'pr' && rec) printable(rec);
      else if(a === 'vf' && rec) doVerify(rec, cardEl.querySelector('[data-vr]'));
      else if(a === 'rm' && rec && window.confirm(t('delQ'))){ R = R.filter(x => x !== rec); save(); render(); }
    });
    document.addEventListener('keydown', function k(e){ if(e.key === 'Escape'){ close(); document.removeEventListener('keydown', k); } });
  };
  window.hcCertLabel = () => '📜 ' + t('menu');

  // ---- ligação ao aviso de bloco encontrado ----
  if(typeof window.addNotification === 'function'){
    const orig = window.addNotification;
    window.addNotification = function(type, title, desc, machineName, extra){
      const r = orig.apply(this, arguments);
      try { if(type === 'block') capture(machineName, extra, /TESTE|TEST/i.test(String(title) + ' ' + String(desc))); } catch(e) {}
      return r;
    };
  }
  window.hcCert = { records: () => R, capture, confirm, verify: verifyCert };   // diagnóstico na consola
})();
