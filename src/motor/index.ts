// ============================================================
// src/motor/index.ts - API PÚBLICA del MotorGPS (fase única,
// cierre). Un solo punto de importación para consumidores externos:
// un proyecto que use el motor importa desde aquí y jamás desde
// archivos internos de Cumbre30. El núcleo no importa nada de la
// app (verificación continua en tests/motor-cierre.test.ts).
// ============================================================

// Núcleo
export { MotorGPS, type MotorGPSSnapshot } from "./nucleo";

// Contratos tipados
export type {
  AlmacenCheckpoint,
  CheckpointMotor,
  EstadoActividad,
  EventoMotor,
  FixBruto,
  FuenteId,
  FuenteUbicacion,
  MetricasMotor,
  OyenteMotor,
  PuntoTrack,
  ResultadoFix,
} from "./tipos";

// Configuración (pura, sin producto)
export { MOTOR_CONFIG_DEFECTO, resolverMotorConfig, type MotorConfig } from "./config";

// Etapas
export { ProcesadorPosicion } from "./procesamiento";
export { MotorMetricas } from "./metricas";
export { MotorActividad } from "./actividad";
export { KalmanVelocidad, type EstadoKalman } from "./kalman";

// Geografía (Haversine propia del motor)
export { haversineM, type PuntoGeo } from "./geo";

// Persistencia: contrato + implementaciones genéricas del núcleo.
// La implementación duradera del producto (localStorage + archivo
// nativo) vive en la app: src/lib/almacenDuradero.ts — se inyecta.
export {
  almacenEnMemoria,
  almacenLocalStorage,
  esCheckpointValido,
} from "./persistencia";
