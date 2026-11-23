#!/usr/bin/env python3
"""Busca fichas buscalibre.cl (/libro-...) para los 8 borradores ES previos."""
import json, re, subprocess, time

QUERIES = [
    ("El ciclista", "Tim Krabbe buscalibre ciclista"),
    ("Elogio de la bicicleta", "buscalibre \"elogio de la bicicleta\" Marc Auge"),
    ("Cuentos de ciclismo", "buscalibre \"cuentos de ciclismo\" Martinez de Mingo"),
    ("La bicicleta, mi cámara y yo", "buscalibre \"la bicicleta mi camara y yo\" Horacio Gil"),
    ("Navarra en Bicicleta", "buscalibre \"navarra en bicicleta\" Ayesa"),
    ("Bicicleta: salud y ejercicio", "buscalibre \"bicicleta salud y ejercicio\" Carmichael"),
    ("Desde Monterrey en bicicleta", "buscalibre \"desde monterrey en bicicleta\""),
    ("La bicicleta de Katmandú", "buscalibre \"la bicicleta de katmandu\" Ovares"),
]

pat = re.compile(r"https://www\.buscalibre\.(cl|us|com\.co|com\.mx|com\.ar)/(libro-[a-z0-9\-]+/[0-9X]{10,13}/p/\d+)")
resultados = {}
for titulo, q in QUERIES:
    raw = subprocess.run(
        ["z-ai", "function", "-n", "web_search",
         "-a", json.dumps({"query": q, "num": 8})],
        capture_output=True, text=True, timeout=120).stdout
    m = re.search(r"\[.*\]", raw, re.S)
    candidatos = []  # (dominio, ruta)
    if m:
        try:
            data = json.loads(m.group(0))
            for r in data:
                mm = pat.search(r.get("url", ""))
                if mm:
                    candidatos.append((mm.group(1), mm.group(2)))
        except Exception:
            pass
    # preferir .cl; el resto se reescribe a .cl (mismo product ID en la plataforma)
    def a_cl(d, ruta):
        return f"https://www.buscalibre.cl/{ruta}"
    orden = {"cl": 0, "us": 1, "com.mx": 2, "com.ar": 3, "com.co": 4}
    vistos, limpias = set(), []
    for d, ruta in sorted(candidatos, key=lambda x: orden.get(x[0], 9)):
        if ruta in vistos:
            continue
        vistos.add(ruta)
        limpias.append(a_cl(d, ruta))
    resultados[titulo] = limpias
    print(f"{titulo}:")
    for u in limpias[:4]:
        print(f"   {u}")
    if not limpias:
        print("   ✗ sin ficha en resultados")
    time.sleep(2)

json.dump(resultados, open("/home/z/my-project/scripts/data/fichas-previos-es.json", "w"), ensure_ascii=False, indent=1)
print("\nguardado scripts/data/fichas-previos-es.json")
