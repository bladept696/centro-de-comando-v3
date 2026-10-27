// ---------- Diagnóstico: que temporizador demorou ----------
// O diagnóstico de congelamentos disse "inline (TimerHandler:setTimeout) 2768 ms": um temporizador a correr 2,7 s sem
// ficheiro associado. Este ficheiro carrega primeiro de todos e embrulha setTimeout, setInterval e requestAnimationFrame:
// quando uma função demora mais de 0,6 s, escreve no Log de eventos o texto dela e onde foi agendada (ficheiro e linha).
(function(){
  if(window.__hcTimerDiag) return;
  window.__hcTimerDiag = true;
  const LIMIT = 600;
  let lastNote = 0;
  const here = () => { try { return (new Error().stack || '').split('\n').slice(3, 6).map(l => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '')).join(' ‹ '); } catch(e) { return ''; } };
  function note(kind, fn, ms, where){
    const src = (fn.name ? fn.name + ' ' : '') + String(fn).replace(/\s+/g, ' ').slice(0, 140);
    const rec = { t: Date.now(), ms: Math.round(ms), kind, src, where };
    try { const l = JSON.parse(localStorage.getItem('hc_slow_timers') || '[]'); l.push(rec); localStorage.setItem('hc_slow_timers', JSON.stringify(l.slice(-30))); } catch(e) {}
    console.warn('[temporizador lento]', rec);
    window.__lastSlowTimer = { t: Date.now(), text: src + (where ? ' · agendado em ' + where : '') };
    if(Date.now() - lastNote < 10000 || typeof logEvent !== 'function') return;
    lastNote = Date.now();
    try { logEvent('Temporizador lento (' + kind + ') ' + (ms / 1000).toFixed(1) + ' s: ' + src + (where ? ' · agendado em ' + where : ''), 'error', 'diagnóstico'); } catch(e) {}
  }
  function wrap(kind, fn, where){
    if(typeof fn !== 'function') return fn;
    const w = function(){
      const s = performance.now();
      try { return fn.apply(this, arguments); }
      finally { const d = performance.now() - s; if(d > LIMIT) note(kind, fn, d, where); }
    };
    try { Object.defineProperty(w, 'name', { value: fn.name || 'anonima' }); } catch(e) {}
    return w;
  }
  const st = window.setTimeout, si = window.setInterval, raf = window.requestAnimationFrame;
  window.setTimeout = function(f, t, ...r){ return st.call(this, wrap('setTimeout', f, here()), t, ...r); };
  window.setInterval = function(f, t, ...r){ return si.call(this, wrap('setInterval', f, here()), t, ...r); };
  window.requestAnimationFrame = function(f){ return raf.call(this, wrap('animationFrame', f, '')); };
  window.hcSlowTimers = () => { try { return JSON.parse(localStorage.getItem('hc_slow_timers') || '[]'); } catch(e) { return []; } };
})();
