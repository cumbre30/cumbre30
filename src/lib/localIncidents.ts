// Conteo de incidencias guardadas localmente (sin conexión).

// v2: descarta reportes locales del test (misma clave que useIncidentFeed)
const KEY = "cumbre30-incidents-local-v2";

export function loadLocalIncidentCount(): number {
  try {
    if (typeof window === "undefined") return 0;
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as unknown[]).length : 0;
  } catch {
    return 0;
  }
}
