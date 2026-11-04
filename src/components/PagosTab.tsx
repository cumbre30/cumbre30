"use client";

// ============================================================
// Pagos y suscripciones — menú lateral (brief: sección bajo Cuenta).
// Dentro vive únicamente:
//   · La casilla para habilitar el modo Pro: ingresar código + validar.
//   · El aporte voluntario (Mercado Pago), movido desde Perfil.
// La comparativa de planes sigue en "Planes"; comprar es parte de
// Planes y del menú lateral (tarjeta PRO).
// ============================================================

import { useState } from "react";
import { BadgeCheck, ChevronDown, Crown, HeartHandshake, KeyRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useProLicense } from "@/lib/proLicense";
import { DONATE_OPTIONS, PRO_PRICE_LABEL, openExternal } from "@/lib/proConfig";

export function PagosTab() {
  const { pro, activate, deactivate } = useProLicense();
  const [enabled, setEnabled] = useState(false); // casilla "Habilitar modo Pro"
  const [proEmail, setProEmail] = useState("");
  const [proCode, setProCode] = useState("");
  const [proBusy, setProBusy] = useState(false);
  const [proMsg, setProMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const activatePro = async () => {
    setProBusy(true);
    setProMsg(null);
    const res = await activate(proEmail, proCode);
    setProBusy(false);
    setProMsg(
      res.ok
        ? { ok: true, text: "¡Cumbre30 Pro activado! Gracias por apoyar el proyecto." }
        : { ok: false, text: res.error ?? "No pudimos validar el código." }
    );
    if (res.ok) {
      setProCode("");
      setEnabled(false);
    }
    setTimeout(() => setProMsg(null), 9000);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Modo Pro: casilla + código + validar ---- */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-start gap-3">
          <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">Modo Cumbre30 Pro</p>
              {pro.active && (
                <Badge className="border border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  PRO ACTIVO
                </Badge>
              )}
            </div>

            {pro.active ? (
              <>
                <p className="mt-1.5 leading-relaxed text-muted-foreground">
                  Activo con <span className="font-medium text-foreground">{pro.email}</span>. ¡Gracias por apoyar
                  el proyecto! Tienes constancias PDF ilimitadas y export GPX en cada viaje con GPS.
                </p>
                <button
                  onClick={() => {
                    deactivate();
                    setProMsg({ ok: true, text: "Licencia quitada de este teléfono." });
                    setTimeout(() => setProMsg(null), 6000);
                  }}
                  className="mt-2 text-[11px] text-muted-foreground underline hover:text-foreground"
                >
                  Quitar licencia de este teléfono
                </button>
              </>
            ) : (
              <>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  Pago único de <span className="font-semibold text-foreground">{PRO_PRICE_LABEL}</span>. Si ya
                  pagaste, habilita el modo Pro aquí con el código que te llegó por correo.
                </p>

                {/* Casilla para habilitar el modo Pro */}
                <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-background/60 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => {
                      setEnabled(e.target.checked);
                      setProMsg(null);
                    }}
                    className="h-4.5 w-4.5 accent-emerald-600"
                    aria-label="Habilitar modo Pro"
                  />
                  <span className="flex-1 text-[13.5px] font-semibold text-foreground">
                    Habilitar modo Pro
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      Ingresar código de licencia y validar
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${enabled ? "rotate-180" : ""}`}
                  />
                </label>

                {enabled && (
                  <div className="mt-3 grid gap-2">
                    <Input
                      type="email"
                      placeholder="correo con el que pagaste"
                      aria-label="Correo con el que pagaste"
                      value={proEmail}
                      onChange={(e) => setProEmail(e.target.value)}
                      className="border-border bg-card"
                    />
                    <Input
                      placeholder="código C30P-XXXX-XXXX-XXXX-XXXX"
                      aria-label="Código de licencia"
                      value={proCode}
                      onChange={(e) => setProCode(e.target.value.toUpperCase())}
                      className="border-border bg-card font-mono"
                    />
                    <Button
                      onClick={activatePro}
                      disabled={proBusy || !proEmail || !proCode}
                      className="h-10 bg-emerald-600 font-semibold text-zinc-950 hover:bg-emerald-500"
                    >
                      {proBusy ? "Validando…" : "Validar código"}
                    </Button>
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <KeyRound className="h-3 w-3" /> Se valida sin internet y queda guardado en este teléfono.
                    </p>
                  </div>
                )}
              </>
            )}
            {proMsg && (
              <p
                className={`mt-2 text-xs ${proMsg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`}
                role="status"
              >
                {proMsg.text}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* ---- Aporte voluntario (movido desde Perfil) ---- */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-start gap-3">
          <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-pink-600 dark:text-pink-400" />
          <div className="text-sm flex-1">
            <p className="font-medium text-foreground">Aporte voluntario</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              Cumbre30 es gratis, sin publicidad y hecha en Chile. Tu aporte financia los mapas, los avisos
              de voz y las próximas funciones. ¡Cualquier monto ayuda!
            </p>
            <div className="mt-3 flex gap-2">
              {DONATE_OPTIONS.map((o) => (
                <Button
                  key={o.label}
                  variant="outline"
                  disabled={!o.url}
                  onClick={() => void openExternal(o.url)}
                  className="h-10 flex-1 border-border text-foreground"
                >
                  {o.label}
                </Button>
              ))}
            </div>
            {DONATE_OPTIONS.every((o) => !o.url) && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                El link de Mercado Pago se está configurando — estará disponible en breve.
              </p>
            )}
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <BadgeCheck className="h-3.5 w-3.5" /> Pago seguro vía Mercado Pago.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
