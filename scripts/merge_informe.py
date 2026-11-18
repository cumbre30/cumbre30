# -*- coding: utf-8 -*-
"""Fusiona portada (Playwright) + cuerpo (ReportLab) en el PDF final normalizado a A4."""
from pypdf import PdfReader, PdfWriter

A4_W, A4_H = 595.28, 841.89
COVER = "/tmp/portada_informe.pdf"
BODY = "/tmp/informe_cuerpo.pdf"
OUT = "/home/z/my-project/download/auditoria-cumbre30/INFORME_AUDITORIA_INTEGRAL_CUMBRE30.pdf"

def normalize(page):
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    if abs(w - A4_W) > 0.5 or abs(h - A4_H) > 0.5:
        page.scale_to(A4_W, A4_H)
    return page

writer = PdfWriter()
writer.add_page(normalize(PdfReader(COVER).pages[0]))
body = PdfReader(BODY)
for p in body.pages:
    writer.add_page(normalize(p))
writer.add_metadata({
    "/Title": "INFORME_AUDITORIA_INTEGRAL_CUMBRE30",
    "/Author": "Z.ai", "/Creator": "Z.ai",
    "/Subject": "Auditoría integral de cumplimiento legal, privacidad y seguridad — Cumbre30 (Chile, 2026-11-18)",
})
with open(OUT, "wb") as f:
    writer.write(f)
print("MERGE_OK", len(body.pages) + 1, "páginas")
