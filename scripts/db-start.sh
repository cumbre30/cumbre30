#!/usr/bin/env bash
# Levanta el Postgres local de desarrollo (PG 18) desde los binarios
# embebidos en node_modules, reutilizando el data dir db/pgdata.
#   Uso: bash scripts/db-start.sh
# Auth trust local → DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres
# ⚠️ El sandbox exporta DATABASE_URL global (file:...) que GANA sobre .env:
#    arranca el server y corre comandos prisma con DATABASE_URL inline.
set -e
cd "$(dirname "$0")/.."
export LD_LIBRARY_PATH="$PWD/node_modules/@embedded-postgres/linux-x64/native/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
PGBIN="$PWD/node_modules/@embedded-postgres/linux-x64/native/bin"

if "$PGBIN/pg_ctl" -D db/pgdata status > /dev/null 2>&1; then
  echo "Postgres ya está corriendo."
else
  # El snapshot del sandbox puede perder directorios runtime vacíos y permisos
  mkdir -p db/pgdata/pg_notify db/pgdata/pg_tblspc db/pgdata/pg_replslot \
           db/pgdata/pg_stat db/pgdata/pg_stat_tmp db/pgdata/pg_subtrans \
           db/pgdata/pg_twophase db/pgdata/pg_commit_ts db/pgdata/pg_serial \
           db/pgdata/pg_logical/snapshots db/pgdata/pg_logical/mappings
  chmod 700 db/pgdata
  rm -f db/pgdata/postmaster.pid
  "$PGBIN/pg_ctl" -D db/pgdata -l db/pg.log -o "-p 5432 -k /tmp" start
  sleep 1
  echo "Postgres 18 arriba en 127.0.0.1:5432 (socket /tmp)."
fi
