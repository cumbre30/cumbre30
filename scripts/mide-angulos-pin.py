# Ángulo exacto de la línea de ruta en pantalla, RANSAC anclado al pin verde
# (la ruta nace en el pin): sólo valen líneas que pasen a <25px del pin.
import glob
import math
import random

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, label as cclabel

random.seed(7)
fs = sorted(glob.glob("/tmp/frame_*.png"))
X0, Y0, X1, Y1 = 25, 352, 548, 588

def centro_pin(im_rgb):
    r, g, b = im_rgb[..., 0], im_rgb[..., 1], im_rgb[..., 2]
    verde = (g > r + 40) & (g > b + 40)
    lab, n = cclabel(verde)
    if not n:
        return None
    big = np.argmax(np.bincount(lab.ravel())[1:]) + 1
    ys, xs = np.nonzero(lab == big)
    return float(xs.mean()), float(ys.mean())

def angulo_ruta(path):
    im = np.asarray(Image.open(path).convert("RGB").crop((X0, Y0, X1, Y1)), dtype=np.int16)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    dark = (r < 45) & (g < 45) & (b < 45)
    verde = (g > r + 40) & (g > b + 40)
    pin = centro_pin(im)
    if pin is None:
        return None, 0, None
    dark &= ~binary_dilation(verde, iterations=10)
    ys, xs = np.nonzero(dark)
    pts = np.vstack([xs, ys]).T.astype(float)
    # excluir UI: leyenda (top-izq), controles (top-der), banda superior
    pts = pts[(pts[:, 1] > 8)]
    m = ~((pts[:, 0] < 250) & (pts[:, 1] < 60))
    pts = pts[m]
    m2 = ~((pts[:, 0] > pts[:, 0].max() - 62) & (pts[:, 1] < 130))
    pts = pts[m2]
    if len(pts) < 40:
        return None, 0, pin
    n = len(pts)
    mejor, mejor_in = None, 0
    for _ in range(30000):
        i, j = random.randrange(n), random.randrange(n)
        (x1, y1), (x2, y2) = pts[i], pts[j]
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy)
        if L < 70:
            continue
        # anclaje al pin: distancia del pin a la RECTA infinita < 25px
        nx, ny = -dy / L, dx / L
        dpin = abs((pin[0] - x1) * nx + (pin[1] - y1) * ny)
        if dpin > 25:
            continue
        d = np.abs((pts[:, 0] - x1) * nx + (pts[:, 1] - y1) * ny)
        inl = (d < 1.6).sum()
        if inl > mejor_in:
            mejor_in, mejor = inl, math.degrees(math.atan2(dy, dx))
    if mejor is None:
        return None, 0, pin
    a = ((mejor % 180) + 180) % 180  # 0=horizontal→90=vertical
    return a, mejor_in, pin

etq = {6: "NORTE", 8: "RUMBO", 9: "RUMBO", 10: "RUMBO", 11: "NORTE", 12: "NORTE", 14: "NORTE"}
for i, modo in etq.items():
    a, inl, pin = angulo_ruta(fs[i])
    print(f"frame {i+1:>2} {modo:>6}: ruta {a if a else -1:6.1f}° (0=horiz, 90=vert) inliers={inl} pin={None if pin is None else (round(pin[0]),round(pin[1]))}")
