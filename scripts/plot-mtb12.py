#!/usr/bin/env python3
"""Grafica mtb1 y mtb2 sobre la red de senderos ciclistas del grafo OSM propio."""
import json, math
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection

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

mtb1, mtb2 = load_route("mtb1"), load_route("mtb2")

def edges_named(prefix):
    segs = []
    for a, b, ci, ni, _c in edges:
        n = names[ni] or ""
        if n.startswith(prefix):
            segs.append(((nodes[a][1], nodes[a][0]), (nodes[b][1], nodes[b][0])))
    return segs

fig, ax = plt.subplots(figsize=(11, 12), constrained_layout=True)

# fondo: toda la red ciclista/path del sector, muy tenue
fondo = []
for a, b, ci, ni, _c in edges:
    if classes[ci] in ("cycleway", "path", "track"):
        fondo.append(((nodes[a][1], nodes[a][0]), (nodes[b][1], nodes[b][0])))
ax.add_collection(LineCollection(fondo, colors="#d0d0d0", linewidths=0.7, zorder=1))

# senderos clave
estilos = [
    ("Sendero Ciclista Pa' Arriba", "#8b5a2b", 2.2, "Pa' Arriba (ascenso)"),
    ("Sendero Ciclista Anfiteatro", "#8a2be2", 2.2, "Anfiteatro"),
    ("Sendero Ciclista El Zorzal", "#d62728", 2.8, "El Zorzal"),
    ("Sendero Ciclista La S", "#2ca02c", 2.8, "La S"),
]
for pref, color, lw, lbl in estilos:
    s = edges_named(pref)
    ax.add_collection(LineCollection(s, colors=color, linewidths=lw, zorder=3, label=lbl))

# rutas
for pts, color, lbl, z in ((mtb1, "#1f77b4", "MTB 1 (6.24 km)", 5), (mtb2, "#ff7f0e", "MTB 2 (6.37 km)", 5)):
    xs = [p[1] for p in pts]; ys = [p[0] for p in pts]
    ax.plot(xs, ys, color=color, linewidth=1.4, alpha=0.85, zorder=z, label=lbl,
            linestyle="--" if color == "#ff7f0e" else "-")

VIAS = {
    "laRotonda": (-33.4093, -70.6213),
    "hubGemelos": (-33.40501, -70.61071),
    "paArriba": (-33.40275, -70.60949),
    "paArribaAlto": (-33.40042, -70.60964),
    "anfiteatroAlto": (-33.39988, -70.61017),
    "zorzal": (-33.40197, -70.60993),
    "laSAlto": (-33.40073, -70.61031),
    "laSMedio": (-33.40315, -70.61034),
    "laSBajo": (-33.40343, -70.61092),
}
for k, (lat, lon) in VIAS.items():
    ax.plot(lon, lat, "k+", markersize=9, markeredgewidth=1.6, zorder=6)
    ax.annotate(k, (lon, lat), textcoords="offset points", xytext=(5, 4), fontsize=7.5, zorder=6)

ax.set_xlabel("lon"); ax.set_ylabel("lat")
ax.set_title("MTB 1 vs MTB 2 · sector Los Gemelos (senderos del grafo OSM propio)")
ax.legend(loc="upper left", fontsize=9)
ax.set_aspect(1 / math.cos(math.radians(-33.4)))
# zoom al sector de senderos
ax.set_xlim(-70.6145, -70.6070)
ax.set_ylim(-33.4060, -33.3975)
ax.grid(True, alpha=0.25)
fig.savefig("/home/z/my-project/scripts/mtb12-sector.png", dpi=110)
print("ok → scripts/mtb12-sector.png")

# segundo mapa: vista completa del loop
fig2, ax2 = plt.subplots(figsize=(11, 10), constrained_layout=True)
ax2.add_collection(LineCollection(fondo, colors="#e0e0e0", linewidths=0.5, zorder=1))
for pts, color, lbl in ((mtb1, "#1f77b4", "MTB 1 (6.24 km)"), (mtb2, "#ff7f0e", "MTB 2 (6.37 km)")):
    xs = [p[1] for p in pts]; ys = [p[0] for p in pts]
    ax2.plot(xs, ys, color=color, linewidth=1.6, alpha=0.85, zorder=5, label=lbl)
ax2.plot(VIAS["laRotonda"][1], VIAS["laRotonda"][0], "k*", markersize=14, zorder=6, label="La Rotonda (inicio/fin)")
ax2.set_xlabel("lon"); ax2.set_ylabel("lat")
ax2.set_title("MTB 1 vs MTB 2 · loop completo")
ax2.legend(loc="upper left", fontsize=9)
ax2.set_aspect(1 / math.cos(math.radians(-33.4)))
ax2.set_xlim(-70.6235, -70.6060)
ax2.set_ylim(-33.4145, -33.3970)
ax2.grid(True, alpha=0.25)
fig2.savefig("/home/z/my-project/scripts/mtb12-loop.png", dpi=110)
print("ok → scripts/mtb12-loop.png")
