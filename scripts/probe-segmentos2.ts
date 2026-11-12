// Sondeo 2 para segmentos:
// a) Distancia de cada punto del sendero Zorro Vidal al trazado del
//    camino b30-pionono → encontrar el punto bajo (lado Pío Nono) donde
//    el sendero se separa >150 m del camino (nueva meta de Zorro Vidal).
// b) ¿Existe subida ciclable directa Acceso La Pirámide → Plaza México?
//    findRoute en la red ciclista (igual que la app).
import * as fs from "fs";
import { findRoute, haversineM, type Network, type NetEdge } from "../src/lib/routing";
import { GATES, NAV_DESTINATIONS } from "../src/lib/park";
import { BAJADAS_CONTROL_30 } from "../src/lib/rutasTrazados";
import { SENDEROS } from "../src/lib/senderos";

const road = BAJADAS_CONTROL_30.find((b) => b.id === "b30-pionono")!.coords;
const distToRoad = (p: { lat: number; lon: number }) => {
  let m = Infinity;
  for (const c of road) m = Math.min(m, haversineM(p, { lat: c[0], lon: c[1] }));
  return m;
};

const zorro = SENDEROS.find((s) => s.id === "zorro-vidal")!;
console.log("=== a) Sendero Zorro Vidal vs camino b30-pionono ===");
console.log(`pts: ${zorro.pts!.length} · cabeza: ${zorro.cabeza!.lat},${zorro.cabeza!.lon}`);
const rows = zorro.pts!.map((c, i) => ({ i, lat: c[0], lon: c[1], d: distToRoad({ lat: c[0], lon: c[1] }) }));
for (const r of rows) console.log(`  pt ${String(r.i).padStart(2)} (${r.lat},${r.lon}) → ${r.d.toFixed(0)} m del camino`);

// b) subida directa La Pirámide → Plaza México
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
  adj[a].push({ to: b, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: 0 });
  adj[b].push({ to: a, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: 0 });
}
const net: Network = { ...raw, adj };
const piramide = GATES.find((g) => g.id === "la-piramide")!.position;
const plaza = NAV_DESTINATIONS.find((d) => d.id === "plaza-mexico")!.position;
const r = findRoute(net, piramide, plaza);
console.log("\n=== b) findRoute Acceso La Pirámide → Plaza México ===");
if (!r) {
  console.log("SIN RUTA directa en la red ciclista");
} else {
  console.log(`${(r.distanceM / 1000).toFixed(2)} km · ${r.coords.length} pts`);
  const names: Record<string, number> = {};
  for (const n of r.segNames ?? []) if (n) names[n] = (names[n] ?? 0) + 1;
  console.log("vías:", Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, c]) => `${n}×${c}`).join(" · "));
}
