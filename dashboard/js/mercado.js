// ---------- Aba Mercado: preços de todas as criptomoedas ----------
// Fonte principal: CoinGecko (preço, variações 1h/24h/7d, volume, capitalização, gráfico de 7 dias).
// Se o CoinGecko falhar (limite de pedidos) usa a Binance, com menos campos. Os favoritos, a moeda e a ordenação ficam guardados neste navegador.
Object.assign(I18N_DICT, {
  mercado_t: { pt: `Mercado`, en: `Market`, es: `Mercado`, fr: `Marché` },
  ab_mercado: { pt: `Preço de todas as criptomoedas em direto: pesquise, ordene e guarde as suas favoritas.`, en: `Live prices for every cryptocurrency: search, sort and keep your favourites.`, es: `Precio de todas las criptomonedas en directo: busque, ordene y guarde sus favoritas.`, fr: `Prix de toutes les cryptomonnaies en direct : cherchez, triez et gardez vos favorites.` },
  mk_search: { pt: `Pesquisar token (nome ou símbolo)…`, en: `Search token (name or symbol)…`, es: `Buscar token (nombre o símbolo)…`, fr: `Chercher un token (nom ou symbole)…` },
  mk_all: { pt: `Todos`, en: `All`, es: `Todos`, fr: `Tous` },
  mk_fav: { pt: `⭐ Favoritos`, en: `⭐ Favourites`, es: `⭐ Favoritos`, fr: `⭐ Favoris` },
  mk_up: { pt: `🟢 A subir`, en: `🟢 Gainers`, es: `🟢 Subiendo`, fr: `🟢 En hausse` },
  mk_down: { pt: `🔴 A descer`, en: `🔴 Losers`, es: `🔴 Bajando`, fr: `🔴 En baisse` },
  mk_refresh: { pt: `atualizar`, en: `refresh`, es: `actualizar`, fr: `actualiser` },
  mk_cap: { pt: `Capitalização total`, en: `Total market cap`, es: `Capitalización total`, fr: `Capitalisation totale` },
  mk_vol24: { pt: `Volume 24 h`, en: `24 h volume`, es: `Volumen 24 h`, fr: `Volume 24 h` },
  mk_dom: { pt: `Dominância BTC / ETH`, en: `BTC / ETH dominance`, es: `Dominancia BTC / ETH`, fr: `Dominance BTC / ETH` },
  mk_fng: { pt: `Medo e ganância`, en: `Fear & greed`, es: `Miedo y codicia`, fr: `Peur et cupidité` },
  mk_fng0: { pt: `Medo extremo`, en: `Extreme fear`, es: `Miedo extremo`, fr: `Peur extrême` },
  mk_fng1: { pt: `Medo`, en: `Fear`, es: `Miedo`, fr: `Peur` },
  mk_fng2: { pt: `Neutro`, en: `Neutral`, es: `Neutral`, fr: `Neutre` },
  mk_fng3: { pt: `Ganância`, en: `Greed`, es: `Codicia`, fr: `Cupidité` },
  mk_fng4: { pt: `Ganância extrema`, en: `Extreme greed`, es: `Codicia extrema`, fr: `Cupidité extrême` },
  mk_gain: { pt: `🔥 Maiores subidas (24 h)`, en: `🔥 Top gainers (24 h)`, es: `🔥 Mayores subidas (24 h)`, fr: `🔥 Plus fortes hausses (24 h)` },
  mk_lose: { pt: `🧊 Maiores quedas (24 h)`, en: `🧊 Top losers (24 h)`, es: `🧊 Mayores caídas (24 h)`, fr: `🧊 Plus fortes baisses (24 h)` },
  mk_c_name: { pt: `Token`, en: `Token`, es: `Token`, fr: `Token` },
  mk_c_price: { pt: `Preço`, en: `Price`, es: `Precio`, fr: `Prix` },
  mk_c_vol: { pt: `Volume 24 h`, en: `Volume 24 h`, es: `Volumen 24 h`, fr: `Volume 24 h` },
  mk_c_cap: { pt: `Capitalização`, en: `Market cap`, es: `Capitalización`, fr: `Capitalisation` },
  mk_c_chart: { pt: `7 dias`, en: `7 days`, es: `7 días`, fr: `7 jours` },
  mk_more: { pt: `Mostrar mais`, en: `Show more`, es: `Mostrar más`, fr: `Afficher plus` },
  mk_loading: { pt: `A carregar o mercado…`, en: `Loading the market…`, es: `Cargando el mercado…`, fr: `Chargement du marché…` },
  mk_empty: { pt: `Nenhum token encontrado.`, en: `No tokens found.`, es: `Ningún token encontrado.`, fr: `Aucun token trouvé.` },
  mk_empty_fav: { pt: `Ainda não tens favoritos: carrega na ☆ de um token para o guardar.`, en: `No favourites yet: tap the ☆ on a token to save it.`, es: `Aún no tienes favoritos: pulsa la ☆ de un token para guardarlo.`, fr: `Pas encore de favoris : appuyez sur la ☆ d'un token pour l'enregistrer.` },
  mk_searching: { pt: `A procurar em todos os tokens…`, en: `Searching all tokens…`, es: `Buscando en todos los tokens…`, fr: `Recherche dans tous les tokens…` },
  mk_err: { pt: `Não foi possível carregar o mercado. A tentar de novo em breve.`, en: `Could not load the market. Retrying soon.`, es: `No se pudo cargar el mercado. Reintentando pronto.`, fr: `Impossible de charger le marché. Nouvel essai bientôt.` },
  mk_stale: { pt: `Dados em cache: o servidor está a limitar pedidos.`, en: `Cached data: the server is rate-limiting requests.`, es: `Datos en caché: el servidor limita las peticiones.`, fr: `Données en cache : le serveur limite les requêtes.` },
  mk_src: { pt: `Fonte`, en: `Source`, es: `Fuente`, fr: `Source` },
  mk_tokens: { pt: `tokens`, en: `tokens`, es: `tokens`, fr: `tokens` },
  mk_d_range: { pt: `Mín. / máx. 24 h`, en: `24 h low / high`, es: `Mín. / máx. 24 h`, fr: `Min. / max. 24 h` },
  mk_d_ath: { pt: `Máximo histórico`, en: `All-time high`, es: `Máximo histórico`, fr: `Plus haut historique` },
  mk_d_supply: { pt: `Em circulação`, en: `Circulating supply`, es: `En circulación`, fr: `En circulation` },
  mk_d_open: { pt: `Abrir no CoinGecko`, en: `Open on CoinGecko`, es: `Abrir en CoinGecko`, fr: `Ouvrir sur CoinGecko` },
  mk_note: { pt: `Preços de CoinGecko (com a Binance como reserva), atualizados a cada 90 s enquanto esta aba está aberta. A pesquisa chega a todos os tokens, mesmo fora da lista carregada. Informação, não é aconselhamento financeiro.`, en: `Prices from CoinGecko (with Binance as a fallback), refreshed every 90 s while this tab is open. Search reaches every token, even outside the loaded list. Information only, not financial advice.`, es: `Precios de CoinGecko (con Binance como respaldo), actualizados cada 90 s mientras esta pestaña está abierta. La búsqueda llega a todos los tokens, incluso fuera de la lista cargada. Solo información, no es asesoramiento financiero.`, fr: `Prix de CoinGecko (avec Binance en secours), actualisés toutes les 90 s tant que cet onglet est ouvert. La recherche couvre tous les tokens, même hors de la liste chargée. Information uniquement, pas un conseil financier.` }
});

(function(){
  const KEY = 'hc_mkt', CKEY = 'hc_mkt_cache', API = 'https://api.coingecko.com/api/v3';
  const CUR = ['eur', 'usd', 'gbp', 'brl'], LOC = { pt: 'pt-PT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR' };
  const PAGE = 250, MAXPAGES = 20, SHOW = 100, EVERY = 90000;
  const S = { cur: 'eur', k: 'rank', dir: 1, view: 'all', q: '', favs: [], rows: [], extra: [], pages: 2, shown: SHOW, glob: null, fng: null,
    src: '', ts: 0, loading: false, err: false, stale: false, open: '', searching: false, prev: {} };
  let root = null, timer = null, gTs = 0, qTimer = null, qSeq = 0;
  try { const o = JSON.parse(localStorage.getItem(KEY) || '{}');
    if(CUR.includes(o.cur)) S.cur = o.cur;
    if(['rank', 'name', 'price', 'c1', 'c24', 'c7', 'vol', 'mc'].includes(o.k)) { S.k = o.k; S.dir = o.dir === -1 ? -1 : 1; }
    if(['all', 'fav', 'up', 'down'].includes(o.view)) S.view = o.view;
    if(Array.isArray(o.favs)) S.favs = o.favs.filter(x => typeof x === 'string').slice(0, 200);
  } catch(e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ cur: S.cur, k: S.k, dir: S.dir, view: S.view, favs: S.favs })); } catch(e) {} };
  const L = () => LOC[typeof currentLang !== 'undefined' ? currentLang : 'pt'] || 'pt-PT';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $m = id => document.getElementById(id);

  // ---------- formatação ----------
  function money(v, compact){
    if(num(v) == null) return '—';
    try {
      if(compact) return new Intl.NumberFormat(L(), { style: 'currency', currency: S.cur.toUpperCase(), notation: 'compact', maximumFractionDigits: 2 }).format(v);
      const a = Math.abs(v), d = a >= 1 ? 2 : a >= 0.01 ? 4 : a >= 0.0001 ? 6 : 8;
      return new Intl.NumberFormat(L(), { style: 'currency', currency: S.cur.toUpperCase(), minimumFractionDigits: Math.min(d, 2), maximumFractionDigits: d }).format(v);
    } catch(e) { return String(v); }
  }
  function pct(v){
    if(num(v) == null) return '<span class="mk-na">—</span>';
    const s = (v > 0 ? '+' : '') + v.toFixed(2).replace('.', L().startsWith('en') ? '.' : ',') + '%';
    return '<span class="' + (v > 0.005 ? 'mk-pos' : v < -0.005 ? 'mk-neg' : 'mk-flat') + '">' + s + '</span>';
  }
  function bigNum(v){ return num(v) == null ? '—' : new Intl.NumberFormat(L(), { notation: 'compact', maximumFractionDigits: 2 }).format(v); }

  // ---------- gráfico de 7 dias ----------
  function spark(a, w, h){
    if(!a || a.length < 2) return '';
    let mn = Infinity, mx = -Infinity; for(const v of a){ if(v < mn) mn = v; if(v > mx) mx = v; }
    const r = mx - mn || 1, st = w / (a.length - 1);
    const pts = a.map((v, i) => (i * st).toFixed(1) + ',' + (h - 2 - ((v - mn) / r) * (h - 4)).toFixed(1)).join(' ');
    const up = a[a.length - 1] >= a[0], c = up ? '#21d98a' : '#ff5d6c';
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="' + c + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" points="' + pts + '"/></svg>';
  }

  // ---------- dados ----------
  function norm(c, i){
    const sp = c.sparkline_in_7d && Array.isArray(c.sparkline_in_7d.price) ? c.sparkline_in_7d.price : null;
    return { id: String(c.id), sym: String(c.symbol || '').toUpperCase(), name: String(c.name || c.id), img: typeof c.image === 'string' && c.image.startsWith('https://') ? c.image : '',
      price: num(c.current_price), c1: num(c.price_change_percentage_1h_in_currency), c24: num(c.price_change_percentage_24h_in_currency != null ? c.price_change_percentage_24h_in_currency : c.price_change_percentage_24h),
      c7: num(c.price_change_percentage_7d_in_currency), vol: num(c.total_volume), mc: num(c.market_cap), rank: num(c.market_cap_rank) || 100000 + i,
      spark: sp ? sp.filter((_, j) => j % 4 === 0 || j === sp.length - 1) : null, hi: num(c.high_24h), lo: num(c.low_24h), ath: num(c.ath), athp: num(c.ath_change_percentage), sup: num(c.circulating_supply) };
  }
  async function jget(url, ms){
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), ms || 15000);
    try { const r = await fetch(url, { signal: ac.signal, headers: { accept: 'application/json' } }); if(!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; } return await r.json(); }
    finally { clearTimeout(to); }
  }
  const mUrl = (extra) => API + '/coins/markets?vs_currency=' + S.cur + '&sparkline=true&price_change_percentage=1h,24h,7d&' + extra;
  const fetchPage = async n => (await jget(mUrl('order=market_cap_desc&per_page=' + PAGE + '&page=' + n))).map((c, i) => norm(c, (n - 1) * PAGE + i));
  const fetchIds = async ids => (await jget(mUrl('ids=' + encodeURIComponent(ids.join(',')) + '&per_page=' + PAGE))).map(norm);

  async function fetchBinance(){
    const all = await jget('https://api.binance.com/api/v3/ticker/24hr', 25000);
    const px = {}; all.forEach(t => { px[t.symbol] = t; });
    const eu = px.EURUSDT && parseFloat(px.EURUSDT.lastPrice), gb = px.GBPUSDT && parseFloat(px.GBPUSDT.lastPrice), br = px.USDTBRL && parseFloat(px.USDTBRL.lastPrice);
    const rate = S.cur === 'usd' ? 1 : S.cur === 'eur' ? (eu ? 1 / eu : 0) : S.cur === 'gbp' ? (gb ? 1 / gb : 0) : (br || 0);
    if(!rate) throw new Error('rate');
    const out = all.filter(t => t.symbol.endsWith('USDT') && !/(UP|DOWN|BULL|BEAR)USDT$/.test(t.symbol) && parseFloat(t.quoteVolume) > 0)
      .map(t => ({ id: t.symbol.slice(0, -4).toLowerCase(), sym: t.symbol.slice(0, -4), name: t.symbol.slice(0, -4), img: '', price: parseFloat(t.lastPrice) * rate,
        c1: null, c24: parseFloat(t.priceChangePercent), c7: null, vol: parseFloat(t.quoteVolume) * rate, mc: null, rank: 0, spark: null, hi: parseFloat(t.highPrice) * rate, lo: parseFloat(t.lowPrice) * rate, ath: null, athp: null, sup: null }));
    out.sort((a, b) => b.vol - a.vol); out.forEach((r, i) => { r.rank = i + 1; });
    return out;
  }
  async function loadGlobal(){
    if(Date.now() - gTs < 240000) return; gTs = Date.now();
    try { const g = (await jget(API + '/global')).data; S.glob = { cap: g.total_market_cap[S.cur], vol: g.total_volume[S.cur], btc: g.market_cap_percentage.btc, eth: g.market_cap_percentage.eth, ch: g.market_cap_change_percentage_24h_usd }; } catch(e) {}
    try { const f = (await jget('https://api.alternative.me/fng/?limit=1')).data[0]; S.fng = { v: parseInt(f.value, 10) }; } catch(e) {}
    drawSummary();
  }
  function readCache(){
    try { const o = JSON.parse(localStorage.getItem(CKEY) || 'null'); if(o && o.cur === S.cur && Array.isArray(o.rows) && Date.now() - o.ts < 3600e3) { S.rows = o.rows; S.ts = o.ts; S.src = o.src || 'CoinGecko'; return true; } } catch(e) {}
    return false;
  }
  function writeCache(){ try { localStorage.setItem(CKEY, JSON.stringify({ cur: S.cur, ts: S.ts, src: S.src, rows: S.rows.slice(0, PAGE) })); } catch(e) {} }

  async function load(force){
    if(S.loading) return; S.loading = true; S.err = false; drawStatus();
    loadGlobal();
    try {
      let fresh = [], gotCG = false;
      try {
        for(let p = 1; p <= S.pages; p++){
          if(p > 1) await sleep(1300);
          const part = await fetchPage(p); fresh = fresh.concat(part); gotCG = true;
          const keep = S.src === 'CoinGecko' ? S.rows.slice(fresh.length) : [];
          absorb(fresh.concat(keep)); S.src = 'CoinGecko'; S.stale = false; S.ts = Date.now();
          draw();
        }
        writeCache();
      } catch(e) {
        if(gotCG) { S.stale = true; }
        else if(S.rows.length && S.src === 'CoinGecko') { S.stale = true; }
        else { const b = await fetchBinance(); absorb(b); S.src = 'Binance'; S.stale = false; S.ts = Date.now(); }
      }
      await ensureFavs();
    } catch(e) { S.err = !S.rows.length; }
    S.loading = false; draw();
  }
  function absorb(rows){
    S.rows.forEach(r => { S.prev[r.id] = r.price; });
    S.extra.forEach(r => { S.prev[r.id] = r.price; });
    S.rows = rows;
  }
  async function ensureFavs(){
    if(S.src !== 'CoinGecko') return;
    const have = new Set(S.rows.map(r => r.id)), miss = S.favs.filter(id => !have.has(id)).slice(0, 50);
    if(!miss.length) { S.extra = S.extra.filter(r => !have.has(r.id)); return; }
    try { await sleep(600); const got = await fetchIds(miss); const ids = new Set(got.map(r => r.id)); S.extra = got.concat(S.extra.filter(r => !ids.has(r.id) && !have.has(r.id))); } catch(e) {}
  }
  // pesquisa em todos os tokens (também os que não estão nas páginas carregadas)
  function remoteSearch(){
    clearTimeout(qTimer);
    const q = S.q.trim();
    if(q.length < 2 || S.src !== 'CoinGecko') { S.searching = false; return; }
    const lq = q.toLowerCase();
    if(S.rows.concat(S.extra).filter(r => r.name.toLowerCase().includes(lq) || r.sym.toLowerCase() === lq).length >= 3) { S.searching = false; return; }
    S.searching = true; drawStatus();
    const seq = ++qSeq;
    qTimer = setTimeout(async () => {
      try {
        const s = await jget(API + '/search?query=' + encodeURIComponent(q));
        const ids = (s.coins || []).slice(0, 12).map(c => String(c.id));
        if(seq !== qSeq) return;
        if(ids.length){ const got = await fetchIds(ids); const have = new Set(S.rows.map(r => r.id)); const keep = new Map(S.extra.map(r => [r.id, r]));
          got.forEach(r => { if(!have.has(r.id)) keep.set(r.id, r); }); S.extra = [...keep.values()].slice(-120); }
      } catch(e) {}
      if(seq === qSeq){ S.searching = false; draw(); }
    }, 650);
  }

  // ---------- desenho ----------
  function visible(){
    let a = S.rows.concat(S.extra.filter(e => !S.rows.some(r => r.id === e.id)));
    if(S.view === 'fav') a = a.filter(r => S.favs.includes(r.id));
    else if(S.view === 'up') a = a.filter(r => num(r.c24) != null && r.c24 > 0);
    else if(S.view === 'down') a = a.filter(r => num(r.c24) != null && r.c24 < 0);
    const q = S.q.trim().toLowerCase();
    if(q) a = a.filter(r => r.name.toLowerCase().includes(q) || r.sym.toLowerCase().includes(q) || r.id.includes(q));
    const k = S.k, d = S.dir;
    a = a.slice().sort((x, y) => {
      if(k === 'name') return d * x.name.localeCompare(y.name);
      let vx = k === 'rank' && S.src === 'Binance' ? -(x.vol || 0) : x[k], vy = k === 'rank' && S.src === 'Binance' ? -(y.vol || 0) : y[k];
      const nx = num(vx) == null, ny = num(vy) == null; if(nx || ny) return nx === ny ? 0 : nx ? 1 : -1;
      return d * (vx - vy);
    });
    return a;
  }
  function rowHtml(r){
    const fav = S.favs.includes(r.id), p = S.prev[r.id], fl = p != null && r.price != null && p !== r.price ? (r.price > p ? ' mk-fup' : ' mk-fdn') : '';
    let h = '<tr class="mk-row' + fl + (S.open === r.id ? ' mk-open' : '') + '" data-id="' + esc(r.id) + '">' +
      '<td class="mk-star" data-star="' + esc(r.id) + '" role="button" aria-label="favorito" title="⭐">' + (fav ? '★' : '☆') + '</td>' +
      '<td class="mk-rk">' + (r.rank < 100000 ? r.rank : '') + '</td>' +
      '<td class="mk-nm">' + (r.img ? '<img src="' + esc(r.img) + '" alt="" loading="lazy" width="22" height="22" onerror="this.style.visibility=\'hidden\'">' : '<span class="mk-ph">' + esc(r.sym.slice(0, 2)) + '</span>') + '<b>' + esc(r.name) + '</b><small>' + esc(r.sym) + '</small></td>' +
      '<td class="mk-pr">' + money(r.price) + '</td><td>' + pct(r.c1) + '</td><td>' + pct(r.c24) + '</td><td>' + pct(r.c7) + '</td>' +
      '<td class="mk-vl">' + money(r.vol, true) + '</td><td class="mk-vl">' + money(r.mc, true) + '</td><td class="mk-sp">' + spark(r.spark, 110, 30) + '</td></tr>';
    if(S.open === r.id){
      h += '<tr class="mk-detail"><td colspan="10"><div class="mk-dg">' +
        '<div><small>' + t('mk_d_range') + '</small><b>' + money(r.lo) + ' – ' + money(r.hi) + '</b></div>' +
        '<div><small>' + t('mk_d_ath') + '</small><b>' + money(r.ath) + (r.athp != null ? ' ' + pct(r.athp) : '') + '</b></div>' +
        '<div><small>' + t('mk_d_supply') + '</small><b>' + bigNum(r.sup) + ' ' + esc(r.sym) + '</b></div>' +
        '<div class="mk-big">' + spark(r.spark, 320, 70) + '</div>' +
        (S.src === 'CoinGecko' ? '<a href="https://www.coingecko.com/en/coins/' + encodeURIComponent(r.id) + '" target="_blank" rel="noopener noreferrer">' + t('mk_d_open') + ' ↗</a>' : '') +
        '</div></td></tr>';
    }
    return h;
  }
  function draw(){
    if(!root) return;
    drawSummary(); drawMovers(); drawStatus();
    const a = visible(), body = $m('mkBody'); if(!body) return;
    const empty = $m('mkEmpty'), more = $m('mkMore');
    body.innerHTML = a.slice(0, S.shown).map(rowHtml).join('');
    S.prev = {}; S.rows.concat(S.extra).forEach(r => { S.prev[r.id] = r.price; });
    empty.hidden = a.length > 0 || S.loading;
    empty.textContent = S.err ? t('mk_err') : S.view === 'fav' && !S.q ? t('mk_empty_fav') : (S.loading && !S.rows.length) ? t('mk_loading') : t('mk_empty');
    if(S.loading && !S.rows.length) empty.hidden = false;
    const canMore = a.length > S.shown || (S.view === 'all' && !S.q.trim() && S.src === 'CoinGecko' && S.rows.length >= S.pages * PAGE && S.pages < MAXPAGES);
    more.hidden = !canMore;
    root.querySelectorAll('th[data-k]').forEach(th => { const on = th.dataset.k === S.k; th.classList.toggle('mk-on', on); th.dataset.ar = on ? (S.dir === 1 ? '▲' : '▼') : ''; });
    root.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === S.view));
  }
  function drawSummary(){
    const el = $m('mkSum'); if(!el) return;
    const g = S.glob, f = S.fng;
    const fi = f ? (f.v <= 25 ? 0 : f.v <= 45 ? 1 : f.v <= 55 ? 2 : f.v <= 75 ? 3 : 4) : -1;
    el.innerHTML =
      '<div class="mk-card"><small>' + t('mk_cap') + '</small><b>' + (g ? money(g.cap, true) : '—') + '</b>' + (g ? pct(g.ch) : '') + '</div>' +
      '<div class="mk-card"><small>' + t('mk_vol24') + '</small><b>' + (g ? money(g.vol, true) : '—') + '</b></div>' +
      '<div class="mk-card"><small>' + t('mk_dom') + '</small><b>' + (g ? g.btc.toLocaleString(L(), { maximumFractionDigits: 1 }) + '% / ' + g.eth.toLocaleString(L(), { maximumFractionDigits: 1 }) + '%' : '—') + '</b>' +
        (g ? '<div class="mk-bar"><i style="width:' + g.btc.toFixed(1) + '%"></i><i class="e" style="width:' + g.eth.toFixed(1) + '%"></i></div>' : '') + '</div>' +
      '<div class="mk-card"><small>' + t('mk_fng') + '</small><b>' + (f ? f.v + ' · ' + t('mk_fng' + fi) : '—') + '</b>' +
        (f ? '<div class="mk-bar mk-fg"><i style="left:' + Math.max(1, Math.min(99, f.v)) + '%"></i></div>' : '') + '</div>';
  }
  function drawMovers(){
    const el = $m('mkMov'); if(!el) return;
    const pool = S.rows.filter(r => r.mc && num(r.c24) != null).slice(0, 250);
    if(pool.length < 20) { el.innerHTML = ''; return; }
    const s = pool.slice().sort((a, b) => b.c24 - a.c24);
    const chip = r => '<button type="button" class="mk-chip" data-q="' + esc(r.sym) + '"><b>' + esc(r.sym) + '</b>' + pct(r.c24) + '</button>';
    el.innerHTML = '<div><span>' + t('mk_gain') + '</span>' + s.slice(0, 6).map(chip).join('') + '</div><div><span>' + t('mk_lose') + '</span>' + s.slice(-6).reverse().map(chip).join('') + '</div>';
  }
  function drawStatus(){
    const el = $m('mkStat'); if(!el) return;
    const tm = S.ts ? new Date(S.ts).toLocaleTimeString(L()) : '';
    el.textContent = (S.loading ? '⟳ ' : '') + (S.searching ? t('mk_searching') + ' ' : '') + (S.rows.length ? S.rows.length + ' ' + t('mk_tokens') + ' · ' + t('mk_src') + ': ' + S.src + (tm ? ' · ' + tm : '') : '') + (S.stale ? ' · ' + t('mk_stale') : '');
  }

  // ---------- estrutura e eventos ----------
  function build(){
    root = $m('tab-mercado'); if(!root || root.dataset.mkBuilt) return;
    root.dataset.mkBuilt = '1';
    const c = document.createElement('div'); c.className = 'blocks-container mk-wrap';
    c.innerHTML =
      '<div id="mkSum" class="mk-sum"></div>' +
      '<div class="panel mk-panel">' +
        '<div class="mk-tools">' +
          '<input type="search" id="mkQ" data-i18n-placeholder="mk_search" placeholder="' + esc(t('mk_search')) + '" autocomplete="off" spellcheck="false">' +
          '<select id="mkCur" aria-label="moeda">' + CUR.map(x => '<option value="' + x + '">' + x.toUpperCase() + '</option>').join('') + '</select>' +
          '<div class="mk-views"><button type="button" data-view="all" data-i18n="mk_all">' + t('mk_all') + '</button><button type="button" data-view="fav" data-i18n="mk_fav">' + t('mk_fav') + '</button><button type="button" data-view="up" data-i18n="mk_up">' + t('mk_up') + '</button><button type="button" data-view="down" data-i18n="mk_down">' + t('mk_down') + '</button></div>' +
          '<button type="button" id="mkRef" class="config ghost mk-ref" data-i18n="mk_refresh">' + t('mk_refresh') + '</button>' +
        '</div>' +
        '<div id="mkMov" class="mk-mov"></div>' +
        '<div class="mk-scroll"><table class="mk-table"><thead><tr>' +
          '<th class="mk-star"></th><th data-k="rank" class="mk-rk">#</th><th data-k="name" class="mk-nm" data-i18n="mk_c_name">' + t('mk_c_name') + '</th>' +
          '<th data-k="price" data-i18n="mk_c_price">' + t('mk_c_price') + '</th><th data-k="c1">1h</th><th data-k="c24">24h</th><th data-k="c7">7d</th>' +
          '<th data-k="vol" data-i18n="mk_c_vol">' + t('mk_c_vol') + '</th><th data-k="mc" data-i18n="mk_c_cap">' + t('mk_c_cap') + '</th><th data-i18n="mk_c_chart">' + t('mk_c_chart') + '</th>' +
        '</tr></thead><tbody id="mkBody"></tbody></table></div>' +
        '<div id="mkEmpty" class="mk-empty"></div>' +
        '<button type="button" id="mkMore" class="config mk-more" data-i18n="mk_more" hidden>' + t('mk_more') + '</button>' +
        '<div id="mkStat" class="mk-stat"></div>' +
        '<div class="hint mk-note" data-i18n="mk_note">' + t('mk_note') + '</div>' +
      '</div>';
    root.appendChild(c);
    $m('mkCur').value = S.cur;
    $m('mkQ').addEventListener('input', e => { S.q = e.target.value; S.shown = SHOW; draw(); remoteSearch(); });
    $m('mkCur').addEventListener('change', e => { S.cur = e.target.value; S.rows = []; S.extra = []; S.glob = null; gTs = 0; S.prev = {}; S.src = ''; save(); readCache(); draw(); load(true); });
    $m('mkRef').addEventListener('click', () => { gTs = 0; load(true); });
    $m('mkMore').addEventListener('click', () => {
      const a = visible();
      if(a.length > S.shown) { S.shown += SHOW; draw(); }
      else if(S.pages < MAXPAGES) { S.pages++; S.shown += SHOW; load(true); }
    });
    root.addEventListener('click', e => {
      const th = e.target.closest('th[data-k]');
      if(th){ const k = th.dataset.k; if(S.k === k) S.dir = -S.dir; else { S.k = k; S.dir = (k === 'rank' || k === 'name') ? 1 : -1; } save(); draw(); return; }
      const vb = e.target.closest('[data-view]');
      if(vb){ S.view = vb.dataset.view; S.shown = SHOW; save(); draw(); return; }
      const ch = e.target.closest('.mk-chip');
      if(ch){ S.q = ch.dataset.q; $m('mkQ').value = S.q; S.view = 'all'; draw(); return; }
      const st = e.target.closest('[data-star]');
      if(st){ const id = st.dataset.star, i = S.favs.indexOf(id); if(i >= 0) S.favs.splice(i, 1); else S.favs.push(id); save(); draw(); if(i < 0) ensureFavs(); return; }
      const tr = e.target.closest('tr.mk-row');
      if(tr && !e.target.closest('a')){ S.open = S.open === tr.dataset.id ? '' : tr.dataset.id; draw(); }
    });
    if(typeof applyTranslations === 'function') applyTranslations();
  }
  function start(){
    build(); stop();
    if(!S.rows.length) readCache();
    draw();
    load(false);
    timer = setInterval(() => { if(!document.hidden && !(typeof hcPaused === 'function' && hcPaused())) load(false); }, EVERY);
  }
  function stop(){ if(timer){ clearInterval(timer); timer = null; } }

  const sw = window.switchTab;
  if(typeof sw === 'function') window.switchTab = function(name){ const r = sw.apply(this, arguments); if(name === 'mercado') start(); else stop(); return r; };
  window.hcMarket = { open(){ const b = document.querySelector('.tab-btn[onclick*="\'mercado\'"]'); if(b) b.click(); }, state: S };
})();
