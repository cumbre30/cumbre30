# ============================================================
# Post-proceso de numeración de página (compatibilidad WPS):
# 1) elimina <w:pgNumType/> vacío (portada)
# 2) parchea el instrText de cada footer según el formato de su
#    sección: upperRoman → PAGE \* ROMAN \* MERGEFORMAT,
#    decimal → PAGE \* arabic \* MERGEFORMAT.
# Mapea sectPr → footerReference r:id → archivo footer via rels.
# Ejecutar: python3 scripts/patch-pagenum.py <docx>
# ============================================================
import re
import shutil
import sys
import zipfile

path = sys.argv[1]
tmp = path + ".tmp"

with zipfile.ZipFile(path, "r") as zin:
    names = zin.namelist()
    data = {n: zin.read(n) for n in names}

doc = data["word/document.xml"].decode("utf-8")
rels = data["word/_rels/document.xml.rels"].decode("utf-8")

# rel id → target footer file
rel_map = dict(re.findall(r'<Relationship[^>]*Id="([^"]+)"[^>]*Target="(footer\d+\.xml)"', rels))
rel_map.update({rid: t for rid, t in re.findall(r'<Relationship[^>]*Target="(footer\d+\.xml)"[^>]*Id="([^"]+)"', rels) and []})

# cada sectPr: formato de página y footerReference
patches = {}  # footer file → fmt
for sect in re.findall(r"<w:sectPr[^>]*>.*?</w:sectPr>", doc, re.S):
    fmt_m = re.search(r'<w:pgNumType[^>]*w:fmt="([^"]+)"', sect)
    if not fmt_m:
        continue
    fmt = fmt_m.group(1)
    for rid in re.findall(r'<w:footerReference[^>]*r:id="([^"]+)"', sect):
        target = rel_map.get(rid)
        if target:
            patches["word/" + target] = fmt

cambios = []
for fname, fmt in patches.items():
    if fname not in data:
        continue
    xml = data[fname].decode("utf-8")
    switch = "ROMAN" if "oman" in fmt.lower() else "arabic"
    nuevo = re.sub(
        r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
        r"\1 PAGE \\* " + switch + r" \\* MERGEFORMAT \2",
        xml,
    )
    if nuevo != xml:
        data[fname] = nuevo.encode("utf-8")
        cambios.append(f"{fname} → \\* {switch}")

# pgNumType vacío fuera (portada)
doc2 = doc.replace("<w:pgNumType/>", "")
if doc2 != doc:
    data["word/document.xml"] = doc2.encode("utf-8")
    cambios.append("document.xml: <w:pgNumType/> eliminado")

with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
    for n in names:
        zout.writestr(n, data[n])
shutil.move(tmp, path)
print("PATCH OK:", "; ".join(cambios) if cambios else "sin cambios necesarios")
