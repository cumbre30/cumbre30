// Catálogo de incidencias reportables en el mapa.

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
