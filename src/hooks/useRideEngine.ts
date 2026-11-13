"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAUTION_KMH,
  GATES,
  LIMIT_KMH,
  PARK_POLYGON,
  RISK_ZONES,
  type LatLng,
} from "@/lib/park";
import { Ema, SpeedKalman, haversineM, pointInPolygon, distToPolygonM } from "@/lib/geo";
import { PARK_HOURS } from "@/lib/park";
import { estadoParque, minutosParaCierre, cierraVozText, cierraHoraTexto } from "@/lib/horario";
import { GATE_PIO_NONO, PUENTE_TUPAHUE_CUMBRE, enCorredorPioNono } from "@/lib/reglasParque";
import { alerts } from "@/lib/alertEngine";
import { RideNative, isNativeApp, type PluginListenerHandleLike } from "@/lib/rideNative";
import { RideSimulator } from "@/lib/simulation";
import { saveRide, type RideSummary, type TrackPt } from "@/lib/history";
import { isMotorizedRide, VEH_LIMIT_KMH, VEH_STREAK_SEC, VEH_TOTAL_SEC } from "@/lib/vehicleDetect";
import { syncRideAfterSave, markRideAsBike } from "@/lib/sync";

export type SpeedState = "ok" | "caution" | "over";
export type RideStatus = "idle" | "running" | "paused";
export type Source = "gps" | "sim";

export type RideEvent = {
  t: number;
  kind: "info" | "warn" | "danger" | "zone" | "gate";
  text: string;
};

export type GpsStatus = "idle" | "requesting" | "active" | "denied" | "error";

const TICK_MS = 500;

function pushEvent(list: RideEvent[], ev: RideEvent): RideEvent[] {
  return [...list.slice(-40), ev];
}

export function useRideEngine() {
  const [status, setStatus] = useState<RideStatus>("idle");
  const [source, setSource] = useState<Source>("sim");
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
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
  // Ride sospechoso de vehículo esperando la confirmación del usuario
  // ("¿fuiste en bici?"). Ya está guardado (con el flag) y sincronizado:
  // esta confirmación solo corrige el flag si fue falso positivo.
  const [pendingConfirm, setPendingConfirm] = useState<RideSummary | null>(null);
  const pendingRef = useRef<RideSummary | null>(null);
  useEffect(() => { pendingRef.current = pendingConfirm; }, [pendingConfirm]);

  // --- refs del motor ---
  const engine = useRef({
    kalman: new SpeedKalman(),
    altEma: new Ema(0.3),
    slopeEma: new Ema(0.22),
    lastFix: null as (LatLng & { speedKmh: number; alt: number; t: number; accuracyM: number }) | null,
    prevSpeed: null as number | null,
    prevAltS: null as number | null,
    startRealTime: 0,
    distanceM: 0,
    parkDistanceM: 0, // km dentro de la geocerca (desafíos del parque)
    movingSec: 0,
    elapsed: 0,
    gain: 0,
    overSec: 0,
    inside: false,
    state: "ok" as SpeedState,
    zoneLastTrigger: {} as Record<string, number>,
    gateLastTrigger: {} as Record<string, number>,
    sim: null as RideSimulator | null,
    paused: false,
    watchId: null as number | null,
    nativeSub: null as PluginListenerHandleLike | null,
    tickTimer: null as ReturnType<typeof setInterval> | null,
    lastTick: 0,
    // Pista muestreada para export GPX: [lat, lon, eleM, tsSec]
    trackPts: [] as TrackPt[],
    trackEveryMs: 5000,
    // Huella de vehículo motorizado: segundos sobre 45 km/h (total y
    // tramo continuo más largo). Con GPS a 1 Hz es la señal que separa
    // un auto de una bici (que solo toca puntas en bajada). Ver
    // lib/vehicleDetect: la decisión final la confirma el usuario.
    vehSec: 0,
    vehStreakSec: 0,
    vehStreakMax: 0,
    vehNotified: false,
    // Reglas direccionales del cliente (2026-11-12): detección de
    // BAJADA por el corredor Pío Nono (sólo subida) y de SUBIDA a la
    // cumbre por el puente de Tupahue fuera de horario (FDS ≥ 13:30).
    pioPrevD: null as number | null,
    pioStreak: 0,
    pioStreakD: null as number | null,
    pioLastTrigger: 0,
    puentePrevD: null as number | null,
    puenteStreak: 0,
    puenteStreakD: null as number | null,
    puenteLastTrigger: 0,
    // Avisos nuevos del cliente (2026-11-13): bajadas fiscalizadas del
    // control 30 km/h (voz al entrar a descender por un corredor rojo)
    // y horario al límite (cierre próximo / parque cerrado). El módulo
    // de corredores se carga con import() dinámico en start(): el
    // trazado (~5.000 pares) NO va en el bundle principal.
    b30Mod: null as typeof import("@/lib/bajadas30") | null,
    b30LastTrigger: {} as Record<string, number>,
    horarioLastCheck: 0,
    horarioVoiceLast: {} as Record<string, number>,
  });

  const logEvent = useCallback((kind: RideEvent["kind"], text: string) => {
    setEvents((prev) => pushEvent(prev, { t: Date.now(), kind, text }));
  }, []);

  /** Procesa un fix (GPS real o simulado) con el mismo pipeline. */
  const processFix = useCallback(
    (fix: LatLng & { speedKmh: number; alt: number; accuracyM: number; t: number }) => {
      const e = engine.current;
      const dt = e.lastFix ? Math.min(10, Math.max(0.15, (fix.t - e.lastFix.t) / 1000)) : 1;

      // 0) PAUSA: el GPS sigue vivo (el mapa no se congela) pero no se
      //    acumula nada: ni tiempo, ni distancia, ni alertas. Solo se
      //    publica posición/precisión y se actualiza lastFix para que
      //    al reanudar no haya salto de distancia.
      if (e.paused) {
        setAccuracyM(fix.accuracyM);
        setPosition(fix);
        e.lastFix = { ...fix };
        e.prevSpeed = null;
        return;
      }

      // 1) Velocidad: GPS (Doppler) → filtro de Kalman + micro-predicción.
      //    Los sensores (Bluetooth y acelerómetro) se retiraron: el WebView
      //    de Capacitor no entrega datos fiables de ellos; el GPS nativo a
      //    1 Hz es la única fuente y basta para fiscalizar los 30 km/h.
      const measuredKmh = fix.speedKmh;
      const vMeasured = measuredKmh / 3.6; // m/s
      const vKf = e.kalman.update(vMeasured, dt);
      let accel = 0;
      if (e.prevSpeed !== null && dt > 0) accel = (vKf - e.prevSpeed) / dt;
      accel = Math.max(-3, Math.min(3, accel));
      e.prevSpeed = vKf;
      const vPred = Math.max(0, vKf + accel * 0.4); // extrapola 400 ms
      const vKmh = vPred * 3.6;

      // 2) Distancia (rechaza teleportes > 100 m o baja precisión)
      let dValid = 0; // metros válidos de este paso (se reutilizan para el parque)
      if (e.lastFix) {
        const d = haversineM(e.lastFix, fix);
        if (d < 100 && fix.accuracyM < 60) {
          e.distanceM += d;
          dValid = d;
        }
      }

      // 3) Desnivel y pendiente (sobre altitud suavizada)
      const altS = e.altEma.update(fix.alt);
      if (e.lastFix) {
        const dHoriz = haversineM(e.lastFix, fix);
        if (dHoriz > 4) {
          const raw = ((fix.alt - e.lastFix.alt) / dHoriz) * 100;
          e.slopeEma.update(Math.max(-35, Math.min(35, raw)));
        }
        if (dHoriz > 3 && e.prevAltS !== null) {
          e.gain += Math.max(0, altS - e.prevAltS);
        }
      }
      e.prevAltS = altS;

      // 4) Tiempos
      e.elapsed += dt;
      if (vKmh > 1.5) e.movingSec += dt;

      // 4b) Huella de vehículo motorizado: tiempo sobre el umbral que una
      //     bici no sostiene. La decisión (isMotorizedRide) se toma al
      //     guardar y el usuario la confirma; aquí solo se mide.
      if (vKmh > VEH_LIMIT_KMH) {
        e.vehSec += dt;
        e.vehStreakSec += dt;
        if (e.vehStreakSec > e.vehStreakMax) e.vehStreakMax = e.vehStreakSec;
        if (!e.vehNotified && (e.vehStreakMax >= VEH_STREAK_SEC || e.vehSec >= VEH_TOTAL_SEC)) {
          e.vehNotified = true;
          logEvent("warn", "Velocidad sostenida típica de vehículo: al guardar te preguntaremos");
        }
      } else {
        e.vehStreakSec = 0;
      }

      // 5) Geofence del parque (con HISTERÉSIS anti-parpadeo).
      //    La frontera corre pegada a caminos reales (Av. El Cerro,
      //    Canal El Carmen, Av. La Montaña) y las porterías caen casi
      //    exactamente sobre la línea: con el ruido del GPS (±10-15 m)
      //    el estado dentro/fuera alternaba en cada fix y la bitácora
      //    se llenaba de «Ingresando/Saliendo» fantasma. Ahora para
      //    cambiar de lado hay que superar 18 m de profundidad real
      //    hacia el nuevo lado (distancia a la frontera del polígono).
      const rawInside = pointInPolygon(fix, PARK_POLYGON);
      const dFront = distToPolygonM(fix, PARK_POLYGON);
      const GEO_HISTERESIS_M = 18;
      const inside = e.inside
        ? rawInside || dFront > GEO_HISTERESIS_M // seguir dentro salvo 18 m reales afuera
        : rawInside && dFront > GEO_HISTERESIS_M; // entrar solo 18 m reales adentro
      if (inside !== e.inside) {
        e.inside = inside;
        if (inside) {
          logEvent("info", "Ingresando al Parque Metropolitano · límite 30 km/h");
          alerts.speak("park-in", "Ingresando al Parque Metropolitano. Límite 30 kilómetros por hora.", 4);
        } else {
          logEvent("info", "Saliendo del parque · modo libre");
          alerts.speak("park-out", "Saliendo del parque. Modo libre.", 4);
        }
      }
      // Km efectivamente pedaleados DENTRO de la geocerca: es la base de
      // los desafíos del parque (un ride de ruta que roza el borde no cuenta).
      if (inside) e.parkDistanceM += dValid;

      // 6) Accesos (cercanía < 80 m). Indicación según la normativa
      //    vigente (actualización Parquemet nov 2026): la credencial QR
      //    ya NO se pide en los accesos (solo rige para los senderos de
      //    enduro desde dic 2026). Ahora se informa si el acceso es o no
      //    de los 4 exclusivos ciclistas y, fuera de horario, el cierre.
      for (const gate of GATES) {
        const d = haversineM(fix, gate.position);
        const last = e.gateLastTrigger[gate.id] ?? 0;
        if (d < 80 && fix.t - last > 120_000) {
          e.gateLastTrigger[gate.id] = fix.t;
          const cerrado = !estadoParque(new Date(fix.t)).abierto;
          if (cerrado) {
            logEvent("gate", `Cerca de ${gate.name}: el parque está cerrado para ciclistas (06:00-20:30)`);
            alerts.speak(`gate-${gate.id}`, "El parque está cerrado para ciclistas. El ingreso es de 6 a 20 y 30.", 60);
          } else if (gate.ciclistas) {
            logEvent("gate", `Cerca de ${gate.name}: acceso exclusivo de ciclistas · casco y luces puestos`);
            alerts.speak(`gate-${gate.id}`, "Acceso exclusivo de ciclistas. Casco y luces puestos.", 60);
          } else {
            logEvent("gate", `Cerca de ${gate.name}: sin ingreso en bici · entra por Zapadores, PdV Norte, Pío Nono o La Pirámide`);
            alerts.speak(`gate-${gate.id}`, "Este acceso no permite el ingreso de bicicletas. Usa Zapadores, Pedro de Valdivia Norte, Pío Nono o La Pirámide.", 60);
          }
        }
      }

      // 7) Zonas de riesgo
      for (const zone of RISK_ZONES) {
        const d = haversineM(fix, zone.position);
        const last = e.zoneLastTrigger[zone.id] ?? 0;
        // Pre-aviso: 100 m antes de la zona (voz, sin detener el pedaleo)
        if (d >= zone.radiusM && d < zone.radiusM + 100 && fix.t - last > 150_000) {
          e.zoneLastTrigger[zone.id] = fix.t;
          logEvent("zone", `${zone.name} a ~100 metros`);
          alerts.speak(`zone-approach-${zone.id}`, `Zona de riesgo a 100 metros: ${zone.name}.`, 30);
        }
        if (d < zone.radiusM && fix.t - last > 150_000) {
          e.zoneLastTrigger[zone.id] = fix.t;
          logEvent("zone", `Zona de riesgo: ${zone.name}`);
          alerts.speak(`zone-${zone.id}`, zone.voice, 10);
          alerts.beepTriple();
        }
      }

      // 7b) Reglas direccionales del cliente (2026-11-12):
      //     · Bajada por el corredor Pío Nono BLOQUEADA (sólo subida,
      //       24/7): si el ciclista desciende hacia el acceso dentro del
      //       corredor, advertencia de voz («no es accesible para bajar
      //       si se subió por los otros 3 accesos»).
      //     · Subida a la cumbre por el puente de Tupahue FUERA DE
      //       HORARIO (fines de semana y festivos desde las 13:30):
      //       advertencia al acercarse al puente con la restricción
      //       activa y alternativas según la posición.
      if (inside && vKmh > 1.5) {
        // — bajada Pío Nono: acercándose al acceso DENTRO del corredor —
        const dPio = haversineM(fix, GATE_PIO_NONO);
        const dPioPrev = e.pioPrevD;
        if (enCorredorPioNono(fix.lat, fix.lon) && dPio < 2100) {
          if (dPioPrev !== null && dPio < dPioPrev - 1) {
            e.pioStreak += 1;
            const dPioStart = e.pioStreakD ?? dPioPrev;
            // 3 fixes acercándose (≥ 15 m netos) en el tramo final del
            // corredor: es una bajada real, no ruido del GPS.
            if (
              e.pioStreak >= 3 &&
              dPioStart - dPio >= 15 &&
              dPio < 1500 &&
              fix.t - e.pioLastTrigger > 180_000
            ) {
              e.pioLastTrigger = fix.t;
              e.pioStreak = 0;
              e.pioStreakD = null;
              logEvent("warn", "Bajada bloqueada: Pío Nono es sólo de subida");
              alerts.speak(
                "pio-bajada",
                "Atención: por Pío Nono no se puede bajar. La bajada es por el puente de Tupahue hacia Pedro de Valdivia Norte.",
                30
              );
            }
          } else if (dPioPrev !== null && dPio > dPioPrev + 1) {
            e.pioStreak = 0;
            e.pioStreakD = null;
          }
          e.pioPrevD = dPio;
        } else {
          e.pioPrevD = null;
          e.pioStreak = 0;
          e.pioStreakD = null;
        }
        // — corte horario cumbre (Tupahue → Cumbre) —
        if (estadoParque(new Date(fix.t)).nivel === "tupa") {
          const dPuen = haversineM(fix, PUENTE_TUPAHUE_CUMBRE);
          const dPuenPrev = e.puentePrevD;
          if (dPuen < 500) {
            if (dPuenPrev !== null && dPuen < dPuenPrev - 1) {
              e.puenteStreak += 1;
              const dPuenStart = e.puenteStreakD ?? dPuenPrev;
              if (
                e.puenteStreak >= 3 &&
                dPuenStart - dPuen >= 12 &&
                fix.t - e.puenteLastTrigger > 180_000
              ) {
                e.puenteLastTrigger = fix.t;
                e.puenteStreak = 0;
                e.puenteStreakD = null;
                logEvent(
                  "warn",
                  "Corte horario: acceso a la cumbre por Tupahue cerrado desde las 13:30 (fin de semana y festivos)"
                );
                alerts.speak(
                  "corte-cumbre",
                  `${PARK_HOURS.msgCumbreTupahue} Alternativas según tu posición: Av. Gabriela Mistral o Av. Carlos Martner.`,
                  30
                );
              }
            } else if (dPuenPrev !== null && dPuen > dPuenPrev + 1) {
              e.puenteStreak = 0;
              e.puenteStreakD = null;
            }
            e.puentePrevD = dPuen;
          } else {
            e.puentePrevD = null;
            e.puenteStreak = 0;
            e.puenteStreakD = null;
          }
        } else {
          e.puentePrevD = null;
          e.puenteStreak = 0;
          e.puenteStreakD = null;
        }
      } else {
        e.pioPrevD = null;
        e.pioStreak = 0;
        e.pioStreakD = null;
        e.puentePrevD = null;
        e.puenteStreak = 0;
        e.puenteStreakD = null;
      }

      // 7c) Bajadas fiscalizadas del control 30 km/h (cliente
      //     2026-11-13: «aviso por voz cuando se esté bajando por una
      //     ruta de 30 km»): al entrar a DESCENDER por uno de los 3
      //     corredores rojos (capa Normativa y Seguridad), voz de
      //     recordatorio del límite. Requiere pendiente de bajada real
      //     (≤ -0,8 %) y movimiento: pedalear plano junto al corredor
      //     no avisa. Cooldown 4 min por corredor.
      if (inside && vKmh > 3 && e.slopeEma.value < -0.8 && e.b30Mod) {
        const hit = e.b30Mod.enBajada30(fix.lat, fix.lon);
        if (hit && fix.t - (e.b30LastTrigger[hit.id] ?? 0) > 240_000) {
          e.b30LastTrigger[hit.id] = fix.t;
          logEvent("warn", `Bajada fiscalizada: ${hit.nombre} · control 30 km/h`);
          alerts.speak(
            `b30-${hit.id}`,
            "Entrando a la bajada fiscalizada. Control de 30 kilómetros por hora.",
            30
          );
        }
      }

      // 7d) Horario al límite (cliente 2026-11-13: «avisos de
      //     ingreso/cierre si se está al límite en el horario»):
      //     dentro del parque, cierre próximo (≤ 30 min) o parque ya
      //     cerrado (desde las 20:30), con voz cada 10 min mientras
      //     dure la condición. El aviso de INGRESO fuera de horario
      //     vive en start().
      if (inside && fix.t - e.horarioLastCheck > 30_000) {
        e.horarioLastCheck = fix.t;
        const mC = minutosParaCierre(new Date(fix.t));
        if (mC <= 0) {
          if (fix.t - (e.horarioVoiceLast["cerrado"] ?? 0) > 600_000) {
            e.horarioVoiceLast["cerrado"] = fix.t;
            logEvent("danger", `Parque cerrado (${cierraHoraTexto()}): el horario de ciclistas terminó`);
            alerts.speak(
              "horario-cerrado",
              `El parque ya cerró. El ingreso de ciclistas es hasta las ${cierraVozText()}.`,
              60
            );
          }
        } else if (mC <= 30) {
          if (fix.t - (e.horarioVoiceLast["proximo"] ?? 0) > 600_000) {
            e.horarioVoiceLast["proximo"] = fix.t;
            const min5 = Math.max(5, Math.round(mC / 5) * 5);
            logEvent("warn", `Al límite del horario: el parque cierra a las ${cierraHoraTexto()} (${mC} min)`);
            alerts.speak(
              "horario-proximo",
              `Atención: el parque cierra a las ${cierraVozText()}. Te quedan ${min5} minutos.`,
              60
            );
          }
        }
      }

      // 8) Máquina de estados de velocidad (solo dentro del parque)
      let nextState: SpeedState = "ok";
      if (e.inside) {
        switch (e.state) {
          case "ok":
            nextState = vKmh >= LIMIT_KMH ? "over" : vKmh >= CAUTION_KMH ? "caution" : "ok";
            break;
          case "caution":
            if (vKmh >= LIMIT_KMH) nextState = "over";
            else if (vKmh < CAUTION_KMH - 0.6) nextState = "ok";
            else nextState = "caution";
            break;
          case "over":
            if (vKmh < LIMIT_KMH - 0.6) nextState = vKmh >= CAUTION_KMH ? "caution" : "ok";
            else nextState = "over";
            break;
        }
      }
      if (e.inside && vKmh >= LIMIT_KMH) e.overSec += dt;
      // Hápticos progresivos por velocidad (25 corto / 28 doble / 30+ continuo)
      alerts.updateHaptics(e.inside ? vKmh : null);

      if (nextState !== e.state) {
        if (nextState === "caution") {
          alerts.startCaution();
          alerts.speak("caution", `Precaución: vas a ${Math.round(vKmh)} kilómetros por hora. Límite 30.`, 10);
          logEvent("warn", `Te acercas al límite: ${Math.round(vKmh)} km/h`);
        } else if (nextState === "over") {
          alerts.startOver();
          alerts.speak("over", "Exceso de velocidad. Reduce a menos de 30 kilómetros por hora.", 6);
          logEvent("danger", `¡Exceso! ${Math.round(vKmh)} km/h dentro del parque`);
        } else {
          alerts.stopAll();
          if (e.state !== "ok") logEvent("info", "Velocidad normalizada");
        }
        e.state = nextState;
      }

      // 9) Publicar estado a la UI
      setSpeedKmh(vKmh);
      setMaxKmh((m) => Math.max(m, vKmh));
      if (e.inside) setMaxInParkKmh((m) => Math.max(m ?? 0, vKmh));
      setAvgKmh(e.movingSec > 2 ? (e.distanceM / e.movingSec) * 3.6 : 0);
      setDistanceKm(e.distanceM / 1000);
      setElapsedSec(e.elapsed);
      setGainM(e.gain);
      setSlopePct(e.slopeEma.value);
      setInsidePark(e.inside);
      setSpeedState(e.state);
      setOverLimitSec(e.overSec);
      setAccuracyM(fix.accuracyM);
      setPosition(fix);
      setTrack((tr) => (tr.length && haversineM(tr[tr.length - 1], fix) < 2 ? tr : [...tr.slice(-6000), fix]));
      // Pista para GPX: ~1 punto cada 5 s, máx 600 (si se llena, se
      // adelgaza a la mitad y se duplica el intervalo - ~21 KB por ride).
      if (!e.trackPts.length || fix.t - e.trackPts[e.trackPts.length - 1][3] * 1000 >= e.trackEveryMs) {
        if (e.trackPts.length >= 600) {
          e.trackPts = e.trackPts.filter((_, i) => i % 2 === 0);
          e.trackEveryMs *= 2;
        }
        e.trackPts.push([fix.lat, fix.lon, fix.alt, Math.round(fix.t / 1000)]);
      }
      e.lastFix = { ...fix };
    },
    [logEvent]
  );

  // --- Fuente GPS web (navigator.geolocation, fallback del WebView) ---
  const startWebGps = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGpsStatus("error");
      logEvent("danger", "Este navegador no soporta geolocalización");
      return;
    }
    setGpsStatus("requesting");
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus("active");
        const c = pos.coords;
        // Velocidad GPS (Doppler) si existe; si no, por delta de posición
        let kmh: number;
        if (c.speed !== null && c.speed >= 0 && isFinite(c.speed)) {
          kmh = c.speed * 3.6;
        } else {
          const e = engine.current;
          kmh = e.lastFix
            ? (haversineM(e.lastFix, { lat: c.latitude, lon: c.longitude }) / Math.max(0.2, (pos.timestamp - e.lastFix.t) / 1000)) * 3.6
            : 0;
        }
        engine.current.lastTick = performance.now();
        processFix({
          lat: c.latitude,
          lon: c.longitude,
          speedKmh: kmh,
          alt: c.altitude ?? 0,
          accuracyM: c.accuracy ?? 20,
          t: pos.timestamp,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus("denied");
          logEvent("danger", "Permiso de ubicación denegado. Usa el Modo Demo para probar.");
        } else {
          setGpsStatus("error");
          logEvent("warn", `GPS: ${err.message}`);
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
    engine.current.watchId = id;
  }, [logEvent, processFix]);

  // --- Fuente GPS nativa: FGS tipo LOCATION a 1 Hz vía plugin RideNative.
  // Sigue entregando fixes con la pantalla bloqueada o cambiando de app.
  const startNativeGps = useCallback(async () => {
    try {
      const sub = await RideNative.addListener("gpsfix", (f) => {
        setGpsStatus("active");
        const eng = engine.current;
        // speed negativo o no finito = Doppler inválido → delta de posición
        const speedKmh =
          f.speed >= 0 && isFinite(f.speed)
            ? f.speed * 3.6
            : eng.lastFix
              ? (haversineM(eng.lastFix, { lat: f.lat, lon: f.lng }) / Math.max(0.2, (f.t - eng.lastFix.t) / 1000)) * 3.6
              : 0;
        eng.lastTick = performance.now();
        processFix({
          lat: f.lat,
          lon: f.lng,
          speedKmh,
          alt: f.alt,
          accuracyM: f.accuracy,
          t: f.t,
        });
      });
      engine.current.nativeSub = sub;
      await RideNative.startLocation();
      logEvent("info", "GPS nativo a 1 Hz: sigue activo con la pantalla bloqueada");
    } catch {
      logEvent("warn", "GPS nativo no disponible: usando GPS del WebView");
      startWebGps();
    }
  }, [logEvent, processFix, startWebGps]);

  const startGps = useCallback(() => {
    if (isNativeApp()) {
      void startNativeGps();
      return;
    }
    startWebGps();
  }, [startNativeGps, startWebGps]);

  // --- Fuente simulación ---
  const startSim = useCallback(() => {
    engine.current.sim = new RideSimulator(12, true);
    engine.current.lastTick = performance.now();
    engine.current.tickTimer = setInterval(() => {
      const e = engine.current;
      if (!e.sim) return;
      const now = performance.now();
      const dt = (now - e.lastTick) / 1000;
      e.lastTick = now;
      const fix = e.sim.tick(dt);
      processFix(fix);
    }, TICK_MS);
    logEvent("info", "Modo demo activo: Pío Nono → Plaza México → Pedro de Valdivia (12× tiempo real)");
  }, [logEvent, processFix]);

  const start = useCallback(
    (src: Source) => {
      alerts.unlock();
      const e = engine.current;
      e.kalman.reset();
      e.altEma.reset();
      e.slopeEma.reset();
      e.lastFix = null;
      e.prevSpeed = null;
      e.distanceM = 0;
      e.parkDistanceM = 0;
      e.movingSec = 0;
      e.elapsed = 0;
      e.gain = 0;
      e.overSec = 0;
      e.inside = false;
      e.state = "ok";
      e.zoneLastTrigger = {};
      e.gateLastTrigger = {};
      e.trackPts = [];
      e.trackEveryMs = 5000;
      e.vehSec = 0;
      e.vehStreakSec = 0;
      e.vehStreakMax = 0;
      e.vehNotified = false;
      e.pioPrevD = null;
      e.pioStreak = 0;
      e.pioStreakD = null;
      e.pioLastTrigger = 0;
      e.puentePrevD = null;
      e.puenteStreak = 0;
      e.puenteStreakD = null;
      e.puenteLastTrigger = 0;
      e.b30Mod = null;
      e.b30LastTrigger = {};
      e.horarioLastCheck = 0;
      e.horarioVoiceLast = {};
      e.paused = false;
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
      setStatus("running");
      logEvent("info", src === "gps" ? "Ride iniciado con GPS real" : "Ride iniciado en modo demo");
      // Corredores de las bajadas 30: carga perezosa (import dinámico,
      // el trazado no viaja en el bundle principal).
      void import("@/lib/bajadas30")
        .then((m) => { engine.current.b30Mod = m; })
        .catch(() => { /* sin detección de bajadas esta sesión */ });
      // Aviso de horario al INICIAR (ingreso fuera de horario o al
      // límite del cierre).
      const mInicio = minutosParaCierre();
      if (mInicio <= 0) {
        logEvent("warn", `Ride fuera de horario: ${PARK_HOURS.msgCierre}`);
        alerts.speak(
          "horario-inicio",
          `Estás fuera del horario del parque. El ingreso de ciclistas es de ${PARK_HOURS.abreMin / 60} a ${cierraVozText()}.`,
          4
        );
      } else if (mInicio <= 30) {
        logEvent("warn", `Ride al límite del horario: cierre a las ${cierraHoraTexto()} (${mInicio} min)`);
        alerts.speak(
          "horario-inicio",
          `Atención: el parque cierra a las ${cierraVozText()}. Te quedan ${Math.max(5, Math.round(mInicio / 5) * 5)} minutos.`,
          4
        );
      }
      void alerts.requestWakeLock();
      if (src === "gps") startGps();
      else startSim();
    },
    [logEvent, startGps, startSim]
  );

  /** Pausa: congela cronómetro/estadísticas sin soltar el GPS.
   *  El estado de velocidad vuelve a "ok" en silencio para que, al
   *  reanudar, los avisos de caution/over se vuelvan a disparar si
   *  corresponde (no se pierde la fiscalización). */
  const pause = useCallback(() => {
    if (status !== "running") return;
    const e = engine.current;
    e.paused = true;
    e.state = "ok";
    alerts.stopAll();
    setStatus("paused");
    setSpeedState("ok");
    setSpeedKmh(0);
    logEvent("info", "Ride en pausa - cronómetro detenido");
  }, [status, logEvent]);

  /** Reanuda: resetea los filtros (Kalman/último fix) para que ni la
   *  velocidad ni la distancia salten con el tiempo de pausa. */
  const resume = useCallback(() => {
    if (status !== "paused") return;
    const e = engine.current;
    e.paused = false;
    e.lastFix = null;
    e.prevSpeed = null;
    e.kalman.reset();
    setStatus("running");
    logEvent("info", "Ride reanudado");
  }, [status, logEvent]);

  // Refs espejo para leer los máximos al guardar
  const maxRef = useRef(0);
  const maxInParkRef = useRef<number | null>(null);
  useEffect(() => { maxRef.current = maxKmh; }, [maxKmh]);
  useEffect(() => { maxInParkRef.current = maxInParkKmh; }, [maxInParkKmh]);

  const stop = useCallback(() => {
    const e = engine.current;
    if (e.watchId !== null) {
      navigator.geolocation.clearWatch(e.watchId);
      e.watchId = null;
    }
    if (e.nativeSub) {
      void e.nativeSub.remove();
      e.nativeSub = null;
      void RideNative.stopLocation().catch(() => { /* ya detenido */ });
    }
    if (e.tickTimer) {
      clearInterval(e.tickTimer);
      e.tickTimer = null;
    }
    e.sim = null;
    alerts.stopAll();
    alerts.releaseWakeLock();
    // Un ride pausado también se guarda: la pausa no borra lo pedaleado.
    if ((status === "running" || status === "paused") && (e.distanceM > 50 || e.elapsed > 10)) {
      // Detección de vehículo motorizado: solo rides con GPS real (el
      // demo corre a su propia velocidad y no cuenta para nada). Si es
      // sospechoso se marca motorizado de inmediato (nunca se pierde el
      // ride) y la app pregunta: "¿fuiste en bici?" para corregirlo.
      const movingAvg = e.movingSec > 2 ? (e.distanceM / e.movingSec) * 3.6 : 0;
      const vehicleSuspect =
        source === "gps" &&
        isMotorizedRide({
          vehSec: e.vehSec,
          vehStreakSec: e.vehStreakMax,
          avgKmh: movingAvg,
          movingSec: e.movingSec,
          maxKmh: maxRef.current,
        });
      const summary: RideSummary = {
        id: crypto.randomUUID(),
        dateISO: new Date().toISOString(),
        source: source,
        distanceKm: e.distanceM / 1000,
        maxKmh: maxRef.current,
        maxInParkKmh: maxInParkRef.current,
        inParkKm: Number((e.parkDistanceM / 1000).toFixed(2)),
        avgKmh: movingAvg,
        elapsedSec: e.elapsed,
        gainM: e.gain,
        overLimitSec: e.overSec,
        motorized: vehicleSuspect || undefined,
        // Solo los viajes GPS guardan pista (los demo no exportan GPX).
        track: source === "gps" && e.trackPts.length > 1 ? e.trackPts : undefined,
      };
      saveRide(summary);
      logEvent("info", "Ride guardado en el historial");
      void syncRideAfterSave(summary); // sube al servidor + logros si hay sesión
      if (vehicleSuspect) setPendingConfirm(summary);
    }
    e.paused = false;
    setStatus("idle");
    setGpsStatus("idle");
    setSpeedState("ok");
    setSpeedKmh(0);
  }, [logEvent, source, status]);

  /** Respuesta al diálogo "¿fuiste en bici?": si fue bici, corrige el
   *  flag del ride (local + servidor) y re-evalúa logros; si fue
   *  vehículo, el flag ya quedó puesto al guardar. */
  const confirmVehicle = useCallback((wasBike: boolean) => {
    const s = pendingRef.current;
    pendingRef.current = null;
    setPendingConfirm(null);
    if (!s) return;
    if (!wasBike) return; // ya quedó guardado como vehículo
    void markRideAsBike(s);
  }, []);

  // Re-adquirir Wake Lock al volver a la app
  useEffect(() => {
    const onVis = () => { if (status === "running") void alerts.reacquireIfVisible(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [status]);

  // --- GPS ambiental (app cargada, sin ride activo): publica la
  // posición del usuario apenas abre la app para que el mapa y la
  // navegación partan en TU ubicación y no en el centro del parque.
  // No toca estadísticas ni recorrido: solo position/accuracy. ---
  useEffect(() => {
    if (status !== "idle") return; // durante el ride el GPS del ride manda
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    setGpsStatus((s) => (s === "idle" || s === "error" ? "requesting" : s));
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus("active");
        setAccuracyM(pos.coords.accuracy ?? null);
        setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus("denied");
        } else {
          setGpsStatus((s) => (s === "requesting" ? "error" : s));
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [status]);

  // Limpieza al desmontar
  useEffect(() => () => {
    const e = engine.current;
    if (e.watchId !== null) navigator.geolocation.clearWatch(e.watchId);
    if (e.tickTimer) clearInterval(e.tickTimer);
    if (e.nativeSub) void e.nativeSub.remove();
    alerts.stopAll();
  }, []);

  return {
    status, source, gpsStatus, accuracyM,
    speedKmh, maxKmh, avgKmh, distanceKm, elapsedSec, gainM, slopePct,
    insidePark, speedState, overLimitSec, maxInParkKmh,
    events, track, position,
    pendingConfirm, confirmVehicle,
    start, pause, resume, stop,
  };
}
