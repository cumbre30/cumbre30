"use client";

// ============================================================
// Cámara de navegación compartida (LeafletNav del APK + MapView
// del mapa grande), v1.12.10:
//  · MODO RUMBO (Waze): el «norte» de la vista es el RUMBO — la
//    dirección de avance apunta hacia arriba; en los giros rota
//    el mapa y el pin queda fijo y centrado, así la ruta se ve
//    recta (vertical), como en Waze.
//  · MODO NORTE: mapa fijo con el norte arriba (botón brújula).
//  · Sin course GPS usa el rumbo del tramo de ruta más cercano;
//    sin ninguno mantiene la última orientación válida (no cae
//    a 0° «por defecto», que era el pin mirando al norte fijo).
//  · El giro siempre va por el camino corto (sin vueltas de 340°).
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLng } from "@/lib/park";
import { haversineM, type NavRoute } from "@/lib/routing";
import { bearingDeg } from "@/lib/geo";

export type ModoCamara = "rumbo" | "norte";

export function useCamaraRumbo({
  activa,
  heading,
  route,
  position,
  pasoEstado = 2,
  modoForzado,
}: {
  /** true mientras hay navegación/rumbo que alinear (ruta activa o course GPS) */
  activa: boolean;
  heading: number | null;
  route: NavRoute | null;
  position: LatLng | null;
  /** Delta mínimo (°) entre actualizaciones del ESTADO React. El magnetómetro
   *  entrega rumbo varias veces por segundo: si el estado cambia en cada tick
   *  (≥0.5°) todo el árbol del mapa re-renderiza y el APK se arrastraba
   *  (v1.13.1). Los iconos contra-rotados no necesitan precisión finer que
   *  este paso; la suavidad visual la da la transición CSS del wrapper. */
  pasoEstado?: number;
  /** v1.13.6: modo de cámara impuesto desde fuera (la brújula única del
   *  minimapa). Si llega, el ciclo de navegación ya NO cambia el modo:
   *  rumbo/norte lo decide solo el ciclista con el botón brújula. */
  modoForzado?: ModoCamara;
}) {
  const [modo, setModo] = useState<ModoCamara>(modoForzado ?? "norte");
  const bearingRef = useRef(0);
  const estadoRef = useRef(0);
  const [mapBearing, setMapBearing] = useState(0);

  // Al activarse la navegación la cámara se bloquea al rumbo; al
  // desactivarse, vuelve a norte arriba. Con modo forzado (v1.13.6)
  // este ciclo no toca el modo: lo manda el botón brújula.
  useEffect(() => {
    if (modoForzado) return;
    setModo(activa ? "rumbo" : "norte");
  }, [activa, modoForzado]);

  // Rumbo de respaldo de la ruta: vértice más cercano → rumbo del tramo
  // siguiente (cuando el GPS no entrega course, p. ej. detenido).
  const segBearing = useMemo(() => {
    if (!route || route.coords.length < 2 || !position) return null;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < route.coords.length; i++) {
      const d = haversineM(position, route.coords[i]);
      if (d < bd) {
        bd = d;
        best = i;
        if (d < 8) break;
      }
    }
    const i = Math.min(best, route.coords.length - 2);
    return bearingDeg(route.coords[i], route.coords[i + 1]);
  }, [route, position]);

  // bearing del mapa: rumbo (navegación) o norte (exploración).
  useEffect(() => {
    let target: number | null = null;
    if (modo === "rumbo") {
      if (heading !== null) target = heading;
      else if (segBearing !== null) target = segBearing;
    } else {
      target = 0;
    }
    if (target === null) return; // sin rumbo confiable: mantener orientación
    const cur = bearingRef.current;
    const d = ((target - cur + 540) % 360) - 180;
    if (Math.abs(d) < 0.5) return;
    const nb = (cur + d + 360) % 360;
    bearingRef.current = nb;
    // Estado React solo en pasos grandes: entre pasos el giro lo suaviza
    // la transición CSS del wrapper (0.25s), sin re-render del árbol.
    const de = ((nb - estadoRef.current + 540) % 360) - 180;
    if (Math.abs(de) >= pasoEstado) {
      estadoRef.current = nb;
      setMapBearing(nb);
    }
  }, [modo, heading, segBearing, pasoEstado]);

  return { modo, mapBearing, setModo };
}
