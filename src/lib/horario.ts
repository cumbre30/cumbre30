// ============================================================
// Horario del parque y avisos de luz (cálculo 100% offline).
// El atardecer se calcula con la fórmula NOAA (general solar
// calculations, la misma de su hoja de cálculo): para Santiago
// el error es < 1-2 minutos, suficiente para avisar de llevar
// luces. Sin API ni conexión. La hora local SIEMPRE se resuelve
// en la zona America/Santiago (independiente del reloj del
// teléfono), con su DST real: UTC-3 en verano, UTC-4 en invierno.
// Reglas del parque (Parquemet, actualización nov 2026):
//   - Ingreso de ciclistas 06:00 a 20:30, todos los días.
//   - Cumbre por el sector Tupahue: restringida desde las 13:30
//     SOLO fines de semana y festivos.
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

// -------------------------------------------------------------
// Festivos de Chile (cálculo offline, sin tabla por año).
//   Fijos: Año Nuevo, Día del Trabajo, Glorias Navales, San Pedro
//   y San Pablo, Virgen del Carmen, Asunción, 18 y 19 de
//   septiembre, Inmaculada Concepción, Navidad.
//   Móviles regla fija: Viernes Santo y Sábado Santo (computus de
//   Meeus/Jones/Butcher) y Día de las Iglesias Evangélicas y
//   Protestantes (primer lunes de noviembre, ley 20.014).
// TODO se evalúa en la zona America/Santiago, nunca en la del
// teléfono: el día de la semana y la fecha siguen al parque.
// -------------------------------------------------------------

const FESTIVOS_FIJOS = new Set([
  "01-01", // Año Nuevo
  "05-01", // Día Nacional del Trabajo
  "05-21", // Glorias Navales
  "06-29", // San Pedro y San Pablo
  "07-16", // Virgen del Carmen
  "08-15", // Asunción de la Virgen
  "09-18", // Primera Junta (Fiestas Patrias)
  "09-19", // Glorias del Ejército
  "12-08", // Inmaculada Concepción
  "12-25", // Navidad
]);

/** Domingo de Pascua (mes/día) por el algoritmo de Meeus/Jones/Butcher. */
function pascuaDomingo(year: number): { mes: number; dia: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { mes, dia };
}

/** Fecha y día de la semana de un instante, resueltas en Santiago. */
function fechaEnSantiago(d: Date): { year: number; mes: number; dia: number; dow: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(get("year")),
    mes: Number(get("month")),
    dia: Number(get("day")),
    dow: dowMap[get("weekday")] ?? 0,
  };
}

/** ¿Sábado, domingo o festivo en Chile? (para la restricción de
 *  cumbre por Tupahue, que rige fines de semana y festivos). */
export function esFinDeSemanaOFestivo(d: Date = new Date()): boolean {
  const { year, mes, dia, dow } = fechaEnSantiago(d);
  if (dow === 0 || dow === 6) return true; // domingo o sábado
  const mmdd = `${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  if (FESTIVOS_FIJOS.has(mmdd)) return true;
  // Semana Santa: Viernes Santo (-2) y Sábado Santo (-1) antes de Pascua.
  const p = pascuaDomingo(year);
  const ord = Math.floor(Date.UTC(year, mes - 1, dia) / 86400000);
  const ordPascua = Math.floor(Date.UTC(year, p.mes - 1, p.dia) / 86400000);
  if (ord === ordPascua - 1 || ord === ordPascua - 2) return true;
  // Iglesias Evangélicas y Protestantes: primer lunes de noviembre.
  if (mes === 11 && dow === 1 && dia <= 7) return true;
  return false;
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
  /** ¿Dentro del horario de ingreso (06:00-20:30)? */
  abierto: boolean;
  /** Aviso para el banner de ride (null: nada que avisar). */
  aviso: string | null;
  /** Nivel del aviso para la UI. */
  nivel: "info" | "luz" | "cierre" | "tupa";
};

/**
 * Estado del parque y aviso de luz para el momento `now`:
 *   - 45 min antes del atardecer: "lleva luces" (fiscalizan).
 *   - Después del atardecer: luces encendidas.
 *   - Fuera de horario (antes de 06:00 o desde las 20:30): cierre.
 *   - Desde las 13:30 SI es fin de semana o festivo: restricción
 *     cumbre por Tupahue (entre semana no aplica).
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
  // Restricción cumbre por Tupahue: SOLO fines de semana y festivos.
  if (min >= PARK_HOURS.cumbreTupahueBloqueaMin && esFinDeSemanaOFestivo(now)) {
    return { abierto: true, aviso: PARK_HOURS.msgCumbreTupahue, nivel: "tupa" };
  }
  return { abierto: true, aviso: null, nivel: "info" };
}
