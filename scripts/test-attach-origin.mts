// Test de attachOrigin + buildRouteFeatures (proyección, sin cortar manzanas)
// Se ejecuta transpilando routing.ts/navCanvasLogic.ts con tsc ligero inline.
import { attachOrigin, projectOnPolyline, haversineM, type LatLng, type NavRoute } from "../src/lib/routing.ts";
import { buildRouteFeatures } from "../src/lib/navCanvasLogic.ts";

let fails = 0;
const ok = (cond: boolean, msg: string) => {
  console.log((cond ? "PASS" : "FAIL") + " — " + msg);
  if (!cond) fails++;
};

// --- Calle en L: horizontal luego vertical (manzana idealizada) ---
// A---B---C  (Calle 1, lat fija)
//         |
//         D  (Calle 2, lon fija)
const A: LatLng = { lat: -33.45, lon: -70.66 };
const B: LatLng = { lat: -33.45, lon: -70.65 };
const C: LatLng = { lat: -33.45, lon: -70.64 };
const D: LatLng = { lat: -33.455, lon: -70.64 };

const mkRoute = (coords: LatLng[]): NavRoute => ({
  coords,
  distanceM: 0,
  etaMin: 0,
  cicloviaPct: 0,
  flags: coords.slice(1).map(() => false),
  segNames: coords.slice(1).map(() => "Calle 1"),
  steps: [
    { icon: "start", text: "Parte por Calle 1", distM: 10, point: coords[0], idx: 0 },
    { icon: "right", text: "Gira a la derecha hacia Calle 2", distM: 800, point: coords[2], idx: 2 },
    { icon: "end", text: "Has llegado", distM: 500, point: coords[3], idx: 3 },
  ],
});

const route = mkRoute([A, B, C, D]);

// 1) Usuario en el CENTRO de la manzana (dentro de la L, lejos de nodos)
//    bajo el tramo B-C, lejos del vértice B
const userBlock: LatLng = { lat: -33.4525, lon: -70.645 };
const pr1 = projectOnPolyline(route.coords, userBlock);
const d1 = pr1.distM;
ok(d1 > 200, `usuario dentro de la manzana: proyección lejos de la ruta (${Math.round(d1)} m)`);
ok(d1 > 40, `distancia > CONNECTOR_MAX_M → sin chaflán`);
const r1 = attachOrigin(route, userBlock);
ok(haversineM(r1.coords[0], userBlock) > 2, "sin stub: la ruta parte en la calle, NO en el usuario");
ok(haversineM(r1.coords[0], pr1.point) < 2, "el nuevo origen ES el punto proyectado (sobre la calle)");
// la cabeza recortada: [P, C, D] (P sobre B-C) — 3 vértices
ok(r1.coords.length === 3, `se recortó la cabeza: ${r1.coords.length} vértices (esperado 3)`);
ok(r1.flags.length === r1.coords.length - 1, "flags coherentes con coords");
ok(r1.segNames.length === r1.coords.length - 1, "segNames coherentes con coords");
ok(r1.steps[0].icon === "start" && r1.steps[0].idx === 0, "paso start re-anclado en 0");
ok(r1.steps.every((s) => s.idx < r1.coords.length), "índices de pasos dentro del rango");

// 1b) Proyección exactamente sobre un vértice (B): caso "dup"
const userAtB: LatLng = { lat: -33.4525, lon: -70.65 }; // justo bajo B
const r1b = attachOrigin(route, userAtB);
ok(r1b.coords.length === 3, `dup: vértice B no duplicado (${r1b.coords.length} vértices)`);
ok(r1b.flags.length === r1b.coords.length - 1, `dup: flags coherentes (${r1b.flags.length} vs ${r1b.coords.length - 1})`);
ok(r1b.segNames.length === r1b.coords.length - 1, "dup: segNames coherentes");
ok(r1b.steps.every((s) => s.idx < r1b.coords.length), "dup: índices de pasos en rango");
ok(r1b.steps.some((s) => s.icon === "end"), "dup: conserva paso end");

// 2) Usuario PARADO sobre la calle A-B (a mitad de cuadra) → chaflán corto
const userOnStreet: LatLng = { lat: -33.4502, lon: -70.655 }; // ~22 m al sur de la calle
const pr2 = projectOnPolyline(route.coords, userOnStreet);
ok(pr2.distM < 30, `proyección corta (${Math.round(pr2.distM)} m)`);
const r2 = attachOrigin(route, userOnStreet);
ok(r2.coords[0].lat === userOnStreet.lat, "con stub: parte en la posición real");
ok(haversineM(r2.coords[0], r2.coords[1]) <= 25, `chaflán corto al punto proyectado (${Math.round(haversineM(r2.coords[0], r2.coords[1]))} m)`);
ok(r2.coords.length === 5, `coords = [user, P, C, D] + ... (${r2.coords.length})`);
ok(r2.flags.length === r2.coords.length - 1, "flags coherentes (stub)");
ok(r2.steps[0].idx === 0 && r2.steps[0].icon === "start", "start en 0 con stub");

// 3) Usuario ya casi sobre coords[0] → sin cambios
const r3 = attachOrigin(route, A);
ok(r3 === route, "posición ≈ inicio: ruta intacta");

// 4) buildRouteFeatures: usuario lejos (dentro de manzana) → remaining parte en la calle
const feats = buildRouteFeatures(route, null, userBlock);
const rem = feats.remaining.features[0];
const line = rem.geometry as unknown as { coordinates: [number, number][] };
const first = line.coordinates[0];
const distFirstUser = haversineM({ lat: first[1], lon: first[0] }, userBlock);
ok(distFirstUser > 100, `remaining NO nace en el usuario (nace a ${Math.round(distFirstUser)} m, en la calle)`);
const lastRem = line.coordinates[line.coordinates.length - 1];
ok(Math.abs(lastRem[1] - D.lat) < 1e-9, "remaining termina en D");

// 5) buildRouteFeatures: usuario a 20 m de la calle → chaflán
const feats2 = buildRouteFeatures(route, null, userOnStreet);
const line2 = feats2.remaining.features[0].geometry as unknown as { coordinates: [number, number][] };
ok(haversineM({ lat: line2.coordinates[0][1], lon: line2.coordinates[0][0] }, userOnStreet) < 2, "remaining con stub nace en el usuario");
const trav = feats2.traveled.features;
ok(trav.length >= 0, "traveled sin crash");

// 6) Caso extremo: usuario MÁS ALLÁ del final de la ruta
const r6 = attachOrigin(mkRoute([A, B, C, D]), { lat: -33.456, lon: -70.64 });
ok(r6.coords.length >= 2, "proyección al final: ruta válida");

// 7) Distancia recalculada coherente
const sum = r2.coords.slice(1).reduce((acc, c, i) => acc + haversineM(r2.coords[i], c), 0) + haversineM(r2.coords[0], r2.coords[1]);
ok(Math.abs(sum - r2.distanceM) < 3, `distanceM recalculada (${r2.distanceM} vs ${Math.round(sum)})`);

console.log(fails === 0 ? "\nTODO OK" : `\n${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
