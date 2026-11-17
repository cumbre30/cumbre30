// ============================================================
// Estilo del minimapa de navegación 3D (look Waze, cámara con
// pitch 50° y rotación al rumbo).
//
// ⚠️ v1.3.2 - causa raíz del "3d no carga": la cámara arrancaba en
// el Atlántico Sur porque PARK_CENTER pasaba [lat, lon] y MapLibre
// espera [lng, lat]. El "océano" era real: estábamos mirando mar,
// no tiles rotos (OpenFreeMap sirve Santiago sin problema).
//
// De paso, la base ahora es RÁSTER OSM estándar (antes vectorial):
// menos pasos al primer pintado (sin TileJSON ni glifos), menos
// dependencias externas y los mismos tiles ya validados en el
// resto de la app. Fallback automático a CyclOSM (OSM-France,
// orientado a bicicletas) si OSM estándar se cae. El "3D" no
// depende de la fuente: lo da la cámara de MapLibre (pitch +
// bearing), y todas las capas de la app (parque, riesgo, ruta,
// pin) son GeoJSON propias y siguen intactas encima.
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

/** Base principal (v1.12.14): ráster CyclOSM (OSM-France) - el mix
 *  pedido por el cliente: datos de ciclovías actualizados (OSM se
 *  renderiza de forma continua) con el estilo ciclista de OSM, que
 *  destaca ciclovías, sendas y servicios para bicicleta. */
export const CYCLOSM_TILES = ["a", "b", "c"].map(
  (s) => `https://${s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png`
);

/** Fallback: ráster OSM estándar (misma fuente validada en el resto
 *  de la app) si CyclOSM falla (rate-limit, caída). */
export const OSM_RASTER_TILES = ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"];

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
        tiles: CYCLOSM_TILES,
        tileSize: 256,
        maxzoom: 19,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a href="https://wiki.openstreetmap.org/wiki/CyclOSM">CyclOSM</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>',
      },
    },
    layers: [
      // Fondo mientras cargan los tiles (claro, coherente con la
      // pestaña Mapa, que ahora también usa CyclOSM).
      { id: "bg", type: "background", paint: { "background-color": "#dfe2e6" } },
      // Base ráster CyclOSM (estilo ciclista, datos OSM frescos);
      // la inclinación 3D la aplica la cámara (pitch/bearing) sobre
      // estos tiles, como un mapa de papel inclinado.
      { id: "base", type: "raster", source: "base", paint: { "raster-fade-duration": 300 } },
    ],
  };
}
