"use client";

// ============================================================
// Diálogo "¿Este viaje fue en bicicleta?" — parte del sistema
// anti-vehículos (lib/vehicleDetect): cuando el motor detecta
// velocidad sostenida típica de auto/moto, el ride se guarda
// marcado como vehículo y este diálogo deja corregirlo con un
// toque si fue un falso positivo (una bajada rápida, por ejemplo).
// ============================================================

import { Bike, Car, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RideSummary } from "@/lib/history";

export function VehicleConfirmModal({
  pending,
  onAnswer,
}: {
  pending: RideSummary | null;
  onAnswer: (wasBike: boolean) => void;
}) {
  if (!pending) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 pb-8"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar si el viaje fue en bicicleta"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-600/50 bg-card p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300">
            <Car className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-bold leading-snug tracking-tight text-foreground">
              ¿Este viaje fue en bicicleta?
            </h2>
            <p className="text-xs text-muted-foreground">
              Detectamos velocidad sostenida típica de vehículo
            </p>
          </div>
        </div>

        <p className="mt-3 text-[13.5px] leading-relaxed text-foreground">
          El ride alcanzó velocidades altas <b>sostenidas</b> (no solo una punta
          en bajada). Si vas en bici, confírmalo y el viaje contará con normalidad;
          si fuiste en auto o moto, quedará marcado como{" "}
          <span className="font-semibold">vehículo</span> y no contará para
          desafíos ni estadísticas.
        </p>

        <div className="mt-3 flex gap-2.5 rounded-xl border border-border bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
          <span>
            El reto Velocista sigue vigente: una bici que llega a 42 km/h en una
            bajada no dispara esta pregunta (miramos el tiempo sostenido, no la punta).
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Button
            onClick={() => onAnswer(true)}
            className="h-12 w-full rounded-xl bg-emerald-600 text-base font-extrabold text-zinc-950 hover:bg-emerald-500"
          >
            <Bike className="h-5 w-5" /> Sí, fui en bici
          </Button>
          <Button
            onClick={() => onAnswer(false)}
            variant="outline"
            className="h-12 w-full rounded-xl border-border bg-card text-base font-bold text-foreground hover:bg-accent"
          >
            <Car className="h-5 w-5" /> No, fui en vehículo
          </Button>
        </div>
      </div>
    </div>
  );
}
