// Prueba de lógica: niveles (Desafiante 500 / Leyenda 500+) + Serie Horas
// + parque solo dentro de la geocerca (inParkKm) + detección de vehículo
// motorizado + desbloqueo secuencial.
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
  ACHIEVEMENT_BY_CODE,
  tierIsPro,
  pinIsPro,
  TIME_SERIES,
  windowStatsFromRides,
  startOfWeek,
  timeChallengeProgress,
  type AchievementStats,
  type PinId,
} from "../src/lib/pins";
import { isMotorizedRide, VEH_LIMIT_KMH } from "../src/lib/vehicleDetect";

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

// ---- 5. Detección de vehículo motorizado (lib/vehicleDetect) ----
eq("bajada rápida en bici (44 km/h 30 s, prom 24) NO es motorizado", isMotorizedRide({ vehSec: 30, vehStreakSec: 30, avgKmh: 24, movingSec: 1800, maxKmh: 44 }), false);
eq("punta de 42 en bajada (reto Velocista) NO es motorizado", isMotorizedRide({ vehSec: 0, vehStreakSec: 0, avgKmh: 18, movingSec: 2400, maxKmh: 42 }), false);
eq("auto: tramo continuo de 50 s sobre 45 SÍ es motorizado", isMotorizedRide({ vehSec: 120, vehStreakSec: 50, avgKmh: 38, movingSec: 900, maxKmh: 58 }), true);
eq("auto urbano: ráfagas entre semáforos (total 100 s) SÍ", isMotorizedRide({ vehSec: 100, vehStreakSec: 25, avgKmh: 31, movingSec: 700, maxKmh: 52 }), true);
eq("auto lento: prom 33 sostenido 12 min SÍ", isMotorizedRide({ vehSec: 0, vehStreakSec: 0, avgKmh: 33, movingSec: 720, maxKmh: 45 }), true);
eq("prom 33 pero solo 5 min en movimiento NO (aún)", isMotorizedRide({ vehSec: 0, vehStreakSec: 0, avgKmh: 33, movingSec: 300, maxKmh: 45 }), false);
eq("moto: punta de 95 km/h SÍ", isMotorizedRide({ vehSec: 10, vehStreakSec: 10, avgKmh: 30, movingSec: 600, maxKmh: 95 }), true);
eq("bici fuerte: 45 km/h sostenidos 40 s (no llega al tramo de 45 s) NO", isMotorizedRide({ vehSec: 40, vehStreakSec: 40, avgKmh: 26, movingSec: 3600, maxKmh: 47 }), false);
eq("umbral VEH_LIMIT_KMH = 45", VEH_LIMIT_KMH, 45);

// ---- 6. Los rides motorizados NO cuentan en stats ni logros ----
const conVehiculo = statsFromRides([
  ...rides, // 43.4 km / 3 rides / máx 45
  { distanceKm: 40, maxKmh: 70, maxInParkKmh: null, inParkKm: 0, gainM: 10, overLimitSec: 0, elapsedSec: 2400, dateISO: "2026-11-03T20:00:00Z", motorized: true }, // auto
]);
eq("motorizado excluido: totalKm sigue 43.4", Number(conVehiculo.totalKm.toFixed(1)), 43.4);
eq("motorizado excluido: rideCount sigue 3", conVehiculo.rideCount, 3);
eq("motorizado excluido: maxKmh sigue 45 (auto 70 no da Velocista)", conVehiculo.maxKmh, 45);
eq("motorizado excluido: totalHours sin el auto", Number(conVehiculo.totalHours.toFixed(2)), 3.25);
eq("motorizado excluido: maxRideKm sigue 21.4", Number(conVehiculo.maxRideKm.toFixed(1)), 21.4);
// Sin flag no excluye nada (rides viejos/otros clientes).
const sinFlag = statsFromRides([...rides, { distanceKm: 40, maxKmh: 70, maxInParkKmh: null, gainM: 10, overLimitSec: 0, elapsedSec: 2400, dateISO: "2026-11-03T20:00:00Z" }]);
eq("sin flag: el ride cuenta (compatibilidad)", Number(sinFlag.totalKm.toFixed(1)), 83.4);

// ---- 7. Coherencia del catálogo ----
const rewards = ALL_TIERS.map((t) => t.reward);
eq("recompensas de tiers todas únicas", new Set(rewards).size === rewards.length, true);
eq("recompensas existen en PINS", rewards.every((r) => r in PINS), true);
const codes = ALL_TIERS.map((t) => t.code);
eq("códigos de tiers únicos", new Set(codes).size === codes.length, true);
const pinSinTier = (Object.keys(PINS) as PinId[]).filter((p) => !rewards.includes(p));
eq("pines sin tier (solo clasico)", pinSinTier, ["clasico"]);
// ---- 8. Free/Pro: solo el primer desafío de cada serie es gratis ----
const proPorSerie = SERIES.flatMap((s) => s.tiers.map((t, i) => ({ code: t.code, pro: t.pro === true, i })));
eq("km_10 free", proPorSerie.find((x) => x.code === "km_10")?.pro, false);
eq("km_50 pro", proPorSerie.find((x) => x.code === "km_50")?.pro, true);
eq("gain_300 free", proPorSerie.find((x) => x.code === "gain_300")?.pro, false);
eq("gain_1500 pro", proPorSerie.find((x) => x.code === "gain_1500")?.pro, true);
eq("park_clean_1 free", proPorSerie.find((x) => x.code === "park_clean_1")?.pro, false);
eq("park_10 pro", proPorSerie.find((x) => x.code === "park_10")?.pro, true);
eq("rep_1 free", proPorSerie.find((x) => x.code === "rep_1")?.pro, false);
eq("rep_10 pro", proPorSerie.find((x) => x.code === "rep_10")?.pro, true);
eq("const_1 free", proPorSerie.find((x) => x.code === "const_1")?.pro, false);
eq("const_10 pro", proPorSerie.find((x) => x.code === "const_10")?.pro, true);
eq("hrs_10 free", proPorSerie.find((x) => x.code === "hrs_10")?.pro, false);
eq("hrs_25 pro", proPorSerie.find((x) => x.code === "hrs_25")?.pro, true);
eq("exactamente un free por serie", SERIES.every((s) => s.tiers.filter((t) => !t.pro).length === 1), true);
eq("night_1 (primer reto) free", RETOS[0].pro ?? false, false);
eq("retos 2+ pro", RETOS.slice(1).every((t) => t.pro === true), true);
eq("tierIsPro(km_50)", tierIsPro(ACHIEVEMENT_BY_CODE["km_50"]), true);
eq("pinIsPro(clasico) false", pinIsPro("clasico"), false);
eq("pinIsPro(trebol) false (1er de kilómetros)", pinIsPro("trebol"), false);
eq("pinIsPro(mate) true", pinIsPro("mate"), true);
eq("pinIsPro(luna) false (1er reto)", pinIsPro("luna"), false);
eq("pinIsPro(rayo) true", pinIsPro("rayo"), true);
eq("pinIsPro(reloj) false (1er de horas)", pinIsPro("reloj"), false);
eq("pinIsPro(cronista) true", pinIsPro("cronista"), true);
const pinesPro = (Object.keys(PINS) as PinId[]).filter((p) => pinIsPro(p));
eq("pines free = 1 por serie + 1 reto + clasico", pinesPro.length, Object.keys(PINS).length - (SERIES.length + 1 + 1));

// Free/Pro en la evaluación de logros
const stats60km: AchievementStats = { totalKm: 60, rideCount: 8, maxKmh: 30, totalGainM: 200, parkRides: 2, cleanParkRides: 1, nightRides: 2, dawnRides: 0, maxRideKm: 20, weekendRides: 2, totalHours: 4, incidentCount: 0 };
const freeEval = evaluateAchievements(stats60km, [], { pro: false });
eq("free: km_10 sí", freeEval.includes("km_10"), true);
eq("free: km_50 NO (pro)", freeEval.includes("km_50"), false);
eq("free: night_1 sí", freeEval.includes("night_1"), true);
eq("free: speed_42 NO (pro, aunque maxKmh 30 no alcanza igual)", freeEval.includes("speed_42"), false);
const statsProReto: AchievementStats = { ...stats60km, maxKmh: 45 };
const freeEval2 = evaluateAchievements(statsProReto, [], { pro: false });
eq("free con 45 km/h: speed_42 NO (requiere Pro)", freeEval2.includes("speed_42"), false);
const proEval = evaluateAchievements(statsProReto, [], { pro: true });
eq("pro con 45 km/h: speed_42 SÍ", proEval.includes("speed_42"), true);
eq("pro con 60 km: km_50 SÍ", proEval.includes("km_50"), true);
// Ya ganados con Pro se conservan aunque la licencia expire.
const licVencida = evaluateAchievements(stats60km, ["km_50", "km_100"], { pro: false });
eq("licencia vencida: km_50/km_100 ya ganados se conservan", [licVencida.includes("km_50"), licVencida.includes("km_100")], [true, true]);
eq("licencia vencida: km_250 no se desbloquea (cadena cortada por pro)", licVencida.includes("km_250"), false);

// ---- 9. Desafíos con fecha: día / semana / mes ----
eq("series de fecha: 3 (dia/semana/mes)", TIME_SERIES.map((t) => t.id), ["dia", "semana", "mes"]);
eq("desafíos con fecha sin reward", TIME_SERIES.every((t) => t.challenges.every((c) => !("reward" in c))), true);
eq("desafíos con fecha sin pro", TIME_SERIES.every((t) => t.challenges.every((c) => !("pro" in c))), true);
const totalFecha = TIME_SERIES.reduce((n, t) => n + t.challenges.length, 0);
eq("8 desafíos con fecha (2+3+3)", totalFecha, 8);

// Ventanas: ahora = miércoles 2026-11-04 15:00 local del servidor de pruebas.
// Usamos fechas LOCALES para que el test no dependa de la zona horaria.
const ahora = new Date(2026, 10, 4, 15, 0, 0); // miércoles
const mismoDia = new Date(2026, 10, 4, 9, 0, 0);
const ayer = new Date(2026, 10, 3, 18, 0, 0);  // martes (misma semana)
const lunes = new Date(2026, 10, 2, 8, 0, 0);  // lunes (misma semana)
const domingoPasado = new Date(2026, 10, 1, 20, 0, 0); // domingo semana anterior
const mesPasado = new Date(2026, 9, 28, 12, 0, 0);     // octubre
const wsRides = [
  { dateISO: mismoDia, distanceKm: 8, gainM: 120 },
  { dateISO: ayer, distanceKm: 10, gainM: 150 },
  { dateISO: lunes, distanceKm: 12, gainM: 200 },
  { dateISO: domingoPasado, distanceKm: 30, gainM: 400 },
  { dateISO: mesPasado, distanceKm: 100, gainM: 900 },
  { dateISO: mismoDia, distanceKm: 5, gainM: 60, motorized: true }, // auto: no cuenta
];
const ws = windowStatsFromRides(wsRides, ahora);
eq("hoy: 1 ride (el auto no cuenta)", ws.dia.rides, 1);
eq("hoy: 8 km", Number(ws.dia.km.toFixed(1)), 8);
eq("hoy: 120 m", ws.dia.gainM, 120);
eq("semana (lunes a hoy): 3 rides", ws.semana.rides, 3);
eq("semana: 30 km", Number(ws.semana.km.toFixed(1)), 30);
eq("semana: 470 m", ws.semana.gainM, 470);
eq("mes: 4 rides", ws.mes.rides, 4);
eq("mes: 60 km", Number(ws.mes.km.toFixed(1)), 60);
eq("mes: 870 m (120+150+200+400)", ws.mes.gainM, 870);
// Semana parte el lunes: startOfWeek(mie 4-nov) = lun 2-nov 00:00
const sow = startOfWeek(new Date(2026, 10, 4, 15, 0, 0));
eq("startOfWeek → lunes 2-nov 00:00", [sow.getFullYear(), sow.getMonth(), sow.getDate(), sow.getHours(), sow.getMinutes()], [2026, 10, 2, 0, 0]);
const sowDom = startOfWeek(new Date(2026, 10, 1, 20, 0, 0)); // domingo → lunes 26-oct
eq("startOfWeek(domingo) → lunes 26-oct", [sowDom.getMonth(), sowDom.getDate()], [9, 26]);
// Progreso de desafíos con fecha
eq("d_ride_1 cumplido hoy", timeChallengeProgress(TIME_SERIES[0].challenges[0], ws).done, true);
eq("d_km_5 con 8 km: cumplido", timeChallengeProgress(TIME_SERIES[0].challenges[1], ws).done, true);
eq("w_km_25 con 30 km: cumplido", timeChallengeProgress(TIME_SERIES[1].challenges[1], ws).done, true);
eq("w_ride_3 con 3 rides: cumplido", timeChallengeProgress(TIME_SERIES[1].challenges[0], ws).done, true);
eq("m_km_100 con 60 km: 60%", timeChallengeProgress(TIME_SERIES[2].challenges[1], ws).pct, 60);
eq("m_gain_1500 con 870 m: sin cumplir", timeChallengeProgress(TIME_SERIES[2].challenges[2], ws).done, false);

console.log(`Series: ${SERIES.map((x) => x.name).join(", ")} · Retos: ${RETOS.length} · Pines: ${Object.keys(PINS).length}`);

console.log(fails === 0 ? "\nTODO OK" : `\n${fails} FALLAS`);
process.exit(fails === 0 ? 0 : 1);
