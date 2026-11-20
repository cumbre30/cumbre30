#!/usr/bin/env python3
"""Reemplaza guiones largos (— em, – en) por guión normal (-) en src/.
Preserva el espaciado alrededor (solo intercambia el carácter).
Excluye node_modules y cualquier binario."""
import pathlib
import sys

ROOT = pathlib.Path("/home/z/my-project/src")
EXTS = {".ts", ".tsx"}

total_files = 0
total_repl = 0
for p in sorted(ROOT.rglob("*")):
    if p.suffix not in EXTS or not p.is_file():
        continue
    text = p.read_text(encoding="utf-8")
    n = text.count("\u2014") + text.count("\u2013")
    if n == 0:
        continue
    nuevo = text.replace("\u2014", "-").replace("\u2013", "-")
    p.write_text(nuevo, encoding="utf-8")
    total_files += 1
    total_repl += n
    print(f"{p.relative_to(ROOT.parent)}: {n} reemplazos")

print(f"\nTOTAL: {total_repl} guiones en {total_files} archivos")
resto = sum(
    p.read_text(encoding="utf-8").count("\u2014") + p.read_text(encoding="utf-8").count("\u2013")
    for p in ROOT.rglob("*") if p.suffix in EXTS and p.is_file()
)
print(f"restantes en src/: {resto}")
sys.exit(0 if resto == 0 else 1)
