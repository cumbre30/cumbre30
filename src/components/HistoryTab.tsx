"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CalendarClock, Download, FileDown, Gauge, ShieldAlert, Timer, Trash2, Route } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatClock } from "@/lib/geo";
import { clearHistory, historyStore, type RideSummary } from "@/lib/history";
import { buildRidePdf, type RideIdentity } from "@/lib/ridePdf";
import { shareOrDownloadFile } from "@/lib/shareFile";
import { buildRideGpxBlob } from "@/lib/gpx";
import {
  constanciaCount,
  FREE_CONSTANCIA_LIMIT,
  incrConstancia,
  useProLicense,
} from "@/lib/proLicense";

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
  const { pro } = useProLicense();
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);
  const [gpxBusyId, setGpxBusyId] = useState<string | null>(null);
  const [gpxMsg, setGpxMsg] = useState<string | null>(null);
  const [constCount, setConstCount] = useState(0);

  // Relee el historial cuando se guarda un ride nuevo
  useEffect(() => {
    historyStore.refresh();
    setConstCount(constanciaCount());
  }, [refreshKey]);

  const exportPdf = async (r: RideSummary) => {
    // Los viajes demo (simulación) no emiten constancia: el registro
    // debe corresponder a un trayecto real hecho con GPS.
    if (r.source === "sim") return;
    // Nivel gratis: cuota mensual de constancias. Pro: ilimitadas.
    if (!pro.active && constanciaCount() >= FREE_CONSTANCIA_LIMIT) {
      setPdfMsg(
        `Este mes ya usaste tus ${FREE_CONSTANCIA_LIMIT} constancias gratis. ` +
          "Con Cumbre30 Pro (pestaña Perfil) son ilimitadas.",
      );
      setTimeout(() => setPdfMsg(null), 9000);
      return;
    }
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
      incrConstancia();
      setConstCount(constanciaCount());
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

  const exportGpx = async (r: RideSummary) => {
    if (r.source === "sim") return;
    setGpxBusyId(r.id);
    setGpxMsg(null);
    try {
      if (!pro.active) {
        setGpxMsg("El export GPX es parte de Cumbre30 Pro — actívalo en la pestaña Perfil.");
        return;
      }
      if (!r.track || r.track.length < 2) {
        setGpxMsg("Este viaje no guarda pista GPS (se grabó antes de la v1.5.0).");
        return;
      }
      const blob = buildRideGpxBlob(r);
      if (!blob) return;
      const day = r.dateISO.slice(0, 10);
      await shareOrDownloadFile({
        blob,
        fileName: `cumbre30-${day}-${r.id.slice(0, 8)}.gpx`,
        title: "Viaje GPX — Cumbre30",
        text: "Pista GPX de tu viaje en el cerro, generada por Cumbre30.",
      });
      setGpxMsg("GPX listo: impórtalo en Strava, Garmin o Komoot.");
    } catch {
      setGpxMsg("No pudimos generar el GPX en este dispositivo.");
    } finally {
      setGpxBusyId(null);
      setTimeout(() => setGpxMsg(null), 9000);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-card/80 border-border p-4 text-sm text-muted-foreground leading-relaxed">
        Registro local de tus viajes por el cerro. Si recibes un parte por exceso de velocidad,
        esta bitácora (velocidad máxima dentro del parque y tiempo sobre el límite) sirve como
        respaldo de tu comportamiento real: cada viaje hecho con GPS se puede descargar como{" "}
        <span className="text-foreground">constancia PDF con redacción formal y código de verificación</span>{" "}
        para presentarla ante Parquemet o la autoridad. Los viajes de demostración no emiten constancia.
        {pro.active ? (
          <span className="mt-2 block text-emerald-700 dark:text-emerald-300">
            Cumbre30 Pro activo: constancias ilimitadas y export GPX en cada viaje con GPS.
          </span>
        ) : (
          <span className="mt-2 block">
            Este mes llevas <span className="text-foreground">{constCount}/{FREE_CONSTANCIA_LIMIT}</span> constancias
            gratis. Con <span className="text-foreground">Cumbre30 Pro</span> (Perfil) son ilimitadas y cada viaje
            con GPS se exporta en GPX para Strava o Garmin.
          </span>
        )}
      </Card>

      {rides.length === 0 ? (
        <Card className="bg-card/60 border-border p-8 text-center text-muted-foreground text-sm">
          Aún no hay viajes guardados. Inicia un ride y al detenerlo quedará registrado aquí.
        </Card>
      ) : (
        <>
          <ul className="flex flex-col gap-2" aria-label="Viajes guardados">
            {rides.map((r) => (
              <li key={r.id}>
                <Card className="bg-card/80 border-border p-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <CalendarClock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> {fmtDate(r.dateISO)}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="border-border text-muted-foreground text-[10px] uppercase">
                        {r.source === "sim" ? "demo" : "gps"}
                      </Badge>
                      {r.source !== "sim" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={gpxBusyId === r.id}
                          onClick={() => void exportGpx(r)}
                          title={
                            pro.active
                              ? r.track && r.track.length >= 2
                                ? "Exportar pista GPX del viaje (Strava, Garmin, Komoot)"
                                : "Este viaje no guarda pista GPS (se grabó antes de la v1.5.0)"
                              : "El export GPX es parte de Cumbre30 Pro"
                          }
                          className="h-7 border-border px-2 text-xs text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-40"
                          aria-label={`Exportar GPX del viaje del ${fmtDate(r.dateISO)}`}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          {gpxBusyId === r.id ? "…" : "GPX"}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pdfBusyId === r.id || r.source === "sim"}
                        onClick={() => void exportPdf(r)}
                        title={r.source === "sim" ? "Los viajes de demostración no emiten constancia" : "Descargar constancia PDF del viaje"}
                        className="h-7 border-emerald-800/60 px-2 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-950 hover:text-emerald-300 disabled:opacity-40"
                        aria-label={
                          r.source === "sim"
                            ? "Viaje de demostración: no emite constancia"
                            : `Descargar constancia PDF del viaje del ${fmtDate(r.dateISO)}`
                        }
                      >
                        <FileDown className="h-3.5 w-3.5 mr-1" />
                        {r.source === "sim" ? "Sin constancia" : pdfBusyId === r.id ? "Generando…" : "Constancia PDF"}
                      </Button>
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <div className="flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground"><Route className="h-3 w-3" /> Dist</div>
                      <div className="font-mono text-sm text-foreground">{r.distanceKm.toFixed(2)} km</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground"><Gauge className="h-3 w-3" /> Máx</div>
                      <div className={`font-mono text-sm ${(r.maxInParkKmh ?? 0) > 30 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{r.maxKmh.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground"><Timer className="h-3 w-3" /> Tiempo</div>
                      <div className="font-mono text-sm text-foreground">{formatClock(r.elapsedSec)}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground"><ShieldAlert className="h-3 w-3" /> S/límite</div>
                      <div className={`font-mono text-sm ${r.overLimitSec > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {r.overLimitSec > 0 ? formatClock(r.overLimitSec) : "0s"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Máx en parque: {r.maxInParkKmh !== null ? `${r.maxInParkKmh.toFixed(1)} km/h` : "no ingresó"} · Promedio: {r.avgKmh.toFixed(1)} km/h · Desnivel: +{Math.round(r.gainM)} m
                    {r.source === "sim" && " · Viaje de demostración: no emite constancia"}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          {pdfMsg && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">{pdfMsg}</p>
          )}
          {gpxMsg && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">{gpxMsg}</p>
          )}
          <Button
            variant="outline"
            className="border-border text-muted-foreground hover:bg-card hover:text-red-600 dark:hover:text-red-400"
            onClick={() => clearHistory()}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Borrar historial
          </Button>
        </>
      )}
    </div>
  );
}
