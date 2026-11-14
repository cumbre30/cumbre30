"use client";

// ============================================================
// Overlay de detección de caída (2026-11-14): "¿Estás bien?".
// Se monta a nivel de app (page.tsx) para funcionar aunque el
// ciclista esté mirando Explorar u otra pestaña durante el ride.
//   · Fase 1 (30 s): cuenta regresiva con beep periódico.
//     "Estoy bien" cierra; "Necesito ayuda" pasa a fase 2.
//   · Fase 2: tarjeta de emergencia autónoma (133/131/132/1466,
//     compartir ubicación y coordenadas legibles). NO contacta a
//     nadie por su cuenta: siempre decide la persona.
// ============================================================

import { useEffect, useState } from "react";
import { Phone, Share2, Siren } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { LatLng } from "@/lib/park";
import { alerts } from "@/lib/alertEngine";
import { t } from "@/lib/i18n";

export type FallAlert = { at: number; help: boolean };

const COUNTDOWN_S = 30;

export function FallOverlay({
  alert,
  position,
  onDismiss,
  onHelp,
}: {
  alert: FallAlert | null;
  position: LatLng | null;
  onDismiss: () => void;
  onHelp: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [msg, setMsg] = useState<string | null>(null);

  // Tick del countdown
  useEffect(() => {
    if (!alert || alert.help) return;
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [alert]);

  // Beep periódico durante el countdown (más suave que la sirena)
  useEffect(() => {
    if (!alert || alert.help) return;
    alerts.beepTriple();
    const iv = setInterval(() => alerts.beepTriple(), 4000);
    return () => clearInterval(iv);
  }, [alert]);

  // Sin respuesta al terminar la cuenta → modo ayuda automático
  const restante = alert && !alert.help ? Math.max(0, COUNTDOWN_S - Math.floor((now - alert.at) / 1000)) : null;
  useEffect(() => {
    if (restante === 0) onHelp();
  }, [restante === 0]);

  if (!alert) return null;
  const help = alert.help;

  const compartirUbicacion = async () => {
    if (!position) return;
    const txt = `${t("sos.compartirMsg", `https://maps.google.com/?q=${position.lat.toFixed(5)},${position.lon.toFixed(5)}`)}${
      help ? ` (${t("caida.ayudaModo")})` : ""
    }`;
    try {
      if (navigator.share) {
        await navigator.share({ title: t("sos.compartirTitulo"), text: txt });
        setMsg(t("sos.okCompartida"));
      } else {
        await navigator.clipboard.writeText(txt);
        setMsg(t("sos.okCopiada"));
      }
    } catch {
      setMsg(t("sos.errorCompartir"));
    }
    setTimeout(() => setMsg(null), 5000);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-label={t("caida.titulo")} aria-modal>
      <Card className="w-full max-w-md bg-background p-5">
        <div className="flex items-center gap-2.5">
          <Siren className={`h-6 w-6 ${help ? "text-red-600 dark:text-red-400" : "text-amber-500"}`} />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold leading-tight text-foreground">
              {help ? t("caida.ayudaModo") : t("caida.titulo")}
            </p>
            {!help && restante !== null && (
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                {t("caida.contando", restante)}
              </p>
            )}
          </div>
          {!help && restante !== null && (
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 font-mono text-lg font-bold ${
                restante <= 10 ? "border-red-600 text-red-500" : "border-amber-500 text-amber-500"
              }`}
              aria-hidden
            >
              {restante}
            </span>
          )}
        </div>

        {!help && (
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
            {t("caida.sub")} {t("caida.detalle")}
          </p>
        )}
        {help && (
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">{t("caida.ayudaSub")}</p>
        )}

        {!help && (
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              onClick={onDismiss}
              className="h-14 rounded-xl bg-emerald-600 text-base font-extrabold text-white shadow-lg hover:bg-emerald-500"
            >
              {t("caida.bien")}
            </button>
            <button
              onClick={onHelp}
              className="h-14 rounded-xl bg-red-950/70 text-base font-extrabold text-red-300 shadow-lg hover:bg-red-900"
            >
              {t("caida.ayuda")}
            </button>
          </div>
        )}

        {help && (
          <>
            <div className="mt-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                {t("sos.emergencias")}
              </p>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {[
                  { tel: "tel:133", n: "133", s: t("sos.carabineros") },
                  { tel: "tel:131", n: "131", s: t("sos.ambulancia") },
                  { tel: "tel:1466", n: "1466", s: t("sos.emergParquemet") },
                ].map((x) => (
                  <a
                    key={x.n}
                    href={x.tel}
                    className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-3 text-center hover:border-red-500/70"
                  >
                    <Phone className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <span className="text-sm font-bold text-foreground">{x.n}</span>
                    <span className="px-1 text-[10px] leading-tight text-muted-foreground">{x.s}</span>
                  </a>
                ))}
              </div>
            </div>
            {position ? (
              <>
                <button
                  onClick={() => void compartirUbicacion()}
                  className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
                >
                  <Share2 className="h-4 w-4" /> {t("sos.compartir")}
                </button>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/90">
                    {position.lat.toFixed(5)}, {position.lon.toFixed(5)}
                  </span>
                </div>
              </>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">{t("sos.sinGps")}</p>
            )}
            {msg && <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400" role="status">{msg}</p>}
            <button
              onClick={onDismiss}
              className="mt-3 w-full rounded-lg border border-border py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              {t("caida.cerrar")}
            </button>
          </>
        )}
      </Card>
    </div>
  );
}
