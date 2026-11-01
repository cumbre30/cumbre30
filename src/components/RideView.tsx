"use client";

import { Bike, Gauge, Mountain, Route, ShieldAlert, Timer, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LIMIT_KMH } from "@/lib/park";
import { formatClock } from "@/lib/geo";
import type { RideEvent, SpeedState } from "@/hooks/useRideEngine";

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

  return (
    <div className="flex flex-col gap-4">
      {/* Banner de zona */}
      <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 font-semibold tracking-wide text-sm ${banner}`} role="status" aria-live="polite">
        {p.insidePark ? <ShieldAlert className="h-5 w-5 shrink-0" /> : <Bike className="h-5 w-5 shrink-0" />}
        <span>{bannerText}</span>
      </div>

      {/* Velocímetro */}
      <div className="relative flex flex-col items-center justify-center py-2">
        <div
          className={`font-mono font-bold tabular-nums leading-none select-none text-[6.5rem] sm:text-[8rem] transition-colors duration-200 ${speedColor} ${over ? "drop-shadow-[0_0_24px_rgba(239,68,68,0.55)]" : ""}`}
          aria-label={`Velocidad actual ${Math.round(p.speedKmh)} kilómetros por hora`}
        >
          {Math.round(p.speedKmh)}
        </div>
        <div className="flex items-center gap-2 text-zinc-400 -mt-2">
          <Gauge className="h-4 w-4" />
          <span className="text-sm tracking-widest uppercase">km/h</span>
          {p.insidePark && (
            <span className={`ml-2 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${over ? "border-red-500 bg-red-950 text-red-300" : "border-emerald-700 bg-emerald-950 text-emerald-300"}`}>
              LÍMITE {LIMIT_KMH}
            </span>
          )}
        </div>
        <div className="mt-2 text-xs text-zinc-500">
          {p.accuracyM !== null && p.running ? `Precisión GPS: ±${Math.round(p.accuracyM)} m` : p.running ? "Adquiriendo señal GPS…" : "En espera — presiona Iniciar"}
        </div>
      </div>

      {/* Contador de exceso (evidencia) */}
      {p.overLimitSec > 0 && (
        <Card className="bg-red-950/40 border-red-900 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-300 text-sm font-medium">
            <ShieldAlert className="h-4 w-4" />
            Tiempo sobre el límite dentro del parque
          </div>
          <div className="font-mono text-lg font-bold text-red-300 tabular-nums">{formatClock(p.overLimitSec)}</div>
        </Card>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile icon={<Gauge className="h-3.5 w-3.5" />} label="Máx" value={p.maxKmh.toFixed(1)} unit="km/h" />
        <StatTile icon={<TrendingUp className="h-3.5 w-3.5" />} label="Prom" value={p.avgKmh.toFixed(1)} unit="km/h" />
        <StatTile icon={<Route className="h-3.5 w-3.5" />} label="Dist" value={p.distanceKm.toFixed(2)} unit="km" />
        <StatTile icon={<Timer className="h-3.5 w-3.5" />} label="Tiempo" value={formatClock(p.elapsedSec)} />
        <StatTile icon={<Mountain className="h-3.5 w-3.5" />} label="Desnivel" value={`+${Math.round(p.gainM)}`} unit="m" />
        <StatTile
          icon={p.slopePct < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
          label="Pendiente"
          value={`${p.slopePct > 0 ? "+" : ""}${p.slopePct.toFixed(1)}`}
          unit="%"
        />
      </div>

      {p.maxInParkKmh !== null && (
        <div className="text-xs text-zinc-500 text-center">
          Velocidad máxima registrada dentro del parque: <span className="font-mono text-zinc-300">{p.maxInParkKmh.toFixed(1)} km/h</span>
        </div>
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
