// ============================================================
// Estilo oscuro del minimapa de navegación (look Waze) sobre
// tiles vectoriales de OpenFreeMap — gratuito, sin clave de API.
// Esquema OpenMapTiles: capas de transporte, agua, parque,
// edificios y rótulos. Los rótulos de lugares quedan SIEMPRE
// derechos (alineación a la pantalla) mientras el mapa gira con
// el rumbo, como en Waze/Google Maps.
// ============================================================

import type { StyleSpecification } from "maplibre-gl";

export const NAV_COLORS = {
  bg: "#0a0e14",
  park: "#0f2a1d",
  parkOutline: "#1d5c3f",
  water: "#0c2739",
  building: "#161d27",
  roadCase: "#04070b",
  roadMinor: "#2b3442",
  roadMid: "#39455a",
  roadMajor: "#5b6b84",
  path: "#3a4453",
  label: "#aab6c6",
  labelDim: "#7d8a9c",
};

/** Polígono circular (32 lados) alrededor de un punto — para zonas
 *  de riesgo y porteras, porque circle-layer usa píxeles, no metros. */
export function circlePolygon(lat: number, lon: number, radiusM: number, segments = 32): [number, number][] {
  const pts: [number, number][] = [];
  const mPerDegLat = 111_320;
  const mPerDegLon = 111_320 * Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([lon + (Math.sin(a) * radiusM) / mPerDegLon, lat + (Math.cos(a) * radiusM) / mPerDegLat]);
  }
  return pts;
}

export function navStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      openmaptiles: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": NAV_COLORS.bg } },

      // --- verde del parque / áreas verdes ---
      {
        id: "park", type: "fill", source: "openmaptiles", "source-layer": "park",
        filter: ["all", ["!=", ["get", "class"], "national_park"]] as never,
        minzoom: 9,
        paint: { "fill-color": NAV_COLORS.park, "fill-opacity": 0.55 },
      },
      {
        id: "landuse-grass", type: "fill", source: "openmaptiles", "source-layer": "landuse",
        filter: ["==", ["get", "class"], "grass"],
        minzoom: 12,
        paint: { "fill-color": NAV_COLORS.park, "fill-opacity": 0.3 },
      },
      {
        id: "landcover-wood", type: "fill", source: "openmaptiles", "source-layer": "landcover",
        filter: ["match", ["get", "class"], ["wood", "forest"], true, false] as never,
        minzoom: 10,
        paint: { "fill-color": NAV_COLORS.park, "fill-opacity": 0.45 },
      },

      // --- agua ---
      { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: { "fill-color": NAV_COLORS.water } },

      // --- edificios (desde z15) ---
      {
        id: "building", type: "fill", source: "openmaptiles", "source-layer": "building",
        minzoom: 15,
        paint: { "fill-color": NAV_COLORS.building, "fill-opacity": 0.9 },
      },

      // --- sendas / veredas ---
      {
        id: "path", type: "line", source: "openmaptiles", "source-layer": "transportation",
        filter: ["match", ["get", "class"], ["path", "footway", "pedestrian", "steps"], true, false] as never,
        minzoom: 15,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": NAV_COLORS.path, "line-width": ["interpolate", ["linear"], ["zoom"], 15, 0.6, 18, 2.2], "line-dasharray": [2, 2], "line-opacity": 0.8 },
      },

      // --- vías: casing + relleno por jerarquía ---
      {
        id: "road-case", type: "line", source: "openmaptiles", "source-layer": "transportation",
        filter: ["match", ["get", "class"], ["path", "footway", "pedestrian", "steps", "track", "ferry", "rail", "transit"], false, true] as never,
        minzoom: 8,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": NAV_COLORS.roadCase,
          "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 10, 1.6, 13, 3.4, 16, 8, 18.5, 16],
          "line-opacity": 0.9,
        },
      },
      {
        id: "road-minor", type: "line", source: "openmaptiles", "source-layer": "transportation",
        filter: ["match", ["get", "class"], ["minor", "service", "track"], true, false] as never,
        minzoom: 12,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": NAV_COLORS.roadMinor, "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 13, 1, 16, 4.6, 18.5, 10] },
      },
      {
        id: "road-mid", type: "line", source: "openmaptiles", "source-layer": "transportation",
        filter: ["match", ["get", "class"], ["secondary", "tertiary"], true, false] as never,
        minzoom: 8,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": NAV_COLORS.roadMid, "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 10, 0.9, 13, 2.4, 16, 6.2, 18.5, 12] },
      },
      {
        id: "road-major", type: "line", source: "openmaptiles", "source-layer": "transportation",
        filter: ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false] as never,
        minzoom: 6,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": NAV_COLORS.roadMajor, "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 8, 1, 11, 1.8, 14, 4, 17, 9, 18.5, 14] },
      },
      // ciclovías OSM del mapa base: verde sutil (solo z16+, no estorba la ruta activa)
      {
        id: "cycleway-base", type: "line", source: "openmaptiles", "source-layer": "transportation",
        filter: ["==", ["get", "class"], "cycleway"],
        minzoom: 15,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#2dd4bf", "line-width": ["interpolate", ["linear"], ["zoom"], 15, 0.8, 18.5, 2.6], "line-opacity": 0.85 },
      },

      // --- rótulos de vías: siguen la calle (rotan con el mapa, como Waze) ---
      {
        id: "road-labels", type: "symbol", source: "openmaptiles", "source-layer": "transportation_name",
        minzoom: 14.5,
        layout: {
          "symbol-placement": "line",
          "text-field": ["coalesce", ["get", "name:es"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": 10.5,
          "text-letter-spacing": 0.08,
          "text-max-angle": 32,
        },
        paint: {
          "text-color": NAV_COLORS.labelDim,
          "text-halo-color": NAV_COLORS.bg,
          "text-halo-width": 1.4,
        },
      },

      // --- rótulos de lugares: SIEMPRE derechos (viewport) ---
      {
        id: "place-city", type: "symbol", source: "openmaptiles", "source-layer": "place",
        filter: ["match", ["get", "class"], ["city", "town", "village"], true, false] as never,
        maxzoom: 15,
        layout: {
          "text-field": ["coalesce", ["get", "name:es"], ["get", "name"]],
          "text-font": ["Noto Sans Bold"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 9, 11, 14, 15],
          "text-rotation-alignment": "viewport",
          "text-pitch-alignment": "viewport",
        },
        paint: { "text-color": "#dbe3ee", "text-halo-color": NAV_COLORS.bg, "text-halo-width": 1.6 },
      },
      {
        id: "place-suburb", type: "symbol", source: "openmaptiles", "source-layer": "place",
        filter: ["match", ["get", "class"], ["suburb", "quarter", "neighbourhood"], true, false] as never,
        minzoom: 11,
        maxzoom: 17,
        layout: {
          "text-field": ["coalesce", ["get", "name:es"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11.5,
          "text-letter-spacing": 0.12,
          "text-transform": "uppercase",
          "text-rotation-alignment": "viewport",
          "text-pitch-alignment": "viewport",
        },
        paint: { "text-color": NAV_COLORS.label, "text-halo-color": NAV_COLORS.bg, "text-halo-width": 1.4 },
      },
    ],
  };
}
