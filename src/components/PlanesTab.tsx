"use client";

// ============================================================
// Planes — comparación FREE vs PRO (brief §4-D).
// Tabla validada contra el código (planData.ts). Pago único por
// Mercado Pago; activación offline por código en Pagos y suscripciones.
// ============================================================

import { useState } from "react";
import { Check, Crown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PLAN_ROWS } from "@/lib/planData";
import { PRO_PAY_URL, PRO_PRICE_LABEL, openExternal } from "@/lib/proConfig";
import { useProLicense } from "@/lib/proLicense";

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check className="mx-auto h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" aria-label="Sí" />;
  if (v === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label="No" />;
  return <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">{v}</span>;
}

export function PlanesTab() {
  const { pro, deactivate } = useProLicense();
  const [msg, setMsg] = useState<string | null>(null);

  const buy = async () => {
    await openExternal(PRO_PAY_URL);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Hero */}
      {pro.active ? (
        <Card className="flex items-center gap-3 border-emerald-600/40 bg-emerald-500/10 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-emerald-50">
            <Crown className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-foreground">Cumbre30 Pro activo</p>
            <p className="text-xs text-muted-foreground">Pago único · todas las funciones desbloqueadas</p>
          </div>
        </Card>
      ) : (
        <div className="rounded-2xl border border-emerald-600/40 bg-gradient-to-b from-emerald-600/15 to-emerald-800/25 p-5 text-center">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded bg-emerald-400 px-2.5 py-1 text-[10.5px] font-extrabold tracking-widest text-emerald-950">
            <Crown className="h-3.5 w-3.5" /> CUMBRE30 PRO
          </div>
          <p className="text-4xl font-extrabold tracking-tight text-foreground">{PRO_PRICE_LABEL.split("·")[0].trim()}</p>
          <p className="mt-1 text-sm text-muted-foreground">pago único · sin suscripción · para siempre</p>
          <Button onClick={buy} className="mt-4 h-[52px] w-full rounded-xl bg-emerald-600 text-base font-bold text-zinc-950 hover:bg-emerald-500">
            Obtener PRO
          </Button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Pagas en Mercado Pago y recibes un código por correo. Lo activas en Pagos y suscripciones — funciona 100% sin internet.
          </p>
        </div>
      )}

      {/* Tabla comparativa */}
      <Card className="overflow-hidden p-0">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-muted/70">
              <th className="px-3 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Función</th>
              <th className="px-2 py-2.5 text-center text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">FREE</th>
              <th className="px-2 py-2.5 text-center text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">PRO</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_ROWS.map((r, i) => (
              <tr key={r.feature} className={i % 2 ? "bg-background/40" : ""}>
                <td className="px-3 py-2.5 pr-2 font-medium text-muted-foreground">{r.feature}</td>
                <td className="px-2 py-2.5 text-center text-foreground">{<Cell v={r.free} />}</td>
                <td className="px-2 py-2.5 text-center text-foreground">{<Cell v={r.pro} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {pro.active ? (
        <div>
          <Button
            variant="outline"
            onClick={() => {
              deactivate();
              setMsg("Licencia quitada de este teléfono. Puedes reactivarla con tu código en Pagos y suscripciones.");
              setTimeout(() => setMsg(null), 8000);
            }}
            className="h-11 w-full rounded-xl border-border text-muted-foreground hover:text-foreground"
          >
            Quitar licencia de este teléfono
          </Button>
          {msg && <p className="mt-2 text-center text-xs text-emerald-600 dark:text-emerald-400">{msg}</p>}
        </div>
      ) : (
        <p className="text-center text-[11.5px] leading-relaxed text-muted-foreground">
          ¿Ya pagaste? Activa tu código en <b className="text-foreground">Pagos y suscripciones</b> (menú lateral).
        </p>
      )}
    </div>
  );
}
