"use client";

// ============================================================
// Estadísticas generales — con subsecciones:
//   · "General": totales del historial local (FREE).
//   · "Pro": estadísticas por segmento del cerro (función Pro,
//     validada: HistoryTab ya las calcula solo con Pro).
//
// Solo viajes con GPS real de la cuenta activa: los de demostración
// (simulación, sin GPS) no cuentan en ninguna estadística y los de
// otra cuenta no se mezclan (gpsOnly + ridesForAccount de lib/history).
// ============================================================

import { useMemo, useState, useSyncExternalStore } from "react";
import { Gauge, Clock, Lock, Mountain, Route, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { gpsOnly, historyStore, ridesForAccount } from "@/lib/history";
import { formatClock } from "@/lib/geo";
import { computeSegmentStats, fmtEffort, SEGMENTS } from "@/lib/segments";
import { useProLicense } from "@/lib/proLicense";
import { useMe } from "@/hooks/useMe";
import { ProTag } from "@/components/ProUI";
import { SubTabs } from "@/components/SubTabs";

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
  const { me } = useMe();

  // Subsecciones: General (totales) | Pro (segmentos del cerro)
  const [sub, setSub] = useState<"general" | "pro">("general");

  // Todas las estadísticas provienen exclusivamente de viajes con GPS
  // real enlazados a la cuenta (sin sesión: solo locales del teléfono).
  const accountEmail = me?.user.email ?? null;
  const gpsRides = useMemo(
    () => gpsOnly(ridesForAccount(rides, accountEmail)),
    [rides, accountEmail],
  );

  const totals = useMemo(() => {
    const dist = gpsRides.reduce((a, r) => a + r.distanceKm, 0);
    const time = gpsRides.reduce((a, r) => a + r.elapsedSec, 0);
    const gain = gpsRides.reduce((a, r) => a + r.gainM, 0);
    const max = gpsRides.reduce((a, r) => Math.max(a, r.maxKmh), 0);
    // Velocidad promedio global: km recorridos / tiempo total.
    const avg = time > 0 ? (dist / time) * 3600 : 0;
    return { dist, time, gain, max, avg, count: gpsRides.length };
  }, [gpsRides]);

  const segStats = useMemo(
    () => (pro.active ? computeSegmentStats(gpsRides) : []),
    [pro.active, gpsRides],
  );

  return (
    <div className="flex flex-col gap-4">
      <SubTabs
        ariaLabel="Subsecciones de Estadísticas generales"
        value={sub}
        onChange={(k) => setSub(k as "general" | "pro")}
        tabs={[
          { key: "general", label: "General" },
          { key: "pro", label: "Pro", crown: true },
        ]}
      />

      {sub === "general" && (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <Kpi icon={<Route className="h-3.5 w-3.5" />} label="Distancia" value={totals.dist.toFixed(1)} unit="km" />
            <Kpi icon={<Trophy className="h-3.5 w-3.5" />} label="Viajes" value={String(totals.count)} />
            <Kpi icon={<Clock className="h-3.5 w-3.5" />} label="Tiempo" value={formatClock(totals.time)} />
            <Kpi icon={<Mountain className="h-3.5 w-3.5" />} label="Desnivel" value={`+${Math.round(totals.gain)}`} unit="m" />
            <Kpi icon={<Gauge className="h-3.5 w-3.5" />} label="Vel. máx" value={totals.max.toFixed(1)} unit="km/h" />
            <Kpi icon={<Gauge className="h-3.5 w-3.5" />} label="Vel. prom" value={totals.avg.toFixed(1)} unit="km/h" />
          </div>
          <p className="-mt-1 text-center text-[11px] text-muted-foreground">
            Solo cuentan viajes con GPS real (los demo no) · se guardan en este teléfono (últimos 50).
          </p>
        </>
      )}

      {sub === "pro" && (
        <>
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
              <>
                {/* Los 3 segmentos existen: el nivel gratis los ve bloqueados */}
                <div className="flex flex-col gap-2">
                  {SEGMENTS.map((def) => (
                    <Card key={def.id} className="flex items-center gap-3 p-3.5">
                      <span className="text-xl">🏁</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-bold text-foreground">{def.name}</p>
                        <p className="text-[11px] leading-snug text-muted-foreground">{def.detail}</p>
                      </div>
                      <Lock className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                    </Card>
                  ))}
                </div>
                <Button onClick={onGoPro} size="sm" className="h-9 shrink-0 self-center rounded-lg bg-emerald-600 px-3 text-xs font-bold text-zinc-950 hover:bg-emerald-500">
                  <Lock className="mr-1 h-3 w-3" /> Con PRO
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
