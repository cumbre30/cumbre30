# Splash v2 de Cumbre30 (boceto del 2026-11-14, release v1.11.0):
#   fondo crema + tarjeta verde oscuro redondeada con tres líneas:
#     1. CUMBRE30  (CUMBRE blanco + "30" verde — la marca)
#     2. SUBE TU LÍMITE.  (verde)
#     3. PEDALEA · DESCUBRE · SUPÉRATE  (gris)
# Genera las 11 densidades de android/app/src/main/res (port + land + default).
from PIL import Image, ImageDraw, ImageFont
import os

RES = os.path.join(os.path.dirname(__file__), "..", "android", "app", "src", "main", "res")

# Paleta (marca Cumbre30)
CREMA = (244, 241, 234)      # fondo
VERDE_OSC = (11, 43, 38)     # tarjeta (verde oscuro)
BLANCO = (255, 255, 255)     # CUMBRE
VERDE = (53, 224, 143)       # "30" y SUBE TU LÍMITE
GRIS = (159, 179, 172)       # PEDALEA · DESCUBRE · SUPÉRATE

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# (carpeta, ancho, alto)
TARGETS = [
    ("drawable-port-mdpi", 320, 480),
    ("drawable-port-hdpi", 480, 800),
    ("drawable-port-xhdpi", 720, 1280),
    ("drawable-port-xxhdpi", 960, 1600),
    ("drawable-port-xxxhdpi", 1280, 1920),
    ("drawable-land-mdpi", 480, 320),
    ("drawable-land-hdpi", 800, 480),
    ("drawable-land-xhdpi", 1280, 720),
    ("drawable-land-xxhdpi", 1600, 960),
    ("drawable-land-xxxhdpi", 1920, 1280),
    ("drawable", 480, 320),
]


def draw_splash(w: int, h: int) -> Image.Image:
    im = Image.new("RGB", (w, h), CREMA)
    d = ImageDraw.Draw(im)
    short = min(w, h)

    # Tarjeta centrada (márgenes generosos como el boceto)
    margin = int(short * 0.085)
    cx0, cy0 = margin, margin
    cx1, cy1 = w - margin, h - margin
    radius = int(short * 0.10)
    d.rounded_rectangle([cx0, cy0, cx1, cy1], radius=radius, fill=VERDE_OSC)

    card_w, card_h = cx1 - cx0, cy1 - cy0
    ccx = (cx0 + cx1) // 2

    # Tamaños de tipografía relativos a la tarjeta
    f_marca = ImageFont.truetype(FONT_BOLD, int(card_h * 0.155))
    f_frase = ImageFont.truetype(FONT_BOLD, int(card_h * 0.098))
    f_lema = ImageFont.truetype(FONT_REG, int(card_h * 0.052))

    # Línea 1: CUMBRE (blanco) + 30 (verde), centradas como conjunto
    t1, t2 = "CUMBRE", "30"
    w1 = d.textlength(t1, font=f_marca)
    w2 = d.textlength(t2, font=f_marca)
    gap = int(card_w * 0.012)
    x = ccx - (w1 + gap + w2) // 2
    # línea base común
    bbox = f_marca.getbbox("CUMBRE30")
    th = bbox[3] - bbox[1]
    y_marca = int(cy0 + card_h * 0.30) - th // 2
    d.text((x, y_marca - bbox[1]), t1, font=f_marca, fill=BLANCO)
    d.text((x + w1 + gap, y_marca - bbox[1]), t2, font=f_marca, fill=VERDE)

    # Línea 2: SUBE TU LÍMITE. (verde)
    t3 = "SUBE TU LÍMITE."
    w3 = d.textlength(t3, font=f_frase)
    bbox3 = f_frase.getbbox(t3)
    y2 = int(cy0 + card_h * 0.52)
    d.text((ccx - w3 // 2, y2 - (bbox3[3] - bbox3[1]) // 2 - bbox3[1]), t3, font=f_frase, fill=VERDE)

    # Línea 3: PEDALEA · DESCUBRE · SUPÉRATE (gris)
    t4 = "PEDALEA · DESCUBRE · SUPÉRATE"
    w4 = d.textlength(t4, font=f_lema)
    bbox4 = f_lema.getbbox(t4)
    y3 = int(cy0 + card_h * 0.70)
    d.text((ccx - w4 // 2, y3 - (bbox4[3] - bbox4[1]) // 2 - bbox4[1]), t4, font=f_lema, fill=GRIS)

    return im


for folder, w, h in TARGETS:
    out = os.path.normpath(os.path.join(RES, folder, "splash.png"))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    draw_splash(w, h).save(out, "PNG")
    print(f"{folder:26} {w}x{h} OK")
print("Splash v2 generado")
