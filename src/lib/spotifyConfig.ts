// ============================================================
// Credenciales de Spotify (v1.28.1) — ÚNICO lugar a tocar.
//
// App «Cumbre30» en developers.spotify.com/dashboard:
//      · Redirect URI: cumbre30://callback  (registrada)
//      · SDK Android: package cl.cumbre30.app + SHA-1 de release
//        (D6:D0:BB:2A:CA:31:D1:EC:A6:5C:98:06:73:DE:55:01:71:D5:EE:68)
//      · Client ID configurado desde v1.28.1 (panel activo).
//
// El Client ID NO es un secreto (identificador público de la
// app en OAuth; por eso va al repo). El Client Secret no se usa
// ni se sube nunca: App Remote no lo necesita.
// ============================================================

export const SPOTIFY_CLIENT_ID = "2735ca16199c4c5fb721bb21f586bb9b";
export const SPOTIFY_REDIRECT_URI = "cumbre30://callback";

/** true solo cuando ya reemplazaste el marcador por el Client ID real. */
export function spotifyConfigurado(): boolean {
  return SPOTIFY_CLIENT_ID.trim() !== "" && !SPOTIFY_CLIENT_ID.includes("PON_AQUI");
}
