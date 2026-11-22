// ============================================================
// src/motor/config.ts - Activity Profiles: un solo objeto de
// configuración que parametriza el comportamiento del motor sin
// tocar el núcleo. Los valores por defecto son los históricos del
// motor (cero cambio de comportamiento en lo que no se corrige),
// salvo los cambios deliberados de esta fase:
//   · umbralMovimientoKmh unificado en 2.5 (antes 1.5 en el motor
//     y 2.5 en rideMetrics: inconsistencia de la auditoría R6).
//   · gainEmaAlpha 0.1 + gainHisteresisM 4.0 (nuevo: cadena de
//     desnivel calibrada contra ruido GNSS vertical; antes sin
//     histéresis y con la misma EMA rápida de la pendiente).
//   · autoPausa activada por defecto (nueva funcionalidad).
// ============================================================

export type MotorConfig = {
  frecuenciaHz: number;
  gateAccuracyM: number;
  saltoBaseM: number;
  saltoMargenVel: number;
  frescuraMaxMs: number;
  umbralMovimientoKmh: number;
  extrapolacionMs: number;
  extrapolacionFrenoMs: number;
  accelMaxMps2: number;
  altEmaAlpha: number;
  gainEmaAlpha: number;
  pendienteEmaAlpha: number;
  gainHisteresisM: number;
  valtRechazoM: number;
  avanceMinimoM: number;
  pendienteCapPct: number;
  trackCadaSec: number;
  trackMaxPts: number;
  checkpointCadaSec: number;
  autoPausa: {
    activada: boolean;
    kmhParada: number;
    segParada: number;
    kmhReanudar: number;
  };
  kalman: {
    q: number;
    r: number;
    rAccReferenciaM: number;
    rAccMax: number;
  };
};

export const MOTOR_CONFIG_DEFECTO: MotorConfig = {
  frecuenciaHz: 1,
  // Gates de validación de posición (Position Processing).
  gateAccuracyM: 60,
  saltoBaseM: 100,
  saltoMargenVel: 4,
  frescuraMaxMs: 5000,
  // Distancia: el criterio de reposo es la velocidad Doppler filtrada
  // (umbral de movimiento) — sin banda muerta posicional, que el ruido
  // del andar aleatorio de la deriva vencía igual (calibración fase única).
  // Movimiento: unificado con rideMetrics (2.5 km/h).
  umbralMovimientoKmh: 2.5,
  // Velocidad: extrapolación y límites de aceleración. El freno
  // extrapola mucho menos (auditoría R2).
  extrapolacionMs: 400,
  extrapolacionFrenoMs: 100,
  accelMaxMps2: 3,
  // Cadena vertical (Metrics Engine): EMA de altitud (rápida, para
  // pendiente y pista), EMA lenta + histéresis SOLO para el desnivel
  // (calibración fase única: ruido GNSS vertical σ=10-15 m → gain
  // en plano ≤ ~5-17 m por ride de 2 min y una subida real de 50 m
  // se captura al ≥ 90 %) y rechazo de altitud de mala calidad.
  altEmaAlpha: 0.3,
  gainEmaAlpha: 0.1,
  pendienteEmaAlpha: 0.22,
  gainHisteresisM: 4,
  valtRechazoM: 30,
  avanceMinimoM: 3,
  pendienteCapPct: 35,
  // Registro: muestreo del track con decimación progresiva.
  trackCadaSec: 5,
  trackMaxPts: 600,
  // Checkpoint de sesión (Persistence Layer).
  checkpointCadaSec: 15,
  // Pausa automática (Activity Engine): FSM parado/moviendo.
  autoPausa: {
    activada: true,
    kmhParada: 2.0,
    segParada: 15,
    kmhReanudar: 3.0,
  },
  // Filtro de velocidad: Q/R base (los históricos) y adaptación
  // de R por la precisión del fix (auditoría R1).
  kalman: {
    q: 0.55,
    r: 0.35,
    rAccReferenciaM: 6,
    rAccMax: 4,
  },
};

function num(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : def;
  return Math.min(max, Math.max(min, n));
}

/** Resuelve la configuración efectiva: merge profundo del parcial
 *  sobre el defecto con validación de rangos. Jamás lanza: un
 *  parcial inválido cae al valor por defecto del campo. */
export function resolverMotorConfig(parcial?: Partial<MotorConfig>): MotorConfig {
  const d = MOTOR_CONFIG_DEFECTO;
  const p = parcial ?? {};
  const ap = p.autoPausa ?? d.autoPausa;
  const k = p.kalman ?? d.kalman;
  return {
    frecuenciaHz: num(p.frecuenciaHz, d.frecuenciaHz, 0.2, 10),
    gateAccuracyM: num(p.gateAccuracyM, d.gateAccuracyM, 10, 200),
    saltoBaseM: num(p.saltoBaseM, d.saltoBaseM, 20, 1000),
    saltoMargenVel: num(p.saltoMargenVel, d.saltoMargenVel, 1.5, 10),
    frescuraMaxMs: num(p.frescuraMaxMs, d.frescuraMaxMs, 1000, 60000),
    umbralMovimientoKmh: num(p.umbralMovimientoKmh, d.umbralMovimientoKmh, 0.5, 10),
    extrapolacionMs: num(p.extrapolacionMs, d.extrapolacionMs, 0, 2000),
    extrapolacionFrenoMs: num(p.extrapolacionFrenoMs, d.extrapolacionFrenoMs, 0, 1000),
    accelMaxMps2: num(p.accelMaxMps2, d.accelMaxMps2, 1, 10),
    altEmaAlpha: num(p.altEmaAlpha, d.altEmaAlpha, 0.05, 1),
    gainEmaAlpha: num(p.gainEmaAlpha, d.gainEmaAlpha, 0.02, 1),
    pendienteEmaAlpha: num(p.pendienteEmaAlpha, d.pendienteEmaAlpha, 0.05, 1),
    gainHisteresisM: num(p.gainHisteresisM, d.gainHisteresisM, 0, 10),
    valtRechazoM: num(p.valtRechazoM, d.valtRechazoM, 5, 100),
    avanceMinimoM: num(p.avanceMinimoM, d.avanceMinimoM, 0.5, 30),
    pendienteCapPct: num(p.pendienteCapPct, d.pendienteCapPct, 5, 100),
    trackCadaSec: num(p.trackCadaSec, d.trackCadaSec, 1, 60),
    trackMaxPts: num(p.trackMaxPts, d.trackMaxPts, 50, 5000),
    checkpointCadaSec: num(p.checkpointCadaSec, d.checkpointCadaSec, 5, 120),
    autoPausa: {
      activada: ap.activada !== false,
      kmhParada: num(ap.kmhParada, d.autoPausa.kmhParada, 0.5, 10),
      segParada: num(ap.segParada, d.autoPausa.segParada, 3, 120),
      kmhReanudar: num(ap.kmhReanudar, d.autoPausa.kmhReanudar, 1, 15),
    },
    kalman: {
      q: num(k.q, d.kalman.q, 0.01, 5),
      r: num(k.r, d.kalman.r, 0.01, 5),
      rAccReferenciaM: num(k.rAccReferenciaM, d.kalman.rAccReferenciaM, 1, 50),
      rAccMax: num(k.rAccMax, d.kalman.rAccMax, 1, 10),
    },
  };
}

// ---------- perfil persistente de la app (consumidor) ----------
// El MotorConfig puro vive en memoria; Cumbre30 persiste sus
// preferencias de perfil en localStorage y las inyecta al crear el
// motor. Otra aplicación puede tener su propia capa de persistencia.

export const LS_MOTOR_CFG = "cumbre30-motor-cfg-v1";

/** Lee la config parcial persistida de la app (o vacía si no hay). */
export function leerConfigMotor(): Partial<MotorConfig> {
  try {
    if (typeof window === "undefined" || !window.localStorage) return {};
    const raw = window.localStorage.getItem(LS_MOTOR_CFG);
    return raw ? (JSON.parse(raw) as Partial<MotorConfig>) : {};
  } catch {
    return {};
  }
}

/** ¿Auto-pausa activada? (perfil persistido; defecto: sí). */
export function autoPausaActivada(): boolean {
  const cfg = leerConfigMotor();
  return cfg.autoPausa ? cfg.autoPausa.activada !== false : true;
}

/** Cambia la auto-pausa del perfil persistido. */
export function setAutoPausaActivada(on: boolean): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const cfg = leerConfigMotor();
    const merged: Partial<MotorConfig> = {
      ...cfg,
      autoPausa: { ...MOTOR_CONFIG_DEFECTO.autoPausa, ...(cfg.autoPausa ?? {}), activada: on },
    };
    window.localStorage.setItem(LS_MOTOR_CFG, JSON.stringify(merged));
  } catch {
    // sin almacenamiento: la preferencia vive solo en esta sesión
  }
}
