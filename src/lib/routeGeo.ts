// ============================================================
// Utilidades geográficas del módulo Rutas y Comunidad (fase A,
// arquitectura v2.1 §4): derivados calculados AL ESCRIBIR para que
// las consultas del catálogo corran sobre columnas dedicadas y
// nunca decodificando polilíneas (v2.1 cambio C1/C2).
//
// Todo es puro (sin APIs de navegador): lo consume la API
// /api/routes para derivar bbox/celdas/distancia del payload, y
// los tests de la suite CT-G de la fase D.
// ============================================================

export type Punto = { lat: number; lon: number };

export type Bbox = { minLat: number; maxLat: number; minLon: number; maxLon: number };

/** Radio de la Tierra en metros (promedio). */
const R_M = 6_371_000;

/** Distancia haversine entre dos puntos, en metros. */
export function haversineM(a: Punto, b: Punto): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Distancia total de la polilínea en km (recorrido real, no volar). */
export function distKm(coords: Punto[]): number {
  let m = 0;
  for (let i = 1; i < coords.length; i++) m += haversineM(coords[i - 1], coords[i]);
  return Math.round((m / 1000) * 100) / 100;
}

/** Bbox exacto de la geometría (predicado de intersección de v2.1 §4.1). */
export function bboxOf(coords: Punto[]): Bbox {
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  for (const c of coords) {
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
    if (c.lon < minLon) minLon = c.lon;
    if (c.lon > maxLon) maxLon = c.lon;
  }
  return { minLat, maxLat, minLon, maxLon };
}

/** Centro del bbox (orden por cercanía en el catálogo: v2.1 §4.3). */
export function centerOf(bbox: Bbox): Punto {
  return { lat: (bbox.minLat + bbox.maxLat) / 2, lon: (bbox.minLon + bbox.maxLon) / 2 };
}

/** Redondeo a 3 decimales (~110 m): extremos aproximados que se
 *  publican. El pin exacto del creador jamás llega al servidor. */
export function aprox3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

// ---------- geohash ----------

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** geohash estándar (implementación propia ≤40 líneas, v2.1 §13):
 *  precisionChars=5 → celdas ~4,9 km; 4 → ~39 km. */
export function geohashEncode(lat: number, lon: number, precisionChars: 4 | 5): string {
  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180;
  let hash = "", bit = 0, ch = 0, even = true;
  while (hash.length < precisionChars) {
    if (even) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) { ch = (ch << 1) + 1; lonMin = mid; } else { ch <<= 1; lonMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { ch = (ch << 1) + 1; latMin = mid; } else { ch <<= 1; latMax = mid; }
    }
    even = !even;
    if (++bit === 5) { hash += BASE32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

/** Celdas madre geohash-4 de una lista de celdas geohash-5 (para
 *  mezclar granularidades cuando una ruta larga cae a g4). */
export function padresG4(cells: string[]): string[] {
  const out = new Set<string>();
  for (const c of cells) out.add(c.slice(0, 4));
  return [...out];
}

/** Tamaño de muestreo al recorrer segmentos (~4 km): un segmento más
 *  largo se subdivide para no saltarse celdas intermedias. */
const PASO_M = 4_000;

/** Conjunto de celdas geohash que toca la geometría (v2.1 §4.2, C2):
 *  recorre la polilínea con subdivisión de segmentos y deduplica.
 *  Si una ruta toca más de maxCells celdas geohash-5, cae a geohash-4
 *  (celdas más gruesas); la consulta incluye las madres g4 de sus
 *  celdas g5, así la mezcla de granularidades sigue encontrándola. */
export function cellsOfRoute(coords: Punto[], maxCells = 64): { g: 4 | 5; cells: string[] } {
  const puntos: Punto[] = [];
  for (let i = 0; i < coords.length; i++) {
    puntos.push(coords[i]);
    if (i === coords.length - 1) break;
    const d = haversineM(coords[i], coords[i + 1]);
    const pasos = Math.ceil(d / PASO_M);
    for (let k = 1; k < pasos; k++) {
      const f = k / pasos;
      puntos.push({
        lat: coords[i].lat + (coords[i + 1].lat - coords[i].lat) * f,
        lon: coords[i].lon + (coords[i + 1].lon - coords[i].lon) * f,
      });
    }
  }
  for (const g of [5, 4] as const) {
    const set = new Set<string>();
    for (const p of puntos) set.add(geohashEncode(p.lat, p.lon, g));
    if (set.size <= maxCells) return { g, cells: [...set] };
  }
  // Ruta de alcance continental (no esperada): g4 sin tope estricto.
  const set = new Set<string>();
  for (const p of puntos) set.add(geohashEncode(p.lat, p.lon, 4));
  return { g: 4, cells: [...set] };
}

/** Celdas a consultar para un viewport: g4 gruesas cubriendo el bbox
 *  (paso ~0,35°) + g5 finas (paso ~0,018° ≈ 2 km) + los 4 bordes
 *  muestreados finos (predicado inclusivo, CT-G4). La consulta usa el
 *  solapamiento de arreglos (hasSome) contra `cells`. */
export function cellsForViewport(n: number, s: number, e: number, o: number): string[] {
  const set = new Set<string>();
  const cruza = o > e; // viewport que cruza el antimeridiano (v2.1 C3)

  /** Lons a muestrear; con cruce, ambos tramos [o,180] y [-180,e]. */
  const rangoLons = (paso: number): number[] => {
    const out: number[] = [];
    if (cruza) {
      for (let lon = o; lon <= 180; lon += paso) out.push(lon);
      for (let lon = -180; lon <= e; lon += paso) out.push(lon);
    } else {
      for (let lon = o; lon <= e; lon += paso) out.push(lon);
    }
    return out;
  };

  // G4 gruesas: cubren el viewport entero aunque sea grande.
  const lonsG4 = rangoLons(0.35);
  for (let lat = s; lat <= n; lat += 0.35) {
    for (const lon of lonsG4) set.add(geohashEncode(lat, lon, 4));
  }

  // G5 finas (~2 km): interior + los cuatro bordes muestreados finos.
  const PASO = 0.018;
  const latsF: number[] = [];
  for (let lat = s; lat <= n; lat += PASO) latsF.push(lat);
  const lonsF = rangoLons(PASO);
  for (const lat of [...latsF, n]) {
    for (const lon of lonsF) set.add(geohashEncode(lat, lon, 5));
  }
  for (const lat of [...latsF, n]) {
    set.add(geohashEncode(lat, o, 5));
    set.add(geohashEncode(lat, e, 5));
  }
  for (const lon of [...lonsF, e]) {
    set.add(geohashEncode(s, lon, 5));
    set.add(geohashEncode(n, lon, 5));
  }
  return [...set];
}

// ---------- polilínea codificada (formato de entrega) ----------

function varint(v: number): string {
  let out = "";
  let x = v < 0 ? ~(v << 1) : v << 1;
  while (x >= 0x20) {
    out += String.fromCharCode((0x20 | (x & 0x1f)) + 63);
    x >>= 5;
  }
  out += String.fromCharCode(x + 63);
  return out;
}

/** Codifica la geometría pública (Google polyline, precisión 5). La
 *  polyline es SOLO formato de entrega/render: las consultas usan
 *  bbox y cells (v2.1 §4). */
export function polylineEncode(coords: Punto[]): string {
  let out = "", lastLat = 0, lastLon = 0;
  for (const c of coords) {
    const la = Math.round(c.lat * 1e5);
    const lo = Math.round(c.lon * 1e5);
    out += varint(la - lastLat) + varint(lo - lastLon);
    lastLat = la;
    lastLon = lo;
  }
  return out;
}

function varintDec(s: string, i: number): { v: number; i: number } {
  let result = 0, shift = 0, b = 0;
  do {
    b = s.charCodeAt(i++) - 63;
    result |= (b & 0x1f) << shift;
    shift += 5;
  } while (b >= 0x20);
  const v = result & 1 ? ~(result >> 1) : result >> 1;
  return { v, i };
}

/** Decodifica una polyline codificada (para entregar coords al mapa
 *  o para el backfill de PostGIS de la migración futura). */
export function polylineDecode(enc: string): Punto[] {
  const out: Punto[] = [];
  let i = 0, lat = 0, lon = 0;
  while (i < enc.length) {
    const a = varintDec(enc, i); lat += a.v; i = a.i;
    const b = varintDec(enc, i); lon += b.v; i = b.i;
    out.push({ lat: lat / 1e5, lon: lon / 1e5 });
  }
  return out;
}
