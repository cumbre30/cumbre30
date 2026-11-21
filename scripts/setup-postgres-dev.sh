#!/usr/bin/env bash
# ============================================================
# Postgres local de desarrollo para Cumbre30 (sin root, sin
# servicios del sistema): usa los binarios de embedded-postgres
# que viven en node_modules. Idempotente: si el cluster ya existe,
# solo lo inicia. El data dir queda en db/pgdata (dentro del
# proyecto, sobrevive al reciclaje del sandbox).
#
#   bash scripts/setup-postgres-dev.sh
#   DATABASE_URL=postgresql://postgres@127.0.0.1:5433/cumbre30
# ============================================================
set -e
# Raíz del repo RELATIVA al script (funciona en el sandbox y en CI;
# el cd absoluto /home/z/my-project rompía la build del APK en
# GitHub Actions, donde esa ruta no existe).
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PGBIN="$PWD/node_modules/@embedded-postgres/linux-x64/native/bin"
export LD_LIBRARY_PATH="$PWD/node_modules/@embedded-postgres/linux-x64/native/lib:${LD_LIBRARY_PATH:-}"
PGDATA="$PWD/db/pgdata"
PORT=5433

if [ ! -x "$PGBIN/initdb" ]; then
  echo "ERROR: no están los binarios (npm i embedded-postgres)"; exit 1
fi

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "initdb → $PGDATA"
  "$PGBIN/initdb" -D "$PGDATA" -U postgres -E UTF8 --auth=trust > /dev/null
fi

# ¿Ya está corriendo?
if "$PGBIN/pg_ctl" -D "$PGDATA" status > /dev/null 2>&1; then
  echo "postgres ya está corriendo (puerto $PORT)"
else
  echo "iniciando postgres en 127.0.0.1:$PORT ..."
  "$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/../pg.log" \
    -o "-p $PORT -c listen_addresses=127.0.0.1" -w start > /dev/null
  echo "postgres iniciado"
fi

# ¿Existe la base? Si no, créala (CREATE DATABASE no puede correr
# dentro de una transacción ni contra la base aún inexistente —
# nos conectamos a la base 'postgres' default).
if ! npx --no-install prisma db execute --schema prisma/schema.prisma \
  --stdin <<< "SELECT 1 FROM pg_database WHERE datname='cumbre30';" > /dev/null 2>&1; then
  echo "creando base 'cumbre30'..."
  DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/postgres" \
    npx --no-install prisma db execute --schema prisma/schema.prisma \
    --stdin <<< "CREATE DATABASE cumbre30;" > /dev/null 2>&1 || true
fi

echo "LISTO — DATABASE_URL=postgresql://postgres@127.0.0.1:$PORT/cumbre30"
