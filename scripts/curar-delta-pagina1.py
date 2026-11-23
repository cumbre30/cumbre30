#!/usr/bin/env python3
# Delta de la página 1/3 del export Buscalibre de Jean (2026-11-23):
# de los 32 items visibles, 30 ya estaban procesados; 2 son NUEVOS:
#   · Ciclismo. Entrenamiento Avanzado — Hunter Allen (Tutor 2013)
#     → edición española de Cutting-Edge Cycling (Allen & Cheung);
#       nota de prensa Tutor 24-04-2013 + Amazon/biblio confirman
#   · Ciclismo Para Niños — Iván Libreros (Ediciones JC 2021)
#     → Open Library: «Ciclismo para niños | Iván Libreros Fernández |
#       2021 | Ediciones JC» (match exacto con la ficha Buscalibre)
# Se añaden al lote canonical (lote-es-fichas-final.json) con reseña propia.
import json
from pathlib import Path

BASE = Path("/home/z/my-project/scripts/data")
F = BASE / "lote-es-fichas-final.json"
lote = json.loads(F.read_text())
ya = {l["isbn"] for l in lote}

DELTA = [
 dict(isbn="9788479029463", ficha="https://www.buscalibre.cl/libro-ciclismo-entrenamiento-avanzado/9788479029463/p/28099786",
      titulo="Ciclismo. Entrenamiento avanzado", autor="Hunter Allen", pais="Estados Unidos",
      categorias=["entrenamiento"], anio=2013, editorial="Tutor",
      extra="Con Stephen Cheung · Edición española de Cutting-Edge Cycling · Editorial Tutor",
      resena="Hunter Allen —entrenador de referencia del ciclismo de potencia, cofundador de TrainingPeaks y coautor de Training and Racing with a Power Meter— y el fisiólogo Stephen Cheung traducen aquí la investigación más reciente a práctica ciclista: potencia, aerodinámica, calor, altitud y manejo de la fatiga. El puente entre el laboratorio y el entrenamiento diario del ciclista competitivo."),
 dict(isbn="9788415448525", ficha="https://www.buscalibre.cl/libro-ciclismo-para-ninos/9788415448525/p/53325523",
      titulo="Ciclismo para niños", autor="Iván Libreros Fernández", pais=None,
      categorias=["personas", "aventura"], anio=2021, editorial="Ediciones JC",
      extra="Guía para iniciar a los peques en la bicicleta · Editorial Ediciones JC",
      resena="Cómo acompañar a los más pequeños en su entrada a la bicicleta: el equilibrio, los primeros pedaleos, la seguridad y el juego como método. El título familiar del catálogo: para papás y mamás que quieren contagiar el vicio de pedalear desde la infancia."),
]

añadidos = 0
for d in DELTA:
    if d["isbn"] in ya:
        print("ya está:", d["titulo"]); continue
    lote.append({
        "titulo": d["titulo"], "tipo": "libro", "idioma": "es",
        "categorias": d["categorias"], "anio": d["anio"], "autor": d["autor"],
        "pais": d["pais"], "extra": d["extra"], "urlExterna": d["ficha"],
        "resena": d["resena"], "proveedor": "buscalibre.cl", "portada": None,
        "isbn": d["isbn"],
    })
    añadidos += 1

F.write_text(json.dumps(lote, ensure_ascii=False, indent=1))
print(f"añadidos {añadidos} · lote total: {len(lote)}")
