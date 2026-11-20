// ============================================================
// Trazados del usuario (v1.13.15, creador de rutas y segmentos).
// Rutas y segmentos guardados por el propio ciclista desde el
// mapa («Trazar ruta» / «Trazar segmento»). Persistencia local
// (localStorage, patrón marks.ts): viajan con el dispositivo y
// el APK funciona igual sin conexión.
// Un SEGMENTO además participa en las estadísticas: sus extremos
// se usan como geocercas de intento sobre la pista GPS de cada
// viaje (lib/segments.ts, dir "libre") → récord personal,
// contador e historial, igual que los segmentos oficiales Pro.
// ============================================================

import { useSyncExternalStore } from "react";
import type { LatLng } from "./routing";
import type { SegmentDef } from "./segments";

export type TrazaGuardada = {
  id: string;
  kind: "ruta" | "segmento";
  nombre: string;
  /** Línea simplificada (motor de rutas o GPX importado). */
  coords: LatLng[];
  distKm: number;
  /** Desnivel positivo de la línea (0 si no se pudo calcular). */
  gainM: number;
  createdAt: string;
  /** "motor": trazada con el motor de rutas · "gpx": importada de un GPX. */
  origen: "motor" | "gpx";
};

const KEY = "c30.trazas";
const MAX_TRAZAS = 50;

function read(): TrazaGuardada[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as TrazaGuardada[];
    return Array.isArray(list) ? list.filter((t) => t && typeof t.id === "string" && Array.isArray(t.coords)) : [];
  } catch {
    return [];
  }
}

let snapshot: TrazaGuardada[] = [];
const listeners = new Set<() => void>();
function notify(): void {
  snapshot = read();
  for (const l of listeners) l();
}

export const trazasStore = {
  subscribe(l: () => void): () => void {
    listeners.add(l);
    if (snapshot.length === 0) snapshot = read();
    return () => listeners.delete(l);
  },
  get(): TrazaGuardada[] {
    return snapshot;
  },
  // Referencia estable: un literal [] nuevo por llamada dispara el
  // aviso "getServerSnapshot should be cached" de React.
  getServer(): TrazaGuardada[] {
    return EMPTY;
  },
};

const EMPTY: TrazaGuardada[] = [];

export function addTraza(t: Omit<TrazaGuardada, "id" | "createdAt">): TrazaGuardada {
  const list = read();
  const guardada: TrazaGuardada = {
    ...t,
    nombre: t.nombre.trim().slice(0, 60) || (t.kind === "ruta" ? "Mi ruta" : "Mi segmento"),
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify([guardada, ...list].slice(0, MAX_TRAZAS)));
  notify();
  return guardada;
}

export function removeTraza(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(read().filter((t) => t.id !== id)));
  notify();
}

/** Hook reactivo para la UI. */
export function useTrazas(): TrazaGuardada[] {
  return useSyncExternalStore(trazasStore.subscribe, trazasStore.get, trazasStore.getServer);
}

// ----------------------------------------------------------------
// Segmentos del usuario → definiciones de intento (estadísticas)
// ----------------------------------------------------------------

/** Radio de las geocercas de inicio/meta de un segmento del usuario.
 *  60 m: tolera la deriva del GPS sin atrapar cruces vecinos. */
const RADIO_USUARIO_M = 60;

/** Convierte cada segmento guardado en una SegmentDef para el motor
 *  de estadísticas. dir "libre": se acepta cualquier dirección y
 *  desnivel (el ciclista define qué correr); la ventana de tiempo
 *  plausible se deriva de la distancia de la línea. */
export function userSegmentDefs(): SegmentDef[] {
  return read()
    .filter((t) => t.kind === "segmento" && t.coords.length >= 2)
    .map((t) => {
      const distM = Math.max(t.distKm * 1000, 100);
      return {
        id: `u-${t.id}`,
        name: t.nombre,
        detail:
          `Tu segmento: ${t.distKm.toFixed(1)} km` +
          (t.gainM > 0 ? ` · +${t.gainM} m` : "") +
          (t.origen === "gpx" ? " · GPX" : ""),
        start: t.coords[0],
        end: t.coords[t.coords.length - 1],
        radiusStartM: RADIO_USUARIO_M,
        radiusEndM: RADIO_USUARIO_M,
        minGainM: 0,
        // Ventana plausible: nada bajo 30 s ni promedios > ~29 km/h;
        // por arriba, ritmo de caminata + margen.
        minTimeSec: Math.max(30, Math.round(distM / 8)),
        maxTimeSec: Math.round(distM / 1.2) + 600,
        dir: "libre",
      } satisfies SegmentDef;
    });
}

/** Nombre del traza dueño de una def de usuario (`u-<id>`). */
export function trazaIdDeDef(defId: string): string {
  return defId.startsWith("u-") ? defId.slice(2) : defId;
}
