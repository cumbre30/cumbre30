"use client";

// ============================================================
// Desafíos y recompensas (v1.14.0: sección del Perfil Ciclista).
// La pestaña propia del menú desaparece: su contenido se divide en
// dos piezas exportadas que el Perfil renderiza como secciones:
//   · ProgresoYNivel - "Tu progreso" + "Tus niveles": al PRINCIPIO
//     de la sección ADN del Perfil.
//   · DesafiosYRecompensas - rachas (trasladada desde Estadísticas
//     generales, al principio) + Desafíos del cerro + Desafíos con
//     fecha + Retos puntuales + Tus pines.
// Estructura original (referencia: mockup de progreso gamificado):
//   · "Tu progreso": km acumulados (GPS real, de la cuenta) + anillo
//     de avance del nivel actual y km que faltan al siguiente.
//   · "Tus niveles": Explorador → Ciclista → Montañero → Desafiante
//     (umbrales compartidos en lib/pins.ts → RIDER_LEVELS).
//   · "Desafíos del cerro": las series acumulativas agrupadas en un
//     menú desplegable, con % de avance por serie.
//   · "Desafíos con fecha": diarios / semanales / mensuales - gratis,
//     sin recompensas; se reinician solos con el periodo.
//   · "Retos puntuales" y "Tus pines": igual regla Free/Pro - solo el
//     primer desafío de cada serie (y su pin) es gratis; el resto
//     requiere Cumbre30 Pro (los ya ganados se conservan).
// ============================================================

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronDown, Crown, Flame, Lock, LogIn, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ACHIEVEMENT_BY_CODE,
  DEFAULT_PIN,
  LEYENDA_KM,
  PINS,
  RETOS,
  RIDER_LEVELS,
  SERIES,
  TIME_SERIES,
  isPinId,
  metricValue,
  normalizeCodes,
  pinIsPro,
  riderLevelForKm,
  tierIsPro,
  timeChallengeProgress,
  windowStatsFromRides,
  type AchievementStats,
  type Tier,
  type TimeChallenge,
  type TimeScope,
} from "@/lib/pins";
import { bikeOnly, historyStore, ridesForAccount, type RideSummary } from "@/lib/history";
import { rachasDe } from "@/lib/rachas";
import { isOfflineMode, offlineUpdateProfile } from "@/lib/offlineAuth";
import { useMe, refreshMe, type MeData } from "@/hooks/useMe";
import { useProLicense } from "@/lib/proLicense";
import { t, useLang } from "@/lib/i18n";

function ProgressBar({ pct, accent = "bg-emerald-500" }: { pct: number; accent?: string }) {
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${accent} transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

const ACCENT_BAR: Record<string, string> = {
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  teal: "bg-teal-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
};

/** Chip "Pro" para desafíos y pines que requieren licencia. */
function ProChip() {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber-500/60 bg-amber-950/40 px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-amber-600 dark:text-amber-400">
      <Crown className="h-2.5 w-2.5" aria-hidden /> Pro
    </span>
  );
}

/** Cabecera plegable de un grupo de series (menú desplegable). */
function GroupHeader({
  emoji,
  title,
  hint,
  pct,
  open,
  onToggle,
}: {
  emoji: string;
  title: string;
  hint: string;
  pct: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg text-left"
      >
        <span className="text-xl leading-none" aria-hidden>{emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-foreground">{title}</p>
          <p className="text-[10.5px] leading-tight text-muted-foreground">{hint}</p>
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{pct}%</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <div className="mt-2">
        <ProgressBar pct={pct} />
      </div>
    </div>
  );
}

/** Fila plegable de una serie dentro de un grupo, con su % de avance. */
function SeriesRow({
  emoji,
  name,
  pct,
  done,
  total,
  accent,
  open,
  onToggle,
  right,
}: {
  emoji: string;
  name: string;
  pct: number;
  done: number;
  total: number;
  accent: string;
  open: boolean;
  onToggle: () => void;
  right?: ReactNode;
}) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-background/60"
    >
      <span className="text-lg leading-none" aria-hidden>{emoji}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{name}</span>
      {right}
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {done}/{total} · {pct}%
      </span>
      <div className="w-14 shrink-0">
        <ProgressBar pct={pct} accent={ACCENT_BAR[accent] ?? "bg-emerald-500"} />
      </div>
      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
    </button>
  );
}

/** Número con decimales a la chilena: "10,9" · enteros sin decimal. */
const numFmt = (v: number): string =>
  v.toLocaleString("es-CL", { maximumFractionDigits: 1 });

/** Formatea el valor de un desafío con fecha según su métrica. */
function timeValueFmt(metric: TimeChallenge["metric"], v: number): string {
  if (metric === "rides") return `${Math.round(v)}`;
  if (metric === "km") return `${numFmt(v)} km`;
  return `${Math.round(v).toLocaleString("es-CL")} m`;
}

function timeGoalFmt(c: TimeChallenge): string {
  if (c.metric === "rides") return `${c.goal} rides`;
  if (c.metric === "km") return `${numFmt(c.goal)} km`;
  return `${c.goal.toLocaleString("es-CL")} m`;
}

/** Fila de un desafío diario/semanal/mensual con progreso en vivo. */
function TimeChallengeRow({ c, ws }: { c: TimeChallenge; ws: Record<TimeScope, { rides: number; km: number; gainM: number }> }) {
  const { value, pct, done } = timeChallengeProgress(c, ws);
  return (
    <div className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 ${done ? "bg-emerald-950/20" : ""}`}>
      <span className="mt-0.5 shrink-0" aria-hidden>
        {done ? (
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <span className="inline-block h-4.5 w-4.5 rounded-full border-2 border-muted-foreground/50" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>{c.name}</p>
        </div>
        <p className="text-[11px] mt-0.5 text-muted-foreground">{c.desc}</p>
        <div className="mt-1.5">
          <ProgressBar pct={pct} accent={done ? "bg-emerald-500" : "bg-amber-500"} />
        </div>
        <p className="text-[10px] text-muted-foreground/80 mt-1 tabular-nums">
          {timeValueFmt(c.metric, value)} / {timeGoalFmt(c)} · {pct}%
        </p>
      </div>
    </div>
  );
}

/**
 * Rides de la cuenta para los desafíos con fecha: en el APK, el
 * historial local (en bici); en la web, GET /api/rides del servidor.
 */
export function useAccountRides(me: MeData | null): RideSummary[] {
  const [rides, setRides] = useState<RideSummary[]>([]);
  const email = me?.user.email ?? null;
  const offline = isOfflineMode();
  useEffect(() => {
    if (!me) return;
    let alive = true;
    if (offline) {
      const upd = () => setRides(bikeOnly(ridesForAccount(historyStore.get(), email)));
      upd();
      const unsub = historyStore.subscribe(upd);
      return () => {
        alive = false;
        unsub();
      };
    }
    fetch("/api/rides", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { rides: [] }))
      .then((d: { rides?: unknown[] }) => {
        if (!alive) return;
        const list = (d.rides ?? []).filter((r) => (r as { source?: string }).source === "gps") as unknown as RideSummary[];
        setRides(bikeOnly(list));
      })
      .catch(() => {
        if (alive) setRides([]);
      });
    return () => {
      alive = false;
    };
  }, [me?.user.id, email, offline]);
  return rides;
}

/** Anillo de progreso del nivel actual, con los km acumulados al centro. */
function LevelRing({ pct, km, gold = false }: { pct: number; km: number; gold?: boolean }) {
  const r = 33;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 84 84" className="h-24 w-24 -rotate-90" aria-hidden="true">
        <circle cx="42" cy="42" r={r} fill="none" strokeWidth="7" className="stroke-muted" />
        <circle
          cx="42" cy="42" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
          className={`${gold ? "stroke-amber-400" : "stroke-emerald-500"} transition-[stroke-dashoffset] duration-500`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-mono text-lg font-bold leading-none tabular-nums ${gold ? "text-amber-500 dark:text-amber-300" : "text-foreground"}`}>{km.toFixed(1)}</span>
        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">km</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Rachas (trasladada desde Estadísticas generales, v1.14.0): abre
// la sección Desafíos y recompensas. Recibe los rides de la cuenta
// ya filtrados (en bici, GPS real) - los mismos del progreso con
// fecha, así que una sola fuente alimenta ambas tarjetas.
// ------------------------------------------------------------
export function RachasCard({ rides }: { rides: RideSummary[] }) {
  useLang();
  const rachas = useMemo(() => rachasDe(rides), [rides]);
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-orange-500" />
        <p className="text-sm font-semibold text-foreground">{t("st.rachas")}</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2.5 text-center">
        <div className="rounded-lg border border-border/70 bg-background/40 p-2.5">
          <p className="font-mono text-[20px] font-bold leading-none tabular-nums text-foreground">
            {rachas.diasActual}
          </p>
          <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{t("st.diasSeguidos")}</p>
        </div>
        <div className="rounded-lg border border-border/70 bg-background/40 p-2.5">
          <p className="font-mono text-[20px] font-bold leading-none tabular-nums text-foreground">
            {rachas.diasMaxima}
          </p>
          <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{t("st.recordDias")}</p>
        </div>
        <div className="rounded-lg border border-border/70 bg-background/40 p-2.5">
          <p className="font-mono text-[20px] font-bold leading-none tabular-nums text-foreground">
            {rachas.semanasActual}
          </p>
          <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{t("st.semanasSeguidas")}</p>
        </div>
      </div>
      <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
        {rachas.diasTotales > 0
          ? rachas.diasTotales === 1
            ? t("st.diaDistinto", rachas.diasTotales)
            : t("st.diasDistintos", rachas.diasTotales)
          : t("st.arrancaRacha")}
      </p>
    </Card>
  );
}

// ------------------------------------------------------------
// Progreso + Niveles: viven al PRINCIPIO de la sección ADN del
// Perfil Ciclista (v1.14.0). Sin sesión no renderiza nada: la ADN
// ya muestra su invitación a entrar.
// ------------------------------------------------------------
export function ProgresoYNivel() {
  const { me, ready } = useMe();
  useLang();
  if (!ready || !me) return null;

  // ---- Nivel actual según km acumulados (helper compartido con Cuenta) ----
  const km = me.stats.totalKm;
  const { index: lvlIdx, level: lvl, next, pct: lvlPct, toNext } = riderLevelForKm(km);
  // 🌟 Leyenda: título exclusivo de esta tarjeta al superar los 500 km
  // (el umbral coincide con el Diamante de la Serie Kilómetros).
  const isLeyenda = km >= LEYENDA_KM;

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Tu progreso ---- */}
      <Card className={`bg-card/80 border-border p-4 ${isLeyenda ? "border-amber-500/50 bg-gradient-to-br from-amber-950/30 to-card" : ""}`}>
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("ch.tuProgreso")}</p>
        <div className="mt-3 flex items-center gap-4">
          <LevelRing pct={lvlPct} km={km} gold={isLeyenda} />
          <div className="min-w-0 flex-1">
            {isLeyenda ? (
              <>
                <p className="flex items-center gap-1.5 text-base font-extrabold text-amber-500 dark:text-amber-300">
                  <span aria-hidden>🌟</span> {t("ch.leyenda")}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {t("ch.leyendaNivel", lvlIdx + 1, lvl.emoji, lvl.name, km.toFixed(0))}
                </p>
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                  {t("ch.leyendaSub", LEYENDA_KM)}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-foreground">
                  {t("ch.nivel", lvlIdx + 1, lvl.emoji, lvl.name)}
                </p>
                {next ? (
                  <>
                    <div className="mt-2">
                      <ProgressBar pct={lvlPct} />
                    </div>
                    <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                      {t("ch.teFaltan1")}<span className="font-semibold text-foreground">{toNext.toFixed(1)} km</span>{t("ch.teFaltan2", next.name, next.min)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                    {t("ch.nivelMaximo")}
                  </p>
                )}
              </>
            )}
            <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground/80">
              {t("ch.kmAcumulados")}
            </p>
          </div>
        </div>
      </Card>

      {/* ---- Tus niveles ---- */}
      <Card className="bg-card/80 border-border p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("ch.tusNiveles")}</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {RIDER_LEVELS.map((L, i) => {
            const done = L.max != null ? km >= L.max : km >= L.min;
            const current = i === lvlIdx;
            return (
              <div
                key={L.name}
                className={`relative flex flex-col items-center gap-1 rounded-xl border p-2.5 text-center ${
                  current
                    ? "border-emerald-500 bg-emerald-950/40 shadow-[0_0_14px_rgba(16,185,129,0.25)]"
                    : "border-border bg-background/40"
                }`}
              >
                <span className={`text-xl leading-none ${!done && !current ? "grayscale opacity-50" : ""}`} aria-hidden>{L.emoji}</span>
                <span className={`text-[11px] font-semibold leading-tight ${current ? "text-emerald-700 dark:text-emerald-300" : done ? "text-foreground" : "text-muted-foreground"}`}>{L.name}</span>
                <span className="text-[9.5px] leading-tight text-muted-foreground/80">
                  {L.max != null ? `${L.min}-${L.max} km` : `${L.min}+ km`}
                </span>
                {done && !current && <CheckCircle2 className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-card text-emerald-600 dark:text-emerald-400" />}
                {current && (
                  <span className="absolute -top-2 right-1 rounded-full bg-emerald-500 px-1.5 text-[8px] font-extrabold uppercase tracking-wide text-(--c30-on-accent)">{t("ch.aqui")}</span>
                )}
                {!done && !current && <Lock className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 text-muted-foreground/70" />}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------
// Desafíos y recompensas: sección del Perfil Ciclista (v1.14.0).
// Rachas al principio (trasladada desde Estadísticas generales) +
// los grupos de desafíos y los pines. Sin sesión muestra su propio
// acceso directo a Cuenta.
// ------------------------------------------------------------
export function DesafiosYRecompensas({ onGoPerfil, onGoPro }: { onGoPerfil?: () => void; onGoPro?: () => void }) {
  const { me, ready } = useMe();
  useLang();
  const { pro } = useProLicense();
  const [savingPin, setSavingPin] = useState<string | null>(null);
  // Menús desplegables: grupo del cerro, grupo con fecha y series internas.
  const [cerroOpen, setCerroOpen] = useState(false);
  const [fechaOpen, setFechaOpen] = useState(false);
  const [openSeries, setOpenSeries] = useState<Record<string, boolean>>({});
  const [openTimeSeries, setOpenTimeSeries] = useState<Record<string, boolean>>({});
  const rides = useAccountRides(me);

  // ---- Sin sesión: la sección es parte del Perfil ----
  if (!ready) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground">
        {t("ch.cargando")}
      </div>
    );
  }
  if (!me) {
    return (
      <Card className="bg-card/80 border-border p-5 text-center">
        <span className="text-3xl" aria-hidden>🏆</span>
        <p className="mt-2 font-semibold text-foreground">{t("menu.premios")}</p>
        <p className="mx-auto mt-1 max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
          {t("ch.sinSesionCuerpo")}
        </p>
        <Button
          onClick={onGoPerfil}
          className="mt-4 h-11 w-full bg-emerald-600 font-bold text-(--c30-on-accent) hover:bg-emerald-500"
        >
          <LogIn className="mr-2 h-4 w-4" /> {t("pf.iniciarSesion")}
        </Button>
      </Card>
    );
  }

  // ---- Con sesión: stats de la cuenta (servidor u offline APK) ----
  const stats: AchievementStats = {
    totalKm: me.stats.totalKm,
    rideCount: me.stats.rideCount,
    maxKmh: me.stats.maxKmh,
    totalGainM: me.stats.totalGainM,
    parkRides: me.stats.parkRides,
    cleanParkRides: me.stats.cleanParkRides,
    nightRides: me.stats.nightRides,
    dawnRides: me.stats.dawnRides,
    maxRideKm: me.stats.maxRideKm,
    weekendRides: me.stats.weekendRides,
    totalHours: me.stats.totalHours,
    // Respuestas /api/me antiguas sin la métrica nueva: 0 (la Serie
    // Metropolitana arranca a medir desde esta versión).
    totalParkKm: me.stats.totalParkKm ?? 0,
    incidentCount: me.stats.incidentCount,
  };
  const unlocked = normalizeCodes(me.achievements.map((a) => a.code));

  const unlockedPins = (() => {
    const set = new Set<string>([DEFAULT_PIN]);
    for (const code of unlocked) {
      const def = ACHIEVEMENT_BY_CODE[code];
      if (def) set.add(def.reward);
    }
    return set;
  })();

  const activePin = (me.user.selectedPin as string) ?? DEFAULT_PIN;

  const selectPin = async (pinId: string) => {
    if (!unlockedPins.has(pinId) || !isPinId(pinId)) return;
    setSavingPin(pinId);
    try {
      if (isOfflineMode()) {
        offlineUpdateProfile({ selectedPin: pinId });
      } else {
        await fetch("/api/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedPin: pinId }),
        });
      }
      await refreshMe();
    } catch {
      // sin conexión
    }
    setSavingPin(null);
  };

  const tierRow = (tier: Tier, state: "done" | "current" | "locked", accent: string) => {
    const reward = PINS[tier.reward];
    const val = metricValue(stats, tier.metric);
    const pct = Math.min(100, Math.round((val / tier.goal) * 100));
    const needPro = tierIsPro(tier) && !pro.active;
    return (
      <div key={tier.code} className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 ${state === "current" ? "bg-card/90 border border-border" : ""}`}>
        <span className="text-xl leading-none mt-0.5 shrink-0" aria-hidden>
          {state === "done" ? reward.emoji : state === "current" ? <span className="inline-block text-2xl grayscale opacity-70">{reward.emoji}</span> : <Lock className="h-4.5 w-4.5 text-muted-foreground/80 mt-1" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium truncate ${state === "done" ? "text-muted-foreground line-through" : state === "current" ? "text-foreground" : "text-muted-foreground"}`}>{tier.name}</p>
            {needPro && <ProChip />}
            {state === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
            {state === "current" && !needPro && <span className="text-[10px] text-muted-foreground shrink-0">{t("ch.recompensa", reward.emoji, reward.name)}</span>}
          </div>
          <p className={`text-[11px] mt-0.5 ${state === "locked" ? "text-muted-foreground/80" : "text-muted-foreground"}`}>{tier.desc}</p>
          {state === "current" && (
            <div className="mt-1.5">
              <ProgressBar pct={pct} accent={ACCENT_BAR[accent] ?? "bg-emerald-500"} />
              <p className="text-[10px] text-muted-foreground/80 mt-1">
                {pct}% · {tier.metric === "totalGainM" || tier.metric === "totalKm" || tier.metric === "totalHours" ? `${Math.round(val).toLocaleString("es-CL")}` : val.toLocaleString("es-CL")} / {tier.goal.toLocaleString("es-CL")}
              </p>
              {needPro && onGoPro && (
                <Button
                  onClick={onGoPro}
                  size="sm"
                  className="mt-2 h-8 w-full rounded-lg bg-amber-500 text-[11px] font-extrabold uppercase tracking-wide text-zinc-950 hover:bg-amber-400"
                >
                  <Crown className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {t("ch.desbloqueaPro")}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ---- Series del cerro: % por serie y totales del grupo ----
  const cerroRows = SERIES.map((s) => {
    const done = s.tiers.filter((t) => unlocked.has(t.code)).length;
    const currentIdx = Math.min(done, s.tiers.length - 1);
    const complete = done === s.tiers.length;
    const pct = Math.round((done / s.tiers.length) * 100);
    return { s, done, currentIdx, complete, pct };
  });
  const cerroDone = cerroRows.reduce((n, r) => n + r.done, 0);
  const cerroTotal = cerroRows.reduce((n, r) => n + r.s.tiers.length, 0);
  const cerroPct = cerroTotal ? Math.round((cerroDone / cerroTotal) * 100) : 0;
  // Primera serie aún incompleta: se abre por defecto al expandir el grupo.
  const firstIncompleteId = cerroRows.find((r) => !r.complete)?.s.id ?? null;

  // ---- Desafíos con fecha: progreso en vivo por ventana ----
  const ws = windowStatsFromRides(rides);
  const timeRows = TIME_SERIES.map((ts) => {
    const done = ts.challenges.filter((c) => timeChallengeProgress(c, ws).done).length;
    return { ts, done, pct: Math.round((done / ts.challenges.length) * 100) };
  });
  const timeDone = timeRows.reduce((n, r) => n + r.done, 0);
  const timeTotal = timeRows.reduce((n, r) => n + r.ts.challenges.length, 0);
  const timePct = timeTotal ? Math.round((timeDone / timeTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Rachas (trasladada desde Estadísticas generales) ---- */}
      <RachasCard rides={rides} />

      {/* ---- Desafíos del cerro (menú desplegable con % por serie) ---- */}
      <Card className="bg-card/80 border-border p-4">
        <GroupHeader
          emoji="🏔️"
          title={t("ch.cerroTitulo")}
          hint={
            pro.active
              ? t("ch.cerroHintPro", cerroDone, cerroTotal)
              : t("ch.cerroHintFree", cerroDone, cerroTotal)
          }
          pct={cerroPct}
          open={cerroOpen}
          onToggle={() => setCerroOpen((v) => !v)}
        />
        {cerroOpen && (
          <div className="mt-3 space-y-2.5">
            {cerroRows.map(({ s, done, currentIdx, complete, pct }) => {
              // Por defecto solo queda abierta la primera serie incompleta
              // (la que tiene el desafío en curso); el resto, plegadas.
              const open = openSeries[s.id] ?? s.id === firstIncompleteId;
              return (
                <div key={s.id} className={`rounded-xl border p-3 ${complete ? "border-emerald-700/60 bg-emerald-950/20" : "border-border bg-card/60"}`}>
                  <SeriesRow
                    emoji={s.emoji}
                    name={s.name}
                    pct={pct}
                    done={done}
                    total={s.tiers.length}
                    accent={s.accent}
                    open={open}
                    onToggle={() => setOpenSeries((m) => ({ ...m, [s.id]: !open }))}
                  />
                  {open && (
                    <div className="space-y-1 pt-1">
                      {s.tiers.map((t, i) =>
                        tierRow(t, unlocked.has(t.code) ? "done" : i === currentIdx ? "current" : "locked", s.accent)
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ---- Desafíos con fecha: diarios / semanales / mensuales ---- */}
      <Card className="bg-card/80 border-border p-4">
        <GroupHeader
          emoji="⏱️"
          title={t("ch.fechaTitulo")}
          hint={t("ch.fechaHint")}
          pct={timePct}
          open={fechaOpen}
          onToggle={() => setFechaOpen((v) => !v)}
        />
        {fechaOpen && (
          <div className="mt-3 space-y-2.5">
            {timeRows.map(({ ts, done, pct }) => {
              const open = openTimeSeries[ts.id] ?? ts.id === "dia";
              return (
                <div key={ts.id} className="rounded-xl border border-border bg-card/60 p-3">
                  <SeriesRow
                    emoji={ts.emoji}
                    name={ts.name}
                    pct={pct}
                    done={done}
                    total={ts.challenges.length}
                    accent={ts.accent}
                    open={open}
                    onToggle={() => setOpenTimeSeries((m) => ({ ...m, [ts.id]: !open }))}
                    right={<span className="hidden shrink-0 text-[9.5px] uppercase tracking-wide text-muted-foreground sm:inline">{ts.resetLabel}</span>}
                  />
                  {open && (
                    <div className="space-y-1 pt-1">
                      {ts.challenges.map((c) => (
                        <TimeChallengeRow key={c.id} c={c} ws={ws} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Retos puntuales (primero gratis, resto Pro) */}
      <div className="rounded-xl border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl" aria-hidden>🎯</span>
          <p className="font-semibold text-sm text-foreground">{t("ch.retosTitulo")}</p>
          <span className="ml-auto text-xs text-muted-foreground">{pro.active ? t("ch.retosTodos") : t("ch.retosFree")}</span>
        </div>
        <div className="space-y-1">
          {RETOS.map((t) => tierRow(t, unlocked.has(t.code) ? "done" : "current", "emerald"))}
        </div>
      </div>

      {/* ---- Tus pines ---- */}
      <div className="rounded-xl border border-border bg-card/70 p-4">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-medium text-foreground">{t("ch.tusPines")}</p>
          <span className="ml-auto text-xs text-muted-foreground">
            {t("ch.pinActivo")}<span className="text-foreground">{PINS[isPinId(activePin) ? activePin : DEFAULT_PIN].emoji} {PINS[isPinId(activePin) ? activePin : DEFAULT_PIN].name}</span>
          </span>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {t("ch.pinesNota1")}
          {!pro.active && <>{t("ch.pinesNota2")}<Crown className="inline h-3 w-3 text-amber-500" aria-hidden />{t("ch.pinesNota3")}<b className="text-foreground">Cumbre30 Pro</b>.</>}
        </p>
        <div className="grid grid-cols-5 gap-2 mt-2">
          {Object.values(PINS).map((pin) => {
            const open = unlockedPins.has(pin.id);
            const active = activePin === pin.id;
            const needPro = !open && !pro.active && pinIsPro(pin.id);
            return (
              <button
                key={pin.id}
                onClick={() => void selectPin(pin.id)}
                disabled={!open || savingPin !== null}
                title={open ? `${pin.name} - ${pin.desc}` : needPro ? `Recompensa Pro: ${pin.desc}` : `Bloqueado: ${pin.desc}`}
                className={`relative rounded-lg border p-2 flex flex-col items-center gap-1 transition-colors ${
                  active
                    ? "border-emerald-400 bg-emerald-950/60"
                    : open
                      ? "border-border bg-background hover:border-emerald-600"
                      : needPro
                        ? "border-amber-700/40 bg-background/40 opacity-70"
                        : "border-border bg-background/40 opacity-60"
                }`}
              >
                <span className="text-2xl" aria-hidden>{open ? pin.emoji : needPro ? "👑" : "🔒"}</span>
                <span className={`text-[9px] leading-tight text-center ${active ? "text-emerald-700 dark:text-emerald-300 font-semibold" : "text-muted-foreground"}`}>{pin.name}</span>
                {active && <CheckCircle2 className="absolute -top-1.5 -right-1.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                {needPro && <Crown className="absolute -top-1.5 -left-1.5 h-3 w-3 rounded-full bg-card text-amber-500" aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
