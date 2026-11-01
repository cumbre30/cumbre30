"use client";

import { useEffect, useSyncExternalStore } from "react";
import { CalendarClock, Gauge, ShieldAlert, Timer, Trash2, Route } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatClock } from "@/lib/geo";
import { clearHistory, historyStore } from "@/lib/history";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function HistoryTab({ refreshKey }: { refreshKey: number }) {
  const rides = useSyncExternalStore(historyStore.subscribe, historyStore.get, historyStore.getServer);

  // Relee el historial cuando se guarda un ride nuevo
  useEffect(() => {
    historyStore.refresh();
  }, [refreshKey]);

  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-zinc-900/80 border-zinc-800 p-4 text-sm text-zinc-400 leading-relaxed">
        Registro local de tus viajes por el cerro. Si recibes un parte por exceso de velocidad,
        esta bitácora (velocidad máxima dentro del parque y tiempo sobre el límite) sirve como
        respaldo de tu comportamiento real.
      </Card>

      {rides.length === 0 ? (
        <Card className="bg-zinc-900/60 border-zinc-800 p-8 text-center text-zinc-500 text-sm">
          Aún no hay viajes guardados. Inicia un ride y al detenerlo quedará registrado aquí.
        </Card>
      ) : (
        <>
          <ul className="flex flex-col gap-2" aria-label="Viajes guardados">
            {rides.map((r) => (
              <li key={r.id}>
                <Card className="bg-zinc-900/80 border-zinc-800 p-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                      <CalendarClock className="h-4 w-4 text-emerald-400" /> {fmtDate(r.dateISO)}
                    </span>
                    <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-[10px] uppercase">
                      {r.source === "sim" ? "demo" : "gps"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <div className="flex items-center justify-center gap-1 text-[10px] uppercase text-zinc-500"><Route className="h-3 w-3" /> Dist</div>
                      <div className="font-mono text-sm text-zinc-200">{r.distanceKm.toFixed(2)} km</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-[10px] uppercase text-zinc-500"><Gauge className="h-3 w-3" /> Máx</div>
                      <div className={`font-mono text-sm ${(r.maxInParkKmh ?? 0) > 30 ? "text-red-400" : "text-zinc-200"}`}>{r.maxKmh.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-[10px] uppercase text-zinc-500"><Timer className="h-3 w-3" /> Tiempo</div>
                      <div className="font-mono text-sm text-zinc-200">{formatClock(r.elapsedSec)}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-[10px] uppercase text-zinc-500"><ShieldAlert className="h-3 w-3" /> S/límite</div>
                      <div className={`font-mono text-sm ${r.overLimitSec > 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {r.overLimitSec > 0 ? formatClock(r.overLimitSec) : "0s"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-zinc-500">
                    Máx en parque: {r.maxInParkKmh !== null ? `${r.maxInParkKmh.toFixed(1)} km/h` : "no ingresó"} · Promedio: {r.avgKmh.toFixed(1)} km/h · Desnivel: +{Math.round(r.gainM)} m
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            className="border-zinc-800 text-zinc-500 hover:bg-zinc-900 hover:text-red-400"
            onClick={() => clearHistory()}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Borrar historial
          </Button>
        </>
      )}
    </div>
  );
}
