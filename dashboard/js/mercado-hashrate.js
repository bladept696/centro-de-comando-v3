// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Aba "Mercado de hashrate" (fase 1: ofertas no Nostr) ----------
// Comprar: lista as ofertas publicadas no Nostr por quem usa a Hash Commander. Vender: escolhes as máquinas, o preço
// (sats por TH/s por minuto), a duração máxima e o teu endereço Lightning, e o servidor publica a oferta assinada com
// a chave Nostr deste PC. A oferta nunca leva os IPs nem os nomes das máquinas. Os alugueres chegam na fase 2.
Object.assign(I18N_DICT, {
  hm_t: { pt: `Mercado de hashrate`, en: `Hashrate market`, es: `Mercado de hashrate`, fr: `Marché du hashrate` },
  ab_hashmarket: { pt: `Compra e vende hashrate entre mineiros, com ofertas no Nostr e pagamento Lightning ao minuto.`, en: `Buy and sell hashrate between miners, with offers on Nostr and Lightning paid by the minute.`, es: `Compra y vende hashrate entre mineros, con ofertas en Nostr y pago Lightning por minuto.`, fr: `Achetez et vendez du hashrate entre mineurs, offres sur Nostr et paiement Lightning à la minute.` },
  hm_buy: { pt: `Comprar hashrate`, en: `Buy hashrate`, es: `Comprar hashrate`, fr: `Acheter du hashrate` },
  hm_sell: { pt: `Vender a minha`, en: `Sell mine`, es: `Vender la mía`, fr: `Vendre le mien` },
  hm_id: { pt: `A tua identidade Nostr`, en: `Your Nostr identity`, es: `Tu identidad Nostr`, fr: `Votre identité Nostr` },
  hm_copy: { pt: `Copiar`, en: `Copy`, es: `Copiar`, fr: `Copier` },
  hm_copied: { pt: `Copiado ✓`, en: `Copied ✓`, es: `Copiado ✓`, fr: `Copié ✓` },
  hm_relays: { pt: `{0} relays`, en: `{0} relays`, es: `{0} relays`, fr: `{0} relays` },
  hm_phase: { pt: `Fase 1: já podes publicar e ver ofertas. O aluguer com pagamento ao minuto chega na próxima versão.`, en: `Phase 1: you can already publish and browse offers. Renting with per-minute payment comes in the next version.`, es: `Fase 1: ya puedes publicar y ver ofertas. El alquiler con pago por minuto llega en la próxima versión.`, fr: `Phase 1 : vous pouvez déjà publier et voir des offres. La location payée à la minute arrive dans la prochaine version.` },
  hm_refresh: { pt: `Atualizar`, en: `Refresh`, es: `Actualizar`, fr: `Actualiser` },
  hm_loading: { pt: `A ler as ofertas no Nostr…`, en: `Reading offers from Nostr…`, es: `Leyendo las ofertas en Nostr…`, fr: `Lecture des offres sur Nostr…` },
  hm_empty: { pt: `Ainda não há ofertas. Sê o primeiro a vender o teu hashrate.`, en: `No offers yet. Be the first to sell your hashrate.`, es: `Aún no hay ofertas. Sé el primero en vender tu hashrate.`, fr: `Aucune offre pour l'instant. Soyez le premier à vendre votre hashrate.` },
  hm_c_seller: { pt: `Vendedor`, en: `Seller`, es: `Vendedor`, fr: `Vendeur` },
  hm_c_hash: { pt: `Hashrate`, en: `Hashrate`, es: `Hashrate`, fr: `Hashrate` },
  hm_c_price: { pt: `Preço`, en: `Price`, es: `Precio`, fr: `Prix` },
  hm_c_max: { pt: `Máximo`, en: `Max`, es: `Máximo`, fr: `Max` },
  hm_rent: { pt: `Alugar`, en: `Rent`, es: `Alquilar`, fr: `Louer` },
  hm_rent_soon: { pt: `O aluguer chega na próxima versão`, en: `Renting comes in the next version`, es: `El alquiler llega en la próxima versión`, fr: `La location arrive dans la prochaine version` },
  hm_yours: { pt: `a tua`, en: `yours`, es: `la tuya`, fr: `la vôtre` },
  hm_per_min: { pt: `sats/min`, en: `sats/min`, es: `sats/min`, fr: `sats/min` },
  hm_unit: { pt: `sats por TH/s por minuto`, en: `sats per TH/s per minute`, es: `sats por TH/s por minuto`, fr: `sats par TH/s par minute` },
  hm_s_machines: { pt: `1. Máquinas que vais alugar`, en: `1. Machines you'll rent out`, es: `1. Máquinas que vas a alquilar`, fr: `1. Machines que vous louez` },
  hm_s_price: { pt: `2. Preço`, en: `2. Price`, es: `2. Precio`, fr: `2. Prix` },
  hm_hp: { pt: `Valor de mercado agora (hashprice): ≈ {0} sats por TH/s por minuto. Abaixo disto ninguém ganha em vender; para quem quer tentar a sorte num bloco solo, costuma pagar-se mais.`, en: `Market value now (hashprice): ≈ {0} sats per TH/s per minute. Below this selling doesn't pay; people trying their luck at a solo block usually pay more.`, es: `Valor de mercado ahora (hashprice): ≈ {0} sats por TH/s por minuto. Por debajo no compensa vender; quien busca un bloque solo suele pagar más.`, fr: `Valeur de marché (hashprice) : ≈ {0} sats par TH/s par minute. En dessous, vendre ne rapporte pas ; ceux qui tentent un bloc solo paient souvent plus.` },
  hm_total: { pt: `= {0} sats por minuto · {1} sats por hora{2}`, en: `= {0} sats per minute · {1} sats per hour{2}`, es: `= {0} sats por minuto · {1} sats por hora{2}`, fr: `= {0} sats par minute · {1} sats par heure{2}` },
  hm_s_max: { pt: `3. Duração máxima de cada aluguer (minutos)`, en: `3. Max length of each rental (minutes)`, es: `3. Duración máxima de cada alquiler (minutos)`, fr: `3. Durée max de chaque location (minutes)` },
  hm_s_ln: { pt: `4. O teu endereço Lightning (onde recebes)`, en: `4. Your Lightning address (where you get paid)`, es: `4. Tu dirección Lightning (donde cobras)`, fr: `4. Votre adresse Lightning (où vous êtes payé)` },
  hm_ln_ph: { pt: `nome@carteira.com`, en: `name@wallet.com`, es: `nombre@cartera.com`, fr: `nom@wallet.com` },
  hm_check: { pt: `Verificar`, en: `Check`, es: `Verificar`, fr: `Vérifier` },
  hm_ln_ok: { pt: `✓ Endereço válido`, en: `✓ Valid address`, es: `✓ Dirección válida`, fr: `✓ Adresse valide` },
  hm_s_extra: { pt: `5. Opcional: país e nota`, en: `5. Optional: country and note`, es: `5. Opcional: país y nota`, fr: `5. Optionnel : pays et note` },
  hm_loc_ph: { pt: `Portugal`, en: `Portugal`, es: `España`, fr: `France` },
  hm_note_ph: { pt: `Ex.: máquinas estáveis, ligadas 24 h`, en: `E.g.: stable machines, online 24/7`, es: `Ej.: máquinas estables, 24 h`, fr: `Ex. : machines stables, 24 h/24` },
  hm_priv: { pt: `🔒 A oferta pública só mostra o modelo das máquinas, o hashrate, o preço e o endereço Lightning. Nunca os IPs nem os nomes.`, en: `🔒 The public offer only shows machine models, hashrate, price and Lightning address. Never IPs or names.`, es: `🔒 La oferta pública solo muestra el modelo, el hashrate, el precio y la dirección Lightning. Nunca las IP ni los nombres.`, fr: `🔒 L'offre publique ne montre que le modèle, le hashrate, le prix et l'adresse Lightning. Jamais les IP ni les noms.` },
  hm_publish: { pt: `Publicar oferta`, en: `Publish offer`, es: `Publicar oferta`, fr: `Publier l'offre` },
  hm_update: { pt: `Atualizar oferta`, en: `Update offer`, es: `Actualizar oferta`, fr: `Mettre à jour l'offre` },
  hm_stop: { pt: `Retirar oferta`, en: `Withdraw offer`, es: `Retirar oferta`, fr: `Retirer l'offre` },
  hm_live: { pt: `A tua oferta está publicada · atualiza-se sozinha de 6 em 6 h`, en: `Your offer is live · refreshes itself every 6 h`, es: `Tu oferta está publicada · se actualiza cada 6 h`, fr: `Votre offre est en ligne · se met à jour toutes les 6 h` },
  hm_done: { pt: `✓ Publicada em {0} de {1} relays.`, en: `✓ Published on {0} of {1} relays.`, es: `✓ Publicada en {0} de {1} relays.`, fr: `✓ Publiée sur {0} relays sur {1}.` },
  hm_stopped: { pt: `Oferta retirada.`, en: `Offer withdrawn.`, es: `Oferta retirada.`, fr: `Offre retirée.` },
  hm_err: { pt: `Não foi possível: {0}`, en: `Could not do it: {0}`, es: `No fue posible: {0}`, fr: `Impossible : {0}` },
  hm_offline: { pt: `offline`, en: `offline`, es: `offline`, fr: `hors ligne` },
  hm_phase2: { pt: `Pagas adiantado em pequenos períodos (minutos), e só enquanto o hashrate aparecer na tua pool. Se algo falhar, ninguém perde mais do que um período. Começa com alugueres curtos.`, en: `You prepay in small periods (minutes), and only while the hashrate shows up on your pool. If anything fails, nobody loses more than one period. Start with short rentals.`, es: `Pagas por adelantado en periodos cortos (minutos), y solo mientras el hashrate aparezca en tu pool. Si algo falla, nadie pierde más de un periodo. Empieza con alquileres cortos.`, fr: `Vous prépayez par petites périodes (minutes), et seulement tant que le hashrate apparaît sur votre pool. En cas de problème, personne ne perd plus d'une période. Commencez par des locations courtes.` },
  hm_w_t: { pt: `A tua carteira para comprar (NWC)`, en: `Your wallet for buying (NWC)`, es: `Tu cartera para comprar (NWC)`, fr: `Votre portefeuille pour acheter (NWC)` },
  hm_w_on: { pt: `✓ Carteira ligada{0}`, en: `✓ Wallet connected{0}`, es: `✓ Cartera conectada{0}`, fr: `✓ Portefeuille connecté{0}` },
  hm_w_off: { pt: `Desligar`, en: `Disconnect`, es: `Desconectar`, fr: `Déconnecter` },
  hm_w_ph: { pt: `nostr+walletconnect://…`, en: `nostr+walletconnect://…`, es: `nostr+walletconnect://…`, fr: `nostr+walletconnect://…` },
  hm_w_go: { pt: `Ligar carteira`, en: `Connect wallet`, es: `Conectar cartera`, fr: `Connecter` },
  hm_w_help: { pt: `Na tua carteira (Alby Hub, LNbits, Coinos, Primal, Zeus…) cria uma ligação "Nostr Wallet Connect" com um limite de gasto (ex.: 2000 sats por dia) e cola aqui o código. O código fica só neste PC.`, en: `In your wallet (Alby Hub, LNbits, Coinos, Primal, Zeus…) create a "Nostr Wallet Connect" link with a spending limit (e.g. 2000 sats a day) and paste the code here. The code stays on this PC.`, es: `En tu cartera (Alby Hub, LNbits, Coinos, Primal, Zeus…) crea una conexión "Nostr Wallet Connect" con un límite de gasto (ej.: 2000 sats al día) y pega aquí el código. El código se queda en este PC.`, fr: `Dans votre portefeuille (Alby Hub, LNbits, Coinos, Primal, Zeus…) créez une connexion « Nostr Wallet Connect » avec une limite de dépense (ex. : 2000 sats par jour) et collez le code ici. Il reste sur ce PC.` },
  hm_w_bal: { pt: ` · saldo {0} sats`, en: ` · balance {0} sats`, es: ` · saldo {0} sats`, fr: ` · solde {0} sats` },
  hm_r_t: { pt: `Alugar {0} TH/s`, en: `Rent {0} TH/s`, es: `Alquilar {0} TH/s`, fr: `Louer {0} TH/s` },
  hm_r_min: { pt: `Duração (minutos)`, en: `Duration (minutes)`, es: `Duración (minutos)`, fr: `Durée (minutes)` },
  hm_r_pool: { pt: `A tua pool`, en: `Your pool`, es: `Tu pool`, fr: `Votre pool` },
  hm_r_addr: { pt: `O teu endereço Bitcoin (recebe o bloco se sair)`, en: `Your Bitcoin address (gets the block if found)`, es: `Tu dirección Bitcoin (recibe el bloque si sale)`, fr: `Votre adresse Bitcoin (reçoit le bloc s'il est trouvé)` },
  hm_r_cost: { pt: `Custo: {0} sats a cada {1} min · total até {2} sats{3}`, en: `Cost: {0} sats every {1} min · total up to {2} sats{3}`, es: `Coste: {0} sats cada {1} min · total hasta {2} sats{3}`, fr: `Coût : {0} sats toutes les {1} min · total jusqu'à {2} sats{3}` },
  hm_r_go: { pt: `Começar aluguer`, en: `Start rental`, es: `Empezar alquiler`, fr: `Démarrer la location` },
  hm_r_cancel: { pt: `Cancelar`, en: `Cancel`, es: `Cancelar`, fr: `Annuler` },
  hm_r_needw: { pt: `Liga primeiro a tua carteira (em cima).`, en: `Connect your wallet first (above).`, es: `Conecta primero tu cartera (arriba).`, fr: `Connectez d'abord votre portefeuille (en haut).` },
  hm_s_t_buy: { pt: `Estás a comprar`, en: `You're buying`, es: `Estás comprando`, fr: `Vous achetez` },
  hm_s_t_sell: { pt: `Estás a vender`, en: `You're selling`, es: `Estás vendiendo`, fr: `Vous vendez` },
  hm_s_wait: { pt: `à espera do vendedor…`, en: `waiting for the seller…`, es: `esperando al vendedor…`, fr: `en attente du vendeur…` },
  hm_s_paid: { pt: `Pago`, en: `Paid`, es: `Pagado`, fr: `Payé` },
  hm_s_got: { pt: `Recebido`, en: `Received`, es: `Recibido`, fr: `Reçu` },
  hm_s_seen: { pt: `Visto na pool`, en: `Seen on pool`, es: `Visto en el pool`, fr: `Vu sur le pool` },
  hm_s_warm: { pt: `a aquecer (4 min)`, en: `warming up (4 min)`, es: `calentando (4 min)`, fr: `démarrage (4 min)` },
  hm_s_stop: { pt: `Parar aluguer`, en: `Stop rental`, es: `Parar alquiler`, fr: `Arrêter` },
  hm_r_other: { pt: `Outra pool…`, en: `Another pool…`, es: `Otro pool…`, fr: `Autre pool…` },
  hm_r_host: { pt: `Servidor (stratum)`, en: `Server (stratum)`, es: `Servidor (stratum)`, fr: `Serveur (stratum)` },
  hm_r_port: { pt: `Porta`, en: `Port`, es: `Puerto`, fr: `Port` },
  hm_r_user: { pt: `Utilizador (conta.worker ou endereço.worker)`, en: `User (account.worker or address.worker)`, es: `Usuario (cuenta.worker o dirección.worker)`, fr: `Utilisateur (compte.worker ou adresse.worker)` },
  hm_r_pass: { pt: `Palavra-passe da pool`, en: `Pool password`, es: `Contraseña del pool`, fr: `Mot de passe du pool` },
  hm_r_noverify: { pt: `Com esta pool a app não consegue confirmar se o hashrate está a chegar: pagas sem essa confirmação. Confirma tu na página da pool e para o aluguer se não vires o worker.`, en: `With this pool the app can't confirm the hashrate is arriving: you pay without that check. Check the pool's page yourself and stop the rental if the worker doesn't show up.`, es: `Con este pool la app no puede confirmar si llega el hashrate: pagas sin esa comprobación. Compruébalo en la página del pool y para el alquiler si no ves el worker.`, fr: `Avec ce pool, l'app ne peut pas confirmer que le hashrate arrive : vous payez sans cette vérification. Vérifiez sur la page du pool et arrêtez la location si le worker n'apparaît pas.` },
  hm_r_verify: { pt: `Esta pool deixa a app confirmar o hashrate: se não chegar, deixas de pagar sozinho.`, en: `This pool lets the app confirm the hashrate: if it doesn't arrive, payments stop by themselves.`, es: `Este pool permite a la app confirmar el hashrate: si no llega, dejas de pagar solo.`, fr: `Ce pool permet à l'app de confirmer le hashrate : s'il n'arrive pas, les paiements s'arrêtent seuls.` },
  hm_e_old: { pt: `O servidor da app que está a correr é de uma versão anterior e não tem esta função. Fecha a app (ícone na bandeja → Sair) e abre-a de novo.`, en: `The running app server is an older version without this feature. Quit the app (tray icon → Exit) and open it again.`, es: `El servidor de la app en ejecución es de una versión anterior sin esta función. Cierra la app (icono de la bandeja → Salir) y ábrela de nuevo.`, fr: `Le serveur de l'app en cours est d'une version antérieure sans cette fonction. Quittez l'app (icône → Quitter) et rouvrez-la.` },
  hm_e_login: { pt: `A sessão expirou: entra outra vez no painel.`, en: `Your session expired: sign in again.`, es: `La sesión ha caducado: vuelve a entrar.`, fr: `Votre session a expiré : reconnectez-vous.` },
  hm_hist: { pt: `Alugueres anteriores`, en: `Past rentals`, es: `Alquileres anteriores`, fr: `Locations passées` }
});

(function(){
  const S = { view: 'buy', st: null, offers: null, busy: false, msg: '' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (k, ...a) => a.reduce((s, v, i) => s.split('{' + i + '}').join(v), t(k));
  const loc = () => ({ pt: 'pt-PT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR' }[typeof currentLang !== 'undefined' ? currentLang : 'pt'] || 'pt-PT');
  const num = (v, d) => Number(v).toLocaleString(loc(), { minimumFractionDigits: 0, maximumFractionDigits: d });
  const shortNpub = n => n ? n.slice(0, 10) + '…' + n.slice(-4) : '';
  const ago = ts => { const s = Math.max(0, Date.now() / 1000 - ts); return s < 3600 ? Math.round(s / 60) + ' min' : s < 86400 ? Math.round(s / 3600) + ' h' : Math.round(s / 86400) + ' d'; };
  const eurPerSat = () => { try { return (Number(currentRates && currentRates.btc_eur) || 0) / 1e8; } catch(e) { return 0; } };
  async function api(path, body){
    const r = await fetch(API_BASE + path, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const txt = await r.text();
    try { return JSON.parse(txt); }
    // resposta vazia ou HTML: o servidor que está a correr é de uma versão sem esta função (ficou aberto de antes)
    catch(e) { throw new Error(t(r.status === 401 ? 'hm_e_login' : 'hm_e_old')); }
  }

  function root(){ return document.getElementById('tab-hashmarket'); }

  function offersHtml(){
    if(!S.offers) return '<div class="hm-empty">' + t('hm_loading') + '</div>';
    if(S.offersErr) return '<div class="hm-empty hm-bad">' + esc(S.offersErr) + '</div>';
    if(!S.offers.length) return '<div class="hm-empty">' + t('hm_empty') + '</div>';
    return '<div class="hm-row hm-hd"><span>' + t('hm_c_seller') + '</span><span>' + t('hm_c_hash') + '</span><span>' + t('hm_c_price') + '</span><span>' + t('hm_c_max') + '</span><span></span></div>' +
      S.offers.map(o => '<div class="hm-row' + (o.mine ? ' mine' : '') + '">' +
        '<span><b>' + esc(shortNpub(o.npub)) + '</b>' + (o.mine ? ' <em class="hm-tag">' + t('hm_yours') + '</em>' : '') +
          '<small>' + esc(o.machines.map(m => m.model + (m.n > 1 ? ' ×' + m.n : '')).join(', ')) + (o.location ? ' · ' + esc(o.location) : '') + ' · ' + ago(o.updated) + '</small></span>' +
        '<span><b>' + num(o.ths, 2) + ' TH/s</b></span>' +
        '<span><b>' + num(o.rate, 4) + '</b> <small>' + t('hm_unit') + '</small><small>= ' + num(o.price_min, 3) + ' ' + t('hm_per_min') + '</small></span>' +
        '<span>' + o.max_min + ' min</span>' +
        '<span>' + (o.mine ? '' : '<button type="button" class="hm-btn" data-hm="rent" data-k="' + esc(o.pubkey + '|' + o.d) + '">' + t('hm_rent') + '</button>') + '</span>' +
      '</div>' + (S.rent && S.rent.pubkey === o.pubkey && S.rent.d === o.d ? rentHtml(o) : '')).join('');
  }

  // mesmas contas do hc_market.billing: período mais curto com >= 1 sat e erro de arredondamento até 10%
  function billing(ths, rate){
    const per = Math.max(1e-9, ths * rate), first = Math.max(1, Math.ceil(1 / per));
    for(let p = first; p <= 60; p++){ const v = per * p; if(Math.abs(Math.round(v) - v) / v <= 0.1) return [p, Math.max(1, Math.round(v))]; }
    const p = Math.min(60, first); return [p, Math.max(1, Math.round(per * p))];
  }
  function myAddress(){
    try { for(const d of (devices || [])){ const u = String((readings[d.id] || {}).stratumUser || '').split('.')[0]; if(/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,}$/i.test(u)) return u; } } catch(e) {}
    return '';
  }
  function rentHtml(o){
    const r = S.rent, pools = (S.ses && S.ses.pools) || ['public-pool.io', 'solo.ckpool.org'];
    return '<div class="hm-rent"><b>' + fmt('hm_r_t', num(o.ths, 2)) + '</b>' +
      '<div class="hm-rgrid"><label>' + t('hm_r_min') + '<input id="hmRMin" type="number" min="1" max="' + o.max_min + '" step="1" value="' + esc(r.minutes) + '"></label>' +
      '<label>' + t('hm_r_pool') + '<select id="hmRPool">' + pools.map(p => '<option value="' + esc(p) + '"' + (p === r.pool ? ' selected' : '') + '>' + esc(p) + ' ✓</option>').join('') +
        '<option value="__other"' + (r.pool === '__other' ? ' selected' : '') + '>' + t('hm_r_other') + '</option></select></label>' +
      (r.pool === '__other'
        ? '<label>' + t('hm_r_host') + '<input id="hmRHost" type="text" maxlength="120" spellcheck="false" placeholder="pool.exemplo.com" value="' + esc(r.host || '') + '"></label>' +
          '<label>' + t('hm_r_port') + '<input id="hmRPort" type="number" min="1" max="65535" value="' + esc(r.port || 3333) + '"></label>' +
          '<label>' + t('hm_r_user') + '<input id="hmRUser" type="text" maxlength="128" spellcheck="false" placeholder="conta.worker" value="' + esc(r.user || '') + '"></label>' +
          '<label>' + t('hm_r_pass') + '<input id="hmRPass" type="text" maxlength="64" spellcheck="false" value="' + esc(r.pass || 'x') + '"></label>' +
          '<p class="hm-warn wide">⚠️ ' + t('hm_r_noverify') + '</p></div>'
        : '<label class="wide">' + t('hm_r_addr') + '<input id="hmRAddr" type="text" maxlength="90" spellcheck="false" value="' + esc(r.address) + '"></label><p class="hm-hint wide">✓ ' + t('hm_r_verify') + '</p></div>') +
      '<small class="hm-calc" id="hmRCost"></small>' +
      (S.ses && S.ses.nwc && S.ses.nwc.connected ? '' : '<small class="hm-bad">' + t('hm_r_needw') + '</small>') +
      '<p class="hm-err" id="hmRErr" hidden></p>' +
      '<div class="hm-go"><button type="button" class="hm-btn" data-hm="rent-x">' + t('hm_r_cancel') + '</button> <button type="button" class="hm-btn y" data-hm="rent-go">' + t('hm_r_go') + '</button></div></div>';
  }
  function rentCost(){
    const el = document.getElementById('hmRCost'); if(!el || !S.rent) return;
    const o = (S.offers || []).find(x => x.pubkey === S.rent.pubkey && x.d === S.rent.d); if(!o) return;
    const mins = Math.max(1, Number((document.getElementById('hmRMin') || {}).value) || 1), [p, s] = billing(o.ths, o.rate), total = s * Math.ceil(mins / p), e = eurPerSat();
    el.textContent = fmt('hm_r_cost', s, p, total, e ? ' ≈ ' + (total * e).toLocaleString(loc(), { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }) : '');
  }

  function walletHtml(){
    const w = S.ses && S.ses.nwc;
    if(w && w.connected) return '<div class="hm-wallet on"><span>' + fmt('hm_w_on', w.alias ? ' · ' + esc(w.alias) : '') + (S.bal != null ? fmt('hm_w_bal', num(S.bal, 0)) : '') + '</span><button type="button" class="hm-btn" data-hm="nwc-off">' + t('hm_w_off') + '</button></div>';
    return '<div class="hm-wallet"><b>' + t('hm_w_t') + '</b><div class="hm-in"><input id="hmNwc" type="password" placeholder="' + esc(t('hm_w_ph')) + '" autocomplete="off" spellcheck="false"><button type="button" class="hm-btn" data-hm="nwc-go">' + t('hm_w_go') + '</button></div><small class="hm-hint">' + t('hm_w_help') + '</small><small id="hmNwcMsg" class="hm-bad"></small></div>';
  }

  function sessionsHtml(){
    const list = (S.ses && S.ses.sessions) || [];
    if(!list.length) return '';
    const now = Date.now() / 1000;
    return list.map(s => {
      const buyer = s.role === 'buyer', el = s.start ? Math.min(s.minutes * 60, now - s.start) : 0, pct = Math.min(100, el / (s.minutes * 60) * 100);
      const seen = buyer ? (s.seen_ths != null ? num(s.seen_ths, 2) + ' TH/s' : t('hm_s_warm')) : '';
      return '<div class="hm-ses ' + (buyer ? 'buy' : 'sell') + '"><div class="hm-ses-h"><b>' + (buyer ? '🔵 ' + t('hm_s_t_buy') : '🟢 ' + t('hm_s_t_sell')) + '</b><span>' + esc(shortNpub(s.peer_npub || '')) + ' · ' + num(s.ths, 2) + ' TH/s → ' + esc(s.pool.host) + '</span>' +
        '<button type="button" class="hm-btn red" data-hm="ses-stop" data-sid="' + esc(s.sid) + '">' + t('hm_s_stop') + '</button></div>' +
        (s.state === 'requested' ? '<small>' + t('hm_s_wait') + '</small>' : '<div class="hm-bar"><i style="width:' + pct.toFixed(1) + '%"></i></div><small>' + Math.floor(el / 60) + ' / ' + s.minutes + ' min · ' + s.sats_per + ' sats / ' + s.period + ' min</small>') +
        '<div class="hm-stats"><span>' + t(buyer ? 'hm_s_paid' : 'hm_s_got') + '<b>' + num(s.paid_sats, 0) + ' sats</b></span>' + (buyer ? '<span>' + t('hm_s_seen') + '<b>' + seen + '</b></span>' : '') + '</div>' +
        '<div class="hm-log">' + (s.log || []).slice(-4).reverse().map(l => '<div><em>' + new Date(l[0] * 1000).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '</em> ' + esc(l[1]) + '</div>').join('') + '</div></div>';
    }).join('');
  }

  function historyHtml(){
    const h = (S.ses && S.ses.history) || [];
    if(!h.length) return '';
    return '<details class="hm-hist"><summary>' + t('hm_hist') + ' (' + h.length + ')</summary>' + h.slice(0, 15).map(x =>
      '<div><span>' + (x.role === 'buyer' ? '🔵' : '🟢') + ' ' + new Date((x.created || 0) * 1000).toLocaleString(loc(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' · ' + num(x.ths, 2) + ' TH/s · ' + x.minutes + ' min</span><b>' + (x.role === 'buyer' ? '−' : '+') + num(x.paid_sats || 0, 0) + ' sats</b><small>' + esc(x.why || '') + '</small></div>').join('') + '</details>';
  }

  function sellHtml(){
    const st = S.st; if(!st) return '<div class="hm-empty">' + t('hm_loading') + '</div>';
    const o = st.offer || {}, sel = new Set(o.machines || st.machines.filter(m => m.online).map(m => m.ip));
    const hp = st.hashprice;
    const live = o.active ? '<div class="hm-live"><span>🟢 ' + t('hm_live') + '</span><button type="button" class="hm-btn red" data-hm="stop">' + t('hm_stop') + '</button></div>' : '';
    return live +
      '<div class="hm-sec"><b>' + t('hm_s_machines') + '</b>' + st.machines.map(m =>
        '<label class="hm-mach' + (m.online ? '' : ' off') + '"><input type="checkbox" data-ip="' + esc(m.ip) + '"' + (sel.has(m.ip) ? ' checked' : '') + (m.online ? '' : ' disabled') + '>' +
        '<span><b>' + esc(m.name) + '</b><small>' + esc(m.model) + '</small></span><em>' + (m.online ? num(m.ths, 2) + ' TH/s' : t('hm_offline')) + '</em></label>').join('') + '</div>' +
      '<div class="hm-sec"><b>' + t('hm_s_price') + '</b><div class="hm-in"><input id="hmRate" type="number" min="0.001" max="1000" step="0.001" value="' + esc(o.rate || (hp ? (hp * 1.5).toFixed(3) : '0.05')) + '"><span>' + t('hm_unit') + '</span></div>' +
        '<small class="hm-calc" id="hmCalc"></small>' + (hp ? '<small class="hm-hint">' + fmt('hm_hp', num(hp, 4)) + '</small>' : '') + '</div>' +
      '<div class="hm-sec"><b>' + t('hm_s_max') + '</b><div class="hm-in"><input id="hmMax" type="number" min="10" max="1440" step="10" value="' + esc(o.max_min || 120) + '"><span>min</span></div></div>' +
      '<div class="hm-sec"><b>' + t('hm_s_ln') + '</b><div class="hm-in"><input id="hmLn" type="text" maxlength="120" placeholder="' + esc(t('hm_ln_ph')) + '" value="' + esc(o.lud16 || '') + '" autocomplete="off" spellcheck="false"><button type="button" class="hm-btn" data-hm="check">' + t('hm_check') + '</button></div><small id="hmLnMsg"></small></div>' +
      '<div class="hm-sec"><b>' + t('hm_s_extra') + '</b><div class="hm-in"><input id="hmLoc" type="text" maxlength="40" placeholder="' + esc(t('hm_loc_ph')) + '" value="' + esc(o.location || '') + '"></div>' +
        '<div class="hm-in"><input id="hmNote" type="text" maxlength="400" placeholder="' + esc(t('hm_note_ph')) + '" value="' + esc(o.note || '') + '"></div></div>' +
      '<p class="hm-priv">' + t('hm_priv') + '</p>' +
      '<div class="hm-go"><button type="button" class="hm-btn y" data-hm="publish"' + (S.busy ? ' disabled' : '') + '>' + t(o.active ? 'hm_update' : 'hm_publish') + '</button></div>' +
      (S.msg ? '<p class="hm-msg">' + S.msg + '</p>' : '');
  }

  function calc(){
    const el = document.getElementById('hmCalc'); if(!el || !S.st) return;
    const rate = Number((document.getElementById('hmRate') || {}).value) || 0;
    const ips = new Set([...root().querySelectorAll('.hm-mach input:checked')].map(i => i.dataset.ip));
    const ths = S.st.machines.filter(m => ips.has(m.ip) && m.online).reduce((a, m) => a + m.ths, 0);
    const pm = ths * rate, e = eurPerSat();
    el.textContent = fmt('hm_total', num(pm, 3), num(pm * 60, 1), e ? ' ≈ ' + (pm * 60 * e).toLocaleString(loc(), { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }) + '/h' : '');
  }

  function render(){
    const r = root(); if(!r) return;
    let box = r.querySelector('.hm'); if(!box){ box = document.createElement('div'); box.className = 'hm'; r.appendChild(box); }
    const st = S.st;
    box.innerHTML =
      '<div class="hm-top"><div><small>' + t('hm_id') + '</small><code>' + esc(st ? shortNpub(st.npub) : '…') + '</code>' + (st ? '<button type="button" class="hm-btn" data-hm="copy">' + t('hm_copy') + '</button>' : '') + '</div>' +
        '<span class="hm-relays">' + (st ? '⚡ Nostr · ' + fmt('hm_relays', st.relays.length) : '') + '</span></div>' +
      '<p class="hm-phase">' + t('hm_phase2') + '</p>' +
      '<div id="hmSes">' + sessionsHtml() + '</div>' +
      '<div class="hm-tabs"><button type="button" data-hm="v-buy" class="' + (S.view === 'buy' ? 'on' : '') + '">' + t('hm_buy') + '</button><button type="button" data-hm="v-sell" class="' + (S.view === 'sell' ? 'on' : '') + '">' + t('hm_sell') + '</button>' +
        (S.view === 'buy' ? '<button type="button" class="hm-ref" data-hm="refresh">↻ ' + t('hm_refresh') + '</button>' : '') + '</div>' +
      '<div class="hm-body">' + (S.view === 'buy' ? walletHtml() + offersHtml() : sellHtml()) + historyHtml() + '</div>';
    if(S.view === 'sell') calc(); else rentCost();
  }

  // os alugueres a decorrer atualizam-se sozinhos sem redesenhar o resto (não se perde o que estás a escrever)
  async function pollSessions(){
    const tab = root(); if(!tab || !tab.classList.contains('active')) return;
    let d; try { d = await api('/api/market/sessions'); } catch(e) { return; }
    const had = S.ses ? JSON.stringify([(S.ses.sessions || []).length, (S.ses.history || []).length, S.ses.nwc]) : '';
    (d.events || []).forEach(ev => { if(ev.ts > (S.evTs || 0) && S.evTs !== undefined && typeof addNotification === 'function') try { addNotification('market', ev.title, ev.text, 'Mercado de hashrate'); } catch(e) {} });
    S.evTs = Math.max(S.evTs || 0, ...(d.events || []).map(ev => ev.ts), 0);
    S.ses = d;
    if(had !== JSON.stringify([(d.sessions || []).length, (d.history || []).length, d.nwc])) render();
    else { const el = document.getElementById('hmSes'); if(el) el.innerHTML = sessionsHtml(); }
  }
  setInterval(pollSessions, 3000);

  async function loadState(){ try { S.st = await api('/api/market/state'); } catch(e) {} render(); }
  async function loadOffers(force){ S.offers = S.offers || null; render(); S.offersErr = ''; try { S.offers = (await api('/api/market/offers' + (force ? '?force=1' : ''))).offers || []; } catch(e) { S.offers = []; S.offersErr = e.message || String(e); } render(); }

  document.addEventListener('click', async e => {
    const b = e.target.closest('#tab-hashmarket [data-hm]'); if(!b) return;
    const k = b.dataset.hm;
    if(k === 'v-buy'){ S.view = 'buy'; render(); loadOffers(false); }
    else if(k === 'v-sell'){ S.view = 'sell'; S.msg = ''; render(); loadState(); }
    else if(k === 'refresh') loadOffers(true);
    else if(k === 'copy'){ try { await navigator.clipboard.writeText(S.st.npub); b.textContent = t('hm_copied'); setTimeout(() => { b.textContent = t('hm_copy'); }, 1500); } catch(err) {} }
    else if(k === 'check'){
      const m = document.getElementById('hmLnMsg'); m.textContent = '…';
      const r = await api('/api/market/lud16?addr=' + encodeURIComponent(document.getElementById('hmLn').value.trim()));
      m.className = r.ok ? 'ok' : 'bad'; m.textContent = r.ok ? t('hm_ln_ok') : r.error;
    } else if(k === 'publish'){
      const body = { machines: [...root().querySelectorAll('.hm-mach input:checked')].map(i => i.dataset.ip), rate: Number(document.getElementById('hmRate').value),
        max_min: Number(document.getElementById('hmMax').value), lud16: document.getElementById('hmLn').value.trim(),
        location: document.getElementById('hmLoc').value.trim(), note: document.getElementById('hmNote').value.trim() };
      S.busy = true; S.msg = ''; render();
      let r; try { r = await api('/api/market/offer', body); } catch(err) { r = { ok: false, error: (err && err.message) || String(err) }; }
      S.busy = false;
      S.msg = r.ok ? fmt('hm_done', r.accepted, Object.keys(r.relays || {}).length) : fmt('hm_err', esc(r.error || '?'));
      await loadState(); S.offers = null;
    } else if(k === 'stop'){
      let r; try { r = await api('/api/market/offer/stop', {}); } catch(err) { r = { ok: false }; }
      S.msg = r.ok ? t('hm_stopped') : fmt('hm_err', '?'); await loadState(); S.offers = null;
    } else if(k === 'nwc-go'){
      const m = document.getElementById('hmNwcMsg'); m.textContent = '…';
      let r; try { r = await api('/api/market/nwc', { uri: document.getElementById('hmNwc').value.trim() }); } catch(err) { r = { ok: false, error: (err && err.message) || String(err) }; }
      if(!r.ok){ m.textContent = r.error || '?'; return; }
      S.bal = r.balance; S.ses = null; await pollSessions(); render();
    } else if(k === 'nwc-off'){
      await api('/api/market/nwc/forget', {}); S.bal = null; S.ses = null; await pollSessions(); render();
    } else if(k === 'rent'){
      const [pubkey, d] = b.dataset.k.split('|');
      S.rent = { pubkey, d, minutes: 30, pool: 'public-pool.io', address: myAddress() }; render();
    } else if(k === 'rent-x'){ S.rent = null; render(); }
    else if(k === 'rent-go'){
      const err = document.getElementById('hmRErr'), show = x => { err.textContent = x; err.hidden = !x; };
      const v = id => ((document.getElementById(id) || {}).value || '').trim(), other = v('hmRPool') === '__other';
      const body = { pubkey: S.rent.pubkey, d: S.rent.d, minutes: Number(v('hmRMin')),
        pool_host: other ? v('hmRHost') : v('hmRPool'), pool_port: other ? Number(v('hmRPort')) : undefined,
        pool_user: other ? v('hmRUser') : undefined, pool_pass: other ? (v('hmRPass') || 'x') : undefined, address: other ? '' : v('hmRAddr') };
      b.disabled = true;
      let r; try { r = await api('/api/market/rent', body); } catch(err2) { r = { ok: false, error: (err2 && err2.message) || String(err2) }; }
      b.disabled = false;
      if(!r.ok){ show(r.error || '?'); return; }
      S.rent = null; await pollSessions(); render();
    } else if(k === 'ses-stop'){
      b.disabled = true; await api('/api/market/session/stop', { sid: b.dataset.sid }); setTimeout(pollSessions, 1500);
    }
  });
  document.addEventListener('input', e => {
    if(!e.target.closest('#tab-hashmarket')) return;
    if(e.target.id === 'hmRate' || e.target.closest('.hm-mach')) calc();
    if(S.rent && /^hmR/.test(e.target.id)){
      const g = id => (document.getElementById(id) || {}).value;
      Object.assign(S.rent, { minutes: g('hmRMin'), host: g('hmRHost') ?? S.rent.host, port: g('hmRPort') ?? S.rent.port, user: g('hmRUser') ?? S.rent.user,
        pass: g('hmRPass') ?? S.rent.pass, address: g('hmRAddr') ?? S.rent.address });
      if(e.target.id === 'hmRPool' && g('hmRPool') !== S.rent.pool){ S.rent.pool = g('hmRPool'); render(); return; }
      rentCost();
    }
  });
  document.addEventListener('change', e => { if(e.target.closest('#tab-hashmarket .hm-mach')) calc(); });

  // carrega quando a aba abre
  const tab = document.getElementById('tab-hashmarket');
  if(tab && window.MutationObserver){
    new MutationObserver(() => { if(tab.classList.contains('active') && !tab.dataset.hmInit){ tab.dataset.hmInit = '1'; loadState(); loadOffers(false); pollSessions(); } })
      .observe(tab, { attributes: true, attributeFilter: ['class'] });
  }
  window.hcHashMarket = { render, loadState, loadOffers };
})();
