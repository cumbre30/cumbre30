"use client";

// ============================================================
// Mapa de referencia: parque + zonas de riesgo + ciclovías
// (SOLO las del cerro, para no ensuciar la vista) + reporte de
// incidencias + botón de localización + pin personal.
// La navegación «Ir a…» vive ahora en el velocímetro (minimapa).
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
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { Crosshair, AlertTriangle, Trash2, X } from "lucide-react";
import { GATES, PARK_POLYGON, RISK_ZONES, type LatLng } from "@/lib/park";
import { PINS, DEFAULT_PIN } from "@/lib/pins";
import { INCIDENT_BY_ID, INCIDENT_TYPES, type IncidentTypeId } from "@/lib/incidents";
import { pointInPolygon } from "@/lib/geo";
import { incidentIcon, userPinIcon, flagIcon } from "@/lib/mapIcons";
import { groupSegments, loadNetwork, type NavRoute, type Network } from "@/lib/routing";
import { useIncidentFeed, addIncident, removeIncident, saveLocalIncidents, loadLocalIncidents, type IncidentItem } from "@/hooks/useIncidentFeed";
import { isNativeMapPlatform } from "@/lib/nativeMapBridge";
import NativeMapCanvas from "@/components/NativeMapCanvas";
import { buildCicloFeature } from "@/lib/navCanvasLogic";

function pinEmoji(pinId: string): string {
  const p = PINS[pinId as keyof typeof PINS];
  return p ? p.emoji : "📍";
}

type Props = {
  track: LatLng[];
  position: LatLng | null;
  accuracyM: number | null;
  heading: number | null;
  userPin?: string;
  /** Ruta activa elegida en el velocímetro (solo lectura aquí). */
  route: NavRoute | null;
  dest: { name: string; position: LatLng } | null;
};

function Recenter({ position }: { position: LatLng | null }) {
  const map = useMap();
  const centeredOnce = useRef(false);
  useEffect(() => {
    if (!position) return;
    // Primer arreglo GPS: el mapa parte SIEMPRE en la ubicación del
    // usuario (ubicación predeterminada = la mía), sin importar cuán
    // lejos esté del centro por defecto.
    if (!centeredOnce.current) {
      centeredOnce.current = true;
      map.setView([position.lat, position.lon], Math.max(map.getZoom(), 15), { animate: true });
      return;
    }
    const center = map.getCenter();
    const d = Math.abs(center.lat - position.lat) + Math.abs(center.lng - position.lon);
    if (d > 0.01) map.setView([position.lat, position.lon], Math.max(map.getZoom(), 15), { animate: true });
  }, [position, map]);
  return null;
}

function LocateHandler({ target }: { target: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 16), { duration: 0.8 });
  }, [target, map]);
  return null;
}

function ClickHandler({ onPick, enabled }: { onPick: (p: LatLng) => void; enabled: boolean }) {
  useMapEvents({
    click(e) {
      if (enabled) onPick({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

// ---- Piezas compartidas web/nativo del mapa grande ----

function MapLegend({ className }: { className: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-emerald-500/50 border border-emerald-400" /> Parque · límite 30</div>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-emerald-500" /> Ciclovía (interior del cerro)</div>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm" style={{ background: "#a855f7" }} /> Ruta: ciclovía</div>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm" style={{ background: "#f4f4f5" }} /> Ruta: vía compartida</div>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-lime-400" /> Tu recorrido</div>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-amber-500" /> Zonas de riesgo</div>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-zinc-600" /> ⚠ Emojis: incidencias reportadas</div>
    </div>
  );
}

function IncidentSheet({
  className,
  pending,
  status,
  onType,
  onCancel,
}: {
  className: string;
  pending: LatLng | null;
  status: string | null;
  onType: (t: IncidentTypeId) => void;
  onCancel: () => void;
}) {
  return (
    <div className={className}>
      {pending ? (
        <div>
          <div className="font-semibold mb-1.5">¿Qué encontraste aquí?</div>
          <div className="flex flex-wrap gap-1.5">
            {INCIDENT_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => onType(t.id)}
                className="px-2 py-1 rounded-md border border-zinc-700 bg-zinc-900 hover:border-amber-400 text-[11px] text-zinc-200"
              >
                {t.emoji} {t.label}
              </button>
            ))}
            <button
              onClick={onCancel}
              className="px-2 py-1 rounded-md border border-zinc-700 bg-zinc-900 hover:border-red-400 text-[11px] text-zinc-400"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        status
      )}
    </div>
  );
}

export default function MapView({ track, position, accuracyM, heading, userPin, route, dest }: Props) {
  const [net, setNet] = useState<Network | null>(null);
  const incidents = useIncidentFeed();
  const [reportMode, setReportMode] = useState(false);
  const [pending, setPending] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [locateTarget, setLocateTarget] = useState<LatLng | null>(null);
  const last = track.length > 0 ? track[track.length - 1] : null;
  // Sin fix aún: el centro por defecto es el parque; al llegar el
  // primer arreglo GPS, Recenter lleva la vista a TU ubicación.
  const center = position ?? last ?? { lat: -33.408, lon: -70.636 };
  // Mapa nativo (MapLibre Native) o Leaflet en la web
  // ⚠️ NATIVE_MAPS_ENABLED=false (v1.3.1): el WebView del dispositivo no
  // renderiza el mapa nativo (ni el GL JS web). Prioriza funcionamiento:
  // siempre Leaflet con tiles ráster. Código nativo dormido tras el flag.
  const NATIVE_MAPS_ENABLED = false;
  const nativeDetected = useMemo(() => isNativeMapPlatform(), []);
  const [nativeFail, setNativeFail] = useState(false);
  const nativeMap = NATIVE_MAPS_ENABLED && nativeDetected && !nativeFail;
  // Ciclovías del cerro para el lienzo nativo (misma regla ≥50%)
  const cicloFeature = useMemo(() => buildCicloFeature(net), [net]);

  // Red de vías (solo para dibujar las ciclovías del cerro)
  useEffect(() => {
    void loadNetwork().then(setNet);
  }, []);

  const reportIncident = async (type: IncidentTypeId) => {
    if (!pending) return;
    const payload = { type, lat: pending.lat, lon: pending.lon };
    setPending(null);
    setReportMode(false);
    try {
      const r = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = (await r.json()) as { incident?: IncidentItem; error?: string };
      if (!r.ok || !d.incident) throw new Error(d.error ?? "error");
      addIncident(d.incident);
      setStatus("Incidencia registrada y visible para todos ✓");
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
      // persistir en la lista local
      saveLocalIncidents([local, ...loadLocalIncidents()]);
      setStatus("Sin conexión: incidencia guardada solo en este dispositivo.");
    }
    setTimeout(() => setStatus(null), 5000);
  };

  const deleteIncident = async (inc: IncidentItem) => {
    if (inc.localOnly) {
      removeIncident(inc.id);
      return;
    }
    try {
      await fetch(`/api/incidents?id=${encodeURIComponent(inc.id)}`, { method: "DELETE" });
      removeIncident(inc.id);
    } catch {
      setStatus("No pudimos eliminar la incidencia (sin conexión).");
      setTimeout(() => setStatus(null), 4000);
    }
  };

  const locate = () => {
    if (position) {
      setLocateTarget(position);
      return;
    }
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocateTarget({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {
          setStatus("No pudimos obtener tu ubicación.");
          setTimeout(() => setStatus(null), 4000);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  // Ciclovías: SOLO las que están dentro del cerro (≥50% de sus puntos
  // dentro del polígono del parque) — el resto se omite por orden.
  const cicloviaLines = useMemo(() => {
    if (!net) return null;
    const out: React.ReactNode[] = [];
    for (let i = 0; i < net.cicloviaPolylines.length; i++) {
      const ids = net.cicloviaPolylines[i];
      if (ids.length < 2) continue;
      let inside = 0;
      for (const id of ids) {
        if (pointInPolygon({ lat: net.nodes[id][0], lon: net.nodes[id][1] }, PARK_POLYGON)) inside++;
      }
      if (inside / ids.length < 0.5) continue;
      out.push(
        <Polyline
          key={`cv-${i}`}
          positions={ids.map((id) => [net.nodes[id][0], net.nodes[id][1]] as [number, number])}
          pathOptions={{ color: "#10b981", weight: 3.5, opacity: 0.85 }}
          interactive={false}
        />
      );
    }
    return out;
  }, [net]);

  const incidentMarkers = useMemo(
    () =>
      incidents.map((inc) => {
        const t = INCIDENT_BY_ID[inc.type] ?? INCIDENT_BY_ID.otro;
        const fecha = new Date(inc.createdAt).toLocaleString("es-CL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        return (
          <Marker key={inc.id} position={[inc.lat, inc.lon]} icon={incidentIcon(inc.type)}>
            <Popup>
              <div className="min-w-[190px] text-[13px]">
                <div className="font-semibold mb-0.5">
                  {t.emoji} {t.label}
                </div>
                <div className="text-zinc-600">
                  Registrada: <b>{fecha}</b>
                </div>
                <div className="text-zinc-600">
                  Reportó: {pinEmoji(inc.authorPin)} {inc.username}
                  {inc.localOnly ? " · solo local" : ""}
                </div>
                {inc.note && <div className="mt-1 italic">“{inc.note}”</div>}
                {inc.mine && (
                  <button
                    onClick={() => deleteIncident(inc)}
                    className="mt-2 inline-flex items-center gap-1 text-red-600 font-medium hover:underline"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        );
      }),
     
    [incidents, userPin]
  );

  // ---- Mapa NATIVO (MapLibre Native): UI HTML alrededor del lienzo ----
  if (nativeMap) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={locate}
            aria-label="Localizarme"
            title="Centrar en mi ubicación"
            className="h-10 w-10 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-100 flex items-center justify-center"
          >
            <Crosshair className="h-5 w-5" />
          </button>
          <button
            onClick={() => setReportMode((v) => !v)}
            aria-label="Reportar incidencia en el mapa"
            title="Toca el mapa para reportar una incidencia"
            className={`h-10 w-10 rounded-lg border flex items-center justify-center ${
              reportMode ? "bg-amber-500 border-amber-300 text-zinc-950" : "bg-zinc-950 border-zinc-700 text-zinc-100"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </button>
        </div>

        {/* SOLO el lienzo nativo dentro del contenedor */}
        <div className="rounded-xl overflow-hidden border border-zinc-800 h-[56vh] min-h-[420px] relative z-0">
          <NativeMapCanvas
            id="bigmap"
            mode="flat"
            position={position}
            heading={heading}
            track={track}
            accuracyM={accuracyM}
            onRoute={!!route && route.coords.length > 1}
            route={route}
            nearestIdx={null}
            remainingM={route?.distanceM ?? 0}
            nextStep={null}
            dest={dest ? dest.position : null}
            pickMode={reportMode}
            onPick={setPending}
            userPin={userPin}
            incidents={incidents}
            locateTarget={locateTarget}
            cicloFeature={cicloFeature}
            onUnavailable={() => setNativeFail(true)}
          />
        </div>

        {(status || pending) && (
          <IncidentSheet
            className="rounded-lg bg-zinc-950 border border-amber-600/70 px-3 py-2 text-xs text-amber-200"
            pending={pending}
            status={status}
            onType={reportIncident}
            onCancel={() => setPending(null)}
          />
        )}

        {reportMode && !pending && <p className="text-xs text-amber-300/90">Toca el mapa donde está el problema y elige el tipo de incidencia.</p>}

        <MapLegend className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-[11px] text-zinc-300 space-y-1" />

        <p className="text-xs text-zinc-500 leading-relaxed">
          Mapa nativo: tu ubicación, zonas de riesgo, simbología e incidencias con fecha y hora. Para navegación con ruta y
          ciclovías, usa el velocímetro (pestaña Ride).
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl overflow-hidden border border-zinc-800 h-[62vh] min-h-[420px] relative z-0">
        <MapContainer
          center={[center.lat, center.lon]}
          zoom={14}
          scrollWheelZoom
          className={`map-dark h-full w-full bg-zinc-950 ${reportMode ? "cursor-crosshair" : ""}`}
          attributionControl
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            maxZoom={19}
          />

          {/* Límite del parque */}
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

          {/* Accesos */}
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

          {/* Ciclovías (solo interior del parque) */}
          {cicloviaLines}

          {/* Ruta elegida: completa, partida por condición — violeta =
              ciclovía · blanco = vía compartida — con casing oscuro */}
          {route && route.coords.length > 1 && (
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
              {/* inicio de la ruta (mi ubicación al trazar) */}
              <CircleMarker
                center={[route.coords[0].lat, route.coords[0].lon]}
                radius={6}
                pathOptions={{ color: "#fafafa", weight: 2.5, fillColor: "#22c55e", fillOpacity: 1 }}
                interactive={false}
              />
            </>
          )}
          {dest && <Marker position={[dest.position.lat, dest.position.lon]} icon={flagIcon()} interactive={false} />}

          {/* Recorrido del ride */}
          {track.length > 1 && (
            <Polyline positions={track.map((p) => [p.lat, p.lon])} pathOptions={{ color: "#a3e635", weight: 4, opacity: 0.9 }} />
          )}

          {/* Incidencias */}
          {incidentMarkers}

          {/* Posición actual con pin personal (flecha si es el clásico) */}
          {position && (
            <>
              {accuracyM !== null && accuracyM < 100 && (
                <Circle
                  center={[position.lat, position.lon]}
                  radius={accuracyM}
                  pathOptions={{ color: "#ffffff", weight: 1, fillColor: "#ffffff", fillOpacity: 0.08 }}
                />
              )}
              <Marker position={[position.lat, position.lon]} icon={userPinIcon(userPin ?? DEFAULT_PIN, heading)} zIndexOffset={500} />
            </>
          )}

          <Recenter position={position} />
          <LocateHandler target={locateTarget} />
          <ClickHandler enabled={reportMode} onPick={setPending} />
        </MapContainer>

        {/* Controles flotantes */}
        <div className="absolute top-2 right-2 z-[600] flex flex-col gap-1.5">
          <button
            onClick={locate}
            aria-label="Localizarme"
            title="Centrar en mi ubicación"
            className="h-10 w-10 rounded-lg bg-zinc-950/90 border border-zinc-700 text-zinc-100 flex items-center justify-center hover:border-emerald-500"
          >
            <Crosshair className="h-5 w-5" />
          </button>
          <button
            onClick={() => setReportMode((v) => !v)}
            aria-label="Reportar incidencia en el mapa"
            title="Toca el mapa para reportar una incidencia"
            className={`h-10 w-10 rounded-lg border flex items-center justify-center ${
              reportMode ? "bg-amber-500 border-amber-300 text-zinc-950" : "bg-zinc-950/90 border-zinc-700 text-zinc-100 hover:border-amber-400"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </button>
        </div>

        {/* Leyenda */}
        <div className="absolute bottom-3 left-2 z-[500] rounded-lg bg-zinc-950/90 border border-zinc-800 px-3 py-2 text-[11px] text-zinc-300 space-y-1 pointer-events-none">
          <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-emerald-500/50 border border-emerald-400" /> Parque · límite 30</div>
          <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-emerald-500" /> Ciclovía (interior del cerro)</div>
          <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm" style={{ background: "#a855f7" }} /> Ruta: ciclovía</div>
          <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm" style={{ background: "#f4f4f5" }} /> Ruta: vía compartida</div>
          <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-lime-400" /> Tu recorrido</div>
          <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-amber-500" /> Zonas de riesgo</div>
          <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-zinc-600" /> ⚠ Emojis: incidencias reportadas</div>
        </div>

        {/* Estado / avisos */}
        {(status || pending) && (
          <div className="absolute top-16 inset-x-2 z-[650] rounded-lg bg-zinc-950/95 border border-amber-600/70 px-3 py-2 text-xs text-amber-200">
            {pending ? (
              <div>
                <div className="font-semibold mb-1.5">¿Qué encontraste aquí?</div>
                <div className="flex flex-wrap gap-1.5">
                  {INCIDENT_TYPES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => reportIncident(t.id)}
                      className="px-2 py-1 rounded-md border border-zinc-700 bg-zinc-900 hover:border-amber-400 text-[11px] text-zinc-200"
                    >
                      {t.emoji} {t.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setPending(null)}
                    className="px-2 py-1 rounded-md border border-zinc-700 bg-zinc-900 hover:border-red-400 text-[11px] text-zinc-400"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              status
            )}
          </div>
        )}
      </div>

      {reportMode && !pending && (
        <p className="text-xs text-amber-300/90 -mt-1">Toca el mapa donde está el problema y elige el tipo de incidencia.</p>
      )}
      <p className="text-xs text-zinc-500 leading-relaxed">
        Mapa de referencia: tu ubicación, zonas de riesgo, simbología e incidencias con fecha y hora. Para navegación con
        ruta y ciclovías, usa el velocímetro (pestaña Ride).
      </p>
    </div>
  );
}

export { L };
