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
import { Ema, SpeedKalman, haversineM, pointInPolygon } from "@/lib/geo";
import { alerts } from "@/lib/alertEngine";
import { RideNative, isNativeApp, type PluginListenerHandleLike } from "@/lib/rideNative";
import { RideSimulator } from "@/lib/simulation";
import { saveRide, type RideSummary, type TrackPt } from "@/lib/history";
import { syncRideAfterSave } from "@/lib/sync";

export type SpeedState = "ok" | "caution" | "over";
export type RideStatus = "idle" | "running";
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
    movingSec: 0,
    elapsed: 0,
    gain: 0,
    overSec: 0,
    inside: false,
    state: "ok" as SpeedState,
    zoneLastTrigger: {} as Record<string, number>,
    gateLastTrigger: {} as Record<string, number>,
    sim: null as RideSimulator | null,
    watchId: null as number | null,
    nativeSub: null as PluginListenerHandleLike | null,
    tickTimer: null as ReturnType<typeof setInterval> | null,
    lastTick: 0,
    // Pista muestreada para export GPX: [lat, lon, eleM, tsSec]
    trackPts: [] as TrackPt[],
    trackEveryMs: 5000,
  });

  const logEvent = useCallback((kind: RideEvent["kind"], text: string) => {
    setEvents((prev) => pushEvent(prev, { t: Date.now(), kind, text }));
  }, []);

  /** Procesa un fix (GPS real o simulado) con el mismo pipeline. */
  const processFix = useCallback(
    (fix: LatLng & { speedKmh: number; alt: number; accuracyM: number; t: number }) => {
      const e = engine.current;
      const dt = e.lastFix ? Math.min(10, Math.max(0.15, (fix.t - e.lastFix.t) / 1000)) : 1;

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
      if (e.lastFix) {
        const d = haversineM(e.lastFix, fix);
        if (d < 100 && fix.accuracyM < 60) e.distanceM += d;
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

      // 5) Geofence del parque
      const inside = pointInPolygon(fix, PARK_POLYGON);
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

      // 6) Accesos (cercanía < 80 m)
      for (const gate of GATES) {
        const d = haversineM(fix, gate.position);
        const last = e.gateLastTrigger[gate.id] ?? 0;
        if (d < 80 && fix.t - last > 120_000) {
          e.gateLastTrigger[gate.id] = fix.t;
          logEvent("gate", `Cerca de ${gate.name}: ten lista tu credencial de enrolamiento`);
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
          alerts.speak(`zone-approach-${zone.id}`, `Zona de fiscalización a 100 metros: ${zone.name}.`, 30);
        }
        if (d < zone.radiusM && fix.t - last > 150_000) {
          e.zoneLastTrigger[zone.id] = fix.t;
          logEvent("zone", `Zona de riesgo: ${zone.name}`);
          alerts.speak(`zone-${zone.id}`, zone.voice, 10);
          alerts.beepTriple();
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
      // adelgaza a la mitad y se duplica el intervalo — ~21 KB por ride).
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
    logEvent("info", "Modo demo activo: Pío Nono → Cumbre → Pedro de Valdivia (12× tiempo real)");
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
      void alerts.requestWakeLock();
      if (src === "gps") startGps();
      else startSim();
    },
    [logEvent, startGps, startSim]
  );

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
    if (status === "running" && (e.distanceM > 50 || e.elapsed > 10)) {
      const summary: RideSummary = {
        id: crypto.randomUUID(),
        dateISO: new Date().toISOString(),
        source: source,
        distanceKm: e.distanceM / 1000,
        maxKmh: maxRef.current,
        maxInParkKmh: maxInParkRef.current,
        avgKmh: e.movingSec > 2 ? (e.distanceM / e.movingSec) * 3.6 : 0,
        elapsedSec: e.elapsed,
        gainM: e.gain,
        overLimitSec: e.overSec,
        // Solo los viajes GPS guardan pista (los demo no exportan GPX).
        track: source === "gps" && e.trackPts.length > 1 ? e.trackPts : undefined,
      };
      saveRide(summary);
      logEvent("info", "Ride guardado en el historial");
      void syncRideAfterSave(summary); // sube al servidor + logros si hay sesión
    }
    setStatus("idle");
    setGpsStatus("idle");
    setSpeedState("ok");
    setSpeedKmh(0);
  }, [logEvent, source, status]);

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
    start, stop,
  };
}
