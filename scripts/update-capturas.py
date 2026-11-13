#!/usr/bin/env python3
"""Reemplaza las capturas del carrusel (modal /geo) con las 3 fotos
adjuntas por el cliente (900x1998 -> 600x1332, mismo aspecto x2/3).

  upload/1-Ride.jpg  -> public/apps/cumbre30/01-ride.jpg
  upload/2-Mapa.jpg  -> public/apps/cumbre30/02-mapa.jpg
  upload/3-Perfil.jpg-> public/apps/cumbre30/03-perfil.jpg

Borra las capturas antiguas fuera del nuevo set (02-explorar,
03-desafios, 04-qr, 05-perfil). Quedan en git por si hay que volver.
"""
from PIL import Image
import os

BASE = "/home/z/my-project"
SRC = os.path.join(BASE, "upload")
DST = os.path.join(BASE, "public/apps/cumbre30")

MAP = {
    "1-Ride.jpg": "01-ride.jpg",
    "2-Mapa.jpg": "02-mapa.jpg",
    "3-Perfil.jpg": "03-perfil.jpg",
}
BORRAR = ["02-explorar.jpg", "03-desafios.jpg", "04-qr.jpg", "05-perfil.jpg"]

TARGET = (600, 1332)

for origen, destino in MAP.items():
    im = Image.open(os.path.join(SRC, origen)).convert("RGB")
    if im.size != (900, 1998):
        # recorte centrado por si el aspecto difiere un poco
        ratio = TARGET[0] / TARGET[1]
        w, h = im.size
        if w / h > ratio:
            nw = int(h * ratio); x = (w - nw) // 2; im = im.crop((x, 0, x + nw, h))
        else:
            nh = int(w / ratio); y = (h - nh) // 2; im = im.crop((0, y, w, y + nh))
    im = im.resize(TARGET, Image.LANCZOS)
    out = os.path.join(DST, destino)
    im.save(out, "JPEG", quality=85, optimize=True, progressive=True)
    print(f"{origen} -> {destino}  {im.size[0]}x{im.size[1]}  {os.path.getsize(out)//1024} KB")

for viejo in BORRAR:
    p = os.path.join(DST, viejo)
    if os.path.exists(p):
        os.remove(p)
        print(f"borrada (queda en git): {viejo}")

print("--- final:")
for f in sorted(os.listdir(DST)):
    print(" ", f, os.path.getsize(os.path.join(DST, f)) // 1024, "KB")
