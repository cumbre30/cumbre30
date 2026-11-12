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
// PLAZA MÉXICO - el Santuario de la Virgen es solo peatonal y no
// se puede subir en bici (misma ruta, ~210 m antes de la cima).
// 2026-11-13: inicios de subida anclados a GATES (las porterías
// Pío Nono y La Pirámide se movieron con la coordenada exacta del
// cliente); nuevo segmento La Pirámide → Plaza México (subida ciclable
// directa de 5,91 km por el Sendero Ciclista Pirámide y Av. Carlos
// Martner, verificada con findRoute) y las 3 BAJADAS del control
// 30 km/h - los mismos corredores rojos de la capa Normativa y
// Seguridad; la auditoría scripts/audita-segmentos.ts los mantiene
// sincronizados con el trazado.
// ============================================================

import { haversineM } from "./geo";
import { GATES, type LatLng } from "./park";
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
  /** Desnivel mínimo inicio→meta para contar como subida (m).
   *  En descensos (dir "bajada") es el desnivel que DEBES perder:
   *  el intento valida gainM <= -minGainM. */
  minGainM: number;
  /** Tiempo plausible del intento (s): fuera de este rango se descarta. */
  minTimeSec: number;
  maxTimeSec: number;
  /** Dirección del intento: "subida" (default) o "bajada" para los
   *  senderos de enduro (2026-11-11). */
  dir?: "subida" | "bajada";
  /** true: trazado preliminar, pendiente de la publicación oficial
   *  de Parquemet (5 rutas de enduro, antes del 15 de diciembre). */
  preliminar?: boolean;
};

/** Plaza México: la meta en bici más alta de la ruta de la cumbre
 *  (848 m, junto a la fuente y la parada de los buses panorámicos).
 *  El Santuario de la Virgen (863 m) es solo peatonal. Verificación
 *  y fuentes en NAV_DESTINATIONS de park.ts. */
const PLAZA_MEXICO: LatLng = { lat: -33.4234, lon: -70.6327 };

/** Posición de una portería ciclista - fuente única: GATES de park.ts.
 *  Así las geocercas de inicio nunca se desincronizan del mapa cuando
 *  el cliente mueve una portería (pasó con Pío Nono y La Pirámide). */
const gate = (id: string): LatLng => GATES.find((g) => g.id === id)!.position;

/** Textos y umbrales de las 3 bajadas del control 30 km/h (claves =
 *  ids de BAJADAS_CONTROL_30). minGainM = pérdida mínima que debe
 *  mostrar el GPS para validar el descenso, calibrada con las alturas
 *  oficiales (CUMBRES/SIM_ROUTE): Plaza México 848 → Pío Nono ~706
 *  (-140), Chacarillas 800 → PdV Norte ~705 (-95), Chacarillas →
 *  portería La Pirámide (-40/-60). El umbral queda al ~55-65% de la
 *  caída real para tolerar la deriva del GPS del teléfono. */
const BAJADAS_30_META: Record<
  string,
  { name: string; detail: string; minGainM: number; minTimeSec: number; maxTimeSec: number }
> = {
  "b30-pionono": {
    name: "Bajada 30 · Plaza México → Pío Nono",
    detail: "La bajada principal fiscalizada (plan Pedalea Seguro): ~5,0 km y -140 m.",
    minGainM: 100,
    minTimeSec: 300,
    maxTimeSec: 2700,
  },
  "b30-pdv": {
    name: "Bajada 30 · Antilén → Pedro de Valdivia",
    detail: "Bajada fiscalizada del lado oriente: ~2,8 km y -95 m.",
    minGainM: 60,
    minTimeSec: 180,
    maxTimeSec: 1800,
  },
  "b30-piramide": {
    name: "Bajada 30 · Chacarillas → La Pirámide",
    detail: "Bajada fiscalizada hacia Vitacura: ~3,3 km desde la cima Chacarillas.",
    minGainM: 25,
    minTimeSec: 210,
    maxTimeSec: 2100,
  },
};

/** Extremos de las 3 bajadas del control 30 km/h (2026-11-13), copiados
 *  de los extremos de BAJADAS_CONTROL_30 (rutasTrazados.ts) - los mismos
 *  corredores que la capa Normativa y Seguridad pinta en rojo. Van como
 *  constantes y NO por import para no arrastrar los ~4.900 pares del
 *  trazado al bundle principal (segments.ts lo usan pestañas estáticas;
 *  el trazado viaja sólo con el MapView lazy). La auditoría
 *  scripts/audita-segmentos.ts verifica estos extremos contra el trazado
 *  real (≤2 m): si el corredor rojo cambia, la auditoría avisa y aquí se
 *  actualizan. */
const BAJADAS_30_EXTREMOS: Record<string, { start: LatLng; end: LatLng }> = {
  "b30-pionono": {
    start: { lat: -33.423652, lon: -70.632435 }, // Plaza México
    end: { lat: -33.43069, lon: -70.636273 }, // esquina de entrada Pío Nono (GATE 0 m)
  },
  "b30-pdv": {
    start: { lat: -33.407511, lon: -70.611222 }, // Plaza Antilén
    end: { lat: -33.415461, lon: -70.617414 }, // portería PdV Norte (a 2 m)
  },
  "b30-piramide": {
    start: { lat: -33.408687, lon: -70.61393 }, // cima Cerro Chacarillas
    end: { lat: -33.388184, lon: -70.601754 }, // portería La Pirámide (a 9 m)
  },
};

/** Orden fijo de presentación de las bajadas 30 en la lista. */
const BAJADAS_30_ORDEN = ["b30-pionono", "b30-pdv", "b30-piramide"] as const;

export const SEGMENTS: SegmentDef[] = [
  {
    id: "pio-nono-plaza-mexico",
    name: "Pío Nono → Plaza México",
    detail: "La subida completa desde Bellavista: ~1,9 km y +140 m.",
    // Portería exacta del cliente (2026-11-13), antes (-33.430691, -70.63592).
    start: gate("pio-nono"),
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
    start: gate("pv-norte"), // cruce Av. El Cerro × Av. PdV Norte
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
  {
    id: "la-piramide-plaza-mexico",
    name: "La Pirámide → Plaza México",
    detail: "Subida desde Vitacura por el Sendero Ciclista Pirámide y Av. Carlos Martner: ~5,9 km.",
    // Portería exacta del cliente (2026-11-13), nodo Zañartu a 9 m.
    start: gate("la-piramide"),
    end: PLAZA_MEXICO,
    radiusStartM: 150,
    radiusEndM: 180,
    // Plaza México 848 m; la portería queda claramente más abajo
    // (Cerro La Pirámide 733 m): +60 m de umbral tolera el ruido
    // del GPS sin bloquear intentos reales (~+90/+110 m).
    minGainM: 60,
    minTimeSec: 600, // 5,9 km de subida: < 10 min es improbable
    maxTimeSec: 5400,
  },
  // ---- Bajadas del control 30 km/h (2026-11-13) ----
  // Extremos = extremos de los corredores rojos de la capa Normativa
  // (BAJADAS_30_EXTREMOS, verificados por auditoría contra el trazado).
  // Radios 120/130 m: el arranque está junto a la plaza/cima y la
  // meta en la portería (los trazados cierran a 2-9 m del acceso).
  ...BAJADAS_30_ORDEN.flatMap((id) => {
    const meta = BAJADAS_30_META[id];
    const ext = BAJADAS_30_EXTREMOS[id];
    if (!meta || !ext) return [];
    return [
      {
        id,
        name: meta.name,
        detail: meta.detail,
        start: ext.start,
        end: ext.end,
        radiusStartM: 120,
        radiusEndM: 130,
        minGainM: meta.minGainM,
        minTimeSec: meta.minTimeSec,
        maxTimeSec: meta.maxTimeSec,
        dir: "bajada" as const,
      },
    ];
  }),
  // ---- Senderos de tierra (enduro) ----
  // Extremos tomados de la geometría OSM de cada sendero
  // (scripts/extract-parque.py, 2026-11-11). Son trazados
  // preliminares: Parquemet aún no publica las 5 rutas de enduro
  // oficiales (obligatorio desde el 15 de diciembre); al
  // confirmarse se ajustan start/end y se marcan como oficiales.
  {
    id: "zorro-vidal-bajada",
    name: "Zorro Vidal · bajada",
    detail: "Descenso de tierra desde Plaza México por el sendero: ~0,6 km y -100 m (meta antes de la confluencia con el camino).",
    start: { lat: -33.42394, lon: -70.63269 }, // cabeza alta (borde Plaza México)
    // 2026-11-13: la meta ya NO es la salida al sector Pío Nono
    // (-33.42651, -70.63765): el camino pavimentado Plaza México → Pío
    // Nono pasa a 1 m de ese punto y todo descenso por el camino
    // generaba un intento falso de este sendero. La meta sube al punto
    // del sendero que queda a 168 m del camino (fuera del radio 130),
    // verificado punto a punto contra el trazado b30-pionono.
    end: { lat: -33.42164, lon: -70.63496 }, // sendero, 168 m del camino
    radiusStartM: 110,
    radiusEndM: 130,
    minGainM: 60, // caída real hasta aquí ~100 m (antes 80 sobre -140)
    minTimeSec: 60,
    maxTimeSec: 900,
    dir: "bajada",
    preliminar: true,
  },
  {
    id: "mapuche-bajada",
    name: "Mapuche · bajada",
    detail: "Descenso de tierra desde la zona Anáhuac hacia el camino: ~1,1 km y -35 m.",
    start: { lat: -33.41781, lon: -70.62392 }, // cabeza alta (sector Anáhuac)
    end: { lat: -33.42405, lon: -70.62944 }, // salida al camino
    radiusStartM: 110,
    radiusEndM: 130,
    minGainM: 20,
    minTimeSec: 60,
    maxTimeSec: 900,
    dir: "bajada",
    preliminar: true,
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

    // Subida: se exige ganar al menos minGainM. Bajada: se exige
    // PERDER al menos minGainM (gainM <= -minGainM).
    const dirOk = def.dir === "bajada" ? gainM <= -def.minGainM : gainM >= def.minGainM;
    if (timeSec >= def.minTimeSec && timeSec <= def.maxTimeSec && dirOk) {
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

/** "24:31" o "1:02:08" - reutiliza el formateo global. */
export { formatClock as fmtEffort } from "./geo";
