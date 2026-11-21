// ============================================================
// Elevación resuelta en el SERVIDOR (fase D, v2.1 §5.1): al publicar,
// la geometría protegida se muestrea (~100 puntos) contra Open-Meteo
// Elevation (sin clave) y se guardan gain/loss/min/max con
// eleFuente = 'servicio'. Si el servicio falla, la ruta se publica
// igual con null — JAMÁS 0 ficticio. No se resuelve en el teléfono.
// ============================================================

import { muestrear, eleDesdeMuestras, type EleResuelta } from "./proteccionRuta";
import { polylineDecode, type Punto } from "./routeGeo";

const OPEN_METEO = "https://api.open-meteo.com/v1/elevation";

/** Resuelve la elevación de una geometría protegida (server-side).
 *  Devuelve null si el servicio falla o no responde a tiempo — el
 *  resultado NUNCA es un 0 ficticio. */
export async function resolverElevacionServicio(coords: Punto[]): Promise<EleResuelta | null> {
  try {
    const puntos = muestrear(coords, 100);
    if (puntos.length < 2) return null;
    const lat = puntos.map((p) => p.lat.toFixed(5)).join(",");
    const lon = puntos.map((p) => p.lon.toFixed(5)).join(",");
    const res = await fetch(`${OPEN_METEO}?lat=${lat}&lon=${lon}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { elevation?: unknown };
    if (!Array.isArray(d.elevation)) return null;
    const eles = d.elevation.map((e) => (typeof e === "number" && Number.isFinite(e) ? e : null));
    return eleDesdeMuestras(eles);
  } catch {
    return null;
  }
}

/** Resuelve desde una polyline codificada (formato de entrega). */
export async function resolverElevacionDePolyline(polyline: string): Promise<EleResuelta | null> {
  try {
    return await resolverElevacionServicio(polylineDecode(polyline));
  } catch {
    return null;
  }
}
