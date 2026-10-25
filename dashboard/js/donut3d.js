// ---------- Rosca do hashrate em 3D ----------
// Cada máquina é uma fatia em relevo: a altura vai com o peso dela no total. A rosca roda devagar,
// a fatia sobre a qual está o rato salta para fora e mostra o valor. Se o 3D não estiver disponível
// (modo Desempenho, sem internet para o Three.js), o renderHashrateDonut usa o anel plano de sempre.

function donut3dSector(a0, a1, ri, ro, depth){
  const sh = new THREE.Shape();
  sh.moveTo(Math.cos(a0) * ri, Math.sin(a0) * ri);
  sh.lineTo(Math.cos(a0) * ro, Math.sin(a0) * ro);
  sh.absarc(0, 0, ro, a0, a1, false);
  sh.lineTo(Math.cos(a1) * ri, Math.sin(a1) * ri);
  sh.absarc(0, 0, ri, a1, a0, true);
  const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: .035, bevelSize: .035, bevelSegments: 2, curveSegments: Math.max(6, Math.ceil((a1 - a0) * 14)) });
  return geo;
}

function donut3dInit(c){
  c.group = new THREE.Group(); c.scene.add(c.group);
  // luz mais neutra do que a dos outros gráficos
  c.scene.children.forEach(o => { if(o.isAmbientLight) o.intensity = .85; if(o.isDirectionalLight){ o.color.set(0xffffff); o.intensity = .95; o.position.set(-3, 6, 4); } if(o.isPointLight) o.intensity = 0; });
  const th = hc3dTheme();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.45, 72), new THREE.MeshBasicMaterial({ color: th.floor, transparent: true, opacity: .9 }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = -.03; c.scene.add(disc);
  const rim = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.46, 72), new THREE.MeshBasicMaterial({ color: th.grid, transparent: true, opacity: .9 }));
  rim.rotation.x = -Math.PI / 2; rim.position.y = -.02; c.scene.add(rim);
  c.d3 = { slices: [], meshes: [], rot: 0, hover: -1, ids: '', sig: '' };
  c.frameFn = (cc, dt) => {
    const D = cc.d3, inside = cc.mouse.x < 5;
    D.rot += dt * (inside ? .04 : .16);
    cc.group.rotation.y = D.rot;
    cc.mx += ((inside ? cc.mouse.x * .5 : 0) - cc.mx) * Math.min(1, dt * 3);
    cc.my += ((inside ? cc.mouse.y * .3 : 0) - cc.my) * Math.min(1, dt * 3);
    cc.camera.position.set(cc.mx * 1.4, 6.6 + cc.my * .9, 4.2); cc.camera.lookAt(0, 0, 0);
    cc.ray.setFromCamera(cc.mouse, cc.camera);
    const hit = inside ? cc.ray.intersectObjects(D.meshes)[0] : null;
    D.hover = hit ? D.meshes.indexOf(hit.object) : -1;
    D.meshes.forEach((m, i) => {
      const u = m.userData, k = Math.min(1, Math.max(0, (cc.t - u.delay) / .8)), e = 1 - Math.pow(1 - k, 3);
      m.scale.z = Math.max(.001, e);
      const want = i === D.hover ? .16 : 0;
      u.pop += (want - u.pop) * Math.min(1, dt * 10);
      m.position.set(Math.cos(u.am) * u.pop, 0, -Math.sin(u.am) * u.pop);
      m.material.emissiveIntensity += ((i === D.hover ? .6 : .1) - m.material.emissiveIntensity) * Math.min(1, dt * 10);
    });
    if(D.hover >= 0){
      const s = D.slices[D.hover], f = formatHashrate(s.r.hashrate);
      cc.tip.style.display = 'block'; cc.tip.style.left = (cc.px + 12) + 'px'; cc.tip.style.top = Math.max(0, cc.py - 30) + 'px';
      cc.tip.textContent = `${s.dev.name} · ${f.value} ${f.unit} · ${(s.pct * 100).toFixed(1)}%`;
    } else cc.tip.style.display = 'none';
  };
}

function donut3dSet(c, slices, total, colorOf){
  const D = c.d3;
  const sig = slices.map(x => x.dev.id + ':' + Math.round(x.r.hashrate / total * 100)).join('|');
  D.slices = slices.map(x => ({ dev: x.dev, r: x.r, pct: x.r.hashrate / total }));
  if(sig === D.sig) return;                   // mesmas fatias: só os valores (dica) mudaram
  D.sig = sig;
  const ids = slices.map(x => x.dev.id).join('|'), fresh = ids !== D.ids;
  D.ids = ids;
  D.meshes.forEach(m => { c.group.remove(m); m.geometry.dispose(); m.material.dispose(); });
  D.meshes = [];
  const maxPct = Math.max(...D.slices.map(s => s.pct)), GAP = .035;
  let a = Math.PI / 2;
  D.slices.forEach((s, i) => {
    const span = s.pct * Math.PI * 2, a0 = a + GAP / 2, a1 = a + span - GAP / 2;
    a += span;
    if(a1 <= a0) return;
    const depth = .22 + .5 * (s.pct / maxPct), col = new THREE.Color(colorOf(s.dev));
    const mesh = new THREE.Mesh(donut3dSector(a0, a1, 1.0, 1.75, depth), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .1, metalness: .2, roughness: .5 }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.userData = { am: (a0 + a1) / 2, pop: 0, delay: fresh ? i * .09 : -1 };
    c.group.add(mesh); D.meshes.push(mesh);
  });
  if(fresh) c.t = 0;
}

// Devolve true se desenhou a rosca em 3D
function donut3dRender(row, slices, total, legendHtml, colorOf){
  const totalFmt = formatHashrate(total);
  let wrap = row.querySelector('.donut-3d');
  if(!wrap){
    row.innerHTML = '<div class="donut-svg-wrap donut-3d"><div id="donut3dHost" class="donut-3d-host"></div><div class="donut-center-label"><div class="val"></div><div class="unit"></div></div></div><div class="donut-legend"></div>';
    wrap = row.querySelector('.donut-3d');
  }
  wrap.querySelector('.val').textContent = totalFmt.value;
  wrap.querySelector('.unit').textContent = totalFmt.unit;
  const legend = row.querySelector('.donut-legend');
  if(legend.dataset.sig !== legendHtml){ legend.dataset.sig = legendHtml; legend.innerHTML = legendHtml; }
  const host = $('donut3dHost');
  let c = HC3D.charts.donut3dHost;
  if(c && c.host !== host){ try { c.renderer.dispose(); } catch(e) {} delete HC3D.charts.donut3dHost; c = null; }   // o contentor foi refeito
  c = hc3dEnsure('donut3dHost');
  if(!c.d3) donut3dInit(c);
  c.active = true;
  donut3dSet(c, slices, total, colorOf);
  if(!HC3D.raf) HC3D.raf = requestAnimationFrame(hc3dLoop);
  return true;
}
