// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Varrimento automático (OC): testa várias frequências e acha o ponto mais eficiente ----------
// Acrescenta um botão a cada cartão da aba "OC" (envolve renderOcTab, em 13-parasite-conversor.js, sem o editar).
// Para cada máquina: testa uma lista de frequências à volta da atual (a voltagem fica como está, só a frequência muda),
// aguarda estabilizar, mede hashrate/potência/temperatura durante uma janela e calcula a eficiência (J/TH) de cada ponto.
// Pára e repõe a frequência original se a temperatura do chip passar do limite em qualquer amostra. No fim mostra uma
// tabela com os resultados e um botão para aplicar o ponto mais eficiente (entre os que não tiveram problemas).
Object.assign(I18N_DICT, {
  sw_btn: { pt: `🎚️ Varrimento automático`, en: `🎚️ Automatic sweep`, es: `🎚️ Barrido automático`, fr: `🎚️ Balayage automatique` },
  sw_stop: { pt: `⏹ Parar`, en: `⏹ Stop`, es: `⏹ Detener`, fr: `⏹ Arrêter` },
  sw_title: { pt: `Varrimento de frequência`, en: `Frequency sweep`, es: `Barrido de frecuencia`, fr: `Balayage de fréquence` },
  sw_hint: { pt: `Testa cada frequência abaixo por uns minutos e mede o hashrate, a potência e a temperatura, para achar o ponto mais eficiente (menos J/TH). A voltagem não muda. Pára sozinho e repõe o valor atual se a temperatura passar do limite.`, en: `Tests each frequency below for a few minutes and measures hashrate, power and temperature, to find the most efficient point (lowest J/TH). Voltage is not changed. Stops by itself and restores the current value if temperature passes the limit.`, es: `Prueba cada frecuencia de abajo durante unos minutos y mide el hashrate, la potencia y la temperatura, para hallar el punto más eficiente (menor J/TH). El voltaje no cambia. Se detiene solo y restaura el valor actual si la temperatura supera el límite.`, fr: `Teste chaque fréquence ci-dessous pendant quelques minutes et mesure le hashrate, la puissance et la température, pour trouver le point le plus efficace (J/TH le plus bas). La tension ne change pas. S’arrête de lui-même et restaure la valeur actuelle si la température dépasse la limite.` },
  sw_offsets: { pt: `Deltas de frequência (MHz)`, en: `Frequency deltas (MHz)`, es: `Deltas de frecuencia (MHz)`, fr: `Écarts de fréquence (MHz)` },
  sw_maxtemp: { pt: `Temperatura máx. do chip (°C)`, en: `Max. chip temperature (°C)`, es: `Temperatura máx. del chip (°C)`, fr: `Température max. du chip (°C)` },
  sw_start: { pt: `▶ Iniciar`, en: `▶ Start`, es: `▶ Iniciar`, fr: `▶ Démarrer` },
  sw_close: { pt: `Fechar`, en: `Close`, es: `Cerrar`, fr: `Fermer` },
  sw_need_base: { pt: `Precisa de uma leitura da frequência atual (a máquina tem de estar online).`, en: `Needs a reading of the current frequency (the machine must be online).`, es: `Necesita una lectura de la frecuencia actual (la máquina debe estar en línea).`, fr: `Nécessite une lecture de la fréquence actuelle (la machine doit être en ligne).` },
  sw_testing: { pt: `A testar {0} MHz…`, en: `Testing {0} MHz…`, es: `Probando {0} MHz…`, fr: `Test de {0} MHz…` },
  sw_warmup: { pt: `a estabilizar`, en: `settling`, es: `estabilizando`, fr: `stabilisation` },
  sw_measuring: { pt: `a medir`, en: `measuring`, es: `midiendo`, fr: `mesure` },
  sw_abort_temp: { pt: `⚠ Parado: {0} °C em {1} MHz passou do limite. Frequência original reposta.`, en: `⚠ Stopped: {0} °C at {1} MHz went past the limit. Original frequency restored.`, es: `⚠ Detenido: {0} °C a {1} MHz superó el límite. Frecuencia original restaurada.`, fr: `⚠ Arrêté : {0} °C à {1} MHz a dépassé la limite. Fréquence d’origine restaurée.` },
  sw_cancelled: { pt: `Cancelado. Frequência original reposta.`, en: `Cancelled. Original frequency restored.`, es: `Cancelado. Frecuencia original restaurada.`, fr: `Annulé. Fréquence d’origine restaurée.` },
  sw_offline: { pt: `A máquina ficou offline durante o teste. Parado.`, en: `The machine went offline during the test. Stopped.`, es: `La máquina se quedó sin conexión durante la prueba. Detenido.`, fr: `La machine s’est déconnectée pendant le test. Arrêté.` },
  sw_done: { pt: `Concluído. Frequência original reposta — aplica o melhor ponto se quiseres ficar com ele.`, en: `Done. Original frequency restored — apply the best point if you want to keep it.`, es: `Completado. Frecuencia original restaurada — aplica el mejor punto si quieres quedarte con él.`, fr: `Terminé. Fréquence d’origine restaurée — appliquez le meilleur point si vous voulez le garder.` },
  sw_col_freq: { pt: `Freq.`, en: `Freq.`, es: `Frec.`, fr: `Fréq.` },
  sw_col_hr: { pt: `Hashrate`, en: `Hashrate`, es: `Hashrate`, fr: `Hashrate` },
  sw_col_pw: { pt: `Potência`, en: `Power`, es: `Potencia`, fr: `Puissance` },
  sw_col_temp: { pt: `Temp. máx.`, en: `Max temp.`, es: `Temp. máx.`, fr: `Temp. max.` },
  sw_col_eff: { pt: `Eficiência`, en: `Efficiency`, es: `Eficiencia`, fr: `Efficacité` },
  sw_col_rej: { pt: `Rejeitadas`, en: `Rejected`, es: `Rechazadas`, fr: `Rejetées` },
  sw_unstable: { pt: `instável`, en: `unstable`, es: `inestable`, fr: `instable` },
  sw_apply: { pt: `Aplicar este ponto`, en: `Apply this point`, es: `Aplicar este punto`, fr: `Appliquer ce point` },
  sw_applied: { pt: `✓ Aplicado.`, en: `✓ Applied.`, es: `✓ Aplicado.`, fr: `✓ Appliqué.` },
  sw_best: { pt: `★ melhor`, en: `★ best`, es: `★ mejor`, fr: `★ meilleur` },
});

(function(){
  // tempos ajustáveis só para diagnóstico/teste (window.hcSweepTuning); por omissão, valores reais de minutos
  const CFG = Object.assign({ warmupMs: 45000, sampleEveryMs: 5000, samples: 8, pauseBetweenMs: 2000 }, window.hcSweepTuning || {});
  const DEFAULT_OFFSETS = [-40, -20, 0, 20, 40];
  const DEFAULT_MAXTEMP = 68;
  const running = {};   // devId -> { cancel: bool }

  function fmtHash(v){ try { const f = formatHashrate(v); return f.value + ' ' + f.unit; } catch(e) { return String(Math.round(v || 0)); } }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function applyFreq(dev, freq){
    const resp = await fetch(API_BASE + '/api/apply-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip: dev.ip, frequency: freq }) });
    const data = await resp.json().catch(() => ({}));
    if(!resp.ok || data.error) throw new Error(data.error || 'falha');
  }

  // mede um ponto: aplica a frequência, aguarda estabilizar e depois recolhe amostras do objeto `readings` (atualizado sozinho a cada ~5s pelo poll do painel)
  async function measurePoint(dev, freq, state, onProgress){
    await applyFreq(dev, freq);
    const warmSteps = Math.ceil(CFG.warmupMs / 1000);
    for(let i = 0; i < warmSteps; i++){
      if(state.cancel) return null;
      onProgress(t('sw_warmup'), i, warmSteps);
      await sleep(1000);
      const r = readings[dev.id];
      if(r && r.temp > state.maxTemp) return { abort: true, temp: r.temp, freq };
      if(!r || !r.online) return { offline: true };
    }
    const hrs = [], pws = [], temps = []; let acc0 = null, rej0 = null, acc1 = 0, rej1 = 0;
    for(let i = 0; i < CFG.samples; i++){
      if(state.cancel) return null;
      onProgress(t('sw_measuring'), i, CFG.samples);
      const r = readings[dev.id];
      if(!r || !r.online) return { offline: true };
      if(r.temp > state.maxTemp) return { abort: true, temp: r.temp, freq };
      hrs.push(Number(r.hashrate) || 0); pws.push(Number(r.power) || 0); temps.push(Number(r.temp) || 0);
      if(acc0 == null){ acc0 = r.accepted || 0; rej0 = r.rejected || 0; } acc1 = r.accepted || 0; rej1 = r.rejected || 0;
      await sleep(CFG.sampleEveryMs);
    }
    const avg = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    const hr = avg(hrs), pw = avg(pws), maxT = Math.max(...temps);
    const effi = hr > 0 ? pw / (hr / 1000) : null;   // J/TH, igual à fórmula usada no resto do painel
    const dAcc = Math.max(0, acc1 - acc0), dRej = Math.max(0, rej1 - rej0), total = dAcc + dRej;
    const rejRate = total > 2 ? dRej / total : 0;
    return { freq, hr, pw, maxT, eff: effi, rejRate, unstable: rejRate > 0.05 };
  }

  function resultsHtml(dev, baseFreq, points, state){
    const ok = points.filter(p => p && !p.abort && !p.offline && p.eff != null && !p.unstable);
    const best = ok.length ? ok.reduce((a, b) => b.eff < a.eff ? b : a) : null;
    const rows = points.map(p => {
      if(!p) return '';
      if(p.abort) return '<tr class="sw-bad"><td>' + p.freq + ' MHz</td><td colspan="4">' + esc(t('sw_abort_temp').replace('{0}', p.temp.toFixed(0)).replace('{1}', p.freq)) + '</td></tr>';
      if(p.offline) return '<tr class="sw-bad"><td>' + p.freq + ' MHz</td><td colspan="4">' + esc(t('sw_offline')) + '</td></tr>';
      const isBest = best && p === best;
      return '<tr class="' + (isBest ? 'sw-best' : p.unstable ? 'sw-bad' : '') + '">' +
        '<td>' + p.freq + ' MHz' + (p.freq === baseFreq ? ' •' : '') + '</td><td>' + fmtHash(p.hr) + '</td><td>' + p.pw.toFixed(1) + ' W</td>' +
        '<td>' + p.maxT.toFixed(0) + ' °C</td><td>' + (p.eff != null ? p.eff.toFixed(2) + ' J/TH' : '—') + (isBest ? ' <b class="sw-best-tag">' + esc(t('sw_best')) + '</b>' : '') + (p.unstable ? ' <small>(' + esc(t('sw_unstable')) + ')</small>' : '') + '</td>' +
        '<td>' + (p.eff != null ? '<button type="button" class="oc-btn-save sw-apply-btn" data-freq="' + p.freq + '">' + esc(t('sw_apply')) + '</button>' : '') + '</td></tr>';
    }).join('');
    return '<table class="sw-table"><thead><tr><th>' + esc(t('sw_col_freq')) + '</th><th>' + esc(t('sw_col_hr')) + '</th><th>' + esc(t('sw_col_pw')) + '</th><th>' + esc(t('sw_col_temp')) + '</th><th>' + esc(t('sw_col_eff')) + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function panelFor(card, dev){
    let panel = card.querySelector('.sw-panel');
    if(panel) return panel;
    panel = document.createElement('div');
    panel.className = 'sw-panel';
    card.appendChild(panel);
    return panel;
  }

  function wireButton(card, dev){
    if(card.querySelector('.sw-open-btn')) return;
    const actions = card.querySelector('.oc-card-actions'); if(!actions) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'oc-btn-save sw-open-btn'; btn.textContent = t('sw_btn');
    actions.appendChild(btn);
    btn.onclick = () => openForm(card, dev);
  }

  function openForm(card, dev){
    const panel = panelFor(card, dev);
    if(panel.classList.contains('open') && panel.dataset.mode === 'form'){ panel.classList.remove('open'); return; }
    const r = readings[dev.id];
    if(!r || !r.online || !r.frequency){ panel.dataset.mode = 'form'; panel.classList.add('open'); panel.innerHTML = '<div class="sw-err">' + esc(t('sw_need_base')) + '</div>'; return; }
    panel.dataset.mode = 'form'; panel.classList.add('open');
    panel.innerHTML =
      '<div class="sw-head">' + esc(t('sw_title')) + '</div><div class="sw-hint">' + esc(t('sw_hint')) + '</div>' +
      '<div class="sw-field-row"><div class="sw-field"><label>' + esc(t('sw_offsets')) + '</label><input type="text" class="sw-offsets-input" value="' + DEFAULT_OFFSETS.join(', ') + '"></div>' +
      '<div class="sw-field"><label>' + esc(t('sw_maxtemp')) + '</label><input type="number" class="sw-maxtemp-input" value="' + DEFAULT_MAXTEMP + '"></div></div>' +
      '<div class="sw-actions"><button type="button" class="oc-btn-save sw-start-btn">' + esc(t('sw_start')) + '</button>' +
      '<button type="button" class="oc-btn-restart sw-close-btn">' + esc(t('sw_close')) + '</button></div>';
    panel.querySelector('.sw-close-btn').onclick = () => panel.classList.remove('open');
    panel.querySelector('.sw-start-btn').onclick = () => startSweep(card, dev, panel);
  }

  async function startSweep(card, dev, panel){
    const r0 = readings[dev.id];
    if(!r0 || !r0.online || !r0.frequency) return;
    const baseFreq = Number(r0.frequency);
    const offsets = (panel.querySelector('.sw-offsets-input').value || '').split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    const maxTemp = Number(panel.querySelector('.sw-maxtemp-input').value) || DEFAULT_MAXTEMP;
    if(!offsets.length){ offsets.push(0); }
    const freqs = [...new Set(offsets.map(o => baseFreq + o).filter(f => f > 0))].sort((a, b) => a - b);

    const state = { cancel: false, maxTemp };
    running[dev.id] = state;
    card.classList.add('sw-running');
    const saveBtn = card.querySelector('.oc-btn-save:not(.sw-open-btn)'), restartBtn = card.querySelector('.oc-btn-restart'), openBtn = card.querySelector('.sw-open-btn');
    [saveBtn, restartBtn, openBtn].forEach(b => { if(b) b.disabled = true; });

    panel.dataset.mode = 'running';
    panel.innerHTML = '<div class="sw-head">' + esc(t('sw_title')) + '</div><div class="sw-progress"></div><div class="sw-actions"><button type="button" class="oc-btn-restart sw-stop-btn">' + esc(t('sw_stop')) + '</button></div>';
    const progEl = panel.querySelector('.sw-progress');
    panel.querySelector('.sw-stop-btn').onclick = () => { state.cancel = true; };

    const onProgress = (phase, i, total, freq) => {
      progEl.textContent = t('sw_testing').replace('{0}', freq != null ? freq : '…') + ' ' + phase + ' (' + (i + 1) + '/' + total + ')';
    };

    const points = [];
    let stoppedReason = null;
    for(const freq of freqs){
      if(state.cancel){ stoppedReason = 'cancel'; break; }
      const res = await measurePoint(dev, freq, state, (phase, i, total) => onProgress(phase, i, total, freq));
      if(state.cancel){ stoppedReason = 'cancel'; break; }
      if(res == null) break;
      if(res.offline){ stoppedReason = 'offline'; points.push(res); break; }
      if(res.abort){ stoppedReason = 'abort'; points.push(res); break; }
      points.push(res);
      await sleep(CFG.pauseBetweenMs);
    }

    // repõe sempre a frequência original no fim (sucesso, cancelamento ou aborto)
    try { await applyFreq(dev, baseFreq); } catch(e) {}
    delete running[dev.id];
    card.classList.remove('sw-running');
    [saveBtn, restartBtn, openBtn].forEach(b => { if(b) b.disabled = false; });

    const msg = stoppedReason === 'cancel' ? t('sw_cancelled') : stoppedReason === 'offline' ? t('sw_offline') : stoppedReason === 'abort' ? '' : t('sw_done');
    panel.dataset.mode = 'results';
    panel.innerHTML = '<div class="sw-head">' + esc(t('sw_title')) + '</div>' + (msg ? '<div class="sw-msg">' + esc(msg) + '</div>' : '') +
      resultsHtml(dev, baseFreq, points, state) +
      '<div class="sw-actions"><button type="button" class="oc-btn-restart sw-close-btn">' + esc(t('sw_close')) + '</button></div>';
    panel.querySelector('.sw-close-btn').onclick = () => panel.classList.remove('open');
    panel.querySelectorAll('.sw-apply-btn').forEach(b => {
      b.onclick = async () => {
        b.disabled = true; b.textContent = '…';
        try { await applyFreq(dev, Number(b.dataset.freq)); b.textContent = t('sw_applied'); logEvent('Varrimento: aplicada a frequência ' + b.dataset.freq + ' MHz.', 'edit', dev.name, dev.id); }
        catch(e) { b.textContent = '✕'; }
      };
    });
    logEvent('Varrimento automático concluído em "' + dev.name + '".', stoppedReason === 'abort' ? 'error' : 'new', dev.name, dev.id);
  }

  // envolve renderOcTab (definida em 13-parasite-conversor.js) para acrescentar o botão a cada cartão já construído
  if(typeof renderOcTab === 'function'){
    const o = renderOcTab;
    window.renderOcTab = function(){
      const ret = o.apply(this, arguments);
      try {
        // a ordem dos cartões segue a de devices.forEach em renderOcTab: casar pelo índice evita confundir máquinas com o mesmo nome
        document.querySelectorAll('#ocGrid .oc-card').forEach((card, i) => {
          const dev = devices[i]; if(!dev) return;
          if(running[dev.id]) return;   // não reconstrói o cartão a meio de um varrimento
          wireButton(card, dev);
        });
      } catch(e) {}
      return ret;
    };
  }
  window.hcSweep = { running: () => Object.keys(running) };
})();
