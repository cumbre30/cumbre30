"use client";

import { useState } from "react";

// ============================================================
// Botón de baja definitiva para la página web /eliminar-cuenta.
// Llama a DELETE /api/auth/account (requiere sesión iniciada en
// la web); si no la hay, guía al usuario hacia la app.
// ============================================================

export function DeleteAccountWebButton() {
  const [stage, setStage] = useState<"idle" | "confirm" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  if (stage === "done") {
    return (
      <p className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300" role="status">
        Tu cuenta fue eliminada definitivamente. Lamentamos verte partir — ¡buen pedaleo! 🚴
      </p>
    );
  }

  if (stage === "confirm" || stage === "busy") {
    return (
      <div className="rounded-lg border border-red-900/40 bg-red-950/10 px-4 py-3">
        <p className="text-sm text-foreground/90">
          ¿Seguro? Esta acción <span className="font-semibold">no se puede deshacer</span>: borra tu cuenta, tus
          kilómetros, logros, pines e historial de viajes.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setStage("idle")}
            disabled={stage === "busy"}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-background/60"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={stage === "busy"}
            onClick={async () => {
              setStage("busy");
              try {
                const r = await fetch("/api/auth/account", { method: "DELETE" });
                if (r.ok) {
                  setStage("done");
                  return;
                }
                setStage("error");
                setMsg(
                  r.status === 401
                    ? "Necesitas sesión iniciada en la web para eliminar desde aquí. Entra con tu cuenta y vuelve a intentarlo, o elimina directamente en la app."
                    : "No pudimos eliminar tu cuenta en este momento. Escríbenos por WhatsApp y lo hacemos nosotros."
                );
              } catch {
                setStage("error");
                setMsg("Sin conexión con el servidor. Intenta más tarde o escríbenos por WhatsApp.");
              }
            }}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
          >
            {stage === "busy" ? "Eliminando…" : "Eliminar definitivamente"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={() => {
          setMsg(null);
          setStage("confirm");
        }}
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
      >
        Eliminar mi cuenta
      </button>
      {stage === "error" && msg && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {msg}
        </p>
      )}
    </div>
  );
}
