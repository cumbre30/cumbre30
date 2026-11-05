// ============================================================
// Segmentos del cerro (función Cumbre30 Pro).
// Un segmento es un tramo definido por dos geocercas (inicio y
// meta): detectamos en la pista GPS de cada viaje el momento en
// que entras a la geocerca de inicio y el momento en que llegas
// a la meta, validando que sea subida real (desnivel mínimo) y
// un tiempo plausible. Con eso: récord personal, contador de
// intentos e historial por segmento.
// Las pistas se guardan desde la v1.5.0 (GPS únicamente), así
// que los viajes anteriores y los demo no generan intentos.
// 2026-11-05: la meta de los 3 segmentos pasa de la Cumbre a
// PLAZA MÉXICO — el Santuario de la Virgen es solo peatonal y no
// se puede subir en bici (misma ruta, ~210 m antes de la cima).
// ============================================================

import { haversineM } from "./geo";
import type { LatLng } from "./park";
import type { RideSummary, TrackPt } from "./history";

export type SegmentDef = {
  id: string;
  name: string;
  /** Descripción corta para la UI. */
  detail: string;
  start: LatLng;
  end: LatLng;
  /** Radio de llegada a cada geocerca (m). */
  radiusStartM: number;
  radiusEndM: number;
  /** Desnivel mínimo inicio→meta para contar como subida (m). */
  minGainM: number;
  /** Tiempo plausible del intento (s): fuera de este rango se descarta. */
  minTimeSec: number;
  maxTimeSec: number;
};

/** Plaza México: la meta en bici más alta de la ruta de la cumbre
 *  (848 m, junto a la fuente y la parada de los buses panorámicos).
 *  El Santuario de la Virgen (863 m) es solo peatonal. Verificación
 *  y fuentes en NAV_DESTINATIONS de park.ts. */
const PLAZA_MEXICO: LatLng = { lat: -33.4234, lon: -70.6327 };

export const SEGMENTS: SegmentDef[] = [
  {
    id: "pio-nono-plaza-mexico",
    name: "Pío Nono → Plaza México",
    detail: "La subida completa desde Bellavista: ~1,9 km y +140 m.",
    start: { lat: -33.430691, lon: -70.63592 }, // Acceso Pío Nono
    end: PLAZA_MEXICO,
    radiusStartM: 160,
    radiusEndM: 180,
    minGainM: 100,
    minTimeSec: 300, // < 5 min es improbable
    maxTimeSec: 5400, // > 90 min ya no es "intento"
  },
  {
    id: "pv-norte-plaza-mexico",
    name: "Pedro de Valdivia Norte → Plaza México",
    detail: "Subida por el lado oriente: ~3,8 km y +110 m.",
    start: { lat: -33.411769, lon: -70.607988 }, // Acceso Pedro de Valdivia Norte
    end: PLAZA_MEXICO,
    radiusStartM: 150,
    radiusEndM: 180,
    minGainM: 80,
    minTimeSec: 240,
    maxTimeSec: 3600,
  },
  {
    id: "antiluen-plaza-mexico",
    name: "Antilén → Plaza México",
    detail: "Desde la piscina por Av. Carlos Martner y Bannen: ~3,1 km y +45 m.",
    start: { lat: -33.409051, lon: -70.61374 }, // Piscina Antilén
    end: PLAZA_MEXICO,
    radiusStartM: 140,
    radiusEndM: 180,
    minGainM: 30,
    minTimeSec: 150,
    maxTimeSec: 2400,
  },
];

export type SegmentEffort = {
  rideId: string;
  dateISO: string;
  segmentId: string;
  /** Tiempo del intento (s). */
  timeSec: number;
  /** Desnivel positivo del intento (m). */
  gainM: number;
  /** Distancia recorrida dentro del intento, según la pista (m). */
  distanceM: number;
  avgKmh: number;
};

export type SegmentStats = {
  def: SegmentDef;
  /** Mejor tiempo (récord personal). */
  pb: SegmentEffort | null;
  /** Intentos válidos totales. */
  count: number;
  /** Último intento (por fecha). */
  last: SegmentEffort | null;
  /** Los 3 mejores tiempos. */
  top: SegmentEffort[];
};

function firstWithin(track: TrackPt[], from: number, p: LatLng, radiusM: number): number {
  for (let i = from; i < track.length; i++) {
    if (haversineM({ lat: track[i][0], lon: track[i][1] }, p) <= radiusM) return i;
  }
  return -1;
}

/**
 * Detecta TODOS los intentos válidos de un segmento dentro de un
 * viaje (puede haber varios si subiste, bajaste y volviste a subir).
 */
export function detectEfforts(r: RideSummary, def: SegmentDef): SegmentEffort[] {
  const track = r.track;
  if (!track || track.length < 4) return [];

  const efforts: SegmentEffort[] = [];
  let i = 0;
  while (i < track.length) {
    const iStart = firstWithin(track, i, def.start, def.radiusStartM);
    if (iStart < 0) break;
    const iEnd = firstWithin(track, iStart + 1, def.end, def.radiusEndM);
    if (iEnd < 0) break;

    const timeSec = track[iEnd][3] - track[iStart][3];
    const gainM = track[iEnd][2] - track[iStart][2];

    if (timeSec >= def.minTimeSec && timeSec <= def.maxTimeSec && gainM >= def.minGainM) {
      let distanceM = 0;
      for (let j = iStart + 1; j <= iEnd; j++) {
        distanceM += haversineM(
          { lat: track[j - 1][0], lon: track[j - 1][1] },
          { lat: track[j][0], lon: track[j][1] },
        );
      }
      efforts.push({
        rideId: r.id,
        dateISO: r.dateISO,
        segmentId: def.id,
        timeSec,
        gainM,
        distanceM,
        avgKmh: timeSec > 0 ? (distanceM / timeSec) * 3.6 : 0,
      });
    }
    // Consumimos el par: sigamos buscando después de la meta,
    // por si el viaje contiene otro intento (bajó y volvió a subir).
    i = iEnd + 1;
  }
  return efforts;
}

/** Todos los intentos de un viaje, en todos los segmentos. */
export function rideEfforts(r: RideSummary): SegmentEffort[] {
  const out: SegmentEffort[] = [];
  for (const def of SEGMENTS) out.push(...detectEfforts(r, def));
  return out.sort((a, b) => a.timeSec - b.timeSec);
}

/** Resumen por segmento (récord, contador, últimos y top 3). */
export function computeSegmentStats(rides: RideSummary[]): SegmentStats[] {
  return SEGMENTS.map((def) => {
    const efforts: SegmentEffort[] = [];
    for (const r of rides) efforts.push(...detectEfforts(r, def));
    efforts.sort((a, b) => a.timeSec - b.timeSec);
    const byDate = [...efforts].sort(
      (a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime(),
    );
    return {
      def,
      pb: efforts[0] ?? null,
      count: efforts.length,
      last: byDate[0] ?? null,
      top: efforts.slice(0, 3),
    };
  });
}

/** Mapa rideId → intentos de ese viaje (para la ficha de cada ride). */
export function effortsByRide(rides: RideSummary[]): Map<string, SegmentEffort[]> {
  const map = new Map<string, SegmentEffort[]>();
  for (const r of rides) {
    const e = rideEfforts(r);
    if (e.length) map.set(r.id, e);
  }
  return map;
}

/** "24:31" o "1:02:08" — reutiliza el formateo global. */
export { formatClock as fmtEffort } from "./geo";
