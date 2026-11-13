#!/usr/bin/env python3
"""Prepara los recursos del despliegue Cumbre GEO:
1. Favicon SVG de Cumbre GEO (montaña verde + sol ámbar, tile crema).
2. Capturas del carrusel Cumbre30: redimensiona las 5 JPG subidas a
   ~600px de ancho (las imágenes originales pesan hasta 1.5 MB).
"""
from pathlib import Path
from PIL import Image

ROOT = Path("/home/z/my-project")
PUB = ROOT / "public"

# ---------- 1. Favicon Cumbre GEO ----------
FAVICON = """<?xml version="1.0" encoding="UTF-8"?>
<!-- Favicon de Cumbre GEO: misma marca del header de /geo
     (montaña verde #14453d + sol ámbar #e8a33d) sobre tile crema. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect width="24" height="24" rx="5" fill="#f6f4ef"/>
  <path d="M3 19L10 6l4 7 2-3 5 9H3z" fill="#14453d"/>
  <circle cx="18" cy="5" r="2" fill="#e8a33d"/>
</svg>
"""
(PUB / "icons" / "cumbre-geo.svg").write_text(FAVICON, encoding="utf-8")
print("favicon: public/icons/cumbre-geo.svg")

# ---------- 2. Capturas carrusel Cumbre30 ----------
SRC = ROOT / "upload"
DEST = PUB / "apps" / "cumbre30"
CAPTURAS = [
    ("1-Ride.jpg", "01-ride.jpg", "Pantalla Ride de Cumbre30"),
    ("2-Explorar.jpg", "02-explorar.jpg", "Explorar del Parque Metropolitano"),
    ("3-Desafios.jpg", "03-desafios.jpg", "Desafíos y recompensas"),
    ("4-QR.jpg", "04-qr.jpg", "Credencial QR Pedalea Seguro"),
    ("5-Perfil.jpg", "05-perfil.jpg", "Perfil e inicio de sesión"),
]
ANCHO = 600
for origen, destino, _ in CAPTURAS:
    img = Image.open(SRC / origen).convert("RGB")
    w, h = img.size
    nuevo = (ANCHO, round(h * ANCHO / w))
    img = img.resize(nuevo, Image.LANCZOS)
    img.save(DEST / destino, "JPEG", quality=82, optimize=True, progressive=True)
    kb = (DEST / destino).stat().st_size // 1024
    print(f"{destino}: {w}x{h} -> {nuevo[0]}x{nuevo[1]} ({kb} KB)")
print("LISTO")
