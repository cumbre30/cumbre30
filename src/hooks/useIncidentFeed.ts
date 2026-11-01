"use client";

// ============================================================
// Feed compartido de incidencias: caché de módulo + store
// externo. El mapa grande (reporte/eliminación) y el minimapa
// (solo lectura) consumen la misma lista sin duplicar fetches.
// ============================================================

import { useEffect, useSyncExternalStore } from "react";

export type IncidentItem = {
  id: string;
  type: string;
  lat: number;
  lon: number;
  note: string | null;
  createdAt: string;
  username: string;
  authorPin: string;
  mine: boolean;
  localOnly?: boolean;
};

const LOCAL_KEY = "cumbre30-incidents-local-v1";
const EMPTY: IncidentItem[] = [];

let cache: IncidentItem[] | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function loadLocalIncidents(): IncidentItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as IncidentItem[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalIncidents(list: IncidentItem[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 100)));
  } catch {
    // almacenamiento lleno
  }
}

export async function refreshIncidents(): Promise<IncidentItem[]> {
  try {
    const r = await fetch("/api/incidents", { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = (await r.json()) as { incidents: IncidentItem[] };
    const locals = loadLocalIncidents().filter((l) => !d.incidents.some((i) => i.id === l.id));
    cache = [...d.incidents, ...locals];
  } catch {
    cache = loadLocalIncidents();
  }
  notify();
  return cache;
}

/** Inserta (al inicio) una incidencia recién creada. */
export function addIncident(inc: IncidentItem) {
  cache = [inc, ...(cache ?? [])];
  notify();
}

/** Elimina por id (server o local). */
export function removeIncident(id: string) {
  if (cache) cache = cache.filter((i) => i.id !== id);
  saveLocalIncidents(loadLocalIncidents().filter((i) => i.id !== id));
  notify();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot(): IncidentItem[] {
  return cache ?? EMPTY;
}

/** Lista de incidencias compartida; carga una vez por sesión de página. */
export function useIncidentFeed(): IncidentItem[] {
  const list = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  useEffect(() => {
    if (cache === null) void refreshIncidents();
  }, []);
  return list;
}
