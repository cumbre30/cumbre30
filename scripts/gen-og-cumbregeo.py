# Genera public/og-cumbregeo.jpg (1200x630): Open Graph de CumbreGeo.
# Identidad: verde bosque + contornos topográficos + marca montaña/sol.
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
img = Image.new("RGB", (W, H), "#0b2b26")
d = ImageDraw.Draw(img, "RGBA")

# Degradado vertical verde-oscuro → verde bosque
for y in range(H):
    t = y / H
    r = int(0x0B + (0x14 - 0x0B) * t)
    g = int(0x2B + (0x45 - 0x2B) * t)
    b = int(0x26 + (0x3D - 0x26) * t)
    d.line([(0, y), (W, y)], fill=(r, g, b))

# Contornos topográficos (curvas suaves, blanco translúcido)
import math
def topo(base_y, amp, phase, op):
    pts = []
    for x in range(0, W + 20, 20):
        y = base_y + amp * math.sin(x / 140 + phase) + amp * 0.5 * math.sin(x / 61 + phase * 1.7)
        pts.append((x, y))
    d.line(pts, fill=(255, 255, 255, op), width=3)
for i, (by, amp, ph) in enumerate([(520, 60, 0.4), (560, 50, 1.1), (480, 70, 2.0), (430, 55, 2.8)]):
    topo(by, amp, ph, 26 - i * 4)

# Marca: montaña + sol (misma del logo)
d.polygon([(120, 470), (240, 260), (330, 420), (380, 340), (470, 470)], fill=(255, 255, 255, 235))
d.ellipse([(430, 190), (490, 250)], fill=(232, 163, 61, 255))

# Textos
f_marca = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 64)
f_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 30)
f_linea = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
d.text((520, 270), "CUMBREGEO", font=f_marca, fill=(255, 255, 255, 255))
d.text((522, 360), "Tecnología que conecta ideas", font=f_sub, fill=(213, 230, 225, 255))
d.text((522, 404), "con soluciones.", font=f_sub, fill=(213, 230, 225, 255))
d.text((522, 470), "OUTDOOR & GEOSPATIAL  ·  CUMBREDOCS", font=f_linea, fill=(169, 214, 171, 255))

img.save("public/og-cumbregeo.jpg", quality=88)
print("OG guardada:", img.size)
