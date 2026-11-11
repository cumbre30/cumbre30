// Componentes del grafo bajo nodeOk (+80m): ¿está el parque bien conectado?
import { readFileSync } from "node:fs";
import { haversineM } from "../src/lib/routing";
import { PARK_POLYGON } from "../src/lib/park";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[];
  names: string[];
  nodes: [number, number][];
  edges: [number, number, number, number, 0 | 1][];
};

const poly = PARK_POLYGON.map((p) => [p.lat, p.lon] as [number, number]);
function inPoly(lat: number, lon: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
    if (yi > lat !== yj > lat && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distToPolyM(lat: number, lon: number): number {
  const kx = Math.cos((lat * Math.PI) / 180);
  const px = lon * kx, py = lat;
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][1] * kx, ay = poly[j][0];
    const bx = poly[i][1] * kx, by = poly[i][0];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320);
  }
  return best;
}
const nodeOk = (lat: number, lon: number) => inPoly(lat, lon) || distToPolyM(lat, lon) <= 80;

// union-find sobre nodos (solo aristas con ambos extremos ok)
const n = raw.nodes.length;
const parent = new Int32Array(n);
for (let i = 0; i < n; i++) parent[i] = i;
function find(x: number): number {
  while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
  return x;
}
function union(a: number, b: number) {
  const ra = find(a), rb = find(b);
  if (ra !== rb) parent[ra] = rb;
}
const okNodes: boolean[] = raw.nodes.map(([lat, lon]) => nodeOk(lat, lon));
for (const [a, b] of raw.edges) {
  if (okNodes[a] && okNodes[b]) union(a, b);
}

const compSize = new Map<number, number>();
for (let i = 0; i < n; i++) if (okNodes[i]) compSize.set(find(i), (compSize.get(find(i)) ?? 0) + 1);
const sorted = [...compSize.entries()].sort((a, b) => b[1] - a[1]);
console.log(`nodos ok: ${okNodes.filter(Boolean).length} · componentes: ${sorted.length}`);
console.log("top componentes:", sorted.slice(0, 8).map(([r, s]) => `#${r}(${s})`).join(" "));

function compOf(p: { lat: number; lon: number }): { root: number; size: number; nodeDist: number } {
  let best = -1, bd = Infinity, broot = -1, bsize = 0;
  for (let i = 0; i < n; i++) {
    if (!okNodes[i]) continue;
    const d = haversineM(p, { lat: raw.nodes[i][0], lon: raw.nodes[i][1] });
    if (d < bd) { bd = d; best = i; }
  }
  const root = find(best);
  return { root, size: compSize.get(root) ?? 0, nodeDist: Math.round(bd) };
}

const PUNTOS: Record<string, { lat: number; lon: number }> = {
  gatePdVNorte: { lat: -33.411769, lon: -70.607988 },
  gatePioNono: { lat: -33.430691, lon: -70.63592 },
  gateZapadores: { lat: -33.399921, lon: -70.620406 },
  gateLaPiramide: { lat: -33.38642, lon: -70.60179 },
  antilenRoad: { lat: -33.40972, lon: -70.61345 },
  jjSur: { lat: -33.4131, lon: -70.61562 },
  jjMedio: { lat: -33.40477, lon: -70.60514 },
  nodoTupahue: { lat: -33.4215, lon: -70.6288 },
  plazaMexico: { lat: -33.4234, lon: -70.6327 },
  accesoPaseoMet: { lat: -33.412407, lon: -70.623052 },
  hubGemelos: { lat: -33.40501, lon: -70.61071 },
  laRotondaGPX: { lat: -33.409, lon: -70.6215 },
  torre5Top: { lat: -33.40805, lon: -70.60694 },
};
const comps: Record<string, string> = {};
for (const [label, p] of Object.entries(PUNTOS)) {
  const c = compOf(p);
  comps[label] = `#${c.root}(${c.size}) @${c.nodeDist}m`;
  console.log(`${label.padEnd(16)} → comp ${comps[label]}`);
}
