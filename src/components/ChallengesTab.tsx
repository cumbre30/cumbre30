"use client";

// ============================================================
// Desafíos y logros: series con avance SECUENCIAL (cada nivel
 // se activa al completar el anterior) + retos puntuales.
// Recompensas: pines personalizables para el mapa.
// ============================================================

import { useMemo, useState } from "react";
import { CheckCircle2, Lock, MapPin, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { historyStore } from "@/lib/history";
import {
  ACHIEVEMENT_BY_CODE,
  DEFAULT_PIN,
  PINS,
  RETOS,
  SERIES,
  evaluateAchievements,
  isPinId,
  metricValue,
  normalizeCodes,
  statsFromRides,
  type AchievementStats,
  type Tier,
} from "@/lib/pins";
import { useMe, refreshMe } from "@/hooks/useMe";
import { loadLocalIncidentCount } from "@/lib/localIncidents";

function ProgressBar({ pct, accent = "bg-emerald-500" }: { pct: number; accent?: string }) {
  return (
    <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
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

export default function ChallengesTab() {
  const { me } = useMe();
  const localRides = historyStore.get();
  const [savingPin, setSavingPin] = useState<string | null>(null);

  const localStats = useMemo(
    () => statsFromRides(localRides, loadLocalIncidentCount()),
     
    [localRides.length]
  );

  // Desbloqueados: sesión (servidor, con compat v1) o evaluación local.
  const unlocked = useMemo(() => {
    if (me) return normalizeCodes(me.achievements.map((a) => a.code));
    return new Set(evaluateAchievements(localStats));
     
  }, [me, localStats]);

  const stats: AchievementStats = me
    ? {
        totalKm: me.stats.totalKm,
        rideCount: me.stats.rideCount,
        maxKmh: me.stats.maxKmh,
        totalGainM: me.stats.totalGainM,
        parkRides: me.stats.parkRides,
        cleanParkRides: me.stats.cleanParkRides,
        nightRides: me.stats.nightRides,
        dawnRides: me.stats.dawnRides,
        incidentCount: me.stats.incidentCount,
      }
    : localStats;

  const unlockedPins = useMemo(() => {
    const set = new Set<string>([DEFAULT_PIN]);
    for (const code of unlocked) {
      const def = ACHIEVEMENT_BY_CODE[code];
      if (def) set.add(def.reward);
    }
    return set;
  }, [unlocked]);

  const activePin = (me?.user.selectedPin as string) ?? DEFAULT_PIN;

  const selectPin = async (pinId: string) => {
    if (!me || !unlockedPins.has(pinId) || !isPinId(pinId)) return;
    setSavingPin(pinId);
    try {
      await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedPin: pinId }),
      });
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
      <div key={t.code} className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 ${state === "current" ? "bg-zinc-900/90 border border-zinc-700" : ""}`}>
        <span className="text-xl leading-none mt-0.5 shrink-0" aria-hidden>
          {state === "done" ? reward.emoji : state === "current" ? <span className="inline-block text-2xl grayscale opacity-70">{reward.emoji}</span> : <Lock className="h-4.5 w-4.5 text-zinc-600 mt-1" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium truncate ${state === "done" ? "text-zinc-400 line-through" : state === "current" ? "text-zinc-100" : "text-zinc-500"}`}>{t.name}</p>
            {state === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
            {state === "current" && <span className="text-[10px] text-zinc-500 shrink-0">recompensa: {reward.emoji} {reward.name}</span>}
          </div>
          <p className={`text-[11px] mt-0.5 ${state === "locked" ? "text-zinc-600" : "text-zinc-500"}`}>{t.desc}</p>
          {state === "current" && (
            <div className="mt-1.5">
              <ProgressBar pct={pct} accent={ACCENT_BAR[accent] ?? "bg-emerald-500"} />
              <p className="text-[10px] text-zinc-600 mt-1">
                {pct}% · {t.metric === "totalGainM" || t.metric === "totalKm" ? `${Math.round(val).toLocaleString("es-CL")}` : val.toLocaleString("es-CL")} / {t.goal.toLocaleString("es-CL")}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-zinc-900/80 border-zinc-800 p-4">
        <div className="flex items-start gap-3">
          <Trophy className="h-5 w-5 text-amber-400 mt-0.5" />
          <div className="text-sm text-zinc-400">
            <p className="font-medium text-zinc-200">Desafíos y logros</p>
            <p className="mt-1 leading-relaxed">
              Cada serie avanza <span className="text-emerald-300">nivel a nivel</span>: completas uno y se activa el
              siguiente. Gana <span className="text-emerald-300">pines personalizables</span> para tu posición en el
              mapa; tus amigos y quienes vean tus reportes verán tu pin activo.
            </p>
            {!me && <p className="mt-1 text-[11px] text-amber-300/80">Sin sesión el progreso se guarda solo en este dispositivo.</p>}
          </div>
        </div>
      </Card>

      {/* Series secuenciales */}
      {SERIES.map((s) => {
        const done = s.tiers.filter((t) => unlocked.has(t.code)).length;
        const currentIdx = Math.min(done, s.tiers.length - 1);
        const complete = done === s.tiers.length;
        return (
          <div key={s.id} className={`rounded-xl border p-4 ${complete ? "border-emerald-700/60 bg-emerald-950/20" : "border-zinc-800 bg-zinc-900/60"}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl" aria-hidden>{s.emoji}</span>
              <p className="font-semibold text-sm text-zinc-200">{s.name}</p>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border ${complete ? "border-emerald-600 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>
                {done}/{s.tiers.length} {complete ? "· completa" : ""}
              </span>
            </div>
            <div className="flex gap-1 mb-2" aria-hidden>
              {s.tiers.map((t, i) => (
                <div key={t.code} className={`h-1.5 flex-1 rounded-full ${unlocked.has(t.code) ? ACCENT_BAR[s.accent] ?? "bg-emerald-500" : "bg-zinc-800"}`} />
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

      {/* Retos puntuales */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl" aria-hidden>🎯</span>
          <p className="font-semibold text-sm text-zinc-200">Retos puntuales</p>
          <span className="ml-auto text-xs text-zinc-500">disponibles siempre</span>
        </div>
        <div className="space-y-1">
          {RETOS.map((t) => tierRow(t, unlocked.has(t.code) ? "done" : "current", "emerald"))}
        </div>
      </div>

      {/* Pines */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-4 w-4 text-emerald-400" />
          <p className="text-sm font-medium text-zinc-200">Tu pin en el mapa</p>
          <span className="ml-auto text-xs text-zinc-500">
            activo: <span className="text-zinc-200">{PINS[isPinId(activePin) ? activePin : DEFAULT_PIN].emoji} {PINS[isPinId(activePin) ? activePin : DEFAULT_PIN].name}</span>
          </span>
        </div>
        {!me && <p className="text-[11px] text-amber-300/80 mb-2">Inicia sesión en Perfil para activar los pines que desbloquees.</p>}
        <div className="grid grid-cols-5 gap-2 mt-2">
          {Object.values(PINS).map((pin) => {
            const open = unlockedPins.has(pin.id);
            const active = activePin === pin.id;
            return (
              <button
                key={pin.id}
                onClick={() => void selectPin(pin.id)}
                disabled={!open || !me || savingPin !== null}
                title={open ? `${pin.name} — ${pin.desc}` : `Bloqueado: ${pin.desc}`}
                className={`relative rounded-lg border p-2 flex flex-col items-center gap-1 transition-colors ${
                  active
                    ? "border-emerald-400 bg-emerald-950/60"
                    : open
                      ? "border-zinc-700 bg-zinc-950 hover:border-emerald-600"
                      : "border-zinc-800 bg-zinc-950/40 opacity-60"
                }`}
              >
                <span className="text-2xl" aria-hidden>{open ? pin.emoji : "🔒"}</span>
                <span className={`text-[9px] leading-tight text-center ${active ? "text-emerald-300 font-semibold" : "text-zinc-400"}`}>{pin.name}</span>
                {active && <CheckCircle2 className="absolute -top-1.5 -right-1.5 h-4 w-4 text-emerald-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {!me && (
        <Button variant="outline" className="border-zinc-800 text-zinc-400" onClick={() => historyStore.refresh()}>
          Actualizar progreso local
        </Button>
      )}
    </div>
  );
}
