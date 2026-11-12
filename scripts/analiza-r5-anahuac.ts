/**
 * Contexto de los picos de r5: vecindario de idx=302 y idx=662,
 * distancia a Casa Anáhuac, y tramos cercanos a la curva Anáhuac.
 */
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";
import { haversineM } from "../src/lib/geo";

const ANAHUAC = { lat: -33.417135, lon: -70.623511 };

function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const φ1 = (a.lat * Math.PI) / 180, φ2 = (b.lat * Math.PI) / 180;
  const Δλ = ((b.lon - a.lon) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
function angDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

const r5 = RUTAS_TRAZADOS["r5"];
const coords = r5.coords.map(([lat, lon]) => ({ lat, lon }));

function vecindario(desde: number, hasta: number, titulo: string) {
  console.log(`\n--- ${titulo} (idx ${desde}..${hasta}) ---`);
  let dTot = 0;
  for (let i = desde; i <= hasta; i++) {
    const dA = haversineM(coords[i], ANAHUAC);
    const prev = i > 0 ? haversineM(coords[i - 1], coords[i]) : 0;
    dTot += prev;
    const b = i > 0 && i < coords.length - 1 ? angDiff(bearing(coords[i - 1], coords[i]), bearing(coords[i], coords[i + 1])) : 0;
    console.log(
      `  idx=${String(i).padStart(4)} (${coords[i].lat.toFixed(6)}, ${coords[i].lon.toFixed(6)}) dAnáhuac=${dA.toFixed(0).padStart(4)}m step=${prev.toFixed(1).padStart(5)}m rev=${b.toFixed(0)}°`
    );
  }
  console.log(`  dist acumulada tramo: ${dTot.toFixed(0)} m`);
}

vecindario(270, 335, "Pico 1 idx=302");
vecindario(640, 690, "Pico 2 idx=662");

// ¿Cuánto avanza el pico 1 hacia adelante y regresa? Comparar idx290 vs idx315
console.log("\nDistancias entre extremos del pico 1: idx285↔idx320:",
  haversineM(coords[285], coords[320]).toFixed(0), "m");
console.log("Distancias entre extremos del pico 2: idx645↔idx680:",
  haversineM(coords[645], coords[680]).toFixed(0), "m");

// Puntos de r5 a <250 m de la curva Anáhuac
console.log("\n--- Puntos r5 a <250 m de Casa Anáhuac ---");
let lastIdx = -99;
for (let i = 0; i < coords.length; i++) {
  const d = haversineM(coords[i], ANAHUAC);
  if (d < 250) {
    if (i - lastIdx > 1) console.log("  --- (salto de índices) ---");
    console.log(`  idx=${String(i).padStart(4)} (${coords[i].lat.toFixed(6)}, ${coords[i].lon.toFixed(6)}) d=${d.toFixed(0)}m`);
    lastIdx = i;
  }
}

// Ventana de retroceso global
for (const w of [5, 15, 25]) {
  let max = 0, idx = -1;
  for (let i = w; i < coords.length - w; i++) {
    const before = haversineM(coords[0], coords[i - w]);
    const after = haversineM(coords[0], coords[i + w]);
    if (after < before && before - after > max) { max = before - after; idx = i; }
  }
  console.log(`ventana ${w}: retroceso máx ${max.toFixed(0)} m @ idx=${idx} (${idx >= 0 ? `${coords[idx].lat.toFixed(6)},${coords[idx].lon.toFixed(6)}` : "ninguno"})`);
}
