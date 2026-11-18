"use client";

// ============================================================
// A-04: banner informativo del plan Pedalea Seguro de Parquemet.
// ------------------------------------------------------------
// El plan (anuncio institucional MINVU del 2026-11-06) exige
// registro QR para enduro en senderos autorizados desde el
// 2026-12-15 y fiscaliza el límite de 30 km/h. El banner avisa
// y enlaza a la plataforma oficial: no imita ni valida la
// credencial, solo informa. Visible hasta el 2027-01-31 o hasta
// que el usuario lo cierre (se recuerda en localStorage).
// ============================================================

import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { openExternal } from "@/lib/proConfig";

const VISIBLE_HASTA = new Date("2027-02-01T00:00:00").getTime();
const LS_KEY = "cumbre30-banner-pedalea";

export function BannerPedalea() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Lectura diferida (evita setState síncrono dentro del efecto).
    const id = window.setTimeout(() => {
      try {
        if (Date.now() < VISIBLE_HASTA && localStorage.getItem(LS_KEY) !== "cerrado") {
          setVisible(true);
        }
      } catch {
        // sin almacenamiento: no molestar con el banner
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  if (!visible) return null;
  const cerrar = () => {
    setVisible(false);
    try {
      localStorage.setItem(LS_KEY, "cerrado");
    } catch {
      // sin almacenamiento
    }
  };
  return (
    <div className="mx-4 mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex gap-2.5 items-start">
      <Megaphone className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[12.5px] leading-snug">{t("banner.pedaleaTitulo")}</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{t("banner.pedaleaTexto")}</p>
        <button
          onClick={() => void openExternal("https://pedaleaseguro.parquemet.cl")}
          className="mt-1 text-[11.5px] font-semibold text-amber-600 dark:text-amber-400 underline-offset-2 hover:underline"
        >
          {t("banner.pedaleaEnlace")}
        </button>
      </div>
      <button onClick={cerrar} aria-label={t("banner.cerrar")} className="shrink-0 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
