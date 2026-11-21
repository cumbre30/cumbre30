// ============================================================
// Fase C · biblioteca y fichas (criterios v2.1 §11.1 fase C y
// §7.4/§5.3): banner de vigencia en sus tres estados básicos,
// tiempo estimado en rango ±25 %, recientes, elevación por punto
// (eleM) alineada con la geometría y «revisé esta ruta hoy».
// Ejecutar: npx tsx tests/rutas-ficha.test.ts
// ============================================================
import assert from "node:assert/strict";
import { estadoVigencia, tiempoEstimadoRango, formatearTiempo, recientesFor, RECIENTES_KEY, type KVStorage } from "../src/lib/rutasFicha";
import { rutasStoreFor, type KVStorage as KVRutas } from "../src/lib/rutasStore";
import { borradoresFor, nuevoBorrador } from "../src/lib/rutasBorrador";
import type { LatLng } from "../src/lib/routing";

let pasos = 0;
function ok(nombre: string): void {
  pasos++;
  console.log(`  ✓ ${nombre}`);
}

function storageFake(): KVStorage & { dump(): Map<string, string> } {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    dump: () => m,
  };
}
const coord = (lat: number, lon: number): LatLng => ({ lat, lon });
const coords: LatLng[] = [coord(-33.43, -70.64), coord(-33.435, -70.638), coord(-33.44, -70.635)];

// ------------------------------------------------------------
console.log("\n1. Banner de vigencia: los tres estados básicos (§7.4)");
const ahora = new Date();
const hace3Meses = new Date(ahora.getTime() - 90 * 24 * 3600 * 1000).toISOString();
const hace7Meses = new Date(ahora.getTime() - 215 * 24 * 3600 * 1000).toISOString();
assert.equal(estadoVigencia(hace3Meses, 0), "vigente");
ok("revisada hace 3 meses (< 6) → VIGENTE");
assert.equal(estadoVigencia(hace7Meses, 0), "sin-revisar");
ok("revisada hace 7 meses (> 6) → SIN REVISAR");
assert.equal(estadoVigencia(null, 0), "sin-revisar");
ok("nunca revisada → SIN REVISAR");
assert.equal(estadoVigencia("no-es-fecha", 0), "sin-revisar");
ok("fecha inválida → SIN REVISAR (sin lanzar)");
assert.equal(estadoVigencia(hace3Meses, 2), "avisos");
assert.equal(estadoVigencia(hace7Meses, 1), "avisos");
ok("con reportes de cierre/peligro abiertos → AVISOS (aunque esté vigente)");
assert.equal(estadoVigencia(hace3Meses, 0, "retirada"), "retirada");
ok("retirada mantiene su estado (fase D)");

// ------------------------------------------------------------
console.log("\n2. Tiempo estimado en rango ±25 % (§5.3)");
const llano = tiempoEstimadoRango(18, null);
assert.equal(llano.preliminar, true);
assert.ok(Math.abs(llano.horas - 1) < 0.01); // 18 km a 18 km/h = 1 h
assert.ok(Math.abs(llano.hMin - 0.8) < 0.01 && Math.abs(llano.hMax - 1.25) < 0.01);
ok("sin elevación → preliminar, 18 km → 48 min – 1 h 15 min (±25 %)");
const subida = tiempoEstimadoRango(10, 600); // pendiente media 6 % → −30 %
assert.equal(subida.preliminar, false);
assert.ok(Math.abs(subida.horas - 10 / 12.6) < 0.02);
ok("6 % de pendiente media penaliza la velocidad (18 → 12.6 km/h)");
const empinada = tiempoEstimadoRango(5, 900); // 18 % → tope penalización 12 %
assert.equal(empinada.preliminar, false);
assert.ok(Math.abs(empinada.horas - 5 / 7.2) < 0.02); // v = 18*(1-0.6) = 7.2 km/h
ok("penalización con tope (12 %): 18 % de pendiente no baja de 7.2 km/h");
const extremo = tiempoEstimadoRango(50, 20000); // pendiente 40 % → tope
assert.ok(extremo.horas > 0);
ok("rango siempre válido con datos extremos");
assert.equal(formatearTiempo(0.75), "45 min");
assert.equal(formatearTiempo(1), "1 h");
assert.equal(formatearTiempo(1.75), "1 h 45 min");
ok("formatearTiempo: min / h / h+min");

// ------------------------------------------------------------
console.log("\n3. Recientes: dedupe, cap y limpieza");
const st = storageFake();
const rec = recientesFor(st);
for (let i = 0; i < 25; i++) rec.registrar(`r-${i}`);
assert.equal(rec.ver().length, 20);
ok("cap de 20 recientes");
rec.registrar("r-24");
assert.equal(rec.ver()[0], "r-24");
assert.equal(rec.ver().filter((x) => x === "r-24").length, 1);
ok("registrar: más reciente primero y sin duplicados");
rec.quitar("r-24");
assert.ok(!rec.ver().includes("r-24"));
ok("quitar de recientes");
rec.limpiar();
assert.deepEqual(rec.ver(), []);
ok("limpiar deja vacío");
st.setItem(RECIENTES_KEY, "{corrupto");
assert.deepEqual(recientesFor(st).ver(), []);
ok("JSON corrupto → lista vacía sin lanzar");

// ------------------------------------------------------------
console.log("\n4. eleM: elevación por punto alineada (ficha + GPX)");
const store = rutasStoreFor(storageFake() as KVRutas);
const bor = borradoresFor(store);
const eleOk: (number | null)[] = [300, 320, null];
const b1 = nuevoBorrador({ nombre: "Con perfil", coords, distKm: 9.7, gainM: 420, eleFuente: "gpx", eleM: eleOk });
assert.deepEqual(b1.eleM, eleOk);
ok("nuevoBorrador conserva eleM alineada con coords");
const b2 = nuevoBorrador({ nombre: "Desalineada", coords, distKm: 9.7, gainM: 420, eleM: [300, 320] });
assert.equal(b2.eleM, undefined);
ok("eleM desalineada → descartada (no se guarda inventada)");
const b3 = nuevoBorrador({ nombre: "Sin gain", coords, distKm: 9.7, gainM: null, eleM: eleOk });
assert.equal(b3.eleM, undefined);
assert.equal(b3.gainM, null);
ok("sin gain real → eleM no se guarda (jamás ceros, §5.1)");

const guardado = bor.guardarBorrador(b1);
bor.actualizarBorrador(guardado.id, { ultimaRevisionAt: hace3Meses });
let despues = bor.listarBorradores()[0];
assert.equal(despues.ultimaRevisionAt, hace3Meses);
ok("«revisé esta ruta hoy»: ultimaRevisionAt persiste (vigencia → vigente)");

bor.actualizarBorrador(guardado.id, { coords: [coord(-33.43, -70.64), coord(-33.44, -70.635)], distKm: 12, gainM: 500 });
despues = bor.listarBorradores()[0];
assert.equal(despues.eleM, undefined);
ok("geometría editada desalinea eleM → se descarta (perfil honesto)");

const g2 = nuevoBorrador({ nombre: "Recuperada", coords, distKm: 9.7, gainM: 420, eleFuente: "gpx", eleM: eleOk });
const g2guardado = bor.guardarBorrador(g2);
bor.actualizarBorrador(g2guardado.id, { eleM: eleOk, coords });
despues = bor.listarBorradores().find((r) => r.id === g2guardado.id);
assert.deepEqual(despues?.eleM, eleOk);
ok("actualizarBorrador puede REESTABLECER eleM alineada con las coords vigentes");

// ------------------------------------------------------------
console.log(`\nFase C · ${pasos} comprobaciones OK`);
