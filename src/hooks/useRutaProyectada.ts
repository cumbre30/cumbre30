"use client";

// Fase F (v2.1 §8): suscripción a la ruta proyectada sobre el mapa.
// Patrón useTrazas/rutasStore: useSyncExternalStore con snapshot
// ESTABLE (la lib devuelve la misma referencia hasta que se escribe).
import { useSyncExternalStore } from "react";
import { rutaProyectadaStore } from "@/lib/rutaProyectada";

const NADA = null;

export function useRutaProyectada() {
  return useSyncExternalStore(
    rutaProyectadaStore.subscribe,
    rutaProyectadaStore.get,
    () => NADA
  );
}
