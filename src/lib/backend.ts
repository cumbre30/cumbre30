// ============================================================
// Origen del backend Cumbre30 (la web desplegada con las rutas /api).
// · En la WEB: "" → rutas relativas al mismo origen (cookies incluidas).
// · En el APK (export estático por Capacitor): las rutas /api NO existen
//   dentro del app (el webview sirve los archivos locales), así que toda
//   llamada a la API debe ir a la web desplegada. El origen se resuelve:
//   1. override guardado por la persona usuaria (Perfil → Servidor de cuenta)
//   2. constante horneada en el build NEXT_PUBLIC_BACKEND_ORIGIN
//   3. si no hay ninguna: null → la UI lo explica en vez de fallar con
//      un genérico "error de servidor".
// ============================================================

import { Capacitor } from "@capacitor/core";

const LS_KEY = "cumbre30_backend";

function clean(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

/** Origen horneado en el build (vacío si no se definió). */
export function bakedBackendOrigin(): string {
  return clean(process.env.NEXT_PUBLIC_BACKEND_ORIGIN ?? "");
}

/** Origen guardado por la persona usuaria en este dispositivo. */
export function userBackendOrigin(): string {
  try {
    return clean(window.localStorage.getItem(LS_KEY) ?? "");
  } catch {
    return "";
  }
}

export function setUserBackendOrigin(origin: string): void {
  try {
    const v = clean(origin);
    if (v) window.localStorage.setItem(LS_KEY, v);
    else window.localStorage.removeItem(LS_KEY);
  } catch {
    // sin localStorage disponible: no se puede persistir
  }
}

/**
 * Origen del backend para este contexto:
 * "" = mismo origen (web) · string = backend absoluto (APK) · null = sin
 * backend configurado (solo posible en el APK sin override ni build con
 * origen horneado).
 */
export function backendOrigin(): string | null {
  const user = userBackendOrigin();
  if (user) return user;
  const baked = bakedBackendOrigin();
  if (baked) return baked;
  if (!Capacitor.isNativePlatform()) return ""; // web: mismo origen
  return null;
}

/** URL completa para una ruta /api, o null si no hay backend configurado. */
export function apiUrl(path: string): string | null {
  const base = backendOrigin();
  if (base === null) return null;
  return `${base}${path}`;
}
