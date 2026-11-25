// ============================================================
// Puente hacia el plugin nativo SpotifyNative (v1.28.0):
// control de la reproducción de Spotify vía App Remote SDK.
//   · conectar() → la app de Spotify muestra SU diálogo de
//     autorización una vez; luego queda enlazada por servicio.
//   · Evento "spotifyEstado" en cada cambio del reproductor.
//   · Sin permisos de notificaciones: nada que Play Protect
//     pueda marcar como fraude.
// En la web no se usa: el panel solo se renderiza en el APK
// (SpotifyPanel comprueba isNativeApp).
// ============================================================

import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface SpotifyEstado {
  instalada: boolean;
  conectado: boolean;
  pista: string;
  artista: string;
  album: string;
  uri: string;
  tocando: boolean;
  posicionMs: number;
  duracionMs: number;
}

export type AccionSpotify = "toggle" | "play" | "pause" | "siguiente" | "anterior";

export type MotivoSpotify =
  | "ok"
  | "sinConfig"
  | "sinApp"
  | "sinSesion"
  | "autorizacion"
  | "desconectado"
  | "error";

export interface SpotifyNativePluginInterface {
  instalada(): Promise<{ instalada: boolean }>;
  conectar(o: { clientId: string; redirectUri: string }): Promise<{ ok: boolean; motivo: MotivoSpotify; detalle?: string }>;
  desconectar(): Promise<void>;
  estado(): Promise<SpotifyEstado>;
  accion(o: { accion: AccionSpotify }): Promise<{ ok: boolean; motivo?: MotivoSpotify }>;
  addListener(eventName: "spotifyEstado", cb: (estado: SpotifyEstado) => void): Promise<PluginListenerHandle>;
}

export const SpotifyNative = registerPlugin<SpotifyNativePluginInterface>("SpotifyNative");

/** Estado vacío para la web / errores de la llamada. */
export function spotifyEstadoVacio(): SpotifyEstado {
  return { instalada: false, conectado: false, pista: "", artista: "", album: "", uri: "", tocando: false, posicionMs: 0, duracionMs: 0 };
}

/** ¿Spotify está instalada en el teléfono? Web → false. */
export async function spotifyInstalada(): Promise<boolean> {
  try {
    const { isNativeApp } = await import("@/lib/rideNative");
    if (!isNativeApp()) return false;
    return (await SpotifyNative.instalada()).instalada;
  } catch {
    return false;
  }
}

/** Conecta con Spotify (dispara su diálogo de autorización si falta). */
export async function spotifyConectar(clientId: string, redirectUri: string): Promise<{ ok: boolean; motivo: MotivoSpotify; detalle?: string }> {
  try {
    const { isNativeApp } = await import("@/lib/rideNative");
    if (!isNativeApp()) return { ok: false, motivo: "error" };
    return await SpotifyNative.conectar({ clientId, redirectUri });
  } catch {
    return { ok: false, motivo: "error" };
  }
}

/** Estado actual del reproductor (web → estado vacío). */
export async function spotifyEstado(): Promise<SpotifyEstado> {
  try {
    const { isNativeApp } = await import("@/lib/rideNative");
    if (!isNativeApp()) return spotifyEstadoVacio();
    return { ...spotifyEstadoVacio(), ...(await SpotifyNative.estado()) };
  } catch {
    return spotifyEstadoVacio();
  }
}

/** Comando de transporte (toggle/play/pause/siguiente/anterior). */
export async function spotifyAccion(accion: AccionSpotify): Promise<void> {
  try {
    await SpotifyNative.accion({ accion });
  } catch {
    /* conexión cortada: el panel refresca estado al volver */
  }
}

/** Suelta la conexión con Spotify (se reconecta a demanda). */
export async function spotifyDesconectar(): Promise<void> {
  try {
    await SpotifyNative.desconectar();
  } catch {
    /* nada */
  }
}

/** Suscripción a los cambios del reproductor que llegan del nativo. */
export async function onSpotifyEstado(cb: (estado: SpotifyEstado) => void): Promise<PluginListenerHandle | null> {
  try {
    return await SpotifyNative.addListener("spotifyEstado", (s: SpotifyEstado) => cb(s));
  } catch {
    return null;
  }
}
