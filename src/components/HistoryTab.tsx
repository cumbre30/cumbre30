"use client";

// ============================================================
// Mis viajes (antes "Historial de viajes") - con subsecciones:
//   · "Viajes": contador de constancias, resumen semanal con
//     compartir (Instagram), filtros de fecha y modo (demo/GPS)
//     y la lista de viajes enlazada al correo de la cuenta.
//   · "Pro": segmentos del cerro - cronometraje de subidas,
//     solo aplican a viajes GPS (función Cumbre30 Pro).
// ============================================================

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Archive,
  CalendarClock,
  CalendarDays,
  Car,
  ChevronDown,
  Crown,
  Download,
  FileDown,
  Gauge,
  Infinity as InfinityIcon,
  Lock,
  Mountain,
  Route,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Timer,
  Trash2,
  Trophy,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatClock } from "@/lib/geo";
import { clearHistory, FREE_RIDE_LIMIT, historyStore, readRideTrack, ridesForAccount, type RideSummary } from "@/lib/history";
import { buildRidePdf, type RideIdentity } from "@/lib/ridePdf";
import { buildConstanciaPayload, constanciaHash, registerConstancia } from "@/lib/constancia";
import { apiUrl } from "@/lib/backend";
import { serverToken } from "@/lib/cloudSync";
import { shareOrDownloadFile } from "@/lib/shareFile";
import { buildRideGpxBlob } from "@/lib/gpx";
import { buildWeekImage, sharePngBlob } from "@/lib/shareAdn";
import { computeSegmentStats, effortsByRide, SEGMENTS, fmtEffort } from "@/lib/segments";
import { userSegmentDefs, useTrazas } from "@/lib/trazasUsuario";
import {
  constanciaCount,
  FREE_CONSTANCIA_LIMIT,
  incrConstancia,
  useProLicense,
} from "@/lib/proLicense";
import { SubTabs } from "@/components/SubTabs";
import { t, useLang } from "@/lib/i18n";

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
  return { start, end, label: `${fmt(start)} - ${fmt(new Date(end.getTime() - 1))}` };
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
  useLang();
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);
  const [gpxBusyId, setGpxBusyId] = useState<string | null>(null);
  const [gpxMsg, setGpxMsg] = useState<string | null>(null);
  const [constCount, setConstCount] = useState(0);
  const [constOpen, setConstOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  // Enlace público del ride (Ola 3): crea /compártelo por Historial.
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

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
  // v1.13.15: segmentos del usuario (creador de trazados) corren en
  // las estadísticas SIN gate Pro; userDefs se re-lee cuando cambia
  // la lista de trazados (alta/baja en el mapa).
  const trazas = useTrazas();
  const userDefs = useMemo(() => userSegmentDefs(), [trazas]);
  const userSegStats = useMemo(() => computeSegmentStats(bikeRides, userDefs), [bikeRides, userDefs]);
  const perRideEfforts = useMemo(
    () => effortsByRide(bikeRides, pro.active ? [...SEGMENTS, ...userDefs] : userDefs),
    [pro.active, bikeRides, userDefs],
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
      const blob = await buildWeekImage({
        rides: weekRides.map((r) => ({
          dateISO: r.dateISO,
          distanceKm: r.distanceKm,
          elapsedSec: r.elapsedSec,
          gainM: r.gainM,
        })),
        start: wk.start,
        end: wk.end,
      });
      const res = await sharePngBlob(blob, "cumbre30-semana.png", t("his.shareSemana"));
      setShareMsg(
        res === "shared"
          ? t("his.shareOk")
          : t("his.shareDescargada")
      );
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setShareMsg(t("his.errImagen"));
    } finally {
      setShareBusy(false);
      setTimeout(() => setShareMsg(null), 8000);
    }
  };

  // Enlace público compartible (Ola 3): POST con la cuenta → código
  // corto → se comparte o copia. Solo rides GPS sincronizados.
  const compartirLink = async (r: RideSummary) => {
    if (r.source === "sim") return;
    const url = apiUrl("/api/rides/share");
    setLinkBusyId(r.id);
    setLinkMsg(null);
    try {
      if (!url) {
        setLinkMsg(t("his.linkNecesitaServer"));
        return;
      }
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const tok = serverToken(); // APK: token Bearer; web: cookie de sesión
      if (tok) headers.Authorization = `Bearer ${tok}`;
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ clientId: r.id }),
        signal: AbortSignal.timeout(12000),
      });
      if (res.status === 401) {
        setLinkMsg(t("his.linkPideSesion"));
        return;
      }
      if (!res.ok) {
        setLinkMsg(t("his.errEnlace"));
        return;
      }
      const d = (await res.json()) as { url?: string };
      const enlace = d.url;
      if (!enlace) throw new Error();
      const texto = t("his.shareTexto", enlace);
      if (navigator.share) {
        await navigator.share({ title: "Ride Cumbre30", text: texto, url: enlace });
        setLinkMsg(t("his.enlaceCompartido"));
      } else {
        await navigator.clipboard.writeText(texto);
        setLinkMsg(t("his.enlaceCopiado", enlace));
      }
    } catch {
      setLinkMsg(t("his.errEnlace"));
    } finally {
      setLinkBusyId(null);
      setTimeout(() => setLinkMsg(null), 12000);
    }
  };

  const exportPdf = async (r: RideSummary) => {
    // Los viajes demo (simulación) no emiten constancia: el registro
    // debe corresponder a un trayecto real hecho con GPS.
    if (r.source === "sim") return;
    // Nivel gratis: cuota mensual de constancias. Pro: ilimitadas.
    if (!pro.active && constanciaCount() >= FREE_CONSTANCIA_LIMIT) {
      setPdfMsg(t("his.cuotaConstancias", FREE_CONSTANCIA_LIMIT));
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
        title: t("his.constanciaTituloShare"),
        text: t("his.constanciaTextoShare"),
      });
      incrConstancia();
      setConstCount(constanciaCount());
      // Registro en línea (best-effort): la verificación pública
      // cumbregeo.cl/verificar consulta este registro para confirmar
      // que la constancia fue emitida por la app. Si no hay conexión,
      // el QR del PDF sigue siendo válido por integridad.
      try {
        const payload = buildConstanciaPayload(r, identity);
        const hash = await constanciaHash(payload);
        void registerConstancia(payload, hash);
      } catch {
        // sin registro en línea: el QR sigue válido por integridad
      }
      setPdfMsg(
        res === "shared"
          ? t("his.constanciaLista")
          : t("his.constanciaDescargada")
      );
    } catch {
      setPdfMsg(t("his.errConstancia"));
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
        setGpxMsg(t("his.gpxPro"));
        return;
      }
      // La pista puede vivir en IndexedDB (rides antiguos podados del
      // almacenamiento local) o embebida en el resumen (rides recientes).
      const track = (await readRideTrack(r.id)) ?? r.track;
      if (!track || track.length < 2) {
        setGpxMsg(t("his.sinPistaGps"));
        return;
      }
      const blob = buildRideGpxBlob({ ...r, track });
      if (!blob) return;
      const day = r.dateISO.slice(0, 10);
      await shareOrDownloadFile({
        blob,
        fileName: `cumbre30-${day}-${r.id.slice(0, 8)}.gpx`,
        title: t("his.gpxTituloShare"),
        text: t("his.gpxTextoShare"),
      });
      setGpxMsg(t("his.gpxListo"));
    } catch {
      setGpxMsg(t("his.errGpx"));
    } finally {
      setGpxBusyId(null);
      setTimeout(() => setGpxMsg(null), 9000);
    }
  };

  const rangeChips: { key: RangeKey; label: string }[] = [
    { key: "week", label: t("his.rangoSemana") },
    { key: "month", label: t("his.rangoMes") },
    { key: "day", label: t("his.rangoDia") },
    { key: "all", label: t("his.rangoTodos") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SubTabs
        ariaLabel={t("his.subAria")}
        value={sub}
        onChange={(k) => setSub(k as "viajes" | "pro")}
        tabs={[
          { key: "viajes", label: t("his.tabViajes") },
          { key: "pro", label: "Pro", crown: true },
        ]}
      />

      {sub === "viajes" && (
      <>
      {/* ---- Contador de historial: palanca freemium 20 / ilimitado ---- */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15">
            <Archive className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-mono text-xl font-bold leading-none tabular-nums text-foreground">
              {linkedRides.length}
              {pro.active ? (
                <InfinityIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <span className="text-sm text-muted-foreground">{t("his.gratis", FREE_RIDE_LIMIT)}</span>
              )}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {pro.active ? (
                t("his.histIlimitado")
              ) : (
                <>{t("his.histFree1", FREE_RIDE_LIMIT)}<b className="text-foreground">Pro</b>{t("his.histFree2")}</>
              )}
            </p>
          </div>
          {!pro.active && <Lock className="h-4 w-4 shrink-0 text-muted-foreground/70" />}
        </div>
      </Card>

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
              {pro.active ? t("his.constPdfIlimitadas") : t("his.constPdfGratisMes")}
            </span>
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${constOpen ? "rotate-180" : ""}`} />
        </button>
        {constOpen && (
          <div className="mt-3 rounded-xl border border-border bg-background/60 p-3 text-[13px] leading-relaxed text-muted-foreground">
            {pro.active ? (
              <p>
                {t("his.constPro1")}<b className="text-foreground">{t("his.ilimitadas")}</b>{t("his.constPro2")}
              </p>
            ) : (
              <p>
                {t("his.constFree1")}<b className="text-foreground">{t("his.constFreeBold", constCount, FREE_CONSTANCIA_LIMIT)}</b>{t("his.constFree2")}
              </p>
            )}
            <p className="mt-2">
              {t("his.constBitacora")}
            </p>
            {!pro.active && onGoPro && (
              <Button
                onClick={onGoPro}
                className="mt-3 h-9 bg-amber-500 font-bold text-zinc-950 hover:bg-amber-400"
              >
                <Crown className="mr-2 h-4 w-4" /> {t("his.verPro")}
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* ---- Resumen semanal + compartir ---- */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-medium text-foreground">{t("his.tuSemana")}</p>
          <span className="ml-auto text-[11px] text-muted-foreground">{wk.label}</span>
        </div>
        {weekStats.count === 0 ? (
          <p className="mt-2 text-[13px] text-muted-foreground">
            {t("his.sinViajesSemana")}
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">{t("his.kViajes")}</div>
              <div className="font-mono text-sm text-foreground">{weekStats.count}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">{t("his.kKm")}</div>
              <div className="font-mono text-sm text-foreground">{weekStats.km.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">{t("his.kTiempo")}</div>
              <div className="font-mono text-sm text-foreground">{formatClock(weekStats.sec)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">{t("his.kDesnivel")}</div>
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
            {shareBusy ? t("his.generando") : t("his.compartirResumen")}
          </Button>
        </div>
        {shareMsg && <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300" role="status">{shareMsg}</p>}
      </Card>

      {/* ---- Filtros: modo (demo/GPS) + rango de fecha ---- */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Select value={mode} onValueChange={(v) => setMode(v as ModeKey)}>
            <SelectTrigger className="h-9 w-[190px] shrink-0 border-border bg-card" aria-label={t("his.filtroAria")}>
              <SelectValue placeholder={t("his.filtroTodos")} />
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              <SelectItem value="all">{t("his.filtroTodos")}</SelectItem>
              <SelectItem value="sim">{t("his.filtroDemo")}</SelectItem>
              <SelectItem value="gps">{t("his.filtroGps")}</SelectItem>
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
            {t("his.elegirDia")}
            <input
              type="date"
              value={dayISO}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDayISO(e.target.value || new Date().toISOString().slice(0, 10))}
              className="h-9 flex-1 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
              aria-label={t("his.fechaAria")}
            />
          </label>
        )}
      </div>

      {/* ---- Lista de viajes ---- */}
      {rides.length === 0 ? (
        <Card className="bg-card/60 border-border p-8 text-center text-muted-foreground text-sm">
          {t("his.vacioTotal")}
        </Card>
      ) : shownRides.length === 0 ? (
        <Card className="bg-card/60 border-border p-6 text-center text-muted-foreground text-sm">
          {t("his.vacioFiltros")}
        </Card>
      ) : (
        <>
          <ul className="flex flex-col gap-2" aria-label={t("his.listaAria")}>
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
                        <Badge variant="outline" className="border-amber-600/70 bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[10px] uppercase" title={t("his.vehiculoTitle")}>
                          <Car className="h-3 w-3" /> {t("his.vehiculoBadge")}
                        </Badge>
                      )}
                      {r.source !== "sim" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={linkBusyId === r.id}
                          onClick={() => void compartirLink(r)}
                          title={t("his.linkTitle")}
                          className="h-7 border-border px-2 text-xs text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-40"
                          aria-label={t("his.linkAria", fmtDate(r.dateISO))}
                        >
                          <Share2 className="h-3.5 w-3.5 mr-1" />
                          {linkBusyId === r.id ? "…" : "Link"}
                        </Button>
                      )}
                      {r.source !== "sim" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={gpxBusyId === r.id}
                          onClick={() => void exportGpx(r)}
                          title={
                            pro.active
                              ? t("his.gpxTitle")
                              : t("his.gpxProShort")
                          }
                          className="h-7 border-border px-2 text-xs text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-40"
                          aria-label={t("his.gpxAria", fmtDate(r.dateISO))}
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
                        title={r.source === "sim" ? t("his.simTitle") : t("his.descargarConstancia")}
                        className="h-7 border-emerald-800/60 px-2 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-950 hover:text-emerald-300 disabled:opacity-40"
                        aria-label={
                          r.source === "sim"
                            ? t("his.demoSinConstancia")
                            : t("his.descargarConstanciaAria", fmtDate(r.dateISO))
                        }
                      >
                        <FileDown className="h-3.5 w-3.5 mr-1" />
                        {r.source === "sim" ? t("his.sinConstancia") : pdfBusyId === r.id ? t("his.generando") : t("his.constanciaPdf")}
                      </Button>
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <div className="flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground"><Route className="h-3 w-3" /> {t("his.kDist")}</div>
                      <div className="font-mono text-sm text-foreground">{r.distanceKm.toFixed(2)} km</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground"><Gauge className="h-3 w-3" /> {t("his.kMax")}</div>
                      <div className={`font-mono text-sm ${(r.maxInParkKmh ?? 0) > 30 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{r.maxKmh.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground"><Timer className="h-3 w-3" /> {t("his.kTiempo")}</div>
                      <div className="font-mono text-sm text-foreground">{formatClock(r.elapsedSec)}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground"><ShieldAlert className="h-3 w-3" /> {t("his.kSobreLimite")}</div>
                      <div className={`font-mono text-sm ${r.overLimitSec > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {r.overLimitSec > 0 ? formatClock(r.overLimitSec) : "0s"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {t("his.detalleLinea", r.maxInParkKmh !== null ? `${r.maxInParkKmh.toFixed(1)} km/h` : t("his.noIngreso"), r.avgKmh.toFixed(1), Math.round(r.gainM))}
                    {r.source === "sim" && ` · ${t("his.demoSinConstancia")}`}
                    {r.motorized && t("his.vehiculoNota")}
                  </div>
                  {r.overLimitSec === 0 && r.maxInParkKmh !== null && r.maxInParkKmh <= 30 && (r.motorized !== true) && (
                    <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-emerald-700/60 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-3 w-3" /> {t("his.descensoLimpioChip")}
                    </div>
                  )}
                  {(perRideEfforts.get(r.id)?.length ?? 0) > 0 && (
                    <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                      <Trophy className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>
                        {perRideEfforts
                          .get(r.id)!
                          .map((e) => {
                            const def = SEGMENTS.find((d) => d.id === e.segmentId) ?? userDefs.find((d) => d.id === e.segmentId);
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
          {linkMsg && (
            <p className="break-all text-sm text-emerald-600 dark:text-emerald-400" role="status">{linkMsg}</p>
          )}
          <Button
            variant="outline"
            className="border-border text-muted-foreground hover:bg-card hover:text-red-600 dark:hover:text-red-400"
            onClick={() => clearHistory()}
          >
            <Trash2 className="h-4 w-4 mr-2" /> {t("his.borrarHistorial")}
          </Button>
        </>
      )}

      {/* Enlace cuenta: sin sesión los viajes nuevos son locales */}
      {!accountEmail && rides.length > 0 && (
        <p className="text-[11px] leading-relaxed text-muted-foreground/80">
          {t("his.localesNota")}
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
              <p className="text-sm font-medium text-foreground">{t("his.segmentosCerro")}</p>
              {pro.active && (
                <Badge className="bg-amber-500 font-bold text-zinc-950 text-[10px]">PRO</Badge>
              )}
              <Badge variant="outline" className="ml-auto border-border text-[10px] uppercase text-muted-foreground">
                {t("his.soloGps")}
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
                          <span className="text-[11px] text-muted-foreground">{t("his.aunSinIntentos")}</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{s.def.detail}</p>
                      {s.pb && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {t("his.record", fmtDate(s.pb.dateISO), s.pb.avgKmh.toFixed(1), Math.round(s.pb.gainM))}
                        </p>
                      )}
                      {s.count > 0 && s.last && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {s.count === 1 ? t("his.intento", s.count) : t("his.intentos", s.count)} · {t("his.ultimo", fmtEffort(s.last.timeSec), fmtDate(s.last.dateISO))}
                        </p>
                      )}
                      {s.top.length > 1 && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {t("his.top", s.top.map((e, i) => `${i + 1}) ${fmtEffort(e.timeSec)}`).join("  "))}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {t("his.segExplicacion")}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  {t("his.proTeaser")}
                </p>
                <Button
                  onClick={onGoPro}
                  className="mt-3 h-9 bg-amber-500 font-bold text-zinc-950 hover:bg-amber-400"
                >
                  <Crown className="mr-2 h-4 w-4" /> {t("his.esPro")}
                </Button>
              </>
            )}

            {/* v1.13.15 - Tus segmentos (creador de trazados): visible en
                ambos niveles, corren como intentos sobre tus viajes GPS. */}
            <div className="mt-3 border-t border-border/60 pt-3">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("st.tusSegmentos")}</p>
              {userSegStats.length ? (
                <ul className="mt-2 flex flex-col gap-2">
                  {userSegStats.map((s) => (
                    <li key={s.def.id} className="rounded-lg border border-border bg-background/60 p-3">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">📏 {s.def.name}</span>
                        {s.pb ? (
                          <span className="flex items-center gap-1 font-mono text-base font-semibold text-amber-600 dark:text-amber-300">
                            <Trophy className="h-4 w-4" /> {fmtEffort(s.pb.timeSec)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">{t("his.aunSinIntentos")}</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{s.def.detail}</p>
                      {s.count > 0 && s.last && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {s.count === 1 ? t("his.intento", s.count) : t("his.intentos", s.count)} · {t("his.ultimo", fmtEffort(s.last.timeSec), fmtDate(s.last.dateISO))}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  {t("st.tusSegmentosVacio")}
                </p>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
