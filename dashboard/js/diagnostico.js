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
      // quanto foi código e quanto foi o navegador a calcular estilos e posições (ou a desenhar)
      const js = Math.round(scripts.reduce((a, x) => a + x.duration, 0));
      const lay = e.styleAndLayoutStart ? Math.max(0, Math.round(e.startTime + e.duration - e.styleAndLayoutStart)) : 0;
      const pre = e.renderStart ? Math.round(e.renderStart - e.startTime) : -1, post = e.renderStart ? Math.round(e.startTime + e.duration - e.renderStart) : -1;   // tempo até começar a desenhar, e tempo a desenhar/apresentar
      const renderBound = js < e.duration * .25;
      const rec = { t: Date.now(), ms: Math.round(e.duration), tab: tab(), what: what + ' · código ' + js + ' ms · estilo/layout ' + lay + ' ms · antes do desenho ' + pre + ' ms · desenho/GPU ' + post + ' ms' };
      // congelou sobretudo no desenho/CSS (não no código): liga o Modo Desempenho, que desliga canvas e efeitos pesados
      if(renderBound && e.duration >= 2000 && typeof hcApplyPerf === 'function' && typeof hcPerfMode !== 'undefined' && !hcPerfMode && (typeof hcPerfPref !== 'function' || hcPerfPref() === 'auto')){
        try { localStorage.setItem('hc_perf_mode', 'on'); } catch(x) {}
        hcApplyPerf(true);
        rec.what += ' → Modo Desempenho ligado (botão Desempenho para desligar)';
      }
      // se um temporizador lento acabou de ser apanhado, junta o texto da função e onde foi agendada (o LoAF só diz o nosso ficheiro de apoio)
      const lt = window.__lastSlowTimer;
      if(lt && Date.now() - lt.t < 8000) rec.what += ' · FUNÇÃO: ' + lt.text;
      save(rec);
      console.warn('[congelou]', rec);
      if(Date.now() - last > 15000 && typeof logEvent === 'function'){
        last = Date.now();
        try { logEvent('Congelou ' + (rec.ms / 1000).toFixed(1) + ' s (aba ' + rec.tab + '): ' + rec.what, 'error', 'diagnóstico'); } catch(x) {}
      }
    }
  }).observe({ type: 'long-animation-frame', buffered: false });
  // Relógio de controlo: se este temporizador de 0,5 s se atrasa mais de 1,8 s, a página esteve parada (mesmo sem código nosso a correr).
  // Anota a memória usada (uma queda grande entre dois pontos indica uma limpeza de memória do navegador) e se a janela estava em foco.
  const heap = () => { try { return performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null; } catch(e) { return null; } };
  let tick = performance.now(), h0 = heap(), hiddenAt = 0, lastLag = 0;
  document.addEventListener('visibilitychange', () => { hiddenAt = performance.now(); });
  setInterval(() => {
    const now = performance.now(), gap = now - tick, h1 = heap();
    if(gap > 1800 && !document.hidden && now - hiddenAt > gap + 500 && Date.now() - lastLag > 15000){
      lastLag = Date.now();
      const rec = { t: Date.now(), ms: Math.round(gap), tab: tab(), what: 'página parada ' + (gap / 1000).toFixed(1) + ' s' + (h0 != null ? ' · memória ' + h0 + '→' + h1 + ' MB' : '') + ' · janela ' + (document.hasFocus() ? 'em foco' : 'sem foco') };
      save(rec); console.warn('[parou]', rec);
      if(typeof logEvent === 'function') try { logEvent('Página parada ' + (gap / 1000).toFixed(1) + ' s (aba ' + rec.tab + ')' + (h0 != null ? ' · memória ' + h0 + '→' + h1 + ' MB' : '') + ' · ' + (document.hasFocus() ? 'janela em foco' : 'janela sem foco'), 'error', 'diagnóstico'); } catch(x) {}
    }
    tick = now; h0 = h1;
  }, 500);
  // Relatório de memória: o JavaScript usa pouco (dezenas de MB), por isso os centenas de MB do separador são elementos da página, imagens ou canvas.
  // Conta elementos, lista os contentores com mais filhos e soma os canvas; avisa no log se houver sinais de acumulação.
  window.hcMem = () => {
    const all = document.getElementsByTagName('*'), big = [];
    for(const el of all) if(el.childElementCount > 200) big.push([(el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]), el.childElementCount]);
    big.sort((a, b) => b[1] - a[1]);
    const cv = [...document.querySelectorAll('canvas')].reduce((a, c) => a + c.width * c.height * 4, 0);
    const imgs = [...document.images].reduce((a, i) => a + (i.naturalWidth || 0) * (i.naturalHeight || 0) * 4, 0);
    let ls = 0; try { for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); ls += k.length + (localStorage.getItem(k) || '').length; } } catch(e) {}
    return { elementos: all.length, maioresContentores: big.slice(0, 6), canvasMB: Math.round(cv / 1048576), imagensMB: Math.round(imgs / 1048576), jsHeapMB: heap(), localStorageKB: Math.round(ls / 1024), linhasConsola: (document.getElementById('consoleScreen') || {}).childElementCount };
  };
  let lastMemNote = 0;
  setInterval(() => {
    const n = document.getElementsByTagName('*').length;
    if(n > 12000 && Date.now() - lastMemNote > 600000){
      lastMemNote = Date.now();
      const r = window.hcMem(), top = r.maioresContentores.slice(0, 3).map(x => x[0] + ' (' + x[1] + ')').join(', ');
      try { logEvent('A página tem ' + n + ' elementos (normal: cerca de 3000). Maiores: ' + top, 'error', 'diagnóstico'); } catch(e) {}
    }
  }, 30000);
  // Para descobrir o que pesa no desenho: desliga uma família de efeitos de cada vez (só nesta sessão) e vê-se a CPU no gestor de tarefas.
  // hcCorta('animacoes') liga/desliga; hcCorta() lista o que está desligado; hcCorta('nada') volta a pôr tudo.
  const CORTES = {
    animacoes: '*,*::before,*::after{animation:none!important;transition:none!important}',
    filtros: '*,*::before,*::after{filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
    sombras: '*,*::before,*::after{box-shadow:none!important;text-shadow:none!important}',
    canvas: 'canvas{display:none!important}',
    '3d': '*{transform-style:flat!important;perspective:none!important;will-change:auto!important}',
    fundos: 'body::before,body::after,.wave-bg-canvas,#bodyMatrixCanvas,#hcBannerCanvas,#footerMatrixCanvas{display:none!important}',
  };
  const ativos = {};
  window.hcCorta = name => {
    if(name === 'nada'){ Object.keys(ativos).forEach(k => { ativos[k].remove(); delete ativos[k]; }); return 'tudo reposto'; }
    if(name){
      if(!CORTES[name]) return 'opções: ' + Object.keys(CORTES).join(', ') + ', nada';
      if(ativos[name]){ ativos[name].remove(); delete ativos[name]; return name + ': reposto'; }
      const st = document.createElement('style'); st.textContent = CORTES[name]; document.head.appendChild(st); ativos[name] = st; return name + ': desligado';
    }
    return { desligados: Object.keys(ativos), opcoes: Object.keys(CORTES) };
  };
  // hcTeste(): corre sozinho os cortes um a seguir ao outro (cumulativos), 20 s cada, com uma faixa no ecrã a dizer em que passo está.
  // Basta ter o gestor de tarefas do navegador aberto ao lado e anotar a CPU em cada passo (ou tirar uma captura por passo).
  window.hcTeste = (segundos = 20) => {
    const passos = [['tudo ligado (como está)', null], ['canvas desligados', 'canvas'], ['+ animações CSS desligadas', 'animacoes'], ['+ filtros e desfocados desligados', 'filtros'], ['+ sombras desligadas', 'sombras'], ['+ 3D desligado', '3d'], ['+ fundos desligados', 'fundos']];
    window.hcCorta('nada');
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:2147483647;background:#000d;color:#ffd76a;font:700 15px monospace;padding:8px 16px;border:2px solid #ffd76a;border-radius:10px;pointer-events:none';
    document.body.appendChild(bar);
    const titulo = document.title;
    let i = 0, t0 = Date.now();
    const show = () => {
      const [nome] = passos[i], resta = Math.max(0, segundos - Math.floor((Date.now() - t0) / 1000));
      bar.textContent = 'TESTE ' + (i + 1) + '/' + passos.length + ' · ' + nome + ' · ' + resta + ' s';
      document.title = 'TESTE ' + (i + 1) + '/' + passos.length;
    };
    show();
    const iv = setInterval(() => {
      if(Date.now() - t0 >= segundos * 1000){
        i++; t0 = Date.now();
        if(i >= passos.length){ clearInterval(iv); window.hcCorta('nada'); bar.remove(); document.title = titulo; return; }
        window.hcCorta(passos[i][1]);
      }
      show();
    }, 500);
    return 'teste a correr: ' + passos.length * segundos + ' s';
  };
  window.hcFreezes = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch(e) { return []; } };
})();
