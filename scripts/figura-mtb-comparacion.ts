// Figura comparativa MTB 1 vs MTB 2: loop completo + zoom al descenso
// donde se separan (Zorzal vs La S), con corredores del grafo superpuestos.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: [number, number][];
  edges: [number, number, number, number][];
};
const IN_SECTOR = (p: [number, number]) =>
  p[0] >= -33.409 && p[0] <= -33.398 && p[1] >= -70.614 && p[1] <= -70.607;
const RE: Record<string, RegExp> = {
  laS: /la s/i, zorzal: /zorzal/i, anfi: /anfiteatro/i, paArriba: /arriba/i,
};
const corredores: Record<string, [number, number][][]> = { laS: [], zorzal: [], anfi: [], paArriba: [] };
for (const [ai, bi, , ni] of raw.edges) {
  const name = raw.names[ni] || "";
  for (const [k, re] of Object.entries(RE)) {
    if (re.test(name)) {
      const a = raw.nodes[ai], b = raw.nodes[bi];
      if (IN_SECTOR(a) && IN_SECTOR(b)) corredores[k].push([a, b]);
      break;
    }
  }
}

const a = RUTAS_TRAZADOS["mtb1"].coords;
const b = RUTAS_TRAZADOS["mtb2"].coords;

// Python/matplotlib: dos paneles
const py = `
import json, math
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

d = json.load(open("/tmp/mtb-comparacion.json"))
mtb1 = d["mtb1"]; mtb2 = d["mtb2"]; cor = d["corredores"]

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11.5, 6.6), constrained_layout=True)
fig.patch.set_facecolor("#fafaf9")

kx = math.cos(math.radians(-33.4))

def fmt(ax):
    ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda v, _: f"{v:.4f}"))
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda v, _: f"{v:.4f}"))
    ax.tick_params(labelsize=7.5)

def panel(ax, titulo, xlim, ylim):
    ax.set_facecolor("#f0f4ef")
    for k, (color, lw, al, z) in {
        "anfi": ("#b45309", 2.4, 0.65, 2),
        "paArriba": ("#7c3aed", 2.6, 0.9, 3),
        "zorzal": ("#15803d", 4.5, 0.55, 4),
        "laS": ("#dc2626", 4.5, 0.55, 5),
    }.items():
        for seg in cor[k]:
            ax.plot([seg[0][1], seg[1][1]], [seg[0][0], seg[1][0]], color=color, lw=lw, alpha=al, zorder=z, solid_capstyle="round")
    xs1 = [p[1] for p in mtb1]; ys1 = [p[0] for p in mtb1]
    xs2 = [p[1] for p in mtb2]; ys2 = [p[0] for p in mtb2]
    ax.plot(xs1, ys1, color="#f97316", lw=2.4, alpha=0.95, zorder=6)
    ax.plot(xs2, ys2, color="#2563eb", lw=1.8, ls=(0, (5, 3)), alpha=0.95, zorder=7)
    ax.set_title(titulo, fontsize=11.5, fontweight="bold", color="#1c1917")
    ax.set_xlim(xlim); ax.set_ylim(ylim)
    ax.set_aspect(1 / kx)
    ax.set_xlabel("Longitud", fontsize=9, color="#44403c")
    ax.set_ylabel("Latitud", fontsize=9, color="#44403c")
    fmt(ax)

# Panel 1: loop completo
lats1 = [p[0] for p in mtb1]; lons1 = [p[1] for p in mtb1]
lats2 = [p[0] for p in mtb2]; lons2 = [p[1] for p in mtb2]
panel(ax1, "Loop completo · MTB 1 (6.2 km) y MTB 2 (6.4 km) superpuestos",
      (min(lons1 + lons2) - 0.002, max(lons1 + lons2) + 0.002),
      (min(lats1 + lats2) - 0.0015, max(lats1 + lats2) + 0.0015))

# Panel 2: zoom al sector de descensos (Los Gemelos), tramos 340-520
z1 = mtb1[350:510]; z2 = mtb2[350:520]
panel(ax2, "Zoom al descenso: MTB 1 baja por Zorzal (verde) · MTB 2 por La S (rojo)",
      (-70.6122, -70.6080), (-33.4048, -33.3990))
# anota los nombres sobre el sector
ax2.annotate("La S", xy=(-70.6101, -33.4021), fontsize=10, fontweight="bold", color="#dc2626", ha="left")
ax2.annotate("Zorzal", xy=(-70.6097, -33.4023), fontsize=10, fontweight="bold", color="#15803d", ha="left")
ax2.annotate("Pa' Arriba (subida compartida)", xy=(-70.6094, -33.4000), fontsize=8.5, color="#7c3aed", ha="left")
ax2.annotate("MTB 1", xy=(-70.6104, -33.4018), fontsize=9, fontweight="bold", color="#f97316", ha="right")
ax2.annotate("MTB 2", xy=(-70.6092, -33.4016), fontsize=9, fontweight="bold", color="#2563eb", ha="left")

handles = [
    Line2D([0], [0], color="#f97316", lw=2.6, label="MTB 1 · Loop Los Gemelos (6.2 km, baja por Zorzal)"),
    Line2D([0], [0], color="#2563eb", lw=2.0, ls=(0, (5, 3)), label="MTB 2 · Loop Técnico La S (6.4 km, baja por La S)"),
    Line2D([0], [0], color="#dc2626", lw=4.5, alpha=0.55, label="Sendero Ciclista La S (descenso exclusivo)"),
    Line2D([0], [0], color="#15803d", lw=4.5, alpha=0.55, label="Sendero Ciclista El Zorzal (descenso)"),
    Line2D([0], [0], color="#7c3aed", lw=2.6, label="Sendero Ciclista Pa' Arriba (subida compartida)"),
    Line2D([0], [0], color="#b45309", lw=2.4, alpha=0.65, label="Sendero Ciclista Anfiteatro"),
]
fig.legend(handles=handles, loc="outside lower center", ncols=2, fontsize=8.5, frameon=False)
fig.suptitle("MTB 1 y MTB 2 comparten acceso, subida (Pa' Arriba) y retorno; solo cambia el descenso medio", fontsize=11, color="#1c1917")
fig.savefig("/home/z/my-project/download/mtb1-mtb2-comparacion.png", dpi=160)
print("OK figura")
`;

mkdirSync("/home/z/my-project/download", { recursive: true });
writeFileSync("/tmp/mtb-comparacion.json", JSON.stringify({ mtb1: a, mtb2: b, corredores }));
writeFileSync("/tmp/plot-mtb.py", py);
if (!existsSync("/home/z/my-project/download")) execSync("mkdir -p /home/z/my-project/download");
execSync("python3 /tmp/plot-mtb.py", { stdio: "inherit" });
console.log("figura → /home/z/my-project/download/mtb1-mtb2-comparacion.png");
