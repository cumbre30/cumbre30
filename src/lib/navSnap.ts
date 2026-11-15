// ============================================================
// Posición de PANTALLA del ciclista (v1.12.8): el pin que se ve en
// el minimapa se ajusta a la calzada para que no aparezca sobre
// edificios, veredas o áreas verdes, y un filtro anti-saltos evita
// los brincos de GPS. NO toca el recorrido grabado ni las
// estadísticas: esas siguen del fix crudo (fuente de verdad).
//   · En navegación: proyección sobre la polilínea de la ruta, en
//     una VENTANA alrededor del vértice más cercano (los sedes del
//     cerro tienen tramos paralelos que confundirían la proyección
//     global: el pin se pegaría a otro lazo de la ruta).
//   · Fuera de navegación: proyección sobre la arista incidente al
//     nodo más cercano del grafo de vías (red-ciclista.json, la
//     misma red que ya carga la navegación).
//   · Filtro: descarta fixes con precisión mala (>45 m) y saltos
//     imposibles según la velocidad; en reposo suprime micro-jitter.
// ============================================================

import { haversineM, type LatLng, type NavRoute, type Network } from "@/lib/routing";

/** Distancia máxima para pegar el pin a la ruta activa (= CONNECTOR_MAX_M). */
export const SNAP_ROUTE_MAX_M = 40;
/** Distancia máxima para pegar el pin a una vía del grafo sin navegación. */
export const SNAP_NET_MAX_M = 30;

/**
 * Filtro anti-saltos: devuelve la posición a mostrar, o null si el fix
 * se descarta (impreciso o teleporte). Estado interno por sesión.
 */
export function createSmoother(): (pos: LatLng, speedKmh: number, accuracyM: number | null) => LatLng | null {
  let last: LatLng | null = null;
  let lastT = 0;
  return (pos, speedKmh, accuracyM) => {
    if (accuracyM !== null && accuracyM > 45) return null; // señal mala: ignora
    const now = Date.now();
    if (!last) {
      last = pos;
      lastT = now;
      return pos;
    }
    const dt = Math.max(0.2, (now - lastT) / 1000);
    const d = haversineM(last, pos);
    // salto imposible: excede lo que da la velocidad + margen de precisión
    const plausible = Math.max(8, (speedKmh / 3.6) * dt * 2.8 + (accuracyM ?? 10) * 1.2 + 6);
    if (d > plausible) return null;
    if (d < 1.2 && speedKmh < 3) return last; // quieto: sin micro-jitter
    last = pos;
    lastT = now;
    return pos;
  };
}

/** Proyección de p sobre el segmento (a,b) en plano local (m). */
function projectSeg(p: LatLng, a: LatLng, b: LatLng): { point: LatLng; distM: number } {
  const kx = Math.cos((p.lat * Math.PI) / 180);
  const px = p.lon * kx, py = p.lat;
  const ax = a.lon * kx, ay = a.lat, bx = b.lon * kx, by = b.lat;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const point = { lat: ay + dy * t, lon: (ax + dx * t) / kx };
  return { point, distM: Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320 };
}

/** Pin sobre la RUTA activa: proyecta en una ventana alrededor del
 *  vértice más cercano. null si quedó a más de SNAP_ROUTE_MAX_M. */
export function snapToRoute(route: NavRoute, nearestIdx: number | null, pos: LatLng): LatLng | null {
  const { coords } = route;
  if (coords.length < 2) return null;
  const lo = nearestIdx === null ? 0 : Math.max(0, nearestIdx - 25);
  const hi = nearestIdx === null ? coords.length - 2 : Math.min(coords.length - 2, nearestIdx + 25);
  let best: LatLng | null = null;
  let bd = Infinity;
  for (let i = lo; i <= hi; i++) {
    const pr = projectSeg(pos, coords[i], coords[i + 1]);
    if (pr.distM < bd) {
      bd = pr.distM;
      best = pr.point;
    }
  }
  return bd <= SNAP_ROUTE_MAX_M ? best : null;
}

// Rejilla espacial por red (cacheada): vecindario del nodo más cercano.
const grids = new WeakMap<Network, { cell: number; map: Map<string, number[]> }>();
function nodeGrid(net: Network) {
  let g = grids.get(net);
  if (!g) {
    const cell = 0.004; // ~440 m por celda
    const map = new Map<string, number[]>();
    for (let i = 0; i < net.nodes.length; i++) {
      const key = `${Math.floor(net.nodes[i][0] / cell)}:${Math.floor(net.nodes[i][1] / cell)}`;
      const arr = map.get(key);
      if (arr) arr.push(i);
      else map.set(key, [i]);
    }
    g = { cell, map };
    grids.set(net, g);
  }
  return g;
}

/** Pin sobre la CALZADA (sin navegación): proyecta sobre las aristas
 *  incidentes al nodo más cercano del grafo. loadNetwork agrega ambas
 *  direcciones por arista, así que adj[nodo] ya cubre todas. null si
 *  no hay vía a menos de SNAP_NET_MAX_M (p. ej. bajo techo). */
export function snapToNet(net: Network, pos: LatLng): LatLng | null {
  const g = nodeGrid(net);
  const cx = Math.floor(pos.lat / g.cell), cy = Math.floor(pos.lon / g.cell);
  let bestNode = -1;
  let bnD = Infinity;
  for (let ix = cx - 1; ix <= cx + 1; ix++) {
    for (let iy = cy - 1; iy <= cy + 1; iy++) {
      const arr = g.map.get(`${ix}:${iy}`);
      if (!arr) continue;
      for (const n of arr) {
        const d = haversineM(pos, { lat: net.nodes[n][0], lon: net.nodes[n][1] });
        if (d < bnD) {
          bnD = d;
          bestNode = n;
        }
      }
    }
  }
  if (bestNode < 0 || bnD > SNAP_NET_MAX_M * 2.5) return null;
  const a = { lat: net.nodes[bestNode][0], lon: net.nodes[bestNode][1] };
  let best: LatLng | null = null;
  let bd = Infinity;
  for (const e of net.adj[bestNode] ?? []) {
    const b = { lat: net.nodes[e.to][0], lon: net.nodes[e.to][1] };
    const pr = projectSeg(pos, a, b);
    if (pr.distM < bd) {
      bd = pr.distM;
      best = pr.point;
    }
  }
  return bd <= SNAP_NET_MAX_M ? best : null;
}
