"use client";

// ============================================================
// useRideEngine - adaptador del MOTOR GPS al producto Cumbre30.
// ------------------------------------------------------------
// Fase única (2026-11-22): el núcleo de captura, procesamiento,
// métricas y sesión vive en src/motor/* (agnóstico de React y del
// parque, reutilizable). Este hook es el CONSUMIDOR:
//   · inyecta la fuente (nativa/web/sim) y el modo ahorro;
//   · aplica las reglas del parque San Cristóbal sobre los eventos
//     del motor (geocercia, accesos, zonas, corredores, bajadas 30,
//     horario, fiscalización 30 km/h, caída, vehículo);
//   · publica el estado a la UI de React.
// El motor ya no contiene reglas del producto ni del parque.
//
// Correcciones de la auditoría integradas en el núcleo:
//   P0-1 checkpoint + recuperación de ride (motor/persistencia),
//   P0-2 banda muerta de distancia (motor/metricas),
//   P0-3 altitud nunca 0 + calidad vertical (fuente + metricas),
//   P0-4 histéresis de desnivel (motor/metricas),
//   P0-5 tiempos por reloj (motor/metricas + actividad),
//   P1-1 pausa/reanudación automáticas (motor/actividad),
//   P1-9 Kalman adaptativo + extrapolación de frenada (motor/kalman).
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAUTION_KMH,
  GATES,
  LIMIT_KMH,
  PARK_POLYGON,
  RISK_ZONES,
  type LatLng,
} from "@/lib/park";
import { haversineM, bearingDeg, pointInPolygon, distToPolygonM } from "@/lib/geo";
import { PARK_HOURS } from "@/lib/park";
import { estadoParque, minutosParaCierre, cierraHoraTexto } from "@/lib/horario";
import { GATE_PIO_NONO, PUENTE_TUPAHUE_CUMBRE, enCorredorPioNono } from "@/lib/reglasParque";
import { alerts } from "@/lib/alertEngine";
import { FallDetector, fallConfigOn } from "@/lib/fallDetect";
import { saltarFix, wakeLockSuspendido } from "@/lib/rideBateria";
import { t, vozHoraCierre, vozHoras } from "@/lib/i18n";
import { RideNative, isNativeApp } from "@/lib/rideNative";
import { saveRide, type RideSummary, type TrackPt } from "@/lib/history";
import { computeRideMetrics } from "@/lib/rideMetrics";
import { getRideWeights } from "@/lib/rideWeights";
import { augmentRideOffRoad } from "@/lib/rideOffroad";
import { isMotorizedRide, VEH_LIMIT_KMH, VEH_STREAK_SEC, VEH_TOTAL_SEC } from "@/lib/vehicleDetect";
import { syncRideAfterSave, markRideAsBike } from "@/lib/sync";
import { rutaProyectadaStore, conRouteRef } from "@/lib/rutaProyectada";
import { MotorGPS } from "@/motor/nucleo";
import { crearFuenteNativa, crearFuenteWeb, crearFuenteSim } from "@/lib/fuentes-motor";
import { autoPausaActivada, leerConfigMotor } from "@/lib/motorPerfil";
import { crearAlmacenDuradero, type AlmacenDuradero } from "@/lib/almacenDuradero";
import type { EventoMotor, FixBruto } from "@/motor/tipos";

export type SpeedState = "ok" | "caution" | "over";
export type RideStatus = "idle" | "running" | "paused";
export type Source = "gps" | "sim";

export type RideEvent = {
  t: number;
  kind: "info" | "warn" | "danger" | "zone" | "gate";
  text: string;
};

export type GpsStatus = "idle" | "requesting" | "active" | "denied" | "error";

/** Ride interrumpido (checkpoint) que puede retomarse tras un cierre
 *  inesperado del WebView o del proceso Android. */
export type RecuperacionPendiente = {
  fecha: number;
  distanciaKm: number;
  elapsedMin: number;
  fuente: "nativa" | "web" | "sim";
};

const TICK_MS = 500;

function pushEvent(list: RideEvent[], ev: RideEvent): RideEvent[] {
  return [...list.slice(-40), ev];
}

/** Zona de riesgo → clave de voz i18n (los nombres propios quedan en park.ts). */
const ZONA_KEY: Record<string, string> = {
  "anahuac": "zona.anahuac",
  "antiluen": "zona.antiluen",
  "jardin-japones": "zona.jardinJapones",
  "salida-pv": "zona.salidaPv",
  "zoologico": "zona.zoologico",
};

/** Contadores del CONSUMIDOR (reglas del parque) que viajan en el
 *  checkpoint del motor para sobrevivir a una recuperación. */
type ExtrasParque = {
  overSec: number;
  maxInParkKmh: number | null;
  parkDistanceM: number;
  vehSec: number;
  vehStreakMax: number;
  limiteEstado: SpeedState;
  dentro: boolean;
};

export function useRideEngine() {
  const [status, setStatus] = useState<RideStatus>("idle");
  const [source, setSource] = useState<Source>("sim");
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [course, setCourse] = useState<number | null>(null); // rumbo nativo del GPS (v1.12.8)
  const [speedKmh, setSpeedKmh] = useState(0);
  const [maxKmh, setMaxKmh] = useState(0);
  const [avgKmh, setAvgKmh] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [gainM, setGainM] = useState(0);
  const [slopePct, setSlopePct] = useState(0);
  const [insidePark, setInsidePark] = useState(false);
  const [speedState, setSpeedState] = useState<SpeedState>("ok");
  const [overLimitSec, setOverLimitSec] = useState(0);
  const [maxInParkKmh, setMaxInParkKmh] = useState<number | null>(null);
  const [events, setEvents] = useState<RideEvent[]>([]);
  const [track, setTrack] = useState<LatLng[]>([]);
  const [position, setPosition] = useState<LatLng | null>(null);
  // Auto-pausa (fase única): el ride sigue "running" pero la FSM del
  // motor lo marcó detenido; la UI muestra el chip correspondiente.
  const [autoPausada, setAutoPausada] = useState(false);
  // Ride sospechoso de vehículo esperando la confirmación del usuario
  // ("¿fuiste en bici?"). Ya está guardado (con el flag) y sincronizado:
  // esta confirmación solo corrige el flag si fue falso positivo.
  const [pendingConfirm, setPendingConfirm] = useState<RideSummary | null>(null);
  const pendingRef = useRef<RideSummary | null>(null);
  useEffect(() => { pendingRef.current = pendingConfirm; }, [pendingConfirm]);
  // Detección de caída: alerta viva para el overlay "¿Estás bien?"
  // (se renderiza a nivel de app en page.tsx).
  const [fallAlert, setFallAlert] = useState<{ at: number; help: boolean } | null>(null);
  // Fase F (v2.1 §8): resumen del ride recién cerrado — con routeRef
  // cuando había una ruta proyectada al cerrar. Solo alimenta el
  // prompt de experiencia post-ride; el ride mismo no cambia.
  const [resumenCerrado, setResumenCerrado] = useState<RideSummary | null>(null);
  // Recuperación de ride interrumpido (checkpoint del motor).
  const [recuperacion, setRecuperacion] = useState<RecuperacionPendiente | null>(null);

  // --- refs del consumidor (reglas del parque) ---
  const park = useRef({
    lastFix: null as FixBruto | null, // fix aceptado previo (deltas del parque)
    parkDistanceM: 0,
    overSec: 0,
    inside: false,
    state: "ok" as SpeedState,
    zoneLastTrigger: {} as Record<string, number>,
    gateLastTrigger: {} as Record<string, number>,
    // Huella de vehículo motorizado: ver lib/vehicleDetect.
    vehSec: 0,
    vehStreakSec: 0,
    vehStreakMax: 0,
    vehNotified: false,
    // Reglas direccionales del cliente (2026-11-12).
    pioPrevD: null as number | null,
    pioStreak: 0,
    pioStreakD: null as number | null,
    pioLastTrigger: 0,
    puentePrevD: null as number | null,
    puenteStreak: 0,
    puenteStreakD: null as number | null,
    puenteLastTrigger: 0,
    // Bajadas fiscalizadas + horario al límite (2026-11-13).
    b30Mod: null as typeof import("@/lib/bajadas30") | null,
    b30LastTrigger: {} as Record<string, number>,
    horarioLastCheck: 0,
    horarioVoiceLast: {} as Record<string, number>,
    // Detección de caída (GPS).
    fall: new FallDetector(),
  });

  // --- motor (núcleo reutilizable) ---
  const motorRef = useRef<MotorGPS | null>(null);
  const fuenteRef = useRef<{ tipo: "nativa" | "web" | "sim" } | null>(null);
  // Almacén DURADERO del checkpoint (localStorage + espejo nativo por
  // Filesystem). Cierre de fase única: la app INYECTA su persistencia
  // al motor — el contrato AlmacenCheckpoint no cambia.
  const almacenRef = useRef<AlmacenDuradero | null>(null);
  function getAlmacen(): AlmacenDuradero {
    if (!almacenRef.current) almacenRef.current = crearAlmacenDuradero();
    return almacenRef.current;
  }
  function getMotor(): MotorGPS {
    if (!motorRef.current) {
      // Perfil de actividad del consumidor (Cumbre30) inyectado como
      // config parcial; defectos = comportamiento histórico del motor.
      motorRef.current = new MotorGPS({ config: leerConfigMotor(), almacen: getAlmacen() });
      motorRef.current.on((e) => eventoRef.current(e));
    }
    return motorRef.current;
  }

  const logEvent = useCallback((kind: RideEvent["kind"], text: string) => {
    setEvents((prev) => pushEvent(prev, { t: Date.now(), kind, text }));
  }, []);

  const dismissFall = useCallback(() => {
    setFallAlert(null);
    logEvent("info", t("log.caidaBien"));
  }, [logEvent]);
  const requestFallHelp = useCallback(() => {
    setFallAlert((prev) => (prev ? { ...prev, help: true } : prev));
    logEvent("danger", t("log.caidaAyuda"));
  }, [logEvent]);

  /** Contadores del parque actuales (para el checkpoint del motor). */
  const extrasParque = useCallback((): ExtrasParque => {
    const p = park.current;
    return {
      overSec: p.overSec,
      maxInParkKmh: maxInParkRef.current,
      parkDistanceM: p.parkDistanceM,
      vehSec: p.vehSec,
      vehStreakMax: p.vehStreakMax,
      limiteEstado: p.state,
      dentro: p.inside,
    };
  }, []);

  /** Reglas del PARQUE sobre un fix validado del motor. Todo lo que
   *  depende del producto vive aquí; el núcleo no sabe nada de esto. */
  const reglasParque = useCallback((fix: FixBruto, velKmh: number, dtSec: number, pendientePct: number) => {
    const p = park.current;
    const e = getMotor();

    // Rumbo (v1.12.8): bearing nativo con avance ≥4 km/h; en web,
    // derivado por delta con avance real (≥4 km/h y ≥3 m).
    const previo = p.lastFix;
    let course: number | null = null;
    if (fix.bearing !== null && velKmh >= 4) course = fix.bearing;
    else if (!fix.bearing && previo && velKmh >= 4) {
      const dd = haversineM(previo, fix);
      if (dd >= 3) course = bearingDeg(previo, fix);
    }
    setCourse(course);

    // PAUSA (manual o auto): el GPS sigue vivo pero no se acumula ni
    // se avisa. Solo posición/precisión y continuidad del fix previo.
    if (e.estado === "pausada") {
      setAccuracyM(fix.accuracyM);
      setPosition(fix);
      p.lastFix = fix;
      return;
    }

    const dt = dtSec;

    // Vehículo motorizado (huella, decisión al guardar)
    if (velKmh > VEH_LIMIT_KMH) {
      p.vehSec += dt;
      p.vehStreakSec += dt;
      if (p.vehStreakSec > p.vehStreakMax) p.vehStreakMax = p.vehStreakSec;
      if (!p.vehNotified && (p.vehStreakMax >= VEH_STREAK_SEC || p.vehSec >= VEH_TOTAL_SEC)) {
        p.vehNotified = true;
        logEvent("warn", t("log.vehiculo"));
      }
    } else {
      p.vehStreakSec = 0;
    }

    // Geofence del parque con HISTERÉSIS (18 m al borde)
    const rawInside = pointInPolygon(fix, PARK_POLYGON);
    const dFront = distToPolygonM(fix, PARK_POLYGON);
    const GEO_HISTERESIS_M = 18;
    const inside = p.inside
      ? rawInside || dFront > GEO_HISTERESIS_M
      : rawInside && dFront > GEO_HISTERESIS_M;
    if (inside !== p.inside) {
      p.inside = inside;
      setInsidePark(inside);
      if (inside) {
        logEvent("info", t("log.ingresoParque"));
        alerts.speak("park-in", t("voz.ingresandoParque"), 4);
      } else {
        logEvent("info", t("log.salidaParque"));
        alerts.speak("park-out", t("voz.saliendoParque"), 4);
      }
    }
    if (inside && previo) {
      const dValid = haversineM(previo, fix);
      // km del parque con el mismo criterio de movimiento unificado del
      // motor (2.5 km/h): en reposo la deriva no suma km del parque.
      if (dValid < 100 && fix.accuracyM < 60 && velKmh > 2.5) {
        p.parkDistanceM += dValid;
      }
    }

    // Accesos (< 80 m) con cooldown
    for (const gate of GATES) {
      const dg = haversineM(fix, gate.position);
      const last = p.gateLastTrigger[gate.id] ?? 0;
      if (dg < 80 && fix.t - last > 120_000) {
        p.gateLastTrigger[gate.id] = fix.t;
        const cerrado = !estadoParque(new Date(fix.t)).abierto;
        if (cerrado) {
          logEvent("gate", t("log.cercaGateCerrado", gate.name));
          alerts.speak(`gate-${gate.id}`, t("voz.parqueCerrado"), 60);
        } else if (gate.ciclistas) {
          logEvent("gate", t("log.cercaGateCiclistas", gate.name));
          alerts.speak(`gate-${gate.id}`, t("voz.accesoExclusivo"), 60);
        } else {
          logEvent("gate", t("log.cercaGateNoBici", gate.name));
          alerts.speak(`gate-${gate.id}`, t("voz.accesoNoBici"), 60);
        }
      }
    }

    // Zonas de riesgo
    for (const zone of RISK_ZONES) {
      const dz = haversineM(fix, zone.position);
      const last = p.zoneLastTrigger[zone.id] ?? 0;
      if (dz >= zone.radiusM && dz < zone.radiusM + 100 && fix.t - last > 150_000) {
        p.zoneLastTrigger[zone.id] = fix.t;
        logEvent("zone", t("log.zona100", zone.name));
        alerts.speak(`zone-approach-${zone.id}`, t("voz.zona100", zone.name), 30);
      }
      if (dz < zone.radiusM && fix.t - last > 150_000) {
        p.zoneLastTrigger[zone.id] = fix.t;
        logEvent("zone", t("log.zonaRiesgo", zone.name));
        const zk = ZONA_KEY[zone.id];
        alerts.speak(`zone-${zone.id}`, zk ? t(zk) : zone.voice, 10);
        alerts.beepTriple();
      }
    }

    // Reglas direccionales (Pío Nono bajada / puente Tupahue)
    if (inside && velKmh > 1.5) {
      const dPio = haversineM(fix, GATE_PIO_NONO);
      const dPioPrev = p.pioPrevD;
      if (enCorredorPioNono(fix.lat, fix.lon) && dPio < 2100) {
        if (dPioPrev !== null && dPio < dPioPrev - 1) {
          p.pioStreak += 1;
          const dPioStart = p.pioStreakD ?? dPioPrev;
          if (p.pioStreak >= 3 && dPioStart - dPio >= 15 && dPio < 1500 && fix.t - p.pioLastTrigger > 180_000) {
            p.pioLastTrigger = fix.t;
            p.pioStreak = 0;
            p.pioStreakD = null;
            logEvent("warn", t("log.pioBajada"));
            alerts.speak("pio-bajada", t("voz.pioBajada"), 30);
          }
        } else if (dPioPrev !== null && dPio > dPioPrev + 1) {
          p.pioStreak = 0;
          p.pioStreakD = null;
        }
        p.pioPrevD = dPio;
      } else {
        p.pioPrevD = null;
        p.pioStreak = 0;
        p.pioStreakD = null;
      }
      if (estadoParque(new Date(fix.t)).nivel === "tupa") {
        const dPuen = haversineM(fix, PUENTE_TUPAHUE_CUMBRE);
        const dPuenPrev = p.puentePrevD;
        if (dPuen < 500) {
          if (dPuenPrev !== null && dPuen < dPuenPrev - 1) {
            p.puenteStreak += 1;
            const dPuenStart = p.puenteStreakD ?? dPuenPrev;
            if (p.puenteStreak >= 3 && dPuenStart - dPuen >= 12 && fix.t - p.puenteLastTrigger > 180_000) {
              p.puenteLastTrigger = fix.t;
              p.puenteStreak = 0;
              p.puenteStreakD = null;
              logEvent("warn", t("log.corteCumbre"));
              alerts.speak("corte-cumbre", `${t("aviso.msgTupahue")} ${t("voz.corteCumbreAlt")}`, 30);
            }
          } else if (dPuenPrev !== null && dPuen > dPuenPrev + 1) {
            p.puenteStreak = 0;
            p.puenteStreakD = null;
          }
          p.puentePrevD = dPuen;
        } else {
          p.puentePrevD = null;
          p.puenteStreak = 0;
          p.puenteStreakD = null;
        }
      } else {
        p.puentePrevD = null;
        p.puenteStreak = 0;
        p.puenteStreakD = null;
      }
    } else {
      p.pioPrevD = null;
      p.pioStreak = 0;
      p.pioStreakD = null;
      p.puentePrevD = null;
      p.puenteStreak = 0;
      p.puenteStreakD = null;
    }

    // Bajadas fiscalizadas (30 km/h) con pendiente del MOTOR
    if (inside && velKmh > 3 && pendientePct < -0.8 && p.b30Mod) {
      const hit = p.b30Mod.enBajada30(fix.lat, fix.lon);
      if (hit && fix.t - (p.b30LastTrigger[hit.id] ?? 0) > 240_000) {
        p.b30LastTrigger[hit.id] = fix.t;
        logEvent("warn", t("log.bajada30", hit.nombre));
        alerts.speak(`b30-${hit.id}`, t("voz.bajada30"), 30);
      }
    }

    // Horario al límite
    if (inside && fix.t - p.horarioLastCheck > 30_000) {
      p.horarioLastCheck = fix.t;
      const mC = minutosParaCierre(new Date(fix.t));
      if (mC <= 0) {
        if (fix.t - (p.horarioVoiceLast["cerrado"] ?? 0) > 600_000) {
          p.horarioVoiceLast["cerrado"] = fix.t;
          logEvent("danger", t("log.parqueCerrado", cierraHoraTexto()));
          alerts.speak("horario-cerrado", t("voz.parqueYaCerro", vozHoraCierre()), 60);
        }
      } else if (mC <= 30) {
        if (fix.t - (p.horarioVoiceLast["proximo"] ?? 0) > 600_000) {
          p.horarioVoiceLast["proximo"] = fix.t;
          const min5 = Math.max(5, Math.round(mC / 5) * 5);
          logEvent("warn", t("log.horarioLimite", cierraHoraTexto(), mC));
          alerts.speak("horario-proximo", t("voz.cierreProximo", vozHoraCierre(), min5), 60);
        }
      }
    }

    // Detección de caída (GPS puro): corre en corriendo Y autoPausada
    // (la inmovilidad post-golpe también pausa el motor), no en pausa manual.
    if (fallConfigOn()) {
      const trig = p.fall.update({ lat: fix.lat, lon: fix.lon, speedKmh: velKmh, t: fix.t });
      if (trig) {
        setFallAlert({ at: Date.now(), help: false });
        logEvent("danger", t("log.caidaDetectada"));
        alerts.speak("fall", t("voz.posibleCaida"), 3);
        if (isNativeApp()) {
          void RideNative.vibrate({ pattern: [0, 400, 200, 400, 200, 400], repeat: 0 }).catch(() =>
            navigator.vibrate?.([400, 200, 400])
          );
        } else {
          navigator.vibrate?.([400, 200, 400, 200, 400]);
        }
      }
    }

    // Máquina de estados de velocidad (fiscalización 30 km/h)
    let nextState: SpeedState = "ok";
    if (p.inside) {
      switch (p.state) {
        case "ok":
          nextState = velKmh >= LIMIT_KMH ? "over" : velKmh >= CAUTION_KMH ? "caution" : "ok";
          break;
        case "caution":
          if (velKmh >= LIMIT_KMH) nextState = "over";
          else if (velKmh < CAUTION_KMH - 0.6) nextState = "ok";
          else nextState = "caution";
          break;
        case "over":
          if (velKmh < LIMIT_KMH - 0.6) nextState = velKmh >= CAUTION_KMH ? "caution" : "ok";
          else nextState = "over";
          break;
      }
    }
    if (p.inside && velKmh >= LIMIT_KMH) p.overSec += dt;
    alerts.updateHaptics(p.inside && e.estado === "corriendo" ? velKmh : null);

    if (nextState !== p.state) {
      if (nextState === "caution") {
        alerts.startCaution();
        alerts.speak("caution", t("voz.precaucion", Math.round(velKmh)), 10);
        logEvent("warn", t("log.precaucion", Math.round(velKmh)));
      } else if (nextState === "over") {
        alerts.startOver();
        alerts.speak("over", t("voz.exceso"), 6);
        logEvent("danger", t("log.exceso", Math.round(velKmh)));
      } else {
        alerts.stopAll();
        if (p.state !== "ok") logEvent("info", t("log.velocidadOk"));
      }
      p.state = nextState;
      setSpeedState(nextState);
    }

    // Publicar estado de UI derivado del parque + contadores
    setOverLimitSec(p.overSec);
    if (p.inside) setMaxInParkKmh((m) => Math.max(m ?? 0, velKmh));
    // contadores del consumidor al checkpoint del motor
    e.setExtra(extrasParque());
    p.lastFix = fix;
  }, [logEvent, extrasParque]);

  /** Publicación de UI del estado del MOTOR (fixes, métricas, track). */
  const publicarMotor = useCallback((fix: FixBruto, velKmh: number, m: {
    distanciaM: number; movingSec: number; elapsedSec: number; velMaxKmh: number;
    gainM: number; pendientePct: number;
  }) => {
    setSpeedKmh(velKmh);
    setMaxKmh((mx) => Math.max(mx, velKmh));
    setAvgKmh(m.movingSec > 2 ? (m.distanciaM / m.movingSec) * 3.6 : 0);
    setDistanceKm(m.distanciaM / 1000);
    setElapsedSec(m.elapsedSec);
    setGainM(m.gainM);
    setSlopePct(m.pendientePct);
    setAccuracyM(fix.accuracyM);
    setPosition(fix);
    // Recorrido de UI (más denso que el track GPX; el GPX sale del motor)
    if (fix.accuracyM < 60) {
      setTrack((tr) => (tr.length && haversineM(tr[tr.length - 1], fix) < 2 ? tr : [...tr.slice(-6000), fix]));
    }
  }, []);

  /** Despachador de eventos del motor (referencia mutable: sin cierres
   *  obsoletos entre renders). */
  const eventoRef = useRef<(e: EventoMotor) => void>(() => undefined);
  eventoRef.current = (e: EventoMotor) => {
    switch (e.tipo) {
      case "fix": {
        publicarMotor(e.fix, e.velKmh, {
          distanciaM: e.metricas.distanciaM,
          movingSec: e.metricas.movingSec,
          elapsedSec: e.metricas.elapsedSec,
          velMaxKmh: e.metricas.velMaxKmh,
          gainM: e.metricas.gainM,
          pendientePct: e.metricas.pendientePct,
        });
        reglasParque(e.fix, e.velKmh, e.dtSec, e.metricas.pendientePct);
        break;
      }
      case "estado": {
        if (e.motivo === "auto-parada") {
          setAutoPausada(true);
          logEvent("info", t("log.autoPausa"));
        } else if (e.motivo === "auto-reanudada") {
          setAutoPausada(false);
          logEvent("info", t("log.autoReanudado"));
        }
        break;
      }
      case "alerta": {
        if (e.codigo === "senal-obsoleta") {
          setGpsStatus((s) => (s === "active" ? s : s));
        }
        break;
      }
    }
  };

  // Refs espejo para leer los máximos al guardar y al checkpointear
  const maxRef = useRef(0);
  const maxInParkRef = useRef<number | null>(null);
  useEffect(() => { maxRef.current = maxKmh; }, [maxKmh]);
  useEffect(() => { maxInParkRef.current = maxInParkKmh; }, [maxInParkKmh]);

  const resetParque = useCallback(() => {
    const p = park.current;
    p.lastFix = null;
    p.parkDistanceM = 0;
    p.overSec = 0;
    p.inside = false;
    p.state = "ok";
    p.zoneLastTrigger = {};
    p.gateLastTrigger = {};
    p.vehSec = 0;
    p.vehStreakSec = 0;
    p.vehStreakMax = 0;
    p.vehNotified = false;
    p.pioPrevD = null;
    p.pioStreak = 0;
    p.pioStreakD = null;
    p.pioLastTrigger = 0;
    p.puentePrevD = null;
    p.puenteStreak = 0;
    p.puenteStreakD = null;
    p.puenteLastTrigger = 0;
    p.b30Mod = null;
    p.b30LastTrigger = {};
    p.horarioLastCheck = 0;
    p.horarioVoiceLast = {};
    p.fall.reset();
  }, []);

  /** Fuente según origen, envuelta con el modo ahorro: el consumidor
   *  decide saltar fixes (1 de cada 2 con ahorro activo; el motor no
   *  sabe nada de batería). saltarFix consulta el estado en VIVO, así
   *  que activar/desactivar el ahorro en marcha funciona igual que
   *  antes. elapsed y distancia no se pierden: el núcleo usa el
   *  último fix aceptado como referencia del delta. */
  const crearFuente = useCallback((src: Source) => {
    const base =
      src === "sim"
        ? crearFuenteSim({ speedScale: 12, tickMs: TICK_MS })
        : isNativeApp()
          ? crearFuenteNativa()
          : crearFuenteWeb();
    fuenteRef.current = { tipo: base.tipo };
    return {
      tipo: base.tipo,
      iniciar: (entregar: (f: FixBruto) => void, err: (m: string) => void) =>
        base.iniciar((f) => {
          if (saltarFix(f.t)) return;
          entregar(f);
        }, err),
      detener: () => base.detener(),
    };
  }, []);

  const start = useCallback((src: Source) => {
    alerts.unlock();
    resetParque();
    const e = getMotor();
    // sesión previa (si la hubiese) se cierra sin guardar
    e.detener();
    setSource(src);
    setEvents([]);
    setTrack([]);
    setSpeedKmh(0);
    setMaxKmh(0);
    setAvgKmh(0);
    setDistanceKm(0);
    setElapsedSec(0);
    setGainM(0);
    setSlopePct(0);
    setInsidePark(false);
    setSpeedState("ok");
    setOverLimitSec(0);
    setMaxInParkKmh(null);
    setAccuracyM(null);
    setPosition(null);
    setFallAlert(null);
    setResumenCerrado(null);
    setAutoPausada(false);
    setStatus("running");
    setRecuperacion(null);
    logEvent("info", src === "gps" ? t("log.rideGps") : t("log.rideDemo"));
    // Corredores de las bajadas 30: carga perezosa
    void import("@/lib/bajadas30")
      .then((m) => { park.current.b30Mod = m; })
      .catch(() => { /* sin detección de bajadas esta sesión */ });
    // Aviso de horario al INICIAR
    const mInicio = minutosParaCierre();
    if (mInicio <= 0) {
      logEvent("warn", t("log.fueraHorario", t("aviso.msgCierre")));
      alerts.speak("horario-inicio", t("voz.fueraHorario", vozHoras().abre, vozHoraCierre()), 4);
    } else if (mInicio <= 30) {
      logEvent("warn", t("log.horarioInicio", cierraHoraTexto(), mInicio));
      alerts.speak("horario-inicio", t("voz.cierreProximo", vozHoraCierre(), Math.max(5, Math.round(mInicio / 5) * 5)), 4);
    }
    if (!wakeLockSuspendido()) void alerts.requestWakeLock();
    e.setExtra(extrasParque());
    e.iniciar(crearFuente(src));
  }, [logEvent, resetParque, extrasParque, crearFuente]);

  /** Retoma un ride interrumpido desde el checkpoint del motor. */
  const retomarRide = useCallback(() => {
    const e = getMotor();
    const cp = e.leerRecuperacion();
    if (!cp) return;
    resetParque();
    // restaura contadores del parque guardados en el checkpoint
    const ex = (cp.extra ?? {}) as Partial<ExtrasParque>;
    const maxInParkRest = typeof ex.maxInParkKmh === "number" ? ex.maxInParkKmh : null;
    park.current.overSec = typeof ex.overSec === "number" ? ex.overSec : 0;
    park.current.parkDistanceM = typeof ex.parkDistanceM === "number" ? ex.parkDistanceM : 0;
    park.current.vehSec = typeof ex.vehSec === "number" ? ex.vehSec : 0;
    park.current.vehStreakMax = typeof ex.vehStreakMax === "number" ? ex.vehStreakMax : 0;
    park.current.state = ex.limiteEstado === "caution" || ex.limiteEstado === "over" ? ex.limiteEstado : "ok";
    park.current.inside = ex.dentro === true;
    maxInParkRef.current = maxInParkRest;
    const src: Source = cp.fuente === "sim" ? "sim" : "gps";
    setSource(src);
    setEvents([]);
    setTrack([]);
    setSpeedKmh(0);
    setMaxKmh(cp.metricas.velMaxKmh);
    setAvgKmh(0);
    setDistanceKm(cp.metricas.distanciaM / 1000);
    setElapsedSec(cp.metricas.elapsedSec);
    setGainM(cp.metricas.gainM);
    setSlopePct(cp.metricas.pendientePct);
    setInsidePark(ex.dentro === true);
    setSpeedState(park.current.state);
    setOverLimitSec(park.current.overSec);
    setMaxInParkKmh(maxInParkRest);
    setAccuracyM(null);
    setPosition(null);
    setFallAlert(null);
    setResumenCerrado(null);
    setAutoPausada(cp.estado === "autoPausada");
    setStatus("running");
    setRecuperacion(null);
    logEvent("info", t("log.rideRetomado"));
    void import("@/lib/bajadas30")
      .then((m) => { park.current.b30Mod = m; })
      .catch(() => undefined);
    if (!wakeLockSuspendido()) void alerts.requestWakeLock();
    // track de UI desde el checkpoint
    for (const pt of cp.track) setTrack((tr) => [...tr.slice(-6000), { lat: pt[0], lon: pt[1] }]);
    e.retomar(cp, crearFuente(src));
  }, [logEvent, resetParque, crearFuente]);

  /** Descarta un ride interrumpido (borra el checkpoint). */
  const descartarRecuperacion = useCallback(() => {
    getMotor().descartarRecuperacion();
    setRecuperacion(null);
    logEvent("info", t("log.recupDescartado"));
  }, [logEvent]);

  // Recuperación pendiente al abrir la app. Primero PRECARGA el espejo
  // nativo duradero (archivo en Directory.Data) y recién entonces
  // pregunta por el ride interrumpido: la capa nativa puede contener
  // un checkpoint más reciente que el localStorage del WebView.
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      await getAlmacen().precargar();
      if (cancelado) return;
      const cp = getMotor().leerRecuperacion();
      if (cp) {
        setRecuperacion({
          fecha: cp.ultimoGuardadoTs,
          distanciaKm: cp.metricas.distanciaM / 1000,
          elapsedMin: cp.metricas.elapsedSec / 60,
          fuente: cp.fuente,
        });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const pause = useCallback(() => {
    const e = getMotor();
    if (e.estado !== "corriendo" && e.estado !== "autoPausada") return;
    e.pausar();
    park.current.state = "ok";
    park.current.fall.reset(); // pausa esperada: no confundir con caída
    alerts.stopAll();
    setStatus("paused");
    setSpeedState("ok");
    setSpeedKmh(0);
    setAutoPausada(false);
    logEvent("info", t("log.pausa"));
  }, [logEvent]);

  const resume = useCallback(() => {
    const e = getMotor();
    if (e.estado !== "pausada" && e.estado !== "autoPausada") return;
    e.reanudar();
    park.current.fall.reset(); // re-arma desde cero tras la pausa
    setStatus("running");
    setAutoPausada(false);
    logEvent("info", t("log.reanudado"));
  }, [logEvent]);

  const stop = useCallback(() => {
    const e = getMotor();
    const snap = e.detener();
    setFallAlert(null);
    alerts.stopAll();
    alerts.releaseWakeLock();
    const p = park.current;
    // Un ride pausado también se guarda: la pausa no borra lo pedaleado.
    const m = snap?.metricas;
    if (m && (m.distanciaM > 50 || m.elapsedSec > 10)) {
      const movingAvg = m.movingSec > 2 ? (m.distanciaM / m.movingSec) * 3.6 : 0;
      const vehicleSuspect =
        source === "gps" &&
        isMotorizedRide({
          vehSec: p.vehSec,
          vehStreakSec: p.vehStreakMax,
          avgKmh: movingAvg,
          movingSec: m.movingSec,
          maxKmh: m.velMaxKmh,
        });
      const trackPts: TrackPt[] = (snap?.track ?? []).map((pt) => [
        pt[0],
        pt[1],
        pt[2] ?? m.altMinM ?? 0,
        pt[3],
      ]);
      const metrics =
        source === "gps" && trackPts.length > 2 ? computeRideMetrics(trackPts, getRideWeights()) : null;
      const summary: RideSummary = conRouteRef({
        id: crypto.randomUUID(),
        dateISO: new Date().toISOString(),
        source: source,
        distanceKm: m.distanciaM / 1000,
        maxKmh: m.velMaxKmh,
        maxInParkKmh: maxInParkRef.current,
        inParkKm: Number((p.parkDistanceM / 1000).toFixed(2)),
        avgKmh: movingAvg,
        elapsedSec: m.elapsedSec,
        gainM: m.gainM,
        overLimitSec: p.overSec,
        motorized: vehicleSuspect || undefined,
        metrics: metrics ?? undefined,
        track: source === "gps" && trackPts.length > 1 ? trackPts : undefined,
      }, rutaProyectadaStore.get());
      saveRide(summary);
      setResumenCerrado(summary);
      logEvent("info", t("log.guardado"));
      void syncRideAfterSave(summary);
      if (metrics) void augmentRideOffRoad(summary, (s) => void syncRideAfterSave(s));
      if (vehicleSuspect) setPendingConfirm(summary);
    }
    resetParque();
    setStatus("idle");
    setGpsStatus("idle");
    setSpeedState("ok");
    setSpeedKmh(0);
    setAutoPausada(false);
  }, [logEvent, source, resetParque]);

  const confirmVehicle = useCallback((wasBike: boolean) => {
    const s = pendingRef.current;
    pendingRef.current = null;
    setPendingConfirm(null);
    if (!s) return;
    if (!wasBike) return;
    void markRideAsBike(s);
  }, []);

  const descartarResumenCerrado = useCallback(() => setResumenCerrado(null), []);

  // Re-adquirir Wake Lock al volver a la app + checkpoint al ocultar
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        // checkpoint de emergencia al salir de primer plano
        getMotor().forzarCheckpoint();
      } else if (status === "running") {
        void alerts.reacquireIfVisible();
      }
    };
    const onHide = () => getMotor().forzarCheckpoint();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
    };
  }, [status]);

  // Tic de reloj: el tiempo transcurrido y el promedio siguen vivos
  // aunque la señal falle (elapsed es por reloj, no por fixes).
  useEffect(() => {
    if (status !== "running") return;
    const iv = setInterval(() => {
      const e = getMotor();
      // el perfil (auto-pausa) puede cambiar en Ajustes en vivo
      e.setAutoPausa(autoPausaActivada());
      const snap = e.snapshot();
      if (!snap) return;
      setElapsedSec(snap.metricas.elapsedSec);
      setAvgKmh(snap.metricas.movingSec > 2 ? (snap.metricas.distanciaM / snap.metricas.movingSec) * 3.6 : 0);
    }, TICK_MS);
    return () => clearInterval(iv);
  }, [status]);

  // --- GPS ambiental (app cargada, sin ride activo): mapa y navegación
  // parten en TU ubicación. No toca estadísticas. Fase única (A.8): se
  // DETIENE con la app oculta o bloqueada — el chip GNSS no queda vivo
  // sin actividad (auditoría R7); al volver, se reabre. ---
  const ambientRef = useRef<number | null>(null);
  const stopAmbiente = useCallback(() => {
    if (ambientRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(ambientRef.current);
      ambientRef.current = null;
    }
  }, []);
  useEffect(() => {
    if (status !== "idle") return; // durante el ride el GPS del ride manda
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    const abrir = () => {
      if (ambientRef.current !== null || document.visibilityState !== "visible") return;
      setGpsStatus((s) => (s === "idle" || s === "error" ? "requesting" : s));
      ambientRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsStatus("active");
          setAccuracyM(pos.coords.accuracy ?? null);
          setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) setGpsStatus("denied");
          else setGpsStatus((s) => (s === "requesting" ? "error" : s));
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
      );
    };
    abrir();
    const onVis = () => {
      if (document.visibilityState === "hidden") stopAmbiente();
      else abrir();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stopAmbiente();
    };
  }, [status, stopAmbiente]);

  // Limpieza al desmontar
  useEffect(() => () => {
    getMotor().forzarCheckpoint();
    motorRef.current?.detener();
    alerts.stopAll();
  }, []);

  return {
    status, source, gpsStatus, accuracyM,
    speedKmh, maxKmh, avgKmh, distanceKm, elapsedSec, gainM, slopePct,
    insidePark, speedState, overLimitSec, maxInParkKmh,
    autoPausada,
    events, track, position, course,
    pendingConfirm, confirmVehicle,
    resumenCerrado, descartarResumenCerrado,
    fallAlert, dismissFall, requestFallHelp,
    recuperacion, retomarRide, descartarRecuperacion,
    start, pause, resume, stop,
  };
}
