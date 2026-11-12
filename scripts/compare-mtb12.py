#!/usr/bin/env python3
"""Compara mtb1 vs mtb2 en src/lib/rutasTrazados.ts: solapamiento, divergencias, distancia."""
import json, math, re

SRC = "/home/z/my-project/src/lib/rutasTrazados.ts"

def parse_routes(path):
    txt = open(path, encoding="utf-8").read()
    routes = {}
    for m in re.finditer(r'"(mtb\d|r\d)":\s*\{', txt):
        key = m.group(1)
        i = txt.index("{", m.start())
        depth = 0
        for j in range(i, len(txt)):
            if txt[j] == "{":
                depth += 1
            elif txt[j] == "}":
                depth -= 1
                if depth == 0:
                    break
        obj = json.loads(txt[i:j+1])
        routes[key] = {"coords": obj["coords"], "distKm": float(obj["distKm"])}
    return routes

def haversine(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 6371000 * 2 * math.asin(math.sqrt(h))

def path_len(coords):
    return sum(haversine(coords[i], coords[i+1]) for i in range(len(coords)-1)) / 1000

def shared_prefix_len(a, b, tol_m=6):
    """Largo del prefijo común (comparando por cercanía, tolerancia tol_m metros)."""
    n = 0
    for x, y in zip(a, b):
        if haversine(x, y) > tol_m:
            break
        n += 1
    return n

def shared_suffix_len(a, b, tol_m=6):
    n = 0
    for x, y in zip(reversed(a), reversed(b)):
        if haversine(x, y) > tol_m:
            break
        n += 1
    return n

def nearest_dist(pt, coords):
    return min(haversine(pt, c) for c in coords)

def overlap_pct(a, b, tol_m=15):
    """% de puntos de a que caen a menos de tol_m de algún punto de b."""
    hit = sum(1 for p in a if nearest_dist(p, b) < tol_m)
    return 100.0 * hit / len(a)

routes = parse_routes(SRC)
a, b = routes["mtb1"]["coords"], routes["mtb2"]["coords"]
print(f"mtb1: {len(a)} pts, distKm declarado={routes['mtb1']['distKm']}, recalculado={path_len(a):.3f} km")
print(f"mtb2: {len(b)} pts, distKm declarado={routes['mtb2']['distKm']}, recalculado={path_len(b):.3f} km")
print(f"prefijo común: {shared_prefix_len(a,b)} pts ({shared_prefix_len(a,b)*100/len(a):.0f}% de mtb1)")
print(f"sufijo común: {shared_suffix_len(a,b)} pts")
print(f"overlap mtb1→mtb2: {overlap_pct(a,b):.1f}% | mtb2→mtb1: {overlap_pct(b,a):.1f}%")

# Identificar tramos divergentes: para cada punto de mtb1, ¿está cerca de mtb2?
def segments_apart(a, b, tol_m=15):
    segs, start = [], None
    for i, p in enumerate(a):
        off = nearest_dist(p, b) >= tol_m
        if off and start is None:
            start = i
        elif not off and start is not None:
            segs.append((start, i-1))
            start = None
    if start is not None:
        segs.append((start, len(a)-1))
    return segs

segs = segments_apart(a, b)
print(f"\nTramos de mtb1 que NO pasan por mtb2 (>15 m): {len(segs)}")
for s, e in segs:
    frag = a[s:e+1]
    print(f"  pts[{s}..{e}] ({e-s+1} pts, {path_len(frag)*1000:.0f} m) ini={a[s]} fin={a[e]}")

segs_b = segments_apart(b, a)
print(f"\nTramos de mtb2 que NO pasan por mtb1 (>15 m): {len(segs_b)}")
for s, e in segs_b:
    frag = b[s:e+1]
    print(f"  pts[{s}..{e}] ({e-s+1} pts, {path_len(frag)*1000:.0f} m) ini={b[s]} fin={b[e]}")

print(f"\nini mtb1={a[0]} fin mtb1={a[-1]}")
print(f"ini mtb2={b[0]} fin mtb2={b[-1]}")

# punto medio de cada una y extremos geográficos
for name, c in (("mtb1", a), ("mtb2", b)):
    lats = [p[0] for p in c]; lons = [p[1] for p in c]
    print(f"{name}: lat [{min(lats):.6f}, {max(lats):.6f}] lon [{min(lons):.6f}, {max(lons):.6f}] mid={c[len(c)//2]}")
