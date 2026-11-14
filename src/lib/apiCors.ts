// ============================================================
// CORS unificado para las rutas API que consume el APK.
// El WebView de Capacitor sirve la app desde https://localhost y sus
// llamadas al servidor de la web cruzan origen. Solo emitimos cabeceras
// para los orígenes conocidos del app; la web normal (same-origin) no
// las necesita. El sync viaja con Authorization: Bearer — las cookies
// third-party del WebView no son confiables en iOS/Android modernos.
// ============================================================

const ALLOWED_ORIGINS = new Set([
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
  "ionic://localhost",
]);

/** ¿La llamada viene del webview del APK (origen cross-site del app)? */
export function isAppOrigin(req: Request): boolean {
  return ALLOWED_ORIGINS.has(req.headers.get("origin") ?? "");
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (!ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

/** Preflight CORS (el navegador del APK lo exige antes del fetch real). */
export function corsPreflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}
