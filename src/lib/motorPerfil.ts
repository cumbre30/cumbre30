// ============================================================
// src/lib/motorPerfil.ts - perfil de actividad del CONSUMIDOR
// (Cumbre30) para el MotorGPS. Fase única (cierre): se movió desde
// src/motor/config.ts para que el núcleo del motor no contenga
// claves de producto ni persistencia propia — la app persiste SUS
// preferencias (localStorage) y las inyecta como config parcial.
// Otra aplicación que consuma el motor define su propio perfil.
// ============================================================

import { MOTOR_CONFIG_DEFECTO, type MotorConfig } from "@/motor/config";

export const LS_MOTOR_CFG = "cumbre30-motor-cfg-v1";

/** Lee la config parcial persistida de la app (o vacía si no hay). */
export function leerConfigMotor(): Partial<MotorConfig> {
  try {
    if (typeof window === "undefined" || !window.localStorage) return {};
    const raw = window.localStorage.getItem(LS_MOTOR_CFG);
    return raw ? (JSON.parse(raw) as Partial<MotorConfig>) : {};
  } catch {
    return {};
  }
}

/** ¿Auto-pausa activada? (perfil persistido; defecto: sí). */
export function autoPausaActivada(): boolean {
  const cfg = leerConfigMotor();
  return cfg.autoPausa ? cfg.autoPausa.activada !== false : true;
}

/** Cambia la auto-pausa del perfil persistido. */
export function setAutoPausaActivada(on: boolean): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const cfg = leerConfigMotor();
    const merged: Partial<MotorConfig> = {
      ...cfg,
      autoPausa: { ...MOTOR_CONFIG_DEFECTO.autoPausa, ...(cfg.autoPausa ?? {}), activada: on },
    };
    window.localStorage.setItem(LS_MOTOR_CFG, JSON.stringify(merged));
  } catch {
    // sin almacenamiento: la preferencia vive solo en esta sesión
  }
}
