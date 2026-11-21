"use client";

// ============================================================
// Panel de MODERACIÓN (fase E, v2.1 §7.3): cola de rutas ocultas
// automáticamente y lotes sospechosos; acciones restaurar/retirar;
// historial reciente (ModerationLog). El tab solo aparece si la
// sesión tiene rol moderador/admin (403 honesto para el resto).
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { colaModeracion, accionModeracion, type ColaModeracion } from "@/lib/rutasApi";
import { t, useLang } from "@/lib/i18n";

export default function ModeracionTab({ activo, onVerEnMapa }: { activo: boolean; onVerEnMapa?: (rutaId: string) => void }) {
  useLang();
  const [cola, setCola] = useState<ColaModeracion | null>(null);
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const r = await colaModeracion();
    setCargando(false);
    if (r.ok && r.cola) {
      setAutorizado(true);
      setCola(r.cola);
    } else if (r.status === 403 || r.status === 401) {
      setAutorizado(false);
    } else {
      setError(r.error ?? "");
    }
  }, []);

  useEffect(() => {
    if (activo && cola === null && autorizado === null) {
      const id = setTimeout(() => void cargar(), 0);
      return () => clearTimeout(id);
    }
    return () => {};
  }, [activo, cola, autorizado, cargar]);

  if (!activo) return null;
  if (autorizado === false) return null; // el tab no se muestra si no es moderador

  const actuar = async (a: { accion: string; rutaId?: string; nota?: string }) => {
    const r = await accionModeracion(a);
    if (r.ok) void cargar();
    else setError(r.error ?? "");
  };

  return (
    <div data-testid="moderacion-tab">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-bold text-foreground">{t("mod.titulo")}</p>
        <button onClick={() => void cargar()} className="rounded-lg border border-border bg-card px-2 py-0.5 text-[10px] font-bold text-muted-foreground" data-testid="mod-refrescar">
          <RefreshCw className={`mr-1 inline h-3 w-3 ${cargando ? "animate-spin" : ""}`} />{t("cat.buscarBtn")}
        </button>
      </div>

      {error && <p className="mt-2 rounded-lg border border-amber-600/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-300">{error}</p>}

      {autorizado === true && cola && (
        <>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("mod.ocultas")} ({cola.ocultas.length})</p>
          <ul className="mt-1 grid gap-1.5">
            {cola.ocultas.map((o) => (
              <li key={o.id} className="rounded-lg border border-border bg-card px-2 py-1.5" data-testid={`mod-oculta-${o.id}`}>
                <p className="text-xs font-semibold text-foreground">{o.nombre}</p>
                <p className="text-[10px] text-muted-foreground">
                  {o.reports.map((r) => `${t(`com.motivo.${r.motivo === "error_geografico" ? "error" : r.motivo === "contenido_inapropiado" ? "inapropiado" : r.motivo}`)} ×${r.peso > 0 ? "" : ""}`).join(" · ") || t("mod.sinReportes")}
                </p>
                <div className="mt-1 flex gap-1.5">
                  <button onClick={() => void actuar({ accion: "restaurar", rutaId: o.id })} className="rounded-lg bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white" data-testid={`mod-restaurar-${o.id}`}>
                    {t("mod.restaurar")}
                  </button>
                  <button onClick={() => void actuar({ accion: "retirar", rutaId: o.id })} className="rounded-lg border border-border bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground hover:border-red-400 hover:text-red-500">
                    {t("mod.retirar")}
                  </button>
                  {onVerEnMapa && (
                    <button onClick={() => onVerEnMapa(o.id)} className="rounded-lg border border-border px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {t("mod.ver")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {cola.ocultas.length === 0 && <p className="mt-1 text-[11px] text-muted-foreground">{t("mod.colaVacia")}</p>}

          <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("mod.sospechosos")} ({cola.sospechosos.length})</p>
          <ul className="mt-1 grid gap-1">
            {cola.sospechosos.map((s) => (
              <li key={s.id} className="rounded-lg border border-border bg-card px-2 py-1 text-[10px] text-foreground" data-testid="mod-sospechoso">
                {t(`com.motivo.${s.motivo === "error_geografico" ? "error" : s.motivo === "contenido_inapropiado" ? "inapropiado" : s.motivo}`)} · {t("mod.ruta")} {s.routeId.slice(0, 8)}…
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("mod.historial")}</p>
          <ul className="mt-1 grid gap-0.5">
            {cola.logs.slice(0, 8).map((l) => (
              <li key={l.id} className="text-[9.5px] text-muted-foreground" data-testid="mod-log">
                {l.accion} · {l.targetType} · {l.createdAt.slice(0, 10)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
