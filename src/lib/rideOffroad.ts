/**
 * rideOffroad - km off-road del ride (fase 2 del Perfil Ciclista,
 * v1.13.17): base del 6º eje EXPLORER.
 *
 * La superficie sale de la clasificación de la red de navegación que
 * la app ya carga (public/red-ciclista.json - grafo OSM propio, sin
 * llamadas externas nuevas y disponible offline en el APK). Las clases
 * path/track son off-road real (sendero/camino de tierra); ciclovía,
 * calles y avenidas son pavimento. Cada segmento del track se proyecta
 * sobre la arista más cercana de la red:
 *   · a ≤ OFFROAD_SNAP_M → cuenta para netKm (el denominador del eje);
 *     si la arista es path/track, también para offRoadKm.
 *   · a más distancia (ride fuera del sector cubierto, error de GPS)
 *     → no cuenta para ninguno: no se inventa superficie.
 *
 * La proyección ingenua sería O(puntos × aristas) (~58k aristas); con
 * la rejilla espacial de celdas de ~440 m queda O(puntos × vecindario).
 */
import { haversineM, loadNetwork, type Network } from "@/lib/routing";
import type { RideSummary, TrackPt } from "@/lib/history";

/** Clases del grafo que son off-road (sendero / camino de tierra). */
export const OFF_ROAD_CLS = new Set(["path", "track"]);

/** Distancia máxima punto→arista para considerarlo sobre la red. */
export const OFFROAD_SNAP_M = 30;

/** Lado de celda de la rejilla (grados): ~0.004° ≈ 440 m en latitud. */
const CELL = 0.004;

/** Red cruda suficiente para el cálculo (la adj de routing no hace falta). */
export type RawNet = {
  classes: string[];
  nodes: Array<[number, number]>;
  edges: Array<[number, number, number, number, number]>; // [a,b,clsIdx,nameIdx,ciclo]
};

export type OffRoadResult = { offRoadKm: number; netKm: number };

// ---------- rejilla espacial (por red, cacheada con WeakMap) ----------

type Grid = Map<string, Set<number>>; // celda → índices de aristas

const gridCache = new WeakMap<Network | RawNet, Grid>();

function celdasDe(latA: number, lonA: number, latB: number, lonB: number): string[] {
  const i0 = Math.floor(Math.min(latA, latB) / CELL);
  const i1 = Math.floor(Math.max(latA, latB) / CELL);
  const j0 = Math.floor(Math.min(lonA, lonB) / CELL);
  const j1 = Math.floor(Math.max(lonA, lonB) / CELL);
  const out: string[] = [];
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) out.push(`${i}_${j}`);
  return out;
}

function gridDe(net: Network | RawNet): Grid {
  const cached = gridCache.get(net);
  if (cached) return cached;
  const g: Grid = new Map();
  for (let e = 0; e < net.edges.length; e++) {
    const [a, b] = net.edges[e];
    const na = net.nodes[a];
    const nb = net.nodes[b];
    if (!na || !nb) continue;
    for (const k of celdasDe(na[0], na[1], nb[0], nb[1])) {
      let s = g.get(k);
      if (!s) {
        s = new Set();
        g.set(k, s);
      }
      s.add(e);
    }
  }
  gridCache.set(net, g);
  return g;
}

/** Distancia punto→segmento en equirectangular local (m). */
function distSegM(pLat: number, pLon: number, aLat: number, aLon: number, bLat: number, bLon: number): number {
  const kx = Math.cos((pLat * Math.PI) / 180);
  const ax = aLon * kx, ay = aLat;
  const bx = bLon * kx, by = bLat;
  const px = pLon * kx, py = pLat;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320;
}

/** Clase off-road de la arista más cercana al punto (o null si nada a ≤ snapM). */
function aristaEn(net: Network | RawNet, g: Grid, lat: number, lon: number, snapM: number): string | null {
  const i = Math.floor(lat / CELL);
  const j = Math.floor(lon / CELL);
  let bestD = Infinity;
  let bestCls: string | null = null;
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const s = g.get(`${i + di}_${j + dj}`);
      if (!s) continue;
      for (const e of s) {
        const [a, b, clsIdx] = net.edges[e];
        const na = net.nodes[a];
        const nb = net.nodes[b];
        if (!na || !nb) continue;
        const d = distSegM(lat, lon, na[0], na[1], nb[0], nb[1]);
        if (d < bestD) {
          bestD = d;
          bestCls = net.classes[clsIdx] ?? "residential";
        }
      }
    }
  }
  return bestD <= snapM ? bestCls : null;
}

/**
 * Km del track que caen sobre la red y cuántos de esos son off-road.
 * Mismos descartes que computeRideMetrics (huecos de GPS dt > 120 s,
 * puntos fijos d < 1 m). Sin red disponible: { 0, 0 }.
 */
export function computeOffRoadKm(track: TrackPt[], net: Network | RawNet): OffRoadResult {
  if (track.length < 2) return { offRoadKm: 0, netKm: 0 };
  const g = gridDe(net);
  let offRoadM = 0;
  let netM = 0;
  for (let i = 1; i < track.length; i++) {
    const [lat1, lon1, , t1] = track[i - 1];
    const [lat2, lon2, , t2] = track[i];
    const dt = t2 - t1;
    if (dt <= 0 || dt > 120) continue; // hueco de GPS
    const d = haversineM({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 });
    if (d < 1) continue; // parado: no aporta superficie
    const cls = aristaEn(net, g, (lat1 + lat2) / 2, (lon1 + lon2) / 2, OFFROAD_SNAP_M);
    if (!cls) continue; // fuera de cobertura de la red
    netM += d;
    if (OFF_ROAD_CLS.has(cls)) offRoadM += d;
  }
  return {
    offRoadKm: Math.round((offRoadM / 1000) * 100) / 100,
    netKm: Math.round((netM / 1000) * 100) / 100,
  };
}

/**
 * Agrega offRoadKm/netKm a las métricas de un ride recién guardado y
 * re-sincroniza (el POST es idempotente por clientId: el reintento
 * actualiza las métricas en el servidor). Silencioso: sin red, sin
 * cobertura o sin métricas no cambia nada. El callback de re-subida lo
 * inyecta el llamador (useRideEngine) para no crear un ciclo de imports
 * con sync.ts.
 */
export async function augmentRideOffRoad(summary: RideSummary, reupload: (s: RideSummary) => void): Promise<void> {
  if (!summary.metrics || !summary.track?.length) return;
  try {
    const net = await loadNetwork();
    if (!net) return;
    const res = computeOffRoadKm(summary.track, net);
    if (res.netKm < 0.3) return; // ride fuera del sector: eje no evaluable
    summary.metrics.offRoadKm = res.offRoadKm;
    summary.metrics.netKm = res.netKm;
    reupload(summary);
  } catch {
    // la superficie es opcional: nunca falla el guardado del ride
  }
}
