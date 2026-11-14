"use client";

// ============================================================
// Control de música en la pantalla ride (v1.12.2): botón junto al
// de ahorro de batería + panel expandible. El objetivo del brief:
// controlar Spotify sin abandonar las métricas del ciclista.
//   · Botón: abre/cierra el panel (icono Music2, verde cuando hay
//     sesión activa).
//   · Panel: alta self-serve del Client ID (cada ciclista crea su
//     app una vez en el dashboard de Spotify, gratis), conexión
//     OAuth PKCE y controles ⏮ ⏯ ⏭ sobre el Spotify Connect del
//     teléfono. Estado refrescado cada 15 s mientras está abierto.
//   · YouTube Music queda fuera: no tiene API pública de control
//     remoto (el copy del panel lo deja claro).
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Music2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { t, useLang } from "@/lib/i18n";
import {
  SPOTIFY_DASHBOARD,
  spotifyAutorizar,
  spotifyClientId,
  spotifyConectado,
  spotifyDesconectar,
  spotifyEstado,
  spotifyPlayPause,
  spotifyRedirectUri,
  spotifySiguiente,
  spotifyAnterior,
  setSpotifyClientId,
  type SpotifyEstado as Estado,
} from "@/lib/spotify";

const btn =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground";

export function MusicaBoton({ abierto, onToggle, conectado }: { abierto: boolean; onToggle: () => void; conectado: boolean }) {
  return (
    <button
      onClick={onToggle}
      aria-label={t("mus.aria")}
      aria-expanded={abierto}
      title={t("mus.aria")}
      className={`${btn} ${conectado ? "border-emerald-600 bg-emerald-950/60 text-emerald-300" : ""} ${abierto ? "ring-2 ring-current/40" : ""}`}
    >
      <Music2 className="h-4 w-4" />
    </button>
  );
}

export function MusicaPanel({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const lang = useLang(); // re-render al cambiar el idioma
  const [clientId, setClientId] = useState<string>("");
  const [guardado, setGuardado] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const refrescar = useCallback(async () => {
    if (!spotifyConectado()) {
      setConectado(false);
      setEstado(null);
      return;
    }
    setConectado(true);
    setBusy(true);
    const e = await spotifyEstado();
    if (!vivo.current) return;
    setBusy(false);
    setEstado(e);
    if (!e.ok && e.motivo) setMsg(t(`mus.${e.motivo === "sinSesion" ? "error" : e.motivo}`));
    else setMsg(null);
  }, []);

  // Al abrirse: Client ID actual + estado. Mientras esté abierto,
  // refresco cada 15 s (pista que avanza sin salir del ride).
  useEffect(() => {
    if (!abierto) return;
    const cid = spotifyClientId();
    setClientId(cid ?? "");
    setGuardado(!!cid);
    void refrescar();
    const iv = setInterval(() => void refrescar(), 15_000);
    return () => clearInterval(iv);
  }, [abierto, refrescar, lang]);

  const guardarClientId = () => {
    setSpotifyClientId(clientId);
    setGuardado(!!clientId.trim());
    setMsg(null);
  };

  const conectar = async () => {
    await spotifyAutorizar(); // navega al login de Spotify; vuelve por ?code= o deep link
  };

  const desconectar = () => {
    spotifyDesconectar();
    setConectado(false);
    setEstado(null);
  };

  const accion = async (fn: () => Promise<{ ok: boolean; motivo?: string }>, luego: boolean) => {
    setBusy(true);
    const r = await fn();
    if (!vivo.current) return;
    setBusy(false);
    if (!r.ok && r.motivo) setMsg(t(r.motivo === "premium" || r.motivo === "sinDispositivo" ? `mus.${r.motivo}` : "mus.error"));
    if (luego) void refrescar();
  };

  if (!abierto) return null;
  const webUri = typeof window !== "undefined" ? spotifyRedirectUri() : "";
  const apkUri = "cumbre30://spotify-callback";

  return (
    <div className="rounded-xl border border-border bg-card/70 p-3" role="region" aria-label={t("mus.aria")}>
      <div className="flex items-center gap-2">
        <Music2 className="h-4 w-4 shrink-0 text-emerald-500" />
        <p className="flex-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("mus.titulo")}</p>
        <button
          onClick={onCerrar}
          className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground hover:text-foreground"
          aria-label={t("aviso.cerrarAria")}
        >
          ✕
        </button>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{t("mus.sub")}</p>

      {/* 1) Sin Client ID: alta self-serve (una sola vez) */}
      {!guardado && (
        <div className="mt-2.5">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-muted-foreground">{t("mus.clientId")}</span>
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-[12px] text-foreground outline-none focus:border-emerald-500"
            />
          </label>
          <p className="mt-1.5 text-[10.5px] leading-snug text-muted-foreground">{t("mus.clientIdHelp", webUri, apkUri)}</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={guardarClientId}
              disabled={!clientId.trim()}
              className="h-9 flex-1 rounded-lg bg-emerald-600 text-[12px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {t("mus.guardar")}
            </button>
            <a
              href={SPOTIFY_DASHBOARD}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-[12px] font-bold text-muted-foreground hover:text-foreground"
            >
              {t("mus.dashboard")} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

      {/* 2) Con Client ID sin sesión: conectar (OAuth PKCE) */}
      {guardado && !conectado && (
        <div className="mt-2.5">
          <button
            onClick={() => void conectar()}
            className="h-9 w-full rounded-lg bg-emerald-600 text-[12px] font-bold text-white hover:bg-emerald-500"
          >
            {t("mus.conectar")}
          </button>
          <button onClick={() => setGuardado(false)} className="mt-1.5 w-full text-[10.5px] font-bold text-muted-foreground underline underline-offset-2 hover:text-foreground">
            {t("mus.cambiar")}
          </button>
        </div>
      )}

      {/* 3) Conectado: pista + controles sobre el Spotify Connect */}
      {guardado && conectado && (
        <div className="mt-2.5">
          {estado?.pista ? (
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-semibold text-foreground">{estado.pista}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {estado.artista}
                {estado.dispositivo ? ` · ${estado.dispositivo}` : ""}
              </p>
            </div>
          ) : (
            <p className="text-[11.5px] text-muted-foreground">{estado?.ok ? t("mus.sinPista") : busy ? "…" : t("mus.sinDispositivo")}</p>
          )}
          <div className="mt-2 flex items-center justify-center gap-2">
            <button
              onClick={() => void accion(spotifyAnterior, true)}
              disabled={busy}
              aria-label={t("mus.prevAria")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground disabled:opacity-50"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={() => void accion(() => spotifyPlayPause(!(estado?.tocando ?? false)), true)}
              disabled={busy}
              aria-label={estado?.tocando ? t("mus.pauseAria") : t("mus.playAria")}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {estado?.tocando ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              onClick={() => void accion(spotifySiguiente, true)}
              disabled={busy}
              aria-label={t("mus.nextAria")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground disabled:opacity-50"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
          <button onClick={desconectar} className="mt-2 w-full text-[10.5px] font-bold text-muted-foreground underline underline-offset-2 hover:text-foreground">
            {t("mus.desconectar")}
          </button>
        </div>
      )}

      {msg && (
        <p className="mt-2 text-[11px] font-semibold text-amber-600 dark:text-amber-400" role="alert">
          {msg}
        </p>
      )}
    </div>
  );
}
