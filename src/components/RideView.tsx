"use client";

// ============================================================
// Vista de ride - rediseño de jerarquía (brief §2):
//   minimapa → VELOCIDAD protagonista → distancia/tiempo →
//   botón principal → stats secundarias colapsables → bitácora.
// Dos estados: DETENIDO (todo visible, Iniciar evidente) y
// EN MARCHA/PAUSA (velocidad+mapa+nav primero, botones grandes).
// La fuente Demo/GPS vive ahora en Configuración (no compite con
// el botón Iniciar).
// Conserva: banner de zona, exceso, indicaciones y bitácora.
// ============================================================

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Bike,
  ChevronDown,
  Copy,
  Gauge,
  ListTree,
  Mountain,
  Navigation,
  Pause,
  Phone,
  Play,
  Route,
  Share2,
  ShieldAlert,
  Siren,
  Square,
  Timer,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Speedometer } from "@/components/Speedometer";
import { LIMIT_KMH } from "@/lib/park";
import { formatClock } from "@/lib/geo";
import { formatStepRemaining, routeProgress, stepGlyph } from "@/lib/routing";
import { estadoParque } from "@/lib/horario";
import { minimapHeight, useRideTheme } from "@/lib/rideTheme";
import type { LatLng } from "@/lib/park";
import type { RideEvent, RideStatus, Source, SpeedState } from "@/hooks/useRideEngine";
import type { NavEngine } from "@/hooks/useNavEngine";

const MiniMap = dynamic(() => import("@/components/MiniMap"), {
  ssr: false,
  loading: () => <div className="h-52 sm:h-56 rounded-xl border border-border bg-card flex items-center justify-center text-sm text-muted-foreground">Cargando minimapa…</div>,
});

type Props = {
  speedKmh: number;
  maxKmh: number;
  avgKmh: number;
  distanceKm: number;
  elapsedSec: number;
  gainM: number;
  slopePct: number;
  insidePark: boolean;
  speedState: SpeedState;
  overLimitSec: number;
  maxInParkKmh: number | null;
  accuracyM: number | null;
  events: RideEvent[];
  status: RideStatus;
  source: Source;
  position: LatLng | null;
  track: LatLng[];
  heading: number | null;
  userPin?: string;
  nav: NavEngine;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
};

export { stepGlyph };

export function RideView(p: Props) {
  const running = p.status === "running";
  const paused = p.status === "paused";
  const idle = p.status === "idle";
  const over = p.speedState === "over";
  const caution = p.speedState === "caution";
  const [sosOpen, setSosOpen] = useState(false);
  const [sosMsg, setSosMsg] = useState<string | null>(null);
  // Personalización Pro: estilo/tamaño del velocímetro y altura del minimapa.
  const theme = useRideTheme();
  const mm = minimapHeight(theme.minimapSize);

  // Horario del parque + aviso de luces (cálculo offline, se
  // evalúa al montar la vista; el banner no necesita reloj vivo).
  const estado = useMemo(() => estadoParque(), []);
  // Descenso limpio: entró al parque y nunca pasó de 30 km/h.
  const descensoLimpio =
    !idle && p.overLimitSec === 0 && p.maxInParkKmh !== null && p.maxInParkKmh <= LIMIT_KMH;

  const compartirUbicacion = async () => {
    if (!p.position) return;
    const txt = `Estoy pedaleando en el cerro San Cristóbal. Mi ubicación: https://maps.google.com/?q=${p.position.lat.toFixed(5)},${p.position.lon.toFixed(5)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Mi ubicación - Cumbre30", text: txt });
        setSosMsg("Ubicación compartida ✓");
      } else {
        await navigator.clipboard.writeText(txt);
        setSosMsg("Ubicación copiada al portapapeles ✓");
      }
    } catch {
      setSosMsg("No se pudo compartir; copia la ubicación de abajo.");
    }
    setTimeout(() => setSosMsg(null), 5000);
  };

  // Modo y estado en UNA píldora compacta (punto 3: sin banner
  // grande que sature la pantalla ride). El modo es automático:
  // geocerca del parque; lo demás son estados de velocidad y pausa.
  const chip = paused
    ? { cls: "border-sky-600/70 bg-sky-950/50 text-sky-300", icon: <Pause className="h-3.5 w-3.5" />, text: "EN PAUSA" }
    : over
      ? { cls: "border-red-600 bg-red-950/80 text-red-300 animate-pulse", icon: <ShieldAlert className="h-3.5 w-3.5" />, text: `EXCESO · límite ${LIMIT_KMH}` }
      : caution
        ? { cls: "border-amber-600/70 bg-amber-950/50 text-amber-300", icon: <ShieldAlert className="h-3.5 w-3.5" />, text: `PRECAUCIÓN · cerca del límite` }
        : p.insidePark
          ? { cls: "border-emerald-600/60 bg-emerald-950/60 text-emerald-300", icon: <ShieldAlert className="h-3.5 w-3.5" />, text: `MODO PARQUE · ${LIMIT_KMH}` }
          : { cls: "border-border bg-card/80 text-muted-foreground", icon: <Bike className="h-3.5 w-3.5" />, text: "MODO LIBRE" };

  // Navegación viva: progreso para la lista de indicaciones
  const onRoute = !!p.nav.route && p.nav.route.coords.length > 1;
  const progress = useMemo(
    () => (onRoute && p.position ? routeProgress(p.nav.route!, p.position) : null),
    [onRoute, p.position, p.nav.route]
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Minimapa tipo Waze: banner de maniobra, ruta ciclovía/vía compartida, ETA y reporte */}
      <MiniMap
        position={p.position}
        heading={p.heading}
        track={p.track}
        accuracyM={p.accuracyM}
        userPin={p.userPin}
        nav={p.nav}
        speedKmh={p.speedKmh}
        heightClass={mm.base}
        heightRouteClass={mm.route}
      />
      {p.nav.note && (
        <p className={`text-xs -mt-2 ${p.nav.provisional ? "text-sky-700/90 dark:text-sky-300/90" : "text-amber-700/90 dark:text-amber-300/90"}`}>{p.nav.note}</p>
      )}

      {/* Píldora compacta de modo/estado (reemplaza el banner grande) */}
      <div className="flex justify-center">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-wide ${chip.cls}`}
          role="status"
          aria-live="polite"
        >
          {chip.icon}
          {chip.text}
        </span>
      </div>

      {/* Horario y luz: reglas del parque + atardecer (offline) */}
      {estado.aviso && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-xs font-medium ${
            estado.nivel === "cierre"
              ? "border-red-700/70 bg-red-950/50 text-red-200"
              : estado.nivel === "luz"
                ? "border-amber-600/70 bg-amber-950/50 text-amber-200"
                : "border-sky-700/60 bg-sky-950/40 text-sky-200"
          }`}
          role="status"
        >
          {estado.nivel === "luz" ? "💡 " : "🕒 "}{estado.aviso}
        </div>
      )}

      {/* SOS: teléfonos de emergencia + compartir ubicación */}
      <div className="flex justify-end -mt-1">
        <button
          onClick={() => setSosOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-red-800/70 bg-red-950/50 px-3 py-1.5 text-[11px] font-bold tracking-wide text-red-300 hover:bg-red-900/60"
          aria-label="Abrir tarjeta de emergencia"
        >
          <Siren className="h-3.5 w-3.5" /> SOS
        </button>
      </div>

      {/* VELOCIDAD - protagonista (elemento 2 del brief), estilo y tamaño personalizables Pro */}
      <div className="text-center pt-1">
        <Speedometer
          speedKmh={p.speedKmh}
          idle={idle}
          over={over}
          caution={caution}
          inPark={p.insidePark}
          style={theme.speedoStyle}
          size={theme.speedoSize}
        />
      </div>

      {/* Distancia y tiempo - el par secundario importante (elemento 5) */}
      <div className="grid grid-cols-2 gap-2.5">
        <Card className="p-3.5">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
            <Route className="h-3.5 w-3.5" /> Distancia
          </div>
          <div className="mt-1 font-mono text-[26px] font-bold tabular-nums leading-none text-foreground">
            {p.distanceKm.toFixed(2)}
            <span className="ml-1 font-sans text-xs font-semibold text-muted-foreground">km</span>
          </div>
        </Card>
        <Card className="p-3.5">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
            <Timer className="h-3.5 w-3.5" /> Tiempo
          </div>
          <div className="mt-1 font-mono text-[26px] font-bold tabular-nums leading-none text-foreground">
            {formatClock(p.elapsedSec)}
          </div>
        </Card>
      </div>

      {/* BOTÓN PRINCIPAL (elemento 4) - inicia/pausa/finaliza */}
      {idle ? (
        <div>
          <Button
            onClick={p.onStart}
            className="h-16 w-full rounded-2xl bg-emerald-600 text-lg font-extrabold text-(--c30-on-accent) shadow-lg hover:bg-emerald-500"
          >
            <Play className="h-6 w-6" /> Iniciar ride
          </Button>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            Fuente: {p.source === "sim" ? "Demo" : "GPS real"} · cámbiala en Configuración
          </p>
        </div>
      ) : (
        <div className="flex gap-2.5">
          {running ? (
            <Button
              onClick={p.onPause}
              variant="outline"
              className="h-16 flex-1 rounded-2xl border-border bg-card text-base font-bold text-foreground hover:bg-accent"
            >
              <Pause className="h-6 w-6" /> Pausar
            </Button>
          ) : (
            <Button
              onClick={p.onResume}
              className="h-16 flex-1 rounded-2xl bg-emerald-600 text-base font-extrabold text-(--c30-on-accent) hover:bg-emerald-500"
            >
              <Play className="h-6 w-6" /> Reanudar
            </Button>
          )}
          <Button
            onClick={p.onFinish}
            className="h-16 w-16 shrink-0 rounded-2xl bg-red-950/60 text-red-300 hover:bg-red-900"
            aria-label="Finalizar y guardar ride"
          >
            <Square className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Stats secundarias - colapsables (elemento 6) */}
      <details className="rounded-xl border border-border bg-card/70 p-3 group" open={idle}>
        <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-semibold text-foreground/90 list-none [&::-webkit-details-marker]:hidden">
          <Gauge className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Estadísticas del viaje
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Máx" value={p.maxKmh.toFixed(1)} unit="km/h" icon={<TrendingUp className="h-3 w-3" />} />
          <Stat label="Prom" value={p.avgKmh.toFixed(1)} unit="km/h" icon={<Gauge className="h-3 w-3" />} />
          <Stat label="Desnivel" value={`+${Math.round(p.gainM)}`} unit="m" icon={<Mountain className="h-3 w-3" />} />
          <Stat
            label="Pendiente"
            value={`${p.slopePct > 0 ? "+" : ""}${p.slopePct.toFixed(1)}`}
            unit="%"
            icon={p.slopePct < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
          />
          <Stat label="Precisión GPS" value={p.accuracyM !== null ? `±${Math.round(p.accuracyM)}` : "-"} unit={p.accuracyM !== null ? "m" : undefined} icon={<Navigation className="h-3 w-3" />} />
          <Stat label="En parque" value={idle ? "-" : p.insidePark ? "Sí" : "No"} icon={<ShieldAlert className="h-3 w-3" />} />
        </div>
        {p.overLimitSec > 0 && (
          <Card className="mt-2.5 flex-row items-center justify-between border-red-900/70 bg-red-950/40 px-3 py-2.5">
            <div className="flex items-center gap-2 text-red-300 text-xs font-semibold">
              <ShieldAlert className="h-4 w-4" />
              Tiempo sobre el límite en el parque
            </div>
            <div className="font-mono text-base font-bold tabular-nums text-red-300">{formatClock(p.overLimitSec)}</div>
          </Card>
        )}
        {descensoLimpio && (
          <Card className="mt-2.5 flex-row items-center justify-between border-emerald-800/70 bg-emerald-950/40 px-3 py-2.5">
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold">
              <BadgeCheck className="h-4 w-4" />
              Descenso limpio: respetaste los {LIMIT_KMH} km/h en el parque
            </div>
            <BadgeCheck className="h-4 w-4 text-emerald-400" />
          </Card>
        )}
        {p.maxInParkKmh !== null && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Máxima dentro del parque: <span className="font-mono text-foreground/90">{p.maxInParkKmh.toFixed(1)} km/h</span>
          </p>
        )}
      </details>

      {/* Indicaciones completas (colapsables) */}
      {onRoute && p.nav.route && p.nav.route.steps.length > 1 && (
        <details className="rounded-xl border border-border bg-card/70 p-3 group">
          <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-semibold text-foreground/90 list-none [&::-webkit-details-marker]:hidden">
            <ListTree className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            Indicaciones de la ruta ({p.nav.route.steps.length})
            <span className="ml-auto text-[11px] text-muted-foreground font-normal group-open:hidden">ver todas</span>
            <span className="ml-auto text-[11px] text-muted-foreground font-normal hidden group-open:inline">ocultar</span>
          </summary>
          <ol className="mt-3 space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {p.nav.route.steps.map((s, i) => {
              const passed = progress ? i < progress.passedCount : false;
              return (
                <li key={i} className={`flex items-start gap-2 text-sm ${passed ? "text-muted-foreground/80 line-through" : "text-foreground"}`}>
                  <span className="text-lg leading-none w-6 text-center shrink-0" aria-hidden>
                    {stepGlyph(s.icon)}
                  </span>
                  <span className="min-w-0 flex-1">{s.text}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{s.distM > 0 ? formatStepRemaining(s) : ""}</span>
                </li>
              );
            })}
          </ol>
        </details>
      )}

      {/* Bitácora del viaje (elemento 7) */}
      <div>
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2 font-extrabold">Bitácora del viaje</div>
        <Card className="p-0 overflow-hidden">
          <ul className="max-h-56 overflow-y-auto divide-y divide-border/70" aria-label="Eventos del viaje">
            {p.events.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground/80">Sin eventos aún - los avisos de zona, geocercas y excesos aparecerán aquí.</li>
            )}
            {[...p.events].reverse().map((ev, i) => (
              <li key={`${ev.t}-${i}`} className="px-4 py-2.5 flex items-start gap-2.5 text-sm">
                <EventDot kind={ev.kind} />
                <span className={eventText(ev.kind)}>{ev.text}</span>
                <span className="ml-auto font-mono text-[11px] text-muted-foreground/80 shrink-0 mt-0.5">
                  {new Date(ev.t).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Tarjeta de emergencia (funciona sin conexión: tel: y compartir) */}
      {sosOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 sm:items-center" role="dialog" aria-label="Emergencia">
          <Card className="w-full max-w-md rounded-b-none rounded-t-2xl bg-background p-4 sm:rounded-2xl">
            <div className="flex items-center gap-2">
              <Siren className="h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="flex-1 font-bold text-foreground">Emergencia en el cerro</p>
              <button
                onClick={() => setSosOpen(false)}
                className="rounded-full border border-border p-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Cerrar tarjeta de emergencia"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Emergencias</p>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                <a href="tel:133" className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-3 text-center hover:border-red-500/70">
                  <Phone className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-bold text-foreground">133</span>
                  <span className="text-[10px] text-muted-foreground">Carabineros</span>
                </a>
                <a href="tel:131" className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-3 text-center hover:border-red-500/70">
                  <Phone className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-bold text-foreground">131</span>
                  <span className="text-[10px] text-muted-foreground">Ambulancia</span>
                </a>
                <a href="tel:132" className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-3 text-center hover:border-red-500/70">
                  <Phone className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-bold text-foreground">132</span>
                  <span className="text-[10px] text-muted-foreground">Bomberos</span>
                </a>
              </div>
            </div>
            <div className="mt-2.5">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Parque y apoyo</p>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                <a href="tel:+56227301404" className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-3 text-center hover:border-emerald-500/70">
                  <Phone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[13px] font-bold tabular-nums text-foreground">+56 2 2730 1404</span>
                  <span className="text-[10px] text-muted-foreground">Parquemet</span>
                </a>
                <a href="tel:+56226543200" className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-3 text-center hover:border-emerald-500/70">
                  <Phone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[13px] font-bold tabular-nums text-foreground">+56 2 2654 3200</span>
                  <span className="text-[10px] text-muted-foreground">Mun. Providencia</span>
                </a>
                <a href="tel:6003607777" className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-3 text-center hover:border-emerald-500/70">
                  <Phone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[13px] font-bold tabular-nums text-foreground">600 360 7777</span>
                  <span className="text-[10px] text-muted-foreground">Salud Responde</span>
                </a>
              </div>
            </div>
            {p.position ? (
              <>
                <Button
                  onClick={() => void compartirUbicacion()}
                  className="mt-3 w-full bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-semibold"
                >
                  <Share2 className="h-4 w-4 mr-2" /> Compartir mi ubicación
                </Button>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 py-2">
                  <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/90">
                    {p.position.lat.toFixed(5)}, {p.position.lon.toFixed(5)}
                  </span>
                </div>
              </>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Sin posición GPS aún: no se puede compartir ubicación. Acércate al acceso o caseta más cercana del parque.
              </p>
            )}
            {sosMsg && <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400" role="status">{sosMsg}</p>}
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Si puedes, avisa también al personal del parque (accesos y casetas). El teléfono de Parquemet es de
              informaciones (9:00 a 17:00); ante una urgencia llama siempre al 133. Tu QR Pedalea Seguro pegado en la
              bici ayuda a que te identifiquen rápido.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/40 p-2.5">
      <div className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 font-mono text-[15px] font-bold tabular-nums leading-none text-foreground">
        {value}
        {unit && <span className="ml-0.5 font-sans text-[10px] font-semibold text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

const EVENT_STYLE: Record<RideEvent["kind"], { dot: string; text: string }> = {
  info: { dot: "bg-emerald-400", text: "text-foreground/90" },
  gate: { dot: "bg-teal-400", text: "text-foreground/90" },
  zone: { dot: "bg-amber-400", text: "text-amber-800 dark:text-amber-200" },
  warn: { dot: "bg-amber-500", text: "text-amber-800 dark:text-amber-200" },
  danger: { dot: "bg-red-500", text: "text-red-700 dark:text-red-300 font-medium" },
};

function EventDot({ kind }: { kind: RideEvent["kind"] }) {
  return <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${EVENT_STYLE[kind].dot}`} />;
}

function eventText(kind: RideEvent["kind"]): string {
  return EVENT_STYLE[kind].text;
}
