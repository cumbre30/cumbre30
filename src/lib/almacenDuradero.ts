// ============================================================
// src/lib/almacenDuradero.ts - AlmacenCheckpoint DURADERO de
// Cumbre30 (capa de la app, inyectable en el MotorGPS).
//
// Por qué existe (cierre de fase única, punto 3 del encargo):
// el checkpoint por defecto del núcleo usa localStorage del
// WebView. Eso sobrevive a muerte del proceso y reinicio, PERO:
//   a) Chromium hace commit de localStorage en lotes diferidos:
//      un SIGKILL puede perder la ÚLTIMA escritura del checkpoint.
//   b) Las limpiezas agresivas de WebView/OEM pueden borrar el
//      almacenamiento del WebView sin borrar los datos de la app.
// La solución: doble capa con el MISMO contrato sincrónico.
//   · Escritura: localStorage (sincrónico, siempre disponible)
//     + ESPEJO nativo vía Capacitor Filesystem — un archivo JSON
//     en el almacenamiento interno de la app (Directory.Data),
//     que se escribe con FileOutputStream nativo (durable al
//     cerrar: sobrevive muerte del proceso y reinicio del
//     dispositivo; no depende de Chromium).
//   · Lectura (recuperación): prevalece el checkpoint VÁLIDO más
//     reciente (ultimoGuardadoTs) de cualquiera de las dos capas.
//   · Contrato: sigue siendo AlmacenCheckpoint (sincrónico); la
//     precarga del espejo nativo se hace con precargar() al abrir
//     la app, ANTES de preguntar «¿Retomar ride?».
// Escenarios cubiertos: cierre inesperado ✓ · muerte del proceso ✓
// reinicio del dispositivo ✓ · recreación del WebView ✓
// limpieza de ALMACENAMIENTO del WebView ✓ (el espejo nativo sigue).
// "Borrar datos" del usuario en Ajustes borra ambas capas: es un
// reset explícito del producto y no es un caso de recuperación.
// ============================================================

import type { AlmacenCheckpoint, CheckpointMotor } from "@/motor/tipos";
import { CLAVE_CHECKPOINT_LS, esCheckpointValido } from "@/motor/persistencia";
import { isNativeApp } from "@/lib/rideNative";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";

/** Nombre del archivo espejo en el almacenamiento interno
 *  (Directory.Data de la app Android). */
const ARCHIVO_NATIVO = "cumbre30-checkpoint-motor-v1.json";

/** Puente de la capa nativa, inyectable para pruebas. El defecto
 *  usa Capacitor Filesystem dentro del APK. */
export type PuenteAlmacenNativo = {
  leer(): Promise<string | null>;
  escribir(dato: string): Promise<void>;
  borrar(): Promise<void>;
};

function puenteCapacitor(): PuenteAlmacenNativo {
  return {
    async leer() {
      try {
        const r = await Filesystem.readFile({
          path: ARCHIVO_NATIVO,
          directory: Directory.Data,
          encoding: Encoding.UTF8,
        });
        // Capacitor 8: el dato viene en r.data (string con encoding UTF8)
        return typeof r.data === "string" && r.data.length > 0 ? r.data : null;
      } catch {
        return null; // archivo inexistente: primera ejecución
      }
    },
    async escribir(dato) {
      await Filesystem.writeFile({
        path: ARCHIVO_NATIVO,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        data: dato,
        recursive: true,
      });
    },
    async borrar() {
      try {
        await Filesystem.deleteFile({ path: ARCHIVO_NATIVO, directory: Directory.Data });
      } catch {
        // ya no existe: nada que borrar
      }
    },
  };
}

export type AlmacenDuradero = AlmacenCheckpoint & {
  /** Carga el espejo nativo a memoria. Llamar UNA VEZ al abrir la
   *  app, antes de leer la recuperación. Jamás lanza. */
  precargar(): Promise<void>;
};

export function crearAlmacenDuradero(opts: { nativo?: PuenteAlmacenNativo | null } = {}): AlmacenDuradero {
  const nativo: PuenteAlmacenNativo | null =
    opts.nativo !== undefined ? opts.nativo : isNativeApp() ? puenteCapacitor() : null;

  // Cache del espejo nativo: undefined = aún sin cargar.
  let cacheNativo: string | null | undefined = undefined;

  // Cola de escritura nativa: solo el ÚLTIMO dato pendiente llega a
  // disco (last-write-wins) y jamás se intercalan escrituras.
  let cola: Promise<void> = Promise.resolve();
  let pendiente: string | null = null;
  const encolar = (dato: string | null) => {
    pendiente = dato;
    cola = cola.then(async () => {
      const d = pendiente;
      pendiente = null;
      if (d === null || !nativo) return;
      try {
        await nativo.escribir(d);
      } catch {
        // el espejo nativo falla → queda el checkpoint de localStorage
      }
    });
  };

  function leerLs(): CheckpointMotor | null {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      const raw = window.localStorage.getItem(CLAVE_CHECKPOINT_LS);
      if (!raw) return null;
      return esCheckpointValido(JSON.parse(raw)) ? (JSON.parse(raw) as CheckpointMotor) : null;
    } catch {
      return null;
    }
  }

  function parsear(raw: string | null | undefined): CheckpointMotor | null {
    if (!raw) return null;
    try {
      const cp = JSON.parse(raw) as CheckpointMotor;
      return esCheckpointValido(cp) ? cp : null;
    } catch {
      return null;
    }
  }

  return {
    guardar(cp: CheckpointMotor): void {
      const dato = JSON.stringify(cp);
      // capa sincrónica (contrato del motor): siempre primero
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(CLAVE_CHECKPOINT_LS, dato);
        }
      } catch {
        // sin almacenamiento disponible: queda el espejo nativo
      }
      // capa nativa duradera (fire-and-forget, cola serializada)
      if (nativo) encolar(dato);
    },
    leer(): CheckpointMotor | null {
      const ls = leerLs();
      const nat = cacheNativo === undefined ? null : parsear(cacheNativo);
      if (!ls) return nat;
      if (!nat) return ls;
      // prevalece el checkpoint válido más reciente de las dos capas
      return (nat.ultimoGuardadoTs ?? 0) >= (ls.ultimoGuardadoTs ?? 0) ? nat : ls;
    },
    borrar(): void {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(CLAVE_CHECKPOINT_LS);
        }
      } catch {
        // nada que borrar
      }
      cacheNativo = null;
      if (nativo) {
        cola = cola.then(async () => {
          try {
            await nativo.borrar();
          } catch {
            // no importa: el checkpoint ya se invalidó en memoria
          }
        });
      }
    },
    async precargar(): Promise<void> {
      if (cacheNativo !== undefined || !nativo) {
        if (!nativo) cacheNativo = null;
        return;
      }
      // espera a que drenen las escrituras en vuelo: la precarga jamás
      // lee un estado anterior al último guardar()/borrar() pedido
      await cola.catch(() => undefined);
      try {
        cacheNativo = await nativo.leer();
      } catch {
        cacheNativo = null;
      }
    },
  };
}
