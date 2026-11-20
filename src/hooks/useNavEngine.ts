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
import { haversineM, routeProgress, type NavRoute, type LatLng } from "@/lib/routing";
import { computeRoute, computePresetRoute } from "@/lib/routingService";
import { evaluarRuta } from "@/lib/reglasAcceso";
import { GATES, type Gate } from "@/lib/park";
import { t } from "@/lib/i18n";

/** Origen provisional mientras no hay GPS (acceso Pío Nono). */
export const DEFAULT_ORIGIN: LatLng = GATES[0].position;

export type NavDest = { name: string; position: LatLng; /** v1.12.8: destino = acceso ciclista (minimapa «Ir a»): ruta DIRECTA por la calle, sin desvío por el acceso más cercano. */ esAcceso?: boolean };

/** Destino con ruta predefinida del mapa (botón «Ruta» de la capa Rutas):
 *  el motor sigue el trazado precomputado, entrando por el acceso
 *  ciclista más cercano (regla del cliente). */
export type NavDestPreset = { name: string; position: LatLng; preset: { rutaId: string; nombre: string } };

/** v1.12.11: opción elegida en el popup de reglas de accesos. */
export type OpcionRuta = "portería" | "ingresar" | "salidaMia" | "salidaDestino";

/** Opciones extra de trazado que resuelve el popup (F3/D3). */
export type ExtraRuta = {
  /** F3 «solo hasta la portería»: por la vía pública, sin ingresar. */
  sinIngresar?: boolean;
  /** F3 «ingresar»: portería + extensión interior por el camino del acceso. */
  ingresoExtendido?: boolean;
  /** D2/D3: salida en dos tramos por esta portería. */
  salidaPor?: LatLng;
  salidaNombre?: string;
};

/** Decisión pendiente de mostrar en el popup (mientras exista, no hay
 *  ruta trazada: el usuario elige o cancela). */
export type DecisionPendiente =
  | { tipo: "popupAcceso"; d: NavDest; gate: Gate; origen: LatLng }
  | { tipo: "popupSalida"; d: NavDest; gateMio: Gate; gateDest: Gate; origen: LatLng };

/** Preferencia de la sesión para el popup F3 («elegir siempre esta
 *  opción»): sessionStorage sobrevive recargas de la misma pestaña. */
function prefAccesoSesion(): "portería" | "ingresar" | null {
  try {
    const v = sessionStorage.getItem("c30:prefAcceso");
    return v === "portería" || v === "ingresar" ? v : null;
  } catch {
    return null;
  }
}
function guardarPrefAccesoSesion(v: "portería" | "ingresar") {
  try {
    sessionStorage.setItem("c30:prefAcceso", v);
  } catch {
    /* almacenamiento no disponible: sin preferencia */
  }
}

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
  /** v1.12.11: decisión de accesos pendiente (popup F3/D3) o null. */
  decision: DecisionPendiente | null;
  /** Resuelve el popup con la opción elegida (y la recuerda si aplica). */
  resolverDecision: (opcion: OpcionRuta, recordar?: boolean) => void;
  /** Cierra el popup sin trazar (equivale a cancelar el destino). */
  cancelarDecision: () => void;
};

const REROUTE_INTERVAL_MS = 30_000; // recálculo periódico en marcha
const REROUTE_MIN_GAP_MS = 15_000; // mínimo entre recálculos por desvío
const OFF_ROUTE_M = 140; // desvío que dispara recálculo
const REANCHOR_M = 75; // la ruta debe partir donde estás TÚ: si el origen
// del cálculo quedó a más de esto de tu posición fresca, se re-ancla

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
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 5_000 }
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
  /** Origen REAL usado en el último cálculo exitoso (para detectar rutas ancladas a fixes viejos). */
  const originUsedRef = useRef<LatLng | null>(null);

  useEffect(() => {
    posRef.current = position;
  }, [position]);
  useEffect(() => {
    destRef.current = dest;
  }, [dest]);

  /** Calcula ruta desde `origin`; descarta resultados de cálculos viejos.
   *  Con destino predefinido (capa Rutas) recorre el trazado precomputado
   *  COMPLETO (el mismo de «Ver», cliente 2026-11-12); en recálculo por
   *  desvío (isReroute, ride en marcha) se empalma al trazado desde el
   *  punto más cercano hacia adelante.
   *  Blindaje: cualquier excepción deja el estado limpio y avisa - la UI
   *  NUNCA queda pegada en «cargando» (queja del cliente 2026-11-12). */
  const compute = useCallback(async (origin: LatLng, d: NavDest, kind: "gps" | "fallback", isReroute = false, extra?: ExtraRuta) => {
    const seq = ++calcSeqRef.current;
    setLoading(true);
    lastCalcRef.current = Date.now();
    try {
      const preset = (d as NavDestPreset).preset;
      const res = preset
        ? await computePresetRoute(origin, preset, { fullTrace: !isReroute })
        : await computeRoute(origin, d.position, {
            accesoDirecto: d.esAcceso === true || extra?.sinIngresar === true || extra?.ingresoExtendido === true,
            ingresoExtendido: extra?.ingresoExtendido,
            salidaPor: extra?.salidaPor,
            salidaNombre: extra?.salidaNombre,
          });
      if (seq !== calcSeqRef.current) return; // llegó uno más nuevo
      if (!res.route) {
        setRoute(null);
        setProvisional(false);
        setNote(res.error ?? t("nav.errSinRuta"));
        return;
      }
      setRoute(res.route);
      originUsedRef.current = origin;
      setProvisional(kind === "fallback");
      // Aviso del cliente (corte horario con vuelta en U, Pío Nono sólo
      // subida…) tiene prioridad sobre el aviso de partida provisional.
      setNote(
        res.aviso ??
          (kind === "fallback"
            ? t("nav.partidaProvisional")
            : null)
      );
    } catch {
      if (seq !== calcSeqRef.current) return; // llegó uno más nuevo
      setRoute(null);
      setProvisional(false);
      setNote(t("nav.errTrazar"));
    } finally {
      if (seq === calcSeqRef.current) setLoading(false);
    }
  }, []);

  // v1.12.11: decisión de accesos pendiente (popup F3/D3). Mientras
  // exista no se traza nada: la UI muestra el popup y resuelve con
  // resolverDecision() o cancela con cancelarDecision().
  const [decision, setDecision] = useState<DecisionPendiente | null>(null);

  const setDestination = useCallback(
    (d: NavDest | null) => {
      setDest(d);
      setRoute(null);
      setProvisional(false);
      setNote(null);
      setDecision(null);
      lastRerouteRef.current = 0;
      if (!d) return;
      void (async () => {
        const o = posRef.current;
        let origin = o;
        if (!origin) {
          setLoading(true);
          setNote(t("nav.buscandoUbicacion"));
          // 2 intentos: el GPS frío (recién abierto / bajo techo) suele
          // necesitar más de un disparo para dar un fix utilizable.
          // Solo si ambos fallan se usa el origen provisional del acceso.
          let fix = await oneShotFix();
          if (!fix) fix = await oneShotFix(8000);
          if (!fix) {
            await compute(DEFAULT_ORIGIN, d, "fallback");
            return;
          }
          posRef.current = fix;
          origin = fix;
        }
        // v1.12.12 (cliente 2026-11-15): destino = ACCESO ciclista (minimapa
        // «Ir a», marcador de acceso «Ruta aquí») → se cumple SOLO el
        // criterio de llegar al acceso, SIN popup. Fuera del cerro compute
        // ya traza directo a la portería por la vía pública (accesoDirecto
        // vía esAcceso, F1); dentro, flujo normal del grafo (D1).
        if (d.esAcceso === true) {
          await compute(origin, d, "gps");
          return;
        }
        // v1.12.11 reglas de accesos (F1-F3/D1-D3): se evalúan ANTES de
        // trazar y SOLO con ubicación real (el origen provisional Pío Nono
        // está dentro del cerro y falsearía «estás fuera/dentro»). Los
        // destinos predefinidos (capa Rutas) siguen su propio trazado.
        if (!(d as NavDestPreset).preset) {
          const dec = evaluarRuta(origin, d.position);
          if (dec.tipo === "popupAcceso") {
            const pref = prefAccesoSesion();
            if (pref) {
              await compute(origin, d, "gps", false, pref === "ingresar" ? { ingresoExtendido: true } : { sinIngresar: true });
              return;
            }
            setLoading(false);
            setNote(null);
            setDecision({ tipo: "popupAcceso", d, gate: dec.gate, origen: origin });
            return;
          }
          if (dec.tipo === "popupSalida") {
            setLoading(false);
            setNote(null);
            setDecision({ tipo: "popupSalida", d, gateMio: dec.gateMio, gateDest: dec.gateDest, origen: origin });
            return;
          }
          if (dec.tipo === "salidaPor") {
            await compute(origin, d, "gps", false, { salidaPor: dec.gate.position, salidaNombre: dec.gate.name });
            return;
          }
          if (dec.tipo === "sinIngresar") {
            await compute(origin, d, "gps", false, { sinIngresar: true });
            return;
          }
          if (dec.tipo === "ingresarExtendido") {
            await compute(origin, d, "gps", false, { ingresoExtendido: true });
            return;
          }
          // "trazar": continúa el flujo normal abajo
        }
        await compute(origin, d, "gps");
      })();
    },
    [compute]
  );

  // v1.12.11: resolución del popup. «recordar» guarda la preferencia de
  // la sesión (solo popup F3): las próximas rutas a accesos se trazan
  // directo sin volver a preguntar.
  const resolverDecision = useCallback(
    (opcion: OpcionRuta, recordar = false) => {
      const dec = decision;
      if (!dec) return;
      setDecision(null);
      void (async () => {
        const origin = dec.origen;
        posRef.current = origin;
        if (dec.tipo === "popupAcceso") {
          if (recordar) guardarPrefAccesoSesion(opcion === "ingresar" ? "ingresar" : "portería");
          await compute(origin, dec.d, "gps", false, opcion === "ingresar" ? { ingresoExtendido: true } : { sinIngresar: true });
          return;
        }
        const g = opcion === "salidaMia" ? dec.gateMio : dec.gateDest;
        await compute(origin, dec.d, "gps", false, { salidaPor: g.position, salidaNombre: g.name });
      })();
    },
    [decision, compute]
  );

  const cancelarDecision = useCallback(() => {
    setDecision(null);
    setDest(null);
    setNote(null);
  }, []);

  const reroute = useCallback(() => {
    const o = posRef.current;
    const d = destRef.current;
    if (o && d) void compute(o, d, "gps", true);
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

  // Re-anclaje del origen en planificación: si la ruta vigente se calculó
  // desde un punto LEJOS de donde estás AHORA (primer fix malo del GPS
  // ambiental -a veces cae a ~200 m, p.ej. sobre la ciclovía- o caminaste
  // después de trazar), recalcula desde tu posición fresca. Así la ruta
  // SIEMPRE nace en tu pin. Solo sin ride: en marcha los desvíos los
  // maneja el recálculo por desvío (>140 m) y el intervalo de 30 s.
  useEffect(() => {
    if (!position || running || loading) return;
    const d = destRef.current;
    const origin = originUsedRef.current;
    if (!d || !route || !origin) return;
    if (Date.now() - lastCalcRef.current < 5000) return;
    if (haversineM(position, origin) <= REANCHOR_M) return;
    const t = setTimeout(() => {
      void compute(position, d, "gps");
    }, 0);
    return () => clearTimeout(t);
  }, [position, route, running, loading, compute]);

  // Recálculo periódico mientras hay ride activo (recalculo por desvío:
  // empalma al trazado, no reinicia desde el comienzo).
  useEffect(() => {
    if (!running || !dest) return;
    const iv = setInterval(() => {
      const o = posRef.current;
      if (o) void compute(o, destRef.current!, "gps", true);
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
      if (o && d) void compute(o, d, "gps", true);
    }, 800);
    return () => clearTimeout(t);
  }, [position, route, running, dest, compute]);

  const clearNote = useCallback(() => setNote(null), []);

  return {
    net: null,
    dest,
    route,
    note,
    loading,
    provisional,
    decision,
    setDestination,
    reroute,
    clearNote,
    resolverDecision,
    cancelarDecision,
  };
}
