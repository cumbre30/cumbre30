// ============================================================
// src/motor/persistencia.ts - Persistence Layer del checkpoint.
//   · Guarda el snapshot del ride cada checkpointCadaSec y en los
//     hitos (pausa, visibilitychange hidden, pagehide), para que
//     un crasheo del WebView o la muerte del proceso Android
//     dejen al ride recuperable (auditoría P0-1).
//   · Implementación de la app: localStorage (sincrónico, sobrevive
//     al proceso, capacidad sobrada para ~600 puntos). En pruebas
//     y en otros proyectos: AlmacenEnMemoria o el que se provea.
//   · Tolerante a fallos: cualquier error de almacenamiento deja el
//     motor vivo (el ride en RAM sigue siendo la fuente de verdad
//     mientras el proceso exista).
// ============================================================

import type { AlmacenCheckpoint, CheckpointMotor } from "./tipos";

const KEY = "cumbre30-motor-checkpoint-v1";

/** Almacén localStorage (app real). */
export function almacenLocalStorage(): AlmacenCheckpoint {
  return {
    guardar(cp: CheckpointMotor): void {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(cp));
      } catch {
        // sin almacenamiento disponible: el checkpoint simplemente no se persiste
      }
    },
    leer(): CheckpointMotor | null {
      try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return null;
        const cp = JSON.parse(raw) as CheckpointMotor;
        return cp && cp.version === 1 && typeof cp.inicioTs === "number" ? cp : null;
      } catch {
        return null;
      }
    },
    borrar(): void {
      try {
        window.localStorage.removeItem(KEY);
      } catch {
        // nada que borrar
      }
    },
  };
}

/** Almacén en memoria (pruebas, proyectos sin localStorage). */
export function almacenEnMemoria(): AlmacenCheckpoint {
  let cp: CheckpointMotor | null = null;
  return {
    guardar(c: CheckpointMotor): void {
      cp = c;
    },
    leer(): CheckpointMotor | null {
      return cp;
    },
    borrar(): void {
      cp = null;
    },
  };
}

/** Valida la forma de un checkpoint leído (defensa contra datos
 *  corruptos o de versiones futuras). */
export function esCheckpointValido(cp: unknown): cp is CheckpointMotor {
  if (!cp || typeof cp !== "object") return false;
  const c = cp as CheckpointMotor;
  return (
    c.version === 1 &&
    typeof c.inicioTs === "number" &&
    typeof c.metricas?.distanciaM === "number" &&
    typeof c.metricas?.elapsedSec === "number" &&
    Array.isArray(c.track)
  );
}
