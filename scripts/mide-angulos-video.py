# Mide el ángulo en pantalla de la LÍNEA DE RUTA (casing oscuro) vía RANSAC,
# excluyendo UI (banner, leyenda, controles, pin verde).
import glob
import math
import random

import numpy as np
from PIL import Image

random.seed(42)
fs = sorted(glob.glob("/tmp/frame_*.png"))

def puntos_ruta(path, y0=352, y1=588, x0=25, x1=548):
    im = np.asarray(Image.open(path).convert("RGB").crop((x0, y0, x1, y1)), dtype=np.int16)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    dark = (r < 45) & (g < 45) & (b < 45)
    verde = (g > r + 30) & (g > b + 30)
    H, W = dark.shape
    # limpiar verde (pin) con dilatación ~14px
    from scipy.ndimage import binary_dilation
    verde = binary_dilation(verde, iterations=7)
    dark &= ~verde
    ys, xs = np.nonzero(dark)
    pts = np.vstack([xs, ys]).T
    # excluir rects de UI (coords relativas al crop)
    def excluir(pts, rx0, ry0, rx1, ry1):
        m = ~((pts[:, 0] >= rx0) & (pts[:, 0] <= rx1) & (pts[:, 1] >= ry0) & (pts[:, 1] <= ry1))
        return pts[m]
    pts = excluir(pts, 0, 0, W, 12)              # borde banner residual arriba
    pts = excluir(pts, 0, 0, 270, 55)            # leyenda (top-izq)
    pts = excluir(pts, W-60, 0, W, 130)          # controles (top-der)
    return pts, (x0, y0, W, H)

def ransac_linea(pts, tol=2.2, iters=2600):
    n = len(pts)
    mejor, mejor_in = None, 0
    for _ in range(iters):
        i, j = random.randrange(n), random.randrange(n)
        if i == j:
            continue
        (x1, y1), (x2, y2) = pts[i], pts[j]
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy)
        if L < 40:   # sólo pares lejanos: la ruta es larga
            continue
        nx, ny = -dy / L, dx / L
        d = np.abs((pts[:, 0] - x1) * nx + (pts[:, 1] - y1) * ny)
        inl = (d < tol).sum()
        if inl > mejor_in:
            mejor_in, mejor = inl, (math.degrees(math.atan2(dy, dx)), (x1, y1, dx, dy))
    if not mejor:
        return None, 0
    ang, _ = mejor
    a = ((ang % 180) + 180) % 180   # 0=horizontal, 90=vertical
    return a, mejor_in

etiquetas = {6: "NORTE", 8: "RUMBO", 9: "RUMBO", 10: "RUMBO", 11: "NORTE", 14: "NORTE"}
print(f"{'frame':>7} {'modo':>6} {'ángulo_ruta':>12} {'inliers':>8}")
res = {}
for i, modo in etiquetas.items():
    pts, _ = puntos_ruta(fs[i])
    ang, inl = ransac_linea(pts)
    res[i] = (modo, ang, inl)
    print(f"{i+1:>7} {modo:>6} {ang if ang else -1:>10.1f}° {inl:>8}")
