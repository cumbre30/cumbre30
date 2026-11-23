#!/usr/bin/env python3
# Delta del export completo de Jean (gemini-code-1795433122194.json, 105 fichas)
# contra todo lo ya procesado:
#   · fichas-nuevas-candidatas.json (63) · fichas-previos-es/r2
#   · lote-es-fichas-final.json (29) · fichas-pdf-completo.json (66)
# y además contra los TÍTULOS vivos en Neon (lección «Ciclismo para niños»):
#   un título que ya existe en producción (publicado o borrador) no se re-cura.
# Salida: scripts/data/delta-export-completo.json (nuevos + conocidos + duplicados Neon)
import json, re, unicodedata
from pathlib import Path

BASE = Path("/home/z/my-project/scripts/data")

def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

# --- conocidos por ISBN ---
conocidos = set()
for name in ["fichas-nuevas-candidatas.json", "fichas-previos-es.json", "fichas-previos-r2.json"]:
    p = BASE / name
    if not p.exists():
        continue
    d = json.loads(p.read_text())
    items = d if isinstance(d, list) else d.get("fichas") or d.get("libros") or list(d.values())
    for f in items:
        if isinstance(f, dict) and f.get("isbn_en_url"):
            conocidos.add(f["isbn_en_url"])
for name in ["lote-es-fichas-final.json"]:
    for f in json.loads((BASE / name).read_text()):
        conocidos.add(f["isbn"])
pdf = json.loads((BASE / "fichas-pdf-completo.json").read_text())
for f in pdf["todas"]:
    if f.get("isbn"):
        conocidos.add(f["isbn"])
# ISBNs de los registros publicados del lote anterior (digital/print conocidos)
prev_lote = json.loads((BASE / "lote-ciclismo-final.json").read_text())
titulos_neon_archivo = {norm(r["titulo"]) for r in prev_lote}
print(f"conocidos por ISBN: {len(conocidos)} · títulos lote anterior: {len(titulos_neon_archivo)}")

# --- nuevo export ---
nuevo = json.loads(Path("/home/z/my-project/upload/gemini-code-1795433122194.json").read_text())
print(f"items en el nuevo export: {len(nuevo)}")

nuevos, conocidos_items, sin_url = [], [], []
for it in nuevo:
    u = it.get("url") or ""
    m = re.search(r"/libro(?:-digital)?-[^/]+/(\d{8,13})/p/(\d+)", u)
    isbn, pid = (m.group(1), m.group(2)) if m else (None, None)
    if not isbn:
        sin_url.append(it); continue
    it2 = dict(it); it2["isbn"], it2["pid"] = isbn, pid
    if isbn in conocidos:
        conocidos_items.append(it2)
    else:
        nuevos.append(it2)

# dedupe interno
vistos = set()
unicos_nuevos = []
for it in nuevos:
    if it["isbn"] in vistos:
        continue
    vistos.add(it["isbn"])
    unicos_nuevos.append(it)

print(f"sin URL parseable: {len(sin_url)}")
print(f"ya conocidos: {len(conocidos_items)} · NUEVOS por ISBN: {len(unicos_nuevos)}")
for it in unicos_nuevos:
    print(f"  ★ [{it['isbn']}] {it['title'][:64]} | {', '.join(it['authors'])[:38]} | {it['publisher']} {it['year']}")

(BASE / "delta-export-completo.json").write_text(json.dumps(
    {"total": len(nuevo), "nuevos": unicos_nuevos, "conocidos": len(conocidos_items),
     "sin_url": sin_url}, ensure_ascii=False, indent=1))
print("guardado:", BASE / "delta-export-completo.json")
