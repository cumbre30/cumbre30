"use client";

// Sincronización local→servidor: sube el ride guardado y registra
// logros nuevos. Silencioso: si no hay sesión o conexión, no hace nada.

import { historyStore, type RideSummary } from "@/lib/history";
import { evaluateAchievements, statsFromRides } from "@/lib/pins";
import { refreshMe } from "@/hooks/useMe";

export async function syncRideAfterSave(summary: RideSummary): Promise<void> {
  try {
    const r = await fetch("/api/rides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summary),
    });
    if (!r.ok) return; // sin sesión o sin conexión

    const me = await refreshMe();
    const stats = statsFromRides(historyStore.get());
    const codes = evaluateAchievements(stats);
    const have = new Set(me?.achievements.map((a) => a.code) ?? []);
    for (const code of codes) {
      if (!have.has(code)) {
        try {
          await fetch("/api/achievements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
        } catch {
          // sin conexión
        }
      }
    }
    await refreshMe();
  } catch {
    // modo offline: el ride queda guardado localmente
  }
}
