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
  // Aberto de fora do PC (telemóvel via Tailscale) não há consola à mão: os erros do arranque aparecem numa faixa no fundo do ecrã (toca para a fechar)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const dbgLines = [];
  window.hcRemoteDbg = function(text){
    if(local) return;
    dbgLines.push(new Date().toLocaleTimeString() + ' ' + String(text).slice(0, 220));
    if(dbgLines.length > 8) dbgLines.shift();
    const put = () => {
      let d = document.getElementById('hcDbg');
      if(!d){
        d = document.createElement('div'); d.id = 'hcDbg';
        d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;max-height:38vh;overflow:auto;background:#3a0b0bee;color:#ffd9d9;font:11px/1.35 monospace;padding:6px 8px;white-space:pre-wrap;word-break:break-word';
        d.addEventListener('click', () => { d.remove(); });
        document.body.appendChild(d);
      }
      d.textContent = dbgLines.join('\n');
    };
    if(document.body) put(); else document.addEventListener('DOMContentLoaded', put);
  };
  // um script que não chegou (ligação móvel instável) deixa o painel a meio: avisa e recarrega uma vez, sozinho
  window.addEventListener('error', e => {
    const t = e.target;
    if(!t || t === window || !(t.tagName === 'SCRIPT' || t.tagName === 'LINK')) return;
    window.hcRemoteDbg('Falhou a carregar ' + String(t.src || t.href || '').split('/').pop());
    if(local) return;
    try {
      if(!sessionStorage.getItem('hc_retry_load')){ sessionStorage.setItem('hc_retry_load', '1'); setTimeout(() => location.reload(), 1200); }
    } catch(x) {}
  }, true);
  window.addEventListener('load', () => { setTimeout(() => { try { sessionStorage.removeItem('hc_retry_load'); } catch(x) {} }, 20000); });
  window.addEventListener('error', e => { window.hcRemoteDbg('ERRO ' + (e.message || '') + ' @' + String(e.filename || '').split('/').pop() + ':' + (e.lineno || '')); });
  window.addEventListener('unhandledrejection', e => { window.hcRemoteDbg('PROMESSA ' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason)); });
  window.hcSlowTimers = () => { try { return JSON.parse(localStorage.getItem('hc_slow_timers') || '[]'); } catch(e) { return []; } };
})();
