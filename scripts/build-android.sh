#!/usr/bin/env bash
# ============================================================
# Build Android de Cumbre30 (APK release + AAB para Play Store).
#
# Flujo completo, idempotente, sobrevive reciclajes del sandbox:
#   1. Export estático web (STATIC_EXPORT=1) → build-static/
#      · NEXT_PUBLIC_STATIC=1: auth y logros por localStorage dentro
#        del APK (¡CRÍTICO! sin esta bandera isOfflineMode() es false,
#        el login por correo y Google quedan rotos en el APK - build
#        30 salió así; el fix entró en build 31).
#      · NEXT_PUBLIC_PLAY_BUILD=PLAY_BUILD (default 0): build para
#        Google Play (1) usa Play Billing y oculta pagos externos.
#      · Las rutas API server-only se mueven a un dir temporal durante
#        el export y se restauran con trap: en el APK no sirven
#        (la app llama a cumbregeo.cl) y sin force-static rompen
#        `output: export`.
#   2. npx cap sync android (copia build-static + plugins nativos)
#   3. Gradle assembleRelease + bundleRelease (firma release:
#      android/cumbre30-release.keystore vía keystore.properties)
#
# Requisitos: bash scripts/setup-android-env.sh (JDK 21 + SDK).
#
# Uso:  PLAY_BUILD=0 bash scripts/build-android.sh   → APK directa (pagos web)
#       PLAY_BUILD=1 bash scripts/build-android.sh   → variante Play Store
#       STAGE=export bash scripts/build-android.sh   → solo pasos 1-2 (export+sync)
#       STAGE=gradle bash scripts/build-android.sh   → solo paso 3 (reusa export)
# Salida: download/cumbre30-v<ver>-code<code>[-play].apk / .aab
# ============================================================
set -euo pipefail
cd /home/z/my-project

JAVA_HOME="$PWD/tools/jdk"
export JAVA_HOME
GRADLE_INIT="$PWD/scripts/gradle-mirror-init.gradle"

# --- 0. Sanity del entorno ---
[ -x tools/jdk/bin/javac ] || { echo "FALTA JDK: bash scripts/setup-android-env.sh"; exit 1; }
[ -d tools/android-sdk/platforms/android-36 ] || { echo "FALTA SDK: bash scripts/setup-android-env.sh"; exit 1; }
[ -f android/keystore.properties ] || { echo "FALTA android/keystore.properties"; exit 1; }
echo "sdk.dir=$PWD/tools/android-sdk" > android/local.properties

# --- 1. Export estático (con api server-only fuera) ---
# Todas las rutas de src/app/api son force-dynamic (correcto en
# Vercel) o sin marker: con `output: export` fallan todas y en el
# APK no sirven (la app llama a cumbregeo.cl). Se mueve el dir
# completo a un dir temporal y se restaura con trap; así rutas
# nuevas no rompen el build del APK.
API_DIR="src/app/api"
TMP_API=".build-android-tmp/api-off"
# Guardia: una ejecución anterior interrumpida pudo dejar la API movida
# aquí dentro. Recuperarla ANTES del rm -rf (borrarla sería catastrófico).
if [ ! -d "$API_DIR" ] && [ -d "$TMP_API/api" ]; then
  mv "$TMP_API/api" "$API_DIR"
  echo "API recuperada de una ejecución anterior interrumpida"
fi
rm -rf .build-android-tmp && mkdir -p "$TMP_API"
restore_api() {
  # Solo restaura si existe la copia guardada (STAGE=gradle no mueve
  # nada: sin copia, la API real NO se toca jamás).
  if [ -d "$TMP_API/api" ]; then
    rm -rf "$API_DIR"
    mv "$TMP_API/api" "$API_DIR"
  fi
  rm -rf .build-android-tmp
  echo "API restaurada: $(ls $API_DIR | tr '\n' ' ')"
}
trap restore_api EXIT

PLAY_BUILD="${PLAY_BUILD:-0}"
STAGE="${STAGE:-full}"
ARTIFACT_SUFFIX=""
if [ "$PLAY_BUILD" = "1" ]; then ARTIFACT_SUFFIX="-play"; fi

# --- Gradle release (APK + AAB) + copia a download/ ---
gradle_and_copy() {
  echo "[3/3] Gradle assembleRelease + bundleRelease (firma release)..."
  cd android
  ./gradlew assembleRelease bundleRelease --no-daemon --init-script "$GRADLE_INIT"

  # Rutas ABSOLUTAS: el bloque de copia corre tras `cd ..`
  APK="$PWD/app/build/outputs/apk/release/app-release.apk"
  AAB="$PWD/app/build/outputs/bundle/release/app-release.aab"
  [ -f "$APK" ] || { echo "ERROR: no se generó $APK"; exit 1; }
  [ -f "$AAB" ] || { echo "ERROR: no se generó $AAB"; exit 1; }

  cd ..
  VERSION=$(rg -o 'versionName "([^"]+)"' -r '$1' android/app/build.gradle)
  CODE=$(rg -o 'versionCode ([0-9]+)' -r '$1' android/app/build.gradle)
  OUT_APK="download/cumbre30-v${VERSION}-code${CODE}${ARTIFACT_SUFFIX}.apk"
  OUT_AAB="download/cumbre30-v${VERSION}-code${CODE}${ARTIFACT_SUFFIX}.aab"
  cp "$APK" "$OUT_APK"
  cp "$AAB" "$OUT_AAB"

  echo "============================================================"
  echo "APK: $OUT_APK ($(du -h "$OUT_APK" | cut -f1))"
  echo "AAB: $OUT_AAB ($(du -h "$OUT_AAB" | cut -f1))"
  # Verificación de firma con apksigner (build-tools)
  BT="tools/android-sdk/build-tools/36.0.0"
  "$BT/apksigner" verify --print-certs "$OUT_APK" | head -4 || echo "apksigner no disponible"
  echo "BUILD_ANDROID_OK"
}

if [ "$STAGE" = "gradle" ]; then
  # Solo gradle + copia de artefactos: reutiliza el export ya sincronizado
  # por una ejecución STAGE=export previa (misma PLAY_BUILD). No se toca
  # la API ni el export web.
  gradle_and_copy
  exit 0
fi

mv "$API_DIR" "$TMP_API/"

echo "[1/3] Export estático web (STATIC + NEXT_PUBLIC_STATIC=1 + PLAY_BUILD=$PLAY_BUILD)..."
NEXT_PUBLIC_STATIC=1 STATIC_EXPORT=1 NEXT_PUBLIC_PLAY_BUILD="$PLAY_BUILD" npx next build
restore_api
trap - EXIT
[ -f build-static/index.html ] || { echo "ERROR: build-static/index.html no existe"; exit 1; }
echo "  build-static OK: $(du -sh build-static | cut -f1)"

# --- 2. Sync Capacitor ---
echo "[2/3] cap sync android..."
npx cap sync android

if [ "$STAGE" = "export" ]; then
  echo "STAGE_EXPORT_OK (gradle queda pendiente: STAGE=gradle)"
  exit 0
fi
gradle_and_copy
