// Catálogo de incidencias reportables en el mapa.

import { t } from "./i18n";

export type IncidentTypeId = "pozo" | "vidrio" | "perro" | "peaton" | "cierre" | "arbol" | "otro";

export const INCIDENT_TYPES: { id: IncidentTypeId; label: string; emoji: string; color: string }[] = [
  { id: "pozo", label: "Pozo / bache", emoji: "🕳️", color: "#f59e0b" },
  { id: "vidrio", label: "Vidrios en la vía", emoji: "🧊", color: "#38bdf8" },
  { id: "perro", label: "Perro suelto", emoji: "🐕", color: "#fb923c" },
  { id: "peaton", label: "Peatones en la ciclovía", emoji: "🚶", color: "#a78bfa" },
  { id: "cierre", label: "Cierre / obra", emoji: "🚧", color: "#f87171" },
  { id: "arbol", label: "Ramas o árbol caído", emoji: "🌲", color: "#4ade80" },
  { id: "otro", label: "Otro peligro", emoji: "⚠️", color: "#e879f9" },
];

export const INCIDENT_BY_ID: Record<string, (typeof INCIDENT_TYPES)[number]> = Object.fromEntries(
  INCIDENT_TYPES.map((t) => [t.id, t])
);

export function isIncidentType(v: string): v is IncidentTypeId {
  return INCIDENT_TYPES.some((t) => t.id === v);
}

// ------------------------------------------------------------
// Canal ciudadano (2026-11-14): después de registrar la incidencia
// en el mapa comunitario, la app entrega el mensaje listo para
// enviarlo a los canales oficiales del parque (línea 1466, web o
// redes de Parquemet). El mensaje sale en el idioma activo.
// ------------------------------------------------------------

/** Mensaje de reporte listo para enviar (tipo + enlace de mapa + fecha). */
export function mensajeReporte(type: IncidentTypeId, lat: number, lon: number, createdAt?: string): string {
  const tipo = INCIDENT_BY_ID[type]?.label ?? type;
  const enlace = `https://maps.google.com/?q=${lat.toFixed(5)},${lon.toFixed(5)}`;
  const fecha = createdAt
    ? new Date(createdAt).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : new Date().toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return t("rep.compartirMsg", tipo, enlace, fecha);
}

/** Comparte el mensaje (Web Share) o lo copia si no hay share sheet. */
export async function compartirReporte(
  type: IncidentTypeId,
  lat: number,
  lon: number,
  createdAt?: string
): Promise<"shared" | "copied" | "error"> {
  const texto = mensajeReporte(type, lat, lon, createdAt);
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: "Reporte - Cumbre30", text: texto });
      return "shared";
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(texto);
      return "copied";
    }
    return "error";
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return "shared"; // cerró el panel: no es error
    return "error";
  }
}
