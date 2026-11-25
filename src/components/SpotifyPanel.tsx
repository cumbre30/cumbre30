"use client";

// ============================================================
// Spotify en el ride (v1.28.0): botón junto al de sensores +
// panel expandible. Controla la reproducción de la app de
// Spotify vía App Remote SDK — el reemplazo del antiguo panel
// de MediaSessions (v1.12.3, eliminado en v1.27.2 porque el
// «acceso a las notificaciones» que exigía disparaba el bloqueo
// de Play Protect como fraude).
//
//   · Mecanismo: SpotifyAppRemote.connect — la app de Spotify
//     muestra SU PROPIO diálogo de autorización (una sola vez)
//     y queda enlazada. Sin permisos de notificaciones, sin
//     listeners, sin Client Secret. Funciona con cuenta gratis
//     y Premium.
//   · Estados del panel: sin configurar (Client ID pendiente) →
//     sin Spotify instalada → sin sesión → sin autorización →
//     conectado (pista + play/pause/saltar). El botón «Conectar»
//     es SIEMPRE visible sin conexión y la conexión nativa tiene
//     timeout de 30 s (v1.28.2): el panel nunca se queda vacío.
//   · Solo APK: en la web no se renderiza (RideView).
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { Music2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { t, useLang } from "@/lib/i18n";
import {
  onSpotifyEstado,
  spotifyAccion,
  spotifyConectar,
  spotifyEstado,
  spotifyEstadoVacio,
  type SpotifyEstado,
} from "@/lib/spotifyNative";
import { SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI, spotifyConfigurado } from "@/lib/spotifyConfig";

export function SpotifyBoton({ abierto, onToggle }: { abierto: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={t("sp.aria")}
      aria-expanded={abierto}
      title={t("sp.aria")}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground ${abierto ? "ring-2 ring-current/40" : ""}`}
    >
      <Music2 className="h-4 w-4" />
    </button>
  );
}

export function SpotifyPanel({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const lang = useLang(); // re-render al cambiar el idioma
  const [estado, setEstado] = useState<SpotifyEstado>(spotifyEstadoVacio());
  const [conectando, setConectando] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const refrescar = useCallback(async () => {
    const s = await spotifyEstado();
    if (!vivo.current) return;
    setEstado(s);
    if (!s.conectado) setMotivo((m) => m); // conserva el motivo visible
  }, []);

  const conectar = useCallback(async () => {
    if (conectando) return;
    setConectando(true);
    setMotivo(null);
    const r = await spotifyConectar(SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI);
    if (!vivo.current) return;
    setConectando(false);
    if (r.ok) {
      setMotivo(null);
      void refrescar();
    } else {
      setMotivo(r.motivo);
    }
  }, [conectando, refrescar]);

  // Al abrir el panel: estado + eventos en vivo del nativo.
  useEffect(() => {
    if (!abierto) return;
    void refrescar();
    let handle: PluginListenerHandle | null = null;
    void onSpotifyEstado((s) => {
      if (!vivo.current) return;
      setEstado(s);
      if (s.conectado) setMotivo(null);
    }).then((h) => {
      handle = h;
    });
    return () => {
      void handle?.remove();
    };
  }, [abierto, refrescar]);

  // Latido (v1.28.2): mientras el panel está abierto sin conexión,
  // consulta el estado cada 5 s — recoge conexiones que llegan tarde
  // (tras el timeout nativo de 30 s) o reconexiones espontáneas.
  useEffect(() => {
    if (!abierto || estado.conectado) return;
    const id = setInterval(() => {
      void refrescar();
    }, 5000);
    return () => clearInterval(id);
  }, [abierto, estado.conectado, refrescar]);

  // Conexión automática al abrir: una sola vez por apertura.
  useEffect(() => {
    if (!abierto || !spotifyConfigurado() || conectando) return;
    void (async () => {
      const s = await spotifyEstado();
      if (!vivo.current || s.conectado) return;
      void conectar();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const sinConfig = !spotifyConfigurado();
  const instalada = estado.instalada;

  // Estado de error a mostrar (prioridad: config > app > sesión > autorización)
  let aviso: { clave: string } | null = null;
  if (sinConfig) aviso = { clave: "sp.configPendiente" };
  else if (!instalada) aviso = { clave: "sp.sinApp" };
  else if (motivo === "sinSesion") aviso = { clave: "sp.sinSesion" };
  else if (motivo === "autorizacion") aviso = { clave: "sp.autorizacion" };
  else if (motivo === "error" || motivo === "desconectado") aviso = { clave: "sp.error" };

  if (!abierto) return null;

  return (
    <div className="rounded-xl border border-border bg-card/70 p-3" role="region" aria-label={t("sp.aria")}>
      <div className="flex items-center gap-2">
        <Music2 className="h-4 w-4 shrink-0 text-emerald-500" />
        <p className="flex-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("sp.titulo")}</p>
        <button
          onClick={onCerrar}
          className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground hover:text-foreground"
          aria-label={t("aviso.cerrarAria")}
        >
          ✕
        </button>
      </div>

      {/* Sin configurar / sin app / sin sesión / sin autorización */}
      {aviso && <p className="mt-2.5 text-[11px] leading-snug text-foreground/80">{t(aviso.clave)}</p>}

      {/* Sin conectar (v1.28.2): botón de conexión SIEMPRE visible — antes
          solo aparecía tras un error y, si la conexión nativa tardaba, el
          panel se quedaba vacío y parecía roto. Mientras conecta se muestra
          «Conectando…»; sin errores previos se explica el flujo (sp.sub). */}
      {!estado.conectado && !sinConfig && instalada && (
        conectando ? (
          <p className="mt-2.5 text-[11.5px] font-semibold text-foreground/80">{t("sp.conectando")}</p>
        ) : (
          <>
            {!aviso && <p className="mt-2.5 text-[11px] leading-snug text-muted-foreground">{t("sp.sub")}</p>}
            <button
              onClick={() => void conectar()}
              className="mt-2.5 h-9 w-full rounded-lg bg-emerald-600 text-[12px] font-bold text-white hover:bg-emerald-500"
            >
              {motivo ? t("sp.reconectar") : t("sp.conectar")}
            </button>
          </>
        )
      )}

      {/* Conectado: pista actual + controles de transporte */}
      {estado.conectado && (
        <>
          {estado.pista ? (
            <div className="mt-2.5 rounded-lg border border-border/60 bg-card px-3 py-2.5">
              <p className="truncate text-[12.5px] font-semibold text-foreground">{estado.pista}</p>
              <p className="truncate text-[11px] text-muted-foreground">{estado.artista || "Spotify"}</p>
            </div>
          ) : (
            <p className="mt-2.5 text-[11.5px] text-muted-foreground">{t("sp.sinReproduccion")}</p>
          )}
          <div className="mt-2 flex items-center justify-center gap-2">
            <button
              onClick={() => void spotifyAccion("anterior")}
              aria-label={t("sp.prevAria")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={() => void spotifyAccion("toggle")}
              aria-label={estado.tocando ? t("sp.pauseAria") : t("sp.playAria")}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-white ${estado.tocando ? "bg-emerald-600 hover:bg-emerald-500" : "bg-amber-600 hover:bg-amber-500"}`}
            >
              {estado.tocando ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              onClick={() => void spotifyAccion("siguiente")}
              aria-label={t("sp.nextAria")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
