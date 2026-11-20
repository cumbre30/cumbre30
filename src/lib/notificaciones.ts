"use client";

// ============================================================
// Notificaciones locales (Ola 1) - solo APK nativo (Capacitor).
// ------------------------------------------------------------
// Los avisos operativos (avisos.json) y la voz viven mientras la
// app está abierta; con el teléfono guardado solo quedan las
// notificaciones locales programadas. Alcance Ola 1:
//
//   · Cierre del parque: aviso 30 min antes de las 20:30.
//   · Luces: aviso 45 min antes del atardecer (fiscalización).
//
// Ambas se recalculan al abrir la app (re-programar el mismo id
// sobrescribe) y funcionan sin conexión: el horario sale de
// horario.ts (cálculo offline NOAA + hora de Santiago).
// Web/PWA sin push queda para la Ola 2 (Web Push + VAPID).
// ============================================================

import { isNativeApp } from "./rideNative";
import { PARK_HOURS } from "./park";
import { minutosParaCierre, sunsetFor, horaSantiago } from "./horario";
import { t } from "./i18n";

type LocalNotificationsModule = typeof import("@capacitor/local-notifications");

let modPromise: Promise<LocalNotificationsModule | null> | null = null;

function loadModule(): Promise<LocalNotificationsModule | null> {
  if (!isNativeApp()) return Promise.resolve(null);
  if (!modPromise) {
    modPromise = import("@capacitor/local-notifications").catch(() => null);
  }
  return modPromise;
}

const ID_LUCES = 1001;
const ID_CIERRE = 1002;
const ID_ACTUALIZACION = 1003; // sincronizado con ID_NOTIF (actualizacion.ts)
const ID_BIENVENIDA = 1004; // cuenta recién creada (localRegister o /api/auth/register)
const VENTANA_MAX_H = 12; // no programar avisos de más de 12 h a futuro

/** Programa (o re-programa) los avisos locales del día del parque. */
export async function programarAvisoHorario(): Promise<void> {
  try {
    const mod = await loadModule();
    if (!mod) return;
    const perm = await mod.LocalNotifications.checkPermissions();
    if (perm.display !== "granted") {
      const req = await mod.LocalNotifications.requestPermissions();
      if (req.display !== "granted") return;
    }
    const now = Date.now();
    const notis: import("@capacitor/local-notifications").ScheduleOptions["notifications"] = [];

    // Luces: 45 min antes del atardecer de hoy (fiscalización al caer la tarde).
    const sunset = sunsetFor(new Date(now));
    const atLuces = sunset.getTime() - 45 * 60_000;
    if (atLuces - now > 5 * 60_000 && atLuces - now < VENTANA_MAX_H * 3_600_000) {
      notis.push({
        id: ID_LUCES,
        title: "Cumbre30",
        body: t("notif.luces", horaSantiago(sunset)),
        schedule: { at: new Date(atLuces), allowWhileIdle: true },
      });
    }

    // Cierre de ciclistas: 30 min antes (ingreso hasta las 20:30).
    const mCierre = minutosParaCierre(new Date(now));
    const cierreMin = PARK_HOURS.cierraMin;
    const hCierre = Math.floor(cierreMin / 60);
    const mMins = cierreMin % 60;
    if (mCierre > 30 && mCierre < VENTANA_MAX_H * 60) {
      const atCierre = now + (mCierre - 30) * 60_000;
      notis.push({
        id: ID_CIERRE,
        title: "Cumbre30",
        body: t("notif.cierre", `${String(hCierre).padStart(2, "0")}:${String(mMins).padStart(2, "0")}`),
        schedule: { at: new Date(atCierre), allowWhileIdle: true },
      });
    }

    if (notis.length > 0) {
      await mod.LocalNotifications.schedule({ notifications: notis });
    }
  } catch {
    // notificaciones no disponibles en esta sesión: silencio
  }
}

/** Aviso local «hay una versión nueva» (v1.12.4). Lo dispara el
 *  chequeo automático de actualizacion.ts (a lo más 1 vez al día).
 *  Sin permiso de notificaciones no hace nada: el aviso queda
 *  siempre en la tarjeta de versión de Configuración. Al tocarla
 *  abre la descarga (registrarToqueActualizacion). */
export async function notificarNuevaVersion(version: string): Promise<void> {
  try {
    const mod = await loadModule();
    if (!mod) return;
    const perm = await mod.LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;
    await mod.LocalNotifications.schedule({
      notifications: [
        {
          id: ID_ACTUALIZACION,
          title: "Cumbre30",
          body: t("act.notif", version),
          schedule: { at: new Date(Date.now() + 1_500), allowWhileIdle: true },
        },
      ],
    });
  } catch {
    // silencio: el aviso dentro de la app siempre está
  }
}

/** Bienvenida al crear cuenta (v1.14.1). Notificación local inmediata
 *  (solo APK; en web el aviso es la tarjeta de bienvenida de Cuenta).
 *  Sin permiso de notificaciones no hace nada: la tarjeta dentro de la
 *  app cubre ese caso. */
export async function notificarBienvenida(nombre: string): Promise<void> {
  try {
    const mod = await loadModule();
    if (!mod) return;
    const perm = await mod.LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;
    await mod.LocalNotifications.schedule({
      notifications: [
        {
          id: ID_BIENVENIDA,
          title: "Cumbre30",
          body: t("notif.bienvenida", nombre),
          schedule: { at: new Date(Date.now() + 1_500), allowWhileIdle: true },
        },
      ],
    });
  } catch {
    // silencio: la bienvenida dentro de la app siempre está
  }
}
