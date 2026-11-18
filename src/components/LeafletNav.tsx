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
//  · Brújula (v1.13.6): UN solo botón, el del minimapa, que fija
//    el modo por prop (camMode). El botón interno propio se eliminó:
//    rendía dos rombos superpuestos y el externo no movía el mapa.
//  · Pin: puck plano centrado sobre la posición (snapped a la
//    calzada por navSnap) con flecha al rumbo — la burbuja del
//    pin personal queda para el mapa grande; el puck no tapa
//    edificios ni veredas al norte de la posición.
//
// ROTACIÓN (v1.13.7): nativa vía plugin leaflet-rotate (setBearing).
// El wrapper CSS de v1.12.9 (transform + will-change + filter sobre
// un div al 150%) se eliminó: en el WebView del dispositivo giraba
// el rectángulo pero NO el mapa. El plugin rota los paneles internos
// de Leaflet: tiles, ruta, pin y gestos quedan coherentes. Los
// iconos siguen contra-rotando (userPinIcon/flagIcon con mapBearing).
// ============================================================

import { useEffect, useMemo, useRef } from "react";
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
// El orden IMPORTA: el setup pone L en la global ANTES de que el
// IIFE del plugin lo lea al evaluarse.
import "@/lib/leaflet-rotate-setup";
import "leaflet-rotate";
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
  /** v1.13.6: modo de cámara impuesto por la brújula única del minimapa
   *  (RUMBO = mapa girado a la marcha, NORTE = fijo con la flecha girando).
   *  Antes cada lienzo tenía su propio botón y estado: dos rombos que se
   *  pisaban y el externo no afectaba al mapa. */
  camMode?: ModoCamara;
  /** Rumbo de cámara (mapBearing) para la aguja de la brújula externa. */
  onBearing?: (b: number) => void;
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
    // v1.13.8: en RUMBO el recentrado es SECO (sin paneo animado): el
    // pin queda CLAVADO al centro fix a fix y el mapa se mueve bajo él
    // (Waze real). La animación de 0.9 s dejaba al pin «flotando» lejos
    // del centro entre fixes — se veía moverse o salir del cuadro.
    if (modo === "rumbo") {
      map.setView([position.lat, position.lon], zoom, { animate: false });
    } else {
      map.setView([position.lat, position.lon], zoom, {
        animate: true,
        duration: 0.9, // ≈ intervalo entre fixes (1 Hz): paneo continuo
        easeLinearity: 1,
      });
    }
  }, [position, onRoute, modo, map]);

  useEffect(() => {
    if (!locateTarget) return;
    skip.current = false;
    map.flyTo([locateTarget.lat, locateTarget.lon], Math.max(map.getZoom(), 16), { duration: 0.8 });
  }, [locateTarget, map]);

  return null;
}

/** v1.13.8: Leaflet solo escucha el resize de la VENTANA; si el
 *  contenedor del minimapa cambia de tamaño por otra vía (temas Pro,
 *  rotación del teléfono), el mapa queda con el tamaño interno viejo:
 *  el centro matemático se desplaza del centro visible y el pin sale
 *  del cuadro. ResizeObserver → invalidateSize (mantiene el centro). */
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/** Rotación del mapa (v1.13.7): aplica mapBearing con setBearing del
 *  plugin — rotación NATIVA de Leaflet (paneles internos), no CSS de
 *  un wrapper. El hook ya cuantiza el estado a pasos grandes; el
 *  guard de delta evita setBearing redundantes entre renders. */
function Bearing({ mapBearing }: { mapBearing: number }) {
  const map = useMap();
  useEffect(() => {
    const d = ((mapBearing - map.getBearing() + 540) % 360) - 180;
    if (Math.abs(d) < 0.5) return;
    map.setBearing(mapBearing);
  }, [map, mapBearing]);
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
  camMode,
  onBearing,
}: Props) {
  const center = position ?? { lat: -33.408, lon: -70.636 };
  // Cámara Waze compartida (hook v1.12.10): rumbo bloqueado mientras hay
  // navegación O rumbo GPS conocido — la ruta se ve recta y el pin queda
  // fijo al centro; norte arriba cuando todo está en reposo (exploración).
  // v1.13.6: el MODO lo fija la brújula única del minimapa (modoForzado);
  // el hook sigue calculando el bearing según heading/ruta dentro de cada
  // modo (rumbo = gira con la marcha, norte = 0 fijo).
  const { modo, mapBearing } = useCamaraRumbo({
    activa: onRoute || heading !== null,
    heading,
    route: onRoute ? route : null,
    position,
    modoForzado: camMode,
  });
  // La aguja de la brújula externa apunta hacia donde queda el norte en
  // pantalla (mismo canal que NavCanvas): el hook ya cuantiza a pasos
  // grandes, así que esto no introduce re-renders extra.
  useEffect(() => {
    onBearing?.(mapBearing);
  }, [mapBearing, onBearing]);
  // v1.12.10: la flecha del puck mira SIEMPRE hacia donde mira la cámara.
  // Sin course GPS (parado/interior) el mapa gira al rumbo de la ruta; si
  // la flecha siguiera en 0° (norte del mapa) quedaría viendo hacia un
  // lado (el cliente la vio a la izquierda con la ruta hacia el este).
  const rumboPin = heading ?? (modo === "rumbo" ? mapBearing : null);

  // Segmentos de la ruta (v1.13.1): memoizados fuera del render para que
  // los ticks de brújula no recalculen groupSegments sobre cientos de
  // vértices (era el grueso del retraso del minimapa en el APK).
  const segments = useMemo(
    () => (onRoute && route && route.coords.length > 1 ? groupSegments(route.coords, route.flags, 0, route.coords.length - 2) : []),
    [onRoute, route]
  );

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "#09090b" }}>
      {/* Contenedor SOBREDIMENSIONADO (150%): margen de tiles para que
          las esquinas no queden vacías cuando el mapa rota vía plugin
          (<Bearing/>). SIN transform CSS — la rotación del wrapper de
          v1.12.9/v1.13.1 giraba el rectángulo pero no el mapa en el
          WebView del dispositivo, y el filter de v1.13.3 era el otro
          sospechoso de romper la composición. */}
      <div
        style={{
          position: "absolute",
          left: "-25%",
          top: "-25%",
          width: "150%",
          height: "150%",
        }}
      >
        <MapContainer
          center={[center.lat, center.lon]}
          zoom={16}
          zoomControl={false}
          // v1.13.7: rotación nativa del mapa (plugin leaflet-rotate).
          // Sin control flotante ni gesto de dos dedos: el rumbo lo fija
          // la brújula única del minimapa.
          rotate
          bearing={0}
          rotateControl={false}
          touchRotate={false}
          // v1.13.1: SIN control de atribución de Leaflet — vivía dentro
          // del wrapper rotado y al girar la cámara salía del viewport
          // («se pierde la etiqueta de OSM», queja del cliente). La
          // atribución exigida por la ODbL ahora es una capa FIJA fuera
          // (abajo a la derecha), igual en web y APK.
          attributionControl={false}
          className="h-full w-full"
          style={{ background: "#09090b" }}
        >
          <TileLayer
            // Base ráster estándar OSM France (v1.12.14): fallback
            // Leaflet del minimapa, coherente con el mapa grande.
            url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
            subdomains="abc"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>'
            maxZoom={19}
          />

          {/* Ruta activa: casing oscuro + segmentos por condición.
              Memoizado (v1.13.1): antes se recalculaba groupSegments en
              cada tick de brújula y el APK se arrastraba. */}
          {onRoute && route && route.coords.length > 1 && (
            <>
              <Polyline
                positions={route.coords.map((p) => [p.lat, p.lon] as [number, number])}
                pathOptions={{ color: "#05070a", weight: 10, opacity: 0.8 }}
                interactive={false}
              />
              {segments.map((g, i) => (
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
          <AutoResize />
          <Bearing mapBearing={mapBearing} />
        </MapContainer>
      </div>

      {/* Atribución OSM (v1.13.1): FIJA fuera del wrapper rotado — la
          licencia ODbL exige visible siempre, girada o no. Misma
          posición que la web (esquina inferior derecha del mapa). */}
      <div
        className="absolute bottom-0 right-0 z-[800] rounded-tl-md bg-white/85 px-1.5 py-0.5 text-[9px] leading-tight text-zinc-800 dark:bg-zinc-900/85 dark:text-zinc-300"
        style={{ pointerEvents: "none" }}
      >
        &copy;{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline"
          style={{ pointerEvents: "auto" }}
        >
          OpenStreetMap
        </a>{" "}
        contributors ·{" "}
        <a
          href="https://opendatacommons.org/licenses/odbl/1-0/"
          target="_blank"
          rel="noreferrer"
          className="underline"
          style={{ pointerEvents: "auto" }}
        >
          ODbL
        </a>
      </div>
    </div>
  );
}
