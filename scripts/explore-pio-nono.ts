// Exploración: destino Pío Nono (pedido del usuario) — ¿el primer tramo
// va por la calle o corta las cuadras en línea recta?
// Verificación: cada segmento inicial debe apoyarse en aristas del grafo
// (punto medio a ≤ ~25 m de alguna arista) o ser un chaflán ≤ 40 m.
import * as fs from "fs";
import {
  attachOrigin,
  findRoute,
  haversineM,
  originAttachPlan,
  type Network,
  type NavRoute,
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
console.log(`grafo: ${net.nodes.length} nodos, ${net.edges.length} aristas`);

// Distancia de un punto a la arista más cercana del grafo (proyección).
function distToNearestEdge(p: LatLng): { dM: number; name: string; cls: string } {
  const kx = Math.cos((p.lat * Math.PI) / 180);
  let bestD = Infinity;
  let bestName = "";
  let bestCls = "";
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
    const qx = ax + dx * t, qy = ay + dy * t;
    const dM = Math.hypot(px - qx, py - qy) * 111_320;
    if (dM < bestD) {
      bestD = dM;
      bestName = net.names[nameIdx] ?? "";
      bestCls = net.classes[clsIdx] ?? "";
    }
  }
  return { dM: bestD, name: bestName, cls: bestCls };
}

/** ¿El segmento a→b va por calle? punto medio cerca de una arista + alineación. */
function segOnStreet(a: LatLng, b: LatLng): { ok: boolean; gapM: number; name: string } {
  const mid = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
  const r = distToNearestEdge(mid);
  const len = haversineM(a, b);
  // un chaflán corto (< 40 m) se tolera; un tramo largo debe estar sobre aristas
  if (len <= 42) return { ok: true, gapM: r.dM, name: r.name };
  return { ok: r.dM <= 25, gapM: r.dM, name: r.name };
}

const PIO_NONO: LatLng = { lat: -33.430691, lon: -70.63592 }; // Acceso Pío Nono (park.ts)

const origins: { label: string; from: LatLng }[] = [
  { label: "Bellavista Dardignac", from: { lat: -33.4292, lon: -70.6385 } },
  { label: "Bellavista fuera del parque (simulador)", from: { lat: -33.4343, lon: -70.636 } },
  { label: "Mitad de cuadra Bellavista", from: { lat: -33.4315, lon: -70.6375 } },
  { label: "El Salvador / Plaza Aviación", from: { lat: -33.4341, lon: -70.6393 } },
  { label: "Constitución esq. Bellavista", from: { lat: -33.4322, lon: -70.6366 } },
  { label: "Pin dentro de manzana (entre Pío Nono y Dardignac)", from: { lat: -33.4309, lon: -70.6373 } },
  { label: "Pin al poniente del ingreso (entre árboles/parque)", from: { lat: -33.4305, lon: -70.6346 } },
  { label: "Pedro de Valdivia Norte", from: { lat: -33.411769, lon: -70.607988 } },
];

console.log(`\n=== RUTAS con destino ACCESO PÍO NONO (${PIO_NONO.lat}, ${PIO_NONO.lon}) ===`);
for (const o of origins) {
  const snap = distToNearestEdge(o.from);
  console.log(`\n--- ${o.label} (pin a ${snap.dM.toFixed(0)} m del grafo, vía más cercana "${snap.name || snap.cls}") ---`);
  const r0 = findRoute(net, o.from, PIO_NONO);
  if (!r0) {
    console.log("  findRoute: null → computeRoute caería a OSRM");
    continue;
  }
  const route = attachOrigin(r0, o.from, { net });
  const plan = originAttachPlan(r0, o.from);
  console.log(`  plan: mode=${plan.mode} straightM=${plan.straightM.toFixed(0)} · ruta final ${(route.distanceM / 1000).toFixed(2)} km, ${route.coords.length} vértices`);
  // examinar los primeros 12 tramos
  let bad = 0;
  const N = Math.min(12, route.coords.length - 1);
  for (let i = 0; i < N; i++) {
    const a = route.coords[i];
    const b = route.coords[i + 1];
    const len = haversineM(a, b);
    const chk = segOnStreet(a, b);
    const flag = chk.ok ? " " : "X";
    if (!chk.ok) bad++;
    console.log(`   ${flag} seg${i}: ${len.toFixed(0)} m · mid a ${chk.gapM.toFixed(0)} m de "${chk.name || "?"}"${i >= 8 ? " …" : ""}`);
  }
  if (bad === 0) console.log("  ✅ primeros tramos sobre calles");
  else console.log(`  ❌ ${bad}/${N} tramos cortan cuadras`);
  console.log(`  inicio: "${route.steps[0]?.text}" · ${route.segNames.slice(0, 4).join(" → ")}`);
}
