// ============================================================
// src/lib/fuentes-motor.ts - Location Source: adaptadores que
// entregan FixBruto al núcleo del MotorGPS. CIERRE DE FASE ÚNICA:
// vivían en src/motor/fuente.ts y se MOVIERON a la capa de la
// app — el núcleo (src/motor/*) ya no conoce rideNative, park ni
// simulation: solo el contrato FuenteUbicacion de tipos.ts.
// Tres fábricas:
//   · crearFuenteNativa(): FGS Android vía RideNativePlugin
//     (LocationManager.GPS_PROVIDER a 1 Hz; GNSS del dispositivo;
//     A-GNSS solo asiste la adquisición de satélites — jamás se usa
//     Wi-Fi/red celular como fuente de posición, ver docs/motor-gps.md).
//   · crearFuenteWeb(): navigator.geolocation.watchPosition (respaldo
//     y desarrollo en navegador).
//   · crearFuenteSim(): RideSimulator con ruta inyectable (defecto:
//     la ruta de demo del parque San Cristóbal, SIM_ROUTE).
// La selección se hace en el consumidor; el núcleo acepta cualquiera.
// ============================================================

import type { FixBruto, FuenteUbicacion } from "@/motor/tipos";
import { RideNative, isNativeApp, type PluginListenerHandleLike } from "@/lib/rideNative";
import { RideSimulator, type PuntoRutaSim, type SimFix } from "@/lib/simulation";
import { SIM_ROUTE } from "@/lib/park";

/** Prueba de fix nativo (payload del evento "gpsfix"). */
export type NativeFixCrudo = {
  lat: number;
  lng: number;
  speed: number;
  accuracy: number;
  bearing: number;
  alt: number;
  /** Fase única: accuracy vertical (m; -1 si el proveedor no la da). */
  valt?: number;
  /** Fase única: el proveedor entregó altitud real (getAltitude). */
  hasAlt?: boolean;
  t: number;
};

/** Fuente nativa (APK Android). */
export function crearFuenteNativa(): FuenteUbicacion & { tipo: "nativa" } {
  const handles: PluginListenerHandleLike[] = [];
  return {
    tipo: "nativa",
    async iniciar(entregar, error) {
      if (!isNativeApp()) {
        error("fuente nativa no disponible fuera del APK");
        return;
      }
      try {
        const handle = await RideNative.addListener("gpsfix", (crudo: NativeFixCrudo) => {
          const doppler = typeof crudo.speed === "number" && crudo.speed >= 0 ? crudo.speed : null;
          const fix: FixBruto = {
            lat: crudo.lat,
            lon: crudo.lng,
            speedMps: doppler,
            accuracyM: crudo.accuracy,
            bearing: crudo.bearing >= 0 ? crudo.bearing : null,
            // hasAlt=false → alt null (el motor conserva la última válida;
            // JAMÁS 0 — corrección de la auditoría D3)
            alt: crudo.hasAlt === false ? null : Number.isFinite(crudo.alt) ? crudo.alt : null,
            valt: typeof crudo.valt === "number" && crudo.valt >= 0 ? crudo.valt : null,
            t: crudo.t,
            fuente: "nativa",
          };
          entregar(fix);
        });
        handles.push(handle);
        await RideNative.startLocation();
      } catch (e) {
        error(String(e));
      }
    },
    detener() {
      for (const h of handles) h.remove();
      handles.length = 0;
      void RideNative.stopLocation().catch(() => undefined);
    },
  };
}

/** Fuente web (respaldo/desarrollo). Opciones pasadas a watchPosition. */
export function crearFuenteWeb(opts: { enableHighAccuracy?: boolean } = {}): FuenteUbicacion & { tipo: "web" } {
  let watchId: number | null = null;
  return {
    tipo: "web",
    iniciar(entregar, error) {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        error("geolocalización no disponible");
        return;
      }
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const alt = pos.coords.altitude;
          const fix: FixBruto = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            speedMps: typeof pos.coords.speed === "number" && pos.coords.speed >= 0 ? pos.coords.speed : null,
            accuracyM: pos.coords.accuracy,
            bearing: typeof pos.coords.heading === "number" && pos.coords.heading >= 0 ? pos.coords.heading : null,
            alt: alt === null || !Number.isFinite(alt) ? null : alt,
            valt: null, // la web no expone accuracy vertical
            t: pos.timestamp,
            fuente: "web",
          };
          entregar(fix);
        },
        (err) => {
          // El código de error viaja prefijado para que el consumidor
          // distinga permiso denegado de un error de señal.
          error(err.code === err.PERMISSION_DENIED ? `PERMISSION_DENIED: ${err.message}` : err.message);
        },
        { enableHighAccuracy: opts.enableHighAccuracy ?? true, maximumAge: 0, timeout: 15000 }
      );
    },
    detener() {
      if (watchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    },
  };
}

/** Fuente simulada (demo/pruebas). Con semilla: recorridos deterministas.
 *  La ruta se INYECTA: sin `ruta`, Cumbre30 usa su ruta de demo del
 *  parque (SIM_ROUTE); otro proyecto pasa la suya. */
export function crearFuenteSim(
  opciones: { ruta?: PuntoRutaSim[]; speedScale?: number; loop?: boolean; semilla?: number; tickMs?: number } = {}
): FuenteUbicacion & { tipo: "sim" } {
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    tipo: "sim",
    iniciar(entregar) {
      const sim = new RideSimulator({
        ruta: opciones.ruta ?? SIM_ROUTE,
        speedScale: opciones.speedScale ?? 6,
        loop: opciones.loop ?? true,
        semilla: opciones.semilla,
      });
      const tickMs = opciones.tickMs ?? 500;
      timer = setInterval(() => {
        const f: SimFix = sim.tick(tickMs / 1000);
        const fix: FixBruto = {
          lat: f.lat,
          lon: f.lon,
          speedMps: f.speedKmh / 3.6,
          accuracyM: f.accuracyM,
          bearing: null,
          alt: f.alt,
          valt: null,
          t: f.t,
          fuente: "sim",
        };
        entregar(fix);
      }, tickMs);
    },
    detener() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
