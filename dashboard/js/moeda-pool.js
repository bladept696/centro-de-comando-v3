// ---------- Moeda e modo da pool (solo / partilhada), detetados sozinhos ----------
// O painel assumia sempre Bitcoin e uma pool qualquer. Aqui deduz-se, para cada máquina, a moeda (pelo endereço da carteira e
// pelo nome da pool) e se a pool é solo ou partilhada (lista de pools conhecidas + palavras como "solo" no endereço). Muda sozinho
// quando alteras a pool. Quando não há certeza, mostra "?" e o utilizador pode fixar a moeda e o modo (fica guardado).
// A chance de bloco e o lucro usam a dificuldade e a recompensa da moeda certa.
(function(){
  const OVR = 'hc_coin_ovr', LANGS = ['pt', 'en', 'es', 'fr'];
  // moedas SHA-256 com dificuldade conhecida (a fórmula hashes = dificuldade × 2^32 vale para todas)
  const COINS = {
    BTC: { name: 'Bitcoin', ic: '₿', reward: 3.125, sha: true, sub: 'btc' },
    BCH: { name: 'Bitcoin Cash', ic: '₿', reward: 3.125, sha: true, sub: 'bch', stats: ['https://api.blockchair.com/bitcoin-cash/stats', 'chair'] },
    // Bitcoin Purity: moeda à parte (não é Bitcoin). A Molepool publica a dificuldade, a recompensa, a comissão e o preço em /api/v1/stats
    BTC1: { name: 'Bitcoin Purity', ic: '₿', reward: 3.125, sha: true, sub: 'btc1', stats: ['https://btc1.molepool.com/api/v1/stats', 'mole'] },
    LTC: { name: 'Litecoin', ic: 'Ł', reward: 6.25, sha: false }, DOGE: { name: 'Dogecoin', ic: 'Ð', reward: 10000, sha: false },
    OTHER: { name: '?', ic: '⛏', reward: 0, sha: false }
  };
  // pools conhecidas: [expressão do endereço, nome, modo]. 'solo' = o bloco é todo teu; 'pool' = recompensa repartida pelos shares
  const POOLS = [
    [/(^|\.)solo\.ckpool\.org$|(^|\.)eusolo\.ckpool\.org$|(^|\.)ausolo\.ckpool\.org$/i, 'CKPool Solo', 'solo'],
    [/(^|\.)public-pool\.io$/i, 'Public Pool', 'solo'],
    [/(^|\.)ocean\.xyz$/i, 'OCEAN', 'pool'], [/braiins|slushpool/i, 'Braiins', 'pool'], [/viabtc/i, 'ViaBTC', 'pool'], [/antpool/i, 'Antpool', 'pool'],
    [/f2pool/i, 'F2Pool', 'pool'], [/foundry/i, 'Foundry', 'pool'], [/luxor/i, 'Luxor', 'pool'], [/emcd/i, 'EMCD', 'pool'], [/poolin/i, 'Poolin', 'pool'],
    [/binance/i, 'Binance Pool', 'pool'], [/btc\.com/i, 'BTC.com', 'pool'], [/1thash|spiderpool|secpool|mara|ultimus/i, 'Pool', 'pool'],
    [/parasite\.(wtf|space)/i, 'Parasite Pool', 'hybrid'],   // híbrida: quem acha o bloco leva uma parte fixa e o resto reparte-se pelos mineiros
    [/molepool/i, 'Molepool', 'solo']   // a Molepool é uma pool solo (a MiningBoard lista-a como SOLO); se usares outro modo, fixa-o no distintivo
  ];
  const TX = {
    solo: ['Solo', 'Solo', 'Solo', 'Solo'], pool: ['Pool', 'Pool', 'Pool', 'Pool'], hybrid: ['Híbrida', 'Hybrid', 'Híbrida', 'Hybride'],
    hybridTip: ['Pool híbrida: quem acha o bloco leva uma parte fixa da recompensa e o resto reparte-se pelos mineiros. A chance abaixo é a de achares o bloco.', 'Hybrid pool: whoever finds the block gets a fixed part of the reward and the rest is shared among miners. The chance below is that of finding the block.', 'Pool híbrido: quien encuentra el bloque se lleva una parte fija de la recompensa y el resto se reparte entre los mineros. La probabilidad es la de encontrar el bloque.', 'Pool hybride : celui qui trouve le bloc reçoit une part fixe de la récompense et le reste est partagé entre les mineurs. La chance indiquée est celle de trouver le bloc.'], unk: ['modo?', 'mode?', '¿modo?', 'mode ?'],
    title: ['Moeda e modo da pool', 'Coin and pool mode', 'Moneda y modo del pool', 'Monnaie et mode du pool'],
    coin: ['Moeda', 'Coin', 'Moneda', 'Monnaie'], mode: ['Modo', 'Mode', 'Modo', 'Mode'], auto: ['Automático', 'Automatic', 'Automático', 'Automatique'],
    shared: ['Pool partilhada', 'Shared pool', 'Pool compartido', 'Pool partagé'], sharedTip: ['Numa pool partilhada não achas o bloco sozinho: recebes uma parte proporcional aos teus shares. Chance teórica de achar um bloco sozinho:', 'In a shared pool you do not find the block alone: you get a share proportional to your shares. Theoretical chance of finding one alone:', 'En un pool compartido no encuentras el bloque tú solo: recibes una parte proporcional a tus shares. Probabilidad teórica de encontrar uno solo:', 'Dans un pool partagé vous ne trouvez pas le bloc seul : vous recevez une part proportionnelle à vos shares. Chance théorique d’en trouver un seul :'],
    diff: ['Dificuldade da rede', 'Network difficulty', 'Dificultad de la red', 'Difficulté du réseau'], rew: ['Recompensa', 'Reward', 'Recompensa', 'Récompense'],
    how_manual: ['Definido por ti', 'Set by you', 'Definido por ti', 'Défini par vous'], how_known: ['Pool conhecida', 'Known pool', 'Pool conocido', 'Pool connu'],
    how_name: ['Pelo nome da pool', 'From the pool name', 'Por el nombre del pool', 'D’après le nom du pool'], how_addr: ['Pelo endereço da carteira', 'From the wallet address', 'Por la dirección de la cartera', 'D’après l’adresse du portefeuille'],
    how_guess: ['Suposição (confirma)', 'Guess (please confirm)', 'Suposición (confirma)', 'Supposition (à confirmer)'], how_none: ['Não foi possível deduzir', 'Could not be deduced', 'No se pudo deducir', 'Impossible à déduire'],
    nodiff: ['sem dados', 'no data', 'sin datos', 'pas de données'], save: ['Guardar', 'Save', 'Guardar', 'Enregistrer'], close: ['Fechar', 'Close', 'Cerrar', 'Fermer'],
    hint: ['Se a pool muda, o painel volta a deduzir sozinho (a menos que fixes aqui).', 'If the pool changes, the panel deduces it again by itself (unless you fix it here).', 'Si cambia el pool, el panel lo vuelve a deducir solo (salvo que lo fijes aquí).', 'Si le pool change, le tableau de bord le déduit à nouveau (sauf si vous le fixez ici).'],
    how_pool: ['Confirmado pela API da pool', 'Confirmed by the pool API', 'Confirmado por la API del pool', 'Confirmé par l’API du pool'],
    applyPool: ['Aplicar a todas as máquinas nesta pool e porta', 'Apply to all machines on this pool and port', 'Aplicar a todas las máquinas en este pool y puerto', 'Appliquer à toutes les machines sur ce pool et ce port'],
    tap: ['Toca para definir', 'Tap to set', 'Toca para definir', 'Touchez pour définir']
  };
  const lang = () => { try { const l = typeof currentLang !== 'undefined' ? currentLang : 'pt'; return LANGS.includes(l) ? l : 'pt'; } catch(e) { return 'pt'; } };
  const t = k => TX[k][LANGS.indexOf(lang())];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fd = n => { if(!(n > 0)) return '—'; try { const f = formatDiff(n); return f.value + f.unit; } catch(e) { return String(Math.round(n)); } };

  let ovr = {}, ovrPool = {};
  try { ovr = JSON.parse(localStorage.getItem(OVR) || '{}') || {}; } catch(e) { ovr = {}; }
  try { ovrPool = JSON.parse(localStorage.getItem('hc_coin_pool') || '{}') || {}; } catch(e) { ovrPool = {}; }
  const saveOvr = () => { try { localStorage.setItem(OVR, JSON.stringify(ovr)); localStorage.setItem('hc_coin_pool', JSON.stringify(ovrPool)); } catch(e) {} };
  const poolKey = r => hostOf(r) + ':' + ((r && r.poolPort) || '');

  // moeda pelo endereço da carteira (o utilizador da pool é "endereço.nome-da-máquina")
  function coinFromAddr(user){
    const a = String(user || '').trim().split('.')[0].replace(/^[a-z]+:\/\//i, '');
    if(/^bc1[0-9a-z]{20,}$/i.test(a)) return { coin: 'BTC', sure: true };
    if(/^(bitcoincash:)?[qp][0-9a-z]{40,}$/i.test(a)) return { coin: 'BCH', sure: true };
    if(/^ltc1[0-9a-z]{20,}$/i.test(a) || /^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(a)) return { coin: 'LTC', sure: true };
    if(/^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/.test(a)) return { coin: 'DOGE', sure: true };
    if(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(a)) return { coin: 'BTC', sure: false };   // formato antigo: serve a BTC e a BCH
    if(/^btc1$/i.test(a)) return { coin: 'BTC1', sure: true };
    const m = a.match(/^(btc|bch|ltc|doge)\d*$/i);   // alguns serviços usam o nome da conta em vez do endereço
    if(m) return { coin: m[1].toUpperCase(), sure: true };
    return null;
  }
  function coinFromHost(host){
    const h = String(host || '').toLowerCase();
    // "btc1" é o ticker da Bitcoin Purity (moeda própria); as outras variantes numeradas (btc2, bch1...) leem-se como a moeda base
    if(/(^|[.\-_])btc1([.\-_]|$)/.test(h)) return 'BTC1';
    if(/(^|[.\-_])(bch|bitcoincash)\d*([.\-_]|$)/.test(h)) return 'BCH';
    if(/(^|[.\-_])(ltc|litecoin)\d*([.\-_]|$)/.test(h)) return 'LTC';
    if(/(^|[.\-_])(doge|dogecoin)\d*([.\-_]|$)/.test(h)) return 'DOGE';
    if(/(^|[.\-_])(btc|bitcoin)\d*([.\-_]|$)|ckpool|public-pool|parasite\.(wtf|space)|ocean\.xyz|braiins|antpool|viabtc|f2pool|foundry|luxor/.test(h)) return 'BTC';
    return null;
  }
  const hostOf = r => String((r && (r.pool || (r.poolInfo && r.poolInfo.primary && r.poolInfo.primary.url))) || '').replace(/^[a-z+]+:\/\//i, '').replace(/[:\/].*$/, '').toLowerCase();
  const userOf = r => (r && r.poolInfo && r.poolInfo.primary && r.poolInfo.primary.user) || '';

  // ---- dados da rede por moeda (dificuldade, recompensa, comissão, preço), atualizados sozinhos ----
  const ST = {};
  function loadStats(coin){
    const c = COINS[coin]; if(!c || !c.stats) return null;
    const e = ST[coin] = ST[coin] || { diff: 0, reward: 0, fee: 0, price: 0, scheme: '', at: 0, busy: false };
    if(!e.busy && Date.now() - e.at > 10 * 60e3){
      e.busy = true; e.at = Date.now() - 8 * 60e3;   // se falhar volta a tentar daí a ~2 min
      fetch(c.stats[0]).then(x => x.json()).then(j => {
        if(c.stats[1] === 'mole'){
          const d = j && j.result; if(!d || !(Number(d.networkDifficulty) > 0)) return;
          Object.assign(e, { diff: Number(d.networkDifficulty), reward: Number(d.reward) || 0, fee: Number(d.fee) || 0, price: Number(d.btc) || 0, scheme: String(d.scheme || ''), at: Date.now() });
        } else {
          const v = Number(j && j.data && j.data.difficulty); if(v > 0){ e.diff = v; e.at = Date.now(); }
        }
      }).catch(() => {}).finally(() => { e.busy = false; });
    }
    return e;
  }

  // ---- Molepool: serve várias moedas no mesmo endereço. A API pública diz em que moeda tens a máquina a minerar ----
  const MOLE = {};
  const isMole = h => /molepool/i.test(h);
  function probeMole(addr){
    if(!/^[A-Za-z0-9]{26,64}$/.test(addr)) return null;
    const m = MOLE[addr] = MOLE[addr] || { coin: null, at: 0, busy: false };
    if(!m.busy && Date.now() - m.at > 10 * 60e3){
      m.busy = true; m.at = Date.now() - 8 * 60e3;
      Promise.all(['BTC1', 'BTC', 'BCH'].map(k => fetch('https://' + COINS[k].sub + '.molepool.com/api/v1/account/' + addr).then(x => x.json()).then(j => ({ k, hr: j && j.status && j.result ? Number(j.result.currentHashrate) || 0 : 0 })).catch(() => ({ k, hr: 0 }))))
        .then(rs => {
          const best = rs.filter(x => x.hr > 0).sort((a, b) => b.hr - a.hr)[0];
          if(best){ m.coin = best.k; m.at = Date.now(); loadStats(best.k); }
        }).finally(() => { m.busy = false; });
    }
    return m;
  }

  // deduz tudo para uma máquina: { coin, mode, pool, coinHow, modeHow }
  function info(dev, r){
    // prioridade: o que fixaste nesta máquina > o que fixaste para esta pool e porta > o que a pool confirma > dedução automática
    const host = hostOf(r), user = userOf(r), o = Object.assign({}, ovrPool[poolKey(r)] || {}, (dev && ovr[dev.id]) || {});
    const known = POOLS.find(p => p[0].test(host));
    const mole = isMole(host) ? probeMole(String(user).split('.')[0].trim()) : null;
    let coin = null, coinHow = 'none';
    const fa = coinFromAddr(user), fh = coinFromHost(host);
    if(o.coin){ coin = o.coin; coinHow = 'manual'; }
    else if(mole && mole.coin){ coin = mole.coin; coinHow = 'pool'; }
    else if(fa && fa.sure){ coin = fa.coin; coinHow = 'addr'; }
    else if(fh){ coin = fh; coinHow = known ? 'known' : 'name'; }
    else if(fa){ coin = fa.coin; coinHow = 'guess'; }
    else if(r && algoGroupOf(r) === 'sha256'){ coin = 'BTC'; coinHow = 'guess'; }
    let mode = null, modeHow = 'none';
    const sch = mole && coin && coinHow === 'pool' && ST[coin] ? ST[coin].scheme : '';
    if(o.mode){ mode = o.mode; modeHow = 'manual'; }
    else if(sch){ mode = /solo/i.test(sch) ? 'solo' : 'pool'; modeHow = 'pool'; }
    else if(known && known[2]){ mode = known[2]; modeHow = 'known'; }
    else if(/solo/i.test(host) || /(^|[._\-])solo([._\-]|$)/i.test(String(user))){ mode = 'solo'; modeHow = 'name'; }
    return { coin, mode, pool: known ? known[1] : host, coinHow, modeHow, host };
  }

  // dificuldade, recompensa (já sem a comissão da pool) e preço por moeda
  function netDiff(coin){
    if(coin === 'BTC'){ try { return difficultyData && difficultyData.currentDifficulty || 0; } catch(e) { return 0; } }
    const e = loadStats(coin); return e ? e.diff : 0;
  }
  const reward = coin => { const e = ST[coin]; return e && e.reward > 0 ? e.reward * (1 - e.fee / 100) : (COINS[coin] || COINS.OTHER).reward; };
  const priceEur = coin => { const e = ST[coin]; let eur = 0; try { eur = currentRates && currentRates.btc_eur; } catch(x) {} return e && e.price > 0 && eur > 0 ? e.price * eur : 0; };
  const algoOk = coin => !!(COINS[coin] && COINS[coin].sha);

  // ---- distintivo no cartão ----
  function label(i){
    if(!i.coin) return '';
    const c = COINS[i.coin] || COINS.OTHER, m = i.mode === 'solo' ? t('solo') : i.mode === 'pool' ? t('pool') : i.mode === 'hybrid' ? t('hybrid') : t('unk');
    return c.ic + ' ' + i.coin + ' · ' + m + (i.coinHow === 'guess' && i.mode ? ' ?' : '');
  }
  function how(h){ return { pool: t('how_pool'), manual: t('how_manual'), known: t('how_known'), name: t('how_name'), addr: t('how_addr'), guess: t('how_guess'), none: t('how_none') }[h]; }
  function tip(i){
    const c = COINS[i.coin] || COINS.OTHER, nd = netDiff(i.coin);
    return c.name + ' (' + how(i.coinHow) + ')\n' + t('mode') + ': ' + (i.mode ? (i.mode === 'solo' ? t('solo') : i.mode === 'hybrid' ? t('hybrid') : t('shared')) + ' (' + how(i.modeHow) + ')' : '? — ' + t('tap')) +
      '\n' + t('diff') + ': ' + (nd ? fd(nd) : t('nodiff')) + (reward(i.coin) ? ' · ' + t('rew') + ': ' + reward(i.coin).toFixed(4) + ' ' + i.coin + (ST[i.coin] && ST[i.coin].fee ? ' (−' + ST[i.coin].fee + '%)' : '') : '');
  }
  window.hcCoinBadge = function(el, dev, r){
    const b = el && el.querySelector('[data-f="coin"]'); if(!b) return;
    const i = info(dev, r);
    if(!i.coin){ b.hidden = true; return; }
    b.hidden = false; b.textContent = label(i); b.title = tip(i);
    b.className = 'hc-coin' + (i.mode === 'solo' ? ' solo' : i.mode === 'pool' ? ' pool' : i.mode === 'hybrid' ? ' hybrid' : ' unk');
  };

  // ---- janela para fixar moeda e modo ----
  function close(){ const n = document.getElementById('hcCoinModal'); if(n) n.remove(); }
  function open(devId){
    close();
    let dev = null; try { dev = (devices || []).find(d => String(d.id) === String(devId)); } catch(e) {}
    if(!dev) return;
    const r = readings[dev.id], i = info(dev, r), o = ovr[dev.id] || {};
    const sel = (id, opts, cur) => '<select id="' + id + '">' + opts.map(([v, l]) => '<option value="' + v + '"' + (v === (cur || '') ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
    const ov = document.createElement('div');
    ov.id = 'hcCoinModal'; ov.className = 'hc-ch-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="hc-ch-box hc-coin-box"><h2>⛏ ' + t('title') + '</h2><p class="hc-ch-intro">' + esc(dev.name) + ' · ' + esc(i.host || '—') + (r && r.poolPort ? ':' + esc(r.poolPort) : '') + '</p>' +
      '<div class="hc-coin-sum">' + esc(label(i)) + '<span>' + esc(tip(i)).replace(/\n/g, '<br>') + '</span></div>' +
      '<label class="hc-coin-f"><span>' + t('coin') + '</span>' + sel('hcCoinC', [['', t('auto')], ['BTC', 'Bitcoin (BTC)'], ['BTC1', 'Bitcoin Purity (BTC1)'], ['BCH', 'Bitcoin Cash (BCH)'], ['LTC', 'Litecoin (LTC)'], ['DOGE', 'Dogecoin (DOGE)']], o.coin) + '</label>' +
      '<label class="hc-coin-f"><span>' + t('mode') + '</span>' + sel('hcCoinM', [['', t('auto')], ['solo', t('solo')], ['pool', t('shared')], ['hybrid', t('hybrid')]], o.mode) + '</label>' +
      '<label class="hc-coin-chk"><input id="hcCoinP" type="checkbox" checked> ' + t('applyPool') + ' (' + esc(poolKey(r)) + ')</label>' +
      '<p class="hc-ch-intro">' + t('hint') + '</p>' +
      '<div class="hc-ch-act"><button type="button" class="hc-coin-sec" data-a="x">' + t('close') + '</button><button type="button" class="hc-ch-btn" data-a="s">' + t('save') + '</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => {
      if(e.target === ov || e.target.closest('[data-a="x"]')) close();
      else if(e.target.closest('[data-a="s"]')){
        const c = document.getElementById('hcCoinC').value, m = document.getElementById('hcCoinM').value, v = Object.assign({}, c ? { coin: c } : {}, m ? { mode: m } : {});
        const forPool = document.getElementById('hcCoinP').checked, key = poolKey(r);
        if(forPool){ if(c || m) ovrPool[key] = v; else delete ovrPool[key]; delete ovr[dev.id]; }
        else if(c || m) ovr[dev.id] = v; else delete ovr[dev.id];
        saveOvr(); close();
        try { if(typeof renderMachineCards === 'function') renderMachineCards(); } catch(e2) {}
      }
    });
    document.addEventListener('keydown', function k(e){ if(e.key === 'Escape'){ close(); document.removeEventListener('keydown', k); } });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.hc-coin'); if(!b) return;
    const card = b.closest('[data-id]'); if(card){ e.stopPropagation(); open(card.dataset.id); }
  }, true);

  window.hcCoin = { info, netDiff, reward, priceEur, stats: () => ST, algoOk, open, set(id, v){ if(v) ovr[id] = v; else delete ovr[id]; saveOvr(); }, ovr: () => ovr, coins: COINS };
  window.hcCoinTip = (dev, r) => { const i = info(dev, r); return i.coin ? tip(i) : ''; };
  window.hcCoinShared = () => ({ text: t('shared'), tip: t('sharedTip') });
  window.hcCoinHybridTip = () => t('hybridTip');
})();
