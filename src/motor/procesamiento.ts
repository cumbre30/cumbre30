// ============================================================
// src/motor/procesamiento.ts - Position Processing: valida cada
// fix crudo y produce una velocidad estable.
//
//   1. Frescura: fix más viejo que frescuraMaxMs respecto del
//      reloj → "obsoleto" (fixes cacheados del sistema).
//   2. Precisión: accuracy ≥ gateAccuracyM → "accuracy".
//   3. Salto con umbral DINÁMICO: d > max(saltoBaseM,
//      velPrevia·dt·saltoMargenVel) → "salto" (a 1 Hz el fijo de
//      100 m equivalía a 360 km/h; ahora sigue al ciclista rápido).
//   4. Velocidad: Doppler → KalmanVelocidad con R adaptativo; sin
//      Doppler válido, delta de posición (NaN si accuracy ≥ gate).
//   5. Micro-extrapolación para tapar la latencia: +extrapolacionMs
//      subiendo y +extrapolacionFrenoMs frenando (auditoría R2:
//      no sobrestima tras una frenada brusca).
// ============================================================

import type { FixBruto, ResultadoFix } from "./tipos";
import type { MotorConfig } from "./config";
import { KalmanVelocidad } from "./kalman";
import { haversineM } from "../lib/geo";
import type { LatLng } from "../lib/park";

const KM_H = 3.6;

export class ProcesadorPosicion {
  private cfg: MotorConfig;
  private kalman: KalmanVelocidad;
  private ultimo: FixBruto | null = null;
  private ultimoTsAceptado: number | null = null;
  private velFiltradaMps = 0;
  private accelPrev = 0; // aceleración implícita previa (para extrapolación)
  private ahora: () => number;

  constructor(cfg: MotorConfig, ahora: () => number = () => Date.now()) {
    this.cfg = cfg;
    this.ahora = ahora;
    this.kalman = new KalmanVelocidad(cfg.kalman);
  }

  /** Procesa un fix crudo. Nunca lanza: siempre devuelve resultado. */
  procesar(fix: FixBruto): ResultadoFix {
    if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lon)) {
      return { aceptado: false, fix, motivo: "invalido" };
    }
    // 1) frescura (la fuente sim controla su propio reloj)
    if (fix.fuente !== "sim" && this.ahora() - fix.t > this.cfg.frescuraMaxMs) {
      return { aceptado: false, fix, motivo: "obsoleto" };
    }
    // 2) precisión
    if (!(fix.accuracyM < this.cfg.gateAccuracyM)) {
      return { aceptado: false, fix, motivo: "accuracy" };
    }
    // 3) salto con umbral dinámico + dt acotado (igual que el histórico)
    const dtBruto = this.ultimoTsAceptado === null ? 1 : (fix.t - this.ultimoTsAceptado) / 1000;
    const dtSec = Math.min(10, Math.max(0.15, dtBruto));
    if (this.ultimo) {
      const d = haversineM(this.ultimo as LatLng, fix as LatLng);
      const velKmhPrev = this.velFiltradaMps * KM_H;
      const dMax = Math.max(this.cfg.saltoBaseM, (velKmhPrev / KM_H) * dtBruto * this.cfg.saltoMargenVel);
      if (d > dMax) {
        return { aceptado: false, fix, motivo: "salto" };
      }
    }
    // 4) velocidad Doppler → Kalman; respaldo por delta de posición
    let medidoMps = fix.speedMps;
    if (medidoMps === null || !Number.isFinite(medidoMps)) {
      medidoMps =
        this.ultimo && fix.accuracyM < this.cfg.gateAccuracyM
          ? (haversineM(this.ultimo as LatLng, fix as LatLng) / dtSec) || NaN
          : NaN;
    }
    const filtrado = this.kalman.update(medidoMps ?? NaN, dtSec, fix.accuracyM);
    this.accelPrev = dtSec > 0 ? (filtrado - this.velFiltradaMps) / dtSec : 0;
    this.velFiltradaMps = filtrado;
    // 5) extrapolación dependiente del signo (frena menos)
    const exMs = this.accelPrev >= 0 ? this.cfg.extrapolacionMs : this.cfg.extrapolacionFrenoMs;
    const accel = Math.max(-this.cfg.accelMaxMps2, Math.min(this.cfg.accelMaxMps2, this.accelPrev));
    const velPredMps = Math.max(0, filtrado + accel * (exMs / 1000));
    const velInstKmh = velPredMps * KM_H;
    this.ultimo = fix;
    this.ultimoTsAceptado = fix.t;
    return {
      aceptado: true,
      fix,
      dtSec,
      velKmh: velPredMps * KM_H,
      velInstKmh,
    };
  }

  /** Velocidad filtrada sin extrapolación (para métricas internas). */
  get velKmhFiltrada(): number {
    return this.velFiltradaMps * KM_H;
  }

  restaurar(kalmanEstado: Parameters<KalmanVelocidad["restaurar"]>[0], ultimoFix: FixBruto | null | undefined): void {
    this.kalman.restaurar(kalmanEstado);
    this.ultimo = ultimoFix ?? null;
    this.velFiltradaMps = this.kalman.velMps;
    if (ultimoFix) this.ultimoTsAceptado = ultimoFix.t;
  }

  estadoKalman() {
    return this.kalman.estado();
  }

  get fixPrevio(): FixBruto | null {
    return this.ultimo;
  }
}
