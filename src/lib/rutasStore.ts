// ============================================================
// Store local de rutas v2 (fase A del módulo Rutas y Comunidad,
// arquitectura v2.1 §2): clave "c30.rutas-v2".
//
// MIGRACIÓN POR LECTURA: la primera vez que se lee el store, se
// COPIAN los trazados existentes de "c30.trazas" (trazasUsuario.ts)
// tal cual — id, kind, coords y demás campos sin transformación —
// y se marcan como migrados. "c30.trazas" queda INTACTO para
// siempre: es el respaldo de las fases aditivas (v2.1 §14) y el
// creador/panel vigente siguen leyéndolo sin cambios. La nueva
// estructura nunca re-migra (borrar una ruta migrada no la
// resucita en la siguiente lectura).
//
// Diseño probado en node: la lógica vive en rutasStoreFor(storage)
// con almacenamiento inyectable; la instancia de navegador usa
// localStorage con un respaldo en memoria para SSR.
// ============================================================

import type { TrazaGuardada } from "./trazasUsuario";

export const RUTAS_V2_KEY = "c30.rutas-v2";
const TRAZAS_KEY = "c30.trazas"; // SOLO lectura; jamás se escribe aquí.
const MAX_RUTAS_V2 = 200;

/** Una ruta v2: conserva 1:1 los campos de la traza migrada y
 *  añade los metadatos del módulo (opcionales hasta fase B). */
export type RutaV2 = TrazaGuardada & {
  descripcion?: string;
  /** Atributos recreativos orientativos (máx 3, enumerado cerrado). */
  attrs?: string[];
  /** Registro de protección aplicada al publicar (v2.1 §3). */
  proteccion?: {
    recorteIniM: number;
    recorteFinM: number;
    snapInicio?: boolean;
    snapFin?: boolean;
    sinSnapInicio?: boolean;
    sinSnapFin?: boolean;
  };
  /** id del servidor si la ruta se publicó (fase D); null en borrador. */
  servidorId?: string | null;
  /** id de la versión publicada (RouteVersion) si existe. */
  versionId?: string | null;
  updatedAt?: string;
  /** Marca de la migración por lectura desde c30.trazas (fase A). */
  migradaDe?: "c30.trazas";
};

type Envelope = { v: 1; migrado: boolean; entries: RutaV2[] };

export type KVStorage = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem?(k: string): void;
};

function esRutaValida(t: unknown): t is RutaV2 {
  if (!t || typeof t !== "object") return false;
  const r = t as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    (r.kind === "ruta" || r.kind === "segmento") &&
    Array.isArray(r.coords)
  );
}

/** Fábrica pura del store (probable en node con storage fake). */
export function rutasStoreFor(storage: KVStorage) {
  let snapshot: RutaV2[] = [];
  const listeners = new Set<() => void>();

  function escribir(entries: RutaV2[]): void {
    const env: Envelope = { v: 1, migrado: true, entries };
    storage.setItem(RUTAS_V2_KEY, JSON.stringify(env));
    snapshot = entries;
    for (const l of listeners) l();
  }

  /** Lectura con migración por lectura (única vez). */
  function leer(): RutaV2[] {
    const raw = storage.getItem(RUTAS_V2_KEY);
    if (raw) {
      try {
        const env = JSON.parse(raw) as Envelope;
        if (Array.isArray(env?.entries)) {
          snapshot = env.entries.filter(esRutaValida);
          return snapshot;
        }
      } catch {
        // envelope corrupto: se re-migra desde c30.trazas abajo
      }
    }
    // Primera lectura (o envelope corrupto): copiar c30.trazas TAL CUAL.
    // Solo lectura del origen: nada aquí toca TRAZAS_KEY.
    let trazas: unknown = [];
    try {
      const t = storage.getItem(TRAZAS_KEY);
      trazas = t ? JSON.parse(t) : [];
    } catch {
      trazas = [];
    }
    const entries = (Array.isArray(trazas) ? trazas : [])
      .filter(esRutaValida)
      .map((t) => ({ ...t, migradaDe: "c30.trazas" as const }));
    escribir(entries.slice(0, MAX_RUTAS_V2));
    return snapshot;
  }

  return {
    /** Lista actual (migra por lectura si es la primera vez). */
    get(): RutaV2[] {
      return leer();
    },
    /** ¿La migración por lectura ya corrió? (para diagnóstico/tests). */
    migrado(): boolean {
      const raw = storage.getItem(RUTAS_V2_KEY);
      if (!raw) return false;
      try {
        return (JSON.parse(raw) as Envelope)?.migrado === true;
      } catch {
        return false;
      }
    },
    add(entry: Omit<RutaV2, "id" | "migradaDe"> & { id?: string }): RutaV2 {
      const list = leer();
      const nueva: RutaV2 = {
        ...entry,
        id: entry.id ?? crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
      };
      escribir([nueva, ...list].slice(0, MAX_RUTAS_V2));
      return nueva;
    },
    remove(id: string): void {
      const list = leer();
      escribir(list.filter((r) => r.id !== id));
    },
    update(id: string, patch: Partial<Omit<RutaV2, "id" | "migradaDe">>): RutaV2 | null {
      const list = leer();
      let actualizada: RutaV2 | null = null;
      const siguiente = list.map((r) => {
        if (r.id !== id) return r;
        actualizada = { ...r, ...patch, updatedAt: new Date().toISOString() };
        return actualizada;
      });
      if (actualizada) escribir(siguiente);
      return actualizada;
    },
    subscribe(l: () => void): () => void {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

// ---------- instancia de navegador (SSR-safe) ----------

/** Respaldo en memoria para SSR/pruebas sin localStorage: el módulo
 *  se importa en el servidor y ahí localStorage no existe. */
const memoria: Record<string, string> = {};
const storageMemoria: KVStorage = {
  getItem: (k) => (k in memoria ? memoria[k] : null),
  setItem: (k, v) => { memoria[k] = v; },
  removeItem: (k) => { delete memoria[k]; },
};

const storageNavegador: KVStorage =
  typeof localStorage !== "undefined"
    ? localStorage
    : storageMemoria;

export const rutasStore = rutasStoreFor(storageNavegador);
