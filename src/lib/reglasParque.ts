// ============================================================
// Reglas direccionales del parque (cliente, 2026-11-12):
//
//  1. PÍO NONO SÓLO SUBIDA: el acceso Pío Nono y su camino de
//     ascenso (Av. Alberto Mackenna hasta el puente de Tupahue)
//     NO se puede bajar. «si se sube de los otros 3 accesos no es
//     accesible para bajar» — la ruta en reversa queda bloqueada
//     SIEMPRE (24/7), en navegación y en los trazados precomputados.
//
//  2. CORTE HORARIO CUMBRE (Tupahue → Cumbre): los sábados,
//     domingos y festivos desde las 13:30 no se puede seguir hacia
//     la cumbre por Av. Pedro Bannen. El corte está EN EL PUENTE
//     que une Av. Alberto Mackenna con Av. Pedro Bannen en el
//     sector Tupahue (-33.416121, -70.623005, nodo compartido del
//     grafo — «dónde tenemos el puente»). Fuera de horario la
//     navegación a destinos de la cumbre traza una VUELTA EN U en
//     ese puente (ver conVueltaEnU).
//
//  3. CARLOS REED queda fuera del trazado pavimento: son tramos del
//     Paseo Metropolitano aún no implementados (se excluye por
//     nombre en los filtros de pavimento, ver routingService).
//
// Cómo se orienta cada corredor: cadenas ordenadas GENERADAS
// (scripts/gen-cadenas-corredores.ts → src/lib/cadenasCorredores.ts):
// camino simple más largo por componente conexa, arrancando en el
// extremo más cercano al ancla. La dirección prohibida es DISMINUIR la
// t de la cadena: abajo hacia el acceso Pío Nono, o arriba hacia Plaza
// México en el corredor Bannen. Probados árbol BFS y árbol DFS: ambos
// se desorientan con las horquillas de Mackenna (micro-aristas de 3-8 m
// que retroceden hasta -95 %) y con tramos paralelos; la cadena
// generada y verificada fuera de línea es la única orientación fiel.
// ============================================================

import { GATES, PARK_POLYGON, type LatLng } from "./park";
import { haversineM, type Network } from "./routing";
import { CADENAS_BANNEN, CADENAS_PIO_NONO, type CadenaCorredor } from "./cadenasCorredores";

/** El puente Mackenna ↔ Pedro Bannen en Tupahue: nodo compartido del
 *  grafo (transición Mackenna-Bannen a 0 m, verificación 2026-11-12).
 *  Ahí vive el corte horario «Tupahue → Cumbre». */
export const PUENTE_TUPAHUE_CUMBRE: LatLng = { lat: -33.416121, lon: -70.623005 };

/** Plaza México: referencia de la cara cumbre (destino más alto en bici). */
export const PLAZA_MEXICO_POS: LatLng = { lat: -33.4234, lon: -70.6327 };

/** Acceso Pío Nono (fondo del corredor de ascenso). */
export const GATE_PIO_NONO: LatLng =
  GATES.find((g) => g.id === "pio-nono")?.position ?? { lat: -33.430691, lon: -70.63592 };

// ----------------------------------------------------------------
// Dentro del parque (+80 m en el borde, igual que el ruteo)
// ----------------------------------------------------------------

function distAPoligonoM(lat: number, lon: number): number {
  const kx = Math.cos((lat * Math.PI) / 180);
  const px = lon * kx, py = lat;
  let best = Infinity;
  for (let i = 0, j = PARK_POLYGON.length - 1; i < PARK_POLYGON.length; j = i++) {
    const a = PARK_POLYGON[j], b = PARK_POLYGON[i];
    const ax = a.lon * kx, ay = a.lat;
    const bx = b.lon * kx, by = b.lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320);
  }
  return best;
}

export function dentroDelParqueM(lat: number, lon: number): boolean {
  let inside = false;
  const poly = PARK_POLYGON;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i].lat, xi = poly[i].lon, yj = poly[j].lat, xj = poly[j].lon;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside || distAPoligonoM(lat, lon) <= 80;
}

// ----------------------------------------------------------------
// Árbol DFS del corredor: se recorre el corredor CAMINANDO el camino
// (profundidad, no BFS radial) desde el ancla del componente. El
// recorrido sigue la secuencia real de la vía — incluidas las
// horquillas de Mackenna, donde micro-aristas de 3-8 m retroceden
// hasta -95 % respecto al ancla (medido 2026-11-12): un test de
// gradiente local no puede separar subida de bajada ahí, pero el
// ORDEN del camino sí. La dirección prohibida es la que va HACIA el
// ancla en el árbol:
//  · Pío Nono (ancla = acceso, abajo) → bloquea el descenso.
//  · Pedro Bannen (ancla = Plaza México, arriba) → bloquea la subida.
// Aristas fuera del árbol (lazos, atajos, conectores sin nombre dentro
// de la banda del corredor): test de gradiente por distancia al ancla.
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// Orientación por CADENAS GENERADAS (scripts/gen-cadenas-corredores.ts):
// cada corredor tiene una o más cadenas ordenadas de puntos [lat, lon];
// la dirección prohibida es DISMINUIR la t de la cadena (hacia el
// arranque): abajo hacia el acceso Pío Nono, o arriba hacia Plaza
// México. Ambos extremos de la arista deben proyectar sobre LA MISMA
// cadena (t comparables); si no, gradiente por distancia al ancla.
// ----------------------------------------------------------------

type CadenaIndex = {
  /** puntos [lat, lon] de la cadena. */
  pts: CadenaCorredor;
  /** t acumulado (m) por punto. */
  t: number[];
  /** rejilla espacial: celda 0.0005° ≈ 55 m → índices de puntos. */
  grid: Map<string, number[]>;
};

function indexarCadena(pts: CadenaCorredor): CadenaIndex {
  const t: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    t[i] = t[i - 1] + haversineM({ lat: pts[i - 1][0], lon: pts[i - 1][1] }, { lat: pts[i][0], lon: pts[i][1] });
  }
  const cell = 0.0005;
  const grid = new Map<string, number[]>();
  for (let i = 0; i < pts.length; i++) {
    const k = `${Math.round(pts[i][0] / cell)}:${Math.round(pts[i][1] / cell)}`;
    let arr = grid.get(k);
    if (!arr) grid.set(k, (arr = []));
    arr.push(i);
  }
  return { pts, t, grid };
}

/** t de la cadena en el punto más cercano (≤ RADIO_PROYECCION_M), o null. */
function proyectarCadena(c: CadenaIndex, lat: number, lon: number): number | null {
  const cell = 0.0005;
  const ci = Math.round(lat / cell);
  const cj = Math.round(lon / cell);
  let bi = -1;
  let bd = Infinity;
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++) {
      const arr = c.grid.get(`${ci + di}:${cj + dj}`);
      if (!arr) continue;
      for (const i of arr) {
        const d = haversineM({ lat, lon }, { lat: c.pts[i][0], lon: c.pts[i][1] });
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
    }
  return bi >= 0 && bd <= RADIO_PROYECCION_M ? c.t[bi] : null;
}

/** ¿La arista avanza hacia el ARRANQUE de la cadena (dirección prohibida)?
 *  Resuelve por cadena (ambos extremos sobre la misma); sin cadena,
 *  gradiente por distancia al ancla. */
function avanzaHaciaArranque(
  cadenas: CadenaIndex[],
  uLat: number,
  uLon: number,
  vLat: number,
  vLon: number,
  ancla: LatLng,
  len: number
): boolean {
  for (const c of cadenas) {
    const tu = proyectarCadena(c, uLat, uLon);
    const tv = proyectarCadena(c, vLat, vLon);
    if (tu !== null && tv !== null) return tv < tu - UMBRAL_CADENA_M;
  }
  const dU = haversineM({ lat: uLat, lon: uLon }, ancla);
  const dV = haversineM({ lat: vLat, lon: vLon }, ancla);
  return dV < dU - Math.max(8, len * GRADIENTE_ATAJO);
}

const RADIO_PROYECCION_M = 40;
/** Retroceso en la cadena que se considera descenso (m de t). */
const UMBRAL_CADENA_M = 3;
/** Descenso por atajo/conector fuera de la cadena: la distancia al ancla
 *  cae más de este fraction de la longitud de la arista (mínimo 8 m). */
const GRADIENTE_ATAJO = 0.6;
/** Banda del corte horario alrededor del puente (m). */
const BANDA_CORTE_M = 160;
/** Avance hacia Plaza México dentro de la banda que se considera
 *  «subiendo a la cumbre» (m por arista). */
const UMBRAL_SUBIDA_CORTE_M = 4;
/** Corredor de ascenso Pío Nono: nombres de vía del camino real. */
const NOMBRES_CORREDOR_PIO =
  /^(Pío Nono|Pio Nono|Avenida Alberto Mackenna|Camino Pío Nono - Plaza México|Terraza Bellavista|Explanada|Paseo Peatonal Cumbre|Camino Siete Palabras|Sendero El Excursionista|Camino El Excursionista)/;
/** Corredor del corte cumbre: Av. Pedro Bannen (Tupahue → Plaza México). */
const NOMBRES_BANNEN = /^Avenida Pedro Bannen/;
/** Banda del corredor para conectores sin nombre (m a un nodo de cadena). */
const BANDA_NODO_M = 40;

const cadenasPio = CADENAS_PIO_NONO.map(indexarCadena);
const cadenasBannen = CADENAS_BANNEN.map(indexarCadena);

/** ¿El nodo cae dentro de la banda de alguna cadena del corredor? */
function enBandaCorredor(cadenas: CadenaIndex[], lat: number, lon: number): boolean {
  for (const c of cadenas) {
    const cell = 0.0005;
    const ci = Math.round(lat / cell);
    const cj = Math.round(lon / cell);
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        const arr = c.grid.get(`${ci + di}:${cj + dj}`);
        if (!arr) continue;
        for (const i of arr) {
          if (haversineM({ lat, lon }, { lat: c.pts[i][0], lon: c.pts[i][1] }) <= BANDA_NODO_M) return true;
        }
      }
  }
  return false;
}

// ----------------------------------------------------------------
// Dirección permitida por arista
// ----------------------------------------------------------------

export type DireccionOpts = {
  /** true: bloquear descenso por el corredor Pío Nono (siempre). */
  pioNonoSoloSubida: boolean;
  /** true: bloquear la subida a la cumbre por el puente de Tupahue
   *  (corte horario FDS/festivos desde 13:30). */
  corteCumbre: boolean;
};

/** Devuelve el filtro direccional para findRoute. Firma:
 *  (u, v, coords de ambos extremos, clase, nombre) → false bloquea. */
export function crearDirOk(
  net: Network,
  o: DireccionOpts
): (u: number, v: number, uLat: number, uLon: number, vLat: number, vLon: number, cls: string, name: string) => boolean {
  void net;
  const parqueCache = new Map<number, boolean>();
  const esParque = (n: number, lat: number, lon: number): boolean => {
    let v = parqueCache.get(n);
    if (v === undefined) {
      v = dentroDelParqueM(lat, lon);
      parqueCache.set(n, v);
    }
    return v;
  };
  const pioActivo = o.pioNonoSoloSubida;
  const corteActivo = o.corteCumbre;

  return (u, v, uLat, uLon, vLat, vLon, _cls, name) => {
    const len = haversineM({ lat: uLat, lon: uLon }, { lat: vLat, lon: vLon });
    const esPioNombre = NOMBRES_CORREDOR_PIO.test(name);
    const esBannenNombre = NOMBRES_BANNEN.test(name);
    // OJO: junto al puente de Tupahue el tramo final de Mackenna y la
    // bajada de Bannen corren paralelos (~200 m): una arista de Bannen
    // NO se puede proyectar sobre las cadenas de Pío Nono (y
    // viceversa) — la orientación se decide por el NOMBRE de la vía.
    // --- 1. Pío Nono sólo subida (24/7): bloquear el descenso ---
    if (pioActivo && !esBannenNombre) {
      const enCorredor =
        esPioNombre || (enBandaCorredor(cadenasPio, uLat, uLon) && enBandaCorredor(cadenasPio, vLat, vLon));
      if (enCorredor && esParque(u, uLat, uLon) && esParque(v, vLat, vLon)) {
        // ancla = acceso Pío Nono: avanzar hacia él = bajar
        if (avanzaHaciaArranque(esPioNombre ? cadenasPio : [], uLat, uLon, vLat, vLon, GATE_PIO_NONO, len)) return false;
      }
    }
    // --- 2. Corte horario cumbre: bloquear la subida por el puente ---
    if (corteActivo) {
      if (esBannenNombre) {
        // ancla = Plaza México: avanzar hacia ella = subir a la cumbre
        if (avanzaHaciaArranque(cadenasBannen, uLat, uLon, vLat, vLon, PLAZA_MEXICO_POS, len)) return false;
      } else if (enBandaCorredor(cadenasBannen, uLat, uLon) && enBandaCorredor(cadenasBannen, vLat, vLon)) {
        // conectores sin nombre junto a Bannen: gradiente hacia la plaza
        const dU = haversineM({ lat: uLat, lon: uLon }, PLAZA_MEXICO_POS);
        const dV = haversineM({ lat: vLat, lon: vLon }, PLAZA_MEXICO_POS);
        if (dV < dU - Math.max(8, len * GRADIENTE_ATAJO)) return false;
      }
      // banda del puente: dentro de 160 m no se avanza hacia Plaza
      // México ni por los conectores peatonales de la explanada
      const dPuenU = haversineM({ lat: uLat, lon: uLon }, PUENTE_TUPAHUE_CUMBRE);
      if (dPuenU <= BANDA_CORTE_M) {
        const dPlU = haversineM({ lat: uLat, lon: uLon }, PLAZA_MEXICO_POS);
        const dPlV = haversineM({ lat: vLat, lon: vLon }, PLAZA_MEXICO_POS);
        if (dPlV < dPlU - UMBRAL_SUBIDA_CORTE_M) return false;
      }
    }
    return true;
  };
}

/** DIAGNÓSTICO (scripts): explica por qué una arista queda bloqueada. */
export function debugDirOk(
  net: Network,
  o: DireccionOpts,
  u: number,
  v: number,
  uLat: number,
  uLon: number,
  vLat: number,
  vLon: number,
  cls: string,
  name: string
): string {
  void net;
  void u;
  void v;
  void cls;
  const len = haversineM({ lat: uLat, lon: uLon }, { lat: vLat, lon: vLon });
  const partes: string[] = [];
  if (o.pioNonoSoloSubida) {
    const enCorredor =
      NOMBRES_CORREDOR_PIO.test(name) ||
      (enBandaCorredor(cadenasPio, uLat, uLon) && enBandaCorredor(cadenasPio, vLat, vLon));
    const cadeInfo: string[] = [];
    for (const c of cadenasPio) {
      const tu = proyectarCadena(c, uLat, uLon);
      const tv = proyectarCadena(c, vLat, vLon);
      if (tu !== null || tv !== null) cadeInfo.push(`(tu=${tu?.toFixed(0) ?? "-"} tv=${tv?.toFixed(0) ?? "-"})`);
    }
    partes.push(`pio: enCorredor=${enCorredor} cadenas=[${cadeInfo.join(" ")}]`);
  }
  if (o.corteCumbre) {
    const esBannen =
      NOMBRES_BANNEN.test(name) ||
      (enBandaCorredor(cadenasBannen, uLat, uLon) && enBandaCorredor(cadenasBannen, vLat, vLon));
    partes.push(`bannen: esBannen=${esBannen}`);
  }
  const bloquea = !crearDirOk({ nodes: [], edges: [], names: [], classes: [], cicloviaPolylines: [], adj: [] }, o)(u, v, uLat, uLon, vLat, vLon, cls, name);
  return `dirOk=${bloquea ? "BLOQUEA" : "PERMITE"} · ${partes.join(" | ")}`;
}

// ----------------------------------------------------------------
// Vuelta en U: el trazado llega al corte y regresa en espejo con un
// pequeño desplazamiento lateral, como una U (hairpin) sobre el mapa.
// ----------------------------------------------------------------

export function conVueltaEnU(coords: LatLng[]): { coords: LatLng[]; metrosVuelta: number } {
  if (coords.length < 3) return { coords, metrosVuelta: 0 };
  // tramo final a espejar: hasta ~80 m hacia atrás
  const cola: LatLng[] = [coords[coords.length - 1]];
  let acc = 0;
  for (let i = coords.length - 1; i > 0 && acc < 80; i--) {
    acc += haversineM(coords[i], coords[i - 1]);
    cola.push(coords[i - 1]);
  }
  // espejo con 5 m de desplazamiento lateral (perpendicular al rumbo local)
  const OFFSET = 5;
  const espejo: LatLng[] = [];
  for (let i = cola.length - 1; i >= 1; i--) {
    const p = cola[i];
    const q = cola[i - 1];
    const dLat = q.lat - p.lat;
    const dLon = q.lon - p.lon;
    const norm = Math.hypot(dLat, dLon) || 1;
    const kx = Math.max(Math.cos((p.lat * Math.PI) / 180), 0.1);
    // perpendicular en (dLat, dLon·kx), escalada a metros
    const pl = (-dLon * kx) / norm;
    const pm = dLat / norm;
    const n2 = Math.hypot(pl, pm) || 1;
    espejo.push({
      lat: p.lat + (OFFSET / 111_320) * (pl / n2),
      lon: p.lon + (OFFSET / (111_320 * kx)) * (pm / n2),
    });
  }
  const coords2 = [...coords, ...espejo];
  return { coords: coords2, metrosVuelta: Math.round(acc) };
}
