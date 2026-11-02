// ============================================================
// Puente hacia el plugin nativo GoogleAuth (Android APK).
// Abre el selector de cuentas de Google y devuelve la cuenta.
// Sin Firebase ni servidor: el perfil se guarda en la auth offline
// (localStorage) igual que las cuentas por correo/contraseña.
//
// ⚠️ ÚNICO PASO DE CONFIGURACIÓN:
//   1. En Google Cloud Console crea un Client ID OAuth tipo
//      "Web application" (ver GUIA-GOOGLE-SIGNIN.md).
//   2. Pégalo aquí abajo en GOOGLE_WEB_CLIENT_ID y recompila.
// El botón avisa si falta configurarlo.
// ============================================================

import { Capacitor, registerPlugin } from "@capacitor/core";

export interface GoogleAcct {
  /** ID estable de la cuenta Google (claim "sub"). */
  sub: string;
  email: string;
  name: string;
  /** ID token JWT de Google (no se valida en línea: flujo 100% offline). */
  idToken: string;
  photoUrl?: string;
}

interface GoogleAuthPluginInterface {
  signIn(opts: { webClientId: string }): Promise<GoogleAcct>;
  signOut(): Promise<void>;
}

const GoogleAuth = registerPlugin<GoogleAuthPluginInterface>("GoogleAuth");

/**
 * Client ID OAuth de tipo "Web application" (mismo proyecto de Cloud
 * Console que el client "Android" con el SHA-1 de la APK).
 * Formato: "1234567890-abc123.apps.googleusercontent.com"
 * Proyecto Google Cloud: Cumbre30 (configurado por el dueño de la app).
 */
export const GOOGLE_WEB_CLIENT_ID =
  "1083733199182-gbe3bnj00bivr7la3d4s80r5av7r964e.apps.googleusercontent.com";

/** true solo dentro del APK y con el Client ID ya configurado. */
export function googleSignInReady(): boolean {
  try {
    return Capacitor.isNativePlatform() && GOOGLE_WEB_CLIENT_ID.length > 10;
  } catch {
    return false;
  }
}

/** Lanza el selector nativo de cuentas de Google. Lanza Error con mensaje en español si algo falla. */
export async function nativeGoogleSignIn(): Promise<GoogleAcct> {
  let isNative = false;
  try {
    isNative = Capacitor.isNativePlatform();
  } catch {
    isNative = false;
  }
  if (!isNative) {
    throw new Error("El inicio con Google está disponible en la app Android.");
  }
  if (GOOGLE_WEB_CLIENT_ID.length < 10) {
    throw new Error(
      "El inicio con Google aún no está activado: falta el Client ID. " +
        "Sigue la guía GUIA-GOOGLE-SIGNIN.md y pégalo en src/lib/googleAuth.ts."
    );
  }
  try {
    return await GoogleAuth.signIn({ webClientId: GOOGLE_WEB_CLIENT_ID });
  } catch (e) {
    const err = e as { message?: string };
    throw new Error(err?.message || "No pudimos iniciar sesión con Google.");
  }
}

/** Cierra la sesión en Google para que la próxima vez se vuelva a elegir cuenta. */
export async function nativeGoogleSignOut(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) await GoogleAuth.signOut();
  } catch {
    // silencioso: cerrar sesión de Google nunca debe bloquear el logout local
  }
}
