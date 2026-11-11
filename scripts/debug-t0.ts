import { readFileSync } from "node:fs";
import { findRoute, haversineM, type Network, type NetNode, type NetEdge } from "../src/lib/routing";
import { crearDirOk, GATE_PIO_NONO } from "../src/lib/reglasParque";
const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as { classes: string[]; names: string[]; nodes: NetNode[]; edges: NetEdge[] };
const PENALTY: Record<string, number> = { cycleway: 0.65, path: 0.9, footway: 1.35, pedestrian: 1.1, track: 1.0, living_street: 0.95, residential: 0.95, service: 1.05, unclassified: 1.0, tertiary: 1.15, tertiary_link: 1.2, secondary: 1.5, secondary_link: 1.5, primary: 2.4, primary_link: 2.4 };
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
const dirOk = crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: false });
const PAV = {
  allowedCls: new Set(["living_street", "residential", "service", "unclassified", "tertiary", "tertiary_link", "secondary", "secondary_link", "primary", "primary_link"]),
  nameAllow: [/^Paseo Metropolitano/, /^Avenida /, /^Camino /, /^Antilen$/, /^Rotonda /, /^Terraza Bellavista/, /^Explanada$/, /^Paseo Peatonal Cumbre/],
  nameBlock: [/^Sendero Ciclista /, /^Avenida Carlos Reed/, /^Carlos Reed/],
  edgeDirOk: dirOk,
};
const casos: Array<[string, LatLngT]> = [
  ["t0 raíz", { lat: -33.43069, lon: -70.63627 }],
  ["t9", { lat: -33.42990, lon: -70.63601 }],
  ["t45", { lat: -33.42577, lon: -70.63748 }],
  ["t135 horquilla", { lat: -33.41885, lon: -70.63587 }],
];
type LatLngT = { lat: number; lon: number };
for (const [nm, dest] of casos) {
  const r1 = findRoute(net, GATE_PIO_NONO, dest, PAV);
  const r2 = findRoute(net, GATE_PIO_NONO, dest, { ...PAV, edgeDirOk: undefined });
  const fin = (r: ReturnType<typeof findRoute>) => r ? `fin (${r.coords[r.coords.length - 1].lat.toFixed(5)},${r.coords[r.coords.length - 1].lon.toFixed(5)}) ${(r.distanceM / 1000).toFixed(2)} km` : "null";
  console.log(`${nm}: conDirOk=${fin(r1)} · sinDirOk=${fin(r2)}`);
  if (r1) {
    const nombres = new Map<string, number>();
    for (const n of r1.segNames) nombres.set(n, (nombres.get(n) ?? 0) + 1);
    console.log(`   vía: ${[...nombres.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([n, c]) => `${n}×${c}`).join(" · ")}`);
  }
}
