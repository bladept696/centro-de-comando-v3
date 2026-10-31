// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Deteção de firmware desatualizado (Bitaxe / NerdQAxe, AxeOS) ----------
// Compara a versão de firmware de cada máquina com a última conhecida no GitHub (bitaxeorg/ESP-Miner e shufps/ESP-Miner-NerdQAxePlus,
// via /api/firmware-latest em app.py) e avisa uma vez por máquina quando há uma mais recente. A família (Bitaxe ou NerdQAxe) é
// adivinhada pelo nome do modelo que a própria máquina expõe (ex. "NerdQAxe++", "Bitaxe Gamma").
Object.assign(I18N_DICT, {
  fw_old_t: { pt: `{0}: firmware desatualizado`, en: `{0}: outdated firmware`, es: `{0}: firmware desactualizado`, fr: `{0} : firmware obsolète` },
  fw_old_d: { pt: `Tens a versão {0}, já há a {1}. Atualiza em AxeOS › Settings › Firmware Update.`, en: `You have version {0}, {1} is out. Update it in AxeOS › Settings › Firmware Update.`, es: `Tienes la versión {0}, ya está la {1}. Actualiza en AxeOS › Settings › Firmware Update.`, fr: `Vous avez la version {0}, la {1} est sortie. Mettez à jour dans AxeOS › Settings › Firmware Update.` },
  fw_row: { pt: `Firmware mais recente`, en: `Latest firmware`, es: `Firmware más reciente`, fr: `Dernier firmware` },
  fw_uptodate: { pt: `atualizado`, en: `up to date`, es: `actualizado`, fr: `à jour` },
  fw_update: { pt: `há {0} ↗`, en: `{0} available ↗`, es: `hay {0} ↗`, fr: `{0} disponible ↗` },
});

(function(){
  const EVERY = 3600e3, KEY = 'hc_fw_seen';
  // modelos conhecidos -> família do firmware (ordem importa: o mais específico primeiro)
  const FAMILIES = [
    [/nerdqaxe|nerdoctaxe|nerdaxe/i, 'nerdqaxe'],
    [/bitaxe/i, 'bitaxe'],
  ];
  const familyOf = model => { const m = String(model || ''); for(const [re, fam] of FAMILIES) if(re.test(m)) return fam; return null; };
  const cmp = (a, b) => {   // compara "1.2.3" com "1.10.0" numericamente, não como texto
    const pa = String(a || '0').replace(/^v/i, '').split(/[.\-+]/).map(n => parseInt(n, 10) || 0);
    const pb = String(b || '0').replace(/^v/i, '').split(/[.\-+]/).map(n => parseInt(n, 10) || 0);
    for(let i = 0; i < Math.max(pa.length, pb.length); i++){ const d = (pa[i] || 0) - (pb[i] || 0); if(d) return d; }
    return 0;
  };
  let seen = new Set(); try { seen = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch(e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...seen].slice(-200))); } catch(e) {} };

  let latest = null, ts = 0;
  async function getLatest(){
    if(latest && Date.now() - ts < EVERY) return latest;
    try { const r = await fetch(API_BASE + '/api/firmware-latest'); if(/json/i.test(r.headers.get('content-type') || '')){ latest = await r.json(); ts = Date.now(); } } catch(e) {}
    return latest;
  }

  function infoFor(dev){
    const r = readings[dev.id]; if(!r || !r.online) return null;
    const fam = familyOf(r.asicModel || r.deviceModel || r.model);
    const fw = r.firmware;
    if(!fam || !fw || fw === '—' || !latest || !latest[fam] || latest[fam].error) return null;
    return { fam, fw, data: latest[fam], outdated: cmp(fw, latest[fam].version) < 0 };
  }

  async function check(){
    if(typeof addNotification !== 'function' || typeof devices === 'undefined') return;
    await getLatest(); if(!latest) return;
    devices.forEach(dev => {
      const info = infoFor(dev); if(!info || !info.outdated) return;
      const key = dev.id + '|' + info.fam + '|' + info.data.version;
      if(seen.has(key)) return;
      seen.add(key); save();
      addNotification('best', '🔧 ' + t('fw_old_t').replace('{0}', dev.name), t('fw_old_d').replace('{0}', info.fw).replace('{1}', info.data.version), dev.name);
    });
  }
  setTimeout(check, 10000);
  setInterval(check, EVERY);

  // acrescenta uma linha ao detalhe da máquina (mcMoreHtml, em cartoes.js), sem tocar nesse ficheiro
  if(typeof mcMoreHtml === 'function'){
    const o = mcMoreHtml;
    window.mcMoreHtml = function(dev, r){
      let html = o.apply(this, arguments);
      const info = infoFor(dev);
      const val = !info ? '—' : info.outdated ? '<a href="' + info.data.url + '" target="_blank" rel="noopener noreferrer" class="fw-old">' + t('fw_update').replace('{0}', info.data.version) + '</a>' : t('fw_uptodate');
      html += '<div><span>' + t('fw_row') + '</span><b>' + val + '</b></div>';
      return html;
    };
  }
  window.hcFirmware = { check, infoFor, familyOf };
})();
