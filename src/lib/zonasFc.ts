"use client";

// ============================================================
// Zonas de esfuerzo por frecuencia cardíaca (Ola 1).
// ------------------------------------------------------------
// sensors.ts ya entrega los bpm del monitor Bluetooth; este módulo
// los convierte en zonas de esfuerzo (Karvonen) y acumula las
// estadísticas del ride (promedio, máximo y tiempo por zona).
//
//   %FC reserva = (bpm − reposo) / (máxima − reposo)
//   Z1 <60% · Z2 60-70% · Z3 70-80% · Z4 80-90% · Z5 ≥90%
//
// Sin dependencias del DOM salvo localStorage para la config:
// corre en la app y en pruebas.
// ============================================================

import { t } from "./i18n";

const LS_KEY = "cumbre30-fc-v1";

export type FcConfig = {
  maxBpm: number; // FC máxima estimada o medida (120-230)
  reposoBpm: number; // FC en reposo (30-120)
};

const DEFECTO: FcConfig = { maxBpm: 190, reposoBpm: 60 };

export function getFcConfig(): FcConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<FcConfig>;
      const maxBpm = Number(d.maxBpm);
      const reposoBpm = Number(d.reposoBpm);
      return {
        maxBpm: maxBpm >= 120 && maxBpm <= 230 ? maxBpm : DEFECTO.maxBpm,
        reposoBpm: reposoBpm >= 30 && reposoBpm <= 120 ? reposoBpm : DEFECTO.reposoBpm,
      };
    }
  } catch {
    // sin almacenamiento disponible
  }
  return { ...DEFECTO };
}

export function saveFcConfig(cfg: FcConfig): FcConfig {
  const clean: FcConfig = {
    maxBpm: cfg.maxBpm >= 120 && cfg.maxBpm <= 230 ? Math.round(cfg.maxBpm) : DEFECTO.maxBpm,
    reposoBpm: cfg.reposoBpm >= 30 && cfg.reposoBpm <= 120 ? Math.round(cfg.reposoBpm) : DEFECTO.reposoBpm,
  };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(clean));
  } catch {
    // sin almacenamiento disponible
  }
  return clean;
}

export type ZonaId = 1 | 2 | 3 | 4 | 5;

export const ZONA_RANGOS: { id: ZonaId; desde: number; hasta: number }[] = [
  { id: 1, desde: 0, hasta: 0.6 },
  { id: 2, desde: 0.6, hasta: 0.7 },
  { id: 3, desde: 0.7, hasta: 0.8 },
  { id: 4, desde: 0.8, hasta: 0.9 },
  { id: 5, desde: 0.9, hasta: Infinity },
];

export function zonaLabel(id: ZonaId): string {
  return t(`zonaFc.z${id}`);
}

export function zonaDesc(id: ZonaId): string {
  return t(`zonaFc.z${id}Desc`);
}

/** Zona (1-5) por Karvonen a partir de los bpm actuales. */
export function zonaOfBpm(bpm: number, cfg: FcConfig): ZonaId {
  const reserva = Math.max(20, cfg.maxBpm - cfg.reposoBpm);
  const pct = (bpm - cfg.reposoBpm) / reserva;
  for (const z of ZONA_RANGOS) {
    if (pct < z.hasta) return z.id;
  }
  return 5;
}

// ---------- acumulador del ride ----------

/** Acumula bpm, promedio, máximo y tiempo por zona durante el ride.
 *  update() recibe cada lectura del sensor (~1/s). */
export class HrTracker {
  private n = 0;
  private suma = 0;
  private max = 0;
  private ultima: number | null = null;
  private tiempoPorZona: Record<ZonaId, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  private zonaActual: ZonaId | null = null;
  private tiempoZonaActual = 0;

  reset(): void {
    this.n = 0;
    this.suma = 0;
    this.max = 0;
    this.ultima = null;
    this.tiempoPorZona = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    this.zonaActual = null;
    this.tiempoZonaActual = 0;
  }

  /** Procesa una lectura y devuelve la zona en la que quedó (para voz). */
  update(bpm: number, cfg: FcConfig): ZonaId {
    this.n += 1;
    this.suma += bpm;
    if (bpm > this.max) this.max = bpm;
    const z = zonaOfBpm(bpm, cfg);
    this.tiempoPorZona[z] += 1; // ~1 s por lectura
    if (z === this.zonaActual) {
      this.tiempoZonaActual += 1;
    } else {
      this.zonaActual = z;
      this.tiempoZonaActual = 0;
    }
    this.ultima = bpm;
    return z;
  }

  get zona(): ZonaId | null {
    return this.zonaActual;
  }
  /** Segundos sin cambiar de zona (para avisar "ya llevas X en Z4"). */
  get segundosEnZona(): number {
    return this.tiempoZonaActual;
  }
  get maxBpm(): number {
    return this.max;
  }
  get promedioBpm(): number {
    return this.n > 0 ? Math.round(this.suma / this.n) : 0;
  }
  get lecturas(): number {
    return this.n;
  }
  get tiempos(): Record<ZonaId, number> {
    return { ...this.tiempoPorZona };
  }
  get ultimoBpm(): number | null {
    return this.ultima;
  }
}
