// Análisis de trazados actuales: qué nombres/clases usa cada ruta,
// cuánto cae fuera del polígono del parque.
import { readFileSync } from "node:fs";
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";
import { PARK_POLYGON, type LatLng } from "../src/lib/park";
import { haversineM } from "../src/lib/routing";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[];
  names: string[];
  nodes: [number, number][];
  edges: [number, number, number, number, 0 | 1][];
};

function inPoly(lat: number, lon: number): boolean {
  let inside = false;
  const poly = PARK_POLYGON;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i].lat, xi = poly[i].lon, yj = poly[j].lat, xj = poly[j].lon;
    if (yi > lat !== yj > lat && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// distancia de un punto a la arista (aprox: a nodos de aristas cercanas)
type Edge = { u: number; v: number; cls: string; name: string };
const kx = Math.cos((-33.4 * Math.PI) / 180);
const edges: Edge[] = raw.edges.map(([a, b, ci, ni]) => ({
  u: a, v: b, cls: raw.classes[ci], name: raw.names[ni] ?? "",
}));

function nearestEdgeName(p: { lat: number; lon: number }): { name: string; cls: string; d: number } {
  let bestName = "", bestCls = "", bestD = Infinity;
  const px = p.lon * kx, py = p.lat;
  for (const e of edges) {
    const na = raw.nodes[e.u], nb = raw.nodes[e.v];
    const ax = na[1] * kx, ay = na[0], bx = nb[1] * kx, by = nb[0];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + dx * t, qy = ay + dy * t;
    const dM = Math.hypot(px - qx, py - qy) * 111_320;
    if (dM < bestD) { bestD = dM; bestName = e.name || "(sin nombre)"; bestCls = e.cls; }
  }
  return { name: bestName, cls: bestCls, d: bestD };
}

const SENDEROS_MTB = /^Sendero Ciclista /;

for (const [id, t] of Object.entries(RUTAS_TRAZADOS)) {
  const coords: LatLng[] = t.coords.map(([lat, lon]) => ({ lat, lon }));
  const nameM = new Map<string, number>();
  const clsM = new Map<string, number>();
  let fueraM = 0;
  for (let i = 1; i < coords.length; i++) {
    const seg = haversineM(coords[i - 1], coords[i]);
    const mid = { lat: (coords[i - 1].lat + coords[i].lat) / 2, lon: (coords[i - 1].lon + coords[i].lon) / 2 };
    if (!inPoly(mid.lat, mid.lon)) fueraM += seg;
    const ne = nearestEdgeName(mid);
    nameM.set(ne.name, (nameM.get(ne.name) ?? 0) + seg);
    clsM.set(ne.cls, (clsM.get(ne.cls) ?? 0) + seg);
  }
  const total = t.distKm * 1000;
  const fueraPct = Math.round((fueraM / total) * 100);
  console.log(`\n== ${id} · ${t.distKm} km · fuera del parque: ${fueraPct}% ==`);
  const top = [...nameM.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  for (const [n, m] of top) console.log(`  ${String(Math.round(m)).padStart(5)} m · ${n}`);
  const senderoM = [...nameM.entries()].filter(([n]) => SENDEROS_MTB.test(n)).reduce((s, [, m]) => s + m, 0);
  if (senderoM > 50) console.log(`  ⚠ senderos MTB: ${Math.round(senderoM)} m`);
}
