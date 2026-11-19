/**
 * Test unitario de computeRideMetrics (track sintético).
 * Ejecutar: bun run scripts/test-ride-metrics.ts
 *
 * Track: arranque quieto (no cuenta) → llano 30 km/h → parada 20 s →
 * llano 30 km/h → subida fuerte (100 m en 90 s) → parada 30 s → llano
 * 30 km/h → tramo imposible a 90 km/h (pendiente 0 = llano: entra al
 * P15s; el antitrampa del servidor es quien excluye el ride).
 * Distancias por punto de 5 s: 30 km/h = 41.7 m, 12 km/h = 16.7 m,
 * 90 km/h = 125 m.
 */
import { computeRideMetrics } from "@/lib/rideMetrics";
import type { TrackPt } from "@/lib/history";

let fallos = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`${ok ? "✓" : "✗"} ${n}${d ? " — " + d : ""}`);
  if (!ok) fallos++;
};

const LAT = -33.41;
const M_POR_DEG_LON = 111320 * Math.cos((LAT * Math.PI) / 180); // ~92952 m
const pts: TrackPt[] = [];
let t = 1000;
let lon = -70.56;
let alt = 800;
const push = (n: number, dLonM: number, dAlt: number) => {
  for (let i = 0; i < n; i++) {
    lon += dLonM / M_POR_DEG_LON;
    alt += dAlt;
    pts.push([LAT, lon, alt, t]);
    t += 5;
  }
};

push(8, 0, 0); // arranque quieto 40 s (no cuenta: no hubo movimiento antes)
push(12, 41.7, 0); // llano 30 km/h · 60 s
push(4, 0, 0); // parada 1: 20 s (>15 s → cuenta)
push(10, 41.7, 0); // llano 30 km/h · 50 s
push(18, 16.6, 100 / 18); // subida fuerte · 90 s · 100 m
push(6, 0, 0); // parada 2: 30 s (cuenta)
push(4, 41.7, 0); // llano final · 20 s
push(8, 125, 0); // imposible 90 km/h · 40 s

const m = computeRideMetrics(pts);
if (!m) {
  console.log("✗ computeRideMetrics devolvió null");
  process.exit(1);
}
check("1. muestras procesadas", m.samples === pts.length, `${m.samples}/${pts.length}`);
check("2. media en llano ~44 (130 s a 30 + 40 s a 90 en llano)", (m.flatAvgKmh ?? 0) > 40 && (m.flatAvgKmh ?? 0) < 50, `${m.flatAvgKmh}`);
check("3. VAM ~4000 m/h (100 m en 90 s)", m.vamMh !== null && m.vamMh > 3600 && m.vamMh < 4400, `${m.vamMh}`);
check("4. climbGain ~100 m", m.climbGainM >= 92 && m.climbGainM <= 105, `${m.climbGainM}`);
check("5. 2 paradas >15 s", m.stopCount === 2, `${m.stopCount}`);
check("6. tramo imposible: streak >55 ≈40 s", m.over55StreakSec >= 35 && m.over55StreakSec <= 45, `${m.over55StreakSec} s`);
check("7. P95 de picos en llano ~90 (la cola imposible es llano)", (m.peak15sKmh ?? 0) > 80, `${m.peak15sKmh}`);
check("8. movingSec ~260 s", m.movingSec > 250 && m.movingSec < 275, `${m.movingSec} s`);
check("9. track corto → null", computeRideMetrics([[1, 1, 0, 0], [1, 1, 0, 5]]) === null);

console.log(fallos === 0 ? "\nTODO OK" : `\nFALLOS: ${fallos}`);
process.exit(fallos === 0 ? 0 : 1);
