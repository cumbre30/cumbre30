"use client";

// ============================================================
// Editor de rutas (fase B del módulo Rutas y Comunidad,
// arquitectura v2.1 tabla 6 «B. Creación y edición»): máquina de
// estados del botón «Crear ruta» del mapa grande.
//
// · Geometría: trazado MULTI-WAYPOINT (cada tap añade un punto de
//   decisión y el motor traza la pierna desde el anterior — el
//   mismo computeRoute del buscador), importar GPX (la línea del
//   archivo se respeta tal cual) o crear desde actividad (una
//   traza existente copiada 1:1 desde el panel Mis trazados).
// · POIs: modo «agregar en el mapa» (tap → formulario) y lista.
// · Elevación: null cuando no hay fuente (§5.1 — «sin datos»,
//   jamás 0); con GPX, gainM real y eleFuente 'gpx'.
// · Borradores: se guardan en c30.rutas-v2 con status 'borrador';
//   se pueden seguir editando (guardar otra vez) y exportar GPX.
// · Dificultad: sugerencia orientativa recalculada al cambiar
//   geometría/atributos, que NUNCA sobrescribe el valor ajustado
//   por el creador (dificultadOrigen, §5.2).
// El creador de TRAZADOS vigente (useCreadorTrazas) no se toca:
// los rides/segmentos siguen su flujo sin cambios de conducta.
// ============================================================

import { useCallback, useMemo, useRef, useState } from "react";
import { computeRoute } from "@/lib/routingService";
import { haversineM, type LatLng } from "@/lib/routing";
import { parseGpxLine } from "@/lib/gpx";
import { rutasStore, type RutaV2 } from "@/lib/rutasStore";
import {
  agregarPoi as agregarPoiEnLista,
  borradorDesdeTraza,
  borradores,
  nuevoBorrador,
  ordenarPois,
  type MetadatosBorrador,
  type PoiEntrada,
} from "@/lib/rutasBorrador";
import { aplicarSugerencias, sugerirDificultad, type Modalidad } from "@/lib/dificultad";
import { t } from "@/lib/i18n";

export type FaseEditor = "puntos" | "calculando" | "editando";

/** Concatena una pierna nueva al trazado (sin duplicar el punto de
 *  unión) y suma su distancia. Función pura, probada en node. */
export function sumarPierna(
  previo: LatLng[],
  pierna: LatLng[],
): { coords: LatLng[]; distM: number } {
  const coords = [...previo];
  for (const c of pierna) {
    const prev = coords[coords.length - 1];
    if (prev && haversineM(prev, c) < 1) continue; // punto de unión repetido
    coords.push(c);
  }
  let distM = 0;
  for (let i = Math.max(1, previo.length); i < coords.length; i++) {
    distM += haversineM(coords[i - 1], coords[i]);
  }
  return { coords, distM };
}

export function useEditorRutas() {
  const [activo, setActivo] = useState(false);
  const [fase, setFase] = useState<FaseEditor>("puntos");
  const [waypoints, setWaypoints] = useState<LatLng[]>([]);
  const [coords, setCoords] = useState<LatLng[]>([]);
  const [distKm, setDistKm] = useState(0);
  const [gainM, setGainM] = useState<number | null>(null);
  const [eleFuente, setEleFuente] = useState<"gpx" | "servicio" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [aviso, setAvisoInterno] = useState<string | null>(null);
  const [modoPoi, setModoPoi] = useState(false);
  const [poiPendiente, setPoiPendiente] = useState<LatLng | null>(null);
  const [pois, setPois] = useState<PoiEntrada[]>([]);
  // Metadatos del borrador en edición (el panel los pinta).
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [modalidad, setModalidad] = useState<Modalidad>("pavimento");
  const [attrs, setAttrs] = useState<string[]>([]);
  const [dificultadFisica, setDificultadFisica] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [dificultadTecnica, setDificultadTecnica] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [dificultadOrigen, setDificultadOrigen] = useState<"auto" | "creador">("auto");
  // Cita de la última consulta: si se cancela mientras el motor
  // calcula, la respuesta tardía no debe restaurar nada.
  const generaRef = useRef(0);

  const sugerencia = useMemo(
    () => sugerirDificultad({ distKm, gainM, modalidad, attrs }),
    [distKm, gainM, modalidad, attrs],
  );

  const reset = useCallback(() => {
    generaRef.current++;
    setActivo(false);
    setFase("puntos");
    setWaypoints([]);
    setCoords([]);
    setDistKm(0);
    setGainM(null);
    setEleFuente(null);
    setErr(null);
    setModoPoi(false);
    setPoiPendiente(null);
    setPois([]);
    setEditandoId(null);
    setNombre("");
    setDescripcion("");
    setModalidad("pavimento");
    setAttrs([]);
    setDificultadFisica(1);
    setDificultadTecnica(1);
    setDificultadOrigen("auto");
  }, []);

  /** Activa el editor (botón «Crear ruta» del mapa). */
  const empezar = useCallback(() => {
    reset();
    setActivo(true);
  }, [reset]);

  /** Recalcula la dificultad vigente según el origen (§5.2):
   *  'auto' sigue la sugerencia; 'creador' se conserva. */
  const refrescarDificultad = useCallback(
    (datos: { distKm: number; gainM: number | null; modalidad: Modalidad; attrs: string[]; fisica: 1 | 2 | 3 | 4 | 5; tecnica: 1 | 2 | 3 | 4 | 5; origen: "auto" | "creador" }) => {
      const nueva = aplicarSugerencias(
        { fisica: datos.fisica, tecnica: datos.tecnica, origen: datos.origen },
        { distKm: datos.distKm, gainM: datos.gainM, modalidad: datos.modalidad, attrs: datos.attrs },
      );
      setDificultadFisica(nueva.fisica);
      setDificultadTecnica(nueva.tecnica);
      setDificultadOrigen(nueva.origen);
    },
    [],
  );

  /** Tap en el mapa con el editor activo: añade un waypoint (y
   *  traza la pierna desde el anterior) o un POI si modoPoi. */
  const pick = useCallback(
    (p: LatLng) => {
      if (!activo) return;
      if (modoPoi && fase === "editando") {
        setPoiPendiente(p);
        setModoPoi(false);
        return;
      }
      if (fase !== "puntos") return;
      setErr(null);
      const prev = waypoints;
      if (prev.length === 0) {
        // Primer waypoint: sin pierna todavía.
        setWaypoints([p]);
        setCoords([p]);
        return;
      }
      const g = ++generaRef.current;
      setFase("calculando");
      void (async () => {
        try {
          const res = await computeRoute(prev[prev.length - 1], p);
          if (g !== generaRef.current) return; // cancelado mientras calculaba
          if (!res.route) {
            setFase("puntos");
            setErr(res.error ?? t("tra.errorMotor"));
            return;
          }
          const { coords: nuevas, distM } = sumarPierna(coords, res.route.coords);
          setAvisoInterno(res.aviso ?? null);
          setCoords(nuevas);
          setDistKm((d) => d + distM / 1000);
          setWaypoints((w) => [...w, p]);
          // gainM del motor es desconocido: mantener null salvo GPX.
          setFase("puntos");
        } catch {
          if (g !== generaRef.current) return;
          setFase("puntos");
          setErr(t("tra.errorMotor"));
        }
      })();
    },
    [activo, modoPoi, fase, waypoints, coords],
  );

  /** Confirma la geometría trazada y abre el formulario. */
  const listo = useCallback(() => {
    if (coords.length < 2) {
      setErr(t("edi.minimoPuntos"));
      return;
    }
    setErr(null);
    setFase("editando");
    const sug = sugerirDificultad({ distKm, gainM, modalidad, attrs });
    setDificultadFisica(sug.fisica);
    setDificultadTecnica(sug.tecnica);
    setDificultadOrigen("auto");
  }, [coords.length, distKm, gainM, modalidad, attrs]);

  /** Importa un GPX: la línea del archivo se respeta tal cual. */
  const importarGpx = useCallback(
    (file: File) => {
      if (!activo) return;
      setErr(null);
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
          const gain = linea.gainM > 0 ? linea.gainM : null;
          setCoords(linea.pts);
          setWaypoints([]);
          setDistKm(linea.distKm);
          setGainM(gain);
          setEleFuente(gain != null ? "gpx" : null);
          setFase("editando");
          const sug = sugerirDificultad({ distKm: linea.distKm, gainM: gain, modalidad, attrs });
          setDificultadFisica(sug.fisica);
          setDificultadTecnica(sug.tecnica);
          setDificultadOrigen("auto");
        })
        .catch(() => {
          if (g !== generaRef.current) return;
          setFase("puntos");
          setErr(t("tra.gpxInvalido"));
        });
    },
    [activo, modalidad, attrs],
  );

  /** «Crear desde actividad»: traza existente copiada 1:1. */
  const desdeActividad = useCallback(
    (traza: { nombre: string; coords: LatLng[]; distKm: number; gainM: number; origen: "motor" | "gpx" }) => {
      reset();
      setActivo(true);
      const b = borradorDesdeTraza(traza);
      setCoords(b.coords);
      setWaypoints(b.waypoints ? b.waypoints.map((w) => ({ lat: w.lat, lon: w.lon })) : []);
      setDistKm(b.distKm);
      setGainM(b.gainM);
      setEleFuente(b.eleFuente ?? null);
      setNombre(b.nombre);
      setFase("editando");
      const sug = sugerirDificultad({ distKm: b.distKm, gainM: b.gainM, modalidad, attrs: [] });
      setDificultadFisica(sug.fisica);
      setDificultadTecnica(sug.tecnica);
      setDificultadOrigen("auto");
    },
    [reset, modalidad],
  );

  /** Continúa la edición de un borrador guardado. */
  const editarBorrador = useCallback((id: string) => {
    const r = rutasStore.get().find((x) => x.id === id && x.status === "borrador");
    if (!r) return;
    reset();
    setActivo(true);
    generaRef.current++;
    setEditandoId(id);
    setCoords(r.coords);
    setWaypoints((r.waypoints ?? []).map((w) => ({ lat: w.lat, lon: w.lon })));
    setDistKm(r.distKm);
    setGainM(r.gainM);
    setEleFuente(r.eleFuente ?? null);
    setPois(r.pois ?? []);
    setNombre(r.nombre);
    setDescripcion(r.descripcion ?? "");
    setModalidad(r.modalidad ?? "pavimento");
    setAttrs(r.attrs ?? []);
    setDificultadFisica(r.dificultadFisica ?? 1);
    setDificultadTecnica(r.dificultadTecnica ?? 1);
    setDificultadOrigen(r.dificultadOrigen ?? "auto");
    setFase("editando");
  }, []);

  /** Modo «agregar POI en el mapa» (solo en edición). */
  const empezarPoi = useCallback(() => {
    if (fase !== "editando") return;
    setModoPoi(true);
    setErr(null);
  }, [fase]);

  /** Confirma el POI pendiente con los datos del formulario. */
  const confirmarPoi = useCallback(
    (datos: { tipo: string; nombre: string; nota?: string }) => {
      if (!poiPendiente) return;
      setPois((prev) => agregarPoiEnLista(prev, { ...datos, lat: poiPendiente.lat, lon: poiPendiente.lon }));
      setPoiPendiente(null);
    },
    [poiPendiente],
  );

  const descartarPoiPendiente = useCallback(() => setPoiPendiente(null), []);

  const quitarPoi = useCallback((id: string) => {
    setPois((prev) => ordenarPois(prev.filter((p) => p.id !== id)));
  }, []);

  /** El creador ajusta una escala a mano: origen pasa a 'creador'. */
  const ajustarDificultad = useCallback((fisica: 1 | 2 | 3 | 4 | 5, tecnica: 1 | 2 | 3 | 4 | 5) => {
    setDificultadFisica(fisica);
    setDificultadTecnica(tecnica);
    setDificultadOrigen("creador");
  }, []);

  /** Vuelve a la sugerencia automática (deshace el ajuste manual). */
  const usarSugerencia = useCallback(() => {
    setDificultadFisica(sugerencia.fisica);
    setDificultadTecnica(sugerencia.tecnica);
    setDificultadOrigen("auto");
  }, [sugerencia]);

  /** Guarda el borrador (nuevo o existente). Devuelve el guardado. */
  const guardar = useCallback(
    (m?: Partial<MetadatosBorrador>): RutaV2 | null => {
      const n = (m?.nombre ?? nombre).trim();
      if (!n) {
        setErr(t("edi.nombreRequerido"));
        return null;
      }
      const metadatos: MetadatosBorrador = {
        nombre: n,
        descripcion: m?.descripcion ?? descripcion,
        modalidad: m?.modalidad ?? modalidad,
        attrs: m?.attrs ?? attrs,
        dificultadFisica: m?.dificultadFisica ?? dificultadFisica,
        dificultadTecnica: m?.dificultadTecnica ?? dificultadTecnica,
        dificultadOrigen: m?.dificultadOrigen ?? dificultadOrigen,
        pois: m?.pois ?? pois,
      };
      let guardado: RutaV2 | null = null;
      if (editandoId) {
        guardado = borradores.actualizarBorrador(editandoId, {
          ...metadatos,
          coords,
          distKm,
          gainM,
          eleFuente,
          waypoints,
        });
      } else {
        guardado = borradores.guardarBorrador(
          nuevoBorrador({
            nombre: metadatos.nombre,
            descripcion: metadatos.descripcion,
            coords,
            distKm,
            gainM,
            eleFuente,
            waypoints,
            modalidad: metadatos.modalidad,
            attrs: metadatos.attrs,
            dificultadFisica: metadatos.dificultadFisica,
            dificultadTecnica: metadatos.dificultadTecnica,
            dificultadOrigen: metadatos.dificultadOrigen,
            pois: metadatos.pois,
          }),
        );
      }
      reset();
      return guardado;
    },
    [nombre, descripcion, modalidad, attrs, dificultadFisica, dificultadTecnica, dificultadOrigen, pois, editandoId, coords, distKm, gainM, eleFuente, waypoints, reset],
  );

  return {
    activo,
    fase,
    waypoints,
    coords,
    distKm,
    gainM,
    eleFuente,
    err,
    aviso,
    sugerencia,
    modoPoi,
    poiPendiente,
    pois,
    editandoId,
    nombre,
    descripcion,
    modalidad,
    attrs,
    dificultadFisica,
    dificultadTecnica,
    dificultadOrigen,
    empezar,
    pick,
    listo,
    importarGpx,
    desdeActividad,
    editarBorrador,
    guardar,
    empezarPoi,
    confirmarPoi,
    descartarPoiPendiente,
    quitarPoi,
    ajustarDificultad,
    usarSugerencia,
    setNombre,
    setDescripcion,
    setModalidad,
    setAttrs,
    cancelar: reset,
  };
}

export type EditorRutas = ReturnType<typeof useEditorRutas>;
