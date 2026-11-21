// ============================================================
// Protección geométrica (fase D, arquitectura v2.1 §3.1 — CT-P1..P6).
//
// Principio: la geometría original vive SOLO en el dispositivo; lo que
// sale al servidor es exclusivamente la geometría pública protegida
// derivada aquí. La protección NO deforma el recorrido: solo recorta
// prefijo y sufijo (la polilínea resultado es conexa por construcción,
// sin vértices añadidos ni desplazamientos del tramo interior).
//
// Niveles por extremo (inicio y fin independientes, evaluados en orden):
// · A — snap de deriva (≤ 30 m): si el extremo queda a ≤30 m de un nodo
//   de vía conocido (las rutas del motor ya vienen pegadas; GPX puede
//   pasar nodos conocidos), se sustituye el vértice. Tras el snap,
//   truncado.
// · B — sin snap: si no hay nodo a ≤30 m NO hay snap (la regla de 80 m
//   de la v2 se retiró: mover 30-80 m ya es alteración perceptible).
//   Solo truncado.
// · C — zona sin conexión al grafo: sinSnap = true, truncado sobre la
//   geometría cruda, zona de imprecisión conserva su radio de 150 m.
//
// Truncado (común): recorta desde cada extremo hasta el primer vértice
// que queda a más de D = 150 m del extremo ORIGINAL, con tope de 400 m
// o el 10 % de la distancia total (lo que ocurra primero). Si el tope se
// alcanza sin asegurar el recorte, topeExcedido = true: la vista previa
// lo advierte y la publicación exige confirmación explícita (CT-P6).
// ============================================================

import { haversineM, aprox3, type Punto } from "./routeGeo";

export type NivelExtremo = "A" | "B" | "C";

export type RegistroExtremo = {
  nivel: NivelExtremo;
  /** Deriva corregida por snap en metros (nivel A). */
  snapM?: number;
  /** Metros recortados desde el extremo original. */
  recorteM: number;
  /** true: no hay vía cercana — zona sin conexión (nivel C). */
  sinSnap: boolean;
};

export type RegistroProteccion = {
  ini: RegistroExtremo;
  fin: RegistroExtremo;
  topeExcedido: boolean;
};

export type ResultadoProteccion = {
  /** Geometría PÚBLICA protegida (la única que sale del dispositivo). */
  coords: Punto[];
  registro: RegistroProteccion;
  /** Extremos aproximados redondeados a 3 decimales (~110 m) — los
   *  únicos datos de extremo que se publican. */
  inicioAprox: { lat: number; lon: number };
  finAprox: { lat: number; lon: number };
};

const RECORTE_M = 150;
const TOPE_ABS_M = 400;
const TOPE_PCT = 0.10;
const SNAP_MAX_M = 30;

/** Distancia desde el extremo (vértice 0 o último) hasta el índice
 *  del primer vértice que queda a más de D metros. Devuelve también
 *  los metros acumulados hasta ese vértice. */
function corteDesdeExtremo(coords: Punto[], desdeInicio: boolean, D: number): { idx: number; metros: number } {
  const n = coords.length;
  let metros = 0;
  if (desdeInicio) {
    for (let i = 1; i < n; i++) {
      metros += haversineM(coords[i - 1], coords[i]);
      if (haversineM(coords[0], coords[i]) > D) return { idx: i, metros };
    }
    return { idx: n - 1, metros };
  }
  for (let i = n - 2; i >= 0; i--) {
    metros += haversineM(coords[i + 1], coords[i]);
    if (haversineM(coords[n - 1], coords[i]) > D) return { idx: i, metros };
  }
  return { idx: 0, metros };
}

/** Protege un extremo: snap de deriva (si hay nodo a ≤30 m) y truncado. */
function protegerExtremo(
  coords: Punto[],
  desdeInicio: boolean,
  nodo: Punto | null,
  topeM: number,
): { coords: Punto[]; registro: RegistroExtremo } {
  const p0 = desdeInicio ? coords[0] : coords[coords.length - 1];
  let nivel: NivelExtremo = nodo ? "B" : "C";
  let snapM: number | undefined;
  let sinSnap = !nodo;
  let trabajar = coords;
  if (nodo) {
    const d = haversineM(p0, nodo);
    if (d <= SNAP_MAX_M) {
      nivel = "A";
      snapM = Math.round(d);
      trabajar = desdeInicio ? [nodo, ...coords.slice(1)] : [...coords.slice(0, -1), nodo];
    }
    // 30 m < d: sin snap (nivel B) — el vértice queda tal cual.
  }
  const { idx, metros } = corteDesdeExtremo(trabajar, desdeInicio, RECORTE_M);
  const protegidas = desdeInicio ? trabajar.slice(idx) : trabajar.slice(0, idx + 1);
  return {
    coords: protegidas,
    registro: { nivel, snapM, recorteM: Math.round(metros), sinSnap },
  };
}

export type OpcionesProteccion = {
  /** Nodo de vía conocido para el extremo inicial (motor ya lo trae;
   *  GPX sin grafo → null ⇒ nivel B/C). */
  nodoInicio?: Punto | null;
  nodoFin?: Punto | null;
};

/** Aplica la protección completa: snap de deriva por extremo (niveles
 *  A/B/C) + truncado con topes. Jamás altera el tramo interior. */
export function protegerRuta(coords: Punto[], opts: OpcionesProteccion = {}): ResultadoProteccion {
  if (coords.length < 2) throw new Error("La geometría necesita al menos 2 puntos.");
  const total = coords.reduce((a, c, i) => (i === 0 ? 0 : a + haversineM(coords[i - 1], c)), 0);
  const topeM = Math.min(TOPE_ABS_M, total * TOPE_PCT);

  // Corte por extremo sobre una copia (el segundo usa el resultado del primero).
  const ini = protegerExtremo(coords, true, opts.nodoInicio ?? null, topeM);
  const fin = protegerExtremo(ini.coords, false, opts.nodoFin ?? null, topeM);
  let protegidas = fin.coords;

  // Garantía de continuidad mínima: al menos 2 vértices; si el recorte
  // consumió todo (traza ≤ 2·tope), se conserva la polilínea íntegra y
  // se marca el tope como excedido (la vista previa lo advierte, CT-P6).
  let topeExcedido = ini.registro.recorteM >= topeM || fin.registro.recorteM >= topeM;
  if (protegidas.length < 2) {
    protegidas = coords;
    topeExcedido = true;
  }

  return {
    coords: protegidas,
    registro: { ini: ini.registro, fin: fin.registro, topeExcedido },
    inicioAprox: { lat: aprox3(protegidas[0].lat), lon: aprox3(protegidas[0].lon) },
    finAprox: { lat: aprox3(protegidas[protegidas.length - 1].lat), lon: aprox3(protegidas[protegidas.length - 1].lon) },
  };
}

// ------------------------------------------------------------
// Elevación resuelta al publicar (§5.1): el servidor muestrea la
// geometría protegida contra Open-Meteo Elevation (sin clave,
// ~100 puntos por ruta). Aquí solo el muestreo + el cliente HTTP
// vive en el endpoint (server-side).
// ------------------------------------------------------------

/** Submuestreo uniforme de ~n puntos (extremos incluidos). */
export function muestrear(coords: Punto[], n = 100): Punto[] {
  if (coords.length <= n) return coords;
  const out: Punto[] = [];
  const step = (coords.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) out.push(coords[Math.round(i * step)]);
  out[0] = coords[0];
  out[n - 1] = coords[coords.length - 1];
  return out;
}

export type EleResuelta = { gainM: number; lossM: number; minEle: number; maxEle: number };

/** Resuelve gain/loss/min/max desde una serie de elevaciones alineada
 *  con los puntos muestreados (nulls por hueco del servicio). */
export function eleDesdeMuestras(eles: (number | null)[]): EleResuelta | null {
  const validas = eles.filter((e): e is number => e != null && Number.isFinite(e));
  if (validas.length < 2) return null;
  let gain = 0;
  let loss = 0;
  let prev: number | null = null;
  for (const e of eles) {
    if (e == null || !Number.isFinite(e)) continue;
    if (prev != null) {
      if (e > prev) gain += e - prev;
      else loss += prev - e;
    }
    prev = e;
  }
  return { gainM: Math.round(gain), lossM: Math.round(loss), minEle: Math.round(Math.min(...validas)), maxEle: Math.round(Math.max(...validas)) };
}
