#!/usr/bin/env python3
# Valida el PDF export de Buscalibre (upload/DOC-20261123-WA0000.pdf):
#  · reconstruye las fichas de los 3 bloques (página 1/3, 2/3, 3/3)
#  · tolera artefactos de pdftotext (saltos de línea a mitad de token,
#    espacios perdidos en wraps, guiones caídos)
#  · identidad = (ISBN, product_id) extraídos de enlace_ficha
#  · título canónico derivado del slug de la URL (el JSON puede venir con
#    espacios perdidos por el wrap)
#  · delta contra lo ya procesado (63 candidatos + 2 del pegado + previos)
# Salidas: scripts/data/fichas-pdf-completo.json + impresión del delta
import json, re, unicodedata
from pathlib import Path

BASE = Path("/home/z/my-project/scripts/data")
TXT = Path("/tmp/busca.txt")

def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def slug_de_titulo(t):
    s = unicodedata.normalize("NFD", (t or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("ñ", "n")  # NFD ya la separó; por si acaso
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

lineas = TXT.read_text().splitlines()
# unir todo el documento en un stream limpio (los wraps se pegan con "")
doc = "\n".join(lineas)

# ---------- bloquear por libro ----------
bloques = []
actual = None
for ln in lineas:
    if ln.startswith("[22-11"):          # encabezado WhatsApp → separador
        if actual is not None:
            bloques.append(actual); actual = None
        continue
    if ln.strip().startswith('"titulo"'):
        if actual is not None:
            bloques.append(actual)
        actual = [ln]
    elif actual is not None:
        actual.append(ln)
        s = ln.strip()
        if s == "}" or s == "},":        # fin de objeto libro
            bloques.append(actual); actual = None
if actual is not None:
    bloques.append(actual)               # bloque truncado al fin del fragmento

print(f"bloques de libro detectados: {len(bloques)}")

def campo(b, key):
    """valor del campo key dentro del bloque (líneas unidas); '' si no está"""
    txt = "\n".join(b)
    m = re.search(r'"%s"\s*:\s*(.*?)(?=,\s*"|\n\s*[\}\]])' % key, txt, re.S)
    if not m:
        return ""
    v = m.group(1).strip().rstrip(",")
    return v

fichas, problematicos = [], []
for b in bloques:
    raw_titulo = campo(b, "titulo")
    try:
        titulo = json.loads(raw_titulo)
    except Exception:
        titulo = raw_titulo.strip('"')
    autores = campo(b, "autores")
    try:
        autores = ", ".join(json.loads(autores))
    except Exception:
        pass
    editorial = campo(b, "editorial").strip('"')
    anio = campo(b, "anio_edicion")
    try:
        anio = int(anio) if anio not in ("", "null") else None
    except Exception:
        anio = None
    url = campo(b, "enlace_ficha").strip('"')
    url = re.sub(r"\s+", "", url)  # wraps dentro de la URL
    m = re.search(r"/libro[^/]*?/(\d{8,13})/p/(\d+)", url)
    isbn = m.group(1) if m else None
    pid = m.group(2) if m else None
    # slug: preferir el de la URL; si el título viene corrompido, derivarlo del slug
    ms = re.search(r"/libro(?:-digital)?-([^/]+)/", url)
    slug = ms.group(1) if ms else None
    if slug:
        titulo_slug = slug.replace("-", " ").strip()
        # si el titulo del JSON perdió espacios en el wrap, usar el del slug
        if norm(titulo) != norm(titulo_slug) and norm(titulo_slug).startswith(norm(titulo)[:20]):
            titulo = titulo_slug
    rec = {
        "titulo": titulo, "autores": autores, "editorial": editorial,
        "anio_edicion": anio, "isbn": isbn, "pid": pid,
        "enlace_ficha": f"https://www.buscalibre.cl/libro-{slug}/{isbn}/p/{pid}" if (slug and isbn and pid) else url,
    }
    if not isbn or not pid:
        problematicos.append(rec)
    fichas.append(rec)

print(f"fichas con ISBN+pid: {sum(1 for f in fichas if f['isbn'])}/{len(fichas)}")
for p in problematicos:
    print("  ⚠ sin URL válida:", json.dumps(p, ensure_ascii=False)[:160])

# ---------- delta contra lo ya procesado ----------
conocidos = set()
for f_name in ["fichas-nuevas-candidatas.json", "fichas-previos-es.json", "fichas-previos-r2.json"]:
    p = BASE / f_name
    if p.exists():
        d = json.loads(p.read_text())
        items = d if isinstance(d, list) else d.get("fichas") or d.get("libros") or list(d.values())
        for f in items:
            if isinstance(f, dict) and f.get("isbn_en_url"):
                conocidos.add(f["isbn_en_url"])
for f_name in ["lote-es-fichas-final.json"]:
    for f in json.loads((BASE / f_name).read_text()):
        conocidos.add(f["isbn"])

# dedupe interno por isbn+pid
vistos, unicos = set(), []
for f in fichas:
    k = (f["isbn"], f["pid"])
    if k in vistos:
        continue
    vistos.add(k)
    unicos.append(f)

nuevos = [f for f in unicos if f["isbn"] and f["isbn"] not in conocidos]
print(f"\nfichas únicas en el PDF: {len(unicos)} · ya conocidas: {len(unicos)-len(nuevos)} · NUEVAS: {len(nuevos)}")
for f in nuevos:
    print(f"  ★ {f['titulo'][:70]} | {f['autores'][:40]} | {f['editorial']} {f['anio_edicion']} | {f['isbn']}")
    print(f"      {f['enlace_ficha']}")

(BASE / "fichas-pdf-completo.json").write_text(
    json.dumps({"total_reportado": 106, "fichas_en_pdf": len(unicos), "nuevas": nuevos, "todas": unicos},
               ensure_ascii=False, indent=1))
print("\nguardado:", BASE / "fichas-pdf-completo.json")
