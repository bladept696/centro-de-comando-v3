; ============================================================================
;  CentroDeComando.iss - script do Inno Setup para gerar o instalador
;  do "Centro de Comando" (dashboard NerdQAxe++/Bitaxe).
;
;  Como usar:
;   1. Instala o Inno Setup (gratuito): https://jrsoftware.org/isdl.php
;   2. Corre primeiro o build_exe.bat (PyInstaller) para gerar dist\CentroDeComando.exe
;   3. Abre este ficheiro no Inno Setup (ou corre build_installer.bat) e compila
;   4. O instalador final aparece em Output\CentroDeComando-Setup-<versao>.exe
;
;  IMPORTANTE: atualiza MyAppVersion a cada release, para bater certo com
;  APP_VERSION no app.py (é o que o /api/update/check compara).
; ============================================================================

#define MyAppName "Centro de Comando"
#define MyAppVersion "3.6.0"
#define MyAppPublisher "Centro de Comando"
#define MyAppExeName "CentroDeComando.exe"
; GUID fixo do produto - gera o teu próprio uma vez (Tools > Generate GUID no
; Inno Setup) e NUNCA mudes depois, ou o Windows deixa de saber que é o
; mesmo programa em updates/desinstalação.
#define MyAppId "{{B3F5D9A2-6C1E-4C7A-9E2B-8F4A1D2C7E10}"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
; Instalador de utilizador único (não pede admin) - evita UAC sempre que
; possível; muda para "admin" se precisares de instalar para todos os
; utilizadores da máquina.
PrivilegesRequired=lowest
OutputDir=Output
OutputBaseFilename=CentroDeComando-Setup-{#MyAppVersion}
SetupIconFile=app_icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; Permite atualizações silenciosas (usado pelo botão "Atualizar agora" do
; próprio painel, que chama o instalador com /VERYSILENT /SP-).
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "portuguese"; MessagesFile: "compiler:Languages\Portuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "startupicon"; Description: "Arrancar automaticamente com o Windows"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Executável principal gerado pelo PyInstaller (--onefile).
Source: "dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
; Ícone usado também pelo tray icon em runtime (resource_dir()).
Source: "app_icon.ico"; DestDir: "{app}"; Flags: ignoreversion
; Ficheiros estáticos do painel servidos pelo servidor local. Ajusta esta
; lista conforme o que o teu build_exe.bat já embebe com --add-data; se o
; PyInstaller já os inclui dentro do --onefile, podes remover estas linhas
; para não duplicar.
Source: "nerdqaxe-dashboard.html"; DestDir: "{app}"; Flags: ignoreversion
Source: "overlay-obs.html"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "rainmeter-skin\*"; DestDir: "{app}\rainmeter-skin"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
; NOTA: config.json (MQTT, IPs das máquinas, perfis) NÃO é copiado aqui de
; propósito - é gerado pela própria app na primeira execução, e o
; [UninstallDelete] abaixo garante que não é apagado ao desinstalar.

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startupicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Limpa a pasta de instaladores descarregados automaticamente, mas NUNCA
; toca em config.json nem nos históricos (diff_history.json, etc.) - ficam
; para o caso de o utilizador reinstalar a seguir.
Type: filesandordirs; Name: "{app}\updates"

[Code]
// Se já houver uma instância da app a correr, o CloseApplications=yes acima
// já trata de a fechar antes de substituir o .exe. Nada mais a fazer aqui.
