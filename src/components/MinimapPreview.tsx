"use client";

// ============================================================
// Vista previa del minimapa en Configuración (v1.12.14).
// El mismo motor del minimapa real (MapLibre + estilo OMT de
// OpenFreeMap) montado en modo estático: centro del parque, un
// tramo de ciclovía violeta de muestra y el pin del ciclista.
// Solo estética: el marco y el acabado los da minimapStyleCls y
// la altura minimapHeight, así la preview refleja el estilo y el
// tamaño elegidos, como la vista previa del velocímetro.
// ============================================================

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { navStyle, OMT_STYLE_URL } from "@/lib/navStyle";
import { minimapHeight, minimapStyleCls, type MinimapSize, type MinimapStyle } from "@/lib/rideTheme";

// Centro del parque San Cristóbal (misma referencia del minimapa
// real; [lng, lat] — MapLibre espera longitud primero).
const CENTER: [number, number] = [-70.636, -33.408];

/** Tramo de ciclovía demo (curva corta alrededor del centro). */
const DEMO_ROUTE: [number, number][] = [
  [-70.6405, -33.4058],
  [-70.6385, -33.4075],
  [-70.6362, -33.4088],
  [-70.6338, -33.4081],
  [-70.6328, -33.4062],
];

export function MinimapPreview({ style, size }: { style: MinimapStyle; size: MinimapSize }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const failedRef = useRef(false);

  useEffect(() => {
    if (!boxRef.current || mapRef.current || failedRef.current) return;
    let map: MlMap | null = null;
    try {
      map = new maplibregl.Map({
        container: boxRef.current,
        style: OMT_STYLE_URL,
        center: CENTER,
        zoom: 14.6,
        pitch: 0,
        bearing: 0,
        attributionControl: { compact: true },
        // Estático: sin interacción (es una vista previa).
        dragRotate: false,
        dragPan: false,
        scrollZoom: false,
        doubleClickZoom: false,
        touchZoomRotate: false,
        keyboard: false,
        boxZoom: false,
      });
      // Capas demo (re-instalables: el failover de estilo las descarta).
      const installDemo = (m: MlMap) => {
        // Ciclovía violeta de muestra (color de la ruta ciclista).
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
          paint: { "line-color": "#8b5cf6", "line-width": 5 },
        });
        // Pin del ciclista (punta de la ruta demo).
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
      };
      map.on("load", () => {
        const m = mapRef.current;
        if (!m) return;
        installDemo(m);
      });
      // Failover: si el estilo OMT no carga, ráster OSM estándar.
      let errs = 0;
      map.on("error", (e) => {
        if (errs < 0) return;
        const m = mapRef.current;
        if (!m) return;
        const ev = e as unknown as { sourceId?: string };
        if (ev.sourceId === "demo-route" || ev.sourceId === "demo-pin") return;
        errs++;
        if (errs >= 5) {
          m.setStyle(navStyle());
          const onStyleData = () => {
            if (!m.isStyleLoaded()) return;
            m.off("styledata", onStyleData);
            installDemo(m);
          };
          m.on("styledata", onStyleData);
          errs = -1;
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
    };
  }, []);

  if (failedRef.current) {
    return (
      <div className={`flex items-center justify-center bg-background/60 ${minimapStyleCls(style)} ${minimapHeight(size).base}`}>
        <span className="text-xs text-muted-foreground">MapLibre no disponible</span>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden bg-background ${minimapStyleCls(style)} ${minimapHeight(size).base}`}>
      <div ref={boxRef} className="h-full w-full" />
    </div>
  );
}
