"use client";

// ============================================================
// Componentes reutilizables del rediseño: etiqueta de plan,
// estados PRO y modal contextual de bloqueo.
// Misma identidad visual en toda la app (brief §6).
// ============================================================

import { Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRO_LOCK_COPY, type ProLockFeature } from "@/lib/planData";
import { PRO_PRICE_LABEL } from "@/lib/proConfig";

/** Etiqueta compacta del plan actual (header). */
export function PlanPill({ pro, onClick }: { pro: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={pro ? "Plan Pro activo - ver beneficios" : "Plan gratis - ver planes"}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] font-extrabold tracking-wide transition-colors ${
        pro
          ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
          : "border-border bg-card text-muted-foreground hover:border-emerald-500/50 hover:text-foreground"
      }`}
    >
      {pro && <Crown className="h-3 w-3" />}
      {pro ? "PRO" : "FREE"}
    </button>
  );
}

/** Igual que PlanPill pero no interactiva: para usar DENTRO de otro
 *  botón (el HTML no permite button anidados). */
export function PlanBadge({ pro }: { pro: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] font-extrabold tracking-wide ${
        pro
          ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      {pro && <Crown className="h-3 w-3" />}
      {pro ? "PRO" : "FREE"}
    </span>
  );
}

/** Sello PRO para funciones bloqueadas: discreto, sin "bloqueada". */
export function ProTag({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
      <Lock className="h-2.5 w-2.5" />
      {label ?? "PRO"}
    </span>
  );
}

/** Tarjeta promo del menú lateral (solo FREE). */
export function ProPromoCard({ onDiscover }: { onDiscover: () => void }) {
  return (
    <div className="rounded-xl border border-emerald-600/40 bg-gradient-to-br from-emerald-600/15 to-emerald-800/25 p-4">
      <div className="mb-2 inline-flex items-center gap-1.5 rounded bg-emerald-400 px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-emerald-950">
        <Crown className="h-3 w-3" /> CUMBRE30 PRO
      </div>
      <p className="text-[13px] leading-relaxed text-foreground">
        Planifica mejor tus rutas y desbloquea herramientas avanzadas para tus subidas.
      </p>
      <Button onClick={onDiscover} className="mt-3 h-10 w-full rounded-lg bg-emerald-600 text-[13px] font-bold text-zinc-950 hover:bg-emerald-500">
        Descubrir PRO
      </Button>
    </div>
  );
}

/** Modal contextual de función Pro: explica el beneficio, muestra la
 *  diferencia con FREE y deja seguir gratis. No bloquea nada básico. */
export function ProContextModal({
  feature,
  onClose,
  onDiscover,
}: {
  feature: ProLockFeature | null;
  onClose: () => void;
  onDiscover: () => void;
}) {
  if (!feature) return null;
  const copy = PRO_LOCK_COPY[feature];
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 pb-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-emerald-600/40 bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <Lock className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-bold leading-snug tracking-tight text-foreground">{copy.title}</h2>
            <p className="text-xs text-muted-foreground">Función de Cumbre30 Pro</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            ✕
          </button>
        </div>

        <p className="mt-3 text-[13.5px] leading-relaxed text-foreground">{copy.body}</p>

        <div className="mt-3 flex gap-2.5 rounded-xl border border-border bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
          <span>
            <b className="text-foreground">En FREE</b> {copy.free}
          </span>
        </div>

        <Button onClick={onDiscover} className="mt-4 h-12 w-full rounded-xl bg-emerald-600 text-[15px] font-bold text-zinc-950 hover:bg-emerald-500">
          <Crown className="h-4 w-4" /> Descubrir PRO · {PRO_PRICE_LABEL}
        </Button>
        <button onClick={onClose} className="mt-1 h-10 w-full rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground">
          Ahora no, seguir usando la app
        </button>
      </div>
    </div>
  );
}
