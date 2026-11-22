// ============================================================
// MOTOR GPS · CIERRE DE FASE ÚNICA · pruebas de arquitectura y
// persistencia. Ejecutar: npx tsx tests/motor-cierre.test.ts
//   1. Almacén duradero (localStorage + espejo nativo): recuperación
//      aunque el WebView se limpie o se pierda la última escritura.
//   2. Pureza del núcleo: src/motor/* no importa nada de la app
//      (lib/park, lib/geo, lib/rideNative, React, pantallas…).
//   3. Identidad de tiempos: elapsed + pausa = reloj de pared.
//   4. API pública: src/motor/index.ts exporta el consumible.
// ============================================================
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { MotorGPS } from "../src/motor/nucleo";
import { almacenEnMemoria } from "../src/motor/persistencia";
import { crearAlmacenDuradero } from "../src/lib/almacenDuradero";
import type { EventoMotor, FixBruto } from "../src/motor/tipos";

let pasos = 0;
function ok(nombre: string): void {
  pasos += 1;
  console.log(`  ✓ ${nombre}`);
}

function reloj(inicio = 1_000_000) {
  let t = inicio;
  return { get: () => t, avanza: (ms: number) => { t += ms; } };
}

function fix(lat: number, lon: number, t: number, speedMps: number): FixBruto {
  return { lat, lon, speedMps, accuracyM: 5, bearing: null, alt: 850, valt: null, t, fuente: "nativa" };
}

function fuenteDePrueba(): import("../src/motor/tipos").FuenteUbicacion & { tipo: "nativa"; emitir: (f: FixBruto) => void } {
  const fuente: import("../src/motor/tipos").FuenteUbicacion & { tipo: "nativa"; emitir: (f: FixBruto) => void } = {
    tipo: "nativa",
    emitir: (f: FixBruto) => undefined,
    iniciar(entregar: (f: FixBruto) => void) {
      fuente.emitir = (f) => entregar(f);
    },
    detener() {
      fuente.emitir = () => undefined;
    },
  };
  return fuente;
}

/** Punto de ruta recta al norte para pedalear N segundos a v km/h. */
function pedalea(motor: MotorGPS, rl: ReturnType<typeof reloj>, segs: number, lat: number, velKmh: number): number {
  const paso = (velKmh / 3.6) / 111_320;
  for (let i = 0; i < segs; i++) {
    rl.avanza(1000);
    lat += paso;
    motor["procesarFix"](fix(lat, -70.65, rl.get(), velKmh / 3.6));
  }
  return lat;
}

// ============================================================
async function main(): Promise<void> {
  console.log("\nMOTOR GPS · CIERRE · arquitectura y persistencia\n");

  // ---------- 1) almacén duradero: espejo nativo ----------
  {
    // el WebView está LIMPIO (sin localStorage) pero el espejo nativo
    // tiene el checkpoint: la recuperación sale del archivo nativo.
    const puente = {
      dato: null as string | null,
      async leer() { return this.dato; },
      async escribir(d: string) { this.dato = d; },
      async borrar() { this.dato = null; },
    };
    const almacen = crearAlmacenDuradero({ nativo: puente });
    const rl = reloj();
    const motor1 = new MotorGPS({ almacen, ahora: rl.get, config: { checkpointCadaSec: 5 } });
    motor1.iniciar(fuenteDePrueba());
    pedalea(motor1, rl, 30, -33.4, 20);
    await new Promise((r) => setTimeout(r, 10)); // deja drenar la cola nativa
    assert.ok(puente.dato !== null, "espejo nativo escrito durante el ride");
    const distNativa = (JSON.parse(puente.dato!) as { metricas: { distanciaM: number } }).metricas.distanciaM;
    // "muerte" del proceso: motor nuevo + WebView limpio (sin localStorage)
    await almacen.precargar();
    const motor2 = new MotorGPS({ almacen, ahora: rl.get, config: { checkpointCadaSec: 5 } });
    const cp = motor2.leerRecuperacion();
    assert.ok(cp !== null, "checkpoint recuperado desde el espejo nativo");
    assert.ok(Math.abs(cp!.metricas.distanciaM - distNativa) < 0.001, "distancia íntegra del espejo");
    ok("limpieza del WebView: el checkpoint vive en el espejo nativo");
    motor2.descartarRecuperacion();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(puente.dato, null, "borrado también en nativo");
    ok("descartar recuperación borra ambas capas");
  }
  {
    // DOBLE CAPA: el localStorage del WebView quedó con un checkpoint
    // viejo (su última escritura se perdió en el commit diferido de
    // Chromium) y el espejo nativo con uno MÁS RECIENTE → prevalece
    // el nativo. También se verifica la escritura en ambas capas.
    const shim = new Map<string, string>();
    (globalThis as { window?: unknown }).window = { localStorage: {
      getItem: (k: string) => (shim.has(k) ? shim.get(k)! : null),
      setItem: (k: string, v: string) => void shim.set(k, v),
      removeItem: (k: string) => void shim.delete(k),
    } };
    try {
      const puente = {
        dato: null as string | null,
        async leer() { return this.dato; },
        async escribir(d: string) { this.dato = d; },
        async borrar() { this.dato = null; },
      };
      const almacen = crearAlmacenDuradero({ nativo: puente });
      const rl = reloj();
      const motor1 = new MotorGPS({ almacen, ahora: rl.get, config: { checkpointCadaSec: 5 } });
      motor1.iniciar(fuenteDePrueba());
      pedalea(motor1, rl, 25, -33.4, 20);
      await new Promise((r) => setTimeout(r, 10));
      const claves = [...shim.keys()];
      assert.ok(claves.length === 1, `escritura sincrónica en localStorage (${claves.join(",")})`);
      assert.ok(puente.dato !== null, "escritura en espejo nativo");
      // localStorage se queda VIEJO: el nativo avanza 10 s y 111 m más
      const cpViejo = JSON.parse(shim.get(claves[0])!) as { ultimoGuardadoTs: number; metricas: { distanciaM: number } };
      cpViejo.ultimoGuardadoTs = rl.get() - 10_000;
      shim.set(claves[0], JSON.stringify(cpViejo));
      const cpNuevo = JSON.parse(puente.dato!) as { ultimoGuardadoTs: number; metricas: { distanciaM: number } };
      cpNuevo.ultimoGuardadoTs = rl.get();
      cpNuevo.metricas.distanciaM += 111;
      puente.dato = JSON.stringify(cpNuevo);
      await almacen.precargar();
      const motor2 = new MotorGPS({ almacen, ahora: rl.get, config: { checkpointCadaSec: 5 } });
      const cp = motor2.leerRecuperacion();
      assert.ok(cp !== null, "recuperación legible");
      assert.ok(Math.abs(cp!.metricas.distanciaM - cpNuevo.metricas.distanciaM) < 0.001,
        `prevalece el nativo más reciente (${cp!.metricas.distanciaM.toFixed(0)} m, no el viejo ${cpViejo.metricas.distanciaM.toFixed(0)} m)`);
      ok("checkpoint nativo más reciente prevalece sobre el localStorage viejo");
      motor2.descartarRecuperacion();
      assert.equal(shim.size, 0, "borrado también en localStorage");
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  }
  {
    // checkpoint corrupto en nativo + válido en localStorage → localStorage
    const shim = new Map<string, string>();
    (globalThis as { window?: unknown }).window = { localStorage: {
      getItem: (k: string) => (shim.has(k) ? shim.get(k)! : null),
      setItem: (k: string, v: string) => void shim.set(k, v),
      removeItem: (k: string) => void shim.delete(k),
    } };
    try {
      const puente = {
        dato: "{esto no es json" as string | null,
        async leer() { return this.dato; },
        async escribir(d: string) { this.dato = d; },
        async borrar() { this.dato = null; },
      };
      const almacen = crearAlmacenDuradero({ nativo: puente });
      const rl = reloj();
      const motor1 = new MotorGPS({ almacen, ahora: rl.get });
      motor1.iniciar(fuenteDePrueba());
      pedalea(motor1, rl, 10, -33.4, 20);
      motor1.forzarCheckpoint(); // llega a localStorage (válido) y al nativo
      await new Promise((r) => setTimeout(r, 10));
      assert.ok(shim.size === 1, "checkpoint válido en localStorage");
      puente.dato = "{esto no es json"; // el espejo nativo se corrompe
      await almacen.precargar();
      const motor2 = new MotorGPS({ almacen, ahora: rl.get });
      assert.equal(motor2.hayRecuperacion(), true, "corrupto en nativo no tumba la recuperación");
      ok("espejo nativo corrupto: cae al localStorage sin perder el ride");
      motor2.descartarRecuperacion();
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  }
  {
    // en la web (sin puente nativo) el almacén funciona con localStorage/memoria
    const shim = new Map<string, string>();
    (globalThis as { window?: unknown }).window = { localStorage: {
      getItem: (k: string) => (shim.has(k) ? shim.get(k)! : null),
      setItem: (k: string, v: string) => void shim.set(k, v),
      removeItem: (k: string) => void shim.delete(k),
    } };
    try {
      const almacen = crearAlmacenDuradero({ nativo: null });
      await almacen.precargar();
      const rl = reloj();
      const motor = new MotorGPS({ almacen, ahora: rl.get });
      motor.iniciar(fuenteDePrueba());
      pedalea(motor, rl, 5, -33.4, 20);
      motor.forzarCheckpoint();
      assert.equal(motor.hayRecuperacion(), true, "web: recuperación solo con capa sincrónica");
      assert.equal(shim.size, 1, "checkpoint en la capa sincrónica");
      ok("sin capa nativa (web): el contrato sigue siendo sincrónico");
      motor.descartarRecuperacion();
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  }

  // ---------- 2) pureza del núcleo: sin dependencias de la app ----------
  {
    const dirMotor = join(process.cwd(), "src", "motor");
    const archivos = readdirSync(dirMotor).filter((f) => f.endsWith(".ts"));
    const prohibidos = /from\s+["'](@\/lib|\.\.\/lib|@\/hooks|\.\.\/hooks|@\/components|react|@capacitor|@\/motor\/fuente)/;
    const violaciones: string[] = [];
    for (const f of archivos) {
      const txt = readFileSync(join(dirMotor, f), "utf8");
      for (const linea of txt.split("\n")) {
        if (prohibidos.test(linea)) violaciones.push(`${f}: ${linea.trim()}`);
      }
    }
    assert.deepEqual(violaciones, [], `núcleo puro: ${violaciones.join(" | ")}`);
    assert.ok(archivos.length >= 8, `${archivos.length} módulos en src/motor`);
    ok(`núcleo puro: ${archivos.length} módulos sin importar la app (${archivos.join(", ")})`);
  }

  // ---------- 3) identidad de tiempos: elapsed + pausa = reloj ----------
  {
    const almacen = almacenEnMemoria();
    const rl = reloj();
    const motor = new MotorGPS({ almacen, ahora: rl.get, config: { checkpointCadaSec: 5 } });
    const inicioTs = rl.get(); // el motor arranca con este mismo instante
    motor.iniciar(fuenteDePrueba());
    let lat = pedalea(motor, rl, 20, -33.4, 20); // 20 s pedaleando
    pedaleaQuieto(motor, rl, 22, lat); // semáforo (22 s) → auto-pausa abierta
    lat += (20 / 3.6) / 111_320;
    rl.avanza(1000);
    motor["procesarFix"](fix(lat, -70.65, rl.get(), 20 / 3.6)); // reanuda
    motor.pausar(); // pausa manual 40 s
    rl.avanza(40_000);
    motor.reanudar();
    lat = pedalea(motor, rl, 10, lat + (20 / 3.6) / 111_320, 20);
    const m = motor.snapshot()!.metricas;
    const paredSec = (rl.get() - inicioTs) / 1000;
    // elapsed + pausa ≈ pared (requisito E del cierre)
    const identidad = Math.abs(m.elapsedSec + m.secPausa - paredSec);
    assert.ok(identidad < 1.5, `elapsed ${m.elapsedSec.toFixed(0)} + pausa ${m.secPausa.toFixed(0)} ≈ pared ${paredSec.toFixed(0)} s (Δ=${identidad.toFixed(2)})`);
    assert.ok(m.secAutoPausa > 0 && m.secAutoPausa <= 20, `auto-pausa separada de la manual (${m.secAutoPausa.toFixed(0)} s)`);
    ok(`identidad de tiempos: elapsed ${m.elapsedSec.toFixed(0)} s + pausa ${m.secPausa.toFixed(0)} s = pared ${paredSec.toFixed(0)} s`);
    motor.detener();
  }

  // ---------- 4) API pública del motor (barrel) ----------
  {
    const idx = readFileSync(join(process.cwd(), "src", "motor", "index.ts"), "utf8");
    for (const sim of ["MotorGPS", "AlmacenCheckpoint", "FuenteUbicacion", "resolverMotorConfig", "haversineM", "almacenEnMemoria"]) {
      assert.ok(idx.includes(sim), `index.ts exporta ${sim}`);
    }
    ok("API pública: index.ts exporta el núcleo consumible");
  }

  console.log(`\nMOTOR CIERRE: ${pasos} verificaciones OK\n`);
}

function pedaleaQuieto(motor: MotorGPS, rl: ReturnType<typeof reloj>, segs: number, lat: number): void {
  for (let i = 0; i < segs; i++) {
    rl.avanza(1000);
    motor["procesarFix"](fix(lat, -70.65, rl.get(), 0));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
