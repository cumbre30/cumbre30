"use client";

// ============================================================
// Mapa de referencia: parque + zonas de riesgo + ciclovías
// (SOLO las del cerro, para no ensuciar la vista) + reporte de
// incidencias + botón de localización + pin personal.
// Buscador universal (Pro): escribes CUALQUIER dirección —casa,
// trabajo, otro barrio— o un lugar del cerro y la ruta ciclable
// se traza sola desde tu ubicación (grafo propio u OSRM bici).
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
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
import { Crosshair, AlertTriangle, Trash2, X, Search, MapPin, Flag, Crown } from "lucide-react";
import { GATES, NAV_DESTINATIONS, PARK_POLYGON, RISK_ZONES, type LatLng } from "@/lib/park";
import { PINS, DEFAULT_PIN } from "@/lib/pins";
import { INCIDENT_BY_ID, INCIDENT_TYPES, type IncidentTypeId } from "@/lib/incidents";
import { pointInPolygon } from "@/lib/geo";
import { incidentIcon, userPinIcon, flagIcon, markIcon } from "@/lib/mapIcons";
import { groupSegments, loadNetwork, type NavRoute, type Network } from "@/lib/routing";
import { useIncidentFeed, addIncident, removeIncident, saveLocalIncidents, loadLocalIncidents, type IncidentItem } from "@/hooks/useIncidentFeed";
import { isNativeMapPlatform } from "@/lib/nativeMapBridge";
import NativeMapCanvas from "@/components/NativeMapCanvas";
import { buildCicloFeature } from "@/lib/navCanvasLogic";
import { useProLicense } from "@/lib/proLicense";
import { addMark, removeMark, useMarks, normalizeForSearch } from "@/lib/marks";
import { geocodeAddress, type AddrResult } from "@/lib/geocode";

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
  /** true mientras el motor de navegación calcula la ruta. */
  navLoading?: boolean;
  /** Aviso del motor de navegación (sin conexión, origen provisional…). */
  navNote?: string | null;
  /** Fijar/quitar el destino de navegación (buscador Pro). */
  onSetDest?: (d: { name: string; position: LatLng } | null) => void;
  /** Saltar a la pestaña Perfil (teaser Pro). */
  onGoPro?: () => void;
};

function Recenter({ position, holdRef }: { position: LatLng | null; holdRef?: { current: number } }) {
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
    // Una ruta recién trazada se mira un rato: el encuadre automático
    // no debe pelear con el «volver a mí».
    if (holdRef && Date.now() < holdRef.current) return;
    const center = map.getCenter();
    const d = Math.abs(center.lat - position.lat) + Math.abs(center.lng - position.lon);
    if (d > 0.01) map.setView([position.lat, position.lon], Math.max(map.getZoom(), 15), { animate: true });
  }, [position, map, holdRef]);
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

/** Cuando llega la ruta pedida desde el buscador, la encuadra COMPLETA
 *  (inicio → destino) UNA sola vez; después la vista vuelve a seguir
 *  al ciclista. Rutas del velocímetro/minimapa no se enmarcan. */
function RouteFitter({
  route,
  pendingRef,
  holdRef,
}: {
  route: NavRoute | null;
  pendingRef: { current: boolean };
  holdRef: { current: number };
}) {
  const map = useMap();
  useEffect(() => {
    if (!route || route.coords.length < 2 || !pendingRef.current) return;
    pendingRef.current = false;
    holdRef.current = Date.now() + 12_000;
    const b = L.latLngBounds(route.coords.map((p) => [p.lat, p.lon] as [number, number]));
    map.fitBounds(b, { padding: [44, 44], maxZoom: 16, animate: true });
  }, [route, map, pendingRef, holdRef]);
  return null;
}

// ---- Buscador de destinos y marcadores (función Cumbre30 Pro) ----

function SearchCard({
  pro,
  marks,
  position,
  dest,
  route,
  routeLoading,
  routeNote,
  onSetDest,
  onGoPro,
  markMode,
  onToggleMarkMode,
  onMarkPoi,
  onRemoveMark,
}: {
  pro: boolean;
  marks: { id: string; name: string; lat: number; lon: number }[];
  position: LatLng | null;
  dest: { name: string; position: LatLng } | null;
  route: NavRoute | null;
  routeLoading: boolean;
  routeNote: string | null;
  onSetDest?: (d: { name: string; position: LatLng } | null) => void;
  onGoPro?: () => void;
  markMode: boolean;
  onToggleMarkMode: () => void;
  onMarkPoi: (name: string, p: LatLng) => void;
  onRemoveMark: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [addr, setAddr] = useState<AddrResult[]>([]);
  const [addrSearching, setAddrSearching] = useState(false);
  const [addrOffline, setAddrOffline] = useState(false);

  const nq = normalizeForSearch(query);
  const dests = NAV_DESTINATIONS.filter((d) => !nq || normalizeForSearch(d.name).includes(nq));
  const mine = marks.filter((m) => !nq || normalizeForSearch(m.name).includes(nq));

  // Direcciones libres: geocodificación en línea (Photon → Nominatim)
  // con debonceo de 450 ms y aborto de la búsqueda anterior. El sesgo
  // usa el último fix de GPS vía ref, para NO relanzar la búsqueda con
  // cada tick del GPS ambiental.
  const nearRef = useRef(position ?? { lat: -33.408, lon: -70.636 });
  useEffect(() => {
    if (position) nearRef.current = position;
  }, [position]);
  useEffect(() => {
    if (!pro) return;
    const q = query.trim();
    if (q.length < 4) {
      setAddr([]);
      setAddrSearching(false);
      setAddrOffline(false);
      return;
    }
    const ctrl = new AbortController();
    setAddrSearching(true);
    setAddrOffline(false);
    const t = setTimeout(() => {
      geocodeAddress(q, nearRef.current, ctrl.signal)
        .then((rs) => {
          setAddr(rs);
          setAddrSearching(false);
        })
        .catch((e) => {
          if ((e as Error)?.name === "AbortError") return;
          setAddr([]);
          setAddrSearching(false);
          setAddrOffline(true);
        });
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, pro]);

  /** Elegir destino: el motor de navegación traza la ruta solo. */
  const traceTo = (name: string, p: LatLng) => onSetDest?.({ name, position: p });
  const traceFirstAddr = () => {
    const a = addr[0];
    if (a) traceTo(a.name, { lat: a.lat, lon: a.lon });
  };

  if (!pro) {
    return (
      <div className="rounded-xl border border-border bg-card/80 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Search className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Buscador de rutas
          <Crown className="h-4 w-4 text-amber-500" />
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Escribe cualquier dirección —tu casa, el trabajo, otro barrio— o un lugar del cerro
          y la ruta ciclable se traza sola desde tu ubicación. Además guardas tus propios
          marcadores (miradores, fuentes, puntos de encuentro). Parte de Cumbre30 Pro.
        </p>
        <button
          onClick={onGoPro}
          className="mt-2.5 h-9 rounded-md bg-amber-500 px-3 text-xs font-bold text-zinc-950 hover:bg-amber-400"
        >
          Es parte de Cumbre30 Pro
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/80 p-3">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && traceFirstAddr()}
          placeholder="Cualquier dirección o lugar: Providencia 1234, cumbre…"
          aria-label="Buscar cualquier dirección o lugar y trazar la ruta"
          className="w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Limpiar búsqueda" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {dest && onSetDest && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-sky-700/60 bg-sky-950/30 px-2.5 py-1.5 text-[11px] text-foreground">
          <Flag className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
          <span className="min-w-0 flex-1 truncate">
            {route
              ? `${dest.name} · ${(route.distanceM / 1000).toFixed(1)} km · ~${route.etaMin} min en bici`
              : `Ruta a ${dest.name}`}
          </span>
          <button
            onClick={() => onSetDest(null)}
            className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-red-400 hover:text-red-500"
          >
            Quitar ruta
          </button>
        </div>
      )}

      {routeLoading && (
        <p className="mt-1.5 text-[11px] text-muted-foreground animate-pulse">Trazando la ruta hasta «{dest?.name}»…</p>
      )}
      {!routeLoading && dest && routeNote && (
        <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-300">{routeNote}</p>
      )}

      <ul className="mt-1.5 max-h-56 overflow-y-auto pr-0.5">
        {dests.map((d) => (
          <li key={d.id} className="flex items-center gap-1.5 border-b border-border/50 py-1.5 last:border-0">
            <button
              onClick={() => traceTo(d.name, d.position)}
              className="min-w-0 flex-1 truncate text-left text-xs text-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
              title="Trazar ruta hasta aquí"
            >
              {d.name}
            </button>
            {onSetDest && (
              <button
                onClick={() => onSetDest({ name: d.name, position: d.position })}
                className="shrink-0 rounded border border-sky-700/60 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-950/40 dark:text-sky-300"
                title="Generar ruta hasta aquí"
              >
                Ruta
              </button>
            )}
            <button
              onClick={() => onMarkPoi(d.name, d.position)}
              className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-emerald-500 hover:text-emerald-500"
              title="Guardar en mis lugares"
            >
              📍
            </button>
          </li>
        ))}
        {mine.map((m) => (
          <li key={m.id} className="flex items-center gap-1.5 border-b border-border/50 py-1.5 last:border-0">
            <button
              onClick={() => traceTo(m.name, { lat: m.lat, lon: m.lon })}
              className="min-w-0 flex-1 truncate text-left text-xs text-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
              title="Trazar ruta hasta aquí"
            >
              📍 {m.name} <span className="text-[10px] text-muted-foreground">· mi lugar</span>
            </button>
            {onSetDest && (
              <button
                onClick={() => onSetDest({ name: m.name, position: { lat: m.lat, lon: m.lon } })}
                className="shrink-0 rounded border border-sky-700/60 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-950/40 dark:text-sky-300"
                title="Generar ruta hasta aquí"
              >
                Ruta
              </button>
            )}
            <button
              onClick={() => onRemoveMark(m.id)}
              className="shrink-0 text-muted-foreground/70 hover:text-red-500"
              aria-label={`Eliminar ${m.name}`}
              title="Eliminar marcador"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {(addr.length > 0 || addrSearching) && (
          <li className="pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
            Direcciones{addrSearching ? " · buscando…" : ""}
          </li>
        )}
        {addr.map((a) => (
          <li key={a.id} className="flex items-center gap-1.5 border-b border-border/50 py-1.5 last:border-0">
            <button
              onClick={() => traceTo(a.name, { lat: a.lat, lon: a.lon })}
              className="min-w-0 flex-1 text-left hover:text-emerald-600 dark:hover:text-emerald-400"
              title="Trazar ruta hasta aquí"
            >
              <span className="block truncate text-xs text-foreground">
                {a.emoji} {a.name}
              </span>
              {a.detail && <span className="block truncate text-[10px] text-muted-foreground">{a.detail}</span>}
            </button>
            {onSetDest && (
              <button
                onClick={() => traceTo(a.name, { lat: a.lat, lon: a.lon })}
                className="shrink-0 rounded border border-sky-700/60 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-950/40 dark:text-sky-300"
                title="Generar ruta hasta aquí"
              >
                Ruta
              </button>
            )}
            <button
              onClick={() => onMarkPoi(a.name, { lat: a.lat, lon: a.lon })}
              className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-emerald-500 hover:text-emerald-500"
              title="Guardar en mis lugares"
            >
              📍
            </button>
          </li>
        ))}
        {addrSearching && addr.length === 0 && (
          <li className="py-2 text-center text-xs text-muted-foreground animate-pulse">Buscando direcciones…</li>
        )}
        {addrOffline && (
          <li className="py-2 text-center text-[11px] text-amber-700 dark:text-amber-300">
            Sin conexión para buscar direcciones — los lugares del cerro y tus marcadores siguen disponibles.
          </li>
        )}
        {dests.length === 0 && mine.length === 0 && addr.length === 0 && !addrSearching && !addrOffline && query.trim().length >= 2 && (
          <li className="py-2 text-center text-xs text-muted-foreground">Sin resultados para «{query}»</li>
        )}
      </ul>

      <button
        onClick={onToggleMarkMode}
        className={`mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-md border text-[11px] font-medium ${
          markMode
            ? "border-emerald-400 bg-emerald-600 text-zinc-950"
            : "border-border bg-background text-muted-foreground hover:border-emerald-500 hover:text-foreground"
        }`}
      >
        <MapPin className="h-3.5 w-3.5" />
        {markMode ? "Toca el mapa para marcar (cancelar)" : "Marcar un punto tocando el mapa"}
      </button>
    </div>
  );
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
                className="px-2 py-1 rounded-md border border-border bg-card hover:border-amber-400 text-[11px] text-foreground"
              >
                {t.emoji} {t.label}
              </button>
            ))}
            <button
              onClick={onCancel}
              className="px-2 py-1 rounded-md border border-border bg-card hover:border-red-400 text-[11px] text-muted-foreground"
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

export default function MapView({ track, position, accuracyM, heading, userPin, route, dest, navLoading, navNote, onSetDest, onGoPro }: Props) {
  // Filtro nocturno de los tiles OSM: solo con el tema oscuro
  // (en modo claro el mapa se muestra con sus colores normales).
  const { resolvedTheme } = useTheme();
  const darkMap = resolvedTheme !== "light";
  const [net, setNet] = useState<Network | null>(null);
  const incidents = useIncidentFeed();
  const [reportMode, setReportMode] = useState(false);
  const [pending, setPending] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [locateTarget, setLocateTarget] = useState<LatLng | null>(null);
  // Buscador Pro: consulta, marcadores personales y modo "marcar tocando"
  const { pro } = useProLicense();
  const marks = useMarks();
  // Encuadre único de la ruta recién trazada desde el buscador
  const pendingFitRef = useRef(false);
  const recenterHoldRef = useRef(0);
  const [markMode, setMarkMode] = useState(false);
  const [pendingMark, setPendingMark] = useState<LatLng | null>(null);
  const [markName, setMarkName] = useState("");
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

  // --- Marcadores personales (Pro): guardar POI o punto tocado ---
  const markPoi = (name: string, p: LatLng) => {
    addMark(name, p);
    setStatus(`📍 «${name}» guardado en tus lugares.`);
    setTimeout(() => setStatus(null), 4000);
  };

  const saveMark = () => {
    if (!pendingMark) return;
    const m = addMark(markName, pendingMark);
    setPendingMark(null);
    setMarkName("");
    setMarkMode(false);
    setStatus(`📍 «${m.name}» guardado en tus lugares.`);
    setTimeout(() => setStatus(null), 4000);
  };

  /** Destino desde el buscador/marcadores: cuando llegue la ruta se
   *  encuadra entera UNA vez (RouteFitter) y luego la vista vuelve al
   *  ciclista. Las rutas del velocímetro no se enmarcan. */
  const handleSetDest = (d: { name: string; position: LatLng } | null) => {
    if (d) pendingFitRef.current = true;
    onSetDest?.(d);
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
            className="h-10 w-10 rounded-lg bg-background border border-border text-foreground flex items-center justify-center"
          >
            <Crosshair className="h-5 w-5" />
          </button>
          <button
            onClick={() => setReportMode((v) => !v)}
            aria-label="Reportar incidencia en el mapa"
            title="Toca el mapa para reportar una incidencia"
            className={`h-10 w-10 rounded-lg border flex items-center justify-center ${
              reportMode ? "bg-amber-500 border-amber-300 text-zinc-950" : "bg-background border-border text-foreground"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </button>
        </div>

        {/* SOLO el lienzo nativo dentro del contenedor */}
        <div className="rounded-xl overflow-hidden border border-border h-[56vh] min-h-[420px] relative z-0">
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
            className="rounded-lg bg-background border border-amber-600/70 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
            pending={pending}
            status={status}
            onType={reportIncident}
            onCancel={() => setPending(null)}
          />
        )}

        {reportMode && !pending && <p className="text-xs text-amber-700/90 dark:text-amber-300/90">Toca el mapa donde está el problema y elige el tipo de incidencia.</p>}

        <MapLegend className="rounded-lg bg-background border border-border px-3 py-2 text-[11px] text-foreground/90 space-y-1" />

        <p className="text-xs text-muted-foreground leading-relaxed">
          Mapa nativo: tu ubicación, zonas de riesgo, simbología e incidencias con fecha y hora. Para navegación con ruta y
          ciclovías, usa el velocímetro (pestaña Ride).
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchCard
        pro={pro.active}
        marks={marks}
        position={position}
        dest={dest}
        route={route}
        routeLoading={!!navLoading}
        routeNote={navNote ?? null}
        onSetDest={handleSetDest}
        onGoPro={onGoPro}
        markMode={markMode}
        onToggleMarkMode={() => {
          setMarkMode((v) => !v);
          setPendingMark(null);
          setReportMode(false);
        }}
        onMarkPoi={markPoi}
        onRemoveMark={removeMark}
      />

      <div className="rounded-xl overflow-hidden border border-border h-[62vh] min-h-[420px] relative z-0">
        <MapContainer
          center={[center.lat, center.lon]}
          zoom={14}
          scrollWheelZoom
          className={`${darkMap ? "map-dark" : ""} h-full w-full bg-background ${reportMode || markMode ? "cursor-crosshair" : ""}`}
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

          {/* Marcadores personales (Pro) */}
          {marks.map((m) => (
            <Marker key={m.id} position={[m.lat, m.lon]} icon={markIcon()}>
              <Popup>
                <div className="min-w-[170px] text-[13px]">
                  <div className="font-semibold mb-1">📍 {m.name}</div>
                  <div className="flex gap-3">
                    {onSetDest && (
                      <button
                        onClick={() => handleSetDest({ name: m.name, position: { lat: m.lat, lon: m.lon } })}
                        className="font-medium text-sky-600 hover:underline"
                      >
                        Ruta aquí
                      </button>
                    )}
                    <button
                      onClick={() => removeMark(m.id)}
                      className="font-medium text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

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

          <Recenter position={position} holdRef={recenterHoldRef} />
          <RouteFitter route={route} pendingRef={pendingFitRef} holdRef={recenterHoldRef} />
          <LocateHandler target={locateTarget} />
          <ClickHandler enabled={reportMode} onPick={setPending} />
          <ClickHandler
            enabled={markMode}
            onPick={(p) => {
              setPendingMark(p);
              setMarkName("");
            }}
          />
        </MapContainer>

        {/* Controles flotantes */}
        <div className="absolute top-2 right-2 z-[600] flex flex-col gap-1.5">
          <button
            onClick={locate}
            aria-label="Localizarme"
            title="Centrar en mi ubicación"
            className="h-10 w-10 rounded-lg bg-background/90 border border-border text-foreground flex items-center justify-center hover:border-emerald-500"
          >
            <Crosshair className="h-5 w-5" />
          </button>
          <button
            onClick={() => setReportMode((v) => !v)}
            aria-label="Reportar incidencia en el mapa"
            title="Toca el mapa para reportar una incidencia"
            className={`h-10 w-10 rounded-lg border flex items-center justify-center ${
              reportMode ? "bg-amber-500 border-amber-300 text-zinc-950" : "bg-background/90 border-border text-foreground hover:border-amber-400"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </button>
        </div>

        {/* Leyenda */}
        <div className="absolute bottom-3 left-2 z-[500] rounded-lg bg-background/90 border border-border px-3 py-2 text-[11px] text-foreground/90 space-y-1 pointer-events-none">
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
          <div className="absolute top-16 inset-x-2 z-[650] rounded-lg bg-background/95 border border-amber-600/70 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            {pending ? (
              <div>
                <div className="font-semibold mb-1.5">¿Qué encontraste aquí?</div>
                <div className="flex flex-wrap gap-1.5">
                  {INCIDENT_TYPES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => reportIncident(t.id)}
                      className="px-2 py-1 rounded-md border border-border bg-card hover:border-amber-400 text-[11px] text-foreground"
                    >
                      {t.emoji} {t.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setPending(null)}
                    className="px-2 py-1 rounded-md border border-border bg-card hover:border-red-400 text-[11px] text-muted-foreground"
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
        {/* Nombrar un marcador personal (Pro, modo marcar) */}
        {pendingMark && (
          <div className="absolute top-16 inset-x-2 z-[650] rounded-lg bg-background/95 border border-emerald-500/70 px-3 py-2 text-xs">
            <div className="font-semibold mb-1.5 text-foreground">📍 ¿Qué nombre le ponemos a este lugar?</div>
            <div className="flex gap-1.5">
              <input
                value={markName}
                onChange={(e) => setMarkName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && markName.trim() && saveMark()}
                placeholder="Ej: mirador del cóndor"
                aria-label="Nombre del marcador"
                autoFocus
                className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-emerald-500"
              />
              <button
                onClick={saveMark}
                disabled={!markName.trim()}
                className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-950 hover:bg-emerald-500 disabled:opacity-40"
              >
                Guardar
              </button>
              <button
                onClick={() => setPendingMark(null)}
                className="rounded-md border border-border bg-card px-2 py-1.5 text-[11px] text-muted-foreground hover:border-red-400 hover:text-red-500"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {reportMode && !pending && (
        <p className="text-xs text-amber-700/90 dark:text-amber-300/90 -mt-1">Toca el mapa donde está el problema y elige el tipo de incidencia.</p>
      )}
      {markMode && !pendingMark && (
        <p className="text-xs text-emerald-700/90 dark:text-emerald-300/90 -mt-1">Toca el mapa donde quieres dejar tu marcador 📍.</p>
      )}
      <p className="text-xs text-muted-foreground leading-relaxed">
        Mapa de referencia: tu ubicación, zonas de riesgo, simbología e incidencias. Con Cumbre30 Pro escribes
        cualquier dirección o lugar del cerro y la ruta ciclable se traza sola desde tu ubicación (buscar la
        dirección necesita internet); además guardas tus propios marcadores. Para navegación giro a giro, usa
        el velocímetro (pestaña Ride).
      </p>
    </div>
  );
}

export { L };
