# Mide cuánto rotó el mapa del dispositivo entre NORTE y RUMBO:
# busca θ que minimiza el SSD (escala de grises) entre el crop RUMBO rotado
# y el crop NORTE (north-up). Si la cámara aplicara mapBearing=routeBearing,
# θ ≡ rumbo de la ruta (la ruta quedaría vertical).
import glob

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation

fs = sorted(glob.glob("/tmp/frame_*.png"))
X0, Y0, X1, Y1 = 30, 358, 545, 585

def crop_mapa(path):
    im = np.asarray(Image.open(path).convert("RGB").crop((X0, Y0, X1, Y1)), dtype=np.int16)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    verde = (g > r + 25) & (g > b + 25)
    oscuro_ui = (r < 60) & (g < 60) & (b < 60)
    ui = binary_dilation(verde, iterations=9) | binary_dilation(oscuro_ui, iterations=2)
    # UI conocida por coords: leyenda (top-izq), controles (top-der)
    ui[0:58, 0:265] = True
    ui[0:120, -62:] = True
    gray = im.mean(axis=2)
    gray[ui] = np.nan
    return gray

def ssd_rotado(a, b, theta):
    # rota `a` theta grados (PIL: positivo = antihorario) alrededor del centro
    im = Image.fromarray(np.nan_to_num(a, nan=128.0))
    rot = np.asarray(im.rotate(theta, resample=Image.BILINEAR, fillcolor=128), dtype=np.float64)
    valid = ~np.isnan(a) & ~np.isnan(b)
    d = (rot - b)[valid]
    return float((d * d).mean())

norte = crop_mapa(fs[6])   # frame 7: NORTE
for fi in (8, 9):          # frames 9,10: RUMBO
    rumbo = crop_mapa(fs[fi])
    best = min(((ssd_rotado(rumbo, norte, t), t) for t in range(-90, 91, 1)))
    # refinado ±1.5° en pasos de 0.25
    t0 = best[1]
    fine = min(((ssd_rotado(rumbo, norte, t0 + dt), t0 + dt) for dt in np.arange(-1.5, 1.51, 0.25)))
    print(f"frame {fi+1} (RUMBO): rotación vs NORTE = {fine[1]:+.2f}°  (ssd {fine[0]:.1f})")
