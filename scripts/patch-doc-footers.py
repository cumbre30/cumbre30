#!/usr/bin/env python3
"""Parche post-generación docx (compatibilidad WPS/Word, per toc.md):
1. Elimina <w:pgNumType/> vacíos del document.xml.
2. Parchea el instrText de cada footer: el footer marcado con zero-width
   space (U+200B) usa PAGE \\* ROMAN, el resto PAGE \\* arabic."""
import sys, zipfile, shutil, re

path = sys.argv[1]
tmp = path + ".tmp"

zin = zipfile.ZipFile(path, "r")
zout = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)

for item in zin.infolist():
    data = zin.read(item.filename)
    name = item.filename
    if name == "word/document.xml":
        xml = data.decode("utf-8")
        n = xml.count("<w:pgNumType/>")
        xml = xml.replace("<w:pgNumType/>", "")
        print(f"document.xml: {n} pgNumType vacios eliminados")
        data = xml.encode("utf-8")
    elif re.match(r"word/footer\d+\.xml", name):
        xml = data.decode("utf-8")
        fmt = "ROMAN" if "\u200b" in xml or "\u200B" in xml else "arabic"
        new_xml, n = re.subn(
            r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
            r"\1 PAGE \\* " + fmt + r" \\* MERGEFORMAT \2",
            xml,
        )
        if n:
            print(f"{name}: {n} campo PAGE -> \\* {fmt}")
            data = new_xml.encode("utf-8")
    zout.writestr(item, data)

zin.close()
zout.close()
shutil.move(tmp, path)
print("OK", path)
