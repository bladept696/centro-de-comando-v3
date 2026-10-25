// ---------- Escritório: as salas de apoio (ala esquerda de cada piso) ----------
// Cada piso tem duas salas ao lado das máquinas: 0 = bar + sala de descanso, 1 = ginásio + reuniões,
// 2 = oficina + biblioteca (e repete). Têm mobília, animações (TV, jukebox, tapete rolante, fumo...)
// e pontos onde os técnicos se sentam ou fazem as suas pausas. Carrega antes do escritorio.js.
const HO_WING_KINDS = [['bar', 'lounge'], ['gym', 'meeting'], ['workshop', 'library']];
const HO_WING_NAME = {
  bar: 'BAR', lounge: 'SALA DE DESCANSO', gym: 'GINÁSIO', meeting: 'SALA DE REUNIÕES', workshop: 'OFICINA', library: 'BIBLIOTECA'
};
const HO_WING_ICON = { bar: '🍺', lounge: '🛋️', gym: '🏋️', meeting: '📊', workshop: '🔧', library: '📚' };
function hoWingKind(f, slot){ return HO_WING_KINDS[f % HO_WING_KINDS.length][slot]; }
function hoWingFloorOf(kind){ return HO_WING_KINDS.findIndex(p => p.includes(kind)); }
function hoWingX0(kind){ return HO_WING_KINDS.some(p => p[0] === kind) ? -HO.RB : -HO.RB + HO.R; }

// pontos (relativos ao x0 da sala): onde se estar de pé, onde se senta e para onde se olha
const HO_WING_SPOTS = {
  bar:      [{ x: 2.0, y: 4.2, sit: 1, look: [2.0, 2.6] }, { x: 3.6, y: 4.2, sit: 1, look: [3.6, 2.6] }, { x: 5.2, y: 4.2, sit: 1, look: [5.2, 2.6] }, { x: 6.8, y: 4.2, sit: 1, look: [6.8, 2.6] }],
  lounge:   [{ x: 3.55, y: 6.8, sit: 1, look: [3.55, 0] }, { x: 4.85, y: 6.8, sit: 1, look: [4.85, 0] }, { x: 6.15, y: 6.8, sit: 1, look: [6.15, 0] }],
  foos:     [{ x: 7.7, y: 4.0, look: [9.1, 4.0] }, { x: 7.7, y: 5.4, look: [9.1, 5.4] }],
  run:      [{ x: 1.95, y: 4.1, look: [1.95, 0] }, { x: 4.05, y: 4.1, look: [4.05, 0] }],
  weights:  [{ x: 7.0, y: 2.6, look: [7.0, 0] }, { x: 8.6, y: 2.6, look: [8.6, 0] }],
  meeting:  [{ x: 8.3, y: 1.7, look: [8.3, 0] }, { x: 2.7, y: 3.3, sit: 1, look: [2.7, 5.2] }, { x: 4.0, y: 3.3, sit: 1, look: [4.0, 5.2] }, { x: 5.4, y: 3.3, sit: 1, look: [5.4, 5.2] }, { x: 6.7, y: 3.3, sit: 1, look: [6.7, 5.2] }],
  workshop: [{ x: 2.6, y: 3.0, look: [2.6, 1.2] }, { x: 5.2, y: 3.0, look: [5.2, 1.2] }],
  library:  [{ x: 3.0, y: 6.55, sit: 1, look: [3.0, 0] }, { x: 6.9, y: 6.55, sit: 1, look: [6.9, 0] }]
};
// lista de pontos usada por uma atividade (por omissão a da sala)
function hoWingSpot(kind, k, list){
  const L = HO_WING_SPOTS[list || kind], s = L[k % L.length], x0 = hoWingX0(kind);
  return { x: x0 + s.x, y: s.y, f: hoWingFloorOf(kind), sit: !!s.sit, look: { x: x0 + s.look[0], y: s.look[1] }, n: L.length };
}

// pequenos auxiliares de desenho
const hoWall = (x0, z0, inner) => `<g transform="${hoM('wallY', x0, 0, z0 + HO.H)}">${inner}</g>`;
const hoFront = (x, y, zTop, inner) => `<g transform="${hoM('wallY', x, y, zTop)}">${inner}</g>`;
const hoFlr = (x, y, z, inner) => `<g transform="${hoM('floor', x, y, z)}">${inner}</g>`;
function hoSpr(x, y, z, inner, cls){ const [X, Y] = hoP(x, y, z); return `<g class="${cls || ''}" transform="translate(${X.toFixed(1)},${Y.toFixed(1)})">${inner}</g>`; }
function hoPlant(x, y, z, s){
  s = s || 1;
  return hoBox(x - .25, y - .25, z, .5, .5, .45, '#8a5a35') +
    hoSpr(x, y, z + .45, `<g transform="scale(${s})"><g class="ho-plant"><ellipse cx="-5" cy="-9" rx="5" ry="10" transform="rotate(-24 -5 -9)" fill="#2e8f4e"/><ellipse cx="5" cy="-10" rx="5" ry="11" transform="rotate(22 5 -10)" fill="#3aa35c"/><ellipse cx="0" cy="-13" rx="4.5" ry="12" fill="#43b869"/><ellipse cx="-1" cy="-17" rx="3" ry="6" fill="#58cc7e" opacity=".7"/></g></g>`);
}
function hoWingBase(x0, z0, f, kind, wallCol, floorFill, inner, outer){
  const { R, H } = HO;
  const wall = hoWall(x0, z0, `<rect width="${R}" height="${H}" fill="${wallCol}"/><rect y="${H - .35}" width="${R}" height="0.35" fill="${hoShade(wallCol, -.45)}"/>` +
    `<rect y="${H - .38}" width="${R}" height=".05" fill="#fff" opacity=".07"/>` + inner +
    `<rect x="0.5" y="0.35" width="${kind === 'meeting' || kind === 'lounge' ? 5.2 : 4.6}" height="0.8" rx="0.12" fill="#0c151c" stroke="#2c4252" stroke-width="0.06"/>` +
    `<text x="0.78" y="0.93" font-size="0.46" font-weight="700" fill="var(--amber)">${HO_WING_ICON[kind]} ${HO_WING_NAME[kind]}<tspan class="ho-cnt" data-cnt="${kind}:${f}" fill="var(--cyan)"></tspan></text>`);
  const side = outer ? `<g transform="${hoM('wallX', x0, 0, z0 + H)}"><rect width="${R}" height="${H}" fill="${hoShade(wallCol, -.3)}"/><rect y="${H - 0.35}" width="${R}" height="0.35" fill="#101b23"/>` +
    `<rect x="0" y="0" width="${R}" height=".12" fill="#fff" opacity=".05"/></g>` : '';
  const floor = hoFlr(x0, 0, z0, `<rect width="${R}" height="${R}" fill="${floorFill}"/>` + (kind === 'lounge' ? '<rect x="2" y="3.7" width="6.3" height="5" rx=".3" fill="#5a2a35"/><rect x="2.2" y="3.9" width="5.9" height="4.6" rx=".2" fill="none" stroke="#c9a14a" stroke-width=".07"/>' : '') +
    `<ellipse class="ho-lamp" cx="5" cy="5" rx="4.4" ry="4.4" fill="url(#hoLampGlow)"/>`);
  return { wall: wall + side, floor };
}
function hoWingHit(x0, z0, f, kind){
  return `<polygon class="ho-whit" data-wing="${kind}:${f}" points="${hoPts([[x0, 0, z0], [x0 + HO.R, 0, z0], [x0 + HO.R, HO.R, z0], [x0, HO.R, z0]])}"/>`;
}
function hoToggleHit(id, x, y, z, w, d, h){
  return `<polygon class="ho-thit" data-toggle="${id}" points="${hoPts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]])}"/>`;
}

// --- BAR ---
function hoBarRoom(x0, z0, f){
  const bt = ['#2f8f5a', '#c9822b', '#7a2f3f', '#3a6fa8', '#d9d2b0', '#8a3fb0'];
  let w = `<rect x="1" y="1" width="6.4" height="3.5" fill="#3a3050" opacity=".55"/><path d="M1 1L3.2 1L1 3.4Z M4.2 4.5L7.4 1.2V3.2L5.6 4.5Z" fill="#fff" opacity=".06"/>`;
  [2.3, 3.55].forEach((v, r) => {
    w += `<rect x="0.9" y="${v}" width="6.6" height=".13" fill="#a0733c"/>`;
    for(let u = 1.2, k = 0; u < 7.2; u += .55, k++) w += `<rect x="${u}" y="${v - .55}" width=".22" height=".55" rx=".06" fill="${bt[(k + r * 2) % bt.length]}"/><rect x="${u + .04}" y="${v - .5}" width=".04" height=".4" fill="#fff" opacity=".35"/>`;
  });
  w += `<g class="ho-neon"><rect x="7.7" y="0.5" width="2" height="1.25" rx=".15" fill="#1a0f1a" stroke="#ff5ea8" stroke-width=".07"/><text x="8.7" y="1.4" font-size=".78" font-weight="700" text-anchor="middle" fill="#ff5ea8" filter="url(#hoGlow)">BAR</text></g>`;
  w += `<rect x="7.7" y="2.2" width="2" height="1.9" rx=".1" fill="#1c2a22" stroke="#7a5a30" stroke-width=".09"/><path d="M8 2.7h1.4M8 3.1h1M8 3.5h1.2" stroke="#e8efe8" stroke-width=".07" opacity=".8"/><text x="8.7" y="2.55" font-size=".3" text-anchor="middle" fill="#ffd27a">MENU</text>`;
  [2.2, 4.2, 6.2].forEach(u => { w += `<path d="M${u} 0V.95" stroke="#222" stroke-width=".05"/><path d="M${u - .45} 1.45Q${u} .75 ${u + .45} 1.45Z" fill="#c9a14a"/><ellipse cx="${u}" cy="1.5" rx=".5" ry=".14" fill="#fff3c4" opacity=".7"/>`; });
  const fl = hoBase(x0, z0, f, 'bar', '#2a2230', 'url(#hoWood)', w, true);
  let b = hoBox(x0 + .8, 2.3, z0, 6.8, 1.0, 1.5, '#5c3820') + hoBox(x0 + .6, 2.1, z0 + 1.5, 7.2, 1.5, .18, '#b07840');
  for(let k = 0; k < 3; k++) b += hoBox(x0 + 2.0 + k * .7, 2.5, z0 + 1.68, .18, .18, .62, '#c9ced3') + hoBox(x0 + 1.95 + k * .7, 2.45, z0 + 2.2, .28, .28, .1, ['#c9822b', '#2f8f5a', '#3a6fa8'][k]);
  for(let k = 0; k < 4; k++) b += hoBox(x0 + 4.9 + k * .45, 2.8, z0 + 1.68, .22, .22, .34, '#cfe9f7', 'opacity=".75"');
  b += hoBox(x0 + 6.6, 2.5, z0 + 1.68, .9, .7, .55, '#2a2a30');
  for(let k = 0; k < 4; k++){
    const sx = x0 + 1.7 + k * 1.6;
    b += hoBox(sx + .22, 4.12, z0, .14, .14, .72, '#2a2a2a') + hoBox(sx, 3.9, z0 + .72, .58, .58, .2, ['#b33a3a', '#3a6fa8', '#b33a3a', '#3a6fa8'][k]);
  }
  [[7.4, 6.3], [4.4, 7.9]].forEach(([tx, ty]) => {
    b += hoBox(x0 + tx + .65, ty + .65, z0, .22, .22, .95, '#3a2a1c') + hoBox(x0 + tx, ty, z0 + .95, 1.5, 1.5, .12, '#8a5a30');
    b += hoBox(x0 + tx + .5, ty + .5, z0 + 1.07, .22, .22, .22, '#cfe9f7', 'opacity=".8"') + hoBox(x0 + tx - .55, ty + .45, z0, .5, .5, .55, '#b33a3a') + hoBox(x0 + tx + 1.55, ty + .45, z0, .5, .5, .55, '#b33a3a');
  });
  // jukebox: luzes e notas que sobem quando está a tocar
  const jx = x0 + .45, jy = 6.1;
  b += `<g class="ho-juke on" data-toggle-g="juke:${f}">` + hoBox(jx, jy, z0, 1.2, .9, 2.2, '#7a1f3a') +
    hoFront(jx, jy + .9, z0 + 2.2, `<path d="M.15 .1Q.6 -.3 1.05 .1V1.1H.15Z" fill="#14081a" stroke="#ffd27a" stroke-width=".05"/><g class="ho-jl"><rect x=".25" y=".3" width=".7" height=".12" fill="#ff5ea8"/><rect x=".25" y=".55" width=".7" height=".12" fill="#35e0ff"/><rect x=".25" y=".8" width=".7" height=".12" fill="#ffd34a"/></g><rect x=".2" y="1.35" width=".8" height=".5" rx=".05" fill="#2a0e1a"/><path d="M.3 1.5h.6M.3 1.62h.6M.3 1.74h.6" stroke="#c9a14a" stroke-width=".04"/><circle cx=".6" cy="2" r=".07" fill="#ffd27a"/>`) +
    hoSpr(jx + .6, jy + .45, z0 + 2.5, `<text class="ho-note" x="0" y="0" font-size="11" fill="#ff8ac0">♪</text><text class="ho-note n2" x="7" y="0" font-size="12" fill="#7fe8ff">♫</text><text class="ho-note n3" x="-7" y="0" font-size="10" fill="#ffd34a">♪</text>`) + `</g>`;
  b += hoPlant(x0 + 9.2, 9.0, z0, 1.2);
  const hit = hoWingHit(x0, z0, f, 'bar') + hoToggleHit(`juke:${f}`, jx, jy, z0, 1.2, .9, 2.2);
  return { wall: fl.wall, floor: fl.floor, body: `<g class="ho-wing" data-wing-g="bar:${f}">${b}</g>`, hit };
}
const hoBase = (...a) => hoWingBase(...a);

// --- SALA DE DESCANSO ---
function hoLoungeRoom(x0, z0, f){
  let w = '<g transform="translate(5.4,0)">' + hoWindowSvg() + '</g>';
  w += `<g class="ho-tv on" data-toggle-g="tv:${f}"><rect x="2.5" y="0.85" width="3.3" height="2.1" rx=".1" fill="#07090d" stroke="#2c3440" stroke-width=".07"/>` +
    `<rect class="ho-tv-scr" x="2.62" y="0.97" width="3.06" height="1.86" fill="#0e2a44"/>` +
    `<g class="ho-tv-live"><path d="M2.75 2.5L3.25 2.15 3.7 2.35 4.2 1.7 4.6 1.95 5.1 1.35 5.55 1.5" fill="none" stroke="#35e08a" stroke-width=".08" stroke-linejoin="round" stroke-dasharray="6" class="ho-tv-line"/>` +
    `<text x="2.8" y="1.35" font-size=".34" font-weight="700" fill="#ffb020">₿ BTC</text></g>` +
    `<rect class="ho-tv-off" x="2.62" y="0.97" width="3.06" height="1.86" fill="#000"/><rect x="2.62" y="0.97" width="1.2" height="1.86" fill="#fff" opacity=".05"/></g>`;
  w += `<rect x="0.9" y="3.9" width="1" height=".7" fill="none"/><rect x="6.1" y="3.4" width="1.5" height=".9" fill="none"/>`;
  const fl = hoBase(x0, z0, f, 'lounge', '#2c3a4a', 'url(#hoWood)', w, false);
  let b = hoBox(x0 + .4, .5, z0, 1.4, 1.1, 3.0, '#b93a45');
  b += hoFront(x0 + .4, 1.6, z0 + 3.0, `<rect x=".12" y=".15" width="1.16" height="1.35" fill="#10161d"/>` + [0, 1, 2].map(r => [0, 1, 2].map(c => `<rect x="${.2 + c * .36}" y="${.24 + r * .4}" width=".28" height=".3" rx=".04" fill="${['#e8a33a', '#3aa36a', '#3a6fa8', '#d94f5c', '#f4f1ea'][(r * 3 + c) % 5]}"/>`).join('')).join('') +
    `<rect x=".2" y="1.62" width=".9" height=".5" rx=".05" fill="#07090d"/><rect class="ho-vend-led" x=".28" y="1.7" width=".4" height=".1" fill="#35e08a"/><rect x=".2" y="2.4" width=".9" height=".38" fill="#07090d"/>`);
  b += hoBox(x0 + 2.0, .55, z0, 1.1, 1.0, 2.2, '#d9e3ea') + hoFront(x0 + 2.0, 1.55, z0 + 2.2, `<line x1="0" y1=".95" x2="1.1" y2=".95" stroke="#9aa6b0" stroke-width=".05"/><rect x=".88" y=".3" width=".07" height=".4" rx=".02" fill="#5a6672"/><rect x=".88" y="1.2" width=".07" height=".6" rx=".02" fill="#5a6672"/>`);
  b += hoBox(x0 + 6.2, .55, z0, 3.4, 1.3, 1.5, '#6b4a2b') + hoBox(x0 + 6.1, .45, z0 + 1.5, 3.6, 1.5, .14, '#8a6238');
  b += hoBox(x0 + 6.6, .8, z0 + 1.64, .95, .7, .85, '#202326') + hoBox(x0 + 6.75, 1.4, z0 + 1.64, .3, .3, .22, '#f4f1ea') + hoBox(x0 + 8.0, .85, z0 + 1.64, .5, .5, .4, '#3aa36a') + hoBox(x0 + 8.8, .9, z0 + 1.64, .45, .45, .3, '#f4f1ea');
  b += hoSpr(x0 + 7.07, .8, z0 + 2.55, `<g class="ho-steam"><path d="M0 0q-3 -6 0 -12q3 -6 0 -12" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></g><g class="ho-steam s2"><path d="M4 0q-3 -6 0 -12q3 -6 0 -12" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/></g>`);
  // sofá e mesa de centro
  b += hoBox(x0 + 2.5, 6.2, z0, 4.9, 1.5, .55, '#4b6a9a') + hoBox(x0 + 2.5, 7.5, z0 + .55, 4.9, .4, .95, '#3e5a86') +
    hoBox(x0 + 2.3, 6.2, z0, .3, 1.7, .95, '#37507a') + hoBox(x0 + 7.2, 6.2, z0, .3, 1.7, .95, '#37507a') +
    hoBox(x0 + 3.0, 6.3, z0 + .55, 1.1, 1.0, .18, '#5c7db0') + hoBox(x0 + 4.3, 6.3, z0 + .55, 1.1, 1.0, .18, '#5c7db0') + hoBox(x0 + 5.6, 6.3, z0 + .55, 1.1, 1.0, .18, '#5c7db0');
  b += hoBox(x0 + 3.5, 4.5, z0 + .4, 2.8, 1.1, .12, '#7a5a3a') + hoBox(x0 + 3.65, 4.65, z0, .14, .14, .4, '#3a2a1c') + hoBox(x0 + 6.0, 4.65, z0, .14, .14, .4, '#3a2a1c') +
    hoBox(x0 + 4.0, 4.8, z0 + .52, .4, .4, .2, '#e8a33a') + hoBox(x0 + 5.0, 4.9, z0 + .52, .3, .3, .09, '#f4f1ea');
  // matraquilhos
  const fx = x0 + 8.5, fy = 3.3;
  b += `<g class="ho-foos">` + hoBox(fx, fy, z0 + .8, 1.2, 3.0, .3, '#2f6f4a') + [0, 1].map(k => hoBox(fx + .1 + k * .9, fy + .1, z0, .14, .14, .8, '#3a2a1c') + hoBox(fx + .1 + k * .9, fy + 2.7, z0, .14, .14, .8, '#3a2a1c')).join('') +
    hoFlr(fx, fy, z0 + 1.12, `<rect x=".08" y=".08" width="1.04" height="2.84" fill="none" stroke="#e8efe8" stroke-width=".05"/><line x1=".08" y1="1.5" x2="1.12" y2="1.5" stroke="#e8efe8" stroke-width=".05"/><g class="ho-rods">` +
      [.55, 1.05, 1.95, 2.45].map((v, k) => `<g class="ho-rod r${k % 2}"><rect x="-.15" y="${v - .03}" width="1.5" height=".06" fill="#c9ced3"/><rect x="${.25 + (k % 2) * .3}" y="${v - .1}" width=".16" height=".2" fill="${k < 2 ? '#d94f5c' : '#3a6fa8'}"/><rect x="${.65 - (k % 2) * .2}" y="${v - .1}" width=".16" height=".2" fill="${k < 2 ? '#d94f5c' : '#3a6fa8'}"/></g>`).join('') + `</g><circle class="ho-ball" cx=".6" cy="1.5" r=".1" fill="#fff"/>`) + `</g>`;
  b += hoPlant(x0 + 1.0, 9.1, z0, 1.4) + hoPlant(x0 + 9.2, 9.2, z0, 1.1);
  b += hoBox(x0 + 8.9, 7.7, z0, .9, .9, .35, '#3a2a1c') + hoBox(x0 + 9.0, 7.8, z0 + .35, .7, .7, .22, '#b33a3a');
  const hit = hoWingHit(x0, z0, f, 'lounge') + hoToggleHit(`tv:${f}`, x0 + 2.5, 0, z0 + 3.0, 3.3, .1, 2.1);
  return { wall: fl.wall, floor: fl.floor, body: `<g class="ho-wing" data-wing-g="lounge:${f}">${b}</g>`, hit };
}

// --- GINÁSIO ---
function hoGymRoom(x0, z0, f){
  let w = `<rect x="0.8" y="1" width="6.8" height="3.7" fill="#6f8da6" opacity=".38" stroke="#aac3d6" stroke-width=".08"/><path d="M1.4 4.7L4.1 1M3.8 4.7L6.5 1M6 4.7L7.6 2.6" stroke="#fff" stroke-width=".28" opacity=".1"/>` +
    `<rect x="7.9" y="1" width="1.7" height="2.3" fill="#10202c" stroke="#35e0ff" stroke-width=".05"/><text x="8.75" y="2.0" font-size=".3" font-weight="700" text-anchor="middle" fill="#35e0ff">NO PAIN</text><text x="8.75" y="2.45" font-size=".3" font-weight="700" text-anchor="middle" fill="#ffd34a">NO HASH</text>` +
    `<circle cx="8.75" cy="3.95" r=".5" fill="#f4f1ea" stroke="#333" stroke-width=".07"/><path d="M8.75 3.95V3.65M8.75 3.95L8.95 4.1" stroke="#222" stroke-width=".06"/>`;
  const fl = hoBase(x0, z0, f, 'gym', '#1f2c38', 'url(#hoTile)', w, true);
  let b = '';
  [0, 1].forEach(k => {
    const tx = x0 + 1.4 + k * 2.1;
    b += `<g class="ho-tread" data-tread="${k}">` + hoBox(tx, 2.3, z0, 1.1, 2.9, .3, '#2a2f36') +
      hoFlr(tx, 2.3, z0 + .3, `<rect x=".1" y=".35" width=".9" height="2.4" rx=".1" fill="#14181d"/><g class="ho-belt">${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x=".12" y="${.4 + i * .3}" width=".86" height=".07" fill="#4a5560"/>`).join('')}</g>`) +
      hoBox(tx + .05, 2.25, z0 + .3, .08, .08, 1.5, '#5a6672') + hoBox(tx + .97, 2.25, z0 + .3, .08, .08, 1.5, '#5a6672') + hoBox(tx + .05, 2.2, z0 + 1.8, 1.0, .25, .3, '#0b1015') +
      hoFront(tx + .05, 2.45, z0 + 2.1, `<rect x=".05" y=".04" width=".85" height=".22" fill="#07121a"/><rect class="ho-tread-led" x=".1" y=".09" width=".5" height=".1" fill="#35e08a"/>`) + `</g>`;
  });
  b += hoBox(x0 + 6.4, 1.0, z0, 3.2, .6, 2.2, '#3a4550');
  b += [0, 1].map(r => [0, 1, 2, 3, 4].map(c => hoBox(x0 + 6.55 + c * .58, 1.05 + r * 0, z0 + 1.0 + r * .9 + 0, .4, .4, .22, ['#d94f5c', '#e8a33a', '#3a6fa8', '#3aa36a', '#8a3fb0'][c])).join('')).join('');
  b += hoBox(x0 + 5.6, 5.4, z0, 2.4, .9, .5, '#2a2f36') + hoBox(x0 + 5.5, 5.5, z0 + .5, 2.6, .7, .22, '#b33a3a') + hoBox(x0 + 5.1, 5.5, z0 + .5, .1, .7, 1.0, '#5a6672') + hoBox(x0 + 8.5, 5.5, z0 + .5, .1, .7, 1.0, '#5a6672');
  b += hoBox(x0 + 5.0, 5.75, z0 + 1.1, 4.0, .16, .16, '#c9ced3') + hoBox(x0 + 4.9, 5.55, z0 + .95, .22, .56, .46, '#222') + hoBox(x0 + 8.9, 5.55, z0 + .95, .22, .56, .46, '#222');
  b += hoFlr(x0, 0, z0, `<rect x="1.2" y="6.4" width="3.2" height="1.2" rx=".1" fill="#3a6fa8" opacity=".85"/><rect x="1.3" y="6.5" width="3" height="1" rx=".08" fill="none" stroke="#fff" stroke-width=".04" opacity=".5"/>`);
  b += hoBox(x0 + 8.2, 8.0, z0, .9, .9, .55, '#d94f5c') + hoBox(x0 + 9.0, 8.4, z0, .6, .6, .4, '#3a6fa8') + hoPlant(x0 + 9.3, 9.3, z0, 1);
  return { wall: fl.wall, floor: fl.floor, body: `<g class="ho-wing" data-wing-g="gym:${f}">${b}</g>`, hit: hoWingHit(x0, z0, f, 'gym') };
}

// --- SALA DE REUNIÕES ---
function hoMeetingRoom(x0, z0, f){
  let w = `<rect x="1" y="0.95" width="5.4" height="3.1" rx=".1" fill="#07090d" stroke="#3a4a5a" stroke-width=".08"/><rect x="1.12" y="1.07" width="5.16" height="2.86" fill="#0c2236"/>` +
    `<text x="1.4" y="1.55" font-size=".3" font-weight="700" fill="#6f8696">HASHRATE TOTAL</text><text class="ho-wing-hash" data-k="wingHash" x="1.4" y="2.4" font-size=".78" font-weight="700" fill="#35e0ff">—</text>` +
    `<text class="ho-wing-onl" data-k="wingOnl" x="1.4" y="3.0" font-size=".34" font-weight="700" fill="#35e08a">—</text><text class="ho-wing-pow" data-k="wingPow" x="1.4" y="3.55" font-size=".3" fill="#ffb020"></text>` +
    `<g class="ho-wing-bars">${[0, 1, 2, 3, 4, 5, 6].map(i => `<rect class="ho-bar" style="animation-delay:${i * .17}s" x="${4.1 + i * .31}" y="2.2" width=".2" height="1.5" fill="#35e0ff" opacity=".7"/>`).join('')}</g>` +
    `<rect x="6.9" y="1" width="2.7" height="3.2" fill="#f4f1ea" stroke="#9aa6b0" stroke-width=".1"/><path d="M7.2 1.8Q7.9 1.3 8.4 1.9T9.3 1.7M7.2 2.6h1.2M7.2 3.1h2M7.2 3.6h1.4" fill="none" stroke="#2f5fa8" stroke-width=".07"/><circle cx="9" cy="3.4" r=".25" fill="none" stroke="#d94f5c" stroke-width=".07"/><rect x="7.1" y="4.28" width="2.3" height=".1" fill="#c9ced3"/>`;
  const fl = hoBase(x0, z0, f, 'meeting', '#263444', 'url(#hoTile)', w, false);
  let b = hoBox(x0 + 2.2, 4.0, z0, 5.2, 2.2, .1, '#4a3322') + hoBox(x0 + 2.1, 3.9, z0 + .1, 5.4, 2.4, .85, '#6b4a2b') + hoBox(x0 + 2.2, 4.0, z0, .2, .2, .1, '#3a2a1c');
  for(let k = 0; k < 4; k++){
    const cx = x0 + 2.3 + k * 1.35;
    b += hoBox(cx, 2.9, z0, .75, .75, .5, '#2b3a52') + hoBox(cx, 2.85, z0 + .5, .75, .14, .7, '#243049');
    b += hoBox(cx, 6.5, z0, .75, .75, .5, '#2b3a52') + hoBox(cx, 7.1, z0 + .5, .75, .14, .7, '#243049');
  }
  b += hoBox(x0 + 3.0, 4.5, z0 + .96, .8, .55, .05, '#c9ced3') + hoBox(x0 + 5.4, 5.2, z0 + .96, .8, .55, .05, '#c9ced3') + hoBox(x0 + 4.4, 4.9, z0 + .96, .4, .4, .22, '#f4f1ea') + hoBox(x0 + 6.4, 4.4, z0 + .96, .3, .3, .18, '#e8a33a');
  b += hoBox(x0 + 8.4, 1.8, z0, .12, .12, 2.3, '#5a6672');
  b += hoPlant(x0 + 9.2, 8.8, z0, 1.3) + hoPlant(x0 + .9, 8.8, z0, 1.1);
  return { wall: fl.wall, floor: fl.floor, body: `<g class="ho-wing" data-wing-g="meeting:${f}">${b}</g>`, hit: hoWingHit(x0, z0, f, 'meeting') };
}

// --- OFICINA ---
function hoWorkshopRoom(x0, z0, f){
  let w = `<rect x="0.8" y="0.95" width="4.4" height="2.4" fill="#33333b" stroke="#4a4a55" stroke-width=".08"/>`;
  for(let i = 0; i < 9; i++) w += `<circle cx="${1.1 + (i % 9) * .45}" cy="1.15" r=".03" fill="#222"/>`;
  w += `<path d="M1.2 1.4v1.5M1.2 1.4h.5M2 1.4l.4 1.6M2.8 1.5h.6l.2 1.2h-.8zM3.9 1.5v1.6M4.4 1.6l.5 1.2" fill="none" stroke="#c9ced3" stroke-width=".1" stroke-linecap="round"/><circle cx="1.6" cy="3" r=".22" fill="none" stroke="#e8a33a" stroke-width=".08"/>`;
  w += `<rect x="5.6" y="0.95" width="4" height="2.2" rx=".1" fill="#07090d" stroke="#3a4a5a" stroke-width=".08"/><path d="M5.9 1.4h1.6M5.9 1.7h2.2M5.9 2.0h1.2M5.9 2.3h1.9M5.9 2.6h1" stroke="#35e08a" stroke-width=".07" opacity=".85"/>` +
    `<rect class="ho-cursor" x="7.2" y="2.55" width=".14" height=".22" fill="#35e08a"/>`;
  w += `<rect x="0.6" y="3.7" width="9" height=".1" fill="#6b4a2b"/><rect x="1" y="3.1" width=".9" height=".6" fill="#8a6a3a"/><rect x="2.2" y="3.2" width=".7" height=".5" fill="#9a7a4a"/>`;
  const fl = hoBase(x0, z0, f, 'workshop', '#2a2a30', 'url(#hoTile)', w, true);
  let b = hoBox(x0 + .8, .6, z0, 7.2, 1.5, 1.25, '#5a4630') + hoBox(x0 + .7, .5, z0 + 1.25, 7.4, 1.7, .14, '#8a6a42');
  b += hoBox(x0 + 1.2, .8, z0 + 1.39, 1.1, .8, .09, '#1f7a4a') + hoBox(x0 + 1.4, .95, z0 + 1.48, .5, .4, .1, '#0b0f12') + hoBox(x0 + 2.8, .8, z0 + 1.39, 1.1, .8, .09, '#1f7a4a') + hoBox(x0 + 4.4, 1.0, z0 + 1.39, .7, .6, .5, '#3a4550') + hoBox(x0 + 5.5, .9, z0 + 1.39, .4, .3, .2, '#e8a33a');
  b += hoBox(x0 + 6.6, .9, z0 + 1.39, 1.0, .7, .5, '#202326') + hoFront(x0 + 6.6, 1.6, z0 + 1.89, `<rect x=".08" y=".08" width=".84" height=".28" fill="#07121a"/><rect class="ho-tread-led" x=".12" y=".14" width=".4" height=".1" fill="#35e0ff"/>`);
  b += hoSpr(x0 + 5.6, 1.1, z0 + 1.55, `<g class="ho-steam"><path d="M0 0q-3 -6 0 -12q3 -6 0 -12" fill="none" stroke="#cfd6dc" stroke-width="1.2" stroke-linecap="round"/></g>`);
  b += hoBox(x0 + 8.3, .7, z0, 1.5, 1.3, 1.7, '#b33a3a') + hoFront(x0 + 8.3, 2.0, z0 + 1.7, [0, 1, 2].map(i => `<rect x=".12" y="${.1 + i * .38}" width="1.26" height=".3" fill="#8e2a2a" stroke="#6a1d1d" stroke-width=".04"/><rect x=".6" y="${.2 + i * .38}" width=".3" height=".08" fill="#cfd6dc"/>`).join(''));
  b += hoBox(x0 + 1.0, 5.0, z0, 2.0, 1.2, .7, '#3a4550') + hoBox(x0 + 1.15, 5.15, z0 + .7, .9, .8, .55, '#2f2f38') + hoBox(x0 + 3.4, 6.0, z0, 1.1, 1.1, .8, '#8a6a3a') + hoBox(x0 + 3.6, 6.15, z0 + .8, .8, .8, .5, '#9a7a4a');
  b += hoBox(x0 + 6.0, 5.3, z0, 2.4, 1.6, .55, '#4a5560') + hoBox(x0 + 6.2, 5.5, z0 + .55, 1.6, 1.1, .5, '#2a6fa0') + hoBox(x0 + 6.4, 5.65, z0 + 1.05, .6, .5, .2, '#35e0ff');
  b += hoPlant(x0 + 9.2, 9.0, z0, 1.1);
  return { wall: fl.wall, floor: fl.floor, body: `<g class="ho-wing" data-wing-g="workshop:${f}">${b}</g>`, hit: hoWingHit(x0, z0, f, 'workshop') };
}

// --- BIBLIOTECA ---
function hoLibraryRoom(x0, z0, f){
  const cols = ['#a33a3a', '#2f5fa8', '#c9a227', '#2f8f5a', '#7a4a9a', '#d9d2b0', '#c9822b'];
  let w = '';
  for(let s = 0; s < 3; s++){
    const v = 1.5 + s * 1.3;
    w += `<rect x="0.5" y="${v}" width="9" height=".1" fill="#6b4a2b"/>`;
    for(let u = .6, k = s * 3; u < 9.3; u += .24 + ((k++ * 7) % 3) * .05) w += `<rect x="${u.toFixed(2)}" y="${(v - .62 + ((k * 5) % 4) * .05).toFixed(2)}" width=".19" height="${(.62 - ((k * 5) % 4) * .05).toFixed(2)}" fill="${cols[k % cols.length]}" stroke="#0004" stroke-width=".02"/>`;
  }
  w += `<rect x="0.45" y="0.4" width=".12" height="4.8" fill="#6b4a2b"/><rect x="9.43" y="0.4" width=".12" height="4.8" fill="#6b4a2b"/>`;
  const fl = hoBase(x0, z0, f, 'library', '#33281f', 'url(#hoWood)', w, false);
  let b = hoBox(x0 + 2.4, 6.0, z0, 1.2, 1.1, .5, '#8a3a3a') + hoBox(x0 + 2.4, 6.9, z0 + .5, 1.2, .3, .8, '#7a3030') + hoBox(x0 + 2.25, 6.0, z0, .2, 1.2, .8, '#6a2a2a') + hoBox(x0 + 3.55, 6.0, z0, .2, 1.2, .8, '#6a2a2a');
  b += hoBox(x0 + 6.3, 6.0, z0, 1.2, 1.1, .5, '#3a6a8a') + hoBox(x0 + 6.3, 6.9, z0 + .5, 1.2, .3, .8, '#305a78') + hoBox(x0 + 6.15, 6.0, z0, .2, 1.2, .8, '#284c64') + hoBox(x0 + 7.45, 6.0, z0, .2, 1.2, .8, '#284c64');
  b += hoBox(x0 + 4.4, 6.3, z0, .6, .6, .6, '#3a2a1c') + hoBox(x0 + 4.5, 6.4, z0 + .6, .22, .22, .08, '#f4f1ea');
  b += hoBox(x0 + 8.4, 3.2, z0, .12, .12, 2.6, '#c9a14a') + hoSpr(x0 + 8.46, 3.26, z0 + 2.7, `<path d="M-9 0L9 0L5 -8L-5 -8Z" fill="#ffd27a" opacity=".92"/><ellipse class="ho-lampglow-l" cx="0" cy="4" rx="26" ry="16" fill="#ffe7a0" opacity=".18"/>`);
  b += hoBox(x0 + .8, 3.6, z0, .9, .9, .5, '#3a2a1c') + hoSpr(x0 + 1.25, 4.05, z0 + .5, `<circle r="9" cy="-9" fill="#2a6fa0"/><path d="M-6 -12q4 -3 5 1t4 1M-3 -5q5 1 7 -3" fill="#3aa36a" stroke="none"/><path d="M-9 -9H9" stroke="#c9a14a" stroke-width=".8"/>`);
  b += hoPlant(x0 + .9, 9.0, z0, 1.2) + hoPlant(x0 + 9.2, 9.1, z0, 1.1);
  return { wall: fl.wall, floor: fl.floor, body: `<g class="ho-wing" data-wing-g="library:${f}">${b}</g>`, hit: hoWingHit(x0, z0, f, 'library') };
}

const HO_WING_DRAW = { bar: hoBarRoom, lounge: hoLoungeRoom, gym: hoGymRoom, meeting: hoMeetingRoom, workshop: hoWorkshopRoom, library: hoLibraryRoom };
function hoWingRooms(f){
  const z0 = f * HO.FH;
  return [0, 1].map(slot => { const kind = hoWingKind(f, slot); return HO_WING_DRAW[kind](hoWingX0(kind), z0, f); });
}
