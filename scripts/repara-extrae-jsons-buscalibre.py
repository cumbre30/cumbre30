#!/usr/bin/env python3
"""Repara los JSON truncados (2 y 3) del usuario y extrae el catálogo completo.

Salida: scripts/data/buscalibre-ciclismo-jsons.json (libros dedupeados con enlace_ficha).
"""
import json, re, unicodedata
from pathlib import Path

UP = Path("/home/z/my-project/upload")
OUT = Path("/home/z/my-project/scripts/data/buscalibre-ciclismo-jsons.json")

FILES = {
    1: UP / "gemini-code-1795398810085-1.json",
    2: UP / "gemini-code-1795398798495-2.json",
    3: UP / "gemini-code-1795398851222-3.json",
}

def repara(texto: str) -> str:
    """Trunca al último objeto-libro completo y cierra la estructura."""
    # los objetos libro terminan con el campo enlace_ficha, luego }
    patron = re.compile(r'"enlace_ficha"\s*:\s*"[^"]*"')
    ult = None
    for m in patron.finditer(texto):
        ult = m
    if ult is None:
        raise ValueError("sin enlace_ficha alguno")
    # desde el fin del string del enlace, buscar el cierre del objeto libro '}'
    cierre = texto.find("}", ult.end())
    if cierre == -1:
        raise ValueError("sin cierre de objeto")
    cuerpo = texto[: cierre + 1]
    # quitar coma final si quedó colgando
    cuerpo = cuerpo.rstrip()
    if cuerpo.endswith(","):
        cuerpo = cuerpo[:-1]
    return cuerpo + "\n  ]\n}"

def carga(pagina: int, path: Path):
    texto = path.read_text(encoding="utf-8")
    try:
        return json.loads(texto), "original"
    except json.JSONDecodeError as e:
        print(f"  pág {pagina}: JSON truncado ({e.msg} @ char {e.pos}) → reparando")
        reparado = repara(texto)
        return json.loads(reparado), "reparado"

todos = {}
for pag, path in FILES.items():
    data, estado = carga(pag, path)
    f = data["fuente"]
    print(f"pág {pag} ({estado}): {f['pagina']} · reportados {f['total_resultados_reportados']} · libros {len(data['libros'])}")
    for b in data["libros"]:
        enlace = b.get("enlace_ficha") or ""
        if not enlace:
            continue
        m = re.search(r"/libro-([a-z0-9-]+)/([0-9Xx-]+)/p/(\d+)", enlace)
        isbn = m.group(2) if m else ""
        pid = m.group(3) if m else ""
        key = pid or enlace
        if key in todos and todos[key]["titulo"].lower() == b["titulo"].lower():
            continue
        todos[key] = {
            "titulo": b["titulo"],
            "autores": b.get("autores") or [],
            "editorial": b.get("editorial"),
            "anio_edicion": b.get("anio_edicion"),
            "precio_actual": b.get("precio_actual"),
            "moneda": b.get("moneda"),
            "enlace_ficha": enlace,
            "isbn_en_url": isbn,
            "product_id": pid,
            "pagina_buscalibre": pag,
        }

print(f"\nTOTAL libros únicos con enlace_ficha: {len(todos)}")
con_isbn = sum(1 for v in todos.values() if v["isbn_en_url"])
print(f"  con ISBN-13 en la URL: {con_isbn}")
sin_isbn = [v for v in todos.values() if not v["isbn_en_url"]]
for v in sin_isbn[:10]:
    print("  sin ISBN:", v["titulo"], v["enlace_ficha"])

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(list(todos.values()), ensure_ascii=False, indent=1), encoding="utf-8")
print(f"\nguardado: {OUT}")
