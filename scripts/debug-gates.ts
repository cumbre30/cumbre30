// Debug: distancia de los accesos al polígono y aristas elegibles cerca.
import { readFileSync } from "node:fs";
import { haversineM, edgePasses, type FindRouteOpts, type LatLng } from "../src/lib/routing";
import { PARK_POLYGON } from "../src/lib/park";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[];
  names: string[];
  nodes: [number, number][];
  edges: [number, number, number, number, 0 | 1][];
};

const poly = PARK_POLYGON.map((p) => [p.lat, p.lon] as [number, number]);
function inPoly(lat: number, lon: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
    if (yi > lat !== yj > lat && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distToPolyM(lat: number, lon: number): number {
  const kx = Math.cos((lat * Math.PI) / 180);
  const px = lon * kx, py = lat;
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][1] * kx, ay = poly[j][0];
    const bx = poly[i][1] * kx, by = poly[i][0];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320);
  }
  return best;
}

const GATES: Record<string, LatLng> = {
  pvNorte: { lat: -33.411769, lon: -70.607988 },
  pioNono: { lat: -33.430691, lon: -70.63592 },
  zapadores: { lat: -33.399921, lon: -70.620406 },
  laPiramide: { lat: -33.38642, lon: -70.60179 },
  accesoPaseoMet: { lat: -33.412407, lon: -70.623052 },
};

const PAV_OPTS: FindRouteOpts = {
  allowedCls: new Set(["living_street", "residential", "service", "unclassified", "tertiary", "tertiary_link", "secondary", "secondary_link", "primary", "primary_link"]),
  nameAllow: [/^Paseo Metropolitano - Tramo /, /^Paseo Metropolitano$/, /^Paseo Metropolitano - Sendero Bellavista/, /^Avenida /, /^Camino /, /^Antilen$/, /^Rotonda /],
  nameBlock: [/^Sendero Ciclista /],
};

for (const [label, p] of Object.entries(GATES)) {
  const dPoly = distToPolyM(p.lat, p.lon);
  const dentro = inPoly(p.lat, p.lon);
  console.log(`\n== ${label} · poly: ${dentro ? "dentro" : "FUERA"} · dist borde: ${Math.round(dPoly)}m ==`);
  // aristas que pasan nodeOk+80m, sin restricción de clase
  const cerca: Array<{ d: number; name: string; cls: string }> = [];
  for (const [a, b, ci, ni] of raw.edges) {
    const na = raw.nodes[a], nb = raw.nodes[b];
    const okN = (x: number, y: number) => inPoly(x, y) || distToPolyM(x, y) <= 80;
    if (!okN(na[0], na[1]) || !okN(nb[0], nb[1])) continue;
    const d = Math.min(haversineM(p, { lat: na[0], lon: na[1] }), haversineM(p, { lat: nb[0], lon: nb[1] }));
    if (d > 250) continue;
    cerca.push({ d, name: raw.names[ni] || "(sin nombre)", cls: raw.classes[ci] });
  }
  cerca.sort((x, y) => x.d - y.d);
  for (const c of cerca.slice(0, 6)) console.log(`  ${Math.round(c.d)}m [${c.cls}] ${c.name}`);
  const pav = cerca.filter((c) => edgePasses({ cls: c.cls, name: c.name }, PAV_OPTS));
  console.log(`  → elegibles pavimento: ${pav.length} · más cerca: ${pav[0] ? `${Math.round(pav[0].d)}m [${pav[0].cls}] ${pav[0].name}` : "NINGUNA"}`);
}
