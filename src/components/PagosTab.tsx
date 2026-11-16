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
import { t, useLang } from "@/lib/i18n";

export function PagosTab() {
  const { pro, activate, deactivate } = useProLicense();
  useLang();
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
        ? { ok: true, text: t("pag.proActivado") }
        : { ok: false, text: res.error ?? t("pag.errCodigo") }
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
    setPlayMsg(err ? { ok: false, text: err } : { ok: true, text: t("pag.compraRestaurada") });
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
              <p className="font-medium text-foreground">{t("pag.comprarTitulo")}</p>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                {t("pag.pagoUnico1")}<span className="font-semibold text-foreground">{shownPlayPrice}</span>{t("pag.comprarCuerpo2")}
              </p>
              <Button
                onClick={() => void buy()}
                disabled={playBusy || !playReady}
                className="mt-3 h-10 w-full bg-emerald-600 font-semibold text-(--c30-on-accent) hover:bg-emerald-500"
              >
                {playBusy ? t("pag.abriendoPlay") : playReady ? t("pag.comprarPlay", shownPlayPrice) : t("pag.conectandoPlay")}
              </Button>
              <button
                onClick={() => void restore()}
                disabled={playBusy}
                className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground underline hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" /> {t("pag.restaurar")}
              </button>
              {playMsg && (
                <p className={`mt-2 text-xs ${playMsg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`} role="status">
                  {playMsg.text}
                </p>
              )}
              {!playReady && !playBusy && playBillingAvailable() === false && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {t("pag.playFalla")}
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
              <p className="font-medium text-foreground">{t("pag.modoPro")}</p>
              {pro.active && (
                <Badge className="border border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  {t("pag.proActivoBadge")}
                </Badge>
              )}
            </div>

            {pro.active ? (
              <>
                <p className="mt-1.5 leading-relaxed text-muted-foreground">
                  {t("pag.proActivoNota1")}{pro.email ? t("pag.proActivoNota2", pro.email) : t("pag.proActivoNotaGoogle")}{t("pag.proActivoGracias")}
                </p>
                <button
                  onClick={() => {
                    deactivate();
                    setProMsg({ ok: true, text: t("pag.licenciaQuitada") });
                    setTimeout(() => setProMsg(null), 6000);
                  }}
                  className="mt-2 text-[11px] text-muted-foreground underline hover:text-foreground"
                >
                  {t("pag.quitarLicencia")}
                </button>
              </>
            ) : (
              <>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  {canPlay ? (
                    <>
                      {t("pag.webPago1")}
                      <span className="font-semibold text-foreground">{PRO_PRICE_LABEL.split("·")[0].trim()}</span>
                      {t("pag.webPago2")}
                    </>
                  ) : (
                    <>
                      {t("pag.pagoUnico1")}<span className="font-semibold text-foreground">{PRO_PRICE_LABEL}</span>{t("pag.pagoUnico2")}
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
                    aria-label={t("pag.habilitarPro")}
                  />
                  <span className="flex-1 text-[13.5px] font-semibold text-foreground">
                    {t("pag.habilitarPro")}
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      {t("pag.habilitarSub")}
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
                          {t("pag.validaConCorreo")}
                          <span className="font-semibold text-foreground">{me.user.email}</span>
                        </span>
                      </p>
                    ) : (
                      <Input
                        type="email"
                        placeholder={t("pag.correoPagoPlaceholder")}
                        aria-label={t("pag.correoPagoAria")}
                        value={proEmail}
                        onChange={(e) => setProEmail(e.target.value)}
                        className="border-border bg-card"
                      />
                    )}
                    <Input
                      placeholder={t("pag.codigoPlaceholder")}
                      aria-label={t("pag.codigoAria")}
                      value={proCode}
                      onChange={(e) => setProCode(e.target.value.toUpperCase())}
                      className="border-border bg-card font-mono"
                    />
                    <Button
                      onClick={activatePro}
                      disabled={proBusy || !proCode || (!me && !proEmail)}
                      className="h-10 bg-emerald-600 font-semibold text-(--c30-on-accent) hover:bg-emerald-500"
                    >
                      {proBusy ? t("pag.validando") : t("pag.validar")}
                    </Button>
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <KeyRound className="h-3 w-3" /> {t("pag.sinInternet")}
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
