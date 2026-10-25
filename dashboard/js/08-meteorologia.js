/* ===== Relógio 3D + tempo (Open-Meteo, sem chave) ===== */
const WX = { loc: null, data: null, tz: null, results: [], fmt: {}, lang: '' };
const WX_TXT = {
  clear: { pt: 'Céu limpo', en: 'Clear sky', es: 'Despejado', fr: 'Ciel dégagé' }, mostly: { pt: 'Quase limpo', en: 'Mostly clear', es: 'Casi despejado', fr: 'Peu nuageux' },
  partly: { pt: 'Parcialmente nublado', en: 'Partly cloudy', es: 'Parcialmente nublado', fr: 'Partiellement nuageux' }, overcast: { pt: 'Nublado', en: 'Overcast', es: 'Nublado', fr: 'Couvert' },
  fog: { pt: 'Nevoeiro', en: 'Fog', es: 'Niebla', fr: 'Brouillard' }, drizzle: { pt: 'Chuvisco', en: 'Drizzle', es: 'Llovizna', fr: 'Bruine' },
  rain: { pt: 'Chuva', en: 'Rain', es: 'Lluvia', fr: 'Pluie' }, snow: { pt: 'Neve', en: 'Snow', es: 'Nieve', fr: 'Neige' }, thunder: { pt: 'Trovoada', en: 'Thunderstorm', es: 'Tormenta', fr: 'Orage' }
};
function wxInfo(code, day){
  const g = code === 0 ? 'clear' : code === 1 ? 'mostly' : code === 2 ? 'partly' : code === 3 ? 'overcast' : (code === 45 || code === 48) ? 'fog' : (code >= 51 && code <= 57) ? 'drizzle'
    : ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) ? 'rain' : ((code >= 71 && code <= 77) || code === 85 || code === 86) ? 'snow' : code >= 95 ? 'thunder' : 'partly';
  const icon = { clear: day ? '☀️' : '🌙', mostly: day ? '🌤️' : '🌙', partly: day ? '⛅' : '☁️', overcast: '☁️', fog: '🌫️', drizzle: '🌦️', rain: '🌧️', snow: '❄️', thunder: '⛈️' }[g];
  const fx = { rain: g === 'rain' ? 260 : g === 'drizzle' ? 90 : g === 'thunder' ? 300 : 0, snow: g === 'snow' ? 160 : 0,
    clouds: { clear: 0, mostly: .15, partly: .5, overcast: 1, fog: .6, drizzle: .9, rain: 1, snow: .8, thunder: 1 }[g], sun: !!day && (g === 'clear' || g === 'mostly' || g === 'partly'), night: !day, thunder: g === 'thunder' };
  return { g, icon, fx };
}
const wxLoad = () => { try { return JSON.parse(localStorage.getItem('hc_wx_loc')); } catch(e){ return null; } };
const wxSave = () => { try { localStorage.setItem('hc_wx_loc', JSON.stringify(WX.loc)); } catch(e){} };
const wxStatus = m => { const e = $('wxCond'); if(e) e.textContent = m; };
function wxRadios(){ document.querySelectorAll('input[name="wxMode"]').forEach(r => { r.checked = !!WX.loc && r.value === WX.loc.mode; }); }
function wxToggleSettings(){ const e = $('wxSettings'); e.style.display = e.style.display === 'none' ? 'block' : 'none'; wxRadios(); }
function wxManual(){ if(WX.loc) { WX.loc.mode = 'manual'; wxSave(); } $('wxQuery').focus(); }
async function wxDetect(){
  const loc = WX.loc = Object.assign(WX.loc || {}, { mode: 'auto' }); wxSave(); wxRadios();
  const done = async (lat, lon, name) => { loc.lat = lat; loc.lon = lon; loc.name = name; wxSave(); await wxFetch(); };
  const byTz = async () => {
    const city = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').split('/').pop().replace(/_/g, ' ');
    try { const r = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=${currentLang}`)).json(), x = r.results && r.results[0];
      if(x) return done(x.latitude, x.longitude, x.name + (x.country ? ', ' + x.country : '')); } catch(e){}
    wxStatus('Não foi possível detetar a localização. Usa o modo Manual (⚙).');
  };
  if(!navigator.geolocation) return byTz();
  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude, lon = pos.coords.longitude; let name = '';
    try { const r = await (await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${currentLang}`)).json(); name = [r.city || r.locality, r.countryName].filter(Boolean).join(', '); } catch(e){}
    done(lat, lon, name || `${lat.toFixed(2)}, ${lon.toFixed(2)}`);
  }, () => byTz(), { timeout: 8000, maximumAge: 3600000 });
}
async function wxSearch(){
  const q = $('wxQuery').value.trim(), box = $('wxResults'); if(!q) return;
  try {
    const r = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=${currentLang}`)).json();
    WX.results = r.results || [];
    box.innerHTML = WX.results.length ? WX.results.map((x, i) => `<button onclick="wxPick(${i})">${mpEsc([x.name, x.admin1, x.country].filter(Boolean).join(', '))}</button>`).join('') : '<div class="hint">Sem resultados.</div>';
  } catch(e){ box.innerHTML = '<div class="hint">Sem ligação ao serviço de pesquisa.</div>'; }
}
function wxPick(i){
  const x = WX.results[i]; if(!x) return;
  WX.loc = { mode: 'manual', name: [x.name, x.country].filter(Boolean).join(', '), lat: x.latitude, lon: x.longitude }; wxSave(); wxRadios();
  $('wxResults').innerHTML = ''; $('wxSettings').style.display = 'none'; wxFetch();
}
async function wxFetch(){
  const l = WX.loc; if(!l || l.lat == null) return;
  try {
    const j = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${l.lat}&longitude=${l.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day&timezone=auto`)).json();
    WX.data = j.current; WX.tz = j.timezone; wxRender(); wxScene();
  } catch(e){ wxStatus('Sem ligação ao serviço de meteorologia.'); }
}
function wxRender(){
  const d = WX.data; if(!d) return;
  const inf = wxInfo(d.weather_code, d.is_day);
  $('wxIcon').textContent = inf.icon; $('wxTemp').textContent = Math.round(d.temperature_2m) + '°C';
  $('wxCond').textContent = WX_TXT[inf.g][currentLang] || WX_TXT[inf.g].pt;
  $('wxFeels').textContent = Math.round(d.apparent_temperature) + '°C'; $('wxWind').textContent = Math.round(d.wind_speed_10m) + ' km/h'; $('wxHum').textContent = Math.round(d.relative_humidity_2m) + '%';
  $('wxPlace').textContent = (WX.loc && WX.loc.name) || '—'; WX.lang = currentLang;
}
function wxTick(){
  const loc = currentLang === 'pt' ? 'pt-PT' : currentLang, key = (WX.tz || '') + loc;
  let f = WX.fmt[key];
  if(!f) f = WX.fmt[key] = { t: new Intl.DateTimeFormat(loc, { timeZone: WX.tz || undefined, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
                             d: new Intl.DateTimeFormat(loc, { timeZone: WX.tz || undefined, weekday: 'long', day: 'numeric', month: 'long' }) };
  const now = new Date(), parts = f.t.format(now).split(':');
  $('wxTime').firstChild.nodeValue = parts[0] + ':' + parts[1]; $('wxSec').textContent = ':' + (parts[2] || '00');
  $('wxDate').textContent = f.d.format(now);
  if(WX.lang !== currentLang) wxRender();
}
function wxTexture(file, done){
  const bases = ['https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/textures/planets/', 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/'];
  const L = new THREE.TextureLoader(); L.setCrossOrigin('anonymous');
  (function next(i){ if(i < bases.length) L.load(bases[i] + file, done, undefined, () => next(i + 1)); })(0);
}
// Direção do Sol no referencial do globo (sem rodar): ponto subsolar a partir da hora UTC
function wxSunLocal(R){
  const now = new Date(), start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const doy = (now - start) / 86400000;
  const decl = -23.44 * Math.cos(2 * Math.PI / 365 * (doy + 10));
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const lon = -(utcH - 12) * 15;
  const ph = (90 - decl) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(-R * Math.sin(ph) * Math.cos(th), R * Math.cos(ph), R * Math.sin(ph) * Math.sin(th)).normalize();
}
function wxPlainTex(rgb){
  const t = new THREE.DataTexture(new Uint8Array([rgb[0], rgb[1], rgb[2], 255]), 1, 1, THREE.RGBAFormat); t.needsUpdate = true; return t;
}
// Globo realista: texturas da NASA (Blue Marble), dia e noite pela posição real do Sol,
// luzes das cidades no lado noturno, brilho do Sol nos oceanos, nuvens e atmosfera.
function wxBuildGlobe(c){
  const g = c.group = new THREE.Group(); c.scene.add(g); c.custom = true; c.rx = 0; c.ry = 0; c.tx = 0; c.ty = 0;
  const R = 1.5;
  const sun = new THREE.Vector3(1, .3, .6).normalize();
  const U = c.wxU = {
    dayMap: { value: wxPlainTex([24, 64, 112]) }, nightMap: { value: wxPlainTex([0, 0, 0]) }, specMap: { value: wxPlainTex([255, 255, 255]) },
    sunDir: { value: sun.clone() }
  };
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform sampler2D dayMap; uniform sampler2D nightMap; uniform sampler2D specMap; uniform vec3 sunDir;
      varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      void main(){
        vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
        float NdL = dot(N, sunDir);
        float dayMix = smoothstep(-0.10, 0.22, NdL);
        vec3 day = texture2D(dayMap, vUv).rgb * (0.08 + 1.08 * max(NdL, 0.0));
        vec3 lights = texture2D(nightMap, vUv).rgb;
        vec3 night = vec3(0.010, 0.018, 0.035) + lights * vec3(1.0, 0.78, 0.48) * 1.6;
        vec3 col = mix(night, day, dayMix);
        float water = texture2D(specMap, vUv).r;
        vec3 H = normalize(sunDir + V);
        col += vec3(1.0, 0.93, 0.8) * pow(max(dot(N, H), 0.0), 55.0) * water * 0.75 * dayMix;
        col += vec3(1.0, 0.42, 0.14) * 0.16 * max(0.0, 1.0 - abs(NdL) * 6.0);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
        col += vec3(0.32, 0.62, 1.0) * fres * (0.12 + 0.75 * smoothstep(-0.3, 0.6, NdL));
        gl_FragColor = vec4(col, 1.0);
      }`
  }));
  g.add(earth);
  // nuvens: camada própria, iluminada pelo Sol
  c.cloudU = { map: { value: wxPlainTex([0, 0, 0]) }, sunDir: U.sunDir, opacity: { value: .55 }, tint: { value: new THREE.Color(1, 1, 1) } };
  c.cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 72, 48), new THREE.ShaderMaterial({
    uniforms: c.cloudU, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 sunDir; uniform float opacity; uniform vec3 tint; varying vec2 vUv; varying vec3 vN;
      void main(){ float a = texture2D(map, vUv).r; float l = dot(normalize(vN), sunDir);
        vec3 col = tint * (0.04 + 1.0 * max(l, 0.0)); gl_FragColor = vec4(col, a * opacity * (0.25 + 0.75 * smoothstep(-0.25, 0.2, l))); }`
  }));
  g.add(c.cloudMesh);
  wxTexture('earth_atmos_2048.jpg', tex => { U.dayMap.value = tex; });
  wxTexture('earth_lights_2048.png', tex => { U.nightMap.value = tex; });
  wxTexture('earth_specular_2048.jpg', tex => { U.specMap.value = tex; });
  wxTexture('earth_clouds_1024.png', tex => { c.cloudU.map.value = tex; });
  // atmosfera: halo azul fino, mais forte do lado do Sol
  c.atmoU = { sunDir: U.sunDir };
  c.scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.075, 64, 48), new THREE.ShaderMaterial({
    uniforms: c.atmoU, blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true, depthWrite: false,
    vertexShader: `varying vec3 vN; varying vec3 vNW; void main(){ vN = normalize(normalMatrix * normal); vNW = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 sunDir; varying vec3 vN; varying vec3 vNW;
      void main(){ float i = pow(max(0.0, 0.66 - dot(vN, vec3(0.0, 0.0, 1.0))), 2.4); float s = 0.25 + 0.75 * smoothstep(-0.4, 0.5, dot(vNW, sunDir));
        gl_FragColor = vec4(0.35, 0.65, 1.0, 1.0) * i * s * 1.8; }`
  })));
  // estrelas ao fundo
  const sp = new Float32Array(240); for(let i = 0; i < 80; i++){ sp[3*i] = (Math.random() - .5) * 9; sp[3*i+1] = (Math.random() - .5) * 9; sp[3*i+2] = -3 - Math.random() * 2; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  c.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfe3ff, size: .035, transparent: true, opacity: .75 })));
  // marcador da localização
  c.pin = new THREE.Group(); const pm = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffc040 })); c.pin.add(pm);
  c.pinHalo = hc3dHalo('rgba(255,180,50,.9)'); c.pinHalo.scale.set(.35, .35, 1); c.pin.add(c.pinHalo); g.add(c.pin);
  c.sunLocal = wxSunLocal(R); c.sunAt = Date.now();
  const tmp = new THREE.Vector3();
  c.frameFn = (cc, dt) => {
    const k = Math.min(1, dt * 2.5); cc.ry += (cc.ty - cc.ry) * k; cc.rx += (cc.tx - cc.rx) * k;
    cc.group.rotation.y = cc.ry + Math.sin(cc.t * .25) * .18; cc.group.rotation.x = cc.rx + Math.sin(cc.t * .2) * .04;
    cc.camera.position.set(0, 0, 5.2); cc.camera.lookAt(0, 0, 0);
    if(Date.now() - cc.sunAt > 60000){ cc.sunLocal = wxSunLocal(R); cc.sunAt = Date.now(); }
    cc.group.updateMatrixWorld();
    U.sunDir.value.copy(tmp.copy(cc.sunLocal).transformDirection(cc.group.matrixWorld));
    cc.pinHalo.scale.setScalar(.28 + .09 * Math.sin(cc.t * 3.5));
    cc.cloudMesh.rotation.y += dt * .012;
  };
}
function wxScene(){
  if(hcPerfMode || HC3D.failed) return;
  if(!HC3D.ready){ hc3dLoad().then(wxScene).catch(() => {}); return; }
  const d = WX.data, l = WX.loc; if(!d || !l) return;
  const c = hc3dEnsure('wxGlobe'); if(!c.group) wxBuildGlobe(c);
  c.active = true; if(!HC3D.raf) HC3D.raf = requestAnimationFrame(hc3dLoop);
  const ph = (90 - l.lat) * Math.PI / 180, th = (l.lon + 180) * Math.PI / 180, R = 1.5;
  const P = new THREE.Vector3(-R * Math.sin(ph) * Math.cos(th), R * Math.cos(ph), R * Math.sin(ph) * Math.sin(th));
  c.pin.position.copy(P.clone().multiplyScalar(1.01)); c.ty = Math.atan2(-P.x, P.z); c.tx = Math.atan2(P.y, Math.sqrt(P.x * P.x + P.z * P.z));
  // o tempo atual muda só a camada de nuvens: mais densa e mais escura com chuva/trovoada
  const inf = wxInfo(d.weather_code, d.is_day).fx, dark = inf.rain || inf.thunder;
  c.cloudU.opacity.value = .22 + .63 * (inf.clouds || 0);
  c.cloudU.tint.value.setRGB(dark ? .72 : 1, dark ? .76 : 1, dark ? .82 : 1);
}
(function wxInit(){
  function go(){
    WX.loc = wxLoad() || { mode: 'auto' }; wxRadios();
    if(WX.loc.lat == null) wxDetect(); else wxFetch();
    wxTick(); setInterval(wxTick, 1000); setInterval(wxFetch, 600000);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();

