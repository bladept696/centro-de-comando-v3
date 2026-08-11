; ============================================================================
; Centro de Comando — Script do Inno Setup
;
; Gera um instalador Windows (.exe) a partir do CentroDeComando.exe já
; compilado com o PyInstaller (dist/CentroDeComando.exe).
;
; Como usar:
;   1. Instala o Inno Setup (gratuito): https://jrsoftware.org/isinfo.php
;   2. Garante que já correste build_exe.bat e que existe
;      dist\CentroDeComando.exe
;   3. Abre este ficheiro (CentroDeComando.iss) no Inno Setup Compiler
;   4. Clica em "Compile" (ou F9)
;   5. O instalador final fica em Output\CentroDeComando-Setup.exe
;
; Atualiza a linha MyAppVersion sempre que publicares uma nova release,
; para condizer com APP_VERSION em app.py e com a tag da release no GitHub.
; ============================================================================

#define MyAppName "Centro de Comando"
#define MyAppVersion "3.0"
#define MyAppPublisher "bladept696"
#define MyAppURL "https://github.com/bladept696/centro-de-comando-v3"
#define MyAppExeName "CentroDeComando.exe"

[Setup]
AppId={{8F2B7C1A-4E6D-4A2F-9C3B-CENTRODECOMANDO}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
; Instalador de utilizador único (não precisa de admin) - mais simples para
; quem só usa a app na sua própria conta Windows. Muda para "admin" se
; preferires instalar para todos os utilizadores da máquina.
PrivilegesRequired=lowest
OutputDir=Output
OutputBaseFilename=CentroDeComando-Setup
SetupIconFile=app_icon.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}
; Impede instalar uma versão mais antiga por cima de uma mais nova por engano
AppMutex=CentroDeComandoMutex

[Languages]
Name: "portuguese"; MessagesFile: "compiler:Languages\Portuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho no ambiente de trabalho"; GroupDescription: "Atalhos adicionais:"
Name: "startupicon"; Description: "Iniciar automaticamente com o Windows"; GroupDescription: "Arranque:"; Flags: unchecked

[Files]
Source: "dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "app_icon.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "bitminer33-banner.png"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "lightning-qrcode.png"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "LEIA-ME.txt"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist isreadme
; NOTA: não incluir power_profiles.json aqui de propósito - é gerado pela
; app e não deve ser substituído numa atualização (perderia a configuração
; do utilizador). O uninstaller também não o apaga (ver secção [UninstallDelete]).

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startupicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir o {#MyAppName} agora"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Remove ficheiros gerados em runtime, mas preserva power_profiles.json
; para o caso de o utilizador reinstalar a app mais tarde.
Type: files; Name: "{app}\*.log"
