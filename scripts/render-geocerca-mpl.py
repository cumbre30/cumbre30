# Render matplotlib offline: geocerca + grafo vial (ciudad/parque) + accesos
# para auditar la geocerca SIN tiles.
import json, math
import urllib.request
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MplPoly

# matplotlib con DejaVu (sin chino necesario)
G = json.load(open("public/red-ciclista.json"))
nodes, edges, names, classes = G["nodes"], G["edges"], G["names"], G["classes"]
POLY = json.load(open("/tmp/render/osm-boundary-park.json"))  # [lat,lon]
OSM = json.load(open("/tmp/way-nodes-ll.json"))

import re, pathlib
src = pathlib.Path("src/lib/park.ts").read_text(encoding="utf-8")
def extract(var):
    m = re.search(rf"export const {var}[^=]*=\s*\[", src)
    i = src.index(m.group(0)) + len(m.group(0)) - 1
    depth = 0
    for j in range(i, len(src)):
        if src[j] == "[": depth += 1
        elif src[j] == "]":
            depth -= 1
            if depth == 0: break
    txt = src[i:j+1]
    txt = re.sub(r"//.*$", "", txt, flags=re.M)
    txt = re.sub(r"\{\s*lat:\s*(-?[\d.]+),\s*lon:\s*(-?[\d.]+)\s*\}", r"[\1,\2]", txt)
    txt = re.sub(r",(\s*[\]}])", r"\1", txt)
    return json.loads(txt)
RISK = [(z["id"], z["position"]["lat"], z["position"]["lon"]) for z in (json.loads("[]"))]  # placeholder

GATES = [
    ("Pío Nono",-33.430691,-70.63592,"ciclista"),("PdV Norte",-33.415479,-70.617402,"ciclista"),
    ("La Pirámide",-33.38642,-70.60179,"ciclista"),("Zapadores",-33.399921,-70.620406,"ciclista"),
    ("Santos Dumont",-33.423385,-70.637442,""),("Carlos Reed",-33.430102,-70.635426,""),
    ("Aurora de Chile",-33.415205,-70.627807,""),("Paseo Metropolitano",-33.412407,-70.623052,""),
]
POIS = [
    ("Plaza México",-33.4234,-70.6327),("Santuario",-33.42574,-70.63319),
    ("Antilén",-33.409051,-70.61374),("Tupahue",-33.41581,-70.62355),
    ("Jardín Jap.",-33.413345,-70.614692),("Anáhuac",-33.417135,-70.623511),
    ("Salida PdV",-33.416209,-70.619256),("Anfiteatro",-33.40401,-70.60956),
]

def pip(pt, poly):
    x, y = pt[1], pt[0]
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i][1], poly[i][0]
        xj, yj = poly[j][1], poly[j][0]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside

# clase de cada arista → parque si AMBOS extremos dentro del polígono y clase no urbana mayor
PARKNAMES = re.compile(r"Bannen|Tupahue|Martner|Mistral|Anáhuac|El Cerro|La Montaña|Funicular|Metropolitano|Sendero|Pirámide|Antilén|Jardín|Zoológico|Mackenna|Pío Nono|Bellavista|Cumbre|Foster|Abate Molina|Carlos Reed|Centenario|Excursionista|Zañartu|Federico Albert|Claudio Gay|Caupolicán|Añahuac", re.I)

# segmentos: (a, b, nombre, ambos_dentro)
segs_in, segs_out, segs_cross = [], [], []
for a, b, ci, ni, fl in edges:
    pa, pb = nodes[a], nodes[b]
    ia, ib = pip(pa, POLY), pip(pb, POLY)
    nm = names[ni] if ni < len(names) else ""
    s = (pa, pb)
    if ia and ib: segs_in.append((s, nm))
    elif ia or ib: segs_cross.append((s, nm))
    else: segs_out.append((s, nm))

fig, ax = plt.subplots(figsize=(11, 12), constrained_layout=True)
ax.set_facecolor("#eef0f2")

# ciudad (fuera) gris claro
for (pa, pb), nm in segs_out:
    ax.plot([pa[1], pb[1]], [pa[0], pb[0]], color="#b9bdc4", lw=0.35, zorder=1)
# dentro del parque verde
for (pa, pb), nm in segs_in:
    ax.plot([pa[1], pb[1]], [pa[0], pb[0]], color="#2e7d32", lw=0.5, zorder=2)
# cruzando la frontera ROJO (error potencial)
for (pa, pb), nm in segs_cross:
    ax.plot([pa[1], pb[1]], [pa[0], pb[0]], color="#e53935", lw=1.6, zorder=4)

poly = MplPoly([(p[1], p[0]) for p in POLY], closed=True, fill=False, edgecolor="#d81bda", lw=1.8, zorder=5)
ax.add_patch(poly)
# límite OSM de referencia
ox = [p[1] for p in OSM]; oy = [p[0] for p in OSM]
ax.plot(ox, oy, color="#00bcd4", lw=0.8, ls="--", zorder=3)

for nm, la, lo, tipo in GATES:
    ax.plot(lo, la, "o", ms=7, mfc="#ff9100" if tipo == "ciclista" else "#616161", mec="black", mew=0.8, zorder=6)
    ax.annotate(nm, (lo, la), textcoords="offset points", xytext=(5, 4), fontsize=7.5, fontweight="bold", zorder=7)
for nm, la, lo in POIS:
    ax.plot(lo, la, "s", ms=4, mfc="#1e88e5", mec="none", zorder=6)
    ax.annotate(nm, (lo, la), textcoords="offset points", xytext=(4, -8), fontsize=6.5, color="#0d47a1", zorder=7)

ax.set_xlim(-70.649, -70.592)
ax.set_ylim(-33.442, -33.379)
ax.set_xlabel("lon"); ax.set_ylabel("lat")
ax.set_title("Geocerca (magenta) vs límite OSM (cian) · verde=vía dentro · rojo=vía cruzando la frontera")
ax.tick_params(axis="both", labelsize=7)
ax.grid(alpha=0.2, lw=0.3)
fig.savefig("/tmp/render/geocerca-audit.png", dpi=110)
print("saved /tmp/render/geocerca-audit.png")
print("segs dentro:", len(segs_in), "fuera:", len(segs_out), "CRUZANDO:", len(segs_cross))
# listado de las vías que cruzan
from collections import Counter
c = Counter(nm for _, nm in segs_cross)
print("\nvías que CRUZAN la geocerca (top 20):")
for nm, n in c.most_common(20):
    print(f"  {n:3d} · {nm!r}")
