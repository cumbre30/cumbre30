# -*- coding: utf-8 -*-
"""
Post-proceso del docx Cumbre30 (compatibilidad WPS/Word):
1. Elimina <w:pgNumType/> vacíos del document.xml (los emite docx-js).
2. Parcha los campos PAGE de los pies de página con el switch de formato
   explícito: sección de índice -> ROMAN, sección de cuerpo -> arabic.
Identifica cada pie por el footerReference de cada w:sectPr en orden.
"""
import re
import shutil
import sys
import zipfile

DOCX = "/home/z/my-project/download/Cumbre30-analisis-nuevas-funcionalidades.docx"
TMP = DOCX + ".tmp"

with zipfile.ZipFile(DOCX, "r") as z:
    names = z.namelist()
    data = {n: z.read(n) for n in names}

doc_xml = data["word/document.xml"].decode("utf-8")

# 1. Eliminar pgNumType vacíos
before = doc_xml.count("<w:pgNumType/>")
doc_xml = doc_xml.replace("<w:pgNumType/>", "")
print(f"pgNumType vacios eliminados: {before}")

# 2. Mapear sectPr -> footerReference en orden de documento
sect_blocks = re.findall(r"<w:sectPr[^>]*>.*?</w:sectPr>", doc_xml, re.S)
print(f"secciones encontradas: {len(sect_blocks)}")

rels_xml = data["word/_rels/document.xml.rels"].decode("utf-8")
rel_map = dict(re.findall(r'<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"', rels_xml))

# Orden esperado: [0] portada (sin footer), [1] indice (ROMAN), [2] cuerpo (arabic)
# docx-js puede dejar el sectPr de la ultima seccion al final del body.
fmt_by_index = {1: "ROMAN", 2: "arabic"}
for idx, block in enumerate(sect_blocks):
    fmt = fmt_by_index.get(idx)
    if not fmt:
        continue
    m = re.search(r'<w:footerReference[^>]*w:type="default"[^>]*r:id="([^"]+)"', block)
    if not m:
        m = re.search(r'<w:footerReference[^>]*r:id="([^"]+)"', block)
    if not m:
        print(f"  seccion {idx}: sin footerReference")
        continue
    target = rel_map.get(m.group(1), "")
    fname = "word/" + target.lstrip("/")
    if fname not in data:
        print(f"  seccion {idx}: footer {fname} no encontrado")
        continue
    fxml = data[fname].decode("utf-8")
    fxml_new, n = re.subn(
        r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
        rf"\1 PAGE \\* {fmt} \\* MERGEFORMAT \2",
        fxml,
    )
    if n == 0:
        print(f"  seccion {idx}: {fname} sin campo PAGE (ya parchado o vacio)")
    else:
        data[fname] = fxml_new.encode("utf-8")
        print(f"  seccion {idx}: {fname} parchado con \\* {fmt} ({n} campo/s)")

data["word/document.xml"] = doc_xml.encode("utf-8")

with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as z:
    for n in names:
        z.writestr(n, data[n])
shutil.move(TMP, DOCX)
print("OK: post-proceso completado")
