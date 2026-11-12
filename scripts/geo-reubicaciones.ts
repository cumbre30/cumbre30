/**
 * Geometría del lote de reubicaciones (cliente 2026-11-13):
 * 1. ¿Los 2 accesos movidos (Pío Nono, La Pirámide) caen cerca del grafo
 *    y dentro del parque (+80 m)?
 * 2. Radio máximo inscrito en PARK_POLYGON para la Salida Pedro de
 *    Valdivia (y de paso para las otras zonas de advertencia).
 */
import { readFileSync } from "node:fs";
import grafo from "../public/red-ciclista.json";
import { PARK_POLYGON, RISK_ZONES } from "../src/lib/park";

const nodes = grafo.nodes as [number, number][];
const classes = grafo.classes as string[];
const names = grafo.names as string[];
const edges = grafo.edges as [number, number, number, number, number][];

function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (bLat - aLat) * toR, dLon = (bLon - aLon) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function dentroParque(lat: number, lon: number): boolean {
  let inside = false;
  const poly = PARK_POLYGON;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i].lat, xi = poly[i].lon, yj = poly[j].lat, xj = poly[j].lon;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distAPoligonoM(lat: number, lon: number): number {
  const kx = Math.cos((lat * Math.PI) / 180);
  const px = lon * kx, py = lat;
  let best = Infinity;
  for (let i = 0, j = PARK_POLYGON.length - 1; i < PARK_POLYGON.length; j = i++) {
    const a = PARK_POLYGON[j], b = PARK_POLYGON[i];
    const ax = a.lon * kx, ay = a.lat, bx = b.lon * kx, by = b.lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320);
  }
  return best;
}
function snap(lat: number, lon: number) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const d = haversineM(lat, lon, nodes[i][0], nodes[i][1]);
    if (d < bd) { bd = d; best = i; }
  }
  // vía del nodo
  let via = "(sin nombre)";
  for (const [a, b, ci, ni] of edges) {
    if (a === best || b === best) { via = `${names[ni] || "(sin nombre)"} [${classes[ci]}]`; break; }
  }
  return { idx: best, d: bd, via, pos: nodes[best] };
}

console.log("=== Accesos movidos ===");
for (const [nombre, lat, lon] of [
  ["Acceso Pío Nono (nuevo)", -33.430462, -70.636212],
  ["Acceso La Pirámide (nuevo)", -33.3881236831842, -70.60168398128492],
] as [string, number, number][]) {
  const s = snap(lat, lon);
  const dentro = dentroParque(lat, lon);
  const dPoly = distAPoligonoM(lat, lon);
  console.log(
    `${nombre}: nodo n${s.idx} a ${s.d.toFixed(0)} m vía ${s.via} · dentro=${dentro} · dPolígono=${dPoly.toFixed(0)} m (${dentro ? "dentro" : dPoly <= 80 ? "borde +80m OK" : "FUERA >80m"})`
  );
}

console.log("\n=== Radio inscrito máximo por zona (centro → borde del polígono) ===");
for (const z of RISK_ZONES) {
  const d = distAPoligonoM(z.position.lat, z.position.lon);
  console.log(`${z.id} (${z.name}): centro ${dentroParque(z.position.lat, z.position.lon) ? "dentro" : "fuera"} · dPolígono=${d.toFixed(0)} m · radio actual ${z.radiusM} m`);
}
