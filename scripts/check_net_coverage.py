#!/usr/bin/env python3
# Chequea cobertura del grafo red-ciclista.json cerca de la cumbre REAL
# y valida que los puntos queden dentro del polígono del parque.
import json, math

net = json.load(open("/home/z/my-project/public/red-ciclista.json"))
nodes = net["nodes"]
print(f"nodos del grafo: {len(nodes)}")

def hav_km(a, b):
    toR = math.pi / 180
    dLat = (b[0] - a[0]) * toR
    dLon = (b[1] - a[1]) * toR
    s = math.sin(dLat / 2) ** 2 + math.cos(a[0] * toR) * math.cos(b[0] * toR) * math.sin(dLon / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(s))

def nearest(p):
    best, bi = 1e9, -1
    for i, n in enumerate(nodes):
        d = hav_km(p, n)
        if d < best:
            best, bi = d, i
    return bi, best

PUNTOS = {
    "cumbre REAL (Virgen)":      (-33.42527, -70.63324),
    "plaza México (estimada)":   (-33.42340, -70.63250),
    "estación Foster":           (-33.42277, -70.63103),
    "cumbre VIEJA (errónea)":    (-33.40400, -70.61700),
    "piscina Tupahue":           (-33.41582, -70.62353),
    "piscina Antilén":           (-33.40901, -70.61385),
    "acceso Pío Nono":           (-33.430691, -70.63592),
    "acceso PdV Norte":          (-33.411769, -70.607988),
}
for name, p in PUNTOS.items():
    bi, d = nearest(p)
    n = nodes[bi]
    print(f"  {name:26} -> nodo más cercano {d*1000:6.0f} m  ({n[0]:.5f},{n[1]:.5f})")

# punto-en-polígono (ray casting) con el polígono simplificado del código
poly = json.load(open("/home/z/my-project/scripts/osm-calibrated.json"))["park"]

def inside(pt, poly):
    x, y = pt[1], pt[0]
    c = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i][1], poly[i][0]
        x2, y2 = poly[(i + 1) % n][1], poly[(i + 1) % n][0]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c

print()
for name, p in PUNTOS.items():
    print(f"  {name:26} dentro del polígono del parque: {inside(p, poly)}")

# distancias reales entre puntos clave (haversine)
print()
pares = [
    ("acceso Pío Nono → cumbre REAL", PUNTOS["acceso Pío Nono"], PUNTOS["cumbre REAL (Virgen)"]),
    ("acceso PdV Norte → cumbre REAL", PUNTOS["acceso PdV Norte"], PUNTOS["cumbre REAL (Virgen)"]),
    ("piscina Antilén → cumbre REAL", PUNTOS["piscina Antilén"], PUNTOS["cumbre REAL (Virgen)"]),
    ("cumbre REAL → plaza México", PUNTOS["cumbre REAL (Virgen)"], PUNTOS["plaza México (estimada)"]),
    ("cumbre REAL → Tupahue", PUNTOS["cumbre REAL (Virgen)"], PUNTOS["piscina Tupahue"]),
    ("cumbre VIEJA → cumbre REAL", PUNTOS["cumbre VIEJA (errónea)"], PUNTOS["cumbre REAL (Virgen)"]),
]
for name, a, b in pares:
    print(f"  {name:32} {hav_km(a, b)*1000:6.0f} m")
