# -*- coding: utf-8 -*-
"""Fusiona portada + cuerpo, normaliza a A4 y escribe el PDF final."""
from pypdf import PdfReader, PdfWriter

A4_W, A4_H = 595.28, 841.89
COVER = "/tmp/proto/cover.pdf"
BODY = "/tmp/proto/propuesta_body.pdf"
OUT = "/home/z/my-project/download/Cumbre30_Propuesta_Rediseno_UX_UI.pdf"

def normalize(page):
    w, h = float(page.mediabox.width), float(page.mediabox.height)
    if abs(w - A4_W) > 0.1 or abs(h - A4_H) > 0.1:
        page.scale_to(A4_W, A4_H)
    return page

writer = PdfWriter()
writer.add_page(normalize(PdfReader(COVER).pages[0]))
for p in PdfReader(BODY).pages:
    writer.add_page(normalize(p))
writer.add_metadata({
    "/Title": "Cumbre30 - Propuesta de Rediseño UX/UI y Navegación",
    "/Author": "Z.ai",
    "/Creator": "Z.ai",
    "/Subject": "Auditoría, arquitectura de navegación, sistema de diseño y prototipo (Fases 1-2)",
})
with open(OUT, "wb") as f:
    writer.write(f)
print("OK final ->", OUT, "| páginas:", len(writer.pages))
