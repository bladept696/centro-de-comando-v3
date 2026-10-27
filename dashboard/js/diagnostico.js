// ---------- Diagnóstico de congelamentos ----------
// Quando um quadro demora mais de 0,8 s (a dashboard "congela"), regista no Log de eventos quanto tempo foi, em que
// aba estavas e que ficheiro e função gastaram o tempo (o Chrome diz-o através dos "long animation frames").
// Serve para descobrir de onde vêm os congelamentos: basta dizer-me a linha que aparecer no log.
(function(){
  if(!window.PerformanceObserver || !(PerformanceObserver.supportedEntryTypes || []).includes('long-animation-frame')) return;
  const KEY = 'hc_freeze_log', LIMIT = 800;
  let last = 0;
  const tab = () => { const a = document.querySelector('.tab-content.active'); return a ? a.id.replace('tab-', '') : '?'; };
  const short = u => String(u || '').split('/').pop().split('?')[0] || 'inline';
  const save = rec => {
    try { const l = JSON.parse(localStorage.getItem(KEY) || '[]'); l.push(rec); localStorage.setItem(KEY, JSON.stringify(l.slice(-40))); } catch(e) {}
  };
  new PerformanceObserver(list => {
    for(const e of list.getEntries()){
      if(e.duration < LIMIT) continue;
      const scripts = (e.scripts || []).slice().sort((a, b) => b.duration - a.duration);
      const top = scripts[0];
      const what = top ? short(top.sourceURL) + (top.sourceFunctionName ? ' › ' + top.sourceFunctionName : '') + (top.invoker ? ' (' + top.invoker + ')' : '') + ' ' + Math.round(top.duration) + ' ms' : 'sem script (desenho/CSS/GPU) — ' + Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0) + ' ms a desenhar';
      const rec = { t: Date.now(), ms: Math.round(e.duration), tab: tab(), what };
      save(rec);
      console.warn('[congelou]', rec);
      if(Date.now() - last > 15000 && typeof logEvent === 'function'){
        last = Date.now();
        try { logEvent('Congelou ' + (rec.ms / 1000).toFixed(1) + ' s (aba ' + rec.tab + '): ' + rec.what, 'error', 'diagnóstico'); } catch(x) {}
      }
    }
  }).observe({ type: 'long-animation-frame', buffered: false });
  window.hcFreezes = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch(e) { return []; } };
})();
