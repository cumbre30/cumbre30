// ============================================================
// Fase A · migración por lectura de c30.trazas → c30.rutas-v2
// (criterios v2.1 §11.1 fase A). Ejecutar: npx tsx tests/rutas-store.test.ts
// ============================================================
import assert from "node:assert/strict";
import { rutasStoreFor, RUTAS_V2_KEY, type KVStorage } from "../src/lib/rutasStore";
import type { TrazaGuardada } from "../src/lib/trazasUsuario";

let pasos = 0;
function ok(nombre: string): void {
  pasos++;
  console.log(`  ✓ ${nombre}`);
}

/** Storage en memoria (JSON strings, como localStorage). */
function storageFake(): KVStorage & { dump(): Record<string, string> } {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

const trazas: TrazaGuardada[] = [
  {
    id: "t-ruta-1",
    kind: "ruta",
    nombre: "Cerro Pio Nono",
    coords: [
      { lat: -33.4310, lon: -70.6401 },
      { lat: -33.4315, lon: -70.6390 },
      { lat: -33.4322, lon: -70.6382 },
    ],
    distKm: 1.42,
    gainM: 0, // trazas viejas guardan 0 cuando no se pudo calcular
    createdAt: "2026-11-10T15:00:00.000Z",
    origen: "motor",
  },
  {
    id: "t-seg-2",
    kind: "segmento",
    nombre: "Sprint Av. Grecia",
    coords: [
      { lat: -33.4570, lon: -70.5930 },
      { lat: -33.4560, lon: -70.5900 },
    ],
    distKm: 0.61,
    gainM: 12.5,
    createdAt: "2026-11-12T18:30:00.000Z",
    origen: "gpx",
  },
];

const st = storageFake();
st.setItem("c30.trazas", JSON.stringify(trazas));
const trazasAntes = st.getItem("c30.trazas");

const store = rutasStoreFor(st);

// 1) La primera lectura migra por lectura SIN tocar c30.trazas.
const rutas = store.get();
assert.equal(rutas.length, 2, "debe copiar los 2 trazados");
assert.equal(rutas[0].id, "t-ruta-1");
assert.equal(rutas[0].kind, "ruta", "kind se conserva sin convertir");
assert.equal(rutas[0].origen, "motor");
assert.equal(rutas[1].kind, "segmento", "segmentos se conservan como segmentos");
assert.equal(rutas[1].gainM, 12.5);
assert.equal(rutas[0].gainM, 0, "gainM se copia tal cual (aunque sea 0)");
assert.deepEqual(rutas[0].coords, trazas[0].coords, "coords idénticas, sin conversión");
assert.equal(rutas[0].migradaDe, "c30.trazas", "marca de migración");
ok("primera lectura copia los trazados (id, kind, coords, gainM) sin transformarlos");

assert.equal(st.getItem("c30.trazas"), trazasAntes, "c30.trazas NO debe cambiar");
ok("c30.trazas queda intacto (migración SOLO por lectura)");
assert.equal(store.migrado(), true);
ok("envelope c30.rutas-v2 marcado migrado=true");

// 2) Borrar una migrada no la resucita en la siguiente instancia.
store.remove("t-ruta-1");
const store2 = rutasStoreFor(st);
const otraVez = store2.get();
assert.equal(otraVez.length, 1, "no re-migra: lo borrado sigue borrado");
assert.equal(otraVez[0].id, "t-seg-2");
ok("sin re-migración: borrar una ruta migrada no la resucita");

// 3) Altas y cambios post-migración operan solo en rutas-v2.
const nueva = store2.add({
  kind: "ruta",
  nombre: "Nueva del creador",
  coords: [{ lat: -33.4, lon: -70.6 }, { lat: -33.41, lon: -70.61 }],
  distKm: 1.5,
  gainM: 30,
  createdAt: new Date().toISOString(),
  origen: "motor",
});
assert.equal(nueva.migradaDe, undefined, "lo nuevo no es migrado");
assert.equal(rutasStoreFor(st).get().length, 2);
const dump = st.dump();
assert.ok(dump[RUTAS_V2_KEY]?.includes("Nueva del creador"));
assert.equal(dump["c30.trazas"], trazasAntes, "c30.trazas sigue intacto tras add");
ok("add() escribe solo en c30.rutas-v2");

// 4) update() aplica el patch y mantiene el resto.
store2.update(nueva.id, { attrs: ["escenica"], descripcion: "Vista de Santiago" });
const trasUpdate = rutasStoreFor(st).get().find((r) => r.id === nueva.id);
assert.equal(trasUpdate?.attrs?.[0], "escenica");
assert.equal(trasUpdate?.descripcion, "Vista de Santiago");
assert.equal(trasUpdate?.distKm, 1.5);
ok("update() conserva campos y aplica el patch");

// 5) Sin c30.trazas: store vacío, sin error.
const st3 = storageFake();
const store3 = rutasStoreFor(st3);
assert.equal(store3.get().length, 0);
assert.equal(store3.migrado(), true);
ok("dispositivo sin c30.trazas → store vacío sin error");

// 6) c30.trazas corrupto no rompe.
const st4 = storageFake();
st4.setItem("c30.trazas", "{no-es-json");
assert.equal(rutasStoreFor(st4).get().length, 0);
ok("c30.trazas corrupto → store vacío sin lanzar");

console.log(`\nRUTAS-STORE: ${pasos} verificaciones OK`);
