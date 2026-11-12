# Autointersecciones del polígono + zooms de zonas críticas
import json, math
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MplPoly

G = json.load(open("public/red-ciclista.json"))
nodes, edges, names = G["nodes"], G["edges"], G["names"]
POLY = json.load(open("/tmp/render/osm-boundary-park.json"))


def segs_intersect(p1, p2, p3, p4):
    def ccw(A, B, C):
        return (C[1] - A[1]) * (B[0] - A[0]) - (B[1] - A[1]) * (C[0] - A[0])
    d1 = ccw(p3, p4, p1)
    d2 = ccw(p3, p4, p2)
    d3 = ccw(p1, p2, p3)
    d4 = ccw(p1, p2, p4)
    return ((d1 > 0) != (d2 > 0)) and ((d3 > 0) != (d4 > 0))


n = len(POLY)
bad = []
for i in range(n):
    a1, a2 = POLY[i], POLY[(i + 1) % n]
    for k in range(i + 2, n):
        if i == 0 and k == n - 1:
            continue
        b1, b2 = POLY[k], POLY[(k + 1) % n]
        if segs_intersect(a1, a2, b1, b2):
            bad.append((i, k))
print("AUTOCRUZES:", len(bad))
for i, k in bad[:10]:
    print(f"  seg[{i}] {POLY[i]} -> {POLY[(i+1)%n]}  x  seg[{k}] {POLY[k]} -> {POLY[(k+1)%n]}")

GATES = [
    ("Pío Nono", -33.430691, -70.63592), ("PdV Norte", -33.415479, -70.617402),
    ("La Pirámide", -33.38642, -70.60179), ("Zapadores", -33.399921, -70.620406),
]
ZOOMS = [
    ("elcerro", (-70.6225, -70.6125), (-33.4205, -33.4125)),
    ("pionono", (-70.6395, -70.6310), (-33.4350, -33.4270)),
    ("piramide", (-70.6050, -70.5985), (-33.3910, -33.3835)),
    ("zapadores", (-70.6240, -70.6150), (-33.4040, -33.3960)),
]
for name, lonr, latr in ZOOMS:
    fig, ax = plt.subplots(figsize=(9, 8), constrained_layout=True)
    ax.set_facecolor("#f1f2f4")
    for a, b, ci, ni, fl in edges:
        pa, pb = nodes[a], nodes[b]
        nm = names[ni] if ni < len(names) else ""
        inside_a = lonr[0] - 0.004 <= pa[1] <= lonr[1] + 0.004 and latr[0] - 0.004 <= pa[0] <= latr[1] + 0.004
        if not inside_a:
            continue
        ax.plot([pa[1], pb[1]], [pa[0], pb[0]], color="#2e7d32" if nm else "#9aa0a8", lw=0.8, zorder=1)
    ax.add_patch(MplPoly([(p[1], p[0]) for p in POLY], closed=True, fill=False, edgecolor="#d81bda", lw=2.0, zorder=5))
    for nm, la, lo in GATES:
        if lonr[0] <= lo <= lonr[1] and latr[0] <= la <= latr[1]:
            ax.plot(lo, la, "o", ms=9, mfc="#ff9100", mec="black", zorder=6)
            ax.annotate(nm, (lo, la), textcoords="offset points", xytext=(6, 5), fontsize=10, fontweight="bold", zorder=7)
    ax.set_xlim(*lonr)
    ax.set_ylim(*latr)
    ax.set_title(f"zoom {name}")
    ax.tick_params(labelsize=7)
    fig.savefig(f"/tmp/render/geo-zoom-{name}.png", dpi=100)
    print("zoom", name, "ok")
