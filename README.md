# Centro de Comando — Dashboard 

Painel de monitorização para mineradores, com histórico de best
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

## Como gerar o .exe

Corre o `build_exe.bat` (num PC com Windows e Python instalado). O
executável final fica em `dist/CentroDeComando.exe`.

## Ficheiros

- `app.py` — servidor local + launcher
- `nerdqaxe-dashboard.html` — o painel/dashboard
- `bitminer33-banner.png` — banner do separador "Apoiantes"
- `lightning-qrcode.png` — QR code Lightning para doações
- `app_icon.ico` — ícone do executável
- `build_exe.bat` — script que gera o .exe
