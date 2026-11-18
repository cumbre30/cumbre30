"use client";

// ============================================================
// Lienzo de mapa NATIVO (MapLibre Native Android vía plugin).
// Misma lógica que NavCanvas (web) pero las capas/cámara viven en
// una vista nativa: el plugin perfore una ventana en el backdrop y
// el WebView solo dibuja la UI HTML alrededor.
// · mode "nav" → cámara ciclocomputador: pin abajo-centrado, 2D
//   cenital (pitch 0, v1.13.3), rumbo Track Up o Norte arriba.
// · mode "flat" → mapa grande plano con gestos nativos.
// ============================================================

import { useEffect, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import { isNativeMapPlatform, NativeMap } from "@/lib/nativeMapBridge";
import { accuracyFeature, nativeStyle, staticSources, trackFeature, type NativeMapMode } from "@/lib/nativeStyle";
import { EMPTY_FC, buildFullRouteFeatures, buildRouteFeatures, navCamera, pointFeat, toFc, NAV_PITCH } from "@/lib/navCanvasLogic";
import { nativeMapImages, puckIconFor } from "@/lib/nativeMapImages";
import type { IncidentItem } from "@/hooks/useIncidentFeed";
import type { NavEngine } from "@/hooks/useNavEngine";
import type { RouteStep } from "@/lib/routing";
import type { LatLng } from "@/lib/park";

// ⚠️ [lng, lat] - MapLibre espera longitud PRIMERO (fix v1.3.2).
const PARK_CENTER: [number, number] = [-70.636, -33.408];

type Props = {
  id: string;
  mode: NativeMapMode;
  position: LatLng | null;
  heading: number | null;
  track: LatLng[];
  accuracyM?: number | null;
  onRoute: boolean;
  route: NonNullable<NavEngine["route"]> | null;
  nearestIdx: number | null;
  remainingM: number;
  nextStep: RouteStep | null;
  dest: LatLng | null;
  /** Modo toque para reportar incidencias (mapa grande). Opcional.
   *  El minimapa ya no elige destino tocando el lienzo. */
  pickMode?: boolean;
  onPick?: (p: LatLng) => void;
  userPin?: string;
  incidents: IncidentItem[];
  locateTarget: LatLng | null;
  /** v1.13.3: «rumbo» = Track Up o «norte» = Norte arriba (Norte arriba fija bearing 0). */
  camMode?: "rumbo" | "norte";
  /** Rumbo de cámara final (por fix) para la aguja de la brújula. */
  onBearing?: (b: number) => void;
  /** Ciclovías del cerro (solo modo flat). */
  cicloFeature?: FeatureCollection | null;
  /** Aviso de que el mapa nativo no llegó a estar listo (fallback a web). */
  onUnavailable?: () => void;
};

export default function NativeMapCanvas(props: Props) {
  const { id, mode } = props;
  const boxRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const unavailableRef = useRef(props.onUnavailable);
  const rectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const firstFixRef = useRef(false);
  const lastBearingRef = useRef(0);
  const userMovedRef = useRef(false);

  // refs vivas para handlers registrados una sola vez
  const pickModeRef = useRef(props.pickMode);
  const onPickRef = useRef(props.onPick);
  const onBearingRef = useRef(props.onBearing);
  useEffect(() => {
    pickModeRef.current = props.pickMode;
    onPickRef.current = props.onPick;
    onBearingRef.current = props.onBearing;
    unavailableRef.current = props.onUnavailable;
  }, [props.pickMode, props.onPick, props.onBearing, props.onUnavailable]);
  // (en el minimapa ya no existen: props undefined = sin pick)

  // ---- crear / destruir el mapa nativo ----
  useEffect(() => {
    if (!isNativeMapPlatform()) return;
    let alive = true;
    const handles: Promise<unknown>[] = [];

    NativeMap.create({
      id,
      styleJson: JSON.stringify(nativeStyle(mode)),
      images: nativeMapImages(),
      gestures: mode === "flat",
      center: PARK_CENTER,
      zoom: mode === "flat" ? 14 : 13.5,
      pitch: 0,
      bearing: 0,
    }).catch(() => {});

    handles.push(
      NativeMap.addListener("mapready", (d) => {
        if (alive && d.id === id) {
          readyRef.current = true;
          setReady(true);
        }
      })
    );
    handles.push(
      NativeMap.addListener("mapclick", (d) => {
        if (alive && d.id === id && pickModeRef.current) onPickRef.current?.({ lat: d.lat, lon: d.lng });
      })
    );
    handles.push(
      NativeMap.addListener("usermove", (d) => {
        if (alive && d.id === id) userMovedRef.current = true;
      })
    );

    // Red de seguridad: si el mapa nativo no reporta mapready en 7 s
    // (estilo inaccesible, GL sin arrancar, etc.) avisamos para que el
    // componente padre caiga al renderizador web de MapLibre GL JS.
    const failTimer = window.setTimeout(() => {
      if (alive && !readyRef.current) unavailableRef.current?.();
    }, 7000);

    return () => {
      alive = false;
      window.clearTimeout(failTimer);
      setReady(false);
      readyRef.current = false;
      firstFixRef.current = false;
      userMovedRef.current = false;
      for (const h of handles)
        (h as Promise<{ remove: () => void }>).then((hh) => hh.remove()).catch(() => {});
      NativeMap.destroy({ id }).catch(() => {});
    };
  }, [id, mode]);

  // ---- ventana del mapa: rect del contenedor (scroll/resize) ----
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !isNativeMapPlatform()) return;
    let raf = 0;
    const send = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      rectRef.current = { x: r.left, y: r.top, w: r.width, h: r.height };
      NativeMap.setRect({ id, x: r.left, y: r.top, w: r.width, h: r.height, radius: 12 }).catch(() => {});
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(send);
    };
    send();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    const iv = setInterval(schedule, 900); // red de seguridad
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      clearInterval(iv);
      rectRef.current = null;
      NativeMap.setRect({ id, x: 0, y: 0, w: 0, h: 0, radius: 0 }).catch(() => {});
    };
  }, [id]);

  // ---- fuentes estáticas al estar listo ----
  useEffect(() => {
    if (!ready || !isNativeMapPlatform()) return;
    const st = staticSources();
    const payload: Record<string, string> = {
      park: JSON.stringify(st.park),
      risk: JSON.stringify(st.risk),
      gates: JSON.stringify(st.gates),
    };
    if (mode === "flat" && props.cicloFeature) payload.ciclo = JSON.stringify(props.cicloFeature);
    NativeMap.setData({ id, sources: payload }).catch(() => {});
  }, [ready, mode, id, props.cicloFeature]);

  // ---- datos vivos: recorrido, ruta, pin, bandera, incidencias ----
  useEffect(() => {
    if (!ready || !isNativeMapPlatform()) return;
    const sources: Record<string, string> = {};
    sources.track = JSON.stringify(trackFeature(props.track));

    if (mode === "nav") {
      const r =
        props.onRoute && props.route
          ? buildRouteFeatures(props.route, props.nearestIdx, props.position)
          : { remaining: EMPTY_FC, traveled: EMPTY_FC };
      sources["route-remaining"] = JSON.stringify(r.remaining);
      sources["route-traveled"] = JSON.stringify(r.traveled);
    } else {
      sources["route-remaining"] = JSON.stringify(buildFullRouteFeatures(props.route ?? null));
      sources["route-traveled"] = JSON.stringify(EMPTY_FC);
    }

    sources.incidents = JSON.stringify(
      toFc(props.incidents.map((i) => pointFeat({ lat: i.lat, lon: i.lon }, { icon: `c30-inc-${i.type}` })))
    );

    if (props.position) {
      const pk = puckIconFor(props.userPin);
      sources.puck = JSON.stringify(
        toFc([pointFeat(props.position, { kind: pk.kind, icon: pk.icon, rotate: Math.round(props.heading ?? 0) })])
      );
    } else {
      sources.puck = JSON.stringify(EMPTY_FC);
    }

    sources.flag = props.dest ? JSON.stringify(toFc([pointFeat(props.dest)])) : JSON.stringify(EMPTY_FC);

    if (mode === "flat") {
      sources.accuracy =
        props.position && props.accuracyM != null && props.accuracyM < 100
          ? JSON.stringify(accuracyFeature(props.position, props.accuracyM))
          : JSON.stringify(EMPTY_FC);
    }

    NativeMap.setData({ id, sources }).catch(() => {});
  }, [
    ready,
    mode,
    id,
    props.track,
    props.onRoute,
    props.route,
    props.nearestIdx,
    props.position,
    props.heading,
    props.userPin,
    props.incidents,
    props.dest,
    props.accuracyM,
  ]);

  // ---- cámara nav: pin FIJO abajo y al centro (padding incluye la ventana) ----
  useEffect(() => {
    if (!ready || mode !== "nav" || !props.position) return;
    const r = rectRef.current;
    if (!r || r.w < 8 || r.h < 8) return;
    const cam = navCamera({
      position: props.position,
      heading: props.heading,
      onRoute: props.onRoute,
      remainingM: props.remainingM,
      nearestIdx: props.nearestIdx,
      route: props.route ?? null,
      lastBearing: lastBearingRef.current,
    });
    // v1.13.3 (mockup ciclocomputador): en Norte arriba el mapa queda
    // fijo (bearing 0) y el pin flecha sigue girando al rumbo real.
    const bearing = props.camMode === "norte" ? 0 : cam.bearing;
    lastBearingRef.current = bearing;
    // la brújula (aguja) apunta hacia donde queda el norte en pantalla
    onBearingRef.current?.(bearing);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const anchorBottom = Math.round(r.h * cam.anchorBottomFrac);
    const padTop = Math.max(0, Math.round(r.h) - anchorBottom * 2);
    const padding = {
      top: Math.round(r.y) + padTop,
      left: Math.round(r.x),
      right: Math.max(0, Math.round(vw - (r.x + r.w))),
      bottom: Math.max(0, Math.round(vh - (r.y + r.h))),
    };

    const animated = firstFixRef.current;
    firstFixRef.current = true;
    NativeMap.setCamera({
      id,
      lat: cam.center.lat,
      lng: cam.center.lon,
      zoom: cam.zoom,
      pitch: NAV_PITCH,
      bearing,
      padding,
      animated,
      duration: 680,
    }).catch(() => {});
  }, [ready, mode, id, props.position, props.heading, props.onRoute, props.remainingM, props.nearestIdx, props.route, props.camMode]);

  // ---- cámara flat: seguir mi ubicación / volver al pulsar localizar ----
  useEffect(() => {
    if (!ready || mode !== "flat") return;
    const r = rectRef.current;
    if (!r || r.w < 8 || r.h < 8) return;
    const target = props.locateTarget ?? (props.position && !userMovedRef.current ? props.position : null);
    if (!target) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const padding = {
      top: Math.round(r.y),
      left: Math.round(r.x),
      right: Math.max(0, Math.round(vw - (r.x + r.w))),
      bottom: Math.max(0, Math.round(vh - (r.y + r.h))),
    };
    // primer encuadre sin animación (evita el vuelo desde el origen del mundo)
    const animated = firstFixRef.current;
    firstFixRef.current = true;
    NativeMap.setCamera({
      id,
      lat: target.lat,
      lng: target.lon,
      zoom: 14.5,
      pitch: 0,
      bearing: 0,
      padding,
      animated,
      duration: 600,
    }).catch(() => {});
  }, [ready, mode, id, props.position, props.locateTarget]);

  return <div ref={boxRef} className="absolute inset-0" />;
}
