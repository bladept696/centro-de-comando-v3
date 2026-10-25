/* ===== Gráficos 3D (Three.js carregado a pedido; SVG como alternativa) ===== */
var HC3D = { charts: {}, ready: false, loading: null, failed: false, raf: 0, last: 0, payload: {}, pr: 1.5, gap: 33, q: 2, ema: 40, good: 0 };
function hc3dLoad(){
  if(window.THREE){ HC3D.ready = true; return Promise.resolve(); }
  if(HC3D.loading) return HC3D.loading;
  return HC3D.loading = new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    sc.onload = () => { HC3D.ready = true; res(); };
    sc.onerror = () => { HC3D.failed = true; rej(new Error('three')); };
    document.head.appendChild(sc);
  });
}
function hc3dHalo(color){
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
}
function hc3dClear(c){
  if(c.lab){ c.lab.innerHTML = ''; c.labels = []; }
  if(!c.group) return;
  c.scene.remove(c.group);
  c.group.traverse(o => { if(o.geometry) o.geometry.dispose(); if(o.material){ if(o.material.map) o.material.map.dispose(); o.material.dispose(); } });
  c.group = null; c.line = null; c.bars = null;
}
function hc3dEnsure(id){
  if(HC3D.charts[id]) return HC3D.charts[id];
  const el0 = document.getElementById(id), custom = el0.tagName.toLowerCase() !== 'svg';
  const svg = custom ? { style: {} } : el0, host = custom ? el0 : el0.parentElement;
  host.style.position = 'relative';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, HC3D.pr || 1.5));
  const cv = renderer.domElement; cv.className = 'hc3d-canvas'; host.appendChild(cv);
  const tip = document.createElement('div'); tip.className = 'hc3d-tip'; host.appendChild(tip);
  // Gráficos: lente "longa" (pouca perspetiva) para as alturas se compararem bem
  const c = { id, svg, host, renderer, tip, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(custom ? 38 : 22, 3, .1, 100), ray: new THREE.Raycaster(),
              mouse: new THREE.Vector2(9, 9), mx: 0, my: 0, px: 0, py: 0, visible: true, active: false, t: 0, W: 16, dist: custom ? 7.8 : 13.5, group: null };
  c.scene.add(new THREE.AmbientLight(0xffffff, custom ? .55 : .7));
  const dl = new THREE.DirectionalLight(0xffe2b8, custom ? .9 : .75); dl.position.set(-4, 9, 7); c.scene.add(dl);
  c.light = new THREE.PointLight(0xffb020, custom ? 1.3 : .5, 22); c.light.position.set(0, 3.5, 3); c.scene.add(c.light);
  if(!custom){
    const rim = new THREE.DirectionalLight(0x6fb7ff, .35); rim.position.set(6, 3, -6); c.scene.add(rim);
    c.lab = document.createElement('div'); c.lab.className = 'hc3d-labels'; host.appendChild(c.lab); c.labels = [];
  }
  cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); c.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); c.px = e.clientX - r.left; c.py = e.clientY - r.top; });
  cv.addEventListener('pointerleave', () => { c.mouse.set(9, 9); tip.style.display = 'none'; });
  if(window.ResizeObserver) new ResizeObserver(() => hc3dResize(c)).observe(host);
  if(window.IntersectionObserver) new IntersectionObserver(es => { c.visible = es[0].isIntersecting; }).observe(host);
  c.custom = custom; HC3D.charts[id] = c; hc3dResize(c); return c;
}
function hc3dResize(c){
  const w = c.host.clientWidth, h = c.host.clientHeight; if(!w || !h) return;
  c.renderer.setSize(w, h, false); c.camera.aspect = w / h; c.camera.updateProjectionMatrix();
  const W = Math.max(8, Math.min(30, 5.4 * (w / h) * .86));
  if(!c.custom && Math.abs(W - c.W) / c.W > .05){ c.W = W; c.sig = null; hc3dClear(c); clearTimeout(c.rz); c.rz = setTimeout(hc3dReplay, 50); }
}

// --- Peças comuns aos gráficos 3D ---
// Cores do tema atual (seguem os temas da dashboard)
function hc3dTheme(){
  const cs = getComputedStyle(document.body), v = (n, d) => { const s = cs.getPropertyValue(n).trim(); return /^#[0-9a-f]{6}$/i.test(s) ? s : d; };
  return { accent: new THREE.Color(v('--amber', '#ffb020')), floor: new THREE.Color(v('--panel-2', '#0f2130')), wall: new THREE.Color(v('--panel', '#0d1a26')),
           grid: new THREE.Color(v('--line-strong', '#1c3a49')), text: v('--text', '#eaf6f7') };
}
// Rótulos em HTML projetados a partir da cena: texto sempre nítido e legível
function hc3dAddLabel(c, text, x, y, z, align, cls){
  const el = document.createElement('span'); el.className = 'hc3d-lbl' + (cls ? ' ' + cls : ''); el.textContent = text; c.lab.appendChild(el);
  const L = { el, pos: new THREE.Vector3(x, y, z), align: align || 'c' }; c.labels.push(L); return L;
}
function hc3dPlaceLabels(c){
  if(!c.labels || !c.labels.length) return;
  const w = c.host.clientWidth, h = c.host.clientHeight, v = c._v || (c._v = new THREE.Vector3());
  const off = { r: 'translate(-100%,-50%)', l: 'translate(0,-50%)', c: 'translate(-50%,0)', b: 'translate(-50%,-100%)' };
  c.labels.forEach(L => {
    if(L.hidden){ if(L.el.style.display !== 'none') L.el.style.display = 'none'; return; }
    v.copy(L.pos).project(c.camera);
    L.el.style.display = '';
    L.el.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px,${((1 - v.y) / 2 * h).toFixed(1)}px) ${off[L.align]}`;
  });
}
// Chão, parede de fundo e linhas de valor (o "eixo Y" desenhado na parede)
function hc3dStage(c, g, D, H, ticks, th){
  const x0 = c.xL - .3, x1 = c.xR + .3, zb = -D / 2 - .35;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, D + 1.1), new THREE.MeshStandardMaterial({ color: th.floor, roughness: 1, metalness: 0, transparent: true, opacity: .85 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -.002, .2); g.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, H + .5), new THREE.MeshStandardMaterial({ color: th.wall, roughness: 1, metalness: 0, transparent: true, opacity: .55 }));
  wall.position.set(0, (H + .5) / 2, zb); g.add(wall);
  const lm = new THREE.LineBasicMaterial({ color: th.grid, transparent: true, opacity: .9 });
  const pts = [];
  ticks.forEach(t => { pts.push(new THREE.Vector3(x0, t.y, zb + .01), new THREE.Vector3(x1, t.y, zb + .01)); });
  // aresta do chão junto à parede e à frente
  pts.push(new THREE.Vector3(x0, 0, zb + .01), new THREE.Vector3(x1, 0, zb + .01), new THREE.Vector3(x0, 0, D / 2 + .75), new THREE.Vector3(x1, 0, D / 2 + .75));
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lm));
  ticks.forEach(t => hc3dAddLabel(c, t.text, x0 - .1, t.y, zb, 'r'));
}
// Valores "redondos" para as linhas de valor (escala linear)
function hc3dNiceTicks(lo, hi, n){
  const span = hi - lo || Math.abs(hi) || 1, raw = span / Math.max(1, n), mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || 10 * mag;
  const out = []; for(let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(+v.toFixed(10));
  return out;
}
function hc3dRangeLabels(){
  const ms = (typeof _hashrateRangeState !== 'undefined' && _hashrateRangeState.rangeMs) || 3600000, min = Math.round(ms / 60000);
  const fmt = m => m >= 120 ? '-' + Math.round(m / 60) + ' h' : '-' + m + ' min';
  return { start: fmt(min), mid: fmt(Math.round(min / 2)), minutes: min };
}

// --- Hashrate: área em 3D com a linha à frente ---
function hc3dStrip(N){
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
  const idx = []; for(let i = 0; i < N - 1; i++){ const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx); return geo;
}
function hc3dMesh(g, geo, opacity){
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: opacity == null ? 1 : opacity, side: THREE.DoubleSide, depthWrite: false }));
  m.frustumCulled = false; g.add(m); return m;
}
function hc3dLine(c, vals){
  const N = Math.min(96, vals.length), rs = [];
  for(let i = 0; i < N; i++){ const a = Math.floor(i * vals.length / N), b = Math.max(a + 1, Math.floor((i + 1) * vals.length / N)); let sm = 0; for(let k = a; k < b; k++) sm += vals[k]; rs.push(sm / (b - a)); }
  const mn = Math.min(...rs), mx = Math.max(...rs), pad = ((mx - mn) || Math.max(mx * .1, 1)) * .25;
  let ticks = hc3dNiceTicks(Math.max(0, mn - pad), mx + pad, 3);
  if(ticks.length < 2) ticks = [mn, mx];
  const lo = Math.min(ticks[0], mn), hi = Math.max(ticks[ticks.length - 1], mx), H = 3.2, D = 1.1;
  const yOf = v => (v - lo) / ((hi - lo) || 1) * H;
  const target = rs.map(yOf), rl = hc3dRangeLabels();
  c.xL = -c.W / 2 + 1.7; c.xR = c.W / 2 - 2.0;
  const sig = N + '|' + c.W.toFixed(1) + '|' + ticks.join(',') + '|' + rl.minutes;
  if(!c.line || c.sig !== sig){
    const prev = c.line && c.line.N === N ? c.line.cur : null;
    hc3dClear(c); c.sig = sig;
    const th = hc3dTheme(), g = c.group = new THREE.Group(); c.scene.add(g);
    hc3dStage(c, g, D, H, ticks.map(v => { const f = formatHashrate(v); return { y: yOf(v), text: f.value.replace(/\.?0+$/, '') + ' ' + f.unit }; }), th);
    const L = c.line = { N, D, H, cur: prev || target.slice(), target, rs, th, yOf };
    L.front = hc3dMesh(g, hc3dStrip(N), .92);   // face da frente (área)
    L.top = hc3dMesh(g, hc3dStrip(N), .9);      // topo com profundidade
    L.edge = hc3dMesh(g, hc3dStrip(N));          // linha brilhante na aresta da frente
    L.mark = new THREE.Mesh(new THREE.SphereGeometry(.14, 20, 20), new THREE.MeshStandardMaterial({ color: th.accent, emissive: th.accent, emissiveIntensity: .7, roughness: .3 })); g.add(L.mark);
    L.halo = hc3dHalo('rgba(255,190,80,.55)'); L.halo.scale.set(1, 1, 1); g.add(L.halo);
    L.guide = new THREE.Mesh(new THREE.BoxGeometry(.025, 1, .025), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5 })); L.guide.geometry.translate(0, .5, 0); L.guide.visible = false; g.add(L.guide);
    L.dot = new THREE.Mesh(new THREE.SphereGeometry(.09, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })); L.dot.visible = false; g.add(L.dot);
    L.hitPlane = new THREE.Mesh(new THREE.PlaneGeometry(c.W + 2, H + 3), new THREE.MeshBasicMaterial({ visible: false })); L.hitPlane.position.set(0, H / 2, D / 2); g.add(L.hitPlane);
    const avgV = rs.reduce((a, b) => a + b, 0) / rs.length, ay = yOf(avgV);
    const avg = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(c.xL, ay, -D / 2 - .33), new THREE.Vector3(c.xR, ay, -D / 2 - .33)]),
      new THREE.LineDashedMaterial({ color: th.accent, dashSize: .25, gapSize: .18, transparent: true, opacity: .55 }));
    avg.computeLineDistances(); g.add(avg); L.avg = avg;
    hc3dAddLabel(c, 'média', c.xR + .4, ay, -D / 2 - .33, 'l');
    hc3dAddLabel(c, rl.start, c.xL, -.05, D / 2 + .75, 'c');
    hc3dAddLabel(c, rl.mid, (c.xL + c.xR) / 2, -.05, D / 2 + .75, 'c');
    hc3dAddLabel(c, 'agora', c.xR, -.05, D / 2 + .75, 'c');
  }
  c.line.target = target; c.line.rs = rs;
}
function hc3dFrameLine(c, dt){
  const L = c.line; if(!L) return;
  const N = L.N, D = L.D, e = Math.min(1, dt * 5), a = L.th.accent, f = L.th.floor, xL = c.xL, PW = c.xR - c.xL;
  const fp = L.front.geometry.attributes, tp = L.top.geometry.attributes, ep = L.edge.geometry.attributes;
  for(let i = 0; i < N; i++){
    L.cur[i] += (L.target[i] - L.cur[i]) * e;
    const x = xL + i * PW / (N - 1), y = L.cur[i], k = .35 + .65 * (y / L.H);
    fp.position.setXYZ(2*i, x, y, D / 2); fp.position.setXYZ(2*i + 1, x, 0, D / 2);
    fp.color.setXYZ(2*i, f.r + (a.r - f.r) * .55 * k, f.g + (a.g - f.g) * .55 * k, f.b + (a.b - f.b) * .55 * k);
    fp.color.setXYZ(2*i + 1, f.r, f.g, f.b);
    tp.position.setXYZ(2*i, x, y, -D / 2); tp.position.setXYZ(2*i + 1, x, y, D / 2);
    tp.color.setXYZ(2*i, a.r * .35, a.g * .35, a.b * .35); tp.color.setXYZ(2*i + 1, a.r * .7, a.g * .7, a.b * .7);
    ep.position.setXYZ(2*i, x, y + .05, D / 2 + .005); ep.position.setXYZ(2*i + 1, x, y - .05, D / 2 + .005);
    ep.color.setXYZ(2*i, a.r, a.g, a.b); ep.color.setXYZ(2*i + 1, a.r, a.g, a.b);
  }
  [fp, tp, ep].forEach(at => { at.position.needsUpdate = true; at.color.needsUpdate = true; });
  const ly = L.cur[N - 1];
  L.mark.position.set(c.xR, ly, D / 2 + .02); L.halo.position.copy(L.mark.position); L.halo.scale.setScalar(.9 + .25 * Math.sin(c.t * 2.2));
  // passar o rato: guia vertical, ponto e dica com o valor e o tempo
  let shown = false;
  if(c.mouse.x < 5){
    c.ray.setFromCamera(c.mouse, c.camera);
    const hit = c.ray.intersectObject(L.hitPlane)[0];
    if(hit){
      const i = Math.max(0, Math.min(N - 1, Math.round((hit.point.x - xL) / PW * (N - 1))));
      const x = xL + i * PW / (N - 1), y = L.cur[i];
      L.guide.position.set(x, 0, D / 2 + .01); L.guide.scale.y = Math.max(.01, y); L.guide.visible = true;
      L.dot.position.set(x, y, D / 2 + .03); L.dot.visible = true;
      const fv = formatHashrate(L.rs[i]), rl = hc3dRangeLabels(), ago = Math.round(rl.minutes * (1 - i / (N - 1)));
      c.tip.style.display = 'block'; c.tip.style.left = (c.px + 12) + 'px'; c.tip.style.top = Math.max(0, c.py - 30) + 'px';
      c.tip.textContent = `${fv.value} ${fv.unit} · ${ago ? (ago >= 120 ? '-' + Math.round(ago / 60) + ' h' : '-' + ago + ' min') : 'agora'}`;
      shown = true;
    }
  }
  if(!shown){ L.guide.visible = false; L.dot.visible = false; c.tip.style.display = 'none'; }
}

// --- Melhor dificuldade: colunas 3D com escala logarítmica marcada na parede ---
function hc3dBars(c, buckets, range){
  const sig = range + '|' + c.W.toFixed(1) + '|' + buckets.map(b => b.ts + ':' + b.value).join(',');
  if(c.sig === sig) return;
  hc3dClear(c); c.sig = sig;
  const th = hc3dTheme(), g = c.group = new THREE.Group(); c.scene.add(g);
  const n = buckets.length, W = c.W, D = 1.1, H = 3.2;
  const vals = buckets.map(b => Math.max(1, b.value)), top = Math.max(...vals), low = Math.min(...vals);
  c.xL = -W / 2 + 1.5; c.xR = W / 2 - .4;
  // marcas 1-3-10: do primeiro valor abaixo do mínimo ao primeiro acima do máximo
  const steps = []; for(let e = Math.floor(Math.log10(low)) - 1; e <= Math.ceil(Math.log10(top)) + 1; e++) steps.push(Math.pow(10, e), 3 * Math.pow(10, e));
  const lo = steps.filter(v => v <= low).pop() || steps[0], hi = steps.find(v => v >= top * 1.05) || top * 1.5;
  const tickVals = steps.filter(v => v >= lo && v <= hi);
  const logMin = Math.log10(lo), lr = (Math.log10(hi) - logMin) || 1, hOf = v => .06 + (Math.log10(Math.max(1, v)) - logMin) / lr * (H - .06);
  hc3dStage(c, g, D, H, tickVals.map(v => { const f = formatDiff(v); return { y: hOf(v), text: f.value.replace(/\.0+$/, '') + f.unit }; }), th);
  const step = (c.xR - c.xL) / n, bw = Math.min(1.0, step * .62), best = vals.indexOf(top);
  const dim = th.accent.clone().lerp(th.wall, .5), capCol = th.accent.clone().lerp(new THREE.Color(0xffffff), .35);
  const B = c.bars = { meshes: [], caps: [], best };
  buckets.forEach((b, i) => {
    const h = hOf(vals[i]), isBest = i === best, col = isBest ? th.accent : dim;
    const geo = new THREE.BoxGeometry(bw, 1, D * .8); geo.translate(0, .5, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: isBest ? .28 : .08, metalness: .15, roughness: .5 }));
    m.position.set(c.xL + i * step + step / 2, 0, 0); m.scale.y = .001; m.userData = { h, delay: i * .04, b, base: isBest ? .28 : .08 }; g.add(m); B.meshes.push(m);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(bw, .04, D * .8), new THREE.MeshBasicMaterial({ color: isBest ? capCol : dim.clone().lerp(new THREE.Color(0xffffff), .2) }));
    cap.position.set(m.position.x, 0, 0); g.add(cap); B.caps.push(cap);
  });
  const fb = formatDiff(top);
  B.bestLabel = hc3dAddLabel(c, fb.value + fb.unit, B.meshes[best].position.x, hOf(top) + .12, 0, 'b', 'hc3d-lbl-strong'); B.bestLabel.hidden = true;
  const cnt = Math.min(n, Math.max(2, Math.floor(W / 3)));
  for(let i = 0; i < cnt; i++){
    const idx = cnt > 1 ? Math.round(i * (n - 1) / (cnt - 1)) : 0, d = new Date(buckets[idx].ts * 1000);
    const txt = range === '24h' ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    hc3dAddLabel(c, txt, B.meshes[idx].position.x, -.05, D / 2 + .75, 'c');
  }
  c.t = 0;
}
function hc3dFrameBars(c, dt){
  const B = c.bars; if(!B) return;
  c.ray.setFromCamera(c.mouse, c.camera);
  const hit = c.mouse.x < 5 ? c.ray.intersectObjects(B.meshes)[0] : null;
  let done = true;
  B.meshes.forEach((m, i) => {
    const u = m.userData, k = Math.min(1, Math.max(0, (c.t - u.delay) / .7)), e = 1 - Math.pow(1 - k, 3);
    if(k < 1) done = false;
    m.scale.y = Math.max(.001, u.h * e); B.caps[i].position.y = u.h * e + .02;
    const want = (hit && hit.object === m) ? u.base + .45 : u.base;
    m.material.emissiveIntensity += (want - m.material.emissiveIntensity) * Math.min(1, dt * 10);
  });
  B.bestLabel.hidden = !done;
  if(hit){
    const b = hit.object.userData.b, f = formatDiff(b.value), d = new Date(b.ts * 1000);
    c.tip.style.display = 'block'; c.tip.style.left = (c.px + 12) + 'px'; c.tip.style.top = Math.max(0, c.py - 30) + 'px';
    c.tip.textContent = `${f.value}${f.unit} · ${d.toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
  } else c.tip.style.display = 'none';
}
function hc3dFrame(c, dt){
  if(c.frameFn){ c.frameFn(c, dt); return; }
  // câmara: ligeiramente de cima e de lado; o rato inclina-a um pouco (paralaxe suave)
  const inside = c.mouse.x < 5, tx = inside ? c.mouse.x * .6 : 0, ty = inside ? c.mouse.y * .35 : 0, k = Math.min(1, dt * 3);
  c.mx += (tx - c.mx) * k; c.my += (ty - c.my) * k;
  c.camera.position.set(-2.2 + c.mx * 1.6, 4.6 + c.my * 1.2, c.dist); c.camera.lookAt(0, 1.45, 0);
  c.light.position.set(0, 4, 4);
  if(c.line) hc3dFrameLine(c, dt); else hc3dFrameBars(c, dt);
  hc3dPlaceLabels(c);
}
function hc3dQuality(q){
  HC3D.q = q; HC3D.pr = [.75, 1, 1.5][q]; HC3D.gap = [66, 50, 33][q];
  for(const id in HC3D.charts){ const c = HC3D.charts[id]; c.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, HC3D.pr)); hc3dResize(c); if(c.line && c.line.parts) c.line.parts.visible = q >= 2; }
}
function hc3dLoop(ts){
  HC3D.raf = requestAnimationFrame(hc3dLoop);
  if(ts - HC3D.last < HC3D.gap || hcPaused()) return;
  const raw = ts - HC3D.last, dt = Math.min(.1, raw / 1000); HC3D.last = ts;
  if(raw < 300){
    HC3D.ema = HC3D.ema * .92 + raw * .08;
    if(HC3D.ema > HC3D.gap * 1.5 && HC3D.q > 0){ hc3dQuality(HC3D.q - 1); HC3D.ema = HC3D.gap; HC3D.good = 0; }
    else if(HC3D.ema < HC3D.gap * 1.1 && HC3D.q < 2 && ++HC3D.good > 600){ hc3dQuality(HC3D.q + 1); HC3D.good = 0; }
  }
  for(const id in HC3D.charts){ const c = HC3D.charts[id]; if(!c.visible || !c.active || !c.group) continue; c.t += dt; hc3dFrame(c, dt); c.renderer.render(c.scene, c.camera); }
}
function hc3dRender(id, p){
  const c = hc3dEnsure(id); c.active = true; c.svg.style.visibility = 'hidden'; c.renderer.domElement.style.display = 'block';
  if(id === 'chartHashrate') hc3dLine(c, p); else hc3dBars(c, p.buckets, p.range);
  if(!HC3D.raf) HC3D.raf = requestAnimationFrame(hc3dLoop);
}
function hc3dReplay(){ if(hcPerfMode || !HC3D.ready) return; for(const id in HC3D.payload) hc3dRender(id, HC3D.payload[id]); }
function hc3dTry(id, payload){
  HC3D.payload[id] = payload;
  if(hcPerfMode || HC3D.failed) return false;
  if(!HC3D.ready){ hc3dLoad().then(hc3dReplay).catch(() => {}); return false; }
  hc3dRender(id, payload); return true;
}
function hc3dSync(){
  for(const id in HC3D.charts){ const c = HC3D.charts[id]; c.renderer.domElement.style.display = hcPerfMode ? 'none' : 'block'; c.svg.style.visibility = hcPerfMode ? 'visible' : 'hidden'; c.active = !hcPerfMode; }
  if(!hcPerfMode) hc3dReplay();
}

/* ===== Visual 3D: faíscas de shares, cockpit, globo, barras empilhadas ===== */
const SF = { sparks: [], cv: null, raf: 0 };
function hcShareFlow(devId, prev, cur){
  if(hcPerfMode || !prev || !prev.online || prev.accepted == null || !cur) return;
  const da = (cur.accepted || 0) - (prev.accepted || 0), dr = (cur.rejected || 0) - (prev.rejected || 0);
  if(da <= 0 && dr <= 0) return;
  const wrap = $('networkMapWrap'); if(!wrap || wrap.clientWidth < 80) return;
  const now = performance.now();
  for(let i = 0; i < Math.min(da, 6); i++) SF.sparks.push({ id: devId, t0: now + Math.random() * 4000, dur: 900 + Math.random() * 400, bad: false });
  for(let i = 0; i < Math.min(dr, 4); i++) SF.sparks.push({ id: devId, t0: now + Math.random() * 4000, dur: 800, bad: true });
  if(!SF.raf) SF.raf = requestAnimationFrame(sfLoop);
}
function sfLoop(ts){
  SF.raf = requestAnimationFrame(sfLoop);
  const wrap = $('networkMapWrap'); if(!wrap || hcPaused()) return;
  if(!SF.cv){ SF.cv = document.createElement('canvas'); SF.cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:6'; wrap.appendChild(SF.cv); }
  const cv = SF.cv, w = wrap.clientWidth, h = wrap.clientHeight;
  if(cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
  const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, w, h);
  const dn = nmNodes.get('net') || nmNodes.get('center'); if(!dn){ SF.sparks.length = 0; }
  const wr = wrap.getBoundingClientRect(), mid = el => { const r = el.getBoundingClientRect(); return [r.left - wr.left + r.width / 2, r.top - wr.top + r.height / 2]; };
  SF.sparks = SF.sparks.filter(s => ts - s.t0 < s.dur);
  const dst = dn ? mid(dn.el) : [0, 0];
  for(const s of SF.sparks){
    const u = (ts - s.t0) / s.dur; if(u < 0) continue;
    const sn = nmNodes.get('m:' + s.id); if(!sn) continue;
    const src = mid(sn.el);
    if(!s.bad){
      const cx = (src[0] + dst[0]) / 2, cy = (src[1] + dst[1]) / 2 - 30;
      for(let k = 3; k >= 0; k--){
        const v = Math.max(0, u - k * .05), x = (1 - v) * (1 - v) * src[0] + 2 * (1 - v) * v * cx + v * v * dst[0], y = (1 - v) * (1 - v) * src[1] + 2 * (1 - v) * v * cy + v * v * dst[1];
        ctx.fillStyle = `rgba(79,214,255,${k === 0 ? 1 : .35 - k * .08})`; ctx.beginPath(); ctx.arc(x, y, k === 0 ? 2.6 : 2, 0, 6.3); ctx.fill();
        if(k === 0){ ctx.fillStyle = 'rgba(79,214,255,.25)'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.3); ctx.fill(); }
      }
      if(u > .92){ ctx.strokeStyle = `rgba(33,255,176,${(1 - u) * 8})`; ctx.beginPath(); ctx.arc(dst[0], dst[1], 6 + (u - .92) * 90, 0, 6.3); ctx.stroke(); }
    } else {
      ctx.strokeStyle = `rgba(255,77,94,${1 - u})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(src[0], src[1], 5 + u * 24, 0, 6.3); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = `rgba(255,77,94,${1 - u})`;
      for(let i = 0; i < 6; i++){ const a = i * 1.047 + u, d = u * 22; ctx.beginPath(); ctx.arc(src[0] + Math.cos(a) * d, src[1] + Math.sin(a) * d, 2, 0, 6.3); ctx.fill(); }
    }
  }
  if(!SF.sparks.length){ ctx.clearRect(0, 0, w, h); cancelAnimationFrame(SF.raf); SF.raf = 0; }
}

