// ============================================================
// Credenciales de Spotify (v1.28.0) — ÚNICO lugar a tocar.
//
// 1. En developers.spotify.com/dashboard crea la app «Cumbre30»:
//      · Redirect URI: cumbre30://callback  (botón Add → Save)
//      · ¿Qué API/SDK usarás?: marca «Android»
// 2. Copia el Client ID (Settings → Basic Information) y pégalo
//    abajo entre comillas. El Client Secret NO se usa (ni se
//    sube nunca al repo): App Remote no lo necesita.
//
// Mientras el Client ID siga como marcador, el panel de Spotify
// se muestra como «se activa próximamente» y no intenta conectar.
// ============================================================

export const SPOTIFY_CLIENT_ID = "PON_AQUI_TU_CLIENT_ID";
export const SPOTIFY_REDIRECT_URI = "cumbre30://callback";

/** true solo cuando ya reemplazaste el marcador por el Client ID real. */
export function spotifyConfigurado(): boolean {
  return SPOTIFY_CLIENT_ID.trim() !== "" && !SPOTIFY_CLIENT_ID.includes("PON_AQUI");
}
