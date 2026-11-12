/**
 * Reproduce los tramos de r1 alrededor de la curva Anáhuac:
 * t0 = pdvNorte → curvaAnahuac, t1 = curvaAnahuac → nodoTupahue.
 * Muestra el final de t0 y el inicio de t1 (coordenadas exactas).
 */
import { readFileSync } from "node:fs";
import { findRoute, haversineM, type FindRouteOpts, type Network, type NetNode, type NetEdge, type LatLng } from "../src/lib/routing";
import { PARK_POLYGON } from "../src/lib/park";
import { aplicarPuentes } from "../src/lib/puentesGrafo";
import { crearDirOk } from "../src/lib/reglasParque";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[];
  names: string[];
  nodes: NetNode[];
  edges: NetEdge[];
  cicloviaPolylines: number[][];
};

const PENALTY: Record<string, number> = {
  cycleway: 0.65, path: 0.9, footway: 1.35, pedestrian: 1.1, track: 1.0,
  living_street: 0.95, residential: 0.95, service: 1.05, unclassified: 1.0,
  tertiary: 1.15, tertiary_link: 1.2, secondary: 1.5, secondary_link: 1.5,
  primary: 2.4, primary_link: 2.4,
};

const adj: Network["adj"] = raw.nodes.map(() => []);
for (const [a, b, clsIdx, nameIdx, ciclo] of raw.edges) {
  const cls = raw.classes[clsIdx] ?? "residential";
  const name = raw.names[nameIdx] ?? "";
  const p = PENALTY[cls] ?? 1;
  const pa = { lat: raw.nodes[a][0], lon: raw.nodes[a][1] };
  const pb = { lat: raw.nodes[b][0], lon: raw.nodes[b][1] };
  const dist = haversineM(pa, pb);
  const w = dist * p;
  const bearingDeg = ((Math.atan2(
    ((pb.lon - pa.lon) * Math.PI) / 180 * Math.cos((pb.lat * Math.PI) / 180),
    (pb.lat - pa.lat) * (Math.PI / 180)
  ) * 180) / Math.PI + 360) % 360;
  adj[a].push({ to: b, w, dist, cls, name, ciclovia: ciclo === 1, bearing: bearingDeg });
  adj[b].push({ to: a, w, dist, cls, name, ciclovia: ciclo === 1, bearing: (bearingDeg + 180) % 360 });
}
const net: Network = { ...raw, adj };
aplicarPuentes(net);

// réplica de OPTS_PAV y nodeOk de build-rutas.ts
function inPoly(lat: number, lon: number, poly: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lon, yi = poly[i].lat, xj = poly[j].lon, yj = poly[j].lat;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distToPolyM(lat: number, lon: number, poly: LatLng[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const kx = Math.cos((lat * Math.PI) / 180);
    const ax = a.lon * kx, ay = a.lat, bx = b.lon * kx, by = b.lat;
    const px = lon * kx, py = lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320);
  }
  return best;
}
const TOL_M = 80;
const nodeOk = (lat: number, lon: number) => inPoly(lat, lon, PARK_POLYGON) || distToPolyM(lat, lon, PARK_POLYGON) <= TOL_M;

const dirOk = crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: false });

const OPTS_PAV = {
  allowedCls: new Set([
    "living_street", "residential", "service", "unclassified",
    "tertiary", "tertiary_link", "secondary", "secondary_link",
    "primary", "primary_link",
  ]),
  nameAllow: [
    /^Paseo Metropolitano - Tramo /, /^Paseo Metropolitano$/,
    /^Paseo Metropolitano - Sendero Bellavista/, /^Avenida /, /^Camino /,
  ],
  edgeDirOk: dirOk,
};
const OPTS_PAV_PARK: FindRouteOpts = { ...OPTS_PAV, nodeOk };

const pdvNorte: LatLng = { lat: -33.415479, lon: -70.617402 };
const curvaAnahuac: LatLng = { lat: -33.41689, lon: -70.623351 };
const nodoTupahue: LatLng = { lat: -33.4215, lon: -70.6288 };

const t0 = findRoute(net, pdvNorte, curvaAnahuac, OPTS_PAV_PARK);
console.log(`t0: ${t0 ? (t0.distanceM / 1000).toFixed(3) + " km, " + t0.coords.length + " pts" : "null"}`);
if (t0) {
  console.log("t0 últimos 6 pts:");
  for (const c of t0.coords.slice(-6)) console.log(`  (${c.lat.toFixed(6)}, ${c.lon.toFixed(6)})`);
}

const t1 = findRoute(net, curvaAnahuac, nodoTupahue, OPTS_PAV_PARK);
console.log(`\nt1: ${t1 ? (t1.distanceM / 1000).toFixed(3) + " km, " + t1.coords.length + " pts" : "null"}`);
if (t1) {
  console.log("t1 primeros 6 pts:");
  for (const c of t1.coords.slice(0, 6)) console.log(`  (${c.lat.toFixed(6)}, ${c.lon.toFixed(6)})`);
}

// --- depuración: ¿a qué nodo se ancla el via curvaAnahuac? ---
import { snapInfo } from "../src/lib/routing";
const si = snapInfo(net, curvaAnahuac);
console.log(`\nsnapInfo(curvaAnahuac) → n${si.idx} (${net.nodes[si.idx][0].toFixed(6)}, ${net.nodes[si.idx][1].toFixed(6)}) d=${si.distM.toFixed(2)}m`);
// nodos a <15 m del via, por índice
const cerca: { i: number; d: number }[] = [];
net.nodes.forEach((n, i) => {
  const d = haversineM(curvaAnahuac, { lat: n[0], lon: n[1] });
  if (d < 15) cerca.push({ i, d });
});
console.log("nodos a <15 m (orden de índice):");
for (const c of cerca) console.log(`  n${c.i} (${net.nodes[c.i][0].toFixed(6)}, ${net.nodes[c.i][1].toFixed(6)}) d=${c.d.toFixed(2)}m`);
