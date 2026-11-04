// ============================================================
// Detección de viajes en vehículo motorizado (solo GPS real).
//
// Objetivo (pedido del usuario): que los desafíos no cuenten
// rides hechos en auto/moto. El motor solo tiene GPS a 1 Hz
// (el WebView de Capacitor no entrega acelerómetro fiable),
// así que la señal disponible es la VELOCIDAD SOSTENIDA:
//
//  · Una bici toca puntas altas en bajada (el reto Velocista
//    pide 42 km/h), pero NO SOSTIENE 45+ km/h por minuto.
//  · Un vehículo en avenida sostiene 45+ entre semáforos y
//    acumula promedios móviles imposibles para una bici.
//
// Como ninguna heurística es perfecta (una bajada rápida en
// Pedro de Valdivia Norte puede sostener 45+ por ~1 min),
// la detección es HÍBRIDA: el motor marca el ride como
// sospechoso y la app pregunta al guardar "¿fuiste en bici?".
// El usuario corrige falsos positivos con un toque; los rides
// marcados como vehículo quedan con badge en el historial y
// NO cuentan para desafíos ni estadísticas (statsFromRides).
// ============================================================

/** Velocidad sostenida que una bici no mantiene: umbral de sospecha. */
export const VEH_LIMIT_KMH = 45;

/** Total de segundos sobre VEH_LIMIT_KMH para marcar sospecha. */
export const VEH_TOTAL_SEC = 90;

/** Segmento CONTINUO sobre VEH_LIMIT_KMH para marcar sospecha. */
export const VEH_STREAK_SEC = 45;

/** Promedio móvil de vía urbana que una bici del cerro no sostiene... */
export const VEH_AVG_KMH = 32;
/** ...durando al menos 10 minutos en movimiento. */
export const VEH_AVG_SEC = 600;

/** Velocidad absoluta fuera del rango de cualquier bici urbana. */
export const VEH_ABS_KMH = 90;

export type VehicleSignals = {
  /** Segundos acumulados sobre VEH_LIMIT_KMH (post-Kalman). */
  vehSec: number;
  /** Mayor segmento continuo sobre VEH_LIMIT_KMH (segundos). */
  vehStreakSec: number;
  /** Promedio móvil del ride (km recorridos / tiempo en movimiento). */
  avgKmh: number;
  /** Segundos en movimiento (> 1.5 km/h). */
  movingSec: number;
  /** Velocidad máxima del ride (Doppler filtrado). */
  maxKmh: number;
};

/**
 * Decide si un ride tiene huella de vehículo motorizado.
 * Pura y determinista: testeable sin GPS. La respuesta define
 * si la app pregunta "¿fuiste en bici?" al guardar.
 */
export function isMotorizedRide(s: VehicleSignals): boolean {
  // 1) Velocidad absoluta imposible en bici (moto/auto directo).
  if (s.maxKmh >= VEH_ABS_KMH) return true;
  // 2) Sostuvo el umbral sin frenar: huella clara de motor.
  if (s.vehStreakSec >= VEH_STREAK_SEC) return true;
  // 3) Acumuló mucho tiempo sobre el umbral (ráfagas entre semáforos).
  if (s.vehSec >= VEH_TOTAL_SEC) return true;
  // 4) Ritmo de vía urbana sostenido 10+ min: una bici del cerro
  //    no mantiene ese promedio (y la bajada no dura 10 min).
  if (s.avgKmh >= VEH_AVG_KMH && s.movingSec >= VEH_AVG_SEC) return true;
  return false;
}
