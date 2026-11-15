"use client";

// ============================================================
// Minimapa del velocímetro - NAVEGACIÓN REAL 3D (MapLibre GL).
// Nada de trucos CSS: el motor WebGL de MapLibre (el mismo núcleo
// que MapLibre Native en apps Android/iOS) dibuja con cámara de
// perspectiva: inclinación (pitch), rotación al rumbo y el pin del
// ciclista anclado abajo, como Waze.
// · Banner superior: flecha de maniobra + metros + calle en celeste.
// · Ruta COMPLETA inicio→fin: ciclovía violeta, vía compartida
//   blanca, flechas de dirección sobre la ruta y tramo recorrido
//   atenuado.
// · Barra inferior: llegada estimada + botón amarillo de reporte.
//   SIN velocímetro: la velocidad vive en el velocímetro principal.
// · Pin de posición = elegido por el usuario (o flecha clásica).
// · Si el WebView no soporta WebGL: aviso elegante sin romper la UI.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { setWorkerUrl } from "maplibre-gl";
import type { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// El bundler rompe la resolución automática del worker (import.meta.url),
// así que lo servimos nosotros: public/maplibre-gl-worker.mjs - mismo
// archivo incluido en el APK como asset.
setWorkerUrl("/maplibre-gl-worker.mjs?v=6.16.0");
import { Crosshair, Plus, Route as RouteIcon, TriangleAlert, X, Phone } from "lucide-react";
import { apiUrl } from "@/lib/backend";
import { GATES, PARK_POLYGON, RISK_ZONES, type LatLng } from "@/lib/park";
import { MINIMAP_ACCESOS } from "@/lib/mapLayers";
import { DEFAULT_PIN, PINS, type PinId } from "@/lib/pins";
import { INCIDENT_BY_ID } from "@/lib/incidents";
import { circlePolygon, navStyle, CYCLOSM_TILES } from "@/lib/navStyle";
import { haversineM, routeProgress, streetAt, streetOfStep } from "@/lib/routing";
import { bearingOf, buildRouteFeatures, lineFeat, polyFeat, toFc } from "@/lib/navCanvasLogic";
import { INCIDENT_TYPES, type IncidentTypeId } from "@/lib/incidents";
import { addIncident, loadLocalIncidents, saveLocalIncidents, useIncidentFeed, type IncidentItem } from "@/hooks/useIncidentFeed";
import type { NavEngine } from "@/hooks/useNavEngine";
import type { RouteStep } from "@/lib/routing";
import { isNativeMapPlatform } from "@/lib/nativeMapBridge";
import NativeMapCanvas from "@/components/NativeMapCanvas";
import LeafletNav from "@/components/LeafletNav";
import { isNativeApp } from "@/lib/rideNative";

// ⚠️ [lng, lat] - MapLibre espera longitud PRIMERO. Antes estaba
// invertido (-33.408, -70.636) y la cámara arrancaba en el Atlántico
// Sur: el minimapa 3D se veía como un fondo de color sin mapa
// (v1.3.2, causa raíz de "el 3d no carga").
const PARK_CENTER: [number, number] = [-70.636, -33.408];

/** Anticipación de la cámara: con el pin abajo, estilo Waze. */
const ARRIVAL_M = 150;
const NAV_ZOOM = 16.5;
const ARRIVAL_ZOOM = 17.4;
const NAV_PITCH = 50;

const COLOR_CICLO = "#a855f7";
const COLOR_VIA = "#f4f4f5";
const COLOR_CASING = "#05070a";

type Props = {
  position: LatLng | null;
  heading: number | null;
  track: LatLng[];
  accuracyM: number | null;
  userPin?: string;
  nav: NavEngine;
  speedKmh?: number;
  /** Altura del contenedor sin ruta activa (tema Pro: minimapa compacto/grande). */
  heightClass?: string;
  /** Altura del contenedor con ruta activa. */
  heightRouteClass?: string;
  /** Abrir el mapa general (listado completo de destinos y capas). */
  onOpenMap?: () => void;
};

const wrap360 = (deg: number) => ((deg % 360) + 360) % 360;
const fmtKmM = (m: number) => (m >= 950 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(m / 10) * 10)} m`);

/** ¿Hay WebGL disponible? (maplibre v6 ya no exporta supported()) */
function webglSupported(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Rumbo (0-360) entre dos puntos (definido en navCanvasLogic). */

/**
 * Flecha de maniobra estilo Waze: trazos gruesos blancos con
 * puntas redondeadas y punta de flecha maciza.
 */
function TurnArrow({ icon, className }: { icon: RouteStep["icon"]; className?: string }) {
  if (icon === "end") {
    return (
      <svg viewBox="0 0 96 96" className={className} aria-hidden>
        <path d="M32 90 L32 12" stroke="currentColor" strokeWidth="9" strokeLinecap="round" fill="none" />
        <path d="M32 16 L74 16 L74 48 L32 48 Z" fill="currentColor" />
        <g fill="#0a0a0a" opacity="0.85">
          <rect x="43" y="16" width="10" height="10" />
          <rect x="63" y="16" width="11" height="10" />
          <rect x="32" y="27" width="11" height="10" />
          <rect x="53" y="27" width="10" height="10" />
          <rect x="43" y="38" width="10" height="10" />
          <rect x="63" y="38" width="11" height="10" />
        </g>
      </svg>
    );
  }
  if (icon === "uturn") {
    return (
      <svg viewBox="0 0 96 96" className={className} aria-hidden>
        <path d="M30 88 L30 44 Q30 16 52 16 Q74 16 74 44 L74 58" stroke="currentColor" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M56 52 L74 84 L92 52 Z" fill="currentColor" />
      </svg>
    );
  }
  if (icon === "left") {
    return (
      <svg viewBox="0 0 96 96" className={className} aria-hidden>
        <path d="M64 90 L64 58 Q64 38 44 38 L30 38" stroke="currentColor" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M42 14 L12 38 L42 62 Z" fill="currentColor" />
      </svg>
    );
  }
  if (icon === "right") {
    return (
      <svg viewBox="0 0 96 96" className={className} aria-hidden>
        <path d="M32 90 L32 58 Q32 38 52 38 L66 38" stroke="currentColor" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M54 14 L84 38 L54 62 Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <path d="M48 90 L48 34" stroke="currentColor" strokeWidth="13" strokeLinecap="round" fill="none" />
      <path d="M48 8 L70 42 L26 42 Z" fill="currentColor" />
    </svg>
  );
}

/** Chevron blanco (borde oscuro) que va sobre la ruta indicando dirección. */
function makeChevronImage(): ImageData {
  const c = document.createElement("canvas");
  c.width = 48;
  c.height = 48;
  const ctx = c.getContext("2d")!;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(4,7,11,0.95)";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(11, 32);
  ctx.lineTo(24, 15);
  ctx.lineTo(37, 32);
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(14, 31);
  ctx.lineTo(24, 19);
  ctx.lineTo(34, 31);
  ctx.stroke();
  return ctx.getImageData(0, 0, 48, 48);
}

/** Elemento DOM del pin del usuario (flecha o burbuja del pin elegido). */
function buildPuck(pinId: string | undefined): { el: HTMLElement; arrow: HTMLElement | null } {
  const p = PINS[(pinId ?? DEFAULT_PIN) as PinId] ?? PINS[DEFAULT_PIN as PinId];
  const wrap = document.createElement("div");
  wrap.className = "c30-puck";
  if (p.id === DEFAULT_PIN) {
    wrap.innerHTML = `<div class="c30-puck-pulse"></div>
      <div class="c30-puck-arrow-wrap" style="width:38px;height:38px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.7));">
        <svg width="38" height="38" viewBox="0 0 34 34">
          <circle cx="17" cy="17" r="12.5" fill="${p.color}" stroke="#fafafa" stroke-width="3"/>
          <path d="M17 9 L21.5 19.5 L17 17.2 L12.5 19.5 Z" fill="#09090b"/>
        </svg>
      </div>`;
    const arrow = wrap.querySelector(".c30-puck-arrow-wrap") as HTMLElement;
    return { el: wrap, arrow };
  }
  wrap.innerHTML = `<div class="c30-puck-pulse"></div>
    <div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px 9999px 9999px 4px;background:${p.color};border:3px solid #fafafa;box-shadow:0 2px 8px rgba(0,0,0,.65);font-size:17px;line-height:1;">${p.emoji}</div>`;
  return { el: wrap, arrow: null };
}

function buildFlagEl(): HTMLElement {
  const d = document.createElement("div");
  d.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:#0ea5e9;border:2.5px solid #fafafa;box-shadow:0 2px 10px rgba(0,0,0,.7);font-size:14px;line-height:1;">🏁</div>`;
  return d.firstChild as HTMLElement;
}

function buildBadgeEl(icon: RouteStep["icon"]): HTMLElement {
  const stroke = `stroke="#09090b" stroke-width="15" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  let inner: string;
  if (icon === "left") {
    inner = `<path d="M64 84 L64 58 Q64 38 44 38 L30 38" ${stroke}/><path d="M40 18 L12 38 L40 58 Z" fill="#09090b"/>`;
  } else if (icon === "right") {
    inner = `<path d="M32 84 L32 58 Q32 38 52 38 L66 38" ${stroke}/><path d="M56 18 L84 38 L56 58 Z" fill="#09090b"/>`;
  } else if (icon === "end") {
    inner = `<path d="M44 86 L44 20" ${stroke}/><path d="M44 16 L82 16 L82 46 L44 46 Z" fill="#09090b"/>`;
  } else {
    inner = `<path d="M48 84 L48 40" ${stroke}/><path d="M48 12 L70 44 L26 44 Z" fill="#09090b"/>`;
  }
  const d = document.createElement("div");
  d.innerHTML = `<div style="width:30px;height:30px;border-radius:8px;background:#fafafa;border:2px solid #09090b;box-shadow:0 2px 8px rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;">
    <svg width="22" height="22" viewBox="0 0 96 96">${inner}</svg>
  </div>`;
  return d.firstChild as HTMLElement;
}

function buildIncidentEl(type: string): HTMLElement {
  const t = INCIDENT_BY_ID[type] ?? INCIDENT_BY_ID.otro;
  const d = document.createElement("div");
  d.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:${t.color};border:2px solid #09090b;box-shadow:0 0 0 1.5px ${t.color}55;font-size:11px;line-height:1;">${t.emoji}</div>`;
  return d.firstChild as HTMLElement;
}

// ============================================================
// Lienzo del mapa (MapLibre). Se monta una vez y reacciona a
// posición/ruta/estado vía efectos.
// ============================================================
type NavCanvasProps = {
  position: LatLng | null;
  heading: number | null;
  track: LatLng[];
  onRoute: boolean;
  route: NonNullable<NavEngine["route"]> | null;
  nearestIdx: number | null;
  offRoute: boolean;
  remainingM: number;
  nextStep: RouteStep | null;
  dest: LatLng | null;
  userPin?: string;
  incidents: IncidentItem[];
  locateTarget: LatLng | null;
};

function NavCanvas(props: NavCanvasProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const firstFixRef = useRef(false);

  // Rumbo del tramo de ruta más cercano a la posición (v1.12.11):
  // paridad con useCamaraRumbo del mapa grande — se calcula AQUÍ con el
  // vértice más cercano, sin depender de nearestIdx del progreso (puede
  // venir null fuera de ruta y antes dejaba la cámara y el pin sin
  // orientarse: la ruta se veía acostada y el pin apuntaba a cualquier
  // lado, justo lo que reportó el cliente con la ruta a Pío Nono).
  const routeBearing = useMemo(() => {
    if (!props.onRoute || !props.route || props.route.coords.length < 2 || !props.position) return null;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < props.route.coords.length; i++) {
      const d = haversineM(props.position, props.route.coords[i]);
      if (d < bd) {
        bd = d;
        best = i;
        if (d < 8) break;
      }
    }
    const i = Math.min(best, props.route.coords.length - 2);
    return bearingOf(props.route.coords[i], props.route.coords[i + 1]);
  }, [props.onRoute, props.route, props.position]);

  // ---- init ----
  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: boxRef.current,
      style: navStyle(),
      center: PARK_CENTER,
      zoom: 13.5,
      pitch: 0,
      bearing: 0,
      // Atribución compacta (obligatoria para tiles OSM/CARTO).
      attributionControl: { compact: true },
      dragRotate: false,
      dragPan: false,
      scrollZoom: false,
      doubleClickZoom: false,
      touchZoomRotate: false,
      keyboard: false,
      boxZoom: false,
      maxPitch: 70,
    });
    mapRef.current = map;

    // --- fallback de base (v1.3.2): si OSM estándar falla repetidamente
    // (rate-limit 429, caída), cambiamos a CyclOSM (OSM-France) -
    // prioriza funcionamiento: peor es quedarse sin mapa.
    let baseTileErr = 0;
    map.on("error", (e) => {
      if (baseTileErr < 0) return; // ya cambiamos; no insistir
      const ev = e as unknown as { sourceId?: string; error?: { message?: string } };
      if (ev.sourceId && ev.sourceId !== "base") return;
      const msg = ev.error?.message ?? "";
      if (!ev.sourceId && !/tile|base|fetch|status|ajax/i.test(msg)) return;
      baseTileErr++;
      if (baseTileErr >= 5) {
        const src = map.getSource("base") as maplibregl.RasterTileSource | undefined;
        if (src && typeof src.setTiles === "function") {
          src.setTiles(CYCLOSM_TILES);
          baseTileErr = -1; // un solo cambio por sesión
        }
      }
    });

    map.on("load", () => {
      map.addImage("c30-chev", makeChevronImage());

      // asa de depuración/E2E (no interfiere en producción)
      (window as unknown as Record<string, unknown>).__c30nav = map;

      // --- fuentes ---
      map.addSource("park", { type: "geojson", data: toFc([polyFeat(PARK_POLYGON.map((p) => [p.lon, p.lat] as [number, number]))]) });
      map.addSource("risk", {
        type: "geojson",
        data: toFc(RISK_ZONES.map((z) => polyFeat(circlePolygon(z.position.lat, z.position.lon, z.radiusM), { id: z.id }))),
      });
      map.addSource("gates", {
        type: "geojson",
        // Limpieza del minimapa: SOLO los 4 accesos habilitados para
        // ciclistas (normativa Parquemet). El resto de accesos no se dibuja.
        data: toFc(GATES.filter((g) => g.ciclistas).map((g) => polyFeat(circlePolygon(g.position.lat, g.position.lon, 18), { id: g.id }))),
      });
      map.addSource("track", { type: "geojson", data: toFc([]) });
      map.addSource("route-remaining", { type: "geojson", data: toFc([]) });
      map.addSource("route-traveled", { type: "geojson", data: toFc([]) });

      // --- capas ---
      map.addLayer({ id: "park-fill", type: "fill", source: "park", paint: { "fill-color": "#10b981", "fill-opacity": 0.09 } });
      map.addLayer({ id: "park-line", type: "line", source: "park", paint: { "line-color": "#34d399", "line-width": 1.4, "line-opacity": 0.8 } });
      map.addLayer({ id: "risk-fill", type: "fill", source: "risk", paint: { "fill-color": "#f59e0b", "fill-opacity": 0.14 } });
      map.addLayer({ id: "risk-line", type: "line", source: "risk", paint: { "line-color": "#f59e0b", "line-width": 1, "line-opacity": 0.7 } });
      map.addLayer({ id: "gates-fill", type: "fill", source: "gates", paint: { "fill-color": "#0f766e", "fill-opacity": 0.9 } });
      map.addLayer({
        id: "track-line", type: "line", source: "track",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#a3e635", "line-width": 3.5, "line-opacity": 0.9 },
      });
      map.addLayer({
        id: "traveled-line", type: "line", source: "route-traveled",
        filter: ["==", ["get", "ciclo"], true],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLOR_CICLO, "line-width": 5, "line-opacity": 0.3 },
      });
      map.addLayer({
        id: "traveled-line-via", type: "line", source: "route-traveled",
        filter: ["==", ["get", "ciclo"], false],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLOR_VIA, "line-width": 4, "line-opacity": 0.28 },
      });
      map.addLayer({
        id: "route-casing", type: "line", source: "route-remaining",
        filter: ["==", ["get", "kind"], "casing"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLOR_CASING, "line-width": ["interpolate", ["linear"], ["zoom"], 15, 9, 18, 14], "line-opacity": 0.9 },
      });
      map.addLayer({
        id: "route-ciclo", type: "line", source: "route-remaining",
        filter: ["==", ["get", "ciclo"], true],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLOR_CICLO, "line-width": ["interpolate", ["linear"], ["zoom"], 15, 6.5, 18, 10], "line-opacity": 0.98 },
      });
      map.addLayer({
        id: "route-via", type: "line", source: "route-remaining",
        filter: ["all", ["==", ["get", "ciclo"], false], ["==", ["get", "kind"], "seg"]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLOR_VIA, "line-width": ["interpolate", ["linear"], ["zoom"], 15, 5, 18, 8], "line-opacity": 0.98 },
      });
      map.addLayer({
        id: "route-arrows", type: "symbol", source: "route-remaining",
        filter: ["==", ["get", "kind"], "seg"],
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 130,
          "icon-image": "c30-chev",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 15, 0.35, 18, 0.6],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: { "icon-opacity": 0.95 },
      });

      setReady(true);
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(boxRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- marcadores DOM ----
  const puckRef = useRef<maplibregl.Marker | null>(null);
  const arrowRef = useRef<HTMLElement | null>(null);
  const puckPinRef = useRef<string | undefined>(undefined);
  const flagRef = useRef<maplibregl.Marker | null>(null);
  const badgeRef = useRef<maplibregl.Marker | null>(null);
  const badgeIconRef = useRef<string | null>(null);
  const incidentMarkersRef = useRef<maplibregl.Marker[]>([]);

  // pin del usuario (recrear solo si cambia el pin elegido)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !props.position) return;
    if (!puckRef.current) {
      const { el, arrow } = buildPuck(props.userPin);
      puckPinRef.current = props.userPin;
      arrowRef.current = arrow;
      puckRef.current = new maplibregl.Marker({ element: el, rotationAlignment: "map" })
        .setLngLat([props.position.lon, props.position.lat])
        .addTo(map);
    } else if (props.userPin !== puckPinRef.current) {
      const { el, arrow } = buildPuck(props.userPin);
      puckPinRef.current = props.userPin;
      arrowRef.current = arrow;
      puckRef.current.remove();
      puckRef.current = new maplibregl.Marker({ element: el, rotationAlignment: "map" })
        .setLngLat([props.position.lon, props.position.lat])
        .addTo(map);
    }
  }, [ready, props.position, props.userPin]);

  // posición viva del pin: sigue cada arreglo GPS
  useEffect(() => {
    if (puckRef.current && props.position) {
      puckRef.current.setLngLat([props.position.lon, props.position.lat]);
    }
  }, [props.position]);

  // bandera de destino + insignia del próximo giro
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (props.dest) {
      if (!flagRef.current) {
        flagRef.current = new maplibregl.Marker({ element: buildFlagEl() }).setLngLat([props.dest.lon, props.dest.lat]).addTo(map);
      } else {
        flagRef.current.setLngLat([props.dest.lon, props.dest.lat]);
      }
    } else if (flagRef.current) {
      flagRef.current.remove();
      flagRef.current = null;
    }

    const badge = props.nextStep && props.nextStep.icon !== "end" ? props.nextStep : null;
    if (badge) {
      if (!badgeRef.current) {
        badgeRef.current = new maplibregl.Marker({ element: buildBadgeEl(badge.icon) }).setLngLat([badge.point.lon, badge.point.lat]).addTo(map);
        badgeIconRef.current = badge.icon;
      } else {
        badgeRef.current.setLngLat([badge.point.lon, badge.point.lat]);
        if (badgeIconRef.current !== badge.icon) {
          // reemplazo del elemento: el DOM interno cambia de glifo
          const oldEl = badgeRef.current.getElement();
          const newEl = buildBadgeEl(badge.icon);
          if (oldEl.parentNode) oldEl.parentNode.replaceChild(newEl, oldEl);
          badgeIconRef.current = badge.icon;
        }
      }
    } else if (badgeRef.current) {
      badgeRef.current.remove();
      badgeRef.current = null;
      badgeIconRef.current = null;
    }
  }, [ready, props.dest, props.nextStep]);

  // incidencias de la comunidad
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const m of incidentMarkersRef.current) m.remove();
    incidentMarkersRef.current = props.incidents.map((inc) =>
      new maplibregl.Marker({ element: buildIncidentEl(inc.type) }).setLngLat([inc.lon, inc.lat]).addTo(map)
    );
  }, [ready, props.incidents]);

  // ---- datos GeoJSON ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // recorrido del ride
    const trackSrc = map.getSource("track") as maplibregl.GeoJSONSource | undefined;
    trackSrc?.setData(props.track.length > 1 ? toFc([lineFeat(props.track)]) : toFc([]));

    if (!props.onRoute || !props.route) {
      (map.getSource("route-remaining") as maplibregl.GeoJSONSource | undefined)?.setData(toFc([]));
      (map.getSource("route-traveled") as maplibregl.GeoJSONSource | undefined)?.setData(toFc([]));
      return;
    }

    const r = props.route;
    // El tramo restante SIEMPRE parte de la ubicación ACTUAL: si el
    // pin ya se movió del vértice más cercano, se antepone la
    // posición viva como origen con un conector directo (así la ruta
    // nace en tu punto, no en la ciclovía más próxima).
    const feats = buildRouteFeatures(r, props.nearestIdx, props.position);

    (map.getSource("route-remaining") as maplibregl.GeoJSONSource | undefined)?.setData(feats.remaining);
    (map.getSource("route-traveled") as maplibregl.GeoJSONSource | undefined)?.setData(feats.traveled);
  }, [ready, props.onRoute, props.route, props.nearestIdx, props.position, props.track]);

  // ---- cámara: pin FIJO abajo y al centro, estilo Waze ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // Sin posición: encuadra la ruta completa. GIRADA al rumbo inicial
    // del trazado (v1.12.11): la vista de navegación se ve SIEMPRE
    // vertical (la ruta corre hacia arriba), no un norte arriba con la
    // ruta acostada — era la vista que quedó clavada en el reporte del
    // cliente al navegar a Pío Nono sin fix fresco. Zoom con margen
    // extra porque al girar el encuadre norte-arriba puede quedarse
    // corto (el bbox no rota con la cámara).
    if (!props.position) {
      if (props.onRoute && props.route) {
        const lons = props.route.coords.map((c) => c.lon);
        const lats = props.route.coords.map((c) => c.lat);
        const b0 = props.route.coords.length > 1 ? bearingOf(props.route.coords[0], props.route.coords[1]) : 0;
        map.easeTo({
          center: [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2],
          zoom: 12.9,
          pitch: 0,
          bearing: b0,
          duration: 700,
        });
      }
      return;
    }

    // El CENTRO de la cámara es la posición del ciclista y el relleno
    // superior corre el punto de ancla al ~30% del alto: el pin queda
    // clavado abajo y centrado mientras el mundo fluye bajo él.
    const h = boxRef.current?.clientHeight ?? 260;
    const anchorBottom = Math.round(h * (props.onRoute ? 0.3 : 0.34));
    const padding = { top: Math.max(0, Math.round(h) - anchorBottom * 2), bottom: 0, left: 0, right: 0 };

    // rumbo: curso del GPS → RUMBO DE LA RUTA (routeBearing, calculado
    // arriba con el vértice más cercano) → mantener actual
    let b: number;
    if (props.heading !== null) {
      b = props.heading;
    } else if (routeBearing !== null) {
      b = routeBearing;
    } else {
      b = map.getBearing();
    }
    const cur = map.getBearing();
    // giro por el camino corto (evita vueltas de 340°)
    while (b - cur > 180) b -= 360;
    while (b - cur < -180) b += 360;

    const camZoom = props.onRoute && props.remainingM < ARRIVAL_M ? ARRIVAL_ZOOM : NAV_ZOOM;

    if (!firstFixRef.current) {
      firstFixRef.current = true;
      map.jumpTo({
        center: [props.position.lon, props.position.lat],
        bearing: b,
        pitch: NAV_PITCH,
        zoom: camZoom,
        padding,
      });
      return;
    }

    map.easeTo({
      center: [props.position.lon, props.position.lat],
      bearing: b,
      pitch: NAV_PITCH,
      zoom: camZoom,
      padding,
      duration: 680,
      easing: (t) => t,
    });
  }, [ready, props.position, props.heading, props.onRoute, props.remainingM, routeBearing, props.route]);

  // rotación del pin flecha (v1.12.11, reporte del cliente: «que el pin
  // apunte en la dirección que se traza la ruta, ahora apunta a cualquier
  // lado»). Dos causas, ambas corregidas:
  // 1) El marker de MapLibre con rotationAlignment "map" YA contra-rota
  //    la RAÍZ del elemento rotateZ(-bearing) (verificado en el DOM:
  //    translate(...) rotateX(50deg) rotateZ(-bearing)) — el eje del
  //    puck queda alineado al norte del mapa. Restar map.getBearing()
  //    ADEMÁS en la flecha interna contaba el giro DOS veces y con el
  //    mapa rotado el pin caía a cualquier lado. El ángulo del rumbo va
  //    SOLO en la flecha interna.
  // 2) Sin course GPS (parado) el ángulo era heading ?? 0 = norte fijo;
  //    ahora cae al RUMBO DE LA RUTA (routeBearing). Con la cámara
  //    girada al mismo rumbo, la flecha se ve hacia ARRIBA, estilo
  //    Waze (misma idea que rumboPin en LeafletNav v1.12.10).
  useEffect(() => {
    if (!ready) return;
    const hdg = props.heading ?? routeBearing ?? 0;
    const arrow = arrowRef.current;
    if (arrow) arrow.style.transform = `rotate(${hdg}deg)`;
  }, [ready, props.heading, routeBearing, props.position, props.userPin]);

  // sin posición viva el puck se retira (no dejar un pin congelado en
  // la última esquina: con la ruta activa la vista general muestra la
  // ruta completa y un pin viejo confunde — era otra pieza del reporte)
  useEffect(() => {
    if (props.position || !puckRef.current) return;
    puckRef.current.remove();
    puckRef.current = null;
    arrowRef.current = null;
  }, [props.position]);

  // vista a un punto (localización sin ride)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !props.locateTarget) return;
    map.flyTo({ center: [props.locateTarget.lon, props.locateTarget.lat], zoom: Math.max(map.getZoom(), 16), duration: 800 });
  }, [ready, props.locateTarget]);

  return (
    // position absolute por estilo inline: el CSS de maplibre usa
    // .maplibregl-map{position:relative} y pisa la utilidad `absolute`
    <div ref={boxRef} style={{ position: "absolute", inset: 0 }} />
  );
}

// ============================================================
// Piezas de la capa Waze: compartidas por el lienzo web (UI
// absoluta sobre el mapa) y el lienzo nativo (UI HTML fuera de
// la ventana del mapa nativo, porque la vista nativa cubre el
// interior del contenedor).
// ============================================================

type ManeuverBannerProps = {
  className: string;
  nextStep: RouteStep;
  distM: number;
  destName: string;
  offRoute: boolean;
  laterStep: RouteStep | null;
};

function ManeuverBanner({ className, nextStep, distM, destName, offRoute, laterStep }: ManeuverBannerProps) {
  return (
    <div className={className}>
      <TurnArrow icon={nextStep.icon} className="h-14 w-14 shrink-0 text-foreground" />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[26px] font-bold text-foreground leading-none tabular-nums">
          {nextStep.icon === "end" ? "Llegaste" : fmtKmM(distM)}
        </div>
        <div className="text-lg font-bold text-sky-600 dark:text-sky-400 leading-tight truncate mt-0.5">
          {nextStep.icon === "end" ? destName : streetOfStep(nextStep.text)}
        </div>
        {offRoute && <div className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold mt-0.5">desviado, recalculando…</div>}
      </div>
      {laterStep && laterStep.icon !== "end" && <TurnArrow icon={laterStep.icon} className="h-7 w-7 shrink-0 mt-1 text-muted-foreground" />}
    </div>
  );
}

function LegendChip({ className, route }: { className: string; route: NavEngine["route"] }) {
  return (
    <div className={className}>
      <span className="inline-block h-[3px] w-4 rounded-full shrink-0" style={{ background: COLOR_CICLO }} />
      <span className="text-[10px] text-foreground/90">Ciclovía {!!route?.cicloviaPct ? `${route.cicloviaPct}%` : ""}</span>
      <span className="text-[10px] text-muted-foreground/80">·</span>
      <span className="inline-block h-[3px] w-4 rounded-full shrink-0" style={{ background: COLOR_VIA }} />
      <span className="text-[10px] text-foreground/90">Compartida</span>
    </div>
  );
}

type ControlsProps = {
  className: string;
  onLocate: () => void;
  hasDest: boolean;
  onClear: () => void;
};

function Controls({ className, onLocate, hasDest, onClear }: ControlsProps) {
  return (
    <div className={className}>
      <button
        onClick={onLocate}
        aria-label="Localizarme"
        title="Centrar en mi ubicación"
        className="h-8 w-8 rounded-md bg-background/90 border border-border text-foreground flex items-center justify-center hover:border-emerald-500"
      >
        <Crosshair className="h-4 w-4" />
      </button>
      {hasDest && (
        <button
          onClick={onClear}
          aria-label="Quitar destino"
          title="Quitar la ruta"
          className="h-8 w-8 rounded-md bg-background/90 border border-border text-foreground flex items-center justify-center hover:border-red-500"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

type BottomBarProps = {
  className: string;
  onRoute: boolean;
  etaMin: number;
  arrivalClock: string;
  remainingM: number;
  dest: NavEngine["dest"];
  onSetDest: NavEngine["setDestination"];
  onReport: () => void;
  /** Abrir el mapa general (opción «Revisa el listado completo»). */
  onOpenMap?: () => void;
};

// Limpieza del cliente (2026-11-12): en el minimapa SOLO los accesos —
// el resto de destinos vive en el listado completo del mapa general.
const TODOS_DESTINOS = MINIMAP_ACCESOS;

function BottomBar({ className, onRoute, etaMin, arrivalClock, remainingM, dest, onSetDest, onReport, onOpenMap }: BottomBarProps) {
  return (
    <div className={className}>
      {onRoute ? (
        <div className="min-w-0 flex-1 text-center">
          <div className="font-mono text-xl font-bold text-foreground leading-none tabular-nums">{etaMin > 0 ? arrivalClock : "-"}</div>
          <div className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
            {etaMin > 0 ? `${etaMin} min · ${fmtKmM(remainingM)}` : "Ruta lista"}
          </div>
        </div>
      ) : (
        <div className="min-w-0 flex-1 flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5">
          <RouteIcon className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
          <select
            aria-label="Ir a"
            value={
              dest
                ? TODOS_DESTINOS.find((d) => d.position.lat === dest.position.lat && d.position.lon === dest.position.lon)?.id ?? "mapa"
                : ""
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === "listado") {
                onOpenMap?.(); // el listado completo vive en el mapa general
                return;
              }
              if (v === "mapa") return; // ya navegando a un punto libre: no borrar la ruta
              const d = TODOS_DESTINOS.find((x) => x.id === v);
              if (d) onSetDest({ name: d.name, position: d.position, esAcceso: true }); // v1.12.8: acceso → ruta DIRECTA
              else onSetDest(null);
            }}
            className="bg-transparent text-[11px] text-foreground outline-none w-full min-w-0"
          >
            <option value="" className="bg-card">Ir a…</option>
            {/* Solo los ACCESOS habilitados para ciclistas (limpieza del
                cliente, 2026-11-12): sin opciones de ruta ni otros destinos */}
            {MINIMAP_ACCESOS.map((d) => (
              <option key={d.id} value={d.id} className="bg-card">{d.name}</option>
            ))}
            {dest && <option value="mapa" className="bg-card">🎯 {dest.name}</option>}
            {onOpenMap && <option value="listado" className="bg-card">🗺 Revisa el listado completo</option>}
          </select>
        </div>
      )}

      {/* botón amarillo de reporte de incidencias */}
      <button
        onClick={onReport}
        aria-label="Reportar incidencia en mi posición"
        title="Reportar incidencia en mi posición"
        className="relative h-11 w-11 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 transition text-zinc-950 flex items-center justify-center shrink-0"
      >
        <TriangleAlert className="h-6 w-6" strokeWidth={2.4} />
        <Plus className="absolute bottom-0 right-0.5 h-3.5 w-3.5" strokeWidth={3.5} />
      </button>
    </div>
  );
}

function ReportSheet({
  className,
  hasPosition,
  onType,
  onClose,
}: {
  className: string;
  hasPosition: boolean;
  onType: (t: IncidentTypeId) => void;
  onClose: () => void;
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-foreground">Reportar incidencia {hasPosition ? "en tu posición" : "(sin GPS aún)"}</span>
        <button onClick={onClose} aria-label="Cerrar reporte" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {INCIDENT_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => onType(t.id)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-left text-[11px] text-foreground hover:border-zinc-500"
          >
            <span aria-hidden>{t.emoji}</span>
            <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">Se registra con fecha y hora, y aparece en el mapa compartido.</p>
      {/* Canal ciudadano (2026-11-14): para que el parque lo revise, la
          línea oficial de emergencias queda a un toque. */}
      <div className="mt-2 flex items-center gap-2 border-t border-border/60 pt-2">
        <a
          href="tel:1466"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-800/60 bg-red-950/40 px-2.5 py-1.5 text-[11px] font-bold text-red-300 hover:bg-red-900/50"
        >
          <Phone className="h-3.5 w-3.5" /> 1466
        </a>
        <p className="min-w-0 flex-1 text-[10px] leading-snug text-muted-foreground">
          ¿Urgencia o peligro grande? Llama a la línea oficial de emergencias del parque y avisa al personal más cercano.
        </p>
      </div>
    </div>
  );
}

function StatusNote({ className, text }: { className: string; text: string }) {
  return <div className={`${className} pointer-events-none shadow-xl`}>{text}</div>;
}

// ============================================================
// Componente principal: lienzo + capa Waze (banner, barra, etc.)
// ============================================================
export default function MiniMap({ position, heading, track, accuracyM, userPin, nav, speedKmh = 0, heightClass = "h-52 sm:h-56", heightRouteClass = "h-80", onOpenMap }: Props) {
  const incidents = useIncidentFeed();
  const [locateTarget, setLocateTarget] = useState<LatLng | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const route = nav.route;
  const dest = nav.dest;
  // Mapa nativo (MapLibre Native vía plugin) o lienzo web (MapLibre GL JS)
  // ⚠️ NATIVE_MAPS_ENABLED=false (v1.3.1): el WebView del dispositivo no
  // renderiza ni el nativo ni MapLibre GL JS (WebGL caído) - se muestra un
  // fondo de color sin mapa. Prioriza funcionamiento: en la app nativa
  // corre Leaflet con tiles ráster (LeafletNav); el código nativo queda
  // dormido detrás de este flag para depurarlo más adelante.
  const NATIVE_MAPS_ENABLED = false;
  const nativeDetected = useMemo(() => isNativeMapPlatform(), []);
  const [nativeFail, setNativeFail] = useState(false);
  const native = NATIVE_MAPS_ENABLED && nativeDetected && !nativeFail;

  const webglOk = useMemo(() => {
    try {
      return webglSupported();
    } catch {
      return false;
    }
  }, []);

  const locate = () => {
    if (position) {
      setLocateTarget(position);
      return;
    }
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocateTarget({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  const onRoute = !!route && route.coords.length > 1;

  const progress = useMemo(
    () => (onRoute && position ? routeProgress(route!, position) : null),
    [onRoute, route, position]
  );

  const nextStep = progress?.nextStep ?? route?.steps[0] ?? null;
  const laterStep = onRoute && progress && route ? route.steps[progress.passedCount + 1] ?? null : null;
  const offRoute = !!progress && progress.offRouteM > 140;
  const remainingM = progress?.remainingM ?? route?.distanceM ?? 0;

  const currentStreet = onRoute && progress ? streetAt(route!, progress.nearestIdx) : "";

  const spd = speedKmh > 4 ? speedKmh : 15;
  const etaMin = remainingM > 0 ? Math.max(1, Math.round((remainingM / 1000 / spd) * 60)) : 0;
  const arrivalClock = useMemo(
    () => new Date(Date.now() + etaMin * 60000).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    [etaMin]
  );

  // ---- Reporte rápido de incidencias (botón amarillo) ----
  // En el APK la llamada va al backend de la web (apiUrl); sin backend
  // configurado, el reporte se guarda local en el dispositivo.
  const reportIncident = async (type: IncidentTypeId) => {
    if (!position) {
      setStatus("Aún sin GPS: no podemos fijar la ubicación del reporte.");
      setReportOpen(false);
      setTimeout(() => setStatus(null), 4000);
      return;
    }
    setReportOpen(false);
    const payload = { type, lat: position.lat, lon: position.lon };
    const guardarLocal = () => {
      const local: IncidentItem = {
        id: crypto.randomUUID(),
        ...payload,
        note: null,
        createdAt: new Date().toISOString(),
        username: "tú (local)",
        authorPin: userPin ?? DEFAULT_PIN,
        mine: true,
        localOnly: true,
        confirmCount: 0,
        resolvedCount: 0,
        lastConfirmAt: null,
      };
      addIncident(local);
      saveLocalIncidents([local, ...loadLocalIncidents()]);
      setStatus("Sin conexión: reporte guardado en este dispositivo.");
    };
    const url = apiUrl("/api/incidents");
    if (!url) {
      guardarLocal();
      setTimeout(() => setStatus(null), 5000);
      return;
    }
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = (await r.json()) as { incident?: IncidentItem; error?: string };
      if (!r.ok || !d.incident) throw new Error(d.error ?? "error");
      addIncident(d.incident);
      setStatus("Incidencia reportada ✓ visible para toda la comunidad");
    } catch {
      guardarLocal();
    }
    setTimeout(() => setStatus(null), 5000);
  };

  // ---- ramas de render: NATIVO (MapLibre Native) o WEB (MapLibre GL JS) ----
  if (native) {
    return (
      <div className="flex flex-col gap-1.5">
        {/* Banner de maniobra ENCIMA del lienzo nativo */}
        {onRoute && nextStep && (
          <ManeuverBanner
            className="rounded-xl border border-border bg-background/95 px-3 py-2 flex items-center gap-3"
            nextStep={nextStep}
            distM={progress?.distToNextStepM ?? nextStep.distM}
            destName={dest?.name ?? "Destino"}
            offRoute={offRoute}
            laterStep={laterStep}
          />
        )}

        {/* SOLO el lienzo nativo dentro de la ventana: sin HTML encima */}
        <div className={`relative rounded-xl overflow-hidden border border-border shrink-0 ${onRoute ? heightRouteClass : heightClass}`}>
          <NativeMapCanvas
            id="minimap"
            mode="nav"
            position={position}
            heading={heading}
            track={track}
            accuracyM={accuracyM}
            onRoute={onRoute}
            route={onRoute ? route : null}
            nearestIdx={progress ? progress.nearestIdx : null}
            remainingM={remainingM}
            nextStep={nextStep}
            dest={dest ? dest.position : null}
            userPin={userPin}
            incidents={incidents}
            locateTarget={locateTarget}
            onUnavailable={() => setNativeFail(true)}
          />
        </div>

        {/* Estado + leyenda + controles (debajo del lienzo) */}
        <div className="flex items-center gap-2 flex-wrap">
          {nav.loading && (
            <span className="rounded-full bg-background/90 border border-sky-700 px-2.5 py-1 text-[10px] font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
              Calculando ruta…
            </span>
          )}
          {onRoute && !nav.loading && <LegendChip className="rounded-md bg-background/90 border border-border px-2 py-1 flex items-center gap-2" route={route} />}
          <Controls
            className="ml-auto flex gap-1.5"
            onLocate={locate}
            hasDest={!!dest}
            onClear={() => nav.setDestination(null)}
          />
        </div>

        {reportOpen && <ReportSheet className="rounded-xl bg-background/95 border border-border shadow-2xl p-3" hasPosition={!!position} onType={reportIncident} onClose={() => setReportOpen(false)} />}
        {status && <StatusNote className="rounded-lg bg-card/95 border border-border px-3 py-2 text-[11px] text-foreground" text={status} />}

        <BottomBar
          className="rounded-xl border border-border bg-background/95 px-2.5 py-2 flex items-center gap-2.5"
          onRoute={onRoute}
          etaMin={etaMin}
          arrivalClock={arrivalClock}
          remainingM={remainingM}
          dest={dest}
          onSetDest={nav.setDestination}
          onReport={() => setReportOpen((v) => !v)}
          onOpenMap={onOpenMap}
        />
      </div>
    );
  }

  return (
    <div className={`relative rounded-xl overflow-hidden border border-border z-0 c30-minimap ${onRoute ? heightRouteClass : heightClass}`}>
      {webglOk && !isNativeApp() ? (
        <NavCanvas
          position={position}
          heading={heading}
          track={track}
          onRoute={onRoute}
          route={onRoute ? route : null}
          nearestIdx={progress ? progress.nearestIdx : null}
          offRoute={offRoute}
          remainingM={remainingM}
          nextStep={nextStep}
          dest={dest ? dest.position : null}
          userPin={userPin}
          incidents={incidents}
          locateTarget={locateTarget}
        />
      ) : (
        /* WebView del APK (o navegador sin WebGL): Leaflet ráster, sin WebGL */
        <LeafletNav
          position={position}
          heading={heading}
          track={track}
          accuracyM={accuracyM}
          onRoute={onRoute}
          route={onRoute ? route : null}
          dest={dest ? { name: dest.name, position: dest.position } : null}
          userPin={userPin}
          locateTarget={locateTarget}
        />
      )}

      {/* ===== Banner de maniobra (modo ruta), estilo Waze ===== */}
      {onRoute && nextStep && (
        <ManeuverBanner
          className="absolute top-0 inset-x-0 z-[500] bg-background/95 border-b border-border px-3 pt-1.5 pb-2 flex items-center gap-3 pointer-events-none"
          nextStep={nextStep}
          distM={progress?.distToNextStepM ?? nextStep.distM}
          destName={dest?.name ?? "Destino"}
          offRoute={offRoute}
          laterStep={laterStep}
        />
      )}

      {/* Estado de cálculo de ruta */}
      {nav.loading && (
        <div className="absolute top-2 left-2 z-[520] rounded-full bg-background/90 border border-sky-700 px-2.5 py-1 text-[10px] font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-1.5 pointer-events-none">
          <span className="inline-block h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
          Calculando ruta…
        </div>
      )}

      {/* Leyenda compacta de la ruta (solo modo ruta) */}
      {onRoute && !nav.loading && (
        <LegendChip
          className="absolute left-2 top-[92px] z-[500] rounded-md bg-background/90 border border-border px-2 py-1 flex items-center gap-2 pointer-events-none"
          route={route}
        />
      )}

      {/* Píldora con la calle actual sobre el pin (modo ruta) */}
      {onRoute && currentStreet && !offRoute && !(progress && progress.remainingM < ARRIVAL_M) && (
        <div className="absolute bottom-[108px] inset-x-0 z-[500] flex justify-center pointer-events-none">
          <span className="rounded-full bg-zinc-100 text-zinc-900 text-[11px] font-semibold px-3 py-1 shadow-lg max-w-[70%] truncate">
            {currentStreet}
          </span>
        </div>
      )}

      {/* Controles flotantes */}
      <Controls
        className="absolute top-2 right-2 z-[500] flex flex-col gap-1.5"
        onLocate={locate}
        hasDest={!!dest}
        onClear={() => nav.setDestination(null)}
      />

      {/* ===== Barra inferior tipo Waze - SIN velocímetro ===== */}
      <BottomBar
        className="absolute bottom-0 inset-x-0 z-[500] bg-background/95 border-t border-border px-2.5 py-2 flex items-center gap-2.5"
        onRoute={onRoute}
        etaMin={etaMin}
        arrivalClock={arrivalClock}
        remainingM={remainingM}
        dest={dest}
        onSetDest={nav.setDestination}
        onReport={() => setReportOpen((v) => !v)}
        onOpenMap={onOpenMap}
      />

      {/* Hoja de reporte rápido */}
      {reportOpen && (
        <ReportSheet
          className="absolute bottom-[60px] inset-x-2 z-[650] rounded-xl bg-background/95 border border-border shadow-2xl p-3"
          hasPosition={!!position}
          onType={reportIncident}
          onClose={() => setReportOpen(false)}
        />
      )}

      {/* Confirmación / avisos */}
      {status && <StatusNote className="absolute bottom-[60px] inset-x-3 z-[700] rounded-lg bg-card/95 border border-border px-3 py-2 text-[11px] text-foreground" text={status} />}
    </div>
  );
}
