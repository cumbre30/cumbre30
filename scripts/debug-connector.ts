// ¿Por qué streetConnector devuelve null en el caso Pedro de Valdivia
// Norte → Pío Nono (straightM=53 m)? Depuración paso a paso con réplicas
// locales de nearestEdge (la función real no está exportada).
import * as fs from "fs";
import {
  haversineM,
  streetConnector,
  originAttachPlan,
  findRoute,
  attachOrigin,
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
  adj[a].push({ to: b, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: 0 });
  adj[b].push({ to: a, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: 0 });
}
const net: Network = { ...raw, adj };

type EdgeHit = { u: number; v: number; cls: string; name: string; ciclovia: boolean; point: LatLng; distM: number };

function nearestEdge(net: Network, p: LatLng, maxM: number): EdgeHit | null {
  const kx = Math.cos((p.lat * Math.PI) / 180);
  let best: EdgeHit | null = null;
  let bestD = Infinity;
  for (let i = 0; i < net.edges.length; i++) {
    const [a, b, clsIdx, nameIdx, ciclo] = net.edges[i];
    const na = net.nodes[a];
    const nb = net.nodes[b];
    const ax = na[1] * kx, ay = na[0];
    const bx = nb[1] * kx, by = nb[0];
    const px = p.lon * kx, py = p.lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const dM = Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320;
    if (dM < bestD) {
      bestD = dM;
      best = {
        u: a, v: b,
        cls: net.classes[clsIdx] ?? "residential",
        name: net.names[nameIdx] ?? "",
        ciclovia: ciclo === 1,
        point: { lat: na[0] + (nb[0] - na[0]) * t, lon: na[1] + (nb[1] - na[1]) * t },
        distM: dM,
      };
    }
  }
  return best && best.distM <= maxM ? best : null;
}

const PIO_NONO: LatLng = { lat: -33.430691, lon: -70.63592 };
const PIN: LatLng = { lat: -33.411769, lon: -70.607988 }; // Pedro de Valdivia Norte

console.log("== depuración streetConnector, Pedro de Valdivia Norte → Pío Nono ==");
const r0 = findRoute(net, PIN, PIO_NONO);
if (!r0) { console.log("findRoute null"); process.exit(1); }
const plan = originAttachPlan(r0, PIN);
console.log(`plan: mode=${plan.mode} straightM=${plan.straightM.toFixed(0)} join=(${plan.join.lat.toFixed(6)}, ${plan.join.lon.toFixed(6)})`);

const a1 = nearestEdge(net, PIN, 250);
console.log(`a1 (pin): ${a1 ? `edge ${a1.u}-${a1.v} "${a1.name}" cls=${a1.cls} d=${a1.distM.toFixed(0)} m p=(${a1.point.lat.toFixed(6)},${a1.point.lon.toFixed(6)})` : "NULL"}`);
const a2 = nearestEdge(net, plan.join, 250);
console.log(`a2 (join): ${a2 ? `edge ${a2.u}-${a2.v} "${a2.name}" cls=${a2.cls} d=${a2.distM.toFixed(0)} m p=(${a2.point.lat.toFixed(6)},${a2.point.lon.toFixed(6)})` : "NULL"}`);

if (a1 && a2) {
  console.log(`dist a1.point ↔ a2.point = ${haversineM(a1.point, a2.point).toFixed(1)} m`);
  const conn = streetConnector(net, PIN, plan.join);
  console.log(`streetConnector → ${conn ? `OK (${conn.coords.length} vértices, ${conn.distM.toFixed(0)} m)` : "NULL"}`);
  if (conn) {
    for (let i = 0; i < Math.min(conn.coords.length - 1, 8); i++) {
      const L = haversineM(conn.coords[i], conn.coords[i + 1]);
      console.log(`   conn seg${i}: ${L.toFixed(0)} m "${conn.names[i]}"`);
    }
  }
}

// Y la ruta completa con attachOrigin
const route = attachOrigin(r0, PIN, { net });
console.log(`\nruta final: ${route.coords.length} vértices, ${(route.distanceM / 1000).toFixed(2)} km`);
console.log(`primeros 4 vértices:`);
for (let i = 0; i < 4; i++) {
  const c = route.coords[i];
  console.log(`  v${i}: ${c.lat.toFixed(6)},${c.lon.toFixed(6)}${i === 0 ? " (pin)" : ` · a ${haversineM(PIN, c).toFixed(0)} m del pin`}`);
}
console.log(`seg0 = ${haversineM(route.coords[0], route.coords[1]).toFixed(0)} m (recta si ≈ straightM)`);
