"use client";

// ============================================================
// Motor de navegación compartido: red de vías + destino + ruta.
// Vive a nivel de página para que el minimapa (pestaña Ride) y
// el mapa grande (pestaña Mapa) muestren el mismo estado.
//
// · Al elegir destino SIN posición activa pide un arreglo GPS de
//   una vez (getCurrentPosition): así la ruta parte de TU
//   ubicación real, no de un acceso del parque.
// · Ruta vía routingService: grafo local (cerro) u OSRM bici
//   (resto de Santiago). Recalcula al cambiar destino, en marcha
//   y al detectar desvío.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { routeProgress, type NavRoute } from "@/lib/routing";
import { computeRoute } from "@/lib/routingService";
import { GATES, type LatLng } from "@/lib/park";

/** Origen provisional mientras no hay GPS (acceso Pío Nono). */
export const DEFAULT_ORIGIN: LatLng = GATES[0].position;

export type NavDest = { name: string; position: LatLng };

export type NavEngine = {
  net: ReturnType<typeof Object> | null; // se mantiene por compatibilidad; no se usa en UI
  dest: NavDest | null;
  route: NavRoute | null;
  /** Aviso breve para la UI (errores, estados de carga, ruta provisional). */
  note: string | null;
  /** true mientras se calcula la ruta. */
  loading: boolean;
  /** true si la ruta vigente partió del origen provisional (sin GPS). */
  provisional: boolean;
  setDestination: (d: NavDest | null) => void;
  reroute: () => void;
  clearNote: () => void;
};

const REROUTE_INTERVAL_MS = 30_000; // recálculo periódico en marcha
const REROUTE_MIN_GAP_MS = 15_000; // mínimo entre recálculos por desvío
const OFF_ROUTE_M = 140; // desvío que dispara recálculo

/** Arreglo GPS de una sola vez (para rutear desde tu ubicación real). */
function oneShotFix(timeoutMs = 6000): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return resolve(null);
    let done = false;
    const finish = (v: LatLng | null) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    navigator.geolocation.getCurrentPosition(
      (pos) => finish({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => finish(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 }
    );
    setTimeout(() => finish(null), timeoutMs + 1500);
  });
}

export function useNavEngine(position: LatLng | null, running: boolean): NavEngine {
  const [dest, setDest] = useState<NavDest | null>(null);
  const [route, setRoute] = useState<NavRoute | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [provisional, setProvisional] = useState(false);

  const posRef = useRef(position);
  const destRef = useRef(dest);
  const lastCalcRef = useRef(0);
  const lastRerouteRef = useRef(0);
  const calcSeqRef = useRef(0);

  useEffect(() => {
    posRef.current = position;
  }, [position]);
  useEffect(() => {
    destRef.current = dest;
  }, [dest]);

  /** Calcula ruta desde `origin`; descarta resultados de cálculos viejos. */
  const compute = useCallback(async (origin: LatLng, d: NavDest, kind: "gps" | "fallback") => {
    const seq = ++calcSeqRef.current;
    setLoading(true);
    lastCalcRef.current = Date.now();
    const res = await computeRoute(origin, d.position);
    if (seq !== calcSeqRef.current) return; // llegó uno más nuevo
    setLoading(false);
    if (!res.route) {
      setRoute(null);
      setProvisional(false);
      setNote(res.error ?? "No encontramos una ruta ciclable hasta ese destino.");
      return;
    }
    setRoute(res.route);
    setProvisional(kind === "fallback");
    setNote(
      kind === "fallback"
        ? "Partida provisional desde el Acceso Pío Nono — activa tu GPS para rutear desde tu ubicación."
        : null
    );
  }, []);

  const setDestination = useCallback(
    (d: NavDest | null) => {
      setDest(d);
      setRoute(null);
      setProvisional(false);
      setNote(null);
      lastRerouteRef.current = 0;
      if (!d) return;
      void (async () => {
        const o = posRef.current;
        if (o) {
          await compute(o, d, "gps");
          return;
        }
        setLoading(true);
        setNote("Buscando tu ubicación para rutear desde ahí…");
        const fix = await oneShotFix();
        if (fix) {
          posRef.current = fix;
          await compute(fix, d, "gps");
        } else {
          await compute(DEFAULT_ORIGIN, d, "fallback");
        }
      })();
    },
    [compute]
  );

  const reroute = useCallback(() => {
    const o = posRef.current;
    const d = destRef.current;
    if (o && d) void compute(o, d, "gps");
  }, [compute]);

  // Cuando aparece la posición real y la ruta vigente era provisional,
  // re-rutear desde la ubicación verdadera.
  useEffect(() => {
    if (!position) return;
    posRef.current = position;
    if (!destRef.current || !provisional || loading) return;
    if (Date.now() - lastCalcRef.current < 5000) return;
    // Diferido con timeout: evita setState síncrono dentro del effect.
    const t = setTimeout(() => {
      const d = destRef.current;
      if (d) void compute(position, d, "gps");
    }, 0);
    return () => clearTimeout(t);
  }, [position, provisional, loading, compute]);

  // Recálculo periódico mientras hay ride activo.
  useEffect(() => {
    if (!running || !dest) return;
    const iv = setInterval(() => {
      const o = posRef.current;
      if (o) void compute(o, destRef.current!, "gps");
    }, REROUTE_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [running, dest, compute]);

  // Desvío de la ruta → recalcular (con descanso mínimo entre cálculos).
  useEffect(() => {
    if (!running || !route || !position || !dest) return;
    const now = Date.now();
    if (now - lastRerouteRef.current < REROUTE_MIN_GAP_MS || now - lastCalcRef.current < 5000) return;
    const p = routeProgress(route, position);
    if (p.offRouteM <= OFF_ROUTE_M) return;
    const t = setTimeout(() => {
      lastRerouteRef.current = Date.now();
      const o = posRef.current;
      const d = destRef.current;
      if (o && d) void compute(o, d, "gps");
    }, 800);
    return () => clearTimeout(t);
  }, [position, route, running, dest, compute]);

  const clearNote = useCallback(() => setNote(null), []);

  return { net: null, dest, route, note, loading, provisional, setDestination, reroute, clearNote };
}
