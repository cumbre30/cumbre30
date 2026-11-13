// Figura comparativa MTB 1 vs MTB 2 (v2): panel loop + panel zoom con los
// tramos únicos resaltados sobre los corredores Zorzal y La S.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: [number, number][];
  edges: [number, number, number, number][];
};
const IN_SECTOR = (p: [number, number]) =>
  p[0] >= -33.409 && p[0] <= -33.398 && p[1] >= -70.614 && p[1] <= -70.607;
const RE: Record<string, RegExp> = { laS: /la s/i, zorzal: /zorzal/i, anfi: /anfiteatro/i, paArriba: /arriba/i };

function polilineas(list: [number, number][][]): [number, number][][] {
  const remaining = [...list];
  const lines: [number, number][][] = [];
  const rad = (d: number) => (d * Math.PI) / 180;
  const hav = (a: [number, number], b: [number, number]) => {
    const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(s));
  };
  while (remaining.length) {
    const s0 = remaining.shift()!;
    const line: [number, number][] = [s0[0], s0[1]];
    let crecio = true;
    while (crecio) {
      crecio = false;
      for (let i = 0; i < remaining.length; i++) {
        const s = remaining[i];
        const ini = line[0], fin = line[line.length - 1];
        if (hav(s[1], fin) < 2) { line.push(s[0]); remaining.splice(i, 1); crecio = true; break; }
        if (hav(s[0], fin) < 2) { line.push(s[1]); remaining.splice(i, 1); crecio = true; break; }
        if (hav(s[1], ini) < 2) { line.unshift(s[0]); remaining.splice(i, 1); crecio = true; break; }
        if (hav(s[0], ini) < 2) { line.unshift(s[1]); remaining.splice(i, 1); crecio = true; break; }
      }
    }
    lines.push(line);
  }
  return lines;
}

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
// por corredor: solo la polilínea principal
const principales: Record<string, [number, number][]> = {};
for (const [k, segs] of Object.entries(corredores)) {
  const pls = polilineas(segs);
  const largo = (l: [number, number][]) => {
    let m = 0;
    for (let i = 1; i < l.length; i++) {
      const dLat = (l[i][0] - l[i - 1][0]) * 111_320;
      const dLon = (l[i][1] - l[i - 1][1]) * 111_320 * Math.cos((l[i][0] * Math.PI) / 180);
      m += Math.hypot(dLat, dLon);
    }
    return m;
  };
  const idx = pls.map(largo).indexOf(Math.max(...pls.map(largo)));
  principales[k] = pls[idx];
}

const a = RUTAS_TRAZADOS["mtb1"].coords;
const b = RUTAS_TRAZADOS["mtb2"].coords;
const key = (p: [number, number]) => `${p[0]},${p[1]}`;
const setB = new Set(b.map(key));
const setA = new Set(a.map(key));
// tramos únicos (índices)
const uniqA: number[] = [];
a.forEach((p, i) => { if (!setB.has(key(p))) uniqA.push(i); });
const uniqB: number[] = [];
b.forEach((p, i) => { if (!setA.has(key(p))) uniqB.push(i); });

writeFileSync("/tmp/mtb-fig2.json", JSON.stringify({
  mtb1: a, mtb2: b,
  corredores: principales,
  tramoA: a.slice(uniqA[0], uniqA[uniqA.length - 1] + 1),
  tramoB: b.slice(uniqB[0], uniqB[uniqB.length - 1] + 1),
  preA: a.slice(uniqA[0] - 12, uniqA[0] + 1),
  preB: b.slice(uniqB[0] - 12, uniqB[0] + 1),
}));

const py = `
import json, math
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

d = json.load(open("/tmp/mtb-fig2.json"))
mtb1, mtb2, cor = d["mtb1"], d["mtb2"], d["corredores"]
tramoA, tramoB = d["tramoA"], d["tramoB"]
preA, preB = d["preA"], d["preB"]

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 6.8), width_ratios=[1, 1.05], constrained_layout=True)
fig.patch.set_facecolor("#fafaf9")
kx = math.cos(math.radians(-33.4))

def estilo(ax):
    ax.set_facecolor("#eef3ec")
    ax.set_xlabel("Longitud", fontsize=9, color="#44403c")
    ax.set_ylabel("Latitud", fontsize=9, color="#44403c")
    ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda v, _: f"{v:.3f}"))
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda v, _: f"{v:.4f}"))
    ax.tick_params(labelsize=8)

# ---- Panel 1: loops completos ----
for k, (color, lw, al, z) in {"paArriba": ("#7c3aed", 1.4, 0.35, 2), "anfi": ("#b45309", 1.4, 0.35, 2), "zorzal": ("#15803d", 1.6, 0.4, 2), "laS": ("#dc2626", 1.6, 0.4, 2)}.items():
    ax1.plot([p[1] for p in cor[k]], [p[0] for p in cor[k]], color=color, lw=lw, alpha=al, zorder=z)
ax1.plot([p[1] for p in mtb1], [p[0] for p in mtb1], color="#f97316", lw=2.6, zorder=6, label="MTB 1 · 6.2 km (descenso Zorzal)")
ax1.plot([p[1] for p in mtb2], [p[0] for p in mtb2], color="#2563eb", lw=2.0, ls=(0, (5, 3)), zorder=7, label="MTB 2 · 6.4 km (descenso La S)")
ax1.set_title("Loops completos superpuestos: solo difieren en el descenso medio", fontsize=11, fontweight="bold", color="#1c1917")
ax1.legend(loc="lower left", fontsize=8.5, framealpha=0.95)
estilo(ax1)
ax1.set_xlim(-70.6245, -70.6065); ax1.set_ylim(-33.4152, -33.3985)
ax1.set_aspect(1 / kx)

# ---- Panel 2: zoom al sector de descensos ----
ax2.plot([p[1] for p in preA], [p[0] for p in preA], color="#78716c", lw=2.2, alpha=0.6, zorder=3)
ax2.plot([p[1] for p in preB], [p[0] for p in preB], color="#78716c", lw=2.2, alpha=0.6, zorder=3)
ax2.plot([p[1] for p in cor["laS"]], [p[0] for p in cor["laS"]], color="#dc2626", lw=6, alpha=0.45, zorder=4, solid_capstyle="round")
ax2.plot([p[1] for p in cor["zorzal"]], [p[0] for p in cor["zorzal"]], color="#15803d", lw=6, alpha=0.45, zorder=5, solid_capstyle="round")
ax2.plot([p[1] for p in tramoA], [p[0] for p in tramoA], color="#f97316", lw=3.2, zorder=8, solid_capstyle="round")
ax2.plot([p[1] for p in tramoB], [p[0] for p in tramoB], color="#2563eb", lw=2.6, ls=(0, (5, 3)), zorder=9)

# etiquetas posicionadas desde los datos: punto medio de cada tramo
mA = tramoA[len(tramoA) // 2]
mB = tramoB[len(tramoB) // 2]
top = cor["laS"][0]; bot = cor["laS"][-1]
if top[0] < bot[0]: top, bot = bot, top
ax2.annotate("MTB 1 baja por Zorzal", xy=(mA[1], mA[0]), xytext=(mA[1] - 0.0016, mA[0] - 0.0004),
             fontsize=10, fontweight="bold", color="#c2410c",
             arrowprops={"arrowstyle": "->", "color": "#c2410c", "lw": 1.4})
ax2.annotate("MTB 2 baja por La S", xy=(mB[1], mB[0]), xytext=(mB[1] + 0.0008, mB[0] - 0.0002),
             fontsize=10, fontweight="bold", color="#1d4ed8",
             arrowprops={"arrowstyle": "->", "color": "#1d4ed8", "lw": 1.4})
ax2.annotate("corredor Zorzal", xy=(cor["zorzal"][len(cor["zorzal"]) // 3][1], cor["zorzal"][len(cor["zorzal"]) // 3][0]),
             xytext=(cor["zorzal"][len(cor["zorzal"]) // 3][1] + 0.0004, cor["zorzal"][len(cor["zorzal"]) // 3][0] + 0.0006),
             fontsize=8.5, color="#15803d")
ax2.annotate("corredor La S", xy=(cor["laS"][2 * len(cor["laS"]) // 3][1], cor["laS"][2 * len(cor["laS"]) // 3][0]),
             xytext=(cor["laS"][2 * len(cor["laS"]) // 3][1] - 0.0022, cor["laS"][2 * len(cor["laS"]) // 3][0] - 0.0002),
             fontsize=8.5, color="#dc2626")
ax2.annotate("tramo compartido (sector alto)", xy=(preA[-1][1], preA[-1][0]),
             xytext=(preA[-1][1] - 0.0032, preA[-1][0] - 0.0011), fontsize=8.5, color="#78716c",
             arrowprops={"arrowstyle": "->", "color": "#78716c", "lw": 1.1})
ax2.annotate("fin compartido", xy=(bot[1], bot[0]), xytext=(bot[1] - 0.0022, bot[0] + 0.00055),
             fontsize=8.5, color="#78716c",
             arrowprops={"arrowstyle": "->", "color": "#78716c", "lw": 1.1})
ax2.set_title("Zoom al sector Los Gemelos: descensos paralelos a 10-35 m", fontsize=11, fontweight="bold", color="#1c1917")
estilo(ax2)
ax2.set_xlim(-70.6128, -70.6068); ax2.set_ylim(-33.4046, -33.3988)
ax2.set_aspect(1 / kx)

fig.suptitle("Verificación MTB 1 vs MTB 2 · trazados correctos: misma subida (Pa' Arriba) y descensos distintos (Zorzal / La S), como mapea la Mesa de Ciclistas", fontsize=11.5, color="#1c1917")
fig.savefig("/home/z/my-project/download/mtb1-mtb2-comparacion.png", dpi=160)
print("OK figura v2")
`;
writeFileSync("/tmp/plot-mtb2.py", py);
execSync("python3 /tmp/plot-mtb2.py", { stdio: "inherit" });
console.log("figura → /home/z/my-project/download/mtb1-mtb2-comparacion.png");
