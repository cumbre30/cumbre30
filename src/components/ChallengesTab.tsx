"use client";

// ============================================================
// Desafíos y logros: progreso por desafío y recompensas en
// pines personalizables para el mapa (visibles para amigos).
// ============================================================

import { useMemo, useState } from "react";
import { Lock, MapPin, Trophy, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { historyStore } from "@/lib/history";
import { ACHIEVEMENTS, PINS, DEFAULT_PIN, evaluateAchievements, isPinId, statsFromRides, type PinId } from "@/lib/pins";
import { useMe, refreshMe } from "@/hooks/useMe";
import { loadLocalIncidentCount } from "@/lib/localIncidents";

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export default function ChallengesTab() {
  const { me } = useMe();
  const localRides = historyStore.get(); // store externo: se actualiza con refresh() tras cada ride
  const [savingPin, setSavingPin] = useState<string | null>(null);

  // Progreso: con sesión usa las estadísticas del servidor; si no, locales.
  const localStats = useMemo(
    () => statsFromRides(localRides, loadLocalIncidentCount()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localRides.length]
  );

  const serverUnlocked = new Set(me?.achievements.map((a) => a.code) ?? []);
  const localCodes = evaluateAchievements(localStats);
  const unlocked = me ? serverUnlocked : new Set(localCodes);

  const totalKm = me ? me.stats.totalKm : localStats.totalKm;
  const incidentCount = me ? me.stats.incidentCount : localStats.incidentCount;
  const maxGain = me ? me.stats.totalGainM : localStats.maxGainM;
  const maxKmh = me ? me.stats.maxKmh : localStats.maxKmh;
  const rideCount = me ? me.stats.rideCount : localStats.rideCount;

  const progressOf = (code: string): number => {
    switch (code) {
      case "primer_pedaleo": return rideCount >= 1 ? 100 : 0;
      case "trebol_25": return Math.round((totalKm / 25) * 100);
      case "corona_100": return Math.round((totalKm / 100) * 100);
      case "cumbre": return Math.round((maxGain / 150) * 100);
      case "ride_limpio": return serverUnlocked.has("ride_limpio") || localCodes.includes("ride_limpio") ? 100 : 35;
      case "nocturno": return serverUnlocked.has("nocturno") || localCodes.includes("nocturno") ? 100 : 0;
      case "velocista": return Math.round((maxKmh / 40) * 100);
      case "reportero": return incidentCount >= 1 ? 100 : 0;
      default: return 0;
    }
  };

  const unlockedPins = useMemo(() => {
    const set = new Set<string>([DEFAULT_PIN]);
    for (const a of ACHIEVEMENTS) {
      if (unlocked.has(a.code)) set.add(a.reward);
    }
    return set;
  }, [unlocked]);

  const activePin = (me?.user.selectedPin as PinId) ?? DEFAULT_PIN;

  const selectPin = async (pinId: PinId) => {
    if (!me || !unlockedPins.has(pinId)) return;
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

  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-zinc-900/80 border-zinc-800 p-4">
        <div className="flex items-start gap-3">
          <Trophy className="h-5 w-5 text-amber-400 mt-0.5" />
          <div className="text-sm text-zinc-400">
            <p className="font-medium text-zinc-200">Desafíos y logros</p>
            <p className="mt-1 leading-relaxed">
              Completa desafíos pedaleando y gana <span className="text-emerald-300">pines personalizables</span> para tu
              posición en el mapa. Tus amigos y quienes vean tus reportes verán tu pin activo.
            </p>
          </div>
        </div>
      </Card>

      {/* Pines */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-4 w-4 text-emerald-400" />
          <p className="text-sm font-medium text-zinc-200">Tu pin en el mapa</p>
          <span className="ml-auto text-xs text-zinc-500">
            activo: <span className="text-zinc-200">{PINS[activePin].emoji} {PINS[activePin].name}</span>
          </span>
        </div>
        {!me && <p className="text-[11px] text-amber-300/80 mb-2">Inicia sesión en Perfil para activar los pines que desbloquees.</p>}
        <div className="grid grid-cols-4 gap-2 mt-2">
          {Object.values(PINS).map((p) => {
            const open = unlockedPins.has(p.id);
            const active = activePin === p.id;
            return (
              <button
                key={p.id}
                onClick={() => void selectPin(p.id)}
                disabled={!open || !me || savingPin !== null}
                title={open ? `${p.name} — ${p.desc}` : `Bloqueado: ${p.desc}`}
                className={`relative rounded-lg border p-2 flex flex-col items-center gap-1 transition-colors ${
                  active
                    ? "border-emerald-400 bg-emerald-950/60"
                    : open
                      ? "border-zinc-700 bg-zinc-950 hover:border-emerald-600"
                      : "border-zinc-800 bg-zinc-950/40 opacity-60"
                }`}
              >
                <span className="text-2xl" aria-hidden>{open ? p.emoji : "🔒"}</span>
                <span className={`text-[10px] leading-tight text-center ${active ? "text-emerald-300 font-semibold" : "text-zinc-400"}`}>{p.name}</span>
                {active && <CheckCircle2 className="absolute -top-1.5 -right-1.5 h-4 w-4 text-emerald-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de desafíos */}
      <div className="grid gap-2.5">
        {ACHIEVEMENTS.map((a) => {
          const open = unlocked.has(a.code);
          const pct = Math.min(100, progressOf(a.code));
          const reward = PINS[a.reward];
          return (
            <div key={a.code} className={`rounded-xl border p-3.5 ${open ? "border-emerald-700/70 bg-emerald-950/30" : "border-zinc-800 bg-zinc-900/60"}`}>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl shrink-0" aria-hidden>{open ? reward.emoji : <Lock className="h-5 w-5 text-zinc-600" />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold text-sm truncate ${open ? "text-emerald-300" : "text-zinc-200"}`}>{a.name}</p>
                    <span className="text-[10px] text-zinc-500 shrink-0">recompensa: {reward.emoji} {reward.name}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{a.desc}</p>
                </div>
                {open && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />}
              </div>
              {!open && pct > 0 && (
                <div className="mt-2">
                  <ProgressBar pct={pct} />
                  <p className="text-[10px] text-zinc-600 mt-1">{pct}%</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!me && (
        <Button
          variant="outline"
          className="border-zinc-800 text-zinc-400"
          onClick={() => historyStore.refresh()}
        >
          Actualizar progreso local
        </Button>
      )}
    </div>
  );
}

export function pinIsValid(p: string): boolean {
  return isPinId(p);
}
