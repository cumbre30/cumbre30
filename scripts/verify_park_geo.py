#!/usr/bin/env python3
# Verifica los POI del parque contra OSM real (Overpass API) y el código.
import json, math, urllib.request, urllib.parse

BBOX = "-33.45,-70.67,-33.38,-70.58"  # S,W,N,E alrededor del cerro

NAMES = "Virgen|Inmaculada|Plaza México|Pirámide|Antilén|Tupahue|Zoológico|Jardín Japonés|Terraza Bellavista|Funicular|Teleférico Cumbre|San Cristóbal"

q = (
    "[out:json];("
    f'node["name"~"{NAMES}"]({BBOX});'
    f'way["name"~"{NAMES}"]({BBOX});'
    ");out center 120;"
)
url = "https://overpass-api.de/api/interpreter?data=" + urllib.parse.quote(q)
req = urllib.request.Request(url, headers={"User-Agent": "cumbre30-verify/1.0"})
with urllib.request.urlopen(req, timeout=60) as r:
    data = json.load(r)

def to_xy(lat, lon):
    x = lon * 92.9  # km por grado de lon a esta latitud
    y = lat * 110.9
    return x, y

def dist_km(a, b):
    ax, ay = to_xy(a[0], a[1]); bx, by = to_xy(b[0], b[1])
    return math.hypot(ax - bx, ay - by)

# Posiciones actuales en el código (park.ts)
CODE = {
    "cumbre (código)":       (-33.404,   -70.617),
    "plaza-mexico (código)": (-33.4026,  -70.6164),
    "piscina antilén (cód)": (-33.409051,-70.61374),
    "jardín japonés (cód)":  (-33.413345,-70.614692),
    "zoológico (código)":    (-33.429636,-70.633963),
    "pío nono (código)":     (-33.430691,-70.63592),
    "pdv norte (código)":    (-33.411769,-70.607988),
    "anáhuac (código)":      (-33.417135,-70.623511),
}

print("== Elementos OSM encontrados (Overpass) ==")
results = []
for el in data.get("elements", []):
    name = el.get("tags", {}).get("name", "?")
    if el["type"] == "node":
        pos = (el["lat"], el["lon"])
    else:
        c = el.get("center") or {}
        if "lat" not in c:
            continue
        pos = (c["lat"], c["lon"])
    results.append((name, pos, el["type"], el["id"], el.get("tags", {}).get("tourism", el.get("tags", {}).get("leisure", ""))))
    # distancia al POI del código más cercano
    best = min(((d, cn) for cn, cp in CODE.items() for d in [dist_km(pos, cp)]))
    print(f"  {el['type']:5} {el['id']:12} {name:38} {pos[0]:10.5f} {pos[1]:11.5f}  ({el.get('tags',{}).get('tourism') or el.get('tags',{}).get('leisure') or '-'})")

print()
print("== Distancias del POI de código más cercano ==")
for name, pos, *_ in results:
    best = min(((dist_km(pos, cp), cn) for cn, cp in CODE.items()))
    print(f"  {name:38} -> {best[1]:22} {best[0]*1000:7.0f} m")

with open("/home/z/my-project/scripts/overpass_park.json", "w") as f:
    json.dump(data, f, ensure_ascii=False, indent=1)
print("\nguardado en scripts/overpass_park.json")
