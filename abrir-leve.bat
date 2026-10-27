@echo off
rem Abre o Centro de Comando numa janela propria do Chrome, em Modo Desempenho (leve), sem extensoes e com um perfil so para a dashboard.
rem Primeira vez: pede o login; depois fica guardado neste perfil.
set URL=http://localhost:8765/nerdqaxe-dashboard.html?leve=1
set PERFIL=%LOCALAPPDATA%\CentroDeComando\perfil-leve
set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe
start "" "%CHROME%" --user-data-dir="%PERFIL%" --disable-extensions --no-first-run --no-default-browser-check --app=%URL%
