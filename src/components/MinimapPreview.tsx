"use client";

// ============================================================
// Vista previa del minimapa en Configuración (v1.12.14) y, desde
// v1.13.15, minimapa de la vista previa del creador de trazados:
// si llega `coords` ([lng, lat]), pinta esa línea (naranja) con
// su inicio (verde) y su fin (rojo), encuadrada - en vez de la
// demo del minimapa.
// El mismo motor del minimapa real (MapLibre + navStyle, ráster
// estándar OSM France - la misma base del mapa grande) montado en
// modo estático. Solo estética: el marco y el acabado los da
// minimapStyleCls y la altura minimapHeight, así la preview
// refleja el estilo y el tamaño elegidos, como la vista previa
// del velocímetro.
// ============================================================

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { navStyle, OSM_ORG_FALLBACK_TILES } from "@/lib/navStyle";
import { minimapHeight, minimapStyleCls, type MinimapSize, type MinimapStyle } from "@/lib/rideTheme";

// Centro del parque San Cristóbal (misma referencia del minimapa
// real; [lng, lat] - MapLibre espera longitud primero).
const CENTER: [number, number] = [-70.636, -33.408];

/** Tramo de ciclovía demo (curva corta alrededor del centro). */
const DEMO_ROUTE: [number, number][] = [
  [-70.6405, -33.4058],
  [-70.6385, -33.4075],
  [-70.6362, -33.4088],
  [-70.6338, -33.4081],
  [-70.6328, -33.4062],
];

/** Pinta la línea (demo o del trazado) y encuadra si hay línea. */
function pintarLinea(m: MlMap, coords?: [number, number][]) {
  const line = coords && coords.length >= 2 ? coords : DEMO_ROUTE;
  const esTrazado = coords && coords.length >= 2;
  const src = m.getSource("demo-route") as maplibregl.GeoJSONSource | undefined;
  if (src) {
    src.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line } });
    // La demo nace violeta; el trazado del creador es naranja.
    if (m.getLayer("demo-route-line")) m.setPaintProperty("demo-route-line", "line-color", esTrazado ? "#f97316" : "#8b5cf6");
  }
  const pinSrc = m.getSource("demo-pin") as maplibregl.GeoJSONSource | undefined;
  if (pinSrc) pinSrc.setData({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: line[line.length - 1] } });
  const iniSrc = m.getSource("demo-pin-ini") as maplibregl.GeoJSONSource | undefined;
  if (iniSrc) iniSrc.setData({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: line[0] } });
  if (esTrazado) {
    const lngs = line.map((c) => c[0]);
    const lats = line.map((c) => c[1]);
    m.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 22, duration: 0, maxZoom: 16 },
    );
  }
}

export function MinimapPreview({ style, size, coords, heightClass }: { style: MinimapStyle; size: MinimapSize; coords?: [number, number][]; heightClass?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const failedRef = useRef(false);
  const loadedRef = useRef(false);
  const pendRef = useRef<[number, number][] | undefined>(undefined);

  useEffect(() => {
    if (!boxRef.current || mapRef.current || failedRef.current) return;
    let map: MlMap | null = null;
    try {
      map = new maplibregl.Map({
        container: boxRef.current,
        // Base ráster estándar OSM (v1.12.14b): la misma del minimapa
        // real y del mapa grande.
        style: navStyle(),
        center: CENTER,
        zoom: 14.6,
        pitch: 0,
        bearing: 0,
        // Atribución siempre legible (queja del cliente 2026-11-17).
        attributionControl: { compact: false },
        // Estático: sin interacción (es una vista previa).
        dragRotate: false,
        dragPan: false,
        scrollZoom: false,
        doubleClickZoom: false,
        touchZoomRotate: false,
        keyboard: false,
        boxZoom: false,
      });
      // Capas demo de la vista previa (el failover setTiles no las toca);
      // con coords presentes se reutilizan para la línea del trazado.
      const installDemo = (m: MlMap) => {
        m.addSource("demo-route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: DEMO_ROUTE } } });
        m.addLayer({
          id: "demo-route-case",
          type: "line",
          source: "demo-route",
          paint: { "line-color": "#04070b", "line-width": 8, "line-opacity": 0.85 },
        });
        m.addLayer({
          id: "demo-route-line",
          type: "line",
          source: "demo-route",
          paint: { "line-color": esTrazadoColor(coords), "line-width": 5 },
        });
        // Pin del extremo (punta de la ruta) y del inicio.
        m.addSource("demo-pin", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: DEMO_ROUTE[DEMO_ROUTE.length - 1] } } });
        m.addLayer({
          id: "demo-pin",
          type: "circle",
          source: "demo-pin",
          paint: {
            "circle-radius": 7,
            "circle-color": "#10b981",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2.5,
          },
        });
        m.addSource("demo-pin-ini", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: DEMO_ROUTE[0] } } });
        m.addLayer({
          id: "demo-pin-ini",
          type: "circle",
          source: "demo-pin-ini",
          paint: {
            "circle-radius": 7,
            "circle-color": "#ef4444",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2.5,
          },
        });
        loadedRef.current = true;
        if (pendRef.current) {
          pintarLinea(m, pendRef.current);
          pendRef.current = undefined;
        }
      };
      map.on("load", () => {
        const m = mapRef.current;
        if (!m) return;
        installDemo(m);
      });
      // Failover: si la base estándar (OSM France) cae, OSM estándar.
      let errs = 0;
      map.on("error", (e) => {
        if (errs < 0) return;
        const m = mapRef.current;
        if (!m) return;
        const ev = e as unknown as { sourceId?: string };
        if (ev.sourceId === "demo-route" || ev.sourceId === "demo-pin" || ev.sourceId === "demo-pin-ini") return;
        errs++;
        if (errs >= 5) {
          const src = m.getSource("base") as maplibregl.RasterTileSource | undefined;
          if (src && typeof src.setTiles === "function") {
            src.setTiles(OSM_ORG_FALLBACK_TILES);
            errs = -1;
          }
        }
      });
      mapRef.current = map;
    } catch {
      // Sin WebGL (WebView antiguo): placeholder elegante.
      failedRef.current = true;
    }
    return () => {
      map?.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  // Línea del trazado: llega después de calcular; se aplica al
  // cargar o se deja pendiente para el handler de load.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !loadedRef.current) {
      pendRef.current = coords;
      return;
    }
    pintarLinea(m, coords);
  }, [coords]);

  if (failedRef.current) {
    return (
      <div className={`flex items-center justify-center bg-background/60 ${heightClass ?? minimapStyleCls(style) + " " + minimapHeight(size).base}`}>
        <span className="text-xs text-muted-foreground">MapLibre no disponible</span>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden bg-background ${heightClass ?? minimapStyleCls(style) + " " + minimapHeight(size).base}`}>
      <div ref={boxRef} className="h-full w-full" />
    </div>
  );
}

/** Color de la línea: naranja para un trazado del usuario,
 *  violeta ciclovía para la demo del minimapa. */
function esTrazadoColor(coords?: [number, number][]): string {
  return coords && coords.length >= 2 ? "#f97316" : "#8b5cf6";
}
