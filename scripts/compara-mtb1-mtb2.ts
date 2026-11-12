// Compara trazados mtb1 vs mtb2: largo, puntos compartidos, divergencias.
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
function hav(a: [number, number], b: [number, number]) {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function largo(coords: [number, number][]) {
  let m = 0;
  for (let i = 1; i < coords.length; i++) m += hav(coords[i - 1], coords[i]);
  return m;
}

const a = RUTAS_TRAZADOS["mtb1"].coords;
const b = RUTAS_TRAZADOS["mtb2"].coords;
console.log(`mtb1: ${a.length} pts, ${(largo(a) / 1000).toFixed(3)} km | distKm declarado ${RUTAS_TRAZADOS["mtb1"].distKm}`);
console.log(`mtb2: ${b.length} pts, ${(largo(b) / 1000).toFixed(3)} km | distKm declarado ${RUTAS_TRAZADOS["mtb2"].distKm}`);

// Puntos idénticos (mismo par lat/lon exacto)
const key = (p: [number, number]) => `${p[0]},${p[1]}`;
const setB = new Map<string, number[]>();
b.forEach((p, i) => {
  const k = key(p);
  (setB.get(k) ?? setB.set(k, []).get(k)!).push(i);
});
let comunes = 0;
const idxComunesA: number[] = [];
a.forEach((p, i) => {
  if (setB.has(key(p))) { comunes++; idxComunesA.push(i); }
});
console.log(`puntos exactamente iguales: ${comunes} (${((comunes / a.length) * 100).toFixed(1)}% de mtb1)`);

// Primer y último punto divergente dentro de A
if (idxComunesA.length) {
  const primero = idxComunesA[0];
  const ultimo = idxComunesA[idxComunesA.length - 1];
  console.log(`en mtb1, puntos compartidos van del índice ${primero} al ${ultimo} (tramo común de ${(largo(a.slice(primero, ultimo + 1)) / 1000).toFixed(2)} km)`);
}

// Divergencia punto a punto: primera posición donde difieren
let firstDiff = -1;
for (let i = 0; i < Math.min(a.length, b.length); i++) {
  if (key(a[i]) !== key(b[i])) { firstDiff = i; break; }
}
console.log(`primera diferencia (índice alineado): ${firstDiff === -1 ? "ninguna en el tramo alineado" : firstDiff}`);
if (firstDiff !== -1) {
  console.log("  mtb1[firstDiff-1..firstDiff+1]:", JSON.stringify(a.slice(Math.max(0, firstDiff - 1), firstDiff + 2)));
  console.log("  mtb2[firstDiff-1..firstDiff+1]:", JSON.stringify(b.slice(Math.max(0, firstDiff - 1), firstDiff + 2)));
}

// Reversa: ¿mtb2 contiene el tramo final de mtb1 (descenso Zorzal) o el de La S es distinto?
// Distancia de cada punto de A al punto más cercano de B (muestreo cada 20)
let sumaMin = 0, n = 0, maxMin = 0, peorIdx = -1;
for (let i = 0; i < a.length; i += 20) {
  let min = Infinity;
  for (const q of b) { const d = hav(a[i], q); if (d < min) min = d; }
  sumaMin += min; n++;
  if (min > maxMin) { maxMin = min; peorIdx = i; }
}
console.log(`distancia media punto-mtb1→mtb2 (muestreo): ${(sumaMin / n).toFixed(0)} m; peor: ${maxMin.toFixed(0)} m en índice ${peorIdx} (coord ${JSON.stringify(a[peorIdx])})`);

// Y al revés: peor de B respecto a A
let maxMinB = 0, peorB = -1;
for (let i = 0; i < b.length; i += 20) {
  let min = Infinity;
  for (const q of a) { const d = hav(b[i], q); if (d < min) min = d; }
  if (min > maxMinB) { maxMinB = min; peorB = i; }
}
console.log(`peor punto de mtb2 respecto a mtb1: ${maxMinB.toFixed(0)} m en índice ${peorB} (coord ${JSON.stringify(b[peorB])})`);

// Autointersección básica por proximidad de segmentos no consecutivos (solo alerta gruesa)
function bbox(coords: [number, number][]) {
  const lats = coords.map((c) => c[0]), lons = coords.map((c) => c[1]);
  return { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLon: Math.min(...lons), maxLon: Math.max(...lons) };
}
console.log("bbox mtb1:", JSON.stringify(bbox(a)));
console.log("bbox mtb2:", JSON.stringify(bbox(b)));
