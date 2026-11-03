"use client";

// ============================================================
// Lienzo de navegación con Leaflet (tiles RÁSTER) para el
// WebView del APK. El WebView del dispositivo no renderiza
// MapLibre (ni Native bajo el WebView, ni GL JS: WebGL caído),
// así que priorizamos funcionamiento: Leaflet clásico con
// <img> de OpenStreetMap — funciona en cualquier equipo.
//
// Sustituye al lienzo 3D de MapLibre GL JS (NavCanvas) en la
// app nativa; en el navegador se sigue mostrando el 3D.
// Misma información: ruta segmentada (violeta ciclovía / blanca
// vía compartida), destino, recorrido, precisión y pin personal.
// Sin rotación de mapa (Leaflet no rota): el pin apunta al rumbo.
// ============================================================

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { LatLng } from "@/lib/park";
import type { NavRoute } from "@/lib/routing";
import { groupSegments } from "@/lib/routing";
import { DEFAULT_PIN } from "@/lib/pins";
import { flagIcon, userPinIcon } from "@/lib/mapIcons";

type Props = {
  position: LatLng | null;
  heading: number | null;
  track: LatLng[];
  accuracyM: number | null;
  onRoute: boolean;
  route: NavRoute | null;
  dest: { name: string; position: LatLng } | null;
  userPin?: string;
  locateTarget: LatLng | null;
};

/** Seguimiento Waze: recentra en cada fix salvo que el usuario
 *  haya arrastrado el mapa (lo reactiva el botón localizarme). */
function Follow({
  position,
  locateTarget,
}: {
  position: LatLng | null;
  locateTarget: LatLng | null;
}) {
  const map = useMap();
  const skip = useRef(false);
  const zoomedOnce = useRef(false);

  useEffect(() => {
    const onDrag = () => { skip.current = true; };
    map.on("dragstart", onDrag);
    return () => { map.off("dragstart", onDrag); };
  }, [map]);

  useEffect(() => {
    if (!position || skip.current) return;
    const zoom = zoomedOnce.current ? map.getZoom() : 16;
    zoomedOnce.current = true;
    map.setView([position.lat, position.lon], zoom, { animate: true, duration: 0.5 });
  }, [position, map]);

  useEffect(() => {
    if (!locateTarget) return;
    skip.current = false;
    map.flyTo([locateTarget.lat, locateTarget.lon], Math.max(map.getZoom(), 16), { duration: 0.8 });
  }, [locateTarget, map]);

  return null;
}


export default function LeafletNav({
  position,
  heading,
  track,
  accuracyM,
  onRoute,
  route,
  dest,
  userPin,
  locateTarget,
}: Props) {
  const center = position ?? { lat: -33.408, lon: -70.636 };

  return (
    <MapContainer
      center={[center.lat, center.lon]}
      zoom={16}
      zoomControl={false}
      attributionControl
      className="h-full w-full"
      style={{ background: "#09090b" }}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />

      {/* Ruta activa: casing oscuro + segmentos por condición */}
      {onRoute && route && route.coords.length > 1 && (
        <>
          <Polyline
            positions={route.coords.map((p) => [p.lat, p.lon] as [number, number])}
            pathOptions={{ color: "#05070a", weight: 10, opacity: 0.8 }}
            interactive={false}
          />
          {groupSegments(route.coords, route.flags, 0, route.coords.length - 2).map((g, i) => (
            <Polyline
              key={`seg-${i}`}
              positions={g.coords.map((p) => [p.lat, p.lon] as [number, number])}
              pathOptions={{
                color: g.ciclovia ? "#a855f7" : "#f4f4f5",
                weight: g.ciclovia ? 6.5 : 5.5,
                opacity: 0.98,
                lineCap: "round",
                lineJoin: "round",
              }}
              interactive={false}
            />
          ))}
          <CircleMarker
            center={[route.coords[0].lat, route.coords[0].lon]}
            radius={6}
            pathOptions={{ color: "#fafafa", weight: 2.5, fillColor: "#22c55e", fillOpacity: 1 }}
            interactive={false}
          />
        </>
      )}

      {/* Destino */}
      {dest && <Marker position={[dest.position.lat, dest.position.lon]} icon={flagIcon()} interactive={false} />}

      {/* Recorrido del ride */}
      {track.length > 1 && (
        <Polyline positions={track.map((p) => [p.lat, p.lon])} pathOptions={{ color: "#a3e635", weight: 4, opacity: 0.9 }} interactive={false} />
      )}

      {/* Posición actual: círculo de precisión + pin personal */}
      {position && (
        <>
          {accuracyM !== null && accuracyM < 100 && (
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

      <Follow position={position} locateTarget={locateTarget} />
    </MapContainer>
  );
}
