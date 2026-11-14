// ============================================================
// Spotify desde Cumbre30 (v1.12.2): controlar la música del
// ciclista sin salir de la pantalla ride.
//
//   · Spotify Web API (endpoints /me/player) vía "Spotify
//     Connect": el control remoto actúa sobre la sesión activa
//     del usuario en CUALQUIER dispositivo (el Spotify del
//     teléfono sigue sonando; aquí solo mandamos pausa/next).
//   · OAuth: Authorization Code + PKCE, el flujo que Spotify
//     recomienda para apps móviles y SPAs (no hay secret en el
//     cliente). Requiere Spotify Premium: sin él la API responde
//     403 y el panel lo explica.
//   · Client ID: cada ciclista crea su app una sola vez en el
//     dashboard de Spotify (es gratis) y la pega en el panel.
//     Redirect URIs a registrar: https://cumbregeo.cl/demo (web)
//     y cumbre30://spotify-callback (APK, via @capacitor/app).
//   · YouTube Music no tiene API pública de control remoto, por
//     eso el panel es solo Spotify.
// ============================================================

import { isNativeApp } from "@/lib/rideNative";

const LS_CLIENT = "cumbre30-spotify-client";
const LS_TOK = "cumbre30-spotify-tok";
const LS_PKCE = "cumbre30-spotify-pkce";
const API = "https://api.spotify.com/v1";
const AUTH = "https://accounts.spotify.com/authorize";
const TOKEN = "https://accounts.spotify.com/api/token";
const SCOPES = "user-read-playback-state user-modify-playback-state";
export const SPOTIFY_DASHBOARD = "https://developer.spotify.com/dashboard";

// ---------- Client ID (el que cada ciclista registra) ----------

export function spotifyClientId(): string | null {
  try {
    const v = localStorage.getItem(LS_CLIENT);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function setSpotifyClientId(id: string): void {
  try {
    const t = id.trim();
    if (t) localStorage.setItem(LS_CLIENT, t);
    else localStorage.removeItem(LS_CLIENT);
  } catch {
    /* sin almacenamiento */
  }
}

/** Redirect URI registrado en el dashboard: web = /demo (la app vive
 *  ahí en producción), APK = deep link que @capacitor/app recibe. */
export function spotifyRedirectUri(): string {
  return isNativeApp() ? "cumbre30://spotify-callback" : `${window.location.origin}/demo`;
}

// ---------- token persistente ----------

type Tok = { access: string; refresh?: string; exp: number };

function leerTok(): Tok | null {
  try {
    const raw = localStorage.getItem(LS_TOK);
    if (!raw) return null;
    const t = JSON.parse(raw) as Tok;
    return typeof t.access === "string" && typeof t.exp === "number" ? t : null;
  } catch {
    return null;
  }
}

function guardarTok(t: Tok): void {
  try {
    localStorage.setItem(LS_TOK, JSON.stringify(t));
  } catch {
    /* sin almacenamiento */
  }
}

/** ¿Hay sesión? (token vivo o refresh para renovarlo). */
export function spotifyConectado(): boolean {
  const t = leerTok();
  return !!(t && (t.exp > Date.now() || t.refresh));
}

export function spotifyDesconectar(): void {
  try {
    localStorage.removeItem(LS_TOK);
    localStorage.removeItem(LS_PKCE);
  } catch {
    /* sin almacenamiento */
  }
}

/** Token válido, renovando con refresh_token si expira. */
async function token(): Promise<string | null> {
  const t = leerTok();
  if (!t) return null;
  if (t.exp - 60_000 > Date.now()) return t.access;
  if (!t.refresh) return null;
  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: t.refresh,
      client_id: spotifyClientId() ?? "",
    });
    const r = await fetch(TOKEN, { method: "POST", body });
    if (!r.ok) return null;
    const j = (await r.json()) as { access_token?: string; expires_in?: number; refresh_token?: string };
    if (!j.access_token) return null;
    const nuevo: Tok = {
      access: j.access_token,
      refresh: j.refresh_token ?? t.refresh,
      exp: Date.now() + (j.expires_in ?? 3600) * 1000,
    };
    guardarTok(nuevo);
    return nuevo.access;
  } catch {
    return null;
  }
}

// ---------- OAuth: Authorization Code + PKCE ----------

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const rnd = crypto.getRandomValues(new Uint8Array(48));
  const verifier = base64url(rnd);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(digest) };
}

/** Arranca el flujo OAuth en el navegador del sistema (en el APK,
 *  Capacitor abre los orígenes externos fuera de la WebView). */
export async function spotifyAutorizar(): Promise<void> {
  const clientId = spotifyClientId();
  if (!clientId) return;
  const { verifier, challenge } = await pkcePair();
  const state = base64url(crypto.getRandomValues(new Uint8Array(12)));
  const redirect = spotifyRedirectUri();
  try {
    localStorage.setItem(LS_PKCE, JSON.stringify({ verifier, state, redirect }));
  } catch {
    return;
  }
  const q = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirect,
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  window.location.href = `${AUTH}?${q.toString()}`;
}

/** Recibe el regreso de Spotify (?code=…&state=… en la web o el deep
 *  link cumbre30://spotify-callback?… en el APK), intercambia el
 *  código por token y limpia la URL. true si la sesión quedó lista. */
export async function spotifyManejarCodigo(params: URLSearchParams): Promise<boolean> {
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return false;
  let pend: { verifier: string; state: string; redirect: string } | null = null;
  try {
    pend = JSON.parse(localStorage.getItem(LS_PKCE) ?? "null");
  } catch {
    pend = null;
  }
  if (!pend || pend.state !== state) return false;
  try {
    localStorage.removeItem(LS_PKCE);
  } catch {
    /* noop */
  }
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: pend.redirect,
      client_id: spotifyClientId() ?? "",
      code_verifier: pend.verifier,
    });
    const r = await fetch(TOKEN, { method: "POST", body });
    if (!r.ok) return false;
    const j = (await r.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!j.access_token) return false;
    guardarTok({
      access: j.access_token,
      refresh: j.refresh_token,
      exp: Date.now() + (j.expires_in ?? 3600) * 1000,
    });
    return true;
  } catch {
    return false;
  }
}

// ---------- control del player (Spotify Connect) ----------

export type SpotifyAccion = { ok: boolean; motivo?: "premium" | "sinDispositivo" | "sinSesion" | "error" };

export type SpotifyEstado = {
  ok: boolean;
  motivo?: SpotifyAccion["motivo"];
  tocando: boolean;
  pista?: string;
  artista?: string;
  dispositivo?: string;
};

async function llamar(
  path: string,
  method: "GET" | "POST",
): Promise<{ status: number; data: SpotifyPlayerJson | null }> {
  const tok = await token();
  if (!tok) return { status: 401, data: null };
  try {
    const r = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${tok}` },
    });
    // 401 con token recién renovado → un reintento único
    if (r.status === 401) {
      const tok2 = await token();
      if (!tok2) return { status: 401, data: null };
      const r2 = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${tok2}` } });
      return { status: r2.status, data: r2.status === 200 ? ((await r2.json()) as SpotifyPlayerJson) : null };
    }
    return { status: r.status, data: r.status === 200 ? ((await r.json()) as SpotifyPlayerJson) : null };
  } catch {
    return { status: 0, data: null };
  }
}

type SpotifyPlayerJson = {
  is_playing?: boolean;
  device?: { name?: string };
  item?: { name?: string; artists?: { name?: string }[] };
};

function motivoDe(status: number): SpotifyAccion["motivo"] {
  if (status === 403) return "premium";
  if (status === 404) return "sinDispositivo";
  if (status === 401 || status === 0) return "error";
  return "error";
}

/** Estado del player activo del usuario (cualquier dispositivo). */
export async function spotifyEstado(): Promise<SpotifyEstado> {
  if (!spotifyConectado()) return { ok: false, motivo: "sinSesion", tocando: false };
  const { status, data } = await llamar("/me/player", "GET");
  if (status === 200 && data) {
    return {
      ok: true,
      tocando: !!data.is_playing,
      pista: data.item?.name,
      artista: data.item?.artists?.map((a) => a.name).join(", ") || undefined,
      dispositivo: data.device?.name,
    };
  }
  // 204/404: sesión válida pero ningún dispositivo activo
  if (status === 204 || status === 404) return { ok: true, tocando: false };
  return { ok: false, motivo: motivoDe(status), tocando: false };
}

async function accion(path: string): Promise<SpotifyAccion> {
  if (!spotifyConectado()) return { ok: false, motivo: "sinSesion" };
  const { status } = await llamar(path, "POST");
  if (status === 200 || status === 202 || status === 204) return { ok: true };
  return { ok: false, motivo: motivoDe(status) };
}

/** Play/pause sobre el dispositivo activo. */
export function spotifyPlayPause(ponerse: boolean): Promise<SpotifyAccion> {
  return accion(ponerse ? "/me/player/play" : "/me/player/pause");
}

export function spotifySiguiente(): Promise<SpotifyAccion> {
  return accion("/me/player/next");
}

export function spotifyAnterior(): Promise<SpotifyAccion> {
  return accion("/me/player/previous");
}
