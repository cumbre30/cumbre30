"use client";

// ============================================================
// Minimapa del velocímetro (estilo ciclócomputador):
// · Con ruta: solo muestra el camino a seguir, con el punto del
//   próximo giro, el destino y la distancia restante.
// · Sin ruta: mapa seguido de la posición con parque, zonas de
//   riesgo, incidencias y recorrido — como un ciclócomputador.
// Integra controles: localizarme, fijar destino e «Ir a…».
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { Crosshair, Flag, Route as RouteIcon, X } from "lucide-react";
import { GATES, NAV_DESTINATIONS, PARK_POLYGON, RISK_ZONES, type LatLng } from "@/lib/park";
import { DEFAULT_PIN } from "@/lib/pins";
import { flagIcon, miniIncidentIcon, stepDotIcon, userPinIcon } from "@/lib/mapIcons";
import { routeProgress } from "@/lib/routing";
import { useIncidentFeed } from "@/hooks/useIncidentFeed";
import type { NavEngine } from "@/hooks/useNavEngine";

const PARK_CENTER: [number, number] = [-33.408, -70.636];

type Props = {
  position: LatLng | null;
  heading: number | null;
  track: LatLng[];
  accuracyM: number | null;
  userPin?: string;
  nav: NavEngine;
};

/** Centra y sigue la posición en modo libre (zoom tipo ciclócomputador). */
function FollowFree({ position }: { position: LatLng | null }) {
  const map = useMap();
  const init = useRef(false);
  useEffect(() => {
    if (!position) return;
    if (!init.current) {
      init.current = true;
      map.setView([position.lat, position.lon], 17, { animate: false });
      return;
    }
    map.setView([position.lat, position.lon], map.getZoom(), { animate: true, duration: 0.6 });
  }, [position, map]);
  return null;
}

/** Ajusta la vista a la ruta completa cuando cambia. */
function FitRoute({ coords }: { coords: LatLng[] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!coords || coords.length < 2) return;
    const bounds = L.latLngBounds(coords.map((c) => [c.lat, c.lon] as [number, number]));
    map.fitBounds(bounds, { paddingTopLeft: [14, 44], paddingBottomRight: [14, 34] });
  }, [coords, map]);
  return null;
}

/** En modo ruta, mantiene la posición dentro del encuadre. */
function PanAlong({ position }: { position: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (!position) return;
    const inner = map.getBounds().pad(-0.18);
    if (!inner.contains([position.lat, position.lon])) {
      map.panTo([position.lat, position.lon], { animate: true, duration: 0.6 });
    }
  }, [position, map]);
  return null;
}

/** Escala métrica (referencia tipo 200 m). */
function ScaleHandler() {
  const map = useMap();
  useEffect(() => {
    const c = L.control.scale({ imperial: false, position: "bottomleft" });
    c.addTo(map);
    return () => {
      c.remove();
    };
  }, [map]);
  return null;
}

function ClickPick({ enabled, onPick }: { enabled: boolean; onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      if (enabled) onPick({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

export default function MiniMap({ position, heading, track, accuracyM, userPin, nav }: Props) {
  const incidents = useIncidentFeed();
  const [pickMode, setPickMode] = useState(false);
  const [locateTarget, setLocateTarget] = useState<LatLng | null>(null);
  const route = nav.route;
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

  // Tramo recorrido vs restante
  const traveled = useMemo(() => {
    if (!onRoute || !progress) return null;
    return route!.coords.slice(0, progress.nearestIdx + 1);
  }, [onRoute, progress, route]);

  const remaining = useMemo(() => {
    if (!onRoute || !progress) return route?.coords ?? null;
    return route!.coords.slice(Math.max(0, progress.nearestIdx));
  }, [onRoute, progress, route]);

  const dest = nav.dest;
  const nextStep = progress?.nextStep ?? null;
  const offRoute = !!progress && progress.offRouteM > 140;

  return (
    <div className="relative rounded-xl overflow-hidden border border-zinc-800 h-52 sm:h-56 z-0">
      <MapContainer
        center={position ? [position.lat, position.lon] : PARK_CENTER}
        zoom={position ? 17 : 13}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        className={`map-dark h-full w-full bg-zinc-950 ${pickMode ? "cursor-crosshair" : ""}`}
      >
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />

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
            {incidents.map((inc) => (
              <Marker key={inc.id} position={[inc.lat, inc.lon]} icon={miniIncidentIcon(inc.type)} interactive={false} />
            ))}
            {track.length > 1 && (
              <Polyline positions={track.map((p) => [p.lat, p.lon])} pathOptions={{ color: "#a3e635", weight: 3.5, opacity: 0.9 }} interactive={false} />
            )}
          </>
        )}

        {onRoute && (
          <>
            {traveled && traveled.length > 1 && (
              <Polyline positions={traveled.map((p) => [p.lat, p.lon])} pathOptions={{ color: "#64748b", weight: 6, opacity: 0.8 }} interactive={false} />
            )}
            {remaining && remaining.length > 1 && (
              <Polyline positions={remaining.map((p) => [p.lat, p.lon])} pathOptions={{ color: "#38bdf8", weight: 6, opacity: 0.95 }} interactive={false} />
            )}
            {nextStep && nextStep.icon !== "end" && (
              <Marker position={[nextStep.point.lat, nextStep.point.lon]} icon={stepDotIcon()} interactive={false} />
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
            <Marker position={[position.lat, position.lon]} icon={userPinIcon(userPin ?? DEFAULT_PIN, heading)} zIndexOffset={500} />
          </>
        )}

        <ScaleHandler />
        {!onRoute ? <FollowFree position={position} /> : <FitRoute coords={onRoute ? route!.coords : null} />}
        {onRoute && <PanAlong position={position} />}
        {locateTarget && !position && <FollowOnce target={locateTarget} />}
        <ClickPick enabled={pickMode} onPick={pick} />
      </MapContainer>

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

      {/* Chip restante / desvío (modo ruta) */}
      {onRoute && progress && (
        <div className="absolute top-2 left-2 z-[500] rounded-md bg-zinc-950/90 border border-sky-800/80 px-2 py-1 text-[11px] font-semibold text-sky-200 flex items-center gap-1.5 pointer-events-none">
          🏁 {progress.remainingM >= 950 ? `${(progress.remainingM / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(progress.remainingM / 10) * 10)} m`}
          {offRoute && <span className="text-amber-300">· desviado</span>}
        </div>
      )}

      {/* Selector «Ir a…» */}
      <div className="absolute bottom-2 right-2 z-[500] rounded-md bg-zinc-950/90 border border-zinc-700 px-1.5 py-1 flex items-center gap-1.5 max-w-[62%]">
        <RouteIcon className="h-3.5 w-3.5 text-sky-400 shrink-0" />
        <select
          aria-label="Ir a"
          value={dest ? NAV_DESTINATIONS.find((d) => d.position === dest.position)?.id ?? "mapa" : ""}
          onChange={(e) => {
            const d = NAV_DESTINATIONS.find((x) => x.id === e.target.value);
            if (d) nav.setDestination({ name: d.name, position: d.position });
            else nav.setDestination(null);
          }}
          className="bg-transparent text-[11px] text-zinc-200 outline-none max-w-[150px]"
        >
          <option value="" className="bg-zinc-900">
            Ir a…
          </option>
          {NAV_DESTINATIONS.map((d) => (
            <option key={d.id} value={d.id} className="bg-zinc-900">
              {d.name}
            </option>
          ))}
          {dest && <option value="mapa" className="bg-zinc-900">Punto en el mapa</option>}
        </select>
      </div>

      {/* Aviso de modo elección de destino */}
      {pickMode && (
        <div className="absolute top-2 inset-x-2 z-[600] rounded-md bg-sky-950/95 border border-sky-600 px-2.5 py-1.5 text-[11px] text-sky-100 flex items-center justify-between">
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
