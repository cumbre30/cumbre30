// ============================================================
// Marcadores personales del mapa (función Cumbre30 Pro).
// Lugares que el ciclista guarda para volver después: una
// mirada, una fuente, un punto de encuentro. Se guardan solo
// en el teléfono (localStorage) como todo lo demás en la app.
// ============================================================

import { useSyncExternalStore } from "react";
import type { LatLng } from "./park";

export type Mark = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  createdAt: string;
};

const KEY = "cumbre30-marks-v1";
const MAX_MARKS = 30;

let snapshot: Mark[] = [];
const listeners = new Set<() => void>();

function read(): Mark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Mark[]) : [];
  } catch {
    return [];
  }
}

function notify(): void {
  snapshot = read();
  for (const l of listeners) l();
}

export const marksStore = {
  subscribe(l: () => void): () => void {
    listeners.add(l);
    // primera lectura perezosa
    if (snapshot.length === 0) snapshot = read();
    return () => listeners.delete(l);
  },
  get(): Mark[] {
    return snapshot;
  },
  getServer(): Mark[] {
    return [];
  },
};

export function addMark(name: string, p: LatLng): Mark {
  const list = read();
  const mark: Mark = {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 40) || "Lugar sin nombre",
    lat: p.lat,
    lon: p.lon,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify([mark, ...list].slice(0, MAX_MARKS)));
  notify();
  return mark;
}

export function removeMark(id: string): void {
  const list = read().filter((m) => m.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
  notify();
}

/** Hook reactivo para la UI. */
export function useMarks(): Mark[] {
  return useSyncExternalStore(marksStore.subscribe, marksStore.get, marksStore.getServer);
}

/** Normaliza para buscar: sin tildes, minúsculas. */
export function normalizeForSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
