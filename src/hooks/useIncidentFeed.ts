"use client";

// ============================================================
// Feed compartido de incidencias: caché de módulo + store
// externo. El mapa grande (reporte/eliminación) y el minimapa
// (solo lectura) consumen la misma lista sin duplicar fetches.
//
// Moderación comunitaria (Ola 1): cada ciclista puede votar
// "sigue ahí" (frescura) o "ya resuelto" (3 votos cierran). Los
// votos suben al servidor con sesión; sin conexión quedan en el
// teléfono y se superponen al feed localmente (APK offline).
// ============================================================

import { useEffect, useSyncExternalStore } from "react";
import { apiUrl } from "@/lib/backend";

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
  // Moderación comunitaria (Ola 1):
  confirmCount: number;
  resolvedCount: number;
  lastConfirmAt: string | null;
};

export type IncidentVote = "confirm" | "resolved";

// v2: descarta reportes locales del test (el bache de prueba queda fuera)
const LOCAL_KEY = "cumbre30-incidents-local-v2";
// Votos locales: { [id]: "confirm" | "resolved" } — dedup por dispositivo.
const VOTES_KEY = "cumbre30-incident-votes-v1";
const EMPTY: IncidentItem[] = [];

let cache: IncidentItem[] | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/** Normaliza items viejos o locales que aún no traen los contadores. */
function norm(i: IncidentItem): IncidentItem {
  return {
    ...i,
    confirmCount: typeof i.confirmCount === "number" ? i.confirmCount : 0,
    resolvedCount: typeof i.resolvedCount === "number" ? i.resolvedCount : 0,
    lastConfirmAt: i.lastConfirmAt ?? null,
  };
}

function loadLocalVotes(): Record<string, IncidentVote> {
  try {
    return JSON.parse(localStorage.getItem(VOTES_KEY) ?? "{}") as Record<string, IncidentVote>;
  } catch {
    return {};
  }
}

function saveLocalVotes(v: Record<string, IncidentVote>) {
  try {
    localStorage.setItem(VOTES_KEY, JSON.stringify(v));
  } catch {
    // almacenamiento lleno
  }
}

export function loadLocalIncidents(): IncidentItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as IncidentItem[]).map(norm) : [];
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

/** Superpone los votos guardados en el teléfono sobre el feed. */
function aplicarVotosLocales(list: IncidentItem[]): IncidentItem[] {
  const votes = loadLocalVotes();
  if (Object.keys(votes).length === 0) return list;
  return list.map((i) => {
    const v = votes[i.id];
    if (!v) return i;
    if (v === "confirm" && !i.mine) {
      return { ...i, confirmCount: i.confirmCount + 1, lastConfirmAt: new Date().toISOString() };
    }
    if (v === "resolved" && !i.mine) {
      return { ...i, resolvedCount: i.resolvedCount + 1 };
    }
    return i;
  });
}

export async function refreshIncidents(): Promise<IncidentItem[]> {
  try {
    const r = await fetch(apiUrl("/api/incidents") ?? "/api/incidents", { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = (await r.json()) as { incidents: IncidentItem[] };
    const locals = loadLocalIncidents().filter((l) => !d.incidents.some((i) => i.id === l.id));
    cache = aplicarVotosLocales([...d.incidents.map(norm), ...locals]);
  } catch {
    cache = aplicarVotosLocales(loadLocalIncidents());
  }
  notify();
  return cache;
}

/** Inserta (al inicio) una incidencia recién creada. */
export function addIncident(inc: IncidentItem) {
  cache = [norm(inc), ...(cache ?? [])];
  notify();
}

/** Elimina por id (server o local). */
export function removeIncident(id: string) {
  if (cache) cache = cache.filter((i) => i.id !== id);
  saveLocalIncidents(loadLocalIncidents().filter((i) => i.id !== id));
  notify();
}

/** ¿Ya votó este dispositivo por la incidencia? (dedup local) */
export function incidentVoteOf(id: string): IncidentVote | null {
  return loadLocalVotes()[id] ?? null;
}

/** Voto de moderación: sube al servidor (si hay sesión) y queda
 *  guardado en el teléfono para no repetir ni perder el APK offline.
 *  Devuelve { ok, cerrada } (cerrada: 3 votos "resuelto" la dieron de baja). */
export async function voteIncident(
  id: string,
  vote: IncidentVote
): Promise<{ ok: boolean; cerrada: boolean }> {
  const votes = loadLocalVotes();
  votes[id] = vote;
  saveLocalVotes(votes);
  // Actualización optimista del caché (y del almacenamiento local).
  if (cache) {
    cache = cache.map((i) =>
      i.id === id
        ? vote === "confirm"
          ? { ...i, confirmCount: i.confirmCount + 1, lastConfirmAt: new Date().toISOString() }
          : { ...i, resolvedCount: i.resolvedCount + 1 }
        : i
    );
    notify();
  }
  try {
    const url = apiUrl("/api/incidents");
    if (!url) throw new Error("sin backend");
    const r = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, vote }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ok: false, cerrada: false };
    const d = (await r.json()) as { ok?: boolean; cerrada?: boolean };
    const cerrada = !!d.cerrada;
    if (cerrada) removeIncident(id); // la comunidad la cerró: fuera del mapa
    return { ok: true, cerrada };
  } catch {
    // Sin sesión o sin conexión: el voto queda local (se re-intenta
    // implícitamente si el usuario lo pulsa tras loguearse — dedup lo
    // evita; el servidor acepta votos repetidos como "confirmaciones").
    return { ok: false, cerrada: false };
  }
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
