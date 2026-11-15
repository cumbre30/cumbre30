#!/usr/bin/env bash
# Export estático de la web para el APK (Capacitor).
# Las rutas API (Prisma/cookies) no existen en el APK: se excluyen temporalmente.
set -e
# Raíz del proyecto relativa al propio script (funciona local y en CI).
cd "$(dirname "$0")/.."

if [ -d src/app/api ]; then
  mv src/app/api /tmp/api-routes-apk-backup
  echo "API excluida del export"
fi
trap 'if [ -d /tmp/api-routes-apk-backup ] && [ ! -d src/app/api ]; then mv /tmp/api-routes-apk-backup src/app/api; echo "API restaurada"; fi' EXIT

# NEXT_PUBLIC_STATIC=1: activa el modo offline en el bundle (auth y logros
# por localStorage en vez de /api/*, que no existe dentro del APK).
# NEXT_PUBLIC_BACKEND_ORIGIN: origen del backend horneado — el sync de
# progreso (outbox en IndexedDB + token Bearer) apunta a la web desplegada.
# PLAY_BUILD=1: build para Google Play (NEXT_PUBLIC_PLAY_BUILD=1) — muestra
# la compra con Play Billing y oculta cualquier mención de pago externo.
node scripts/gen-version-json.mjs
NEXT_PUBLIC_STATIC=1 NEXT_PUBLIC_BACKEND_ORIGIN="https://cumbregeo.cl" STATIC_EXPORT=1 NEXT_PUBLIC_PLAY_BUILD=${PLAY_BUILD:-0} npx next build
echo "EXPORT_OK: $(du -sh build-static | cut -f1)"
