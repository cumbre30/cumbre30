"use client";

// ============================================================
// Diálogo "¿Este viaje fue en bicicleta?" - parte del sistema
// anti-vehículos (lib/vehicleDetect): cuando el motor detecta
// velocidad sostenida típica de auto/moto, el ride se guarda
// marcado como vehículo y este diálogo deja corregirlo con un
// toque si fue un falso positivo (una bajada rápida, por ejemplo).
// Textos vía i18n (claves veh.*).
// ============================================================

import { Bike, Car, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RideSummary } from "@/lib/history";
import { t, useLang } from "@/lib/i18n";

export function VehicleConfirmModal({
  pending,
  onAnswer,
}: {
  pending: RideSummary | null;
  onAnswer: (wasBike: boolean) => void;
}) {
  const lang = useLang(); // re-render al cambiar el idioma
  if (!pending) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 pb-8"
      role="dialog"
      aria-modal="true"
      aria-label={t("veh.aria")}
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-600/50 bg-card p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300">
            <Car className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-bold leading-snug tracking-tight text-foreground">
              {t("veh.titulo")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("veh.sub")}
            </p>
          </div>
        </div>

        <p className="mt-3 text-[13.5px] leading-relaxed text-foreground">
          {t("veh.cuerpo1")}
          <b>{t("veh.cuerpoBold")}</b>
          {t("veh.cuerpo2")}
          <span className="font-semibold">{t("veh.cuerpoVehiculo")}</span>
          {t("veh.cuerpo3")}
        </p>

        <div className="mt-3 flex gap-2.5 rounded-xl border border-border bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
          <span>
            {t("veh.nota")}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Button
            onClick={() => onAnswer(true)}
            className="h-12 w-full rounded-xl bg-emerald-600 text-base font-extrabold text-(--c30-on-accent) hover:bg-emerald-500"
          >
            <Bike className="h-5 w-5" /> {t("veh.siBici")}
          </Button>
          <Button
            onClick={() => onAnswer(false)}
            variant="outline"
            className="h-12 w-full rounded-xl border-border bg-card text-base font-bold text-foreground hover:bg-accent"
          >
            <Car className="h-5 w-5" /> {t("veh.noVehiculo")}
          </Button>
        </div>
      </div>
    </div>
  );
}
