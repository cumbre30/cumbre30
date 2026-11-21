# Post-proceso TOC (compatibilidad WPS/Word) para el docx generado:
# 1. Quita <w:pgNumType/> vacíos (emisiones de docx-js que confunden a WPS).
# 2. Parchea el instrText de cada pie: PAGE → PAGE \* ROMAN / \* arabic
#    según el formato declarado en la sección que lo referencia.
import re
import shutil
import sys
import zipfile

path = sys.argv[1]
tmp = path + ".tmp"

with zipfile.ZipFile(path, "r") as z:
    nombres = z.namelist()
    datos = {n: z.read(n) for n in nombres}

doc = datos["word/document.xml"].decode("utf-8")

# 1. pgNumType vacíos fuera
doc = doc.replace("<w:pgNumType/>", "")

# 2. Mapa sectPr → (formato, rId del footer default)
sect_blocks = re.findall(r"<w:sectPr[\s\S]*?</w:sectPr>", doc)
rels = datos["word/_rels/document.xml.rels"].decode("utf-8")
rid_a_archivo = dict(re.findall(r'<Relationship[^>]*Id="([^"]+)"[^>]*Target="(footer\d+\.xml)"', rels))

plan = {}  # archivo footer → formato
for bloque in sect_blocks:
    fmt = re.search(r'<w:pgNumType[^>]*w:fmt="([^"]+)"', bloque)
    refs = re.findall(r'<w:footerReference[^>]*w:type="default"[^>]*r:id="([^"]+)"', bloque)
    if not fmt or not refs:
        continue
    formato = "ROMAN" if "roman" in fmt.group(1).lower() else "arabic"
    for rid in refs:
        archivo = rid_a_archivo.get(rid)
        if archivo:
            plan["word/" + archivo] = formato

for archivo, formato in plan.items():
    if archivo not in datos:
        continue
    xml = datos[archivo].decode("utf-8")
    xml2 = re.sub(
        r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
        r"\1 PAGE \\* " + formato + r" \\* MERGEFORMAT \2",
        xml,
    )
    if xml2 != xml:
        datos[archivo] = xml2.encode("utf-8")
        print(f"parcheado {archivo} → \\* {formato}")

datos["word/document.xml"] = doc.encode("utf-8")

# 3. Entrada incrustada en el párrafo del propio campo TOC: tras el
#    separate queda un hiperenlace sin número de página que LibreOffice
#    renderiza como línea duplicada. Se elimina ese hiperenlace.
doc, n_hl = re.subn(
    r'(<w:fldChar w:fldCharType="separate"/></w:r>)<w:hyperlink w:history="1" w:anchor="_Toc\d+">[\s\S]*?</w:hyperlink>',
    r"\1",
    doc,
)
if n_hl:
    print(f"entrada incrustada del campo TOC eliminada ({n_hl})")
    datos["word/document.xml"] = doc.encode("utf-8")

with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
    for n in nombres:
        z.writestr(n, datos[n])
shutil.move(tmp, path)
print("post-proceso TOC listo")
