#!/usr/bin/env bash
# Build do Centro de Comando para Linux (AppImage) e Mac (.zip com o .app).
# Uso:  ./build_unix.sh        (no Linux ou no Mac; o GitHub Actions corre-o nos dois)
# Resultado em Output/: CentroDeComando-<versão>-linux-<x86_64|arm64>.AppImage  ou  CentroDeComando-<versão>-mac-<arm64|x64>.zip
# Estes nomes são os que a atualização automática procura (app.py: _update_asset_for_this_os).
set -euo pipefail
cd "$(dirname "$0")"

VER=$(grep -m1 '^APP_VERSION = ' app.py | sed -E 's/.*"(.*)".*/\1/')
ARCH=$(uname -m); [ "$ARCH" = "aarch64" ] && ARCH=arm64
PY=${PYTHON:-python3}
mkdir -p Output

"$PY" -m pip install --quiet --upgrade pip pyinstaller
"$PY" -m pip install --quiet -r requirements.txt
"$PY" -m PyInstaller --noconfirm --clean CentroDeComando-unix.spec

if [ "$(uname)" = "Darwin" ]; then
  [ "$ARCH" = "x86_64" ] && MARCH=x64 || MARCH=arm64
  OUT="Output/CentroDeComando-${VER}-mac-${MARCH}.zip"
  rm -f "$OUT"
  # ditto mantém o .app inteiro (ligações e permissões) dentro do zip
  ditto -c -k --sequesterRsrc --keepParent dist/CentroDeComando.app "$OUT"
else
  APPDIR=build/AppDir
  rm -rf "$APPDIR"; mkdir -p "$APPDIR/usr/bin"
  cp -a dist/CentroDeComando "$APPDIR/usr/bin/"
  "$PY" -c "from PIL import Image; Image.open('app_icon.ico').convert('RGBA').resize((256,256)).save('$APPDIR/centrodecomando.png')"
  cat > "$APPDIR/AppRun" <<'EOS'
#!/bin/sh
HERE="$(dirname "$(readlink -f "$0")")"
exec "$HERE/usr/bin/CentroDeComando/CentroDeComando" "$@"
EOS
  chmod +x "$APPDIR/AppRun"
  cat > "$APPDIR/centrodecomando.desktop" <<'EOS'
[Desktop Entry]
Type=Application
Name=Centro de Comando
Comment=Hash Commander: painel das máquinas de mineração
Exec=CentroDeComando
Icon=centrodecomando
Categories=Utility;Network;
Terminal=false
EOS
  TOOL=build/appimagetool-${ARCH}.AppImage
  [ "$ARCH" = "arm64" ] && TA=aarch64 || TA=$ARCH
  if [ ! -x "$TOOL" ]; then
    curl -fsSL -o "$TOOL" "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-${TA}.AppImage"
    chmod +x "$TOOL"
  fi
  OUT="Output/CentroDeComando-${VER}-linux-${ARCH}.AppImage"
  # sem FUSE (ex.: WSL, contentores do CI) o appimagetool corre extraído
  ARCH=$TA APPIMAGE_EXTRACT_AND_RUN=1 "$TOOL" --no-appstream "$APPDIR" "$OUT"
fi
ls -la "$OUT"
echo "ok: $OUT"
