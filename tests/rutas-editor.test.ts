// ============================================================
// Fase B · creación y edición de rutas (criterios v2.1 §11.1 fase B
// y §5: dificultad sugerida editable, atributos recreativos máx 3,
// elevación null explícito — jamás 0 —, POIs, borradores y GPX).
// Ejecutar: npx tsx tests/rutas-editor.test.ts
// ============================================================
import assert from "node:assert/strict";
import { rutasStoreFor, type KVStorage } from "../src/lib/rutasStore";
import { borradoresFor, nuevoBorrador, borradorDesdeTraza, agregarPoi, ordenarPois, TIPOS_POI } from "../src/lib/rutasBorrador";
import { sugerirDificultad, sugerirFisica, sugerirTecnica, attrsValidos, aplicarSugerencias, ATRIBUTOS_RECREATIVOS } from "../src/lib/dificultad";
import { buildRutaGpxBlob } from "../src/lib/gpx";
import { sumarPierna } from "../src/hooks/useEditorRutas";
import type { LatLng } from "../src/lib/routing";

let pasos = 0;
function ok(nombre: string): void {
  pasos++;
  console.log(`  ✓ ${nombre}`);
}

function storageFake(): KVStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

const coord = (lat: number, lon: number): LatLng => ({ lat, lon });

// ------------------------------------------------------------
console.log("\n1. Sugerencia de dificultad física (§5.2)");
assert.equal(sugerirFisica({ distKm: 5, gainM: null }).nivel, 1);
assert.equal(sugerirFisica({ distKm: 12, gainM: null }).nivel, 2);
assert.equal(sugerirFisica({ distKm: 20, gainM: null }).nivel, 3);
assert.equal(sugerirFisica({ distKm: 30, gainM: null }).nivel, 4);
assert.equal(sugerirFisica({ distKm: 45, gainM: null }).nivel, 5);
ok("base por distancia: 5/12/20/30/45 km → 1/2/3/4/5");

const conDesnivel = sugerirFisica({ distKm: 12, gainM: 800 });
assert.equal(conDesnivel.nivel, 4); // 2 + 1 gain>500 + 1 pendiente 6.7%>5%
assert.equal(conDesnivel.preliminar, false);
ok("con desnivel 800 m: dos ajustes (ganancia y pendiente media), preliminar=false");

const empinada = sugerirFisica({ distKm: 5, gainM: 350 }); // pendiente media 7%
assert.equal(empinada.nivel, 2); // base 1 + 0 (350<500) + 1 (7%>5%)
ok(`pendiente media > 5% suma nivel (5 km y 350 m → ${empinada.nivel})`);

const preliminar = sugerirFisica({ distKm: 20, gainM: null });
assert.equal(preliminar.preliminar, true);
ok("sin gainM → preliminar=true (UI: «revisa y ajusta»)");
assert.equal(sugerirFisica({ distKm: 100, gainM: 3000 }).nivel, 5);
ok("tope superior 5 (100 km y 3000 m no pasa de muy difícil)");

// ------------------------------------------------------------
console.log("\n2. Sugerencia de dificultad técnica (modalidad + atributos)");
assert.equal(sugerirTecnica({ modalidad: "pavimento", attrs: [] }), 1);
assert.equal(sugerirTecnica({ modalidad: "mtb", attrs: [] }), 2);
assert.equal(sugerirTecnica({ modalidad: "mtb", attrs: ["desafiante"] }), 3);
assert.equal(sugerirTecnica({ modalidad: "pavimento", attrs: ["desafiante", "para principiantes"] }), 1);
assert.equal(sugerirTecnica({ modalidad: "pavimento", attrs: ["para principiantes"] }), 1); // piso 1
ok("pavimento=1, mtb=2, desafiante +1, principiantes −1, jamás <1");

// ------------------------------------------------------------
console.log("\n3. Atributos recreativos: enumerado cerrado y máximo 3 (§5.3)");
assert.equal(ATRIBUTOS_RECREATIVOS.length, 7);
ok("enumerado cerrado de 7 valores");
assert.deepEqual(attrsValidos(["escénica", "familiar", "con miradores", "recreativa"]), ["escénica", "familiar", "con miradores"]);
ok("más de 3 → recortado a 3");
assert.deepEqual(attrsValidos(["escénica", "escénica"]), ["escénica"]);
ok("duplicados eliminados");
assert.deepEqual(attrsValidos(["inventado", "familiar"]), ["familiar"]);
ok("valores fuera del enumerado descartados");
assert.equal(attrsValidos(["x", "y"]), null);
assert.equal(attrsValidos("no-lista"), null);
ok("nada válido → null");

// ------------------------------------------------------------
console.log("\n4. aplicarSugerencias: jamás sobrescribe al creador (§5.2)");
const auto = aplicarSugerencias({ fisica: 1, tecnica: 1, origen: "auto" }, { distKm: 30, gainM: null, modalidad: "pavimento", attrs: [] });
assert.deepEqual([auto.fisica, auto.tecnica, auto.origen], [4, 1, "auto"]);
ok("origen auto → los niveles siguen la nueva sugerencia");
const creador = aplicarSugerencias({ fisica: 5, tecnica: 2, origen: "creador" }, { distKm: 30, gainM: null, modalidad: "pavimento", attrs: [] });
assert.deepEqual([creador.fisica, creador.tecnica, creador.origen], [5, 2, "creador"]);
ok("origen creador → valores del creador intactos");

// ------------------------------------------------------------
console.log("\n5. Borradores: creación, elevación null y sugerencia inicial");
const store = rutasStoreFor(storageFake());
const borradores = borradoresFor(store);

const coords: LatLng[] = [coord(-33.43, -70.64), coord(-33.435, -70.638), coord(-33.44, -70.635)];
const b1 = nuevoBorrador({ nombre: "  La Chascona  ", coords, distKm: 12.4, gainM: 0, modalidad: "pavimento", attrs: ["escénica", "familiar"] });
assert.equal(b1.nombre, "La Chascona");
assert.equal(b1.gainM, null); // 0 ficticio → null explícito
assert.equal(b1.eleFuente, null);
assert.equal(b1.status, "borrador");
assert.equal(b1.kind, "ruta");
assert.ok(b1.dificultadFisica >= 2); // sugerencia por distancia
ok("nuevoBorrador: nombre recortado, gainM 0 → null, status borrador, sugerencia auto");

const guardado = borradores.guardarBorrador(b1);
assert.equal(borradores.listarBorradores().length, 1);
assert.equal(borradores.listarBorradores()[0].nombre, "La Chascona");
ok("guardarBorrador + listarBorradores en c30.rutas-v2");

// ------------------------------------------------------------
console.log("\n6. Crear desde actividad: copia 1:1, gain del motor → null");
const trazaMotor = { nombre: "Vuelta al cerro", coords, distKm: 3.2, gainM: 0, origen: "motor" as const };
const desdeMotor = borradorDesdeTraza(trazaMotor);
assert.deepEqual(desdeMotor.coords, coords); // sin transformación
assert.equal(desdeMotor.distKm, 3.2);
assert.equal(desdeMotor.gainM, null); // el 0 ficticio NO entra
assert.equal(desdeMotor.eleFuente, null);
ok("traza del motor: coords/dist 1:1, gainM 0 → null («sin datos»)");

const trazaGpx = { nombre: "Quebrada GPX", coords, distKm: 9.7, gainM: 420, origen: "gpx" as const };
const desdeGpx = borradorDesdeTraza(trazaGpx);
assert.equal(desdeGpx.gainM, 420);
assert.equal(desdeGpx.eleFuente, "gpx");
assert.equal(desdeGpx.origen, "gpx");
ok("traza de GPX: gainM real conservado con eleFuente 'gpx'");

// ------------------------------------------------------------
console.log("\n7. Edición post-guardado: persiste y respeta al creador");
borradores.actualizarBorrador(guardado.id, { descripcion: "Ruta de prueba del editor", dificultadFisica: 5, dificultadTecnica: 4, dificultadOrigen: "creador" });
let despues = borradores.listarBorradores()[0];
assert.equal(despues.dificultadFisica, 5);
assert.equal(despues.dificultadOrigen, "creador");
ok("ajuste manual del creador registrado (origen 'creador')");

borradores.actualizarBorrador(guardado.id, { distKm: 45, gainM: 1200 });
despues = borradores.listarBorradores()[0];
assert.equal(despues.distKm, 45);
assert.equal(despues.dificultadFisica, 5); // origen creador: NO sobrescribe
assert.equal(despues.dificultadTecnica, 4);
ok("al cambiar la geometría, el valor del creador se conserva");

const conNombre = borradores.listarBorradores()[0];
borradores.actualizarBorrador(guardado.id, { distKm: 50 });
despues = borradores.listarBorradores()[0];
assert.equal(despues.nombre, conNombre.nombre); // patch sin undefined no borra campos
assert.equal(despues.descripcion, conNombre.descripcion);
ok("campos no tocados NO se pierden al actualizar");

borradores.actualizarBorrador(guardado.id, { dificultadOrigen: "auto" });
despues = borradores.listarBorradores()[0];
assert.equal(despues.dificultadFisica, 5); // sugerencia 45 km → 4-5; tope… base 45 → 4, +gain 1200 → +2 → 5
assert.equal(despues.dificultadOrigen, "auto");
ok("«usar sugerencia» vuelve a auto y recalcula");

// ------------------------------------------------------------
console.log("\n8. POIs: tipo cerrado, orden y limpieza");
let pois = agregarPoi(undefined, { tipo: "mirador", nombre: "  Mirador Castillo  ", nota: "vista norte", lat: -33.43, lon: -70.64 });
pois = agregarPoi(pois, { tipo: "tipo-raro", nombre: "Puerta", lat: -33.44, lon: -70.63 });
pois = agregarPoi(pois, { tipo: "agua", nombre: "Grifo", lat: -33.435, lon: -70.637 });
assert.equal(pois.length, 3);
assert.equal(pois[0].nombre, "Mirador Castillo"); // orden por inserción
assert.equal(pois[1].tipo, "otro"); // tipo fuera del enumerado → 'otro'
assert.ok((TIPOS_POI as readonly string[]).includes(pois[2].tipo));
assert.deepEqual(pois.map((p) => p.orden), [0, 1, 2]);
ok("agregarPoi: tipos cerrados con respaldo 'otro', orden renumerado");

const sinNombre = agregarPoi(pois, { tipo: "agua", nombre: "   ", lat: 0, lon: 0 });
assert.equal(sinNombre[sinNombre.length - 1].nombre, "");
assert.equal(ordenarPois([...pois].reverse())[0].nombre, "Mirador Castillo");
ok("ordenarPois restaura el orden");

// ------------------------------------------------------------
(async () => { // Blob.text() es async en node: el resto corre dentro
console.log("\n9. Export GPX: 1.1 válido, sin ele cuando no hay fuente");
const gpx = await buildRutaGpxBlob({ nombre: "Ruta <Q&A>", descripcion: "Prueba & verificación", coords }).text();
assert.ok(gpx.includes('<gpx version="1.1" creator="Cumbre30" xmlns="http://www.topografix.com/GPX/1/1"'));
ok("encabezado GPX 1.1 con namespace");
assert.equal((gpx.match(/<trkpt /g) || []).length, coords.length);
ok(`un <trkpt> por coordenada (${coords.length})`);
assert.ok(!gpx.includes("<ele>"));
ok("sin fuente de elevación → SIN <ele> (jamás 0, §5.1)");
assert.ok(gpx.includes("Ruta &lt;Q&amp;A&gt;"));
ok("nombre/desc escapados (& y <)");
assert.ok(!gpx.includes("<time>"));
ok("sin metadatos privados (no hay timestamps del dispositivo)");

const gpxEle = await buildRutaGpxBlob({ nombre: "x", coords, eleM: coords.map((_, i) => (i === 1 ? 12.4 : null)) }).text();
assert.equal((gpxEle.match(/<ele>/g) || []).length, 1);
ok("con fuente: solo los puntos con elevación llevan <ele>");

// ------------------------------------------------------------
console.log("\n10. Multi-waypoint: concatenación de piernas (sumarPierna)");
const pierna1 = [coord(0, 0), coord(0.001, 0), coord(0.002, 0)];
const pierna2 = [coord(0.002, 0), coord(0.002, 0.001), coord(0.002, 0.002)];
const r1 = sumarPierna([], pierna1);
assert.equal(r1.coords.length, 3);
const r2 = sumarPierna(r1.coords, pierna2);
assert.equal(r2.coords.length, 5); // el punto de unión NO se duplica
assert.ok(r2.distM > 150 && r2.distM < 300); // ~222 m: SOLO la pierna nueva (2×111 m)
assert.ok(r1.distM > 150 && r1.distM < 300);
ok("pierna concatenada sin duplicar el vértice común; distM = pierna nueva");
const vacia = sumarPierna([coord(0, 0)], []);
assert.equal(vacia.coords.length, 1);
assert.equal(vacia.distM, 0);
ok("pierna vacía no rompe");

// ------------------------------------------------------------
console.log("\n11. Convivencia con la migración (fase A intacta)");
const st2 = storageFake();
st2.setItem(
  "c30.trazas",
  JSON.stringify([
    { id: "t-1", kind: "ruta", nombre: "Histórica", coords: [{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }], distKm: 1.1, gainM: 0, createdAt: "2026-11-01T00:00:00.000Z", origen: "motor" },
  ]),
);
const store2 = rutasStoreFor(st2);
store2.get(); // dispara la migración por lectura
const bor2 = borradoresFor(store2);
bor2.guardarBorrador(nuevoBorrador({ nombre: "Borrador nuevo", coords, distKm: 7, gainM: null }));
const crudo = JSON.parse(st2.getItem("c30.trazas") as string) as unknown[];
assert.equal(crudo.length, 1);
assert.equal((crudo[0] as { nombre: string }).nombre, "Histórica");
assert.equal(bor2.listarBorradores().length, 1);
assert.equal(store2.get().length, 2); // migrada + borrador
ok("c30.trazas queda byte a byte intacto; borrador convive con la migrada");

bor2.actualizarBorrador(bor2.listarBorradores()[0].id, { nombre: "Renombrada" });
assert.equal((JSON.parse(st2.getItem("c30.trazas") as string) as unknown[]).length, 1);
ok("editar borradores jamás escribe en c30.trazas");
})();

// ------------------------------------------------------------
console.log(`\nFase B · ${pasos} comprobaciones OK`);
