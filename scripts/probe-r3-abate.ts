// Prueba el trazado propuesto de r3 (Zapadores → La Montaña → Abate Molina
// siempre → PdV Norte, pasando Jardín Japonés y Salida PDV) ANTES de
// regenerar, y mide el cuelgue de corredorPav con net.
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
const NOMBRES_PERMITIDOS_PAV = [
  /^Paseo Metropolitano - Tramo /, /^Paseo Metropolitano$/, /^Paseo Metropolitano - Sendero Bellavista/,
  /^Avenida /, /^Camino /, /^Antilen$/, /^Rotonda /,
];
const OPTS: FindRouteOpts = {
  allowedCls: CLASES_PAVIMENTO,
  nameAllow: NOMBRES_PERMITIDOS_PAV,
  nameBlock: [/^Sendero Ciclista /, /^Avenida Carlos Reed/, /^Carlos Reed/],
  edgeDirOk: crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: false }),
};

const VIA_LA_MONTANA: LatLng = { lat: -33.40501, lon: -70.61772 };
const VIA_ABATE_JJ: LatLng = { lat: -33.413715, lon: -70.614624 }; // n30354, Abate Molina ~41 m del Jardín Japonés
const ZAPADORES: LatLng = { lat: -33.399921, lon: -70.620406 };
const PDV: LatLng = { lat: -33.415479, lon: -70.617402 };
const JJ = { lat: -33.413345, lon: -70.614692 };
const SP = { lat: -33.416209, lon: -70.619256 };
const PUENTE = { lat: -33.416121, lon: -70.623005 };

function seq(r: ReturnType<typeof findRoute>): string {
  const nm = new Map<string, number>();
  for (const n of r?.segNames ?? []) nm.set(n, (nm.get(n) ?? 0) + 1);
  return [...nm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => `${n}×${c}`).join(" · ");
}
function minDistM(coords: LatLng[], p: LatLng): number {
  let bd = Infinity;
  for (const c of coords) {
    const d = haversineM(c, p);
    if (d < bd) bd = d;
  }
  return bd;
}

async function main() {
  // tramo 1: Zapadores → via Abate JJ
  const t0 = performance.now();
  const t1 = findRoute(net, ZAPADORES, VIA_ABATE_JJ, { ...OPTS });
  console.log(`t0 Zapadores→AbateJJ: ${(t1!.distanceM / 1000).toFixed(2)} km ← ${seq(t1)} (${Math.round(performance.now() - t0)} ms)`);
  // tramo 2: JJ → PdV
  const t2 = findRoute(net, VIA_ABATE_JJ, PDV, { ...OPTS });
  console.log(`t1 AbateJJ→PdV Norte: ${(t2!.distanceM / 1000).toFixed(2)} km ← ${seq(t2)}`);
  const coords = [...t1!.coords, ...t2!.coords.slice(1)];
  console.log(`TOTAL r3 propuesta: ${(t1!.distanceM + t2!.distanceM) / 1000 < 0 ? "?" : ((t1!.distanceM + t2!.distanceM) / 1000).toFixed(2)} km, ${coords.length} pts`);
  console.log(`  min dist Jardín Japonés: ${minDistM(coords, JJ).toFixed(0)} m (zona radio 120)`);
  console.log(`  min dist Salida PDV: ${minDistM(coords, SP).toFixed(0)} m (zona radio 130)`);
  console.log(`  min dist puente Tupahue: ${minDistM(coords, PUENTE).toFixed(0)} m`);
  const cm = (t1!.segNames.filter((n) => n === "Avenida Carlos Martner").length) + (t2!.segNames.filter((n) => n === "Avenida Carlos Martner").length);
  const gm = (t1!.segNames.filter((n) => n === "Avenida Gabriela Mistral").length) + (t2!.segNames.filter((n) => n === "Avenida Gabriela Mistral").length);
  console.log(`  aristas Carlos Martner: ${cm} (esperado ≤ 2: sólo la junta del cruce de 2 m)`);
  console.log(`  aristas Gabriela Mistral: ${gm} (esperado 0)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
