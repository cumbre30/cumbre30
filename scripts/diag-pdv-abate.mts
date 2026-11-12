// Diagnóstico: corredores posibles PdV Norte ↔ Tupahue (Casa Anáhuac)
// con el motor A* real, SIN el puente sintético "Acceso sector Tupahue".
// Verifica qué corredor usa Av. Abate Molina y cuál sería el trazado.
import { readFileSync } from "node:fs";
import { findRoute, haversineM, type FindRouteOpts, type Network, type NetNode, type NetEdge, type LatLng } from "../src/lib/routing";
import { PARK_POLYGON } from "../src/lib/park";
import { aplicarPuentes, PUENTES } from "../src/lib/puentesGrafo";
import { crearDirOk } from "../src/lib/reglasParque";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: NetNode[]; edges: NetEdge[];
};

const PENALTY: Record<string, number> = {
  cycleway: 0.65, path: 0.9, footway: 1.35, pedestrian: 1.1, track: 1.0,
  living_street: 0.95, residential: 0.95, service: 1.05, unclassified: 1.0,
  tertiary: 1.15, tertiary_link: 1.2, secondary: 1.5, secondary_link: 1.5,
  primary: 2.4, primary_link: 2.4,
};

function buildNet(puentes: boolean): Network {
  const adj: Network["adj"] = raw.nodes.map(() => []);
  for (const [a, b, clsIdx, nameIdx, ciclo] of raw.edges) {
    const cls = raw.classes[clsIdx] ?? "residential";
    const name = raw.names[nameIdx] ?? "";
    const p = PENALTY[cls] ?? 1;
    const pa = { lat: raw.nodes[a][0], lon: raw.nodes[a][1] };
    const pb = { lat: raw.nodes[b][0], lon: raw.nodes[b][1] };
    const dist = haversineM(pa, pb);
    adj[a].push({ to: b, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: 0 });
    adj[b].push({ to: a, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: 0 });
  }
  const net: Network = { ...raw, adj };
  if (puentes) aplicarPuentes(net);
  return net;
}

const CLASES_PAVIMENTO = new Set([
  "living_street", "residential", "service", "unclassified",
  "tertiary", "tertiary_link", "secondary", "secondary_link",
  "primary", "primary_link",
]);
const NOMBRES_PERMITIDOS_PAV = [
  /^Paseo Metropolitano - Tramo /,
  /^Paseo Metropolitano$/,
  /^Paseo Metropolitano - Sendero Bellavista/,
  /^Avenida /,
  /^Camino /,
  /^Antilen$/,
  /^Rotonda /,
];
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
    const ax = poly[j][1] * kx, ay = poly[j][0], bx = poly[i][1] * kx, by = poly[i][0];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320);
  }
  return best;
}
const TOL_M = 80;
const nodeOk = (lat: number, lon: number) => inPoly(lat, lon) || distToPolyM(lat, lon) <= TOL_M;
const OPTS: FindRouteOpts = {
  allowedCls: CLASES_PAVIMENTO,
  nameAllow: NOMBRES_PERMITIDOS_PAV,
  nameBlock: [/^Sendero Ciclista /, /^Avenida Carlos Reed/, /^Carlos Reed/],
};

const P = {
  pdvNorte: { lat: -33.415479, lon: -70.617402 },
  tupahueAnahuac: { lat: -33.417135, lon: -70.623511 }, // VIA.tupahue
  nodoTupahue: { lat: -33.4215, lon: -70.6288 },
  plazaMexico: { lat: -33.4234, lon: -70.6327 },
  abateMolinaMedio: { lat: -33.4141, lon: -70.6183 }, // punto medio de Abate Molina
  martnerSur: { lat: -33.4159, lon: -70.6226 },
};

function resumen(r: { segNames: string[]; distanceM: number; coords: LatLng[] } | null, tag: string) {
  if (!r) { console.log(`${tag}: ✗ sin ruta`); return; }
  const nm = new Map<string, number>();
  for (const n of r.segNames) nm.set(n, (nm.get(n) ?? 0) + 1);
  const top = [...nm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => `${n}×${c}`).join(" · ");
  console.log(`${tag}: ${(r.distanceM / 1000).toFixed(2)} km ← ${top}`);
  // saltos largos
  let prev: LatLng | null = null;
  for (const c of r.coords) {
    if (prev && haversineM(prev, c) > 120) console.log(`   SALTO ${haversineM(prev, c).toFixed(0)}m [${prev.lat.toFixed(5)},${prev.lon.toFixed(5)}] -> [${c.lat.toFixed(5)},${c.lon.toFixed(5)}]`);
    prev = c;
  }
}

// ¿Abate Molina es alcanzable y qué clase tiene?
const abateIdx = raw.names.indexOf("Avenida Abate Molina");
const clases = new Set<string>();
for (const e of raw.edges) if (e[3] === abateIdx) clases.add(raw.classes[e[2]]);
console.log("Clases de Avenida Abate Molina:", [...clases]);
const gabIdx = raw.names.indexOf("Avenida Gabriela Mistral");
const clasesGab = new Set<string>();
for (const e of raw.edges) if (e[3] === gabIdx) clasesGab.add(raw.classes[e[2]]);
console.log("Clases de Avenida Gabriela Mistral:", [...clasesGab]);
const martnerIdx = raw.names.indexOf("Avenida Carlos Martner");
const clasesMartner = new Set<string>();
for (const e of raw.edges) if (e[3] === martnerIdx) clasesMartner.add(raw.classes[e[2]]);
console.log("Clases de Avenida Carlos Martner:", [...clasesMartner]);

console.log("\n=== CON puente sintético (estado actual) ===");
const net1 = buildNet(true);
resumen(findRoute(net1, P.pdvNorte, P.tupahueAnahuac, OPTS), "pdvNorte→Anáhuac");

console.log("\n=== SIN el puente 'Acceso sector Tupahue' ===");
const net2 = buildNet(false);
resumen(findRoute(net2, P.pdvNorte, P.tupahueAnahuac, OPTS), "pdvNorte→Anáhuac");
resumen(findRoute(net2, P.pdvNorte, P.abateMolinaMedio, OPTS), "pdvNorte→AbateMolina(medio)");
resumen(findRoute(net2, P.pdvNorte, P.martnerSur, OPTS), "pdvNorte→Martner(sur)");
resumen(findRoute(net2, P.abateMolinaMedio, P.tupahueAnahuac, OPTS), "AbateMolina(medio)→Anáhuac");
resumen(findRoute(net2, P.tupahueAnahuac, P.plazaMexico, OPTS), "Anáhuac→PlazaMéxico");
