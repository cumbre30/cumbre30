/**
 * rideWeights — pesos del conjunto ciclista + bici (fase 2 del Perfil
 * Ciclista, v1.13.17). Alimentan la estimación de watts en subidas >4%
 * que hace computeRideMetrics al cerrar cada ride.
 *
 * Fuente de verdad en el DISPOSITIVO (localStorage): los watts se
 * calculan al cerrar el ride, a veces sin conexión, así que el valor
 * tiene que estar disponible sí o sí. La copia de cuenta (User.
 * riderWeightKg / bikeWeightKg vía PUT /api/me) es respaldo para no
 * perderlos al cambiar de teléfono: al iniciar sesión se adoptan si el
 * dispositivo aún usa los defaults.
 *
 * Defaults del estándar del sector: 75 kg de ciclista + 12 kg de bici.
 */

export const DEFAULT_RIDER_KG = 75;
export const DEFAULT_BIKE_KG = 12;

export type RideWeights = { riderKg: number; bikeKg: number };

const KEY = "cumbre30-ride-weights-v1";

const RIDER_MIN = 30;
const RIDER_MAX = 200;
const BIKE_MIN = 5;
const BIKE_MAX = 50;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function read(): RideWeights | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<RideWeights>;
    if (typeof d.riderKg !== "number" || typeof d.bikeKg !== "number") return null;
    if (!isFinite(d.riderKg) || !isFinite(d.bikeKg)) return null;
    return { riderKg: clamp(d.riderKg, RIDER_MIN, RIDER_MAX), bikeKg: clamp(d.bikeKg, BIKE_MIN, BIKE_MAX) };
  } catch {
    return null;
  }
}

/** Pesos vigentes (los guardados o los defaults). Nunca lanza. */
export function getRideWeights(): RideWeights {
  return read() ?? { riderKg: DEFAULT_RIDER_KG, bikeKg: DEFAULT_BIKE_KG };
}

/** ¿El dispositivo sigue con los defaults (nada guardado aún)? */
export function weightsAreDefault(): boolean {
  return read() === null;
}

/** Valida y guarda. Devuelve null si algún valor quedó fuera de rango. */
export function setRideWeights(riderKg: number, bikeKg: number): RideWeights | null {
  if (!isFinite(riderKg) || !isFinite(bikeKg)) return null;
  if (riderKg < RIDER_MIN || riderKg > RIDER_MAX || bikeKg < BIKE_MIN || bikeKg > BIKE_MAX) return null;
  const w = { riderKg: Math.round(riderKg * 10) / 10, bikeKg: Math.round(bikeKg * 10) / 10 };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    return null; // almacenamiento lleno/bloqueado
  }
  return w;
}

/**
 * Adopta los pesos de la cuenta si el dispositivo aún no guardó ninguno
 * (defaults vigentes). Los pesos locales nunca se sobreescriben: el
 * dispositivo es la fuente de verdad una vez que el usuario guardó.
 */
export function hydrateWeightsFromAccount(user: { riderWeightKg?: number | null; bikeWeightKg?: number | null }): void {
  if (!weightsAreDefault()) return;
  const r = user.riderWeightKg;
  const b = user.bikeWeightKg;
  if (typeof r !== "number" || typeof b !== "number" || !isFinite(r) || !isFinite(b)) return;
  if (r < RIDER_MIN || r > RIDER_MAX || b < BIKE_MIN || b > BIKE_MAX) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ riderKg: r, bikeKg: b }));
  } catch {
    // sin espacio: se siguen los defaults
  }
}
