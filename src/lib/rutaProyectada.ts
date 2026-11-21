// ============================================================
// Fase F del módulo Rutas y Comunidad (v2.1 §8): RUTA PROYECTADA
// sobre el mapa + COMPLETADA binaria + EXPERIENCIA post-ride.
//
// · Proyector: al pulsar «Navegar» en una ficha (privada o pública),
//   la geometría de la ruta se proyecta sobre el mapa grande para
//   seguirla pedaleando. Es un estado de UI del dispositivo: no
//   cambia el motor de rides ni el de navegación (v2.1 §8: sin
//   recomputo, sin GPS del servido — la ruta local es TU copia y la
//   pública es la geometría protegida del servidor).
// · routeRef: al cerrar un ride con una ruta proyectada, el resumen
//   LOCAL del ride guarda {id, serverId, nombre, origen} — solo ids
//   y nombre, jamás geometría. El servidor no recibe este campo
//   (rideToPayload arma un whitelist), así los rides del servidor
//   quedan intocados.
// · Completada binaria: cerrar el ride marca la ruta local
//   (RutaV2.completada=true) — sí/no, sin conteos ni ranking.
// · Experiencia post-ride: el cierre ofrece registrar la experiencia
//   (§6) con la fecha del ride y su rideId; jamás lleva pista GPS.
//
// Lógica pura en rutasProyectadaFor(storage) + helpers puros para
// pruebas en node; instancia de navegador con localStorage (patrón
// rutasStore / useTrazas: snapshot estable para useSyncExternalStore).
// ============================================================

/** Ruta proyectada sobre el mapa. coords nunca salen del dispositivo:
 *  origen "local" usa tu copia; origen "publica" decodifica la
 *  geometría protegida que el servidor ya entabló (v2.1 §3). */
export type RutaProyectada = {
  /** Id local (RutaV2.id) o id del servidor si vino del catálogo. */
  routeId: string;
  /** Id del servidor cuando existe (publicada o catálogo); null en borrador. */
  serverId?: string | null;
  nombre: string;
  coords: { lat: number; lon: number }[];
  origen: "local" | "publica";
};

/** Referencia mínima que el ride LOCAL guarda al cerrar con ruta
 *  proyectada (ids + nombre; JAMÁS coords — el ride no duplica
 *  geometría y el servidor jamás recibe este campo). */
export type RouteRef = {
  id: string;
  serverId?: string | null;
  nombre: string;
  origen: "local" | "publica";
};

export const RUTA_PROYECTADA_KEY = "c30.ruta-proyectada";

export type KVStorageProy = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem?(k: string): void;
};

type Envelope = { v: 1; r: RutaProyectada | null };

function esProyectadaValida(r: unknown): r is RutaProyectada {
  if (!r || typeof r !== "object") return false;
  const p = r as Record<string, unknown>;
  if (typeof p.routeId !== "string" || p.routeId.length === 0) return false;
  if (typeof p.nombre !== "string" || p.nombre.length === 0) return false;
  if (p.origen !== "local" && p.origen !== "publica") return false;
  if (!Array.isArray(p.coords) || p.coords.length < 2) return false;
  for (const c of p.coords as unknown[]) {
    if (!c || typeof c !== "object") return false;
    const v = c as Record<string, unknown>;
    if (typeof v.lat !== "number" || !Number.isFinite(v.lat)) return false;
    if (typeof v.lon !== "number" || !Number.isFinite(v.lon)) return false;
  }
  return true;
}

/** Fábrica pura del store de ruta proyectada (probable en node). */
export function rutasProyectadaFor(storage: KVStorageProy) {
  let snapshot: RutaProyectada | null = null;
  let rawCache: string | null | undefined = undefined;
  const listeners = new Set<() => void>();

  function escribir(r: RutaProyectada | null): void {
    const json = JSON.stringify({ v: 1, r } satisfies Envelope);
    storage.setItem(RUTA_PROYECTADA_KEY, json);
    rawCache = json;
    snapshot = r;
    for (const l of listeners) l();
  }

  function leer(): RutaProyectada | null {
    const raw = storage.getItem(RUTA_PROYECTADA_KEY);
    if (raw !== null && raw === rawCache) return snapshot;
    rawCache = raw;
    if (raw) {
      try {
        const env = JSON.parse(raw) as Envelope;
        if (env?.r && esProyectadaValida(env.r)) {
          snapshot = env.r;
          return snapshot;
        }
      } catch {
        // envelope corrupto: se re-escribe al próximo set
      }
    }
    snapshot = null;
    return snapshot;
  }

  return {
    get(): RutaProyectada | null {
      return leer();
    },
    set(r: RutaProyectada | null): void {
      escribir(r);
    },
    subscribe(l: () => void): () => void {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

// ---------- instancia de navegador (SSR-safe, patrón rutasStore) ----------
const memoria: Record<string, string> = {};
const storageMemoria: KVStorageProy = {
  getItem: (k) => (k in memoria ? memoria[k] : null),
  setItem: (k, v) => {
    memoria[k] = v;
  },
  removeItem: (k) => {
    delete memoria[k];
  },
};
const storageNavegador: KVStorageProy =
  typeof localStorage !== "undefined" ? localStorage : storageMemoria;

export const rutaProyectadaStore = rutasProyectadaFor(storageNavegador);

// ---------- helpers puros (probados en node) ----------

/** routeRef del ride: solo ids y nombre — jamás geometría. */
export function conRouteRef<T extends Record<string, unknown>>(summary: T, proyectada: RutaProyectada | null): T {
  if (!proyectada) return summary;
  return {
    ...summary,
    routeRef: { id: proyectada.routeId, serverId: proyectada.serverId ?? null, nombre: proyectada.nombre, origen: proyectada.origen },
  };
}

type StoreMinimo = {
  get(): { id: string; serverId?: string | null; completada?: boolean }[];
  update(id: string, patch: Record<string, unknown>): unknown | null;
};

/** COMPLETADA BINARIA (v2.1 §8): al cerrar un ride con ruta
 *  proyectada, la copia local de la ruta queda marcada. Resuelve por
 *  id local y, si no existe, por serverId (Navegar desde el catálogo
 *  con copia local publicada). Sí/no — sin conteos, sin ranking;
 *  conservar la PRIMERA fecha (binaria, no un historial). */
export function marcarCompletada(store: StoreMinimo, ref: RouteRef, fechaISO: string): string | null {
  const rutas = store.get();
  const local = rutas.find((r) => r.id === ref.id);
  const objetivo = local ?? (ref.serverId ? rutas.find((r) => r.serverId === ref.serverId) : undefined);
  if (!objetivo) return null; // ruta pública sin copia local: nada que marcar
  if (objetivo.completada) return objetivo.id; // idempotente
  store.update(objetivo.id, { completada: true, completadaAt: fechaISO });
  return objetivo.id;
}

/** Payload de la experiencia post-ride (§6): fecha = fecha del ride
 *  (yyyy-mm-dd), condiciones tipificadas dedup ≤3, rideId anclado.
 *  Devuelve null si faltan datos (sin ride o sin fecha válida) — el
 *  servidor jamás recibe pista GPS porque el payload no la lleva. */
export function armarExperienciaDeRide(
  ride: { id: string; dateISO: string } | null,
  seleccion: { condiciones?: string[]; comentario?: string; observacion?: string } | null
): { fechaRealizacion: string; condiciones: string[]; comentario?: string; observacion?: string; rideId: string } | null {
  if (!ride || typeof ride.id !== "string" || ride.id.length === 0) return null;
  const fecha = typeof ride.dateISO === "string" && /^\d{4}-\d{2}-\d{2}/.test(ride.dateISO) ? ride.dateISO.slice(0, 10) : null;
  if (!fecha) return null;
  // Condiciones: dedup + filtro al enumerado cerrado §6 + tope 3.
  const CONDICIONES = ["camino_ok", "tramo_cerrado", "barro", "mucho_trafico", "sombra", "agua", "otro"];
  const condiciones: string[] = [];
  for (const c of Array.isArray(seleccion?.condiciones) ? seleccion.condiciones : []) {
    if (typeof c === "string" && CONDICIONES.includes(c) && !condiciones.includes(c) && condiciones.length < 3) {
      condiciones.push(c);
    }
  }
  const comentario = typeof seleccion?.comentario === "string" ? seleccion.comentario.trim().slice(0, 2000) : undefined;
  const observacion = typeof seleccion?.observacion === "string" ? seleccion.observacion.trim().slice(0, 500) : undefined;
  return {
    fechaRealizacion: fecha,
    condiciones,
    ...(comentario ? { comentario } : {}),
    ...(observacion ? { observacion } : {}),
    rideId: ride.id,
  };
}
