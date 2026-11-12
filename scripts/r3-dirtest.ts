// ¿Bloquea la regla Pío Nono la bajada por GM? Probar con/sin edgeDirOk.
import { readFileSync } from "node:fs";
import { findRoute, haversineM, type FindRouteOpts, type Network, type NetNode, type NetEdge, type LatLng } from "../src/lib/routing";
import { aplicarPuentes } from "../src/lib/puentesGrafo";
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
function build(): Network {
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
  return net;
}
const netA = build(); // con reglas
const netB = build(); // sin reglas (edgeDirOk undefined)

const CLASES_PAVIMENTO = new Set([
  "living_street", "residential", "service", "unclassified",
  "tertiary", "tertiary_link", "secondary", "secondary_link",
  "primary", "primary_link",
]);
const NOMBRES_PERMITIDOS_PAV = [
  /^Paseo Metropolitano - Tramo /, /^Paseo Metropolitano$/,
  /^Paseo Metropolitano - Sendero Bellavista/, /^Avenida /, /^Camino /, /^Antilen$/, /^Rotonda /,
];
const OPTS_PAV: FindRouteOpts = {
  allowedCls: CLASES_PAVIMENTO,
  nameAllow: NOMBRES_PERMITIDOS_PAV,
  nameBlock: [/^Sendero Ciclista /, /^Avenida Carlos Reed/, /^Carlos Reed/],
};
const OPTS_PAV_DIR: FindRouteOpts = { ...OPTS_PAV, edgeDirOk: crearDirOk(netA, { pioNonoSoloSubida: true, corteCumbre: false }) };

const GM_START: LatLng = { lat: -33.416062, lon: -70.622767 };
const GM_END: LatLng = { lat: -33.414073, lon: -70.617944 };

function seq(r: ReturnType<typeof findRoute>): string {
  const nm = new Map<string, number>();
  for (const n of r?.segNames ?? []) nm.set(n, (nm.get(n) ?? 0) + 1);
  return [...nm.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n}×${c}`).join(" · ") || "(vacío)";
}
console.log("GM bajada (Bannen→Abate):");
const r1 = findRoute(netA, GM_START, GM_END, OPTS_PAV_DIR);
console.log(`  PAV+dirPio: ${r1 ? r1.distanceM.toFixed(0) + " m ← " + seq(r1) : "SIN RUTA"}`);
const r2 = findRoute(netB, GM_START, GM_END, OPTS_PAV);
console.log(`  PAV sin dir: ${r2 ? r2.distanceM.toFixed(0) + " m ← " + seq(r2) : "SIN RUTA"}`);
// y también subida GM para comparar (r1 la usa así)
const r3 = findRoute(netA, GM_END, GM_START, OPTS_PAV_DIR);
console.log(`  PAV+dirPio SUBIDA: ${r3 ? r3.distanceM.toFixed(0) + " m ← " + seq(r3) : "SIN RUTA"}`);
