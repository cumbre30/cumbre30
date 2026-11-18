// ============================================================
// Limitador de tasa en memoria para las rutas de autenticación.
// ------------------------------------------------------------
// Ventana deslizante por clave (IP + identidad). Es por instancia
// de función serverless: para una app de nicho esto detiene la
// fuerza bruta sin introducir Redis ni dependencias nuevas.
// No persiste: reiniciar la función limpia los contadores, lo que
// es aceptable para el modelo de amenaza actual (C-01).
// ============================================================

const buckets = new Map<string, number[]>();

/**
 * Devuelve true si la llamada está permitida. `max` eventos por
 * `windowMs` bajo la misma clave.
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  let hits = buckets.get(key);
  if (!hits) {
    hits = [];
    buckets.set(key, hits);
  }
  // Descarta eventos fuera de la ventana.
  while (hits.length > 0 && now - hits[0] > windowMs) {
    hits.shift();
  }
  if (hits.length >= max) return false;
  hits.push(now);
  // Poda defensiva: si el mapa crece mucho, suelta buckets vacíos.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.length === 0 || now - v[v.length - 1] > windowMs * 10) buckets.delete(k);
    }
  }
  return true;
}

/** IP del cliente (Vercel entrega x-forwarded-for con la cadena de proxies). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0].trim() || "desconocida";
}

/**
 * Aplica el límite y devuelve la respuesta de rechazo ya lista
 * (o null si la llamada está permitida). Mensaje genérico a propósito:
 * no revela si el problema es la IP o el correo.
 */
export function guard(
  req: Request,
  scope: string,
  identity: string,
  max: number,
  windowMs: number,
  cors?: Record<string, string>,
): Response | null {
  const ok = rateLimit(`${scope}:${clientIp(req)}:${identity}`, max, windowMs);
  if (ok) return null;
  return new Response(
    JSON.stringify({ error: "Demasiados intentos. Espera un momento y vuelve a intentarlo." }),
    { status: 429, headers: { "content-type": "application/json", ...(cors ?? {}) } },
  );
}
