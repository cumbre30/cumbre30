#!/usr/bin/env python3
"""Cruza las 66 fichas con el catálogo ES actual → candidatos nuevos para futura oleada."""
import json, unicodedata, re
from pathlib import Path

def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

fichas = json.load(open("/home/z/my-project/scripts/data/buscalibre-ciclismo-jsons.json"))

# títulos ES de nuestra DB (lo aproxima: conocidos de los lotes ES)
nuestros = {
    "ciclismo para ninos", "ciclismo entrenamiento avanzado", "ciclomontanismo",
    "cicloturismo bikepacking 12 rutas circulares de 3 4 etapas",
    "crea tu entrenamiento por intervalos en 10 minutos ciclismo y ciclistas",
    "curso de mountain bike", "guia general del ciclismo", "manual de la bicicleta",
    "manual de reparacion de bicicletas", "viajar en bici", "el ciclista",
    "elogio de la bicicleta", "cuentos de ciclismo", "la bicicleta mi camara y yo",
    "navarra en bicicleta", "bicicleta salud y ejercicio", "desde monterrey en bicicleta",
    "la bicicleta de katmandu", "mountain biking", "digital hinault el tejon",
    "digital tadej pogacar imparable la biografia definitiva del mejor ciclista de la historia",
}
nuevos = []
for f in fichas:
    t = norm(f["titulo"])
    t = re.sub(r"^(libro|digital)\s+", "", t)
    if not any(t == n or t.startswith(n[:24]) or n.startswith(t[:24]) for n in nuestros):
        nuevos.append(f)

print(f"fichas totales: {len(fichas)} · ya en catálogo: {len(fichas)-len(nuevos)} · NUEVOS: {len(nuevos)}\n")
precios = []
for f in sorted(nuevos, key=lambda x: x["precio_actual"] or 10**9):
    p = f["precio_actual"]
    precios.append(p)
    print(f"  · {f['titulo']} — {', '.join(f['autores']) or '?'} ({f['editorial']}, {f['anio_edicion']}) · CLP {p:,}")
    print(f"      {f['enlace_ficha']}")
if precios:
    print(f"\nprecio mediano CLP: {sorted(precios)[len(precios)//2]:,}")

# guardamos el lote candidato
Path("/home/z/my-project/scripts/data/fichas-nuevas-candidatas.json").write_text(
    json.dumps(nuevos, ensure_ascii=False, indent=1), encoding="utf-8")
print("guardado: scripts/data/fichas-nuevas-candidatas.json")
