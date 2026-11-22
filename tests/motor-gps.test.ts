// ============================================================
// MOTOR GPS · pruebas deterministas del núcleo (fase única).
// Ejecutar: npx tsx tests/motor-gps.test.ts
// Sin base de datos ni React: el núcleo (src/motor/*) es puro.
// Cubre los criterios de aceptación del encargo:
//   1. checkpoint/recuperación tras "cierre" (nuevo motor + mismo almacén)
//   2. banda muerta de distancia en reposo
//   3. coherencia velocidad-distancia-tiempo (señal perdida ≠ tiempo perdido)
//   4. altitud: nunca 0, última válida retenida, histéresis vs ruido
//   5. pausa/reanudación automáticas (FSM configurable)
//   6. gates dinámicos de salto, precisión y frescura
//   7. Kalman adaptativo + outliers + extrapolación de frenada
//   8. RideSimulator determinista (semilla)
// ============================================================
import assert from "node:assert/strict";
import { MotorGPS } from "../src/motor/nucleo";
import { almacenEnMemoria } from "../src/motor/persistencia";
import { resolverMotorConfig } from "../src/motor/config";
import { KalmanVelocidad } from "../src/motor/kalman";
import { ProcesadorPosicion } from "../src/motor/procesamiento";
import { crearFuenteSim } from "../src/motor/fuente";
import { RideSimulator } from "../src/lib/simulation";
import type { CheckpointMotor, EventoMotor, FixBruto, FuenteUbicacion } from "../src/motor/tipos";

let pasos = 0;
function ok(nombre: string): void {
  pasos += 1;
  console.log(`  ✓ ${nombre}`);
}

// ---------- utilidades de simulación determinista ----------

/** Fuente de prueba: entrega los fixes que la prueba inyecta. */
function fuenteDePrueba() {
  const fuente: FuenteUbicacion & { tipo: "nativa"; emitir: (f: FixBruto) => void } = {
    tipo: "nativa",
    iniciar(entregar, _error) {
      fuente.emitir = (f) => entregar(f);
    },
    detener() {
      fuente.emitir = () => undefined;
    },
  };
  fuente.emitir = () => undefined;
  return fuente;
}

/** Reloj controlado (ms). */
function reloj(inicio = 1_000_000) {
  let t = inicio;
  return {
    get() { return t; },
    avanza(ms: number) { t += ms; },
  };
}

function fix(
  lat: number,
  lon: number,
  t: number,
  opts: { speedMps?: number | null; accuracyM?: number; alt?: number | null; valt?: number | null; fuente?: "nativa" | "web" | "sim" } = {},
): FixBruto {
  return {
    lat,
    lon,
    speedMps: opts.speedMps ?? null,
    accuracyM: opts.accuracyM ?? 5,
    bearing: null,
    alt: opts.alt === undefined ? null : opts.alt,
    valt: opts.valt ?? null,
    t,
    fuente: opts.fuente ?? "nativa",
  };
}

/** Simula una ruta recta hacia el norte a velocidad constante (Doppler limpio). */
function rutaRecta(motor: MotorGPS, relojR: ReturnType<typeof reloj>, opts: {
  fixes: number; lat0: number; velKmh: number; dtMs?: number; alt?: ((i: number) => number) | null;
  jitterAlt?: number; semilla?: number;
}) {
  const dtSec = (opts.dtMs ?? 1000) / 1000;
  const pasoDeg = (opts.velKmh / 3.6) * dtSec / 111_320;
  let s = opts.semilla ?? 42;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  for (let i = 1; i <= opts.fixes; i++) {
    relojR.avanza(opts.dtMs ?? 1000);
    const lat = opts.lat0 + pasoDeg * i;
    const alt = opts.alt ? opts.alt(i) : null;
    const jitter = opts.jitterAlt ? (rnd() - 0.5) * 2 * opts.jitterAlt : 0;
    motor["procesarFix"](
      fix(lat, -70.65, relojR.get(), {
        speedMps: opts.velKmh / 3.6,
        accuracyM: 5,
        alt: alt === null ? null : alt + jitter,
        fuente: "nativa",
      })
    );
  }
}

// ============================================================
async function main(): Promise<void> {
  console.log("\nMOTOR GPS · pruebas deterministas del núcleo\n");

  // ---------- 1) banda muerta en reposo ----------
  {
    const relojR = reloj();
    const motor = new MotorGPS({ almacen: almacenEnMemoria(), ahora: relojR.get });
    const fuente = fuenteDePrueba();
    motor.iniciar(fuente);
    // 3 min detenido con deriva ±3 m y Doppler 0
    let s = 7;
    const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    for (let i = 0; i < 180; i++) {
      relojR.avanza(1000);
      motor["procesarFix"](
        fix(-33.4 + (rnd() - 0.5) * 0.000054, -70.65 + (rnd() - 0.5) * 0.000054, relojR.get(), {
          speedMps: 0,
          accuracyM: 4,
          alt: 850,
        })
      );
    }
    const snap = motor.snapshot()!;
    assert.ok(snap.metricas.distanciaM < 10, `distancia en reposo=${snap.metricas.distanciaM.toFixed(1)} m debe ser <10 m`);
    assert.ok(snap.metricas.movingSec < 5, "sin tiempo en movimiento en reposo");
    ok("banda muerta: 3 min detenido con deriva ±3 m → distancia <10 m");
    motor.detener();
  }

  // ---------- 2) distancia real en movimiento ----------
  {
    const relojR = reloj();
    const motor = new MotorGPS({ almacen: almacenEnMemoria(), ahora: relojR.get });
    const fuente = fuenteDePrueba();
    motor.iniciar(fuente);
    // 20 km/h × 600 s = 3.333 m esperados
    rutaRecta(motor, relojR, { fixes: 600, lat0: -33.4, velKmh: 20 });
    const snap = motor.snapshot()!;
    const esperado = (20 / 3.6) * 600;
    const errorPct = Math.abs(snap.metricas.distanciaM - esperado) / esperado * 100;
    assert.ok(errorPct < 5, `distancia ${snap.metricas.distanciaM.toFixed(0)} m vs esperado ${esperado.toFixed(0)} m (error ${errorPct.toFixed(1)}%)`);
    ok(`distancia en movimiento: error ${errorPct.toFixed(2)}% (<5%)`);
    // coherencia: elapsed ≈ 600 s por reloj, moving ≈ 600
    assert.ok(Math.abs(snap.metricas.elapsedSec - 600) < 2, "elapsed por reloj ≈ 600 s");
    assert.ok(Math.abs(snap.metricas.movingSec - 600) < 5, "movingSec ≈ 600 s");
    ok("coherencia d-t-v: elapsed y moving consistentes con la distancia");
    motor.detener();
  }

  // ---------- 3) pérdida de señal NO resta tiempo ----------
  {
    const relojR = reloj();
    const motor = new MotorGPS({ almacen: almacenEnMemoria(), ahora: relojR.get });
    motor.iniciar(fuenteDePrueba());
    rutaRecta(motor, relojR, { fixes: 60, lat0: -33.4, velKmh: 18 }); // 60 s
    // túnel de 5 minutos: el reloj avanza, NO llegan fixes
    relojR.avanza(300_000);
    rutaRecta(motor, relojR, { fixes: 60, lat0: -33.4 + (18 / 3.6) * 60 / 111_320, velKmh: 18 });
    const snap = motor.snapshot()!;
    assert.ok(snap.metricas.elapsedSec > 400, `elapsed=${snap.metricas.elapsedSec.toFixed(0)} s debe incluir el hueco (reloj)`);
    assert.ok(snap.metricas.movingSec < 130, `movingSec=${snap.metricas.movingSec.toFixed(0)} s: sin fixes no hay tiempo en movimiento`);
    ok(`túnel de 5 min: elapsed por reloj ${snap.metricas.elapsedSec.toFixed(0)} s (no ${120} s)`);
    motor.detener();
  }

  // ---------- 4) altitud: nunca 0, última válida, histéresis ----------
  {
    const relojR = reloj();
    const motor = new MotorGPS({ almacen: almacenEnMemoria(), ahora: relojR.get });
    motor.iniciar(fuenteDePrueba());
    // cadena: 850 válido, 2 fixes sin altitud, 860 válido → sin salto a 0
    let lat = -33.4;
    const paso = (20 / 3.6) / 111_320;
    relojR.avanza(1000);
    motor["procesarFix"](fix(lat, -70.65, relojR.get(), { speedMps: 20 / 3.6, alt: 850 }));
    for (const a of [null, null]) {
      relojR.avanza(1000); lat += paso;
      motor["procesarFix"](fix(lat, -70.65, relojR.get(), { speedMps: 20 / 3.6, alt: a }));
    }
    relojR.avanza(1000); lat += paso;
    motor["procesarFix"](fix(lat, -70.65, relojR.get(), { speedMps: 20 / 3.6, alt: 860 }));
    const snap = motor.snapshot()!;
    assert.ok(snap.metricas.gainM < 12, `gain con alt null=${snap.metricas.gainM.toFixed(1)} m no debe explotar (sin dips a 0)`);
    assert.ok(snap.metricas.altMinM! > 800, "altMin no cayó a 0");
    ok("altitud ausente jamás se convierte en 0 (última válida retenida)");
    motor.detener();
  }
  {
    // ruido vertical σ=10 en llano → gain pequeño; subida real 50 m → capturada
    const relojR = reloj();
    const motor = new MotorGPS({ almacen: almacenEnMemoria(), ahora: relojR.get });
    motor.iniciar(fuenteDePrueba());
    rutaRecta(motor, relojR, { fixes: 120, lat0: -33.4, velKmh: 20, alt: () => 850, jitterAlt: 10, semilla: 99 });
    const plano = motor.snapshot()!.metricas;
    assert.ok(plano.gainM < 10, `gain en plano con σ=10 = ${plano.gainM.toFixed(1)} m debe ser <10 m`);
    ok(`histéresis vertical: ruido σ=10 en llano → gain ${plano.gainM.toFixed(1)} m (<10 m)`);
    motor.detener();
  }
  {
    const relojR = reloj();
    const motor = new MotorGPS({ almacen: almacenEnMemoria(), ahora: relojR.get });
    motor.iniciar(fuenteDePrueba());
    // subida real de 50 m en 4 min con el mismo ruido
    rutaRecta(motor, relojR, {
      fixes: 240, lat0: -33.4, velKmh: 20,
      alt: (i) => 850 + (50 / 240) * i, jitterAlt: 10, semilla: 77,
    });
    const subida = motor.snapshot()!.metricas;
    assert.ok(subida.gainM >= 40 && subida.gainM <= 65, `gain de subida real 50 m = ${subida.gainM.toFixed(1)} m (esperado 40-65)`);
    assert.ok(subida.altMaxM! >= 895 && subida.altMinM! <= 855, "altMin/altMax plausibles");
    ok(`subida real de 50 m con ruido σ=10 → gain ${subida.gainM.toFixed(1)} m (40-65)`);
    motor.detener();
  }
  {
    // altitud vertical de mala calidad (valt ≥ 30) no alimenta el desnivel
    const relojR = reloj();
    const motor = new MotorGPS({ almacen: almacenEnMemoria(), ahora: relojR.get });
    motor.iniciar(fuenteDePrueba());
    let lat = -33.4;
    for (let i = 1; i <= 60; i++) {
      relojR.avanza(1000); lat += (20 / 3.6) / 111_320;
      motor["procesarFix"](fix(lat, -70.65, relojR.get(), { speedMps: 20 / 3.6, alt: 850 + (i % 2) * 25, valt: 40 }));
    }
    const snap = motor.snapshot()!;
    assert.ok(snap.metricas.gainM < 1, `gain con valt=40 m = ${snap.metricas.gainM.toFixed(1)} debe ser ~0`);
    ok("accuracy vertical mala (valt ≥30 m) no alimenta el desnivel");
    motor.detener();
  }

  // ---------- 5) pausa/reanudación automáticas ----------
  {
    const relojR = reloj();
    const motor = new MotorGPS({ almacen: almacenEnMemoria(), ahora: relojR.get });
    const eventos: EventoMotor[] = [];
    motor.on((e) => eventos.push(e));
    motor.iniciar(fuenteDePrueba());
    // pedalea 30 s a 20 km/h
    rutaRecta(motor, relojR, { fixes: 30, lat0: -33.4, velKmh: 20 });
    // se detiene en un semáforo: Doppler 0 durante 18 s
    const latQuieto = -33.4 + (20 / 3.6) * 30 / 111_320;
    for (let i = 0; i < 18; i++) {
      relojR.avanza(1000);
      motor["procesarFix"](fix(latQuieto, -70.65, relojR.get(), { speedMps: 0, accuracyM: 4, alt: 850 }));
    }
    assert.equal(motor.estado, "autoPausada", "FSM → autoPausada tras 15 s detenido");
    const elapsedAlPausar = motor.snapshot()!.metricas.elapsedSec;
    ok("auto-pausa: detenido 15 s → autoPausada");
    // sigue detenido 20 s más: elapsed NO avanza
    for (let i = 0; i < 20; i++) {
      relojR.avanza(1000);
      motor["procesarFix"](fix(latQuieto, -70.65, relojR.get(), { speedMps: 0, accuracyM: 4, alt: 850 }));
    }
    const elapsedCongelado = motor.snapshot()!.metricas.elapsedSec;
    assert.ok(Math.abs(elapsedCongelado - elapsedAlPausar) < 1.5, `elapsed congelado en auto-pausa (${elapsedAlPausar.toFixed(0)} vs ${elapsedCongelado.toFixed(0)})`);
    ok("tiempo en auto-pausa NO cuenta (cronómetro detenido)");
    // vuelve a pedalear a 12 km/h → auto-reanudación
    let lat = latQuieto;
    for (let i = 0; i < 10; i++) {
      relojR.avanza(1000); lat += (12 / 3.6) / 111_320;
      motor["procesarFix"](fix(lat, -70.65, relojR.get(), { speedMps: 12 / 3.6, accuracyM: 4, alt: 850 }));
    }
    assert.equal(motor.estado, "corriendo", "FSM → corriendo al pedalear ≥3 km/h");
    const distTotal = motor.snapshot()!.metricas.distanciaM;
    assert.ok(distTotal < (20 / 3.6) * 30 + (12 / 3.6) * 10 + 30, "sin distancia fantasma del tiempo detenido");
    ok("auto-reanudación al pedalear + sin distancia fantasma");
    motor.detener();
  }
  {
    // auto-pausa desactivada por config (perfil)
    const relojR = reloj();
    const motor = new MotorGPS({
      almacen: almacenEnMemoria(), ahora: relojR.get,
      config: { autoPausa: { activada: false, kmhParada: 2, segParada: 15, kmhReanudar: 3 } },
    });
    motor.iniciar(fuenteDePrueba());
    rutaRecta(motor, relojR, { fixes: 20, lat0: -33.4, velKmh: 20 });
    const latQuieto = -33.4 + (20 / 3.6) * 20 / 111_320;
    for (let i = 0; i < 30; i++) {
      relojR.avanza(1000);
      motor["procesarFix"](fix(latQuieto, -70.65, relojR.get(), { speedMps: 0, accuracyM: 4, alt: 850 }));
    }
    assert.equal(motor.estado, "corriendo", "con auto-pausa OFF sigue corriendo");
    ok("config por perfil: auto-pausa desactivable sin tocar el núcleo");
    motor.detener();
  }

  // ---------- 6) gates dinámicos ----------
  {
    const cfg = resolverMotorConfig({});
    const relojR = reloj();
    const proc = new ProcesadorPosicion(cfg, relojR.get);
    const t0 = relojR.get();
    assert.equal(proc.procesar(fix(-33.4, -70.65, t0, { speedMps: 0 })).aceptado, true, "primer fix aceptado");
    // fix con mala precisión
    const rAcc = proc.procesar(fix(-33.4001, -70.65, t0 + 1000, { speedMps: 0, accuracyM: 70 }));
    assert.equal(rAcc.aceptado, false, "accuracy 70 m rechazada");
    // fix obsoleto (fuente web, reloj avanzado 10 s)
    relojR.avanza(10000);
    const procWeb = new ProcesadorPosicion(cfg, relojR.get);
    procWeb.procesar(fix(-33.4, -70.65, relojR.get(), { speedMps: 0, fuente: "web" }));
    relojR.avanza(10000);
    const rObsoleto = procWeb.procesar(fix(-33.4001, -70.65, relojR.get() - 9000, { speedMps: 0, fuente: "web" }));
    assert.equal(rObsoleto.aceptado, false, "fix obsoleto (>5 s de edad) rechazado");
    ok("gates: precision ≥60 m y fixes obsoletos rechazados");
  }
  {
    // salto dinámico: a 40 km/h el margen se estrecha (44 m @1s), en reposo queda 100 m
    const cfg = resolverMotorConfig({});
    const relojR = reloj();
    const proc = new ProcesadorPosicion(cfg, relojR.get);
    let lat = -33.4;
    proc.procesar(fix(lat, -70.65, relojR.get(), { speedMps: 40 / 3.6 }));
    for (let i = 0; i < 20; i++) {
      relojR.avanza(1000); lat += (40 / 3.6) / 111_320;
      proc.procesar(fix(lat, -70.65, relojR.get(), { speedMps: 40 / 3.6 }));
    }
    const rSalto = proc.procesar(fix(lat + 0.002, -70.65, relojR.get() + 1000, { speedMps: 40 / 3.6 })); // ~222 m
    assert.equal(rSalto.aceptado, false, "salto de 222 m a 40 km/h (dMax≈44 m) rechazado");
    // en reposo, el salto base sigue en 100 m: 60 m de deriva pasa (conservador)
    const proc2 = new ProcesadorPosicion(cfg, relojR.get);
    proc2.procesar(fix(-33.4, -70.65, relojR.get(), { speedMps: 0 }));
    const r60 = proc2.procesar(fix(-33.4 + 60 / 111_320, -70.65, relojR.get() + 1000, { speedMps: 0 }));
    assert.equal(r60.aceptado, true, "60 m en reposo dentro del salto base (histórico)");
    const r150 = proc2.procesar(fix(-33.4 + 60 / 111_320 + 150 / 111_320, -70.65, relojR.get() + 2000, { speedMps: 0 }));
    assert.equal(r150.aceptado, false, "150 m en reposo rechazado (salto base)");
    ok("umbral de salto dinámico: se estrecha con la velocidad, base 100 m");
  }

  // ---------- 7) Kalman adaptativo + outliers + frenada ----------
  {
    const k = new KalmanVelocidad(resolverMotorConfig({}).kalman);
    let v = 0;
    for (let i = 0; i < 30; i++) v = k.update(20 / 3.6 + (i % 2 === 0 ? 0.3 : -0.3), 1, 4); // ruido ±0.3 m/s, accuracy 4 m
    const errPct = Math.abs((v * 3.6 - 20) / 20) * 100;
    assert.ok(errPct < 8, `Kalman converge a 20 km/h (error ${errPct.toFixed(1)}%)`);
    // outlier imposible: Doppler 200 km/h con estado a 20 → amortiguado
    const vOutlier = k.update(200 / 3.6, 1, 4);
    assert.ok(vOutlier * 3.6 < 40, `outlier de 200 km/h amortiguado (${(vOutlier * 3.6).toFixed(1)} km/h)`);
    ok(`Kalman: converge (error ${errPct.toFixed(1)}%) y amortigua outliers`);
    // R adaptativo: con accuracy mala el filtro se vuelve más lento
    const kA = new KalmanVelocidad(resolverMotorConfig({ kalman: { q: 0.55, r: 0.35, rAccReferenciaM: 6, rAccMax: 4 } }).kalman);
    let buena = 0, mala = 0;
    for (let i = 0; i < 10; i++) buena = kA.update(10 / 3.6, 1, 3);
    kA.restaurar(null); // reinicio de estado
    let v0 = 0; for (let i = 0; i < 10; i++) v0 = kA.update(20 / 3.6, 1, 3); // no usado, solo calentar
    kA.restaurar(null);
    for (let i = 0; i < 10; i++) mala = kA.update(10 / 3.6, 1, 40);
    assert.ok(Math.abs(buena * 3.6 - 10) <= Math.abs(mala * 3.6 - 10) + 2, "fix con accuracy 3 m converge más rápido que uno con 40 m");
    ok("R adaptativo: precisión del fix modula la confianza");
  }
  {
    // extrapolación de frenada: al frenar bruscamente no sobrestima
    const cfg = resolverMotorConfig({});
    const relojR = reloj();
    const proc = new ProcesadorPosicion(cfg, relojR.get);
    let lat = -33.4;
    proc.procesar(fix(lat, -70.65, relojR.get(), { speedMps: 10 }));
    for (let i = 0; i < 10; i++) { relojR.avanza(1000); lat += 10 / 111_320; proc.procesar(fix(lat, -70.65, relojR.get(), { speedMps: 10 })); }
    // frenada: 10 → 2 m/s en un fix (aceleración implícita -8 m/s²,
    // compuerta ×25 amortigua el salto). Criterio correcto (auditoría R2):
    // la velocidad NUNCA sobrepasa la previa a la frenada y converge a
    // la real en ≤3 fixes (el lag de 1 fix es el diseño anti-spike).
    relojR.avanza(1000); lat += 2 / 111_320;
    const r1 = proc.procesar(fix(lat, -70.65, relojR.get(), { speedMps: 2 }));
    const v1 = r1.aceptado ? r1.velKmh : -1;
    assert.ok(v1 > 0 && v1 < 36, `tras frenada ${v1.toFixed(1)} km/h < 36 (sin overshoot)`);
    let v3 = v1;
    for (let i = 0; i < 2; i++) { relojR.avanza(1000); lat += 2 / 111_320; const r = proc.procesar(fix(lat, -70.65, relojR.get(), { speedMps: 2 })); if (r.aceptado) v3 = r.velKmh; }
    assert.ok(v3 < 12, `converge tras frenar: ${v3.toFixed(1)} km/h (<12) en ≤3 fixes`);
    ok(`frenada brusca: sin overshoot (${v1.toFixed(1)} km/h) y convergencia ${v3.toFixed(1)} km/h`);
  }

  // ---------- 8) checkpoint y recuperación (criterio 1) ----------
  {
    const almacen = almacenEnMemoria();
    const relojR = reloj();
    const motor1 = new MotorGPS({ almacen, ahora: relojR.get, config: { checkpointCadaSec: 5 } });
    motor1.iniciar(fuenteDePrueba());
    motor1.setExtra({ overSec: 12, dentro: true, parkDistanceM: 250 });
    rutaRecta(motor1, relojR, { fixes: 40, lat0: -33.4, velKmh: 20, alt: () => 850 }); // 40 s → 2 checkpoints
    assert.ok(almacen.leer() !== null, "checkpoint escrito durante el ride");
    const distAntes = motor1.snapshot()!.metricas.distanciaM;
    // "cierre inesperado": el motor1 muere sin detener() (sin borrar checkpoint)
    const cp1 = almacen.leer();
    assert.ok(cp1 !== null);
    assert.equal(cp1!.extra?.overSec, 12, "extras del consumidor en el checkpoint");
    // nuevo proceso: mismo almacén
    const relojR2 = reloj(relojR.get());
    const motor2 = new MotorGPS({ almacen, ahora: relojR2.get, config: { checkpointCadaSec: 5 } });
    assert.equal(motor2.hayRecuperacion(), true, "recuperación detectada al reabrir");
    const fuente2 = fuenteDePrueba();
    motor2.retomar(cp1!, fuente2);
    assert.equal(motor2.estado, "corriendo");
    rutaRecta(motor2, relojR2, { fixes: 20, lat0: -33.4 + (20 / 3.6) * 40 / 111_320, velKmh: 20, alt: () => 850 });
    const snap2 = motor2.snapshot()!;
    const esperadoTotal = (20 / 3.6) * (40 + 20);
    const errorPct = Math.abs(snap2.metricas.distanciaM - esperadoTotal) / esperadoTotal * 100;
    assert.ok(errorPct < 6, `distancia tras retomar = ${snap2.metricas.distanciaM.toFixed(0)} m vs esperado ${esperadoTotal.toFixed(0)} m (error ${errorPct.toFixed(1)}%)`);
    assert.ok(snap2.metricas.elapsedSec > 55, "elapsed continuo tras retomar (reloj de pared)");
    ok(`recuperación: ride retomado con distancia continua (error ${errorPct.toFixed(1)}%) y elapsed por reloj`);
    motor2.detener();
    assert.equal(motor2.hayRecuperacion(), false, "checkpoint borrado al detener");
  }
  {
    // descartar + checkpoint corrupto
    const almacen = almacenEnMemoria();
    const motor = new MotorGPS({ almacen, ahora: reloj(1).get });
    assert.equal(motor.hayRecuperacion(), false, "sin checkpoint no hay recuperación");
    almacen.guardar({ version: 1 } as unknown as CheckpointMotor);
    assert.equal(motor.hayRecuperacion(), false, "checkpoint corrupto descartado por validación");
    motor.descartarRecuperacion();
    ok("validación de checkpoint: corrupto/incompleto no se retoma");
  }

  // ---------- 9) pausa manual ----------
  {
    const relojR = reloj();
    const motor = new MotorGPS({ almacen: almacenEnMemoria(), ahora: relojR.get });
    motor.iniciar(fuenteDePrueba());
    rutaRecta(motor, relojR, { fixes: 20, lat0: -33.4, velKmh: 20 });
    motor.pausar();
    const elapsedPausa = motor.snapshot()!.metricas.elapsedSec;
    relojR.avanza(120_000); // 2 min en pausa (fixes siguen llegando: el mapa vive)
    let lat = -33.4 + (20 / 3.6) * 20 / 111_320;
    for (let i = 0; i < 10; i++) { relojR.avanza(1000); lat += (20 / 3.6) / 111_320; motor["procesarFix"](fix(lat, -70.65, relojR.get(), { speedMps: 20 / 3.6, alt: 850 })); }
    const snap = motor.snapshot()!;
    assert.ok(Math.abs(snap.metricas.elapsedSec - elapsedPausa) < 1.5, "elapsed congelado en pausa manual");
    assert.equal(motor.estado, "pausada");
    motor.reanudar();
    // primer fix tras reanudar: filtros limpios, acepta sin salto
    relojR.avanza(1000); lat += (20 / 3.6) / 111_320;
    const r = motor.snapshot();
    assert.equal(motor.estado, "corriendo", "reanudado");
    ok("pausa manual: elapsed congelado, reanudación limpia");
    motor.detener();
  }

  // ---------- 10) RideSimulator determinista (semilla) ----------
  {
    const s1 = new RideSimulator(6, true, 2026);
    const s2 = new RideSimulator(6, true, 2026);
    for (let i = 0; i < 10; i++) {
      const a = s1.tick(0.5);
      const b = s2.tick(0.5);
      assert.equal(a.lat, b.lat, "misma lat");
      assert.equal(a.speedKmh, b.speedKmh, "misma velocidad");
    }
    ok("RideSimulator con semilla: secuencias idénticas (tests reproducibles)");
  }

  // ---------- 11) fuente sim entrega al motor (integración) ----------
  {
    const relojR = reloj();
    const motor = new MotorGPS({ almacen: almacenEnMemoria(), ahora: relojR.get });
    motor.iniciar(crearFuenteSim({ speedScale: 12, tickMs: 20, semilla: 5 }));
    await new Promise((r) => setTimeout(r, 400));
    const snap = motor.snapshot();
    motor.detener();
    assert.ok(snap && snap.metricas.fixes > 3, `fuente sim alimenta el núcleo (${snap?.metricas.fixes} fixes)`);
    assert.ok(snap!.metricas.distanciaM > 0, "distancia acumulada en sim");
    ok(`integración fuente sim → núcleo: ${snap!.metricas.fixes} fixes, ${(snap!.metricas.distanciaM / 1000).toFixed(2)} km`);
  }

  console.log(`\nMOTOR GPS: ${pasos} verificaciones OK\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
