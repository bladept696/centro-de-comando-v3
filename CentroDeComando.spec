# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

# Ecrã físico: o esptool grava o programa (screen_fw/hc-screen.bin, feito pelo build_screen_fw.py) e precisa
# dos seus ficheiros de dados (stubs de cada chip); o pyserial lista as portas USB.
a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[('nerdqaxe-dashboard.html', '.'), ('dashboard', 'dashboard'), ('overlay-obs.html', '.'), ('bitminer33-banner.png', '.'), ('baroneclub-banner.png', '.'), ('lightning-qrcode.png', '.'), ('app_icon.ico', '.'), ('screen_fw', 'screen_fw')] + collect_data_files('esptool'),
    hiddenimports=['paho.mqtt.client', 'pystray._win32', 'cryptography.hazmat.primitives.asymmetric.ed25519', 'PIL._tkinter_finder', 'serial.tools.list_ports'] + collect_submodules('esptool'),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='CentroDeComando',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['app_icon.ico'],
)
