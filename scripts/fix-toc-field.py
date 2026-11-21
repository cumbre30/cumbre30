# ============================================================
# Repara la estructura del campo TOC tras add_toc_placeholders:
# · el párrafo del campo debe quedar begin + instrText + separate
#   (sin entrada cacheada ni end prematuro);
# · las entradas estáticas viven ENTRE separate y end;
# · el end se mueve a un párrafo propio tras la última entrada.
# Así Word regenera TODO el bloque al actualizar (sin duplicar)
# y la vista estática muestra cada entrada una sola vez.
# Ejecutar: python3 scripts/fix-toc-field.py <docx>
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

xml = data["word/document.xml"].decode("utf-8")
paras = re.findall(r"<w:p\b[^>]*>(?:(?!</w:p>).)*?</w:p>", xml, re.S)
toc = [p for p in paras if 'w:val="TOC' in p]
if not toc:
    print("sin párrafos TOC; nada que hacer")
    sys.exit(0)

campo = toc[0]
if 'fldCharType="end"' not in campo:
    print("el campo ya termina fuera del primer párrafo; nada que hacer")
    sys.exit(0)

# 1 · limpiar el párrafo del campo: solo begin + instrText + separate
limpio = re.sub(r"<w:hyperlink\b.*?</w:hyperlink>", "", campo, flags=re.S)
limpio = limpio.replace('<w:r><w:fldChar w:fldCharType="end"/></w:r>', "")
assert 'fldCharType="begin"' in limpio and "instrText" in limpio and 'fldCharType="separate"' in limpio
assert xml.count(campo) == 1, "párrafo del campo no único"
xml = xml.replace(campo, limpio)

# 2 · end del campo en párrafo propio tras la última entrada estática
ultimo = toc[-1]
assert xml.count(ultimo) == 1, "última entrada TOC no única"
xml = xml.replace(ultimo, ultimo + '<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>')

data["word/document.xml"] = xml.encode("utf-8")
with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
    for n in names:
        zout.writestr(n, data[n])
shutil.move(tmp, path)
print("TOC reparado: campo abierto al inicio, 18 entradas estáticas dentro, end al cierre")
