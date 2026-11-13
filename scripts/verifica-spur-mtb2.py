#!/usr/bin/env python3
"""Verifica: (1) extremo sur de Pa' Arriba y cadena path al sur de 27100;
(2) si mtb2 tiene ida-y-vuelta (spur) en la rama La S inferior."""
import json, math

raw = json.load(open("/home/z/my-project/public/red-ciclista.json", encoding="utf-8"))
nodes, edges, classes, names = raw["nodes"], raw["edges"], raw["classes"], raw["names"]

for nid in (27889, 27099, 27098):
    print(f"=== nodo {nid} ({nodes[nid][0]:.6f},{nodes[nid][1]:.6f}) ===")
    for a, b, ci, ni, _c in edges:
        if a == nid or b == nid:
            o = b if a == nid else a
            print(f"  {'→' if a == nid else '←'} {o}  {classes[ci]:9s} {names[ni] or '(sin nombre)'}  ({nodes[o][0]:.6f},{nodes[o][1]:.6f})")
    print()

# cadena Pa' Arriba completa (para ver sus extremos)
pa = {}
for a, b, ci, ni, _c in edges:
    if names[ni] == "Sendero Ciclista Pa' Arriba":
        pa.setdefault(a, []).append(b)
        pa.setdefault(b, []).append(a)
deg = {k: len(v) for k, v in pa.items()}
ends = [k for k, d in deg.items() if d == 1]
print(f"Pa' Arriba: {len(pa)} nodos, extremos: {[(e, nodes[e]) for e in ends]}")

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

mtb2 = load_route("mtb2")
# detectar puntos repetidos (ida y vuelta): un punto que reaparece >100 pts después
print("\n=== mtb2: detección de ida-y-vuelta (puntos que se re-visitan) ===")
seen = {}
for i, p in enumerate(mtb2):
    k = (round(p[0] * 1e5), round(p[1] * 1e5))
    if k in seen and i - seen[k] > 30:
        print(f"  pt[{seen[k]}] {p[0]:.6f},{p[1]:.6f} se re-visita en pt[{i}] (Δ{i - seen[k]} pts)")
    seen[k] = i

# tramo de mtb2 entre laSAlto y el fondo: volcar puntos
print("\n=== mtb2 pts 350..430 ===")
for i in range(350, 431):
    p = mtb2[i]
    print(f"  [{i}] {p[0]:.6f},{p[1]:.6f}")
