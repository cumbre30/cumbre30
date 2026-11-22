// ============================================================
// src/lib/simulation.ts - RideSimulator: simulador de recorridos
// para demo y pruebas. CIERRE DE FASE ÚNICA: la RUTA se INYECTA
// por parámetro y el simulador solo depende del NÚCLEO del motor
// (haversine de src/motor/geo.ts) — ya no importa park.ts ni
// lib/geo de la app. Cualquier proyecto construye sus propios
// waypoints; Cumbre30 le pasa SIM_ROUTE desde sus adaptadores
// (src/lib/fuentes-motor.ts).
// ============================================================

import { haversineM } from "../motor/geo";

/** Waypoint de la ruta simulada: posición, velocidad objetivo del
 *  tramo (km/h) y altitud (m). */
export type PuntoRutaSim = { lat: number; lon: number; kmh: number; alt: number };

/** Fix que entrega el simulador (velocidad ya en km/h del tramo). */
export type SimFix = { lat: number; lon: number; speedKmh: number; alt: number; accuracyM: number; t: number };

export type OpcionesSimulador = {
  ruta: PuntoRutaSim[];
  speedScale?: number;
  loop?: boolean;
  semilla?: number;
};

/**
 * Simulador determinista de un recorrido: interpola posición y
 * velocidad a lo largo de la ruta inyectada. Avanza `speedScale`
 * veces el tiempo real. Con `semilla`, las "corridas" son
 * reproducibles (tests motor-gps y proyecto independiente).
 */
export class RideSimulator {
  private ruta: PuntoRutaSim[];
  private cumulative: number[] = [];
  private totalDist = 0;
  private traveled = 0; // metros recorridos
  private simTime: number;
  private readonly speedScale: number;
  private loop: boolean;
  private rnd: () => number;

  constructor(opciones: OpcionesSimulador) {
    this.ruta = opciones.ruta;
    if (!Array.isArray(this.ruta) || this.ruta.length < 2) {
      // ruta trivial de 2 puntos en línea: el simulador nunca lanza
      this.ruta = [
        { lat: 0, lon: 0, kmh: 10, alt: 0 },
        { lat: 0, lon: 0.0001, kmh: 10, alt: 0 },
      ];
    }
    this.speedScale = opciones.speedScale ?? 6;
    this.loop = opciones.loop ?? true;
    this.simTime = Date.now();
    this.rnd = opciones.semilla === undefined ? Math.random : mulberry32(opciones.semilla);
    let acc = 0;
    this.cumulative.push(0);
    for (let i = 1; i < this.ruta.length; i++) {
      acc += haversineM(this.ruta[i - 1], this.ruta[i]);
      this.cumulative.push(acc);
    }
    this.totalDist = acc;
  }

  reset(): void {
    this.traveled = 0;
    this.simTime = Date.now();
  }

  /** Interpola la posición y velocidad a la distancia `d`. */
  private at(d: number): { lat: number; lon: number; kmh: number; alt: number } {
    const clamped = Math.max(0, Math.min(this.totalDist, d));
    let i = 1;
    while (i < this.cumulative.length - 1 && this.cumulative[i] < clamped) i++;
    const d0 = this.cumulative[i - 1];
    const d1 = this.cumulative[i];
    const f = d1 > d0 ? (clamped - d0) / (d1 - d0) : 0;
    const a = this.ruta[i - 1];
    const b = this.ruta[i];
    return {
      lat: a.lat + (b.lat - a.lat) * f,
      lon: a.lon + (b.lon - a.lon) * f,
      kmh: a.kmh + (b.kmh - a.kmh) * f,
      alt: a.alt + (b.alt - a.alt) * f,
    };
  }

  /** Avanza el tiempo simulado y entrega un fix. */
  tick(dtRealSec: number): SimFix {
    const dtSim = dtRealSec * this.speedScale;
    const here = this.at(this.traveled);
    const vms = (here.kmh * 1000) / 3600;
    this.traveled += vms * dtSim;
    if (this.traveled >= this.totalDist) {
      if (this.loop) this.traveled = 0;
      else this.traveled = this.totalDist;
    }
    this.simTime += dtSim * 1000;
    const now = this.at(this.traveled);
    const noise = (this.rnd() - 0.5) * 0.9; // ±0.45 km/h
    return {
      lat: now.lat + (this.rnd() - 0.5) * 0.00004,
      lon: now.lon + (this.rnd() - 0.5) * 0.00004,
      speedKmh: Math.max(0, now.kmh + noise),
      alt: now.alt + (this.rnd() - 0.5) * 0.8,
      accuracyM: 4 + this.rnd() * 3,
      t: this.simTime,
    };
  }

  get progressPct(): number {
    return (this.traveled / this.totalDist) * 100;
  }

  get totalKm(): number {
    return this.totalDist / 1000;
  }
}

/** PRNG mulberry32: pequeño, rápido y reproducible por semilla. */
function mulberry32(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
