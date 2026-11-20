"use client";

// ============================================================
// Creador de trazados (v1.13.15): máquina de estados del botón
// «Trazar ruta» y «Trazar segmento» del mapa grande.
//
// · RUTA: 1er tap → popup con 2 opciones: «Ruta hacia aquí»
//   (motor traza desde tu ubicación actual) o «Ruta desde aquí»
//   (2º tap = fin; el motor traza inicio→fin). Vista previa con
//   minimapa, confirmación, nombre y guardado.
// · SEGMENTO: 2 taps (inicio y fin) y el motor traza; también
//   acepta importar un GPX (la línea se lee y se simplifica tal
//   cual - es la información del archivo). Los segmentos se
//   asocian a las estadísticas (intentos sobre tus viajes GPS).
// El motor es el mismo del buscador: grafo OSM local del cerro u
// OSRM bici para el resto de Santiago (routingService).
// ============================================================

import { useCallback, useRef, useState } from "react";
import { computeRoute } from "@/lib/routingService";
import { haversineM, type LatLng } from "@/lib/routing";
import { addTraza, type TrazaGuardada } from "@/lib/trazasUsuario";
import { parseGpxLine } from "@/lib/gpx";
import { t } from "@/lib/i18n";

export type TrazaPreview = {
  kind: "ruta" | "segmento";
  coords: LatLng[];
  distKm: number;
  gainM: number;
  origen: "motor" | "gpx";
};

export type FaseTrazado = "puntos" | "calculando" | "preview";

export function useCreadorTrazas() {
  const [modo, setModo] = useState<"ruta" | "segmento" | null>(null);
  const [picks, setPicks] = useState<LatLng[]>([]);
  const [fase, setFase] = useState<FaseTrazado>("puntos");
  const [preview, setPreview] = useState<TrazaPreview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Ruta «desde aquí»: el primer tap es el INICIO y se espera el
  // segundo tap (fin); el popup de opciones ya no se re-muestra.
  const [desdeAqui, setDesdeAqui] = useState(false);
  // Cita de la última consulta: si el usuario cancela mientras el
  // motor calcula, la respuesta tardía no debe restaurar el modo.
  const generaRef = useRef(0);

  const cancelar = useCallback(() => {
    generaRef.current++;
    setModo(null);
    setPicks([]);
    setFase("puntos");
    setPreview(null);
    setErr(null);
    setAviso(null);
    setDesdeAqui(false);
  }, []);

  /** Activa el modo de trazado (botón del mapa). */
  const empezar = useCallback((m: "ruta" | "segmento") => {
    generaRef.current++;
    setModo((prev) => (prev === m ? null : m));
    setPicks([]);
    setFase("puntos");
    setPreview(null);
    setErr(null);
    setAviso(null);
  }, []);

  /** Traza con el motor (inicio → fin) y deja la vista previa. */
  const trazar = useCallback(async (kind: "ruta" | "segmento", from: LatLng, to: LatLng) => {
    const g = ++generaRef.current;
    setFase("calculando");
    setErr(null);
    setAviso(null);
    try {
      const res = await computeRoute(from, to);
      if (g !== generaRef.current) return; // cancelado mientras calculaba
      if (!res.route) {
        setFase("puntos");
        setErr(res.error ?? t("tra.errorMotor"));
        // «Desde aquí»: se conserva el inicio para reintentar el fin.
        if (kind === "ruta") setPicks((prev) => (prev.length > 1 ? [prev[0]] : prev));
        return;
      }
      const coords = res.route.coords;
      const distM = coords.reduce((acc, c, i) => (i === 0 ? 0 : acc + haversineM(coords[i - 1], c)), 0);
      setAviso(res.aviso ?? null);
      setPreview({
        kind,
        coords,
        distKm: distM / 1000,
        gainM: 0, // el grafo no trae elevación; el desnivel real sale de la pista GPS en los intentos
        origen: "motor",
      });
      setFase("preview");
    } catch {
      if (g !== generaRef.current) return;
      setFase("puntos");
      setErr(t("tra.errorMotor"));
      if (kind === "ruta") setPicks((prev) => (prev.length > 1 ? [prev[0]] : prev));
    }
  }, []);

  /** Tap en el mapa con el modo activo. Con el 2º punto el motor
   *  traza solo (ruta «desde aquí» y segmento; «hacia aquí» lo
   *  dispara el botón del popup). */
  const pick = useCallback(
    (p: LatLng) => {
      if (!modo || fase !== "puntos") return;
      setErr(null);
      const prev = picks;
      if (prev.length === 0) {
        setPicks([p]);
        return;
      }
      if (prev.length === 1) {
        // trazado desde el handler del evento (no desde un efecto:
        // regla react-hooks/set-state-in-effect).
        void trazar(modo, prev[0], p);
        return;
      }
    },
    [modo, fase, picks, trazar],
  );

  /** «Ruta hacia aquí»: desde la ubicación actual hasta el punto elegido. */
  const elegirHaciaAqui = useCallback(
    (desde: LatLng | null) => {
      if (!modo || picks.length === 0) return;
      if (!desde) {
        setErr(t("tra.sinGps"));
        return;
      }
      void trazar("ruta", desde, picks[0]);
    },
    [modo, picks, trazar],
  );

  /** «Ruta desde aquí»: el punto elegido es el inicio; espera el fin. */
  const elegirDesdeAqui = useCallback(() => {
    setErr(null);
    setAviso(null);
    setFase("puntos");
    setDesdeAqui(true);
  }, []);

  /** Importa un GPX (segmento): la línea del archivo se respeta. */
  const subirGpx = useCallback(
    (file: File) => {
      if (modo !== "segmento") return;
      setErr(null);
      setAviso(null);
      const g = ++generaRef.current;
      setFase("calculando");
      file
        .text()
        .then((xml) => {
          if (g !== generaRef.current) return;
          const linea = parseGpxLine(xml);
          if (!linea || linea.pts.length < 2) {
            setFase("puntos");
            setErr(t("tra.gpxInvalido"));
            return;
          }
          setPreview({
            kind: "segmento",
            coords: linea.pts,
            distKm: linea.distKm,
            gainM: linea.gainM,
            origen: "gpx",
          });
          setFase("preview");
        })
        .catch(() => {
          if (g !== generaRef.current) return;
          setFase("puntos");
          setErr(t("tra.gpxInvalido"));
        });
    },
    [modo],
  );

  /** Confirma y guarda con el nombre dado. Devuelve el traza guardado. */
  const guardar = useCallback(
    (nombre: string): TrazaGuardada | null => {
      if (!preview) return null;
      const guardado = addTraza({
        kind: preview.kind,
        nombre,
        coords: preview.coords,
        distKm: preview.distKm,
        gainM: preview.gainM,
        origen: preview.origen,
      });
      cancelar();
      return guardado;
    },
    [preview, cancelar],
  );

  return {
    modo,
    picks,
    desdeAqui,
    fase,
    preview,
    err,
    aviso,
    empezar,
    pick,
    elegirHaciaAqui,
    elegirDesdeAqui,
    cancelar,
    subirGpx,
    guardar,
  };
}

export type CreadorTrazas = ReturnType<typeof useCreadorTrazas>;
