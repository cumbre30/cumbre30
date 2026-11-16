"use client";

// ============================================================
// Planes - comparación FREE vs PRO.
// La compra NO ocurre desde aquí (Google Play lo prohíbe para
// funciones digitales): el pago vive en la web oficial /pro o en
// Google Play Billing (build Play, dentro de Pagos y suscripciones).
// Tabla validada contra el código (planData.ts, claves i18n plan.*).
// ============================================================

import { Check, Crown, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PLAN_ROWS } from "@/lib/planData";
import { IS_PLAY_BUILD, PRO_PLAY_PRICE_LABEL, PRO_PRICE_LABEL } from "@/lib/proConfig";
import { useProLicense } from "@/lib/proLicense";
import { t, useLang } from "@/lib/i18n";

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check className="mx-auto h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" aria-label={t("ride.statSi")} />;
  if (v === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label={t("ride.statNo")} />;
  return <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">{t(v)}</span>;
}

export function PlanesTab() {
  const lang = useLang(); // re-render al cambiar el idioma
  const { pro } = useProLicense();
  const priceLabel = (IS_PLAY_BUILD ? PRO_PLAY_PRICE_LABEL : PRO_PRICE_LABEL).split("·")[0].trim();

  return (
    <div className="flex flex-col gap-4">
      {/* Hero */}
      {pro.active ? (
        <Card className="flex items-center gap-3 border-emerald-600/40 bg-emerald-500/10 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-emerald-50">
            <Crown className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-foreground">{t("plan.proActivo")}</p>
            <p className="text-xs text-muted-foreground">{t("plan.proActivoSub")}</p>
          </div>
        </Card>
      ) : (
      <div className="rounded-2xl border border-emerald-600/40 bg-gradient-to-b from-emerald-600/15 to-emerald-800/25 p-5 text-center">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded bg-emerald-400 px-2.5 py-1 text-[10.5px] font-extrabold tracking-widest text-emerald-950">
          <Crown className="h-3.5 w-3.5" /> CUMBRE30 PRO
        </div>
        <p className="text-4xl font-extrabold tracking-tight text-foreground">{priceLabel}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("plan.heroSub")}</p>

        {/* Cómo obtener PRO - sin links externos (requisito Play):
            el pago ocurre en la web /pro o en Google Play Billing,
            la activación del código es local y offline. */}
        <div className="mt-4 rounded-xl border border-border bg-background/60 p-3 text-left text-[12.5px] leading-relaxed text-muted-foreground">
          {IS_PLAY_BUILD ? (
            <p>
              {t("plan.play1")}
              <b className="text-foreground">Google Play</b>
              {t("plan.play2")}
              <b className="text-foreground">{t("plan.perfilPagos")}</b>
              {t("plan.play3")}
              <b className="text-foreground">{t("plan.playCodWeb")}</b>
              {t("plan.play4")}
            </p>
          ) : (
            <>
              <p>
                <b className="text-foreground">1.</b> {t("plan.paso1")}
                <b className="text-foreground">www.cumbregeo.cl</b>
              </p>
              <p className="mt-1">
                <b className="text-foreground">2.</b> {t("plan.paso2")}
                <span className="font-mono text-foreground/90">C30P-XXXX-…</span>
              </p>
              <p className="mt-1">
                <b className="text-foreground">3.</b> {t("plan.paso3")}
                <b className="text-foreground">{t("plan.perfilPagos")}</b>
                {t("plan.paso3b")}
              </p>
            </>
          )}
        </div>
      </div>
      )}

      {/* Tabla comparativa */}
      <Card className="overflow-hidden p-0">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-muted/70">
              <th className="px-3 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("plan.thFuncion")}</th>
              <th className="px-2 py-2.5 text-center text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">FREE</th>
              <th className="px-2 py-2.5 text-center text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">PRO</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_ROWS.map((r, i) => (
              <tr key={r.feature} className={i % 2 ? "bg-background/40" : ""}>
                <td className="px-3 py-2.5 pr-2 font-medium text-muted-foreground">{t(r.feature)}</td>
                <td className="px-2 py-2.5 text-center text-foreground">{<Cell v={r.free} />}</td>
                <td className="px-2 py-2.5 text-center text-foreground">{<Cell v={r.pro} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-center text-[11.5px] leading-relaxed text-muted-foreground">
        {t("plan.yaPagaste1")}
        <b className="text-foreground">{t("pf.subPagos")}</b>
        {t("plan.yaPagaste2")}
      </p>
    </div>
  );
}
