"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CalendarClock, FileDown, Gauge, ShieldAlert, Timer, Trash2, Route } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatClock } from "@/lib/geo";
import { clearHistory, historyStore, type RideSummary } from "@/lib/history";
import { buildRidePdf, type RideIdentity } from "@/lib/ridePdf";
import { shareOrDownloadFile } from "@/lib/shareFile";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function HistoryTab({
  refreshKey,
  user,
}: {
  refreshKey: number;
  user?: { email?: string; username?: string };
}) {
  const rides = useSyncExternalStore(historyStore.subscribe, historyStore.get, historyStore.getServer);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);

  // Relee el historial cuando se guarda un ride nuevo
  useEffect(() => {
    historyStore.refresh();
  }, [refreshKey]);

  const exportPdf = async (r: RideSummary) => {
    setPdfBusyId(r.id);
    setPdfMsg(null);
    try {
      const identity: RideIdentity = { email: user?.email, username: user?.username };
      const doc = await buildRidePdf(r, identity);
      const blob = doc.output("blob") as Blob;
      const day = r.dateISO.slice(0, 10);
      const fileName = `constancia-cumbre30-${day}-${r.id.slice(0, 8)}.pdf`;
      const res = await shareOrDownloadFile({
        blob,
        fileName,
        title: "Constancia de trayecto — Cumbre30",
        text: "Constancia de registro de trayecto en bicicleta, generada por la aplicación Cumbre30.",
      });
      setPdfMsg(
        res === "shared"
          ? "Constancia lista: envíala por correo o guárdala en tu teléfono desde el panel de Android."
          : "Constancia PDF descargada. Revísala en tu carpeta de descargas."
      );
    } catch {
      setPdfMsg("No pudimos generar la constancia en este dispositivo.");
    } finally {
      setPdfBusyId(null);
      setTimeout(() => setPdfMsg(null), 9000);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-zinc-900/80 border-zinc-800 p-4 text-sm text-zinc-400 leading-relaxed">
        Registro local de tus viajes por el cerro. Si recibes un parte por exceso de velocidad,
        esta bitácora (velocidad máxima dentro del parque y tiempo sobre el límite) sirve como
        respaldo de tu comportamiento real: cada viaje se puede descargar como{" "}
        <span className="text-zinc-200">constancia PDF con redacción formal y código de verificación</span>{" "}
        para presentarla ante Parquemet o la autoridad.
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
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-[10px] uppercase">
                        {r.source === "sim" ? "demo" : "gps"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pdfBusyId === r.id}
                        onClick={() => void exportPdf(r)}
                        className="h-7 border-emerald-800/60 px-2 text-xs text-emerald-400 hover:bg-emerald-950 hover:text-emerald-300"
                        aria-label={`Descargar constancia PDF del viaje del ${fmtDate(r.dateISO)}`}
                      >
                        <FileDown className="h-3.5 w-3.5 mr-1" />
                        {pdfBusyId === r.id ? "Generando…" : "Constancia PDF"}
                      </Button>
                    </span>
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
          {pdfMsg && (
            <p className="text-sm text-emerald-400" role="status">{pdfMsg}</p>
          )}
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
