// ============================================================
// Puente hacia el plugin nativo RideNative:
//   • GPS en primer plano (FGS tipo LOCATION a 1 Hz) — sigue
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
}

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
