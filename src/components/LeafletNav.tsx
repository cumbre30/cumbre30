"use client";

// ============================================================
// Lienzo de navegación con Leaflet (tiles RÁSTER) para el
// WebView del APK. El WebView del dispositivo no renderiza
// MapLibre (ni Native bajo el WebView, ni GL JS: WebGL caído),
// así que priorizamos funcionamiento: Leaflet clásico con
// <img> de OpenStreetMap - funciona en cualquier equipo.
//
// v1.12.9 — cámara estilo Waze:
//  · En navegación el mapa queda BLOQUEADO AL RUMBO de la ruta:
//    la dirección de avance apunta siempre hacia arriba (el
//    «norte» de la vista es el rumbo). En los giros ROTAN el
//    mapa y las tiles; el pin se mantiene fijo y centrado.
//  · Seguimiento pegado: recentra en cada fix con animación
//    continua (~duración del intervalo entre fixes), sin saltos.
//  · Botón brújula: alterna entre «rumbo» (girado) y «norte»
//    (norte arriba). Fuera de navegación: norte arriba.
//  · Pin: puck plano centrado sobre la posición (snapped a la
//    calzada por navSnap) con flecha al rumbo — la burbuja del
//    pin personal queda para el mapa grande; el puck no tapa
//    edificios ni veredas al norte de la posición.
//
// Leaflet no rota de forma nativa: la rotación es un wrapper
// CSS (150% para no mostrar esquinas vacías) y los iconos se
// contra-rotan (userPinIcon/flagIcon con mapBearing).
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
import { groupSegments, type NavRoute } from "@/lib/routing";
import { useCamaraRumbo, type ModoCamara } from "@/hooks/useCamaraRumbo";
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

/** Seguimiento Waze: recentra en cada fix con animación continua
 *  (duración ≈ intervalo entre fixes → el pin queda «pegado» al
 *  centro, sin saltos). Si el usuario arrastró (modo norte) se
 *  pausa; lo reactiva el botón localizarme. */
function Follow({
  position,
  onRoute,
  locateTarget,
  modo,
}: {
  position: LatLng | null;
  onRoute: boolean;
  locateTarget: LatLng | null;
  modo: ModoCamara;
}) {
  const map = useMap();
  const skip = useRef(false);
  const zoomedOnce = useRef(false);
  const navZoomRef = useRef(false);

  useEffect(() => {
    const onDrag = () => { skip.current = true; };
    map.on("dragstart", onDrag);
    return () => { map.off("dragstart", onDrag); };
  }, [map]);

  // En modo «rumbo» el arrastre queda deshabilitado (la vista es de
  // navegación); en «norte» se puede explorar con el dedo.
  useEffect(() => {
    if (modo === "rumbo") {
      map.dragging.disable();
      skip.current = false;
    } else {
      map.dragging.enable();
    }
  }, [modo, map]);

  useEffect(() => {
    if (!position || skip.current) return;
    let zoom: number;
    if (!zoomedOnce.current) {
      zoom = onRoute ? 17 : 16; // primer fix: acercar según modo
      zoomedOnce.current = true;
    } else if (onRoute && !navZoomRef.current) {
      zoom = 17; // arrancó la navegación: más cerca de la calzada
      navZoomRef.current = true;
    } else {
      zoom = map.getZoom(); // respetar el zoom del ciclista
    }
    map.setView([position.lat, position.lon], zoom, {
      animate: true,
      duration: 0.9, // ≈ intervalo entre fixes (1 Hz): paneo continuo
      easeLinearity: 1,
    });
  }, [position, onRoute, map]);

  useEffect(() => {
    if (!locateTarget) return;
    skip.current = false;
    map.flyTo([locateTarget.lat, locateTarget.lon], Math.max(map.getZoom(), 16), { duration: 0.8 });
  }, [locateTarget, map]);

  return null;
}

/** Botón brújula: flecha hacia donde queda el NORTE real en pantalla
 *  (rota con el mapa); al tocarlo alterna rumbo ↔ norte. */
function Brújula({ mapBearing, modo, onToggle }: { mapBearing: number; modo: ModoCamara; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={modo === "rumbo" ? "Orientar el mapa al norte" : "Orientar el mapa al rumbo de la ruta"}
      title={modo === "rumbo" ? "Vista girada al rumbo · tocar para norte arriba" : "Norte arriba · tocar para girar al rumbo"}
      className="absolute right-2 top-2 z-[800] flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/90 shadow-md backdrop-blur"
      style={{ pointerEvents: "auto" }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" style={{ transform: `rotate(${-Math.round(mapBearing)}deg)`, transition: "transform 0.45s ease-out" }} aria-hidden>
        <path d="M12 2.5 L15.5 12 L12 10.2 L8.5 12 Z" fill="#ef4444" />
        <path d="M12 21.5 L8.5 12 L12 13.8 L15.5 12 Z" fill="#71717a" />
        <circle cx="12" cy="12" r="1.4" fill="#09090b" />
      </svg>
      {modo === "rumbo" && <span className="absolute -bottom-0.5 rounded bg-emerald-600 px-1 text-[8px] font-bold text-white">RUMBO</span>}
    </button>
  );
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
  // Cámara Waze compartida (hook v1.12.10): rumbo bloqueado mientras hay
  // navegación O rumbo GPS conocido — la ruta se ve recta y el pin queda
  // fijo al centro; norte arriba cuando todo está en reposo (exploración).
  const { modo, mapBearing, setModo } = useCamaraRumbo({
    activa: onRoute || heading !== null,
    heading,
    route: onRoute ? route : null,
    position,
  });
  // v1.12.10: la flecha del puck mira SIEMPRE hacia donde mira la cámara.
  // Sin course GPS (parado/interior) el mapa gira al rumbo de la ruta; si
  // la flecha siguiera en 0° (norte del mapa) quedaría viendo hacia un
  // lado (el cliente la vio a la izquierda con la ruta hacia el este).
  const rumboPin = heading ?? (modo === "rumbo" ? mapBearing : null);

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "#09090b" }}>
      {/* Mapa rotado: wrapper al 150% para que no se vean esquinas
          vacías al girar; el centro del wrapper es el centro de la
          vista, así que el pin pegado al centro queda clavado en
          pantalla mientras el mundo rota bajo él. */}
      <div
        style={{
          position: "absolute",
          left: "-25%",
          top: "-25%",
          width: "150%",
          height: "150%",
          transform: `rotate(${-mapBearing}deg)`,
          transition: "transform 0.45s ease-out",
        }}
      >
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
          {dest && <Marker position={[dest.position.lat, dest.position.lon]} icon={flagIcon(mapBearing)} interactive={false} />}

          {/* Recorrido del ride */}
          {track.length > 1 && (
            <Polyline positions={track.map((p) => [p.lat, p.lon])} pathOptions={{ color: "#a3e635", weight: 4, opacity: 0.9 }} interactive={false} />
          )}

          {/* Posición actual: círculo de precisión + puck centrado.
              En navegación: puck PLANO (flecha al rumbo, anclado al
              centro de la posición — no flota sobre edificios como la
              burbuja, cuya punta dejaba el cuerpo ~25 m al norte).
              Fuera de navegación: pin personal elegido. */}
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
              <Marker
                position={[position.lat, position.lon]}
                icon={userPinIcon(onRoute ? DEFAULT_PIN : userPin ?? DEFAULT_PIN, rumboPin, mapBearing)}
                zIndexOffset={500}
              />
            </>
          )}

          <Follow position={position} onRoute={onRoute} locateTarget={locateTarget} modo={modo} />
        </MapContainer>
      </div>

      <Brújula mapBearing={mapBearing} modo={modo} onToggle={() => setModo((m) => (m === "rumbo" ? "norte" : "rumbo"))} />
    </div>
  );
}
