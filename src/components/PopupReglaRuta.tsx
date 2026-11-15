"use client";

// ============================================================
// Popup de reglas de trazado (v1.12.11/12, cliente 2026-11-15).
// Se muestra desde el motor de navegación (useNavEngine) cuando
// la decisión le corresponde al ciclista:
// · F3 — destino = acceso ciclista (buscador/POI libre): ¿solo
//   hasta la portería o ingresar al cerro? Con opción «siempre
//   en esta sesión».
// · D3 — estás cerca de un acceso, pero según el destino deberías
//   salir por otro: ¿salir por el del destino o por el más
//   cercano a ti?
// · Preset (v1.12.12) — botón «Ruta» de las capas del mapa:
//   ¿ingresar al cerro por el acceso ciclista MÁS CERCANO A TI y
//   llegar al inicio de la ruta por dentro, o ir por fuera hasta
//   el acceso donde nace el trazado? El minimapa NO abre este
//   popup (cliente 2026-11-15): ahí solo aplica el criterio de
//   llegar al acceso.
// ============================================================

import { useState } from "react";
import type { DecisionPendiente, OpcionRuta } from "@/hooks/useNavEngine";

export default function PopupReglaRuta({
  decision,
  onElegir,
  onCancelar,
}: {
  decision: DecisionPendiente | null;
  onElegir: (opcion: OpcionRuta, recordar?: boolean) => void;
  onCancelar: () => void;
}) {
  const [recordar, setRecordar] = useState(false);
  if (!decision) return null;
  const esAcceso = decision.tipo === "popupAcceso";
  const esPreset = decision.tipo === "popupPreset";
  const titulo = esAcceso
    ? `¿Ruta hasta el ${decision.gate.name}?`
    : esPreset
      ? `¿Ingresas al cerro por el ${decision.gateIngreso.name}?`
      : "¿Por dónde sales del cerro?";
  const detalle = esAcceso
    ? "El destino es un acceso ciclista del parque. Puedo llevarte solo hasta la portería por la vía pública, o ingresar al cerro por ese acceso y dejarte ya dentro para arrancar el paseo."
    : esPreset
      ? `«${decision.d.name}» nace en el ${decision.gateInicio.name}. Puedo ingresar al cerro por el ${decision.gateIngreso.name} (el acceso ciclista más cercano a ti), llevarte por dentro hasta el inicio de la ruta y recorrerla completa; o llevarte por la vía pública, sin ingresar, hasta el ${decision.gateInicio.name}.`
      : `Estás cerca del ${decision.gateMio.name}, pero la salida de ciclistas más cercana a tu destino (${decision.d.name}) es el ${decision.gateDest.name}. ¿Por cuál prefieres salir?`;

  const btnBase =
    "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors";
  const btnPrimario = `${btnBase} bg-sky-500 text-zinc-950 hover:bg-sky-400`;
  const btnSecundario = `${btnBase} border border-border bg-sidebar text-foreground hover:bg-zinc-800/60`;

  return (
    <div className="fixed inset-0 z-[810] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-sidebar p-5 shadow-2xl">
        <h2 className="text-base font-bold tracking-tight text-foreground">{titulo}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{detalle}</p>

        {esAcceso && (
          <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={recordar}
              onChange={(e) => setRecordar(e.target.checked)}
              className="size-4 accent-sky-500"
            />
            Elegir siempre esta opción en esta sesión
          </label>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {decision.tipo === "popupSalida" ? (
            <>
              <button type="button" className={btnPrimario} onClick={() => onElegir("salidaDestino")}>
                Salir por {decision.gateDest.name}
              </button>
              <button type="button" className={btnSecundario} onClick={() => onElegir("salidaMia")}>
                Salir por {decision.gateMio.name}
              </button>
            </>
          ) : decision.tipo === "popupPreset" ? (
            <>
              <button type="button" className={btnPrimario} onClick={() => onElegir("ingresar")}>
                Ingresar por el {decision.gateIngreso.name}
              </button>
              <button type="button" className={btnSecundario} onClick={() => onElegir("portería")}>
                Por fuera hasta el {decision.gateInicio.name}
              </button>
            </>
          ) : (
            <>
              <button type="button" className={btnPrimario} onClick={() => onElegir("ingresar", recordar)}>
                Ingresar al cerro
              </button>
              <button type="button" className={btnSecundario} onClick={() => onElegir("portería", recordar)}>
                Solo hasta la portería
              </button>
            </>
          )}
          <button type="button" className="mt-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline" onClick={onCancelar}>
            Cancelar ruta
          </button>
        </div>
      </div>
    </div>
  );
}
