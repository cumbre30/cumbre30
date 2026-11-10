"use client";

// Estado de sesión compartido: /api/me con caché de módulo +
// useSyncExternalStore para consumirlo sin efectos problemáticos.
// En el APK (export estático) todo va por offlineAuth (localStorage).

import { useSyncExternalStore } from "react";
import { isOfflineMode, offlineChangeUsername, offlineDeleteAccount, offlineForgotReset, offlineGoogleSignIn, offlineLogin, offlineLogout, offlineMe, offlineRegister } from "@/lib/offlineAuth";

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

export async function authAction(kind: "login" | "register", payload: Record<string, string>): Promise<string | null> {
  try {
    if (isOfflineMode()) {
      const err = kind === "login" ? await offlineLogin(payload) : await offlineRegister(payload);
      if (err) return err;
      await refreshMe();
      return null;
    }
    const r = await fetch(`/api/auth/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await r.json()) as { error?: string };
    if (!r.ok) return data.error ?? "Error inesperado.";
    await refreshMe();
    return null;
  } catch {
    return "Sin conexión con el servidor.";
  }
}

/** Inicio de sesión con Google (solo APK): enlaza/crea la cuenta local y refresca el estado. */
export async function googleAuthAction(acct: { sub: string; email: string; name?: string }): Promise<string | null> {
  try {
    if (!isOfflineMode()) {
      return "El inicio con Google está disponible en la app Android.";
    }
    const err = await offlineGoogleSignIn(acct);
    if (err) return err;
    await refreshMe();
    return null;
  } catch {
    return "No pudimos completar el inicio con Google.";
  }
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
    if (!r.ok) return d.error ?? "No pudimos cambiar el nombre de usuario.";
    await refreshMe();
    return null;
  } catch {
    return "Sin conexión. Intenta de nuevo.";
  }
}

/** Solicita un código de restablecimiento (server). En offline no aplica:
 *  el APK usa el código de recuperación local desde la misma UI. */
export async function forgotPassword(email: string): Promise<string | null> {
  try {
    if (isOfflineMode()) return null;
    const r = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return d.error ?? "No pudimos registrar la solicitud.";
    return null;
  } catch {
    return "Sin conexión con el servidor.";
  }
}

/** Cambia la contraseña con el código: server (soporte) o código de
 *  recuperación local (APK). Devuelve error o null si salió bien. */
export async function resetPassword(payload: { email: string; code: string; newPassword: string }): Promise<string | null> {
  try {
    if (isOfflineMode()) {
      return await offlineForgotReset({ email: payload.email, recoveryCode: payload.code, newPassword: payload.newPassword });
    }
    const r = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return d.error ?? "No pudimos restablecer la contraseña.";
    return null;
  } catch {
    return "Sin conexión con el servidor.";
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
 * Baja definitiva de la cuenta (Google Play exige eliminación in-app).
 * Servidor: DELETE /api/auth/account (cascade en el schema). APK:
 * offlineDeleteAccount borra cuenta, sesión, rides y -si es la última
 * cuenta del dispositivo- logros y licencia Pro locales.
 */
export async function deleteAccount(): Promise<void> {
  try {
    if (isOfflineMode()) {
      offlineDeleteAccount();
    } else {
      await fetch("/api/auth/account", { method: "DELETE" });
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
