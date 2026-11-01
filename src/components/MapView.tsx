"use client";

import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Polygon, Circle, CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import { GATES, PARK_POLYGON, RISK_ZONES } from "@/lib/park";
import type { LatLng } from "@/lib/park";

function Recenter({ position }: { position: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (!position) return;
    const center = map.getCenter();
    const d = Math.abs(center.lat - position.lat) + Math.abs(center.lng - position.lon);
    // Sigue al ciclista solo si se aleja mucho del encuadre
    if (d > 0.01) map.setView([position.lat, position.lon], Math.max(map.getZoom(), 15), { animate: true });
  }, [position, map]);
  return null;
}

type Props = {
  track: LatLng[];
  position: LatLng | null;
  accuracyM: number | null;
};

export default function MapView({ track, position, accuracyM }: Props) {
  const last = track.length > 0 ? track[track.length - 1] : null;
  const center = position ?? last ?? { lat: -33.408, lon: -70.636 };

  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800 h-[62vh] min-h-[420px] relative z-0">
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={14}
        scrollWheelZoom
        className="map-dark h-full w-full bg-zinc-950"
        attributionControl
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />

        {/* Límite del Parque Metropolitano */}
        <Polygon
          positions={PARK_POLYGON.map((p) => [p.lat, p.lon])}
          pathOptions={{ color: "#34d399", weight: 2, fillColor: "#10b981", fillOpacity: 0.08 }}
        />

        {/* Zonas de riesgo */}
        {RISK_ZONES.map((z) => (
          <Circle
            key={z.id}
            center={[z.position.lat, z.position.lon]}
            radius={z.radiusM}
            pathOptions={{ color: "#f59e0b", weight: 1.5, fillColor: "#f59e0b", fillOpacity: 0.15 }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <span className="text-xs font-medium">⚠ {z.name}</span>
            </Tooltip>
          </Circle>
        ))}

        {/* Accesos con fiscalización */}
        {GATES.map((g) => (
          <CircleMarker
            key={g.id}
            center={[g.position.lat, g.position.lon]}
            radius={7}
            pathOptions={{ color: "#2dd4bf", weight: 2, fillColor: "#0f766e", fillOpacity: 0.9 }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <span className="text-xs font-medium">🚪 {g.name}</span>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Recorrido */}
        {track.length > 1 && (
          <Polyline positions={track.map((p) => [p.lat, p.lon])} pathOptions={{ color: "#a3e635", weight: 4, opacity: 0.9 }} />
        )}

        {/* Posición actual */}
        {position && (
          <>
            {accuracyM !== null && accuracyM < 100 && (
              <Circle center={[position.lat, position.lon]} radius={accuracyM} pathOptions={{ color: "#ffffff", weight: 1, fillColor: "#ffffff", fillOpacity: 0.08 }} />
            )}
            <CircleMarker center={[position.lat, position.lon]} radius={8} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#a3e635", fillOpacity: 1 }} />
          </>
        )}

        <Recenter position={position} />
      </MapContainer>

      {/* Leyenda */}
      <div className="absolute bottom-3 left-3 z-[500] rounded-lg bg-zinc-950/90 border border-zinc-800 px-3 py-2 text-[11px] text-zinc-300 space-y-1 pointer-events-none">
        <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-emerald-500/50 border border-emerald-400" /> Parque Metropolitano · límite 30</div>
        <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-amber-500/50 border border-amber-400" /> Zona de riesgo</div>
        <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-lime-400" /> Tu recorrido</div>
      </div>
    </div>
  );
}

export { L };
