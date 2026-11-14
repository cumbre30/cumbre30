"use client";

// ============================================================
// Detección de caída (2026-11-14, funcionalidad nueva).
// ------------------------------------------------------------
// El acelerómetro se retiró de la app (el WebView de Capacitor no
// entrega datos fiables de los sensores, ver useRideEngine §1), así
// que la detección es 100% GPS y funciona en cualquier dispositivo:
//
//   1) GOLPE: velocidad sostenida ≥ 12 km/h que cae a ≤ 3 km/h en
//      ≤ 4 s (frenado brusco).
//   2) INMOVILIDAD: durante los ~18 s siguientes la velocidad se
//      mantiene ≤ 2 km/h (≥ 70% de las muestras) y el desplazamiento
//      total es < 20 m.
//   3) Confirmación → la app abre "¿Estás bien?" con cuenta regresiva;
//      sin respuesta pasa a modo ayuda (SOS con ubicación).
//
// Anti-falsos positivos:
//   - Solo corre DENTRO de la geocerca del parque (el motor decide):
//     en la ciudad los frenados de semáforo son el ruido dominante.
//   - No se evalúa a menos de 60 m de un acceso (parar en la portería
//     es normal).
//   - Si el ciclista vuelve a pedalear (> 6 km/h) se cancela.
//   - Cooldown de 3 minutos tras cada alerta.
// Diseño conservador en consecuencias: el detector NUNCA decide por
// su cuenta; la UI pregunta, y el contacto con terceros es opt-in vía
// los contactos ICE del usuario (iceContacts.ts, Ola 1).
// ============================================================

import { GATES } from "./park";
import { haversineM } from "./geo";
import type { LatLng } from "./park";

// ---------- configuración persistente ----------

const LS_KEY = "cumbre30-fallcfg-v1";

export function fallConfigOn(): boolean {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw === null) return true; // activada por defecto
    return JSON.parse(raw).on !== false;
  } catch {
    return true;
  }
}

export function setFallConfigOn(on: boolean): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ on }));
  } catch {
    // sin almacenamiento disponible
  }
}

// Ventana de confirmación de estado (v1.12.1): tras confirmar la
// caída, el overlay "¿Estás bien?" espera este tiempo antes de pasar
// a ayuda automática (avisar contactos ICE si "Aviso al expirar").
// Diseño conservador: nunca se salta la pregunta, solo se ajusta
// cuánto se espera la respuesta del ciclista. Default 30 s.

const LS_CONFIRM = "cumbre30-fallconfirm-v1";
export const FALL_CONFIRM_SEGS = [15, 30, 60] as const;
export type FallConfirmSegs = (typeof FALL_CONFIRM_SEGS)[number];

export function fallConfirmSegs(): FallConfirmSegs {
  try {
    const v = Number(localStorage.getItem(LS_CONFIRM));
    if ((FALL_CONFIRM_SEGS as readonly number[]).includes(v)) return v as FallConfirmSegs;
    return 30;
  } catch {
    return 30;
  }
}

export function setFallConfirmSegs(segs: FallConfirmSegs): void {
  try {
    localStorage.setItem(LS_CONFIRM, String(segs));
  } catch {
    // sin almacenamiento disponible
  }
}

// ---------- detector ----------

export type FixLike = { lat: number; lon: number; speedKmh: number; t: number };
export type FallStatus = "idle" | "impact" | "still";

const WINDOW_S = 12; // ventana de velocidad para el golpe
const PEAK_MIN_KMH = 12; // velocidad mínima previa al golpe
const DROP_TO_KMH = 3; // velocidad tras el golpe
const DROP_MIN_KMH = 9; // caída mínima de velocidad
const IMPACT_WINDOW_S = 4; // el golpe ocurre dentro de esta ventana
const STILL_S = 18; // ventana de inmovilidad que confirma la caída
const STILL_SPEED_KMH = 2; // umbral de "sin avanzar"
const STILL_RATIO = 0.7; // proporción de muestras inmóvil
const STILL_MOVE_M = 20; // desplazamiento máximo durante la inmovilidad
const CANCEL_KMH = 6; // volvió a pedalear → cancelar
const COOLDOWN_MS = 180_000; // silencio tras una alerta
const GATE_DIST_M = 60; // no evaluar cerca de accesos
const MIN_SAMPLES = 6; // muestras mínimas para el análisis

export class FallDetector {
  private win: { t: number; v: number }[] = [];
  private impactAt: number | null = null;
  private stillN = 0;
  private totalN = 0;
  private movedM = 0;
  private lastPos: LatLng | null = null;
  private lastTrigger = 0;

  /** Limpia el estado (start / pausa / reanudar / fin). */
  reset(): void {
    this.win = [];
    this.impactAt = null;
    this.stillN = 0;
    this.totalN = 0;
    this.movedM = 0;
    this.lastPos = null;
    // lastTrigger NO se limpia: el cooldown sobrevive a pausas.
  }

  status(): FallStatus {
    if (this.impactAt !== null) return Date.now() - this.impactAt > 2500 ? "still" : "impact";
    return "idle";
  }

  private cercaDeAcceso(fix: FixLike): boolean {
    for (const g of GATES) {
      if (haversineM(fix, g.position) < GATE_DIST_M) return true;
    }
    return false;
  }

  /**
   * Procesa un fix GPS (1 Hz). Devuelve true SOLO cuando se confirma
   * la caída (golpe + inmovilidad); la UI debe mostrar entonces la
   * tarjeta "¿Estás bien?".
   */
  update(fix: FixLike): boolean {
    const t = fix.t;
    const v = Math.max(0, fix.speedKmh);

    // Cooldown: seguimos alimentando la ventana pero sin decidir nada.
    const enCooldown = t - this.lastTrigger < COOLDOWN_MS;

    this.win = this.win.filter((s) => t - s.t <= WINDOW_S * 1000);
    this.win.push({ t, v });

    if (enCooldown) return false;
    if (this.cercaDeAcceso(fix)) {
      this.impactAt = null;
      return false;
    }

    // ---- Fase 2: monitor de inmovilidad tras el golpe ----
    if (this.impactAt !== null) {
      const el = t - this.impactAt;
      if (v > CANCEL_KMH) {
        // Volvió a rodar: era una detención normal.
        this.impactAt = null;
        return false;
      }
      this.totalN += 1;
      if (v <= STILL_SPEED_KMH) this.stillN += 1;
      if (this.lastPos) {
        this.movedM += haversineM(this.lastPos, { lat: fix.lat, lon: fix.lon });
      }
      this.lastPos = { lat: fix.lat, lon: fix.lon };
      if (this.movedM > STILL_MOVE_M) {
        // Se desplazó a pie o empujando: no es una caída con ayuda urgente.
        this.impactAt = null;
        return false;
      }
      if (el >= STILL_S * 1000) {
        const inmobil = this.totalN >= 5 && this.stillN / Math.max(1, this.totalN) >= STILL_RATIO;
        this.impactAt = null;
        if (inmobil) {
          this.lastTrigger = t;
          return true;
        }
      }
      return false;
    }

    // ---- Fase 1: detección del golpe ----
    if (v <= DROP_TO_KMH && this.win.length >= MIN_SAMPLES) {
      let peak: { t: number; v: number } | null = null;
      let sostenidos = 0;
      for (const s of this.win) {
        if (s.v >= PEAK_MIN_KMH - 4) sostenidos += 1;
        if (t - s.t <= IMPACT_WINDOW_S * 1000 && (peak === null || s.v > peak.v)) peak = s;
      }
      if (
        peak &&
        peak.v >= PEAK_MIN_KMH &&
        peak.v - v >= DROP_MIN_KMH &&
        t - peak.t >= 800 && // no es un ruido de un solo fix
        sostenidos >= 3 // venía rodando de verdad
      ) {
        // Golpe: frenó de golpe desde velocidad de pedaleo.
        this.impactAt = t;
        this.stillN = v <= STILL_SPEED_KMH ? 1 : 0;
        this.totalN = 1;
        this.movedM = 0;
        this.lastPos = { lat: fix.lat, lon: fix.lon };
      }
    }
    return false;
  }
}
