// Pin REAL del usuario (respaldo: Marín × Fray Camilo Henríquez) → Pío Nono.
// Reproduce computeRoute COMPLETO (local + conector por calles) y audita
// los primeros tramos contra el grafo.
import * as fs from "fs";
import {
  attachOrigin,
  findRoute,
  haversineM,
  originAttachPlan,
  streetConnector,
  snapInfo,
  ORIGIN_ANCHOR_MAX_M,
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

function distToNearestEdge(p: LatLng): { dM: number; name: string; cls: string } {
  const kx = Math.cos((p.lat * Math.PI) / 180);
  let bestD = Infinity, bestName = "", bestCls = "";
  for (const [a, b, clsIdx, nameIdx] of net.edges) {
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
    if (dM < bestD) { bestD = dM; bestName = net.names[nameIdx] ?? ""; bestCls = net.classes[clsIdx] ?? ""; }
  }
  return { dM: bestD, name: bestName, cls: bestCls };
}

function segOnStreet(a: LatLng, b: LatLng): { ok: boolean; gapM: number; name: string; lenM: number } {
  const mid = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
  const r = distToNearestEdge(mid);
  const len = haversineM(a, b);
  if (len <= 42) return { ok: true, gapM: r.dM, name: r.name, lenM: len };
  return { ok: r.dM <= 25, gapM: r.dM, name: r.name, lenM: len };
}

const PIO_NONO: LatLng = { lat: -33.430691, lon: -70.63592 };

const origins: { label: string; from: LatLng }[] = [
  { label: "PUCK Marín × F. Camilo Henríquez", from: { lat: -33.4218, lon: -70.6375 } },
  { label: "PUCK Marín cerca Vicuña Mackenna", from: { lat: -33.4213, lon: -70.6348 } },
];

for (const o of origins) {
  const snap = snapInfo(net, o.from);
  const ne = distToNearestEdge(o.from);
  console.log(`\n=== ${o.label} ===`);
  console.log(`  snap del grafo: ${snap.distM.toFixed(0)} m (ORIGIN_COVER_M=250 → ${snap.distM <= 250 ? "RUTA LOCAL" : "OSRM"}) · arista más cercana: ${ne.dM.toFixed(0)} m "${ne.name || ne.cls}"`);
  const r0 = findRoute(net, o.from, PIO_NONO);
  if (!r0) {
    console.log("  findRoute → null (OSRM). No puedo reproducir OSRM offline.");
    continue;
  }
  const plan = originAttachPlan(r0, o.from);
  console.log(`  plan: mode=${plan.mode} straightM=${plan.straightM.toFixed(0)} segIdx=${plan.segIdx} prefixM=${plan.prefixM.toFixed(0)}`);
  const conn = plan.straightM > 40 ? streetConnector(net, o.from, plan.join) : null;
  console.log(`  streetConnector (>40 m): ${conn ? `OK ${conn.coords.length} vértices, ${(conn.distM).toFixed(0)} m` : "null"}`);
  const route = attachOrigin(r0, o.from, { net });
  console.log(`  ruta final ${(route.distanceM / 1000).toFixed(2)} km, ${route.coords.length} vértices · inicio "${route.steps[0]?.text}"`);
  let bad = 0;
  const N = Math.min(14, route.coords.length - 1);
  for (let i = 0; i < N; i++) {
    const chk = segOnStreet(route.coords[i], route.coords[i + 1]);
    if (!chk.ok) bad++;
    console.log(`   ${chk.ok ? " " : "X"} seg${i}: ${chk.lenM.toFixed(0)} m · mid a ${chk.gapM.toFixed(0)} m de "${chk.name || "?"}"`);
  }
  console.log(bad === 0 ? "  ✅ primeros tramos sobre calles" : `  ❌ ${bad}/${N} tramos cortan cuadras`);
  console.log(`  segNames iniciales: ${route.segNames.slice(0, 5).map((n) => n || "(?)").join(" → ")}`);
}

// EXTRA: ¿qué pasa SI findRoute da null y OSRM ancla el origen a una
// ciclovía lejana? Simulación: ruta sintética que empieza en un punto
// a 120 m del pin (como OSRM con radiuses=200 anclando lejos) y attachOrigin.
console.log("\n=== SIMULACIÓN OSRM: ancla a 120 m del pin, conn OSRM falla ===");
{
  const pin: LatLng = { lat: -33.4218, lon: -70.6375 };
  // punto "snap" a ~120 m al sur del pin (en una calle real del grafo si existe)
  const ne = distToNearestEdge(pin);
  const joinGuess: LatLng = { lat: pin.lat + 0.001, lon: pin.lon };
  const rg = distToNearestEdge(joinGuess);
  console.log(`  snap simulado a ${haversineM(pin, joinGuess).toFixed(0)} m del pin; cerca de "${rg.name || rg.cls}" (${rg.dM.toFixed(0)} m)`);
  console.log(`  → attachOrigin caería en straightM=${haversineM(pin, joinGuess).toFixed(0)} m > 40 → conector OSRM`);
  console.log(`  → si ese conector falla → coords=[pin, join, ...] = RECTA de ${haversineM(pin, joinGuess).toFixed(0)} m atravesando cuadras`);
  void ORIGIN_ANCHOR_MAX_M;
}
