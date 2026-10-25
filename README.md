# Centro de Comando — Dashboard NerdQAxe++

Painel de monitorização para mineradores NerdQAxe++, com histórico de best
shares, deteção de blocos, simulador, latência, saúde térmica preditiva e
gestão dinâmica de perfil de alimentação via MQTT / Home Assistant.

## Como correr (modo desenvolvimento)

```
pip install paho-mqtt
python app.py
```

Isto arranca um servidor local na porta 8765 e abre o painel no browser.
O `paho-mqtt` é opcional — sem ele a app funciona normalmente, só a secção
"Perfis de Energia" fica sem ligação MQTT (o painel avisa disso).

## ⚡ Perfis de Energia (MQTT / Home Assistant)

No separador "☀️ Perfis de Energia" podes:

1. Ligar o painel ao teu broker MQTT (tipicamente o do Home Assistant),
   indicando os tópicos que publicam a produção solar (W) e a tarifa
   dinâmica de eletricidade (€/kWh).
2. Definir perfis de energia personalizados (nome, condições de solar
   mínimo / tarifa máxima, frequência e undervolt/coreVoltage do ASIC),
   por ordem de prioridade.
3. Ver a sugestão de perfil calculada em tempo real a partir dos valores
   MQTT atuais, e aplicá-la manualmente a uma máquina ou a todas.

Por desenho, a aplicação de um perfil é **sempre manual** — o painel nunca
altera a frequência/undervolt de um ASIC sozinho, apenas sugere.
A configuração fica gravada em `power_profiles.json`, ao lado do executável
ou do `app.py`.

## 🖥️ Cartões das máquinas

O Dashboard Geral mostra um cartão por máquina (vista de cartões, compacta ou tabela):

- **Estado e leituras:** hashrate com mini-gráfico e tendência, temperatura, ventoinha,
  Wi-Fi, consumo, eficiência, partilhas, pool, histórico de 1/6/24 h e linha do tempo do estado.
- **Avisos e alertas:** temperatura, rejeições, Wi-Fi, pool lenta, queda de hashrate, abaixo do
  esperado e máquina presa (com reinício automático opcional). Os limites configuram-se em
  ⚙ > Limites de alerta. Os avisos saem pelo Telegram, Discord, Windows e navegador.
- **Organização:** grupos, favoritos, notas, filtros, pesquisa, ordenação, seleção em grupo
  (Eco, Turbo, reiniciar), comparação lado a lado e exportação em CSV.
- **Resumo e custos:** média e pico de 24 h, energia, lucro estimado, chance de bloco,
  disponibilidade a 7/30 dias, resumo diário opcional e relatório imprimível.
- **Ferramentas (⚙):** backup e restauro da configuração, procura de máquinas novas na rede,
  agendamento de perfis Eco/Turbo, pausa de todos os alertas e atalhos de teclado (`?`).
- **Mapa da rede:** partículas nas ligações (mais depressa com mais hashrate), zonas coloridas por grupo, destaque do
  caminho da máquina escolhida, diagnóstico do caminho (router, internet e DNS), radar, exportar PNG e ecrã inteiro.
- **Tomada inteligente:** com os endereços de ligar e desligar (Shelly, Tasmota...), o botão ⚡ faz
  um ciclo de energia; se a máquina ficar presa 25 min, pode fazê-lo sozinha (só com o reinício automático permitido).
- **Webhook / ntfy:** os alertas podem também seguir para um endereço à escolha (Home Assistant, ntfy.sh, Slack...).
- Traduzido em português, inglês, espanhol e francês.

## Como gerar o .exe

Corre o `build_exe.bat` (num PC com Windows e Python instalado). O
executável final fica em `dist/CentroDeComando.exe`.

## Ficheiros

- `app.py` — servidor local + launcher
- `nerdqaxe-dashboard.html` — a estrutura (HTML) do painel
- `dashboard/css/` — os estilos, por assunto (`base`, `mempool`, `cartoes`, ...)
- `dashboard/js/` — o código, por assunto. Os ficheiros numerados (`01-` a `19-`)
  são carregados por esta ordem e partilham as mesmas variáveis; os restantes
  (`login`, `chat`, `noticias`, `donut3d`, `cartoes*`, `firebase-init`) vêm depois.
  Os `cartoes*.js` desenham os cartões das máquinas: `cartoes.js` (cartões, filtros e vistas),
  `cartoes-extra.js` (alertas, resumo e eventos), `cartoes-ferramentas.js` (menu ⚙, backup e
  agendamentos), `cartoes-relatorios.js` (comparar, relatório e limites), `cartoes-experiencias.js` (efeitos, mapa de calor 3D e planta),
  `cartoes-regras.js` (regras "se… então…") e `cartoes-i18n.js` (traduções).
  Para acrescentar um ficheiro novo, junta uma linha `<script src="dashboard/js/...">`
  (ou `<link>` para CSS) ao HTML, na posição certa.
- `bitminer33-banner.png` — banner do separador "Apoiantes"
- `baroneclub-banner.png` — banner do separador "Apoiantes"
- `lightning-qrcode.png` — QR code Lightning para doações
- `app_icon.ico` — ícone do executável
- `build_exe.bat` — script que gera o .exe
