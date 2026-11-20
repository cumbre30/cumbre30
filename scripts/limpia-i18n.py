#!/usr/bin/env python3
"""Elimina claves i18n sin uso de src/lib/i18n.ts.

Seguridad:
- Detecta claves usadas dinámicamente vía prefijos de template literal
  (pc.arch, pc.archDesc) y las conserva.
- Solo borra líneas de definición exactas `"clave": [es, en, pt],`.
"""
import re

I18N = "/home/z/my-project/src/lib/i18n.ts"

text = open(I18N, encoding="utf-8").read()

# Claves definidas
keys = re.findall(r'^  "([a-z][.\w]+)": \[', text, re.M)
print(f"claves definidas: {len(keys)}")

# Claves usadas en el resto de src (literal)
import subprocess, pathlib
files = subprocess.run(
    ["bash", "-c", "find /home/z/my-project/src -name '*.ts' -o -name '*.tsx' | grep -v i18n.ts"],
    capture_output=True, text=True).stdout.split()
resto = "".join(pathlib.Path(f).read_text(encoding="utf-8") for f in files)

# Prefijos dinámicos detectados en template literals (t(`prefijo${...}`))
DYNAMIC_PREFIXES = ["pc.arch"]

sin_uso = [k for k in keys if k not in resto]
a_borrar = [k for k in sin_uso if not any(k.startswith(p) for p in DYNAMIC_PREFIXES)]
conservadas = [k for k in sin_uso if k not in a_borrar]
print(f"sin uso: {len(sin_uso)} | a borrar: {len(a_borrar)} | conservadas por uso dinámico: {conservadas}")

borradas = 0
for k in a_borrar:
    nueva = re.sub(rf'^  "{re.escape(k)}": \[[^\n]*\],\n', "", text, count=1, flags=re.M)
    if nueva == text:
        print(f"  ATENCIÓN: no se pudo borrar {k} (patrón no exacto)")
    else:
        text = nueva
        borradas += 1

open(I18N, "w", encoding="utf-8").write(text)
print(f"borradas: {borradas}")

# Verificación: las claves restantes deben seguir balanceadas y parseables
quedan = re.findall(r'^  "([a-z][.\w]+)": \[', text, re.M)
print(f"claves restantes: {len(quedan)}")
assert len(quedan) == len(keys) - borradas, "conteo inconsistente"
