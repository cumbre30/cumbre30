#!/usr/bin/env python3
"""Limpia la entrada de TOC fundida en el párrafo del campo (texto sin
número de página que el script de placeholders dejó dentro del párrafo
del propio campo TOC). Operación a nivel de RUN con cierre correcto de
etiquetas, y verificación de XML bien formado antes de escribir."""
import sys, zipfile, shutil, re
from xml.dom import minidom

path = sys.argv[1]
tmp = path + ".tmp"

zin = zipfile.ZipFile(path, "r")
zout = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)

for item in zin.infolist():
    data = zin.read(item.filename)
    if item.filename == "word/document.xml":
        xml = data.decode("utf-8")
        i = xml.find("TOC \\h")
        if i == -1:
            print("AVISO: sin campo TOC")
        else:
            ps = max(xml.rfind("<w:p ", 0, i), xml.rfind("<w:p>", 0, i))
            pe = xml.find("</w:p>", i) + len("</w:p>")
            p = xml[ps:pe]
            sep_i = p.find('w:fldCharType="separate"')
            sep_run_end = p.find("</w:r>", sep_i)
            p_close = p.rfind("</w:p>")
            tail = p[sep_run_end + len("</w:r>"):p_close]
            tail_texts = re.findall(r"<w:t[^>]*>([^<]*)</w:t>", tail)
            if sep_i != -1 and tail.strip() and not any(t.strip().isdigit() for t in tail_texts):
                # conservar runs entre sep_run_end y el cierre SOLO si son necesarios:
                # se descartan (son el fragmento fundido: texto + subcampo PAGEREF vacío)
                p_new = p[:sep_run_end + len("</w:r>")] + p[p_close:]
                xml = xml[:ps] + p_new + xml[pe:]
                print("fragmento fundido eliminado (textos):", tail_texts)
            else:
                print("AVISO: nada que limpiar (tail:", tail_texts, ")")
        # verificación de XML bien formado
        minidom.parseString(xml)
        print("XML bien formado OK")
        data = xml.encode("utf-8")
    zout.writestr(item, data)

zin.close()
zout.close()
shutil.move(tmp, path)
print("OK", path)
