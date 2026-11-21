// ============================================================
// Ficha de ruta — lógica pura de la fase C (biblioteca y fichas,
// arquitectura v2.1 tabla 6 «C» y §7.4/§5.3 del plan v2):
// · Banner de vigencia (§7.4): vigente (revisada hace < 6 meses),
//   avisos activos (reportes confirmados/abiertos de cierre o
//   peligro, con su número) y sin revisar (nunca revisada o hace
//   más de 6 meses). La retirada es estado de publicación (fase D).
// · Tiempo estimado ORIENTATIVO como rango ±25 % (§5.3): modelo de
//   velocidad por pendiente inspirado en rideMetrics (llano v0,
//   la subida penaliza por pendiente media); con gainM null la
//   estimación es preliminar (solo distancia). Jamás es ranking ni
//   tiempo objetivo — la etiqueta «completada» sigue binaria.
// · Rutas recientes: ids de fichas abiertas en el dispositivo
//   (c30.rutas-recientes), con fábrica inyectable probada en node.
// ============================================================

export type EstadoVigencia = "vigente" | "avisos" | "sin-revisar" | "retirada";

const MESES_SEIS = 182 * 24 * 60 * 60 * 1000; // ~6 meses en ms

/** Estado informativo de vigencia (§7.4). Los reportes NUNCA
 *  cambian la geometría: 'avisos' es un aviso informativo. */
export function estadoVigencia(
  ultimaRevisionAt: string | null,
  avisosAbiertos: number,
  status?: string,
): EstadoVigencia {
  if (status === "retirada") return "retirada";
  if (avisosAbiertos > 0) return "avisos";
  if (!ultimaRevisionAt) return "sin-revisar";
  const t = Date.parse(ultimaRevisionAt);
  if (!Number.isFinite(t)) return "sin-revisar";
  return Date.now() - t < MESES_SEIS ? "vigente" : "sin-revisar";
}

/** Modelo de velocidad por pendiente (inspirado en rideMetrics:
 *  llano como referencia, la pendiente media penaliza). */
const V_LLANO_KMH = 18;
const V_MIN_KMH = 6;

function velocidadKmh(distKm: number, gainM: number | null): { v: number; preliminar: boolean } {
  if (gainM == null || distKm <= 0) return { v: V_LLANO_KMH, preliminar: gainM == null };
  const pendienteMediaPct = (gainM / (distKm * 1000)) * 100;
  const penal = Math.min(pendienteMediaPct, 12) * 0.05; // 6% → −30%
  return { v: Math.max(V_MIN_KMH, V_LLANO_KMH * (1 - penal)), preliminar: false };
}

export type TiempoEstimado = {
  /** Horas del punto medio de la estimación. */
  horas: number;
  /** Rango ±25 % alrededor del punto medio (§5.3). */
  hMin: number;
  hMax: number;
  /** true cuando gainM es null: solo distancia, sin pendiente. */
  preliminar: boolean;
};

/** Tiempo estimado orientativo como rango (±25 %). */
export function tiempoEstimadoRango(distKm: number, gainM: number | null): TiempoEstimado {
  const { v, preliminar } = velocidadKmh(distKm, gainM);
  const horas = distKm / v;
  return { horas, hMin: horas / 1.25, hMax: horas * 1.25, preliminar };
}

/** «1 h 45 min» / «45 min» — para el rango se formatea cada extremo. */
export function formatearTiempo(horas: number): string {
  const min = Math.round(horas * 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// ------------------------------------------------------------
// Rutas recientes (fichas abiertas), patrón rutasStoreFor.
// ------------------------------------------------------------

export const RECIENTES_KEY = "c30.rutas-recientes";
const MAX_RECIENTES = 20;

export type KVStorage = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem?(k: string): void;
};

export function recientesFor(storage: KVStorage) {
  function ver(): string[] {
    try {
      const raw = storage.getItem(RECIENTES_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, MAX_RECIENTES) : [];
    } catch {
      return [];
    }
  }
  /** Registra una ficha abierta: sin duplicados, más reciente primero. */
  function registrar(id: string): void {
    if (!id) return;
    const lista = [id, ...ver().filter((x) => x !== id)].slice(0, MAX_RECIENTES);
    storage.setItem(RECIENTES_KEY, JSON.stringify(lista));
  }
  function quitar(id: string): void {
    storage.setItem(RECIENTES_KEY, JSON.stringify(ver().filter((x) => x !== id)));
  }
  function limpiar(): void {
    if (storage.removeItem) storage.removeItem(RECIENTES_KEY);
    else storage.setItem(RECIENTES_KEY, JSON.stringify([]));
  }
  return { ver, registrar, quitar, limpiar };
}

const memoria = new Map<string, string>();
/** Instancia de navegador sobre localStorage con respaldo en memoria. */
export const recientes = recientesFor({
  getItem: (k) => (typeof localStorage !== "undefined" ? localStorage.getItem(k) : (memoria.get(k) ?? null)),
  setItem: (k, v) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(k, v);
    else memoria.set(k, v);
  },
  removeItem: (k) => {
    if (typeof localStorage !== "undefined") localStorage.removeItem(k);
    else memoria.delete(k);
  },
});
