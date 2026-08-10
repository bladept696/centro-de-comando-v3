@echo off
title Centro de Comando - A compilar o .exe...
echo ============================================
echo   CENTRO DE COMANDO - Compilar para .EXE
echo ============================================
echo.

REM Verifica se o Python esta instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python nao encontrado.
    echo Instala o Python em https://www.python.org/downloads/
    echo IMPORTANTE: marca a opcao "Add Python to PATH" durante a instalacao.
    pause
    exit /b 1
)

echo [1/4] A instalar o PyInstaller...
python -m pip install --upgrade pyinstaller --quiet

echo [2/4] A instalar dependencias (paho-mqtt para os Perfis de Energia)...
python -m pip install --upgrade paho-mqtt --quiet

echo [3/4] A compilar o executavel (isto pode demorar 1-2 minutos)...
python -m PyInstaller --noconfirm --onefile --windowed ^
    --name "CentroDeComando" ^
    --icon "app_icon.ico" ^
    --add-data "nerdqaxe-dashboard.html;." ^
    --add-data "bitminer33-banner.png;." ^
    --add-data "lightning-qrcode.png;." ^
    --hidden-import "paho.mqtt.client" ^
    app.py

echo [4/4] Concluido!
echo.
echo O executavel esta em: dist\CentroDeComando.exe
echo Podes copiar so esse ficheiro e enviar ao pessoal.
echo.
pause
