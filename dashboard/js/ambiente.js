// ---------- Ambiente do edifício ----------
// Dia e noite pela hora real (sol, lua, estrelas, luzes, raios de sol nos quartos), o tempo
// (chuva, neve, trovoada, nuvens), a celebração quando se encontra um bloco e a vida à volta
// do edifício (carros, drones, camião de entregas e helicóptero).
// Este ficheiro carrega ANTES do escritorio.js: só define funções, que o escritório chama
// quando desenha o edifício.

const HOA_CONFETTI = ['#ffd34a', '#ff5d5d', '#4fd6ff', '#21ffb0', '#ff5de6', '#b69cff', '#ffffff'];

function hoRand(seed){ let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function hoLerp(a, b, t){ return a + (b - a) * t; }
function hoMix(c1, c2, t){
  const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const a = p(c1), b = p(c2);
  return '#' + a.map((v, i) => Math.round(hoLerp(v, b[i], t)).toString(16).padStart(2, '0')).join('');
}

// --- Hora do dia: luz 0 (noite) → 1 (dia), posição do sol e da lua ---
function hoDay(){
  const d = new Date();
  const h = (typeof window.__hoHour === 'number') ? window.__hoHour : d.getHours() + d.getMinutes() / 60;   // __hoHour: só para testes
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const light = Math.min(sm(5.5, 8, h), 1 - sm(18, 20.5, h));
  const u = (h < 12 ? h + 24 : h) - 18;
  return { h, light, sunT: (h - 6) / 12, moonT: u / 12 };
}
// --- Tempo atual (o mesmo do globo): chuva, neve, trovoada, nuvens ---
function hoWeather(){
  try { if(typeof WX !== 'undefined' && WX.data) return wxInfo(WX.data.weather_code, WX.data.is_day).fx; } catch(e) {}
  const cond = ($('wxCond')?.textContent || '').toLowerCase();
  return { rain: /chuv|rain|aguaceir|trovo|storm|drizzle/.test(cond) ? 200 : 0, snow: /neve|snow/.test(cond) ? 100 : 0,
           thunder: /trovo|thunder|storm/.test(cond), clouds: /nubl|nuve|cloud|encob|overcast|nevoeiro|fog/.test(cond) ? 1 : 0 };
}

// --- Definições comuns (gradientes, padrões da chuva e da neve) ---
function hoAmbientDefs(){
  const anim = !hoReducedMotion();
  const rain = [[4, 0, 22], [17, 38, 18], [29, 12, 26], [41, 60, 16], [53, 26, 24], [62, 80, 20], [10, 70, 14], [35, 92, 18]]
    .map(([x, y, l]) => `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + l}"/>`).join('');
  const snow = [[10, 12, 1.6], [34, 50, 1.1], [58, 22, 1.4], [82, 70, 1.8], [104, 36, 1.2], [22, 102, 1.3], [70, 118, 1.6], [96, 138, 1.1], [46, 146, 1.5], [6, 74, 1.2]]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
  return `<radialGradient id="hoLampWarm"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".5"/><stop offset=".55" stop-color="#ffc878" stop-opacity=".16"/><stop offset="1" stop-color="#ffc878" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="hoBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c8" stop-opacity=".5"/><stop offset="1" stop-color="#fff2c8" stop-opacity="0"/></linearGradient>` +
    `<radialGradient id="hoSunGlow"><stop offset="0" stop-color="#fff4c2" stop-opacity="1"/><stop offset=".22" stop-color="#ffd86b" stop-opacity=".9"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="hoMoonGlow"><stop offset="0" stop-color="#cfe0ff" stop-opacity=".55"/><stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="hoHeadGlow"><stop offset="0" stop-color="#fff0b0" stop-opacity=".95"/><stop offset="1" stop-color="#fff0b0" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="hoStreetGlow"><stop offset="0" stop-color="#ffd48a" stop-opacity=".7"/><stop offset="1" stop-color="#ffd48a" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="hoSheenG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".28"/><stop offset=".45" stop-color="#ffffff" stop-opacity=".02"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>` +
    `<filter id="hoBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.3"/></filter>` +
    `<pattern id="hoRainPat" width="70" height="110" patternUnits="userSpaceOnUse" patternTransform="rotate(14)"><g stroke="#a9c8e0" stroke-width="1.1" stroke-linecap="round" opacity=".55">${rain}</g>` +
      (anim ? `<animateTransform attributeName="patternTransform" type="translate" additive="sum" from="0 0" to="0 110" dur=".8s" repeatCount="indefinite"/>` : '') + `</pattern>` +
    `<pattern id="hoSnowPat" width="120" height="160" patternUnits="userSpaceOnUse"><g fill="#ffffff" opacity=".85">${snow}</g>` +
      (anim ? `<animateTransform attributeName="patternTransform" type="translate" from="0 0" to="-30 160" dur="9s" repeatCount="indefinite"/>` : '') + `</pattern>`;
}
// Camadas de luz ambiente: escurece à noite, tom quente ao amanhecer/anoitecer, e a luz da sirene
function hoOverlaySvg(){
  const big = 'x="-8000" y="-8000" width="16000" height="16000"';
  return `<g class="ho-ambient" pointer-events="none"><rect ${big} class="ho-amb-day" fill="#cfe6ff" opacity="0"/><rect ${big} class="ho-amb-dark" fill="#020611" opacity="0"/>` +
    `<rect ${big} class="ho-amb-tint" fill="#ff8f4a" opacity="0"/><rect ${big} class="ho-amb-party" fill="#ff2a2a" opacity="0"/></g>`;
}
// Chuva, neve e relâmpagos (só por cima da vista de fora)
function hoWxFxSvg(){
  const big = 'x="-8000" y="-8000" width="16000" height="16000"';
  return `<g class="ho-wxfx" pointer-events="none"><rect ${big} class="ho-fx-rain" fill="url(#hoRainPat)"/><rect ${big} class="ho-fx-snow" fill="url(#hoSnowPat)"/>` +
    `<rect ${big} class="ho-fx-flash" fill="#e2ecff" opacity="0"/></g>`;
}
// Luz de cada quarto por dentro: raio de sol (de dia) e brilho do candeeiro (à noite)
function hoRoomLights(f, c, window_){
  const x0 = c * HO.R, z0 = f * HO.FH;
  return `<g transform="${hoM('floor', x0, 0, z0)}" pointer-events="none">` +
    (window_ ? `<polygon class="ho-sunbeam" points="0.8,0 4.4,0 8.8,6.8 5.2,6.8" fill="url(#hoBeam)"/>` : '') +
    `<ellipse class="ho-lampglow" cx="5" cy="5" rx="4.8" ry="4.8" fill="url(#hoLampWarm)"/></g>`;
}

// --- Atualização contínua (chamada de cada vez que o escritório se atualiza) ---
function hoAmbientUpdate(svg){
  const d = hoDay(), fx = hoWeather();
  const cloudy = Math.min(1, (fx.clouds || 0) + (fx.rain ? .4 : 0));
  svg.style.setProperty('--ho-light', d.light.toFixed(3));
  svg.style.setProperty('--ho-clear', (1 - cloudy * .85).toFixed(2));
  svg.classList.toggle('ho-wx-rain', !!fx.rain);
  svg.classList.toggle('ho-wx-cloud', (fx.clouds || 0) > .25);
  svg.classList.toggle('ho-wx-snow', !!fx.snow);
  svg.classList.toggle('ho-wx-storm', !!fx.thunder);
  const bell = Math.max(0, 1 - Math.abs(d.light * 2 - 1));
  const set = (sel, v) => { const e = svg.querySelector(sel); if(e) e.setAttribute('opacity', v.toFixed(3)); };
  set('.ho-amb-dark', .34 * (1 - d.light) + (fx.rain ? .06 : 0) + cloudy * .04 * d.light);
  set('.ho-amb-tint', .15 * bell);
  set('.ho-amb-day', .05 * d.light * (1 - cloudy));
  // sol, lua e estrelas (só na vista de fora)
  const vb = ho.baseVB;
  const pos = t => vb ? [vb[0] + vb[2] * (.06 + .88 * t), vb[1] + vb[3] * (.32 - .24 * Math.sin(Math.PI * t))] : [0, 0];
  const sun = svg.querySelector('.ho-sun'), moon = svg.querySelector('.ho-moon');
  if(sun){ const on = d.sunT > -.02 && d.sunT < 1.02; sun.style.display = on ? '' : 'none'; if(on){ const [x, y] = pos(Math.max(0, Math.min(1, d.sunT))); sun.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`); sun.style.opacity = (1 - cloudy * .9).toFixed(2); } }
  if(moon){ const on = d.moonT > -.02 && d.moonT < 1.02; moon.style.display = on ? '' : 'none'; if(on){ const [x, y] = pos(Math.max(0, Math.min(1, d.moonT))); moon.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`); } }
  // fundo do palco: céu da hora do dia (só na vista de fora)
  const stage = $('officeStage');
  if(stage){
    const out = svg.classList.contains('ho-outside');
    stage.classList.toggle('is-outside', out);
    if(out){
      const top = hoMix(hoMix('#03070f', '#245285', d.light), '#3a3568', bell * .55), bot = hoMix(hoMix('#08121b', '#5f93b8', d.light), '#c26a45', bell * .45);
      stage.style.setProperty('--ho-sky-top', top); stage.style.setProperty('--ho-sky-bot', bot);
    }
  }
  hoWeatherFlash(svg, fx);
  if(hoPartyActive() && !svg.querySelector('.ho-fx')) hoPartyFx(svg);   // o edifício foi redesenhado durante a festa
  hoLifeSync(svg);
}
// Relâmpagos ocasionais quando há trovoada
let hoFlashTimer = 0;
function hoWeatherFlash(svg, fx){
  clearTimeout(hoFlashTimer);
  if(!fx.thunder || !svg.classList.contains('ho-outside') || hoReducedMotion()) return;
  const flash = () => {
    const el = svg.querySelector('.ho-fx-flash');
    if(!el || !el.isConnected) return;
    el.style.transition = 'none'; el.setAttribute('opacity', '.55');
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = 'opacity .5s ease-out'; el.setAttribute('opacity', '0'); }));
    hoFlashTimer = setTimeout(flash, 5000 + Math.random() * 9000);
  };
  hoFlashTimer = setTimeout(flash, 2500 + Math.random() * 4000);
}

// ================= Celebração quando se encontra um bloco =================
// Sirene, confettis, fogo de artifício, técnicos aos saltos e a janela/quarto da máquina em dourado.
const HOA_PARTY_MS = 11000;
function hoPartyActive(){ return !!(ho.party && Date.now() < ho.party.until); }
function hoCelebrate(machineName){
  const dev = (typeof devices !== 'undefined' ? devices : []).find(d => d.name === machineName);
  ho.party = { until: Date.now() + HOA_PARTY_MS, devId: dev ? String(dev.id) : null, name: machineName || '' };
  const stage = $('officeStage'), svg = $('officeSvgHost') && $('officeSvgHost').querySelector('svg');
  if(!stage || !svg) return;
  hoPartyFx(svg);
  let banner = stage.querySelector('.office-party-banner');
  if(!banner){ banner = document.createElement('div'); banner.className = 'office-party-banner'; stage.appendChild(banner); }
  banner.innerHTML = '🎉 BLOCO ENCONTRADO' + (machineName ? ' · <b></b>' : '') + ' 🎉';
  if(machineName) banner.querySelector('b').textContent = machineName;
  banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show');
  clearTimeout(ho.partyEnd);
  ho.partyEnd = setTimeout(hoPartyEnd, HOA_PARTY_MS + 300);
  if(typeof renderOffice === 'function') renderOffice();
}
function hoPartyFx(svg){
  svg.querySelectorAll('.ho-fx').forEach(e => e.remove());
  svg.classList.add('ho-party');
  const vbs = svg.getAttribute('viewBox').split(' ').map(Number), [vx, vy, vw, vh] = vbs;
  const rnd = hoRand(Date.now() & 0xffff), reduced = hoReducedMotion();
  let h = '';
  if(!reduced){
    for(let i = 0; i < 90; i++){
      const x = vx + rnd() * vw, w = 4 + rnd() * 5, hh = 7 + rnd() * 6, dur = 2.6 + rnd() * 2.6, del = rnd() * 3.4;
      h += `<rect class="ho-confetti" x="${x.toFixed(1)}" y="${(vy - 20).toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" fill="${HOA_CONFETTI[i % HOA_CONFETTI.length]}" ` +
        `style="--fall:${(vh + 60).toFixed(0)}px;--sway:${((rnd() - .5) * 80).toFixed(0)}px;--spin:${(rnd() * 900 - 300).toFixed(0)}deg;animation-duration:${dur.toFixed(2)}s;animation-delay:${del.toFixed(2)}s"/>`;
    }
    if(svg.classList.contains('ho-outside')){
      for(let i = 0; i < 7; i++){
        const x = vx + vw * (.12 + .76 * rnd()), y = vy + vh * (.08 + .32 * rnd()), col = HOA_CONFETTI[(i * 2) % HOA_CONFETTI.length], del = (i * .55 + rnd() * .3).toFixed(2);
        let rays = '';
        for(let k = 0; k < 16; k++){ const a = k / 16 * Math.PI * 2; rays += `<line x1="${(Math.cos(a) * 8).toFixed(1)}" y1="${(Math.sin(a) * 8).toFixed(1)}" x2="${(Math.cos(a) * 40).toFixed(1)}" y2="${(Math.sin(a) * 40).toFixed(1)}"/>`; }
        h += `<g transform="translate(${x.toFixed(0)},${y.toFixed(0)})"><g class="ho-firework" stroke="${col}" stroke-width="2.4" stroke-linecap="round" style="animation-delay:${del}s">${rays}<circle r="3" fill="${col}"/></g></g>`;
      }
    }
  }
  svg.insertAdjacentHTML('beforeend', `<g class="ho-fx" pointer-events="none">${h}</g>`);
}
function hoPartyEnd(){
  ho.party = null;
  const stage = $('officeStage');
  stage && stage.querySelectorAll('.office-party-banner').forEach(e => e.remove());
  const svg = $('officeSvgHost') && $('officeSvgHost').querySelector('svg');
  if(svg){ svg.classList.remove('ho-party'); svg.querySelectorAll('.ho-fx').forEach(e => e.remove()); }
  if(typeof renderOffice === 'function') renderOffice();
}

// ================= Exterior: céu, estrada, candeeiros, heliporto =================
// geo: { x0, x1, y0, y1, px0, px1, py0, py1, top }  (unidades do mundo isométrico)
function hoOutsideExtras(g){
  g.roadY0 = g.y1 + 14.6; g.roadY1 = g.y1 + 20.6; g.laneA = g.y1 + 16.3; g.laneB = g.y1 + 18.9;
  g.pad = { x: g.x1 + 3.5, y: g.y1 + 6.5 }; g.bay = { x: g.x1 - 8, y: g.y1 + 6 };
  const PW = g.px1 - g.px0, RH = g.roadY1 - g.roadY0;
  let ground = '', lights = '';
  ground += `<g transform="${hoM('floor', g.px0, g.roadY0, -.015)}"><rect width="${PW}" height="${RH}" fill="#0b1118"/>` +
    `<line x1="0" y1=".15" x2="${PW}" y2=".15" stroke="#2a3a47" stroke-width=".14"/><line x1="0" y1="${RH - .15}" x2="${PW}" y2="${RH - .15}" stroke="#2a3a47" stroke-width=".14"/>` +
    `<line x1="0" y1="${RH / 2}" x2="${PW}" y2="${RH / 2}" stroke="#e0b53a" stroke-width=".11" stroke-dasharray="1.5 1.2" opacity=".65"/></g>`;
  // candeeiros ao longo da estrada
  for(let x = g.px0 + 7; x < g.px1 - 3; x += 15){
    const y = g.roadY0 - .9, [sx, sy] = hoP(x, y, 4.3);
    ground += hoBox(x - .12, y - .12, 0, .24, .24, 4.4, '#35424d') + hoBox(x - .6, y - .14, 4.4, 1.2, .28, .2, '#4a5966');
    lights += `<circle class="ho-streetglow" cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="16" fill="url(#hoStreetGlow)"/>` +
      `<g transform="${hoM('floor', x, y, .01)}"><ellipse class="ho-streetglow" rx="4.2" ry="4.2" fill="url(#hoStreetGlow)"/></g>`;
  }
  // luzes do heliporto (piscam quando há um helicóptero)
  let ring = '';
  for(let k = 0; k < 12; k++){ const a = k / 12 * Math.PI * 2; ring += `<circle cx="${(Math.cos(a) * 2.5).toFixed(2)}" cy="${(Math.sin(a) * 2.5).toFixed(2)}" r=".16" fill="#ffb020" style="animation-delay:${(k * .05).toFixed(2)}s"/>`; }
  ground += `<g class="ho-padlights" transform="${hoM('floor', g.pad.x, g.pad.y, .03)}">${ring}</g>`;
  // ondulações das poças quando chove
  const rnd = hoRand(7);
  let rip = '';
  for(let k = 0; k < 14; k++) rip += `<ellipse class="ho-ripple" cx="${(rnd() * PW).toFixed(1)}" cy="${(rnd() * (g.py1 - g.py0)).toFixed(1)}" rx=".5" ry=".5" fill="none" stroke="#a9c8e0" stroke-width=".07" style="animation-delay:${(rnd() * 1.6).toFixed(2)}s"/>`;
  ground += `<g class="ho-ripples" transform="${hoM('floor', g.px0, g.py0, -.012)}">${rip}</g>`;
  const life = `<g class="ho-life"><g class="ho-ground-fx"></g><g class="ho-lane-a"></g><g class="ho-lane-b"></g><g class="ho-air"></g></g>`;
  lights += `<g class="ho-life-lights"></g>`;
  return { ground, lights, life };
}
// Céu da vista de fora: estrelas, sol e lua (desenhados atrás de tudo)
function hoSkyOut(vb){
  const rnd = hoRand(11);
  let stars = '';
  for(let i = 0; i < 70; i++) stars += `<circle cx="${(vb[0] + rnd() * vb[2]).toFixed(0)}" cy="${(vb[1] + rnd() * vb[3] * .62).toFixed(0)}" r="${(rnd() * 1.1 + .5).toFixed(1)}" fill="#e8f0ff" style="animation-delay:${(rnd() * 4).toFixed(1)}s"/>`;
  return `<g class="ho-stars-out" pointer-events="none">${stars}</g>` +
    `<g class="ho-sun" pointer-events="none" style="display:none"><circle r="95" fill="url(#hoSunGlow)"/><circle r="19" fill="#fff6c8"/></g>` +
    `<g class="ho-moon" pointer-events="none" style="display:none"><circle r="60" fill="url(#hoMoonGlow)"/><circle r="15" fill="#e9f1ff"/><circle cx="-4.5" cy="-3" r="3.2" fill="#cdd9ee"/><circle cx="5" cy="4.5" r="2.4" fill="#cdd9ee"/><circle cx="3" cy="-6" r="1.7" fill="#cdd9ee"/></g>`;
}

// ================= Vida à volta do edifício =================
const HOL = { svg: null, geo: null, raf: 0, last: 0, t: 0, visible: true, io: null, cars: [], drones: [], truck: null, heli: null,
              nextCar: 0, nextTruck: 0, nextHeli: 0, ground: null, laneA: null, laneB: null, air: null, glow: null };
const HOL_CAR_COLORS = ['#c0392b', '#2f80ed', '#e0b53a', '#2fa86b', '#aab6c0', '#7a5af8', '#e67e22'];
const SVGNS = 'http://www.w3.org/2000/svg';
function hoMk(parent, markup, cls){ const g = document.createElementNS(SVGNS, 'g'); if(cls) g.setAttribute('class', cls); g.innerHTML = markup; parent.appendChild(g); return g; }
function hoPut(el, x, y, z){ const p = hoP(x, y, z); el.setAttribute('transform', `translate(${p[0].toFixed(1)},${p[1].toFixed(1)})`); }
const hoEase = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);

function hoCarMarkup(color, dir){
  const L = 3.4, Wd = 1.6, wh = (x, y) => hoBox(x - .32, y - .16, 0, .64, .32, .5, '#06090c');
  return wh(-1.05, -.82) + wh(1.05, -.82) + hoBox(-L / 2, -Wd / 2, .28, L, Wd, .62, color) +
    hoBox(dir > 0 ? -.95 : -.65, -Wd / 2 + .14, .9, 1.6, Wd - .28, .58, hoShade(color, -.38)) + wh(-1.05, .82) + wh(1.05, .82);
}
function hoCarGlow(dir){
  return [-.45, .45].map(y => { const [x, yy] = hoP(dir * 1.75, y, .6); return `<circle class="ho-headlight" cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="7" fill="url(#hoHeadGlow)"/>`; }).join('');
}
function hoTruckMarkup(axis){
  const wh = (x, y) => hoBox(x - .4, y - .16, 0, .8, .32, .62, '#06090c');
  if(axis === 'x') return wh(-1.9, -1.1) + wh(1.4, -1.1) + hoBox(-2.9, -1.1, .35, 4.5, 2.2, 2.5, '#cfd8de') + hoBox(1.6, -1.0, .35, 1.3, 2.0, 1.6, '#2b6fb3') + wh(-1.9, 1.1) + wh(1.4, 1.1);
  return wh(-1.1, -2.1) + wh(-1.1, 1.9) + hoBox(-1.0, -2.9, .35, 2.0, 1.3, 1.6, '#2b6fb3') + hoBox(-1.1, -1.6, .35, 2.2, 4.5, 2.5, '#cfd8de') + wh(1.1, -2.1) + wh(1.1, 1.9);
}
function hoHeliMarkup(){
  return hoBox(-1.4, -.95, .12, 2.8, .14, .14, '#2b343c') + hoBox(-4.5, -.5, 1.0, .3, 1.0, .9, '#c3ccd3') + hoBox(-4.4, -.25, 1.1, 2.9, .5, .4, '#b8c2ca') +
    hoBox(-1.6, -.7, .5, 3.2, 1.4, 1.1, '#e1e7ec') + hoBox(.3, -.6, 1.2, 1.3, 1.2, .5, '#1d2a36') + hoBox(-1.4, .8, .12, 2.8, .14, .14, '#2b343c');
}
function hoDroneMarkup(){
  const rot = [[-9, -2.6], [9, -2.6], [-6.5, 3.4], [6.5, 3.4]].map(([x, y], i) => `<line x1="0" y1="0" x2="${x}" y2="${y}" stroke="#2b343c" stroke-width="1.4"/><ellipse class="ho-drone-rotor" cx="${x}" cy="${y - 1}" rx="6" ry="2.1" fill="#b9c8d3" opacity=".5" style="animation-delay:${i * .04}s"/>`).join('');
  return `${rot}<ellipse rx="4.6" ry="3" fill="#39454f"/><ellipse cy="-.8" rx="2.6" ry="1.5" fill="#56677a"/><circle class="ho-drone-led" cx="0" cy="1.6" r="1.1" fill="#ff4d4d"/>`;
}

function hoLifeStart(svg){
  hoLifeStop();
  const geo = ho.outGeo; if(!geo) return;
  HOL.svg = svg; HOL.geo = geo; HOL.t = 0; HOL.last = 0; HOL.cars = []; HOL.drones = []; HOL.truck = null; HOL.heli = null;
  HOL.ground = svg.querySelector('.ho-ground-fx'); HOL.laneA = svg.querySelector('.ho-lane-a'); HOL.laneB = svg.querySelector('.ho-lane-b');
  HOL.air = svg.querySelector('.ho-air'); HOL.glow = svg.querySelector('.ho-life-lights');
  if(!HOL.ground || !HOL.air) return;
  HOL.nextCar = 0; HOL.nextTruck = 9; HOL.nextHeli = 14;
  // drones: patrulha do telhado, oito sobre a praça e entregas à porta
  const g = geo, cx = (g.px0 + g.px1) / 2;
  const mk = (fn, extra) => { const el = hoMk(HOL.air, hoDroneMarkup(), 'ho-drone'), sh = hoMk(HOL.ground, '<ellipse rx="5" ry="2.4" fill="#000"/>', 'ho-shadow'); HOL.drones.push({ el, sh, fn, pkg: null, ...extra }); };
  mk(t => { const w = g.x1 - g.x0, d = g.y1 - g.y0, u = (t * 4.2) % (2 * (w + d)), z = g.top + 3.5;
    if(u < w) return [g.x0 + u, g.y0, z]; if(u < w + d) return [g.x1, g.y0 + (u - w), z];
    if(u < 2 * w + d) return [g.x1 - (u - w - d), g.y1, z]; return [g.x0, g.y1 - (u - 2 * w - d), z]; });
  mk(t => [cx + 15 * Math.sin(t * .33), g.y1 + 9 + 5 * Math.sin(t * .66), 9 + 2 * Math.sin(t * .9)]);
  const doorX = g.x0 + (HO.RB + HO.E) / 2, home = [g.x1 - 3, g.y0 + 3, g.top + 3];
  const lerp3 = (p, q, k) => [hoLerp(p[0], q[0], k), hoLerp(p[1], q[1], k), hoLerp(p[2], q[2], k)];
  mk(t => { const c = t % 38, B = [doorX, g.y1 + 3.5, 4.6];
    if(c < 7) return lerp3(home, B, hoEase(c / 7));
    if(c < 10) return [B[0], B[1], hoLerp(B[2], 2.4, hoEase((c - 7) / 3))];
    if(c < 12) return [B[0], B[1], 2.4];
    if(c < 19) return lerp3([B[0], B[1], 2.4], home, hoEase((c - 12) / 7));
    return [home[0], home[1], home[2] + .4 * Math.sin(c)]; },
    { carry: t => (t % 38) < 10.5 });
  // observa se está visível para parar quando está fora do ecrã
  if(window.IntersectionObserver){ HOL.io = new IntersectionObserver(es => { HOL.visible = es[0].isIntersecting; }); HOL.io.observe(svg); }
  hoSpawnCar(true); hoSpawnCar(true);
  HOL.raf = requestAnimationFrame(hoLifeLoop);
}
function hoLifeStop(){
  if(HOL.raf) cancelAnimationFrame(HOL.raf);
  HOL.raf = 0;
  if(HOL.io){ HOL.io.disconnect(); HOL.io = null; }
  HOL.svg = null; HOL.cars = []; HOL.drones = []; HOL.truck = null; HOL.heli = null;
}
function hoLifeSync(svg){
  const perf = typeof hcPerfMode !== 'undefined' && hcPerfMode;
  const want = svg.classList.contains('ho-outside') && ho.outGeo && !perf && !hoReducedMotion();
  if(!want){ if(HOL.svg) hoLifeStop(); return; }
  if(HOL.svg !== svg) hoLifeStart(svg);
}
function hoSpawnCar(anywhere){
  const g = HOL.geo; if(!g || HOL.cars.length >= 6) return;
  const dir = Math.random() < .5 ? 1 : -1, y = dir > 0 ? g.laneA : g.laneB, x = anywhere ? g.px0 + Math.random() * (g.px1 - g.px0) : (dir > 0 ? g.px0 - 5 : g.px1 + 5);
  if(HOL.cars.some(c => c.dir === dir && Math.abs(c.x - x) < 9)) return;
  const color = HOL_CAR_COLORS[Math.floor(Math.random() * HOL_CAR_COLORS.length)];
  const car = { x, y, dir, base: 4.4 + Math.random() * 1.2, speed: 0, el: hoMk(dir > 0 ? HOL.laneA : HOL.laneB, hoCarMarkup(color, dir), 'ho-car'), gl: hoMk(HOL.glow, hoCarGlow(dir), 'ho-carlight') };
  car.speed = car.base; HOL.cars.push(car);
  hoPut(car.el, x, y, 0); hoPut(car.gl, x, y, 0);
}

function hoLifeLoop(now){
  HOL.raf = requestAnimationFrame(hoLifeLoop);
  if(!HOL.svg || !HOL.svg.isConnected){ hoLifeStop(); return; }
  if(document.hidden || !HOL.visible || (typeof hcPaused === 'function' && hcPaused())){ HOL.last = 0; return; }
  const dt = HOL.last ? Math.min(.05, (now - HOL.last) / 1000) : 0;
  HOL.last = now;
  if(!dt) return;
  HOL.t += dt;
  const g = HOL.geo, t = HOL.t;
  // carros (mantêm distância ao veículo da frente)
  if(t >= HOL.nextCar){ hoSpawnCar(false); HOL.nextCar = t + 4 + Math.random() * 8; }
  const tr = HOL.truck, onRoad = tr && (tr.st === 'in' || tr.st === 'out' || tr.st === 'turn1' || tr.st === 'turn2');
  for(let i = HOL.cars.length - 1; i >= 0; i--){
    const c = HOL.cars[i];
    let ahead = null, gap = 1e9;
    HOL.cars.forEach(o => { if(o !== c && o.dir === c.dir && (o.x - c.x) * c.dir > 0 && Math.abs(o.x - c.x) < gap){ gap = Math.abs(o.x - c.x); ahead = o; } });
    if(onRoad && c.dir > 0 && (tr.x - c.x) > 0 && (tr.x - c.x) < gap){ gap = tr.x - c.x - 1.5; ahead = { speed: tr.st === 'turn1' || tr.st === 'turn2' ? 0 : tr.speed || 0 }; }
    c.speed = ahead && gap < 6 ? Math.min(c.base, ahead.speed) : c.base;
    c.x += c.dir * c.speed * dt;
    if(c.dir > 0 ? c.x > g.px1 + 6 : c.x < g.px0 - 6){ c.el.remove(); c.gl.remove(); HOL.cars.splice(i, 1); continue; }
    hoPut(c.el, c.x, c.y, 0); hoPut(c.gl, c.x, c.y, 0);
  }
  hoTruckStep(dt, t); hoDronesStep(t); hoHeliStep(dt, t);
}

// --- Camião de entregas: chega pela estrada, vira para a doca, descarrega e sai ---
function hoTruckStep(dt, t){
  const g = HOL.geo;
  if(!HOL.truck){
    if(t < HOL.nextTruck) return;
    const ex = hoMk(HOL.laneA, hoTruckMarkup('x'), 'ho-truck'), ey = hoMk(HOL.laneA, hoTruckMarkup('y'), 'ho-truck');
    ey.style.display = 'none';
    HOL.truck = { st: 'in', x: g.px0 - 6, y: g.laneA, timer: 0, speed: 4.6, ex, ey, crates: [] };
  }
  const tr = HOL.truck;
  switch(tr.st){
    case 'in': tr.speed = 4.6; tr.x += tr.speed * dt; if(tr.x >= g.bay.x){ tr.x = g.bay.x; tr.st = 'turn1'; tr.timer = .7; tr.speed = 0; } break;
    case 'turn1': tr.timer -= dt; if(tr.timer <= 0){ tr.st = 'fwd'; tr.ex.style.display = 'none'; tr.ey.style.display = ''; } break;
    case 'fwd': tr.speed = 0; tr.y -= 3.2 * dt; if(tr.y <= g.bay.y){ tr.y = g.bay.y; tr.st = 'unload'; tr.timer = 0; } break;
    case 'unload': tr.timer += dt;
      while(tr.crates.length < 4 && tr.timer > 1.2 + tr.crates.length * 1.4){
        const n = tr.crates.length, c = { el: hoMk(HOL.ground, hoBox(0, 0, 0, .9, .9, .9, n % 2 ? '#9a7a4a' : '#8a6a3a'), 'ho-crate'), x: g.bay.x + 2.3, y: g.bay.y - 1.2 + n * 1.15 };
        hoPut(c.el, c.x, c.y, 0); tr.crates.push(c);
      }
      if(tr.timer > 8) tr.st = 'back'; break;
    case 'back': tr.y += 3.2 * dt; if(tr.y >= g.laneA){ tr.y = g.laneA; tr.st = 'turn2'; tr.timer = .7; tr.ey.style.display = 'none'; tr.ex.style.display = ''; } break;
    case 'turn2': tr.timer -= dt; if(tr.timer <= 0){ tr.st = 'out'; tr.crates.forEach(c => c.el.classList.add('fade')); } break;
    case 'out': tr.speed = 4.6; tr.x += tr.speed * dt;
      if(tr.x > g.px1 + 8){ [tr.ex, tr.ey].forEach(e => e.remove()); tr.crates.forEach(c => c.el.remove()); HOL.truck = null; HOL.nextTruck = t + 70 + Math.random() * 50; return; } break;
  }
  hoPut(tr.ex, tr.x, tr.y, 0); hoPut(tr.ey, tr.x, tr.y, 0);
}

// --- Drones ---
function hoDronesStep(t){
  HOL.drones.forEach(d => {
    const [x, y, z] = d.fn(t);
    hoPut(d.el, x, y, z); hoPut(d.sh, x, y, 0);
    d.sh.style.opacity = Math.max(0, .35 - z * .014).toFixed(2);
    if(d.carry){
      const carry = d.carry(t);
      if(carry && !d.pkg) d.pkg = hoMk(d.el, '<rect x="-3.2" y="4.2" width="6.4" height="5.4" fill="#9a7a4a" stroke="#6b4f26" stroke-width=".6"/><line x1="-3.2" y1="6.9" x2="3.2" y2="6.9" stroke="#6b4f26" stroke-width=".6"/>', 'ho-pkg');
      if(!carry && d.pkg){ d.pkg.remove(); d.pkg = null; }
    }
  });
}

// --- Helicóptero: chega, aterra no heliporto, fica um bocado e levanta voo ---
function hoHeliStep(dt, t){
  const g = HOL.geo, pad = g.pad;
  if(!HOL.heli){
    if(t < HOL.nextHeli) return;
    const [rx, ry] = hoP(0, 0, 2.3), [lx, ly] = hoP(-4.5, 0, 1.5);
    const el = hoMk(HOL.air, hoHeliMarkup() + `<g transform="translate(${rx.toFixed(1)},${ry.toFixed(1)})"><ellipse rx="30" ry="11" fill="#fff" opacity=".1"/><g class="ho-rotor-spin"><rect x="-30" y="-1.2" width="60" height="2.4" rx="1.2" fill="#2b343c"/></g></g>` +
      `<circle class="ho-heli-light" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="1.6" fill="#ff3b3b"/>`, 'ho-heli');
    const sh = hoMk(HOL.ground, '<ellipse rx="9" ry="4" fill="#000"/>', 'ho-shadow');
    HOL.heli = { st: 'approach', k: 0, el, sh };
  }
  const h = HOL.heli, A = [pad.x, pad.y, 8], S = [pad.x - 36, pad.y - 12, 20], E = [pad.x + 32, pad.y + 14, 22];
  const lerp = (p, q, k) => [hoLerp(p[0], q[0], k), hoLerp(p[1], q[1], k), hoLerp(p[2], q[2], k)];
  h.k += dt;
  const stages = { approach: [7, 'descend'], descend: [3.6, 'landed'], landed: [10, 'ascend'], ascend: [3.6, 'depart'], depart: [7, null] };
  const [dur, next] = stages[h.st], k = Math.min(1, h.k / dur);
  let pos;
  if(h.st === 'approach') pos = lerp(S, A, hoEase(k));
  else if(h.st === 'descend') pos = [pad.x, pad.y, hoLerp(8, 1.1, hoEase(k))];
  else if(h.st === 'landed') pos = [pad.x, pad.y, 1.1];
  else if(h.st === 'ascend') pos = [pad.x, pad.y, hoLerp(1.1, 8, hoEase(k))];
  else pos = lerp(A, E, hoEase(k));
  HOL.svg.classList.toggle('ho-heli-active', h.st === 'descend' || h.st === 'landed' || h.st === 'ascend' || (h.st === 'approach' && k > .6));
  hoPut(h.el, pos[0], pos[1], pos[2]); hoPut(h.sh, pos[0], pos[1], 0);
  h.sh.style.opacity = Math.max(0, .4 - (pos[2] - 1) * .02).toFixed(2);
  if(h.k >= dur){
    if(next){ h.st = next; h.k = 0; }
    else { h.el.remove(); h.sh.remove(); HOL.heli = null; HOL.svg.classList.remove('ho-heli-active'); HOL.nextHeli = t + 60 + Math.random() * 50; }
  }
}
