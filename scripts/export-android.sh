#!/usr/bin/env bash
# ============================================================
# export-android.sh — etapa 1 del build Android de Cumbre30:
# export estático web + sincronización Capacitor.
# (Replica el flujo STAGE=export de scripts/build-android.sh
# sin exigir el keystore de release; para APK de validación
# debug se compila después con gradle assembleDebug.)
# Uso: bash scripts/export-android.sh
# ============================================================
set -euo pipefail
cd /home/z/my-project

API_DIR="src/app/api"
TMP_API=".build-android-tmp/api-off"
# Guardia: una ejecución interrumpida pudo dejar la API movida
if [ ! -d "$API_DIR" ] && [ -d "$TMP_API/api" ]; then
  mv "$TMP_API/api" "$API_DIR"
  echo "API recuperada de una ejecución anterior interrumpida"
fi
rm -rf .build-android-tmp && mkdir -p "$TMP_API"
restore_api() {
  if [ -d "$TMP_API/api" ]; then
    rm -rf "$API_DIR"
    mv "$TMP_API/api" "$API_DIR"
  fi
  rm -rf .build-android-tmp
  echo "API restaurada: $(ls "$API_DIR" | tr '\n' ' ')"
}
trap restore_api EXIT

mv "$API_DIR" "$TMP_API/"
echo "[1/2] Export estático web (STATIC + NEXT_PUBLIC_STATIC=1 + PLAY_BUILD=0)..."
NEXT_PUBLIC_STATIC=1 STATIC_EXPORT=1 NEXT_PUBLIC_PLAY_BUILD=0 npx next build
restore_api
trap - EXIT
[ -f build-static/index.html ] || { echo "ERROR: build-static/index.html no existe"; exit 1; }
echo "  build-static OK: $(du -sh build-static | cut -f1)"

echo "[2/2] cap sync android..."
npx cap sync android
echo "STAGE_EXPORT_OK"
