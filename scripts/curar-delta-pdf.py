#!/usr/bin/env python3
# Delta 2: candidatas reales detectadas en el PDF export (DOC-20261123-WA0000.pdf).
# De las 18 fichas nuevas del PDF: 13 autoeditadas/POD descartadas por política v4
# (Mariana Correa ×6 Createspace, Independently Published ×2, EAE/vanity ×3,
# Palibrio, Círculo Rojo), «Ciclismo para niños» ya publicada en catálogo,
# y 3 confirmadas por Open Library / web:
#   · Atlas ilustrado de ciclismo épico — Susaeta (OL exacto, 2006, cover_i)
#   · El placer del ciclismo — Louis Chauvet Urquidi, Trillas (OL exacto, 2001, cover_i)
#   · Ciclismo (Science of Cycling) — David Bailey, DK — edición española del
#     original DK (13-01-2026, ISBN 9798217126538) anunciada para 2027
# Nota: la ficha de «El placer del ciclismo» venía con el slug mangled por el
# salto de línea del PDF (ciclismoguia → ciclismo-guia) — reconstruido.
import json, re, urllib.request
from pathlib import Path

BASE = Path("/home/z/my-project/scripts/data")
F = BASE / "lote-es-fichas-final.json"
lote = json.loads(F.read_text())
ya = {l["isbn"] for l in lote}

def url_ok(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "cumbre30/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = r.read()
        return len(raw) > 3000 and raw[:3] != b"GIF"
    except Exception:
        return False

DELTA = [
 dict(isbn="9788430558346", pid="4197433",
      slug="atlas-ilustrado-de-ciclismo-epico",
      titulo="Atlas ilustrado de ciclismo épico", autor="Varios autores", pais=None,
      categorias=["historia", "ruta"], anio=2006, editorial="Editorial Susaeta",
      extra="Atlas ilustrado · Editorial Susaeta (año confirmado por Open Library)",
      resena="Un atlas ilustrado de las gestas y paisajes legendarios del ciclismo mundial: puertos míticos, vueltas y héroes a color, para devorar en la mesa antes que en la bici. El libro de regalo perfecto para el ciclista curioso.",
      portada_ol="https://covers.openlibrary.org/b/id/12862564-L.jpg"),
 dict(isbn="9789682463525", pid="980782",
      slug="el-placer-del-ciclismo-guia-practica-para-principiantes",
      titulo="El placer del ciclismo", autor="Louis Chauvet Urquidi", pais=None,
      categorias=["personas", "aventura"], anio=2001, editorial="Trillas",
      extra="Guía práctica para principiantes · Editorial Trillas (México)",
      resena="Guía práctica para quienes empiezan a pedalear, con el disfrute como centro: técnica básica, equipo y hábito. Introducción amable publicada por Trillas; el principiante de hoy tiene las mismas dudas que el de entonces.",
      portada_ol="https://covers.openlibrary.org/b/id/5247416-L.jpg"),
 dict(isbn="9798217496693", pid="68933252",
      slug="ciclismo-science-of-cycling",
      titulo="Ciclismo. Science of Cycling", autor="David Bailey", pais=None,
      categorias=["entrenamiento"], anio=2027, editorial="DK",
      extra="Edición española anunciada del original DK (2026) · Editorial DK",
      resena="La ciencia del ciclismo al estilo DK: la fisiología, la potencia y el entrenamiento que sostienen el rendimiento, explicados con el formato visual que hace digestible cualquier densidad de datos. Del autor del original Science of Cycling.",
      portada_ol=None),
]

añadidos = 0
for d in DELTA:
    if d["isbn"] in ya:
        print("ya está:", d["titulo"]); continue
    portada = d["portada_ol"]
    if portada and not url_ok(portada):
        print(f"  portada OL muerta para «{d['titulo']}» → dejará que image-search la resuelva")
        portada = None
    lote.append({
        "titulo": d["titulo"], "tipo": "libro", "idioma": "es",
        "categorias": d["categorias"], "anio": d["anio"], "autor": d["autor"],
        "pais": d["pais"], "extra": d["extra"],
        "urlExterna": f"https://www.buscalibre.cl/libro-{d['slug']}/{d['isbn']}/p/{d['pid']}",
        "resena": d["resena"], "proveedor": "buscalibre.cl",
        "portada": portada, "isbn": d["isbn"],
    })
    añadidos += 1
    print(f"  ✓ {d['titulo']} · portada: {'OL' if portada else 'pendiente image-search'}")

F.write_text(json.dumps(lote, ensure_ascii=False, indent=1))
print(f"añadidos {añadidos} · lote total: {len(lote)}")
