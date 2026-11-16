#!/usr/bin/env python3
"""Scan de acentos sobre src/components/*.tsx + src/app/page.tsx.
Marca cada linea con acentos como COMENTARIO (// o /* o *), CODIGO-STRING
(literales entre comillas con acentos) o CODIGO-OTRO (acentos fuera de
strings, p.ej. comparaciones). Solo imprime lo problematico por defecto.
"""
import glob
import re
import sys

FILES = sorted(glob.glob("src/components/*.tsx")) + ["src/app/page.tsx"]

ACCENTS = "áéíóúñüÁÉÍÓÚÑÜ¿¡"
STRING_RE = re.compile(r'"([^"]*)|\'([^\']*)|`([^`]*)')

def strip_comment(line: str) -> str:
    # corta la parte de la linea que esta dentro de un comentario //
    idx = line.find("//")
    # evitar falsos positivos: '//' dentro de 'https://'
    while idx != -1:
        before = line[:idx]
        if before.count('"') % 2 == 0 and before.count("'") % 2 == 0:
            return before
        idx = line.find("//", idx + 1)
    return line

def classify(path: str):
    problems = []
    with open(path, encoding="utf-8") as f:
        for n, raw in enumerate(f, 1):
            if not any(c in ACCENTS for c in raw):
                continue
            line = raw.rstrip("\n")
            stripped = line.strip()
            # comentarios JS/JSX claros
            if stripped.startswith(("//", "*", "/*")) or stripped.startswith("{/*"):
                continue
            code = strip_comment(line)
            if not any(c in ACCENTS for c in code):
                continue  # acentos solo en comentario
            # hay acentos en codigo: ver si estan dentro de un string literal
            in_string = False
            quote = None
            acc_in_string = False
            i = 0
            while i < len(code):
                c = code[i]
                if in_string:
                    if c == "\\":
                        i += 2
                        continue
                    if c == quote:
                        in_string = False
                    elif c in ACCENTS:
                        acc_in_string = True
                else:
                    if c in "\"'`":
                        in_string = True
                        quote = c
                    elif c in ACCENTS:
                        acc_in_string = True  # acento fuera de string
                i += 1
            kind = "STRING" if acc_in_string and not in_string else "CODE"
            problems.append((n, kind, line.strip()[:160]))
    return problems

all_problems = []
for path in FILES:
    probs = classify(path)
    if probs:
        print(f"== {path}")
        for n, kind, txt in probs:
            print(f"  L{n} [{kind}] {txt}")
        all_problems.extend((path, p) for p in probs)

print(f"\nTOTAL lineas con acentos en codigo: {len(all_problems)}")
