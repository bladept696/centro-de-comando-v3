# -*- mode: python ; coding: utf-8 -*-
# Build para Mac (.app) e Linux (pasta que o build_unix.sh transforma em AppImage).
# No Windows continua a ser usado o CentroDeComando.spec (um .exe).
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

IS_MAC = sys.platform == 'darwin'
datas = [('nerdqaxe-dashboard.html', '.'), ('dashboard', 'dashboard'), ('overlay-obs.html', '.'), ('bitminer33-banner.png', '.'),
         ('baroneclub-banner.png', '.'), ('lightning-qrcode.png', '.'), ('app_icon.ico', '.'), ('screen_fw', 'screen_fw'),
         ('extensao-telegram', 'extensao-telegram')] + collect_data_files('esptool')
hidden = ['paho.mqtt.client', 'cryptography.hazmat.primitives.asymmetric.ed25519', 'serial.tools.list_ports'] + \
    collect_submodules('esptool') + collect_submodules('pystray')

a = Analysis(['app.py'], pathex=[], binaries=[], datas=datas, hiddenimports=hidden, hookspath=[], hooksconfig={},
             runtime_hooks=[], excludes=['winotify'], noarchive=False, optimize=0)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='CentroDeComando', debug=False, bootloader_ignore_signals=False,
          strip=False, upx=False, console=False, disable_windowed_traceback=False, argv_emulation=False,
          target_arch=None, codesign_identity=None, entitlements_file=None, icon=['app_icon.ico'])
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, upx_exclude=[], name='CentroDeComando')
if IS_MAC:
    app = BUNDLE(coll, name='CentroDeComando.app', icon='app_icon.ico', bundle_identifier='pt.hashcommander.centrodecomando',
                 info_plist={'CFBundleName': 'Centro de Comando', 'CFBundleDisplayName': 'Centro de Comando',
                             'LSUIElement': False, 'NSHighResolutionCapable': True})
