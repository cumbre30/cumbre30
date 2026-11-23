"use client";

// Estado de sesión compartido: /api/me con caché de módulo +
// useSyncExternalStore para consumirlo sin efectos problemáticos.
// En el APK (export estático) todo va por offlineAuth (localStorage).

import { useSyncExternalStore } from "react";
import { isOfflineMode, offlineActualizarEspejoPassword, offlineCambiarPassword, offlineChangeUsername, offlineDeleteAccount, offlineForgotReset, offlineGoogleSignIn, offlineImportWebAccount, offlineLogin, offlineLogout, offlineMe, offlineRegister, offlineSetPasswordNueva } from "@/lib/offlineAuth";
import { cambiarPasswordServidor, passwordInicialServidor, serverToken, forgetToken, setServerToken, syncNow } from "@/lib/cloudSync";
import { apiUrl } from "@/lib/backend";
import { notificarBienvenida } from "@/lib/notificaciones";
import { t } from "@/lib/i18n";

export type MeUser = {
  id: string;
  email: string;
  username: string;
  /** Última vez que cambió su nombre de usuario (regla: 1 vez cada 30 días). */
  usernameChangedAt?: string | null;
  selectedPin: string;
  bikeBrand: string | null;
  bikeType: string | null;
  bikeModel: string | null;
  bikeSize: string | null;
  bikeColor: string | null;
  /** Pesos del conjunto (v1.13.17): respaldo en cuenta de los que usa
   *  el dispositivo (localStorage) para estimar watts en subida. */
  riderWeightKg?: number | null;
  bikeWeightKg?: number | null;
  /** Solo APK (cuenta local): código para restablecer la contraseña sin perder datos. */
  recoveryCode?: string | null;
};

export type MeStats = {
  totalKm: number;
  rideCount: number;
  maxKmh: number;
  totalGainM: number;
  parkRides: number;
  cleanParkRides: number;
  nightRides: number;
  dawnRides: number;
  /** Mayor distancia en un solo ride (km). */
  maxRideKm: number;
  /** Rides de sábado o domingo. */
  weekendRides: number;
  /** Horas totales pedaleadas. */
  totalHours: number;
  /** Km pedaleados dentro del parque (Serie Metropolitana). */
  totalParkKm: number;
  lastRideDate: string | null;
  incidentCount: number;
};

export type MeFriend = {
  username: string;
  selectedPin: string;
  totalKm: number;
  totalGainM: number;
  maxKmh: number;
  rideCount: number;
  achievementCount?: number;
  lastRideDate: string | null;
};

export type MeData = {
  user: MeUser;
  stats: MeStats;
  achievements: { code: string; unlockedAt: string }[];
  pins: string[];
  friends: MeFriend[];
};

let cache: MeData | null = null;
let ready = false;
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

function notify() {
  for (const l of listeners) l();
}

export function refreshMe(): Promise<MeData | null> {
  if (!inflight) {
    if (isOfflineMode()) {
      // APK: sin servidor. Reconstruye MeData desde localStorage.
      inflight = Promise.resolve().then(() => {
        cache = offlineMe();
      })
        .catch(() => {
          cache = null;
        })
        .finally(() => {
          ready = true;
          inflight = null;
          notify();
        });
      return inflight.then(() => cache);
    }
    inflight = fetch("/api/me", { cache: "no-store" })
      .then(async (r) => {
        cache = r.ok ? ((await r.json()) as MeData) : null;
      })
      .catch(() => {
        cache = null;
      })
      .finally(() => {
        ready = true;
        inflight = null;
        notify();
      });
  }
  return inflight.then(() => cache);
}

// --- Bienvenida al crear cuenta (v1.14.1) ---
// Se marca en ambos modos (web /api/auth/register y APK localRegister).
// La tarjeta de bienvenida en Cuenta › Mis datos la lee y la borra al
// cerrarla; la notificación local (APK) complementa fuera de la app.
const WELCOME_KEY = "c30.bienvenida";

/** Marca la bienvenida de la cuenta recién creada y dispara la
 *  notificación local nativa (solo APK, silenciosa si no hay permiso). */
function marcarBienvenida(nombre: string): void {
  try {
    localStorage.setItem(WELCOME_KEY, nombre || "");
  } catch {
    // sin localStorage: la tarjeta no se mostrará, no es crítico
  }
  void notificarBienvenida(nombre);
}

/** Nombre guardado por marcarBienvenida (null si no hay bienvenida pendiente). */
export function leerBienvenida(): string | null {
  try {
    return localStorage.getItem(WELCOME_KEY);
  } catch {
    return null;
  }
}

/** Cierra la bienvenida (al tocar el botón de la tarjeta). */
export function limpiarBienvenida(): void {
  try {
    localStorage.removeItem(WELCOME_KEY);
  } catch {
    // nada que limpiar
  }
}

export async function authAction(kind: "login" | "register", payload: Record<string, unknown>): Promise<string | null> {
  try {
    if (isOfflineMode()) {
      // La cuenta local solo necesita credenciales; los flags de
      // términos y edad ya fueron validados en el formulario.
      const credenciales = {
        email: String(payload.email ?? ""),
        username: String(payload.username ?? ""),
        password: String(payload.password ?? ""),
      };
      const err = kind === "login" ? await offlineLogin(credenciales) : await offlineRegister(credenciales);
      if (err) {
        // APK: si el correo no existe en el teléfono puede ser una
        // cuenta creada en la web (o en otro dispositivo): la cuenta
        // vive en el servidor y el teléfono solo guarda un espejo.
        // Con internet la verificamos contra el servidor e importamos.
        const imp = kind === "login" ? await offlineImportWebAccount(payload) : { ok: false, sinContrasena: false };
        if (imp.ok) {
          await refreshMe();
          return null;
        }
        if (imp.sinContrasena) {
          // El servidor conoce la cuenta (creada con Google) pero no
          // tiene contraseña: la guía real es Google o el código por correo.
          return t("pf.googleSinPassShort");
        }
        return err;
      }
      // Bienvenida ANTES de refreshMe(): el cambio de sesión dispara el
      // efecto que lee el flag en Cuenta › Mis datos; si se escribiera
      // después, la tarjeta lo vería vacío (carrera de render).
      if (kind === "register") marcarBienvenida(credenciales.username);
      await refreshMe();
      return null;
    }
    const r = await fetch(`/api/auth/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await r.json()) as { error?: string };
    if (!r.ok) return data.error ?? t("me.errInesperado");
    if (kind === "register") marcarBienvenida(String(payload.username ?? ""));
    await refreshMe();
    return null;
  } catch {
    return t("me.sinConexion");
  }
}

/** Inicio de sesión con Google (solo APK): enlaza/crea la cuenta local y refresca el estado.
 *  El idToken del plugin nativo viaja junto: offlineGoogleSignIn lo canjea por un token
 *  de sesión del servidor (linkGoogle) - es lo que une la cuenta Google con la web.
 *  Devuelve también `nueva`: la UI muestra de inmediato el paso «Crea tu contraseña». */
export async function googleAuthAction(acct: { sub: string; email: string; name?: string; idToken?: string; aceptacion?: { terminos: boolean; edad14: boolean } }): Promise<{ err: string | null; nueva: boolean }> {
  try {
    if (!isOfflineMode()) {
      return { err: t("me.googleSoloApp"), nueva: false };
    }
    const r = await offlineGoogleSignIn(acct, acct.aceptacion);
    if (r.err) return { err: r.err, nueva: false };
    await refreshMe();
    return { err: null, nueva: r.nueva };
  } catch {
    return { err: t("me.googleErr"), nueva: false };
  }
}

/** Paso «Crea tu contraseña» tras el primer ingreso con Google:
 *  la fija en el servidor (sesión recién canjeada) y, en el APK,
 *  también en la cuenta local del teléfono. */
export async function crearPasswordInicial(password: string): Promise<string | null> {
  if (password.length < 8) return t("me.passCorta");
  if (!isOfflineMode()) {
    try {
      const r = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) return d.error ?? t("me.errInesperado");
      return null;
    } catch {
      return t("me.sinConexion");
    }
  }
  const errLocal = await offlineSetPasswordNueva(password, true);
  if (errLocal) return errLocal;
  return await passwordInicialServidor(password);
}

/** Cambia la contraseña conociendo la actual (Cuenta → Gestionar).
 *  En el APK va primero al servidor (con el token) y solo si quedó
 *  aplicado toca la cuenta local, para no desincronizar ambas. */
export async function cambiarPassword(passwordActual: string, passwordNueva: string): Promise<string | null> {
  if (passwordNueva.length < 8) return t("me.passCorta");
  if (!isOfflineMode()) {
    try {
      const r = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordActual, passwordNueva }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) return d.error ?? t("me.errInesperado");
      return null;
    } catch {
      return t("me.sinConexionReintenta");
    }
  }
  const errSrv = await cambiarPasswordServidor(passwordActual, passwordNueva);
  if (errSrv) return errSrv;
  return await offlineCambiarPassword(passwordActual, passwordNueva);
}

/** Cambia el nombre de usuario (1 vez cada 30 días). Devuelve error o null. */
export async function changeUsername(newUsername: string): Promise<string | null> {
  try {
    if (isOfflineMode()) {
      const err = await offlineChangeUsername(newUsername);
      if (err) return err;
      await refreshMe();
      return null;
    }
    const r = await fetch("/api/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: newUsername }),
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return d.error ?? t("me.errUsuario");
    await refreshMe();
    return null;
  } catch {
    return t("me.sinConexionReintenta");
  }
}

/** Solicita el código de restablecimiento (server, llega al correo
 *  registrado). Web y APK por igual: la cuenta vive en el servidor.
 *  Sin backend configurado devuelve null (la UI sigue al paso del
 *  código de recuperación local del dispositivo). */
export async function forgotPassword(email: string): Promise<string | null> {
  try {
    const url = apiUrl("/api/auth/forgot");
    if (!url) return null;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(15_000),
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return d.error ?? t("me.errSolicitud");
    return null;
  } catch {
    return t("me.sinConexion");
  }
}

/** Cambia la contraseña con el código. Unificado: el código de 6
 *  dígitos del correo va al servidor (web y APK — el reset deja la
 *  sesión iniciada; en el APK además se crea el espejo local con la
 *  contraseña nueva). El código local XXXX-XXXX del dispositivo sigue
 *  sirviendo sin internet (solo APK). Devuelve error o null. */
export async function resetPassword(payload: { email: string; code: string; newPassword: string }): Promise<string | null> {
  try {
    const code = payload.code.trim().toUpperCase();
    const url = apiUrl("/api/auth/reset");
    if (/^\d{6}$/.test(code) && url) {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: payload.email, code, newPassword: payload.newPassword }),
        signal: AbortSignal.timeout(15_000),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; token?: string; expiresAt?: string };
      if (!r.ok) return d.error ?? t("me.errReset");
      if (isOfflineMode()) {
        // Espejo local con la contraseña nueva + token de sync: el
        // teléfono queda capaz de entrar sin internet desde ya.
        const importado = await offlineImportWebAccount({ email: payload.email, password: payload.newPassword });
        if (!importado.ok) {
          // El espejo ya existía (contraseñas divergentes: el caso que
          // dejaba la sync "unlinked" sin salida): alinea el espejo con
          // la contraseña nueva y toma el token de auto-login que el
          // reset devuelve para vincular el progreso de inmediato.
          const errEspejo = await offlineActualizarEspejoPassword(payload.email, payload.newPassword);
          if (errEspejo) return errEspejo;
        }
        if (typeof d.token === "string" && d.token) {
          setServerToken(d.token, payload.email.trim().toLowerCase(), d.expiresAt);
          void syncNow();
        }
      }
      await refreshMe(); // el reset dejó la sesión iniciada
      return null;
    }
    if (isOfflineMode()) {
      // Sin internet o código local XXXX-XXXX: recuperación del dispositivo.
      return await offlineForgotReset({ email: payload.email, recoveryCode: code, newPassword: payload.newPassword });
    }
    return t("me.errReset");
  } catch {
    return t("me.sinConexion");
  }
}

export async function logout(): Promise<void> {
  try {
    if (isOfflineMode()) {
      offlineLogout();
    } else {
      await fetch("/api/auth/logout", { method: "POST" });
    }
  } catch {
    // sin conexión
  }
  cache = null;
  ready = true;
  notify();
}

/**
 * Cierra TODAS las sesiones de la cuenta excepto la actual (C-02:
 * dispositivo perdido). Solo servidor; en el APK la cuenta local
 * no tiene sesiones remotas que revocar (salvo el token de sync,
 * que se renueva al entrar de nuevo). Devuelve cuántas cerró.
 */
export async function revokeOtherSessions(): Promise<number | null> {
  try {
    if (isOfflineMode()) return null;
    const r = await fetch("/api/auth/sessions", { method: "DELETE" });
    if (!r.ok) return null;
    const d = (await r.json()) as { revocadas?: number };
    return typeof d.revocadas === "number" ? d.revocadas : null;
  } catch {
    return null;
  }
}

/**
 * Baja definitiva de la cuenta (Google Play exige eliminación in-app).
 * Servidor: DELETE /api/auth/account (cascade en el schema) con cookie
 * (web) o Bearer (APK, vía apiUrl — el fetch relativo muere en el
 * webview). APK offline: offlineDeleteAccount borra cuenta, sesión,
 * rides y -si es la última cuenta del dispositivo- logros y licencia
 * Pro locales.
 */
export async function deleteAccount(): Promise<void> {
  try {
    if (isOfflineMode()) {
      offlineDeleteAccount();
    } else {
      const url = apiUrl("/api/auth/account");
      const token = serverToken();
      if (url) {
        await fetch(url, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          signal: AbortSignal.timeout(15_000),
        });
        if (token) forgetToken();
      }
    }
  } catch {
    // sin conexión
  }
  cache = null;
  ready = true;
  notify();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  if (!ready) void refreshMe();
  return () => listeners.delete(l);
}

function getSnapshot(): MeData | null {
  return cache;
}

export function useMe(): { me: MeData | null; ready: boolean; refresh: () => Promise<MeData | null> } {
  const me = useSyncExternalStore(subscribe, getSnapshot, () => null);
  return { me, ready, refresh: refreshMe };
}
