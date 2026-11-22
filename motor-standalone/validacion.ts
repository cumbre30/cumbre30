// ============================================================
// PROYECTO DE VALIDACIÓN INDEPENDIENTE del MotorGPS.
// Ejecutar desde la raíz del repo:  npx tsx motor-standalone/validacion.ts
//
// Demuestra (punto 6 del encargo de cierre) que el núcleo del
// motor es REUTILIZABLE sin Cumbre30: este proyecto consume SOLO
//   · la API pública del motor  → src/motor/index.ts
//   · el simulador (toolkit)    → src/lib/simulation.ts
// y NADA más: ni park.ts, ni lib/geo, ni rideNative, ni React,
// ni i18n, ni reglas del Parque, ni la fiscalización de 30 km/h.
// Sus importaciones se resuelven SIN los alias "@/..." de la app
// (este proyecto tiene su propio tsconfig sin paths).
//
// Lo que hace:
//   1. Crea su PROPIA configuración (perfil propio del consumidor).
//   2. Inyecta su PROPIA fuente de ubicación (generador sintético).
//   3. Inicia el motor y recibe eventos tipados.
//   4. Consulta métricas.
//   5. Gestiona su PROPIO almacenamiento (contrato AlmacenCheckpoint
//      implementado sobre un archivo JSON de ESTE proyecto).
//   6. Simula un "cierre inesperado" y RETOMA el ride con su almacén.
//   7. Ejecuta pruebas con RideSimulator (ruta propia, no del parque).
// ============================================================

import { writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

// --- ÚNICAS dependencias permitidas: la API pública del motor ---
import {
  MotorGPS,
  resolverMotorConfig,
  almacenEnMemoria,
  haversineM,
  KalmanVelocidad,
  type AlmacenCheckpoint,
  type CheckpointMotor,
  type EventoMotor,
  type FixBruto,
  type FuenteUbicacion,
  type MetricasMotor,
} from "../src/motor/index";
// --- y el simulador (toolkit reutilizable, ruta inyectada) ---
import { RideSimulator, type PuntoRutaSim } from "../src/lib/simulation";

// ------------------------------------------------------------
// 1) Configuración PROPIA del proyecto (nada de perfiles de la app):
//    gates más estrictos, checkpoint cada 10 s, auto-pausa propia.
// ------------------------------------------------------------
const MI_CONFIG = resolverMotorConfig({
  gateAccuracyM: 25,
  saltoBaseM: 60,
  checkpointCadaSec: 10,
  umbralMovimientoKmh: 2.0,
  autoPausa: { activada: true, kmhParada: 1.5, segParada: 20, kmhReanudar: 2.5 },
  kalman: { q: 0.4, r: 0.3, rAccReferenciaM: 5, rAccMax: 3 },
});

// ------------------------------------------------------------
// 2) Almacenamiento PROPIO del proyecto (contrato AlmacenCheckpoint
//    implementado sobre un archivo JSON local). El motor no sabe
//    cómo ni dónde se guarda: solo conoce el contrato.
// ------------------------------------------------------------
const ARCHIVO_SESION = join(import.meta.dirname ?? ".", ".sesion-checkpoint.json");

function miAlmacen(): AlmacenCheckpoint {
  return {
    guardar(cp: CheckpointMotor): void {
      writeFileSync(ARCHIVO_SESION, JSON.stringify(cp), "utf8");
    },
    leer(): CheckpointMotor | null {
      if (!existsSync(ARCHIVO_SESION)) return null;
      try {
        return JSON.parse(readFileSync(ARCHIVO_SESION, "utf8")) as CheckpointMotor;
      } catch {
        return null;
      }
    },
    borrar(): void {
      try {
        if (existsSync(ARCHIVO_SESION)) rmSync(ARCHIVO_SESION);
      } catch {
        // nada que borrar
      }
    },
  };
}

// ------------------------------------------------------------
// 3) Fuente de ubicación PROPIA del proyecto: un generador sintético
//    que produce FixBruto (ni navigator.geolocation ni el plugin
//    nativo de Cumbre30 — cualquier origen sirve al contrato).
// ------------------------------------------------------------
function miFuente(opciones: { lat0: number; velKmh: number; dtMs: number; velocidad?: () => number }) {
  let lat = opciones.lat0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const fuente: FuenteUbicacion & { tipo: "nativa" } = {
    tipo: "nativa",
    iniciar(entregar) {
      timer = setInterval(() => {
        const v = (opciones.velocidad ?? (() => opciones.velKmh))();
        lat += ((v / 3.6) * opciones.dtMs) / 1000 / 111_320;
        const fix: FixBruto = {
          lat,
          lon: -70.5,
          speedMps: v / 3.6,
          accuracyM: 4,
          bearing: 0,
          alt: 500,
          valt: 3,
          t: Date.now(),
          fuente: "nativa",
        };
        entregar(fix);
      }, opciones.dtMs);
    },
    detener() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
  return fuente;
}

// ------------------------------------------------------------
async function principal(): Promise<void> {
  console.log("\nVALIDACIÓN INDEPENDIENTE DEL MOTOR GPS\n");

  // --- escenario A: ride propio con fuente propia ---
  const eventos: EventoMotor[] = [];
  const motor = new MotorGPS({ config: MI_CONFIG, almacen: miAlmacen() });
  const suscripcion = motor.on((e) => eventos.push(e));
  const fuenteA = miFuente({ lat0: -33.45, velKmh: 18, dtMs: 100 });
  motor.iniciar(fuenteA);

  await new Promise((r) => setTimeout(r, 2500)); // la fuente entrega fixes en vivo
  const m: MetricasMotor = motor.snapshot()!.metricas;
  console.log(`A. ride propio: ${m.fixes} fixes, ${(m.distanciaM / 1000).toFixed(2)} km, ${m.elapsedSec.toFixed(0)} s, ${m.velKmh.toFixed(1)} km/h`);
  console.log(`   eventos tipados recibidos: ${eventos.length} (fix/estado/alerta: ${new Set(eventos.map((e) => e.tipo)).size} tipos)`);
  if (m.fixes < 10) throw new Error("la fuente propia no alimentó al motor");
  if (m.distanciaM <= 0) throw new Error("distancia nula con fuente propia");

  // métricas consultadas directamente (API)
  const vel = motor.velKmhActual();
  console.log(`   velKmhActual()=${vel.toFixed(1)} · estado=${motor.estado}`);
  suscripcion(); // des-suscripción tipada

  // --- escenario B: "cierre inesperado" y retomar con SU almacén ---
  motor.forzarCheckpoint(); // el checkpoint queda en el archivo de ESTE proyecto
  if (!existsSync(ARCHIVO_SESION)) throw new Error("su almacén no escribió el checkpoint");
  fuenteA.detener(); // su fuente muere (proceso "crasheado"): el checkpoint queda
  console.log(`B. checkpoint propio en ${ARCHIVO_SESION}`);
  // el "proceso muere": no se llama detener(); se crea OTRO motor
  const motor2 = new MotorGPS({ config: MI_CONFIG, almacen: miAlmacen() });
  const cp = motor2.leerRecuperacion();
  if (!cp) throw new Error("no recuperó desde su almacén propio");
  motor2.retomar(cp, miFuente({ lat0: -33.45 + (18 / 3.6) * 2.5 / 111_320, velKmh: 18, dtMs: 100 }));
  await new Promise((r) => setTimeout(r, 1500)); // continúa el ride retomado
  const m2 = motor2.snapshot()!.metricas;
  console.log(`   retomado: distancia ${m2.distanciaM.toFixed(0)} m ≥ checkpoint ${cp.metricas.distanciaM.toFixed(0)} m, fixes ${m2.fixes}`);
  if (m2.distanciaM < cp.metricas.distanciaM) throw new Error("la distancia no es continua tras retomar");
  motor2.detener(); // borra el checkpoint de su almacén
  if (existsSync(ARCHIVO_SESION)) throw new Error("su almacén no borró el checkpoint");
  console.log("   checkpoint borrado por su propio almacén al detener");

  // --- escenario C: RideSimulator con ruta del proyecto ---
  const RUTA_PROPIA: PuntoRutaSim[] = [
    { lat: 40.4168, lon: -3.7038, kmh: 15, alt: 650 },   // Madrid (ruta ajena a Cumbre30)
    { lat: 40.4090, lon: -3.6920, kmh: 25, alt: 680 },
    { lat: 40.4020, lon: -3.6850, kmh: 10, alt: 700 },
  ];
  const sim = new RideSimulator({ ruta: RUTA_PROPIA, speedScale: 8, loop: false, semilla: 7 });
  const motorSim = new MotorGPS({ config: MI_CONFIG, almacen: almacenEnMemoria() });
  const fuenteSim: FuenteUbicacion = {
    tipo: "sim",
    iniciar(entregar) {
      const iv = setInterval(() => {
        const f = sim.tick(0.1);
        entregar({
          lat: f.lat, lon: f.lon, speedMps: f.speedKmh / 3.6, accuracyM: f.accuracyM,
          bearing: null, alt: f.alt, valt: null, t: f.t, fuente: "sim",
        });
      }, 100);
      (fuenteSim as { _iv?: ReturnType<typeof setInterval> })._iv = iv;
    },
    detener() {
      const iv = (fuenteSim as { _iv?: ReturnType<typeof setInterval> })._iv;
      if (iv) clearInterval(iv);
    },
  };
  motorSim.iniciar(fuenteSim);
  await new Promise((r) => setTimeout(r, 1200)); // sim alimenta al motor
  const ms = motorSim.snapshot()!.metricas;
  motorSim.detener();
  console.log(`C. RideSimulator (ruta propia ${sim.totalKm.toFixed(2)} km): ${ms.fixes} fixes, ${(ms.distanciaM / 1000).toFixed(2)} km, gain ${ms.gainM.toFixed(0)} m`);
  if (ms.distanciaM <= 0) throw new Error("el simulador no alimentó al motor");

  // --- escenario D: utilidades del núcleo usables por terceros ---
  const d = haversineM({ lat: RUTA_PROPIA[0].lat, lon: RUTA_PROPIA[0].lon }, { lat: RUTA_PROPIA[1].lat, lon: RUTA_PROPIA[1].lon });
  const k = new KalmanVelocidad(MI_CONFIG.kalman);
  let v = 0;
  for (let i = 0; i < 20; i++) v = k.update(5, 1, 4);
  console.log(`D. haversineM=${d.toFixed(1)} m · Kalman converge a ${(v * 3.6).toFixed(1)} km/h (medido 18)`);
  if (!(d > 1000 && d < 3000)) throw new Error("haversine fuera de rango");

  console.log("\nVALIDACIÓN OK — el núcleo es consumible sin Cumbre30\n");
}

void principal();
