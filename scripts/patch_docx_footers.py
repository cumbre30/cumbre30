#!/usr/bin/env python3
# ============================================================
# patch_docx_footers.py — post-proceso de numeración para docx
# generados con 3 secciones (portada / preliminares romanas /
# cuerpo arábigo), según toc.md del skill docx:
#   1. elimina <w:pgNumType/> vacío (confunde a WPS)
#   2. parchea el instrText de cada footer: PAGE → PAGE \* ROMAN
#      o PAGE \* arabic según la sección a la que pertenece
# Uso: python3 patch_docx_footers.py <archivo.docx>
# ============================================================
import re
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

def main():
    ruta = Path(sys.argv[1])
    tmp = Path(tempfile.mkdtemp())
    des = tmp / ruta.name
    shutil.copy(ruta, des)

    with zipfile.ZipFile(des) as z:
        nombres = z.namelist()
        data = {n: z.read(n) for n in nombres}

    doc = data["word/document.xml"].decode("utf-8")
    # 1) quitar pgNumType vacío
    doc = doc.replace("<w:pgNumType/>", "")

    # 2) identificar qué footer pertenece a qué sección por orden de aparición
    #    (docx-js escribe footerN en el orden de las secciones que lo usan)
    fmt_secciones = re.findall(r'<w:pgNumType[^/]*w:fmt="([^"]+)"[^/]*/>', doc)
    romanos = any("roman" in f.lower() for f in fmt_secciones)

    # map: rId de footer → archivo
    rels = data["word/_rels/document.xml.rels"].decode("utf-8")
    mapa_rid = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="(footer\d+\.xml)"', rels))

    # orden de referencia de footers por sección (secciones sin footer no aparecen)
    refs = re.findall(r'<w:footerReference w:type="default" r:id="(rId\d+)"/>', doc)

    for idx, rid in enumerate(refs):
        archivo = mapa_rid.get(rid)
        if not archivo:
            continue
        clave = f"word/{archivo}"
        if clave not in data:
            continue
        xml = data[clave].decode("utf-8")
        es_roman = romanos and idx == 0 and "upperRoman" in fmt_secciones[0]
        switch = "ROMAN" if es_roman else "arabic"
        xml2 = re.sub(
            r'(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)',
            r'\1 PAGE \\* ' + switch + r' \\* MERGEFORMAT \2',
            xml,
        )
        if xml2 != xml:
            data[clave] = xml2.encode("utf-8")
            print(f"footer {archivo}: PAGE → PAGE \\* {switch} \\* MERGEFORMAT")

    data["word/document.xml"] = doc.encode("utf-8")

    out = Path(str(ruta) + ".tmp")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for n in nombres:
            z.writestr(n, data[n])
    out.replace(ruta)
    print("OK:", ruta)

if __name__ == "__main__":
    main()
