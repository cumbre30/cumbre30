"use client";

// ============================================================
// Minimapa del velocímetro, DISEÑO TIPO WAZE (referencia foto):
// · CÁMARA DE NAVEGACIÓN 3D: el mapa gira al rumbo (avance = arriba)
//   y se inclina en perspectiva (tilt CSS) como Waze — nunca se ve
//   "desde arriba". Los pines contra-rota para verse de pie.
// · Banner negro superior: flecha de maniobra grande + metros +
//   nombre de la calle en celeste (próximo giro), y la maniobra
//   siguiente en pequeño al costado.
// · Ruta trazada COMPLETA de inicio a fin, distinguiendo los
//   tramos de CICLOVÍA (violeta) de las VÍAS COMPARTIDAS (blanco).
// · Píldora con la calle actual sobre el pin, como Waze.
// · Barra inferior: hora de llegada con minutos y kilómetros
//   restantes (o selector "Ir a…") y botón AMARILLO para reportar
//   incidencias. SIN velocímetro: el dato de velocidad vive en el
//   velocímetro principal, fuera del mapa.
// · El pin de posición es el elegido por el usuario en Premios
//   (o la flecha clásica por defecto).
// · Sin ruta: mismo look de navegación siguiendo la posición, con
//   parque, zonas de riesgo, porteras, incidencias y recorrido.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "@/lib/leaflet-rotate-setup"; // define window.L antes del plugin
import "leaflet-rotate";
import L from "leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { Crosshair, Flag, Plus, Route as RouteIcon, TriangleAlert, X } from "lucide-react";
import { GATES, NAV_DESTINATIONS, PARK_POLYGON, RISK_ZONES, type LatLng } from "@/lib/park";
import { DEFAULT_PIN } from "@/lib/pins";
import { flagIcon, miniIncidentIcon, stepBadgeIcon, userPinIcon } from "@/lib/mapIcons";
import { groupSegments, pointAhead, routeProgress, streetAt, streetOfStep } from "@/lib/routing";
import { INCIDENT_TYPES, type IncidentTypeId } from "@/lib/incidents";
import { addIncident, loadLocalIncidents, saveLocalIncidents, useIncidentFeed, type IncidentItem } from "@/hooks/useIncidentFeed";
import type { NavEngine } from "@/hooks/useNavEngine";
import type { RouteStep } from "@/lib/routing";

const PARK_CENTER: [number, number] = [-33.408, -70.636];
const PARK_CENTER_OBJ: LatLng = { lat: PARK_CENTER[0], lon: PARK_CENTER[1] };

/** El contenedor interno del mapa es más alto que la ventana visible
 *  (135%) para que Leaflet cargue teselas más allá del horizonte del
 *  tilt 3D. El centro del mapa queda a ~32% de la vista; con estos
 *  metros de anticipación el pin cae en el tercio inferior, como Waze. */
const LOOKAHEAD_NAV_M = 100; // modo ruta
const LOOKAHEAD_FREE_M = 45; // modo libre
/** A partir de esta distancia al destino, zoom de llegada. */
const ARRIVAL_M = 150;
const NAV_ZOOM = 17;
const ARRIVAL_ZOOM = 18;

/** Colores de la ruta: ciclovía violeta (Waze) · vía compartida blanca. */
const COLOR_CICLO = "#a855f7";
const COLOR_VIA = "#f4f4f5";
const COLOR_CASING = "#09090b";

type Props = {
  position: LatLng | null;
  heading: number | null;
  track: LatLng[];
  accuracyM: number | null;
  userPin?: string;
  nav: NavEngine;
  speedKmh?: number;
};

/** Convierte cualquier ángulo a [0, 360). */
const wrap360 = (deg: number) => ((deg % 360) + 360) % 360;

const fmtKmM = (m: number) => (m >= 950 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(m / 10) * 10)} m`);

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
  // straight / start
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <path d="M48 90 L48 34" stroke="currentColor" strokeWidth="13" strokeLinecap="round" fill="none" />
      <path d="M48 8 L70 42 L26 42 Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Cámara de navegación (ambos modos): gira el mapa al rumbo
 * (avance = arriba) y centra un punto más adelante, dejando el pin
 * abajo como en una app de navegación. Con tilt 3D (clase c30-tilt)
 * el resultado es la vista perspectiva tipo Waze.
 */
function NavCamera({ position, bearing, target, zoom }: { position: LatLng | null; bearing: number; target: LatLng; zoom: number }) {
  const map = useMap();
  const init = useRef(false);
  useEffect(() => {
    if (!position) return;
    map.invalidateSize();
    const b = wrap360(bearing);
    if (!init.current) {
      init.current = true;
      map.setBearing(b);
      map.setView([target.lat, target.lon], zoom, { animate: false });
      return;
    }
    map.setBearing(b, { animate: true, duration: 0.4 });
    map.setView([target.lat, target.lon], zoom, { animate: true, duration: 0.6 });
  }, [position, map]); // target/zoom/derivados del mismo tick de posición
  return null;
}

/** Mantiente el tamaño interno de Leaflet sincronizado con el DOM:
 *  el minimapa cambia de alto al activarse la ruta (h-52 → h-80) y su
 *  contenedor interno es 135% más alto (por el tilt 3D). Sin esto, la
 *  cámara calcula con un tamaño viejo y la ruta/cámara se ven mal. */
function AutoInvalidate() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/** Ajusta la vista a la ruta completa cuando aún no hay posición.
 *  El contenedor interno es 135% más alto que la ventana visible (por el
 *  tilt 3D), así que compensa la franja superior recortada para que la
 *  ruta completa —del inicio al fin— quede dentro de la zona visible. */
function FitRoute({ coords }: { coords: LatLng[] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!coords || coords.length < 2) return;
    map.invalidateSize();
    if (map.getBearing && map.getBearing() !== 0) map.setBearing(0);
    const tall = map.getContainer().clientHeight || 432;
    const hiddenTop = Math.round(tall - tall / 1.35); // franja bajo el banner que no se ve
    const bounds = L.latLngBounds(coords.map((c) => [c.lat, c.lon] as [number, number]));
    map.fitBounds(bounds, { paddingTopLeft: [24, hiddenTop + 8], paddingBottomRight: [24, 112] });
  }, [coords, map]);
  return null;
}

/** Desplaza un punto `distM` metros según un rumbo (para adelantar la
 *  cámara en modo libre y dejar el pin abajo, estilo navegación). */
function offsetAlong(p: LatLng, headingDeg: number, distM: number): LatLng {
  const r = (headingDeg * Math.PI) / 180;
  const mPerDegLat = 111_320;
  const mPerDegLon = 111_320 * Math.cos((p.lat * Math.PI) / 180);
  return {
    lat: p.lat + (Math.cos(r) * distM) / mPerDegLat,
    lon: p.lon + (Math.sin(r) * distM) / mPerDegLon,
  };
}

function ClickPick({ enabled, onPick }: { enabled: boolean; onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      if (enabled) onPick({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

export default function MiniMap({ position, heading, track, accuracyM, userPin, nav, speedKmh = 0 }: Props) {
  const incidents = useIncidentFeed();
  const [pickMode, setPickMode] = useState(false);
  const [locateTarget, setLocateTarget] = useState<LatLng | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const route = nav.route;
  const dest = nav.dest;

  const pick = (p: LatLng) => {
    nav.setDestination({ name: "Punto en el mapa", position: p });
    setPickMode(false);
  };

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

  // Progreso vivo sobre la ruta (restante + desvío)
  const progress = useMemo(
    () => (onRoute && position ? routeProgress(route!, position) : null),
    [onRoute, route, position]
  );

  const nextStep = progress?.nextStep ?? route?.steps[0] ?? null;
  const laterStep = onRoute && progress && route ? route.steps[progress.passedCount + 1] ?? null : null;
  const offRoute = !!progress && progress.offRouteM > 140;
  const remainingM = progress?.remainingM ?? route?.distanceM ?? 0;

  // Ruta COMPLETA (inicio → fin) partida por condición: recorrida (tenue) + restante (plena)
  const traveledGroups = useMemo(
    () => (onRoute && progress ? groupSegments(route!.coords, route!.flags, 0, progress.nearestIdx - 1) : []),
    [onRoute, progress, route]
  );
  const remainingGroups = useMemo(
    () => (onRoute ? groupSegments(route!.coords, route!.flags, progress ? progress.nearestIdx : 0, route!.coords.length - 2) : []),
    [onRoute, progress, route]
  );
  const remainingLine = useMemo(
    () => (onRoute ? route!.coords.slice(progress ? progress.nearestIdx : 0).map((c) => [c.lat, c.lon] as [number, number]) : []),
    [onRoute, progress, route]
  );

  // Calle actual (píldora sobre el pin)
  const currentStreet = onRoute && progress ? streetAt(route!, progress.nearestIdx) : "";

  // ETA vivo: con la velocidad actual (toma 15 km/h como referencia base)
  const spd = speedKmh > 4 ? speedKmh : 15;
  const etaMin = remainingM > 0 ? Math.max(1, Math.round((remainingM / 1000) / spd * 60)) : 0;
  const arrivalClock = useMemo(
    () => new Date(Date.now() + etaMin * 60000).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    [etaMin]
  );

  // ---- Reporte rápido de incidencias (botón amarillo) ----
  const reportIncident = async (type: IncidentTypeId) => {
    if (!position) {
      setStatus("Aún sin GPS: no podemos fijar la ubicación del reporte.");
      setReportOpen(false);
      setTimeout(() => setStatus(null), 4000);
      return;
    }
    setReportOpen(false);
    const payload = { type, lat: position.lat, lon: position.lon };
    try {
      const r = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = (await r.json()) as { incident?: IncidentItem; error?: string };
      if (!r.ok || !d.incident) throw new Error(d.error ?? "error");
      addIncident(d.incident);
      setStatus("Incidencia reportada ✓ visible para toda la comunidad");
    } catch {
      const local: IncidentItem = {
        id: crypto.randomUUID(),
        ...payload,
        note: null,
        createdAt: new Date().toISOString(),
        username: "tú (local)",
        authorPin: userPin ?? DEFAULT_PIN,
        mine: true,
        localOnly: true,
      };
      addIncident(local);
      saveLocalIncidents([local, ...loadLocalIncidents()]);
      setStatus("Sin conexión: reporte guardado en este dispositivo.");
    }
    setTimeout(() => setStatus(null), 5000);
  };

  // ----- Cámara de navegación 3D (rumbo = arriba, pin abajo) -----
  const bearing = heading !== null ? wrap360(-heading) : 0;
  const camTarget: LatLng = useMemo(() => {
    if (!position) return PARK_CENTER_OBJ;
    if (onRoute && !offRoute && progress && progress.remainingM >= ARRIVAL_M) {
      return pointAhead(route!.coords, progress.nearestIdx, LOOKAHEAD_NAV_M);
    }
    // Sin ruta (o llegada/desvío): adelanta la cámara hacia el rumbo
    if (heading !== null) return offsetAlong(position, heading, onRoute ? LOOKAHEAD_NAV_M : LOOKAHEAD_FREE_M);
    return position;
  }, [onRoute, position, offRoute, progress, route, heading]);
  const camZoom = onRoute && progress && progress.remainingM < ARRIVAL_M ? ARRIVAL_ZOOM : NAV_ZOOM;

  return (
    <div className={`relative rounded-xl overflow-hidden border border-zinc-800 z-0 c30-minimap ${onRoute ? "h-80" : "h-52 sm:h-56"} ${pickMode ? "" : "c30-tilt"}`}>
      {/* Contenedor interno más alto (135%): Leaflet carga teselas más
          allá del horizonte que genera la perspectiva 3D */}
      <div className="absolute inset-x-0 bottom-0 h-[135%]">
      <MapContainer
        center={position ? [position.lat, position.lon] : PARK_CENTER}
        zoom={position ? 17 : 13}
        zoomControl={false}
        attributionControl={false}
        rotate
        bearing={0}
        rotateControl={false}
        touchRotate={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        className={`map-dark h-full w-full bg-zinc-950 ${pickMode ? "cursor-crosshair" : ""}`}
      >
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} keepBuffer={4} />

        {!onRoute && (
          <>
            <Polygon
              positions={PARK_POLYGON.map((p) => [p.lat, p.lon])}
              pathOptions={{ color: "#34d399", weight: 1.5, fillColor: "#10b981", fillOpacity: 0.07 }}
              interactive={false}
            />
            {RISK_ZONES.map((z) => (
              <Circle
                key={z.id}
                center={[z.position.lat, z.position.lon]}
                radius={z.radiusM}
                pathOptions={{ color: "#f59e0b", weight: 1, fillColor: "#f59e0b", fillOpacity: 0.13 }}
                interactive={false}
              />
            ))}
            {GATES.map((g) => (
              <CircleMarker
                key={g.id}
                center={[g.position.lat, g.position.lon]}
                radius={5}
                pathOptions={{ color: "#2dd4bf", weight: 1.5, fillColor: "#0f766e", fillOpacity: 0.9 }}
                interactive={false}
              />
            ))}
            {track.length > 1 && (
              <Polyline positions={track.map((p) => [p.lat, p.lon])} pathOptions={{ color: "#a3e635", weight: 3.5, opacity: 0.9 }} interactive={false} />
            )}
          </>
        )}

        {/* Incidencias de la comunidad: visibles en ambos modos */}
        {incidents.map((inc) => (
          <Marker key={inc.id} position={[inc.lat, inc.lon]} icon={miniIncidentIcon(inc.type)} interactive={false} />
        ))}

        {onRoute && (
          <>
            {/* base oscura bajo la ruta activa para que destaque */}
            {remainingLine.length > 1 && (
              <Polyline positions={remainingLine} pathOptions={{ color: COLOR_CASING, weight: 10, opacity: 0.85 }} interactive={false} />
            )}
            {/* recorrido ya hecho: mismos colores, tenue (ruta completa a la vista) */}
            {traveledGroups.map((g, i) => (
              <Polyline
                key={`t${i}`}
                positions={g.coords.map((c) => [c.lat, c.lon] as [number, number])}
                pathOptions={{ color: g.ciclovia ? COLOR_CICLO : COLOR_VIA, weight: g.ciclovia ? 5 : 4, opacity: 0.32 }}
                interactive={false}
              />
            ))}
            {/* tramo restante: violeta = ciclovía · blanco = vía compartida */}
            {remainingGroups.map((g, i) => (
              <Polyline
                key={`r${i}`}
                positions={g.coords.map((c) => [c.lat, c.lon] as [number, number])}
                pathOptions={{ color: g.ciclovia ? COLOR_CICLO : COLOR_VIA, weight: g.ciclovia ? 7 : 5.5, opacity: 0.98, lineCap: "round", lineJoin: "round" }}
                interactive={false}
              />
            ))}
            {nextStep && nextStep.icon !== "end" && (
              <Marker position={[nextStep.point.lat, nextStep.point.lon]} icon={stepBadgeIcon(nextStep.icon)} interactive={false} />
            )}
            {dest && <Marker position={[dest.position.lat, dest.position.lon]} icon={flagIcon()} interactive={false} />}
          </>
        )}

        {/* Posición actual: pin elegido por el usuario o flecha por defecto */}
        {position && (
          <>
            {!onRoute && accuracyM !== null && accuracyM < 100 && (
              <Circle
                center={[position.lat, position.lon]}
                radius={accuracyM}
                pathOptions={{ color: "#ffffff", weight: 1, fillColor: "#ffffff", fillOpacity: 0.08 }}
                interactive={false}
              />
            )}
            <Marker
              position={[position.lat, position.lon]}
              icon={userPinIcon(userPin ?? DEFAULT_PIN, heading, bearing)}
              zIndexOffset={500}
            />
          </>
        )}

        {position ? (
          <NavCamera position={position} bearing={bearing} target={camTarget} zoom={camZoom} />
        ) : onRoute ? (
          <FitRoute coords={route!.coords} />
        ) : null}
        <AutoInvalidate />
        {locateTarget && !position && <FollowOnce target={locateTarget} />}
        <ClickPick enabled={pickMode} onPick={pick} />
      </MapContainer>
      </div>

      {/* ===== Banner de maniobra (modo ruta), estilo Waze ===== */}
      {onRoute && nextStep && (
        <div className="absolute top-0 inset-x-0 z-[500] bg-zinc-950/95 border-b border-zinc-800 px-3 pt-1.5 pb-2 flex items-center gap-3 pointer-events-none">
          <TurnArrow icon={nextStep.icon} className="h-14 w-14 shrink-0 text-zinc-50" />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[26px] font-bold text-zinc-50 leading-none tabular-nums">
              {nextStep.icon === "end" ? "Llegaste" : fmtKmM(progress?.distToNextStepM ?? nextStep.distM)}
            </div>
            <div className="text-lg font-bold text-sky-400 leading-tight truncate mt-0.5">
              {nextStep.icon === "end" ? dest?.name ?? "Destino" : streetOfStep(nextStep.text)}
            </div>
            {offRoute && <div className="text-[11px] text-amber-300 font-semibold mt-0.5">desviado, recalculando…</div>}
          </div>
          {laterStep && laterStep.icon !== "end" && <TurnArrow icon={laterStep.icon} className="h-7 w-7 shrink-0 mt-1 text-zinc-500" />}
        </div>
      )}

      {/* Leyenda compacta de la ruta (solo modo ruta) */}
      {onRoute && (
        <div className="absolute left-2 top-[92px] z-[500] rounded-md bg-zinc-950/90 border border-zinc-800 px-2 py-1 flex items-center gap-2 pointer-events-none">
          <span className="inline-block h-[3px] w-4 rounded-full shrink-0" style={{ background: COLOR_CICLO }} />
          <span className="text-[10px] text-zinc-300">Ciclovía {!!route?.cicloviaPct ? `${route.cicloviaPct}%` : ""}</span>
          <span className="text-[10px] text-zinc-600">·</span>
          <span className="inline-block h-[3px] w-4 rounded-full shrink-0" style={{ background: COLOR_VIA }} />
          <span className="text-[10px] text-zinc-300">Compartida</span>
        </div>
      )}

      {/* Píldora con la calle actual sobre el pin (modo ruta; se oculta
          si vas desviado o en llegada, cuando el pin vuelve al centro) */}
      {onRoute && currentStreet && !offRoute && !(progress && progress.remainingM < ARRIVAL_M) && (
        <div className="absolute bottom-[108px] inset-x-0 z-[500] flex justify-center pointer-events-none">
          <span className="rounded-full bg-zinc-100 text-zinc-900 text-[11px] font-semibold px-3 py-1 shadow-lg max-w-[70%] truncate">
            {currentStreet}
          </span>
        </div>
      )}

      {/* Controles flotantes */}
      <div className="absolute top-2 right-2 z-[500] flex flex-col gap-1.5">
        <button
          onClick={locate}
          aria-label="Localizarme"
          title="Centrar en mi ubicación"
          className="h-8 w-8 rounded-md bg-zinc-950/90 border border-zinc-700 text-zinc-100 flex items-center justify-center hover:border-emerald-500"
        >
          <Crosshair className="h-4 w-4" />
        </button>
        <button
          onClick={() => setPickMode((v) => !v)}
          aria-label="Elegir destino en el minimapa"
          title="Toca el minimapa para fijar destino"
          className={`h-8 w-8 rounded-md border flex items-center justify-center ${
            pickMode ? "bg-sky-600 border-sky-300 text-white" : "bg-zinc-950/90 border-zinc-700 text-zinc-100 hover:border-sky-500"
          }`}
        >
          <Flag className="h-4 w-4" />
        </button>
        {dest && (
          <button
            onClick={() => nav.setDestination(null)}
            aria-label="Quitar destino"
            title="Quitar la ruta"
            className="h-8 w-8 rounded-md bg-zinc-950/90 border border-zinc-700 text-zinc-100 flex items-center justify-center hover:border-red-500"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ===== Barra inferior tipo Waze — SIN velocímetro: la velocidad
          vive en el velocímetro principal, no sobre el mapa ===== */}
      <div className="absolute bottom-0 inset-x-0 z-[500] bg-zinc-950/95 border-t border-zinc-800 px-2.5 py-2 flex items-center gap-2.5">
        {onRoute ? (
          <div className="min-w-0 flex-1 text-center">
            <div className="font-mono text-xl font-bold text-zinc-50 leading-none tabular-nums">{etaMin > 0 ? arrivalClock : "—"}</div>
            <div className="text-[11px] text-zinc-400 leading-tight mt-0.5 truncate">
              {etaMin > 0 ? `${etaMin} min · ${fmtKmM(remainingM)}` : "Ruta lista"}
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1 flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5">
            <RouteIcon className="h-3.5 w-3.5 text-sky-400 shrink-0" />
            <select
              aria-label="Ir a"
              value={dest ? NAV_DESTINATIONS.find((d) => d.position === dest.position)?.id ?? "mapa" : ""}
              onChange={(e) => {
                const d = NAV_DESTINATIONS.find((x) => x.id === e.target.value);
                if (d) nav.setDestination({ name: d.name, position: d.position });
                else nav.setDestination(null);
              }}
              className="bg-transparent text-[11px] text-zinc-200 outline-none w-full min-w-0"
            >
              <option value="" className="bg-zinc-900">Ir a…</option>
              {NAV_DESTINATIONS.map((d) => (
                <option key={d.id} value={d.id} className="bg-zinc-900">{d.name}</option>
              ))}
              {dest && <option value="mapa" className="bg-zinc-900">Punto en el mapa</option>}
            </select>
          </div>
        )}

        {/* botón amarillo de reporte de incidencias */}
        <button
          onClick={() => setReportOpen((v) => !v)}
          aria-label="Reportar incidencia en mi posición"
          title="Reportar incidencia en mi posición"
          className="relative h-11 w-11 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 transition text-zinc-950 flex items-center justify-center shrink-0"
        >
          <TriangleAlert className="h-6 w-6" strokeWidth={2.4} />
          <Plus className="absolute bottom-0 right-0.5 h-3.5 w-3.5" strokeWidth={3.5} />
        </button>
      </div>

      {/* Hoja de reporte rápido */}
      {reportOpen && (
        <div className="absolute bottom-[60px] inset-x-2 z-[650] rounded-xl bg-zinc-950/95 border border-zinc-700 shadow-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-100">Reportar incidencia {position ? "en tu posición" : "(sin GPS aún)"}</span>
            <button onClick={() => setReportOpen(false)} aria-label="Cerrar reporte" className="text-zinc-400 hover:text-zinc-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {INCIDENT_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => reportIncident(t.id)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-left text-[11px] text-zinc-200 hover:border-zinc-500"
              >
                <span aria-hidden>{t.emoji}</span>
                <span className="truncate">{t.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-zinc-500 mt-2">Se registra con fecha y hora, y aparece en el mapa compartido.</p>
        </div>
      )}

      {/* Confirmación / avisos */}
      {status && (
        <div className="absolute bottom-[60px] inset-x-3 z-[700] rounded-lg bg-zinc-900/95 border border-zinc-700 px-3 py-2 text-[11px] text-zinc-100 pointer-events-none shadow-xl">
          {status}
        </div>
      )}

      {/* Aviso de modo elección de destino */}
      {pickMode && (
        <div className={`absolute inset-x-2 z-[700] rounded-md bg-sky-950/95 border border-sky-600 px-2.5 py-1.5 text-[11px] text-sky-100 flex items-center justify-between ${onRoute ? "top-[86px]" : "top-2"}`}>
          <span>Toca el minimapa para fijar tu destino</span>
          <button onClick={() => setPickMode(false)} aria-label="Cancelar elección" className="text-sky-300 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Vuela a un punto una sola vez (localización sin ride activo). */
function FollowOnce({ target }: { target: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 16), { duration: 0.8 });
  }, [target, map]);
  return null;
}
