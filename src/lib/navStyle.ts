// ============================================================
// Estilo del minimapa de navegación (v1.13.3: 2D CENITAL tipo
// ciclocomputador, alto contraste) y base de los mapas de la app
// (el JSON íntegro viaja al plugin nativo del APK).
//
// ⚠️ v1.3.2 - causa raíz del "3d no carga": la cámara arrancaba en
// el Atlántico Sur porque PARK_CENTER pasaba [lat, lon] y MapLibre
// espera [lng, lat]. El "océano" era real: estábamos mirando mar,
// no tiles rotos.
//
// v1.12.14b - pedido del cliente: la versión ESTÁNDAR OSM en ambos
// mapas. El intento OMT del commit anterior (OpenFreeMap Liberty,
// vectorial) queda en el historial: el minimapa web vuelve al ráster
// estándar - la misma base del mapa grande (Leaflet) y del APK
// nativo. Fuente: OSM France (mismo render que tile.openstreetmap.org
// y límites más generosos: OSM estándar responde 429 con usuarios
// concurrentes).
//
// v1.13.3 - alto contraste del ráster (mockup ciclocomputador):
// contraste +0.12 y saturación -0.08 sobre los tiles. RETIRADO en
// v1.14.3 a pedido del cliente: el minimapa se ve EXACTAMENTE igual
// que el mapa grande y que Google Maps - tiles OSM estándar, blancos,
// sin realce, en tema claro y en oscuro. El pitch se quitó de la
// cámara (2D cenital). La paleta oscura NAV_COLORS (lienzo nativo de
// la v1.3.x) también salió: código muerto, el ráster claro no la usa.
// ============================================================

import type { StyleSpecification } from "maplibre-gl";

/** Base principal (v1.12.14b): ráster estándar OSM France - mismo
 *  render que tile.openstreetmap.org, sin key y con límites más
 *  generosos (OSM estándar responde 429 con usuarios concurrentes). */
export const BASE_RASTER_TILES = ["a", "b", "c"].map(
  (s) => `https://${s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png`
);

/** Respaldo del failover: OSM estándar si OSM France cae. */
export const OSM_ORG_FALLBACK_TILES = ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"];

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
        tiles: BASE_RASTER_TILES,
        tileSize: 256,
        maxzoom: 19,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>',
      },
    },
    layers: [
      // Fondo mientras cargan los tiles (claro, coherente con la base).
      { id: "bg", type: "background", paint: { "background-color": "#eef0f3" } },
      // Base ráster OSM estándar SIN realce (v1.14.3): mismo render
      // que el mapa grande - tiles blancos tal como los pinta OSM.
      {
        id: "base",
        type: "raster",
        source: "base",
        paint: {
          "raster-fade-duration": 300,
        },
      },
    ],
  };
}
