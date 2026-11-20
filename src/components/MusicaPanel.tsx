"use client";

// ============================================================
// Control de música en la pantalla ride (v1.12.3): botón junto al
// de ahorro de batería + panel expandible. Controla la música del
// teléfono sin abandonar las métricas del ciclista.
//
//   · Mecanismo: MediaSessions de Android (vía nuestro plugin
//     nativo RideNative) — el MISMO camino que los botones de los
//     audífonos. Funciona con Spotify (incluida la cuenta gratis),
//     YouTube Music y cualquier reproductor. Sin cuentas, sin API
//     remota y sin Premium.
//   · Requisito único: el acceso a notificaciones que Android exige
//     para cualquier controlador de media de terceros. El panel abre
//     el ajuste y re-revisa al volver (visibilitychange). Con el APK
//     instalado fuera de la tienda Android 13+ bloquea la concesión
//     («Aplicación restringida»): el botón lleva entonces a Información
//     de la aplicación para levantar la restricción (⋮ → Permitir
//     ajustes restringidos); sin restricción abre la lista de acceso.
//   · Solo APK: en la web no hay sesiones de media — el botón no
//     se renderiza (RideView).
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Music2, Pause, Play, SkipBack, SkipForward, Info } from "lucide-react";
import { t, useLang } from "@/lib/i18n";
import {
  abrirAjustesMedia,
  mediaAccion,
  mediaPermitido,
  mediaSesiones,
  type MediaSesion,
} from "@/lib/rideNative";

export function MusicaBoton({ abierto, onToggle, activo }: { abierto: boolean; onToggle: () => void; activo: boolean }) {
  return (
    <button
      onClick={onToggle}
      aria-label={t("mus.aria")}
      aria-expanded={abierto}
      title={t("mus.aria")}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground ${activo ? "border-emerald-600 bg-emerald-950/60 text-emerald-300" : ""} ${abierto ? "ring-2 ring-current/40" : ""}`}
    >
      <Music2 className="h-4 w-4" />
    </button>
  );
}

export function MusicaPanel({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const lang = useLang(); // re-render al cambiar el idioma
  const [permitido, setPermitido] = useState<boolean | null>(null);
  const [sesiones, setSesiones] = useState<MediaSesion[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const refrescar = useCallback(async () => {
    const p = await mediaPermitido();
    if (!vivo.current) return;
    setPermitido(p);
    if (!p) {
      setSesiones([]);
      return;
    }
    const r = await mediaSesiones();
    if (!vivo.current) return;
    setSesiones(r.sesiones);
  }, []);

  // Mientras esté abierto: refresco cada 4 s (pista que avanza,
  // sesión que aparece al abrir la app de música) + re-revisión al
  // volver de los ajustes de Android (visibilitychange).
  useEffect(() => {
    if (!abierto) return;
    void refrescar();
    const iv = setInterval(() => void refrescar(), 4_000);
    const alVolver = () => {
      if (document.visibilityState === "visible") void refrescar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [abierto, refrescar, lang]);

  if (!abierto) return null;

  return (
    <div className="rounded-xl border border-border bg-card/70 p-3" role="region" aria-label={t("mus.aria")}>
      <div className="flex items-center gap-2">
        <Music2 className="h-4 w-4 shrink-0 text-emerald-500" />
        <p className="flex-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("mus.titulo")}</p>
        {/* Explicación larga en el icono de información (cliente
            2026-11-17): el control de música es lo prioritario. */}
        <button
          onClick={() => setInfoOpen((v) => !v)}
          aria-expanded={infoOpen}
          aria-label={t("mus.aria")}
          title={t("mus.aria")}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onCerrar}
          className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground hover:text-foreground"
          aria-label={t("aviso.cerrarAria")}
        >
          ✕
        </button>
      </div>
      {infoOpen && (
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{t("mus.sub")}</p>
      )}

      {/* Sin el acceso a notificaciones: explicar + abrir ajuste */}
      {permitido === false && (
        <div className="mt-2.5">
          <p className="text-[11px] leading-snug text-foreground/80">{t("mus.permiso")}</p>
          <button
            onClick={abrirAjustesMedia}
            className="mt-2 h-9 w-full rounded-lg bg-emerald-600 text-[12px] font-bold text-white hover:bg-emerald-500"
          >
            {t("mus.permisoBtn")}
          </button>
          <button
            onClick={() => void refrescar()}
            className="mt-1.5 w-full text-[10.5px] font-bold text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {t("mus.revisar")}
          </button>
        </div>
      )}

      {/* Con acceso y sin nada sonando */}
      {permitido === true && sesiones.length === 0 && (
        <p className="mt-2.5 text-[11.5px] text-muted-foreground">{t("mus.sinSesiones")}</p>
      )}

      {/* Con acceso: una fila por sesión activa (normalmente 1) */}
      {permitido === true &&
        sesiones.length > 0 &&
        sesiones.map((s) => (
          <div key={s.id} className="mt-2.5 rounded-lg border border-border/60 bg-card px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-semibold text-foreground">{s.pista || s.app}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {s.artista || s.app}
                {s.tocando ? " · " + s.app : ""}
              </p>
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <button
                onClick={() => void mediaAccion(s.id, "anterior").then(refrescar)}
                aria-label={t("mus.prevAria")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground"
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                onClick={() => void mediaAccion(s.id, "toggle").then(refrescar)}
                aria-label={s.tocando ? t("mus.pauseAria") : t("mus.playAria")}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-white ${s.tocando ? "bg-emerald-600 hover:bg-emerald-500" : "bg-amber-600 hover:bg-amber-500"}`}
              >
                {s.tocando ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <button
                onClick={() => void mediaAccion(s.id, "siguiente").then(refrescar)}
                aria-label={t("mus.nextAria")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
