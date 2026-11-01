// ============================================================
// Catálogo compartido (cliente/servidor): pines de recompensa
// y definición de desafíos/logros.
// ============================================================

export type PinId =
  | "clasico"
  | "cumbre"
  | "escudo"
  | "luna"
  | "rayo"
  | "estrella"
  | "trebol"
  | "corona";

export type PinDef = {
  id: PinId;
  name: string;
  emoji: string;
  color: string;
  desc: string;
};

export const PINS: Record<PinId, PinDef> = {
  clasico: { id: "clasico", name: "Clásico", emoji: "📍", color: "#a3e635", desc: "Pin inicial de todo ciclista Cumbre30." },
  cumbre: { id: "cumbre", name: "Cumbre", emoji: "🏔️", color: "#38bdf8", desc: "Por subir más de 150 m de desnivel en un ride." },
  escudo: { id: "escudo", name: "Escudo 30", emoji: "🛡️", color: "#10b981", desc: "Ride dentro del parque sin ningún exceso de velocidad." },
  luna: { id: "luna", name: "Nocturno", emoji: "🌙", color: "#818cf8", desc: "Pedalea entre las 21:00 y las 06:00." },
  rayo: { id: "rayo", name: "Velocista", emoji: "⚡", color: "#facc15", desc: "Registra más de 40 km/h (fuera del parque)." },
  estrella: { id: "estrella", name: "Reportero", emoji: "⭐", color: "#f472b6", desc: "Reporta tu primera incidencia en el mapa." },
  trebol: { id: "trebol", name: "Trébol 25", emoji: "🍀", color: "#4ade80", desc: "Acumula 25 km recorridos." },
  corona: { id: "corona", name: "Corona 100", emoji: "👑", color: "#fbbf24", desc: "Acumula 100 km recorridos." },
};

export const DEFAULT_PIN: PinId = "clasico";

export function isPinId(v: string): v is PinId {
  return Object.prototype.hasOwnProperty.call(PINS, v);
}

// ---- Desafíos / logros ----

export type AchievementCode =
  | "primer_pedaleo"
  | "trebol_25"
  | "corona_100"
  | "cumbre"
  | "ride_limpio"
  | "nocturno"
  | "velocista"
  | "reportero";

export type AchievementDef = {
  code: AchievementCode;
  name: string;
  desc: string;
  reward: PinId;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: "primer_pedaleo", name: "Primer pedaleo", desc: "Completa tu primer ride con Cumbre30.", reward: "cumbre" },
  { code: "trebol_25", name: "25 km acumulados", desc: "Suma 25 km entre todos tus rides.", reward: "trebol" },
  { code: "corona_100", name: "100 km acumulados", desc: "Suma 100 km entre todos tus rides.", reward: "corona" },
  { code: "cumbre", name: "Conquistador de la cumbre", desc: "Acumula 150 m de desnivel positivo en un solo ride.", reward: "cumbre" },
  { code: "ride_limpio", name: "Ride limpio", desc: "Ride de 2+ km dentro del parque sin exceder 30 km/h.", reward: "escudo" },
  { code: "nocturno", name: "Ciclista nocturno", desc: "Completa un ride entre las 21:00 y las 06:00.", reward: "luna" },
  { code: "velocista", name: "Velocista", desc: "Supera los 40 km/h en un tramo libre (fuera del parque).", reward: "rayo" },
  { code: "reportero", name: "Ojos del cerro", desc: "Reporta tu primera incidencia en el mapa.", reward: "estrella" },
];

export const ACHIEVEMENT_BY_CODE: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.code, a])
);

/** Estadísticas agregadas para evaluar logros (cliente o servidor). */
export type AchievementStats = {
  totalKm: number;
  rideCount: number;
  maxKmh: number;
  maxGainM: number;
  maxInParkKmh: number | null;
  minOverLimitSec: number | null; // mínimo de exceso entre rides con paso por parque
  hasNightRide: boolean;
  incidentCount: number;
};

export function statsFromRides(
  rides: Array<{
    distanceKm: number;
    maxKmh: number;
    maxInParkKmh: number | null;
    gainM: number;
    overLimitSec: number;
    dateISO: string | Date;
  }>,
  incidentCount = 0
): AchievementStats {
  let totalKm = 0;
  let maxKmh = 0;
  let maxGainM = 0;
  let maxInParkKmh: number | null = null;
  let minOverLimitSec: number | null = null;
  let hasNightRide = false;
  for (const r of rides) {
    totalKm += r.distanceKm ?? 0;
    maxKmh = Math.max(maxKmh, r.maxKmh ?? 0);
    maxGainM = Math.max(maxGainM, r.gainM ?? 0);
    if (r.maxInParkKmh != null) {
      maxInParkKmh = Math.max(maxInParkKmh ?? 0, r.maxInParkKmh);
      minOverLimitSec = minOverLimitSec === null ? r.overLimitSec : Math.min(minOverLimitSec, r.overLimitSec);
    }
    const d = new Date(r.dateISO);
    // Hora local de Chile aproximada (UTC-3 / UTC-4 según época); usa UTC-4 como base conservadora
    const clHour = (d.getUTCHours() + 21) % 24; // restamos 3h (CLT)
    if (clHour >= 21 || clHour < 6) hasNightRide = true;
  }
  return { totalKm, rideCount: rides.length, maxKmh, maxGainM, maxInParkKmh, minOverLimitSec, hasNightRide, incidentCount };
}

/** Evalúa qué logros se cumplen con las estadísticas dadas. */
export function evaluateAchievements(s: AchievementStats): AchievementCode[] {
  const out: AchievementCode[] = [];
  if (s.rideCount >= 1) out.push("primer_pedaleo");
  if (s.totalKm >= 25) out.push("trebol_25");
  if (s.totalKm >= 100) out.push("corona_100");
  if (s.maxGainM >= 150) out.push("cumbre");
  if (s.maxInParkKmh !== null && s.minOverLimitSec === 0 && s.totalKm >= 2) out.push("ride_limpio");
  if (s.hasNightRide) out.push("nocturno");
  if (s.maxKmh >= 40) out.push("velocista");
  if (s.incidentCount >= 1) out.push("reportero");
  return out;
}
