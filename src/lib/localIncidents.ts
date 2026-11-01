// Conteo de incidencias guardadas localmente (sin conexión).

const KEY = "cumbre30-incidents-local-v1";

export function loadLocalIncidentCount(): number {
  try {
    if (typeof window === "undefined") return 0;
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as unknown[]).length : 0;
  } catch {
    return 0;
  }
}
