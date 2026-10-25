// --- Perfis de Energia (MQTT / Home Assistant) ---------------------------
let powerProfiles = [];
let powerConfigLoaded = false;

function emptyPowerProfile(){
  return { name: '', min_solar: '', max_tariff: '', frequency: '', coreVoltage: '' };
}

async function loadPowerConfig(){
  try {
    const res = await fetch(`${API_BASE}/api/power/config`);
    const cfg = await res.json();
    $('pwHost').value = cfg.mqtt.host || '';
    $('pwPort').value = cfg.mqtt.port || 1883;
    $('pwUser').value = cfg.mqtt.username || '';
    $('pwPass').placeholder = cfg.mqtt.password_set ? '•••••••• (já definida — deixa em branco para manter)' : 'deixa em branco para manter';
    $('pwTopicSolar').value = cfg.mqtt.topic_solar || '';
    $('pwTopicTariff').value = cfg.mqtt.topic_tariff || '';
    powerProfiles = Array.isArray(cfg.profiles) && cfg.profiles.length ? cfg.profiles : [];
    renderPowerProfilesForm();
    powerConfigLoaded = true;
  } catch(e) {
    $('powerLiveError').style.display = 'block';
    $('powerLiveError').textContent = 'Não foi possível carregar a configuração de energia do servidor local.';
  }
}

function renderPowerProfilesForm(){
  const el = $('powerProfilesList');
  if(!powerProfiles.length){
    el.innerHTML = `<div class="hint">Ainda não tens perfis definidos. Clica em "+ Adicionar Perfil".</div>`;
    return;
  }
  el.innerHTML = powerProfiles.map((p, i) => `
    <div class="power-profile-row">
      <div class="priority-num">#${i+1}</div>
      <label><span class="field-label">Nome</span><input type="text" value="${p.name ?? ''}" placeholder="ex: Turbo" oninput="powerProfiles[${i}].name=this.value"></label>
      <label><span class="field-label">Solar mín. (W)</span><input type="number" value="${p.min_solar ?? ''}" placeholder="sem mínimo" oninput="powerProfiles[${i}].min_solar=this.value"></label>
      <label><span class="field-label">Tarifa máx. (€/kWh)</span><input type="number" step="0.01" value="${p.max_tariff ?? ''}" placeholder="sem máximo" oninput="powerProfiles[${i}].max_tariff=this.value"></label>
      <label><span class="field-label">Frequência (MHz)</span><input type="number" value="${p.frequency ?? ''}" placeholder="ex: 550" oninput="powerProfiles[${i}].frequency=this.value"></label>
      <label><span class="field-label">CoreVoltage (mV)</span><input type="number" value="${p.coreVoltage ?? ''}" placeholder="ex: 1150" oninput="powerProfiles[${i}].coreVoltage=this.value"></label>
      <div class="power-profile-row-actions">
        <button title="Subir prioridade" onclick="movePowerProfile(${i}, -1)" ${i===0 ? 'disabled' : ''}>↑</button>
        <button title="Descer prioridade" onclick="movePowerProfile(${i}, 1)" ${i===powerProfiles.length-1 ? 'disabled' : ''}>↓</button>
        <button class="remove" title="Remover" onclick="removePowerProfile(${i})">✕</button>
      </div>
    </div>
  `).join('');
}

function addPowerProfile(){
  powerProfiles.push(emptyPowerProfile());
  renderPowerProfilesForm();
}

function removePowerProfile(i){
  powerProfiles.splice(i, 1);
  renderPowerProfilesForm();
}

function movePowerProfile(i, dir){
  const j = i + dir;
  if(j < 0 || j >= powerProfiles.length) return;
  [powerProfiles[i], powerProfiles[j]] = [powerProfiles[j], powerProfiles[i]];
  renderPowerProfilesForm();
}

function sanitizedPowerProfiles(){
  return powerProfiles
    .filter(p => (p.name || '').trim())
    .map(p => {
      const out = { name: p.name.trim() };
      if(p.min_solar !== '' && p.min_solar != null) out.min_solar = Number(p.min_solar);
      if(p.max_tariff !== '' && p.max_tariff != null) out.max_tariff = Number(p.max_tariff);
      if(p.frequency !== '' && p.frequency != null) out.frequency = Number(p.frequency);
      if(p.coreVoltage !== '' && p.coreVoltage != null) out.coreVoltage = Number(p.coreVoltage);
      return out;
    });
}

// --- Renting (MiningRigRentals) ---------------------------------------------
let rentingRefreshTimer = null;
let mrrConfigured = false;
let lastMrrRawResponse = null;

function toggleMrrRawDebug(){
  const el = $('mrrRawDebug');
  if(!el) return;
  const showing = el.style.display !== 'none';
  if(showing){
    el.style.display = 'none';
  } else {
    el.textContent = lastMrrRawResponse ? JSON.stringify(lastMrrRawResponse, null, 2) : 'Ainda sem resposta guardada — abre a aba Renting para ir buscar dados primeiro.';
    el.style.display = 'block';
  }
}

function startRentingAutoRefresh(){
  stopRentingAutoRefresh();
  rentingRefreshTimer = setInterval(fetchRentingList, 30000);
}
function stopRentingAutoRefresh(){
  if(rentingRefreshTimer){ clearInterval(rentingRefreshTimer); rentingRefreshTimer = null; }
}

function initRentingTab(){
  fetchMrrStatus();
  fetchRentingList();
  startRentingAutoRefresh();
}

async function saveMrrConfig(){
  const body = { api_key: $('mrrApiKey').value.trim() };
  if($('mrrApiSecret').value) body.api_secret = $('mrrApiSecret').value;
  try {
    const res = await fetch(`${API_BASE}/api/mrr/config`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
    });
    const data = await res.json();
    if(data.ok){
      $('mrrApiSecret').value = '';
      logEvent('Ligação à MiningRigRentals guardada.', 'new', 'Sistema', 'sys');
      $('mrrLiveError').style.display = 'none';
    } else {
      throw new Error('save failed');
    }
  } catch(e) {
    $('mrrLiveError').style.display = 'block';
    $('mrrLiveError').textContent = 'Falha ao guardar a ligação à MiningRigRentals.';
  }
  fetchMrrStatus();
  fetchRentingList();
}

async function fetchMrrStatus(){
  const dot = $('mrrStatusDot');
  const label = $('mrrConnLabel');
  try {
    const res = await fetch(`${API_BASE}/api/mrr/status`);
    const data = await res.json();
    mrrConfigured = !!data.configured;
    if(dot) dot.className = 'power-status-dot ' + (mrrConfigured ? 'connected' : 'disconnected');
    if(label) label.textContent = mrrConfigured ? 'Credenciais configuradas' : 'Sem credenciais configuradas';
    // Pré-preenche a API Key (nunca o secret) para não parecer que as
    // credenciais não ficaram guardadas só por o campo aparecer vazio.
    const keyInput = $('mrrApiKey');
    if(keyInput && document.activeElement !== keyInput && data.api_key){
      keyInput.value = data.api_key;
    }
    const secretInput = $('mrrApiSecret');
    if(secretInput && document.activeElement !== secretInput){
      secretInput.placeholder = data.has_secret ? '•••••••• (já configurado, deixa em branco para manter)' : 'a tua API Secret da MiningRigRentals';
    }
  } catch(e) {
    mrrConfigured = false;
    if(dot) dot.className = 'power-status-dot disconnected';
    if(label) label.textContent = 'Servidor local indisponível';
  }
}

// A API da MiningRigRentals ainda está em beta e os nomes exatos dos campos
// de /rental podem variar por conta/tipo de rig; por isso vamos buscar o
// valor pela primeira chave que existir numa lista de alternativas, em vez
// de assumir uma única estrutura fixa.
function pickField(obj, paths){
  for(const path of paths){
    const parts = path.split('.');
    let cur = obj;
    let ok = true;
    for(const p of parts){
      if(cur && typeof cur === 'object' && p in cur){ cur = cur[p]; }
      else { ok = false; break; }
    }
    if(ok && cur !== null && cur !== undefined && cur !== '') return cur;
  }
  return null;
}

function rentingStatusClass(statusText){
  const s = String(statusText || '').toLowerCase();
  if(s.includes('active') || s.includes('rent') || s.includes('running')) return 'active';
  if(s.includes('expir') || s.includes('end') || s.includes('cancel') || s.includes('complete')) return 'expired';
  return 'other';
}

function rentingFormatTime(val){
  if(val === null || val === undefined || val === '') return '—';
  if(typeof val === 'number'){
    const ms = val < 2e10 ? val * 1000 : val; // segundos vs milissegundos
    const d = new Date(ms);
    if(!isNaN(d.getTime())) return d.toLocaleString();
  }
  return String(val);
}

async function fetchRentingList(){
  const listEl = $('rentingList');
  if(!listEl) return;

  if(!mrrConfigured){
    listEl.innerHTML = `<div class="renting-empty">${t('renting_sem_dados')}</div>`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/mrr/rentals`);
    const data = await res.json();
    lastMrrRawResponse = data;
    if($('mrrLastUpdate')) $('mrrLastUpdate').textContent = new Date().toLocaleTimeString();

    if(!data || data.success === false){
      listEl.innerHTML = `<div class="renting-empty">Falha ao obter rentals: ${(data && data.error) || 'erro desconhecido'}.</div>`;
      return;
    }

    let rentals = data.data;
    if(rentals && !Array.isArray(rentals)){
      // Vários endpoints da MRR (ex: /rig) envolvem a lista dentro de
      // 'records'; tenta isso primeiro antes de recorrer a Object.values
      // (que misturava campos como 'total'/'stats' com a lista real e
      // fazia aparecer sempre "5 rentals desconhecidas").
      if(Array.isArray(rentals.records)) rentals = rentals.records;
      else if(Array.isArray(rentals.rentals)) rentals = rentals.rentals;
      else if(Array.isArray(rentals.data)) rentals = rentals.data;
      else rentals = Object.values(rentals);
    }
    if(!Array.isArray(rentals) || rentals.length === 0){
      listEl.innerHTML = `<div class="renting-empty">Não tens nenhuma rig alugada neste momento.</div>`;
      return;
    }

    listEl.innerHTML = rentals.map(r => {
      const idVal = pickField(r, ['id', 'rental_id', 'rentalid']);
      const name = pickField(r, ['rig.name', 'name', 'rigname']);
      const statusRaw = pickField(r, ['status.status', 'status', 'state']);
      const recognized = idVal !== null || statusRaw !== null || name !== null;

      if(!recognized){
        // Não reconheço nenhum campo esperado nesta estrutura — mostra os
        // dados originais tal como vieram da API em vez de "desconhecido",
        // para se poder ver os nomes reais dos campos.
        return `<div class="renting-card">
          <div class="renting-card-head">
            <div class="renting-card-title">Rental (estrutura não reconhecida)</div>
          </div>
          <pre style="white-space:pre-wrap; font-size:11px; color:var(--muted); margin:0; overflow-x:auto;">${JSON.stringify(r, null, 2)}</pre>
        </div>`;
      }

      const statusText = statusRaw || '—';
      const cls = rentingStatusClass(statusText);
      // Só esconde quando o estado claramente indica que já acabou -
      // se o texto do estado não bater com nenhuma palavra-chave conhecida,
      // mostra na mesma (mais seguro do que arriscar esconder uma rental
      // ativa só por não reconhecer a palavra usada).
      if(cls === 'expired') return '';
      const algo = pickField(r, ['type', 'rig.type', 'algo']);
      const hashrate = pickField(r, ['hashrate.advertised.nice', 'hashrate.nice', 'rig.hashrate.advertised.nice']);
      const price = pickField(r, ['price.paid', 'price.amount', 'price']);
      const currency = pickField(r, ['price.currency', 'currency']);
      const started = pickField(r, ['start', 'starts', 'time.start', 'created']);
      const ends = pickField(r, ['end', 'expires', 'time.end']);

      // Alerta de rental prestes a terminar (dentro de 30 min), com
      // cooldown por rental para não repetir o aviso a cada refresh de 30s.
      if(alertsConfig.notify_rental_ending && ends){
        const endsMs = typeof ends === 'number' ? (ends < 2e10 ? ends * 1000 : ends) : new Date(ends).getTime();
        if(!isNaN(endsMs)){
          const minsLeft = (endsMs - Date.now()) / 60000;
          if(minsLeft > 0 && minsLeft <= 30){
            sendAlert(`⏳ A rental "${name || idVal}" termina em cerca de ${Math.round(minsLeft)} min.`, `rental-ending-${idVal || name}`);
          }
        }
      }

      const fields = [
        ['Estado', statusText],
        algo ? ['Algo', algo] : null,
        hashrate ? ['Hashrate', hashrate] : null,
        price ? ['Preço', `${price}${currency ? ' ' + currency : ''}`] : null,
        started ? ['Início', rentingFormatTime(started)] : null,
        ends ? ['Termina', rentingFormatTime(ends)] : null,
      ].filter(Boolean);

      return `<div class="renting-card">
        <div class="renting-card-head">
          <div class="renting-card-title">${name || `Rental #${idVal}`}</div>
          <div class="renting-status-pill ${cls}">${statusText}</div>
        </div>
        <div class="renting-grid">
          ${fields.map(([label, val]) => `
            <div>
              <div class="renting-field-label">${label}</div>
              <div class="renting-field-val">${val}</div>
            </div>
          `).join('')}
        </div>
      </div>`;
    }).filter(html => html !== '').join('');

    if(!listEl.innerHTML.trim()){
      listEl.innerHTML = `<div class="renting-empty">Não tens nenhuma rental ativa neste momento.</div>`;
    }
  } catch(e) {
    listEl.innerHTML = `<div class="renting-empty">Não foi possível ligar ao servidor local.</div>`;
  }
}

// --- Alertas (Telegram / Discord) -------------------------------------------
let alertCooldowns = {}; // chave -> timestamp do último alerta enviado (evita spam)
const ALERT_COOLDOWN_MS = 10 * 60 * 1000; // 10 min por tipo/máquina
let alertsConfig = { notify_offline: true, notify_record: true, notify_rental_ending: true, notify_hashrate_drop: true, notify_windows_toast: true, notify_health: true, notify_daily: false, daily_hour: 21, hashrate_drop_pct: 30 };

async function sendAlert(message, cooldownKey){
  if(cooldownKey){
    const last = alertCooldowns[cooldownKey] || 0;
    if(Date.now() - last < ALERT_COOLDOWN_MS) return;
    alertCooldowns[cooldownKey] = Date.now();
  }
  try {
    await fetch(`${API_BASE}/api/alerts/notify`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ message })
    });
  } catch(e) { /* falha silenciosa - não bloqueia o resto do dashboard */ }
}

async function loadAlertsConfig(){
  try {
    const res = await fetch(`${API_BASE}/api/alerts/config`);
    const cfg = await res.json();
    alertsConfig = {
      notify_offline: cfg.notify_offline !== false,
      notify_record: cfg.notify_record !== false,
      notify_rental_ending: cfg.notify_rental_ending !== false,
      notify_hashrate_drop: cfg.notify_hashrate_drop !== false,
      notify_windows_toast: cfg.notify_windows_toast !== false,
      notify_health: cfg.notify_health !== false,
      notify_daily: cfg.notify_daily === true,
      daily_hour: cfg.daily_hour != null ? Number(cfg.daily_hour) : 21,
      hashrate_drop_pct: cfg.hashrate_drop_pct || 30,
    };
    if($('alTgChatId')) $('alTgChatId').value = cfg.telegram_chat_id || '';
    if($('alHashDropPct')) $('alHashDropPct').value = cfg.hashrate_drop_pct || 30;
    if($('alNotifyOffline')) $('alNotifyOffline').checked = alertsConfig.notify_offline;
    if($('alNotifyRecord')) $('alNotifyRecord').checked = alertsConfig.notify_record;
    if($('alNotifyRental')) $('alNotifyRental').checked = alertsConfig.notify_rental_ending;
    if($('alNotifyDrop')) $('alNotifyDrop').checked = alertsConfig.notify_hashrate_drop;
    if($('alNotifyHealth')) $('alNotifyHealth').checked = alertsConfig.notify_health;
    if($('alNotifyDaily')) $('alNotifyDaily').checked = alertsConfig.notify_daily;
    if($('alDailyHour')) $('alDailyHour').value = String(alertsConfig.daily_hour);
    if($('alNotifyToast')){
      $('alNotifyToast').checked = alertsConfig.notify_windows_toast;
      $('alNotifyToast').disabled = cfg.toast_available === false;
    }
    if($('alNotifyToastLabel')) $('alNotifyToastLabel').style.opacity = (cfg.toast_available === false) ? '0.5' : '1';
    if($('alNotifyToastLock')) $('alNotifyToastLock').style.display = (cfg.toast_available === false) ? 'inline' : 'none';
    if($('alertsToastHint')) $('alertsToastHint').style.display = (cfg.toast_available === false) ? 'block' : 'none';
    // token/webhook nunca voltam do servidor completos por serem segredos -
    // só se sabe se já estão configurados através do placeholder.
    if($('alTgToken')) $('alTgToken').placeholder = cfg.telegram_bot_token ? '•••••••• (já configurado, deixa em branco para manter)' : 'ex: 123456:ABC-DEF...';
    if($('alDiscordWebhook')) $('alDiscordWebhook').placeholder = cfg.discord_webhook_url ? '•••••••• (já configurado, deixa em branco para manter)' : 'https://discord.com/api/webhooks/...';
  } catch(e) { /* servidor local pode estar indisponível */ }
}

async function saveAlertsConfig(){
  const body = {
    telegram_chat_id: $('alTgChatId').value.trim(),
    hashrate_drop_pct: parseInt($('alHashDropPct').value, 10) || 30,
    notify_offline: $('alNotifyOffline').checked,
    notify_record: $('alNotifyRecord').checked,
    notify_rental_ending: $('alNotifyRental').checked,
    notify_hashrate_drop: $('alNotifyDrop').checked,
    notify_windows_toast: $('alNotifyToast') ? $('alNotifyToast').checked : true,
    notify_health: $('alNotifyHealth') ? $('alNotifyHealth').checked : true,
    notify_daily: $('alNotifyDaily') ? $('alNotifyDaily').checked : false,
    daily_hour: $('alDailyHour') ? parseInt($('alDailyHour').value, 10) : 21,
  };
  if($('alTgToken').value.trim()) body.telegram_bot_token = $('alTgToken').value.trim();
  if($('alDiscordWebhook').value.trim()) body.discord_webhook_url = $('alDiscordWebhook').value.trim();

  const errEl = $('alertsLiveError');
  const okEl = $('alertsLiveOk');
  errEl.style.display = 'none';
  okEl.style.display = 'none';
  try {
    const res = await fetch(`${API_BASE}/api/alerts/config`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
    });
    const data = await res.json();
    if(data.ok){
      $('alTgToken').value = '';
      $('alDiscordWebhook').value = '';
      okEl.textContent = 'Configuração de alertas guardada.';
      okEl.style.display = 'block';
      loadAlertsConfig();
    } else {
      throw new Error('save failed');
    }
  } catch(e) {
    errEl.textContent = 'Falha ao guardar a configuração de alertas.';
    errEl.style.display = 'block';
  }
}

async function testAlerts(){
  const errEl = $('alertsLiveError');
  const okEl = $('alertsLiveOk');
  errEl.style.display = 'none';
  okEl.style.display = 'none';
  try {
    const res = await fetch(`${API_BASE}/api/alerts/test`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}' });
    const data = await res.json();
    if(data.ok){
      okEl.textContent = 'Teste enviado! Verifica o Telegram/Discord.';
      okEl.style.display = 'block';
    } else {
      errEl.textContent = (data.errors && data.errors.join(' | ')) || 'Nenhum canal configurado.';
      errEl.style.display = 'block';
    }
  } catch(e) {
    errEl.textContent = 'Não foi possível ligar ao servidor local.';
    errEl.style.display = 'block';
  }
}

async function savePowerMqttConfig(){
  const body = {
    mqtt: {
      host: $('pwHost').value.trim(),
      port: Number($('pwPort').value) || 1883,
      username: $('pwUser').value.trim(),
      topic_solar: $('pwTopicSolar').value.trim(),
      topic_tariff: $('pwTopicTariff').value.trim(),
    }
  };
  if($('pwPass').value) body.mqtt.password = $('pwPass').value;
  try {
    const res = await fetch(`${API_BASE}/api/power/config`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
    });
    const data = await res.json();
    if(data.ok){
      $('pwPass').value = '';
      logEvent('Configuração MQTT de energia guardada.', 'new', 'Sistema', 'sys');
    }
  } catch(e) {
    $('powerLiveError').style.display = 'block';
    $('powerLiveError').textContent = 'Falha ao guardar a configuração MQTT.';
  }
  pollPowerStatus();
}

async function savePowerProfiles(){
  try {
    const res = await fetch(`${API_BASE}/api/power/config`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ profiles: sanitizedPowerProfiles() })
    });
    const data = await res.json();
    if(data.ok) logEvent('Perfis de energia guardados.', 'new', 'Sistema', 'sys');
  } catch(e) {
    $('powerLiveError').style.display = 'block';
    $('powerLiveError').textContent = 'Falha ao guardar os perfis de energia.';
  }
  pollPowerStatus();
}

let lastSuggestedProfile = null;

async function pollPowerStatus(){
  try {
    const res = await fetch(`${API_BASE}/api/power/status`);
    const st = await res.json();

    const dots = [$('powerStatusDot'), $('powerStatusDotInline')];
    dots.forEach(d => { if(d) d.classList.remove('connected', 'disconnected'); d?.classList.add(st.connected ? 'connected' : 'disconnected'); });
    $('powerConnLabel').textContent = st.connected ? 'MQTT ligado' : 'MQTT desligado';

    $('powerSolarVal').textContent = st.solar != null ? `${st.solar.toFixed(0)} W` : '—';
    $('powerTariffVal').textContent = st.tariff != null ? `${st.tariff.toFixed(3)} €/kWh` : '—';
    $('powerLastUpdate').textContent = st.last_update ? new Date(st.last_update * 1000).toLocaleTimeString('pt-PT') : '—';

    const errEl = $('powerLiveError');
    if(st.error && !st.connected){
      errEl.style.display = 'block';
      errEl.textContent = st.mqtt_available === false
        ? 'A biblioteca paho-mqtt não está instalada no ambiente que corre o app.py — instala-a com "pip install paho-mqtt" e reinicia o Hash Commander.'
        : st.error;
    } else {
      errEl.style.display = 'none';
    }

    lastSuggestedProfile = st.suggested_profile || null;
    if(lastSuggestedProfile){
      $('powerSuggestedName').textContent = lastSuggestedProfile.name;
      const parts = [];
      if(lastSuggestedProfile.frequency != null) parts.push(`${lastSuggestedProfile.frequency} MHz`);
      if(lastSuggestedProfile.coreVoltage != null) parts.push(`${lastSuggestedProfile.coreVoltage} mV`);
      parts.push(`solar: ${st.solar != null ? st.solar.toFixed(0)+' W' : '—'}`, `tarifa: ${st.tariff != null ? st.tariff.toFixed(3)+' €/kWh' : '—'}`);
      $('powerSuggestedMeta').textContent = parts.join(' · ');
    } else {
      $('powerSuggestedName').textContent = 'Sem sugestão disponível';
      $('powerSuggestedMeta').textContent = 'Configura o MQTT e pelo menos um perfil para começar a receber sugestões.';
    }
    renderPowerDevicesApply();
  } catch(e) {
    // servidor local indisponível - ignora silenciosamente neste ciclo
  }
}

function renderPowerDevicesApply(){
  const el = $('powerDevicesApply');
  const allBtn = $('powerApplyAllBtn');
  if(!devices.length){
    el.innerHTML = `<div class="hint">Adiciona máquinas no separador "Dashboard Geral" para poderes aplicar perfis.</div>`;
    allBtn.disabled = true;
    return;
  }
  allBtn.disabled = !lastSuggestedProfile;
  el.innerHTML = devices.map(d => {
    const r = readings[d.id];
    const current = r ? `atual: ${r.frequency || '—'} MHz` : 'sem leitura';
    return `
      <div class="power-device-apply-row">
        <div>
          <div class="dname">${d.name}</div>
          <div class="dcurrent">${d.ip} · ${current}</div>
        </div>
        <button class="power-apply-btn" ${lastSuggestedProfile ? '' : 'disabled'} onclick="applySuggestedProfileToDevice('${d.id}')">Aplicar "${lastSuggestedProfile ? lastSuggestedProfile.name : '—'}"</button>
      </div>
    `;
  }).join('');
}

async function applySuggestedProfileToDevice(devId){
  if(!lastSuggestedProfile) return;
  const dev = devices.find(d => d.id === devId);
  if(!dev) return;
  const payload = { ip: dev.ip };
  if(lastSuggestedProfile.frequency != null) payload.frequency = lastSuggestedProfile.frequency;
  if(lastSuggestedProfile.coreVoltage != null) payload.coreVoltage = lastSuggestedProfile.coreVoltage;
  try {
    const res = await fetch(`${API_BASE}/api/apply-profile`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
    });
    const data = await res.json();
    if(data.ok){
      logEvent(`Perfil "${lastSuggestedProfile.name}" aplicado com sucesso.`, 'new', dev.name, dev.id);
    } else {
      logEvent(`Falha ao aplicar perfil: ${data.error || 'erro desconhecido'}`, 'error', dev.name, dev.id);
    }
  } catch(e) {
    logEvent(`Falha ao aplicar perfil "${lastSuggestedProfile.name}".`, 'error', dev.name, dev.id);
  }
}

async function applySuggestedProfileToAll(){
  for(const d of devices){
    await applySuggestedProfileToDevice(d.id);
  }
}

