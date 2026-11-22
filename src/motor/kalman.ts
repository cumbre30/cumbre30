// ============================================================
// src/motor/kalman.ts - filtro de velocidad del motor (evolución
// del SpeedKalman de geo.ts, que se conserva por compatibilidad):
//   · R adaptativo por la precisión del fix (auditoría R1): un fix
//     con accuracy 3 m pesa más que uno con 40 m. La referencia es
//     rAccReferenciaM (6 m históricos); R se multiplica por
//     clamp(accuracy/ref, 1, rAccMax).
//   · Mismas compuertas de outliers en dos niveles (×25 / ×60).
//   · Serializable para el checkpoint (retomar sin salto de velocidad).
// ============================================================

import type { MotorConfig } from "./config";

export type EstadoKalman = { x: number | null; p: number };

export class KalmanVelocidad {
  private x: number | null = null; // estado: velocidad estimada (m/s)
  private p = 1; // incertidumbre
  private readonly q: number;
  private readonly r: number;
  private readonly rAccRef: number;
  private readonly rAccMax: number;

  constructor(cfg: MotorConfig["kalman"]) {
    this.q = cfg.q;
    this.r = cfg.r;
    this.rAccRef = cfg.rAccReferenciaM;
    this.rAccMax = cfg.rAccMax;
  }

  /** Actualiza el filtro con una medición Doppler (m/s) y devuelve
   *  la velocidad estimada en m/s. dt en segundos. accuracyM en m
   *  (null = desconocida: usa R base). hardConfirm desactiva la
   *  amortiguación media (reservado, igual que en geo.ts). */
  update(measured: number, dt: number, accuracyM: number | null, hardConfirm = false): number {
    if (!Number.isFinite(measured) || measured < 0) return this.x ?? 0;
    if (this.x === null) {
      this.x = measured;
      this.p = 1;
      return this.x;
    }
    // predicción
    this.p += this.q * Math.max(dt, 0.05);
    // compuerta de outliers: aceleración implícita imposible
    const impliedA = Math.abs(measured - this.x) / Math.max(dt, 0.1);
    let r = this.r;
    if (impliedA > 25) r = this.r * 60;
    else if (impliedA > 8 && !hardConfirm) r = this.r * 25;
    else if (accuracyM !== null && accuracyM > 0) {
      // R adaptativo: más precisión → más confianza (R bajo).
      r = this.r * Math.min(this.rAccMax, Math.max(1, accuracyM / this.rAccRef));
    }
    const k = this.p / (this.p + r);
    this.x += k * (measured - this.x);
    this.p *= 1 - k;
    return this.x;
  }

  /** Última estimación en m/s (0 sin estado). */
  get velMps(): number {
    return this.x ?? 0;
  }

  /** Aceleración implícita entre la estimación y una medición (m/s²). */
  accelImplícita(measured: number, dt: number): number {
    if (this.x === null || dt <= 0) return 0;
    return (measured - this.x) / dt;
  }

  estado(): EstadoKalman {
    return { x: this.x, p: this.p };
  }

  restaurar(estado: EstadoKalman | null | undefined): void {
    if (!estado) return;
    this.x = typeof estado.x === "number" && Number.isFinite(estado.x) ? estado.x : null;
    this.p = typeof estado.p === "number" && Number.isFinite(estado.p) && estado.p > 0 ? estado.p : 1;
  }
}
