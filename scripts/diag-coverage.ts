// Diagnóstico: cobertura del grafo en el sector del screenshot
// (Marín / Fray Camilo Henríquez / Vicuña Mackenna / General Jofré).
// 1) ¿El grafo tiene esas calles?  2) ¿Qué arista/nodo le queda más
//    cerca al ciclista?  3) ¿Dónde parte la ruta hacia cada destino?
import * as fs from "fs";
import {
  findRoute,
  attachOrigin,
  haversineM,
  type Network,
  type NetEdge,
  type LatLng,
} from "../src/lib/routing";

const raw = JSON.parse(fs.readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[];
  names: string[];
  nodes: [number, number][];
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
  const br = Math.atan2(
    Math.sin((pb.lon - pa.lon) * Math.PI / 180) * Math.cos(pb.lat * Math.PI / 180),
    Math.cos(pa.lat * Math.PI / 180) * Math.sin(pb.lat * Math.PI / 180) -
      Math.sin(pa.lat * Math.PI / 180) * Math.cos(pb.lat * Math.PI / 180) * Math.cos((pb.lon - pa.lon) * Math.PI / 180)
  ) / Math.PI * 180;
  const brr = (br + 360) % 360;
  adj[a].push({ to: b, w, dist, cls, name, ciclovia: ciclo === 1, bearing: brr });
  adj[b].push({ to: a, w, dist, cls, name, ciclovia: ciclo === 1, bearing: (brr + 180) % 360 });
}
const net: Network = { ...raw, adj };

// --- 1) ¿Qué calles del screenshot existen en el grafo? ---
const want = ["Marín", "Marin", "Camilo", "Canto", "Jofré", "Jofre", "Elisa", "Vicuña", "Vicuna", "Santa Isabel", "Victor"];
const nameHits: Record<string, number> = {};
for (let i = 0; i < raw.names.length; i++) {
  const nm = raw.names[i];
  if (!nm) continue;
  for (const w of want) {
    if (nm.toLowerCase().includes(w.toLowerCase())) {
      nameHits[nm] = (nameHits[nm] ?? 0) + 1;
    }
  }
}
console.log("== calles del screenshot presentes en el grafo ==");
console.log(nameHits);

// --- 2) nearest node + nearest edge para posiciones candidatas ---
function nearestNodeInfo(p: LatLng) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < net.nodes.length; i++) {
    const d = haversineM(p, { lat: net.nodes[i][0], lon: net.nodes[i][1] });
    if (d < bestD) { bestD = d; best = i; if (d < 12) break; }
  }
  const cls = net.classes[raw.edges[0][2]]; // dummy
  void cls;
  return { idx: best, distM: bestD, pos: { lat: net.nodes[best][0], lon: net.nodes[best][1] } };
}
function nearestEdgeInfo(p: LatLng) {
  const kx = Math.cos((p.lat * Math.PI) / 180);
  let bestD = Infinity, best: { u: number; v: number; dM: number; point: LatLng; cls: string; name: string; ciclo: boolean } | null = null;
  for (let i = 0; i < net.edges.length; i++) {
    const [a, b, ci, ni, c] = net.edges[i];
    const na = net.nodes[a], nb = net.nodes[b];
    const ax = na[1] * kx, ay = na[0], bx = nb[1] * kx, by = nb[0];
    const px = p.lon * kx, py = p.lat;
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + dx * t, qy = ay + dy * t;
    const dM = Math.hypot(px - qx, py - qy) * 111_320;
    if (dM < bestD) {
      bestD = dM;
      best = { u: a, v: b, dM, point: { lat: na[0] + (nb[0] - na[0]) * t, lon: na[1] + (nb[1] - na[1]) * t }, cls: net.classes[ci], name: net.names[ni], ciclo: c === 1 };
    }
  }
  return best!;
}

// posiciones candidatas estimadas del screenshot (puck del usuario)
const userCandidates: { label: string; p: LatLng }[] = [
  { label: "Marín × Fray Camilo Henríquez (puck)", p: { lat: -33.4218, lon: -70.6375 } },
  { label: "Marín cerca Vicuña Mackenna", p: { lat: -33.4213, lon: -70.6348 } },
];

for (const c of userCandidates) {
  const nn = nearestNodeInfo(c.p);
  const ne = nearestEdgeInfo(c.p);
  console.log(`\n== ${c.label} ${c.p.lat},${c.p.lon}`);
  console.log(`  nodo más cercano: ${nn.distM.toFixed(0)} m (clase vía del nodo desconocida)`);
  console.log(`  arista más cercana: ${ne.dM.toFixed(0)} m · clase=${ne.cls} · nombre="${ne.name}" · ciclovia=${ne.ciclo}`);
  console.log(`  punto proyectado: ${ne.point.lat.toFixed(6)},${ne.point.lon.toFixed(6)}`);
}

// --- 3) ¿Dónde parte la ruta hacia cada destino típico? ---
const dests: { label: string; p: LatLng }[] = [
  { label: "Cumbre", p: { lat: -33.42527, lon: -70.63324 } },
  { label: "Zoológico", p: { lat: -33.429636, lon: -70.633963 } },
  { label: "Piscina Antilén", p: { lat: -33.409051, lon: -70.61374 } },
  { label: "Acceso Pío Nono", p: { lat: -33.430691, lon: -70.63592 } },
];
const user: LatLng = { lat: -33.4218, lon: -70.6375 };
for (const d of dests) {
  const r0 = findRoute(net, user, d.p);
  if (!r0) { console.log(`\n${d.label}: SIN RUTA local`); continue; }
  const route = attachOrigin(r0, user);
  console.log(`\n== destino ${d.label}:`);
  console.log(`  inicio ruta: ${route.coords[0].lat.toFixed(6)},${route.coords[0].lon.toFixed(6)} (a ${haversineM(user, route.coords[0]).toFixed(0)} m del ciclista)`);
  console.log(`  ${(route.distanceM / 1000).toFixed(2)} km · ${route.cicloviaPct}% ciclo · ${route.steps.length} pasos`);
}
