"use client";

// ============================================================
// Mapa de referencia: parque + zonas de riesgo + ciclovías
// (SOLO las del cerro, para no ensuciar la vista) + reporte de
// incidencias + botón de localización + pin personal.
// Buscador universal (Pro): escribes CUALQUIER dirección -casa,
// trabajo, otro barrio- o un lugar del cerro y la ruta ciclable
// se traza sola desde tu ubicación (grafo propio u OSRM bici).
// ============================================================

import { useEffect, useMemo, useRef, useState, Fragment } from "react";
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
import { Crosshair, AlertTriangle, Trash2, X, Search, MapPin, Flag, Crown, Lock, Layers, ChevronDown, Eye, Share2, Check, RefreshCw } from "lucide-react";
import { apiUrl } from "@/lib/backend";
import { NAV_DESTINATIONS, PARK_POLYGON, RISK_ZONES, type LatLng } from "@/lib/park";
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
import { incidentIcon, userPinIcon, flagIcon, markIcon, poiIcon } from "@/lib/mapIcons";
import { groupSegments, loadNetwork, type NavRoute, type Network } from "@/lib/routing";
import { useIncidentFeed, addIncident, removeIncident, saveLocalIncidents, loadLocalIncidents, voteIncident, incidentVoteOf, type IncidentItem } from "@/hooks/useIncidentFeed";
import { isNativeMapPlatform } from "@/lib/nativeMapBridge";
import NativeMapCanvas from "@/components/NativeMapCanvas";
import { buildCicloFeature } from "@/lib/navCanvasLogic";
import { useProLicense } from "@/lib/proLicense";
import { addMark, removeMark, useMarks, normalizeForSearch } from "@/lib/marks";
import { geocodeAddress, type AddrResult } from "@/lib/geocode";
import type { CapaRuta } from "@/lib/mapLayers";
import type { ProLockFeature } from "@/lib/planData";
import type { NavDest } from "@/hooks/useNavEngine";

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
};

// SIN ubicación automática (cliente, 2026-11-12): el mapa NO se envía
// solo a la posición del ciclista — perseguía el dedo y no dejaba
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
  { id: "accesos", titulo: "Accesos", sub: "Entradas y salidas oficiales", emoji: "🚪", items: CAPA_ACCESOS.length },
  { id: "rutas", titulo: "Rutas", sub: "Trazados de pavimento y circuitos MTB", emoji: "🛣️", items: CAPA_RUTAS.length },
  { id: "senderos", titulo: "Senderos peatonales", sub: "Informativo · no son rutas ciclistas", emoji: "🥾", items: CAPA_SENDEROS_PEATONALES.length },
  { id: "paseo-met", titulo: "Paseo Metropolitano", sub: "Uso mixto: peatones y ciclistas · anillo del cerro", emoji: "🛤️", items: CAPA_PASEO_METROPOLITANO.length },
  { id: "pois", titulo: "Puntos de Interés", sub: "Cruces, servicios, miradores y alertas peatonales", emoji: "📍", items: CAPA_POIS.length },
  { id: "normativa", titulo: "Normativa y Seguridad", sub: "Cortes horarios, límites y soporte técnico", emoji: "🛡️", items: CAPA_NORMATIVA.length },
  { id: "urbana", titulo: "Conexión Urbana", sub: "Metro y ciclovías externas", emoji: "🏙️", items: CAPA_URBANA.length },
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
        aria-label={`Centrar mapa en ${p.nombre}`}
        title="Centrar el mapa aquí"
        className="shrink-0 rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:border-emerald-500 hover:text-emerald-600"
      >
        <Eye className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

/** Interruptor compacto Ver/Ocultar de una capa o ruta. */
function SwitchCapa({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
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
      {on ? "Ocultar" : "Ver"}
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
}: {
  vis: Record<string, boolean>;
  onVer: (id: string) => void;
  onFocus: (f: Focus) => void;
  onGenerarRuta?: (r: CapaRuta) => void;
}) {
  const [abierto, setAbierto] = useState(true);
  return (
    <div className="rounded-xl border border-border bg-card/95 overflow-hidden shadow-md backdrop-blur" data-testid="capas-panel">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <Layers className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="text-xs font-bold text-foreground">Capas del mapa</span>
        {!abierto && <span className="text-[10px] text-muted-foreground">elige qué ver en el mapa</span>}
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
                    <span className="text-[13px] font-bold text-foreground">{m.titulo}</span>
                    <span className="rounded-full bg-emerald-600/10 px-1.5 py-px text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300">
                      {m.items}
                    </span>
                    {activos > 0 && (
                      <span className="rounded-full bg-emerald-600 px-1.5 py-px text-[9.5px] font-bold text-(--c30-on-accent)">
                        {activos} {m.id === "rutas" ? "dibujadas" : "visibles"}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[10.5px] text-muted-foreground">{m.sub}</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform details-chev" aria-hidden />
              </summary>

              <div className="px-1.5 pb-2.5">
                {m.id === "accesos" && (
                  <>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground">Solo los 4 accesos habilitados para ingreso en bici (06:00-20:30).</p>
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
                    <p className="mb-1 text-[10px] text-muted-foreground">Toca «Ver» para dibujar el trazado · «Ruta» genera la navegación (entra por el acceso ciclista más cercano).</p>
                    <ul>
                      {CAPA_RUTAS.map((r) => {
                        const t = rutaTrazado(r);
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
                                  {r.tipo === "pavimento" ? "Pavimento" : "MTB"}
                                </span>
                              </span>
                              <span className="block truncate text-[10px] text-muted-foreground">
                                {r.nivel} · {t.distKm.toFixed(1)} km
                              </span>
                            </span>
                            <span className="h-2 w-4 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />
                            <SwitchCapa on={!!vis[r.id]} onClick={() => onVer(r.id)} label={r.id} />
                            {onGenerarRuta && (
                              <button
                                onClick={() => onGenerarRuta(r)}
                                aria-label={`Generar ruta: ${r.nombre}`}
                                title="Generar la ruta desde tu ubicación (acceso ciclista más cercano)"
                                className="shrink-0 rounded border border-sky-700/60 px-1.5 py-1 text-[10px] font-semibold text-sky-700 hover:bg-sky-950/40 dark:text-sky-300"
                              >
                                Ruta
                              </button>
                            )}
                            <button
                              onClick={() => onFocus({ kind: "ruta", coords: t.coords })}
                              aria-label={`Encuadrar ${r.nombre}`}
                              title="Encuadrar la ruta completa"
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
                      <p className="text-[10px] text-muted-foreground">Informativo: solo peatones, nunca en las rutas ciclistas.</p>
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
                            aria-label={`Encuadrar ${s.nombre}`}
                            title="Encuadrar el sendero en el mapa"
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
                        Tramos mixtos (peatones + ciclistas) del anillo del cerro; algunos conectan con pavimento y MTB. Informativa: no cambia el ruteo.
                      </p>
                      <SwitchCapa on={on} onClick={() => onVer("paseo-met")} label="paseo-met" />
                    </div>
                    <ul>
                      {CAPA_PASEO_METROPOLITANO.map((t) => (
                        <li key={t.id} className="flex items-center gap-1.5 py-1.5">
                          <span aria-hidden className="shrink-0 text-[13px]">🚶‍♂️</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs text-foreground">{t.nombre}</span>
                            <span className="block truncate text-[10px] text-muted-foreground">{t.detalle}</span>
                          </span>
                          <span className="h-0.5 w-4 shrink-0" style={{ borderTop: "2px dashed #0d9488" }} aria-hidden />
                          <button
                            onClick={() => onFocus({ kind: "ruta", coords: t.coords })}
                            aria-label={`Encuadrar ${t.nombre}`}
                            title="Encuadrar el tramo en el mapa"
                            className="shrink-0 rounded border border-border px-1.5 py-1 text-muted-foreground hover:border-emerald-500 hover:text-emerald-600"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {m.id === "pois" && (
                  <>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground">Conexiones, servicios, miradores y alertas peatonales.</p>
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
                      <p className="text-[10px] text-muted-foreground">Cortes horarios, límites y soporte técnico.</p>
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
                      <p className="text-[10px] text-muted-foreground">Metro y ciclovías externas para llegar pedaleando.</p>
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
  );

  const avisos = (
    <>
      {routeLoading && (
        <p className="mt-1 text-[11px] text-muted-foreground animate-pulse drop-shadow">Trazando la ruta hasta «{dest?.name}»…</p>
      )}
      {!routeLoading && dest && routeNote && (
        <p className="mt-1 rounded-lg bg-card/95 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-300">{routeNote}</p>
      )}
    </>
  );

  if (!pro) {
    // FREE: la barra es el mensaje Pro (badge PRO) — al tocarla abre el
    // modal contextual con el beneficio real, sin sacar del mapa.
    return (
      <div className="relative">
        <button
          onClick={() => onProLocked?.("buscador")}
          className="flex w-full items-center gap-2 rounded-xl border border-border bg-card/95 px-2.5 py-2.5 text-left shadow-md backdrop-blur hover:border-emerald-500/60"
          aria-label="Buscador universal de direcciones - función Cumbre30 Pro"
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            ¿A dónde quieres ir? Busca una dirección…
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
                  title="Trazar ruta hasta aquí"
                >
                  {d.name}
                </button>
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
                Sin conexión para buscar direcciones - los lugares del cerro y tus marcadores siguen disponibles.
              </li>
            )}
            {dests.length === 0 && mine.length === 0 && addr.length === 0 && !addrSearching && !addrOffline && activa && (
              <li className="py-2 text-center text-xs text-muted-foreground">Sin resultados para «{query}»</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---- Piezas compartidas web/nativo del mapa grande ----

function MapLegend({ className }: { className: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-emerald-500/50 border border-emerald-400" /> Parque · límite 30</div>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-emerald-500" /> Ciclovía (interior del cerro)</div>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm" style={{ background: "#0ea5e9" }} /> Ruta pavimento (capas)</div>
      <div className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm" style={{ background: "#f97316" }} /> Ruta MTB (capas)</div>
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

export default function MapView({ track, position, accuracyM, heading, userPin, route, dest, navLoading, navNote, onSetDest, onProLocked }: Props) {
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
  // Buscador Pro: consulta y marcadores personales
  const { pro } = useProLicense();
  const marks = useMarks();
  // Encuadre único de la ruta recién trazada desde el buscador
  const pendingFitRef = useRef(false);
  // Capas del mapa (arquitectura GPX): visibilidad por capa/ruta
  const [capasVis, setCapasVis] = useState<Record<string, boolean>>({ accesos: true, senderos: true, "paseo-met": true });
  const [focus, setFocus] = useState<Focus>(null);
  const last = track.length > 0 ? track[track.length - 1] : null;
  // Sin fix aún: el centro por defecto es el parque. Con fix GPS la
  // vista NO salta sola a tu ubicación (cliente 2026-11-12): la
  // centras tú con el botón «Centrar en mi ubicación».
  const center = last ?? position ?? { lat: -33.408, lon: -70.636 };
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
    // En el APK (export estático) /api no existe localmente: va al
    // backend de la web (backendOrigin); si no hay backend configurado,
    // el reporte queda local para sincronizarse más tarde.
    const url = apiUrl("/api/incidents");
    if (!url) {
      guardarLocal(payload);
      setStatus("Sin conexión: incidencia guardada solo en este dispositivo.");
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
      setStatus("Incidencia registrada y visible para todos ✓");
    } catch {
      guardarLocal(payload);
      setStatus("Sin conexión: incidencia guardada solo en este dispositivo.");
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
      username: "tú (local)",
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
      setStatus("No pudimos eliminar la incidencia (sin conexión).");
      setTimeout(() => setStatus(null), 4000);
    }
  };

  /** Canal ciudadano: mensaje listo para los canales oficiales. */
  const enviarAParquemet = async (inc: IncidentItem) => {
    const res = await compartirReporte(inc.type as IncidentTypeId, inc.lat, inc.lon, inc.createdAt);
    if (res === "copied") {
      setStatus("Mensaje copiado: envíalo a la línea 1466 o a los canales oficiales del parque.");
      setTimeout(() => setStatus(null), 6000);
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
    const t = rutaTrazado(r);
    if (t.coords.length < 2) return;
    if (!position) {
      setStatus("Activa tu GPS para generar la ruta desde tu ubicación.");
      setTimeout(() => setStatus(null), 4500);
      return;
    }
    setCapasVis((prev) => ({ ...prev, [r.id]: true }));
    setFocus({ kind: "ruta", coords: t.coords });
    handleSetDest({
      name: r.nombre,
      position: t.coords[t.coords.length - 1],
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
    // «dejar sólo en la capa») — al elegirlo se activa la capa Normativa
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
      <Marker key={pt.id} position={[pt.position.lat, pt.position.lon]} icon={poiIcon(pt.emoji, colorOf(pt))}>
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
                Ruta aquí
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
        const t = INCIDENT_BY_ID[inc.type] ?? INCIDENT_BY_ID.otro;
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
                {!inc.mine && (confirmaciones > 0 || resueltos > 0) && (
                  <div className="mt-1 text-[11.5px] text-zinc-600">
                    {confirmaciones > 0 && <span>✔ {confirmaciones} confirman · </span>}
                    {resueltos > 0 && <span>✓ {resueltos} lo resolvieron</span>}
                  </div>
                )}
                {!inc.mine && (
                  <div className="mt-2 flex items-center gap-3">
                    {voto === "confirm" ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" /> Confirmada
                      </span>
                    ) : (
                      <button
                        onClick={() => void voteIncident(inc.id, "confirm")}
                        className="inline-flex items-center gap-1 font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Sigue ahí
                      </button>
                    )}
                    {voto === "resolved" ? (
                      <span className="inline-flex items-center gap-1 font-medium text-zinc-500">
                        <Check className="h-3.5 w-3.5" /> Resuelta
                      </span>
                    ) : (
                      <button
                        onClick={() => void voteIncident(inc.id, "resolved")}
                        className="inline-flex items-center gap-1 text-zinc-600 font-medium hover:underline dark:text-zinc-400"
                      >
                        <Check className="h-3.5 w-3.5" /> Ya resuelto
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
                      <Share2 className="h-3.5 w-3.5" /> Enviar a Parquemet
                    </button>
                    <button
                      onClick={() => deleteIncident(inc)}
                      className="inline-flex items-center gap-1 text-red-600 font-medium hover:underline"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Eliminar
                    </button>
                  </div>
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
    <div className="relative min-h-0 w-full flex-1" data-testid="mapa-explorar">
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
          bottom 80px = nav real (~69 px) + holgura; antes quedaba a 64 y
          tapaba la barra inferior al hacer scroll el documento (queja del
          cliente 2026-11-11: "al mover la búsqueda o el botón de capas se
          superpone a la información"). */}
      <div className="absolute inset-x-2 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[690]">
        <CapasPanel vis={capasVis} onVer={toggleCapa} onFocus={enfocar} onGenerarRuta={generarRuta} />
      </div>

      {/* Mapa a pantalla completa (bajo header y barra inferior): 72 px
          cubre la altura real del nav inferior (~69 px) + 3 px de aire. */}
      <div className="absolute inset-x-0 top-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-0">
        <MapContainer
          center={[center.lat, center.lon]}
          zoom={14}
          zoomControl={false}
          scrollWheelZoom
          className={`${darkMap ? "map-dark" : ""} h-full w-full bg-background ${reportMode ? "cursor-crosshair" : ""}`}
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

          {/* Capa Accesos: los 4 autorizados para ingreso en bicicleta
              (normativa Parquemet) — el resto de accesos no se dibuja. */}
          {capasVis["accesos"] &&
            CAPA_ACCESOS.map((a) => (
              <CircleMarker
                key={a.id}
                center={[a.position.lat, a.position.lon]}
                radius={7}
                pathOptions={{ color: "#34d399", weight: 2.5, fillColor: "#065f46", fillOpacity: 0.95 }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <span className="text-xs font-medium">🚴 {a.nombre} · acceso ciclistas</span>
                </Tooltip>
              </CircleMarker>
            ))}

          {/* Capa Rutas: trazados predefinidos (pavimento azul · MTB naranja
              punteado) con casing oscuro para leerse sobre cualquier fondo. */}
          {CAPA_RUTAS.filter((r) => capasVis[r.id]).map((r) => {
            const t = rutaTrazado(r);
            if (t.coords.length < 2) return null;
            const path = t.coords.map((c) => [c.lat, c.lon] as [number, number]);
            return (
              <Fragment key={r.id}>
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
                      {r.emoji} {r.nombre} · {t.distKm.toFixed(1)} km
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
                      <span className="text-xs font-medium">🐢 30 km/h · {b.nombre} · {b.distKm.toFixed(1)} km</span>
                    </Tooltip>
                  </Polyline>
                </Fragment>
              );
            })}

          {/* Senderos peatonales (cliente 2026-11-13: «para tenerlos verlos
              pero no para ruta»): línea café punteada, informativa — NINGÚN
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
                    <span className="text-xs font-medium">🥾 {s.nombre} · peatonal</span>
                  </Tooltip>
                </Polyline>
              );
            })}

          {/* Paseo Metropolitano (cliente 2026-11-13: nueva categoría
              para los tramos mixtos peatón+bici del anillo): línea teal
              de guion-punto, datos en su propia variable
              (paseoMetropolitano.ts) — informativa, el ruteo no cambia. */}
          {capasVis["paseo-met"] &&
            CAPA_PASEO_METROPOLITANO.map((t) => {
              if (t.coords.length < 2) return null;
              return (
                <Polyline
                  key={`pm-${t.id}`}
                  positions={t.coords.map((c) => [c.lat, c.lon] as [number, number])}
                  pathOptions={{ color: "#0d9488", weight: 4, opacity: 0.9, dashArray: "14 7 3 7", lineCap: "round" }}
                >
                  <Tooltip direction="top">
                    <span className="text-xs font-medium">🚶‍♂️ {t.nombre} · {t.largoKm.toLocaleString("es-CL")} km · uso mixto</span>
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

          <RouteFitter route={route} pendingRef={pendingFitRef} />
          <FocusHandler focus={focus} />
          <LocateHandler target={locateTarget} />
          <ClickHandler enabled={reportMode} onPick={setPending} />
        </MapContainer>

        {/* Controles flotantes (bajo la barra de direcciones) */}
        <div className="absolute top-[64px] right-2 z-[600] flex flex-col gap-1.5">
          <button
            onClick={locate}
            aria-label="Localizarme"
            title="Centrar en mi ubicación"
            className="h-10 w-10 rounded-lg bg-background/90 border border-border text-foreground flex items-center justify-center hover:border-emerald-500 shadow-md"
          >
            <Crosshair className="h-5 w-5" />
          </button>
          <button
            onClick={() => setReportMode((v) => !v)}
            aria-label="Reportar incidencia en el mapa"
            title="Toca el mapa para reportar una incidencia"
            className={`h-10 w-10 rounded-lg border flex items-center justify-center shadow-md ${
              reportMode ? "bg-amber-500 border-amber-300 text-zinc-950" : "bg-background/90 border-border text-foreground hover:border-amber-400"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </button>
        </div>

        {/* Estado / avisos */}
        {(status || pending) && (
          <div className="absolute top-[112px] inset-x-2 z-[750] rounded-lg bg-background/95 border border-amber-600/70 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 shadow-md">
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
        {reportMode && !pending && (
          <p className="absolute top-[112px] inset-x-2 z-[740] rounded-lg bg-background/95 border border-amber-600/50 px-3 py-2 text-xs text-amber-700/90 dark:text-amber-300/90 shadow-md">
            Toca el mapa donde está el problema y elige el tipo de incidencia.
          </p>
        )}
      </div>
    </div>
  );
}

export { L };
