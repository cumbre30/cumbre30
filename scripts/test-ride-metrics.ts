/**
 * Test unitario de computeRideMetrics (track sintético) + watts (fase 2)
 * + km off-road de computeOffRoadKm (v1.13.17).
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
import { computeOffRoadKm, type RawNet } from "@/lib/rideOffroad";
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

// --- fase 2: watts estimados en subida >4% ---
// Subida realista al 6%: 12 tramos de 5 s a 12 km/h (16.7 m) con 1 m de
// ascenso por punto. Física esperada (masa 87 kg = 75 + 12):
//   gravedad = 87·9.80665·(16.7/5)·(1/16.7) ≈ 171 W
//   rodadura = 0.005·87·9.80665·3.34 ≈ 14 W
//   aire     = 0.5·1.225·0.45·3.34³ ≈ 10 W   → total ≈ 195 W
const ptsW: TrackPt[] = [];
let tW = 5000;
let lonW = -70.60;
let altW = 500;
for (let i = 0; i <= 12; i++) {
  ptsW.push([LAT, lonW, altW, tW]);
  lonW += 16.7 / M_POR_DEG_LON;
  altW += 1.0;
  tW += 5;
}
const mW = computeRideMetrics(ptsW)!;
check("10. watts subida 6% ≈ 195 W (defaults 75/12)", mW.estWattsClimb !== null && mW.estWattsClimb! > 185 && mW.estWattsClimb! < 205, `${mW.estWattsClimb} W`);

// Ciclista más pesado → más watts (la gravedad domina: P ∝ masa).
const mW2 = computeRideMetrics(ptsW, { riderKg: 95, bikeKg: 12 })!;
check("11. ciclista 95 kg → watts suben (~225 W)", mW2.estWattsClimb !== null && mW2.estWattsClimb! > 210 && mW2.estWattsClimb! < 240, `${mW2.estWattsClimb} W`);

// Subida demasiado corta (<30 s) → null (ruido de GPS).
const ptsW3 = ptsW.slice(0, 5); // 20 s subiendo
check("12. subida <30 s → watts null", computeRideMetrics(ptsW3)!.estWattsClimb === null, "");

// Llano puro → null (los watts solo se reportan en subida >4%).
const ptsW4: TrackPt[] = [];
let lonW4 = -70.60;
for (let i = 0; i <= 12; i++) {
  ptsW4.push([LAT, lonW4, 500, 5000 + i * 5]);
  lonW4 += 41.7 / M_POR_DEG_LON;
}
check("13. llano puro → watts null", computeRideMetrics(ptsW4)!.estWattsClimb === null, "");

// --- fase 2: km off-road (superficie según la red path/track) ---
// Red sintética: una arista path (off-road) a lo largo de LAT y una
// residential (pavimento) a 222 m al norte, ambas ~4.6 km.
const net: RawNet = {
  classes: ["path", "residential"],
  nodes: [
    [LAT, -70.60], [LAT, -70.55], // 0-1: path
    [LAT + 0.002, -70.60], [LAT + 0.002, -70.55], // 2-3: residential
  ],
  edges: [
    [0, 1, 0, 0, 0], // path
    [2, 3, 1, 0, 0], // residential
  ],
};
// track 1: sobre el path → offRoadKm ≈ netKm ≈ 4.6 km
const trackPath: TrackPt[] = [];
let lonP = -70.60;
let tP = 100;
for (let i = 0; i <= 60; i++) {
  trackPath.push([LAT, lonP, 800, tP]);
  lonP += 75 / M_POR_DEG_LON; // ~75 m cada 10 s (~27 km/h)
  tP += 10;
}
const rPath = computeOffRoadKm(trackPath, net);
check("14. track sobre path → off-road ≈ medido ≈ 4.5 km", rPath.netKm > 4 && rPath.netKm < 5 && Math.abs(rPath.offRoadKm - rPath.netKm) < 0.05, `off=${rPath.offRoadKm} net=${rPath.netKm}`);
// track 2: sobre la residential a 222 m del path → off-road 0, medido ~4.6
const trackCalle: TrackPt[] = [];
let lonC = -70.60;
let tC = 100;
for (let i = 0; i <= 60; i++) {
  trackCalle.push([LAT + 0.002, lonC, 800, tC]);
  lonC += 75 / M_POR_DEG_LON;
  tC += 10;
}
const rCalle = computeOffRoadKm(trackCalle, net);
check("15. track sobre calle → off-road 0, medido ~4.5 km", rCalle.offRoadKm === 0 && rCalle.netKm > 4 && rCalle.netKm < 5, `off=${rCalle.offRoadKm} net=${rCalle.netKm}`);
// track 3: a 100 m al sur del path → fuera de cobertura (≤30 m) → net 0
const trackFuera: TrackPt[] = [];
let lonF = -70.60;
let tF = 100;
for (let i = 0; i <= 20; i++) {
  trackFuera.push([LAT - 0.001, lonF, 800, tF]);
  lonF += 75 / M_POR_DEG_LON;
  tF += 10;
}
const rFuera = computeOffRoadKm(trackFuera, net);
check("16. track fuera de cobertura → net 0 (no se inventa superficie)", rFuera.netKm === 0 && rFuera.offRoadKm === 0, `off=${rFuera.offRoadKm} net=${rFuera.netKm}`);
// track 4: mitad path, mitad fuera → solo la mitad entra al denominador
const trackMix: TrackPt[] = [];
let lonM = -70.60;
let tM = 100;
for (let i = 0; i <= 60; i++) {
  const lat = i < 30 ? LAT : LAT - 0.001;
  trackMix.push([lat, lonM, 800, tM]);
  lonM += 75 / M_POR_DEG_LON;
  tM += 10;
}
const rMix = computeOffRoadKm(trackMix, net);
check("17. track mixto → denominador solo con cobertura (~2.2 km)", rMix.netKm > 1.8 && rMix.netKm < 2.6 && rMix.offRoadKm > 1.8 && rMix.offRoadKm <= rMix.netKm, `off=${rMix.offRoadKm} net=${rMix.netKm}`);

console.log(fallos === 0 ? "\nTODO OK" : `\nFALLOS: ${fallos}`);
process.exit(fallos === 0 ? 0 : 1);
