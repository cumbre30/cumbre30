"use client";

// ============================================================
// Estadísticas generales — totales del historial local.
// Los totales siempre (FREE); los segmentos del cerro son Pro
// (validado: HistoryTab ya los calcula solo con Pro).
// ============================================================

import { useMemo, useSyncExternalStore } from "react";
import { Gauge, Clock, Lock, Mountain, Route, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { historyStore } from "@/lib/history";
import { formatClock } from "@/lib/geo";
import { computeSegmentStats, fmtEffort } from "@/lib/segments";
import { useProLicense } from "@/lib/proLicense";
import { ProTag } from "@/components/ProUI";

function Kpi({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit?: string }) {
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 font-mono text-[22px] font-bold leading-none tabular-nums text-foreground">
        {value}
        {unit && <span className="ml-1 font-sans text-[11px] font-semibold text-muted-foreground">{unit}</span>}
      </p>
    </Card>
  );
}

export function StatsTab({ onGoPro }: { onGoPro: () => void }) {
  const rides = useSyncExternalStore(historyStore.subscribe, historyStore.get, historyStore.getServer);
  const { pro } = useProLicense();

  const totals = useMemo(() => {
    const dist = rides.reduce((a, r) => a + r.distanceKm, 0);
    const time = rides.reduce((a, r) => a + r.elapsedSec, 0);
    const gain = rides.reduce((a, r) => a + r.gainM, 0);
    const max = rides.reduce((a, r) => Math.max(a, r.maxKmh), 0);
    const gpsRides = rides.filter((r) => r.source === "gps").length;
    return { dist, time, gain, max, gpsRides, count: rides.length };
  }, [rides]);

  const segStats = useMemo(() => (pro.active ? computeSegmentStats(rides) : []), [pro.active, rides]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5">
        <Kpi icon={<Route className="h-3.5 w-3.5" />} label="Distancia" value={totals.dist.toFixed(1)} unit="km" />
        <Kpi icon={<Trophy className="h-3.5 w-3.5" />} label="Viajes" value={String(totals.count)} />
        <Kpi icon={<Clock className="h-3.5 w-3.5" />} label="Tiempo" value={formatClock(totals.time)} />
        <Kpi icon={<Mountain className="h-3.5 w-3.5" />} label="Desnivel" value={`+${Math.round(totals.gain)}`} unit="m" />
        <Kpi icon={<Gauge className="h-3.5 w-3.5" />} label="Vel. máx" value={totals.max.toFixed(1)} unit="km/h" />
        <Kpi icon={<Gauge className="h-3.5 w-3.5" />} label="Con GPS real" value={String(totals.gpsRides)} />
      </div>
      <p className="-mt-1 text-center text-[11px] text-muted-foreground">Tus viajes se guardan en este teléfono (últimos 50).</p>

      {/* Segmentos del cerro — función Pro validada (lib/segments) */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">Segmentos del cerro</p>
          {!pro.active && <ProTag />}
        </div>
        {pro.active ? (
          segStats.length ? (
            <div className="flex flex-col gap-2">
              {segStats.map((s) => (
                <Card key={s.def.id} className="flex items-center gap-3 p-3.5">
                  <span className="text-xl">🏁</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-foreground">{s.def.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {s.count} {s.count === 1 ? "intento" : "intentos"}
                      {s.pb ? ` · récord: ${fmtEffort(s.pb.timeSec)}` : ""}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-4 text-center text-xs text-muted-foreground">
              Sube el cerro con GPS real y tus tiempos por segmento aparecerán aquí.
            </Card>
          )
        ) : (
          <Card className="flex items-center gap-3 p-4">
            <span className="text-xl">🏁</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold text-foreground">Pío Nono → Cumbre</p>
              <p className="text-[11.5px] leading-snug text-muted-foreground">
                Tu récord personal e historial de intentos por segmento.
              </p>
            </div>
            <Button onClick={onGoPro} size="sm" className="h-9 shrink-0 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-zinc-950 hover:bg-emerald-500">
              <Lock className="mr-1 h-3 w-3" /> Con PRO
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
