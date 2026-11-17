// ============================================================
// Estilo del minimapa de navegación 3D (look Waze, cámara con
// pitch 50° y rotación al rumbo) y base de los mapas de la app
// (el JSON íntegro viaja al plugin nativo del APK).
//
// ⚠️ v1.3.2 - causa raíz del "3d no carga": la cámara arrancaba en
// el Atlántico Sur porque PARK_CENTER pasaba [lat, lon] y MapLibre
// espera [lng, lat]. El "océano" era real: estábamos mirando mar,
// no tiles rotos.
//
// v1.12.14 - pedido del cliente: look MapTiler / OMT (OpenMapTiles).
// El minimapa web (MapLibre) carga el estilo vectorial OMT de
// OpenFreeMap (Liberty, sin API key - el esquema OpenMapTiles lo
// mantiene MapTiler, pero sus tiles exigen key de pago; CARTO, la
// alternativa raster gratuita, ahora también pide key: en producción
// devuelve el tile placeholder "API KEY REQUIRED"). El fallback y la
// base del APK nativo siguen siendo el ráster OSM estándar validado:
// el JSON íntegro del estilo nativo no puede apuntar a una URL de
// estilo externa sin tocar el bridge del plugin.
// ============================================================

import type { StyleSpecification } from "maplibre-gl";

/** Paleta del tema oscuro del lienzo nativo (nativeStyle la
 *  re-exporta; el estilo ráster claro de arriba no la usa). */
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

/** Estilo vectorial OpenMapTiles (look MapTiler) del minimapa web,
 *  servido por OpenFreeMap sin API key. Carga async: si falla, el
 *  failover de MiniMap vuelve a navStyle() (ráster OSM estándar). */
export const OMT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** Base ráster: estilo estándar OSM France (mismo render que OSM
 *  estándar, sin key y con límites más generosos - tile.openstreetmap.org
 *  responde 429 con usuarios concurrentes). Fallback del minimapa web
 *  y base del APK nativo. */
export const OSM_RASTER_TILES = ["a", "b", "c"].map(
  (s) => `https://${s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png`
);

/** Polígono circular (32 lados) alrededor de un punto - para zonas
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
    sources: {
      base: {
        type: "raster",
        tiles: OSM_RASTER_TILES,
        tileSize: 256,
        maxzoom: 19,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>',
      },
    },
    layers: [
      // Fondo mientras cargan los tiles (claro, coherente con la base).
      { id: "bg", type: "background", paint: { "background-color": "#eef0f3" } },
      // Base ráster OSM estándar; la inclinación 3D la aplica la cámara
      // (pitch/bearing) sobre estos tiles, como un mapa de papel
      // inclinado.
      { id: "base", type: "raster", source: "base", paint: { "raster-fade-duration": 300 } },
    ],
  };
}
