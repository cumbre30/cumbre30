#!/usr/bin/env python3
"""Verificación visual final: mtb1/mtb2 limpios + path sin nombre en negro."""
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
    obj = json.loads(txt[i:j+1])
    return obj["coords"], obj["distKm"]

mtb1, km1 = load_route("mtb1")
mtb2, km2 = load_route("mtb2")

fig, ax = plt.subplots(figsize=(12, 11), constrained_layout=True)

# path sin nombre (el del atajo) en negro punteado
atajo = [((nodes[a][1], nodes[a][0]), (nodes[b][1], nodes[b][0]))
         for a, b, ci, ni, _c in edges
         if names[ni] == "" and classes[ci] == "path"
         and -33.4040 < nodes[a][0] < -33.4015 and -70.6115 < nodes[a][1] < -70.6090]
ax.add_collection(LineCollection(atajo, colors="black", linewidths=2.2, linestyles=":", zorder=3, label="path sin nombre (atajo)"))

# senderos de referencia, finos
for pref, color in (("Sendero Ciclista Pa' Arriba", "#d2b48c"),
                    ("Sendero Ciclista Anfiteatro", "#dda0dd"),
                    ("Sendero Ciclista El Zorzal", "#ffb3b3"),
                    ("Sendero Ciclista La S", "#b2f2bb")):
    s = [((nodes[a][1], nodes[a][0]), (nodes[b][1], nodes[b][0]))
         for a, b, ci, ni, _c in edges if names[ni] == pref]
    ax.add_collection(LineCollection(s, colors=color, linewidths=4.5, zorder=2))

# rutas encima
xs = [p[1] for p in mtb1]; ys = [p[0] for p in mtb1]
ax.plot(xs, ys, color="#1565c0", linewidth=1.7, zorder=5, label=f"MTB 1 ({km1} km, Zorzal completo)")
xs = [p[1] for p in mtb2]; ys = [p[0] for p in mtb2]
ax.plot(xs, ys, color="#ef6c00", linewidth=1.7, linestyle=(0, (5, 3)), zorder=6, label=f"MTB 2 ({km2} km, curva La S)")

for k, (lat, lon) in {"zorzal": (-33.401971, -70.609926), "zorzalBajo": (-33.403264, -70.610174),
                      "laSAlto": (-33.400798, -70.610268), "laSMedio (curva)": (-33.403039, -70.611123),
                      "laSBajo": (-33.403428, -70.610917)}.items():
    ax.plot(lon, lat, "k+", markersize=10, markeredgewidth=1.8, zorder=7)
    ax.annotate(k, (lon, lat), textcoords="offset points", xytext=(6, 5), fontsize=8.5, zorder=7, fontweight="bold")

ax.set_xlabel("lon"); ax.set_ylabel("lat")
ax.set_title("MTB 1 vs MTB 2 corregidos · sector Los Gemelos")
ax.legend(loc="lower right", fontsize=9.5)
ax.set_aspect(1 / math.cos(math.radians(-33.4)))
ax.set_xlim(-70.6135, -70.6075)
ax.set_ylim(-33.4055, -33.3975)
ax.grid(True, alpha=0.25)
fig.savefig("/home/z/my-project/scripts/mtb12-final.png", dpi=115)
print("ok → scripts/mtb12-final.png")
