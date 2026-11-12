#!/usr/bin/env python3
"""Inspecciona la arista recta de mtb1 (pts 394..417) y la geometría de Zorzal / La S."""
import json, math

raw = json.load(open("/home/z/my-project/public/red-ciclista.json", encoding="utf-8"))
nodes, edges, classes, names = raw["nodes"], raw["edges"], raw["classes"], raw["names"]

def load_route(key):
    txt = open("/home/z/my-project/src/lib/rutasTrazados.ts", encoding="utf-8").read()
    i = txt.index(f'"{key}"'); i = txt.index("{", i)
    depth = 0
    for j in range(i, len(txt)):
        if txt[j] == "{": depth += 1
        elif txt[j] == "}":
            depth -= 1
            if depth == 0: break
    return json.loads(txt[i:j+1])["coords"]

def hav(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 6371000 * 2 * math.asin(math.sqrt(h))

mtb1 = load_route("mtb1")
print("=== mtb1 pts 390..420 (segmento recto) ===")
for i in range(390, 421):
    p = mtb1[i]
    print(f"  [{i}] {p[0]:.6f},{p[1]:.6f}")

# nodos exactos del grafo más cercanos a los extremos de la recta
def nearest_node(lat, lon):
    bd, bi = float("inf"), -1
    for i, (la, lo) in enumerate(nodes):
        d = hav((lat, lon), (la, lo))
        if d < bd: bd, bi = d, i
    return bi, bd

i0, d0 = nearest_node(*mtb1[394])
i1, d1 = nearest_node(*mtb1[417])
print(f"\nmtb1[394] → nodo {i0} ({d0:.1f} m) {nodes[i0]}")
print(f"mtb1[417] → nodo {i1} ({d1:.1f} m) {nodes[i1]}")

# ¿existe arista directa entre esos nodos o una cadena corta?
print("\n=== aristas incidentes a nodo", i0, "===")
for a, b, ci, ni, _c in edges:
    if a == i0 or b == i0:
        o = b if a == i0 else a
        print(f"  {a}→{b}  {classes[ci]:10s} {names[ni] or '(sin nombre)'}  dest=({nodes[o][0]:.6f},{nodes[o][1]:.6f}) d={hav(nodes[a], nodes[b]):.0f} m")

print("\n=== todas las aristas 'Sendero Ciclista El Zorzal' ===")
for a, b, ci, ni, _c in edges:
    if names[ni] == "Sendero Ciclista El Zorzal":
        print(f"  {a}({nodes[a][0]:.6f},{nodes[a][1]:.6f}) → {b}({nodes[b][0]:.6f},{nodes[b][1]:.6f})  {classes[ci]}  {hav(nodes[a],nodes[b]):.0f} m")

print("\n=== todas las aristas 'Sendero Ciclista La S' ===")
for a, b, ci, ni, _c in edges:
    if names[ni] == "Sendero Ciclista La S":
        print(f"  {a}({nodes[a][0]:.6f},{nodes[a][1]:.6f}) → {b}({nodes[b][0]:.6f},{nodes[b][1]:.6f})  {classes[ci]}  {hav(nodes[a],nodes[b]):.0f} m")

# aristas 'path'/'track' sin nombre en el rectángulo del sector (por si la recta es un way sin nombre)
print("\n=== aristas path/track SIN NOMBRE cerca de la recta zorzal→laSBajo ===")
lat_min, lat_max = -33.4036, -33.4019
lon_min, lon_max = -70.6111, -70.6098
for a, b, ci, ni, _c in edges:
    la, lo = nodes[a]
    if names[ni] == "" and classes[ci] in ("path", "track", "footway") and lat_min <= la <= lat_max and lon_min <= lo <= lon_max:
        print(f"  {a}({la:.6f},{lo:.6f}) → {b}({nodes[b][0]:.6f},{nodes[b][1]:.6f})  {classes[ci]}  {hav(nodes[a],nodes[b]):.0f} m")
