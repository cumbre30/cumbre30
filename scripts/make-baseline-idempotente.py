#!/usr/bin/env python3
# ============================================================
# Convierte el baseline de migraciones en idempotente para que el
# PRIMER deploy de producción no necesite el `migrate resolve`
# manual (criterio fase A, runbook §9.1 v2.1): sobre una base que
# ya tiene las tablas (creada históricamente con db push), el
# baseline aplica como no-op y la migración del módulo crea las 11
# tablas nuevas en la misma pasada del guard VERCEL_ENV=production.
#
# Transformaciones:
#   CREATE TABLE "X"          → CREATE TABLE IF NOT EXISTS "X"
#   CREATE [UNIQUE] INDEX "Y" → CREATE [UNIQUE] INDEX IF NOT EXISTS
#   ALTER TABLE ... ADD CONSTRAINT ...;  → bloque DO con manejo de
#                               duplicate_object (Postgres no tiene
#                               ADD CONSTRAINT IF NOT EXISTS).
# Conserva el SQL canónico original en scripts/backup-baseline-canonical.sql
# ============================================================
import re, shutil

SRC = "prisma/migrations/20261121000000_init_baseline/migration.sql"
BACKUP = "scripts/backup-baseline-canonical.sql"

sql = open(SRC, encoding="utf-8").read()
shutil.copyfile(SRC, BACKUP)

lineas_salida = []
en_do = False
for linea in sql.splitlines():
    if en_do:
        lineas_salida.append(linea)
        if linea.strip() == "END $$;":
            en_do = False
        continue
    s = linea.strip()
    # CREATE TABLE → IF NOT EXISTS
    m = re.match(r'^CREATE TABLE ("[^"]+") \($', s)
    if m:
        lineas_salida.append(linea.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ", 1))
        continue
    # CREATE [UNIQUE] INDEX → IF NOT EXISTS
    m = re.match(r'^(CREATE(?: UNIQUE)? INDEX) ("[^"]+")', s)
    if m:
        lineas_salida.append(re.sub(r'^(CREATE(?: UNIQUE)? INDEX) ', r'\1 IF NOT EXISTS ', linea, count=1))
        continue
    # ALTER TABLE ... ADD CONSTRAINT ...; → bloque DO idempotente
    if s.startswith("ALTER TABLE ") and "ADD CONSTRAINT" in s and s.endswith(";"):
        indent = linea[: len(linea) - len(linea.lstrip())]
        lineas_salida.append(f"{indent}DO $$ BEGIN")
        lineas_salida.append(f"{indent}    {s}")
        lineas_salida.append(f"{indent}EXCEPTION")
        lineas_salida.append(f"{indent}    WHEN duplicate_object THEN NULL;")
        lineas_salida.append(f"{indent}END $$;")
        en_do = False
        continue
    lineas_salida.append(linea)

open(SRC, "w", encoding="utf-8").write("\n".join(lineas_salida) + "\n")

n_tablas = sum(1 for l in lineas_salida if "CREATE TABLE IF NOT EXISTS" in l)
n_idx = sum(1 for l in lineas_salida if re.search(r'CREATE (?:UNIQUE )?INDEX IF NOT EXISTS', l))
n_do = sum(1 for l in lineas_salida if l.strip() == "DO $$ BEGIN")
print(f"baseline idempotente: {n_tablas} tablas IF NOT EXISTS, {n_idx} índices IF NOT EXISTS, {n_do} constraints en DO-block")
assert n_tablas == 14 and n_do > 0, "transformación incompleta"
print("OK — canónico conservado en", BACKUP)
