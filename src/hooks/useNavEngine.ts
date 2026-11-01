"use client";

// ============================================================
// Motor de navegación compartido: red de vías + destino + ruta.
// Vive a nivel de página para que el minimapa (pestaña Ride) y
// el mapa grande (pestaña Mapa) muestren el mismo estado.
// Recalcula al cambiar destino, periódicamente en marcha y al
// detectar desvío de la ruta.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { findRoute, loadNetwork, routeProgress, type NavRoute, type Network } from "@/lib/routing";
import type { LatLng } from "@/lib/park";

export type NavDest = { name: string; position: LatLng };

export type NavEngine = {
  net: Network | null;
  dest: NavDest | null;
  route: NavRoute | null;
  /** Aviso breve para la UI (errores, estados de carga). */
  note: string | null;
  setDestination: (d: NavDest | null) => void;
  reroute: () => void;
  clearNote: () => void;
};

const REROUTE_INTERVAL_MS = 30_000; // recálculo periódico en marcha
const REROUTE_MIN_GAP_MS = 15_000; // mínimo entre recálculos por desvío
const OFF_ROUTE_M = 140; // desvío que dispara recálculo

export function useNavEngine(position: LatLng | null, running: boolean): NavEngine {
  const [net, setNet] = useState<Network | null>(null);
  const [dest, setDest] = useState<NavDest | null>(null);
  const [route, setRoute] = useState<NavRoute | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const posRef = useRef(position);
  const destRef = useRef(dest);
  const lastCalcRef = useRef(0);
  const lastRerouteRef = useRef(0);
  const netRef = useRef(net);
  // Espejo de valores actuales para callbacks/timers (sin tocar refs en render).
  useEffect(() => {
    posRef.current = position;
  }, [position]);
  useEffect(() => {
    destRef.current = dest;
  }, [dest]);
  useEffect(() => {
    netRef.current = net;
  }, [net]);

  useEffect(() => {
    void loadNetwork().then((n) => {
      setNet(n);
      if (!n) setNote("Red de vías no disponible (sin conexión).");
    });
  }, []);

  const compute = useCallback((origin: LatLng, d: NavDest) => {
    const n = netRef.current;
    if (!n) {
      setNote("Red de vías aún cargando…");
      return;
    }
    const r = findRoute(n, origin, d.position);
    lastCalcRef.current = Date.now();
    if (!r) {
      setRoute(null);
      setNote("No encontramos una ruta ciclable cercana a ese destino.");
      return;
    }
    setRoute(r);
    setNote(null);
  }, []);

  const setDestination = useCallback(
    (d: NavDest | null) => {
      setDest(d);
      setRoute(null);
      lastRerouteRef.current = 0;
      if (!d) {
        setNote(null);
        return;
      }
      const o = posRef.current;
      if (o) compute(o, d);
      else setNote("Esperando tu ubicación para trazar la ruta…");
    },
    [compute]
  );

  const reroute = useCallback(() => {
    const o = posRef.current;
    const d = destRef.current;
    if (o && d) compute(o, d);
  }, [compute]);

  // Si la red llega tarde y ya hay destino, calcular en cuanto esté lista.
  useEffect(() => {
    if (net && destRef.current && !route) {
      const o = posRef.current;
      if (o) compute(o, destRef.current);
    }
     
  }, [net, compute]);

  // Recálculo periódico mientras hay ride activo.
  useEffect(() => {
    if (!running || !dest) return;
    const iv = setInterval(() => {
      const o = posRef.current;
      if (o) compute(o, destRef.current!);
    }, REROUTE_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [running, dest, compute]);

  // Desvío de la ruta → recalcular (con descanso mínimo entre cálculos).
  // Diferido con timeout: evita setState síncrono dentro del effect.
  useEffect(() => {
    if (!running || !route || !position || !dest) return;
    const now = Date.now();
    if (now - lastRerouteRef.current < REROUTE_MIN_GAP_MS || now - lastCalcRef.current < 5_000) return;
    const p = routeProgress(route, position);
    if (p.offRouteM <= OFF_ROUTE_M) return;
    const t = setTimeout(() => {
      lastRerouteRef.current = Date.now();
      const o = posRef.current;
      const d = destRef.current;
      if (o && d) compute(o, d);
    }, 800);
    return () => clearTimeout(t);
  }, [position, route, running, dest, compute]);

  const clearNote = useCallback(() => setNote(null), []);

  return { net, dest, route, note, setDestination, reroute, clearNote };
}
