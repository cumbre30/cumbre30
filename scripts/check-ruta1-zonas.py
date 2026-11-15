#!/usr/bin/env python3
"""Verifica la distancia del trazado r1 (Ruta 1) a las 3 zonas de riesgo:
salida PDV, jardín japonés y curva Anáhuac."""
import json, re, math

RUTAS = "/home/z/my-project/src/lib/rutasTrazados.ts"

# Extraer el bloque "r1" (desde '"r1": {' hasta '"r2": {')
src = open(RUTAS, encoding="utf-8").read()
i1 = src.index('"r1": {')
i2 = src.index('"r2": {')
block = src[i1:i2]
nums = re.findall(r"-?\d+\.\d+", block)
coords = [(float(nums[k]), float(nums[k + 1])) for k in range(0, len(nums) - 1, 2)]
print(f"r1: {len(coords)} puntos · inicio {coords[0]} · fin {coords[-1]}")

ZONAS = {
    "salida-pv":     (-33.416209, -70.619256),
    "jardin-japones":(-33.413703, -70.614831),
    "anahuac":       (-33.416704, -70.623639),
}

R = 6371000.0
def dist_m(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(h))

def min_dist_polyline(zone, poly):
    best, idx = float("inf"), -1
    for i, p in enumerate(poly):
        d = dist_m(zone, p)
        if d < best:
            best, idx = d, i
    return best, idx

for name, z in ZONAS.items():
    d, idx = min_dist_polyline(z, coords)
    status = "OK  (dentro 55 m)" if d <= 55 else "FUERA"
    pct = round(100 * idx / len(coords))
    print(f"{name:16s} min={d:7.1f} m  en punto {idx}/{len(coords)} ({pct}%)  -> {status}")
