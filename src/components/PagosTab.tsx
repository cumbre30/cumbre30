"use client";

// ============================================================
// Pagos y suscripciones - subsección dentro de Perfil (PerfilTab),
// porque la licencia Pro va atada al correo de la cuenta.
//
// Sin links externos de pago (requisito Google Play): aquí vive
//   · Build Play: botón de compra con Google Play Billing
//     (producto único cumbre30_pro, comisión 15%).
//   · Siempre: la casilla para activar un código C30P-… que el
//     usuario recibió por correo tras pagar en la web oficial.
// El aporte voluntario vive SOLO en la página web /pro.
// ============================================================

import { useEffect, useState } from "react";
import { AtSign, ChevronDown, Crown, KeyRound, Play, RefreshCw } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMe } from "@/hooks/useMe";
import { useProLicense } from "@/lib/proLicense";
import { IS_PLAY_BUILD, PRO_PLAY_PRICE_LABEL, PRO_PLAY_PRODUCT_ID, PRO_PRICE_LABEL } from "@/lib/proConfig";
import {
  buyPlayPro,
  initPlayBilling,
  playBillingAvailable,
  playProPrice,
  restorePlayPro,
} from "@/lib/playBilling";

export function PagosTab() {
  const { pro, activate, deactivate } = useProLicense();
  const { me } = useMe(); // con sesión, el correo de validación es el de la cuenta
  const [enabled, setEnabled] = useState(false); // casilla "Habilitar modo Pro"
  const [proEmail, setProEmail] = useState("");
  const [proCode, setProCode] = useState("");
  const [proBusy, setProBusy] = useState(false);
  const [proMsg, setProMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ---- Play Billing (solo build Play en Android) ----
  const canPlay = IS_PLAY_BUILD && Capacitor.isNativePlatform();
  const [playReady, setPlayReady] = useState(false);
  const [playPrice, setPlayPrice] = useState<string | null>(null);
  const [playBusy, setPlayBusy] = useState(false);
  const [playMsg, setPlayMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!canPlay) return;
    let alive = true;
    void initPlayBilling(PRO_PLAY_PRODUCT_ID, () => undefined).then((res) => {
      if (!alive) return;
      setPlayReady(res.ok);
      setPlayPrice(playProPrice());
    });
    return () => {
      alive = false;
    };
  }, [canPlay]);

  const activatePro = async () => {
    setProBusy(true);
    setProMsg(null);
    const res = await activate(me?.user.email ?? proEmail, proCode);
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

  const buy = async () => {
    setPlayBusy(true);
    setPlayMsg(null);
    const err = await buyPlayPro(PRO_PLAY_PRODUCT_ID);
    setPlayBusy(false);
    if (err) setPlayMsg({ ok: false, text: err });
    setTimeout(() => setPlayMsg(null), 9000);
  };

  const restore = async () => {
    setPlayBusy(true);
    setPlayMsg(null);
    const err = await restorePlayPro(PRO_PLAY_PRODUCT_ID, () => undefined);
    setPlayBusy(false);
    setPlayMsg(err ? { ok: false, text: err } : { ok: true, text: "¡Compra restaurada! Pro activo en este teléfono." });
    setTimeout(() => setPlayMsg(null), 9000);
  };

  const shownPlayPrice = playPrice ?? PRO_PLAY_PRICE_LABEL.split("·")[0].trim();

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Compra con Google Play Billing (solo build Play) ---- */}
      {canPlay && !pro.active && (
        <Card className="border-emerald-600/40 bg-emerald-500/10 p-4">
          <div className="flex items-start gap-3">
            <Play className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-sm flex-1 min-w-0">
              <p className="font-medium text-foreground">Comprar Cumbre30 Pro</p>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                Pago único de <span className="font-semibold text-foreground">{shownPlayPrice}</span>, se cobra a tu
                cuenta Google. Desbloquea todo al instante y queda asociado a tu cuenta de Play.
              </p>
              <Button
                onClick={() => void buy()}
                disabled={playBusy || !playReady}
                className="mt-3 h-10 w-full bg-emerald-600 font-semibold text-(--c30-on-accent) hover:bg-emerald-500"
              >
                {playBusy ? "Abriendo Google Play…" : playReady ? `Comprar con Google Play - ${shownPlayPrice}` : "Conectando con Google Play…"}
              </Button>
              <button
                onClick={() => void restore()}
                disabled={playBusy}
                className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground underline hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" /> Restaurar compra previa
              </button>
              {playMsg && (
                <p className={`mt-2 text-xs ${playMsg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`} role="status">
                  {playMsg.text}
                </p>
              )}
              {!playReady && !playBusy && playBillingAvailable() === false && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Si Play no responde, también puedes activar un código de la web abajo.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

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
                  Activo{pro.email ? ` con ${pro.email}` : " con Google Play"}. ¡Gracias por apoyar el proyecto! Tienes
                  constancias PDF ilimitadas, export GPX, historial ilimitado y estadísticas avanzadas.
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
                  {canPlay ? (
                    <>
                      ¿Pagaste en la web oficial? Paga único de{" "}
                      <span className="font-semibold text-foreground">{PRO_PRICE_LABEL.split("·")[0].trim()}</span>:
                      habilita el modo Pro aquí con el código que te llegó por correo.
                    </>
                  ) : (
                    <>
                      Pago único de <span className="font-semibold text-foreground">{PRO_PRICE_LABEL}</span>. Si ya
                      pagaste en la web oficial (o conseguiste tu código con la comunidad), habilítalo aquí.
                    </>
                  )}
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
                    {me ? (
                      <p className="flex items-start gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-2.5 text-[12px] leading-snug text-muted-foreground">
                        <AtSign className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>
                          Se validará con tu correo de la sesión:{" "}
                          <span className="font-semibold text-foreground">{me.user.email}</span>
                        </span>
                      </p>
                    ) : (
                      <Input
                        type="email"
                        placeholder="correo con el que pagaste"
                        aria-label="Correo con el que pagaste"
                        value={proEmail}
                        onChange={(e) => setProEmail(e.target.value)}
                        className="border-border bg-card"
                      />
                    )}
                    <Input
                      placeholder="código C30P-XXXX-XXXX-XXXX-XXXX"
                      aria-label="Código de licencia"
                      value={proCode}
                      onChange={(e) => setProCode(e.target.value.toUpperCase())}
                      className="border-border bg-card font-mono"
                    />
                    <Button
                      onClick={activatePro}
                      disabled={proBusy || !proCode || (!me && !proEmail)}
                      className="h-10 bg-emerald-600 font-semibold text-(--c30-on-accent) hover:bg-emerald-500"
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
    </div>
  );
}
