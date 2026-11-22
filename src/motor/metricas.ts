// ============================================================
// src/motor/metricas.ts - Metrics Engine: distancia con banda
// muerta, cadena vertical con histéresis, tiempos por reloj de
// pared y muestreo del track. Acumula y serializa; JAMÁS aplica
// reglas del parque ni del producto.
//
// Correcciones de la fase única (auditoría):
//   · Banda muerta en reposo: con velocidad bajo el umbral, un
//     desplazamiento solo cuenta si supera max(bandaMuertaReposoM,
//     accuracy·factor). La deriva de 1-4 m/fix deja de sumar.
//   · Altitud: fix sin altitud NO entra como 0; se conserva la
//     última válida. Con accuracy vertical mala (valt ≥
//     valtRechazoM) el fix no alimenta la cadena vertical.
//   · Desnivel con histéresis: el ancla de gain desciende libre con
//     la altitud y solo acumula cuando la altitud supera al ancla
//     en ≥ gainHisteresisM; simétrico para el loss. El ruido de
//     ±10-20 m deja de producir desnivel falso.
//   · Tiempos por reloj: elapsed = (ahora − inicio − pausas)/1000;
//     movingSec con el umbral unificado. La pérdida de señal no
//     resta tiempo (auditoría D5).
// ============================================================

import type { FixBruto, MetricasMotor, PuntoTrack } from "./tipos";
import type { MotorConfig } from "./config";
import { haversineM } from "./geo";

const KM_H = 3.6;

export class MotorMetricas {
  readonly cfg: MotorConfig;
  inicioTs: number;
  /** ms acumulados de pausas CERRADAS (manual + auto). */
  pausasMs = 0;
  /** ts de la pausa abierta actual (manual o auto), null si corre. */
  pausaAbiertaTs: number | null = null;

  distanciaM = 0;
  movingSec = 0;
  /** Segundos de AUTO-pausa ya cerrados (fase única, requisito E:
   *  diferenciar tiempo total / en movimiento / pausado). */
  secAutoPausa = 0;
  /** ¿La pausa abierta actual es una auto-pausa? (false = manual). */
  abiertaAuto = false;
  velMaxKmh = 0;
  gainM = 0;
  lossM = 0;
  altMinM: number | null = null;
  altMaxM: number | null = null;
  altEma: number | null = null;
  /** EMA lenta SOLO para la cadena de desnivel (calibración: α 0.1
   *  + histéresis 4 m filtran el ruido GNSS vertical en llano). */
  gainEma: number | null = null;
  pendienteEma = 0;
  fixes = 0;
  track: PuntoTrack[] = [];
  trackIntervalSec: number;
  private anclaGain: number | null = null;
  private anclaLoss: number | null = null;
  private ultimoAltValido: number | null = null;
  private ultimoTrackTs = 0;
  private ultimoFixTs = 0;

  constructor(cfg: MotorConfig, inicioTs: number) {
    this.cfg = cfg;
    this.inicioTs = inicioTs;
    this.trackIntervalSec = cfg.trackCadaSec;
  }

  /** Tiempo transcurrido (reloj de pared) menos pausas, en segundos. */
  elapsedSec(ahoraTs: number): number {
    const abierta = this.pausaAbiertaTs === null ? 0 : Math.max(0, ahoraTs - this.pausaAbiertaTs);
    return Math.max(0, (ahoraTs - this.inicioTs - this.pausasMs - abierta) / 1000);
  }

  /** Segundos totales de pausa (manual + auto), incluida la pausa
   *  abierta en curso. total = elapsed + pausa + moviendo se cuadra
   *  contra el reloj de pared. */
  secPausa(ahoraTs: number): number {
    const abierta = this.pausaAbiertaTs === null ? 0 : Math.max(0, ahoraTs - this.pausaAbiertaTs);
    return (this.pausasMs + abierta) / 1000;
  }

  /** Abre el span de pausa (auto=true cuando la FSM auto-pausó).
   *  Si ya había un span abierto no duplica: el llamador debe cerrar
   *  antes (el núcleo cierra y abre al sustituir auto por manual). */
  abrirPausa(ahoraTs: number, auto: boolean): void {
    if (this.pausaAbiertaTs !== null) return;
    this.pausaAbiertaTs = ahoraTs;
    this.abiertaAuto = auto;
  }

  /** Cierra el span de pausa abierto: suma el tramo a pausasMs y, si
   *  era auto-pausa, también a secAutoPausa. Idempotente. */
  cerrarPausa(ahoraTs: number): void {
    if (this.pausaAbiertaTs === null) return;
    const span = Math.max(0, ahoraTs - this.pausaAbiertaTs);
    this.pausasMs += span;
    if (this.abiertaAuto) this.secAutoPausa += span / 1000;
    this.pausaAbiertaTs = null;
    this.abiertaAuto = false;
  }

  /** Procesa un fix YA VALIDADO (aceptado por Position Processing).
   *  velKmh: velocidad filtrada+extrapolada en km/h. dM: desplazamiento
   *  haversine desde el fix aceptado previo. */
  procesar(fix: FixBruto, velKmh: number, dM: number, ahoraTs: number): void {
    this.fixes += 1;
    const enMovimiento = velKmh > this.cfg.umbralMovimientoKmh;

    // --- distancia: velocidad Doppler filtrada como criterio ---
    // Con velocidad bajo el umbral de movimiento (Doppler confiable
    // en reposo, ±0.1 km/h) la distancia es CERO aunque la posición
    // derive: es el criterio de los ciclocomputadores profesionales
    // y elimina el P0-2 de la auditoría (deriva en reposo sumaba
    // metros). Durante pausa (manual/auto) tampoco se acumula.
    if (this.pausaAbiertaTs === null && enMovimiento) {
      this.distanciaM += dM;
    }

    // --- tiempo en movimiento (dt real entre fixes aceptados) ---
    if (enMovimiento && this.pausaAbiertaTs === null) {
      const dtMov = this.ultimoFixTs > 0 ? (fix.t - this.ultimoFixTs) / 1000 : 1;
      this.movingSec += Math.min(10, Math.max(0.15, dtMov));
    }

    // --- velocidad máxima ---
    if (velKmh > this.velMaxKmh) this.velMaxKmh = velKmh;
    this.ultimoFixTs = fix.t;

    // --- cadena vertical: solo con altitud válida ---
    if (fix.alt !== null && Number.isFinite(fix.alt) && (fix.valt === null || fix.valt < this.cfg.valtRechazoM)) {
      const alt = fix.alt;
      this.ultimoAltValido = alt;
      // EMA rápida (pendiente, pista, altMin/Max) — igual que el histórico
      this.altEma = this.altEma === null ? alt : this.altEma + this.cfg.altEmaAlpha * (alt - this.altEma);
      const suavizada = this.altEma;
      // EMA lenta para el desnivel + histéresis (calibración fase única)
      this.gainEma = this.gainEma === null ? alt : this.gainEma + this.cfg.gainEmaAlpha * (alt - this.gainEma);
      const g = this.gainEma;
      // histéresis de desnivel: el ancla desciende libre; sube solo
      // con salto ≥ h y en ese caso reinicia AMBAS anclas (sin doble conteo)
      if (this.anclaGain === null) this.anclaGain = g;
      if (this.anclaLoss === null) this.anclaLoss = g;
      if (g < this.anclaGain) this.anclaGain = g;
      else if (g - this.anclaGain >= this.cfg.gainHisteresisM) {
        this.gainM += g - this.anclaGain;
        this.anclaGain = g;
        this.anclaLoss = g;
      }
      if (g > this.anclaLoss) this.anclaLoss = g;
      else if (this.anclaLoss - g >= this.cfg.gainHisteresisM) {
        this.lossM += this.anclaLoss - g;
        this.anclaLoss = g;
        this.anclaGain = g;
      }
      if (this.altMinM === null || suavizada < this.altMinM) this.altMinM = suavizada;
      if (this.altMaxM === null || suavizada > this.altMaxM) this.altMaxM = suavizada;
      // pendiente: EMA con avance mínimo y cap (igual que el histórico)
      const prev = this.track.length > 0 ? this.track[this.track.length - 1] : null;
      if (prev) {
        // avance desde el punto de track previo (ya validado)
        const dTrack = this.distanciaDesdeTrack(prev, fix);
        if (dTrack > this.cfg.avanceMinimoM) {
          const p = ((suavizada - (prev[2] ?? suavizada)) / dTrack) * 100;
          const cap = this.cfg.pendienteCapPct;
          const pc = Math.max(-cap, Math.min(cap, p));
          this.pendienteEma += this.cfg.pendienteEmaAlpha * (pc - this.pendienteEma);
        }
      }
    }

    // --- track con muestreo y decimación progresiva (histórico) ---
    if (this.pausaAbiertaTs === null && fix.t - this.ultimoTrackTs >= this.cfg.trackCadaSec * 1000) {
      this.ultimoTrackTs = fix.t;
      this.track.push([fix.lat, fix.lon, this.ultimoAltValido, Math.round(fix.t / 1000)]);
      if (this.track.length > this.cfg.trackMaxPts) {
        const medio: PuntoTrack[] = [];
        for (let i = 0; i < this.track.length; i += 2) medio.push(this.track[i]);
        this.track = medio;
        this.trackIntervalSec *= 2;
      }
    }
  }

  private distanciaDesdeTrack(prev: PuntoTrack, fix: FixBruto): number {
    // Haversine compartida del motor (motor/geo.ts)
    return haversineM({ lat: prev[0], lon: prev[1] }, fix);
  }

  /** Snapshot de métricas para eventos y resumen. */
  snapshot(ahoraTs: number, velKmh: number, rumbo: number | null): MetricasMotor {
    return {
      distanciaM: this.distanciaM,
      movingSec: this.movingSec,
      elapsedSec: this.elapsedSec(ahoraTs),
      secAutoPausa: this.secAutoPausa,
      secPausa: this.secPausa(ahoraTs),
      velKmh,
      velMaxKmh: this.velMaxKmh,
      gainM: this.gainM,
      lossM: this.lossM,
      altMinM: this.altMinM,
      altMaxM: this.altMaxM,
      pendientePct: this.pendienteEma,
      rumboDeg: rumbo,
      fixes: this.fixes,
    };
  }

  /** Serializa para el checkpoint. */
  serializar() {
    return {
      inicioTs: this.inicioTs,
      pausasMs: this.pausasMs,
      pausaAbiertaTs: this.pausaAbiertaTs,
      distanciaM: this.distanciaM,
      movingSec: this.movingSec,
      secAutoPausa: this.secAutoPausa,
      abiertaAuto: this.abiertaAuto,
      velMaxKmh: this.velMaxKmh,
      gainM: this.gainM,
      lossM: this.lossM,
      altMinM: this.altMinM,
      altMaxM: this.altMaxM,
      altEma: this.altEma,
      gainEma: this.gainEma,
      pendienteEma: this.pendienteEma,
      fixes: this.fixes,
      track: this.track,
      anclaGain: this.anclaGain,
      anclaLoss: this.anclaLoss,
      ultimoAltValido: this.ultimoAltValido,
      ultimoTrackTs: this.ultimoTrackTs,
      ultimoFixTs: this.ultimoFixTs,
      trackIntervalSec: this.trackIntervalSec,
    };
  }

  /** Restaura desde un checkpoint (mismo formato de serializar). */
  restaurar(s: ReturnType<MotorMetricas["serializar"]>): void {
    this.inicioTs = s.inicioTs;
    this.pausasMs = s.pausasMs;
    this.pausaAbiertaTs = s.pausaAbiertaTs;
    this.distanciaM = s.distanciaM;
    this.movingSec = s.movingSec;
    this.secAutoPausa = s.secAutoPausa;
    this.abiertaAuto = s.abiertaAuto ?? false;
    this.velMaxKmh = s.velMaxKmh;
    this.gainM = s.gainM;
    this.lossM = s.lossM;
    this.altMinM = s.altMinM;
    this.altMaxM = s.altMaxM;
    this.altEma = s.altEma;
    this.gainEma = s.gainEma;
    this.pendienteEma = s.pendienteEma;
    this.fixes = s.fixes;
    this.track = Array.isArray(s.track) ? s.track.slice() : [];
    this.anclaGain = s.anclaGain;
    this.anclaLoss = s.anclaLoss;
    this.ultimoAltValido = s.ultimoAltValido;
    this.ultimoTrackTs = s.ultimoTrackTs;
    this.ultimoFixTs = s.ultimoFixTs ?? 0;
    this.trackIntervalSec = s.trackIntervalSec ?? this.cfg.trackCadaSec;
  }
}
