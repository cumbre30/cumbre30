#!/usr/bin/env python3
"""Verificación i18n fase 3 (2026-11-16).
(a) Scan de acentos sobre src/components/*.tsx + src/app/page.tsx
    con seguimiento de comentarios de bloque multilinea: reporta
    solo acentos en CODIGO (strings visibles u otra cosa).
(b) Chequeo de claves: toda clave usada via t("...") o referenciada
    como literal "p.*"/"plan.*" en src debe estar definida en D.
"""
import glob
import re
import sys

ACCENTS = "áéíóúñüÁÉÍÓÚÑÜ¿¡"

# ---------- (a) scan de acentos ----------
FILES = sorted(glob.glob("src/components/*.tsx")) + ["src/app/page.tsx"]

def strip_line_comment(line: str) -> str:
    idx = line.find("//")
    while idx != -1:
        before = line[:idx]
        if before.count('"') % 2 == 0 and before.count("'") % 2 == 0:
            return before
        idx = line.find("//", idx + 1)
    return line

def scan_file(path: str):
    problems = []
    in_block = False  # /* ... */ multilinea
    with open(path, encoding="utf-8") as f:
        for n, raw in enumerate(f, 1):
            line = raw.rstrip("\n")
            code = line
            if in_block:
                end = code.find("*/")
                if end == -1:
                    continue  # linea 100% comentario
                code = code[end + 2:]
                in_block = False
            # procesar la linea por segmentos (comentario de bloque en linea)
            out = []
            i = 0
            while i < len(code):
                if code.startswith("/*", i):
                    end = code.find("*/", i + 2)
                    if end == -1:
                        in_block = True
                        i = len(code)
                        break
                    i = end + 2
                elif code.startswith("//", i):
                    before = "".join(out) + code[:i]
                    if before.count('"') % 2 == 0 and before.count("'") % 2 == 0:
                        i = len(code)
                        break
                    out.append(code[i])
                    i += 1
                else:
                    out.append(code[i])
                    i += 1
            code = "".join(out)
            if not any(c in ACCENTS for c in code):
                continue
            # clasificar: acento dentro de string literal?
            in_string = False
            quote = None
            in_str_acc = False
            out_acc = False
            j = 0
            while j < len(code):
                c = code[j]
                if in_string:
                    if c == "\\":
                        j += 2
                        continue
                    if c == quote:
                        in_string = False
                    elif c in ACCENTS:
                        in_str_acc = True
                else:
                    if c in "\"'`":
                        in_string = True
                        quote = c
                    elif c in ACCENTS:
                        out_acc = True
                j += 1
            kind = "STRING" if in_str_acc and not out_acc else "CODE"
            problems.append((n, kind, line.strip()[:150]))
    return problems

print("=" * 30, "(a) SCAN DE ACENTOS", "=" * 30)
total = 0
for path in FILES:
    probs = scan_file(path)
    if probs:
        print(f"== {path}")
        for n, kind, txt in probs:
            print(f"  L{n} [{kind}] {txt}")
        total += len(probs)
print(f"\nTOTAL lineas con acentos en codigo: {total}")

# ---------- (b) claves usadas vs definidas ----------
print("\n" + "=" * 30, "(b) CLAVES", "=" * 30)
with open("src/lib/i18n.ts", encoding="utf-8") as f:
    dict_src = f.read()
defined = set(re.findall(r'"([A-Za-z0-9_.]+)":\s*\[', dict_src))

used = set()
src_files = sorted(glob.glob("src/**/*.ts*", recursive=True))
src_files = [p for p in src_files if "node_modules" not in p]
for path in src_files:
    if path == "src/lib/i18n.ts":
        continue
    with open(path, encoding="utf-8") as f:
        s = f.read()
    used |= set(re.findall(r'\bt\(\s*"([A-Za-z0-9_.]+)"', s))
    # claves referenciadas como valores (planData: title: "p.xxx")
    used |= set(re.findall(r'["\']([ap]\.[A-Za-z0-9_.]+)["\']', s))

missing = sorted(k for k in used if k not in defined)
if missing:
    for k in missing:
        print("SIN DEFINIR:", k)
else:
    print("OK: 0 claves usadas sin definir")
print(f"claves definidas: {len(defined)} · usadas: {len(used)}")
sys.exit(0 if (total == 0 and not missing) else 1)
