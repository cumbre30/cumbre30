"use client";

// ============================================================
// Mis viajes (antes "Historial de viajes") — con subsecciones:
//   · "Viajes": contador de constancias, resumen semanal con
//     compartir (Instagram), filtros de fecha y modo (demo/GPS)
//     y la lista de viajes enlazada al correo de la cuenta.
//   · "Pro": segmentos del cerro — cronometraje de subidas,
//     solo aplican a viajes GPS (función Cumbre30 Pro).
// ============================================================

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  CalendarClock,
  CalendarDays,
  Car,
  ChevronDown,
  Crown,
  Download,
  FileDown,
  Gauge,
  Infinity as InfinityIcon,
  Mountain,
  Route,
  Share2,
  ShieldAlert,
  Timer,
  Trash2,
  Trophy,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatClock } from "@/lib/geo";
import { clearHistory, historyStore, ridesForAccount, type RideSummary } from "@/lib/history";
import { buildRidePdf, type RideIdentity } from "@/lib/ridePdf";
import { shareOrDownloadFile } from "@/lib/shareFile";
import { buildRideGpxBlob } from "@/lib/gpx";
import { buildShareImage, sharePngBlob } from "@/lib/shareImage";
import { computeSegmentStats, effortsByRide, SEGMENTS, fmtEffort } from "@/lib/segments";
import { PINS, DEFAULT_PIN } from "@/lib/pins";
import {
  constanciaCount,
  FREE_CONSTANCIA_LIMIT,
  incrConstancia,
  useProLicense,
} from "@/lib/proLicense";
import { SubTabs } from "@/components/SubTabs";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

// Semana actual: lunes 00:00 → domingo 23:59 (semana ISO, Chile)
function weekBounds(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // lunes
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const fmt = (d: Date) => d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
  return { start, end, label: `${fmt(start)} — ${fmt(new Date(end.getTime() - 1))}` };
}

type RangeKey = "week" | "month" | "day" | "all";
type ModeKey = "all" | "gps" | "sim";

export function HistoryTab({
  refreshKey,
  user,
  onGoPro,
}: {
  refreshKey: number;
  user?: { email?: string; username?: string; selectedPin?: string };
  onGoPro?: () => void;
}) {
  const rides = useSyncExternalStore(historyStore.subscribe, historyStore.get, historyStore.getServer);
  const { pro } = useProLicense();
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);
  const [gpxBusyId, setGpxBusyId] = useState<string | null>(null);
  const [gpxMsg, setGpxMsg] = useState<string | null>(null);
  const [constCount, setConstCount] = useState(0);
  const [constOpen, setConstOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  // Filtros: por defecto solo la semana actual; modo: todos
  const [range, setRange] = useState<RangeKey>("week");
  const [dayISO, setDayISO] = useState(() => new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState<ModeKey>("all");

  // Subsecciones: Viajes (lista) | Pro (segmentos del cerro)
  const [sub, setSub] = useState<"viajes" | "pro">("viajes");

  // ---- Enlace viaje ↔ cuenta: sin correo solo se ven los locales ----
  const accountEmail = user?.email?.trim().toLowerCase() ?? null;
  const linkedRides = useMemo(
    () => ridesForAccount(rides, accountEmail),
    [rides, accountEmail],
  );

  // Segmentos: se calculan solo con Pro (función Pro); para nivel
  // gratis basta el teaser. Solo viajes de la cuenta activa con GPS
  // real: los demo no guardan pista, los rides en vehículo no son
  // pedaleo y otra cuenta no se mezcla.
  const bikeRides = useMemo(
    () => linkedRides.filter((r) => r.source === "gps" && !r.motorized),
    [linkedRides],
  );
  const segStats = useMemo(
    () => (pro.active ? computeSegmentStats(bikeRides) : []),
    [pro.active, bikeRides],
  );
  const perRideEfforts = useMemo(
    () => (pro.active ? effortsByRide(bikeRides) : new Map()),
    [pro.active, bikeRides],
  );

  // Relee el historial cuando se guarda un ride nuevo
  useEffect(() => {
    historyStore.refresh();
    setConstCount(constanciaCount());
  }, [refreshKey]);

  // ---- Filtros de tiempo y modo ----
  const wk = useMemo(() => weekBounds(), []);
  const now = useMemo(() => new Date(), []);
  const inRange = useMemo(() => {
    if (range === "all") return () => true;
    if (range === "week") return (d: Date) => d >= wk.start && d < wk.end;
    if (range === "month") {
      return (d: Date) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    const [y, m, dd] = dayISO.split("-").map(Number);
    return (d: Date) =>
      d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === dd;
  }, [range, wk, now, dayISO]);

  const shownRides = useMemo(
    () =>
      linkedRides.filter((r) => {
        if (mode !== "all" && r.source !== mode) return false;
        return inRange(new Date(r.dateISO));
      }),
    [linkedRides, mode, inRange],
  );

  // Resumen semanal: solo viajes con GPS real en bici (los demo y los
  // rides en vehículo no cuentan en estadísticas) + botón compartir
  const weekRides = useMemo(
    () => linkedRides.filter((r) => {
      if (r.source !== "gps" || r.motorized) return false;
      const d = new Date(r.dateISO);
      return d >= wk.start && d < wk.end;
    }),
    [linkedRides, wk],
  );
  const weekStats = useMemo(() => {
    const km = weekRides.reduce((a, r) => a + r.distanceKm, 0);
    const sec = weekRides.reduce((a, r) => a + r.elapsedSec, 0);
    const gain = weekRides.reduce((a, r) => a + r.gainM, 0);
    const max = weekRides.reduce((a, r) => Math.max(a, r.maxKmh), 0);
    return { count: weekRides.length, km, sec, gain, max };
  }, [weekRides]);

  const shareWeek = async () => {
    setShareBusy(true);
    setShareMsg(null);
    try {
      const pin = PINS[(user?.selectedPin as keyof typeof PINS) ?? DEFAULT_PIN] ?? PINS[DEFAULT_PIN];
      const uname = user?.username ?? "ciclista";
      const blob = await buildShareImage({
        headline: `${pin.emoji} @${uname}`,
        sub: `Mi semana en el cerro · ${wk.label}`,
        rows: [
          { label: "Viajes", value: String(weekStats.count) },
          { label: "Kilómetros", value: `${weekStats.km.toFixed(1)} km` },
          { label: "Tiempo pedaleado", value: formatClock(weekStats.sec) },
          { label: "Desnivel acumulado", value: `+${Math.round(weekStats.gain)} m` },
        ],
      });
      const res = await sharePngBlob(blob, "cumbre30-semana.png", "Mi semana en el cerro con Cumbre30 🚴");
      setShareMsg(
        res === "shared"
          ? "¡Listo! Elige Instagram (Historia o Feed) en el panel."
          : "Imagen descargada. Compártela en Instagram como historia o post."
      );
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setShareMsg("No pudimos generar la imagen en este dispositivo.");
    } finally {
      setShareBusy(false);
      setTimeout(() => setShareMsg(null), 8000);
    }
  };

  const exportPdf = async (r: RideSummary) => {
    // Los viajes demo (simulación) no emiten constancia: el registro
    // debe corresponder a un trayecto real hecho con GPS.
    if (r.source === "sim") return;
    // Nivel gratis: cuota mensual de constancias. Pro: ilimitadas.
    if (!pro.active && constanciaCount() >= FREE_CONSTANCIA_LIMIT) {
      setPdfMsg(
        `Este mes ya usaste tus ${FREE_CONSTANCIA_LIMIT} constancias gratis. ` +
          "Con Cumbre30 Pro (Perfil → Pagos y suscripciones) son ilimitadas.",
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
        setGpxMsg("El export GPX es parte de Cumbre30 Pro — actívalo en Perfil → Pagos y suscripciones.");
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

  const rangeChips: { key: RangeKey; label: string }[] = [
    { key: "week", label: "Semana" },
    { key: "month", label: "Mes" },
    { key: "day", label: "Día" },
    { key: "all", label: "Todos" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SubTabs
        ariaLabel="Subsecciones de Mis viajes"
        value={sub}
        onChange={(k) => setSub(k as "viajes" | "pro")}
        tabs={[
          { key: "viajes", label: "Viajes" },
          { key: "pro", label: "Pro", crown: true },
        ]}
      />

      {sub === "viajes" && (
      <>
      {/* ---- Contador visual de constancias ---- */}
      <Card className="bg-card/80 border-border p-4">
        <button
          type="button"
          onClick={() => setConstOpen((v) => !v)}
          aria-expanded={constOpen}
          className="flex w-full items-center gap-3 text-left"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15">
            <FileDown className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-2xl font-bold leading-none tabular-nums text-foreground">
              {pro.active ? (
                <span className="flex items-center gap-1.5">
                  <InfinityIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  <Badge className="border border-amber-500/40 bg-amber-500/15 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
                    PRO
                  </Badge>
                </span>
              ) : (
                <>
                  {constCount}
                  <span className="text-base text-muted-foreground">/{FREE_CONSTANCIA_LIMIT}</span>
                </>
              )}
            </span>
            <span className="mt-1 block text-[11px] text-muted-foreground">
              constancias PDF {pro.active ? "ilimitadas" : "gratis este mes"}
            </span>
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${constOpen ? "rotate-180" : ""}`} />
        </button>
        {constOpen && (
          <div className="mt-3 rounded-xl border border-border bg-background/60 p-3 text-[13px] leading-relaxed text-muted-foreground">
            {pro.active ? (
              <p>
                Tienes Cumbre30 Pro: constancias PDF <b className="text-foreground">ilimitadas</b> y cada
                viaje con GPS se exporta en GPX para Strava o Garmin.
              </p>
            ) : (
              <p>
                Este mes llevas <b className="text-foreground">{constCount}/{FREE_CONSTANCIA_LIMIT} constancias gratis</b>.
                Con Cumbre30 Pro son ilimitadas y cada viaje con GPS se exporta en GPX para Strava o Garmin.
              </p>
            )}
            <p className="mt-2">
              La bitácora (velocidad máxima dentro del parque y tiempo sobre el límite) sirve como respaldo
              de tu comportamiento real: cada viaje con GPS descarga una constancia con redacción formal y
              código de verificación. Los viajes de demostración no emiten constancia.
            </p>
            {!pro.active && onGoPro && (
              <Button
                onClick={onGoPro}
                className="mt-3 h-9 bg-amber-500 font-bold text-zinc-950 hover:bg-amber-400"
              >
                <Crown className="mr-2 h-4 w-4" /> Ver Cumbre30 Pro
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* ---- Resumen semanal + compartir ---- */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-medium text-foreground">Tu semana</p>
          <span className="ml-auto text-[11px] text-muted-foreground">{wk.label}</span>
        </div>
        {weekStats.count === 0 ? (
          <p className="mt-2 text-[13px] text-muted-foreground">
            Sin viajes esta semana todavía. Pedalea y aparecerán aquí.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Viajes</div>
              <div className="font-mono text-sm text-foreground">{weekStats.count}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Km</div>
              <div className="font-mono text-sm text-foreground">{weekStats.km.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Tiempo</div>
              <div className="font-mono text-sm text-foreground">{formatClock(weekStats.sec)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Desnivel</div>
              <div className="font-mono text-sm text-foreground">+{Math.round(weekStats.gain)}</div>
            </div>
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <Button
            onClick={() => void shareWeek()}
            disabled={shareBusy || weekStats.count === 0}
            className="h-9 flex-1 bg-pink-600 font-semibold text-white hover:bg-pink-500 disabled:opacity-40"
          >
            <Share2 className="mr-2 h-4 w-4" />
            {shareBusy ? "Generando…" : "Compartir resumen (Instagram)"}
          </Button>
        </div>
        {shareMsg && <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300" role="status">{shareMsg}</p>}
      </Card>

      {/* ---- Filtros: modo (demo/GPS) + rango de fecha ---- */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Select value={mode} onValueChange={(v) => setMode(v as ModeKey)}>
            <SelectTrigger className="h-9 w-[190px] shrink-0 border-border bg-card" aria-label="Filtrar por modo del viaje">
              <SelectValue placeholder="Todos los viajes" />
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              <SelectItem value="all">Todos los viajes</SelectItem>
              <SelectItem value="sim">Viajes en modo demo</SelectItem>
              <SelectItem value="gps">Viajes en modo GPS</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex flex-1 gap-1.5 overflow-x-auto">
            {rangeChips.map((c) => (
              <button
                key={c.key}
                onClick={() => setRange(c.key)}
                aria-pressed={range === c.key}
                className={`h-9 flex-1 whitespace-nowrap rounded-lg border px-3 text-[12px] font-semibold transition-colors ${
                  range === c.key
                    ? "border-emerald-700 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        {range === "day" && (
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <CalendarClock className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            Elegir día
            <input
              type="date"
              value={dayISO}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDayISO(e.target.value || new Date().toISOString().slice(0, 10))}
              className="h-9 flex-1 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
              aria-label="Fecha de los viajes"
            />
          </label>
        )}
      </div>

      {/* ---- Lista de viajes ---- */}
      {rides.length === 0 ? (
        <Card className="bg-card/60 border-border p-8 text-center text-muted-foreground text-sm">
          Aún no hay viajes guardados. Inicia un ride y al detenerlo quedará registrado aquí.
        </Card>
      ) : shownRides.length === 0 ? (
        <Card className="bg-card/60 border-border p-6 text-center text-muted-foreground text-sm">
          No hay viajes con estos filtros. Prueba otro rango de fecha o el modo.
        </Card>
      ) : (
        <>
          <ul className="flex flex-col gap-2" aria-label="Viajes guardados">
            {shownRides.map((r) => (
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
                      {r.motorized && (
                        <Badge variant="outline" className="border-amber-600/70 bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[10px] uppercase" title="Viaje en vehículo motorizado: no cuenta para desafíos ni estadísticas">
                          <Car className="h-3 w-3" /> vehículo
                        </Badge>
                      )}
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
                    {r.motorized && " · Viaje en vehículo: no cuenta para desafíos ni estadísticas"}
                  </div>
                  {(perRideEfforts.get(r.id)?.length ?? 0) > 0 && (
                    <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                      <Trophy className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>
                        {perRideEfforts
                          .get(r.id)!
                          .map((e) => {
                            const def = SEGMENTS.find((d) => d.id === e.segmentId);
                            return `${def?.name ?? e.segmentId}: ${fmtEffort(e.timeSec)}`;
                          })
                          .join(" · ")}
                      </span>
                    </div>
                  )}
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

      {/* Enlace cuenta: sin sesión los viajes nuevos son locales */}
      {!accountEmail && rides.length > 0 && (
        <p className="text-[11px] leading-relaxed text-muted-foreground/80">
          Estos viajes son locales del dispositivo. Inicia sesión en Perfil y quedarán enlazados a tu
          correo automáticamente.
        </p>
      )}
      </>
      )}

      {sub === "pro" && (
        <>
          {/* ---- Segmentos del cerro (función Cumbre30 Pro, solo GPS) ---- */}
          <Card className="bg-card/80 border-border p-4">
            <div className="flex items-center gap-2">
              <Mountain className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-medium text-foreground">Segmentos del cerro</p>
              {pro.active && (
                <Badge className="bg-amber-500 font-bold text-zinc-950 text-[10px]">PRO</Badge>
              )}
              <Badge variant="outline" className="ml-auto border-border text-[10px] uppercase text-muted-foreground">
                solo viajes GPS
              </Badge>
            </div>
            {pro.active ? (
              <>
                <ul className="mt-2 flex flex-col gap-2">
                  {segStats.map((s) => (
                    <li key={s.def.id} className="rounded-lg border border-border bg-background/60 p-3">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{s.def.name}</span>
                        {s.pb ? (
                          <span className="flex items-center gap-1 font-mono text-base font-semibold text-amber-600 dark:text-amber-300">
                            <Trophy className="h-4 w-4" /> {fmtEffort(s.pb.timeSec)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">aún sin intentos</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{s.def.detail}</p>
                      {s.pb && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Récord: {fmtDate(s.pb.dateISO)} · prom {s.pb.avgKmh.toFixed(1)} km/h · +{Math.round(s.pb.gainM)} m
                        </p>
                      )}
                      {s.count > 0 && s.last && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {s.count} {s.count === 1 ? "intento" : "intentos"} · último: {fmtEffort(s.last.timeSec)} — {fmtDate(s.last.dateISO)}
                        </p>
                      )}
                      {s.top.length > 1 && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Top: {s.top.map((e, i) => `${i + 1}) ${fmtEffort(e.timeSec)}`).join("  ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Se detectan solos: graba tu viaje con GPS y si pasas por el acceso del segmento
                  hasta la meta, queda cronometrado con récord personal e historial.
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  Cronometraje oficial de tus subidas — Pío Nono → Cumbre, Pedro de Valdivia Norte
                  → Cumbre y el tramo final Antilén → Cumbre — con récord personal, contador de
                  intentos e historial de tiempos. Aplican solo a viajes grabados con GPS.
                </p>
                <Button
                  onClick={onGoPro}
                  className="mt-3 h-9 bg-amber-500 font-bold text-zinc-950 hover:bg-amber-400"
                >
                  <Crown className="mr-2 h-4 w-4" /> Es parte de Cumbre30 Pro
                </Button>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
