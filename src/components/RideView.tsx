"use client";

// ============================================================
// Vista de ride - rediseño de jerarquía (brief §2):
//   minimapa → fila estado/avisos/SOS → VELOCIDAD protagonista →
//   distancia/tiempo → caja-filtro (stats + bitácora, pegada justo
//   debajo de las tarjetas) → indicaciones. El botón principal flota
//   fijo abajo y la holgura de scroll va al FINAL del contenido.
// Punto 4 del brief: banner de avisos/advertencias/restricciones
//   colapsable a un icono junto a la píldora de estado GPS y al
//   botón SOS (horario/luz/Tupahue + advertencias vivas).
// Punto 8 del brief: estadísticas y bitácora agrupadas en UNA
//   caja con filtro por pestañas.
// Dos estados: DETENIDO (caja abierta, Iniciar evidente) y
// EN MARCHA/PAUSA (velocidad+mapa+nav primero, botones grandes).
// La fuente Demo/GPS vive ahora en Configuración (no compite con
// el botón Iniciar).
// ============================================================

import dynamic from "next/dynamic";
import {
  AlertTriangle,
  BadgeCheck,
  Bike,
  ChevronDown,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Copy,
  Gauge,
  ListTree,
  Mountain,
  Navigation,
  Pause,
  Phone,
  Play,
  Route,
  ScrollText,
  Share2,
  ShieldAlert,
  Siren,
  Square,
  Sun,
  Timer,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Speedometer } from "@/components/Speedometer";
import { ACCESOS_CICLISTAS, LIMIT_KMH, PEDALEA_SEGURO } from "@/lib/park";
import { formatClock } from "@/lib/geo";
import { formatStepRemaining, routeProgress, stepGlyph } from "@/lib/routing";
import { estadoParque, horaSantiago } from "@/lib/horario";
import { etiquetaClima, useClima } from "@/hooks/useClima";
import { minimapHeight, useRideTheme } from "@/lib/rideTheme";
import { alerts } from "@/lib/alertEngine";
import { fetchAvisosOperativos, textoAviso, type AvisoOperativo } from "@/lib/avisos";
import { t, useLang } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLng } from "@/lib/park";
import type { RideEvent, RideStatus, Source, SpeedState } from "@/hooks/useRideEngine";
import type { NavEngine } from "@/hooks/useNavEngine";

const MiniMap = dynamic(() => import("@/components/MiniMap"), {
  ssr: false,
  loading: () => <div className="h-52 sm:h-56 rounded-xl border border-border bg-card flex items-center justify-center text-sm text-muted-foreground">Cargando minimapa…</div>,
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
  status: RideStatus;
  source: Source;
  position: LatLng | null;
  track: LatLng[];
  heading: number | null;
  userPin?: string;
  nav: NavEngine;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  /** Abrir el mapa general (pestaña Explorar) desde el minimapa. */
  onOpenMap?: () => void;
};

export { stepGlyph };

// Punto 6: icono del banner de clima según el código WMO de Open-Meteo.
function climaIcono(code: number) {
  const cls = "h-4 w-4 shrink-0 text-amber-400";
  if (code === 0) return <Sun className={cls} />;
  if (code === 1 || code === 2) return <CloudSun className={cls} />;
  if (code === 3 || code === 45 || code === 48) return <CloudFog className={cls} />;
  if ((code >= 51 && code <= 57) || (code >= 80 && code <= 82)) return <CloudDrizzle className={cls} />;
  if (code === 85 || code === 86 || (code >= 71 && code <= 77)) return <CloudSnow className={cls} />;
  if (code >= 61 && code <= 67) return <CloudRain className={cls} />;
  if (code >= 95) return <CloudLightning className={cls} />;
  return <Cloud className={cls} />;
}

export function RideView(p: Props) {
  const running = p.status === "running";
  const paused = p.status === "paused";
  const idle = p.status === "idle";
  const over = p.speedState === "over";
  const caution = p.speedState === "caution";
  const lang = useLang(); // re-render al cambiar el idioma (selector)
  const [sosOpen, setSosOpen] = useState(false);
  const [sosMsg, setSosMsg] = useState<string | null>(null);
  // Punto 4: banner de avisos colapsado a icono por defecto.
  const [avisosOpen, setAvisosOpen] = useState(false);
  // Punto 8: pestaña activa de la caja-filtro (stats o bitácora) y
  // apertura controlada: React 19 trata open de <details> como atributo
  // controlado, así que el toque del usuario se sincroniza con onToggle.
  // Sin estado propio, cada re-render (ticks de velocidad en marcha)
  // revertía la apertura/cierre y la caja parecía no funcionar.
  const [cajaTab, setCajaTab] = useState<"stats" | "bitacora">("stats");
  const [cajaManual, setCajaManual] = useState<boolean | null>(null);
  const cajaAbierta = cajaManual ?? idle;
  // Personalización Pro: estilo/tamaño del velocímetro y altura del minimapa.
  const theme = useRideTheme();
  const mm = minimapHeight(theme.minimapSize);
  // Punto 6: clima del parque para el banner (icono + °C). En el APK
  // funciona offline: muestra el último dato guardado con su hora.
  const { clima } = useClima();

  // ---- Avisos operativos en tiempo real (2026-11-14) ----
  // Fuente remota public/avisos.json en cumbregeo.cl; poll cada 5 min
  // mientras la vista está montada + al volver la conexión. Los avisos
  // de nivel danger se anuncian por voz una única vez por aviso.
  const [ops, setOps] = useState<{ list: AvisoOperativo[]; actualizado: Date | null }>({
    list: [],
    actualizado: null,
  });
  const opsAnunciados = useRef<Set<string>>(new Set());
  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      const r = await fetchAvisosOperativos(true);
      if (!vivo) return;
      setOps({ list: r.list, actualizado: r.actualizado });
      for (const a of r.list) {
        if (a.nivel === "danger" && !opsAnunciados.current.has(a.id)) {
          opsAnunciados.current.add(a.id);
          alerts.speak(`op-${a.id}`, t("voz.avisoOp", textoAviso(a)), 30);
        }
      }
    };
    void cargar();
    const iv = setInterval(() => void cargar(), 5 * 60 * 1000);
    const alConectar = () => void cargar();
    window.addEventListener("online", alConectar);
    return () => {
      vivo = false;
      clearInterval(iv);
      window.removeEventListener("online", alConectar);
    };
  }, []);

  // Horario del parque + aviso de luces (cálculo offline, se
  // evalúa al montar la vista; el banner no necesita reloj vivo).
  const estado = useMemo(() => estadoParque(), []);
  // Descenso limpio: entró al parque y nunca pasó de 30 km/h.
  const descensoLimpio =
    !idle && p.overLimitSec === 0 && p.maxInParkKmh !== null && p.maxInParkKmh <= LIMIT_KMH;

  // Punto 4: avisos activos para el banner colapsable. Combina el
  // estado del parque (horario/luz/restricción Tupahue, ahora i18n),
  // los AVISOS OPERATIVOS en tiempo real (fuente remota) y las
  // advertencias vivas de la bitácora (warn/danger de los últimos
  // 30 minutos, sin repetir texto).
  const avisos = useMemo(() => {
    type Aviso = { nivel: "info" | "warn" | "danger"; text: string; op?: boolean };
    const list: Aviso[] = [];
    if (estado.key === "cerrado") {
      list.push({ nivel: "danger", text: `${t("aviso.msgCierre")} ${t("aviso.fiscalizacion")}` });
    } else if (estado.key === "anochece") {
      list.push({ nivel: "warn", text: t("horario.anochece") });
    } else if (estado.key === "luces") {
      list.push({ nivel: "warn", text: t("horario.llevaLuces", estado.params.sunset ?? "") });
    } else if (estado.key === "tupahue") {
      list.push({ nivel: "warn", text: t("aviso.msgTupahue") });
    } else {
      // Parque abierto sin advertencia activa: el horario de ingreso y
      // la restricción Tupahue se muestran igual. Así el icono de avisos
      // nunca desaparece de la fila superior y el horario siempre está
      // a un toque (punto 4 del brief).
      list.push({ nivel: "info", text: t("aviso.msgCierre") });
      list.push({ nivel: "info", text: t("aviso.msgTupahue") });
    }
    // Avisos operativos remotos (ordenados por severidad desde avisos.ts)
    for (const a of ops.list) list.push({ nivel: a.nivel, text: textoAviso(a), op: true });
    const limite = Date.now() - 30 * 60 * 1000;
    const vistos = new Set<string>();
    for (const ev of [...p.events].reverse()) {
      if (ev.t < limite) break;
      if ((ev.kind === "warn" || ev.kind === "danger") && !vistos.has(ev.text)) {
        vistos.add(ev.text);
        list.push({ nivel: ev.kind === "danger" ? "danger" : "warn", text: ev.text });
      }
      if (list.length >= 4) break;
    }
    return list;
  }, [estado, p.events, ops, lang]);
  const avisoPeor = avisos.some((a) => a.nivel === "danger") ? "danger" : avisos.some((a) => a.nivel === "warn") ? "warn" : "info";
  const avisoIconoCls =
    avisoPeor === "danger"
      ? "border-red-600/80 bg-red-950/60 text-red-300"
      : avisoPeor === "warn"
        ? "border-amber-600/80 bg-amber-950/60 text-amber-300"
        : "border-border bg-card/90 text-muted-foreground";
  const avisoBadgeCls =
    avisoPeor === "danger"
      ? "bg-red-600 text-white"
      : avisoPeor === "warn"
        ? "bg-amber-500 text-amber-950"
        : "bg-emerald-600 text-white";
  const avisoPanelCls =
    avisoPeor === "danger"
      ? "border-red-700/60 bg-red-950/40 text-red-300"
      : avisoPeor === "warn"
        ? "border-amber-600/60 bg-amber-950/40 text-amber-300"
        : "border-border bg-card/90";
  // "Zapadores, Pedro de Valdivia Norte, Pío Nono y La Pirámide" (los
  // 4 accesos exclusivos con ingreso en bici, normativa Parquemet).
  const listaAccesosCiclistas = useMemo(() => {
    const nombres = ACCESOS_CICLISTAS.map((a) => a.nombre.replace("Acceso ", ""));
    return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
  }, []);

  const compartirUbicacion = async () => {
    if (!p.position) return;
    const txt = t("sos.compartirMsg", `https://maps.google.com/?q=${p.position.lat.toFixed(5)},${p.position.lon.toFixed(5)}`);
    try {
      if (navigator.share) {
        await navigator.share({ title: t("sos.compartirTitulo"), text: txt });
        setSosMsg(t("sos.okCompartida"));
      } else {
        await navigator.clipboard.writeText(txt);
        setSosMsg(t("sos.okCopiada"));
      }
    } catch {
      setSosMsg(t("sos.errorCompartir"));
    }
    setTimeout(() => setSosMsg(null), 5000);
  };

  // Modo y estado en UNA píldora compacta (punto 3: sin banner
  // grande que sature la pantalla ride). El modo es automático:
  // geocerca del parque; lo demás son estados de velocidad y pausa.
  const chip = paused
    ? { cls: "border-sky-600/70 bg-sky-950/50 text-sky-300", icon: <Pause className="h-3.5 w-3.5" />, text: t("chip.pausa") }
    : over
      ? { cls: "border-red-600 bg-red-950/80 text-red-300 animate-pulse", icon: <ShieldAlert className="h-3.5 w-3.5" />, text: t("chip.exceso", LIMIT_KMH) }
      : caution
        ? { cls: "border-amber-600/70 bg-amber-950/50 text-amber-300", icon: <ShieldAlert className="h-3.5 w-3.5" />, text: t("chip.precaucion") }
        : p.insidePark
          ? { cls: "border-emerald-600/60 bg-emerald-950/60 text-emerald-300", icon: <ShieldAlert className="h-3.5 w-3.5" />, text: t("chip.parque", LIMIT_KMH) }
          : { cls: "border-border bg-card/80 text-muted-foreground", icon: <Bike className="h-3.5 w-3.5" />, text: t("chip.libre") };

  // Navegación viva: progreso para la lista de indicaciones
  const onRoute = !!p.nav.route && p.nav.route.coords.length > 1;
  const progress = useMemo(
    () => (onRoute && p.position ? routeProgress(p.nav.route!, p.position) : null),
    [onRoute, p.position, p.nav.route]
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Punto 6: banner de clima (icono + °C). Open-Meteo sin API
          key; offline muestra el último dato con su hora. Arriba,
          agrupado con la fila de modo/avisos/SOS. */}
      {clima && (
        <div
          className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5"
          role="status"
          aria-label={t("clima.aria", etiquetaClima(clima.code), Math.round(clima.tempC))}
        >
          {climaIcono(clima.code)}
          <span className="font-mono text-sm font-bold tabular-nums text-foreground">
            {Math.round(clima.tempC)}°
          </span>
          <span className="truncate text-xs text-muted-foreground">{etiquetaClima(clima.code)}</span>
          <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/80">
            Santiago · {horaSantiago(clima.actualizado)}
          </span>
        </div>
      )}

      {/* Punto 4: fila superior = píldora de modo/estado + icono de
          avisos colapsable + botón SOS. Arriba junto al banner de
          clima; el banner completo se abre bajo la fila al tocarlo. */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-wide ${chip.cls}`}
          role="status"
          aria-live="polite"
        >
          {chip.icon}
          <span className="truncate">{chip.text}</span>
        </span>
        <button
          onClick={() => setAvisosOpen((v) => !v)}
          className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${avisoIconoCls} ${avisosOpen ? "ring-2 ring-current/40" : ""}`}
          aria-label={avisosOpen ? t("aviso.colapsarAria", avisos.length) : t("aviso.verAria", avisos.length)}
          aria-expanded={avisosOpen}
        >
          <AlertTriangle className="h-4 w-4" />
          <span className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-extrabold ${avisoBadgeCls}`}>
            {avisos.length}
          </span>
        </button>
        <button
          onClick={() => setSosOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-800/70 bg-red-950/50 px-3 py-1.5 text-[11px] font-bold tracking-wide text-red-300 hover:bg-red-900/60"
          aria-label="Abrir tarjeta de emergencia"
        >
          <Siren className="h-3.5 w-3.5" /> SOS
        </button>
      </div>

      {/* Punto 4: banner de avisos completo (colapsado por defecto) */}
      {avisosOpen && (
        <div className={`rounded-xl border p-3 ${avisoPanelCls}`} role="region" aria-label={t("aviso.panelAria")}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="flex-1 text-[10px] font-extrabold uppercase tracking-widest">{t("aviso.titulo")}</p>
            {ops.actualizado && (
              <span className="shrink-0 font-mono text-[9.5px] text-muted-foreground/80">
                {t("aviso.actualizado", horaSantiago(ops.actualizado))}
              </span>
            )}
            <button
              onClick={() => setAvisosOpen(false)}
              className="rounded-full border border-border/60 p-1 text-muted-foreground hover:text-foreground"
              aria-label={t("aviso.cerrarAria")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {avisos.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-snug text-foreground/90">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.nivel === "danger" ? "bg-red-500" : a.nivel === "warn" ? "bg-amber-400" : a.op ? "bg-violet-400" : "bg-sky-400"}`} />
                <span className="min-w-0 flex-1">{a.text}</span>
                {a.op && (
                  <span className="shrink-0 rounded bg-violet-600/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-violet-600 dark:text-violet-300">
                    {t("aviso.operativo")}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {/* Info permanente (actualización normativa Parquemet, nov 2026):
              los ÚNICOS accesos con ingreso en bici y las normas del plan
              Pedalea Seguro vigentes desde diciembre de 2026. */}
          <div className="mt-2.5 space-y-1.5 border-t border-border/50 pt-2">
            <p className="flex items-start gap-2 text-xs leading-snug text-foreground/90">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-400" />
              <span>
                <span className="font-semibold text-foreground">{t("aviso.ingresaBici")}</span>{" "}
                {listaAccesosCiclistas}. {t("aviso.noHabilitan")}
              </span>
            </p>
            <p className="flex items-start gap-2 text-xs leading-snug text-foreground/90">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
              {t("aviso.msgPedalea")}
            </p>
          </div>
        </div>
      )}

      {/* Minimapa tipo Waze (arriba del velocímetro): banner de maniobra,
          ruta ciclovía/vía compartida, ETA y reporte */}
      <MiniMap
        position={p.position}
        heading={p.heading}
        track={p.track}
        accuracyM={p.accuracyM}
        userPin={p.userPin}
        nav={p.nav}
        speedKmh={p.speedKmh}
        heightClass={mm.base}
        heightRouteClass={mm.route}
        onOpenMap={p.onOpenMap}
      />
      {p.nav.note && (
        <p className={`text-xs -mt-2 ${p.nav.provisional ? "text-sky-700/90 dark:text-sky-300/90" : "text-amber-700/90 dark:text-amber-300/90"}`}>{p.nav.note}</p>
      )}

      {/* VELOCIDAD - protagonista (elemento 2 del brief), estilo y tamaño personalizables Pro */}
      <div className="text-center pt-1">
        <Speedometer
          speedKmh={p.speedKmh}
          idle={idle}
          over={over}
          caution={caution}
          inPark={p.insidePark}
          style={theme.speedoStyle}
          size={theme.speedoSize}
        />
      </div>

      {/* Distancia y tiempo - el par secundario importante (elemento 5) */}
      <div className="grid grid-cols-2 gap-2.5">
        <Card className="p-3.5">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
            <Route className="h-3.5 w-3.5" /> {t("ride.distancia")}
          </div>
          <div className="mt-1 font-mono text-[26px] font-bold tabular-nums leading-none text-foreground">
            {p.distanceKm.toFixed(2)}
            <span className="ml-1 font-sans text-xs font-semibold text-muted-foreground">km</span>
          </div>
        </Card>
        <Card className="p-3.5">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
            <Timer className="h-3.5 w-3.5" /> {t("ride.tiempo")}
          </div>
          <div className="mt-1 font-mono text-[26px] font-bold tabular-nums leading-none text-foreground">
            {formatClock(p.elapsedSec)}
          </div>
        </Card>
      </div>

      {/* BOTÓN PRINCIPAL (punto 7 del brief): fijo abajo, flotando sobre
          el contenido. La pantalla scrollea completa y el botón siempre
          queda a la vista, sobre la barra de navegación inferior.
          bottom 80px = nav real (~69 px) + holgura (antes 58 px: el botón
          tapaba la mitad superior del nav). */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+80px)] z-[45]">
        <div className="pointer-events-auto mx-auto max-w-md px-4">
          <div className="pointer-events-none absolute inset-x-0 -top-8 bottom-0 -z-10 bg-gradient-to-t from-background via-background/85 to-transparent" />
          {idle ? (
            <div>
              <Button
                onClick={p.onStart}
                className="h-16 w-full rounded-2xl bg-emerald-600 text-lg font-extrabold text-(--c30-on-accent) shadow-xl hover:bg-emerald-500"
              >
                <Play className="h-6 w-6" /> {t("ride.iniciar")}
              </Button>
              <p className="mt-1 text-center text-[11px] text-muted-foreground">
                {t("ride.fuenteLeyenda", p.source === "sim" ? t("ride.demo") : t("ride.gpsReal"))}
              </p>
            </div>
          ) : (
            <div className="flex gap-2.5">
              {running ? (
                <Button
                  onClick={p.onPause}
                  variant="outline"
                  className="h-16 flex-1 rounded-2xl border-border bg-card text-base font-bold text-foreground shadow-xl hover:bg-accent"
                >
                  <Pause className="h-6 w-6" /> {t("ride.pausar")}
                </Button>
              ) : (
                <Button
                  onClick={p.onResume}
                  className="h-16 flex-1 rounded-2xl bg-emerald-600 text-base font-extrabold text-(--c30-on-accent) shadow-xl hover:bg-emerald-500"
                >
                  <Play className="h-6 w-6" /> {t("ride.reanudar")}
                </Button>
              )}
              <Button
                onClick={p.onFinish}
                className="h-16 w-16 shrink-0 rounded-2xl bg-red-950/60 text-red-300 shadow-xl hover:bg-red-900"
                aria-label={t("ride.finalizarAria")}
              >
                <Square className="h-6 w-6" />
              </Button>
            </div>
          )}
        </div>
      </div>
      {/* Punto 8: caja-filtro - estadísticas y bitácora en UNA caja,
          filtrables por pestañas. Queda JUSTO DEBAJO de las tarjetas
          de distancia/tiempo (solo el gap de la columna). Abierta por
          defecto cuando estás detenido; en marcha queda colapsada
          para no estorbar. */}
      <details
        className="rounded-xl border border-border bg-card/70 p-3 group"
        open={cajaAbierta}
        onToggle={(e) => setCajaManual(e.currentTarget.open)}
      >
        <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-semibold text-foreground/90 list-none [&::-webkit-details-marker]:hidden">
          <Gauge className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          {t("ride.cajaTitulo")}
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 flex rounded-lg border border-border bg-background/50 p-0.5" role="tablist" aria-label={t("ride.tabStats")}>
          <button
            role="tab"
            aria-selected={cajaTab === "stats"}
            onClick={() => setCajaTab("stats")}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${cajaTab === "stats" ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t("ride.tabStats")}
          </button>
          <button
            role="tab"
            aria-selected={cajaTab === "bitacora"}
            onClick={() => setCajaTab("bitacora")}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${cajaTab === "bitacora" ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <ScrollText className="h-3.5 w-3.5" /> {t("ride.tabBitacora")}
            {p.events.length > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-extrabold text-white">
                {p.events.length}
              </span>
            )}
          </button>
        </div>
        {cajaTab === "stats" ? (
          <div className="mt-2.5">
            <div className="grid grid-cols-3 gap-2">
              <Stat label={t("ride.statMax")} value={p.maxKmh.toFixed(1)} unit="km/h" icon={<TrendingUp className="h-3 w-3" />} />
              <Stat label={t("ride.statProm")} value={p.avgKmh.toFixed(1)} unit="km/h" icon={<Gauge className="h-3 w-3" />} />
              <Stat label={t("ride.statDesnivel")} value={`+${Math.round(p.gainM)}`} unit="m" icon={<Mountain className="h-3 w-3" />} />
              <Stat
                label={t("ride.statPendiente")}
                value={`${p.slopePct > 0 ? "+" : ""}${p.slopePct.toFixed(1)}`}
                unit="%"
                icon={p.slopePct < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              />
              <Stat label={t("ride.statPrecision")} value={p.accuracyM !== null ? `±${Math.round(p.accuracyM)}` : "-"} unit={p.accuracyM !== null ? "m" : undefined} icon={<Navigation className="h-3 w-3" />} />
              <Stat label={t("ride.statEnParque")} value={idle ? "-" : p.insidePark ? t("ride.statSi") : t("ride.statNo")} icon={<ShieldAlert className="h-3 w-3" />} />
            </div>
            {p.overLimitSec > 0 && (
              <Card className="mt-2.5 flex-row items-center justify-between border-red-900/70 bg-red-950/40 px-3 py-2.5">
                <div className="flex items-center gap-2 text-red-300 text-xs font-semibold">
                  <ShieldAlert className="h-4 w-4" />
                  {t("ride.sobreLimite")}
                </div>
                <div className="font-mono text-base font-bold tabular-nums text-red-300">{formatClock(p.overLimitSec)}</div>
              </Card>
            )}
            {descensoLimpio && (
              <Card className="mt-2.5 flex-row items-center justify-between border-emerald-800/70 bg-emerald-950/40 px-3 py-2.5">
                <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold">
                  <BadgeCheck className="h-4 w-4" />
                  {t("ride.descensoLimpio", LIMIT_KMH)}
                </div>
                <BadgeCheck className="h-4 w-4 text-emerald-400" />
              </Card>
            )}
            {p.maxInParkKmh !== null && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                {t("ride.maxParque")}{" "}
                <span className="font-mono text-foreground/90">{p.maxInParkKmh.toFixed(1)} km/h</span>
              </p>
            )}
          </div>
        ) : (
          <ul className="mt-2.5 max-h-56 overflow-y-auto rounded-lg border border-border/70 divide-y divide-border/70" aria-label="Eventos del viaje">
            {p.events.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground/80">{t("ride.sinEventos")}</li>
            )}
            {[...p.events].reverse().map((ev, i) => (
              <li key={`${ev.t}-${i}`} className="px-3.5 py-2.5 flex items-start gap-2.5 text-sm">
                <EventDot kind={ev.kind} />
                <span className={eventText(ev.kind)}>{ev.text}</span>
                <span className="ml-auto font-mono text-[11px] text-muted-foreground/80 shrink-0 mt-0.5">
                  {new Date(ev.t).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>

      {/* Indicaciones completas (colapsables) */}
      {onRoute && p.nav.route && p.nav.route.steps.length > 1 && (
        <details className="rounded-xl border border-border bg-card/70 p-3 group">
          <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-semibold text-foreground/90 list-none [&::-webkit-details-marker]:hidden">
            <ListTree className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            {t("ride.indicaciones", p.nav.route.steps.length)}
            <span className="ml-auto text-[11px] text-muted-foreground font-normal group-open:hidden">{t("ride.verTodas")}</span>
            <span className="ml-auto text-[11px] text-muted-foreground font-normal hidden group-open:inline">{t("ride.ocultar")}</span>
          </summary>
          <ol className="mt-3 space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {p.nav.route.steps.map((s, i) => {
              const passed = progress ? i < progress.passedCount : false;
              return (
                <li key={i} className={`flex items-start gap-2 text-sm ${passed ? "text-muted-foreground/80 line-through" : "text-foreground"}`}>
                  <span className="text-lg leading-none w-6 text-center shrink-0" aria-hidden>
                    {stepGlyph(s.icon)}
                  </span>
                  <span className="min-w-0 flex-1">{s.text}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{s.distM > 0 ? formatStepRemaining(s) : ""}</span>
                </li>
              );
            })}
          </ol>
        </details>
      )}

      {/* Holgura final: permite scrollear hasta ver el último elemento
          por encima del botón flotante (main trae pb-28 por el nav;
          el botón + su leyenda llegan a ~145px del borde inferior). */}
      <div className="h-10" aria-hidden />

      {/* Tarjeta de emergencia (funciona sin conexión: tel: y compartir) */}
      {sosOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 sm:items-center" role="dialog" aria-label={t("sos.titulo")}>
          <Card className="w-full max-w-md rounded-b-none rounded-t-2xl bg-background p-4 sm:rounded-2xl">
            <div className="flex items-center gap-2">
              <Siren className="h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="flex-1 font-bold text-foreground">{t("sos.titulo")}</p>
              <button
                onClick={() => setSosOpen(false)}
                className="rounded-full border border-border p-1.5 text-muted-foreground hover:text-foreground"
                aria-label={t("sos.cerrarAria")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("sos.emergencias")}</p>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                <a href="tel:133" className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-3 text-center hover:border-red-500/70">
                  <Phone className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-bold text-foreground">133</span>
                  <span className="text-[10px] text-muted-foreground">{t("sos.carabineros")}</span>
                </a>
                <a href="tel:131" className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-3 text-center hover:border-red-500/70">
                  <Phone className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-bold text-foreground">131</span>
                  <span className="text-[10px] text-muted-foreground">{t("sos.ambulancia")}</span>
                </a>
                <a href="tel:132" className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-3 text-center hover:border-red-500/70">
                  <Phone className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-bold text-foreground">132</span>
                  <span className="text-[10px] text-muted-foreground">{t("sos.bomberos")}</span>
                </a>
              </div>
            </div>
            <div className="mt-2.5">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("sos.parqueYApoyo")}</p>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {/* Número oficial de EMERGENCIAS del parque (cliente 2026-11-13,
                    insignia roja «EMERGENCIAS 1466»): reemplaza a la antigua
                    línea de informaciones +56 2 2730 1404. Estilo rojo como
                    los números nacionales de urgencia. */}
                <a href="tel:1466" className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-3 text-center hover:border-red-500/70">
                  <Phone className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-[13px] font-bold tabular-nums text-foreground">1466</span>
                  <span className="text-[10px] text-muted-foreground">{t("sos.emergParquemet")}</span>
                </a>
                <a href="tel:+56226543200" className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-3 text-center hover:border-emerald-500/70">
                  <Phone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[13px] font-bold tabular-nums text-foreground">+56 2 2654 3200</span>
                  <span className="text-[10px] text-muted-foreground">{t("sos.providencia")}</span>
                </a>
                <a href="tel:6003607777" className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-3 text-center hover:border-emerald-500/70">
                  <Phone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[13px] font-bold tabular-nums text-foreground">600 360 7777</span>
                  <span className="text-[10px] text-muted-foreground">{t("sos.saludResponde")}</span>
                </a>
              </div>
            </div>
            {p.position ? (
              <>
                <Button
                  onClick={() => void compartirUbicacion()}
                  className="mt-3 w-full bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-semibold"
                >
                  <Share2 className="h-4 w-4 mr-2" /> {t("sos.compartir")}
                </Button>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 py-2">
                  <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/90">
                    {p.position.lat.toFixed(5)}, {p.position.lon.toFixed(5)}
                  </span>
                </div>
              </>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                {t("sos.sinGps")}
              </p>
            )}
            {sosMsg && <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400" role="status">{sosMsg}</p>}
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              {t("sos.nota")}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/40 p-2.5">
      <div className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 font-mono text-[15px] font-bold tabular-nums leading-none text-foreground">
        {value}
        {unit && <span className="ml-0.5 font-sans text-[10px] font-semibold text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

const EVENT_STYLE: Record<RideEvent["kind"], { dot: string; text: string }> = {
  info: { dot: "bg-emerald-400", text: "text-foreground/90" },
  gate: { dot: "bg-teal-400", text: "text-foreground/90" },
  zone: { dot: "bg-amber-400", text: "text-amber-800 dark:text-amber-200" },
  warn: { dot: "bg-amber-500", text: "text-amber-800 dark:text-amber-200" },
  danger: { dot: "bg-red-500", text: "text-red-700 dark:text-red-300 font-medium" },
};

function EventDot({ kind }: { kind: RideEvent["kind"] }) {
  return <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${EVENT_STYLE[kind].dot}`} />;
}

function eventText(kind: RideEvent["kind"]): string {
  return EVENT_STYLE[kind].text;
}
