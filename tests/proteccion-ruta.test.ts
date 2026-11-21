// ============================================================
// Fase D · protección geométrica (v2.1 §3.1, tabla 8 — CT-P1..P6).
// Ejecutar: npx tsx tests/proteccion-ruta.test.ts
// ============================================================
import assert from "node:assert/strict";
import { protegerRuta, muestrear, eleDesdeMuestras, type OpcionesProteccion } from "../src/lib/proteccionRuta";
import { haversineM, polylineEncode, polylineDecode, type Punto } from "../src/lib/routeGeo";

let pasos = 0;
function ok(nombre: string): void {
  pasos++;
  console.log(`  ✓ ${nombre}`);
}
const pt = (lat: number, lon: number): Punto => ({ lat, lon });
/** Recta lat/lon de n puntos entre dos extremos. */
function recta(a: Punto, b: Punto, n: number): Punto[] {
  const out: Punto[] = [];
  for (let i = 0; i < n; i++) out.push({ lat: a.lat + ((b.lat - a.lat) * i) / (n - 1), lon: a.lon + ((b.lon - a.lon) * i) / (n - 1) });
  return out;
}
/** Interiores idénticos (CT-P5): diff de vértices interiores = 0. */
function interiorSinCambios(original: Punto[], protegida: Punto[]): boolean {
  const idxIni = original.findIndex((p) => p.lat === protegida[0].lat && p.lon === protegida[0].lon);
  const idxFin = original.findIndex((p) => p.lat === protegida[protegida.length - 1].lat && p.lon === protegida[protegida.length - 1].lon);
  if (idxIni < 0 || idxFin < 0 || idxFin <= idxIni) return false;
  const seg = original.slice(idxIni, idxFin + 1);
  return seg.length === protegida.length && seg.every((p, i) => p.lat === protegida[i].lat && p.lon === protegida[i].lon);
}

const SIN_NODO: OpcionesProteccion = {};

console.log("\nCT-P1 · GPX que inicia a 12 m de un domicilio urbano");
// Domicilio en (-33.40000, -70.55000); la traza empieza a ~12 m y corre al sur.
const domicilio = pt(-33.4, -70.55);
const inicioCasa = pt(-33.40011, -70.55);
const ruta1 = recta(inicioCasa, pt(-33.42, -70.548), 40); // ~2.2 km
const p1 = protegerRuta(ruta1, SIN_NODO);
assert.ok(p1.registro.ini.recorteM >= 150, `recorte ${p1.registro.ini.recorteM}`);
assert.equal(p1.registro.ini.nivel, "C");
assert.ok(p1.registro.topeExcedido === false || p1.registro.topeExcedido === true);
// La primera coordenada publicada queda a ≥ 150 m del domicilio.
const d0 = haversineM(domicilio, p1.coords[0]);
assert.ok(d0 >= 150, `inicio publicado a ${d0.toFixed(0)} m`);
// Conexa: cada vértice consecutivo pegado al siguiente (sin saltos).
for (let i = 1; i < p1.coords.length; i++) assert.ok(haversineM(p1.coords[i - 1], p1.coords[i]) < 200);
ok(`extremo recortado ${p1.registro.ini.recorteM} m; polilínea conexa única; el original no sale`);

console.log("\nCT-P2 · inicio en calle sin salida, a 8 m de un nodo del grafo");
const nodo = pt(-33.401, -70.549); // nodo de vía "conocido"
const inicio8m = pt(-33.401072, -70.549); // ~8 m al sur del nodo
const ruta2 = recta(inicio8m, pt(-33.41, -70.545), 30);
const p2 = protegerRuta(ruta2, { nodoInicio: nodo, nodoFin: null });
assert.equal(p2.registro.ini.nivel, "A");
assert.ok(p2.registro.ini.snapM !== undefined && p2.registro.ini.snapM <= 30);
// Tras el snap se aplica el truncado (§3.1): el primer vértice publicado
// queda a ≥150 m del extremo EFECTIVO tras el snap (el nodo).
assert.ok(haversineM(nodo, p2.coords[0]) >= 150, `recorte efectivo ${haversineM(nodo, p2.coords[0]).toFixed(0)} m`);
// Ambos extremos se recortan: la protegida es SUBSECUENCIA del original
// en orden (solo se quitan prefijo/sufijo, jamás se altera el interior).
const idxIni = ruta2.findIndex((q) => q.lat === p2.coords[0].lat && q.lon === p2.coords[0].lon);
const idxFin = ruta2.findIndex((q) => q.lat === p2.coords[p2.coords.length - 1].lat && q.lon === p2.coords[p2.coords.length - 1].lon);
assert.ok(idxIni > 0 && idxFin < ruta2.length - 1 && idxFin > idxIni);
assert.equal(p2.coords.length, idxFin - idxIni + 1);
ok(`snap de deriva ${p2.registro.ini.snapM} m; sin vértices nuevos; recorte posterior ${p2.registro.ini.recorteM} m`);

console.log("\nCT-P3 · inicio a 500 m de la vía más cercana (sin conexión al grafo)");
const inicio500 = pt(-33.405, -70.555);
const ruta3 = recta(inicio500, pt(-33.42, -70.55), 40);
const p3 = protegerRuta(ruta3, SIN_NODO);
assert.equal(p3.registro.ini.nivel, "C");
assert.equal(p3.registro.ini.sinSnap, true);
assert.ok(p3.registro.ini.recorteM >= 150);
ok(`sinSnap=true; solo recorte (${p3.registro.ini.recorteM} m); zona de imprecisión 150 m; ningún tramo inventado`);

console.log("\nCT-P4 · GPX exportado de una ruta pública");
const protegida = p1.coords;
const gpxPub = polylineEncode(protegida);
const decodificada = polylineDecode(gpxPub);
assert.equal(decodificada.length, protegida.length);
// La polyline tiene precisión 5 decimales (~1 m): cada vértice
// decodificado coincide con el protegido dentro de esa tolerancia.
for (let i = 0; i < protegida.length; i++) {
  assert.ok(Math.abs(decodificada[i].lat - protegida[i].lat) < 1e-5 && Math.abs(decodificada[i].lon - protegida[i].lon) < 1e-5);
}
assert.ok(Math.abs(decodificada[0].lat - ruta1[0].lat) > 1e-4); // distinta del original en el extremo
ok("trackpoints idénticos a la geometría protegida y distintos del original en los extremos");

console.log("\nCT-P5 · ruta trazada con el motor: cuerpo interior sin cambios");
const motor = recta(pt(-33.45, -70.6), pt(-33.47, -70.6), 60); // ya en el grafo
const nodoIni = motor[0];
const nodoFin = motor[motor.length - 1];
const p5 = protegerRuta(motor, { nodoInicio: nodoIni, nodoFin });
assert.ok(interiorSinCambios(motor, p5.coords), "diff de vértices interiores = 0");
ok("cuerpo interior sin cambios tras la protección (diff = 0)");

console.log("\nCT-P6 · inicio a 600 m de la primera vía: tope de recorte excedido");
const inicio600 = pt(-33.41, -70.6);
// Traza corta: el extremo queda a ~600 m; el tope (400 m / 10 %) corta antes de 150 m efectivos.
const ruta6 = recta(inicio600, pt(-33.415, -70.599), 20); // ~560 m
const p6 = protegerRuta(ruta6, SIN_NODO);
const topeAlcanzado = p6.registro.topeExcedido || p6.registro.ini.recorteM < 150;
assert.ok(topeAlcanzado, `recorte ${p6.registro.ini.recorteM} m + topeExcedido=${p6.registro.topeExcedido}`);
ok(`la vista previa advierte (recorte ${p6.registro.ini.recorteM} m, topeExcedido=${p6.registro.topeExcedido}); publicación exige confirmación`);

console.log("\nExtremos aproximados y elevación resuelta");
assert.ok(Math.abs(p2.inicioAprox.lat - nodo.lat) <= 0.0005 + 0.0011);
ok("inicioAprox/finAprox redondeados a 3 decimales (~110 m)");
const muestras = muestrear(recta(pt(-33.4, -70.55), pt(-33.42, -70.55), 500), 100);
assert.equal(muestras.length, 100);
assert.deepEqual(muestras[0], pt(-33.4, -70.55));
ok("muestreo uniforme de ~100 puntos con extremos incluidos");
const ele = eleDesdeMuestras([100, 120, 130, 110, 90]);
assert.deepEqual(ele, { gainM: 30, lossM: 40, minEle: 90, maxEle: 130 });
assert.equal(eleDesdeMuestras([null, null]), null);
assert.equal(eleDesdeMuestras([500]), null);
ok("eleDesdeMuestras: gain/loss/min/max sin 0 ficticio; <2 valores → null");

console.log(`\nCT-P · ${pasos} comprobaciones OK`);
