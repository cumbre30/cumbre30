// ============================================================
// CORS para el APK: el webview de Capacitor sirve la app desde su
// propio origen (https://localhost) y las llamadas a la web desplegada
// cruzan origen, con cookies (credentials). Cada ruta API necesita
// devolver estas cabeceras y responder el preflight OPTIONS.
// Solo se emiten para orígenes conocidos del app — la web normal
// (mismo origen) no las necesita.
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
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

/** Preflight CORS (el navegador del APK lo exige antes del POST/DELETE). */
export function corsPreflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}
