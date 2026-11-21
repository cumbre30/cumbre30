"use client";

// ============================================================
// Mapa de referencia: parque + zonas de riesgo + ciclovías
// (SOLO las del cerro, para no ensuciar la vista) + reporte de
// incidencias + botón de localización + pin personal.
// Buscador universal (Pro): escribes CUALQUIER dirección -casa,
// trabajo, otro barrio- o un lugar del cerro y la ruta ciclable
// se traza sola desde tu ubicación (grafo propio u OSRM bici).
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
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
import { Crosshair, AlertTriangle, Trash2, X, Search, MapPin, Flag, Crown, Lock, Layers, ChevronDown, Eye, Share2, Check, RefreshCw, Route, Milestone, Navigation, PencilRuler } from "lucide-react";
import { apiUrl } from "@/lib/backend";
import { useCamaraRumbo } from "@/hooks/useCamaraRumbo";
import { NAV_DESTINATIONS, PARK_POLYGON, RISK_ZONES, type LatLng } from "@/lib/park";
import { SECTORES_EMERGENCIA } from "@/lib/sectoresEmergencia";
import {
  CAPA_ACCESOS,
  CAPA_NORMATIVA,
  CAPA_POIS,
  CAPA_RUTAS,
  BAJADAS_30,
  CAPA_URBANA,
  CAPA_SENDEROS_PEATONALES,
  CAPA_PASEO_METROPOLITANO,
  SUB_ETIQUETAS,
  rutaTrazado,
  type CapaPunto,
  type CapaPuntoBase,
} from "@/lib/mapLayers";
import { PINS, DEFAULT_PIN } from "@/lib/pins";
import { INCIDENT_BY_ID, INCIDENT_TYPES, compartirReporte, type IncidentTypeId } from "@/lib/incidents";
import { pointInPolygon } from "@/lib/geo";
import { incidentIcon, userPinIcon, flagIcon, markIcon, poiIcon, banderaInicioIcon } from "@/lib/mapIcons";
import { groupSegments, loadNetwork, type NavRoute, type Network } from "@/lib/routing";
import { useIncidentFeed, addIncident, removeIncident, saveLocalIncidents, loadLocalIncidents, voteIncident, incidentVoteOf, type IncidentItem } from "@/hooks/useIncidentFeed";
import { isNativeMapPlatform } from "@/lib/nativeMapBridge";
import NativeMapCanvas from "@/components/NativeMapCanvas";
import { buildCicloFeature } from "@/lib/navCanvasLogic";
import { useProLicense } from "@/lib/proLicense";
import { addMark, removeMark, useMarks, normalizeForSearch } from "@/lib/marks";
import { useCreadorTrazas } from "@/hooks/useCreadorTrazas";
import TrazadoOverlay from "@/components/TrazadoOverlay";
import EditorRutaPanel, { ListaBorradores } from "@/components/EditorRutaPanel";
import { useEditorRutas } from "@/hooks/useEditorRutas";
import BibliotecaRutas from "@/components/BibliotecaRutas";
import PublicarRuta from "@/components/PublicarRuta";
import type { BboxMapa } from "@/components/CatalogoTab";
import type { RutaPublica } from "@/lib/rutasApi";
import { polylineDecode } from "@/lib/routeGeo";
import { useTrazas, removeTraza, type TrazaGuardada } from "@/lib/trazasUsuario";
import { rutaProyectadaStore, type RutaProyectada } from "@/lib/rutaProyectada";
import { useRutaProyectada } from "@/hooks/useRutaProyectada";
import { geocodeAddress, type AddrResult } from "@/lib/geocode";
import type { CapaRuta } from "@/lib/mapLayers";
import type { ProLockFeature } from "@/lib/planData";
import type { NavDest } from "@/hooks/useNavEngine";
import { t, useLang } from "@/lib/i18n";

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
  dest: NavDest | null;
  /** true mientras el motor de navegación calcula la ruta. */
  navLoading?: boolean;
  /** Aviso del motor de navegación (sin conexión, origen provisional…). */
  navNote?: string | null;
  /** Fijar/quitar el destino de navegación (buscador Pro · capas Rutas). */
  onSetDest?: (d: NavDest | null) => void;
  /** FREE tocó una función Pro → abrir modal contextual con el
   *  beneficio real (sin sacarlo del mapa ni bloquear nada básico). */
  onProLocked?: (feature: ProLockFeature) => void;
  /** Rediseño Explorar (2026-11-21): orden puntual desde el módulo
   *  (ExplorarView). `n` se incrementa por orden y MapView la aplica
   *  una sola vez; el mapa sigue siendo el mismo componente con todas
   *  sus herramientas — ahora responde también al módulo que lo
   *  hospeda. */
  orden?: OrdenExplorar;
};

/** Orden externa del módulo Explorar hacia el mapa embebido. */
export type OrdenExplorar = {
  /** Contador incremental: cada orden nueva lleva un n distinto. */
  n: number;
  tipo:
    | "biblioteca" // abrir la biblioteca (tabBiblioteca elige la sección)
    | "trazar-ruta" // activar el creador de trazados en modo ruta
    | "trazar-segmento" // activar el creador de trazados en modo segmento
    | "importar-gpx" // abrir el selector de archivos del editor
    | "actividades" // abrir capas con «Mis trazados» (crear ruta desde traza)
    | "ver-ruta" // dibujar la geometría protegida de una ruta pública
    | "navegar-ruta" // proyectar una copia local (proyector «Navegar»)
    | "encuadrar" // encuadrar una ruta local en el mapa
    | "editar-borrador" // abrir el editor con un borrador guardado
    | "publicar" // abrir la vista previa de publicación de un borrador
    | "desde-traza" // crear un borrador desde un trazado guardado
    | "ir-inicio"; // «cómo llegar»: destino = inicio aproximado
  /** Sección de la biblioteca para el tipo "biblioteca". */
  tabBiblioteca?: "mias" | "catalogo" | "favoritas" | "recientes";
  /** Ruta pública para "ver-ruta" e "ir-inicio". */
  rutaPublica?: RutaPublica;
  /** Ruta local (borrador/migrada) para "navegar-ruta", "encuadrar",
   *  "editar-borrador" y "publicar". */
  rutaLocal?: { id: string; serverId?: string | null; nombre: string; coords: { lat: number; lon: number }[] };
  /** Trazado guardado para "desde-traza". */
  traza?: TrazaGuardada;
};

/** Props públicas de MapView (ExplorarView las reenvía tal cual). */
export type MapViewProps = Props;

// SIN ubicación automática (cliente, 2026-11-12): el mapa NO se envía
// solo a la posición del ciclista - perseguía el dedo y no dejaba
// navegar/explorar. La ubicación se centra SOLO con el botón
// «Centrar en mi ubicación» (LocateHandler abajo).
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
 *  (inicio → destino) UNA sola vez; después la vista queda libre para
 *  que el ciclista explore sin que nadie se la lleve. Rutas del
 *  velocímetro/minimapa no se enmarcan. */
function RouteFitter({
  route,
  pendingRef,
}: {
  route: NavRoute | null;
  pendingRef: { current: boolean };
}) {
  const map = useMap();
  useEffect(() => {
    if (!route || route.coords.length < 2 || !pendingRef.current) return;
    pendingRef.current = false;
    const b = L.latLngBounds(route.coords.map((p) => [p.lat, p.lon] as [number, number]));
    map.fitBounds(b, { padding: [44, 44], maxZoom: 16, animate: true });
  }, [route, map, pendingRef]);
  return null;
}

/** v1.12.10: cámara Waze del mapa grande. Mientras hay navegación activa
 *  sigue el pin con paneo continuo (≈ intervalo entre fixes); mientras el
 *  mapa está ROTADO (≠0°) el arrastre queda deshabilitado - Leaflet no
 *  entiende toques sobre un mapa girado - y se reactiva al volver a norte.
 *  El contenedor crece a 150% al rotar → invalidateSize. */
function NavCamara({
  position,
  navOn,
  rotado,
  locateTarget,
}: {
  position: LatLng | null;
  navOn: boolean;
  rotado: boolean;
  locateTarget: LatLng | null;
}) {
  const map = useMap();
  const skip = useRef(false);
  const zoomed = useRef(false);

  useEffect(() => {
    const onDrag = () => { skip.current = true; };
    map.on("dragstart", onDrag);
    return () => { map.off("dragstart", onDrag); };
  }, [map]);

  // el wrapper crece 100% ↔ 150% al rotar: recalcular el tamaño del lienzo
  useEffect(() => {
    map.invalidateSize();
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [rotado, map]);

  useEffect(() => {
    if (rotado) {
      map.dragging.disable();
    } else {
      map.dragging.enable();
      zoomed.current = false;
    }
  }, [rotado, map]);

  useEffect(() => {
    if (!navOn || !position || skip.current) return;
    const zoom = zoomed.current ? map.getZoom() : 17;
    zoomed.current = true;
    map.setView([position.lat, position.lon], zoom, { animate: true, duration: 0.9, easeLinearity: 1 });
  }, [position, navOn, map]);

  useEffect(() => {
    if (!locateTarget) return;
    skip.current = false;
  }, [locateTarget]);

  return null;
}

// ---- Capas del mapa: 7 menús desplegables (arquitectura GPX +
//      Paseo Metropolitano, cliente 2026-11-13) ----

type MenuCapa = {
  id: string;
  titulo: string;
  sub: string;
  emoji: string;
  /** ids de visibilidad que agrupa (para el conteo) */
  items: number;
};

const MENUS_CAPAS: MenuCapa[] = [
  { id: "accesos", titulo: "mapa.capaAccesos", sub: "mapa.capaAccesosSub", emoji: "🚪", items: CAPA_ACCESOS.length },
  { id: "rutas", titulo: "mapa.capaRutas", sub: "mapa.capaRutasSub", emoji: "🛣️", items: CAPA_RUTAS.length },
  { id: "senderos", titulo: "mapa.capaSenderos", sub: "mapa.capaSenderosSub", emoji: "🥾", items: CAPA_SENDEROS_PEATONALES.length },
  { id: "paseo-met", titulo: "mapa.capaPaseoMet", sub: "mapa.capaPaseoMetSub", emoji: "🛤️", items: CAPA_PASEO_METROPOLITANO.length },
  { id: "pois", titulo: "mapa.capaPois", sub: "mapa.capaPoisSub", emoji: "📍", items: CAPA_POIS.length },
  { id: "normativa", titulo: "mapa.capaNormativa", sub: "mapa.capaNormativaSub", emoji: "🛡️", items: CAPA_NORMATIVA.length },
  { id: "urbana", titulo: "mapa.capaUrbana", sub: "mapa.capaUrbanaSub", emoji: "🏙️", items: CAPA_URBANA.length },
  { id: "sectores", titulo: "mapa.capaSectores", sub: "mapa.capaSectoresSub", emoji: "🚨", items: SECTORES_EMERGENCIA.length },
];

/** Colores de burbuja por subcategoría de Puntos de Interés y por capa de puntos. */
const COLOR_SUB_POI: Record<CapaPunto["sub"], string> = {
  conexion: "#0891b2",
  servicio: "#16a34a",
  mirador: "#8b5cf6",
  precaucion: "#dc2626",
};
const COLOR_NORMATIVA = "#be123c";
const COLOR_URBANA = "#7c3aed";

/** Enfoque pedido desde el panel: centrar un punto o encuadrar una ruta. */
type Focus =
  | { kind: "punto"; p: LatLng }
  | { kind: "ruta"; coords: LatLng[] }
  | { kind: "control30"; coords: LatLng[] }
  | null;

/** Fase D: refleja el viewport del mapa para las consultas del
 *  catálogo (bbox en columnas del servidor — nunca en el cliente). */
function BboxReflector({ onMove }: { onMove: (b: BboxMapa) => void }) {
  const map = useMap();
  useEffect(() => {
    const leer = () => {
      const b = map.getBounds();
      onMove({ n: b.getNorth(), s: b.getSouth(), e: b.getEast(), o: b.getWest() });
    };
    leer();
    map.on("moveend zoomend", leer);
    return () => { map.off("moveend zoomend", leer); };
  }, [map, onMove]);
  return null;
}

/** Fase D: dibuja la geometría PROTEGIDA de una ruta pública sobre
 *  el mapa grande (la original jamás llegó al servidor). */
function RutaPublicaLayer({ sel }: { sel: RutaPublica | null }) {
  const map = useMap();
  useEffect(() => {
    if (!sel) return;
    const pts = polylineDecode(sel.polyline);
    const linea = L.polyline(pts.map((p) => [p.lat, p.lon] as [number, number]), { color: "#059669", weight: 5 }).addTo(map);
    if (sel.inicioAproxLat != null && sel.inicioAproxLon != null) {
      L.circle([sel.inicioAproxLat, sel.inicioAproxLon], { radius: 150, color: "#059669", weight: 1, fillOpacity: 0.15 }).addTo(map);
    }
    if (sel.finAproxLat != null && sel.finAproxLon != null) {
      L.circle([sel.finAproxLat, sel.finAproxLon], { radius: 150, color: "#059669", weight: 1, fillOpacity: 0.15 }).addTo(map);
    }
    map.fitBounds(linea.getBounds(), { padding: [30, 30] });
    return () => { linea.remove(); map.eachLayer((l) => { if (l instanceof L.Circle) l.remove(); }); };
  }, [map, sel]);
  return null;
}

/** Fase F (v2.1 §8): proyector de la ruta planificada — «Navegar» en
 *  una ficha proyecta aquí la geometría para seguirla pedaleando.
 *  LOCAL = tu copia completa; PÚBLICA = geometría protegida que el
 *  servidor ya entabló. Línea índigo punteada + extremos marcados;
 *  se encuadra al proyectar pero NO persigue al ciclista (el mapa
 *  no se envía solo: misma regla del resto de la app). */
function RutaProyectadaLayer({ sel }: { sel: RutaProyectada | null }) {
  const map = useMap();
  useEffect(() => {
    if (!sel || sel.coords.length < 2) return;
    const line = sel.coords.map((c) => [c.lat, c.lon] as [number, number]);
    const casing = L.polyline(line, { color: "#05070a", weight: 9, opacity: 0.75, interactive: false }).addTo(map);
    const linea = L.polyline(line, { color: "#6366f1", weight: 5.5, opacity: 0.95, dashArray: "12 8", lineCap: "round", lineJoin: "round" }).addTo(map);
    const ini = L.circleMarker(line[0], { radius: 7, color: "#fafafa", weight: 2, fillColor: "#22c55e", fillOpacity: 1 }).addTo(map);
    const fin = L.circleMarker(line[line.length - 1], { radius: 7, color: "#fafafa", weight: 2, fillColor: "#6366f1", fillOpacity: 1 }).addTo(map);
    map.fitBounds(linea.getBounds(), { padding: [40, 40] });
    return () => { casing.remove(); linea.remove(); ini.remove(); fin.remove(); };
  }, [map, sel]);
  return null;
}

function FocusHandler({ focus }: { focus: Focus }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    if (focus.kind === "punto") {
      map.flyTo([focus.p.lat, focus.p.lon], Math.max(map.getZoom(), 15.5), { duration: 0.8 });
    } else if (focus.coords.length > 1) {
      const b = L.latLngBounds(focus.coords.map((c) => [c.lat, c.lon] as [number, number]));
      map.fitBounds(b, { padding: [40, 40], maxZoom: 16, animate: true });
    }
  }, [focus, map]);
  return null;
}

/** Fila de punto dentro de un menú: emoji + nombre + botón para centrar el mapa. */
function FilaPunto({ p, color, onFocus }: { p: { nombre: string; detalle: string; emoji: string }; color: string; onFocus: () => void }) {
  useLang();
  return (
    <li className="flex items-center gap-1.5 py-1.5">
      <span aria-hidden className="shrink-0 text-[13px]">{p.emoji}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-xs text-foreground">{p.nombre}</span>
        <span className="block truncate text-[10px] text-muted-foreground">{p.detalle}</span>
      </span>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      <button
        onClick={onFocus}
        aria-label={t("mapa.centrarMapaEn", p.nombre)}
        title={t("mapa.centrarAqui")}
        className="shrink-0 rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:border-emerald-500 hover:text-emerald-600"
      >
        <Eye className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

/** Interruptor compacto Ver/Ocultar de una capa o ruta. */
function SwitchCapa({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  useLang();
  return (
    <button
      onClick={onClick}
      data-vercapa={label}
      aria-pressed={on}
      className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-bold transition ${
        on
          ? "border-emerald-500 bg-emerald-600 text-(--c30-on-accent)"
          : "border-border bg-background text-muted-foreground hover:border-emerald-500/60 hover:text-foreground"
      }`}
    >
      {on ? t("mapa.ocultar") : t("mapa.ver")}
    </button>
  );
}

/** Panel de capas flotante: 5 menús desplegables sobre el mapa general.
 *  Cada menú tiene su propio estado abierto (los toggle de cierre de
 *  un menú no cancelan la apertura de otro, que ocurría con un único
 *  «abierto» compartido). El panel colapsa a su fila de título para
 *  dejar el mapa limpio. */
function CapasPanel({
  vis,
  onVer,
  onFocus,
  onGenerarRuta,
  trazas,
  verTrazas,
  onVerTrazas,
  onEnfocarTraza,
  onNavegarTraza,
  onBorrarTraza,
  onCrearRutaTraza,
  onEditarBorrador,
  onAbrirBiblioteca,
  abierto,
  onToggleAbierto,
}: {
  vis: Record<string, boolean>;
  onVer: (id: string) => void;
  onFocus: (f: Focus) => void;
  onGenerarRuta?: (r: CapaRuta) => void;
  trazas?: TrazaGuardada[];
  verTrazas?: boolean;
  onVerTrazas?: () => void;
  onEnfocarTraza?: (tz: TrazaGuardada) => void;
  onNavegarTraza?: (tz: TrazaGuardada) => void;
  onBorrarTraza?: (tz: TrazaGuardada) => void;
  /** Fase B: crear una ruta (borrador) desde esta actividad/traza. */
  onCrearRutaTraza?: (tz: TrazaGuardada) => void;
  /** Fase B: continuar la edición de un borrador guardado. */
  onEditarBorrador?: (id: string) => void;
  /** Fase C: abrir la biblioteca de rutas. */
  onAbrirBiblioteca?: () => void;
  /** Rediseño Explorar: abierto/onToggle ahora los controla MapView —
   *  la orden «actividades» del módulo debe expandir «Mis trazados». */
  abierto: boolean;
  onToggleAbierto: () => void;
}) {
  useLang();
  return (
    <div className="rounded-xl border border-border bg-card/95 overflow-hidden shadow-md backdrop-blur" data-testid="capas-panel">
      <button
        onClick={onToggleAbierto}
        aria-expanded={abierto}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <Layers className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="text-xs font-bold text-foreground">{t("mapa.capasTitulo")}</span>
        {!abierto && <span className="text-[10px] text-muted-foreground">{t("mapa.capasSub")}</span>}
        <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abierto ? "" : "-rotate-90"}`} aria-hidden />
      </button>
      {abierto && (
        <div className="max-h-[38vh] overflow-y-auto px-2 pb-2">
        {MENUS_CAPAS.map((m) => {
          const on = vis[m.id] ?? false;
          const activos =
            m.id === "rutas"
              ? CAPA_RUTAS.filter((r) => vis[r.id]).length
              : on
                ? m.items
                : 0;
          return (
            <details
              key={m.id}
              data-capa={m.id}
              className="border-b border-border/50 last:border-0"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 px-1.5 py-2.5">
                <span aria-hidden className="text-[15px]">{m.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[13px] font-bold text-foreground">{t(m.titulo)}</span>
                    <span className="rounded-full bg-emerald-600/10 px-1.5 py-px text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300">
                      {m.items}
                    </span>
                    {activos > 0 && (
                      <span className="rounded-full bg-emerald-600 px-1.5 py-px text-[9.5px] font-bold text-(--c30-on-accent)">
                        {activos} {m.id === "rutas" ? t("mapa.dibujadas") : t("mapa.visibles")}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[10.5px] text-muted-foreground">{t(m.sub)}</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform details-chev" aria-hidden />
              </summary>

              <div className="px-1.5 pb-2.5">
                {m.id === "accesos" && (
                  <>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground">{t("mapa.accesosNota")}</p>
                      <SwitchCapa on={on} onClick={() => onVer("accesos")} label="accesos" />
                    </div>
                    <ul>
                      {CAPA_ACCESOS.map((a) => (
                        <FilaPunto key={a.id} p={{ nombre: a.nombre, detalle: a.detalle, emoji: "🚴" }} color="#065f46" onFocus={() => onFocus({ kind: "punto", p: a.position })} />
                      ))}
                    </ul>
                  </>
                )}

                {m.id === "rutas" && (
                  <>
                    <p className="mb-1 text-[10px] text-muted-foreground">{t("mapa.rutasNota")}</p>
                    <ul>
                      {CAPA_RUTAS.map((r) => {
                        const tr = rutaTrazado(r);
                        return (
                          <li key={r.id} className="flex items-center gap-1.5 py-1.5">
                            <span aria-hidden className="shrink-0 text-[13px]">{r.emoji}</span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-xs font-semibold text-foreground">{r.nombre}</span>
                                <span
                                  className={`shrink-0 rounded px-1 py-px text-[9px] font-bold ${
                                    r.tipo === "pavimento" ? "bg-sky-500/15 text-sky-700 dark:text-sky-300" : "bg-orange-500/15 text-orange-700 dark:text-orange-300"
                                  }`}
                                >
                                  {r.tipo === "pavimento" ? t("mapa.pavimento") : "MTB"}
                                </span>
                              </span>
                              <span className="block truncate text-[10px] text-muted-foreground">
                                {r.nivel} · {tr.distKm.toFixed(1)} km
                              </span>
                            </span>
                            <span className="h-2 w-4 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />
                            <SwitchCapa on={!!vis[r.id]} onClick={() => onVer(r.id)} label={r.id} />
                            {onGenerarRuta && (
                              <button
                                onClick={() => onGenerarRuta(r)}
                                aria-label={`Generar ruta: ${r.nombre}`}
                                title={t("mapa.generarRutaTitle")}
                                className="shrink-0 rounded border border-sky-700/60 px-1.5 py-1 text-[10px] font-semibold text-sky-700 hover:bg-sky-950/40 dark:text-sky-300"
                              >
                                {t("mapa.btnRuta")}
                              </button>
                            )}
                            <button
                              onClick={() => onFocus({ kind: "ruta", coords: tr.coords })}
                              aria-label={t("mapa.encuadrar", r.nombre)}
                              title={t("mapa.encuadrarRuta")}
                              className="shrink-0 rounded border border-border px-1.5 py-1 text-muted-foreground hover:border-emerald-500 hover:text-emerald-600"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}

                {m.id === "senderos" && (
                  <>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground">{t("mapa.senderosNota")}</p>
                      <SwitchCapa on={on} onClick={() => onVer("senderos")} label="senderos" />
                    </div>
                    <ul>
                      {CAPA_SENDEROS_PEATONALES.map((s) => (
                        <li key={s.id} className="flex items-center gap-1.5 py-1.5">
                          <span aria-hidden className="shrink-0 text-[13px]">🥾</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs text-foreground">{s.nombre}</span>
                            <span className="block truncate text-[10px] text-muted-foreground">{s.detalle}</span>
                          </span>
                          <span className="h-0.5 w-4 shrink-0" style={{ borderTop: "2px dashed #92400e" }} aria-hidden />
                          <button
                            onClick={() => onFocus({ kind: "ruta", coords: s.coords })}
                            aria-label={t("mapa.encuadrar", s.nombre)}
                            title={t("mapa.encuadrarSendero")}
                            className="shrink-0 rounded border border-border px-1.5 py-1 text-muted-foreground hover:border-emerald-500 hover:text-emerald-600"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {m.id === "paseo-met" && (
                  <>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground">
                        {t("mapa.paseoNota")}
                      </p>
                      <SwitchCapa on={on} onClick={() => onVer("paseo-met")} label="paseo-met" />
                    </div>
                    <ul>
                      {CAPA_PASEO_METROPOLITANO.map((pm) => (
                        <li key={pm.id} className="flex items-center gap-1.5 py-1.5">
                          <span aria-hidden className="shrink-0 text-[13px]">🚶‍♂️</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs text-foreground">{pm.nombre}</span>
                            <span className="block truncate text-[10px] text-muted-foreground">{pm.detalle}</span>
                          </span>
                          <span className="h-0.5 w-4 shrink-0" style={{ borderTop: "2px dashed #0d9488" }} aria-hidden />
                          <button
                            onClick={() => onFocus({ kind: "ruta", coords: pm.coords })}
                            aria-label={t("mapa.encuadrar", pm.nombre)}
                            title={t("mapa.encuadrarTramo")}
                            className="shrink-0 rounded border border-border px-1.5 py-1 text-muted-foreground hover:border-emerald-500 hover:text-emerald-600"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {m.id === "sectores" && (
                  <>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground">{t("mapa.sectoresNota")}</p>
                      <SwitchCapa on={on} onClick={() => onVer("sectores")} label="sectores" />
                    </div>
                    <ul>
                      {SECTORES_EMERGENCIA.map((sec) => (
                        <FilaPunto
                          key={sec.id}
                          p={{ nombre: `${sec.nombre} · ${t(sec.sectorKey)}`, detalle: `${t("sos.emergencias")} ${sec.telefono}`, emoji: sec.emoji }}
                          color={sec.color}
                          onFocus={() => onFocus({ kind: "punto", p: sec.polygon[Math.floor(sec.polygon.length / 2)] })}
                        />
                      ))}
                    </ul>
                  </>
                )}
                {m.id === "pois" && (
                  <>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground">{t("mapa.poisNota")}</p>
                      <SwitchCapa on={on} onClick={() => onVer("pois")} label="pois" />
                    </div>
                    {(["conexion", "servicio", "mirador", "precaucion"] as const).map((sub) => (
                      <div key={sub}>
                        <p className="mt-1 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground/80">
                          {SUB_ETIQUETAS[sub]}
                        </p>
                        <ul>
                          {CAPA_POIS.filter((p) => p.sub === sub).map((p) => (
                            <FilaPunto key={p.id} p={p} color={COLOR_SUB_POI[p.sub]} onFocus={() => onFocus({ kind: "punto", p: p.position })} />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </>
                )}

                {m.id === "normativa" && (
                  <>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground">{t("mapa.normativaNota")}</p>
                      <SwitchCapa on={on} onClick={() => onVer("normativa")} label="normativa" />
                    </div>
                    <ul>
                      {CAPA_NORMATIVA.map((p) => (
                        <FilaPunto
                          key={p.id}
                          p={p}
                          color={COLOR_NORMATIVA}
                          onFocus={() =>
                            p.id === "control-30"
                              ? onFocus({ kind: "control30", coords: BAJADAS_30.flatMap((b) => b.coords) })
                              : onFocus({ kind: "punto", p: p.position })
                          }
                        />
                      ))}
                    </ul>
                  </>
                )}

                {m.id === "urbana" && (
                  <>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground">{t("mapa.urbanaNota")}</p>
                      <SwitchCapa on={on} onClick={() => onVer("urbana")} label="urbana" />
                    </div>
                    <ul>
                      {CAPA_URBANA.map((p) => (
                        <FilaPunto key={p.id} p={p} color={COLOR_URBANA} onFocus={() => onFocus({ kind: "punto", p: p.position })} />
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </details>
          );
        })}

        {/* v1.13.15 - Mis trazados: rutas y segmentos guardados por el
            ciclista desde los botones «Trazar ruta» / «Trazar segmento».
            Un segmento, además, corre en las estadísticas (intentos). */}
        <details data-capa="mias" className="border-b border-border/50 last:border-0">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-1.5 py-2.5">
            <span aria-hidden className="text-[15px]">🧭</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold text-foreground">{t("tra.capasTitulo")}</span>
                <span className="rounded-full bg-emerald-600/10 px-1.5 py-px text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300">
                  {(trazas ?? []).length}
                </span>
              </span>
              <span className="block truncate text-[10.5px] text-muted-foreground">{t("tra.capasSub")}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform details-chev" aria-hidden />
          </summary>
          <div className="px-1.5 pb-2.5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-[10px] text-muted-foreground">{t("tra.capasNota")}</p>
              <SwitchCapa on={!!verTrazas} onClick={() => onVerTrazas?.()} label="mias" />
            </div>
            {(trazas ?? []).length === 0 ? (
              <p className="py-1 text-[10.5px] leading-snug text-muted-foreground">{t("tra.capasVacio")}</p>
            ) : (
              <ul>
                {(trazas ?? []).map((tz) => (
                  <li key={tz.id} className="flex items-center gap-1.5 py-1.5">
                    <span aria-hidden className="shrink-0 text-[13px]">{tz.kind === "ruta" ? "🛣️" : "🏁"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-foreground">{tz.nombre}</span>
                        <span
                          className={`shrink-0 rounded px-1 py-px text-[9px] font-bold ${
                            tz.kind === "ruta" ? "bg-orange-500/15 text-orange-700 dark:text-orange-300" : "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
                          }`}
                        >
                          {tz.kind === "ruta" ? t("tra.tipoRuta") : t("tra.tipoSegmento")}
                        </span>
                        {tz.origen === "gpx" && (
                          <span className="shrink-0 rounded px-1 py-px text-[9px] font-bold text-muted-foreground border border-border">GPX</span>
                        )}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {tz.distKm.toFixed(1)} km{tz.gainM > 0 ? ` · +${tz.gainM} m` : ""}
                      </span>
                    </span>
                    <button
                      onClick={() => onEnfocarTraza?.(tz)}
                      aria-label={t("tra.encuadrar", tz.nombre)}
                      title={t("tra.encuadrarTitle")}
                      className="shrink-0 rounded border border-border px-1.5 py-1 text-muted-foreground hover:border-emerald-500 hover:text-emerald-600"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    {tz.kind === "ruta" && onNavegarTraza && (
                      <button
                        onClick={() => onNavegarTraza(tz)}
                        aria-label={t("tra.navegar", tz.nombre)}
                        title={t("tra.navegarTitle")}
                        className="shrink-0 rounded border border-border px-1.5 py-1 text-muted-foreground hover:border-sky-500 hover:text-sky-600"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {onCrearRutaTraza && (
                      <button
                        onClick={() => onCrearRutaTraza(tz)}
                        aria-label={t("edi.crearDesdeAria", tz.nombre)}
                        title={t("edi.crearDesdeTitle")}
                        className="shrink-0 rounded border border-border px-1.5 py-1 text-muted-foreground hover:border-violet-500 hover:text-violet-600"
                        data-testid={`crear-ruta-desde-${tz.id}`}
                      >
                        <PencilRuler className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onBorrarTraza?.(tz)}
                      aria-label={t("mapa.eliminar")}
                      title={t("mapa.eliminar")}
                      className="shrink-0 rounded border border-border px-1.5 py-1 text-muted-foreground hover:border-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
        {/* Fase B: borradores de ruta del editor (c30.rutas-v2). */}
        <ListaBorradores onEditar={onEditarBorrador} onAbrirBiblioteca={onAbrirBiblioteca} />
        </div>
      )}
    </div>
  );
}

// ---- Barra de direcciones flotante (buscador Cumbre30 Pro) ----
// Compacta: sólo la barra sobre el mapa; los resultados aparecen
// como menú desplegable SOLO mientras se escribe (sin listas fijas
// debajo, según el nuevo diseño de la pantalla Explorar).

function SearchCard({
  pro,
  marks,
  position,
  dest,
  route,
  routeLoading,
  routeNote,
  onSetDest,
  onProLocked,
  onMarkPoi,
  onRemoveMark,
}: {
  pro: boolean;
  marks: { id: string; name: string; lat: number; lon: number }[];
  position: LatLng | null;
  dest: NavDest | null;
  route: NavRoute | null;
  routeLoading: boolean;
  routeNote: string | null;
  onSetDest?: (d: NavDest | null) => void;
  onProLocked?: (feature: ProLockFeature) => void;
  onMarkPoi: (name: string, p: LatLng) => void;
  onRemoveMark: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [addr, setAddr] = useState<AddrResult[]>([]);
  const [addrSearching, setAddrSearching] = useState(false);
  const [addrOffline, setAddrOffline] = useState(false);
  useLang();

  // Sólo con consulta activa se muestran resultados (nada de listas fijas)
  const nq = normalizeForSearch(query);
  const activa = query.trim().length >= 2;
  const dests = NAV_DESTINATIONS.filter((d) => activa && normalizeForSearch(d.name).includes(nq));
  const mine = marks.filter((m) => activa && normalizeForSearch(m.name).includes(nq));

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

  /** Elegir destino: el motor de navegación traza la ruta solo.
   *  esAcceso (v1.12.9): el destino es uno de los 4 accesos ciclistas →
   *  ruta DIRECTA por la calle, sin desvío por el acceso más cercano. */
  const esAccesoId = (id: string) => CAPA_ACCESOS.some((a) => a.id === id);
  const traceTo = (name: string, p: LatLng, esAcceso = false) => {
    onSetDest?.({ name, position: p, esAcceso });
    setQuery("");
  };

  const hayResultados = activa && (dests.length > 0 || mine.length > 0 || addr.length > 0 || addrSearching || addrOffline);

  const chipDestino = dest && onSetDest && (
    <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-sky-700/60 bg-card/95 px-2.5 py-1.5 text-[11px] text-foreground shadow-sm">
      <Flag className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
      <span className="min-w-0 flex-1 truncate">
        {route
          ? t("mapa.chipDestino", dest.name, (route.distanceM / 1000).toFixed(1), route.etaMin)
          : t("mapa.rutaA", dest.name)}
      </span>
      <button
        onClick={() => onSetDest(null)}
        className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-red-400 hover:text-red-500"
      >
        {t("mapa.quitarRuta")}
      </button>
    </div>
  );

  const avisos = (
    <>
      {routeLoading && (
        <p className="mt-1 text-[11px] text-muted-foreground animate-pulse drop-shadow">{t("mapa.trazando", dest?.name ?? "")}</p>
      )}
      {!routeLoading && dest && routeNote && (
        <p className="mt-1 rounded-lg bg-card/95 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-300">{routeNote}</p>
      )}
    </>
  );

  if (!pro) {
    // FREE: la barra es el mensaje Pro (badge PRO) - al tocarla abre el
    // modal contextual con el beneficio real, sin sacar del mapa.
    return (
      <div className="relative">
        <button
          onClick={() => onProLocked?.("buscador")}
          className="flex w-full items-center gap-2 rounded-xl border border-border bg-card/95 px-2.5 py-2.5 text-left shadow-md backdrop-blur hover:border-emerald-500/60"
          aria-label={t("mapa.buscadorProAria")}
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {t("mapa.freeBuscar")}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            <Crown className="h-2.5 w-2.5" /> PRO
          </span>
        </button>
        {chipDestino}
        {avisos}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card/95 px-2.5 py-2 shadow-md backdrop-blur">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const a = addr[0];
              if (a) traceTo(a.name, { lat: a.lat, lon: a.lon });
              else if (dests[0]) traceTo(dests[0].name, dests[0].position, esAccesoId(dests[0].id));
            }
          }}
          placeholder={t("mapa.buscarPlaceholder")}
          aria-label={t("mapa.buscarAria")}
          className="w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label={t("mapa.limpiarBusqueda")} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {chipDestino}
      {avisos}

      {hayResultados && (
        <div className="absolute inset-x-0 top-full mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-card/95 shadow-lg backdrop-blur">
          <ul className="p-1.5">
            {dests.map((d) => (
              <li key={d.id} className="flex items-center gap-1.5 border-b border-border/50 py-1.5 last:border-0">
                <button
                  onClick={() => traceTo(d.name, d.position, esAccesoId(d.id))}
                  className="min-w-0 flex-1 truncate text-left text-xs text-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
                  title={t("mapa.trazarAqui")}
                >
                  {d.name}
                </button>
                <button
                  onClick={() => onMarkPoi(d.name, d.position)}
                  className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-emerald-500 hover:text-emerald-500"
                  title={t("mapa.guardarLugar")}
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
                  title={t("mapa.trazarAqui")}
                >
                  📍 {m.name} <span className="text-[10px] text-muted-foreground">{t("mapa.miLugar")}</span>
                </button>
                <button
                  onClick={() => onRemoveMark(m.id)}
                  className="shrink-0 text-muted-foreground/70 hover:text-red-500"
                  aria-label={t("mapa.eliminarNombre", m.name)}
                  title={t("mapa.eliminarMarcador")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
            {(addr.length > 0 || addrSearching) && (
              <li className="pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("mapa.direcciones")}{addrSearching ? t("mapa.buscando") : ""}
              </li>
            )}
            {addr.map((a) => (
              <li key={a.id} className="flex items-center gap-1.5 border-b border-border/50 py-1.5 last:border-0">
                <button
                  onClick={() => traceTo(a.name, { lat: a.lat, lon: a.lon })}
                  className="min-w-0 flex-1 text-left hover:text-emerald-600 dark:hover:text-emerald-400"
                  title={t("mapa.trazarAqui")}
                >
                  <span className="block truncate text-xs text-foreground">
                    {a.emoji} {a.name}
                  </span>
                  {a.detail && <span className="block truncate text-[10px] text-muted-foreground">{a.detail}</span>}
                </button>
                <button
                  onClick={() => onMarkPoi(a.name, { lat: a.lat, lon: a.lon })}
                  className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-emerald-500 hover:text-emerald-500"
                  title={t("mapa.guardarLugar")}
                >
                  📍
                </button>
              </li>
            ))}
            {addrSearching && addr.length === 0 && (
              <li className="py-2 text-center text-xs text-muted-foreground animate-pulse">{t("mapa.buscandoDirecciones")}</li>
            )}
            {addrOffline && (
              <li className="py-2 text-center text-[11px] text-amber-700 dark:text-amber-300">
                {t("mapa.sinConexionDirecciones")}
              </li>
            )}
            {dests.length === 0 && mine.length === 0 && addr.length === 0 && !addrSearching && !addrOffline && activa && (
              <li className="py-2 text-center text-xs text-muted-foreground">{t("mapa.sinResultados", query)}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---- Piezas compartidas web/nativo del mapa grande ----

function MapLegend({ className }: { className: string }) {
  useLang();
  return (
    <div className={className}>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-emerald-500/50 border border-emerald-400" /> {t("mapa.leyendaParque")}</div>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-emerald-500" /> {t("mapa.leyendaCiclovia")}</div>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm" style={{ background: "#0ea5e9" }} /> {t("mapa.leyendaPavimento")}</div>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm" style={{ background: "#f97316" }} /> {t("mapa.leyendaMtb")}</div>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm" style={{ background: "#a855f7" }} /> {t("mapa.leyendaCicloRuta")}</div>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm" style={{ background: "#f4f4f5" }} /> {t("mapa.leyendaCompartida")}</div>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-lime-400" /> {t("mapa.leyendaRecorrido")}</div>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-amber-500" /> {t("mapa.leyendaZonas")}</div>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-zinc-600" /> {t("mapa.leyendaIncidencias")}</div>
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
  useLang();
  return (
    <div className={className}>
      {pending ? (
        <div>
          <div className="font-semibold mb-1.5">{t("mapa.queEncontraste")}</div>
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
              {t("mapa.cancelar")}
            </button>
          </div>
        </div>
      ) : (
        status
      )}
    </div>
  );
}

export default function MapView({ track, position, accuracyM, heading, userPin, route, dest, navLoading, navNote, onSetDest, onProLocked, orden }: Props) {
  const lang = useLang(); // re-render al cambiar el idioma
  // Mapa SIEMPRE claro (pedido del cliente): los tiles OSM se muestran
  // blancos tipo Google Maps aunque el resto de la app esté en tema
  // oscuro. El filtro nocturno (clase map-dark, invert+hue-rotate en
  // globals.css) se retiró en v1.14.3.
  const [net, setNet] = useState<Network | null>(null);
  const incidents = useIncidentFeed();
  const [reportMode, setReportMode] = useState(false);
  const [pending, setPending] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [locateTarget, setLocateTarget] = useState<LatLng | null>(null);
  // Buscador Pro: consulta y marcadores personales
  const { pro } = useProLicense();
  const marks = useMarks();
  // v1.13.15: creador de trazados - «Trazar ruta» y «Trazar segmento»
  // (el segmento, además de guardarse, corre en las estadísticas).
  const trazar = useCreadorTrazas();
  // Fase B: editor de rutas del módulo (multi-waypoint, POIs,
  // metadatos, borradores y export GPX) — no toca el creador de trazados.
  const editor = useEditorRutas();
  // Fase C: biblioteca de rutas (cuatro secciones + ficha completa).
  const [bibliotecaAbierta, setBibliotecaAbierta] = useState(false);
  // Fase D: publicación (vista previa) + ruta pública sobre el mapa.
  const [publicarId, setPublicarId] = useState<string | null>(null);
  const [rutaPublicaSel, setRutaPublicaSel] = useState<RutaPublica | null>(null);
  const bboxRef = useRef<BboxMapa | null>(null);
  const getBbox = useCallback(() => bboxRef.current, []);
  /** Encuadra una ruta v2 (borrador o migrada) en el mapa. */
  const encuadrarRuta = (r: { id: string; coords: { lat: number; lon: number }[] }) => {
    setTrazaSel(r.id);
    setFocus({ kind: "ruta", coords: r.coords });
  };
  const trazas = useTrazas();
  const [verTrazas, setVerTrazas] = useState(true);
  const [trazaSel, setTrazaSel] = useState<string | null>(null);
  // Rediseño Explorar: sección de la biblioteca pedida desde el módulo
  // (Mis rutas → «mias», Guardados → «favoritas») y estado del panel
  // de capas, ahora controlado por MapView para la orden «actividades».
  const [bibliotecaTab, setBibliotecaTab] = useState<"mias" | "catalogo" | "favoritas" | "recientes">("mias");
  const [capasAbierto, setCapasAbierto] = useState(true);
  // Selector de GPX a nivel raíz: la orden «importar-gpx» llega aunque
  // el panel del editor esté cerrado; el input vive oculto y reutiliza
  // el importador real del editor (ctrl.importarGpx).
  const gpxRef = useRef<HTMLInputElement | null>(null);
  const ordenAplicadaRef = useRef(0);
  useEffect(() => {
    if (!orden || orden.n === ordenAplicadaRef.current) return;
    ordenAplicadaRef.current = orden.n;
    switch (orden.tipo) {
      case "biblioteca":
        setBibliotecaTab(orden.tabBiblioteca ?? "mias");
        setBibliotecaAbierta(true);
        break;
      case "trazar-ruta":
        trazar.empezar("ruta");
        break;
      case "trazar-segmento":
        trazar.empezar("segmento");
        break;
      case "importar-gpx":
        // El importador exige el editor activo: se abre la sesión y,
        // en el mismo toque, el diálogo de archivo.
        editor.empezar();
        gpxRef.current?.click();
        break;
      case "actividades":
        setCapasAbierto(true);
        setVerTrazas(true);
        break;
      case "ver-ruta":
        setRutaPublicaSel(orden.rutaPublica ?? null);
        break;
      case "navegar-ruta":
        if (orden.rutaLocal) {
          // Proyector (fase F): la COPIA LOCAL se proyecta completa —
          // jamás sale del dispositivo (v2.1 §3/§8).
          rutaProyectadaStore.set({
            routeId: orden.rutaLocal.id,
            serverId: orden.rutaLocal.serverId ?? null,
            nombre: orden.rutaLocal.nombre,
            coords: orden.rutaLocal.coords,
            origen: "local",
          });
        }
        break;
      case "encuadrar":
        if (orden.rutaLocal) {
          setTrazaSel(orden.rutaLocal.id);
          setFocus({ kind: "ruta", coords: orden.rutaLocal.coords });
        }
        break;
      case "editar-borrador":
        if (orden.rutaLocal) editor.editarBorrador(orden.rutaLocal.id);
        break;
      case "publicar":
        if (orden.rutaLocal) setPublicarId(orden.rutaLocal.id);
        break;
      case "desde-traza":
        if (orden.traza) editor.desdeActividad(orden.traza);
        break;
      case "ir-inicio":
        if (orden.rutaPublica && orden.rutaPublica.inicioAproxLat != null && orden.rutaPublica.inicioAproxLon != null && onSetDest) {
          handleSetDest({ name: orden.rutaPublica.nombre, position: { lat: orden.rutaPublica.inicioAproxLat, lon: orden.rutaPublica.inicioAproxLon } });
        }
        break;
    }
  }, [orden, trazar, editor, onSetDest]);
  // Fase F: ruta proyectada («Navegar» en fichas) — estado global del
  // dispositivo; el ride la vincula (routeRef) al cerrarse.
  const proyectada = useRutaProyectada();
  /** Enfoca una traza guardada en el mapa (fitBounds a su línea). */
  const enfocarTraza = (tz: TrazaGuardada) => {
    setTrazaSel(tz.id);
    setFocus({ kind: "ruta", coords: tz.coords });
  };
  /** Navega una ruta guardada: destino = su último punto (el motor
      estándar traza desde tu ubicación, con sus reglas y avisos). */
  const navegarTraza = (tz: TrazaGuardada) => {
    if (!onSetDest || tz.coords.length === 0) return;
    handleSetDest({ name: tz.nombre, position: tz.coords[tz.coords.length - 1] });
  };
  // Encuadre único de la ruta recién trazada desde el buscador
  const pendingFitRef = useRef(false);
  // v1.12.10: cámara Waze del mapa grande - con navegación activa
  // (destino + ruta + ride grabándose) el mapa gira al rumbo y sigue
  // el pin (la ruta se ve recta, como en Waze). Sin ride: vista libre.
  const navOn = !!(dest && route && route.coords.length > 1 && track.length > 1);
  const { modo: modoCamara, mapBearing, routeBearing, setModo: setModoCamara } = useCamaraRumbo({ activa: navOn, heading, route, position });
  const rotado = mapBearing !== 0;
  // v1.13.10: la flecha del pin apunta al rumbo de la RUTA si la hay -
  // el mismo rumbo que lleva la cámara (route-first, unificado con el
  // minimapa): en rumbo se ve hacia ARRIBA; course GPS sólo sin ruta.
  const rumboPin = routeBearing ?? heading ?? (modoCamara === "rumbo" ? mapBearing : null);
  // Capas del mapa (arquitectura GPX): visibilidad por capa/ruta
  const [capasVis, setCapasVis] = useState<Record<string, boolean>>({ accesos: true, senderos: true, "paseo-met": true, sectores: true });
  const [focus, setFocus] = useState<Focus>(null);
  const last = track.length > 0 ? track[track.length - 1] : null;
  // Sin fix aún: el centro por defecto es el parque. Con fix GPS la
  // vista NO salta sola a tu ubicación (cliente 2026-11-12): la
  // centras tú con el botón «Centrar en mi ubicación».
  const center = last ?? position ?? { lat: -33.408, lon: -70.636 };
  // Mapa nativo (MapLibre Native) o Leaflet en la web
  // v1.13.5 - NATIVE_MAPS_ENABLED=false: vuelva al modo compatibilidad
  // (Leaflet ráster), el único con uso comprobado en el WebView del
  // dispositivo desde v1.3.1. Los intentos de reactivar el nativo en
  // v1.13.2 (MapLibre 13.7.1/Vulkan) y v1.13.4 (13.7.1-opengl/GL ES)
  // quedaron negros en el teléfono, igual que el GL JS web desde v1.3.1:
  // el WebView de ese equipo no dibuja GL de ningún backend. El código
  // nativo queda dormido; el diagnóstico (Configuración → Acerca de)
  // reporta la GPU real para un próximo intento con datos.
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
    // En el APK (export estático) /api no existe localmente: va al
    // backend de la web (backendOrigin); si no hay backend configurado,
    // el reporte queda local para sincronizarse más tarde.
    const url = apiUrl("/api/incidents");
    if (!url) {
      guardarLocal(payload);
      setStatus(t("mapa.sinConexionLocal"));
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
      setStatus(t("mapa.registradaOk"));
    } catch {
      guardarLocal(payload);
      setStatus(t("mapa.sinConexionLocal"));
    }
    setTimeout(() => setStatus(null), 5000);
  };

  /** Guarda la incidencia solo en el dispositivo (offline / APK). */
  const guardarLocal = (payload: { type: IncidentTypeId; lat: number; lon: number }) => {
    const local: IncidentItem = {
      id: crypto.randomUUID(),
      ...payload,
      note: null,
      createdAt: new Date().toISOString(),
      username: t("mapa.tuLocal"),
      authorPin: userPin ?? DEFAULT_PIN,
      mine: true,
      localOnly: true,
      confirmCount: 0,
      resolvedCount: 0,
      lastConfirmAt: null,
    };
    addIncident(local);
    // persistir en la lista local
    saveLocalIncidents([local, ...loadLocalIncidents()]);
  };

  const deleteIncident = async (inc: IncidentItem) => {
    if (inc.localOnly) {
      removeIncident(inc.id);
      return;
    }
    try {
      const url = apiUrl(`/api/incidents?id=${encodeURIComponent(inc.id)}`);
      if (url) await fetch(url, { method: "DELETE" });
      removeIncident(inc.id);
    } catch {
      setStatus(t("mapa.errEliminar"));
      setTimeout(() => setStatus(null), 4000);
    }
  };

  /** Canal ciudadano: mensaje listo para los canales oficiales. */
  const enviarAParquemet = async (inc: IncidentItem) => {
    const res = await compartirReporte(inc.type as IncidentTypeId, inc.lat, inc.lon, inc.createdAt);
    if (res === "copied") {
      setStatus(t("mapa.mensajeCopiado"));
      setTimeout(() => setStatus(null), 6000);
    }
  };

  /** v1.13.14: denuncia de contenido inapropiado (política UGC de Google
   *  Play). Desaparece del teléfono del denunciante al instante; con 2
   *  denuncias el servidor la cierra para todos. */
  const reportarIncidente = async (inc: IncidentItem) => {
    const r = await voteIncident(inc.id, "report");
    setStatus(r.ok ? t("mapa.reportadaOk") : t("mapa.reportadaLocal"));
    setTimeout(() => setStatus(null), 5000);
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
          setStatus(t("mapa.errUbicacion"));
          setTimeout(() => setStatus(null), 4000);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  // --- Marcadores personales (Pro): guardar POI o punto tocado ---
  const markPoi = (name: string, p: LatLng) => {
    addMark(name, p);
    setStatus(t("mapa.guardadoLugar", name));
    setTimeout(() => setStatus(null), 4000);
  };

  /** Destino desde el buscador/marcadores/capas: cuando llegue la ruta se
   *  encuadra entera UNA vez (RouteFitter) y luego la vista queda libre
   *  para el ciclista. Las rutas del velocímetro no se enmarcan. */
  const handleSetDest = (d: NavDest | null) => {
    if (d) pendingFitRef.current = true;
    onSetDest?.(d);
  };

  /** «Ruta» en la capa Rutas: genera la navegación de una ruta predefinida.
   *  Regla del cliente: entra por el acceso ciclista más cercano y sigue la
   *  ruta dentro del cerro (computePresetRoute en el motor de navegación).
   *  Además dibuja el trazado de fondo y lo encuadra una vez. */
  const generarRuta = (r: CapaRuta) => {
    const tr = rutaTrazado(r);
    if (tr.coords.length < 2) return;
    if (!position) {
      setStatus(t("mapa.activaGps"));
      setTimeout(() => setStatus(null), 4500);
      return;
    }
    setCapasVis((prev) => ({ ...prev, [r.id]: true }));
    setFocus({ kind: "ruta", coords: tr.coords });
    handleSetDest({
      name: r.nombre,
      position: tr.coords[tr.coords.length - 1],
      preset: { rutaId: r.id, nombre: r.nombre },
    } as NavDest);
  };

  /** Ver/ocultar una capa o ruta. Al dibujar una ruta se encuadra
   *  completa una vez (FocusHandler); la vista no vuelve sola a nadie. */
  const toggleCapa = (id: string) => {
    const willBeOn = !capasVis[id];
    setCapasVis((prev) => ({ ...prev, [id]: !prev[id] }));
    if (willBeOn) {
      const r = CAPA_RUTAS.find((x) => x.id === id);
      if (r) {
        const t = rutaTrazado(r);
        if (t.coords.length > 1) setFocus({ kind: "ruta", coords: t.coords });
      }
    }
  };

  const enfocar = (f: Focus) => {
    // Control 30 km/h: no tiene punto en el mapa (cliente 2026-11-13,
    // «dejar sólo en la capa») - al elegirlo se activa la capa Normativa
    // y se enmarcan los 3 corredores rojos de las bajadas.
    if (f && f.kind === "control30") {
      setCapasVis((prev) => ({ ...prev, normativa: true }));
      setFocus({ kind: "ruta", coords: f.coords });
      return;
    }
    setFocus(f);
  };

  /** Marcadores de una capa de puntos con popup (nombre, detalle y «Ruta aquí»). */
  const puntoMarkers = (pts: CapaPuntoBase[], colorOf: (pt: CapaPuntoBase) => string) =>
    pts
      // Items con sinMarcador (control 30 km/h) se listan en la capa pero
      // no se pintan: su representación son los trazados rojos.
      .filter((pt) => !pt.sinMarcador)
      .map((pt) => (
          <Marker key={pt.id} position={[pt.position.lat, pt.position.lon]} icon={poiIcon(pt.emoji, colorOf(pt), mapBearing)}>
        <Popup>
          <div className="min-w-[190px] text-[13px]">
            <div className="font-semibold mb-0.5">
              {pt.emoji} {pt.nombre}
            </div>
            <div className="text-zinc-600 text-[12px]">{pt.detalle}</div>
            {onSetDest && (
              <button
                onClick={() => handleSetDest({ name: pt.nombre, position: pt.position })}
                className="mt-1.5 font-medium text-sky-600 hover:underline"
              >
                {t("mapa.rutaAqui")}
              </button>
            )}
          </div>
        </Popup>
      </Marker>
    ));

  // Ciclovías: SOLO las que están dentro del cerro (≥50% de sus puntos
  // dentro del polígono del parque) - el resto se omite por orden.
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
        const tipo = INCIDENT_BY_ID[inc.type] ?? INCIDENT_BY_ID.otro;
        const fecha = new Date(inc.createdAt).toLocaleString("es-CL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const voto = incidentVoteOf(inc.id);
        const confirmaciones = inc.confirmCount;
        const resueltos = inc.resolvedCount;
        return (
          <Marker key={inc.id} position={[inc.lat, inc.lon]} icon={incidentIcon(inc.type, mapBearing)}>
            <Popup>
              <div className="min-w-[190px] text-[13px]">
                <div className="font-semibold mb-0.5">
                  {tipo.emoji} {tipo.label}
                </div>
                <div className="text-zinc-600">
                  {t("mapa.registrada")} <b>{fecha}</b>
                </div>
                <div className="text-zinc-600">
                  {t("mapa.reporto")} {pinEmoji(inc.authorPin)} {inc.username}
                  {inc.localOnly ? ` ${t("mapa.soloLocal")}` : ""}
                </div>
                {inc.note && <div className="mt-1 italic">“{inc.note}”</div>}
                {!inc.mine && (confirmaciones > 0 || resueltos > 0) && (
                  <div className="mt-1 text-[11.5px] text-zinc-600">
                    {confirmaciones > 0 && <span>✔ {t("mapa.confirman", confirmaciones)} · </span>}
                    {resueltos > 0 && <span>✓ {t("mapa.loResolvieron", resueltos)}</span>}
                  </div>
                )}
                {!inc.mine && (
                  <div className="mt-2 flex items-center gap-3">
                    {voto === "confirm" ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" /> {t("mapa.confirmada")}
                      </span>
                    ) : (
                      <button
                        onClick={() => void voteIncident(inc.id, "confirm")}
                        className="inline-flex items-center gap-1 font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> {t("mapa.sigueAhi")}
                      </button>
                    )}
                    {voto === "resolved" ? (
                      <span className="inline-flex items-center gap-1 font-medium text-zinc-500">
                        <Check className="h-3.5 w-3.5" /> {t("mapa.resuelta")}
                      </span>
                    ) : (
                      <button
                        onClick={() => void voteIncident(inc.id, "resolved")}
                        className="inline-flex items-center gap-1 text-zinc-600 font-medium hover:underline dark:text-zinc-400"
                      >
                        <Check className="h-3.5 w-3.5" /> {t("mapa.yaResuelto")}
                      </button>
                    )}
                    {/* v1.13.14: denuncia UGC - el popup ya no vuelve a
                        ofrecerse (la incidencia sale del feed local). */}
                    {voto !== "resolved" && (
                      <button
                        onClick={() => void reportarIncidente(inc)}
                        className="inline-flex items-center gap-1 text-zinc-500 font-medium hover:underline dark:text-zinc-400"
                        title={t("mapa.reportarTitulo")}
                      >
                        <Flag className="h-3.5 w-3.5" /> {t("mapa.reportar")}
                      </button>
                    )}
                  </div>
                )}
                {inc.mine && (
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={() => void enviarAParquemet(inc)}
                      className="inline-flex items-center gap-1 font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      <Share2 className="h-3.5 w-3.5" /> {t("rep.enviarParquemet")}
                    </button>
                    <button
                      onClick={() => deleteIncident(inc)}
                      className="inline-flex items-center gap-1 text-red-600 font-medium hover:underline"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> {t("mapa.eliminar")}
                    </button>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      }),

    [incidents, userPin, lang]
  );

  // ---- Mapa NATIVO (MapLibre Native): UI HTML alrededor del lienzo ----
  if (nativeMap) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={locate}
            aria-label={t("mapa.localizarme")}
            title={t("mapa.centrarUbicacion")}
            className="h-10 w-10 rounded-lg bg-background border border-border text-foreground flex items-center justify-center"
          >
            <Crosshair className="h-5 w-5" />
          </button>
          <button
            onClick={() => setReportMode((v) => !v)}
            aria-label={t("mapa.reportarAria")}
            title={t("mapa.reportarTitle")}
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
          {/* Atribución ODbL (v1.13.2): el MapView nativo es fullscreen bajo
              el backdrop, así que su atribución interna queda bajo la UI.
              La exigida por la ODbL va FIJA aquí, como en la web. */}
          <div
            className="absolute bottom-0 right-0 z-[800] rounded-tl-md bg-white/85 px-1.5 py-0.5 text-[10px] leading-tight text-zinc-800"
            style={{ pointerEvents: "none" }}
          >
            &copy;{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline" style={{ pointerEvents: "auto" }}>
              OpenStreetMap
            </a>{" "}
            contributors ·{" "}
            <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer" className="underline" style={{ pointerEvents: "auto" }}>
              ODbL
            </a>
          </div>
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

        {reportMode && !pending && <p className="text-xs text-amber-700/90 dark:text-amber-300/90">{t("mapa.reportarHint")}</p>}

        <MapLegend className="rounded-lg bg-background border border-border px-3 py-2 text-[11px] text-foreground/90 space-y-1" />

        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("mapa.nativoNota")}
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 w-full flex-1" data-testid="mapa-explorar">
      {/* Rediseño Explorar: selector de GPX a nivel raíz — la orden
          «importar-gpx» del módulo lo abre aunque el editor esté
          cerrado; el archivo entra por el importador real del editor. */}
      <input
        ref={gpxRef}
        type="file"
        accept=".gpx"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) editor.importarGpx(f);
          e.target.value = "";
        }}
      />
      {/* Barra de direcciones flotante (arriba): sólo barra + mensaje Pro */}
      <div className="absolute inset-x-2 top-2 z-[700]">
        <SearchCard
          pro={pro.active}
          marks={marks}
          position={position}
          dest={dest}
          route={route}
          routeLoading={!!navLoading}
          routeNote={navNote ?? null}
          onSetDest={handleSetDest}
          onProLocked={onProLocked}
          onMarkPoi={markPoi}
          onRemoveMark={removeMark}
        />
      </div>

      {/* Capas del mapa flotantes (abajo): 5 menús desplegables + generar ruta.
          bottom 104px = nav real (~69 px) + holgura y espacio para que la
          etiqueta de atribución (OpenStreetMap contributors) quede legible
          debajo (queja del cliente 2026-11-17: la barra tapaba la etiqueta);
          antes quedaba a 80 y tapaba la barra inferior al hacer scroll el
          documento (queja del cliente 2026-11-11: "al mover la búsqueda o el
          botón de capas se superpone a la información"). */}
      <div className="absolute inset-x-2 bottom-[calc(104px+env(safe-area-inset-bottom))] z-[690]">
        <CapasPanel
          abierto={capasAbierto}
          onToggleAbierto={() => setCapasAbierto((v) => !v)}
          vis={capasVis}
          onVer={toggleCapa}
          onFocus={enfocar}
          onGenerarRuta={generarRuta}
          trazas={trazas}
          verTrazas={verTrazas}
          onVerTrazas={() => setVerTrazas((v) => !v)}
          onEnfocarTraza={enfocarTraza}
          onNavegarTraza={navegarTraza}
          onBorrarTraza={(tz) => {
            removeTraza(tz.id);
            if (trazaSel === tz.id) setTrazaSel(null);
          }}
          onCrearRutaTraza={(tz) => editor.desdeActividad(tz)}
          onEditarBorrador={(id) => editor.editarBorrador(id)}
          onAbrirBiblioteca={() => {
            // Entrada clásica (panel de capas): la biblioteca abre en
            // «Mis rutas» aunque una orden del módulo la haya dejado
            // apuntando a otra sección.
            setBibliotecaTab("mias");
            setBibliotecaAbierta(true);
          }}
        />
      </div>

      {/* Mapa a pantalla completa (bajo header y barra inferior): 72 px
          cubre la altura real del nav inferior (~69 px) + 3 px de aire. */}
      <div className="absolute inset-x-0 top-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-0">
        {/* v1.12.10: wrapper de rotación estilo Waze - en navegación el
            mapa gira al rumbo (al 150% para no mostrar esquinas vacías);
            los controles flotantes, fuera del wrapper, quedan fijos. */}
        <div
          style={{
            position: "absolute",
            left: rotado ? "-25%" : 0,
            top: rotado ? "-25%" : 0,
            width: rotado ? "150%" : "100%",
            height: rotado ? "150%" : "100%",
            transform: rotado ? `rotate(${-mapBearing}deg)` : undefined,
            transition: rotado ? "transform 0.25s linear" : undefined,
            willChange: rotado ? "transform" : undefined,
          }}
        >
        <MapContainer
          center={[center.lat, center.lon]}
          zoom={14}
          zoomControl={false}
          scrollWheelZoom
          className={`h-full w-full bg-background ${reportMode ? "cursor-crosshair" : ""}`}
          // v1.13.1: sin control de Leaflet (vivía dentro del wrapper
          // rotado y desaparecía al girar); la atribución exigida por la
          // ODbL va FIJA fuera del wrapper, igual en web y APK.
          attributionControl={false}
        >
          <TileLayer
            // Base ráster estándar OSM France (v1.12.14b): la misma base
            // del minimapa web y del APK nativo (OSM estándar responde 429
            // con usuarios concurrentes).
            url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
            subdomains="abc"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>'
            maxZoom={19}
          />

          {/* Límite del parque */}
          <Polygon
            positions={PARK_POLYGON.map((p) => [p.lat, p.lon])}
            pathOptions={{ color: "#34d399", weight: 2, fillColor: "#10b981", fillOpacity: 0.08 }}
          />

          {/* Capa Sectores de emergencia (cliente 2026-11-17): división
              orientativa del parque por sector municipal, destacada por
              color con el teléfono de contacto de cada patrulla. */}
          {capasVis["sectores"] &&
            SECTORES_EMERGENCIA.map((sec) => (
              <Polygon
                key={sec.id}
                positions={sec.polygon.map((p) => [p.lat, p.lon])}
                pathOptions={{ color: sec.color, weight: 2, dashArray: "6 4", fillColor: sec.color, fillOpacity: 0.14 }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <span className="text-xs font-medium">
                    {sec.emoji} {sec.nombre} · {t(sec.sectorKey)} · {sec.telefono}
                  </span>
                </Tooltip>
              </Polygon>
            ))}

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
              <Popup minWidth={215}>
                <div className="text-[11.5px] leading-snug">
                  <p className="font-semibold">⚠ {z.name}</p>
                  <p className="mt-1">
                    <b>{t("geo.categoria")}:</b> {t("geo.cat.SAFETY")}
                  </p>
                  {z.trazabilidad && (
                    <>
                      <p>
                        <b>{t("geo.fuente")}:</b> {z.trazabilidad.source}
                      </p>
                      <p>
                        <b>{t("geo.verificado")}:</b> {z.trazabilidad.updated_at}
                      </p>
                      <p>
                        <b>{t("geo.confianza")}:</b> {z.trazabilidad.confidence_level}
                      </p>
                      {z.trazabilidad.vigencia && (
                        <p>
                          <b>{t("geo.vigencia")}:</b> {z.trazabilidad.vigencia}
                        </p>
                      )}
                    </>
                  )}
                  <p className="mt-1.5 opacity-75">{t("geo.orientativo")}</p>
                </div>
              </Popup>
            </Circle>
          ))}

          {/* Capa Accesos: los 4 autorizados para ingreso en bicicleta
              (normativa Parquemet) - el resto de accesos no se dibuja. */}
          {capasVis["accesos"] &&
            CAPA_ACCESOS.map((a) => (
              <CircleMarker
                key={a.id}
                center={[a.position.lat, a.position.lon]}
                radius={7}
                pathOptions={{ color: "#34d399", weight: 2.5, fillColor: "#065f46", fillOpacity: 0.95 }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <span className="text-xs font-medium">🚴 {a.nombre} · {t("mapa.accesoCiclistas")}</span>
                </Tooltip>
              </CircleMarker>
            ))}

          {/* Capa Rutas: trazados predefinidos (pavimento azul · MTB naranja
              punteado) con casing oscuro para leerse sobre cualquier fondo,
              y bandera VERDE en el punto de inicio de cada ruta (cliente
              2026-11-15: «para identificar bien en el mapa el punto de
              partida»). */}
          {CAPA_RUTAS.filter((r) => capasVis[r.id]).map((r) => {
            const tr = rutaTrazado(r);
            if (tr.coords.length < 2) return null;
            const path = tr.coords.map((c) => [c.lat, c.lon] as [number, number]);
            return (
              <Fragment key={r.id}>
                <Marker position={[tr.coords[0].lat, tr.coords[0].lon]} icon={banderaInicioIcon(mapBearing)}>
                  <Tooltip direction="top" offset={[0, -8]}>
                    <span className="text-xs font-medium">{t("mapa.inicioRuta", r.nombre)}</span>
                  </Tooltip>
                </Marker>
                <Polyline positions={path} pathOptions={{ color: "#05070a", weight: 9, opacity: 0.75 }} interactive={false} />
                <Polyline
                  positions={path}
                  pathOptions={{
                    color: r.color,
                    weight: 5,
                    opacity: 0.95,
                    dashArray: r.tipo === "mtb" ? "10 8" : undefined,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                >
                  <Tooltip direction="top">
                    <span className="text-xs font-medium">
                      {r.emoji} {r.nombre} · {tr.distKm.toFixed(1)} km
                    </span>
                  </Tooltip>
                </Polyline>
              </Fragment>
            );
          })}

          {/* Capas de puntos: Puntos de Interés · Normativa y Seguridad · Conexión Urbana */}
          {capasVis["pois"] && puntoMarkers(CAPA_POIS, (p) => COLOR_SUB_POI[(p as CapaPunto).sub])}
          {capasVis["normativa"] && puntoMarkers(CAPA_NORMATIVA, () => COLOR_NORMATIVA)}
          {capasVis["urbana"] && puntoMarkers(CAPA_URBANA, () => COLOR_URBANA)}

          {/* Bajadas con control de velocidad 30 km/h (Normativa y Seguridad):
              al marcar la capa se pintan los 3 corredores en rojo
              (cliente 2026-11-13: «al marcar pintar trazado en rojo y que
              se vean los 3»). */}
          {capasVis["normativa"] &&
            BAJADAS_30.map((b) => {
              if (b.coords.length < 2) return null;
              const path = b.coords.map((c) => [c.lat, c.lon] as [number, number]);
              return (
                <Fragment key={b.id}>
                  <Polyline positions={path} pathOptions={{ color: "#450a0a", weight: 8.5, opacity: 0.7 }} interactive={false} />
                  <Polyline
                    positions={path}
                    pathOptions={{ color: "#dc2626", weight: 4.5, opacity: 0.95, lineCap: "round", lineJoin: "round" }}
                  >
                    <Tooltip direction="top">
                      <span className="text-xs font-medium">{t("mapa.bajada30Tooltip", b.nombre, b.distKm.toFixed(1))}</span>
                    </Tooltip>
                  </Polyline>
                </Fragment>
              );
            })}

          {/* Senderos peatonales (cliente 2026-11-13: «para tenerlos verlos
              pero no para ruta»): línea café punteada, informativa - NINGÚN
              ruteo los usa (SEND_PEATONALES_BLOCK en senderos.ts). */}
          {capasVis["senderos"] &&
            CAPA_SENDEROS_PEATONALES.map((s) => {
              if (s.coords.length < 2) return null;
              return (
                <Polyline
                  key={`sp-${s.id}`}
                  positions={s.coords.map((c) => [c.lat, c.lon] as [number, number])}
                  pathOptions={{ color: "#92400e", weight: 3, opacity: 0.85, dashArray: "3 8", lineCap: "round" }}
                >
                  <Tooltip direction="top">
                    <span className="text-xs font-medium">{t("mapa.peatonal", s.nombre)}</span>
                  </Tooltip>
                </Polyline>
              );
            })}

          {/* Paseo Metropolitano (cliente 2026-11-13: nueva categoría
              para los tramos mixtos peatón+bici del anillo): línea teal
              de guion-punto, datos en su propia variable
              (paseoMetropolitano.ts) - informativa, el ruteo no cambia. */}
          {capasVis["paseo-met"] &&
            CAPA_PASEO_METROPOLITANO.map((pm) => {
              if (pm.coords.length < 2) return null;
              return (
                <Polyline
                  key={`pm-${pm.id}`}
                  positions={pm.coords.map((c) => [c.lat, c.lon] as [number, number])}
                  pathOptions={{ color: "#0d9488", weight: 4, opacity: 0.9, dashArray: "14 7 3 7", lineCap: "round" }}
                >
                  <Tooltip direction="top">
                    <span className="text-xs font-medium">{t("mapa.paseoTooltip", pm.nombre, pm.largoKm.toLocaleString("es-CL"))}</span>
                  </Tooltip>
                </Polyline>
              );
            })}

          {/* Ciclovías (solo interior del parque) */}
          {cicloviaLines}

          {/* Ruta elegida: completa, partida por condición - violeta =
              ciclovía · blanco = vía compartida - con casing oscuro */}
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
          {dest && <Marker position={[dest.position.lat, dest.position.lon]} icon={flagIcon(mapBearing)} interactive={false} />}

          {/* v1.13.15 - Creador de trazados: vista previa de la línea que
              acaba de trazar el motor (o del GPX importado) y los puntos
              elegidos (inicio verde, fin rojo). */}
          {trazar.preview && trazar.preview.coords.length > 1 && (
            <>
              <Polyline
                positions={trazar.preview.coords.map((p) => [p.lat, p.lon] as [number, number])}
                pathOptions={{ color: "#05070a", weight: 9, opacity: 0.8 }}
                interactive={false}
              />
              <Polyline
                positions={trazar.preview.coords.map((p) => [p.lat, p.lon] as [number, number])}
                pathOptions={{
                  color: trazar.preview!.kind === "ruta" ? "#f97316" : "#06b6d4",
                  weight: 5.5,
                  opacity: 0.98,
                  lineCap: "round",
                  lineJoin: "round",
                }}
                interactive={false}
              />
            </>
          )}
          {trazar.picks.map((p, i) => (
            <CircleMarker
              key={`tpick-${i}`}
              center={[p.lat, p.lon]}
              radius={7}
              pathOptions={{ color: "#fafafa", weight: 2.5, fillColor: i === 0 ? "#22c55e" : "#ef4444", fillOpacity: 1 }}
              interactive={false}
            />
          ))}

          {/* Fase B - Editor de rutas: línea en construcción (violeta,
              casing negro), waypoints como puntos y POIs como pins. */}
          {editor.activo && editor.coords.length > 1 && (
            <>
              <Polyline
                positions={editor.coords.map((p) => [p.lat, p.lon] as [number, number])}
                pathOptions={{ color: "#05070a", weight: 9, opacity: 0.8 }}
                interactive={false}
              />
              <Polyline
                positions={editor.coords.map((p) => [p.lat, p.lon] as [number, number])}
                pathOptions={{ color: "#8b5cf6", weight: 5.5, opacity: 0.98, lineCap: "round", lineJoin: "round" }}
                interactive={false}
              />
            </>
          )}
          {editor.activo &&
            editor.waypoints.map((p, i) => (
              <CircleMarker
                key={`wpick-${i}`}
                center={[p.lat, p.lon]}
                radius={6}
                pathOptions={{ color: "#fafafa", weight: 2, fillColor: i === 0 ? "#22c55e" : "#8b5cf6", fillOpacity: 1 }}
                interactive={false}
              />
            ))}
          {editor.activo &&
            editor.pois.map((p) => (
              <Marker key={p.id} position={[p.lat, p.lon]} icon={L.divIcon({ className: "", html: `<div style="font-size:18px;line-height:1">📍</div>`, iconSize: [18, 18], iconAnchor: [9, 16] })} />
            ))}

          {/* v1.13.15 - Mis trazados guardados: rutas (naranja sólido) y
              segmentos (cian punteado, los que corren en estadísticas). */}
          {verTrazas &&
            trazas.map((tz) => {
              if (tz.coords.length < 2) return null;
              const line = tz.coords.map((c) => [c.lat, c.lon] as [number, number]);
              const sel = trazaSel === tz.id;
              return (
                <Fragment key={`tz-${tz.id}`}>
                  <Polyline positions={line} pathOptions={{ color: "#05070a", weight: 7.5, opacity: sel ? 0.9 : 0.5 }} interactive={false} />
                  <Polyline
                    positions={line}
                    pathOptions={{
                      color: tz.kind === "ruta" ? "#fb923c" : "#22d3ee",
                      weight: sel ? 5 : 4,
                      opacity: 0.95,
                      dashArray: tz.kind === "segmento" ? "10 7" : undefined,
                      lineCap: "round",
                      lineJoin: "round",
                    }}
                  >
                    <Tooltip direction="top">
                      <span className="text-xs font-medium">
                        {tz.kind === "ruta" ? "🛣️" : "🏁"} {tz.nombre} · {tz.distKm.toFixed(1)} km
                      </span>
                    </Tooltip>
                  </Polyline>
                </Fragment>
              );
            })}

          {/* Recorrido del ride */}
          {track.length > 1 && (
            <Polyline positions={track.map((p) => [p.lat, p.lon])} pathOptions={{ color: "#a3e635", weight: 4, opacity: 0.9 }} />
          )}

          {/* Incidencias */}
          {incidentMarkers}

          {/* Marcadores personales (Pro) */}
          {marks.map((m) => (
            <Marker key={m.id} position={[m.lat, m.lon]} icon={markIcon(mapBearing)}>
              <Popup>
                <div className="min-w-[170px] text-[13px]">
                  <div className="font-semibold mb-1">📍 {m.name}</div>
                  <div className="flex gap-3">
                    {onSetDest && (
                      <button
                        onClick={() => handleSetDest({ name: m.name, position: { lat: m.lat, lon: m.lon } })}
                        className="font-medium text-sky-600 hover:underline"
                      >
                        {t("mapa.rutaAqui")}
                      </button>
                    )}
                    <button
                      onClick={() => removeMark(m.id)}
                      className="font-medium text-red-600 hover:underline"
                    >
                      {t("mapa.eliminar")}
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
              {/* v1.13.12: mapBearing=0 - el wrapper CSS (v1.12.10) ya gira los
                  markers -B; el svg del puck lleva el rumbo crudo (rumboPin - 0). */}
              <Marker position={[position.lat, position.lon]} icon={userPinIcon(userPin ?? DEFAULT_PIN, rumboPin, 0)} zIndexOffset={500} />
            </>
          )}

          <RouteFitter route={route} pendingRef={pendingFitRef} />
          <NavCamara position={position} navOn={navOn} rotado={rotado} locateTarget={locateTarget} />
          <FocusHandler focus={focus} />
          <LocateHandler target={locateTarget} />
          <ClickHandler
            enabled={reportMode || trazar.modo !== null || editor.activo}
            onPick={(p) => {
              // El creador de trazados tiene prioridad sobre el reporte:
              // su botón sigue activo, pero el tap alimenta el trazado.
              if (trazar.modo) trazar.pick(p);
              else if (editor.activo) editor.pick(p);
              else setPending(p);
            }}
          />
          <BboxReflector onMove={(b) => { bboxRef.current = b; }} />
          <RutaPublicaLayer sel={rutaPublicaSel} />
          <RutaProyectadaLayer sel={proyectada} />
        </MapContainer>
        </div>

        {/* Atribución OSM (v1.13.1): FIJA fuera del wrapper rotado - la
            licencia ODbL exige verla siempre, con la cámara girada o no
            («se pierde la etiqueta de OSM», queja del cliente). */}
        <div
          className="absolute bottom-0 right-0 z-[600] rounded-tl-md bg-white/85 px-1.5 py-0.5 text-[10px] leading-tight text-zinc-800 dark:bg-zinc-900/85 dark:text-zinc-300"
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

        {/* Controles flotantes (bajo la barra de direcciones) */}
        <div className="absolute top-[64px] right-2 z-[600] flex flex-col gap-1.5">
          <button
            onClick={locate}
            aria-label={t("mapa.localizarme")}
            title={t("mapa.centrarUbicacion")}
            className="h-10 w-10 rounded-lg bg-background/90 border border-border text-foreground flex items-center justify-center hover:border-emerald-500 shadow-md"
          >
            <Crosshair className="h-5 w-5" />
          </button>
          <button
            onClick={() => setReportMode((v) => !v)}
            aria-label={t("mapa.reportarAria")}
            title={t("mapa.reportarTitle")}
            className={`h-10 w-10 rounded-lg border flex items-center justify-center shadow-md ${
              reportMode ? "bg-amber-500 border-amber-300 text-zinc-950" : "bg-background/90 border-border text-foreground hover:border-amber-400"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </button>
          {/* v1.13.15: creador de trazados - ruta (línea del entrenamiento,
              navegable) y segmento (además corre en las estadísticas). */}
          <button
            onClick={() => trazar.empezar("ruta")}
            aria-label={t("tra.btnRuta")}
            title={t("tra.btnRuta")}
            data-testid="btn-trazar-ruta"
            className={`h-10 w-10 rounded-lg border flex items-center justify-center shadow-md ${
              trazar.modo === "ruta" ? "bg-sky-500 border-sky-300 text-zinc-950" : "bg-background/90 border-border text-foreground hover:border-sky-400"
            }`}
          >
            <Route className="h-5 w-5" />
          </button>
          <button
            onClick={() => trazar.empezar("segmento")}
            aria-label={t("tra.btnSegmento")}
            title={t("tra.btnSegmento")}
            data-testid="btn-trazar-segmento"
            className={`h-10 w-10 rounded-lg border flex items-center justify-center shadow-md ${
              trazar.modo === "segmento" ? "bg-cyan-500 border-cyan-300 text-zinc-950" : "bg-background/90 border-border text-foreground hover:border-cyan-400"
            }`}
          >
            <Milestone className="h-5 w-5" />
          </button>
          {/* Fase B: editor de rutas (multi-waypoint, POIs, borradores). */}
          <button
            onClick={() => editor.empezar()}
            aria-label={t("edi.btnCrear")}
            title={t("edi.btnCrear")}
            data-testid="btn-crear-ruta"
            className={`h-10 w-10 rounded-lg border flex items-center justify-center shadow-md ${
              editor.activo ? "bg-violet-500 border-violet-300 text-zinc-950" : "bg-background/90 border-border text-foreground hover:border-violet-400"
            }`}
          >
            <PencilRuler className="h-5 w-5" />
          </button>
          {(rotado || modoCamara === "rumbo") && (
            <button
              onClick={() => setModoCamara(modoCamara === "rumbo" ? "norte" : "rumbo")}
              aria-label={modoCamara === "rumbo" ? t("mapa.rumboAria") : t("mapa.norteAria")}
              title={modoCamara === "rumbo" ? t("mapa.rumboTitle") : t("mapa.norteTitle")}
              className="relative h-10 w-10 rounded-lg bg-background/90 border border-border text-foreground flex items-center justify-center hover:border-emerald-500 shadow-md"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" style={{ transform: `rotate(${-Math.round(mapBearing)}deg)`, transition: "transform 0.45s ease-out" }} aria-hidden>
                <path d="M12 2.5 L15.5 12 L12 10.2 L8.5 12 Z" fill="#ef4444" />
                <path d="M12 21.5 L8.5 12 L12 13.8 L15.5 12 Z" fill="#71717a" />
                <circle cx="12" cy="12" r="1.4" fill="#09090b" />
              </svg>
              {modoCamara === "rumbo" && <span className="absolute -bottom-1 rounded bg-emerald-600 px-1 text-[8px] font-bold text-white">{t("mapa.rumboChip")}</span>}
            </button>
          )}
        </div>

        {/* Estado / avisos */}
        {(status || pending) && (
          <div className="absolute top-[112px] inset-x-2 z-[750] rounded-lg bg-background/95 border border-amber-600/70 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 shadow-md">
            {pending ? (
              <div>
                <div className="font-semibold mb-1.5">{t("mapa.queEncontraste")}</div>
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
                    {t("mapa.cancelar")}
                  </button>
                </div>
              </div>
            ) : (
              status
            )}
          </div>
        )}
        {reportMode && !pending && !trazar.modo && (
          <p className="absolute top-[112px] inset-x-2 z-[740] rounded-lg bg-background/95 border border-amber-600/50 px-3 py-2 text-xs text-amber-700/90 dark:text-amber-300/90 shadow-md">
            {t("mapa.reportarHint")}
          </p>
        )}

        {/* v1.13.15: overlay del creador de trazados (opciones, preview
            con minimapa, nombre y guardado). */}
        <TrazadoOverlay ctrl={trazar} position={position} />
        {/* Fase B: panel del editor de rutas (metadatos, POIs, GPX). */}
        <EditorRutaPanel ctrl={editor} />
      </div>

      {/* Fase D: chip de la ruta pública dibujada sobre el mapa. */}
      {rutaPublicaSel && (
        <div className="absolute top-2 left-2 right-2 z-[820] flex items-center gap-1.5 rounded-xl border border-emerald-600/40 bg-card/95 px-2.5 py-2 shadow-md" data-testid="chip-ruta-publica">
          <p className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">🛣️ {rutaPublicaSel.nombre} <span className="font-normal text-muted-foreground">· {t("cat.geometriaProtegida")}</span></p>
          <button onClick={() => setRutaPublicaSel(null)} aria-label={t("bib.cerrar")} className="rounded-lg border border-border px-1.5 py-1 text-muted-foreground hover:border-red-400">✕</button>
        </div>
      )}

      {/* Fase F: chip de la ruta proyectada (proyector «Navegar»). */}
      {proyectada && (
        <div className="absolute top-2 left-2 right-2 z-[820] flex items-center gap-1.5 rounded-xl border border-indigo-500/50 bg-card/95 px-2.5 py-2 shadow-md" data-testid="chip-ruta-proyectada">
          <p className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">
            🧭 <span className="text-indigo-600 dark:text-indigo-300">{t("navf.siguiendo")}</span> {proyectada.nombre}{" "}
            <span className="font-normal text-muted-foreground">· {proyectada.origen === "publica" ? t("navf.origenPublica") : t("navf.origenLocal")}</span>
          </p>
          <button onClick={() => rutaProyectadaStore.set(null)} aria-label={t("navf.quitar")} className="rounded-lg border border-border px-1.5 py-1 text-muted-foreground hover:border-red-400">✕</button>
        </div>
      )}

      {/* Fase C: biblioteca de rutas con ficha completa — al nivel raíz
          de MapView, FUERA del wrapper rotado (portal a body: el ancestro
          del mapa es un stacking context y el chrome pintaba encima). */}
      <BibliotecaRutas
        // Remontaje por sección pedida (rediseño Explorar): el cambio
        // de bibliotecaTab reinicia el overlay con el tab inicial —
        // sin efectos de sincronización dentro del overlay.
        key={bibliotecaTab}
        abierto={bibliotecaAbierta}
        onClose={() => setBibliotecaAbierta(false)}
        tabInicial={bibliotecaTab}
        onEditar={(id) => editor.editarBorrador(id)}
        onEncuadrar={encuadrarRuta}
        onPublicar={(id) => setPublicarId(id)}
        onNavegar={(r) => {
          // Proyector (fase F): la COPIA LOCAL se proyecta completa —
          // jamás sale del dispositivo (v2.1 §3/§8).
          rutaProyectadaStore.set({
            routeId: r.id,
            serverId: r.serverId ?? null,
            nombre: r.nombre,
            coords: r.coords,
            origen: "local",
          });
        }}
        getBbox={getBbox}
        onVerEnMapa={(r) => setRutaPublicaSel(r)}
        onIrAInicio={(r) => {
          if (r.inicioAproxLat == null || r.inicioAproxLon == null || !onSetDest) return;
          handleSetDest({ name: r.nombre, position: { lat: r.inicioAproxLat, lon: r.inicioAproxLon } });
        }}
      />

      {/* Fase D: vista previa de publicación (checkbox obligatoria). */}
      <PublicarRuta rutaId={publicarId} abierto={publicarId !== null} onClose={() => setPublicarId(null)} />
    </div>
  );
}

export { L };
