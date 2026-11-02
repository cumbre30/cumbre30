#!/usr/bin/env bash
# Export estático de la web para el APK (Capacitor).
# Las rutas API (Prisma/cookies) no existen en el APK: se excluyen temporalmente.
set -e
cd /home/z/my-project

if [ -d src/app/api ]; then
  mv src/app/api /tmp/api-routes-apk-backup
  echo "API excluida del export"
fi
trap 'if [ -d /tmp/api-routes-apk-backup ] && [ ! -d src/app/api ]; then mv /tmp/api-routes-apk-backup src/app/api; echo "API restaurada"; fi' EXIT

# NEXT_PUBLIC_STATIC=1: activa el modo offline en el bundle (auth y logros
# por localStorage en vez de /api/*, que no existe dentro del APK).
NEXT_PUBLIC_STATIC=1 STATIC_EXPORT=1 npx next build
echo "EXPORT_OK: $(du -sh build-static | cut -f1)"
