// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
/* ===== Fundo que reage ao hashrate e às shares grandes =====
   - Brilho quente nas bordas do ecrã quando o hashrate total está acima da média da última hora
     (começa a aparecer a +1% e fica no máximo a +8%).
   - Onda dourada e aviso no topo quando aparece um recorde de share acima de 100M. */
(function(){
  const BIG_SHARE = 1e8;
  const hist = [];          // hashrate total, uma amostra a cada 15 s (1 h = 240)
  let mood = null, wave = null;

  function layers(){
    if(!mood){ mood = document.createElement('div'); mood.id = 'hcMood'; document.body.appendChild(mood); }
    if(!wave){ wave = document.createElement('div'); wave.id = 'hcWave'; document.body.appendChild(wave); }
  }

  function totalHash(){
    let s = 0;
    (devices || []).forEach(d => { const r = readings[d.id]; if(r && r.online !== false) s += Number(r.hashrate) || 0; });
    return s;
  }

  function tick(){
    layers();
    const t = totalHash();
    if(t > 0){ hist.push(t); if(hist.length > 240) hist.shift(); }
    let m = 0;
    if(hist.length >= 20){
      const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
      m = Math.max(0, Math.min(1, (t / avg - 1.01) / .07));
    }
    mood.style.setProperty('--mood', m.toFixed(3));
  }

  function bigShare(dev, value){
    if(typeof hcPerfMode !== 'undefined' && hcPerfMode) return;
    layers();
    wave.textContent = '';
    const f = formatDiff(value);
    ['ring', 'ring r2', 'flash'].forEach(c => { const e = document.createElement('div'); e.className = c; wave.appendChild(e); });
    const chip = document.createElement('div'); chip.className = 'chip';
    chip.textContent = `⚡ ${f.value}${f.unit} · ${dev && dev.name ? dev.name : ''}`;
    wave.appendChild(chip);
    clearTimeout(bigShare.t);
    bigShare.t = setTimeout(() => { wave.textContent = ''; }, 7500);
  }
  window.hcBigShareWave = bigShare;

  // O recorde de share da sessão chega por recordBestDiffEvent (04-widgets-shares.js)
  const orig = window.recordBestDiffEvent;
  if(typeof orig === 'function'){
    window.recordBestDiffEvent = function(dev, currentBest, ts){
      const r = orig.apply(this, arguments);
      try { if(Number(currentBest) >= BIG_SHARE) bigShare(dev, Number(currentBest)); } catch(_){}
      return r;
    };
  }

  setTimeout(tick, 3000);
  setInterval(tick, 15000);
})();
