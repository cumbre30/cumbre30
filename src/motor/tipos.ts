// ============================================================
// src/motor/tipos.ts - contratos tipados del motor GPS de
// Cumbre30 (fase única 2026-11-22). Núcleo agnóstico de UI:
// no importa React, park.ts, i18n ni nada de la app. Los
// consumidores (useRideEngine) se suscriben a los eventos.
//
// Documentación de la modularización: docs/motor-gps.md
// ============================================================

/** Origen de un fix crudo. La fuente nativa es el FGS Android
 *  (GPS_PROVIDER 1 Hz); la web es navigator.geolocation; la sim
 *  es RideSimulator (determinista con semilla para pruebas). */
export type FuenteId = "nativa" | "web" | "sim";

/** Fix crudo tal como llega de la fuente, sin validar. speedMps es
 *  la velocidad Doppler del GNSS (m/s; null = inválida o ausente).
 *  alt null = el dispositivo no entregó altitud en este fix (el
 *  motor conserva la última válida; JAMÁS la convierte en 0).
 *  valt = accuracy vertical en m (null si el proveedor no la da). */
export type FixBruto = {
  lat: number;
  lon: number;
  speedMps: number | null;
  accuracyM: number;
  bearing: number | null;
  alt: number | null;
  valt: number | null;
  /** Epoch ms del fix (loc.time nativo / pos.timestamp web / reloj sim). */
  t: number;
  fuente: FuenteId;
};

/** Resultado de la validación de un fix por Position Processing. */
export type ResultadoFix =
  | { aceptado: true; fix: FixBruto; dtSec: number; velKmh: number; velInstKmh: number }
  | { aceptado: false; fix: FixBruto; motivo: "accuracy" | "salto" | "obsoleto" | "invalido" };

/** Métricas acumuladas del motor (instantáneas y derivadas).
 *  · distanciaM ya pasa por banda muerta y compuertas.
 *  · elapsedSec es tiempo de PARED menos pausas (manual + auto):
 *    una pérdida de señal NO resta tiempo.
 *  · movingSec cuenta solo con velocidad sobre el umbral de
 *    movimiento (mismo umbral que los resúmenes: consistencia). */
export type MetricasMotor = {
  distanciaM: number;
  movingSec: number;
  elapsedSec: number;
  secAutoPausa: number;
  velKmh: number;
  velMaxKmh: number;
  gainM: number;
  lossM: number;
  altMinM: number | null;
  altMaxM: number | null;
  pendientePct: number;
  rumboDeg: number | null;
  /** Fixes aceptados procesados desde el inicio (telemetría). */
  fixes: number;
};

/** Estados de la máquina de actividad (Activity Engine). */
export type EstadoActividad = "idle" | "corriendo" | "pausada" | "autoPausada";

/** Eventos tipados que el motor emite a los consumidores
 *  (Integration API). El consumidor decide qué hacer con cada uno:
 *  Cumbre30 aplica sus reglas del parque; otra app, las suyas. */
export type EventoMotor =
  | { tipo: "fix"; metricas: MetricasMotor; fix: FixBruto; dtSec: number; velKmh: number; estado: EstadoActividad }
  | { tipo: "estado"; antes: EstadoActividad; ahora: EstadoActividad; motivo: "manual" | "auto-parada" | "auto-reanudada" }
  | { tipo: "alerta"; codigo: "senal-obsoleta" | "checkpoint-listo"; detalle?: string };

/** Oyente de eventos del motor. */
export type OyenteMotor = (e: EventoMotor) => void;

/** Fuente de ubicación (Location Source). Permite nativa/web/sim o
 *  cualquier otra que un proyecto externo provea. */
export type FuenteUbicacion = {
  readonly tipo: FuenteId;
  iniciar(entregar: (fix: FixBruto) => void, error: (msg: string) => void): Promise<void> | void;
  detener(): void;
};

/** Almacén de checkpoint (Persistence Layer). Inyectable: en la app
 *  es localStorage; en pruebas, memoria. */
export type AlmacenCheckpoint = {
  guardar(cp: CheckpointMotor): void;
  leer(): CheckpointMotor | null;
  borrar(): void;
};

/** Punto del track interno del motor: [lat, lon, ele|null, tsSec].
 *  ele null = sin altitud válida en ese punto. tsSeg en segundos epoch. */
export type PuntoTrack = [number, number, number | null, number];

/** Checkpoint persistido cada N segundos: permite retomar un ride
 *  tras crasheo del WebView o muerte del proceso Android. `extra`
 *  es opaco para el motor: los consumidores guardan ahí sus
 *  contadores propios (p. ej. los del parque) para restaurarlos. */
export type CheckpointMotor = {
  version: 1;
  fuente: FuenteId;
  inicioTs: number;
  ultimoFixTs: number;
  ultimoGuardadoTs: number;
  pausasMs: number;
  pausaAbiertaTs: number | null;
  estado: EstadoActividad;
  metricas: MetricasMotor;
  track: PuntoTrack[];
  /** Estado interno del filtro de velocidad (para retomar sin salto). */
  kalman: { x: number | null; p: number } | null;
  /** Anclas de histéresis de desnivel. */
  anclaGain: number | null;
  anclaLoss: number | null;
  ultimoAltValido: number | null;
  /** Estado privado completo de métricas (para restaurar sin pérdida). */
  privado?: ReturnType<import("./metricas").MotorMetricas["serializar"]> | null;
  /** Extras del consumidor (reglas del parque, etc.). */
  extra?: Record<string, number | boolean | string | null>;
};
