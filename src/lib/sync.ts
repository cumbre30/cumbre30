"use client";

// Sincronización local→servidor: sube el ride guardado y registra
// logros nuevos. Silencioso: si no hay sesión o conexión, no hace nada.
// En el APK (export estático) no hay servidor: los logros se evalúan
// y guardan localmente para que Retos/Pines funcionen igual.
//
// Vehículos motorizados: el ride sube con su flag `motorized`; si el
// usuario corrige ("fui en bici"), markRideAsBike quita el flag aquí
// y en el servidor (PATCH por clientId) y re-evalúa logros.

import { bikeOnly, historyStore, ridesForAccount, setRideMotorized, type RideSummary } from "@/lib/history";
import { isOfflineMode, offlineUnlockAchievements } from "@/lib/offlineAuth";
import { evaluateAchievements, statsFromRides } from "@/lib/pins";
import { isProActive } from "@/lib/proLicense";
import { refreshMe } from "@/hooks/useMe";

const AUTH_JSON = { "Content-Type": "application/json" };

/** Logros: evalúa contra el historial local (en bici) y registra los nuevos. */
async function evaluateOfflineAchievements(): Promise<void> {
  const me = await refreshMe();
  const stats = statsFromRides(
    bikeOnly(ridesForAccount(historyStore.get(), me?.user.email ?? null)),
  );
  const have = me?.achievements.map((a) => a.code) ?? [];
  const codes = evaluateAchievements(stats, have, { pro: isProActive() });
  if (codes.length) offlineUnlockAchievements(codes);
  await refreshMe();
}

/** Logros en el despliegue web: evalúa localmente y sube los nuevos. */
async function evaluateOnlineAchievements(): Promise<void> {
  const me = await refreshMe();
  const stats = statsFromRides(
    bikeOnly(ridesForAccount(historyStore.get(), me?.user.email ?? null)),
  );
  const have = me?.achievements.map((a) => a.code) ?? [];
  // La evaluación respeta el avance secuencial de las series y
  // traduce los códigos v1 a sus equivalentes actuales. Free/Pro:
  // sin licencia activa, los desafíos Pro no se desbloquean.
  const codes = evaluateAchievements(stats, have, { pro: isProActive() });
  const haveSet = new Set(have);
  for (const code of codes) {
    if (!haveSet.has(code)) {
      try {
        await fetch("/api/achievements", {
          method: "POST",
          headers: AUTH_JSON,
          body: JSON.stringify({ code }),
        });
      } catch {
        // sin conexión
      }
    }
  }
  await refreshMe();
}

export async function syncRideAfterSave(summary: RideSummary): Promise<void> {
  try {
    if (isOfflineMode()) {
      // APK: evalúa logros contra el historial local y guárdalos.
      await evaluateOfflineAchievements();
      return;
    }
    const r = await fetch("/api/rides", {
      method: "POST",
      headers: AUTH_JSON,
      body: JSON.stringify(summary),
    });
    if (!r.ok) return; // sin sesión o sin conexión
    await evaluateOnlineAchievements();
  } catch {
    // modo offline: el ride queda guardado localmente
  }
}

/**
 * El usuario confirmó que fue en bici: quita el flag de vehículo del
 * ride (local + servidor, por clientId) y re-evalúa logros con las
 * estadísticas corregidas. Si el ride nunca llegó al servidor (sin
 * sesión al grabar), la corrección es solo local, como el ride mismo.
 */
export async function markRideAsBike(summary: RideSummary): Promise<void> {
  setRideMotorized(summary.id, false);
  try {
    if (!isOfflineMode()) {
      await fetch("/api/rides", {
        method: "PATCH",
        headers: AUTH_JSON,
        body: JSON.stringify({ clientId: summary.id, motorized: false }),
      });
    }
  } catch {
    // sin conexión: la corrección queda local y el ride nunca subió
  }
  try {
    if (isOfflineMode()) await evaluateOfflineAchievements();
    else await evaluateOnlineAchievements();
  } catch {
    // la corrección del ride ya está aplicada
  }
}
