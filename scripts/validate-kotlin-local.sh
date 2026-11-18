#!/usr/bin/env bash
# ============================================================
# Validación local de Kotlin sin keystore (el keystore solo lo
# usa la firma release, y CI lo provee). Replica los pasos del
# export de build-android.sh + compileReleaseKotlin.
# Uso: bash scripts/validate-kotlin-local.sh
# ============================================================
set -euo pipefail
cd /home/z/my-project

export JAVA_HOME="$PWD/tools/jdk"
export ANDROID_HOME="$PWD/tools/android-sdk"
GRADLE_INIT="$PWD/scripts/gradle-mirror-init.gradle"

echo "sdk.dir=$PWD/tools/android-sdk" > android/local.properties

API_DIR="src/app/api"
TMP_API=".build-android-tmp/api-off"
if [ ! -d "$API_DIR" ] && [ -d "$TMP_API/api" ]; then
  mv "$TMP_API/api" "$API_DIR"
  echo "API recuperada de una ejecución anterior interrumpida"
fi
rm -rf .build-android-tmp && mkdir -p "$TMP_API"
mv "$API_DIR" "$TMP_API/"
restore_api() {
  if [ -d "$TMP_API/api" ]; then
    rm -rf "$API_DIR"
    mv "$TMP_API/api" "$API_DIR"
  fi
  rm -rf .build-android-tmp
}
trap restore_api EXIT

echo "[1/3] Export estático web..."
NEXT_PUBLIC_STATIC=1 STATIC_EXPORT=1 NEXT_PUBLIC_PLAY_BUILD=0 npx next build
restore_api
trap - EXIT
[ -f build-static/index.html ] || { echo "ERROR: sin build-static/index.html"; exit 1; }
echo "  build-static OK"

echo "[2/3] cap sync android..."
npx cap sync android

echo "[3/3] compileReleaseKotlin (validación de Kotlin + MapLibre 13.7.1)..."
cd android
./gradlew :app:compileReleaseKotlin --no-daemon --init-script "$GRADLE_INIT"
echo "VALIDACION_KOTLIN_OK"
