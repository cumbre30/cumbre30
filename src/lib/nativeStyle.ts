// ============================================================
// Estilo COMPLETO para el mapa nativo (MapLibre Native): el mismo
// estilo oscuro Waze del minimapa web + las fuentes/capas overlay
// (parque, riesgo, porteras, recorrido, ruta, flechas, incidencias,
// bandera y pin). Va entero como JSON al plugin: el lado nativo solo
// actualiza datos de fuentes y cámara.
// ============================================================

import type { DataDrivenPropertyValueSpecification, ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";
import { circlePolygon, navStyle } from "@/lib/navStyle";
import { GATES, PARK_POLYGON, RISK_ZONES, type LatLng } from "@/lib/park";
import { EMPTY_FC, lineFeat, polyFeat, toFc } from "@/lib/navCanvasLogic";

export const COLOR_CICLO = "#a855f7";
export const COLOR_VIA = "#f4f4f5";
export const COLOR_CASING = "#05070a";

const zoomWidth = (stops: [number, number][]): DataDrivenPropertyValueSpecification<number> =>
  ["interpolate", ["linear"], ["zoom"], ...stops.flat()] as unknown as DataDrivenPropertyValueSpecification<number>;

const eq = (field: string, v: boolean | string): ExpressionSpecification =>
  ["==", ["get", field], v] as unknown as ExpressionSpecification;

const all = (...conds: ExpressionSpecification[]): ExpressionSpecification =>
  ["all", ...conds] as unknown as ExpressionSpecification;

export type NativeMapMode = "nav" | "flat";

/** Fuentes estáticas del sector (parque, riesgo, porteras).
 *  Limpieza: solo las 4 porteras habilitadas para ciclistas. */
export function staticSources() {
  return {
    park: toFc([polyFeat(PARK_POLYGON.map((p) => [p.lon, p.lat] as [number, number]))]),
    risk: toFc(RISK_ZONES.map((z) => polyFeat(circlePolygon(z.position.lat, z.position.lon, z.radiusM), { id: z.id }))),
    gates: toFc(GATES.filter((g) => g.ciclistas).map((g) => polyFeat(circlePolygon(g.position.lat, g.position.lon, 18), { id: g.id }))),
  };
}

/**
 * Estilo nativo completo. mode "nav" = minimapa de navegación 3D;
 * "flat" = mapa grande plano (agrega círculo de precisión y ciclovías).
 */
export function nativeStyle(mode: NativeMapMode): StyleSpecification {
  const base = navStyle();
  const sources: StyleSpecification["sources"] = {
    ...base.sources,
    park: { type: "geojson", data: EMPTY_FC },
    risk: { type: "geojson", data: EMPTY_FC },
    gates: { type: "geojson", data: EMPTY_FC },
    track: { type: "geojson", data: EMPTY_FC },
    "route-remaining": { type: "geojson", data: EMPTY_FC },
    "route-traveled": { type: "geojson", data: EMPTY_FC },
    incidents: { type: "geojson", data: EMPTY_FC },
    puck: { type: "geojson", data: EMPTY_FC },
    flag: { type: "geojson", data: EMPTY_FC },
    ...(mode === "flat"
      ? {
          accuracy: { type: "geojson", data: EMPTY_FC },
          ciclo: { type: "geojson", data: EMPTY_FC },
        }
      : {}),
  };

  const layers: LayerSpecification[] = [
    ...base.layers,
    { id: "park-fill", type: "fill", source: "park", paint: { "fill-color": "#10b981", "fill-opacity": 0.09 } },
    { id: "park-line", type: "line", source: "park", paint: { "line-color": "#34d399", "line-width": 1.4, "line-opacity": 0.8 } },
    { id: "risk-fill", type: "fill", source: "risk", paint: { "fill-color": "#f59e0b", "fill-opacity": 0.14 } },
    { id: "risk-line", type: "line", source: "risk", paint: { "line-color": "#f59e0b", "line-width": 1, "line-opacity": 0.7 } },
    { id: "gates-fill", type: "fill", source: "gates", paint: { "fill-color": "#0f766e", "fill-opacity": 0.9 } },
  ];

  if (mode === "flat") {
    layers.push(
      { id: "accuracy-fill", type: "fill", source: "accuracy", paint: { "fill-color": "#ffffff", "fill-opacity": 0.08 } },
      { id: "accuracy-line", type: "line", source: "accuracy", paint: { "line-color": "#ffffff", "line-width": 1, "line-opacity": 0.5 } },
      {
        id: "ciclo-line",
        type: "line",
        source: "ciclo",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#10b981", "line-width": 3.5, "line-opacity": 0.85 },
      }
    );
  }

  layers.push(
    {
      id: "track-line",
      type: "line",
      source: "track",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#a3e635", "line-width": 3.5, "line-opacity": 0.9 },
    },
    {
      id: "traveled-line",
      type: "line",
      source: "route-traveled",
      filter: eq("ciclo", true),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": COLOR_CICLO, "line-width": 5, "line-opacity": 0.3 },
    },
    {
      id: "traveled-line-via",
      type: "line",
      source: "route-traveled",
      filter: eq("ciclo", false),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": COLOR_VIA, "line-width": 4, "line-opacity": 0.28 },
    },
    {
      id: "route-casing",
      type: "line",
      source: "route-remaining",
      filter: eq("kind", "casing"),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": COLOR_CASING, "line-width": zoomWidth([[15, 9], [18, 14]]), "line-opacity": 0.9 },
    },
    {
      id: "route-ciclo",
      type: "line",
      source: "route-remaining",
      filter: eq("ciclo", true),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": COLOR_CICLO, "line-width": zoomWidth([[15, 6.5], [18, 10]]), "line-opacity": 0.98 },
    },
    {
      id: "route-via",
      type: "line",
      source: "route-remaining",
      filter: all(eq("ciclo", false), eq("kind", "seg")),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": COLOR_VIA, "line-width": zoomWidth([[15, 5], [18, 8]]), "line-opacity": 0.98 },
    },
    {
      id: "route-arrows",
      type: "symbol",
      source: "route-remaining",
      filter: eq("kind", "seg"),
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 130,
        "icon-image": "c30-chev",
        "icon-size": zoomWidth([[15, 0.35], [18, 0.6]]) as unknown as DataDrivenPropertyValueSpecification<number>,
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: { "icon-opacity": 0.95 },
    },
    {
      id: "incidents-sym",
      type: "symbol",
      source: "incidents",
      layout: {
        "icon-image": ["get", "icon"] as unknown as DataDrivenPropertyValueSpecification<string>,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {},
    },
    {
      id: "flag-sym",
      type: "symbol",
      source: "flag",
      layout: {
        "icon-image": "c30-flag",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {},
    },
    {
      id: "puck-pin",
      type: "symbol",
      source: "puck",
      filter: eq("kind", "pin"),
      layout: {
        "icon-image": ["get", "icon"] as unknown as DataDrivenPropertyValueSpecification<string>,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-rotation-alignment": "viewport",
      },
      paint: {},
    },
    {
      id: "puck-arrow",
      type: "symbol",
      source: "puck",
      filter: eq("kind", "arrow"),
      layout: {
        "icon-image": ["get", "icon"] as unknown as DataDrivenPropertyValueSpecification<string>,
        "icon-rotate": ["get", "rotate"] as unknown as DataDrivenPropertyValueSpecification<number>,
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {},
    }
  );

  return { ...base, sources, layers } as StyleSpecification;
}

/** GeoJSON del círculo de precisión GPS (mapa plano). */
export function accuracyFeature(position: LatLng, radiusM: number) {
  return toFc([polyFeat(circlePolygon(position.lat, position.lon, Math.max(6, Math.min(radiusM, 120))))]);
}

/** Línea del recorrido del ride. */
export function trackFeature(track: LatLng[]) {
  return track.length > 1 ? toFc([lineFeat(track)]) : EMPTY_FC;
}
