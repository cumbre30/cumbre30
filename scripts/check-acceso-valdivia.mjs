// ============================================================
// Verificación (solo check): al elegir el acceso Pedro de Valdivia
// Norte ("Valdivia") como destino en el minimapa, ¿la ruta va
// DIRECTA al acceso o pasa primero por otro acceso (Pío Nono)?
//
// Replica con las coordenadas reales de park.ts:
//   · parkInsideTest()      → ¿el destino se considera "dentro del parque"?
//     (polígono + tolerancia de 80 m; los accesos quedan sobre el borde)
//   · accesoMasCercano()    → ¿cuál acceso ciclista es el más cercano al usuario?
// Y reproduce la lógica de computeRoute: si destInPark && !fromInPark,
// la ruta es  usuario → accesoMásCercano → destino (dos tramos).
// ============================================================

import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/lib/park.ts", import.meta.url), "utf8");

// --- extraer PARK_POLYGON -------------------------------------------------
const polyStart = src.indexOf("export const PARK_POLYGON");
const polyEnd = src.indexOf("];", polyStart);
const polyText = src.slice(polyStart, polyEnd);
const PARK = [...polyText.matchAll(/lat:\s*(-?[\d.]+),\s*lon:\s*(-?[\d.]+)/g)].map((m) => ({
  lat: Number(m[1]),
  lon: Number(m[2]),
}));

// --- extraer GATES ciclistas ----------------------------------------------
const gatesStart = src.indexOf("export const GATES");
const gatesEnd = src.indexOf("];", gatesStart);
const gatesText = src.slice(gatesStart, gatesEnd);
const GATES = [...gatesText.matchAll(/\{ id: "([^"]+)", name: "([^"]+)", position: \{ lat: (-?[\d.]+), lon: (-?[\d.]+) \}, ciclistas: (true|false)/g)]
  .map((m) => ({ id: m[1], name: m[2], lat: Number(m[3]), lon: Number(m[4]), ciclistas: m[5] === "true" }));
const ACCESOS = GATES.filter((g) => g.ciclistas);

// --- geometría (idéntica a parkInsideTest en routingService.ts) -----------
const poly = PARK.map((p) => [p.lat, p.lon]);

function inPoly(lat, lon) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToPolyM(lat, lon) {
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

// tolerancia 80 m, igual que parkInsideTest()
const inside = (lat, lon) => inPoly(lat, lon) || distToPolyM(lat, lon) <= 80;

function haversineM(a, b) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function accesoMasCercano(p) {
  let best = ACCESOS[0], bd = Infinity;
  for (const g of ACCESOS) {
    const d = haversineM(p, { lat: g.lat, lon: g.lon });
    if (d < bd) { bd = d; best = g; }
  }
  return { nombre: best.name, id: best.id, distM: Math.round(bd) };
}

// --- 1. ¿Los accesos se consideran "dentro del parque"? -------------------
console.log("== ¿Los 4 accesos ciclistas caen 'dentro' del parque (tolerancia 80 m)? ==");
for (const g of ACCESOS) {
  const inP = inPoly(g.lat, g.lon);
  const dP = Math.round(distToPolyM(g.lat, g.lon));
  console.log(`  ${g.name.padEnd(36)} inPoly=${inP}  distBorde=${dP} m  → destInPark=${inside(g.lat, g.lon)}`);
}

// --- 2. Simulación de rutas a "Acceso Pedro de Valdivia Norte" ------------
const VALDIVIA = ACCESOS.find((g) => g.id === "pv-norte");
console.log("\n== Si el destino es el ACCESO PEDRO DE VALDIVIA NORTE (pv-norte) ==");
console.log(`  destInPark(Valdivia) = ${inside(VALDIVIA.lat, VALDIVIA.lon)}  → entra al flujo de DOS TRAMOS cuando estás fuera del parque`);

const ORIGENES = [
  { nombre: "Bellavista (Pío Nono × Constitución)", lat: -33.4345, lon: -70.6422 },
  { nombre: "Recoleta (Av. Recoleta × Pío Nono)", lat: -33.4290, lon: -70.6400 },
  { nombre: "Providencia (PdV Norte × El Cerro)", lat: -33.4152, lon: -70.6155 },
  { nombre: "Providencia (PdV × Los Leones)", lat: -33.4230, lon: -70.6110 },
  { nombre: "Plaza Baquedano", lat: -33.4380, lon: -70.6540 },
];

console.log("\n== Acceso ciclista MÁS CERCANO al usuario (define por dónde pasa la ruta) ==");
for (const o of ORIGENES) {
  const fromInPark = inside(o.lat, o.lon);
  const acc = accesoMasCercano(o);
  const dosTramos = !fromInPark && inside(VALDIVIA.lat, VALDIVIA.lon);
  console.log(
    `  Desde ${o.nombre.padEnd(42)} ` +
      `fromInPark=${fromInPark}  →  ${dosTramos ? "RUTA EN 2 TRAMOS:" : "RUTA DIRECTA:"} ` +
      (dosTramos ? `1º ${acc.nombre} (${acc.distM} m), luego al interior del parque hasta Valdivia` : "usuario → Valdivia")
  );
}

// --- 3. Distancia del rodeo ----------------------------------------------
console.log("\n== Ejemplo del rodeo (Bellavista → Valdivia vía Pío Nono vs directo) ==");
const bellavista = ORIGENES[0];
const acc = accesoMasCercano(bellavista);
const accPos = ACCESOS.find((a) => a.id === acc.id);
const dUserAcc = haversineM(bellavista, { lat: accPos.lat, lon: accPos.lon });
const dAccVal = haversineM({ lat: accPos.lat, lon: accPos.lon }, { lat: VALDIVIA.lat, lon: VALDIVIA.lon });
const dUserVal = haversineM(bellavista, { lat: VALDIVIA.lat, lon: VALDIVIA.lon });
console.log(`  Directo (aire): usuario → Valdivia            ≈ ${Math.round(dUserVal)} m`);
console.log(`  En 2 tramos (aire): usuario → ${acc.nombre} → Valdivia ≈ ${Math.round(dUserAcc)} + ${Math.round(dAccVal)} = ${Math.round(dUserAcc + dAccVal)} m`);
console.log(`  (por calle el rodeo es aún mayor; el tramo 2 sube por DENTRO del parque)`);
