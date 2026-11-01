#!/usr/bin/env python3
"""Genera iconos y splash del APK Cumbre30 a partir de public/icons/icon-512.png."""
from PIL import Image, ImageDraw, ImageOps
import os

SRC = "/home/z/my-project/public/icons/icon-512.png"
RES = "/home/z/my-project/android/app/src/main/res"

icon = Image.open(SRC).convert("RGBA")

# Color de fondo: píxel interior del icono (evita la esquina transparente)
bg_pixel = icon.getpixel((30, 256))[:3]
print("Fondo detectado:", "#%02X%02X%02X" % bg_pixel)

# --- 1) ic_launcher + ic_launcher_round + foreground por densidad ---
DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
FG_BASE = {"mipmap-mdpi": 108, "mipmap-hdpi": 162, "mipmap-xhdpi": 216,
           "mipmap-xxhdpi": 324, "mipmap-xxxhdpi": 432}

def circle_mask(size: int) -> Image.Image:
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.ellipse((0, 0, size - 1, size - 1), fill=255)
    return m

for dens, size in DENSITIES.items():
    out = os.path.join(RES, dens)
    os.makedirs(out, exist_ok=True)
    # Launcher cuadrado (el PNG ya trae esquinas redondeadas + alpha)
    icon.resize((size, size), Image.LANCZOS).save(os.path.join(out, "ic_launcher.png"))
    # Launcher redondo
    r = icon.resize((size, size), Image.LANCZOS)
    r.putalpha(circle_mask(size))
    r.save(os.path.join(out, "ic_launcher_round.png"))
    # Foreground adaptativo: icono al 62% del lienzo 108dp (zona segura)
    fg_size = FG_BASE[dens]
    fg = Image.new("RGBA", (fg_size, fg_size), (0, 0, 0, 0))
    inner = int(fg_size * 0.62)
    scaled = icon.resize((inner, inner), Image.LANCZOS)
    # Redondear esquinas del icono escalado al 22% del radio
    m = Image.new("L", (inner, inner), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, inner - 1, inner - 1), radius=int(inner * 0.22), fill=255)
    scaled.putalpha(Image.composite(scaled.getchannel("A"), Image.new("L", (inner, inner), 0), m))
    fg.paste(scaled, ((fg_size - inner) // 2, (fg_size - inner) // 2), scaled)
    fg.save(os.path.join(out, "ic_launcher_foreground.png"))
    print(f"{dens}: ic_launcher {size}px, foreground {fg_size}px")

# --- 2) Color de fondo del icono adaptativo ---
with open(os.path.join(RES, "values", "ic_launcher_background.xml"), "w") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n')
    f.write('    <color name="ic_launcher_background">#%02X%02X%02X</color>\n' % bg_pixel)
    f.write('</resources>\n')

# --- 3) Splash: repintar cada splash.png con fondo + logo centrado ---
logo = icon.resize((512, 512), Image.LANCZOS)
count = 0
for root, _dirs, files in os.walk(RES):
    if "splash.png" not in files:
        continue
    path = os.path.join(root, "splash.png")
    w, h = Image.open(path).size
    canvas = Image.new("RGB", (w, h), bg_pixel)
    side = int(min(w, h) * 0.42)
    lg = logo.resize((side, side), Image.LANCZOS)
    canvas.paste(lg, ((w - side) // 2, (h - side) // 2), lg)
    canvas.save(path)
    count += 1
    print(f"splash {w}x{h} -> {os.path.relpath(path, RES)}")
print(f"OK: {count} splash generados")
