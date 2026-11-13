// ============================================================
// Bajadas fiscalizadas del control 30 km/h: índice espacial para
// detectar EN VIVO (motor de ride) que el ciclista está descendiendo
// por uno de los 3 corredores rojos de la capa Normativa y Seguridad.
//
// Datos: BAJADAS_CONTROL_30 (rutasTrazados.ts) - los mismos trazados
// que pinta el mapa y que usa la auditoría de segmentos.
//
// IMPORTANTE (bundle): este módulo importa rutasTrazados (~5.000
// pares de coordenadas). useRideEngine lo carga con import() DINÁMICO
// al iniciar el ride, nunca como import estático, para no arrastrar
// el trazado al bundle principal (mismo criterio que segments.ts:
// «el trazado viaja sólo con el MapView»).
//
// Cliente 2026-11-13: «agrega un aviso por voz cuando se esté
// bajando por una ruta de 30 km».
// ============================================================

import { haversineM } from "./geo";
import { BAJADAS_CONTROL_30 } from "./rutasTrazados";

/** Banda (m) alrededor del corredor: el camino fiscalizado + tolerancia
 *  GPS del teléfono (±10-15 m) sin arrastrar ciclistas de caminos
 *  paralelos (el más cercano pasa a >60 m en los 3 corredores). */
const BANDA_M = 50;

/** Celda de la rejilla espacial (grados): 0.0005 ≈ 55 m. */
const CELL = 0.0005;

type BajadaIndex = {
  id: string;
  nombre: string;
  grid: Map<string, Array<[number, number]>>;
};

const indices: BajadaIndex[] = BAJADAS_CONTROL_30.map((b) => {
  const grid = new Map<string, Array<[number, number]>>();
  for (const [lat, lon] of b.coords) {
    const k = `${Math.round(lat / CELL)}:${Math.round(lon / CELL)}`;
    let arr = grid.get(k);
    if (!arr) grid.set(k, (arr = []));
    arr.push([lat, lon]);
  }
  return { id: b.id, nombre: b.nombre, grid };
});

/** Distancia mínima del punto a la polilínea (por rejilla 3×3: si el
 *  punto cae a ≤50 m de algún punto del corredor, ese punto está en
 *  su vecindario - celda 55 m). */
function distMinGrid(grid: Map<string, Array<[number, number]>>, lat: number, lon: number): number {
  const ci = Math.round(lat / CELL);
  const cj = Math.round(lon / CELL);
  let best = Infinity;
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const arr = grid.get(`${ci + di}:${cj + dj}`);
      if (!arr) continue;
      for (const [la, lo] of arr) {
        const d = haversineM({ lat, lon }, { lat: la, lon: lo });
        if (d < best) best = d;
      }
    }
  }
  return best;
}

export type Bajada30Hit = { id: string; nombre: string };

/** ¿El punto cae dentro de la banda de alguna bajada del control 30?
 *  Devuelve el corredor (id + nombre para la bitácora) o null. */
export function enBajada30(lat: number, lon: number): Bajada30Hit | null {
  for (const b of indices) {
    if (distMinGrid(b.grid, lat, lon) <= BANDA_M) return { id: b.id, nombre: b.nombre };
  }
  return null;
}

/** ¿El módulo de corredores ya está disponible? (diagnóstico/E2E) */
export function bajadas30Cargadas(): number {
  return indices.length;
}
