"use client";

// ============================================================
// Mapa v2: parque + ciclovías OSM + navegación tipo Waze
// (A* con preferencia por ciclovías) + reporte de incidencias
// + botón de localización + pin personal del usuario.
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
import { Crosshair, Flag, AlertTriangle, RotateCcw, Trash2, Route as RouteIcon, X } from "lucide-react";
import { GATES, NAV_DESTINATIONS, PARK_POLYGON, RISK_ZONES, type LatLng } from "@/lib/park";
import { PINS, DEFAULT_PIN, type PinId } from "@/lib/pins";
import { INCIDENT_BY_ID, INCIDENT_TYPES, type IncidentTypeId } from "@/lib/incidents";
import { findRoute, formatStepRemaining, loadNetwork, type NavRoute, type Network } from "@/lib/routing";

type IncidentItem = {
  id: string;
  type: string;
  lat: number;
  lon: number;
  note: string | null;
  createdAt: string;
  username: string;
  authorPin: string;
  mine: boolean;
  localOnly?: boolean;
};

const LOCAL_INCIDENTS_KEY = "cumbre30-incidents-local-v1";

function loadLocalIncidents(): IncidentItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_INCIDENTS_KEY);
    return raw ? (JSON.parse(raw) as IncidentItem[]) : [];
  } catch {
    return [];
  }
}

function saveLocalIncidents(list: IncidentItem[]) {
  try {
    localStorage.setItem(LOCAL_INCIDENTS_KEY, JSON.stringify(list.slice(0, 100)));
  } catch {
    // almacenamiento lleno
  }
}

function pinEmoji(pinId: string): string {
  return (PINS[pinId as PinId] ?? PINS[DEFAULT_PIN]).emoji;
}

function incidentIcon(type: string): L.DivIcon {
  const t = INCIDENT_BY_ID[type] ?? INCIDENT_BY_ID.otro;
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:${t.color};border:2.5px solid #09090b;box-shadow:0 0 0 2px ${t.color}66;font-size:14px;line-height:1;">${t.emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
  });
}

function userPinIcon(pinId: string): L.DivIcon {
  const p = PINS[pinId as PinId] ?? PINS[DEFAULT_PIN];
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px 9999px 9999px 4px;background:${p.color};border:3px solid #fafafa;box-shadow:0 2px 8px rgba(0,0,0,.6);font-size:16px;line-height:1;transform:rotate(0deg);">${p.emoji}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 32],
    popupAnchor: [0, -30],
  });
}

function Recenter({ position }: { position: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (!position) return;
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

type Props = {
  track: LatLng[];
  position: LatLng | null;
  accuracyM: number | null;
  userPin?: string;
};

export default function MapView({ track, position, accuracyM, userPin }: Props) {
  const [net, setNet] = useState<Network | null>(null);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [reportMode, setReportMode] = useState(false);
  const [pending, setPending] = useState<LatLng | null>(null);
  const [destMode, setDestMode] = useState(false);
  const [dest, setDest] = useState<{ name: string; position: LatLng } | null>(null);
  const [route, setRoute] = useState<NavRoute | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [locateTarget, setLocateTarget] = useState<LatLng | null>(null);
  const last = track.length > 0 ? track[track.length - 1] : null;
  const center = position ?? last ?? { lat: -33.408, lon: -70.636 };
  const routeStamp = useRef(0);

  // Cargar red de navegación + incidencias
  useEffect(() => {
    void loadNetwork().then((n) => {
      setNet(n);
      if (!n) setStatus("Red de vías no disponible (sin conexión).");
    });
    fetch("/api/incidents", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { incidents: IncidentItem[] }) => {
        const locals = loadLocalIncidents().filter((l) => !d.incidents.some((i) => i.id === l.id));
        setIncidents([...d.incidents, ...locals]);
      })
      .catch(() => setIncidents(loadLocalIncidents()));
  }, []);

  // Calcular ruta cuando cambia destino, red o posición relevante
  const computeRoute = (origin: LatLng, d: { name: string; position: LatLng }) => {
    if (!net) {
      setStatus("Red de vías aún cargando…");
      return;
    }
    const r = findRoute(net, origin, d.position);
    if (!r) {
      setRoute(null);
      setStatus("No encontramos una ruta ciclable cercana a ese destino.");
      return;
    }
    setRoute(r);
    setStatus(null);
  };

  useEffect(() => {
    if (!dest || !net) return;
    // recalcular solo si no hay ruta o el usuario se alejó 150 m del inicio
    const now = Date.now();
    if (!route || now - routeStamp.current > 30000) {
      routeStamp.current = now;
      computeRoute(position ?? center, dest);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dest, net]);

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
      setIncidents((prev) => [d.incident!, ...prev]);
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
      saveLocalIncidents([local, ...loadLocalIncidents()]);
      setIncidents((prev) => [local, ...prev]);
      setStatus("Sin conexión: incidencia guardada solo en este dispositivo.");
    }
    setTimeout(() => setStatus(null), 5000);
  };

  const deleteIncident = async (inc: IncidentItem) => {
    if (inc.localOnly) {
      const rest = loadLocalIncidents().filter((i) => i.id !== inc.id);
      saveLocalIncidents(rest);
      setIncidents((prev) => prev.filter((i) => i.id !== inc.id));
      return;
    }
    try {
      await fetch(`/api/incidents?id=${encodeURIComponent(inc.id)}`, { method: "DELETE" });
      setIncidents((prev) => prev.filter((i) => i.id !== inc.id));
    } catch {
      setStatus("No pudimos eliminar la incidencia (sin conexión).");
      setTimeout(() => setStatus(null), 4000);
    }
  };

  const setDestination = (d: { name: string; position: LatLng } | null) => {
    setDest(d);
    setRoute(null);
    routeStamp.current = 0;
    setDestMode(false);
    if (d) computeRoute(position ?? center, d);
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

  // Polilíneas de ciclovías (memo: se calculan una vez por red)
  const cicloviaLines = useMemo(
    () =>
      net
        ? net.cicloviaPolylines
            .filter((ids) => ids.length > 1)
            .map((ids, i) => (
              <Polyline
                key={`cv-${i}`}
                positions={ids.map((id) => [net.nodes[id][0], net.nodes[id][1]] as [number, number])}
                pathOptions={{ color: "#10b981", weight: 3.5, opacity: 0.85 }}
                interactive={false}
              />
            ))
        : null,
    [net]
  );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [incidents, userPin]
  );

  const stepIcon = (icon: string) =>
    icon === "left" ? "↰" : icon === "right" ? "↱" : icon === "end" ? "🏁" : icon === "start" ? "🚩" : "↑";

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl overflow-hidden border border-zinc-800 h-[62vh] min-h-[420px] relative z-0">
        <MapContainer
          center={[center.lat, center.lon]}
          zoom={14}
          scrollWheelZoom
          className={`map-dark h-full w-full bg-zinc-950 ${reportMode || destMode ? "cursor-crosshair" : ""}`}
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

          {/* Ciclovías OSM */}
          {cicloviaLines}

          {/* Ruta de navegación */}
          {route && (
            <Polyline positions={route.coords.map((p) => [p.lat, p.lon])} pathOptions={{ color: "#38bdf8", weight: 6, opacity: 0.95 }} interactive={false} />
          )}
          {dest && <Marker position={[dest.position.lat, dest.position.lon]} icon={incidentIcon("otro")} />}

          {/* Recorrido del ride */}
          {track.length > 1 && (
            <Polyline positions={track.map((p) => [p.lat, p.lon])} pathOptions={{ color: "#a3e635", weight: 4, opacity: 0.9 }} />
          )}

          {/* Incidencias */}
          {incidentMarkers}

          {/* Posición actual con pin personal */}
          {position && (
            <>
              {accuracyM !== null && accuracyM < 100 && (
                <Circle
                  center={[position.lat, position.lon]}
                  radius={accuracyM}
                  pathOptions={{ color: "#ffffff", weight: 1, fillColor: "#ffffff", fillOpacity: 0.08 }}
                />
              )}
              <Marker position={[position.lat, position.lon]} icon={userPinIcon(userPin ?? DEFAULT_PIN)} />
            </>
          )}

          <Recenter position={position} />
          <LocateHandler target={locateTarget} />
          <ClickHandler enabled={reportMode || destMode} onPick={(p) => (reportMode ? setPending(p) : setDestination({ name: "Punto en el mapa", position: p }))} />
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
            onClick={() => {
              setDestMode((v) => !v);
              setReportMode(false);
            }}
            aria-label="Elegir destino en el mapa"
            title="Toca el mapa para fijar destino"
            className={`h-10 w-10 rounded-lg border flex items-center justify-center ${
              destMode ? "bg-sky-600 border-sky-400 text-white" : "bg-zinc-950/90 border-zinc-700 text-zinc-100 hover:border-sky-500"
            }`}
          >
            <Flag className="h-5 w-5" />
          </button>
          <button
            onClick={() => {
              setReportMode((v) => !v);
              setDestMode(false);
            }}
            aria-label="Reportar incidencia en el mapa"
            title="Toca el mapa para reportar una incidencia"
            className={`h-10 w-10 rounded-lg border flex items-center justify-center ${
              reportMode ? "bg-amber-500 border-amber-300 text-zinc-950" : "bg-zinc-950/90 border-zinc-700 text-zinc-100 hover:border-amber-400"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </button>
        </div>

        {/* Banner navegación estilo Waze */}
        {route && route.steps.length > 0 && (
          <div className="absolute top-2 inset-x-2 z-[550] rounded-xl bg-zinc-950/95 border border-sky-700/70 px-3 py-2.5 shadow-lg pointer-events-auto">
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none mt-0.5" aria-hidden>
                {stepIcon(route.steps[0].icon)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-zinc-100 leading-snug">{route.steps[0].text}</div>
                <div className="text-[11px] text-sky-300 mt-0.5">
                  en {formatStepRemaining(route.steps[0])} · {(route.distanceM / 1000).toFixed(1)} km totales · ~{route.etaMin} min ·{" "}
                  {route.cicloviaPct}% ciclovía
                </div>
              </div>
              <button
                onClick={() => {
                  routeStamp.current = 0;
                  if (dest) computeRoute(position ?? center, dest);
                }}
                aria-label="Recalcular ruta"
                title="Recalcular desde mi posición"
                className="text-zinc-400 hover:text-sky-300"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button onClick={() => setDestination(null)} aria-label="Cerrar navegación" className="text-zinc-500 hover:text-red-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            {route.steps.length > 1 && (
              <div className="mt-1.5 text-[11px] text-zinc-400 truncate">Luego: {route.steps[1].text}</div>
            )}
          </div>
        )}

        {/* Selector de destino */}
        <div className="absolute bottom-14 left-2 z-[550] rounded-lg bg-zinc-950/95 border border-zinc-700 px-2 py-1.5 flex items-center gap-2 max-w-[75%]">
          <RouteIcon className="h-4 w-4 text-sky-400 shrink-0" />
          <select
            aria-label="Destino de navegación"
            value={dest ? NAV_DESTINATIONS.find((d) => d.position === dest.position)?.id ?? "mapa" : ""}
            onChange={(e) => {
              const d = NAV_DESTINATIONS.find((x) => x.id === e.target.value);
              if (d) setDestination({ name: d.name, position: d.position });
              else if (e.target.value === "") setDestination(null);
            }}
            className="bg-transparent text-xs text-zinc-200 outline-none max-w-[210px]"
          >
            <option value="" className="bg-zinc-900">Ir a…</option>
            {NAV_DESTINATIONS.map((d) => (
              <option key={d.id} value={d.id} className="bg-zinc-900">
                {d.name}
              </option>
            ))}
            {dest && <option value="mapa" className="bg-zinc-900">Punto en el mapa</option>}
          </select>
        </div>

        {/* Leyenda */}
        <div className="absolute bottom-3 left-2 z-[500] rounded-lg bg-zinc-950/90 border border-zinc-800 px-3 py-2 text-[11px] text-zinc-300 space-y-1 pointer-events-none">
          <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-emerald-500/50 border border-emerald-400" /> Parque · límite 30</div>
          <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-emerald-500" /> Ciclovía</div>
          <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-sky-400" /> Ruta sugerida</div>
          <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-lime-400" /> Tu recorrido</div>
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

      {/* Próximos pasos */}
      {route && route.steps.length > 2 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
          <div className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Instrucciones</div>
          <ol className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {route.steps.slice(0, 8).map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-zinc-200">
                <span className="text-lg leading-none w-6 text-center" aria-hidden>
                  {stepIcon(s.icon)}
                </span>
                <span className="min-w-0 flex-1">{s.text}</span>
                <span className="text-[11px] text-zinc-500 shrink-0">{s.distM > 0 ? formatStepRemaining(s) : ""}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {reportMode && !pending && (
        <p className="text-xs text-amber-300/90 -mt-1">Toca el mapa donde está el problema y elige el tipo de incidencia.</p>
      )}
      {destMode && (
        <p className="text-xs text-sky-300/90 -mt-1">Toca el mapa para fijar tu destino, o elige un punto frecuente en «Ir a…».</p>
      )}
    </div>
  );
}

export { L };
