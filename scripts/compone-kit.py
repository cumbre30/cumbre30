"""Composición de piezas gráficas del kit de redes sociales Cumbre30.

Genera con PIL sobre capturas reales de la app (3x) e imágenes IA:
  - reel/seg1..6.png   1080x1920  (frames del reel, texto quemado)
  - posts/post-1..3.png 1080x1350  (feed IG 4:5, phone mockup)
  - stories/story-1..2  1080x1920  (stories con CTA)
  - perfil/avatar.png   1080x1080

Diseño: paleta de la app (esmeralda sobre zinc-950), tipografía Carlito
Bold, marco de teléfono dibujado, degradados y viñeta.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

KIT = "/tmp/kit"
OUT = f"{KIT}/salida"
os.makedirs(f"{OUT}/reel", exist_ok=True)
os.makedirs(f"{OUT}/posts", exist_ok=True)
os.makedirs(f"{OUT}/stories", exist_ok=True)
os.makedirs(f"{OUT}/perfil", exist_ok=True)

FONT = "/usr/share/fonts/truetype/english/Carlito-Bold.ttf"
FONT_R = "/usr/share/fonts/truetype/english/Carlito-Regular.ttf"
ICONO = "/home/z/my-project/public/icons/icon-512.png"

# Paleta de marca
VERDE = (16, 185, 129)      # emerald-500
VERDE_OSC = (6, 78, 59)     # emerald-900
NEGRO = (9, 9, 11)          # zinc-950
AMBAR = (251, 191, 36)
BLANCO = (255, 255, 255)
GRIS = (161, 161, 170)      # zinc-400

def f(tam, bold=True):
    return ImageFont.truetype(FONT if bold else FONT_R, tam)

def gradiente(w, h, arriba, abajo):
    img = Image.new("RGB", (w, h), arriba)
    dr = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(int(arriba[i] + (abajo[i] - arriba[i]) * t) for i in range(3))
        dr.line([(0, y), (w, y)], fill=c)
    return img

def vineta(img, fuerza=90):
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    dr = ImageDraw.Draw(mask)
    dr.ellipse([-w * 0.25, -h * 0.15, w * 1.25, h * 1.15], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(120))
    osc = Image.new("RGB", (w, h), (0, 0, 0))
    return Image.composite(img, osc, mask)

def texto_multilinea(dr, xy, lineas, fuente, color, espaciado=14, centrado=True, w=1080):
    y = xy[1]
    for ln in lineas:
        bb = dr.textbbox((0, 0), ln, font=fuente)
        tw = bb[2] - bb[0]
        x = (w - tw) // 2 if centrado else xy[0]
        dr.text((x, y), ln, font=fuente, fill=color)
        y += (bb[3] - bb[1]) + espaciado
    return y

def pastilla(dr, cx, cy, txt, fuente, fg, bg, pad_x=34, pad_y=16, radio=None):
    bb = dr.textbbox((0, 0), txt, font=fuente)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    x0, y0 = cx - tw // 2 - pad_x, cy - th // 2 - pad_y
    x1, y1 = cx + tw // 2 + pad_x, cy + th // 2 + pad_y
    dr.rounded_rectangle([x0, y0, x1, y1], fill=bg, radius=(radio or (y1 - y0) // 2))
    dr.text((cx - tw // 2 - bb[0], cy - th // 2 - bb[1]), txt, font=fuente, fill=fg)
    return (x0, y0, x1, y1)

def marco_telefono(captura_path, alto=1180):
    """Captura real con marco de teléfono (esquinas redondeadas + sombra)."""
    cap = Image.open(captura_path).convert("RGB")
    # la captura es 1236x2745 (3x); escala proporcional a alto=alto
    w = int(cap.width * alto / cap.height)
    cap = cap.resize((w, alto), Image.LANCZOS)
    R = 56
    # máscara de esquinas redondeadas
    mask = Image.new("L", (w, alto), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w, alto], radius=R, fill=255)
    phone = Image.new("RGB", (w + 36, alto + 36), NEGRO)
    # sombra
    sombra = Image.new("RGBA", (w + 160, alto + 160), (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle(
        [80, 80, 80 + w, 80 + alto], radius=R, fill=(0, 0, 0, 230))
    sombra = sombra.filter(ImageFilter.GaussianBlur(38))
    phone = phone.convert("RGBA")
    phone.alpha_composite(sombra, (-62, -46))
    # cuerpo negro del marco
    ImageDraw.Draw(phone).rounded_rectangle([0, 0, w + 36, alto + 36],
        radius=R + 18, fill=(24, 24, 27))
    phone.paste(cap, (18, 18), mask)
    # notch píldora
    ImageDraw.Draw(phone).rounded_rectangle(
        [(w + 36) // 2 - 90, 26, (w + 36) // 2 + 90, 40], radius=7, fill=(0, 0, 0))
    return phone.convert("RGB")

def pieza_base(w, h, c_top=(10, 40, 30), c_bot=NEGRO):
    img = gradiente(w, h, c_top, c_bot)
    img = vineta(img, 110)
    return img

def pieza_con_marco(seg_path, headline, sub, badge="GRATIS · Android", hl_size=88, sub_size=46):
    """Frame del reel: headline arriba, teléfono al centro, badge abajo."""
    W, H = 1080, 1920
    img = pieza_base(W, H)
    dr = ImageDraw.Draw(img)
    y = texto_multilinea(dr, (0, 120), headline, f(hl_size), BLANCO, espaciado=18)
    if sub:
        y = texto_multilinea(dr, (0, y + 26), sub, f(sub_size, bold=False), VERDE, espaciado=10)
    phone = marco_telefono(seg_path, alto=1180)
    img.paste(phone, ((W - phone.width) // 2, y + 60))
    dr = ImageDraw.Draw(img)
    pastilla(dr, W // 2, H - 130, badge, f(44), NEGRO, VERDE)
    return img

def pieza_con_foto(foto_path, headline, sub, badge="GRATIS · Android", hl_size=96):
    """Frame del reel con foto IA full-bleed + texto sobre degradado."""
    W, H = 1080, 1920
    foto = Image.open(foto_path).convert("RGB")
    w = int(foto.width * H / foto.height)
    foto = foto.resize((w, H), Image.LANCZOS)
    foto = foto.crop(((w - W) // 2, 0, (w - W) // 2 + W, H))
    # degradado inferior para el texto
    grad = Image.new("L", (W, H), 0)
    dg = ImageDraw.Draw(grad)
    for yy in range(H):
        t = max(0.0, (yy - H * 0.42) / (H * 0.58))
        dg.line([(0, yy), (W, yy)], fill=int(255 * min(1, t ** 1.4)))
    osc = Image.new("RGB", (W, H), (5, 8, 7))
    img = Image.composite(osc, foto, grad)
    dr = ImageDraw.Draw(img)
    # barra superior de marca
    pastilla(dr, 150, 96, "CUMBRE30", f(40), BLANCO, (0, 0, 0, 150), radio=999)
    y = texto_multilinea(dr, (0, H - 560), headline, f(hl_size), BLANCO, espaciado=16)
    if sub:
        texto_multilinea(dr, (0, y + 24), sub, f(50, bold=False), VERDE, espaciado=10)
    dr = ImageDraw.Draw(img)
    pastilla(dr, W // 2, H - 130, badge, f(46), NEGRO, VERDE)
    return img

def post_feed(captura_path, headline, sub, n):
    """Post 1080x1350 con phone mockup y texto arriba."""
    W, H = 1080, 1350
    img = pieza_base(W, H, (8, 30, 24), NEGRO)
    dr = ImageDraw.Draw(img)
    # logo pequeño arriba
    icono = Image.open(ICONO).convert("RGBA").resize((92, 92), Image.LANCZOS)
    img.paste(icono, (48, 42), icono)
    dr = ImageDraw.Draw(img)
    dr.text((160, 62), "Cumbre30", font=f(52), fill=BLANCO)
    y = texto_multilinea(dr, (0, 180), headline, f(64), BLANCO, espaciado=12)
    texto_multilinea(dr, (0, y + 18), sub, f(38, bold=False), VERDE, espaciado=8)
    phone = marco_telefono(captura_path, alto=820)
    img.paste(phone, ((W - phone.width) // 2, 400))
    dr = ImageDraw.Draw(img)
    pastilla(dr, W // 2, H - 92, "Descárgala gratis → cumbregeo.cl", f(40), NEGRO, VERDE, radio=999)
    img.save(f"{OUT}/posts/post-{n}.png")

# ---------- REEL ----------
print("reel seg1 (hero IA)...")
pieza_con_foto(f"{KIT}/ia/hero-ciclista.png",
    ["¿SUBES EL", "CERRO EN BICI?"],
    ["Hay una app para eso."],
).save(f"{OUT}/reel/seg1.png")

print("reel seg2 (ride)...")
pieza_con_marco(f"{KIT}/app-ride.png",
    ["GPS REAL EN", "TU PEDALEO"],
    ["Velocidad, rumbo y mapa en vivo"],
).save(f"{OUT}/reel/seg2.png")

print("reel seg3 (ruta)...")
pieza_con_marco(f"{KIT}/app-ruta.png",
    ["RUTAS HASTA", "TU DESTINO"],
    ["Plaza México · Pío Nono · La Pirámide"],
).save(f"{OUT}/reel/seg3.png")

print("reel seg4 (alerta 30)...")
pieza_con_marco(f"{KIT}/app-ride.png",
    ["LÍMITE 30 KM/H", "CON ALERTAS"],
    ["Voz, pitidos y vibración en el parque"],
).save(f"{OUT}/reel/seg4.png")

print("reel seg5 (sensores)...")
pieza_con_marco(f"{KIT}/app-sensores.png",
    ["TU PULSO EN", "PANTALLA"],
    ["Sensores Bluetooth: FC y rueda"],
).save(f"{OUT}/reel/seg5.png")

print("reel seg6 (CTA)...")
pieza_con_foto(f"{KIT}/ia/hero-manubrio.png",
    ["PEDALEA CON", "CUMBRE30"],
    ["Descárgala gratis · Android"],
    badge="cumbregeo.cl",
    hl_size=104,
).save(f"{OUT}/reel/seg6.png")

# ---------- POSTS ----------
print("posts feed...")
post_feed(f"{KIT}/app-ride.png",
    ["Tu ciclocomputador", "del cerro, gratis"],
    ["GPS, velocidad y mapa en vivo — sin datos móviles"], 1)
post_feed(f"{KIT}/app-ruta.png",
    ["¿A dónde pedalamos", "hoy?"],
    ["Navegación hasta Plaza México, Pío Nono y más"], 2)
post_feed(f"{KIT}/app-sos.png",
    ["Pedalea tranquilo:", "tu seguridad primero"],
    ["Tarjeta de emergencia, SOS y avisos del parque"], 3)

# ---------- STORIES ----------
print("stories...")
st = pieza_con_foto(f"{KIT}/ia/hero-ciclista.png",
    ["LA APP DEL", "CERRO SAN", "CRISTÓBAL"],
    ["GPS · rutas · alertas 30 km/h"],
    badge="Desliza hacia arriba ↓",
    hl_size=110)
st.save(f"{OUT}/stories/story-1.png")
st2 = pieza_con_marco(f"{KIT}/app-sensores.png",
    ["NOVEDAD:"], ["Sensores Bluetooth en el banner"],
    badge="Prueba la v1.12.14 →", hl_size=96)
st2.save(f"{OUT}/stories/story-2.png")

# ---------- AVATAR ----------
print("avatar...")
av = Image.new("RGB", (1080, 1080), NEGRO)
dr = ImageDraw.Draw(av)
icono = Image.open(ICONO).convert("RGBA").resize((640, 640), Image.LANCZOS)
av.paste(icono, (220, 130), icono)
dr = ImageDraw.Draw(av)
bb = dr.textbbox((0, 0), "Cumbre30", font=f(120))
dr.text(((1080 - bb[2] + bb[0]) // 2, 830), "Cumbre30", font=f(120), fill=BLANCO)
av.save(f"{OUT}/perfil/avatar.png")

print("COMPOSICION_OK")
