// Debug findRoute progresivo: qué restricción mata cada tramo.
import { readFileSync } from "node:fs";
import { findRoute, haversineM, loadNetwork, type FindRouteOpts, type LatLng } from "../src/lib/routing";
import { PARK_POLYGON } from "../src/lib/park";

// misma red que la app (loadNetwork hace fetch — aquí cargamos el JSON directo)
const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as any;
// reutilizamos loadNetwork parcheando fetch… más simple: cargar manualmente como en build-rutas
const PENALTY: Record<string, number> = {
  cycleway: 0.65, path: 0.9, footway: 1.35, pedestrian: 1.1, track: 1.0,
  living_street: 0.95, residential: 0.95, service: 1.05, unclassified: 1.0,
  tertiary: 1.15, tertiary_link: 1.2, secondary: 1.5, secondary_link: 1.5,
  primary: 2.4, primary_link: 2.4,
};
const adj: any[] = raw.nodes.map(() => []);
for (const [a, b, clsIdx, nameIdx, ciclo] of raw.edges) {
  const cls = raw.classes[clsIdx] ?? "residential";
  const name = raw.names[nameIdx] ?? "";
  const p = PENALTY[cls] ?? 1;
  const pa = { lat: raw.nodes[a][0], lon: raw.nodes[a][1] };
  const pb = { lat: raw.nodes[b][0], lon: raw.nodes[b][1] };
  const dist = haversineM(pa, pb);
  const w = dist * p;
  const bearingDeg = 0;
  adj[a].push({ to: b, w, dist, cls, name, ciclovia: ciclo === 1, bearing: bearingDeg });
  adj[b].push({ to: a, w, dist, cls, name, ciclovia: ciclo === 1, bearing: bearingDeg });
}
const net = { ...raw, adj };

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

const PAV: FindRouteOpts = {
  allowedCls: new Set(["living_street", "residential", "service", "unclassified", "tertiary", "tertiary_link", "secondary", "secondary_link", "primary", "primary_link"]),
  nameAllow: [/^Paseo Metropolitano - Tramo /, /^Paseo Metropolitano$/, /^Paseo Metropolitano - Sendero Bellavista/, /^Avenida /, /^Camino /, /^Antilen$/, /^Rotonda /],
  nameBlock: [/^Sendero Ciclista /],
};

const PdV = { lat: -33.411769, lon: -70.607988 };
const antilen = { lat: -33.40972, lon: -70.61345 };
const jjSur = { lat: -33.4131, lon: -70.61562 };

const casos: Array<[string, LatLng, LatLng, FindRouteOpts | undefined]> = [
  ["pdv→antilen sin restricción", PdV, antilen, undefined],
  ["pdv→antilen solo park", PdV, antilen, { nodeOk }],
  ["pdv→antilen PAV+park", PdV, antilen, { ...PAV, nodeOk }],
  ["pdv→jjSur sin restricción", PdV, jjSur, undefined],
  ["pdv→jjSur solo park", PdV, jjSur, { nodeOk }],
  ["pdv→jjSur PAV+park", PdV, jjSur, { ...PAV, nodeOk }],
  ["pdv→plazaMexico PAV+park", PdV, { lat: -33.4234, lon: -70.6327 }, { ...PAV, nodeOk }],
];

for (const [label, a, b, opts] of casos) {
  const r = findRoute(net as any, a, b, opts);
  console.log(`${r ? "✓" : "✗"} ${label}${r ? `: ${r.distanceM} m · ${(r.distanceM / 1000).toFixed(2)} km` : " · null"}`);
  if (r) {
    const names = new Map<string, number>();
    for (const n of r.segNames) names.set(n, (names.get(n) ?? 0) + 1);
    console.log("   vías:", [...names.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([n, c]) => `${n}×${c}`).join(" · "));
  }
}
