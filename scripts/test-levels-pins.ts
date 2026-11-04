// Prueba de lógica: niveles (Desafiante 500 / Leyenda 500+) + Serie Horas
// + parque solo dentro de la geocerca (inParkKm) + desbloqueo secuencial.
// Correr: npx tsx scripts/test-levels-pins.ts
import {
  RIDER_LEVELS,
  LEYENDA_KM,
  riderLevelForKm,
  statsFromRides,
  evaluateAchievements,
  SERIES,
  RETOS,
  ALL_TIERS,
  PINS,
  type PinId,
} from "../src/lib/pins";

let fails = 0;
function eq(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "OK " : "FAIL"} ${label} → ${JSON.stringify(got)}${ok ? "" : ` (esperado ${JSON.stringify(want)})`}`);
}

// ---- 1. Umbrales de niveles ----
console.log("NIVELES:", RIDER_LEVELS.map((l) => `${l.name} ${l.min}-${l.max ?? "+"}`).join(" | "), "· LEYENDA_KM =", LEYENDA_KM);
eq("0 km → Explorador", riderLevelForKm(0).level.name, "Explorador");
eq("49.9 km → Explorador", riderLevelForKm(49.9).level.name, "Explorador");
eq("50 km → Ciclista", riderLevelForKm(50).level.name, "Ciclista");
eq("86.4 km → Ciclista", riderLevelForKm(86.4).level.name, "Ciclista");
eq("150 km → Montañero", riderLevelForKm(150).level.name, "Montañero");
eq("499 km → Montañero", riderLevelForKm(499).level.name, "Montañero");
eq("500 km → Desafiante", riderLevelForKm(500).level.name, "Desafiante");
eq("86.4 km faltan 63.6 a Montañero", Number(riderLevelForKm(86.4).toNext.toFixed(1)), 63.6);
eq("500 km es el umbral Leyenda", LEYENDA_KM, 500);
eq("Desafiante.max es null", riderLevelForKm(600).level.max, null);

// ---- 2. Métricas nuevas: horas, maxRideKm, weekendRides ----
// 2026-11-04 es miércoles. Sábado = 2026-10-31, domingo = 2026-11-01.
const rides = [
  { distanceKm: 21.4, maxKmh: 45, maxInParkKmh: 28.9, inParkKm: 5.2, gainM: 300, overLimitSec: 0, elapsedSec: 5400, dateISO: "2026-10-31T18:00:00Z" }, // sábado local
  { distanceKm: 12.2, maxKmh: 38, maxInParkKmh: 26, inParkKm: 4.8, gainM: 250, overLimitSec: 0, elapsedSec: 3600, dateISO: "2026-11-01T14:00:00Z" },  // domingo local
  { distanceKm: 9.8, maxKmh: 40, maxInParkKmh: 29, inParkKm: 1.1, gainM: 220, overLimitSec: 40, elapsedSec: 2700, dateISO: "2026-11-03T12:00:00Z" },  // martes
];
const s = statsFromRides(rides);
eq("maxRideKm", Number(s.maxRideKm.toFixed(1)), 21.4);
eq("weekendRides", s.weekendRides, 2);
eq("totalHours (5400+3600+2700 s)", Number(s.totalHours.toFixed(2)), 3.25);
eq("cleanParkRides (2 con 2+ km DENTRO)", s.cleanParkRides, 2);
eq("parkRides (3 entraron ≥ 0.5 km dentro)", s.parkRides, 3);
eq("totalKm", Number(s.totalKm.toFixed(1)), 43.4);

// ---- 3. Parque SOLO dentro de la geocerca ----
// Ride de ruta 30 km que roza el borde (0.2 km dentro): NO es ride de parque.
const clip = statsFromRides([{ distanceKm: 30, maxKmh: 50, maxInParkKmh: 22, inParkKm: 0.2, gainM: 100, overLimitSec: 0, dateISO: "2026-11-02T15:00:00Z" }]);
eq("roce de borde (0.2 km dentro) NO cuenta parkRides", clip.parkRides, 0);
eq("roce de borde NO cuenta cleanParkRides", clip.cleanParkRides, 0);
// 1 km dentro sin exceso: entra al parque pero NO es ride limpio (pide 2 km dentro).
const short = statsFromRides([{ distanceKm: 1.2, maxKmh: 26, maxInParkKmh: 26, inParkKm: 1.0, gainM: 60, overLimitSec: 0, dateISO: "2026-11-02T15:00:00Z" }]);
eq("1 km dentro cuenta parkRides", short.parkRides, 1);
eq("1 km dentro NO cuenta cleanParkRides", short.cleanParkRides, 0);
// Ride legacy (sin inParkKm) conserva la regla anterior.
const legacy = statsFromRides([{ distanceKm: 5, maxKmh: 26, maxInParkKmh: 25, gainM: 100, overLimitSec: 0, dateISO: "2026-11-02T15:00:00Z" }]);
eq("legacy sin inParkKm: regla anterior (park)", legacy.parkRides, 1);
eq("legacy sin inParkKm: regla anterior (clean, 5 km total)", legacy.cleanParkRides, 1);

// ---- 4. Serie Horas: desbloqueo secuencial ----
const sH = statsFromRides(rides); // 3.25 h
const gotH = evaluateAchievements(sH, []);
eq("3.25 h NO desbloquea hrs_10", gotH.includes("hrs_10"), false);
// 12 rides de 1 h = 12 h → hrs_10 sí
const s10h = statsFromRides(
  Array.from({ length: 12 }, (_, i) => ({
    distanceKm: 10, maxKmh: 30, maxInParkKmh: null, gainM: 200, overLimitSec: 0, elapsedSec: 3600,
    dateISO: `2026-10-${10 + i}T18:00:00Z`,
  }))
);
const got10h = evaluateAchievements(s10h, []);
eq("12 h → hrs_10 desbloqueado", got10h.includes("hrs_10"), true);
eq("12 h → hrs_25 NO", got10h.includes("hrs_25"), false);

// ---- 5. Coherencia del catálogo ----
const rewards = ALL_TIERS.map((t) => t.reward);
eq("recompensas de tiers todas únicas", new Set(rewards).size === rewards.length, true);
eq("recompensas existen en PINS", rewards.every((r) => r in PINS), true);
const codes = ALL_TIERS.map((t) => t.code);
eq("códigos de tiers únicos", new Set(codes).size === codes.length, true);
const pinSinTier = (Object.keys(PINS) as PinId[]).filter((p) => !rewards.includes(p));
eq("pines sin tier (solo clasico)", pinSinTier, ["clasico"]);
console.log(`Series: ${SERIES.map((x) => x.name).join(", ")} · Retos: ${RETOS.length} · Pines: ${Object.keys(PINS).length}`);

console.log(fails === 0 ? "\nTODO OK" : `\n${fails} FALLAS`);
process.exit(fails === 0 ? 0 : 1);
