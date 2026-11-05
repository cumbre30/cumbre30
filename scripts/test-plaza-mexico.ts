// Verifica que "⛲ Plaza México" y "🚪 Acceso La Pirámide" (park.ts) son
// alcanzables con la red ciclista offline: findRoute desde los accesos
// típicos (Pío Nono y PdV Norte). La Cumbre ya no es destino (solo peatonal).
import * as fs from "fs";
import { findRoute, haversineM, type Network, type NetEdge, type LatLng } from "../src/lib/routing";
import { NAV_DESTINATIONS } from "../src/lib/park";

const raw = JSON.parse(fs.readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: [number, number][]; edges: NetEdge[]; cicloviaPolylines: number[][];
};
const PENALTY: Record<string, number> = {
  cycleway: 0.65, path: 0.9, footway: 1.35, pedestrian: 1.1, track: 1.0,
  living_street: 0.95, residential: 0.95, service: 1.05, unclassified: 1.0,
  tertiary: 1.15, tertiary_link: 1.2, secondary: 1.5, secondary_link: 1.5, primary: 2.4, primary_link: 2.4,
};
const adj: Network["adj"] = raw.nodes.map(() => []);
for (const [a, b, clsIdx, nameIdx, ciclo] of raw.edges) {
  const cls = raw.classes[clsIdx] ?? "residential";
  const name = raw.names[nameIdx] ?? "";
  const p = PENALTY[cls] ?? 1;
  const pa = { lat: raw.nodes[a][0], lon: raw.nodes[a][1] };
  const pb = { lat: raw.nodes[b][0], lon: raw.nodes[b][1] };
  const dist = haversineM(pa, pb);
  const y = Math.sin((pb.lon - pa.lon) * Math.PI / 180) * Math.cos(pb.lat * Math.PI / 180);
  const x = Math.cos(pa.lat * Math.PI / 180) * Math.sin(pb.lat * Math.PI / 180) - Math.sin(pa.lat * Math.PI / 180) * Math.cos(pb.lat * Math.PI / 180) * Math.cos((pb.lon - pa.lon) * Math.PI / 180);
  const brr = (Math.atan2(y, x) / Math.PI * 180 + 360) % 360;
  adj[a].push({ to: b, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: brr });
  adj[b].push({ to: a, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: (brr + 180) % 360 });
}
const net: Network = { ...raw, adj };

const D = Object.fromEntries(NAV_DESTINATIONS.map((d) => [d.id, d.position]));
const plaza = D["plaza-mexico"], piramide = D["la-piramide"];

console.log(`destino plaza-mexico: ${plaza.lat}, ${plaza.lon} · Δ a acceso la-piramide ${Math.round(haversineM(plaza, piramide))} m`);

const cases: [string, LatLng, LatLng][] = [
  ["Acceso Pío Nono → Plaza México", D["pio-nono"], plaza],
  ["Acceso PdV Norte → Plaza México", D["pv-norte"], plaza],
  ["Acceso Pío Nono → Acceso La Pirámide", D["pio-nono"], piramide],
  ["Acceso PdV Norte → Acceso La Pirámide", D["pv-norte"], piramide],
];
let fails = 0;
for (const [label, from, to] of cases) {
  const r = findRoute(net, from, to);
  if (!r) { console.log(`✗ ${label}: SIN RUTA`); fails++; continue; }
  const km = (r.distanceM / 1000).toFixed(2);
  const nNames = r.segNames?.length ?? 0;
  const first = r.segNames?.[0] ?? "";
  console.log(`✓ ${label}: ${km} km · ${nNames} tramos con nombre · empieza en "${first}"`);
}
// sanity: Plaza México y La Pirámide son destinos claramente distintos
const rPlaza = findRoute(net, D["pio-nono"], plaza);
const rPiramide = findRoute(net, D["pio-nono"], piramide);
if (rPlaza && rPiramide) {
  const d = Math.abs(rPlaza.distanceM - rPiramide.distanceM);
  console.log(`Δ distancia plaza vs pirámide desde Pío Nono: ${Math.round(d)} m (debe ser > 1 km: sectores opuestos del parque)`);
  if (d < 1000) fails++;
}
process.exit(fails ? 1 : 0);
