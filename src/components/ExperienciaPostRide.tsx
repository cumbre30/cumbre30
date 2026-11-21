"use client";

// ============================================================
// Fase F (v2.1 §6/§8): experiencia post-ride. Al cerrar un ride
// GPS con una ruta proyectada (routeRef en el resumen local), este
// diálogo ofrece registrar la experiencia comunitaria:
// · fecha = fecha del ride (prellenada, editable vía re-envío desde
//   la ficha) — la unicidad [usuario, ruta, fecha] la guarda el
//   servidor (una por día).
// · condiciones tipificadas ≤3 (mismo enumerado cerrado §6) y
//   comentario opcional ≤2000. JAMÁS lleva la pista GPS del ride:
//   el payload solo lleva fecha + condiciones + texto + rideId.
// · rideId del ride local queda anclado en la experiencia
//   (RouteExperience.rideId) — trazabilidad sin exponer datos.
// · COMPLETADA BINARIA (§8): al abrir este diálogo la copia local de
//   la ruta se marca completada — sí/no, sin conteos ni ranking.
// Sin ruta publicada (serverId) no hay experiencia: se explica
// honestamente; el ride local quedó vinculado igual.
// ============================================================

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BadgeCheck, Check, Loader2, Mountain, X } from "lucide-react";
import { registrarExperiencia } from "@/lib/rutasApi";
import { armarExperienciaDeRide, marcarCompletada, type RouteRef } from "@/lib/rutaProyectada";
import { rutasStore, type RutaV2 } from "@/lib/rutasStore";
import type { RideSummary } from "@/lib/history";
import { t, useLang } from "@/lib/i18n";

/** Mismo enumerado cerrado §6 que ComunidadTab (ids → claves i18n;
 *  el id SIEMPRE es el valor que espera el servidor). */
const CONDICIONES = [
  { id: "camino_ok", clave: "com.cond.camino_ok" },
  { id: "tramo_cerrado", clave: "com.cond.tramo_cerrado" },
  { id: "barro", clave: "com.cond.barro" },
  { id: "mucho_trafico", clave: "com.cond.trafico" },
  { id: "sombra", clave: "com.cond.sombra" },
  { id: "agua", clave: "com.cond.agua" },
  { id: "otro", clave: "com.cond.otro" },
] as const;

export default function ExperienciaPostRide({ resumen, onCerrar }: { resumen: RideSummary | null; onCerrar: () => void }) {
  useLang(); // re-render al cambiar el idioma
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [comentario, setComentario] = useState("");
  const [estado, setEstado] = useState<"form" | "enviando" | "ok" | "error">("form");
  const [error, setError] = useState<string | null>(null);
  const routeRef: RouteRef | null = resumen?.routeRef ?? null;

  // COMPLETADA BINARIA: el efecto NO llama setState — marca la copia
  // local en el store y el uso de suscripción (abajo) vuelve a pintar
  // la nota cuando el store notifica. Se remonta por key={resumen.id}
  // en page.tsx: un ciclo sin setState por ride.
  useEffect(() => {
    if (!resumen || !routeRef) return;
    marcarCompletada(rutasStore, routeRef, resumen.dateISO);
  }, [resumen, routeRef]);

  const RUTAS_VACIAS: RutaV2[] = [];
  const rutas = useSyncExternalStore(rutasStore.subscribe, rutasStore.get, () => RUTAS_VACIAS);
  const marcadaId = useMemo(() => {
    if (!routeRef) return null;
    const found = rutas.find((r) => r.id === routeRef.id) ?? (routeRef.serverId ? rutas.find((r) => r.serverId === routeRef.serverId) : undefined);
    return found?.completada ? found.id : null;
  }, [rutas, routeRef]);

  if (!resumen || !routeRef) return null;
  const fecha = resumen.dateISO.slice(0, 10);
  const sinPublicar = !routeRef.serverId;

  const toggle = (idReal: string) => {
    setSeleccion((s) => (s.includes(idReal) ? s.filter((x) => x !== idReal) : s.length < 3 ? [...s, idReal] : s));
  };

  const enviar = async () => {
    if (!routeRef.serverId) return;
    const payload = armarExperienciaDeRide({ id: resumen.id, dateISO: resumen.dateISO }, { condiciones: seleccion, comentario });
    if (!payload) {
      setError(t("exp.error"));
      return;
    }
    setEstado("enviando");
    const r = await registrarExperiencia(routeRef.serverId, payload);
    if (r.ok) {
      setEstado("ok");
    } else {
      setError(r.error ?? t("exp.error"));
      setEstado("error");
    }
  };

  return (
    <div className="fixed inset-0 z-[840] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t("exp.pregunta", routeRef.nombre)} data-testid="exp-post-ride">
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-sidebar px-5 pb-6 pt-4 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start gap-2">
          <Mountain className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold leading-tight tracking-tight text-foreground">{t("exp.pregunta", routeRef.nombre)}</h2>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t("exp.sub")}</p>
          </div>
          <button onClick={onCerrar} aria-label={t("exp.masTarde")} className="rounded-lg border border-border px-1.5 py-1 text-muted-foreground hover:border-red-400" data-testid="exp-cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        {marcadaId && (
          <p className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-emerald-600/40 bg-emerald-600/10 px-2.5 py-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-300" data-testid="exp-completada">
            <BadgeCheck className="h-4 w-4" /> {t("exp.completadaNota")}
          </p>
        )}

        {estado === "ok" ? (
          <div className="mt-4">
            <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-300" data-testid="exp-ok">
              <Check className="inline h-4 w-4" /> {t("exp.ok")}
            </p>
            <button onClick={onCerrar} className="mt-3 w-full rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500" data-testid="exp-ok-cerrar">
              {t("bib.cerrar")}
            </button>
          </div>
        ) : (
          <>
            <div className="mt-3 grid gap-2.5">
              <p className="text-[11px] text-muted-foreground">
                <span className="font-bold text-foreground">{t("exp.fecha")}:</span> {fecha} · {routeRef.origen === "publica" ? t("navf.origenPublica") : t("navf.origenLocal")}
              </p>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("exp.condiciones")}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {CONDICIONES.map((c) => {
                    const activo = seleccion.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggle(c.id)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${activo ? "border-indigo-500 bg-indigo-600 text-white" : "border-border bg-card text-foreground hover:border-indigo-400"}`}
                        data-testid={`exp-cond-${c.id}`}
                      >
                        {t(c.clave)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label htmlFor="exp-comentario" className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("exp.comentario")}</label>
                <textarea
                  id="exp-comentario"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value.slice(0, 2000))}
                  rows={3}
                  maxLength={2000}
                  placeholder={t("com.expPlaceholder")}
                  className="mt-1 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                  data-testid="exp-comentario"
                />
                <p className="mt-0.5 text-right text-[10px] text-muted-foreground">{comentario.length}/2000</p>
              </div>
            </div>

            {sinPublicar && (
              <p className="mt-2 rounded-xl border border-amber-600/50 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-snug text-amber-700 dark:text-amber-300" data-testid="exp-sin-publicar">
                {t("exp.sinPublicar")}
              </p>
            )}
            {error && estado === "error" && (
              <div className="mt-2" role="alert">
                <p className="text-[11px] font-bold text-red-600 dark:text-red-400">{error}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{t("exp.despues")}</p>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              {!sinPublicar && (
                <button
                  onClick={() => void enviar()}
                  disabled={estado === "enviando"}
                  className="flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
                  data-testid="exp-enviar"
                >
                  {estado === "enviando" ? <Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" /> : <Check className="mr-1.5 inline h-4 w-4" />}
                  {t("exp.enviar")}
                </button>
              )}
              <button onClick={onCerrar} className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-muted-foreground hover:border-red-400" data-testid="exp-mas-tarde">
                {t("exp.masTarde")}
              </button>
            </div>
            <p className="mt-2 text-[9.5px] leading-snug text-muted-foreground">{t("exp.sinGps")}</p>
          </>
        )}
      </div>
    </div>
  );
}
