
// ---------- Escritório isométrico 2.5D ----------
// Um prédio visto em perspetiva: cada máquina tem um quarto onde aparece
// desenhada como a real (placa, dissipador, ventoinha). O ar quente, a cor do
// dissipador, a luz do quarto e o monitor da parede seguem as leituras. Uma
// pequena equipa de técnicos espera na sala técnica e vai pelo corredor (e
// pelo elevador, entre pisos) até às máquinas com avaria; quando o problema
// fica resolvido, volta à pausa.
const HO = { S: 16, R: 10, C: 5, H: 6, PH: 3.2, RB: 10, E: 4, FH: 17, SPEED: 4.5, LIFT: 6, PER_FLOOR: 6 };
const HO_STAFF = [
  { name: 'Rui',   color: '#e8743b', skin: '#f2c49b' },
  { name: 'Ana',   color: '#3b82c4', skin: '#c68654' },
  { name: 'Tiago', color: '#2bb673', skin: '#e0a77a' },
  { name: 'Marta', color: '#b65bd6', skin: '#8d5a3b' },
  { name: 'João',  color: '#d94f5c', skin: '#f5d3b3' },
  { name: 'Inês',  color: '#2fa8b0', skin: '#e0a77a' },
  { name: 'Pedro', color: '#7a8cff', skin: '#c68654' },
  { name: 'Sofia', color: '#c9a227', skin: '#f2c49b' }
];
const HO_PRIORITY = { hot: 5, off: 4, portal: 3, warm: 2, warn: 1 };
const HO_REST = [[-7.8, 8.4], [-5.4, 8.8], [-2.4, 5.4], [-4.6, 4.2], [-1.6, 8.2], [-3.4, 9.2], [-6.6, 3.8], [-2.0, 3.0]];
const HO_LOG_KEY = 'nerdqaxe:office_log';
const OFFICE_STATUS = {
  ok:     { label: 'A trabalhar',   color: 'var(--green)' },
  warn:   { label: 'Atenção',       color: 'var(--amber)' },
  warm:   { label: 'Quente',        color: 'var(--amber)' },
  hot:    { label: 'Alarme',        color: 'var(--red)' },
  off:    { label: 'Offline',       color: 'var(--red)' },
  portal: { label: 'Config. Wi-Fi', color: 'var(--cyan)' },
  idle:   { label: 'À espera',      color: 'var(--muted)' }
};
const officeEls = {};   // dev.id -> grupo SVG do quarto (usado pelo nmSelect para fazer scroll)
const HO_CAB_H = 5.0;   // altura da cabine do elevador
const ho = { sig: '', rooms: {}, techs: [], idx: {}, perFloor: 1, floors: 1, view: null, zShift: 0, baseVB: null, zoom: { k: 1, cx: 0, cy: 0 }, lastSel: undefined, since: {}, log: [], raf: 0, last: 0,
             lift: { z: 0, target: null, busy: null, moving: false } };
try { ho.log = JSON.parse(localStorage.getItem(HO_LOG_KEY) || '[]').filter(e => new Date(e.t).toDateString() === new Date().toDateString()); } catch(e) { ho.log = []; }

// --- Geometria isométrica (2:1). Mundo em unidades; 1 unidade = HO.S px. ---
// ho.zShift: ao mostrar um só piso, esse piso é desenhado à altura 0 (o viewBox fica compacto)
function hoP(x, y, z){ return [(x - y) * HO.S, (x + y) * HO.S / 2 - (z - ho.zShift) * HO.S]; }
function hoPts(arr){ return arr.map(p => hoP(p[0], p[1], p[2]).map(v => v.toFixed(1)).join(',')).join(' '); }
// Matriz que desenha em 2D "dentro" de um plano: chão (z fixo), parede do fundo (y fixo) ou parede lateral (x fixo).
function hoM(kind, x, y, z){
  const [X, Y] = hoP(x, y, z), S = HO.S;
  if(kind === 'floor') return `matrix(${S},${S / 2},${-S},${S / 2},${X.toFixed(1)},${Y.toFixed(1)})`;
  if(kind === 'wallY') return `matrix(${S},${S / 2},0,${S},${X.toFixed(1)},${Y.toFixed(1)})`;
  return `matrix(${-S},${S / 2},0,${S},${X.toFixed(1)},${Y.toFixed(1)})`;
}
function hoShade(hex, f){
  const n = parseInt(hex.slice(1), 16), t = f < 0 ? 0 : 255, a = Math.abs(f);
  const ch = v => Math.round((t - v) * a + v);
  return '#' + ((1 << 24) + (ch(n >> 16) << 16) + (ch((n >> 8) & 255) << 8) + ch(n & 255)).toString(16).slice(1);
}
function hoBox(x, y, z, w, d, h, color, attr){
  return `<g ${attr || ''}>` +
    `<polygon data-face="r" points="${hoPts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]])}" fill="${hoShade(color, -0.32)}"/>` +
    `<polygon data-face="f" points="${hoPts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]])}" fill="${hoShade(color, -0.16)}"/>` +
    `<polygon data-face="t" points="${hoPts([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]])}" fill="${color}"/>` +
    `</g>`;
}
function hoPaintBox(g, color){
  g.querySelectorAll('[data-face]').forEach(p => {
    const f = p.dataset.face;
    p.setAttribute('fill', f === 't' ? color : hoShade(color, f === 'f' ? -0.16 : -0.32));
  });
}
// Alhetas do dissipador (riscas nas faces visíveis)
function hoFins(x, y, z, w, d, h){
  let a = '', b = '';
  for(let u = 0.18; u < w; u += 0.22) a += `<line x1="${u.toFixed(2)}" y1="0" x2="${u.toFixed(2)}" y2="${h}"/>`;
  for(let u = 0.18; u < d; u += 0.22) b += `<line x1="${u.toFixed(2)}" y1="0" x2="${u.toFixed(2)}" y2="${h}"/>`;
  return `<g stroke="rgba(0,0,0,.35)" stroke-width="0.05">` +
    `<g transform="${hoM('wallY', x, y + d, z + h)}">${a}</g><g transform="${hoM('wallX', x + w, y, z + h)}">${b}</g></g>`;
}
function hoFan(r){
  let blades = '';
  for(let i = 0; i < 7; i++){
    blades += `<path d="M0 0 Q${(r * 0.3).toFixed(2)} ${(-r * 0.45).toFixed(2)} ${(r * 0.05).toFixed(2)} ${(-r * 0.95).toFixed(2)} Q${(-r * 0.42).toFixed(2)} ${(-r * 0.62).toFixed(2)} 0 0Z" transform="rotate(${(i * 360 / 7).toFixed(1)})"/>`;
  }
  return `<g data-k="fan"><circle r="${r}" fill="#0b0f12"/>` +
    `<circle class="ho-fanblur" r="${(r * 0.93).toFixed(2)}" fill="#8d9aa4" opacity="0"/>` +
    `<g class="ho-blades" fill="#5f6d77">${blades}</g>` +
    `<circle r="${(r * 0.3).toFixed(2)}" fill="#1d2328"/><circle r="${(r * 0.13).toFixed(2)}" fill="#3a444c"/></g>`;
}
function hoTempColor(t){
  if(t == null || !isFinite(t)) return '#8d98a2';
  const stops = [[35, [141, 163, 182]], [55, [170, 172, 160]], [65, [214, 162, 92]], [75, [228, 98, 58]], [85, [255, 52, 40]]];
  if(t <= stops[0][0]) t = stops[0][0];
  if(t >= 85) t = 85;
  for(let i = 1; i < stops.length; i++){
    if(t <= stops[i][0]){
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i], k = (t - t0) / (t1 - t0);
      return '#' + c0.map((v, j) => Math.round(v + (c1[j] - v) * k).toString(16).padStart(2, '0')).join('');
    }
  }
  return '#ff3428';
}

function officeSeed(str){
  let h = 0;
  for(const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function officeStateOf(r){
  if(!r) return 'idle';
  if(!r.online) return r.portalMode ? 'portal' : 'off';
  const temp = Number(r.temp);
  if(temp >= 75 || (r.vrTemp != null && r.vrTemp >= 85)) return 'hot';
  if(temp >= 65) return 'warm';
  const shares = (r.accepted || 0) + (r.rejected || 0);
  if((shares > 20 && r.rejected / shares > 0.02) || (r.rssi != null && r.rssi <= -80) || (r.poolPing != null && r.poolPing > 400)) return 'warn';
  return 'ok';
}

function officeHashText(r){
  if(!r || !r.online) return '—';
  if(r.hashrate_display) return r.hashrate_display;
  const f = formatHashrate(r.hashrate);
  return f.value + ' ' + f.unit;
}

function hoModelOf(dev, r){
  const s = (dev.name + ' ' + (r?.deviceModel || '') + ' ' + (r?.asicModel || '')).toLowerCase();
  if(r?.type === 'gpu_rig') return 'gpu';
  if(/antminer|whatsminer|avalon|innosilicon|goldshell|elphapex|\b(l3|l7|l9|s9|s19|s21|t21)\b/.test(s) || (r?.algorithm || '').toLowerCase() === 'scrypt') return 'box';
  if(/nerd|qaxe|octaxe/.test(s)) return 'nerd';
  return 'bitaxe';
}

function hoRoomLabel(idx){ return 'Q' + String(idx + 1).padStart(2, '0'); }

// --- Peças da cena ---
function hoWindowSvg(){
  return `<g class="ho-win"><rect x="0.8" y="1.1" width="3.6" height="2.8" fill="url(#hoSky)"/>` +
    `<g class="ho-stars" fill="#fff"><circle cx="1.3" cy="1.5" r="0.04"/><circle cx="2.1" cy="1.35" r="0.05"/><circle cx="3.4" cy="1.6" r="0.04"/><circle cx="4.0" cy="1.3" r="0.05"/><circle cx="2.9" cy="1.9" r="0.03"/></g>` +
    `<g class="ho-clouds" fill="#dfe8ef" opacity="0.55"><ellipse cx="1.8" cy="1.7" rx="0.6" ry="0.18"/><ellipse cx="3.3" cy="1.95" rx="0.75" ry="0.2"/></g>` +
    `<path d="M0.8 3.9V3.2h0.5V2.8h0.4V3.3h0.5V2.6h0.6V3.1h0.4V2.9h0.5V3.4h0.7V3.9Z" fill="#0b141b" opacity="0.9"/>` +
    `<g class="ho-citylights" fill="#ffd27a"><rect x="1.38" y="3.0" width="0.08" height="0.08"/><rect x="2.3" y="2.8" width="0.08" height="0.08"/><rect x="2.45" y="3.2" width="0.08" height="0.08"/><rect x="3.35" y="3.1" width="0.08" height="0.08"/><rect x="3.9" y="3.55" width="0.08" height="0.08"/></g>` +
    `<g class="ho-rain" stroke="#a9c8e0" stroke-width="0.03" opacity="0.7"><line x1="1.1" y1="1.4" x2="1.0" y2="1.7"/><line x1="1.7" y1="2.2" x2="1.6" y2="2.5"/><line x1="2.4" y1="1.5" x2="2.3" y2="1.8"/><line x1="3.0" y1="2.4" x2="2.9" y2="2.7"/><line x1="3.7" y1="1.6" x2="3.6" y2="1.9"/><line x1="4.1" y1="2.6" x2="4.0" y2="2.9"/></g>` +
    `<rect x="0.8" y="1.1" width="3.6" height="2.8" fill="none" stroke="#3a5265" stroke-width="0.16"/>` +
    `<line x1="2.6" y1="1.1" x2="2.6" y2="3.9" stroke="#3a5265" stroke-width="0.12"/>` +
    `<rect x="0.6" y="3.9" width="4" height="0.18" fill="#3a5265"/></g>`;
}

function hoMinerSvg(model, x0, z0){
  const zt = z0 + 1.75;
  let s = '', anchor;
  if(model === 'box'){
    s += hoBox(x0 + 1.2, 1.3, zt, 4.0, 2.4, 1.9, '#8e98a0');
    s += `<g transform="${hoM('floor', x0 + 1.5, 1.55, zt + 1.9)}"><rect data-k="hs" width="3.4" height="1.9" rx="0.1" fill="#8d98a2" opacity="0.6"/>` +
      [0.35, 0.7, 1.05, 1.4].map(v => `<line x1="0.2" y1="${v}" x2="3.2" y2="${v}" stroke="rgba(0,0,0,.35)" stroke-width="0.06"/>`).join('') + `</g>`;
    s += `<g transform="${hoM('wallY', x0 + 2.2, 3.7, zt + 0.95)}">${hoFan(0.72)}</g>`;
    s += `<g transform="${hoM('wallY', x0 + 4.2, 3.7, zt + 0.95)}">${hoFan(0.72)}</g>`;
    anchor = [x0 + 3.2, 2.5, zt + 1.9];
    const [lx, ly] = hoP(x0 + 1.55, 3.7, zt + 1.65);
    s += `<circle data-k="led" class="ho-led" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.2" fill="var(--green)" filter="url(#hoGlow)"/>`;
  } else if(model === 'gpu'){
    s += hoBox(x0 + 1.2, 1.3, zt, 4.0, 2.6, 0.15, '#3a3f45');
    for(let i = 0; i < 3; i++){
      const x = x0 + 1.6 + i * 1.25;
      s += hoBox(x, 1.5, zt + 0.15, 0.4, 2.2, 1.5, '#2a2f36', 'data-k="hs"');
      s += `<g transform="${hoM('wallX', x + 0.4, 2.6, zt + 0.9)}">${hoFan(0.55)}</g>`;
    }
    anchor = [x0 + 3.2, 2.6, zt + 1.7];
    const [lx, ly] = hoP(x0 + 5.0, 3.8, zt + 0.15);
    s += `<circle data-k="led" class="ho-led" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.2" fill="var(--green)" filter="url(#hoGlow)"/>`;
  } else {
    const nerd = model === 'nerd';
    const pcb = nerd ? [x0 + 1.4, 1.3, 3.8, 2.8, '#17171d'] : [x0 + 1.6, 1.5, 3.2, 2.3, '#1c3a2c'];
    const hs = nerd ? [x0 + 2.25, 1.7, 2.0, 2.0, 0.85] : [x0 + 2.5, 1.85, 1.4, 1.4, 0.75];
    const fr = nerd ? 0.95 : 0.66;
    s += hoBox(pcb[0], pcb[1], zt, pcb[2], pcb[3], 0.12, pcb[4]);
    // ecrã OLED e chips pequenos na placa
    s += `<g transform="${hoM('floor', pcb[0] + 0.2, pcb[1] + pcb[3] - 0.55, zt + 0.12)}"><rect width="${nerd ? 1.5 : 0.95}" height="0.34" fill="#04121a" stroke="#123" stroke-width="0.03"/>` +
      `<rect x="0.08" y="0.08" width="${nerd ? 1.0 : 0.6}" height="0.06" fill="var(--cyan)" opacity="0.7"/><rect x="0.08" y="0.2" width="${nerd ? 0.7 : 0.4}" height="0.05" fill="var(--cyan)" opacity="0.5"/></g>`;
    s += `<g transform="${hoM('floor', pcb[0] + pcb[2] - 0.75, pcb[1] + 0.25, zt + 0.12)}" fill="#2b2b2b"><rect width="0.45" height="0.3"/><rect y="0.45" width="0.45" height="0.3"/></g>`;
    s += hoBox(hs[0], hs[1], zt + 0.12, hs[2], hs[3], hs[4], '#8d98a2', 'data-k="hs"');
    s += hoFins(hs[0], hs[1], zt + 0.12, hs[2], hs[3], hs[4]);
    const ht = zt + 0.12 + hs[4];
    s += hoBox(hs[0] - 0.08, hs[1] - 0.08, ht, hs[2] + 0.16, hs[3] + 0.16, 0.22, '#121416');
    s += `<g transform="${hoM('floor', hs[0] + hs[2] / 2, hs[1] + hs[3] / 2, ht + 0.22)}">${hoFan(fr)}</g>`;
    anchor = [hs[0] + hs[2] / 2, hs[1] + hs[3] / 2, ht + 0.22];
    const [lx, ly] = hoP(pcb[0] + pcb[2] - 0.3, pcb[1] + pcb[3] - 0.25, zt + 0.12);
    s += `<circle data-k="led" class="ho-led" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2" fill="var(--green)" filter="url(#hoGlow)"/>`;
  }
  const [ax, ay] = hoP(anchor[0], anchor[1], anchor[2]);
  const wisp = 'M0 0c-3 -6 3 -10 0 -16c-3 -6 3 -10 0 -16';
  s += `<g data-k="wisps" transform="translate(${ax.toFixed(1)},${(ay - 4).toFixed(1)})" opacity="0" fill="none" stroke-width="2.2" stroke-linecap="round">` +
    `<path class="ho-wisp" d="${wisp}" transform="translate(-6,0)"/><path class="ho-wisp" d="${wisp}"/><path class="ho-wisp" d="${wisp}" transform="translate(6,0)"/></g>`;
  return s;
}

function hoRoomSvg(dev, idx, f, c, model){
  const { R, H, PH } = HO, x0 = c * R, z0 = f * HO.FH, id = escapeHtml(String(dev.id));
  const wall = `<g data-wall="${id}" transform="${hoM('wallY', x0, 0, z0 + H)}">` +
    `<rect width="${R}" height="${H}" fill="#1f3140"/><rect y="${H - 0.35}" width="${R}" height="0.35" fill="#132029"/>` +
    hoWindowSvg() +
    `<rect x="5" y="0.55" width="4.4" height="0.95" rx="0.12" fill="#0c151c" stroke="#2c4252" stroke-width="0.06"/>` +
    `<circle data-k="dot" cx="5.35" cy="1.02" r="0.17" fill="var(--muted)"/>` +
    `<text data-k="plate" x="5.65" y="1.2" font-size="0.48" font-weight="700" fill="#d8e6ee"></text>` +
    `<rect x="5" y="1.85" width="4.4" height="2.6" rx="0.15" fill="#05090c" stroke="#2c4252" stroke-width="0.08"/>` +
    `<rect x="5.2" y="2.05" width="4" height="2.2" fill="#08141c"/>` +
    `<text data-k="mhash" x="5.35" y="2.62" font-size="0.55" font-weight="700" fill="var(--green)">—</text>` +
    `<text data-k="mtemp" x="5.35" y="3.14" font-size="0.4" fill="#9fb3c0"></text>` +
    `<polyline data-k="spark" fill="none" stroke="var(--cyan)" stroke-width="0.07" stroke-linejoin="round" points=""/>` +
    `</g>`;
  const floor = `<g transform="${hoM('floor', x0, 0, z0)}"><rect width="${R}" height="${R}" fill="url(#hoTile)"/>` +
    `<ellipse class="ho-lamp" cx="5" cy="5" rx="4.2" ry="4.2" fill="url(#hoLampGlow)"/></g>`;
  const glass = `<g transform="${hoM('wallX', x0, 0, z0 + PH)}"><rect width="${R}" height="${PH}" fill="rgba(150,200,235,0.07)" stroke="#3a5265" stroke-width="0.1"/>` +
    `<line x1="${R / 2}" y1="0" x2="${R / 2}" y2="${PH}" stroke="#3a5265" stroke-width="0.06"/><line x1="0.4" y1="0.4" x2="1.6" y2="2.2" stroke="rgba(255,255,255,.08)" stroke-width="0.1"/></g>`;
  // bancada (pernas de trás, tampo, pernas da frente), armário de ferramentas, planta
  let things = hoBox(x0 + 1.1, 1.1, z0, 0.2, 0.2, 1.55, '#2a343c') + hoBox(x0 + 5.1, 1.1, z0, 0.2, 0.2, 1.55, '#2a343c');
  things += hoBox(x0 + 7.3, 0.5, z0, 1.9, 1.2, 2.3, '#a3342c');
  things += `<g transform="${hoM('wallY', x0 + 7.3, 1.7, z0 + 2.3)}" stroke="#5c1a15" stroke-width="0.05">` +
    [0.55, 1.1, 1.65].map(v => `<line x1="0.1" y1="${v}" x2="1.8" y2="${v}"/><line x1="0.75" y1="${v - 0.28}" x2="1.15" y2="${v - 0.28}" stroke="#d9d9d9" stroke-width="0.07"/>`).join('') + `</g>`;
  things += hoBox(x0 + 1.1, 4.1, z0, 0.2, 0.2, 1.55, '#2a343c') + hoBox(x0 + 5.1, 4.1, z0, 0.2, 0.2, 1.55, '#2a343c');
  things += hoBox(x0 + 1, 1, z0 + 1.55, 4.4, 3.4, 0.2, '#4a5b68');
  things += hoMinerSvg(model, x0, z0);
  things += hoBox(x0 + 8.5, 8.3, z0, 0.9, 0.9, 0.75, '#7a5232');
  const [px, py] = hoP(x0 + 8.95, 8.75, z0 + 1.55);
  things += `<g transform="translate(${px.toFixed(1)},${py.toFixed(1)})"><circle cx="-5" cy="4" r="9" fill="#2a7a4a"/><circle cx="5" cy="2" r="10" fill="#2f8f55"/><circle cx="0" cy="-6" r="10" fill="#3fae6a"/><circle cx="-3" cy="-9" r="4" fill="#5cc985" opacity=".6"/></g>`;
  const area = hoPts([[x0, 0, z0 + H], [x0 + R, 0, z0 + H], [x0 + R, 0, z0], [x0 + R, R, z0], [x0, R, z0], [x0, 0, z0]]);
  const sel = hoPts([[x0 + 0.2, 0.2, z0], [x0 + R - 0.2, 0.2, z0], [x0 + R - 0.2, R - 0.2, z0], [x0 + 0.2, R - 0.2, z0]]);
  return {
    wall, floor,
    body: `<g class="ho-room" data-room="${id}">${glass}${things}<polygon class="ho-light" data-k="light" points="${area}" fill="#000" fill-opacity="0"/><polygon class="ho-sel" points="${sel}"/></g>`,
    hit: `<polygon class="ho-hit" data-id="${id}" points="${area}"/>`
  };
}

// Sala técnica (piso 0) e arrecadação (restantes pisos), à esquerda dos quartos
// Quarto ainda sem máquina: paredes, janela, placa "LIVRE" e caixas por abrir
function hoEmptyRoomSvg(f, c, slot){
  const { R, H, PH } = HO, x0 = c * R, z0 = f * HO.FH;
  const wall = `<g transform="${hoM('wallY', x0, 0, z0 + H)}">` +
    `<rect width="${R}" height="${H}" fill="#1c2c39"/><rect y="${H - 0.35}" width="${R}" height="0.35" fill="#132029"/>` +
    hoWindowSvg() +
    `<rect x="5" y="0.55" width="4.4" height="0.95" rx="0.12" fill="#0c151c" stroke="#2c4252" stroke-width="0.06"/>` +
    `<text x="5.3" y="1.2" font-size="0.48" font-weight="700" fill="#6f8696">${hoRoomLabel(slot)} · LIVRE</text>` +
    `<rect x="5.6" y="2.2" width="3.2" height="1.9" fill="#f4f1ea" opacity="0.85"/>` +
    `<text x="7.2" y="3.0" font-size="0.36" text-anchor="middle" fill="#2c4252" font-weight="700">ESPAÇO PARA</text>` +
    `<text x="7.2" y="3.55" font-size="0.36" text-anchor="middle" fill="#2c4252" font-weight="700">NOVA MÁQUINA</text></g>`;
  const floor = `<g transform="${hoM('floor', x0, 0, z0)}"><rect width="${R}" height="${R}" fill="url(#hoTile)"/>` +
    `<rect x="1" y="1" width="4.4" height="3.4" fill="none" stroke="#e0b53a" stroke-width="0.08" stroke-dasharray="0.4 0.3" opacity="0.5"/></g>`;
  const glass = `<g transform="${hoM('wallX', x0, 0, z0 + PH)}"><rect width="${R}" height="${PH}" fill="rgba(150,200,235,0.07)" stroke="#3a5265" stroke-width="0.1"/></g>`;
  const boxes = hoBox(x0 + 6.6, 6.2, z0, 1.5, 1.2, 1.0, '#8a6a3a') + hoBox(x0 + 6.8, 6.4, z0 + 1.0, 1.1, 0.9, 0.7, '#9a7a4a') + hoBox(x0 + 8.3, 6.6, z0, 1.0, 1.0, 0.8, '#7a5a2a');
  return { wall, floor, body: `<g class="ho-room ho-free">${glass}${boxes}</g>`, hit: '' };
}

function hoSideRoomSvg(f){
  const { R, H } = HO, x0 = -HO.RB, z0 = f * HO.FH;
  const isBreak = f === 0;
  let wall = `<g transform="${hoM('wallY', x0, 0, z0 + H)}"><rect width="${R}" height="${H}" fill="#24394a"/><rect y="${H - 0.35}" width="${R}" height="0.35" fill="#132029"/>` +
    `<rect x="0.5" y="0.5" width="${isBreak ? 4 : 4.4}" height="0.9" rx="0.12" fill="#0c151c" stroke="#2c4252" stroke-width="0.06"/>` +
    `<text x="0.8" y="1.13" font-size="0.55" font-weight="700" fill="var(--amber)">${isBreak ? '☕ SALA TÉCNICA' : '📦 ARRECADAÇÃO'}</text>`;
  if(isBreak){
    wall += [5.2, 6.4, 7.6].map(u => `<rect x="${u}" y="1" width="1.1" height="4.6" fill="#5d6f7d" stroke="#3a4a56" stroke-width="0.06"/><rect x="${u + 0.85}" y="2.8" width="0.08" height="0.5" fill="#cfd6dc"/><rect x="${u + 0.25}" y="1.3" width="0.6" height="0.08" fill="#3a4a56"/><rect x="${u + 0.25}" y="1.5" width="0.6" height="0.08" fill="#3a4a56"/>`).join('');
    wall += `<rect x="0.8" y="2" width="2.6" height="1.8" fill="#f4f1ea"/><text x="2.1" y="2.7" font-size="0.32" text-anchor="middle" fill="#a3342c" font-weight="700">SEGURANÇA</text><text x="2.1" y="3.15" font-size="0.26" text-anchor="middle" fill="#333">usa sempre capacete</text>`;
  }
  wall += `</g>`;
  const side = `<g transform="${hoM('wallX', x0, 0, z0 + H)}"><rect width="${R}" height="${H}" fill="#1b2c39"/><rect y="${H - 0.35}" width="${R}" height="0.35" fill="#101b23"/></g>`;
  const floor = `<g transform="${hoM('floor', x0, 0, z0)}"><rect width="${R}" height="${R}" fill="url(${isBreak ? '#hoWood' : '#hoTile'})"/><ellipse class="ho-lamp" cx="5" cy="5" rx="4.2" ry="4.2" fill="url(#hoLampGlow)"/></g>`;
  let things = '';
  if(isBreak){
    things += hoBox(-3.4, 0.6, z0, 2.8, 1.3, 1.8, '#6b4a2b');
    things += hoBox(-3.0, 0.75, z0 + 1.8, 0.9, 0.75, 1.0, '#202326') + hoBox(-1.8, 0.85, z0 + 1.8, 0.5, 0.5, 0.35, '#f4f1ea');
    things += hoBox(-9.2, 3.2, z0, 0.9, 0.9, 1.7, '#d9e3ea') + hoBox(-9.1, 3.3, z0 + 1.7, 0.7, 0.7, 0.9, '#7fc4ef');
    things += hoBox(-8.6, 5.0, z0, 4.6, 0.6, 1.7, '#35506f') + hoBox(-8.6, 5.6, z0, 4.6, 1.5, 0.8, '#3d5a80');
    things += hoBox(-8.6, 5.0, z0, 0.5, 2.1, 1.2, '#2f4864') + hoBox(-4.5, 5.0, z0, 0.5, 2.1, 1.2, '#2f4864');
    things += hoBox(-7.4, 9.0, z0, 2.2, 0.7, 0.6, '#5a3e2b');
  } else {
    things += hoBox(-9.4, 0.6, z0, 3.6, 1.3, 3.8, '#4a5560') + hoBox(-5.2, 0.6, z0, 3.6, 1.3, 3.8, '#4a5560');
    things += hoBox(-8.6, 5.0, z0, 1.4, 1.4, 1.2, '#8a6a3a') + hoBox(-6.8, 5.4, z0, 1.2, 1.2, 1.0, '#7a5a2a') + hoBox(-8.3, 5.2, z0 + 1.2, 1.0, 1.0, 0.8, '#9a7a4a');
  }
  return { wall: wall + side, floor, body: things };
}

function hoTechSvg(t, i){
  const c = t.color, cd = hoShade(c, -0.25), sk = t.skin;
  return `<g class="ho-tech idle" data-t="${i}"><ellipse rx="9" ry="3.4" fill="rgba(0,0,0,.35)"/>` +
    `<g transform="scale(1.75)"><g class="ho-flip"><g class="ho-body">` +
      `<g class="ho-leg ho-leg-b" style="transform-origin:-1px -14px"><path d="M-1 -14L-1 -2.2" stroke="#1f3048" stroke-width="3.4" stroke-linecap="round"/><path d="M-2.4 -1.6h4.4a1.3 1.3 0 0 1 0 2.4h-4.4z" fill="#151515"/></g>` +
      `<g class="ho-arm ho-arm-b" style="transform-origin:-0.5px -24.5px"><path d="M-0.5 -24.5L-0.5 -16" stroke="${cd}" stroke-width="3" stroke-linecap="round"/><circle cx="-0.5" cy="-15.2" r="1.5" fill="${hoShade(sk, -0.12)}"/></g>` +
      `<g class="ho-leg ho-leg-f" style="transform-origin:1px -14px"><path d="M1 -14L1 -2.2" stroke="#2b4160" stroke-width="3.4" stroke-linecap="round"/><path d="M-0.4 -1.6h4.4a1.3 1.3 0 0 1 0 2.4h-4.4z" fill="#1a1a1a"/></g>` +
      `<path d="M-4.2 -14.5L-4.6 -24.5Q-4.4 -27.5 -1 -27.5L1.6 -27.5Q4.8 -27.3 4.6 -24.5L4.2 -14.5Z" fill="${c}"/>` +
      `<path d="M-4.2 -14.5L-4.6 -24.5Q-4.4 -27.5 -1 -27.5L-0.4 -27.5L-1.2 -14.5Z" fill="${cd}" opacity=".45"/>` +
      `<rect x="-4.5" y="-21.2" width="9" height="1.3" fill="#e8f35a" opacity=".92"/><rect x="-4.4" y="-18.2" width="8.8" height="1.1" fill="#cfd6dc" opacity=".85"/>` +
      `<rect x="-4.3" y="-15.4" width="8.6" height="1.3" fill="#262626"/>` +
      `<rect x="-0.9" y="-29.2" width="2.4" height="2.2" fill="${hoShade(sk, -0.15)}"/>` +
      `<ellipse cx="0.4" cy="-32" rx="3.6" ry="4" fill="${sk}"/>` +
      `<circle cx="-0.9" cy="-31.8" r="0.8" fill="${hoShade(sk, -0.15)}"/>` +
      `<circle cx="2.6" cy="-32.4" r="0.55" fill="#1d1d1d"/><path d="M3.9 -31.6l0.6 0.9-0.7 0.1" fill="none" stroke="${hoShade(sk, -0.25)}" stroke-width="0.45"/>` +
      `<path d="M1.6 -29.6q1 0.5 1.8 0" fill="none" stroke="${hoShade(sk, -0.35)}" stroke-width="0.4"/>` +
      `<path d="M-3.5 -33.4Q-3.4 -38.7 0.6 -38.7Q4.5 -38.6 4.3 -33.4Z" fill="#f2c318"/><path d="M-1.5 -38.2Q0.6 -38.9 2.4 -38.2L1.9 -33.4H-1Z" fill="#ffe066" opacity=".45"/>` +
      `<rect x="-3.8" y="-34.1" width="9.8" height="1.15" rx="0.5" fill="#cfa20d"/>` +
      `<g class="ho-arm ho-arm-f" style="transform-origin:1px -24.5px"><path d="M1 -24.5L1 -16" stroke="${c}" stroke-width="3.2" stroke-linecap="round"/><circle cx="1" cy="-15.2" r="1.6" fill="${sk}"/>` +
        `<g class="ho-wrench"><path d="M1 -15L1 -8.6" stroke="#b4bec6" stroke-width="1.1" stroke-linecap="round"/><path d="M-0.7 -8.8a1.7 1.7 0 1 0 3.4 0l-0.9 -0.1v0.9h-1.6v-0.9z" fill="#b4bec6"/></g>` +
        `<g class="ho-cup"><rect x="-0.3" y="-16.9" width="2.7" height="3" rx="0.4" fill="#f4f1ea"/><path d="M2.4 -16.2a1 1 0 0 1 0 1.7" stroke="#f4f1ea" stroke-width="0.5" fill="none"/></g>` +
        `<g class="p-book" transform="rotate(52 1 -16)"><rect x="-2.2" y="-18.4" width="6.8" height="4.6" rx="0.4" fill="#2f5fa8"/><rect x="-1.7" y="-18" width="5.8" height="3.8" fill="#f4f1ea"/><line x1="1.2" y1="-18" x2="1.2" y2="-14.2" stroke="#b9b2a2" stroke-width="0.3"/><rect class="p-page" x="1.2" y="-17.8" width="2.8" height="3.4" fill="#ffffff"/></g>` +
        `<g class="p-mop"><path d="M1 -19L7.5 1" stroke="#9a6b3c" stroke-width="0.9" stroke-linecap="round"/><path d="M4.4 0.4h6.4l-0.6 1.8h-5.2z" fill="#d9dde0"/><path d="M5 2.2v1.2M6.4 2.2v1.4M7.8 2.2v1.3M9.2 2.2v1.2" stroke="#c4c9cd" stroke-width="0.5"/></g>` +
        `<g class="p-clip"><rect x="-0.8" y="-18.6" width="5" height="6.2" rx="0.4" fill="#8a6a3a"/><rect x="-0.3" y="-17.6" width="4" height="4.9" fill="#f4f1ea"/><rect x="0.6" y="-19.1" width="2.2" height="1" rx="0.3" fill="#9aa4ab"/><path d="M0.2 -16.4h3M0.2 -15.2h3M0.2 -14h2" stroke="#9aa4ab" stroke-width="0.3"/></g>` +
        `<g class="p-can"><path d="M-0.4 -17.4h4.6v3.6h-4.6z" fill="#3aa36a"/><path d="M4.2 -16.6L8.4 -18.6" stroke="#3aa36a" stroke-width="0.9" stroke-linecap="round"/><path d="M0.3 -17.4q1.8 -2.4 3.4 0" fill="none" stroke="#2c7a50" stroke-width="0.5"/>` +
          `<g class="p-drops" fill="#7fc4ef"><circle cx="8.9" cy="-17.6" r="0.35"/><circle cx="9.4" cy="-16.4" r="0.3"/><circle cx="8.7" cy="-15.4" r="0.3"/></g></g>` +
        `<g class="p-duster"><path d="M1 -15L1 -9.8" stroke="#6b4a2b" stroke-width="0.8" stroke-linecap="round"/><ellipse cx="1" cy="-7.6" rx="1.9" ry="2.8" fill="#e9b44c"/><ellipse cx="0.4" cy="-8.2" rx="0.8" ry="1.6" fill="#f6d27f"/></g>` +
      `</g>` +
    `</g></g>` +
    `<g class="p-cone" transform="translate(9,0)"><path d="M-2.4 0L-0.6 -7.2h1.2L2.4 0z" fill="#f5c518"/><rect x="-3" y="-0.6" width="6" height="0.9" rx="0.3" fill="#d9a800"/><path d="M-1.2 -4.2h2.4" stroke="#1d1d1d" stroke-width="0.6"/></g>` +
    `</g>` +
    `<text class="ho-ttag" y="-74" text-anchor="middle"></text>` +
    `<g class="ho-bubble" transform="translate(0,-90)"><rect x="-20" y="-11" width="40" height="18" rx="8" fill="#f4f6f8"/><path d="M-3 7L0 12L3 7z" fill="#f4f6f8"/><text y="2.6" text-anchor="middle" font-size="10" fill="#1d2328"></text></g></g>`;
}

// --- Elevador: poço envidraçado com colunas, cabine com portas e indicador de piso ---
// A cabine é desenhada à altura 0 e depois deslocada (translate) para a altura atual.
function hoLiftSvg(shown, floors){
  const { R, C, H, RB, E, FH } = HO, S = HO.S;
  const sx0 = -RB - E + .2, sy0 = R + .4, sw = E - .4, sd = C - .8;   // poço: x -13.8..-10.2, y 10.4..14.6
  const zb = Math.min(...shown) * FH - .6, zt = Math.max(...shown) * FH + H + 1.2, sh = zt - zb;
  const post = (x, y) => hoBox(x - .1, y - .1, zb, .2, .2, sh, '#4a5966');
  let back = `<g transform="${hoM('wallY', sx0, sy0, zt)}"><rect width="${sw}" height="${sh}" fill="rgba(22,36,48,.62)"/></g>` +
    `<g transform="${hoM('wallX', sx0, sy0, zt)}"><rect width="${sd}" height="${sh}" fill="rgba(18,30,40,.7)"/></g>`;
  // vigas horizontais em cada piso (nas duas faces de trás)
  for(let f = Math.min(...shown); f <= Math.max(...shown); f++){
    const z = f * FH + H + .6;
    back += `<polyline points="${hoPts([[sx0, sy0 + sd, z], [sx0, sy0, z], [sx0 + sw, sy0, z]])}" fill="none" stroke="#4a5966" stroke-width="2.5"/>`;
  }
  back += post(sx0, sy0) + post(sx0 + sw, sy0);
  // cabine (altura 0)
  const cx0 = -RB - E + .4, cy0 = R + .6, cw = E - .8, cd = C - 1.2, CH = HO_CAB_H;   // x -13.6..-10.4, y 10.6..14.4
  const cabBack = hoBox(cx0, cy0, -.25, cw, cd, .25, '#3a4650') +
    `<g transform="${hoM('floor', cx0, cy0, 0)}"><rect width="${cw}" height="${cd}" fill="#46535e"/><rect x=".3" y=".3" width="${cw - .6}" height="${cd - .6}" fill="none" stroke="#2f3a43" stroke-width=".06"/></g>` +
    `<g transform="${hoM('wallY', cx0, cy0, CH)}"><rect width="${cw}" height="${CH}" fill="#6d7c88"/>` +
      `<rect x=".35" y=".6" width="${cw - .7}" height="2.8" fill="#a9bdca" opacity=".35"/><line x1=".2" y1="${CH - 1.7}" x2="${cw - .2}" y2="${CH - 1.7}" stroke="#c9d3da" stroke-width=".12"/></g>` +
    `<g transform="${hoM('wallX', cx0, cy0, CH)}"><rect width="${cd}" height="${CH}" fill="#5a6874"/><line x1=".2" y1="${CH - 1.7}" x2="${cd - .2}" y2="${CH - 1.7}" stroke="#b9c4cc" stroke-width=".12"/></g>`;
  const doorW = (cd - .8) / 2;
  const cabFront = `<g transform="${hoM('wallY', cx0, cy0 + cd, CH)}"><rect width="${cw}" height="${CH}" fill="rgba(170,215,240,.10)" stroke="#9fb3c0" stroke-width=".08"/>` +
      `<line x1="${cw / 2}" y1="0" x2="${cw / 2}" y2="${CH}" stroke="#9fb3c0" stroke-width=".05" opacity=".6"/></g>` +
    `<g transform="${hoM('wallX', cx0 + cw, cy0, CH)}"><rect width="${cd}" height="${CH}" fill="none" stroke="#9fb3c0" stroke-width=".1"/>` +
      `<g clip-path="url(#hoDoorClip)"><rect class="ho-door-a" x=".4" y=".25" width="${doorW}" height="${CH - .25}" fill="rgba(170,215,240,.16)" stroke="#c4d2db" stroke-width=".06"/>` +
      `<rect class="ho-door-b" x="${.4 + doorW}" y=".25" width="${doorW}" height="${CH - .25}" fill="rgba(170,215,240,.16)" stroke="#c4d2db" stroke-width=".06"/></g></g>` +
    `<g opacity=".4">${hoBox(cx0, cy0, CH, cw, cd, .3, '#2b343c')}</g>` +   // tejadilho translúcido: vê-se quem vai lá dentro
    `<g transform="${hoM('floor', cx0, cy0, CH + .3)}"><rect x=".5" y=".5" width="${cw - 1}" height="${cd - 1}" fill="none" stroke="#e0b53a" stroke-width=".08" stroke-dasharray=".3 .25"/></g>`;
  const [ax, ay] = hoP(cx0 + cw / 2, cy0 + cd / 2, zt);
  let front = post(sx0, sy0 + sd) + post(sx0 + sw, sy0 + sd) +
    hoBox(sx0 - .1, sy0 - .1, zt, sw + .2, sd + .2, .7, '#2b343c') +
    `<line class="ho-cable" x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}" stroke="#1d252c" stroke-width="1.6"/>`;
  // indicador de piso por cima da porta, em cada piso visível
  shown.forEach(f => {
    const [ix, iy] = hoP(sx0 + sw + .05, sy0 + sd / 2, f * FH + H - .2);
    front += `<g transform="translate(${ix.toFixed(1)},${iy.toFixed(1)})"><rect x="-11" y="-8" width="22" height="13" rx="2" fill="#05090c" stroke="#2c4252"/>` +
      `<text class="ho-lift-ind" x="0" y="2" text-anchor="middle" font-size="9" font-weight="700" fill="var(--amber)">0</text></g>`;
  });
  return { back, cabBack, cabFront, front, cable: { x: ax, y: ay, zt } };
}
function hoInLift(t){
  return t.x < -HO.RB - .3 && t.x > -HO.RB - HO.E + .3 && t.y > HO.R + .5 && t.y < HO.R + HO.C - .5;
}
// Move a cabine: acompanha o técnico que vai lá dentro, ou vai buscar quem a chamou
function hoLiftStep(dt){
  const L = ho.lift, b = L.busy;
  let moving = false;
  if(b && hoInLift(b)){ L.z = b.z; moving = !!(b.path.length && Math.abs(b.path[0].f * HO.FH - b.z) > .01); }
  else if(L.target != null){
    const tz = L.target * HO.FH, d = tz - L.z, st = HO.LIFT * dt;
    if(Math.abs(d) <= st){ L.z = tz; L.target = null; } else { L.z += Math.sign(d) * st; moving = true; }
  }
  L.moving = moving;
  return moving;
}
function hoPlaceLift(){
  const L = ho.lift, g = ho.liftEl;
  if(!g) return;
  const vis = ho.view === 'all' || Math.abs(L.z - ho.view * HO.FH) < HO.FH * .5;
  g.style.display = vis ? '' : 'none';
  g.setAttribute('transform', `translate(0,${(-L.z * HO.S).toFixed(1)})`);
  const open = !L.moving && (!!L.busy || ho.techs.some(t => t.path[0] && t.path[0].wait));
  g.classList.toggle('open', open);
  if(ho.liftCable){
    const c = ho.liftCable;
    c.el.setAttribute('y1', (c.y + (c.zt - L.z - HO_CAB_H - .3) * HO.S).toFixed(1));
  }
  const fl = Math.round(L.z / HO.FH), dir = L.moving ? (L.busy && L.busy.path[0] ? (L.busy.path[0].f * HO.FH > L.z ? '▲' : '▼') : (L.target != null && L.target * HO.FH > L.z ? '▲' : '▼')) : '';
  const txt = dir + fl;
  (ho.liftInd || []).forEach(el => { if(el.textContent !== txt) el.textContent = txt; });
}

// --- Construção do prédio (só quando a lista de máquinas muda) ---
function hoBuild(host, list, models){
  const { R, C, H, RB, E, FH } = HO, n = list.length;
  const { floors, perFloor } = hoFloorsOf(n);
  ho.perFloor = perFloor;
  ho.floors = floors;
  const shown = ho.view === 'all' ? [...Array(floors).keys()] : [ho.view];
  ho.zShift = ho.view === 'all' ? 0 : ho.view * FH;
  const xmin = -RB - E, xmax = perFloor * R, yc = R + C;

  let defs = `<defs>` +
    `<pattern id="hoTile" width="1" height="1" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#26394a"/><path d="M1 0H0V1" fill="none" stroke="#1d2d3a" stroke-width="0.06"/></pattern>` +
    `<pattern id="hoWood" width="2.5" height="0.6" patternUnits="userSpaceOnUse"><rect width="2.5" height="0.6" fill="#5a3e2b"/><path d="M0 0.6H2.5M1.2 0V0.6" stroke="#47301f" stroke-width="0.05"/></pattern>` +
    `<pattern id="hoCorr" width="1.6" height="1.6" patternUnits="userSpaceOnUse"><rect width="1.6" height="1.6" fill="#1b2a35"/><path d="M1.6 0H0V1.6" fill="none" stroke="#162330" stroke-width="0.05"/></pattern>` +
    `<radialGradient id="hoLampGlow"><stop offset="0" stop-color="#fff6d8" stop-opacity="0.16"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="hoSky" x1="0" y1="0" x2="0" y2="1"><stop data-k="sky0" offset="0" stop-color="#7cc4ff"/><stop data-k="sky1" offset="1" stop-color="#cfe9ff"/></linearGradient>` +
    `<clipPath id="hoDoorClip"><rect x=".3" y="0" width="${HO.C - 1.8}" height="${HO_CAB_H}"/></clipPath>` +
    `<filter id="hoGlow" x="-2" y="-2" width="5" height="5"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `</defs>`;

  let scene = '', hits = '', rails = '';
  const cells = {};
  list.forEach((dev, i) => {
    const f = Math.floor(i / perFloor), c = i % perFloor;
    if(shown.includes(f)) (cells[f] = cells[f] || []).push(hoRoomSvg(dev, i, f, c, models[i]));
  });
  for(const f of [...shown].reverse()){
    const z0 = f * FH, side = hoSideRoomSvg(f), rooms = cells[f] || [];
    for(let c = rooms.length; c < perFloor; c++) rooms.push(hoEmptyRoomSvg(f, c, f * perFloor + c));
    // laje, corredor e plataforma do elevador
    scene += `<polygon points="${hoPts([[xmin, yc, z0 - 0.6], [xmax, yc, z0 - 0.6], [xmax, yc, z0], [xmin, yc, z0]])}" fill="#0e171e"/>`;
    scene += `<polygon points="${hoPts([[xmax, 0, z0 - 0.6], [xmax, yc, z0 - 0.6], [xmax, yc, z0], [xmax, 0, z0]])}" fill="#111c24"/>`;
    scene += `<polygon points="${hoPts([[xmin, R, z0], [xmax, R, z0], [xmax, yc, z0], [xmin, yc, z0]])}" fill="#16232d"/>`;
    scene += `<g transform="${hoM('floor', -RB, R, z0)}"><rect width="${xmax + RB}" height="${C}" fill="url(#hoCorr)"/>` +
      `<line x1="0" y1="0.3" x2="${xmax + RB}" y2="0.3" stroke="#e0b53a" stroke-width="0.08" stroke-dasharray="0.6 0.4" opacity="0.6"/>` +
      `<text x="${xmax + RB - 0.6}" y="${C - 0.7}" font-size="1.1" font-weight="700" text-anchor="end" fill="#2c4252">PISO ${f}</text></g>`;
    scene += `<g transform="${hoM('floor', xmin, R, z0)}"><rect width="${E}" height="${C}" fill="#2a3640" stroke="#4a6070" stroke-width="0.08"/>` +
      `<path d="M0.3 0.3H${E - 0.3}" stroke="#e0b53a" stroke-width="0.25" stroke-dasharray="0.35 0.35"/><text x="${E / 2}" y="${C / 2 + 0.3}" font-size="0.8" text-anchor="middle" fill="#6f8696" font-weight="700">ELEV.</text></g>`;
    scene += side.wall + rooms.map(r => r.wall).join('');
    scene += side.floor + rooms.map(r => r.floor).join('');
    scene += side.body + rooms.map(r => r.body).join('');
    hits += rooms.map(r => r.hit).join('');
  }
  // poço e cabine do elevador
  const lift = hoLiftSvg(shown, floors);
  rails = `<g class="ho-shaft">${lift.back}</g>` +
    `<g class="ho-lift"><g>${lift.cabBack}</g><g class="ho-lift-inside"></g><g>${lift.cabFront}</g></g>` +
    `<g class="ho-shaft">${lift.front}</g>`;

  // limites para o viewBox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for(const f of shown){
    const z0 = f * FH;
    [[xmin, 0, z0 + H + 3], [xmax, 0, z0 + H], [xmax, yc, z0 - 0.6], [xmin, yc, z0 - 0.6], [xmin, 0, z0 - 0.6], [xmax, 0, z0 - 0.6], [xmin, yc, z0 + 5]].forEach(p => {
      const [X, Y] = hoP(p[0], p[1], p[2]);
      minX = Math.min(minX, X); maxX = Math.max(maxX, X); minY = Math.min(minY, Y); maxY = Math.max(maxY, Y);
    });
  }
  const pad = 18;
  ho.baseVB = [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2];
  ho.zoom = { k: 1, cx: 0, cy: 0 };
  const vb = ho.baseVB.map(v => v.toFixed(0)).join(' ');
  host.innerHTML = `<svg viewBox="${vb}" role="img" aria-label="Escritório: um quarto por máquina">${defs}${scene}${rails}<g class="ho-techs"></g>${hits}</svg>`;
  ho.liftEl = host.querySelector('.ho-lift');
  ho.liftInside = host.querySelector('.ho-lift-inside');
  ho.liftInd = [...host.querySelectorAll('.ho-lift-ind')];
  ho.liftCable = { el: host.querySelector('.ho-cable'), y: lift.cable.y, zt: lift.cable.zt };

  // referências para as atualizações rápidas
  ho.rooms = {};
  Object.keys(officeEls).forEach(k => delete officeEls[k]);
  list.forEach((dev, i) => {
    const k = String(dev.id), g = host.querySelector(`.ho-room[data-room="${CSS.escape(k)}"]`);
    const w = host.querySelector(`[data-wall="${CSS.escape(k)}"]`);
    if(!g || !w) return;
    const q = sel => [...g.querySelectorAll(sel)];
    ho.rooms[k] = {
      g, model: models[i],
      light: g.querySelector('[data-k="light"]'),
      hs: q('[data-k="hs"]'), fans: q('[data-k="fan"]'), led: g.querySelector('[data-k="led"]'),
      wisps: g.querySelector('[data-k="wisps"]'),
      plate: w.querySelector('[data-k="plate"]'),
      dot: w.querySelector('[data-k="dot"]'),
      mhash: w.querySelector('[data-k="mhash"]'),
      mtemp: w.querySelector('[data-k="mtemp"]'),
      spark: w.querySelector('[data-k="spark"]')
    };
    officeEls[k] = g;
  });

  // técnicos: mantém as posições dos que já existiam
  const T = Math.min(HO_STAFF.length, Math.max(2, Math.ceil(n / 4)));
  const old = ho.techs;
  ho.techs = HO_STAFF.slice(0, T).map((s, i) => {
    const prev = old[i];
    const t = prev || { ...s, i, x: HO_REST[i][0], y: HO_REST[i][1], z: 0, face: 1, path: [], target: null, mode: 'idle' };
    if(prev && prev.target != null && !ho.rooms[prev.target]) prev.target = null;
    return t;
  });
  if(ho.lift.busy && !ho.techs.includes(ho.lift.busy)) ho.lift.busy = null;
  const layer = ho.techLayer = host.querySelector('.ho-techs');
  layer.innerHTML = ho.techs.map((t, i) => hoTechSvg(t, i)).join('');
  ho.techs.forEach((t, i) => {
    t.el = layer.querySelector(`[data-t="${i}"]`);
    t.flip = t.el.querySelector('.ho-flip');
    t.tag = t.el.querySelector('.ho-ttag');
    t.bubble = t.el.querySelector('.ho-bubble text');
    t.saying = false;
    // a disposição pode ter mudado: volta a pôr cada técnico a caminho do sítio certo
    if(t.actRoom != null && t.actRoom >= n) hoEndAct(t);
    const dest = t.target != null ? hoWorkSpot(ho.idx[t.target]) : (t.act && t.actDest) || hoRestSpot(t);
    if(dest && (Math.abs(dest.x - t.x) + Math.abs(dest.y - t.y) > 0.2 || Math.abs(dest.f * FH - t.z) > 0.01)) hoRoute(t, dest);
  });
  hoPlaceTechs();
}

// --- Técnicos: rotas, movimento e despacho ---
function hoWorkSpot(i){
  if(i == null) return null;
  return { x: (i % ho.perFloor) * HO.R + 4.6, y: 6.1, f: Math.floor(i / ho.perFloor) };
}
function hoRestSpot(t){
  const [x, y] = HO_REST[t.i % HO_REST.length];
  return { x, y, f: 0 };
}
function hoReducedMotion(){
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e) { return false; }
}
function hoRoute(t, dest){
  const yc = HO.R + HO.C / 2, xE = -HO.RB - HO.E / 2, xD = -HO.RB + .8, cf = Math.round(t.z / HO.FH);
  const path = [];
  if(!hoInLift(t) && ho.lift.busy === t) ho.lift.busy = null;   // mudou de rota antes de entrar
  if(hoInLift(t)){
    // já está dentro da cabine: segue nela até ao piso de destino e sai
    ho.lift.busy = t; ho.lift.target = null;
    path.push({ x: xE, y: yc, f: cf });
    if(dest.f !== cf) path.push({ x: xE, y: yc, f: dest.f });
    path.push({ x: xD, y: yc, f: dest.f, exit: true });
  } else {
    if(Math.abs(t.y - yc) > 0.3) path.push({ x: t.x, y: yc, f: cf });
    if(dest.f !== cf){
      path.push({ x: xD, y: yc, f: cf });                 // porta do elevador
      path.push({ x: xD, y: yc, f: cf, wait: true });     // chama a cabine e espera
      path.push({ x: xE, y: yc, f: cf });                 // entra
      path.push({ x: xE, y: yc, f: dest.f });             // viagem
      path.push({ x: xD, y: yc, f: dest.f, exit: true }); // sai
    }
  }
  path.push({ x: dest.x, y: yc, f: dest.f });
  path.push({ x: dest.x, y: dest.y, f: dest.f });
  if(hoReducedMotion()){
    if(ho.lift.busy === t) ho.lift.busy = null;
    t.x = dest.x; t.y = dest.y; t.z = dest.f * HO.FH; t.path = [];
    hoArrive(t);
    return;
  }
  t.path = path;
  hoKick();
}
function hoArrive(t){
  t.mode = t.target != null ? 'work' : t.act ? 'act' : 'idle';
  if(t.target != null){
    const i = ho.idx[t.target];
    const mx = (i % ho.perFloor) * HO.R + 3.2, my = 2.6;
    t.face = (mx - t.x) - (my - t.y) >= 0 ? 1 : -1;
  } else if(t.act){
    const look = t.act === 'chat' && t.partner ? t.partner.actDest : t.look;
    if(look) t.face = (look.x - t.x) - (look.y - t.y) >= 0 ? 1 : -1;
    const [a, b] = HO_ACTS[t.act].dur;
    t.actUntil = Date.now() + (a + Math.random() * (b - a)) * 1000;
  } else {
    t.face = t.i % 2 ? -1 : 1;
  }
}

// --- Rotina sem avarias: cada técnico vai fazendo coisas diferentes ---
const HO_ACTS = {
  read:    { label: 'a ler',            dur: [14, 26] },
  coffee:  { label: 'a beber café',     dur: [8, 14] },
  mop:     { label: 'a limpar o chão',  dur: [12, 20] },
  inspect: { label: 'inspeção',         dur: [8, 14], room: true },
  water:   { label: 'a regar',          dur: [6, 10], room: true },
  dust:    { label: 'a limpar o pó',    dur: [8, 12], room: true },
  chat:    { label: '💬',               dur: [10, 18] },
  stretch: { label: 'alongamentos',     dur: [5, 8] }
};
const HO_CHAT = ['💬', '😂', '☕?', '⛏️ BTC!', '👍', '🤔', '📈', '🔥', '😴', '🍕'];
const HO_COFFEE = [[-2.3, 2.6], [-1.0, 2.8]];
const HO_CHAT_SPOTS = [[-7.2, 3.8], [-4.2, 2.6]];

function hoRandomRoom(){
  const n = (ho.list || []).length;
  if(!n) return null;
  // de preferência no piso que está a ser visto, para se ver a rotina
  let pool = [...Array(n).keys()];
  if(ho.view !== 'all' && ho.view != null){
    const own = pool.filter(i => Math.floor(i / ho.perFloor) === ho.view);
    if(own.length && Math.random() < 0.75) pool = own;
  }
  const calm = pool.filter(i => !HO_PRIORITY[(ho.states || {})[String(ho.list[i].id)]] && !ho.techs.some(u => u.actRoom === i && u.act));
  const list = calm.length ? calm : pool;
  return list[Math.floor(Math.random() * list.length)];
}

function hoStartAct(t, kind, partner){
  t.act = kind;
  t.actRoom = null;
  t.look = null;
  t.partner = null;
  let dest;
  if(kind === 'read' || kind === 'stretch'){
    dest = hoRestSpot(t);
  } else if(kind === 'coffee'){
    const [x, y] = HO_COFFEE[t.i % 2];
    dest = { x, y, f: 0 };
    t.look = { x: -2.45, y: 1.1 };
  } else if(kind === 'chat'){
    const [x, y] = HO_CHAT_SPOTS[0], [x2, y2] = HO_CHAT_SPOTS[1];
    dest = { x, y, f: 0 };
    partner.act = 'chat'; partner.actRoom = null; partner.look = null;
    partner.partner = t; t.partner = partner;
    partner.actDest = { x: x2, y: y2, f: 0 };
    partner.mode = 'act';
    hoRoute(partner, partner.actDest);
  } else if(kind === 'mop'){
    const f = ho.view !== 'all' && ho.view != null ? ho.view : Math.floor(Math.random() * ho.floors);
    dest = { x: 1 + Math.random() * Math.max(1, ho.perFloor * HO.R - 3), y: HO.R + 1.4 + Math.random() * 2.4, f };
  } else {
    const i = hoRandomRoom();
    if(i == null){ t.act = null; return; }
    t.actRoom = i;
    const x0 = (i % ho.perFloor) * HO.R, f = Math.floor(i / ho.perFloor);
    if(kind === 'water'){ dest = { x: x0 + 7.4, y: 9.7, f }; t.look = { x: x0 + 8.95, y: 8.75 }; }
    else { dest = hoWorkSpot(i); t.look = { x: x0 + 3.2, y: 2.6 }; }
  }
  t.actDest = dest;
  t.actUntil = Infinity;   // o relógio só começa quando chega ao sítio
  t.mode = 'act';
  hoRoute(t, dest);
}

function hoPickAct(t){
  const free = u => u !== t && u.target == null && !u.path.length && u.act !== 'chat';
  const partner = ho.techs.find(free);
  // nunca repete a última e não faz o mesmo que um colega já está a fazer
  let kinds = Object.keys(HO_ACTS).filter(k => k !== t.lastAct && !ho.techs.some(u => u !== t && u.act === k));
  if(!partner) kinds = kinds.filter(k => k !== 'chat');
  if(!(ho.list || []).length) kinds = kinds.filter(k => !HO_ACTS[k].room && k !== 'mop');
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  t.lastAct = kind;
  if(kind === 'chat') partner.lastAct = 'chat';
  hoStartAct(t, kind, partner);
}

function hoEndAct(t){
  t.act = null;
  t.actRoom = null;
  t.partner = null;
  t.mode = 'idle';
  t.nextPick = Date.now() + 2000 + Math.random() * 4000;
}

setInterval(() => {
  if(document.hidden || !ho.techs.length || !$('officeSvgHost')?.querySelector('svg')) return;
  const now = Date.now();
  ho.techs.forEach(t => {
    if(t.target != null || !t.el) return;
    if(t.act){
      if(t.act === 'chat' && (!t.partner || t.partner.act !== 'chat' || t.partner.target != null)){ hoEndAct(t); return; }
      if(!t.path.length && now >= t.actUntil){
        if(t.act === 'chat' && t.partner) hoEndAct(t.partner);
        hoEndAct(t);
      }
      return;
    }
    if(!t.path.length && now >= (t.nextPick || 0)) hoPickAct(t);
  });
  hoPlaceTechs();
}, 1000);
function hoKick(){
  if(!ho.raf){ ho.last = 0; ho.raf = requestAnimationFrame(hoTick); }
}
function hoTick(now){
  ho.raf = 0;
  const dt = ho.last ? Math.max(0, Math.min(0.1, (now - ho.last) / 1000)) : 0;
  ho.last = now;
  let moving = false;
  ho.techs.forEach(t => {
    if(!t.path.length) return;
    moving = true;
    const p = t.path[0], tz = p.f * HO.FH;
    if(p.wait){
      const L = ho.lift, here = Math.abs(L.z - tz) < .01;
      if(!L.busy && here && L.target == null && !L.moving){ L.busy = t; t.path.shift(); }
      else if(!L.busy && L.target == null && !here) L.target = p.f;
      return;
    }
    const dx = p.x - t.x, dy = p.y - t.y, dz = tz - t.z;
    const dist = Math.hypot(dx, dy, dz);
    const step = (Math.abs(dz) > 0.01 ? HO.LIFT : HO.SPEED) * dt;
    if(Math.abs(dx - dy) > 0.01) t.face = dx - dy > 0 ? 1 : -1;
    if(dist <= step){ t.x = p.x; t.y = p.y; t.z = tz; t.path.shift(); if(p.exit && ho.lift.busy === t) ho.lift.busy = null; }
    else { t.x += dx / dist * step; t.y += dy / dist * step; t.z += dz / dist * step; }
    if(!t.path.length) hoArrive(t);
  });
  if(hoLiftStep(dt)) moving = true;
  hoPlaceTechs();
  if(moving) ho.raf = requestAnimationFrame(hoTick);
}
function hoPlaceTechs(){
  if(!ho.techs.length) return;
  const states = ho.states || {};
  ho.techs.forEach(t => {
    if(!t.el) return;
    const vis = ho.view === 'all' || Math.abs(t.z - ho.view * HO.FH) < HO.FH * 0.45;
    if(t.el.style.display !== (vis ? '' : 'none')) t.el.style.display = vis ? '' : 'none';
    // dentro da cabine, a posição é relativa à cabine (que já está deslocada para a altura dela)
    const [X, Y] = hoInLift(t) ? hoP(t.x, t.y, t.z - ho.lift.z) : hoP(t.x, t.y, t.z);
    t.el.setAttribute('transform', `translate(${X.toFixed(1)},${Y.toFixed(1)})`);
    t.flip.setAttribute('transform', t.face < 0 ? 'scale(-1,1)' : '');
    const mode = t.path.length ? 'walk' : t.mode;
    const acting = mode === 'act' && t.act;
    const speaking = acting && t.act === 'chat' && t.partner && !t.partner.path.length && Math.floor(Date.now() / 2500) % 2 === t.i % 2;
    const cls = 'ho-tech ' + mode + (acting ? ' a-' + t.act : '') + (speaking ? ' speaking' : '') +
      (mode === 'walk' && t.act === 'mop' ? ' a-mop' : '') + (mode === 'work' && states[t.target] === 'hot' ? ' urgent' : '');
    if(t.el.getAttribute('class') !== cls) t.el.setAttribute('class', cls);
    if(speaking && !t.saying){ t.bubble.textContent = HO_CHAT[Math.floor(Math.random() * HO_CHAT.length)]; }
    t.saying = speaking;
    const i = t.target != null ? ho.idx[t.target] : null;
    let tag = t.name;
    if(i != null) tag += ' · ' + hoRoomLabel(i);
    else if(t.act) tag += ' · ' + HO_ACTS[t.act].label + (t.actRoom != null ? ' ' + hoRoomLabel(t.actRoom) : '');
    if(t.tag.textContent !== tag) t.tag.textContent = tag;
  });
  // quem vai na cabine fica entre as paredes e o vidro dela; os outros por ordem de profundidade
  const layer = ho.techLayer;
  ho.techs.forEach(t => {
    const want = hoInLift(t) && ho.liftInside ? ho.liftInside : layer;
    if(want && t.el && t.el.parentNode !== want) want.appendChild(t.el);
  });
  if(layer){
    const out = ho.techs.filter(t => t.el && t.el.parentNode === layer).sort((a, b) => (a.x + a.y) - (b.x + b.y));
    if(out.some((t, i) => layer.children[i] !== t.el)) out.forEach(t => layer.appendChild(t.el));
  }
  hoPlaceLift();
}

function hoLog(text, kind, id){
  ho.log.push({ t: Date.now(), text, kind, id });
  if(ho.log.length > 60) ho.log = ho.log.slice(-60);
  try { localStorage.setItem(HO_LOG_KEY, JSON.stringify(ho.log)); } catch(e) {}
}

function hoDispatch(list, states){
  const name = d => hoRoomLabel(ho.idx[String(d.id)]) + ' ' + d.name;
  const problems = list.filter(d => HO_PRIORITY[states[String(d.id)]])
    .sort((a, b) => HO_PRIORITY[states[String(b.id)]] - HO_PRIORITY[states[String(a.id)]]);
  const probIds = new Set(problems.map(d => String(d.id)));
  problems.forEach(d => {
    const k = String(d.id);
    if(!ho.since[k]){ ho.since[k] = Date.now(); hoLog(`${name(d)}: ${OFFICE_STATUS[states[k]].label.toLowerCase()}`, 'bad', k); }
  });
  Object.keys(ho.since).forEach(k => {
    if(probIds.has(k)) return;
    const d = list.find(x => String(x.id) === k);
    if(d && states[k] !== 'idle') hoLog(`${name(d)} resolvido (${Math.max(1, Math.round((Date.now() - ho.since[k]) / 60000))} min)`, 'good', k);
    delete ho.since[k];
  });
  ho.techs.forEach(t => {
    if(t.target != null && !probIds.has(t.target)){ t.target = null; hoEndAct(t); hoRoute(t, hoRestSpot(t)); }
  });
  problems.forEach(d => {
    const k = String(d.id);
    if(ho.techs.some(t => t.target === k)) return;
    const spot = hoWorkSpot(ho.idx[k]);
    const free = ho.techs.filter(t => t.target == null);
    if(!free.length || !spot) return;
    const cost = t => Math.abs(t.x - spot.x) + Math.abs(t.y - spot.y) + Math.abs(t.z - spot.f * HO.FH) * 2;
    const t = free.sort((a, b) => cost(a) - cost(b))[0];
    if(t.act === 'chat' && t.partner) hoEndAct(t.partner);
    hoEndAct(t);
    t.target = k;
    hoRoute(t, spot);
    hoLog(`${t.name} a caminho do ${name(d)}`, 'info', k);
  });
}

// --- Atualização a cada leitura ---
function hoUpdateRoom(dev, i, r, state){
  const room = ho.rooms[String(dev.id)];
  if(!room) return;
  const on = r && r.online;
  room.g.classList.toggle('is-sel', selectedId === dev.id);

  const light = { ok: ['#000', 0], warn: ['#ffb020', 0.06], warm: ['#ffb020', 0.11], hot: ['#ff2a2a', 0.2], off: ['#000', 0.5], portal: ['#4fd6ff', 0.1], idle: ['#000', 0.25] }[state];
  room.light.setAttribute('fill', light[0]);
  room.light.setAttribute('fill-opacity', light[1]);
  room.light.classList.toggle('pulse', state === 'hot');

  const tc = on ? hoTempColor(Number(r.temp)) : '#8d98a2';
  room.hs.forEach(el => {
    if(el.querySelector('[data-face]')) hoPaintBox(el, room.model === 'gpu' ? hoShade(tc, -0.55) : tc);
    else el.setAttribute('fill', tc);
  });

  const ratio = on ? (r.fanPct != null ? r.fanPct / 100 : Math.min((r.fanSpeed || 0) / 6000, 1)) : 0;
  room.fans.forEach(fan => {
    const blades = fan.querySelector('.ho-blades'), blur = fan.querySelector('.ho-fanblur');
    blades.style.setProperty('--fan-dur', Math.max(0.08, 1.1 - ratio * 1.0).toFixed(2) + 's');
    blades.style.animationPlayState = on ? 'running' : 'paused';
    blades.setAttribute('opacity', on ? (1 - ratio * 0.55).toFixed(2) : 1);
    blur.setAttribute('opacity', on ? (ratio * 0.55).toFixed(2) : 0);
  });

  const heat = on ? Math.max(0, Math.min(1, (Number(r.temp) - 45) / 35)) : 0;
  room.wisps.setAttribute('opacity', heat.toFixed(2));
  room.wisps.setAttribute('stroke', heat > 0.6 ? 'rgba(255,120,80,.55)' : 'rgba(255,235,210,.4)');

  if(room.led){
    room.led.setAttribute('fill', { ok: 'var(--green)', warn: 'var(--amber)', warm: 'var(--amber)', hot: 'var(--red)', off: '#3a1a1a', portal: 'var(--cyan)', idle: '#556' }[state]);
    room.led.classList.toggle('blink', state === 'hot' || state === 'portal');
  }

  const label = hoRoomLabel(i) + ' · ' + (dev.name.length > 12 ? dev.name.slice(0, 11) + '…' : dev.name);
  if(room.plate.textContent !== label) room.plate.textContent = label;
  room.dot.setAttribute('fill', OFFICE_STATUS[state].color);
  if(on){
    room.mhash.textContent = officeHashText(r);
    room.mhash.setAttribute('fill', 'var(--green)');
    room.mtemp.textContent = r.temp != null ? Number(r.temp).toFixed(1) + ' °C' : '';
    room.mtemp.setAttribute('fill', state === 'hot' ? 'var(--red)' : state === 'warm' ? 'var(--amber)' : '#9fb3c0');
  } else {
    room.mhash.textContent = state === 'portal' ? 'MODO WI-FI' : state === 'idle' ? 'A LIGAR…' : 'SEM SINAL';
    room.mhash.setAttribute('fill', state === 'portal' ? 'var(--cyan)' : state === 'idle' ? '#9fb3c0' : 'var(--red)');
    room.mtemp.textContent = '';
  }
  const vals = (histories[dev.id] || []).slice(-40).map(h => Number(h && h.hashrate) || 0);
  if(vals.length > 1){
    const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
    room.spark.setAttribute('points', vals.map((v, j) => (5.35 + j / (vals.length - 1) * 3.7).toFixed(2) + ',' + (4.12 - (v - lo) / span * 0.75).toFixed(2)).join(' '));
  } else {
    room.spark.setAttribute('points', '');
  }
}

function hoBoardHtml(r, dev, compact){
  const on = r && r.online;
  const row = (label, val) => '<div><span>' + label + '</span><b>' + escapeHtml(String(val)) + '</b></div>';
  const num = (v, d, unit) => (on && v != null && isFinite(v) && Number(v) !== 0) ? Number(v).toFixed(d) + unit : '—';
  let best = '—';
  if(r && r.best){ const f = formatDiff(r.best); best = f.value + ' ' + f.unit; }
  const fan = !on ? '—' : (r.fanPct != null ? Math.round(r.fanPct) + '%' : (r.fanSpeed ? r.fanSpeed + ' rpm' : '—'));
  let html = row('Hashrate', officeHashText(r)) + row('Temperatura', num(r && r.temp, 1, ' °C')) +
    row('Consumo', num(r && r.power, 1, ' W')) + row('Ventoinha', fan) +
    row('Eficiência', num(r && r.efficiency, 1, ' J/TH')) + row('Melhor dif.', best) +
    row('Aceites / rej.', r ? (r.accepted || 0) + ' / ' + (r.rejected || 0) : '—') +
    row('Uptime', on ? formatUptime(r.uptime).text : '—');
  if(!compact){
    const inParts = [];
    if(on && r.inputV != null) inParts.push(r.inputV.toFixed(2) + ' V');
    if(on && r.inputA != null) inParts.push(r.inputA.toFixed(2) + ' A');
    html += row('Temp. VR', num(r && r.vrTemp, 1, ' °C')) + row('Frequência', num(r && r.frequency, 0, ' MHz')) +
      row('Ping ao pool', num(r && r.poolPing, 0, ' ms')) + row('Latência local', num(r && r.localLatency, 0, ' ms')) +
      row('Wi-Fi', on && r.rssi != null ? r.rssi + ' dBm' : '—') + row('Entrada', inParts.length ? inParts.join(' · ') : '—') +
      row('Pool', on && r.pool ? String(r.pool).replace(/^[a-z+]+:\/\//, '') : '—') + row('Firmware', on && r.firmware ? r.firmware : '—');
  }
  return '<div class="ho-board">' + html + '</div>';
}

function hoStaffLine(dev, state){
  const k = String(dev.id);
  const t = ho.techs.find(x => x.target === k);
  const lastMaint = typeof getLastMaintenanceTime === 'function' ? getLastMaintenanceTime(dev.id) : null;
  let who;
  if(t) who = t.path.length ? `👷 ${t.name} vai a caminho` : `👷 ${t.name} está a tratar disto`;
  else if(HO_PRIORITY[state]) who = '⏳ À espera de um técnico livre';
  else who = '✅ Sem avarias';
  return '<div class="ho-staff">' + who + ' · última manutenção: ' + (lastMaint ? formatMaintDate(lastMaint) : 'nunca registada') + '</div>';
}

function hoRenderDetail(list, states){
  const box = $('officeDetail');
  if(!box) return;
  const dev = list.find(d => d.id === selectedId);
  if(!list.length){ box.innerHTML = '<div class="office-hint">Ainda não há máquinas. Adiciona-as no painel Máquinas: cada uma fica com um quarto livre do prédio.</div>'; return; }
  if(!dev){ box.innerHTML = '<div class="office-hint">Clica num quarto para ver aqui todos os detalhes da máquina.</div>'; return; }
  const k = String(dev.id), st = OFFICE_STATUS[states[k]], i = ho.idx[k];
  box.innerHTML = '<div class="office-detail-head"><small>' + hoRoomLabel(i) + '</small><b>' + escapeHtml(dev.name) + '</b><small>' + escapeHtml(dev.ip || '') + '</small>' +
    '<span class="ho-status" style="color:' + st.color + '">' + st.label + '</span>' +
    '<button type="button" class="office-remove" data-remove="' + escapeHtml(k) + '">✕ Remover</button></div>' +
    hoBoardHtml(readings[dev.id], dev, false) + hoStaffLine(dev, states[k]);
}

function hoRenderLog(){
  const ul = $('officeLog');
  if(!ul) return;
  const items = ho.log.slice(-40).reverse();
  const sig = items.length + ':' + (items[0] ? items[0].t : 0);
  if(ul.dataset.sig === sig) return;
  ul.dataset.sig = sig;
  ul.innerHTML = items.length ? items.map(e => '<li class="' + e.kind + '"' + (e.id != null ? ' data-jump="' + escapeHtml(String(e.id)) + '" title="Ver esta máquina"' : '') + '><time>' +
    new Date(e.t).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) + '</time><span>' + escapeHtml(e.text) + '</span></li>').join('')
    : '<li class="info"><span>Sem avarias registadas hoje. 👌</span></li>';
}

function hoUpdateSky(svg){
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  let sky;
  if(h < 6 || h >= 20.5) sky = ['#060d1f', '#16264a'];
  else if(h < 8) sky = ['#f6a96b', '#6d8fc7'];
  else if(h < 18.5) sky = ['#5fb2ff', '#cfe9ff'];
  else sky = ['#f08a5d', '#3b3f78'];
  const s0 = svg.querySelector('[data-k="sky0"]'), s1 = svg.querySelector('[data-k="sky1"]');
  if(s0){ s0.setAttribute('stop-color', sky[0]); s1.setAttribute('stop-color', sky[1]); }
  const cond = ($('wxCond')?.textContent || '').toLowerCase();
  svg.classList.toggle('ho-night', h < 6.5 || h >= 20);
  svg.classList.toggle('ho-wx-rain', /chuv|rain|aguaceir|trovo|storm|drizzle/.test(cond));
  svg.classList.toggle('ho-wx-cloud', /nubl|nuve|cloud|encob|overcast|nevoeiro|fog/.test(cond));
}

// --- Vista de fora: armazém futurista ---
// O escritório abre com o edifício visto de fora: uma janela por máquina, acesa na
// cor do estado dela, uma faixa de luz por piso e um letreiro no telhado com o total.
// "Entrar" (ou clicar numa janela / num piso) mostra o interior.
const HO_MODE_KEY = 'nerdqaxe:office_mode';
ho.mode = (() => { try { return localStorage.getItem(HO_MODE_KEY) || 'outside'; } catch(e) { return 'outside'; } })();
function hoSetMode(mode){
  if(ho.mode === mode) return;
  ho.mode = mode;
  try { localStorage.setItem(HO_MODE_KEY, mode); } catch(e) {}
  ho.sig = '';
  renderOffice();
  const svg = $('officeSvgHost') && $('officeSvgHost').querySelector('svg');
  if(svg){ svg.classList.remove('ho-swap'); void svg.getBoundingClientRect(); svg.classList.add('ho-swap'); }
}
function hoBuildOutside(host, list){
  const { R, C, RB, E } = HO, n = list.length, FO = 6.5;
  const { floors, perFloor } = hoFloorsOf(n);
  ho.perFloor = perFloor; ho.floors = floors; ho.zShift = 0;
  const x0 = -RB - E, x1 = perFloor * R, y0 = 0, y1 = R + C, top = floors * FO + .8, W = x1 - x0, D = y1 - y0;
  const lobbyW = RB + E, doorU = lobbyW / 2;
  let s = '', hits = '';
  // praça com grelha, caminho iluminado até à porta e plataforma de aterragem
  const px0 = x0 - 7, px1 = x1 + 8, py0 = -5, py1 = y1 + 13;
  let grid = '';
  for(let u = 0; u <= px1 - px0; u += 3) grid += `<line x1="${u}" y1="0" x2="${u}" y2="${py1 - py0}"/>`;
  for(let v = 0; v <= py1 - py0; v += 3) grid += `<line x1="0" y1="${v}" x2="${px1 - px0}" y2="${v}"/>`;
  s += `<g transform="${hoM('floor', px0, py0, -.02)}"><rect width="${px1 - px0}" height="${py1 - py0}" rx=".6" fill="#0a131a"/><g stroke="#132430" stroke-width=".05">${grid}</g></g>`;
  s += `<g transform="${hoM('floor', x0 + doorU - 1.8, y1, -.01)}"><rect width="3.6" height="13" fill="#0f2230"/>` +
    `<line x1=".1" y1="0" x2=".1" y2="13" stroke="var(--cyan)" stroke-width=".1" opacity=".8"/><line x1="3.5" y1="0" x2="3.5" y2="13" stroke="var(--cyan)" stroke-width=".1" opacity=".8"/>` +
    [2, 5, 8, 11].map(v => `<path class="ho-out-arrow" d="M1 ${v + 1.2} L1.8 ${v} L2.6 ${v + 1.2}" fill="none" stroke="var(--cyan)" stroke-width=".18"/>`).join('') + `</g>`;
  s += `<g transform="${hoM('floor', x1 + 3.5, y1 + 6.5, -.01)}"><circle r="2.8" fill="#0d1d28" stroke="var(--amber)" stroke-width=".12"/><circle r="2.2" fill="none" stroke="var(--amber)" stroke-width=".05" stroke-dasharray=".3 .3"/>` +
    `<text y=".55" font-size="1.6" font-weight="700" text-anchor="middle" fill="var(--amber)">H</text></g>`;
  // sombra do edifício
  s += `<polygon points="${hoPts([[x0, y1, 0], [x1, y1, 0], [x1 + 3, y1 + 2, 0], [x1 + 3, y0 + 2, 0], [x1, y0, 0]])}" fill="#000" opacity=".35"/>`;
  // lado direito (x = x1)
  let side = `<rect width="${D}" height="${top}" fill="#09121a"/>`;
  for(let f = 1; f < floors; f++) side += `<rect x="0" y="${top - f * FO - .2}" width="${D}" height=".2" fill="#1d3343"/>`;
  [1.2, D - 1.2].forEach(u => { side += `<rect class="ho-out-strip" x="${u - .12}" y=".6" width=".24" height="${top - 1.2}" fill="var(--cyan)" opacity=".55"/>`; });
  for(let f = 0; f < floors; f++) for(let u = 2.6; u < D - 2.2; u += 1.6) side += `<rect x="${u}" y="${top - (f + 1) * FO + 1.6}" width=".9" height="${FO - 3}" fill="#0e1d28"/>`;
  s += `<g transform="${hoM('wallX', x1, y0, top)}">${side}</g>`;
  // fachada principal (y = y1): uma janela por máquina
  let face = `<rect width="${W}" height="${top}" fill="url(#hoOutGlass)"/>`;
  for(let f = 0; f < floors; f++){
    const vb = top - f * FO, vt = vb - FO;   // base e topo deste piso (coordenadas locais, v para baixo)
    face += `<rect x="0" y="${vb - .28}" width="${W}" height=".28" fill="#1d3343"/><line x1="0" y1="${vb - .28}" x2="${W}" y2="${vb - .28}" stroke="var(--cyan)" stroke-width=".06" opacity=".7"/>`;
    if(f === 0){
      face += `<rect x=".5" y="${vt + .9}" width="${lobbyW - 1}" height="${FO - 1.2}" fill="#4fd6ff" fill-opacity=".08" stroke="#2b5568" stroke-width=".06"/>` +
        `<g class="ho-door-out" data-office="enter"><rect x="${doorU - 1.5}" y="${vb - 4.3}" width="3" height="4" fill="#4fd6ff" fill-opacity=".22" stroke="var(--cyan)" stroke-width=".1"/>` +
        `<line x1="${doorU}" y1="${vb - 4.3}" x2="${doorU}" y2="${vb - .3}" stroke="var(--cyan)" stroke-width=".06"/>` +
        `<rect x="${doorU - 1.9}" y="${vb - 5.3}" width="3.8" height=".8" rx=".15" fill="#05121a" stroke="var(--cyan)" stroke-width=".05"/>` +
        `<text x="${doorU}" y="${vb - 4.7}" font-size=".55" font-weight="700" text-anchor="middle" fill="var(--cyan)">ENTRAR</text></g>`;
    } else {
      for(let u = 1; u < lobbyW - .5; u += 1.4) face += `<rect x="${u}" y="${vt + 1.2}" width=".7" height="${FO - 2}" fill="#0e1b25"/>`;
    }
    for(let c = 0; c < perFloor; c++){
      const idx = f * perFloor + c, u0 = c * R - x0 + .7, ww = R - 1.4, wt = vt + 1, wh = FO - 2.1;
      if(idx < n){
        const id = escapeHtml(String(list[idx].id));
        face += `<g data-win="${id}"><rect class="ho-win-out" x="${u0}" y="${wt}" width="${ww}" height="${wh}" fill="var(--muted)" fill-opacity=".25" stroke="var(--muted)" stroke-width=".08"/>` +
          `<line x1="${u0 + .5}" y1="${wt + .4}" x2="${u0 + 2.6}" y2="${wt + .4}" stroke="#ffffff" stroke-width=".07" opacity=".25"/>` +
          `<text x="${u0 + .35}" y="${wt + wh - .35}" font-size=".55" font-weight="700" fill="#d8e6ee">${hoRoomLabel(idx)} · ${escapeHtml(list[idx].name.length > 14 ? list[idx].name.slice(0, 13) + '…' : list[idx].name)}</text></g>`;
        hits += `<g transform="${hoM('wallY', x0, y1, top)}"><rect class="ho-hit" data-id="${id}" x="${u0}" y="${wt}" width="${ww}" height="${wh}"/></g>`;
      } else {
        face += `<rect x="${u0}" y="${wt}" width="${ww}" height="${wh}" fill="#0b161e" stroke="#16262f" stroke-width=".06"/>` +
          `<text x="${u0 + ww / 2}" y="${wt + wh / 2 + .2}" font-size=".55" text-anchor="middle" fill="#2c4252">LIVRE</text>`;
      }
    }
  }
  s += `<g transform="${hoM('wallY', x0, y1, top)}">${face}</g>`;
  // telhado: laje, painéis solares, ar condicionado, antena e letreiro
  let roof = `<rect width="${W}" height="${D}" fill="#101b24"/><rect x=".25" y=".25" width="${W - .5}" height="${D - .5}" fill="none" stroke="#1f3443" stroke-width=".15"/>`;
  for(let i = 0; i < Math.max(2, Math.floor((W - 8) / 4)); i++) for(let j = 0; j < 2; j++)
    roof += `<rect x="${6 + i * 4}" y="${7 + j * 3.2}" width="3.4" height="2.6" fill="#16314a" stroke="#2f5a80" stroke-width=".06"/><line x1="${7.7 + i * 4}" y1="${7 + j * 3.2}" x2="${7.7 + i * 4}" y2="${9.6 + j * 3.2}" stroke="#2f5a80" stroke-width=".04"/>`;
  s += `<g transform="${hoM('floor', x0, y0, top)}">${roof}</g>`;
  s += `<polyline points="${hoPts([[x0, y1, top], [x1, y1, top], [x1, y0, top]])}" fill="none" stroke="var(--cyan)" stroke-width="1.6" opacity=".75"/>`;
  s += hoBox(x0 + 1.2, y0 + 1, top, 2.6, 2.2, 1.4, '#3a4652') + hoBox(x0 + 4.4, y0 + 1, top, 2.6, 2.2, 1.4, '#3a4652');
  [[x0 + 2.5, y0 + 2.1], [x0 + 5.7, y0 + 2.1]].forEach(([fx, fy]) => { s += `<g transform="${hoM('floor', fx, fy, top + 1.4)}"><circle r=".8" fill="#0b0f12"/><g class="ho-blades" style="--fan-dur:.9s" fill="#5f6d77"><rect x="-.08" y="-.7" width=".16" height="1.4"/><rect x="-.7" y="-.08" width="1.4" height=".16"/></g></g>`; });
  const [ax, ay] = hoP(x1 - 1.5, y0 + 1.5, top), [bx, by] = hoP(x1 - 1.5, y0 + 1.5, top + 6);
  s += `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="#4a5966" stroke-width="2"/>` +
    `<circle class="ho-beacon" cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="3.2" fill="#ff4d4d" filter="url(#hoGlow)"/>`;
  const bw = Math.min(W - 6, 20), bx0 = x0 + (W - bw) / 2;
  s += hoBox(bx0 + 1, y0 + 2.4, top, .3, .3, 2.4, '#4a5966') + hoBox(bx0 + bw - 1.3, y0 + 2.4, top, .3, .3, 2.4, '#4a5966');
  s += `<g transform="${hoM('wallY', bx0, y0 + 2.7, top + 6)}"><rect width="${bw}" height="3.6" rx=".2" fill="#05121a" stroke="var(--cyan)" stroke-width=".12"/>` +
    `<text x="${bw / 2}" y="1.55" font-size="1.05" font-weight="700" text-anchor="middle" fill="var(--cyan)" filter="url(#hoGlow)">CENTRO DE COMANDO</text>` +
    `<text data-k="outStats" x="${bw / 2}" y="2.85" font-size=".72" font-weight="700" text-anchor="middle" fill="var(--amber)">—</text></g>`;
  // limites
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  [[px0, py0, 0], [px1, py0, 0], [px1, py1, 0], [px0, py1, 0], [x0, y0, top + 7], [x1, y0, top + 7], [x1, y1, top], [x0, y1, top]].forEach(p => {
    const [X, Y] = hoP(p[0], p[1], p[2]); minX = Math.min(minX, X); maxX = Math.max(maxX, X); minY = Math.min(minY, Y); maxY = Math.max(maxY, Y);
  });
  const pad = 14;
  ho.baseVB = [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2];
  ho.zoom = { k: 1, cx: 0, cy: 0 };
  const defs = `<defs><linearGradient id="hoOutGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#10202c"/><stop offset="1" stop-color="#0a141c"/></linearGradient>` +
    `<filter id="hoGlow" x="-2" y="-2" width="5" height="5"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  host.innerHTML = `<svg class="ho-outside" viewBox="${ho.baseVB.map(v => v.toFixed(0)).join(' ')}" role="img" aria-label="Edifício visto de fora: uma janela por máquina">${defs}${s}${hits}</svg>`;
  ho.rooms = {}; ho.liftEl = null; ho.liftInside = null; ho.liftInd = []; ho.liftCable = null; ho.techLayer = null;
  Object.keys(officeEls).forEach(k => delete officeEls[k]);
  ho.techs.forEach(t => { t.el = null; });
  ho.outWins = {};
  host.querySelectorAll('[data-win]').forEach(g => { ho.outWins[g.dataset.win] = g.querySelector('.ho-win-out'); });
  ho.outStats = host.querySelector('[data-k="outStats"]');
}
function hoUpdateOutside(list, states){
  let gh = 0, on = 0;
  list.forEach(dev => {
    const k = String(dev.id), st = states[k], r = readings[dev.id], el = ho.outWins && ho.outWins[k];
    if(r && r.online){ on++; if(!r.hashrate_display) gh += Number(r.hashrate) || 0; }
    if(!el) return;
    const color = OFFICE_STATUS[st].color;
    el.setAttribute('fill', color); el.setAttribute('stroke', color);
    el.setAttribute('fill-opacity', st === 'off' || st === 'idle' ? '.12' : '.3');
    el.classList.toggle('blink', st === 'hot');
    el.parentNode.classList.toggle('is-sel', selectedId === dev.id);
  });
  if(ho.outStats){ const f = formatHashrate(gh); ho.outStats.textContent = `${gh ? f.value + ' ' + f.unit : '—'} · ${on}/${list.length} online`; }
}
function hoRenderModeBtn(){
  const bar = $('officeModeBar');
  if(!bar) return;
  const html = ho.mode === 'outside'
    ? '<button type="button" class="office-mode-btn" data-office="enter">🚪 Entrar no edifício</button>'
    : '<button type="button" class="office-mode-btn" data-office="exit">⬅ Exterior</button>';
  if(bar.innerHTML !== html) bar.innerHTML = html;
}

function renderOffice(){
  const host = $('officeSvgHost');
  if(!host) return;
  const list = Array.isArray(devices) ? devices : [];
  const countEl = $('officeCount');
  if(countEl) countEl.textContent = list.length + ' quarto' + (list.length === 1 ? '' : 's');

  ho.idx = {};
  list.forEach((d, i) => { ho.idx[String(d.id)] = i; });
  const { floors, perFloor } = hoFloorsOf(list.length);
  if(ho.view === null || (ho.view === 'all' && floors > 3) || (ho.view !== 'all' && ho.view >= floors)) ho.view = floors <= 2 ? 'all' : 0;
  // ao selecionar uma máquina noutro piso (no quarto, no mapa da rede, no registo...), mostra esse piso
  if(selectedId !== ho.lastSel){
    ho.lastSel = selectedId;
    const si = ho.idx[String(selectedId)];
    if(si != null && ho.view !== 'all') ho.view = Math.floor(si / perFloor);
  }
  const models = list.map(d => hoModelOf(d, readings[d.id]));
  const sig = ho.mode + '#' + ho.view + '#' + list.map((d, i) => d.id + ':' + d.name + ':' + models[i]).join('|');
  if(sig !== ho.sig || !host.querySelector('svg')){
    ho.sig = sig;
    if(ho.mode === 'outside') hoBuildOutside(host, list); else hoBuild(host, list, models);
  }

  const states = {};
  const tally = { ok: 0, warn: 0, warm: 0, hot: 0, off: 0, portal: 0, idle: 0 };
  let power = 0, maxTemp = null;
  list.forEach((dev, i) => {
    const r = readings[dev.id], state = officeStateOf(r);
    states[String(dev.id)] = state;
    tally[state]++;
    if(r && r.online){
      power += Number(r.power) || 0;
      if(r.temp != null) maxTemp = Math.max(maxTemp ?? -Infinity, Number(r.temp));
    }
    hoUpdateRoom(dev, i, r, state);
  });
  ho.states = states;
  ho.list = list;
  if(ho.mode === 'outside') hoUpdateOutside(list, states);
  hoRenderModeBtn();
  hoUpdateSky(host.querySelector('svg'));
  hoDispatch(list, states);
  hoPlaceTechs();

  const busy = ho.techs.filter(t => t.target != null).length;
  const waiting = Object.keys(states).filter(k => HO_PRIORITY[states[k]] && !ho.techs.some(t => t.target === k)).length;
  const chip = (icon, label, val, jump) => '<span class="office-chip' + (jump && val ? ' is-link" data-jump-state="' + jump + '" title="Ir para a primeira' : '') + '">' + icon + ' ' + label + ' <b>' + val + '</b></span>';
  const lobby =
    chip('🚪', 'Quartos', list.length) +
    chip('⛏️', 'A trabalhar', tally.ok) +
    chip('⚠️', 'Atenção', tally.warn + tally.warm, 'warm,warn') +
    chip('🚨', 'Alarme', tally.hot, 'hot') +
    chip('🔌', 'Offline', tally.off + tally.portal, 'off,portal') +
    chip('👷', 'Técnicos ocupados', busy + '/' + ho.techs.length) +
    (waiting ? chip('⏳', 'Em espera', waiting) : '') +
    chip('⚡', 'Consumo', power ? power.toFixed(0) + ' W' : '—') +
    chip('🌡️', 'Temp. máx.', maxTemp != null && isFinite(maxTemp) ? maxTemp.toFixed(1) + ' °C' : '—');
  if($('officeLobby').innerHTML !== lobby) $('officeLobby').innerHTML = lobby;
  hoRenderFloors(list, states);
  hoRenderDetail(list, states);
  hoRenderLog();
}

function hoFloorsOf(n){
  const floors = Math.max(2, Math.ceil(n / HO.PER_FLOOR));
  return { floors, perFloor: n <= HO.PER_FLOOR ? Math.max(3, n) : Math.ceil(n / floors) };
}

// Botões dos pisos, cada um com um ponto por quarto na cor do estado
function hoRenderFloors(list, states){
  const box = $('officeFloors');
  if(!box) return;
  if(ho.floors <= 1){ box.innerHTML = ''; box.hidden = true; return; }
  box.hidden = false;
  let html = ho.floors <= 3 ? '<button type="button" class="office-floor-btn' + (ho.view === 'all' ? ' active' : '') + '" data-floor="all">🏢 Todos</button>' : '';
  for(let f = ho.floors - 1; f >= 0; f--){
    const ids = list.slice(f * ho.perFloor, (f + 1) * ho.perFloor).map(d => String(d.id));
    const bad = ids.filter(k => HO_PRIORITY[states[k]] >= 3).length;
    const techs = ho.techs.filter(t => Math.abs(t.z - f * HO.FH) < HO.FH * 0.45).length;
    html += '<button type="button" class="office-floor-btn' + (ho.view === f ? ' active' : '') + (bad ? ' has-alert' : '') + '" data-floor="' + f + '">' +
      'Piso ' + f + (ids.length ? '<span class="office-floor-dots">' + ids.map(k => '<i style="background:' + OFFICE_STATUS[states[k]].color + '"></i>').join('') + '</span>' : '<small>livre</small>') +
      (techs ? '<small>👷' + techs + '</small>' : '') + '</button>';
  }
  if(box.innerHTML !== html) box.innerHTML = html;
}

// Zoom do prédio: altera o viewBox à volta de um centro (cx, cy)
function hoApplyZoom(){
  const svg = $('officeSvgHost')?.querySelector('svg');
  if(!svg || !ho.baseVB) return;
  const [x, y, w, h] = ho.baseVB, z = ho.zoom;
  z.k = Math.max(1, Math.min(5, z.k));
  const cw = w / z.k, ch = h / z.k;
  if(z.k === 1){ z.cx = x + w / 2; z.cy = y + h / 2; }
  z.cx = Math.max(x + cw / 2, Math.min(x + w - cw / 2, z.cx));
  z.cy = Math.max(y + ch / 2, Math.min(y + h - ch / 2, z.cy));
  svg.setAttribute('viewBox', [z.cx - cw / 2, z.cy - ch / 2, cw, ch].map(v => v.toFixed(1)).join(' '));
  $('officeStage').classList.toggle('is-zoomed', z.k > 1);
}
function hoZoomAt(factor, px, py){
  const z = ho.zoom, [x, y, w, h] = ho.baseVB || [0, 0, 1, 1];
  if(z.k === 1){ z.cx = x + w / 2; z.cy = y + h / 2; }
  const nk = Math.max(1, Math.min(5, z.k * factor));
  if(px != null){ z.cx = px + (z.cx - px) * z.k / nk; z.cy = py + (z.cy - py) * z.k / nk; }
  z.k = nk;
  hoApplyZoom();
}

// Interação: dica ao passar o rato, clique para selecionar, remover pelo detalhe
(function(){
  const stage = $('officeStage'), tip = $('officeTip'), detail = $('officeDetail');
  if(!stage || !tip) return;
  stage.addEventListener('mousemove', e => {
    const hit = e.target.closest && e.target.closest('.ho-hit');
    const dev = hit && devices.find(d => String(d.id) === hit.dataset.id);
    if(!dev){ tip.hidden = true; return; }
    const k = String(dev.id), state = (ho.states || {})[k] || 'idle', st = OFFICE_STATUS[state];
    tip.innerHTML = '<h4><span>' + hoRoomLabel(ho.idx[k]) + ' · ' + escapeHtml(dev.name) + '</span><span class="ho-status" style="color:' + st.color + '">' + st.label + '</span></h4>' +
      hoBoardHtml(readings[dev.id], dev, true) + hoStaffLine(dev, state);
    tip.hidden = false;
    const rect = stage.getBoundingClientRect();
    let x = e.clientX - rect.left + 16, y = e.clientY - rect.top + 16;
    if(x + tip.offsetWidth > rect.width - 6) x = e.clientX - rect.left - tip.offsetWidth - 16;
    if(y + tip.offsetHeight > rect.height - 6) y = Math.max(6, rect.height - tip.offsetHeight - 6);
    tip.style.left = Math.max(6, x) + 'px';
    tip.style.top = y + 'px';
  });
  stage.addEventListener('mouseleave', () => { tip.hidden = true; });
  const svgPoint = e => {
    const svg = stage.querySelector('svg'), m = svg && svg.getScreenCTM();
    if(!m) return null;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(m.inverse());
  };
  // Ctrl + roda do rato para aproximar; arrastar para mover quando aproximado; duplo clique repõe
  stage.addEventListener('wheel', e => {
    if(!(e.ctrlKey || e.metaKey) || !stage.querySelector('svg')) return;
    e.preventDefault();
    const p = svgPoint(e);
    hoZoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, p && p.x, p && p.y);
  }, { passive: false });
  let drag = null, dragged = false;
  stage.addEventListener('pointerdown', e => {
    if(ho.zoom.k <= 1 || e.button !== 0 || e.target.closest('.office-zoom')) return;
    const svg = stage.querySelector('svg');
    if(!svg) return;
    drag = { x: e.clientX, y: e.clientY, cx: ho.zoom.cx, cy: ho.zoom.cy, a: svg.getScreenCTM().a };
    dragged = false;
  });
  window.addEventListener('pointermove', e => {
    if(!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if(Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
    if(!dragged) return;
    tip.hidden = true;
    ho.zoom.cx = drag.cx - dx / drag.a;
    ho.zoom.cy = drag.cy - dy / drag.a;
    hoApplyZoom();
  });
  window.addEventListener('pointerup', () => { drag = null; });
  stage.addEventListener('dblclick', e => {
    if(e.target.closest('.office-zoom')) return;
    ho.zoom.k = 1; hoApplyZoom();
  });
  stage.addEventListener('click', e => {
    const ob = e.target.closest && e.target.closest('[data-office]');
    if(ob){ hoSetMode(ob.dataset.office === 'enter' ? 'inside' : 'outside'); return; }
    const zb = e.target.closest && e.target.closest('[data-zoom]');
    if(zb){
      const a = zb.dataset.zoom;
      if(a === 'reset'){ ho.zoom.k = 1; hoApplyZoom(); }
      else hoZoomAt(a === 'in' ? 1.35 : 1 / 1.35);
      return;
    }
    if(dragged){ dragged = false; return; }
    const hit = e.target.closest && e.target.closest('.ho-hit');
    const dev = hit && devices.find(d => String(d.id) === hit.dataset.id);
    if(!dev) return;
    selectedId = dev.id;
    if(ho.mode === 'outside'){ ho.lastSel = undefined; hoSetMode('inside'); }
    renderAll();
  });
  const jumpTo = id => {
    const dev = devices.find(d => String(d.id) === String(id));
    if(!dev) return;
    selectedId = dev.id;
    if(ho.mode === 'outside'){ ho.lastSel = undefined; hoSetMode('inside'); }
    renderAll();
    stage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  $('officeFloors')?.addEventListener('click', e => {
    const b = e.target.closest('[data-floor]');
    if(!b) return;
    ho.view = b.dataset.floor === 'all' ? 'all' : Number(b.dataset.floor);
    if(ho.mode === 'outside') hoSetMode('inside'); else renderOffice();
  });
  $('officeLog')?.addEventListener('click', e => {
    const li = e.target.closest('[data-jump]');
    if(li) jumpTo(li.dataset.jump);
  });
  $('officeLobby')?.addEventListener('click', e => {
    const c = e.target.closest('[data-jump-state]');
    if(!c) return;
    const want = c.dataset.jumpState.split(',');
    const dev = devices.find(d => want.includes((ho.states || {})[String(d.id)]));
    if(dev) jumpTo(dev.id);
  });
  if(detail) detail.addEventListener('click', e => {
    const btn = e.target.closest && e.target.closest('[data-remove]');
    const dev = btn && devices.find(d => String(d.id) === btn.dataset.remove);
    if(dev && confirm('Remover a máquina "' + dev.name + '"?')) removeDevice(dev.id);
  });
})();
renderOffice();
