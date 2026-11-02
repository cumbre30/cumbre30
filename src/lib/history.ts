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
  avgKmh: number;
  elapsedSec: number;
  gainM: number;
  overLimitSec: number;
  /** Pista GPS para export GPX — solo viajes grabados desde v1.5.0. */
  track?: TrackPt[];
};

const KEY = "cumbre30-history-v1";

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
    return [];
  },
  refresh(): void {
    dirty = true;
    for (const l of listeners) l();
  },
};

export function saveRide(s: RideSummary): void {
  if (typeof window === "undefined") return;
  const list = readFromStorage();
  list.unshift(s);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  historyStore.refresh();
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  historyStore.refresh();
}
