// ============================================================
// src/motor/nucleo.ts - MotorGPS: el núcleo del motor, agnóstico
// de React, del parque San Cristóbal y de la interfaz de Cumbre30
// (Integration API). Integra las etapas:
//
//   FuenteUbicacion → ProcesadorPosicion → MotorActividad (FSM)
//                   → MotorMetricas → checkpoint → EventoMotor
//
// El consumidor (useRideEngine en Cumbre30) se suscribe con on():
// recibe fixes validados con métricas y transiciones de estado, y
// sobre eso aplica SUS reglas de negocio (geocercia, fiscalización
// 30 km/h, voz, desafíos...). El núcleo no las conoce: puede vivir
// en cualquier proyecto de geolocalización. Checkpoint cada
// checkpointCadaSec y en hitos → ride recuperable ante crasheo
// (auditoría P0-1).
// ============================================================

import { resolverMotorConfig, type MotorConfig } from "./config";
import { ProcesadorPosicion } from "./procesamiento";
import { MotorMetricas } from "./metricas";
import { MotorActividad } from "./actividad";
import { haversineM } from "./geo";
import { almacenLocalStorage, esCheckpointValido } from "./persistencia";
import type {
  AlmacenCheckpoint,
  CheckpointMotor,
  EstadoActividad,
  EventoMotor,
  FixBruto,
  FuenteUbicacion,
  MetricasMotor,
  OyenteMotor,
} from "./tipos";

export type MotorGPSSnapshot = {
  estado: EstadoActividad;
  metricas: MetricasMotor;
  track: Array<[number, number, number | null, number]>;
};

export class MotorGPS {
  readonly cfg: MotorConfig;
  private procesador: ProcesadorPosicion;
  private metricas: MotorMetricas | null = null;
  private actividad: MotorActividad;
  private fuente: FuenteUbicacion | null = null;
  private oyentes = new Set<OyenteMotor>();
  private almacen: AlmacenCheckpoint;
  private ultimoCheckpointTs = 0;
  private fuenteId: FuenteUbicacion["tipo"] = "nativa";
  private extraActual: CheckpointMotor["extra"] = undefined;
  private readonly ahora: () => number;

  constructor(opts: { config?: Partial<MotorConfig>; almacen?: AlmacenCheckpoint; ahora?: () => number } = {}) {
    this.cfg = resolverMotorConfig(opts.config);
    this.ahora = opts.ahora ?? (() => Date.now());
    this.almacen = opts.almacen ?? almacenLocalStorage();
    this.procesador = new ProcesadorPosicion(this.cfg, this.ahora);
    this.actividad = new MotorActividad(this.cfg);
  }

  // ---------- Integration API ----------

  /** Suscribe un oyente de eventos tipados. Devuelve la des-suscripción. */
  on(oyente: OyenteMotor): () => void {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  }

  private emitir(e: EventoMotor): void {
    for (const o of this.oyentes) {
      try {
        o(e);
      } catch {
        // un oyente roto jamás tumba el pipeline del motor
      }
    }
  }

  /** Contadores opacos del consumidor (se restauran al retomar). */
  setExtra(extra: CheckpointMotor["extra"]): void {
    this.extraActual = extra;
  }

  /** Activa/desactiva la auto-pausa EN VIVO (perfil del consumidor).
   *  La FSM consulta esta bandera en cada fix. */
  setAutoPausa(on: boolean): void {
    (this.cfg.autoPausa as { activada: boolean }).activada = on;
  }

  /** Arranca la captura con la fuente dada y abre la sesión. */
  iniciar(fuente: FuenteUbicacion): void {
    this.fuente = fuente;
    this.fuenteId = fuente.tipo;
    const inicio = this.ahora();
    this.metricas = new MotorMetricas(this.cfg, inicio);
    this.actividad = new MotorActividad(this.cfg);
    this.actividad.iniciar(inicio);
    this.procesador = new ProcesadorPosicion(this.cfg, this.ahora);
    this.ultimoCheckpointTs = inicio;
    void fuente.iniciar(
      (fix) => this.procesarFix(fix),
      (msg) => this.emitir({ tipo: "alerta", codigo: "senal-obsoleta", detalle: msg })
    );
  }

  /** Detiene la captura, cierra la sesión y limpia el checkpoint.
   *  Devuelve el snapshot final (métricas + track). */
  detener(): MotorGPSSnapshot | null {
    this.fuente?.detener();
    this.fuente = null;
    const snap = this.snapshot();
    this.almacen.borrar();
    this.metricas = null;
    return snap;
  }

  pausar(): boolean {
    if (!this.metricas) return false;
    const ahora = this.ahora();
    const ok = this.actividad.pausar(ahora);
    if (!ok) return false;
    // cierra el span abierto (auto-pausa o nada) y abre el de pausa manual
    this.metricas.cerrarPausa(ahora);
    this.metricas.abrirPausa(ahora, false);
    this.emitir({ tipo: "estado", antes: "corriendo", ahora: "pausada", motivo: "manual" });
    this.guardarCheckpoint(this.ahora(), true);
    return true;
  }

  reanudar(): boolean {
    if (!this.metricas) return false;
    const ahora = this.ahora();
    const ok = this.actividad.reanudar(ahora);
    if (!ok) return false;
    this.metricas.cerrarPausa(ahora);
    // Reset de filtros (igual que el motor histórico al reanudar): la
    // velocidad y la posición previa quedan nulas para que ni la
    // velocidad ni la distancia salten con el tiempo de pausa.
    this.procesador = new ProcesadorPosicion(this.cfg, this.ahora);
    this.emitir({ tipo: "estado", antes: "pausada", ahora: "corriendo", motivo: "manual" });
    return ok;
  }

  get estado(): EstadoActividad {
    return this.actividad.estado;
  }

  get activo(): boolean {
    return this.metricas !== null;
  }

  /** Última velocidad filtrada (km/h). */
  velKmhActual(): number {
    return this.procesador.velKmhFiltrada;
  }

  snapshot(): MotorGPSSnapshot | null {
    if (!this.metricas) return null;
    return {
      estado: this.actividad.estado,
      metricas: this.metricas.snapshot(this.ahora(), this.velKmhActual(), null),
      track: this.metricas.track.slice(),
    };
  }

  // ---------- pipeline por fix ----------

  private procesarFix(fix: FixBruto): void {
    if (!this.metricas) return; // sesión cerrada: fixes tardíos se descartan
    // el fix previo se captura ANTES de procesar (procesar lo reemplaza)
    const previo = this.procesador.fixPrevio;
    const r = this.procesador.procesar(fix);
    if (!r.aceptado) return;
    const dM = previo ? haversineM(previo, r.fix) : 0;
    // FSM de actividad con la velocidad filtrada
    const transicion = this.actividad.onFix(r.velKmh, this.ahora());
    if (transicion) {
      if (transicion.ahora === "autoPausada" && this.metricas.pausaAbiertaTs === null) {
        this.metricas.abrirPausa(this.ahora(), true);
      } else if (transicion.motivo === "auto-reanudada" && this.metricas.pausaAbiertaTs !== null) {
        this.metricas.cerrarPausa(this.ahora());
      }
      this.emitir({ tipo: "estado", ...transicion });
    }
    // métricas: banda muerta, cadena vertical con histéresis, track
    this.metricas.procesar(r.fix, r.velKmh, dM, this.ahora());
    this.emitir({
      tipo: "fix",
      metricas: this.snapshot()!.metricas,
      fix: r.fix,
      dtSec: r.dtSec,
      velKmh: r.velKmh,
      estado: this.actividad.estado,
    });
    // checkpoint periódico
    const ahora = this.ahora();
    if (ahora - this.ultimoCheckpointTs >= this.cfg.checkpointCadaSec * 1000) {
      this.guardarCheckpoint(ahora, false);
    }
  }

  // ---------- checkpoint / recuperación ----------

  /** Guarda el checkpoint (cada intervalo o por hito). Incluye el
   *  estado privado de métricas para restaurar sin pérdida. */
  guardarCheckpoint(ahoraTs: number, _hito: boolean): CheckpointMotor | null {
    if (!this.metricas) return null;
    const priv = this.metricas.serializar();
    const cp: CheckpointMotor = {
      version: 1,
      fuente: this.fuenteId,
      inicioTs: priv.inicioTs,
      ultimoFixTs: this.procesador.fixPrevio?.t ?? ahoraTs,
      ultimoGuardadoTs: ahoraTs,
      pausasMs: priv.pausasMs,
      pausaAbiertaTs: priv.pausaAbiertaTs,
      estado: this.actividad.estado,
      metricas: this.metricas.snapshot(ahoraTs, this.velKmhActual(), null),
      track: priv.track,
      kalman: this.procesador.estadoKalman(),
      anclaGain: priv.anclaGain,
      anclaLoss: priv.anclaLoss,
      ultimoAltValido: priv.ultimoAltValido,
      extra: this.extraActual,
      privado: priv,
    };
    this.almacen.guardar(cp);
    this.ultimoCheckpointTs = ahoraTs;
    return cp;
  }

  /** Fuerza un checkpoint ahora (pagehide/visibilitychange/pausa). */
  forzarCheckpoint(): void {
    this.guardarCheckpoint(this.ahora(), true);
  }

  /** ¿Hay un ride interrumpido recuperable? */
  hayRecuperacion(): boolean {
    return this.leerRecuperacion() !== null;
  }

  /** Checkpoint pendiente (o null si no hay o está corrupto). */
  leerRecuperacion(): CheckpointMotor | null {
    const cp = this.almacen.leer();
    return esCheckpointValido(cp) ? cp : null;
  }

  /** Retoma un ride interrumpido: reconstruye métricas, Kalman y FSM
   *  desde el checkpoint y reabre la fuente. */
  retomar(cp: CheckpointMotor, fuente: FuenteUbicacion): void {
    this.fuente = fuente;
    this.fuenteId = cp.fuente;
    this.metricas = new MotorMetricas(this.cfg, cp.inicioTs);
    if (cp.privado) this.metricas.restaurar(cp.privado);
    this.actividad = new MotorActividad(this.cfg);
    const estado = cp.estado === "pausada" ? "pausada" : cp.estado === "autoPausada" ? "autoPausada" : "corriendo";
    this.actividad.iniciar(this.ahora(), estado);
    if (estado !== "corriendo") this.metricas.pausaAbiertaTs = this.ahora();
    this.procesador = new ProcesadorPosicion(this.cfg, this.ahora);
    this.procesador.restaurar(cp.kalman, null);
    this.extraActual = cp.extra;
    this.ultimoCheckpointTs = this.ahora();
    void fuente.iniciar(
      (fix) => this.procesarFix(fix),
      (msg) => this.emitir({ tipo: "alerta", codigo: "senal-obsoleta", detalle: msg })
    );
    this.guardarCheckpoint(this.ahora(), true);
  }

  /** Descarta un ride interrumpido (borra el checkpoint). */
  descartarRecuperacion(): void {
    this.almacen.borrar();
  }
}
