// Prueba de lógica: niveles ajustados + métricas nuevas + desbloqueo secuencial.
// Correr: npx tsx scripts/test-levels-pins.ts
import {
  RIDER_LEVELS,
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
console.log("NIVELES:", RIDER_LEVELS.map((l) => `${l.name} ${l.min}-${l.max ?? "+"}`).join(" | "));
eq("0 km → Explorador", riderLevelForKm(0).level.name, "Explorador");
eq("49.9 km → Explorador", riderLevelForKm(49.9).level.name, "Explorador");
eq("50 km → Ciclista", riderLevelForKm(50).level.name, "Ciclista");
eq("86.4 km → Ciclista", riderLevelForKm(86.4).level.name, "Ciclista");
eq("150 km → Montañero", riderLevelForKm(150).level.name, "Montañero");
eq("399 km → Montañero", riderLevelForKm(399).level.name, "Montañero");
eq("400 km → Desafiante", riderLevelForKm(400).level.name, "Desafiante");
eq("86.4 km faltan 63.6 a Montañero", Number(riderLevelForKm(86.4).toNext.toFixed(1)), 63.6);
eq("500 km pct max 100", riderLevelForKm(500).pct, 100);

// ---- 2. Métricas nuevas en statsFromRides ----
// 2026-11-04 es miércoles. Sábado = 2026-10-31, domingo = 2026-11-01.
const rides = [
  { distanceKm: 21.4, maxKmh: 45, maxInParkKmh: 28.9, gainM: 300, overLimitSec: 0, dateISO: "2026-10-31T18:00:00Z" }, // sábado local
  { distanceKm: 12.2, maxKmh: 38, maxInParkKmh: 26, gainM: 250, overLimitSec: 0, dateISO: "2026-11-01T14:00:00Z" },  // domingo local
  { distanceKm: 9.8, maxKmh: 40, maxInParkKmh: 29, gainM: 220, overLimitSec: 40, dateISO: "2026-11-03T12:00:00Z" },  // martes
];
const s = statsFromRides(rides);
eq("maxRideKm", Number(s.maxRideKm.toFixed(1)), 21.4);
eq("weekendRides", s.weekendRides, 2);
eq("cleanParkRides (2 limpios de 2+ km)", s.cleanParkRides, 2);
eq("parkRides", s.parkRides, 3);
eq("totalKm", Number(s.totalKm.toFixed(1)), 43.4);

// ---- 3. Desbloqueo con esas stats (secuencial + retos) ----
const got = evaluateAchievements(s, []);
console.log("DESBLOQUEADOS:", got.sort());
eq("const_1 desbloqueado", got.includes("const_1"), true);
eq("const_10 NO desbloqueado (falta)", got.includes("const_10"), false);
eq("km_10 desbloqueado (43.4 km ≥ 10)", got.includes("km_10"), true);
eq("gain_300 desbloqueado (770 m)", got.includes("gain_300"), true);
eq("gain_1500 NO desbloqueado", got.includes("gain_1500"), false);
eq("park_clean_1 desbloqueado", got.includes("park_clean_1"), true);
eq("park_10 NO desbloqueado (3 rides)", got.includes("park_10"), false);
eq("dist_21 desbloqueado (21.4 km)", got.includes("dist_21"), true);
eq("clean_5 NO desbloqueado (2 limpios)", got.includes("clean_5"), false);
eq("finde_8 NO desbloqueado (2 finde)", got.includes("finde_8"), false);

// ---- 4. Progresión de serie Constancia: sube secuencial ----
const s10 = statsFromRides(
  Array.from({ length: 10 }, (_, i) => ({
    distanceKm: 5, maxKmh: 30, maxInParkKmh: null, gainM: 100, overLimitSec: 0,
    dateISO: `2026-10-${10 + i}T18:00:00Z`,
  }))
);
const got10 = evaluateAchievements(s10, []);
eq("10 rides → const_1 y const_10", [got10.includes("const_1"), got10.includes("const_10")], [true, true]);
eq("10 rides → const_25 NO", got10.includes("const_25"), false);

// ---- 5. Coherencia del catálogo: cada tier tiene pin único y existente ----
const rewards = ALL_TIERS.map((t) => t.reward);
eq("recompensas de tiers todas únicas", new Set(rewards).size === rewards.length, true);
eq("recompensas existen en PINS", rewards.every((r) => r in PINS), true);
const codes = ALL_TIERS.map((t) => t.code);
eq("códigos de tiers únicos", new Set(codes).size === codes.length, true);
// Los pines sin recompensa asignada:
const pinSinTier = (Object.keys(PINS) as PinId[]).filter((p) => !rewards.includes(p));
eq("pines sin tier (solo clasico)", pinSinTier, ["clasico"]);
console.log(`Series: ${SERIES.map((x) => x.name).join(", ")} · Retos: ${RETOS.length} · Pines: ${Object.keys(PINS).length}`);

console.log(fails === 0 ? "\nTODO OK" : `\n${fails} FALLAS`);
process.exit(fails === 0 ? 0 : 1);
