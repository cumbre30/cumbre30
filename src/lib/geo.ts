import type { LatLng } from "./park";

const R = 6371000; // radio terrestre (m)
const toRad = (d: number) => (d * Math.PI) / 180;

/** Distancia en metros entre dos coordenadas (haversine). */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Test punto-en-polígono (ray casting). */
export function pointInPolygon(p: LatLng, poly: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lon, yi = poly[i].lat;
    const xj = poly[j].lon, yj = poly[j].lat;
    const intersect =
      yi > p.lat !== yj > p.lat &&
      p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Filtro de Kalman escalar para suavizar la velocidad (m/s).
 * - Q: ruido de proceso (aceleración del ciclista)
 * - R: ruido de medición (GPS)
 * Incluye compuerta de outliers en dos niveles:
 *   - salto sospechoso (> 8 m/s²): se ignora salvo que el
 *     acelerómetro confirme aceleración real (hardConfirm),
 *   - salto imposible (> 25 m/s² ≈ 2.5 g sostenido): siempre
 *     se ignora, venga o no confirmación sensorial.
 */
export class SpeedKalman {
  private x: number | null = null; // estado: velocidad estimada
  private p = 1; // incertidumbre
  private readonly q: number;
  private readonly r: number;

  constructor(q = 0.55, r = 0.35) {
    this.q = q;
    this.r = r;
  }

  update(measured: number, dt: number, hardConfirm = false): number {
    if (!isFinite(measured) || measured < 0) return this.x ?? 0;
    if (this.x === null) {
      this.x = measured;
      return this.x;
    }
    // predicción
    this.p += this.q * dt;
    // compuerta de outliers: aceleración imposible
    const impliedA = Math.abs(measured - this.x) / Math.max(dt, 0.1);
    let r = this.r;
    if (impliedA > 25) r = this.r * 60;
    else if (impliedA > 8 && !hardConfirm) r = this.r * 25;
    // corrección
    const k = this.p / (this.p + r);
    this.x += k * (measured - this.x);
    this.p *= 1 - k;
    return this.x;
  }

  get value(): number {
    return this.x ?? 0;
  }

  reset(): void {
    this.x = null;
    this.p = 1;
  }
}

/** Media móvil exponencial simple. */
export class Ema {
  private v: number | null = null;
  constructor(private alpha: number) {}
  update(x: number): number {
    this.v = this.v === null ? x : this.alpha * x + (1 - this.alpha) * this.v;
    return this.v;
  }
  get value(): number {
    return this.v ?? 0;
  }
  reset(): void {
    this.v = null;
  }
}

/** Rumbo (bearing) en grados 0-360 de a → b. */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return (Math.atan2(y, x) / Math.PI * 180 + 360) % 360;
}

/**
 * Curso (heading) del recorrido: rumbo del último tramo con avance
 * suficiente (≥ 3 m). Devuelve null si está detenido o sin datos.
 */
export function courseHeading(track: LatLng[]): number | null {
  for (let i = track.length - 1; i >= 1; i--) {
    const a = track[i - 1];
    const b = track[i];
    if (haversineM(a, b) >= 3) return bearingDeg(a, b);
  }
  return null;
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
