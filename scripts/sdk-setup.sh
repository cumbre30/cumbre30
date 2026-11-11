#!/usr/bin/env bash
# Instala el SDK de Android en el sandbox (no persiste entre sesiones:
# solo git persiste — correr de nuevo tras un reciclaje).
#   Uso: bash scripts/sdk-setup.sh
set -e
SDK=${ANDROID_SDK_DIR:-$HOME/android-sdk}
CLT_ZIP="commandlinetools-linux-11076708_latest.zip"
CLT_URL="https://dl.google.com/android/repository/$CLT_ZIP"

if [ -d "$SDK/platforms/android-36" ] && [ -d "$SDK/build-tools" ]; then
  echo "SDK ya instalado en $SDK"
  exit 0
fi

mkdir -p "$SDK/cmdline-tools"
echo "Descargando cmdline-tools..."
curl -sS -o /tmp/clt.zip "$CLT_URL"
unzip -q -o /tmp/clt.zip -d "$SDK/cmdline-tools"
rm -rf "$SDK/cmdline-tools/latest"
mv "$SDK/cmdline-tools/cmdline-tools" "$SDK/cmdline-tools/latest"

SDKM="$SDK/cmdline-tools/latest/bin/sdkmanager"
echo "Aceptando licencias..."
yes | "$SDKM" --sdk_root="$SDK" --licenses > /dev/null 2>&1 || true

echo "Instalando platform-tools + android-36 + build-tools 36..."
yes | "$SDKM" --sdk_root="$SDK" "platform-tools" "platforms;android-36" "build-tools;36.0.0" > /tmp/sdkmgr.log 2>&1
tail -2 /tmp/sdkmgr.log

echo "sdk.dir=$SDK" > /home/z/my-project/android/local.properties
echo "SDK listo: $SDK (local.properties actualizado)"
