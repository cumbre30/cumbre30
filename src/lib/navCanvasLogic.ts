// ============================================================
// Lógica compartida del lienzo de navegación: features GeoJSON de
// la ruta (restante desde MI POSICIÓN + recorrido atenuado) y
// utilidades de cámara. La usa el minimapa web (MapLibre GL JS),
// el minimapa nativo (MapLibre Native vía puente) y el mapa grande.
// ============================================================

import type { Feature, FeatureCollection } from "geojson";
import type { LatLng, NavRoute, Network } from "@/lib/routing";
import { groupSegments, haversineM } from "@/lib/routing";
import { pointInPolygon } from "@/lib/geo";
import { PARK_POLYGON } from "@/lib/park";

export const toFc = (features: Feature[]): FeatureCollection => ({ type: "FeatureCollection", features });

export const lineFeat = (coords: LatLng[], props: Record<string, unknown> = {}): Feature => ({
  type: "Feature",
  properties: props,
  geometry: { type: "LineString", coordinates: coords.map((c) => [c.lon, c.lat]) },
});

export const pointFeat = (p: LatLng, props: Record<string, unknown> = {}): Feature => ({
  type: "Feature",
  properties: props,
  geometry: { type: "Point", coordinates: [p.lon, p.lat] },
});

export const polyFeat = (ring: [number, number][], props: Record<string, unknown> = {}): Feature => ({
  type: "Feature",
  properties: props,
  geometry: { type: "Polygon", coordinates: [ring] },
});

export const EMPTY_FC = toFc([]);

/** Rumbo (0-360) entre dos puntos. */
export function bearingOf(a: LatLng, b: LatLng): number {
  const toR = Math.PI / 180;
  const y = Math.sin((b.lon - a.lon) * toR) * Math.cos(b.lat * toR);
  const x = Math.cos(a.lat * toR) * Math.sin(b.lat * toR) - Math.sin(a.lat * toR) * Math.cos(b.lat * toR) * Math.cos((b.lon - a.lon) * toR);
  return (Math.atan2(y, x) / toR + 360) % 360;
}

/**
 * Features de la ruta activa:
 * · remaining → SIEMPRE parte de la ubicación ACTUAL del ciclista (si el
 *   pin se movió del vértice más cercano, se antepone la posición viva
 *   con un conector directo, como Waze al desencajarse).
 * · traveled → tramo ya recorrido, atenuado, cerrando en el pin.
 */
export function buildRouteFeatures(
  route: NavRoute,
  nearestIdx: number | null,
  position: LatLng | null
): { remaining: FeatureCollection; traveled: FeatureCollection } {
  if (!route || route.coords.length < 2) return { remaining: EMPTY_FC, traveled: EMPTY_FC };

  const from = Math.min(nearestIdx ?? 0, route.coords.length - 1);
  const pos = position;
  const startAtUser = !!pos && haversineM(pos, route.coords[from]) > 2.5;
  const stubFlag = route.flags[Math.min(from, route.flags.length - 1)] ?? false;

  const remCoords = startAtUser ? [pos!, ...route.coords.slice(from)] : route.coords.slice(from);
  const remFlags = startAtUser ? [stubFlag, ...route.flags.slice(from)] : route.flags.slice(from);
  const remainingGroups = groupSegments(remCoords, remFlags, 0, remCoords.length - 2);

  const travCoords = startAtUser ? [...route.coords.slice(0, from + 1), pos!] : route.coords.slice(0, from + 1);
  const travFlags = startAtUser ? [...route.flags.slice(0, from), stubFlag] : route.flags.slice(0, from);
  const traveledGroups = nearestIdx !== null ? groupSegments(travCoords, travFlags, 0, travCoords.length - 2) : [];

  const remaining = toFc([
    // casing bajo la ruta completa restante (desde MI posición)
    lineFeat(remCoords, { kind: "casing", ciclo: false }),
    ...remainingGroups.map((g) => lineFeat(g.coords, { kind: "seg", ciclo: g.ciclovia })),
  ]);
  const traveled = toFc(traveledGroups.map((g) => lineFeat(g.coords, { ciclo: g.ciclovia })));
  return { remaining, traveled };
}

/** Ruta completa (sin partir) para el mapa grande en modo plano. */
export function buildFullRouteFeatures(route: NavRoute | null): FeatureCollection {
  if (!route || route.coords.length < 2) return EMPTY_FC;
  const groups = groupSegments(route.coords, route.flags, 0, route.coords.length - 2);
  return toFc([
    lineFeat(route.coords, { kind: "casing", ciclo: false }),
    ...groups.map((g) => lineFeat(g.coords, { kind: "seg", ciclo: g.ciclovia })),
  ]);
}

/**
 * Ciclovías SOLO del cerro (≥50% de sus puntos dentro del parque) —
 * la misma regla del mapa web, empaquetada para el mapa nativo.
 */
export function buildCicloFeature(net: Network | null): FeatureCollection | null {
  if (!net) return null;
  const feats: Feature[] = [];
  for (const ids of net.cicloviaPolylines) {
    if (ids.length < 2) continue;
    let inside = 0;
    for (const id of ids) {
      if (pointInPolygon({ lat: net.nodes[id][0], lon: net.nodes[id][1] }, PARK_POLYGON)) inside++;
    }
    if (inside / ids.length < 0.5) continue;
    feats.push(lineFeat(ids.map((id) => ({ lat: net.nodes[id][0], lon: net.nodes[id][1] }))));
  }
  return toFc(feats);
}

/** Parámetros de cámara de navegación (el pin anclado abajo y al centro). */
export type NavCameraParams = {
  center: LatLng;
  zoom: number;
  bearing: number;
  /** Distancia del borde INFERIOR del lienzo al ancla del pin, en fracción del alto. */
  anchorBottomFrac: number;
};

export const ARRIVAL_M_NAV = 150;
export const NAV_ZOOM = 16.5;
export const ARRIVAL_ZOOM = 17.4;
export const NAV_PITCH = 50;

export function navCamera(opts: {
  position: LatLng;
  heading: number | null;
  onRoute: boolean;
  remainingM: number;
  nearestIdx: number | null;
  route: NavRoute | null;
  lastBearing: number;
}): NavCameraParams {
  const { position, heading, onRoute, remainingM, nearestIdx, route, lastBearing } = opts;
  let bearing = lastBearing;
  if (heading !== null) {
    bearing = heading;
  } else if (onRoute && route && nearestIdx !== null && nearestIdx < route.coords.length - 1) {
    bearing = bearingOf(route.coords[nearestIdx], route.coords[nearestIdx + 1]);
  }
  return {
    center: position,
    zoom: onRoute && remainingM < ARRIVAL_M_NAV ? ARRIVAL_ZOOM : NAV_ZOOM,
    bearing,
    anchorBottomFrac: onRoute ? 0.3 : 0.34,
  };
}
