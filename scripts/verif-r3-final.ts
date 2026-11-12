// Verificación final reglas + r3 (cliente 2026-11-12 noche)
import { readFileSync } from "node:fs";
import { findRoute, haversineM, type FindRouteOpts, type Network, type NetNode, type NetEdge, type LatLng } from "../src/lib/routing";
import { aplicarPuentes } from "../src/lib/puentesGrafo";
import { crearDirOk } from "../src/lib/reglasParque";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: NetNode[]; edges: NetEdge[]; cicloviaPolylines: number[][];
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
  adj[a].push({ to: b, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: 0 });
  adj[b].push({ to: a, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: 0 });
}
const net: Network = { ...raw, adj };
aplicarPuentes(net);

const CLASES_PAVIMENTO = new Set([
  "living_street", "residential", "service", "unclassified",
  "tertiary", "tertiary_link", "secondary", "secondary_link",
  "primary", "primary_link",
]);
const OPTS: FindRouteOpts = {
  allowedCls: CLASES_PAVIMENTO,
  nameAllow: [/^Paseo Metropolitano - Tramo /, /^Paseo Metropolitano$/, /^Paseo Metropolitano - Sendero Bellavista/, /^Avenida /, /^Camino /, /^Antilen$/, /^Rotonda /],
  nameBlock: [/^Sendero Ciclista /, /^Avenida Carlos Reed/, /^Carlos Reed/],
  edgeDirOk: crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: false }),
};
const PUENTE: LatLng = { lat: -33.416121, lon: -70.623005 };
const PIONONO: LatLng = { lat: -33.430691, lon: -70.63592 };
const PDV: LatLng = { lat: -33.415479, lon: -70.617402 };

function seq(r: ReturnType<typeof findRoute>): string {
  const nm = new Map<string, number>();
  for (const n of r?.segNames ?? []) nm.set(n, (nm.get(n) ?? 0) + 1);
  return [...nm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n, c]) => `${n}×${c}`).join(" · ");
}

// 1) Bajada puente → acceso Pío Nono (regla del cliente: SIEMPRE bloqueada)
const baj = findRoute(net, PUENTE, PIONONO, OPTS);
console.log(baj === null || baj.distanceM > 3000
  ? `✓ Pío Nono sigue SÓLO SUBIDA: puente→acceso sin bajada directa (${baj ? (baj.distanceM / 1000).toFixed(1) + " km dando la vuelta por fuera" : "sin ruta"})`
  : `✗ FALLA: bajada puente→Pío Nono posible en ${baj.distanceM.toFixed(0)} m ← ${seq(baj)}`);

// 2) Bajada puente → PdV Norte (nueva r3: recto por GM + Abate Molina)
const desc = findRoute(net, PUENTE, PDV, OPTS);
console.log(desc && desc.distanceM < 1500
  ? `✓ puente→PdV Norte recto: ${(desc.distanceM / 1000).toFixed(2)} km ← ${seq(desc)}`
  : `✗ FALLA: puente→PdV ${desc ? (desc.distanceM / 1000).toFixed(2) + " km ← " + seq(desc) : "sin ruta"}`);

// 3) Subida PdV → puente (r1 ya lo hacía) sigue OK
const sub = findRoute(net, PDV, PUENTE, OPTS);
console.log(sub && sub.distanceM < 1500 ? `✓ subida PdV→puente sigue OK: ${sub.distanceM.toFixed(0)} m ← ${seq(sub)}` : `✗ FALLA subida: ${sub?.distanceM}`);

// 4) Navegación a Plaza México (r2) intacta
const PM: LatLng = { lat: -33.4234, lon: -70.6327 };
const r2n = findRoute(net, { lat: -33.430691, lon: -70.63592 }, PM, OPTS);
console.log(r2n ? `✓ Pío Nono→Plaza México intacto: ${(r2n.distanceM / 1000).toFixed(2)} km` : "✗ FALLA r2");
