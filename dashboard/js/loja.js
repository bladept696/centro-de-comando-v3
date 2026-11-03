// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Aba Loja Bitminer33 ----------
// Montra das máquinas da Bitminer33 (https://www.bitminer33.xyz/comprar): imagem, preço, preço em sats ao câmbio do momento,
// €/TH e eficiência. "Comprar" abre o WhatsApp da loja com a mensagem já escrita; a venda é feita direto com a Bitminer33.
// Os produtos, preços e imagens vêm do site da loja pelo servidor (/api/shop/products); LJ_DATA é a lista de reserva e os nomes arrumados.
Object.assign(I18N_DICT, {
  loja_t: { pt: `Loja Bitminer33`, en: `Bitminer33 Shop`, es: `Tienda Bitminer33`, fr: `Boutique Bitminer33` },
  ab_loja: { pt: `Máquinas modificadas e originais da Bitminer33, com pagamento em Bitcoin.`, en: `Modified and original miners from Bitminer33, paid in Bitcoin.`, es: `Máquinas modificadas y originales de Bitminer33, con pago en Bitcoin.`, fr: `Machines modifiées et d'origine de Bitminer33, payables en Bitcoin.` },
  lj_tag1: { pt: `Máquinas modificadas e originais`, en: `Modified and original miners`, es: `Máquinas modificadas y originales`, fr: `Machines modifiées et d'origine` },
  lj_tag2: { pt: `Aceitamos pagamento em Bitcoin`, en: `We accept Bitcoin payments`, es: `Aceptamos pago en Bitcoin`, fr: `Paiement en Bitcoin accepté` },
  lj_whats: { pt: `Falar no WhatsApp`, en: `Chat on WhatsApp`, es: `Hablar por WhatsApp`, fr: `Discuter sur WhatsApp` },
  lj_site: { pt: `Ver o site`, en: `Visit the site`, es: `Ver el sitio`, fr: `Voir le site` },
  lj_yt: { pt: `Canal YouTube`, en: `YouTube channel`, es: `Canal de YouTube`, fr: `Chaîne YouTube` },
  lj_all: { pt: `Tudo`, en: `All`, es: `Todo`, fr: `Tout` },
  lj_miners: { pt: `⛏️ Mineradoras`, en: `⛏️ Miners`, es: `⛏️ Mineras`, fr: `⛏️ Mineurs` },
  lj_wallets: { pt: `🔐 Carteiras`, en: `🔐 Wallets`, es: `🔐 Carteras`, fr: `🔐 Portefeuilles` },
  lj_parts: { pt: `🔌 Acessórios`, en: `🔌 Accessories`, es: `🔌 Accesorios`, fr: `🔌 Accessoires` },
  lj_sort: { pt: `Ordenar`, en: `Sort`, es: `Ordenar`, fr: `Trier` },
  lj_s_feat: { pt: `Destaques`, en: `Featured`, es: `Destacados`, fr: `En vedette` },
  lj_s_low: { pt: `Preço: mais baixo`, en: `Price: low to high`, es: `Precio: más bajo`, fr: `Prix : croissant` },
  lj_s_high: { pt: `Preço: mais alto`, en: `Price: high to low`, es: `Precio: más alto`, fr: `Prix : décroissant` },
  lj_s_ths: { pt: `Mais hashrate`, en: `Most hashrate`, es: `Más hashrate`, fr: `Plus de hashrate` },
  lj_s_eur: { pt: `Melhor €/TH`, en: `Best €/TH`, es: `Mejor €/TH`, fr: `Meilleur €/TH` },
  lj_buy: { pt: `Comprar`, en: `Buy`, es: `Comprar`, fr: `Acheter` },
  lj_more: { pt: `Ver no site`, en: `See on site`, es: `Ver en el sitio`, fr: `Voir sur le site` },
  lj_k_miner: { pt: `Mineradora`, en: `Miner`, es: `Minera`, fr: `Mineur` },
  lj_k_wallet: { pt: `Carteira fria`, en: `Cold wallet`, es: `Cartera fría`, fr: `Portefeuille froid` },
  lj_k_part: { pt: `Acessório`, en: `Accessory`, es: `Accesorio`, fr: `Accessoire` },
  lj_hot: { pt: `Mais procurada`, en: `Best seller`, es: `Más buscada`, fr: `Le plus demandé` },
  lj_best: { pt: `Melhor €/TH`, en: `Best €/TH`, es: `Mejor €/TH`, fr: `Meilleur €/TH` },
  lj_eff: { pt: `eficiência`, en: `efficiency`, es: `eficiencia`, fr: `efficacité` },
  lj_power: { pt: `consumo`, en: `power`, es: `consumo`, fr: `consommation` },
  lj_count: { pt: `{0} produtos`, en: `{0} products`, es: `{0} productos`, fr: `{0} produits` },
  lj_msg: { pt: `[Hash Commander] Olá Bitminer33! Venho da Hash Commander e quero comprar: {0}. Preço: {1} → {2} com os 5% de desconto da Hash Commander.`, en: `[Hash Commander] Hi Bitminer33! I came from Hash Commander and want to buy: {0}. Price: {1} → {2} with the Hash Commander 5% discount.`, es: `[Hash Commander] ¡Hola Bitminer33! Vengo de Hash Commander y quiero comprar: {0}. Precio: {1} → {2} con el 5% de descuento de Hash Commander.`, fr: `[Hash Commander] Bonjour Bitminer33 ! Je viens de Hash Commander et je veux acheter : {0}. Prix : {1} → {2} avec la réduction de 5 % Hash Commander.` },
  lj_msg0: { pt: `[Hash Commander] Olá Bitminer33! Venho da Hash Commander (5% de desconto) e tenho uma dúvida.`, en: `[Hash Commander] Hi Bitminer33! I came from Hash Commander (5% discount) and have a question.`, es: `[Hash Commander] ¡Hola Bitminer33! Vengo de Hash Commander (5% de descuento) y tengo una duda.`, fr: `[Hash Commander] Bonjour Bitminer33 ! Je viens de Hash Commander (5 % de réduction) et j'ai une question.` },
  lj_c_title: { pt: `5% de desconto ao comprar pela Hash Commander`, en: `5% off when you buy through Hash Commander`, es: `5% de descuento al comprar desde Hash Commander`, fr: `5 % de réduction en achetant via Hash Commander` },
  lj_c_sub: { pt: `Carrega em Comprar: a mensagem do WhatsApp já diz à Bitminer33 que vens da dashboard, e a loja aplica o desconto.`, en: `Press Buy: the WhatsApp message already tells Bitminer33 you came from the dashboard, and the shop applies the discount.`, es: `Pulsa Comprar: el mensaje de WhatsApp ya le dice a Bitminer33 que vienes del panel, y la tienda aplica el descuento.`, fr: `Appuyez sur Acheter : le message WhatsApp indique déjà à Bitminer33 que vous venez du tableau de bord, et la boutique applique la réduction.` },
  lj_c_save: { pt: `poupas {0}`, en: `you save {0}`, es: `ahorras {0}`, fr: `vous économisez {0}` },
  lj_p_disc: { pt: `−5% ao comprar pela dashboard`, en: `−5% when buying through the dashboard`, es: `−5% al comprar desde el panel`, fr: `−5 % en achetant via le tableau de bord` },
  lj_p_new: { pt: `Novo`, en: `New`, es: `Nuevo`, fr: `Nouveau` },
  lj_new: { pt: `Novidade`, en: `Just in`, es: `Novedad`, fr: `Nouveauté` },
  lj_n_title: { pt: `Produto novo na loja`, en: `New product in the shop`, es: `Producto nuevo en la tienda`, fr: `Nouveau produit dans la boutique` },
  lj_p_title: { pt: `Loja Bitminer33`, en: `Bitminer33 Shop`, es: `Tienda Bitminer33`, fr: `Boutique Bitminer33` },
  lj_p_sub: { pt: `Bitaxe, NerdQAxe e mais, prontas a minerar · desde {0}`, en: `Bitaxe, NerdQAxe and more, ready to mine · from {0}`, es: `Bitaxe, NerdQAxe y más, listas para minar · desde {0}`, fr: `Bitaxe, NerdQAxe et plus, prêts à miner · dès {0}` },
  lj_p_btc: { pt: `Paga em ₿ Bitcoin`, en: `Pay in ₿ Bitcoin`, es: `Paga en ₿ Bitcoin`, fr: `Payez en ₿ Bitcoin` },
  lj_p_go: { pt: `Ver a loja`, en: `Visit the shop`, es: `Ver la tienda`, fr: `Voir la boutique` },
  lj_note: { pt: `A venda, o pagamento e o envio são tratados diretamente com a Bitminer33; a mensagem do WhatsApp diz que vens da Hash Commander e é a loja que aplica os 5% de desconto. Produtos e preços lidos do site da loja de 6 em 6 horas; confirma sempre com a loja. O preço em sats usa o câmbio do momento.`, en: `Sale, payment and shipping are handled directly with Bitminer33; the WhatsApp message says you came from Hash Commander and the shop applies the 5% discount. Products and prices are read from the shop's site every 6 hours; always confirm with the shop. The sats price uses the current rate.`, es: `La venta, el pago y el envío se tratan directamente con Bitminer33; el mensaje de WhatsApp dice que vienes de Hash Commander y la tienda aplica el 5% de descuento. Productos y precios leídos del sitio de la tienda cada 6 horas; confirma siempre con la tienda. El precio en sats usa el cambio actual.`, fr: `La vente, le paiement et l'envoi se font directement avec Bitminer33 ; le message WhatsApp indique que vous venez de Hash Commander et c'est la boutique qui applique les 5 % de réduction. Produits et prix lus sur le site de la boutique toutes les 6 heures ; confirmez toujours avec la boutique. Le prix en sats utilise le taux du moment.` }
});
try { if(typeof applyTranslations === 'function') applyTranslations(); } catch(e) {}

const LJ_WA = '351910339375', LJ_SITE = 'https://www.bitminer33.xyz/comprar', LJ_YT = 'https://youtube.com/@bitminer33';
const LJ_IMG = 'https://lh7-us.googleusercontent.com/sitesv-images-rt/';
// k: miner | wallet | part · ths: hashrate em TH/s · w: consumo em watts (só quando a loja o indica)
const LJ_DATA = [
  { site: 'Nerdqaxe++ Parasite pool 4.9th/s rev5.1', n: 'NerdQAxe++ Parasite Pool', d: 'rev 5.1', k: 'miner', eur: 240, ths: 4.9, hot: true,
    img: 'AMxu72v9U3SLfqJRUQNS5JywcG7Yg1nwoKVg2hwTJVmgABaAOQAjNpV03wNOmF3_aYxkHG1WEznUt5tGm_t7tXOEHoGHTzSsT7Kw-SfH0uyvK75I7_slGzCJAYbGKbSdAwdkzM2Cu8YSIZn-f6GW6d58HIcA_syUUSh3giuirZJg1Vxb2CsVLroHTLUVm8w_FnXOdExCvDv_-_ArObe3uVKr6CfXN62hJUsm5HGwbV_vIuU=w1280' },
  { site: 'NerdOctaxe 11th/s Rev 3.3', n: 'NerdOctaxe', d: 'Rev 3.3', k: 'miner', eur: 399, ths: 11,
    img: 'AMxu72vmGq5ig9QJAs5J8NZ3toHYu8wJXgLCr2rM408KnavbfhGu_uz5q8IddFdCqb-UiEPf4V4kLKoHpsZky20A31ag6c6dtLiaJ5sqP7at458hhKJSfA2nAUy9phf5Dc_eS-kH7lP7EQGGtzITt1CI5WovkqHlxPSbx0bTAapaisyvY87ZSnicu9poCmURKQX8QKeObUyhom2CNpFLNYy65E751tl2ChhwfPu-tzqs=w1280' },
  { site: 'BITAXE GAMMA 2Th/s 36w', n: 'Bitaxe Gamma', d: '2 TH/s · 36 W', k: 'miner', eur: 120, ths: 2, w: 36,
    img: 'AMxu72vGf9nNC-o42mgc_OctchAOa9coc4OiQmDThp8Czckad6EsXmfY5vscZ1Hr6zkhaVVXIgGAVqObdSdOxtQ0sdqmyiKvjCywSx_aKCpJxQgND5lJwQFnqU_htOMUjyKa3XPmdpvUzy1wNBRXxTgnhqlZdlriURj9zl0c-jZU5YZfPdTgyhX1K32VVlPNzid75u68FyUWF01tyx_1mg3nVWzjqMhKT2Tu7Xx-RBjz580=w1280' },
  { site: 'NerdqAxe++ 6th/s rev 6.1 dual fan', n: 'NerdQAxe++', d: 'rev 6.1 · dual fan', k: 'miner', eur: 249, ths: 6,
    img: 'AMxu72sWL_ulB4zRs0fOtGpr-ABbGH9ezC5DDN7l3QsimWhCQ2120L9PZ6XbAgXTek6qJaTc4B9lyfGPc5M5Z_dep9wUbwio21oMniQyzi5jN5fwJQoA1Q9lKS7vVFRalWpLt_bk9vo8Dd0m6OApQkoXWmmifDNuyUidUBuoUnaq5a_t-KCarFZwl4K1gKpqIs_eBrV0Ybkmwp1xMsVLGzTdzpyzauIgBjfxfis97ymUtTw=w1280' },
  { site: 'MINERADORA DIY NAKAMOTO S19J+ 27TH 650W (depende da hash)', n: 'DIY Nakamoto S19j+', d: '27 TH/s · 650 W (depende da hash)', k: 'miner', eur: 399, ths: 27, w: 650,
    img: 'AMxu72soJ-GefNdQ330oYuupXWCODMKVDhq4_kr3gfTbYGYw2ThZdmk2ANvum2jEnokDnaNxQg1olQ_Yf5XVSdsvB_BZSs5ayAn4fMKA-9FbHpYEjdXCawZONDhxTVZekk3J_8i6PUzLvvQbyotHVskzrz-FHjB6wj6d1pMuWvnqnWJmH_72a-EAXdpGl1UievJOhUQfJK-LrOZ9UgPnBfrYyERZarJaqExyW80rnvuM=w1280' },
  { site: 'luckyaxe B401 8Th/s 150w', n: 'LuckyAxe B401', d: '8 TH/s · 150 W', k: 'miner', eur: 270, ths: 8, w: 150,
    img: 'AMxu72uIIW5PZN-EhMRtG6t1Kcf47ONlxOlxfVtIftch2GuDi3S53weZkwMgixJG1xSjb3ZbexoIEpFPRXgO7Ehj03-CvFRWzikhiIY7EZL0bu-7GAP6IVKRArYpdA7Ng73T0CE2hjaUbSNEnH4zPRZos7uD3g_OlPdWnjOYysjquo_PYQxNEEL7shACSsz38tJwVlcaQ0e8y2-K2XScUUdw-tAZwW9bzcj85zMhqhPXXD0=w1280' },
  { site: 'bitaxe gama 601 1.5th 30w', n: 'Bitaxe Gamma 601', d: '1.5 TH/s · 30 W', k: 'miner', eur: 90, ths: 1.5, w: 30,
    img: 'AMxu72vh6cznss6V01IZqdBVy_mvAYAnxHQwbOlwYV8qXE0pTSV3S25s6p-IEsrtmxva-n8zH3oEQS_dAl4LFnfm8_Tx6yxNGfhu_YWYVgyBbckrdVPjMVtMrzywjtyeziQ-OHHKSS45cNYYELS6WeGL-HeQJyohk1V8-1IFBL8ZOsZShkS-aprGmNVOrMXK9py6hqeWMoGkBEC85G1dOJPdbvaGgT2_8YrC2inXBBeUtY4=w1280' },
  { site: 'krux coldwallet', n: 'Krux', d: 'cold wallet', k: 'wallet', eur: 68,
    img: 'AMxu72tKcm6IWLvO6JmFu-57D5SWWPLxm7ouAkyjW0f4OJS5d_ORrmIaz-UE_Zca1CPTtOE-jgeNPAWPPQ6Fgl6toaHd66UYX4yigo9OZGkZid2L3tLijoV4zu47c3McVf5Wuaz3lYwyNCsPaglK9YuW9k66HLRawfIGEd_EHiGfbRTN_tzVNQjIwNejHzovpnSHLVYn1yoZuHAArasBLZCKCVcyItKGM3kYgp2DwlnXImo=w1280' },
  { site: 'SEEDER KIT - gerador de chaves bip-39 offline', n: 'Seeder Kit', d: 'gerador de chaves BIP-39 offline', k: 'wallet', eur: 29,
    img: 'AMxu72uKmlL_MluJrh85AuIAbNTvFyMyFZRKbJW-b9r1M2o9MAG9tEjNxlPWZyjOtN1MwHN-RyzrmS0TwexjUWLXHIbcLrCEHKz_BKQLVXzI0wZysPByU7X5IEQgru4AjXFEXY-1wzyPo8-F1Fssb_zXC4xussIFhaMhTB8Y9GSjfH_4PYyahYnP_rqEYX3MLuDACpwOrOJ72ejtl077MlsJ2roG5gDg1dYjMxAekchU8BQ=w1280' },
  { site: 'Fonte de energia meanwell 12v 350w', n: 'Fonte Mean Well', d: '12 V · 350 W', k: 'part', eur: 48,
    img: 'AMxu72vGGMyYlmRz2fjOvcSuHGHw7SFXtslX9LiKc79wX35Z4EVBpwbzzmiM1bUaJHzkKi4kAKFTljUmj_mmah-QpjSGL2DZeQ7djImN7M1SNjRXkaGqOW_w6gMm7L407IUcnZhPcgDx54G-U61qtAGamOC0900jP2XoZ1CGQQKQ7UEwmrO7fjWH1r1gC2MhZTq3grG2m9xKnWtzyQm88Ee07LA5AH-Gwe2_GcjRgFm8=w1280' }
];

(function(){
  const S = { view: 'all', sort: 'feat' };
  const KIND = { miner: ['lj_k_miner', '⛏️'], wallet: ['lj_k_wallet', '🔐'], part: ['lj_k_part', '🔌'] };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const loc = () => ({ pt: 'pt-PT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR' }[typeof currentLang !== 'undefined' ? currentLang : 'pt'] || 'pt-PT');
  const eurFmt = v => v.toLocaleString(loc(), { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const btcEur = () => { try { return Number(currentRates && currentRates.btc_eur) || 0; } catch(e) { return 0; } };
  const wa = txt => 'https://wa.me/' + LJ_WA + '?text=' + encodeURIComponent(txt);
  const perTh = p => p.ths ? p.eur / p.ths : Infinity;

  // ---------- 5% de desconto para quem compra pela dashboard ----------
  // O "Comprar" abre o WhatsApp da loja (número do site) com a mensagem já escrita a começar por [Hash Commander]:
  // é assim que a Bitminer33 sabe que o cliente veio da dashboard e aplica o desconto (combinado com a loja).
  const DISC = 0.05;
  const final = eur => Math.round(eur * (1 - DISC) * 100) / 100;
  const eur2 = v => v.toLocaleString(loc(), { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  // a máquina com o melhor €/TH leva o selo "Melhor €/TH"
  let bestIdx = 0;
  const calcBest = () => { bestIdx = LJ_DATA.reduce((b, p, i) => perTh(p) < perTh(LJ_DATA[b]) ? i : b, 0); };
  calcBest();
  // Imagem guardada neste PC pelo servidor (/shop-img/<nome do produto>): os links do Google Sites expiram.
  // Se ainda não houver cópia local, cai para o link do site (onerror troca para data-alt).
  const imgRemote = p => p.url || LJ_IMG + p.img;
  const imgUrl = p => p.site ? `${API_BASE}/shop-img/${keyOf(p.site).slice(0, 60)}` : imgRemote(p);
  const imgFallback = "if(this.dataset.alt){this.src=this.dataset.alt;this.dataset.alt='';return;}";

  // ---------- produtos atuais do site da loja (/api/shop/products, lido pelo servidor de 6 em 6 h) ----------
  // Os produtos conhecidos (LJ_DATA) ficam com os nomes e dados arrumados, mas com o preço e a imagem atuais;
  // os que saíram do site deixam de aparecer; os novos entram sozinhos (TH/s e W tirados do nome) e geram um aviso.
  const SKEY = 'hc_lj_seen', NEW_DAYS = 14;
  const keyOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  function fromSite(sp){
    const s = sp.name, num = x => x ? Number(x.replace(',', '.')) : 0;
    const ths = num((/(\d+(?:[.,]\d+)?)\s*th(?:\/s)?\b/i.exec(s) || [])[1]), w = num((/(\d{2,4})\s*w\b/i.exec(s) || [])[1]);
    const k = /wallet|seed|krux|bip-?39|jade|coldcard|trezor|ledger|passport/i.test(s) ? 'wallet' : ths ? 'miner' : 'part';
    return { site: s, n: s.replace(/\s+/g, ' ').trim(), d: '', k, eur: sp.eur, ths: ths || undefined, w: w || undefined, url: sp.img };
  }
  function mergeSite(list){
    if(!Array.isArray(list) || !list.length) return false;
    const known = {}; LJ_DATA.forEach(p => { if(p.site) known[keyOf(p.site)] = p; });
    let seen = {}; try { seen = JSON.parse(localStorage.getItem(SKEY) || '{}') || {}; } catch(e) {}
    const first = !Object.keys(seen).length, now = Date.now(), fresh = [];
    const merged = list.map(sp => {
      const key = keyOf(sp.name), base = known[key];
      const p = base ? Object.assign({}, base, { eur: sp.eur, url: sp.img }) : fromSite(sp);
      // na primeira leitura tudo o que já existe conta como visto (0 = sem selo "Novidade" nem aviso)
      if(!(key in seen)){ seen[key] = first ? 0 : now; if(!first) fresh.push(p); }
      p.fresh = seen[key] > 0 && now - seen[key] < NEW_DAYS * 864e5;
      return p;
    });
    try { localStorage.setItem(SKEY, JSON.stringify(seen)); } catch(e) {}
    LJ_DATA.splice(0, LJ_DATA.length, ...merged);
    calcBest();
    fresh.forEach(p => { try { addNotification('shop', t('lj_n_title'), p.n + ' — ' + eurFmt(p.eur), 'Loja Bitminer33'); } catch(e) {} });
    return true;
  }
  async function syncSite(){
    try {
      const d = await (await fetch(`${API_BASE}/api/shop/products`)).json();
      if(mergeSite(d && d.products)){ promo(); if(document.getElementById('ljGrid')) draw(); }
    } catch(e) {}
  }

  function card(p, i){
    const [kk, ki] = KIND[p.k], rate = btcEur();
    const fin = final(p.eur), sats = rate ? Math.round(fin / rate * 1e8) : 0;
    const specs = [];
    if(p.ths) specs.push('<span class="lj-spec hs"><b>' + p.ths.toLocaleString(loc()) + '</b> TH/s</span>');
    if(p.w) specs.push('<span class="lj-spec"><b>' + p.w + '</b> W <i>' + t('lj_power') + '</i></span>');
    if(p.ths && p.w) specs.push('<span class="lj-spec"><b>' + (p.w / p.ths).toFixed(1) + '</b> J/TH <i>' + t('lj_eff') + '</i></span>');
    if(p.ths) specs.push('<span class="lj-spec eur"><b>' + (p.eur / p.ths).toFixed(0) + ' €</b>/TH</span>');
    const badge = p.fresh ? '<span class="lj-badge fresh">✨ ' + t('lj_new') + '</span>' : i === bestIdx ? '<span class="lj-badge best">🏆 ' + t('lj_best') + '</span>' : p.hot ? '<span class="lj-badge hot">🔥 ' + t('lj_hot') + '</span>' : '';
    const name = p.n + (p.d ? ' — ' + p.d : '');
    return '<article class="lj-card k-' + p.k + '" data-i="' + i + '">' +
      '<div class="lj-media"><span class="lj-glow"></span>' +
        '<img loading="lazy" referrerpolicy="no-referrer" alt="' + esc(p.n) + '" src="' + esc(imgUrl(p)) + '" data-alt="' + esc(imgRemote(p)) + '" onerror="' + imgFallback + 'this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'lj-noimg\',textContent:\'' + ki + '\'}))">' +
        '<span class="lj-kind">' + ki + ' ' + t(kk) + '</span>' + badge +
      '</div>' +
      '<div class="lj-body">' +
        '<h3>' + esc(p.n) + '</h3><div class="lj-sub">' + esc(p.d || '') + '</div>' +
        (specs.length ? '<div class="lj-specs">' + specs.join('') + '</div>' : '') +
        '<div class="lj-price"><s>' + eurFmt(p.eur) + '</s><b>' + eur2(fin) + '</b><span class="lj-off">−5%</span>' +
          '<span class="lj-sats">' + t('lj_c_save').replace('{0}', eur2(Math.round((p.eur - fin) * 100) / 100)) + (sats ? ' · ≈ ' + sats.toLocaleString(loc()) + ' sats' : '') + '</span></div>' +
        '<div class="lj-acts">' +
          '<a class="lj-buy" target="_blank" rel="noopener" href="' + esc(wa(t('lj_msg').replace('{0}', name).replace('{1}', eurFmt(p.eur)).replace('{2}', eur2(fin)))) + '">🛒 ' + t('lj_buy') + '</a>' +
          '<a class="lj-more" target="_blank" rel="noopener" href="' + LJ_SITE + '">' + t('lj_more') + ' ↗</a>' +
        '</div>' +
      '</div></article>';
  }

  function draw(){
    const grid = document.getElementById('ljGrid'); if(!grid) return;
    let list = LJ_DATA.map((p, i) => [p, i]).filter(([p]) => S.view === 'all' || p.k === S.view);
    const by = { low: (a, b) => a[0].eur - b[0].eur, high: (a, b) => b[0].eur - a[0].eur,
      ths: (a, b) => (b[0].ths || 0) - (a[0].ths || 0), eur: (a, b) => perTh(a[0]) - perTh(b[0]) }[S.sort];
    if(by) list.sort(by);
    grid.innerHTML = list.map(([p, i]) => card(p, i)).join('');
    document.getElementById('ljCount').textContent = t('lj_count').replace('{0}', list.length);
    document.querySelectorAll('#ljViews button').forEach(b => b.classList.toggle('on', b.dataset.v === S.view));
    tilt(grid);
  }

  // inclinação 3D suave dos cartões ao passar o rato
  function tilt(grid){
    grid.querySelectorAll('.lj-card').forEach(c => {
      c.onpointermove = e => { const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        c.style.setProperty('--rx', (-y * 7).toFixed(2) + 'deg'); c.style.setProperty('--ry', (x * 9).toFixed(2) + 'deg');
        c.style.setProperty('--mx', ((x + .5) * 100).toFixed(0) + '%'); c.style.setProperty('--my', ((y + .5) * 100).toFixed(0) + '%'); };
      c.onpointerleave = () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); };
    });
  }

  function build(){
    const root = document.getElementById('tab-loja'); if(!root || root.dataset.ljBuilt) return;
    root.dataset.ljBuilt = '1';
    const c = document.createElement('div'); c.className = 'blocks-container lj-wrap';
    c.innerHTML =
      '<section class="lj-hero">' +
        '<div class="lj-hero-bg"></div>' +
        '<img class="lj-logo" src="bitminer33-banner.png" alt="Bitminer33">' +
        '<div class="lj-hero-txt"><h2>BITMINER33</h2>' +
          '<div class="lj-tags"><span data-i18n="lj_tag1">' + t('lj_tag1') + '</span><span class="btc" data-i18n="lj_tag2">₿ ' + t('lj_tag2') + '</span></div>' +
          '<div class="lj-hero-acts">' +
            '<a class="lj-wa" id="ljWa" target="_blank" rel="noopener" href="' + esc(wa(t('lj_msg0'))) + '"><span data-i18n="lj_whats">' + t('lj_whats') + '</span></a>' +
            '<a class="lj-ghost" target="_blank" rel="noopener" href="' + LJ_SITE + '"><span data-i18n="lj_site">' + t('lj_site') + '</span> ↗</a>' +
            '<a class="lj-ghost" target="_blank" rel="noopener" href="' + LJ_YT + '">▶ <span data-i18n="lj_yt">' + t('lj_yt') + '</span></a>' +
          '</div></div>' +
        '<div class="lj-coupon"><span class="lj-c-pct">5%</span>' +
          '<div class="lj-c-txt"><b data-i18n="lj_c_title">' + t('lj_c_title') + '</b><small data-i18n="lj_c_sub">' + t('lj_c_sub') + '</small></div>' +
          '</div>' +
      '</section>' +
      '<div class="panel lj-panel">' +
        '<div class="lj-tools">' +
          '<div class="lj-views" id="ljViews">' +
            '<button type="button" data-v="all" data-i18n="lj_all">' + t('lj_all') + '</button>' +
            '<button type="button" data-v="miner" data-i18n="lj_miners">' + t('lj_miners') + '</button>' +
            '<button type="button" data-v="wallet" data-i18n="lj_wallets">' + t('lj_wallets') + '</button>' +
            '<button type="button" data-v="part" data-i18n="lj_parts">' + t('lj_parts') + '</button>' +
          '</div>' +
          '<span class="lj-count" id="ljCount"></span>' +
          '<label class="lj-sort"><span data-i18n="lj_sort">' + t('lj_sort') + '</span><select id="ljSort">' +
            ['feat', 'low', 'high', 'ths', 'eur'].map(k => '<option value="' + k + '" data-i18n="lj_s_' + k + '">' + t('lj_s_' + k) + '</option>').join('') +
          '</select></label>' +
        '</div>' +
        '<div class="lj-grid" id="ljGrid"></div>' +
        '<div class="lj-note" data-i18n="lj_note">' + t('lj_note') + '</div>' +
      '</div>';
    root.appendChild(c);
    document.getElementById('ljViews').addEventListener('click', e => { const b = e.target.closest('button'); if(b){ S.view = b.dataset.v; draw(); } });
    document.getElementById('ljSort').addEventListener('change', e => { S.sort = e.target.value; draw(); });
    draw();
  }

  // ---------- destaque na página principal: faixa com a loja e as máquinas a passar ----------
  function goShop(){
    const b = [...document.querySelectorAll('.tab-btn')].find(x => (x.getAttribute('onclick') || '').includes("'loja'"));
    if(b && typeof switchTab === 'function'){ switchTab('loja', b); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }
  function promoItems(){
    const one = LJ_DATA.map((p, i) => '<button type="button" class="ljp-item" data-i="' + i + '" tabindex="-1">' +
      '<img loading="lazy" referrerpolicy="no-referrer" alt="" src="' + esc(imgUrl(p)) + '" data-alt="' + esc(imgRemote(p)) + '" onerror="' + imgFallback + 'this.style.visibility=\'hidden\'">' +
      '<span><b>' + esc(p.n) + '</b><i><s>' + eurFmt(p.eur) + '</s> ' + eur2(final(p.eur)) + (p.ths ? ' · ' + p.ths.toLocaleString(loc()) + ' TH/s' : '') + '</i></span></button>').join('');
    return one + one;   // duas vezes seguidas para a faixa dar a volta sem salto
  }
  function promo(){
    const spot = document.getElementById('gpSpotlight'); if(!spot) return;
    let el = document.getElementById('ljPromo');
    const min = Math.min(...LJ_DATA.map(p => p.eur));
    if(!el){
      el = document.createElement('section'); el.id = 'ljPromo'; el.className = 'ljp';
      spot.after(el);
      el.addEventListener('click', e => { if(!e.target.closest('a')) goShop(); });
    }
    el.innerHTML =
      '<div class="ljp-left">' +
        '<img class="ljp-logo" src="bitminer33-banner.png" alt="Bitminer33">' +
        '<div class="ljp-txt"><div class="ljp-title"><span class="ljp-new">' + t('lj_p_new') + '</span>🛒 ' + t('lj_p_title') + '</div>' +
          '<div class="ljp-sub">' + t('lj_p_sub').replace('{0}', eurFmt(min)) + '</div>' +
          '<div class="ljp-chips"><span class="ljp-btc">' + t('lj_p_btc') + '</span><span class="ljp-disc">🎟️ ' + t('lj_p_disc') + '</span></div></div>' +
        '<button type="button" class="ljp-go">' + t('lj_p_go') + ' →</button>' +
      '</div>' +
      '<div class="ljp-rail" aria-hidden="true"><div class="ljp-track">' + promoItems() + '</div></div>';
  }

  function onOpen(){
    build(); draw();
    // o preço em sats precisa do câmbio: se ainda não foi pedido (aba Conversor nunca aberta), pede-o uma vez
    if(!btcEur() && typeof fetchRates === 'function') Promise.resolve(fetchRates()).then(draw).catch(() => {});
  }
  // há scripts que guardam a switchTab antes desta: em vez de a embrulhar, vê-se quando a aba fica ativa
  const tab = document.getElementById('tab-loja');
  if(tab) new MutationObserver(() => { if(tab.classList.contains('active')) try { onOpen(); } catch(e) { console.error('[loja]', e); } })
    .observe(tab, { attributes: true, attributeFilter: ['class'] });
  const ol = window.setLanguage;
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', promo); else promo();
  // produtos atuais da loja: ao abrir o painel e depois de 6 em 6 horas (o aviso de produto novo chega mesmo sem abrir a aba)
  syncSite();
  setInterval(syncSite, 6 * 3600 * 1000);
  window.hcShopSync = syncSite;
  if(typeof ol === 'function') window.setLanguage = function(){ const r = ol.apply(this, arguments); try { promo(); if(document.getElementById('ljGrid')){ draw(); const w = document.getElementById('ljWa'); if(w) w.href = wa(t('lj_msg0')); } } catch(e) {} return r; };
})();
