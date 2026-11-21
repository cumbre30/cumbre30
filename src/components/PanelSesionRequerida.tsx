"use client";

// ============================================================
// Panel honesto de la política de invitado (2026-11-21): el mapa es
// libre para todos; las secciones que viven en la cuenta (Explorar,
// credencial Pedalea Seguro, perfil ciclista, historial, stats…)
// muestran este panel en lugar de su contenido cuando no hay sesión.
// Sin datos inventados: solo la explicación y la puerta a Cuenta.
// ============================================================

import { LogIn } from "lucide-react";
import { useLang, t } from "@/lib/i18n";

export default function PanelSesionRequerida({
  onIrCuenta,
  onVolverMapa,
  testid,
}: {
  onIrCuenta: () => void;
  onVolverMapa?: () => void;
  testid?: string;
}) {
  useLang(); // re-render al cambiar el idioma
  return (
    <section className="flex flex-1 items-center justify-center px-6 py-10" aria-live="polite" data-testid={testid ?? "panel-sesion-requerida"}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-600/15">
          <LogIn className="h-6 w-6 text-emerald-600 dark:text-emerald-400" aria-hidden />
        </span>
        <h2 className="mt-3 text-lg font-bold leading-tight text-foreground">{t("pg.invitadoTitulo")}</h2>
        <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{t("pg.invitadoCuerpo")}</p>
        <button
          onClick={onIrCuenta}
          data-testid="panel-sesion-cta"
          className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
        >
          {t("pg.invitadoCta")}
        </button>
        {onVolverMapa && (
          <button
            onClick={onVolverMapa}
            data-testid="panel-sesion-mapa"
            className="mt-2 w-full rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {t("pg.invitadoMapa")}
          </button>
        )}
      </div>
    </section>
  );
}
