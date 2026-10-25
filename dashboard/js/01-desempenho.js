
try { console.log("%c© 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.\nProibida a cópia ou redistribuição sem autorização do autor.", "color:#21ffb0;font-weight:700;font-size:12px"); } catch(e){}
// --- Dicionário de traduções (PT/EN/ES/FR) ---
/* ===== Desempenho: pausa durante scroll + Modo Desempenho (auto/on/off) ===== */
let hcScrolling = false, hcScrollT = null, hcPerfMode = false;
function hcPaused(){ return hcScrolling || hcPerfMode || document.hidden; }
(function(){
  function onScroll(){
    if(!hcScrolling){ hcScrolling = true; document.documentElement.classList.add('is-scrolling'); }
    clearTimeout(hcScrollT);
    hcScrollT = setTimeout(() => { hcScrolling = false; document.documentElement.classList.remove('is-scrolling'); }, 150);
  }
  window.addEventListener('scroll', onScroll, { passive:true, capture:true });
  window.addEventListener('wheel', onScroll, { passive:true });
})();
function hcPerfPref(){ try { return localStorage.getItem('hc_perf_mode') || 'auto'; } catch(e){ return 'auto'; } }
function hcApplyPerf(on){
  hcPerfMode = !!on;
  document.body.classList.toggle('perf-mode', hcPerfMode);
  if(typeof hc3dSync === 'function') hc3dSync();
  const b = document.getElementById('perfBtn');
  if(b) b.setAttribute('aria-pressed', hcPerfMode ? 'true' : 'false');
}
function togglePerfMode(){
  const next = !hcPerfMode;
  try { localStorage.setItem('hc_perf_mode', next ? 'on' : 'off'); } catch(e){}
  hcApplyPerf(next);
}
(function hcInitPerf(){
  function init(){
    const pref = hcPerfPref();
    if(pref === 'on') hcApplyPerf(true);
    if(pref !== 'auto') return;
    setTimeout(() => {
      let frames = 0, start = 0;
      function step(ts){
        if(document.hidden) return;
        if(!start) start = ts;
        frames++;
        if(ts - start < 3000){ requestAnimationFrame(step); return; }
        const fps = frames / ((ts - start) / 1000);
        if(fps < 40 && hcPerfPref() === 'auto') hcApplyPerf(true);
      }
      requestAnimationFrame(step);
    }, 3000);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

