#!/usr/bin/env python3
"""Merge portada + cuerpo y normaliza todo a A4 estricto (±0.1 pt).

Uso: python3 scripts/pdf_doc/merge_final.py
Salida: download/cumbre30-doc-tecnica-motor-gps-minimapa-pipeline.pdf
"""
import os
from pypdf import PdfReader, PdfWriter, Transformation
from reportlab.lib.pagesizes import A4

BASE = os.path.dirname(os.path.abspath(__file__))
COVER = os.path.join(BASE, "assets", "cover.pdf")
BODY = os.path.join(BASE, "assets", "body.pdf")
OUT = "/home/z/my-project/download/cumbre30-doc-tecnica-motor-gps-minimapa-pipeline.pdf"

PAGE_W, PAGE_H = A4  # 595.28 x 841.89
TOL = 0.1

def normalize(page: "PageObject") -> "PageObject":
    """Escala el contenido a A4 exacto si la página se desvía de A4."""
    w, h = float(page.mediabox.width), float(page.mediabox.height)
    if abs(w - PAGE_W) <= TOL and abs(h - PAGE_H) <= TOL:
        return page
    page.scale_to(PAGE_W, PAGE_H)
    page.mediabox.lower_left = (0, 0)
    page.mediabox.upper_right = (PAGE_W, PAGE_H)
    return page

writer = PdfWriter()

# Portada (1 pág, 595.92x842.88 -> se normaliza)
cover = PdfReader(COVER)
writer.add_page(normalize(cover.pages[0]))

# Cuerpo (18 págs, ya A4)
body = PdfReader(BODY)
for pg in body.pages:
    writer.add_page(normalize(pg))

writer.add_metadata({
    "/Title": "Cumbre30 - Documentación técnica: motor GPS, minimapa y pipeline de producción",
    "/Author": "Z.ai",
    "/Creator": "Z.ai",
    "/Subject": "Documentación técnica interna: motor GPS, minimapa y pipeline de producción de Cumbre30",
})

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "wb") as f:
    writer.write(f)

# Verificación
r = PdfReader(OUT)
print(f"OK -> {OUT}")
print(f"Páginas: {len(r.pages)} | Tamaño: {os.path.getsize(OUT)/1e6:.2f} MB")
bad = []
for i, pg in enumerate(r.pages):
    w, h = float(pg.mediabox.width), float(pg.mediabox.height)
    if abs(w - PAGE_W) > TOL or abs(h - PAGE_H) > TOL:
        bad.append((i + 1, round(w, 2), round(h, 2)))
print("A4 estricto:", "PASS" if not bad else f"FALLO {bad}")
