"use client";

// ============================================================
// Desafíos y recompensas — sección de la cuenta (requiere sesión;
// sin sesión muestra acceso directo a iniciar sesión y luego carga).
// Estructura (referencia: mockup de progreso gamificado):
//   · "Tu progreso": km acumulados (GPS real, de la cuenta) + anillo
//     de avance del nivel actual y km que faltan al siguiente.
//   · "Tus niveles": Explorador → Ciclista → Montañero → Desafiante
//     (umbrales compartidos en lib/pins.ts → RIDER_LEVELS).
//   · "Desafíos activos": series con avance SECUENCIAL (cada nivel
//     se activa al completar el anterior) + retos puntuales.
//   · "Tus pines": recompensas personalizables para el mapa.
// ============================================================

import { useState } from "react";
import { CheckCircle2, Lock, LogIn, MapPin, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ACHIEVEMENT_BY_CODE,
  DEFAULT_PIN,
  PINS,
  RETOS,
  RIDER_LEVELS,
  SERIES,
  isPinId,
  metricValue,
  normalizeCodes,
  riderLevelForKm,
  type AchievementStats,
  type Tier,
} from "@/lib/pins";
import { useMe, refreshMe } from "@/hooks/useMe";
import { isOfflineMode, offlineUpdateProfile } from "@/lib/offlineAuth";

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
};

/** Anillo de progreso del nivel actual, con los km acumulados al centro. */
function LevelRing({ pct, km }: { pct: number; km: number }) {
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
          className="stroke-emerald-500 transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-lg font-bold leading-none tabular-nums text-foreground">{km.toFixed(1)}</span>
        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">km</span>
      </div>
    </div>
  );
}

export default function ChallengesTab({ onGoPerfil }: { onGoPerfil: () => void }) {
  const { me, ready } = useMe();
  const [savingPin, setSavingPin] = useState<string | null>(null);

  // ---- Sin sesión: la sección es parte de la cuenta ----
  if (!ready) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground">
        Cargando desafíos…
      </div>
    );
  }
  if (!me) {
    return (
      <Card className="bg-card/80 border-border p-5 text-center">
        <span className="text-3xl" aria-hidden>🏆</span>
        <p className="mt-2 font-semibold text-foreground">Desafíos y recompensas</p>
        <p className="mx-auto mt-1 max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
          Tus niveles, desafíos y pines viven en tu cuenta. Inicia sesión para ver tu progreso acumulado y desbloquear recompensas.
        </p>
        <Button
          onClick={onGoPerfil}
          className="mt-4 h-11 w-full bg-emerald-600 font-bold text-zinc-950 hover:bg-emerald-500"
        >
          <LogIn className="mr-2 h-4 w-4" /> Iniciar sesión
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

  const tierRow = (t: Tier, state: "done" | "current" | "locked", accent: string) => {
    const reward = PINS[t.reward];
    const val = metricValue(stats, t.metric);
    const pct = Math.min(100, Math.round((val / t.goal) * 100));
    return (
      <div key={t.code} className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 ${state === "current" ? "bg-card/90 border border-border" : ""}`}>
        <span className="text-xl leading-none mt-0.5 shrink-0" aria-hidden>
          {state === "done" ? reward.emoji : state === "current" ? <span className="inline-block text-2xl grayscale opacity-70">{reward.emoji}</span> : <Lock className="h-4.5 w-4.5 text-muted-foreground/80 mt-1" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium truncate ${state === "done" ? "text-muted-foreground line-through" : state === "current" ? "text-foreground" : "text-muted-foreground"}`}>{t.name}</p>
            {state === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
            {state === "current" && <span className="text-[10px] text-muted-foreground shrink-0">recompensa: {reward.emoji} {reward.name}</span>}
          </div>
          <p className={`text-[11px] mt-0.5 ${state === "locked" ? "text-muted-foreground/80" : "text-muted-foreground"}`}>{t.desc}</p>
          {state === "current" && (
            <div className="mt-1.5">
              <ProgressBar pct={pct} accent={ACCENT_BAR[accent] ?? "bg-emerald-500"} />
              <p className="text-[10px] text-muted-foreground/80 mt-1">
                {pct}% · {t.metric === "totalGainM" || t.metric === "totalKm" ? `${Math.round(val).toLocaleString("es-CL")}` : val.toLocaleString("es-CL")} / {t.goal.toLocaleString("es-CL")}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ---- Nivel actual según km acumulados (helper compartido con Perfil) ----
  const km = stats.totalKm;
  const { index: lvlIdx, level: lvl, next, pct: lvlPct, toNext } = riderLevelForKm(km);

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Tu progreso ---- */}
      <Card className="bg-card/80 border-border p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">Tu progreso</p>
        <div className="mt-3 flex items-center gap-4">
          <LevelRing pct={lvlPct} km={km} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">
              Nivel {lvlIdx + 1} · {lvl.emoji} {lvl.name}
            </p>
            {next ? (
              <>
                <div className="mt-2">
                  <ProgressBar pct={lvlPct} />
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                  Te faltan <span className="font-semibold text-foreground">{toNext.toFixed(1)} km</span> para {next.name} · {next.min} km
                </p>
              </>
            ) : (
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                ¡Nivel máximo alcanzado! Sigue sumando km en el cerro 🏔️
              </p>
            )}
            <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground/80">
              Km acumulados con GPS real, asociados a tu cuenta.
            </p>
          </div>
        </div>
      </Card>

      {/* ---- Tus niveles ---- */}
      <Card className="bg-card/80 border-border p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">Tus niveles</p>
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
                  {L.max != null ? `${L.min}–${L.max} km` : `${L.min}+ km`}
                </span>
                {done && !current && <CheckCircle2 className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-card text-emerald-600 dark:text-emerald-400" />}
                {current && (
                  <span className="absolute -top-2 right-1 rounded-full bg-emerald-500 px-1.5 text-[8px] font-extrabold uppercase tracking-wide text-zinc-950">aquí</span>
                )}
                {!done && !current && <Lock className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 text-muted-foreground/70" />}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ---- Desafíos activos (series secuenciales) ---- */}
      <div>
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">Desafíos activos</p>
        <div className="flex flex-col gap-3">
          {SERIES.map((s) => {
            const done = s.tiers.filter((t) => unlocked.has(t.code)).length;
            const currentIdx = Math.min(done, s.tiers.length - 1);
            const complete = done === s.tiers.length;
            return (
              <div key={s.id} className={`rounded-xl border p-4 ${complete ? "border-emerald-700/60 bg-emerald-950/20" : "border-border bg-card/60"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl" aria-hidden>{s.emoji}</span>
                  <p className="font-semibold text-sm text-foreground">{s.name}</p>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border ${complete ? "border-emerald-600 text-emerald-700 dark:text-emerald-300" : "border-border text-muted-foreground"}`}>
                    {done}/{s.tiers.length} {complete ? "· completa" : ""}
                  </span>
                </div>
                <div className="flex gap-1 mb-2" aria-hidden>
                  {s.tiers.map((t) => (
                    <div key={t.code} className={`h-1.5 flex-1 rounded-full ${unlocked.has(t.code) ? ACCENT_BAR[s.accent] ?? "bg-emerald-500" : "bg-muted"}`} />
                  ))}
                </div>
                <div className="space-y-1">
                  {s.tiers.map((t, i) =>
                    tierRow(t, unlocked.has(t.code) ? "done" : i === currentIdx ? "current" : "locked", s.accent)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Retos puntuales */}
      <div className="rounded-xl border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl" aria-hidden>🎯</span>
          <p className="font-semibold text-sm text-foreground">Retos puntuales</p>
          <span className="ml-auto text-xs text-muted-foreground">disponibles siempre</span>
        </div>
        <div className="space-y-1">
          {RETOS.map((t) => tierRow(t, unlocked.has(t.code) ? "done" : "current", "emerald"))}
        </div>
      </div>

      {/* ---- Tus pines ---- */}
      <div className="rounded-xl border border-border bg-card/70 p-4">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-medium text-foreground">Tus pines</p>
          <span className="ml-auto text-xs text-muted-foreground">
            activo: <span className="text-foreground">{PINS[isPinId(activePin) ? activePin : DEFAULT_PIN].emoji} {PINS[isPinId(activePin) ? activePin : DEFAULT_PIN].name}</span>
          </span>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          El pin que elijas es el que ven tus amigos y queda en tus reportes. Se desbloquean completando desafíos.
        </p>
        <div className="grid grid-cols-5 gap-2 mt-2">
          {Object.values(PINS).map((pin) => {
            const open = unlockedPins.has(pin.id);
            const active = activePin === pin.id;
            return (
              <button
                key={pin.id}
                onClick={() => void selectPin(pin.id)}
                disabled={!open || savingPin !== null}
                title={open ? `${pin.name} — ${pin.desc}` : `Bloqueado: ${pin.desc}`}
                className={`relative rounded-lg border p-2 flex flex-col items-center gap-1 transition-colors ${
                  active
                    ? "border-emerald-400 bg-emerald-950/60"
                    : open
                      ? "border-border bg-background hover:border-emerald-600"
                      : "border-border bg-background/40 opacity-60"
                }`}
              >
                <span className="text-2xl" aria-hidden>{open ? pin.emoji : "🔒"}</span>
                <span className={`text-[9px] leading-tight text-center ${active ? "text-emerald-700 dark:text-emerald-300 font-semibold" : "text-muted-foreground"}`}>{pin.name}</span>
                {active && <CheckCircle2 className="absolute -top-1.5 -right-1.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
