/**
 * Un punto de la pista GPS: [lat, lon, eleM, tsSegundos].
 * Se guarda muestreada (~1 punto cada 5 s, máx 600) para que el
 * historial completo siga cabiendo en localStorage.
 */
export type TrackPt = [lat: number, lon: number, eleM: number, tsSec: number];

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
  /** Pista GPS para export GPX — solo viajes grabados desde v1.5.0. */
  track?: TrackPt[];
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
 * resúmenes semanales, contadores ni logros — igual que ya ocurría
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

export function saveRide(s: RideSummary): void {
  if (typeof window === "undefined") return;
  const list = readFromStorage();
  const rec: RideSummary = { ...s };
  if (!rec.account && rideOwner) rec.account = rideOwner;
  list.unshift(rec);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
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
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
    historyStore.refresh();
  }
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  historyStore.refresh();
}
