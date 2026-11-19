/**
 * Un punto de la pista GPS: [lat, lon, eleM, tsSegundos].
 * Se guarda muestreada (~1 punto cada 5 s, máx 600) para que el
 * historial completo siga cabiendo en localStorage.
 */
export type TrackPt = [lat: number, lon: number, eleM: number, tsSec: number];

import { isProActive } from "@/lib/proLicense";
import { getTrack, putTrack } from "@/lib/idb";
import type { RideMetrics } from "@/lib/rideMetrics";

export type RideSummary = {
  id: string;
  dateISO: string;
  source: "gps" | "sim";
  distanceKm: number;
  maxKmh: number;
  maxInParkKmh: number | null;
  /** Km recorridos DENTRO de la geocerca del parque (null: ride antiguo
   *  sin medición o que nunca entró). Base de los desafíos del parque. */
  inParkKm?: number | null;
  avgKmh: number;
  elapsedSec: number;
  gainM: number;
  overLimitSec: number;
  /** Pista GPS para export GPX - solo viajes grabados desde v1.5.0. */
  track?: TrackPt[];
  /** Métricas derivadas para el Perfil Ciclista (v1.13.16): se calculan
   *  en el dispositivo al cerrar el ride y suben con el resumen. Los
   *  rides anteriores no la tienen y el perfil las compensa. */
  metrics?: RideMetrics;
  /** Correo de la cuenta dueña del viaje. Sin correo = viaje local del dispositivo. */
  account?: string;
  /** True si el viaje se registró en vehículo motorizado (confirmado
   *  por el usuario tras la sospecha del motor): NO cuenta para
   *  desafíos ni estadísticas; queda en el historial con badge. */
  motorized?: boolean;
};

const KEY = "cumbre30-history-v1";

/**
 * Solo viajes con GPS real. Los viajes de demostración (source "sim",
 * simulación sin GPS) NO cuentan para ninguna estadística: totales,
 * resúmenes semanales, contadores ni logros - igual que ya ocurría
 * con las constancias PDF y los segmentos del cerro.
 */
export function gpsOnly(rides: RideSummary[]): RideSummary[] {
  return rides.filter((r) => r.source === "gps");
}

/**
 * Viajes que cuentan como pedaleo real: GPS y confirmados en bici.
 * Excluye los demo (sim) y los marcados como vehículo motorizado;
 * es la base de estadísticas, contadores y desafíos.
 */
export function bikeOnly(rides: RideSummary[]): RideSummary[] {
  return rides.filter((r) => r.source === "gps" && !r.motorized);
}

/**
 * Viajes visibles según la cuenta: con sesión, solo los enlazados a
 * ese correo (más los locales aún sin enlazar, que el login enlaza
 * automáticamente); sin sesión, solo los locales del dispositivo.
 * Así los viajes y estadísticas de una cuenta nunca se mezclan con
 * los de otra ni se muestran sin sesión.
 */
export function ridesForAccount(rides: RideSummary[], email: string | null): RideSummary[] {
  if (!email) return rides.filter((r) => !r.account);
  const mail = email.trim().toLowerCase();
  return rides.filter((r) => !r.account || r.account === mail);
}

// Store externo simple para leer localStorage con useSyncExternalStore
let snapshot: RideSummary[] = [];
let dirty = true;
const listeners = new Set<() => void>();

function readFromStorage(): RideSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RideSummary[]) : [];
  } catch {
    return [];
  }
}

// Snapshot estable para SSR/hidratación: devolver un array nuevo en
// cada llamada dispara "getServerSnapshot should be cached" en React.
const EMPTY_SNAPSHOT: RideSummary[] = [];

export const historyStore = {
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get(): RideSummary[] {
    if (dirty) {
      snapshot = readFromStorage();
      dirty = false;
    }
    return snapshot;
  },
  getServer(): RideSummary[] {
    return EMPTY_SNAPSHOT;
  },
  refresh(): void {
    dirty = true;
    for (const l of listeners) l();
  },
};

// ------------------------------------------------------------------
// Enlace viaje ↔ cuenta: los rides nuevos quedan asociados al correo
// de la sesión activa; sin sesión son locales del dispositivo.
// ------------------------------------------------------------------

let rideOwner: string | null = null;

/** Define la cuenta activa (correo normalizado) o null para modo local. */
export function setRideOwner(email: string | null): void {
  rideOwner = email ? email.trim().toLowerCase() : null;
}

/**
 * Enlaza al correo los viajes antiguos que aún no tienen cuenta
 * (grabados sin sesión iniciada). Idempotente: solo toca los sueltos.
 * Devuelve cuántos viajes quedaron enlazados.
 */
export function linkRidesToAccount(email: string): number {
  if (typeof window === "undefined") return 0;
  const mail = email.trim().toLowerCase();
  if (!mail) return 0;
  const list = readFromStorage();
  let n = 0;
  for (const r of list) {
    if (!r.account) {
      r.account = mail;
      n++;
    }
  }
  if (n) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      historyStore.refresh();
    } catch {
      // almacenamiento lleno/bloqueado
    }
  }
  return n;
}

/**
 * Elimina todos los viajes enlazados a una cuenta (baja de cuenta).
 * Los rides locales sin enlazar y los de otras cuentas se conservan.
 * Devuelve cuántos viajes se borraron.
 */
export function removeRidesForAccount(email: string): number {
  if (typeof window === "undefined") return 0;
  const mail = email.trim().toLowerCase();
  if (!mail) return 0;
  const list = readFromStorage();
  const rest = list.filter((r) => r.account?.toLowerCase() !== mail);
  const removed = list.length - rest.length;
  if (removed) {
    try {
      localStorage.setItem(KEY, JSON.stringify(rest));
      historyStore.refresh();
    } catch {
      // almacenamiento lleno/bloqueado
    }
  }
  return removed;
}

/**
 * Límite del historial para el nivel gratis (Pro: ilimitado).
 * Palanca freemium decidida en la reevaluación de planes v1.8.0.
 */
export const FREE_RIDE_LIMIT = 20;

/**
 * Aplica el tope freemium al historial. Convergencia amable: cada
 * viaje NUEVO descarta solo el más antiguo, así quien venía con el
 * tope anterior de 50 no pierde de golpe 30 registros; el historial
 * baja gradualmente hasta los últimos 20. Pro: sin tope.
 */
export function applyFreeCap(list: RideSummary[], isPro: boolean): RideSummary[] {
  if (isPro || list.length <= FREE_RIDE_LIMIT) return list;
  return list.slice(0, list.length - 1);
}

export function saveRide(s: RideSummary): void {
  if (typeof window === "undefined") return;
  const list = readFromStorage();
  const rec: RideSummary = { ...s };
  if (!rec.account && rideOwner) rec.account = rideOwner;
  // Pista GPS también en IndexedDB: respaldo duradero por si el
  // localStorage se poda (migración) o queda sin espacio.
  if (rec.track?.length) void putTrack(rec.id, rec.track);
  list.unshift(rec);
  localStorage.setItem(KEY, JSON.stringify(applyFreeCap(list, isProActive())));
  historyStore.refresh();
}

/**
 * Corrige el flag de vehículo motorizado de un ride guardado
 * (el usuario confirmó "fui en bici" o lo marca como vehículo).
 * Idempotente: si el flag ya está en ese valor, no toca nada.
 */
export function setRideMotorized(id: string, motorized: boolean): void {
  if (typeof window === "undefined") return;
  const list = readFromStorage();
  let changed = false;
  for (const r of list) {
    if (r.id !== id) continue;
    if (motorized && r.motorized !== true) {
      r.motorized = true;
      changed = true;
    } else if (!motorized && r.motorized !== undefined) {
      delete r.motorized;
      changed = true;
    }
  }
  if (changed) {
    // Sin recorte aquí: corregir el flag de un ride no debe costar
    // datos viejos; el tope freemium solo aplica al guardar viajes.
    localStorage.setItem(KEY, JSON.stringify(list));
    historyStore.refresh();
  }
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  historyStore.refresh();
}

// ------------------------------------------------------------------
// Pistas GPS en IndexedDB + escritura completa del historial.
// El resumen del ride vive en localStorage; las pistas de los rides
// antiguos se podan hacia IndexedDB (migración al arranque) para que
// el almacenamiento local no crezca sin techo. La lectura unificada
// es readRideTrack (IndexedDB primero, luego la embebida).
// ------------------------------------------------------------------

/** Rides recientes que mantienen su pista embebida en localStorage. */
const TRACKS_LOCAL_KEEP = 20;

/** Escribe el historial completo (pull del servidor, migraciones). */
export function writeAllRides(list: RideSummary[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(applyFreeCap(list, isProActive())));
    historyStore.refresh();
  } catch {
    // almacenamiento lleno/bloqueado: se conserva lo que había
  }
}

/** Pista de un ride: IndexedDB (rides podados) o la embebida (recientes). */
export async function readRideTrack(id: string): Promise<TrackPt[] | null> {
  const fromIdb = await getTrack(id);
  if (fromIdb) return fromIdb as unknown as TrackPt[];
  const embedded = historyStore.get().find((r) => r.id === id)?.track;
  return embedded ?? null;
}

let tracksMigrated = false;

/** Una vez por carga: pistas de rides antiguos → IndexedDB. */
export async function migrateTracksToIdb(): Promise<void> {
  if (tracksMigrated || typeof window === "undefined") return;
  tracksMigrated = true;
  try {
    const list = readFromStorage(); // ordenado: [0] es el más nuevo
    let changed = false;
    for (let i = TRACKS_LOCAL_KEEP; i < list.length; i++) {
      const r = list[i];
      if (!r.track?.length) continue;
      await putTrack(r.id, r.track);
      delete r.track;
      changed = true;
    }
    if (changed) {
      localStorage.setItem(KEY, JSON.stringify(list));
      historyStore.refresh();
    }
  } catch {
    // sin IndexedDB ni espacio: las pistas siguen embebidas
  }
}
