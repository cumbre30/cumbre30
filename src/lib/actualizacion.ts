"use client";

// ============================================================
// Revisión de actualizaciones (v1.12.4) — el «Windows Update» de
// Cumbre30, adaptado a cómo se reparte la app.
//
//   · La web desplegada (cumbregeo.cl) siempre corre la última
//     build, y su /version.json (generado en cada build desde
//     appVersion.ts, fuente única) dice cuál es la última versión.
//   · El APK compara ese código contra su versión instalada: si
//     hay una más nueva, avisa dentro de la app (tarjeta de
//     versión en Configuración) y con una notificación local.
//   · La descarga abre el navegador en el APK más reciente de
//     GitHub (releases/latest): al terminar, Android pide
//     confirmar la instalación. Sin Play Store no existe la
//     instalación en silencio — Android no la permite a apps de
//     fuera de la tienda — pero el chequeo y el aviso sí son
//     automáticos.
//
// Chequeo automático: al abrir la app, a lo más una vez cada 24 h
// (marca de tiempo en localStorage). El botón de la tarjeta no
// tiene throttle: es una revisión manual.
// ============================================================

import { APP_VERSION, APP_VERSION_CODE } from "./appVersion";
import { isNativeApp } from "./rideNative";
import { notificarNuevaVersion } from "./notificaciones";

export interface EstadoActualizacion {
  estado: "al-dia" | "nueva" | "error";
  versionNueva?: string;
  urlDescarga?: string;
}

const CLAVE = "cumbre30-upd-v1";
const ORIGEN = "https://cumbregeo.cl";
const THROTTLE_MS = 24 * 3_600_000; // chequeo automático: 1 vez al día
const ID_NOTIF = 1003; // sincronizado con ID_ACTUALIZACION (notificaciones.ts)

/** APK vigente de GitHub (releases/latest): siempre apunta a la
 *  última release publicada, sin cambiar la URL. */
export const URL_DESCARGA =
  "https://github.com/cumbre30/cumbre30/releases/latest/download/cumbre30-latest.apk";

interface Registro {
  version?: string; // última versión nueva detectada (si != instalada)
  url?: string;
  ts?: number; // último chequeo (auto y manual)
  notificado?: string; // versión ya avisada por notificación
}

function leer(): Registro {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || "{}") as Registro;
  } catch {
    return {};
  }
}

function guardar(r: Registro): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(r));
  } catch {
    /* almacenamiento no disponible: el chequeo igual funciona */
  }
}

/** Última versión nueva detectada (para pintar la tarjeta sin red,
 *  p. ej. al reabrir la app tras el aviso de ayer). */
export function nuevaConocida(): { version: string; url: string } | null {
  const r = leer();
  if (r.version && r.version !== APP_VERSION) return { version: r.version, url: r.url || URL_DESCARGA };
  return null;
}

/** Consulta la web desplegada y compara contra la versión instalada. */
export async function revisarActualizacion(): Promise<EstadoActualizacion> {
  try {
    const res = await fetch(`${ORIGEN}/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const v = (await res.json()) as { version?: string; code?: number; url?: string };
    if (typeof v.version !== "string" || typeof v.code !== "number") throw new Error("version.json inválido");
    if (v.code > APP_VERSION_CODE) {
      const url = v.url || URL_DESCARGA;
      const r = leer();
      guardar({ version: v.version, url, ts: Date.now(), notificado: r.notificado });
      return { estado: "nueva", versionNueva: v.version, urlDescarga: url };
    }
    guardar({ ts: Date.now() }); // al día: limpia cualquier aviso viejo
    return { estado: "al-dia" };
  } catch {
    return { estado: "error" };
  }
}

/** Chequeo automático al abrir (solo APK, a lo más 1 vez al día).
 *  Si hay versión nueva y no se ha avisado de esa versión, dispara
 *  la notificación local. */
export async function autoCheckAlAbrir(): Promise<void> {
  if (!isNativeApp()) return;
  const r = leer();
  if (r.ts && Date.now() - r.ts < THROTTLE_MS) return;
  const e = await revisarActualizacion();
  if (e.estado !== "nueva" || !e.versionNueva) return;
  const actual = leer();
  if (actual.notificado === e.versionNueva) return;
  await notificarNuevaVersion(e.versionNueva);
  guardar({
    version: e.versionNueva,
    url: e.urlDescarga,
    ts: Date.now(),
    notificado: e.versionNueva,
  });
}

/** Abre el navegador del sistema para descargar el APK vigente. */
export function abrirDescarga(url: string): void {
  try {
    const a = document.createElement("a");
    a.href = url || URL_DESCARGA;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    /* sin navegador disponible: nada que hacer */
  }
}

/** Tocar la notificación de actualización abre la descarga (APK).
 *  Se registra una sola vez, al abrir la app. */
let toqueRegistrado = false;
export function registrarToqueActualizacion(): void {
  if (!isNativeApp() || toqueRegistrado) return;
  toqueRegistrado = true;
  void import("@capacitor/local-notifications")
    .then(({ LocalNotifications }) =>
      LocalNotifications.addListener("localNotificationActionPerformed", (n) => {
        if (n.notification.id === ID_NOTIF) abrirDescarga(nuevaConocida()?.url || URL_DESCARGA);
      }),
    )
    .catch(() => {});
}
