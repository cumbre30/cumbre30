"use client";

// ============================================================
// Componentes reutilizables del rediseño: etiqueta de plan,
// estados PRO y modal contextual de bloqueo.
// Misma identidad visual en toda la app (brief §6).
// Textos vía i18n (claves p.* en src/lib/i18n.ts).
// ============================================================

import { Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRO_LOCK_COPY, type ProLockFeature } from "@/lib/planData";
import { PRO_PRICE_LABEL } from "@/lib/proConfig";
import { t, useLang } from "@/lib/i18n";

/** Etiqueta compacta del plan actual (header). */
export function PlanPill({ pro, onClick }: { pro: boolean; onClick?: () => void }) {
  const lang = useLang(); // re-render al cambiar el idioma
  return (
    <button
      onClick={onClick}
      aria-label={pro ? t("p.planProAria") : t("p.planFreeAria")}
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
  const lang = useLang(); // re-render al cambiar el idioma
  return (
    <div className="rounded-xl border border-emerald-600/40 bg-emerald-600/10 p-4">
      <div className="mb-2 inline-flex items-center gap-1.5 rounded bg-emerald-400 px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-emerald-950">
        <Crown className="h-3 w-3" /> CUMBRE30 PRO
      </div>
      <p className="text-[13px] leading-relaxed text-foreground">
        {t("p.promoBody")}
      </p>
      <Button onClick={onDiscover} className="mt-3 h-10 w-full rounded-lg bg-emerald-600 text-[13px] font-bold text-(--c30-on-accent) hover:bg-emerald-500">
        {t("p.descubrir")}
      </Button>
    </div>
  );
}

/** Modal contextual de función Pro: explica el beneficio, muestra la
 *  diferencia con FREE y deja seguir gratis. No bloquea nada básico.
 *  PRO_LOCK_COPY trae claves i18n (planData) que se pintan con t(). */
export function ProContextModal({
  feature,
  onClose,
  onDiscover,
}: {
  feature: ProLockFeature | null;
  onClose: () => void;
  onDiscover: () => void;
}) {
  const lang = useLang(); // re-render al cambiar el idioma
  if (!feature) return null;
  const copy = PRO_LOCK_COPY[feature];
  return (
    <div
      className="fixed inset-0 z-[900] flex items-end justify-center bg-black/60 p-4 pb-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t(copy.title)}
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
            <h2 className="text-[17px] font-bold leading-snug tracking-tight text-foreground">{t(copy.title)}</h2>
            <p className="text-xs text-muted-foreground">{t("p.funcionPro")}</p>
          </div>
          <button onClick={onClose} aria-label={t("p.cerrar")} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            ✕
          </button>
        </div>

        <p className="mt-3 text-[13.5px] leading-relaxed text-foreground">{t(copy.body)}</p>

        <div className="mt-3 flex gap-2.5 rounded-xl border border-border bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
          <span>
            <b className="text-foreground">{t("p.enFree")}</b> {t(copy.free)}
          </span>
        </div>

        <Button onClick={onDiscover} className="mt-4 h-12 w-full rounded-xl bg-emerald-600 text-[15px] font-bold text-(--c30-on-accent) hover:bg-emerald-500">
          <Crown className="h-4 w-4" /> {t("p.descubrirPrecio", PRO_PRICE_LABEL)}
        </Button>
        <button onClick={onClose} className="mt-1 h-10 w-full rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground">
          {t("p.ahoraNo")}
        </button>
      </div>
    </div>
  );
}
