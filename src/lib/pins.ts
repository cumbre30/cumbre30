// ============================================================
// Catálogo compartido (cliente/servidor): pines de recompensa
// y desafíos en series con avance SECUENCIAL - cada nivel se
// activa al completar el anterior (no simultáneo).
// Diseñado para completarse en ~3 meses pedaleando regular.
// ============================================================

export type PinId =
  | "clasico" | "trebol" | "mate" | "corona" | "condor" | "diamante"
  | "cumbre" | "sol" | "trueno" | "fuego"
  | "escudo" | "mariposa" | "copihue"
  | "estrella" | "campana"
  | "luna" | "rayo" | "cohete"
  | "brote" | "dorsal" | "zorro" | "bosque"
  | "medalla" | "picnic" | "zen"
  | "credencial"
  | "reloj" | "amanecer" | "atardecer" | "cronista";

export type PinDef = {
  id: PinId;
  name: string;
  emoji: string;
  color: string;
  desc: string;
};

export const PINS: Record<PinId, PinDef> = {
  clasico: { id: "clasico", name: "Clásico", emoji: "📍", color: "#a3e635", desc: "Pin inicial de todo ciclista Cumbre30." },
  // Serie Kilómetros
  trebol: { id: "trebol", name: "Trébol", emoji: "🍀", color: "#4ade80", desc: "Serie Kilómetros · 10 km acumulados." },
  mate: { id: "mate", name: "Mate ciclista", emoji: "🧉", color: "#84cc16", desc: "Serie Kilómetros · 50 km acumulados." },
  corona: { id: "corona", name: "Corona", emoji: "👑", color: "#fbbf24", desc: "Serie Kilómetros · 100 km acumulados." },
  condor: { id: "condor", name: "Cóndor", emoji: "🦅", color: "#38bdf8", desc: "Serie Kilómetros · 250 km acumulados." },
  diamante: { id: "diamante", name: "Diamante", emoji: "💎", color: "#22d3ee", desc: "Serie Kilómetros · 500 km acumulados." },
  // Serie Cumbre
  cumbre: { id: "cumbre", name: "Cumbre", emoji: "🏔️", color: "#38bdf8", desc: "Serie Cumbre · 300 m de desnivel acumulado." },
  sol: { id: "sol", name: "Sol de Antilén", emoji: "☀️", color: "#facc15", desc: "Serie Cumbre · 1.500 m de desnivel acumulado." },
  trueno: { id: "trueno", name: "Trueno", emoji: "🌩️", color: "#818cf8", desc: "Serie Cumbre · 4.000 m de desnivel acumulado." },
  fuego: { id: "fuego", name: "Llama eterna", emoji: "🔥", color: "#f97316", desc: "Serie Cumbre · 8.000 m de desnivel acumulado." },
  // Serie Parque
  escudo: { id: "escudo", name: "Escudo 30", emoji: "🛡️", color: "#10b981", desc: "Serie Parque · un ride de 2+ km en el parque sin exceso." },
  mariposa: { id: "mariposa", name: "Mariposa", emoji: "🦋", color: "#f472b6", desc: "Serie Parque · 10 rides dentro del parque." },
  copihue: { id: "copihue", name: "Copihue", emoji: "🌺", color: "#fb7185", desc: "Serie Parque · 30 rides dentro del parque." },
  // Serie Vigía
  estrella: { id: "estrella", name: "Estrella", emoji: "⭐", color: "#fbbf24", desc: "Serie Vigía · tu primer reporte de incidencia." },
  campana: { id: "campana", name: "Campana", emoji: "🔔", color: "#f59e0b", desc: "Serie Vigía · 10 reportes de incidencias." },
  // Serie Constancia
  brote: { id: "brote", name: "Brote", emoji: "🌱", color: "#4ade80", desc: "Serie Constancia · tu primer ride con GPS real." },
  dorsal: { id: "dorsal", name: "Dorsal", emoji: "🎽", color: "#60a5fa", desc: "Serie Constancia · 10 rides completados." },
  zorro: { id: "zorro", name: "Zorro culpeo", emoji: "🦊", color: "#fb923c", desc: "Serie Constancia · 25 rides completados." },
  bosque: { id: "bosque", name: "Bosque nativo", emoji: "🌳", color: "#16a34a", desc: "Serie Constancia · 50 rides completados." },
  // Retos puntuales
  luna: { id: "luna", name: "Nocturno", emoji: "🌙", color: "#818cf8", desc: "Reto: completa un ride entre las 21:00 y las 06:00." },
  rayo: { id: "rayo", name: "Velocista", emoji: "⚡", color: "#facc15", desc: "Reto: registra 42 km/h (hazlo fuera del parque)." },
  cohete: { id: "cohete", name: "Madrugador", emoji: "🚀", color: "#e879f9", desc: "Reto: termina un ride antes de las 08:00 de la mañana." },
  medalla: { id: "medalla", name: "Medalla", emoji: "🏅", color: "#fbbf24", desc: "Reto: un solo ride de 21 km o más (media maratón)." },
  credencial: { id: "credencial", name: "Pedalea Seguro", emoji: "🪪", color: "#34d399", desc: "Reto: carga tu QR Pedalea Seguro de Parquemet en la pestaña Credencial." },
  picnic: { id: "picnic", name: "Picnic", emoji: "🧺", color: "#d6d3d1", desc: "Reto: 8 rides en sábado o domingo." },
  zen: { id: "zen", name: "Zen", emoji: "🧘", color: "#2dd4bf", desc: "Reto: 5 rides dentro del parque sin exceder los 30 km/h." },
  // Serie Horas
  reloj: { id: "reloj", name: "Reloj de arena", emoji: "⏳", color: "#a78bfa", desc: "Serie Horas · 10 horas pedaleando." },
  amanecer: { id: "amanecer", name: "Amanecer", emoji: "🌅", color: "#f472b6", desc: "Serie Horas · 25 horas pedaleando." },
  atardecer: { id: "atardecer", name: "Atardecer", emoji: "🌇", color: "#fb923c", desc: "Serie Horas · 50 horas pedaleando." },
  cronista: { id: "cronista", name: "Cronista", emoji: "🕰️", color: "#c4b5fd", desc: "Serie Horas · 100 horas pedaleando." },
};

export const DEFAULT_PIN: PinId = "clasico";

export function isPinId(v: string): v is PinId {
  return Object.prototype.hasOwnProperty.call(PINS, v);
}

// ---- Métricas evaluables + niveles del ciclista ----

export type MetricKey =
  | "totalKm"
  | "rideCount"
  | "totalGainM"
  | "parkRides"
  | "cleanParkRides"
  | "credencialLista"
  | "incidentCount"
  | "nightRides"
  | "dawnRides"
  | "maxKmh"
  | "maxRideKm"
  | "weekendRides"
  | "totalHours";

// ---- Niveles del ciclista (km acumulados con GPS real) ----

export type RiderLevel = { name: string; emoji: string; min: number; max: number | null };

/**
 * Umbrales pensados para la escala del cerro: una vuelta al San
 * Cristóbal ida y vuelta son ≈ 10 km, así que el nivel 2 llega con
 * ≈ 5 vueltas, el 3 con ≈ 15 y Desafiante arranca en 500 km -
 * coincidiendo con el tier Diamante (500 km) de la Serie Kilómetros.
 * Sobre los 500 km el título es 🌟 Leyenda, exclusivo de la tarjeta
 * "Tu progreso" (no aparece en la grilla de niveles).
 */
export const RIDER_LEVELS: RiderLevel[] = [
  { name: "Explorador", emoji: "🧭", min: 0, max: 50 },
  { name: "Ciclista", emoji: "🚴", min: 50, max: 150 },
  { name: "Montañero", emoji: "⛰️", min: 150, max: 500 },
  { name: "Desafiante", emoji: "🏔️", min: 500, max: null },
];

/** Km a partir de los cuales el título es 🌟 Leyenda (exclusivo del progreso). */
export const LEYENDA_KM = 500;

export type RiderLevelInfo = {
  /** Índice del nivel actual (0-based). */
  index: number;
  level: RiderLevel;
  next: RiderLevel | null;
  /** % de avance dentro del nivel actual (0-100). */
  pct: number;
  /** km que faltan al siguiente nivel (0 si ya estás en el máximo). */
  toNext: number;
};

export function riderLevelForKm(km: number): RiderLevelInfo {
  let index = 0;
  for (let i = 0; i < RIDER_LEVELS.length; i++) if (km >= RIDER_LEVELS[i].min) index = i;
  const level = RIDER_LEVELS[index];
  const next = RIDER_LEVELS[index + 1] ?? null;
  const pct = level.max == null ? 100 : ((km - level.min) / (level.max - level.min)) * 100;
  const toNext = next ? Math.max(0, next.min - km) : 0;
  return { index, level, next, pct, toNext };
}

// ---- Series de desafíos (avance secuencial por nivel) ----

export type Tier = {
  code: string;
  name: string;
  desc: string;
  metric: MetricKey;
  goal: number;
  reward: PinId;
  /** Desafíos Pro: solo el PRIMER desafío de cada serie es gratis;
   *  los siguientes (y sus pines) requieren Cumbre30 Pro. */
  pro?: boolean;
};

/** ¿Este desafío requiere Cumbre30 Pro? */
export function tierIsPro(t: Tier): boolean {
  return t.pro === true;
}

/** ¿El pin como recompensa requiere Pro? (el pin inicial nunca) */
export function pinIsPro(pinId: PinId): boolean {
  if (pinId === DEFAULT_PIN) return false;
  return ALL_TIERS.some((t) => t.reward === pinId && t.pro);
}

export type Series = {
  id: string;
  name: string;
  emoji: string;
  accent: string; // clases tailwind del acento
  tiers: Tier[]; // orden estricto: el nivel N solo cuenta tras completar el N-1
};

const kmFmt = (n: number) => (n >= 1000 ? `${n.toLocaleString("es-CL")} km` : `${n} km`);
const mFmt = (n: number) => `${n.toLocaleString("es-CL")} m`;
const hFmt = (n: number) => `${n} h`;

export const SERIES: Series[] = [
  {
    id: "kilometros",
    name: "Serie Kilómetros",
    emoji: "🚴",
    accent: "emerald",
    tiers: [
      { code: "km_10", name: "Diez al pie", desc: `Acumula ${kmFmt(10)} pedaleando.`, metric: "totalKm", goal: 10, reward: "trebol" },
      { code: "km_50", name: "Medio centenario", desc: `Acumula ${kmFmt(50)} entre todos tus rides.`, metric: "totalKm", goal: 50, reward: "mate", pro: true },
      { code: "km_100", name: "Cien en el cerro", desc: `Acumula ${kmFmt(100)}. La corona te espera.`, metric: "totalKm", goal: 100, reward: "corona", pro: true },
      { code: "km_250", name: "Gran turista", desc: `Acumula ${kmFmt(250)}. Vuelo de cóndor.`, metric: "totalKm", goal: 250, reward: "condor", pro: true },
      { code: "km_500", name: "Quinientos", desc: `Acumula ${kmFmt(500)}. Un diamante puro.`, metric: "totalKm", goal: 500, reward: "diamante", pro: true },
    ],
  },
  {
    id: "cumbre",
    name: "Serie Cumbre",
    emoji: "⛰️",
    accent: "sky",
    tiers: [
      { code: "gain_300", name: "Primer ascenso", desc: `Suma ${mFmt(300)} de desnivel positivo (≈ 1 subida a la cumbre).`, metric: "totalGainM", goal: 300, reward: "cumbre" },
      { code: "gain_1500", name: "Piernas de acero", desc: `Suma ${mFmt(1500)} de desnivel acumulado (≈ 6 subidas).`, metric: "totalGainM", goal: 1500, reward: "sol", pro: true },
      { code: "gain_4000", name: "Tormenta acumulada", desc: `Suma ${mFmt(4000)} de desnivel acumulado (≈ 17 subidas).`, metric: "totalGainM", goal: 4000, reward: "trueno", pro: true },
      { code: "gain_8000", name: "Ocho mil del cerro", desc: `Suma ${mFmt(8000)} (≈ 35 subidas). Fuego sagrado.`, metric: "totalGainM", goal: 8000, reward: "fuego", pro: true },
    ],
  },
  {
    id: "parque",
    name: "Serie Parque",
    emoji: "🛡️",
    accent: "teal",
    tiers: [
      { code: "park_clean_1", name: "Ride limpio", desc: "Un ride de 2+ km dentro del parque sin exceder 30 km/h.", metric: "cleanParkRides", goal: 1, reward: "escudo" },
      { code: "park_10", name: "Habitué del parque", desc: "Completa 10 rides entrando al parque.", metric: "parkRides", goal: 10, reward: "mariposa", pro: true },
      { code: "park_30", name: "Copihue de oro", desc: "Completa 30 rides entrando al parque. Respeto total al límite.", metric: "parkRides", goal: 30, reward: "copihue", pro: true },
    ],
  },
  {
    id: "vigia",
    name: "Serie Vigía",
    emoji: "📢",
    accent: "amber",
    tiers: [
      { code: "rep_1", name: "Ojos del cerro", desc: "Reporta tu primera incidencia en el mapa.", metric: "incidentCount", goal: 1, reward: "estrella" },
      { code: "rep_10", name: "Centinela", desc: "Reporta 10 incidencias. Los ojos de toda la comunidad.", metric: "incidentCount", goal: 10, reward: "campana", pro: true },
    ],
  },
  {
    id: "constancia",
    name: "Serie Constancia",
    emoji: "🔁",
    accent: "emerald",
    tiers: [
      { code: "const_1", name: "Primer pedal", desc: "Completa tu primer ride con GPS real. Toda cumbre empieza así.", metric: "rideCount", goal: 1, reward: "brote" },
      { code: "const_10", name: "Ya es rutina", desc: "Completa 10 rides registrados con GPS.", metric: "rideCount", goal: 10, reward: "dorsal", pro: true },
      { code: "const_25", name: "Rueda fiel", desc: "Completa 25 rides. El cerro ya te conoce.", metric: "rideCount", goal: 25, reward: "zorro", pro: true },
      { code: "const_50", name: "Cincuenta vueltas", desc: "Completa 50 rides. Hábito de hierro.", metric: "rideCount", goal: 50, reward: "bosque", pro: true },
    ],
  },
  {
    id: "horas",
    name: "Serie Horas",
    emoji: "⏱️",
    accent: "violet",
    tiers: [
      { code: "hrs_10", name: "Primeras horas", desc: `Acumula ${hFmt(10)} pedaleando (≈ 12 vueltas al cerro).`, metric: "totalHours", goal: 10, reward: "reloj" },
      { code: "hrs_25", name: "Tiempo al aire", desc: `Acumula ${hFmt(25)} pedaleando.`, metric: "totalHours", goal: 25, reward: "amanecer", pro: true },
      { code: "hrs_50", name: "Media jornada", desc: `Acumula ${hFmt(50)} pedaleando. Un día entero en dos ruedas.`, metric: "totalHours", goal: 50, reward: "atardecer", pro: true },
      { code: "hrs_100", name: "Cien horas", desc: `Acumula ${hFmt(100)} pedaleando. Crónica del cerro.`, metric: "totalHours", goal: 100, reward: "cronista", pro: true },
    ],
  },
];

/** Retos puntuales: independientes, sin cadena previa. Igual regla
 *  Free/Pro que las series: el primero es gratis, el resto Pro. */
export const RETOS: Tier[] = [
  { code: "night_1", name: "Ciclista nocturno", desc: "Completa un ride entre las 21:00 y las 06:00.", metric: "nightRides", goal: 1, reward: "luna" },
  { code: "speed_42", name: "Velocista", desc: "Registra 42 km/h en un tramo libre (siempre fuera del parque).", metric: "maxKmh", goal: 42, reward: "rayo", pro: true },
  { code: "dawn_1", name: "Madrugador", desc: "Termina un ride antes de las 08:00 de la mañana.", metric: "dawnRides", goal: 1, reward: "cohete", pro: true },
  { code: "dist_21", name: "Media maratón", desc: "Completa un solo ride de 21 km o más. Tu mejor vuelta.", metric: "maxRideKm", goal: 21, reward: "medalla", pro: true },
  { code: "finde_8", name: "Guerrero del finde", desc: "Completa 8 rides en sábado o domingo.", metric: "weekendRides", goal: 8, reward: "picnic", pro: true },
  { code: "clean_5", name: "Cinco limpios", desc: "Suma 5 rides dentro del parque sin exceder los 30 km/h.", metric: "cleanParkRides", goal: 5, reward: "zen", pro: true },
  { code: "pedalea_seguro_qr", name: "Pedalea Seguro listo", desc: "Carga tu QR Pedalea Seguro de Parquemet en la pestaña Credencial. Obligatorio desde el 15 de diciembre para senderos de tierra.", metric: "credencialLista", goal: 1, reward: "credencial" },
];

export const ALL_TIERS: Tier[] = [...SERIES.flatMap((s) => s.tiers), ...RETOS];

export const ACHIEVEMENT_BY_CODE: Record<string, Tier> = Object.fromEntries(ALL_TIERS.map((t) => [t.code, t]));

/** Serie a la que pertenece un código (null = reto puntual). */
export function seriesOfCode(code: string): Series | null {
  for (const s of SERIES) if (s.tiers.some((t) => t.code === code)) return s;
  return null;
}

// ---- Compatibilidad con códigos antiguos (v1) ----

const LEGACY_MAP: Record<string, string> = {
  trebol_25: "km_10",
  corona_100: "km_100",
  cumbre: "gain_300",
  ride_limpio: "park_clean_1",
  nocturno: "night_1",
  velocista: "speed_42",
  reportero: "rep_1",
  primer_pedaleo: "km_10",
};

/** Traduce códigos v1 a sus equivalentes actuales. */
export function normalizeCodes(codes: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const c of codes) {
    if (ACHIEVEMENT_BY_CODE[c]) out.add(c);
    else if (LEGACY_MAP[c]) out.add(LEGACY_MAP[c]);
  }
  return out;
}

// ---- Estadísticas para evaluar ----

export type AchievementStats = {
  totalKm: number;
  rideCount: number;
  maxKmh: number;
  totalGainM: number;
  /** Rides que tocaron el parque. */
  parkRides: number;
  /** Rides en parque de 2+ km y 0 s de exceso. */
  cleanParkRides: number;
  nightRides: number;
  dawnRides: number;
  /** Mayor distancia en un solo ride (km). */
  maxRideKm: number;
  /** Rides de sábado o domingo (hora local aprox. UTC-3). */
  weekendRides: number;
  /** Horas totales pedaleadas (suma de elapsedSec / 3600). */
  totalHours: number;
  incidentCount: number;
};

export function metricValue(s: AchievementStats, m: MetricKey): number {
  // Credencial Pedalea Seguro: no es una métrica de rides, es el QR
  // cargado en la pestaña Credencial (localStorage del dispositivo,
  // nunca viaja al servidor). En el servidor vale 0 y no resta:
  // evaluateAchievements solo agrega códigos, nunca quita.
  if (m === "credencialLista") {
    if (typeof window === "undefined") return 0;
    try {
      return localStorage.getItem("cumbre30-entry-qr-v1") ? 1 : 0;
    } catch {
      return 0;
    }
  }
  return s[m];
}

export function statsFromRides(
  rides: Array<{
    distanceKm: number;
    maxKmh: number;
    maxInParkKmh: number | null;
    /** Km dentro de la geocerca del parque (null/undefined en rides
     *  antiguos: para esos se usa la regla anterior, total del ride). */
    inParkKm?: number | null;
    gainM: number;
    overLimitSec: number;
    elapsedSec?: number;
    dateISO: string | Date;
    /** Rides confirmados en vehículo motorizado NO cuentan: ni km,
     *  ni horas, ni velocidad (un auto no da el reto Velocista). */
    motorized?: boolean;
  }>,
  incidentCount = 0
): AchievementStats {
  let rideCount = 0;
  let totalKm = 0;
  let maxKmh = 0;
  let maxRideKm = 0;
  let totalGainM = 0;
  let totalHours = 0;
  let parkRides = 0;
  let cleanParkRides = 0;
  let nightRides = 0;
  let dawnRides = 0;
  let weekendRides = 0;
  for (const r of rides) {
    // Viaje en vehículo motorizado (confirmado al guardar): no aporta a
    // ninguna métrica de desafíos ni de estadísticas del ciclista.
    if (r.motorized) continue;
    rideCount++;
    totalKm += r.distanceKm ?? 0;
    maxKmh = Math.max(maxKmh, r.maxKmh ?? 0);
    maxRideKm = Math.max(maxRideKm, r.distanceKm ?? 0);
    totalGainM += Math.max(0, r.gainM ?? 0);
    totalHours += (r.elapsedSec ?? 0) / 3600;
    // Desafíos del parque: SOLO cuenta lo pedaleado dentro de la geocerca.
    // Rides nuevos (inParkKm medido): entró si recorrió ≥ 500 m dentro y el
    // ride es "limpio" con ≥ 2 km dentro sin exceso. Rides antiguos (sin
    // medición) conservan la regla anterior para no borrar logros ya dados.
    const parkKm = r.inParkKm ?? null;
    const enteredPark = parkKm != null ? parkKm >= 0.5 : r.maxInParkKmh != null;
    if (enteredPark) {
      parkRides++;
      const enoughKm = parkKm != null ? parkKm >= 2 : (r.distanceKm ?? 0) >= 2;
      if ((r.overLimitSec ?? 0) === 0 && enoughKm) cleanParkRides++;
    }
    const d = new Date(r.dateISO);
    // Hora local de Chile (aprox. UTC-3)
    const clHour = (d.getUTCHours() + 21) % 24;
    if (clHour >= 21 || clHour < 6) nightRides++;
    if (clHour < 8) dawnRides++;
    const clDay = new Date(d.getTime() - 3 * 3600_000).getUTCDay(); // 0 dom, 6 sáb
    if (clDay === 0 || clDay === 6) weekendRides++;
  }
  return { totalKm, rideCount, maxKmh, totalGainM, parkRides, cleanParkRides, nightRides, dawnRides, maxRideKm, weekendRides, totalHours, incidentCount };
}

/**
 * Evalúa logros con avance SECUENCIAL: dentro de cada serie, un nivel
 * solo se desbloquea si el anterior ya está completo (o se completa en
 * esta misma evaluación). Los retos puntuales son independientes.
 *
 * Free/Pro: con `{ pro: false }` los desafíos marcados `pro: true` no
 * se desbloquean (y cortan la cadena de su serie); el progreso métrico
 * se acumula igual y se desbloquean en cadena al activar Pro. Sin
 * opciones todo es desbloqueable (compatibilidad).
 */
export function evaluateAchievements(
  s: AchievementStats,
  unlocked: Iterable<string> = [],
  opts?: { pro?: boolean },
): string[] {
  const allowPro = opts?.pro !== false;
  const have = normalizeCodes(unlocked);
  const out = new Set<string>(have);
  for (const series of SERIES) {
    for (let i = 0; i < series.tiers.length; i++) {
      const t = series.tiers[i];
      if (out.has(t.code)) continue;
      if (!allowPro && t.pro) break; // requiere Pro: corta la cadena de la serie
      if (i > 0 && !out.has(series.tiers[i - 1].code)) break; // nivel previo pendiente
      if (metricValue(s, t.metric) >= t.goal) out.add(t.code);
      else break;
    }
  }
  for (const t of RETOS) {
    if (out.has(t.code)) continue;
    if (!allowPro && t.pro) continue; // requiere Pro: se salta sin cortar a los free
    if (metricValue(s, t.metric) >= t.goal) out.add(t.code);
  }
  return [...out];
}

// ---- Desafíos con fecha: diarios, semanales y mensuales ----
// Series GRATIS sin recompensas (ni pines ni logros guardados): se
// evalúan en el cliente contra la ventana vigente y se reinician
// solas al cambiar el día, la semana o el mes.

export type TimeScope = "dia" | "semana" | "mes";

export type TimeChallenge = {
  id: string;
  scope: TimeScope;
  name: string;
  desc: string;
  metric: "rides" | "km" | "gainM";
  goal: number;
};

export type TimeSeries = {
  id: TimeScope;
  name: string;
  emoji: string;
  accent: string;
  /** Etiqueta del periodo que se reinicia (para la UI). */
  resetLabel: string;
  challenges: TimeChallenge[];
};

export const TIME_SERIES: TimeSeries[] = [
  {
    id: "dia",
    name: "Desafíos diarios",
    emoji: "☀️",
    accent: "amber",
    resetLabel: "se reinician cada día",
    challenges: [
      { id: "d_ride_1", scope: "dia", name: "Rueda del día", desc: "Completa 1 ride hoy.", metric: "rides", goal: 1 },
      { id: "d_km_5", scope: "dia", name: "Cinco al día", desc: "Pedalea 5 km hoy.", metric: "km", goal: 5 },
    ],
  },
  {
    id: "semana",
    name: "Desafíos semanales",
    emoji: "📅",
    accent: "sky",
    resetLabel: "se reinician cada lunes",
    challenges: [
      { id: "w_ride_3", scope: "semana", name: "Ritmo semanal", desc: "Completa 3 rides esta semana.", metric: "rides", goal: 3 },
      { id: "w_km_25", scope: "semana", name: "25 km de la semana", desc: "Pedalea 25 km entre lunes y domingo.", metric: "km", goal: 25 },
      { id: "w_gain_300", scope: "semana", name: "Cuesta de la semana", desc: "Suma 300 m de desnivel esta semana.", metric: "gainM", goal: 300 },
    ],
  },
  {
    id: "mes",
    name: "Desafíos mensuales",
    emoji: "🗓️",
    accent: "violet",
    resetLabel: "se reinician cada mes",
    challenges: [
      { id: "m_ride_10", scope: "mes", name: "Diez vueltas al mes", desc: "Completa 10 rides este mes.", metric: "rides", goal: 10 },
      { id: "m_km_100", scope: "mes", name: "Cien del mes", desc: "Pedalea 100 km este mes.", metric: "km", goal: 100 },
      { id: "m_gain_1500", scope: "mes", name: "Piso del mes", desc: "Suma 1.500 m de desnivel este mes.", metric: "gainM", goal: 1500 },
    ],
  },
];

/** Métricas de una ventana de tiempo (día / semana / mes en curso). */
export type ScopeStats = { rides: number; km: number; gainM: number };

/** Inicio del día en curso (hora local del dispositivo). */
function startOfToday(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Inicio de la semana: lunes 00:00 local (la semana chilena parte el lunes). */
export function startOfWeek(now: Date): Date {
  const d = startOfToday(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Inicio del mes en curso (día 1, 00:00 local). */
export function startOfMonth(now: Date): Date {
  const d = startOfToday(now);
  d.setDate(1);
  return d;
}

/**
 * Suma rides/km/desnivel por ventana: día, semana y mes en curso
 * (hora local del dispositivo). Los rides en vehículo motorizado no
 * cuentan - misma regla que el resto de los desafíos.
 */
export function windowStatsFromRides(
  rides: Array<{
    dateISO: string | Date;
    distanceKm: number;
    gainM: number;
    motorized?: boolean;
  }>,
  now: Date = new Date(),
): Record<TimeScope, ScopeStats> {
  const d0 = startOfToday(now);
  const w0 = startOfWeek(now);
  const m0 = startOfMonth(now);
  const out: Record<TimeScope, ScopeStats> = {
    dia: { rides: 0, km: 0, gainM: 0 },
    semana: { rides: 0, km: 0, gainM: 0 },
    mes: { rides: 0, km: 0, gainM: 0 },
  };
  for (const r of rides) {
    if (r.motorized) continue;
    const t = new Date(r.dateISO).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= m0.getTime()) {
      out.mes.rides++;
      out.mes.km += r.distanceKm ?? 0;
      out.mes.gainM += Math.max(0, r.gainM ?? 0);
    }
    if (t >= w0.getTime()) {
      out.semana.rides++;
      out.semana.km += r.distanceKm ?? 0;
      out.semana.gainM += Math.max(0, r.gainM ?? 0);
    }
    if (t >= d0.getTime()) {
      out.dia.rides++;
      out.dia.km += r.distanceKm ?? 0;
      out.dia.gainM += Math.max(0, r.gainM ?? 0);
    }
  }
  return out;
}

/** Valor, % y estado de un desafío con fecha contra las métricas vigentes. */
export function timeChallengeProgress(
  c: TimeChallenge,
  ws: Record<TimeScope, ScopeStats>,
): { value: number; pct: number; done: boolean } {
  const raw = ws[c.scope];
  const value = c.metric === "rides" ? raw.rides : c.metric === "km" ? raw.km : raw.gainM;
  const pct = Math.min(100, Math.round((value / c.goal) * 100));
  return { value, pct, done: value >= c.goal };
}
