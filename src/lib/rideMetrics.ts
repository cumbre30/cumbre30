/**
 * rideMetrics - métricas derivadas del ride (Perfil Ciclista, fase 1).
 *
 * Se calculan en el DISPOSITIVO al cerrar el ride: el track crudo nunca
 * sale del teléfono (privacidad) y la batería ya se gastó grabando; el
 * servidor solo recibe el resumen derivado. El track está muestreado
 * cada 5 s y se va adelgazando en rides largos (x2 cuando supera 600
 * puntos → 10 s, 20 s…), así que "pico 15 s" es en realidad el P95 de
 * las velocidades de tramo con dt ≤ 15 s en llano: aproximación
 * deliberada, robusta al adelgazado.
 *
 * Umbrales del spec (perfil-ciclista v1):
 *   · en movimiento:   ≥ 2.5 km/h
 *   · llano:           |pendiente| ≤ 1.5 %
 *   · subida (VAM):    pendiente > 4 %   (grupos con ≥ 3 m de ascenso)
 *   · antitrampa:      > 55 km/h sostenido / > 28 km/h en pendiente > 6 %
 *
 * Fase 2 (v1.13.17): con los pesos del conjunto (ciclista + bici) estima
 * los watts SOLO en tramos de subida > 4 % - ahí la gravedad domina
 * (P ≈ m·g·v·pendiente) y la estimación sin sensor de potencia es
 * honesta; en llano la resistencias del aire/rodadura dominan y el
 * error sería grande, así que no se reporta.
 */
import { DEFAULT_BIKE_KG, DEFAULT_RIDER_KG, type RideWeights } from "@/lib/rideWeights";

/** Punto del track (misma forma que TrackPt de history.ts, sin acoplar). */
type TrackSample = [number, number, number, number];

export type RideMetrics = {
  movingSec: number;
  /** P95 de velocidades de tramo en llano (dt ≤ 15 s). null sin llano. */
  peak15sKmh: number | null;
  /** Media ponderada por km en llano. null sin llano. */
  flatAvgKmh: number | null;
  /** Km en llano (denominador de paradas/km del arquetipo URBAN). */
  flatKm: number;
  /** Metros ascendidos en pendiente > 4 % (grupos ≥ 3 m). */
  climbGainM: number;
  /** Segundos en movimiento con pendiente > 4 % (grupos contados). */
  climbSec: number;
  /** VAM = m·3600/s si hubo ≥ 60 s subiendo; null si no. */
  vamMh: number | null;
  /** Paradas: grupos a < 2.5 km/h por > 15 s (sin contar inicio/fin). */
  stopCount: number;
  /** Tiempo total sobre 55 km/h (antitrampa). */
  secOver55: number;
  /** Tramo continuo más largo sobre 55 km/h (antitrampa). */
  over55StreakSec: number;
  /** Media en pendiente > 6 % en movimiento (antitrampa). null sin datos. */
  climb6AvgKmh: number | null;
  /** Watts estimados en subida >4% (media ponderada por tiempo; modelo
   *  gravedad + rodamiento + aire con los pesos del conjunto). null si
   *  hubo < 30 s subiendo (ruido). Los km off-road/netKm llegan aparte
   *  (rideOffroad augment): se agregan como campos opcionales. */
  estWattsClimb: number | null;
  /** Km sobre red clasificada off-road (path/track). Solo si la red de
   *  navegación estaba disponible al cerrar el ride. */
  offRoadKm?: number | null;
  /** Km del track que cayeron sobre la red (denominador del eje
   *  Exploración: sin cobertura de red no se evalúa el eje). */
  netKm?: number | null;
  /** Puntos de track usados (telemetría del muestreo). */
  samples: number;
};

const EARTH_R = 6371000; // metros

// Modelo de potencia en subida (fase 2): gravedad + rodamiento + aire.
const G = 9.80665; // m/s²
const CRR = 0.005; // coef. de rodadura (asfalto)
const RHO = 1.225; // densidad del aire kg/m³
const CDA = 0.45; // área efectiva m² (manos en manillar)
const WATTS_SEG_MAX = 2000; // techo por segmento (glitch de GPS)
const WATTS_MIN_SEC = 30; // menos de esto subiendo: ruido → null

/** Distancia haversine entre dos puntos (m). */
function distM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(a));
}

/** Percentil p (0..1) ponderado por peso: recorre acumulando pesos. */
function pctilPonderado(vals: number[], pesos: number[], p: number): number | null {
  if (!vals.length) return null;
  const orden = vals.map((v, i) => [v, pesos[i]] as const).sort((a, b) => a[0] - b[0]);
  const total = orden.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [v, w] of orden) {
    acc += w;
    if (acc >= total * p) return v;
  }
  return orden[orden.length - 1][0];
}

/** Redondeo a 1 decimal (null-safe). */
const r1 = (v: number | null): number | null => (v === null ? null : Math.round(v * 10) / 10);

/**
 * Deriva las métricas del perfil desde el track del ride.
 * `weights`: pesos del conjunto (ciclista + bici); si no llegan se usan
 * los defaults 75/12 kg (estándar del sector).
 * Devuelve null si no hay track aprovechable (rides demo o muy cortos):
 * esos rides siguen contando para Resistencia/Constancia con los
 * totales del resumen, pero no aportan ejes de velocidad/explosividad.
 */
export function computeRideMetrics(
  track: TrackSample[],
  weights: RideWeights = { riderKg: DEFAULT_RIDER_KG, bikeKg: DEFAULT_BIKE_KG },
): RideMetrics | null {
  const n = track.length;
  if (n < 3) return null;

  const masaKg = weights.riderKg + weights.bikeKg;

  let movingSec = 0;
  let flatKmM = 0; // metros en llano
  let flatVM = 0; // Σ v·dt en llano (media ponderada por tiempo)
  let flatSec = 0; // Σ dt en llano (denominador de la media)
  const vLlano: number[] = [];
  const wLlano: number[] = [];
  let climbGainM = 0;
  let climbSec = 0;
  let climb6Sec = 0;
  let climb6VM = 0;
  // Watts en subida: acumuladores por segmento (p·dt / dt).
  let wattsVMSum = 0;
  let wattsSec = 0;
  let stopCount = 0;
  let secOver55 = 0;
  let over55Streak = 0;
  let over55Best = 0;

  // Grupo de subida en curso (histéresis de 3 m): solo se cuentan los
  // metros/tiempo del grupo si acumuló ≥ 3 m continuos de ascenso.
  let grupoSubM = 0;
  let grupoSubSec = 0;
  // Grupo de parada en curso (< 2.5 km/h) y si ya hubo movimiento antes.
  let grupoStopSec = 0;
  let huboMovimiento = false;

  for (let i = 1; i < n; i++) {
    const [lat1, lon1, alt1, t1] = track[i - 1];
    const [lat2, lon2, alt2, t2] = track[i];
    const dt = t2 - t1;
    if (dt <= 0 || dt > 120) continue; // hueco de GPS: segmento inválido
    const d = distM(lat1, lon1, lat2, lon2);
    if (d < 1) {
      // Fijo sin avance: es exactamente una parada - acumula su tiempo
      // y cierra el grupo de subida en curso (no aporta velocidad).
      if (grupoSubM >= 3) {
        climbGainM += grupoSubM;
        climbSec += grupoSubSec;
      }
      grupoSubM = 0;
      grupoSubSec = 0;
      grupoStopSec += dt;
      continue;
    }
    const v = (d / dt) * 3.6; // km/h
    const dAlt = alt2 - alt1;
    const slope = d >= 5 ? (dAlt / d) * 100 : null;

    if (v >= 2.5) {
      movingSec += dt;
      // fin de grupo de parada (si había): cuenta solo la parada interior
      // (la stationary previa al primer movimiento es el arranque, no una parada)
      if (grupoStopSec > 15 && huboMovimiento) stopCount++;
      grupoStopSec = 0;
      huboMovimiento = true;

      if (slope !== null && Math.abs(slope) <= 1.5) {
        flatKmM += d;
        flatVM += v * dt;
        flatSec += dt;
        if (dt <= 15) {
          vLlano.push(v);
          wLlano.push(dt);
        }
      }
      if (slope !== null && slope > 4 && dAlt > 0) {
        grupoSubM += dAlt;
        grupoSubSec += dt;
        // Watts estimados del segmento (subida >4%): gravedad domina,
        // pero rodamiento y aire van incluidos para no sobreestimar.
        const vms = d / dt;
        const grade = dAlt / d;
        const p =
          masaKg * G * vms * grade + CRR * masaKg * G * vms + 0.5 * RHO * CDA * vms * vms * vms;
        if (p > 0 && p < WATTS_SEG_MAX) {
          wattsVMSum += p * dt;
          wattsSec += dt;
        }
      } else {
        // fin del grupo de subida: histéresis de 3 m
        if (grupoSubM >= 3) {
          climbGainM += grupoSubM;
          climbSec += grupoSubSec;
        }
        grupoSubM = 0;
        grupoSubSec = 0;
      }
      if (slope !== null && slope > 6) {
        climb6Sec += dt;
        climb6VM += v * dt;
      }
    } else {
      // parada en curso (cierra grupos de subida también)
      if (grupoSubM >= 3) {
        climbGainM += grupoSubM;
        climbSec += grupoSubSec;
      }
      grupoSubM = 0;
      grupoSubSec = 0;
      grupoStopSec += dt;
    }

    if (v > 55) {
      secOver55 += dt;
      over55Streak += dt;
      if (over55Streak > over55Best) over55Best = over55Streak;
    } else {
      over55Streak = 0;
    }
  }
  // cierres finales de grupos
  if (grupoSubM >= 3) {
    climbGainM += grupoSubM;
    climbSec += grupoSubSec;
  }
  if (grupoStopSec > 15 && huboMovimiento) stopCount++;

  const flatKm = flatKmM / 1000;
  const peak = pctilPonderado(vLlano, wLlano, 0.95);
  return {
    movingSec: Math.round(movingSec),
    peak15sKmh: r1(peak),
    flatAvgKmh: flatSec > 0 ? r1(flatVM / flatSec) : null,
    flatKm: Math.round(flatKm * 100) / 100,
    climbGainM: Math.round(climbGainM),
    climbSec: Math.round(climbSec),
    vamMh: climbSec >= 60 ? Math.round((climbGainM * 3600) / climbSec) : null,
    stopCount,
    secOver55: Math.round(secOver55),
    over55StreakSec: Math.round(over55Best),
    climb6AvgKmh: climb6Sec >= 30 ? r1(climb6VM / climb6Sec) : null,
    estWattsClimb: wattsSec >= WATTS_MIN_SEC ? Math.round(wattsVMSum / wattsSec) : null,
    samples: n,
  };
}
