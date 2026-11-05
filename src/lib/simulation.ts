import { SIM_ROUTE, type LatLng } from "./park";
import { haversineM } from "./geo";

export type SimFix = LatLng & {
  speedKmh: number;
  alt: number;
  accuracyM: number;
  t: number;
};

/**
 * Simulador de un recorrido real: subida por Pío Nono hasta
 * Plaza México y bajada por Antilén hasta la salida Pedro de Valdivia.
 * Reproduce las velocidades típicas de cada tramo (incluido el
 * pico sobre 30 km/h en la bajada) para probar todas las alertas
 * sin necesitar GPS. Avanza `speedScale` veces el tiempo real.
 */
export class RideSimulator {
  private cumulative: number[] = [];
  private totalDist = 0;
  private traveled = 0; // metros recorridos
  private simTime: number;
  private readonly speedScale: number;

  constructor(speedScale = 6, loop = true) {
    this.speedScale = speedScale;
    this.loop = loop;
    this.simTime = Date.now();
    let acc = 0;
    this.cumulative.push(0);
    for (let i = 1; i < SIM_ROUTE.length; i++) {
      acc += haversineM(SIM_ROUTE[i - 1], SIM_ROUTE[i]);
      this.cumulative.push(acc);
    }
    this.totalDist = acc;
  }

  private loop: boolean;

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
    const a = SIM_ROUTE[i - 1];
    const b = SIM_ROUTE[i];
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
    const noise = (Math.random() - 0.5) * 0.9; // ±0.45 km/h
    return {
      lat: now.lat + (Math.random() - 0.5) * 0.00004,
      lon: now.lon + (Math.random() - 0.5) * 0.00004,
      speedKmh: Math.max(0, now.kmh + noise),
      alt: now.alt + (Math.random() - 0.5) * 0.8,
      accuracyM: 4 + Math.random() * 3,
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
