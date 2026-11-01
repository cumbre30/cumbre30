"use client";

// ============================================================
// Vista de ride estilo ciclócomputador (referencia iGPSPORT):
// banner de giro + minimapa arriba, velocidad y distancia en
// dos columnas, y el resto de indicadores debajo.
// Conserva: banner de zona, exceso, estadísticas y bitácora.
// ============================================================

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { Bike, Gauge, ListTree, Mountain, Navigation, Route, ShieldAlert, Timer, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LIMIT_KMH } from "@/lib/park";
import { formatClock } from "@/lib/geo";
import { formatStepRemaining, routeProgress, stepGlyph } from "@/lib/routing";
import type { LatLng } from "@/lib/park";
import type { RideEvent, SpeedState } from "@/hooks/useRideEngine";
import type { NavEngine } from "@/hooks/useNavEngine";

const MiniMap = dynamic(() => import("@/components/MiniMap"), {
  ssr: false,
  loading: () => <div className="h-52 sm:h-56 rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-center text-sm text-zinc-500">Cargando minimapa…</div>,
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
  running: boolean;
  position: LatLng | null;
  track: LatLng[];
  heading: number | null;
  userPin?: string;
  nav: NavEngine;
};

function StatTile({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit?: string }) {
  return (
    <Card className="bg-zinc-900/80 border-zinc-800 p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-zinc-400">
        {icon}
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <div className="font-mono text-xl font-semibold text-zinc-100 tabular-nums leading-none">
        {value}
        {unit && <span className="text-xs text-zinc-500 font-sans font-normal ml-1">{unit}</span>}
      </div>
    </Card>
  );
}

const EVENT_STYLE: Record<RideEvent["kind"], { dot: string; text: string }> = {
  info: { dot: "bg-emerald-400", text: "text-zinc-300" },
  gate: { dot: "bg-teal-400", text: "text-zinc-300" },
  zone: { dot: "bg-amber-400", text: "text-amber-200" },
  warn: { dot: "bg-amber-500", text: "text-amber-200" },
  danger: { dot: "bg-red-500", text: "text-red-300 font-medium" },
};

export { stepGlyph };

function fmtMeters(m: number): string {
  return m >= 950 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(m / 10) * 10)} m`;
}

export function RideView(p: Props) {
  const over = p.speedState === "over";
  const caution = p.speedState === "caution";

  const speedColor = over
    ? "text-red-500"
    : caution
      ? "text-amber-400"
      : p.insidePark
        ? "text-emerald-400"
        : "text-zinc-100";

  const banner = over
    ? "bg-red-950/90 border-red-600 text-red-200 animate-pulse"
    : caution
      ? "bg-amber-950/90 border-amber-500 text-amber-200"
      : p.insidePark
        ? "bg-emerald-950/70 border-emerald-700 text-emerald-200"
        : "bg-zinc-900/80 border-zinc-800 text-zinc-400";

  const bannerText = over
    ? `¡EXCESO DE VELOCIDAD! · LÍMITE ${LIMIT_KMH} km/h`
    : caution
      ? `PRECAUCIÓN · te acercas al límite de ${LIMIT_KMH} km/h`
      : p.insidePark
        ? `MODO PARQUEMET · límite ${LIMIT_KMH} km/h`
        : "MODO LIBRE · fuera del parque";

  // Navegación viva: próximo paso + restante
  const onRoute = !!p.nav.route && p.nav.route.coords.length > 1;
  const progress = useMemo(
    () => (onRoute && p.position ? routeProgress(p.nav.route!, p.position) : null),
    [onRoute, p.position, p.nav.route]
  );
  const nextStep = progress?.nextStep ?? p.nav.route?.steps[0] ?? null;
  const laterStep = onRoute && progress && p.nav.route ? p.nav.route.steps[progress.passedCount + 1] ?? null : null;
  const remainingM = progress?.remainingM ?? p.nav.route?.distanceM ?? 0;
  const etaMin = remainingM > 0 ? Math.max(1, Math.round((remainingM / 1000) / (p.avgKmh > 4 ? p.avgKmh : 15) * 60)) : 0;
  const offRoute = !!progress && progress.offRouteM > 90;

  return (
    <div className="flex flex-col gap-3">
      {/* Banner de navegación (solo con ruta elegida) */}
      {onRoute && nextStep && (
        <Card className="bg-zinc-900 border-sky-800/70 px-3 py-3 flex-row items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-zinc-950 border border-sky-800 flex items-center justify-center text-3xl leading-none text-sky-300 shrink-0" aria-hidden>
            {stepGlyph(nextStep.icon)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-zinc-100 tabular-nums leading-none whitespace-nowrap shrink-0">
                {nextStep.icon === "end" ? "" : `En ${fmtMeters(progress?.distToNextStepM ?? nextStep.distM)}`}
              </span>
              {offRoute && <span className="text-[11px] text-amber-300 font-semibold">desviado, recalculando…</span>}
            </div>
            <div className="text-sm text-zinc-200 leading-snug mt-0.5 truncate">{nextStep.text}</div>
            {laterStep && (
              <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                Luego: {stepGlyph(laterStep.icon)} {laterStep.text} · {formatStepRemaining(laterStep)}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-lg font-bold text-sky-300 tabular-nums leading-none">{fmtMeters(remainingM)}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">restante · ~{etaMin} min</div>
          </div>
        </Card>
      )}

      {/* Minimapa con controles «Ir a…» */}
      <MiniMap position={p.position} heading={p.heading} track={p.track} accuracyM={p.accuracyM} userPin={p.userPin} nav={p.nav} />
      {!p.nav.route && p.nav.note && <p className="text-xs text-amber-300/90 -mt-2">{p.nav.note}</p>}

      {/* Banner de zona */}
      <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 font-semibold tracking-wide text-sm ${banner}`} role="status" aria-live="polite">
        {p.insidePark ? <ShieldAlert className="h-5 w-5 shrink-0" /> : <Bike className="h-5 w-5 shrink-0" />}
        <span>{bannerText}</span>
      </div>

      {/* Velocidad y distancia — estilo foto de referencia */}
      <Card className="bg-zinc-900/80 border-zinc-800 p-4 grid grid-cols-2 divide-x divide-zinc-800">
        <div className="pr-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] uppercase tracking-wide">
            <Gauge className="h-3.5 w-3.5" /> Velocidad
            {p.insidePark && <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold border ${over ? "border-red-500 bg-red-950 text-red-300" : "border-emerald-700 bg-emerald-950 text-emerald-300"}`}>LÍMITE {LIMIT_KMH}</span>}
          </div>
          <div className={`font-mono font-bold tabular-nums leading-none mt-1.5 text-5xl ${speedColor}`} aria-label={`Velocidad actual ${Math.round(p.speedKmh)} kilómetros por hora`}>
            {Math.round(p.speedKmh)}
            <span className="text-sm text-zinc-500 font-sans font-normal ml-1.5">km/h</span>
          </div>
        </div>
        <div className="pl-4">
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] uppercase tracking-wide">
            <Route className="h-3.5 w-3.5" /> Distancia
          </div>
          <div className="font-mono font-bold tabular-nums leading-none mt-1.5 text-5xl text-zinc-100">
            {p.distanceKm.toFixed(2)}
            <span className="text-sm text-zinc-500 font-sans font-normal ml-1.5">km</span>
          </div>
        </div>
      </Card>

      <div className="text-xs text-zinc-500 -mt-1">
        {p.accuracyM !== null && p.running ? `Precisión GPS: ±${Math.round(p.accuracyM)} m` : p.running ? "Adquiriendo señal GPS…" : "En espera — presiona Iniciar"}
      </div>

      {/* Contador de exceso (evidencia) */}
      {p.overLimitSec > 0 && (
        <Card className="bg-red-950/40 border-red-900 px-3 py-3 flex-row items-center justify-between">
          <div className="flex items-center gap-2 text-red-300 text-sm font-medium">
            <ShieldAlert className="h-4 w-4" />
            Tiempo sobre el límite dentro del parque
          </div>
          <div className="font-mono text-lg font-bold text-red-300 tabular-nums">{formatClock(p.overLimitSec)}</div>
        </Card>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile icon={<TrendingUp className="h-3.5 w-3.5" />} label="Máx" value={p.maxKmh.toFixed(1)} unit="km/h" />
        <StatTile icon={<Gauge className="h-3.5 w-3.5" />} label="Prom" value={p.avgKmh.toFixed(1)} unit="km/h" />
        <StatTile icon={<Timer className="h-3.5 w-3.5" />} label="Tiempo" value={formatClock(p.elapsedSec)} />
        <StatTile icon={<Mountain className="h-3.5 w-3.5" />} label="Desnivel" value={`+${Math.round(p.gainM)}`} unit="m" />
        <StatTile
          icon={p.slopePct < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
          label="Pendiente"
          value={`${p.slopePct > 0 ? "+" : ""}${p.slopePct.toFixed(1)}`}
          unit="%"
        />
        <StatTile icon={<Navigation className="h-3.5 w-3.5" />} label="GPS" value={p.accuracyM !== null ? `±${Math.round(p.accuracyM)}` : "—"} unit={p.accuracyM !== null ? "m" : undefined} />
      </div>

      {p.maxInParkKmh !== null && (
        <div className="text-xs text-zinc-500 text-center">
          Velocidad máxima registrada dentro del parque: <span className="font-mono text-zinc-300">{p.maxInParkKmh.toFixed(1)} km/h</span>
        </div>
      )}

      {/* Indicaciones completas (colapsables) */}
      {onRoute && p.nav.route && p.nav.route.steps.length > 1 && (
        <details className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 group">
          <summary className="flex items-center gap-2 text-sm font-semibold text-zinc-300 cursor-pointer select-none list-none">
            <ListTree className="h-4 w-4 text-sky-400" />
            Indicaciones de la ruta ({p.nav.route.steps.length})
            <span className="ml-auto text-[11px] text-zinc-500 font-normal group-open:hidden">ver todas</span>
            <span className="ml-auto text-[11px] text-zinc-500 font-normal hidden group-open:inline">ocultar</span>
          </summary>
          <ol className="mt-3 space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {p.nav.route.steps.map((s, i) => {
              const passed = progress ? i < progress.passedCount : false;
              return (
                <li key={i} className={`flex items-start gap-2 text-sm ${passed ? "text-zinc-600 line-through" : "text-zinc-200"}`}>
                  <span className="text-lg leading-none w-6 text-center shrink-0" aria-hidden>
                    {stepGlyph(s.icon)}
                  </span>
                  <span className="min-w-0 flex-1">{s.text}</span>
                  <span className="text-[11px] text-zinc-500 shrink-0">{s.distM > 0 ? formatStepRemaining(s) : ""}</span>
                </li>
              );
            })}
          </ol>
        </details>
      )}

      {/* Bitácora de eventos */}
      <div>
        <div className="text-[11px] uppercase tracking-wide text-zinc-500 mb-2">Bitácora del viaje</div>
        <Card className="bg-zinc-900/80 border-zinc-800 p-0 overflow-hidden">
          <ul className="max-h-56 overflow-y-auto divide-y divide-zinc-800/70" aria-label="Eventos del viaje">
            {p.events.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-zinc-600">Sin eventos aún — los avisos de zona, geocercas y excesos aparecerán aquí.</li>
            )}
            {[...p.events].reverse().map((ev, i) => (
              <li key={`${ev.t}-${i}`} className="px-4 py-2.5 flex items-start gap-2.5 text-sm">
                <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${EVENT_STYLE[ev.kind].dot}`} />
                <span className={EVENT_STYLE[ev.kind].text}>{ev.text}</span>
                <span className="ml-auto font-mono text-[11px] text-zinc-600 shrink-0 mt-0.5">
                  {new Date(ev.t).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
