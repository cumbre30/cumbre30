#!/usr/bin/env bash
# Instala Android SDK cmdline-tools + componentes para compilar el APK de Cumbre30.
set -e
SDK=/home/z/my-project/tools/android-sdk
mkdir -p "$SDK/cmdline-tools"

echo "[1/4] Descargando commandlinetools..."
curl -fsSL -o /tmp/clt.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip

echo "[2/4] Descomprimiendo..."
rm -rf /tmp/clt-extract && python3 -m zipfile -e /tmp/clt.zip /tmp/clt-extract
rm -rf "$SDK/cmdline-tools/latest"
mv /tmp/clt-extract/cmdline-tools "$SDK/cmdline-tools/latest"

export JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(which java)")")")"
export ANDROID_HOME="$SDK"

echo "[3/4] Aceptando licencias..."
yes | "$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" --licenses > /tmp/sdk-licenses.log 2>&1 || true

echo "[4/4] Instalando platform-tools, platforms y build-tools..."
"$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" \
  "platform-tools" "platforms;android-35" "platforms;android-34" \
  "build-tools;35.0.0" "build-tools;34.0.0" > /tmp/sdk-install.log 2>&1

echo "SDK_LISTO"
