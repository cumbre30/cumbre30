"use client";

// ============================================================
// Estadísticas generales - con subsecciones:
//   · "General": totales del historial local (FREE) + teaser del
//     resumen mensual avanzado (PRO).
//   · "Pro": resumen mes a mes (statsMonthly) y estadísticas por
//     segmento del cerro (función Pro, validada: HistoryTab ya
//     las calcula solo con Pro).
//
// Solo viajes con GPS real de la cuenta activa: los de demostración
// (simulación, sin GPS) no cuentan en ninguna estadística y los de
// otra cuenta no se mezclan (gpsOnly + ridesForAccount de lib/history).
// ============================================================

import { useMemo, useState, useSyncExternalStore } from "react";
import { CalendarRange, Flame, Gauge, Clock, Lock, Mountain, Route, TrendingUp, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { bikeOnly, historyStore, ridesForAccount } from "@/lib/history";
import { formatClock } from "@/lib/geo";
import { computeSegmentStats, fmtEffort, SEGMENTS } from "@/lib/segments";
import { bestMonth, deltaVsPrev, monthlyBuckets } from "@/lib/statsMonthly";
import { rachasDe } from "@/lib/rachas";
import { useProLicense } from "@/lib/proLicense";
import { useMe } from "@/hooks/useMe";
import { ProTag } from "@/components/ProUI";
import { SubTabs } from "@/components/SubTabs";

function Kpi({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit?: string }) {
  return (
    <Card className="p-3.5">
      {/* Texto centrado (cliente 2026-11-13): etiqueta y valor al centro de la tarjeta. */}
      <div className="flex items-center justify-center gap-1.5 text-center text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 text-center font-mono text-[22px] font-bold leading-none tabular-nums text-foreground">
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
  // real en bici, enlazados a la cuenta (sin sesión: solo locales del
  // teléfono; los demo y los rides en vehículo no cuentan).
  const accountEmail = me?.user.email ?? null;
  const gpsRides = useMemo(
    () => bikeOnly(ridesForAccount(rides, accountEmail)),
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

  // Estadísticas avanzadas (Pro): resumen de los últimos 6 meses.
  const months = useMemo(() => monthlyBuckets(gpsRides, 6), [gpsRides]);
  const best = useMemo(() => bestMonth(months), [months]);
  const delta = useMemo(() => deltaVsPrev(months), [months]);

  // Rachas (Ola 1): días/semanas consecutivas con al menos un ride GPS.
  const rachas = useMemo(() => rachasDe(gpsRides), [gpsRides]);

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
            Solo cuentan viajes con GPS real en bici (los demo y los viajes en vehículo no) · se guardan en este teléfono (gratis: últimos 20).
          </p>

          {/* Rachas de actividad (Ola 1): días y semanas consecutivas con ride */}
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <p className="text-sm font-semibold text-foreground">Rachas</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-lg border border-border/70 bg-background/40 p-2.5">
                <p className="font-mono text-[20px] font-bold leading-none tabular-nums text-foreground">
                  {rachas.diasActual}
                </p>
                <p className="mt-1 text-[10px] leading-tight text-muted-foreground">días seguidos</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/40 p-2.5">
                <p className="font-mono text-[20px] font-bold leading-none tabular-nums text-foreground">
                  {rachas.diasMaxima}
                </p>
                <p className="mt-1 text-[10px] leading-tight text-muted-foreground">récord de días</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/40 p-2.5">
                <p className="font-mono text-[20px] font-bold leading-none tabular-nums text-foreground">
                  {rachas.semanasActual}
                </p>
                <p className="mt-1 text-[10px] leading-tight text-muted-foreground">semanas seguidas</p>
              </div>
            </div>
            <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
              {rachas.diasTotales > 0
                ? `${rachas.diasTotales} ${rachas.diasTotales === 1 ? "día distinto con pedaleo" : "días distintos con pedaleo"} en tu historial`
                : "Pedalea un día para arrancar tu primera racha"}
            </p>
          </Card>

          {/* Teaser del resumen mensual avanzado (Pro) */}
          {!pro.active && (
            <Card className="border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-start gap-3">
                <CalendarRange className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">Resumen mensual avanzado</p>
                    <ProTag />
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                    Tus kilómetros mes a mes con desnivel y horas en bici, comparación contra el mes anterior y tu
                    récord de mejor mes.
                  </p>
                  <Button
                    onClick={onGoPro}
                    size="sm"
                    className="mt-3 h-9 bg-amber-500 font-bold text-zinc-950 hover:bg-amber-400"
                  >
                    <Lock className="mr-1.5 h-3.5 w-3.5" /> Con PRO
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {sub === "pro" && (
        <>
          {/* Resumen mensual - estadísticas avanzadas (Pro) */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">Resumen mensual</p>
              {!pro.active && <ProTag />}
            </div>
            {pro.active ? (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-3 gap-2">
                  <Kpi icon={<TrendingUp className="h-3.5 w-3.5" />} label="Este mes" value={(months[months.length - 1]?.km ?? 0).toFixed(1)} unit="km" />
                  <Kpi icon={<CalendarRange className="h-3.5 w-3.5" />} label="Mes anterior" value={(months[months.length - 2]?.km ?? 0).toFixed(1)} unit="km" />
                  <Kpi icon={<Trophy className="h-3.5 w-3.5" />} label="Mejor mes" value={(best?.km ?? 0).toFixed(1)} unit="km" />
                </div>
                {delta && (
                  <p className="text-center text-[11.5px] text-muted-foreground">
                    Variación vs mes anterior: <b className="text-foreground">{delta}</b>
                    {best ? ` · récord: ${best.label} con ${best.km.toFixed(1)} km` : ""}
                  </p>
                )}
                <Card className="overflow-hidden p-0">
                  <table className="w-full border-collapse text-[12.5px]">
                    <thead>
                      <tr className="bg-muted/70">
                        <th className="px-3 py-2 text-left text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Mes</th>
                        <th className="px-2 py-2 text-right text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Km</th>
                        <th className="px-2 py-2 text-right text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Viajes</th>
                        <th className="px-3 py-2 text-right text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Desnivel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((m) => (
                        <tr key={m.ym} className={m.ym === best?.ym ? "bg-amber-500/10" : ""}>
                          <td className="px-3 py-2 font-medium capitalize text-foreground">
                            {m.label}{m.ym === best?.ym ? " 🏆" : ""}
                          </td>
                          <td className="px-2 py-2 text-right font-mono tabular-nums text-foreground">{m.km.toFixed(1)}</td>
                          <td className="px-2 py-2 text-right font-mono tabular-nums text-muted-foreground">{m.rides}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">+{Math.round(m.gainM)} m</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
                <p className="text-center text-[11px] text-muted-foreground">Últimos 6 meses · solo viajes con GPS real en bici.</p>
              </div>
            ) : (
              <Card className="p-4 text-center text-xs leading-relaxed text-muted-foreground">
                Kilómetros mes a mes, desnivel, horas en bici y tu mejor mes.
                <Button onClick={onGoPro} size="sm" className="mt-3 h-9 bg-amber-500 font-bold text-zinc-950 hover:bg-amber-400">
                  <Lock className="mr-1.5 h-3.5 w-3.5" /> Desbloquear con PRO
                </Button>
              </Card>
            )}
          </div>

          {/* Segmentos del cerro - función Pro validada (lib/segments) */}
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
                  Pedalea el cerro con GPS real y tus tiempos por segmento aparecerán aquí.
                </Card>
              )
            ) : (
              <>
                {/* Todos los segmentos existen (subidas + bajadas 30 + enduro):
                    el nivel gratis los ve bloqueados */}
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
                <Button onClick={onGoPro} size="sm" className="h-9 shrink-0 self-center rounded-lg bg-emerald-600 px-3 text-xs font-bold text-(--c30-on-accent) hover:bg-emerald-500">
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
