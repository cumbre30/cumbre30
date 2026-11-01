"use client";

// Estado de sesión compartido: /api/me con caché de módulo +
// useSyncExternalStore para consumirlo sin efectos problemáticos.

import { useSyncExternalStore } from "react";

export type MeUser = {
  id: string;
  email: string;
  username: string;
  selectedPin: string;
  bikeBrand: string | null;
  bikeType: string | null;
  bikeModel: string | null;
  bikeSize: string | null;
  bikeColor: string | null;
};

export type MeStats = {
  totalKm: number;
  rideCount: number;
  maxKmh: number;
  totalGainM: number;
  lastRideDate: string | null;
  incidentCount: number;
};

export type MeFriend = {
  username: string;
  selectedPin: string;
  totalKm: number;
  totalGainM: number;
  maxKmh: number;
  rideCount: number;
  achievementCount?: number;
  lastRideDate: string | null;
};

export type MeData = {
  user: MeUser;
  stats: MeStats;
  achievements: { code: string; unlockedAt: string }[];
  pins: string[];
  friends: MeFriend[];
};

let cache: MeData | null = null;
let ready = false;
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

function notify() {
  for (const l of listeners) l();
}

export function refreshMe(): Promise<MeData | null> {
  if (!inflight) {
    inflight = fetch("/api/me", { cache: "no-store" })
      .then(async (r) => {
        cache = r.ok ? ((await r.json()) as MeData) : null;
      })
      .catch(() => {
        cache = null;
      })
      .finally(() => {
        ready = true;
        inflight = null;
        notify();
      });
  }
  return inflight.then(() => cache);
}

export async function authAction(kind: "login" | "register", payload: Record<string, string>): Promise<string | null> {
  try {
    const r = await fetch(`/api/auth/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await r.json()) as { error?: string };
    if (!r.ok) return data.error ?? "Error inesperado.";
    await refreshMe();
    return null;
  } catch {
    return "Sin conexión con el servidor.";
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // sin conexión
  }
  cache = null;
  ready = true;
  notify();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  if (!ready) void refreshMe();
  return () => listeners.delete(l);
}

function getSnapshot(): MeData | null {
  return cache;
}

export function useMe(): { me: MeData | null; ready: boolean; refresh: () => Promise<MeData | null> } {
  const me = useSyncExternalStore(subscribe, getSnapshot, () => null);
  return { me, ready, refresh: refreshMe };
}
