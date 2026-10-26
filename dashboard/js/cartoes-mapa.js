// ---------- Cartões: mapa-múndi vivo da comunidade ----------
// Cada mineiro que partilha aparece como um ponto de luz no mapa, só ao nível do país (nunca a morada), com um
// pequeno desvio aleatório. O ponto pisca a cada share, o lado da noite escurece conforme a hora real e, quando
// alguém encontra um bloco, saem raios de luz dele para todos os outros pontos.
// O mapa (continentes) vem do Natural Earth (domínio público), reduzido a células de 2 graus.
const MC_WORLD_W = 180, MC_WORLD_H = 69;     // longitude -180..180, latitude 80..-58
const MC_WORLD_B64 = 'AAAAACd//////4AB/gAAAAB+AAAAAAAAAAB1D34////4AAYAAAMAAfwAAAAAAAAAAfm/wAf//wAAAAADgAf/4AHYAAAAAAH/3/8AP//gAAAAAODD///+DAAAgD4ADfz3/gP//gAAA4AMH///////wAgf////7934H//AAAP/gL//////////8f//////h+H/gAAAf/////////////c///////n+D8A+AB+/////////////Af/////5w8D4AIAH//////////////Af/////gHgB4AAAP5///////////P4AHoP///gH2AAAAAP4//////////+MAADQB///8H+AAAAGDz/////////8A8AAMAA////v/gAAAPDv/////////wB4AAAABf///v/wAAAbv///////////AwAAAAAP/////wAAAH////////////AAAAAAAH////88AAAD///////////9AAAAAAAD////+cAAAB///////////9AAAAAAAD/////AAAAB//7/P//////5AAAAAAAD////gAAAAf5vwPP//////jgAAAAAAD////gAAAAfi///n/////+CAAAAAAAD///+AAAAAfCLf/n/////MCAAAAAAAB///8AAAAAeexf///////mOAAAAAAAB///8AAAAAH/Ai///////G8AAAAAAAAf//4AAAAAf/iB///////hgAAAAAAAAP//wAAAAAf//////////gAAAAAAAAAP/owAAAAA/////f/////gAAAAAAAAAH/AQAAAAB///+/v/////AAAAAAAAAAD/AQAAAAD/////3/////gAAAAAAAAAAeA4AAAAD////f/D///+gAAAAABAAAAfGOAAAAH//////B/z/wAAAAAAAgAAAf8FwAAAD////v+A/h+wAAAAAAAAAAAH8AAAAAD////38A+B/AgAAAAAAAAAAAfgAAAAH/////wAcAfggAAAAAAAAAAAHgAAAAH////+AAcAfgwAAAAAAAAAAABD7AAAD/////wAMAXBYAAAAAAAAAAAA//AAAB/////wAOASAYAAAAAAAAAAAAH/gAAA/////gACAICYAAAAAAAAAAAAH/8AAAfP///AAAAsHAAAAAAAAAAAAAH/+AAAAD///AAAA8OAAAAAAAAAAAAAP/+AAAAD//8AAAAc+yAAAAAAAAAAAAf//gAAAD//4AAAAMfhgAAAAAAAAAAAP//+AAAB//wAAAAGdi/AAAAAAAAAAAf///AAAA//wAAAAGBwfsAAAAAAAAAAP///gAAA//wAAAAB4AHwAAAAAAAAAAP///gAAA//wAAAAANoDYIAAAAAAAAAH///AAAAf/wAAAAAAABAAAAAAAAAAAH//+AAAA//4gAAAAABxAAAAAAAAAAAD//+AAAA//5gAAAAAPxgBAAAAAAAAAB//+AAAA//zgAAAAAf/gABAAAAAAAAAf/8AAAA//DgAAAAA//wAAAAAAAAAAAf/8AAAA//DAAAAAD//4CAAAAAAAAAAf/4AAAAf/DAAAAAH//8AAAAAAAAAAA//gAAAAf+DAAAAAH//+AAAAAAAAAAA//AAAAAf+AAAAAAH//+AAAAAAAAAAA//AAAAAP8AAAAAAH//+AAAAAAAAAAA/+AAAAAH4AAAAAAH//+AAAAAAAAAAA/8AAAAAHwAAAAAAD4f8AAAAAAAAAAA/4AAAAAEAAAAAAADAP8AIAAAAAAAAB/wAAAAAAAAAAAAAAAD4AEAAAAAAAAB/gAAAAAAAAAAAAAAABQAGAAAAAAAAB+AAAAAAAAAAAAAAAAAwAMAAAAAAAAB8AAAAAAAAAAAAAAAAAQAYAAAAAAAAD4AAAAAAAAAAAAAAAAAABwAAAAAAAAD4AAAAAAAAAAAAAAAAAAAgAAAAAAAAD4AAAAAAAAAACAAAAAAAAAAAAAAAAADwgAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const MC_COUNTRIES = { PT: [39.5, -8], ES: [40, -3.7], FR: [46.6, 2.4], DE: [51, 10.4], GB: [54, -2.5], IE: [53.3, -8], IT: [42.8, 12.5], NL: [52.2, 5.3], BE: [50.6, 4.7], LU: [49.8, 6.1], CH: [46.8, 8.2], AT: [47.5, 14.5],
  SE: [62, 15], NO: [61, 9], DK: [56, 10], FI: [64, 26], IS: [65, -18], PL: [52, 19], CZ: [49.8, 15.5], SK: [48.7, 19.5], HU: [47, 19.5], RO: [45.9, 25], BG: [42.7, 25.5], GR: [39, 22], HR: [45.1, 15.2], RS: [44, 21],
  LT: [55.3, 24], LV: [57, 25], EE: [58.6, 25], UA: [49, 32], RU: [57, 45], TR: [39, 35], KZ: [48, 68], IL: [31, 35], SA: [24, 45], AE: [24, 54], IR: [32, 53], PK: [30, 70], IN: [22, 79], BD: [24, 90],
  CN: [35, 103], HK: [22.3, 114.2], TW: [23.7, 121], JP: [36, 138], KR: [36.5, 128], TH: [15, 101], VN: [16, 106], MY: [4, 102], SG: [1.3, 103.8], ID: [-2, 118], PH: [13, 122], AU: [-25, 134], NZ: [-41, 174],
  US: [39, -98], CA: [56, -100], MX: [23.6, -102], CU: [22, -79], DO: [19, -70], PA: [8.5, -80], CR: [10, -84], CO: [4.6, -74], VE: [7, -66], EC: [-1.8, -78], PE: [-9, -75], BO: [-17, -65], BR: [-10, -52],
  CL: [-33, -71], AR: [-34, -64], UY: [-33, -56], PY: [-23, -58], EG: [26, 30], MA: [32, -6], DZ: [28, 3], NG: [9, 8], KE: [0, 38], ZA: [-29, 24], AO: [-12.5, 18.5], MZ: [-18, 35], CV: [16, -24] };
const mcMap = { cv: null, ctx: null, raf: 0, last: 0, t: 0, land: null, ripples: [], arcs: [], parts: [], prevSh: {}, hover: null, mouse: null, visible: true, pts: [] };

function mcMapLand(){
  if(mcMap.land) return mcMap.land;
  const bin = atob(MC_WORLD_B64), n = MC_WORLD_W * MC_WORLD_H, land = new Uint8Array(n);
  for(let i = 0; i < n; i++) land[i] = (bin.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
  return (mcMap.land = land);
}
const mcMapXY = (lat, lon, W, H) => [(lon + 180) / 360 * W, (80 - lat) / 138 * H];
const mcHash = s => { let h = 0; for(const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

// país escolhido (ou deduzido do idioma do navegador); '' = não mostrar
function mcMapCountry(){
  let v = null;
  try { v = localStorage.getItem('nerdqaxe:community_cc'); } catch(e) {}
  if(v === '') return '';
  if(v && MC_COUNTRIES[v]) return v;
  for(const l of (navigator.languages || [navigator.language || ''])){ const m = String(l).match(/[-_]([A-Za-z]{2})\b/); if(m && MC_COUNTRIES[m[1].toUpperCase()]) return m[1].toUpperCase(); }
  return '';
}
// ponto publicado: o centro do país com um desvio fixo de até 2,5 graus, arredondado ao grau
function mcMapMyLoc(uid){
  const cc = mcMapCountry();
  if(!cc) return null;
  const h = mcHash(uid || 'x'), c = MC_COUNTRIES[cc];
  return { cc, lat: Math.round(c[0] + ((h % 1000) / 1000 - .5) * 5), lon: Math.round(c[1] + (((h >> 10) % 1000) / 1000 - .5) * 5) };
}
function mcMapCountryName(cc){ try { return new Intl.DisplayNames([currentLang], { type: 'region' }).of(cc) || cc; } catch(e) { return cc; } }
function mcMapSetCountry(cc){
  try { localStorage.setItem('nerdqaxe:community_cc', cc); } catch(e) {}
  if(typeof mcComPublish === 'function') mcComPublish();
  if(typeof mcComRender === 'function') mcComRender();
}
function mcMapOptions(){
  const cur = mcMapCountry();
  const list = Object.keys(MC_COUNTRIES).sort((a, b) => mcMapCountryName(a).localeCompare(mcMapCountryName(b), typeof mcLocale === 'function' ? mcLocale() : undefined));
  return '<option value="">' + t('mc_cm_loc_hide') + '</option>' + list.map(c => '<option value="' + c + '"' + (c === cur ? ' selected' : '') + '>' + mcMapCountryName(c) + '</option>').join('');
}

// ---- eventos ----
function mcMapEntries(){
  const out = [];
  Object.entries((typeof mcCom !== 'undefined' && mcCom.list) || {}).forEach(([uid, e]) => { if(typeof mcComFresh === 'function' && mcComFresh(e) && typeof e.lat === 'number' && typeof e.lon === 'number') out.push({ uid, e }); });
  return out;
}
// chamado quando chega uma lista nova da comunidade: cada partilha nova vira uma onda, espalhada pelo minuto seguinte
function mcMapUpdate(list){
  Object.entries(list || {}).forEach(([uid, e]) => {
    if(!e || typeof e.lat !== 'number') return;
    const sh = Number(e.sh) || 0, prev = mcMap.prevSh[uid];
    mcMap.prevSh[uid] = sh;
    if(prev == null || uid === (typeof mcCom !== 'undefined' ? mcCom.uid : '')) return;
    const n = Math.min(10, Math.max(0, sh - prev));
    for(let i = 0; i < n; i++) mcMap.ripples.push({ uid, born: 0, delay: Math.random() * 55000, col: '33,255,176' });
  });
  mcMapKick();
}
function mcMapOwnShare(n){
  const uid = typeof mcCom !== 'undefined' ? mcCom.uid : '';
  if(!uid || !mcMap.cv) return;
  for(let i = 0; i < Math.min(n || 1, 4); i++) mcMap.ripples.push({ uid, born: 0, delay: i * 180, col: '79,214,255' });
  mcMapKick();
}
function mcMapBurst(uid){
  const ents = mcMapEntries(), src = ents.find(x => x.uid === uid);
  if(!src) return;
  ents.forEach(x => { if(x.uid !== uid) mcMap.arcs.push({ from: uid, to: x.uid, born: 0, delay: Math.random() * 400 }); });
  for(let i = 0; i < 3; i++) mcMap.ripples.push({ uid, born: 0, delay: i * 350, col: '255,211,74', big: true });
  mcMapKick();
}

// ---- desenho ----
function mcMapEnsure(){
  const cv = $('mcCmMap');
  if(!cv || cv === mcMap.cv) return;
  mcMap.cv = cv; mcMap.ctx = cv.getContext('2d');
  cv.addEventListener('pointermove', e => { const b = cv.getBoundingClientRect(); mcMap.mouse = { x: e.clientX - b.left, y: e.clientY - b.top }; });
  cv.addEventListener('pointerleave', () => { mcMap.mouse = null; });
  try { new IntersectionObserver(es => { mcMap.visible = es[0].isIntersecting; if(mcMap.visible) mcMapKick(); }).observe(cv); } catch(e) {}
  mcMapKick();
}
function mcMapKick(){ if(!mcMap.raf && mcMap.cv){ mcMap.last = performance.now(); mcMap.raf = requestAnimationFrame(mcMapStep); } }
function mcMapStep(now){
  const cv = mcMap.cv;
  if(!cv || !cv.isConnected){ mcMap.raf = 0; return; }
  const box = $('mcCom');
  if(document.hidden || !mcMap.visible || !box || box.hidden || box.classList.contains('collapsed')){ mcMap.raf = 0; return; }
  const perf = typeof hcPerfMode !== 'undefined' && hcPerfMode, reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e) { return false; } })();
  const dt = Math.min(.1, (now - mcMap.last) / 1000);
  if(dt >= (perf || reduce ? .25 : 1 / 30)){ mcMap.last = now; mcMap.t += dt; mcMapDraw(dt); }
  mcMap.raf = requestAnimationFrame(mcMapStep);
}
function mcMapDraw(dt){
  const cv = mcMap.cv, ctx = mcMap.ctx, dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
  if(!W || !H) return;
  if(cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)){ cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#06141f'); bg.addColorStop(1, '#040c13');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // continentes em pontos; o lado da noite fica mais escuro (posição do sol pela hora UTC)
  const land = mcMapLand(), now = new Date(), utcH = now.getUTCHours() + now.getUTCMinutes() / 60;
  const doy = Math.floor((now - Date.UTC(now.getUTCFullYear(), 0, 0)) / 864e5), dec = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (doy - 80) / 365), sunLon = -(utcH - 12) * 15;
  const cw = W / MC_WORLD_W, ch = H / MC_WORLD_H, rad = Math.max(.7, Math.min(cw, ch) * .34);
  for(let r = 0; r < MC_WORLD_H; r++) for(let c = 0; c < MC_WORLD_W; c++){
    if(!land[r * MC_WORLD_W + c]) continue;
    const lat = (80 - (r + .5) * 2) * Math.PI / 180, lon = (c + .5) * 2 - 180, cz = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos((lon - sunLon) * Math.PI / 180);
    ctx.fillStyle = cz > 0 ? 'rgba(130,185,205,' + (.32 + cz * .3).toFixed(2) + ')' : 'rgba(70,110,140,.2)';
    ctx.beginPath(); ctx.arc((c + .5) * cw, (r + .5) * ch, rad, 0, 7); ctx.fill();
  }
  const ents = mcMapEntries(), pos = {};
  mcMap.pts = ents.map(({ uid, e }) => { const [x, y] = mcMapXY(e.lat, e.lon, W, H); pos[uid] = [x, y]; return { uid, e, x, y }; });
  // ondas das shares
  mcMap.ripples = mcMap.ripples.filter(r => {
    if(r.delay > 0){ r.delay -= dt * 1000; return true; }
    const p = pos[r.uid]; if(!p) return false;
    r.born += dt; const life = r.big ? 2.2 : 1.5, k = r.born / life;
    if(k >= 1) return false;
    ctx.strokeStyle = 'rgba(' + r.col + ',' + (.8 * (1 - k)).toFixed(2) + ')'; ctx.lineWidth = r.big ? 2.2 : 1.3;
    ctx.beginPath(); ctx.arc(p[0], p[1], 3 + k * (r.big ? 60 : 24), 0, 7); ctx.stroke();
    return true;
  });
  // raios do bloco: do vencedor para todos os outros pontos
  mcMap.arcs = mcMap.arcs.filter(a => {
    if(a.delay > 0){ a.delay -= dt * 1000; return true; }
    const p = pos[a.from], q = pos[a.to]; if(!p || !q) return false;
    a.born += dt; const k = a.born / 2.6;
    if(k >= 1) return false;
    const mx = (p[0] + q[0]) / 2, my = Math.min(p[1], q[1]) - Math.hypot(q[0] - p[0], q[1] - p[1]) * .25, head = Math.min(1, k * 2), tail = Math.max(0, k * 2 - 1);
    ctx.strokeStyle = 'rgba(255,211,74,' + (.75 * (1 - k)).toFixed(2) + ')'; ctx.lineWidth = 1.4; ctx.beginPath();
    for(let s = tail; s <= head; s += .04){ const u = 1 - s, x = u * u * p[0] + 2 * u * s * mx + s * s * q[0], y = u * u * p[1] + 2 * u * s * my + s * s * q[1]; s === tail ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
    return true;
  });
  // mineiros: ponto de luz com tamanho pelo hashrate
  const me = typeof mcCom !== 'undefined' ? mcCom.uid : '', hov = mcMap.mouse && mcMap.pts.map(p => ({ p, d: Math.hypot(p.x - mcMap.mouse.x, p.y - mcMap.mouse.y) })).filter(o => o.d < 14).sort((a, b) => a.d - b.d)[0];
  mcMap.hover = hov ? hov.p : null;
  mcMap.pts.forEach(p => {
    const gh = Number(p.e.ghs) || 0, r = 2.4 + Math.min(5, Math.log10(1 + gh) * 1.1), isMe = p.uid === me, col = isMe ? '79,214,255' : '33,255,176', pulse = .65 + .35 * Math.sin(mcMap.t * 2.4 + (mcHash(p.uid) % 6));
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 5); g.addColorStop(0, 'rgba(' + col + ',' + (.55 * pulse).toFixed(2) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 5, 0, 7); ctx.fill();
    ctx.fillStyle = isMe ? '#bff0ff' : '#c9ffe9'; ctx.beginPath(); ctx.arc(p.x, p.y, r * .8, 0, 7); ctx.fill();
  });
  if(mcMap.hover){
    const p = mcMap.hover, f = formatHashrate(Number(p.e.ghs) || 0), lines = [String(p.e.nick || '?') + (p.uid === me ? ' (' + t('mc_cm_you') + ')' : ''), (p.e.cc ? mcMapCountryName(p.e.cc) + ' · ' : '') + f.value + ' ' + f.unit + ' · ' + (Number(p.e.n) || 0) + ' ⛏'];
    ctx.font = '11px "JetBrains Mono",monospace'; const w = Math.max(...lines.map(s => ctx.measureText(s).width)) + 16;
    let tx = p.x + 12, ty = p.y - 44; if(tx + w > W - 4) tx = p.x - w - 12; if(ty < 4) ty = p.y + 12;
    ctx.fillStyle = 'rgba(8,18,26,.95)'; ctx.strokeStyle = 'rgba(79,214,255,.5)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(tx, ty, w, 38, 8) : ctx.rect(tx, ty, w, 38); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8f6ff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; lines.forEach((s, k) => ctx.fillText(s, tx + 8, ty + 15 + k * 16));
  }
}
