#!/usr/bin/env bash
# ============================================================
# Guard de migraciones (arquitectura v2.1, cambio C7 / CT-M1):
# prisma migrate deploy se ejecuta ÚNICAMENTE en el build de
# producción de Vercel (VERCEL_ENV=production). Los despliegues
# de preview y desarrollo corren solo `prisma generate` — un
# preview jamás muta el esquema, ni siquiera si su DATABASE_URL
# apuntara a producción por error de configuración.
#
# Respaldo antes de migrar (cambio C8): en producción, si existe
# pg_dump en el entorno, se toma un snapshot del esquema+datos
# como archivo antes de aplicar la migración (best-effort: un
# fallo del dump NO bloquea el deploy; PITR de Neon es la red
# principal).
# ============================================================
set -e
cd "$(dirname "$0")/.."

ENV="${VERCEL_ENV:-development}"
echo "[migrate-deploy] VERCEL_ENV=${ENV}"

if [ "$ENV" = "production" ]; then
  if [ -n "$DATABASE_URL" ] && command -v pg_dump > /dev/null 2>&1; then
    STAMP="$(date +%Y%m%d-%H%M%S)"
    OUT=".migrate-backup-${STAMP}.sql"
    echo "[migrate-deploy] respaldo previo → ${OUT}"
    pg_dump "$DATABASE_URL" > "$OUT" 2>/dev/null || echo "[migrate-deploy] aviso: pg_dump falló; se continúa (PITR de Neon es la red principal)."
  fi
  echo "[migrate-deploy] producción: aplicando migraciones (migrate deploy)…"
  npx prisma migrate deploy
  echo "[migrate-deploy] migraciones aplicadas."
else
  echo "[migrate-deploy] ${ENV}: NO se ejecutan migraciones (solo generate)."
fi
