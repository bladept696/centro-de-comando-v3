// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
// ---------- Placas de Hash para máquinas AxeOS (Bitaxe, NerdQAxe…) ----------
// renderBoards (06-refrigeracao-placas.js) só mostra placas de máquinas LuxOS/Antminer. Estas máquinas têm uma só placa:
// aqui cada uma aparece como uma placa em 3D com os chips ASIC desenhados (cor pela temperatura de cada chip quando a
// máquina a envia; senão pela temperatura geral), e os dados da placa: frequência, tensão, regulador, ventoinha, erros.
Object.assign(I18N_DICT, {
  pa_title: { pt: `As tuas placas (AxeOS)`, en: `Your boards (AxeOS)`, es: `Tus placas (AxeOS)`, fr: `Vos cartes (AxeOS)` },
  pa_chips: { pt: `chips`, en: `chips`, es: `chips`, fr: `puces` },
  pa_perchip: { pt: `por chip`, en: `per chip`, es: `por chip`, fr: `par puce` },
  pa_freq: { pt: `Frequência`, en: `Frequency`, es: `Frecuencia`, fr: `Fréquence` },
  pa_volt: { pt: `Tensão do núcleo`, en: `Core voltage`, es: `Voltaje del núcleo`, fr: `Tension du cœur` },
  pa_vr: { pt: `Regulador (VR)`, en: `Regulator (VR)`, es: `Regulador (VR)`, fr: `Régulateur (VR)` },
  pa_temp: { pt: `Temp. chip`, en: `Chip temp.`, es: `Temp. chip`, fr: `Temp. puce` },
  pa_fan: { pt: `Ventoinha`, en: `Fan`, es: `Ventilador`, fr: `Ventilateur` },
  pa_err: { pt: `Nonces duplicados`, en: `Duplicate nonces`, es: `Nonces duplicados`, fr: `Nonces en double` },
  pa_eff: { pt: `Eficiência`, en: `Efficiency`, es: `Eficiencia`, fr: `Efficacité` },
  pa_off: { pt: `offline`, en: `offline`, es: `sin conexión`, fr: `hors ligne` },
  pa_ok: { pt: `Tudo normal`, en: `All normal`, es: `Todo normal`, fr: `Tout est normal` },
  pa_hot: { pt: `Chip quente`, en: `Hot chip`, es: `Chip caliente`, fr: `Puce chaude` },
  pa_warm: { pt: `Morno`, en: `Warm`, es: `Templado`, fr: `Tiède` },
  pa_none: { pt: `Sem máquinas AxeOS online.`, en: `No AxeOS machines online.`, es: `Sin máquinas AxeOS en línea.`, fr: `Aucune machine AxeOS en ligne.` },
  pa_cores: { pt: `{0} núcleos pequenos`, en: `{0} small cores`, es: `{0} núcleos pequeños`, fr: `{0} petits cœurs` },
});

(function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n = (v, d = 1) => v == null || !isFinite(v) ? '—' : Number(v).toFixed(d);
  // cor pela temperatura: azul frio → verde → laranja → vermelho
  const heat = t => !isFinite(t) || t <= 0 ? '#3a4a5c' : t < 50 ? '#4fd6ff' : t < 60 ? '#21ffb0' : t < 66 ? '#ffd23f' : t < 72 ? '#ff9a1a' : '#ff4d5d';
  const fh = gh => { try { const f = formatHashrate(gh); return f.value + ' ' + f.unit; } catch(e) { return n(gh, 0) + ' GH/s'; } };

  function card(dev, r){
    const count = Number(r.asicCount) || (Array.isArray(r.asicTemps) ? r.asicTemps.length : 0) || 1;
    const temps = Array.isArray(r.asicTemps) && r.asicTemps.some(v => Number(v) > 0) ? r.asicTemps.map(Number) : null;
    const t = Number(r.temp);
    const maxT = temps ? Math.max(...temps) : t;
    const lvl = !r.online ? 'off' : maxT >= 70 ? 'hot' : maxT >= 63 ? 'warm' : 'ok';
    const per = r.online && r.hashrate ? fh(Number(r.hashrate) / count) : '—';
    const chips = Array.from({ length: count }, (_, i) => {
      const ct = temps ? temps[i] : t;
      return '<div class="pa-chip" style="--hc:' + heat(r.online ? ct : 0) + ';--d:' + (i * 0.12).toFixed(2) + 's" title="ASIC ' + (i + 1) + (r.online && isFinite(ct) && ct > 0 ? ' · ' + n(ct) + ' °C' : '') + '">' +
        '<span class="pa-chip-die"><b>' + esc(r.asicModel || 'ASIC') + '</b><i>#' + (i + 1) + '</i>' + (temps && r.online ? '<em>' + n(ct, 0) + '°</em>' : '') + '</span></div>';
    }).join('');
    const volt = r.coreVoltageActual != null ? n(r.coreVoltageActual, 0) + ' mV' : r.coreVoltage != null ? n(r.coreVoltage, 0) + ' mV' : '—';
    const stat = (k, v, c) => '<div class="pa-stat"' + (c ? ' style="--sc:' + c + '"' : '') + '><span>' + t2(k) + '</span><b>' + v + '</b></div>';
    return '<div class="pa-board" data-lvl="' + lvl + '">' +
      '<div class="pa-head"><div><b class="pa-name">' + esc(dev.name || dev.ip) + '</b><small>' + esc([r.deviceModel, r.asicModel].filter(Boolean).join(' · ') || dev.ip) + '</small></div>' +
      '<span class="pa-state">' + (lvl === 'off' ? t2('pa_off') : lvl === 'hot' ? t2('pa_hot') : lvl === 'warm' ? t2('pa_warm') : t2('pa_ok')) + '</span></div>' +
      '<div class="pa-pcb"><div class="pa-traces"></div><div class="pa-chips" style="--cols:' + Math.min(4, count) + '">' + chips + '</div></div>' +
      '<div class="pa-sum"><div><span>' + count + ' ' + t2('pa_chips') + '</span><b>' + (r.online ? fh(Number(r.hashrate) || 0) : '—') + '</b><small>' + per + ' ' + t2('pa_perchip') + (r.smallCores ? ' · ' + t2('pa_cores').replace('{0}', r.smallCores) : '') + '</small></div></div>' +
      '<div class="pa-stats">' +
        stat('pa_temp', r.online ? n(maxT) + ' °C' : '—', heat(r.online ? maxT : 0)) +
        stat('pa_vr', r.online && r.vrTemp != null ? n(r.vrTemp) + ' °C' : '—', heat(r.online ? Number(r.vrTemp) - 8 : 0)) +
        stat('pa_freq', r.online && r.frequency ? n(r.frequency, 0) + ' MHz' : '—', '#b48cff') +
        stat('pa_volt', r.online ? volt : '—', '#ffd23f') +
        stat('pa_fan', r.online && r.fanSpeed ? n(r.fanSpeed, 0) + ' RPM' : '—', '#7aa8ff') +
        stat('pa_eff', r.online && r.efficiency ? n(r.efficiency) + ' J/TH' : '—', '#3dffc2') +
        stat('pa_err', r.online && r.dupNonces != null ? String(r.dupNonces) : '—', Number(r.dupNonces) > 0 ? '#ff9a1a' : '#8aa0b4') +
      '</div></div>';
  }
  const t2 = k => typeof t === 'function' ? t(k) : k;

  function render(){
    const tab = document.getElementById('tab-boards'); if(!tab) return;
    let box = document.getElementById('paBoards');
    if(!box){
      const panel = tab.querySelector('.panel'); if(!panel) return;
      box = document.createElement('div'); box.id = 'paBoards'; box.className = 'pa-wrap';
      panel.parentNode.insertBefore(box, panel);
    }
    // só máquinas AxeOS a sério: sem protocolo próprio (ou axeos-http) e com contagem de chips. LuxOS/Antminer, ePIC, Goldshell e mineiros
    // de GPU trazem o campo protocol e têm a sua própria vista (ou nenhuma); sem isto apareciam aqui como uma placa falsa de 1 chip.
    const isAxe = r => r && (!r.protocol || r.protocol === 'axeos-http') && !(r.boards && r.boards.length) && (Number(r.asicCount) > 0 || Number(r.smallCores) > 0);
    const list = (typeof devices !== 'undefined' ? devices : []).filter(d => isAxe(readings[d.id]));
    const cg = (typeof devices !== 'undefined' ? devices : []).some(d => readings[d.id] && readings[d.id].boards && readings[d.id].boards.length);
    tab.classList.toggle('pa-no-cg', !cg);   // sem máquinas LuxOS/Antminer, a tabela antiga fica escondida
    box.innerHTML = '<div class="pa-title">🔩 ' + t2('pa_title') + '</div>' +
      (list.length ? '<div class="pa-grid">' + list.map(d => card(d, readings[d.id])).join('') + '</div>' : '<div class="pa-empty">' + t2('pa_none') + '</div>');
  }
  if(typeof renderBoards === 'function'){
    const o = renderBoards;
    window.renderBoards = function(){ const ret = o.apply(this, arguments); try { render(); } catch(e) {} return ret; };
  }
  setInterval(() => { const tab = document.getElementById('tab-boards'); if(tab && tab.classList.contains('active') && !document.hidden) render(); }, 5000);
  window.hcPlacasAxe = { render };
})();
