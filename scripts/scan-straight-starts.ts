// BARRIDO: pines en una rejilla de Bellavista / sector Pío Nono → destino
// Acceso Pío Nono. Busca TODAS las posiciones donde el primer tramo de la
// ruta final queda en RECTA larga (>42 m) sin apoyo en aristas del grafo.
import * as fs from "fs";
import {
  attachOrigin,
  findRoute,
  haversineM,
  originAttachPlan,
  streetConnector,
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

// rejilla espacial de aristas para chequear apoyo rápido
const CELL = 0.00045; // ≈50 m
const grid: Map<string, number[]> = new Map();
const keyOf = (lat: number, lon: number) => `${Math.round(lat / CELL)}:${Math.round(lon / CELL)}`;
for (let e = 0; e < net.edges.length; e++) {
  const [a, b] = net.edges[e];
  const na = net.nodes[a], nb = net.nodes[b];
  const steps = 6;
  for (let s = 0; s <= steps; s++) {
    const lat = na[0] + ((nb[0] - na[0]) * s) / steps;
    const lon = na[1] + ((nb[1] - na[1]) * s) / steps;
    const k = keyOf(lat, lon);
    let arr = grid.get(k);
    if (!arr) grid.set(k, (arr = []));
    if (!arr.includes(e)) arr.push(e);
  }
}

function distToNearestEdgeFast(p: LatLng): number {
  const kx = Math.cos((p.lat * Math.PI) / 180);
  const ci = Math.round(p.lat / CELL);
  const cj = Math.round(p.lon / CELL);
  let bestD = Infinity;
  for (let di = -2; di <= 2; di++)
    for (let dj = -2; dj <= 2; dj++) {
      const arr = grid.get(`${ci + di}:${cj + dj}`);
      if (!arr) continue;
      for (const e of arr) {
        const [a, b] = net.edges[e];
        const na = net.nodes[a], nb = net.nodes[b];
        const ax = na[1] * kx, ay = na[0]; const bx = nb[1] * kx, by = nb[0];
        const px = p.lon * kx, py = p.lat;
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const dM = Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320;
        if (dM < bestD) bestD = dM;
      }
    }
  return bestD;
}

const PIO_NONO: LatLng = { lat: -33.430691, lon: -70.63592 };

// Rejilla Bellavista / Recoleta sur / sector Pío Nono: lat -33.4360…-33.4240, lon -70.6420…-70.6320
const results: { p: LatLng; straight0: number; gapM: number; seg1: number }[] = [];
let total = 0;
let withRoute = 0;
const lat0 = -33.436, lat1 = -33.424, lon0 = -70.642, lon1 = -70.632;
const step = 0.0008; // ≈89 m
for (let lat = lat0; lat <= lat1; lat += step) {
  for (let lon = lon0; lon <= lon1; lon += step) {
    total++;
    const pin: LatLng = { lat: +lat.toFixed(6), lon: +lon.toFixed(6) };
    const r0 = findRoute(net, pin, PIO_NONO);
    if (!r0) continue;
    const route = attachOrigin(r0, pin, { net });
    withRoute++;
    const seg0 = haversineM(route.coords[0], route.coords[1]);
    const mid = { lat: (route.coords[0].lat + route.coords[1].lat) / 2, lon: (route.coords[0].lon + route.coords[1].lon) / 2 };
    const gap = distToNearestEdgeFast(mid);
    const seg1 = route.coords.length > 2 ? haversineM(route.coords[1], route.coords[2]) : 0;
    // problema: primer tramo largo en recta sin calle debajo
    if (seg0 > 42 && gap > 25) {
      results.push({ p: pin, straight0: seg0, gapM: gap, seg1 });
    }
  }
}

console.log(`pines probados: ${total} · con ruta: ${withRoute}`);
console.log(`\n=== PINES CON PRIMER TRAMO EN RECTA LARGA SIN CALLE DEBAJO: ${results.length} ===`);
for (const r of results.slice(0, 40)) {
  const plan = originAttachPlan(findRoute(net, r.p, PIO_NONO)!, r.p);
  const conn = plan.straightM > 40 ? streetConnector(net, r.p, plan.join) : null;
  console.log(`  pin ${r.p.lat},${r.p.lon}: seg0=${r.straight0.toFixed(0)} m recta (mid a ${r.gapM.toFixed(0)} m de calle) · plan=${plan.mode} straightM=${plan.straightM.toFixed(0)} conn=${conn ? `ok ${conn.coords.length}v` : "null"}`);
}
if (results.length === 0) console.log("  (ninguno — todos los primeros tramos van por calle o son chaflanes ≤42 m)");
