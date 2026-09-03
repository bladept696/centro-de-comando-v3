@echo off
REM ============================================================================
REM  build_installer.bat - compila o Centro de Comando e gera o instalador
REM
REM  Pré-requisitos:
REM   - build_exe.bat já configurado e a funcionar (PyInstaller instalado)
REM   - Inno Setup instalado em C:\Program Files (x86)\Inno Setup 6\
REM     (ajusta o caminho ISCC.EXE abaixo se tiveres instalado noutro sitio)
REM ============================================================================

setlocal

echo.
echo === 1/2: a compilar o executavel com PyInstaller ===
call build_exe.bat
if errorlevel 1 (
    echo.
    echo [ERRO] build_exe.bat falhou - a parar antes de gerar o instalador.
    exit /b 1
)

set ISCC="C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if not exist %ISCC% (
    set ISCC="C:\Program Files\Inno Setup 6\ISCC.exe"
)
if not exist %ISCC% (
    echo.
    echo [ERRO] Nao encontrei o ISCC.exe do Inno Setup. Instala-o em:
    echo        https://jrsoftware.org/isdl.php
    echo        ou ajusta o caminho no topo deste .bat.
    exit /b 1
)

echo.
echo === 2/2: a gerar o instalador com o Inno Setup ===
%ISCC% CentroDeComando.iss
if errorlevel 1 (
    echo.
    echo [ERRO] O Inno Setup falhou a compilar o instalador.
    exit /b 1
)

echo.
echo === Concluido! Instalador disponivel em Output\ ===
endlocal
