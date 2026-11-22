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
  if npx prisma migrate deploy > /tmp/migrate-deploy.log 2>&1; then
    echo "[migrate-deploy] migraciones aplicadas."
    # Cultura Ciclista (2026-11-22): semilla editorial idempotente en el
    # build de producción — solo llena si el catálogo está incompleto
    # (el guard interno salta si ya están los recursos).
    node scripts/semilla-cultura.mjs || echo "[migrate-deploy] aviso: semilla de Cultura omitida (no bloquea el deploy)."
  elif grep -q "database schema is not empty" /tmp/migrate-deploy.log; then
    # Primer deploy sobre la base histórica (creada con db push: tiene
    # tablas pero sin historial de migraciones). Baselining automático
    # CON PRUEBA, en dos modos:
    #  (a) el esquema vivo coincide EXACTAMENTE con el baseline canónico
    #      (diff solo lectura vacío) → se marca aplicado (resolve) y el
    #      deploy crea solo el delta del módulo;
    #  (b) el esquema vivo es un SUBCONJUNTO del baseline (solo le faltan
    #      objetos que el baseline crea: tablas/índices, sin ALTER sobre
    #      tablas existentes ni DROP) → se crea _prisma_migrations y el
    #      deploy EJECUTA el baseline idempotente (no-op en lo existente,
    #      crea lo faltante): producción converge al esquema declarado.
    #  Cualquier otra divergencia aborta sin tocar nada (revisión manual).
    echo "[migrate-deploy] base con esquema existente y sin historial: verificando coincidencia con el baseline canónico…"
    DIFF=$(npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel scripts/backup-schema-baseline.prisma --script 2>&1) || {
      echo "[migrate-deploy] FALLO: no se pudo leer el estado de la base para el diff."; exit 1; }
    if echo "$DIFF" | grep -q "This is an empty migration"; then
      echo "[migrate-deploy] coincidencia EXACTA con el baseline: baselining automático (resolve --applied 20261121000000_init_baseline)."
      npx prisma migrate resolve --applied 20261121000000_init_baseline
      npx prisma migrate deploy
      echo "[migrate-deploy] migraciones aplicadas."
    else
      # Modo (b): el diff solo puede AÑADIR objetos que faltan.
      # Prohibido: cualquier DROP de objetos, cambios de tipo/nulabilidad
      # o ADD COLUMN (deriva en tablas existentes).
      # Benigno (permitido y reportado): ALTER COLUMN ... DROP DEFAULT
      # (default de BD extra que el esquema no declara — el baseline
      # idempotente no ejecuta statements del diff y no lo toca) y
      # ALTER TABLE ADD CONSTRAINT sobre tablas que el MISMO diff crea.
      PROHIBIDO=$(printf '%s\n' "$DIFF" | grep -iE '^\s*(DROP |ALTER TABLE .* (ALTER COLUMN .* (SET NOT NULL|DROP NOT NULL|SET DEFAULT)|ALTER COLUMN .* TYPE|ADD COLUMN)|DELETE FROM |UPDATE )' || true)
      if [ -n "$PROHIBIDO" ]; then
        echo "[migrate-deploy] FALLO: el esquema de producción DIFIERE del baseline en algo destructivo o no cubierto:"
        echo "$PROHIBIDO" | head -10
        echo "[migrate-deploy] Revisar con: npx prisma migrate diff --from-url \$DATABASE_URL --to-schema-datamodel scripts/backup-schema-baseline.prisma --script"
        exit 1
      fi
      BENIGNO=$(printf '%s\n' "$DIFF" | grep -E '^ALTER TABLE "[^"]+" ALTER COLUMN "[^"]+" DROP DEFAULT' || true)
      if [ -n "$BENIGNO" ]; then
        echo "[migrate-deploy] deriva benigna (defaults de BD extra, sin efecto funcional; NO se ejecuta nada sobre ellas):"
        echo "$BENIGNO" | head -10
      fi
      TABLAS_NUEVAS=$(printf '%s\n' "$DIFF" | grep -oE '^CREATE TABLE "[^"]+"' | sed 's/CREATE TABLE "//; s/"$//' || true)
      MAL_ALTER=$(printf '%s\n' "$DIFF" | grep -oE '^ALTER TABLE "[^"]+"' | sed 's/ALTER TABLE "//; s/"$//' | while read -r t; do
        echo "$TABLAS_NUEVAS" | grep -qx "$t" && continue
        echo "$BENIGNO" | grep -qF "ALTER TABLE \"$t\"" && continue
        echo "$t"
      done || true)
      if [ -n "$MAL_ALTER" ]; then
        echo "[migrate-deploy] FALLO: el diff altera tablas existentes (${MAL_ALTER}) — no es un subconjunto seguro."
        exit 1
      fi
      echo "[migrate-deploy] el esquema vivo es subconjunto del baseline (solo faltan objetos): modo-ejecución."
      echo "[migrate-deploy] creando _prisma_migrations vacía (prisma db execute)…"
      printf '%s\n' \
        'CREATE TABLE IF NOT EXISTS "_prisma_migrations" (' \
        '    "id" VARCHAR(36) NOT NULL,' \
        '    "checksum" VARCHAR(64) NOT NULL,' \
        '    "finished_at" TIMESTAMPTZ(3),' \
        '    "migration_name" VARCHAR(255) NOT NULL,' \
        '    "logs" TEXT,' \
        '    "rolled_back_at" TIMESTAMPTZ(3),' \
        '    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),' \
        '    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,' \
        '    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")' \
        ');' | npx prisma db execute --stdin --schema prisma/schema.prisma
      npx prisma migrate deploy
      echo "[migrate-deploy] migraciones aplicadas (baseline ejecutado idempotentemente + módulo)."
    fi
  else
    cat /tmp/migrate-deploy.log
    exit 1
  fi
else
  echo "[migrate-deploy] ${ENV}: NO se ejecutan migraciones (solo generate)."
fi
