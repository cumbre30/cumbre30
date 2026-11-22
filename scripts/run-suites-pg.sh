#!/usr/bin/env bash
# ============================================================
# run-suites-pg.sh — ejecuta las 7 suites que requieren
# PostgreSQL real (criterio pendiente del cierre del Motor GPS).
#
# Precondiciones (corridas antes por el operador):
#   bash scripts/setup-postgres-dev.sh      # PG 17 en 127.0.0.1:5433
#   DATABASE_URL=… npx prisma db push       # esquema sincronizado
#
# Uso: bash scripts/run-suites-pg.sh
# Salida: log completo en scripts/suites-pg.log + resumen aquí.
# ============================================================
set -u
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export DATABASE_URL="postgresql://postgres@127.0.0.1:5433/cumbre30"
LOG="scripts/suites-pg.log"
SUITES=(api-routes catalogo-geo comunidad cultura fase-f muro-experiencias pro-muro)

: > "$LOG"
fallidas=0
for s in "${SUITES[@]}"; do
  echo "── $s ───────────────────────────────"
  echo "── $s ───────────────────────────────" >> "$LOG"
  if npx tsx "tests/$s.test.ts" >> "$LOG" 2>&1; then
    # Última línea del bloque de la suite (suele ser «N/N OK»)
    colita=$(awk "/── $s ─+/{f=1;next} /── /{f=0} f" "$LOG" | grep -v '^\s*$' | tail -1)
    echo "  PASS $s  ${colita}"
  else
    echo "  FAIL $s"
    fallidas=$((fallidas+1))
  fi
done

echo "═══════════════════════════════════════"
echo "Resultado: $(( ${#SUITES[@]} - fallidas ))/${#SUITES[@]} suites OK (detalle en $LOG)"
exit $(( fallidas > 0 ? 1 : 0 ))
