// ============================================================
// Puente hacia el plugin nativo RideNative:
//   • GPS en primer plano (FGS tipo LOCATION a 1 Hz) - sigue
//     activo con la pantalla bloqueada o cambiando de app.
//   • Hápticos nativos (VibratorManager / VibrationEffect).
// En la web no se usa: useRideEngine cae a navigator.geolocation
// y navigator.vibrate.
// ============================================================

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/** Fix nativo a 1 Hz (speed en m/s; negativo = señal Doppler inválida). */
export interface NativeFix {
  lat: number;
  lng: number;
  speed: number;
  accuracy: number;
  bearing: number;
  alt: number;
  t: number;
}

export interface RideNativePluginInterface {
  startLocation(): Promise<void>;
  stopLocation(): Promise<void>;
  isLocationRunning(): Promise<{ running: boolean }>;
  /** Waveform de vibración: pattern [pausa, vibra, pausa, vibra…],
   *  repeat = índice donde loopea (-1 = una sola vez, 0 = infinito). */
  vibrate(o: { pattern: number[]; repeat?: number }): Promise<void>;
  vibrateCancel(): Promise<void>;
  addListener(eventName: "gpsfix", cb: (fix: NativeFix) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
  // Música (v1.12.3): sesiones de media de otras apps (Spotify,
  // YouTube Music, reproductores locales…). Mecanismo nativo, sin
  // API remota ni cuentas: igual que los botones de los audífonos.
  mediaPermitido(): Promise<{ granted: boolean }>;
  abrirAjustesMedia(): Promise<void>;
  mediaSesiones(): Promise<{ granted: boolean; sesiones: MediaSesion[] }>;
  mediaAccion(o: { id: string; accion: AccionMedia }): Promise<void>;
}

/** Sesión de media activa (v1.12.3): la que publica una app de
 *  música (Spotify, YouTube Music, reproductor local, …). */
export interface MediaSesion {
  id: string; // paquete de la app (ej. com.spotify.music)
  app: string; // nombre legible (ej. "Spotify")
  pista: string;
  artista: string;
  tocando: boolean;
}

export type AccionMedia = "toggle" | "play" | "pause" | "siguiente" | "anterior";

export const RideNative = registerPlugin<RideNativePluginInterface>("RideNative");

/** Subconjunto del handle de listener que guardamos en el engine ref. */
export type PluginListenerHandleLike = Pick<PluginListenerHandle, "remove">;

/** true solo dentro del APK nativo (Android por ahora). */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** ¿Cumbre30 ya tiene el acceso a notificaciones que Android exige
 *  para ver y controlar las sesiones de media de otras apps?
 *  En la web siempre false (el panel de música no se muestra). */
export async function mediaPermitido(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    return (await RideNative.mediaPermitido()).granted;
  } catch {
    return false;
  }
}

/** Sesiones de media activas del teléfono. permitido=false cuando
 *  falta el acceso a notificaciones. */
export async function mediaSesiones(): Promise<{ permitido: boolean; sesiones: MediaSesion[] }> {
  if (!isNativeApp()) return { permitido: false, sesiones: [] };
  try {
    const r = await RideNative.mediaSesiones();
    return { permitido: r.granted, sesiones: r.sesiones ?? [] };
  } catch {
    return { permitido: false, sesiones: [] };
  }
}

/** Envia un comando de transporte a la sesión indicada. */
export async function mediaAccion(id: string, accion: AccionMedia): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await RideNative.mediaAccion({ id, accion });
  } catch {
    /* sesión desapareció o app no responde: el panel refresca estado */
  }
}

/** Abre el ajuste de Android «Acceso a las notificaciones». */
export function abrirAjustesMedia(): void {
  if (!isNativeApp()) return;
  void RideNative.abrirAjustesMedia().catch(() => {});
}
