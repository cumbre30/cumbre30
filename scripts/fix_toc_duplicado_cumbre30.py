# -*- coding: utf-8 -*-
"""
Fix de la entrada duplicada en el TOC de Cumbre30:
1. La primera entrada (hipervinculo con PAGEREF _Toc1 sin resultado cacheado)
   recibe un "1" cacheado entre separate y end para que LibreOffice/WPS la muestren.
2. Se elimina la entrada estatica duplicada "1. Resumen ejecutivo ... 1" que la
   seguía inmediatamente (la propia entrada con hipervinculo ya la representa).
"""
import re
import shutil
import zipfile

DOCX = "/home/z/my-project/download/Cumbre30-analisis-nuevas-funcionalidades.docx"
TMP = DOCX + ".tmp"

with zipfile.ZipFile(DOCX, "r") as z:
    names = z.namelist()
    data = {n: z.read(n) for n in names}

xml = data["word/document.xml"].decode("utf-8")

# 1. Cache del resultado del PAGEREF _Toc1 (campo completo dentro de un unico <w:r>)
pat_cache = re.compile(
    r'(<w:instrText xml:space="preserve">PAGEREF _Toc1 \\h</w:instrText>'
    r'<w:fldChar w:fldCharType="separate"/>)'
    r'(<w:fldChar w:fldCharType="end"/>)'
)
xml, n1 = pat_cache.subn(r"\1<w:t>1</w:t>\2", xml)
print(f"PAGEREF _Toc1 cacheado: {n1}")

# 2. Eliminar la entrada estatica duplicada que sigue al hipervinculo de _Toc1
pat_dup = re.compile(
    r'<w:p><w:pPr><w:pStyle w:val="TOC1"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9026"/></w:tabs>'
    r'<w:spacing w:before="120" w:after="60"/></w:pPr><w:r><w:t>1\. Resumen ejecutivo</w:t></w:r>'
    r'<w:r><w:tab/></w:r><w:r><w:t>1</w:t></w:r></w:p>'
)
xml, n2 = pat_dup.subn("", xml, count=1)
print(f"Entrada estatica duplicada eliminada: {n2}")

if n1 != 1 or n2 != 1:
    print("ERROR: patron no encontrado; no se modifica el archivo")
    sys_exit = 1
    raise SystemExit(1)

data["word/document.xml"] = xml.encode("utf-8")
with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as z:
    for n in names:
        z.writestr(n, data[n])
shutil.move(TMP, DOCX)
print("OK: TOC corregido")
