// ============================================================
// src/motor/actividad.ts - Activity Engine: máquina de estados de
// la sesión (idle/corriendo/pausada/autoPausada) con pausa y
// reanudación automáticas configurables (auditoría D6).
//
//   · auto: velocidad < kmhParada sostenida segParada → autoPausada;
//     velocidad ≥ kmhReanudar → corriendo. Con histéresis propia
//     (parar a 2.0, reanudar a 3.0) para no oscilar en el umbral.
//   · El tiempo de auto-pausa NO cuenta para elapsed ni movingSec
//     (los spans quedan en pausasMs, igual que la pausa manual).
//   · La detención del GPS (sin fixes) NO pausa: elapsed sigue por
//     reloj; solo el movimiento medido pausa.
// ============================================================

import type { EstadoActividad } from "./tipos";
import type { MotorConfig } from "./config";

export class MotorActividad {
  readonly cfg: MotorConfig;
  estado: EstadoActividad = "idle";
  /** ts en que la velocidad cayó bajo kmhParada (candidato a auto-pausa). */
  private quietoDesdeTs: number | null = null;
  /** ts de la transición a autoPausada (para el span de pausa). */
  private autoPausaAbiertaTs: number | null = null;

  constructor(cfg: MotorConfig) {
    this.cfg = cfg;
  }

  /** Marca el inicio del ride (desde idle o tras restaurar). */
  iniciar(ahoraTs: number, restaurado: EstadoActividad = "corriendo"): void {
    this.estado = restaurado;
    this.quietoDesdeTs = null;
    if (restaurado === "autoPausada") this.autoPausaAbiertaTs = ahoraTs;
  }

  /** Pausa manual desde la UI. Devuelve true si cambió el estado. */
  pausar(ahoraTs: number): boolean {
    if (this.estado !== "corriendo" && this.estado !== "autoPausada") return false;
    if (this.autoPausaAbiertaTs !== null) {
      // ya estaba en auto-pausa: la manual la sustituye sin duplicar span
      this.autoPausaAbiertaTs = ahoraTs;
    }
    this.estado = "pausada";
    this.quietoDesdeTs = null;
    return true;
  }

  /** Reanudación manual. */
  reanudar(ahoraTs: number): boolean {
    if (this.estado !== "pausada" && this.estado !== "autoPausada") return false;
    this.estado = "corriendo";
    this.autoPausaAbiertaTs = null;
    this.quietoDesdeTs = null;
    return true;
  }

  /** Evalúa la FSM con cada fix aceptado. Devuelve la transición
   *  ocurrida (si la hay) para que el núcleo emita el evento. */
  onFix(velKmh: number, ahoraTs: number): { antes: EstadoActividad; ahora: EstadoActividad; motivo: "manual" | "auto-parada" | "auto-reanudada" } | null {
    if (this.estado === "idle" || this.estado === "pausada") return null;
    const ap = this.cfg.autoPausa;
    // --- reanudación automática ---
    if (this.estado === "autoPausada") {
      if (velKmh >= ap.kmhReanudar) {
        const antes = this.estado;
        this.estado = "corriendo";
        this.autoPausaAbiertaTs = null;
        this.quietoDesdeTs = null;
        return { antes, ahora: this.estado, motivo: "auto-reanudada" };
      }
      return null;
    }
    // --- pausa automática (solo corriendo) ---
    if (!ap.activada) return null;
    if (velKmh < ap.kmhParada) {
      if (this.quietoDesdeTs === null) this.quietoDesdeTs = ahoraTs;
      const quietoSec = (ahoraTs - this.quietoDesdeTs) / 1000;
      if (quietoSec >= ap.segParada) {
        const antes = this.estado;
        this.estado = "autoPausada";
        this.autoPausaAbiertaTs = ahoraTs;
        return { antes, ahora: this.estado, motivo: "auto-parada" };
      }
    } else {
      this.quietoDesdeTs = null;
    }
    return null;
  }

  /** Cierra el span de auto-pausa al volverse manual (para que las
   *  métricas sumen los ms correctos). El núcleo lo usa antes de
   *  abrir la pausa manual. */
  spanAutoPausaAbierta(): number | null {
    return this.autoPausaAbiertaTs;
  }
}
