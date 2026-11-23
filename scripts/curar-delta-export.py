#!/usr/bin/env python3
# Delta 3: export COMPLETO de Jean (gemini-code-1795433122194.json, 105 fichas).
# De 29 nuevas por ISBN: 24 descartadas por política v4 (Mariana Correa/CréateSpace
# ×13, Independently Published ×3, EAE/vanity ×7, Palibrio, POD alemán), y
# «En bicicleta por los puertos» (9788496349414) es OTRA EDICIÓN del borrador
# ya existente (9788496349544) → no se duplica.
# 4 incorporadas, verificadas por Open Library / librerías:
#   · Ciclismo — Ashley Gish, Creative Company/Paperbacks (OL exacto: 2024)
#   · Ciclismo en carretera. Test de valoración del umbral anaeróbico —
#     J. R. Abad Culebras, Wanceulen (casadellibro/popularlibros/librerialuces)
#   · Ciclismo de precisión — Edmund R. Burke, Dorleta (agapea; original
#     EN «Precision Cycling with Your Polar…»; la ficha dice «Burker», typo)
#   · Ciclismo para señoras — Maria E. Ward, Bravas Literatas (llibreriacoma/
#     BRAVAS LITERATAS; clásico de 1896 rescatado en «El deporte en femenino»)
# El año de Ward/Dorleta/Abad no figura verificable → null (regla v4).
import json
from pathlib import Path

BASE = Path("/home/z/my-project/scripts/data")
F = BASE / "lote-es-fichas-final.json"
lote = json.loads(F.read_text())
ya = {l["isbn"] for l in lote}

delta = json.loads((BASE / "delta-export-completo.json").read_text())
por_isbn = {d["isbn"]: d for d in delta["nuevos"]}

SELECCION = [
 dict(isbn="9781682774786", titulo="Ciclismo", autor="Ashley Gish", pais="Estados Unidos",
      categorias=["aventura", "personas"], anio=2024, editorial="Creative Paperbacks (Creative Company)",
      extra="Divulgación juvenil ilustrada · Editorial Creative Company (año confirmado por Open Library)",
      resena="Introducción ilustrada al ciclismo para lectores jóvenes: qué es el deporte, sus modalidades y sus estrellas, con el formato visual de la serie de Creative Company. La primera piedra para el ciclista pequeño de la casa."),
 dict(isbn="9788498230727", titulo="Ciclismo en carretera. Test de valoración del umbral anaeróbico",
      autor="José Ramón Abad Culebras", pais="España", categorias=["entrenamiento"], anio=None,
      editorial="Wanceulen",
      extra="Editorial Deportiva Wanceulen",
      resena="Manual de campo para medir el umbral anaeróbico en ciclistas: protocolos de test, valoración de resultados y su aplicación al entrenamiento en carretera. La herramienta de laboratorio, en versión llana, para entrenadores y ciclistas serios."),
 dict(isbn="9788487812156", titulo="Ciclismo de precisión", autor="Edmund R. Burke", pais="Estados Unidos",
      categorias=["entrenamiento"], anio=None, editorial="Dorleta",
      extra="Biblioteca Polar Pulsómetro · Editorial Dorleta (el original en inglés: Precision Cycling)",
      resena="Edmund Burke —el fisiólogo que llevó la ciencia al entrenamiento ciclista— explica cómo entrenar por pulsómetro: zonas cardíacas, intensidades y pedaleo preciso. La edición española de Precision Cycling, manifiesto de la era anterior a los medidores de potencia."),
 dict(isbn="9798300686055", titulo="Ciclismo para señoras", autor="Maria E. Ward", pais="Estados Unidos",
      categorias=["historia", "personas"], anio=None, editorial="Bravas Literatas",
      extra="Colección «El deporte en femenino» · Editorial Bravas Literatas (el clásico original es de 1896)",
      resena="El manual con el que las mujeres aprendieron a pedalear a fines del siglo XIX, rescatado por Bravas Literatas en su colección sobre deporte y mujeres. Historia viva del derecho a la bicicleta: técnica, vestimenta y libertad sobre dos ruedas."),
]

añadidos = 0
for s in SELECCION:
    if s["isbn"] in ya:
        print("ya está:", s["titulo"]); continue
    d = por_isbn[s["isbn"]]
    lote.append({
        "titulo": s["titulo"], "tipo": "libro", "idioma": "es",
        "categorias": s["categorias"], "anio": s["anio"], "autor": s["autor"],
        "pais": s["pais"], "extra": s["extra"], "urlExterna": d["url"],
        "resena": s["resena"], "proveedor": "buscalibre.cl", "portada": None,
        "isbn": s["isbn"],
    })
    añadidos += 1
    print(f"  ✓ {s['titulo'][:60]} · ficha: {d['url'][:70]}")

F.write_text(json.dumps(lote, ensure_ascii=False, indent=1))
print(f"añadidos {añadidos} · lote total: {len(lote)}")
