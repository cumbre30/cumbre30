// ============================================================
// Horario del parque y avisos de luz (cálculo 100% offline).
// El atardecer se calcula con la fórmula NOAA (general solar
// calculations, la misma de su hoja de cálculo): para Santiago
// el error es < 1-2 minutos, suficiente para avisar de llevar
// luces. Sin API ni conexión. La hora local SIEMPRE se resuelve
// en la zona America/Santiago (independiente del reloj del
// teléfono), con su DST real: UTC-3 en verano, UTC-4 en invierno.
// Reglas del parque (Parquemet, nov 2026):
//   - Ingreso de ciclistas 06:00 a 19:00.
//   - Cumbre por el sector Tupahue: no se accede desde las 13:30.
//   - Casco y luces al caer la tarde se fiscalizan.
// ============================================================

import { PARK_HOURS } from "./park";

const LAT = -33.408; // centro del parque
const LON = -70.636;
const TZ = "America/Santiago";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Minutos del día en Santiago para un instante dado (Intl, con DST). */
function minutosDelDiaEnSantiago(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

/** "19:43" desde un instante, en hora de Santiago. */
export function horaSantiago(d: Date): string {
  const min = minutosDelDiaEnSantiago(d);
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/**
 * Atardecer de hoy (instante Date absoluto) según la fórmula NOAA:
 * gamma fraccional del año + ecuación del tiempo + declinación +
 * ángulo horario para elevación -0.833° (refracción incluida).
 */
export function sunsetFor(now: Date): Date {
  const start = Date.UTC(now.getFullYear(), 0, 0);
  const doy =
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - start) / 86400000;
  const gamma = ((2 * Math.PI) / 365) * (doy - 1);
  // Ecuación del tiempo (minutos)
  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  // Declinación solar (radianes)
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  // Ángulo horario del atardecer (grados)
  const ha =
    Math.acos(
      Math.cos(90.833 * RAD) / (Math.cos(LAT * RAD) * Math.cos(decl)) -
        Math.tan(LAT * RAD) * Math.tan(decl),
    ) * DEG;
  const sunsetMinUTC = 720 - 4 * (LON - ha) - eqtime;
  // El mediodía solar del día en UTC: construimos el instante absoluto
  // de medianoche UTC del día y sumamos los minutos UTC del atardecer.
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) + sunsetMinUTC * 60000);
}

export type EstadoParque = {
  /** ¿Dentro del horario de ingreso (06:00-19:00)? */
  abierto: boolean;
  /** Aviso para el banner de ride (null: nada que avisar). */
  aviso: string | null;
  /** Nivel del aviso para la UI. */
  nivel: "info" | "luz" | "cierre";
};

/**
 * Estado del parque y aviso de luz para el momento `now`:
 *   - 45 min antes del atardecer: "lleva luces" (fiscalizan).
 *   - Después del atardecer: luces encendidas.
 *   - Fuera de horario (antes de 06:00 o desde las 19:00): cierre.
 *   - Desde las 13:30: restricción cumbre por Tupahue.
 */
export function estadoParque(now: Date = new Date()): EstadoParque {
  const min = minutosDelDiaEnSantiago(now);
  const sunsetMin = minutosDelDiaEnSantiago(sunsetFor(now));
  const paraAtardecer = sunsetMin - min;

  if (min < PARK_HOURS.abreMin || min >= PARK_HOURS.cierraMin) {
    return {
      abierto: false,
      aviso: `${PARK_HOURS.msgCierre} Las luces y el casco se fiscalizan.`,
      nivel: "cierre",
    };
  }
  if (paraAtardecer <= 0) {
    return {
      abierto: true,
      aviso: "Ya anochece: luces encendidas, fiscalización activa al caer la tarde.",
      nivel: "luz",
    };
  }
  if (paraAtardecer <= 45) {
    return {
      abierto: true,
      aviso: `Anochece a las ${horaSantiago(sunsetFor(now))} · lleva luces`,
      nivel: "luz",
    };
  }
  if (min >= PARK_HOURS.cumbreTupahueBloqueaMin) {
    return { abierto: true, aviso: PARK_HOURS.msgCumbreTupahue, nivel: "info" };
  }
  return { abierto: true, aviso: null, nivel: "info" };
}
