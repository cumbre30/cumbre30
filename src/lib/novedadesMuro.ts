"use client";

// ============================================================
// Novedades del muro en MIS rutas guardadas (propuesta Pro, Grupo D):
// al abrir la app y al entrar a la subsección Experiencias se consulta
// cuántas experiencias nuevas hay en las rutas que tengo como
// favoritas desde la última visita (c30.muro.vistoAt). Beneficio Pro:
// sin plan devuelve 0 sin llamar a la API. La notificación nativa es
// solo APK (mismo patrón que actualizacion.ts); en web queda la
// etiqueta dentro del muro.
// ============================================================

import { t } from "@/lib/i18n";
import { isProActive } from "@/lib/proLicense";
import { serverToken } from "@/lib/cloudSync";
import { isNativeApp } from "@/lib/rideNative";
import { novedadesMuro } from "@/lib/rutasApi";

const LS_VISTO = "c30.muro.vistoAt";
const LS_NUEVAS = "c30.muro.nuevas";

function vistoAt(): string {
  try {
    const v = window.localStorage.getItem(LS_VISTO);
    if (v) return v;
  } catch {
    // sin almacenamiento: primera visita
  }
  const ahora = new Date().toISOString();
  try {
    window.localStorage.setItem(LS_VISTO, ahora);
  } catch {
    // idem
  }
  return ahora;
}

/** Experiencias nuevas pendientes en rutas guardadas (Pro). */
export async function chequearNovedadesMuro(): Promise<number> {
  try {
    if (!isProActive() || !serverToken()) return 0;
    const r = await novedadesMuro(vistoAt());
    if (!r.ok || !r.permitido) return 0;
    const total = r.total ?? 0;
    try {
      window.localStorage.setItem(LS_NUEVAS, String(total));
    } catch {
      // idem
    }
    if (total > 0 && isNativeApp()) void notificarNativas(total);
    return total;
  } catch {
    return 0;
  }
}

/** El usuario vio el muro: se cierra el contador de pendientes. */
export function marcarMuroVisto(): void {
  try {
    window.localStorage.setItem(LS_VISTO, new Date().toISOString());
    window.localStorage.setItem(LS_NUEVAS, "0");
  } catch {
    // sin almacenamiento: nada que cerrar
  }
}

/** Pendientes conocidos de esta apertura (sin consulta). */
export function novedadesPendientes(): number {
  try {
    return Number(window.localStorage.getItem(LS_NUEVAS) ?? "0") || 0;
  } catch {
    return 0;
  }
}

async function notificarNativas(total: number): Promise<void> {
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 931,
          title: "Cumbre30",
          body: t("ex.muroNovedades", total),
          schedule: { at: new Date(Date.now() + 1_000) },
        },
      ],
    });
  } catch {
    // web o sin permisos: la etiqueta del muro basta
  }
}
