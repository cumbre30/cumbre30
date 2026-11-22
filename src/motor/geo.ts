// ============================================================
// src/motor/geo.ts - utilidades geográficas puras del motor.
// Fase única (cierre): la fórmula Haversine vive DENTRO del
// motor — ni el núcleo ni los procesadores importan lib/geo ni
// lib/park (dependencia residual eliminada del informe de
// modularización). Mismo R y misma fórmula que lib/geo de la app:
// la paridad se verifica en tests/motor-gps.test.ts.
// ============================================================

/** Radio terrestre medio en metros (WGS84 esferoide aprox., el
 *  estándar de los ciclocomputadores). */
const R = 6371000;

/** Punto geográfico mínimo del motor (sin depender de LatLng de
 *  la app). FixBruto y PuntoTrack son estructuralmente compatibles. */
export type PuntoGeo = { lat: number; lon: number };

/** Distancia ortodrómica Haversine entre dos puntos, en metros. */
export function haversineM(a: PuntoGeo, b: PuntoGeo): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
