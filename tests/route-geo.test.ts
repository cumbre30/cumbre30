// ============================================================
// Fase A · utilidades geográficas (routeGeo): bbox, geohash celdas
// multi-celda con fallback g4 (C2), antimeridiano (C3) y roundtrip
// de polilínea. La suite completa CT-G corre en fase D; aquí se
// fijan los invariantes que la API ya usa al escribir.
// Ejecutar: npx tsx tests/route-geo.test.ts
// ============================================================
import assert from "node:assert/strict";
import {
  aprox3, bboxOf, centerOf, cellsForViewport, cellsOfRoute, distKm,
  geohashEncode, haversineM, padresG4, polylineDecode, polylineEncode,
  type Punto,
} from "../src/lib/routeGeo";

let pasos = 0;
function ok(nombre: string): void {
  pasos++;
  console.log(`  ✓ ${nombre}`);
}

/** Línea recta de n puntos entre dos extremos. */
function linea(a: Punto, b: Punto, n: number): Punto[] {
  const out: Punto[] = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    out.push({ lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f });
  }
  return out;
}

// 1) bbox y centro exactos (criterio C1: datos para el predicado
//    de intersección corregido).
const recta = linea({ lat: -33.4, lon: -70.65 }, { lat: -33.5, lon: -70.55 }, 50);
const bbox = bboxOf(recta);
assert.equal(bbox.minLat, -33.5);
assert.equal(bbox.maxLat, -33.4);
assert.equal(bbox.minLon, -70.65);
assert.equal(bbox.maxLon, -70.55);
const centro = centerOf(bbox);
assert.equal(centro.lat, -33.45);
assert.equal(centro.lon, -70.6);
ok("bbox exacto y centro para el predicado de intersección (C1)");

// 2) distKm por arcos (no vuela): diagonal ~13.3 km + verificación
//    haversine contra un valor de referencia conocido (1° de lat ≈ 111.19 km).
const unGrado = [{ lat: 0, lon: 0 }, { lat: 1, lon: 0 }];
const km1 = distKm(unGrado);
assert.ok(Math.abs(km1 - 111.19) < 0.15, `1° lat ≈ 111.19 km (dio ${km1})`);
ok("distKm haversine consistente (1° latitud ≈ 111,19 km)");

// 3) geohash: puntos cercanos comparten celda; lejanos no.
const g1 = geohashEncode(-33.4489, -70.6693, 5); // Plaza de Armas area
const g2 = geohashEncode(-33.4492, -70.6696, 5); // ~40 m
const g3 = geohashEncode(-33.49, -70.72, 5); // ~9 km al SO
assert.equal(g1, g2, "puntos a ~40 m comparten celda g5");
assert.notEqual(g1, g3, "puntos a ~9 km en celdas distintas");
assert.equal(g1.length, 5);
assert.equal(geohashEncode(-33.4489, -70.6693, 4), g1.slice(0, 4), "g4 es prefijo de g5");
ok("geohash-5/4 correctos (celdas ~4,9 km y prefijo)");

// 4) Celdas multi-celda (C2): una ruta larga de ~60 km toca varias
//    celdas g5 aunque sea recta.
const larga = linea({ lat: -33.3, lon: -70.75 }, { lat: -33.85, lon: -70.6 }, 400); // ~61 km
const celdasLarga = cellsOfRoute(larga);
assert.equal(celdasLarga.g, 5);
assert.ok(celdasLarga.cells.length >= 2, `ruta de 60 km debe tocar ≥2 celdas (tocó ${celdasLarga.cells.length})`);
const corta = [{ lat: -33.44, lon: -70.65 }, { lat: -33.442, lon: -70.651 }];
assert.equal(cellsOfRoute(corta).cells.length, 1);
ok(`ruta multi-celda: 60 km → ${celdasLarga.cells.length} celdas g5 · corta → 1 celda`);

// 5) Fallback g4 (C2): con tope estricto de celdas, cae a geohash-4.
const conTope = cellsOfRoute(larga, 4);
assert.equal(conTope.g, 4, "supera el tope → granularidad g4");
assert.ok(conTope.cells.length <= 8, `g4 debe ser grueso (dio ${conTope.cells.length})`);
ok("fallback geohash-4 cuando la ruta supera el tope de celdas");

// 6) Intersección celdas ↔ viewport: ruta con centro FUERA del
//    viewport se encuentra por solapamiento de cells (CT-G2).
//    Viewport pequeño al norte de la ruta larga (centro de la ruta ~(-33.575, -70.675)).
const viewportN = { n: -33.31, s: -33.36, e: -70.7, o: -70.78 };
const celdasViewport = cellsForViewport(viewportN.n, viewportN.s, viewportN.e, viewportN.o);
const toca = celdasLarga.cells.some((c) => celdasViewport.includes(c));
assert.ok(toca, "la ruta larga entra al viewport por cells aunque su centro está fuera");
const viewportLejano = cellsForViewport(-33.9, -33.95, -70.3, -70.4);
assert.ok(!celdasLarga.cells.some((c) => viewportLejano.includes(c)), "viewport lejos no cruza celdas");
ok("multi-celda: viewport norte encuentra la ruta con centro fuera (CT-G2)");

// 7) Antimeridiano (C3): viewport que cruza ±180° incluye una celda
//    en 175°E y otra en -175°W.
const vpCruce = cellsForViewport(10, -10, -170, 170);
assert.ok(vpCruce.includes(geohashEncode(0, 175, 5)), "celda en 175°E incluida");
assert.ok(vpCruce.includes(geohashEncode(0, -175, 5)), "celda en -175°W incluida");
ok("antimeridiano: ramificación OR del viewport cruza ±180° (C3)");

// 8) Padres g4 para mezclar granularidades.
const padres = padresG4(celdasLarga.cells);
assert.ok(padres.length >= 1);
assert.ok(padres.every((p) => p.length === 4));
ok("madres g4 derivadas de las celdas g5");

// 9) Roundtrip polyline (formato de entrega).
const enc = polylineEncode(recta);
assert.ok(enc.length > 0);
const dec = polylineDecode(enc);
assert.equal(dec.length, recta.length);
for (let i = 0; i < recta.length; i++) {
  assert.ok(Math.abs(dec[i].lat - recta[i].lat) < 1e-5, `lat ${i}`);
  assert.ok(Math.abs(dec[i].lon - recta[i].lon) < 1e-5, `lon ${i}`);
}
ok("polyline encode/decode roundtrip ≤1e-5 grados (~1 m)");

// 10) Extremos aproximados a 3 decimales (~110 m).
assert.equal(aprox3(-33.431099), -33.431);
assert.equal(aprox3(-70.640155), -70.64);
ok("aprox3: extremos redondeados a ~110 m");

// 11) haversine sanity corta.
assert.ok(haversineM({ lat: -33.4, lon: -70.65 }, { lat: -33.4, lon: -70.65 }) === 0);
ok("haversine punto=0");

console.log(`\nROUTE-GEO: ${pasos} verificaciones OK`);
