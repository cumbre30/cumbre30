#!/usr/bin/env python3
# ============================================================
# postfix.py - postfijo del DOCX de auditoría (compat WPS/Word):
#   1) parcha instrText de los footers: PAGE → PAGE \* arabic \* MERGEFORMAT
#      (docx-js emite PAGE sin switch; el switch arabic evita "1decimal")
#   2) elimina <w:pgNumType/> vacíos de la sección de portada
# Uso: python3 postfix.py <archivo.docx>
# ============================================================
import re
import shutil
import sys
import zipfile
from pathlib import Path

src = Path(sys.argv[1])
tmp = src.with_suffix(".tmp.docx")

with zipfile.ZipFile(src, "r") as zin:
    items = {n: zin.read(n) for n in zin.namelist()}

patched_footers = 0
for name in list(items.keys()):
    if re.match(r"word/footer\d+\.xml$", name):
        xml = items[name].decode("utf-8")
        nuevo, n = re.subn(
            r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
            r"\1 PAGE \\* arabic \\* MERGEFORMAT \2",
            xml,
        )
        if n:
            items[name] = nuevo.encode("utf-8")
            patched_footers += n

doc = items["word/document.xml"].decode("utf-8")
doc, removed = re.subn(r"<w:pgNumType/>", "", doc)

# docx-js TableOfContents(hyperlink) emite una entrada de muestra tras el
# 'separate' (hyperlink con PAGEREF sin resultado) que duplica visualmente
# la primera entrada del índice: se elimina; el campo queda con el
# begin/instr/separate y las 37 entradas de placeholders.
doc, stripped = re.subn(
    r'(w:fldCharType="separate"/></w:r>)<w:hyperlink w:history="1" w:anchor="_Toc\d+">.*?</w:hyperlink>',
    r"\1",
    doc,
    count=1,
)
items["word/document.xml"] = doc.encode("utf-8")

with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
    for name, data in items.items():
        zout.writestr(name, data)
shutil.move(tmp, src)
print(f"postfix OK: {patched_footers} instrText parchados, {removed} pgNumType vacíos eliminados, {stripped} muestra de TOC eliminada")
