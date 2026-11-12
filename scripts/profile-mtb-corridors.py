#!/usr/bin/env python3
"""Perfila los corredores (nombre de vía OSM) que usa cada ruta mtb1/mtb2, tramo a tramo."""
import json, math

RAW = "/home/z/my-project/public/red-ciclista.json"
raw = json.load(open(RAW, encoding="utf-8"))
nodes = raw["nodes"]          # [[lat, lon], ...]
edges = raw["edges"]          # [a, b, clsIdx, nameIdx, ciclo]
classes = raw["classes"]
names = raw["names"]

print("Clases:", classes)
print("\nNombres de senderos/caminos relevantes en la red:")
for i, n in enumerate(names):
    if any(k in n for k in ("Sendero", "S ", "La S", "Zorzal", "Anfiteatro", "Arriba", "Gemelos", "Rotonda", "Neruda", "Montaña", "Claudio")):
        print(f"  [{i}] {n}")

# grid espacial de aristas para consulta de vecino más cercano
CELL = 0.0005
grid = {}
for ei, (a, b, ci, ni, _c) in enumerate(edges):
    for nd in (a, b):
        k = (round(nodes[nd][0] / CELL), round(nodes[nd][1] / CELL))
        grid.setdefault(k, set()).add(ei)

def nearest_edge(lat, lon):
    kx = (round(lat / CELL), round(lon / CELL))
    best = (None, float("inf"))
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            for ei in grid.get((kx[0] + di, kx[1] + dj), ()):
                a, b, ci, ni, _c = edges[ei]
                ax, ay = nodes[a][1] * math.cos(math.radians(lat)), nodes[a][0]
                bx, by = nodes[b][1] * math.cos(math.radians(lat)), nodes[b][0]
                px, py = lon * math.cos(math.radians(lat)), lat
                dx, dy = bx - ax, by - ay
                l2 = dx * dx + dy * dy
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / l2)) if l2 else 0.0
                d = math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111320
                if d < best[1]:
                    best = (ei, d)
    return best

def haversine(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(h))

def load_route(key):
    txt = open("/home/z/my-project/src/lib/rutasTrazados.ts", encoding="utf-8").read()
    i = txt.index(f'"{key}"')
    i = txt.index("{", i)
    depth = 0
    for j in range(i, len(txt)):
        if txt[j] == "{": depth += 1
        elif txt[j] == "}":
            depth -= 1
            if depth == 0: break
    return json.loads(txt[i:j+1])["coords"]

def profile(key):
    coords = load_route(key)
    print(f"\n=== {key} ({len(coords)} pts) ===")
    # secuencia de corredores: agrupar tramos consecutivos por nombre+clase
    seq = []  # (name, cls, meters, first_pt, last_pt)
    for i in range(len(coords) - 1):
        mid = ((coords[i][0] + coords[i+1][0]) / 2, (coords[i][1] + coords[i+1][1]) / 2)
        ei, d = nearest_edge(*mid)
        if ei is None or d > 40:
            nm, cl = "(fuera de red)", "?"
        else:
            nm, cl = names[edges[ei][3]] or "(sin nombre)", classes[edges[ei][2]]
        m = haversine(coords[i], coords[i+1])
        if seq and seq[-1][0] == nm and seq[-1][1] == cl:
            seq[-1][2] += m
            seq[-1][4] = coords[i+1]
        else:
            seq.append([nm, cl, m, coords[i], coords[i+1]])
    for nm, cl, m, p0, p1 in seq:
        if m >= 15:  # ignora juntas <15 m
            print(f"  {m:7.0f} m  {cl:12s}  {nm}")
    return coords

a = profile("mtb1")
b = profile("mtb2")

# ¿dónde están los nodos más cercanos a los vias laS* y qué arista los toca?
VIAS = {
    "paArribaAlto": (-33.40042, -70.60964),
    "anfiteatroAlto": (-33.39988, -70.61017),
    "zorzal": (-33.40197, -70.60993),
    "laSAlto": (-33.40073, -70.61031),
    "laSMedio": (-33.40315, -70.61034),
    "laSBajo": (-33.40343, -70.61092),
    "hubGemelos": (-33.40501, -70.61071),
    "laRotonda": (-33.4093, -70.6213),
}
print("\n=== vias → arista más cercana ===")
for k, (lat, lon) in VIAS.items():
    ei, d = nearest_edge(lat, lon)
    if ei is None:
        print(f"  {k:15s} → sin arista a <40 m")
    else:
        a_, b_, ci, ni, _c = edges[ei]
        print(f"  {k:15s} → {d:5.1f} m  {classes[ci]:10s}  {names[ni] or '(sin nombre)'}  nodo {a_} ({nodes[a_][0]:.6f},{nodes[a_][1]:.6f})")
