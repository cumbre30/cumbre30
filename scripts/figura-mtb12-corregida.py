#!/usr/bin/env python3
"""Figura para el cliente: MTB 1 y MTB 2 con las bajadas corregidas
(Zorzal serpenteante completo / curva de La S), tras el cambio aprobado
2026-11-13 («MTB 1 y 2 son similares, verifica si hay error»)."""
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

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14.5, 7.2), constrained_layout=True)

# ---- panel 1: loops completos superpuestos ----
for pts, color, lbl, ls, z in ((mtb1, "#1565c0", f"MTB 1 · {km1} km (bajada Zorzal)", "-", 5),
                               (mtb2, "#ef6c00", f"MTB 2 · {km2} km (bajada La S)", (0, (5, 3)), 6)):
    ax1.plot([p[1] for p in pts], [p[0] for p in pts], color=color, linewidth=2.0, linestyle=ls, zorder=z, label=lbl)
ax1.set_title("Loops completos: mismo acceso y subida (Pa' Arriba), bajada distinta",
              fontsize=10.5, fontweight="bold", color="#1c1917")
ax1.legend(loc="lower right", fontsize=9)
ax1.set_xlabel("Longitud"); ax1.set_ylabel("Latitud")
ax1.set_aspect(1 / math.cos(math.radians(-33.4)))
ax1.grid(True, alpha=0.3)
ax1.tick_params(labelsize=8)

# ---- panel 2: zoom sector con senderos reales ----
def segs_de(pref, color, lw, ls="-"):
    s = [((nodes[a][1], nodes[a][0]), (nodes[b][1], nodes[b][0]))
         for a, b, ci, ni, _c in edges if names[ni] == pref]
    ax2.add_collection(LineCollection(s, colors=color, linewidths=lw, linestyles=ls, zorder=2))

segs_de("Sendero Ciclista El Zorzal", "#ef9a9a", 5.0)
segs_de("Sendero Ciclista La S", "#a5d6a7", 5.0)
segs_de("Sendero Ciclista Pa' Arriba", "#ffe082", 4.0)
# atajo recto sin nombre (eliminado de las rutas)
atajo = [((nodes[a][1], nodes[a][0]), (nodes[b][1], nodes[b][0]))
         for a, b, ci, ni, _c in edges
         if names[ni] == "" and classes[ci] == "path"
         and -33.4040 < nodes[a][0] < -33.4015 and -70.6115 < nodes[a][1] < -70.6090]
ax2.add_collection(LineCollection(atajo, colors="black", linewidths=2.0, linestyles=":", zorder=3))

ax2.plot([p[1] for p in mtb1], [p[0] for p in mtb1], color="#1565c0", linewidth=1.6, zorder=5, label="MTB 1 baja el Zorzal completo")
ax2.plot([p[1] for p in mtb2], [p[0] for p in mtb2], color="#ef6c00", linewidth=1.6, linestyle=(0, (5, 3)), zorder=6, label="MTB 2 baja la curva de La S")

for k, (lat, lon) in {"zorzal": (-33.401971, -70.609926), "zorzalBajo": (-33.403264, -70.610174),
                      "laSAlto": (-33.400798, -70.610268), "laSMedio": (-33.403039, -70.611123),
                      "laSBajo": (-33.403428, -70.610917)}.items():
    ax2.plot(lon, lat, "k+", markersize=9, markeredgewidth=1.6, zorder=7)
    ax2.annotate(k, (lon, lat), textcoords="offset points", xytext=(6, 4), fontsize=7.5, zorder=7, fontweight="bold")

ax2.annotate("atajo recto sin nombre\n(eliminado de las rutas)", xy=(-33.4026, -70.6105),
             xytext=(-33.40235, -70.6121), fontsize=8, color="#111111",
             arrowprops={"arrowstyle": "->", "color": "#111111", "lw": 1.0})
ax2.set_title("Zoom Los Gemelos: cada vuelta por su sendero real de bajada",
              fontsize=10.5, fontweight="bold", color="#1c1917")
ax2.legend(loc="lower left", fontsize=8.5)
ax2.set_xlabel("Longitud"); ax2.set_ylabel("Latitud")
ax2.set_aspect(1 / math.cos(math.radians(-33.4)))
ax2.set_xlim(-70.6130, -70.6072)
ax2.set_ylim(-33.4048, -33.3985)
ax2.grid(True, alpha=0.3)
ax2.tick_params(labelsize=8)

fig.suptitle("Cambio aprobado 2026-11-13 · MTB 1 y MTB 2: bajadas corregidas por los senderos completos (Zorzal / La S) y sin atajo recto",
             fontsize=11.5, color="#1c1917")
fig.savefig("/home/z/my-project/download/mtb1-mtb2-comparacion.png", dpi=160)
print("OK figura actualizada → download/mtb1-mtb2-comparacion.png")
