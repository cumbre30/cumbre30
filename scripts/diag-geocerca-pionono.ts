/**
 * Diagnóstico geocerca Acceso Pío Nono (2026-11-13, cliente:
 * "pio nono quedo fuera de la geocerca, traslada el acceso al
 * punto de inicio del trazado de av. alberto mackenna y la geocerca").
 *
 * 1) ¿El GATE pio-nono (-33.4306903,-70.6362729) está dentro de PARK_POLYGON?
 * 2) ¿Dónde termina el trazado b30-pionono (Plaza México → Acceso Pío Nono)?
 * 3) ¿Dónde arranca el trazado r2 (Clásica Cumbre por Pío Nono) / r1?
 * 4) Distancia del gate y del punto propuesto al borde del polígono.
 */
import { PARK_POLYGON, GATES } from "../src/lib/park";
import { BAJADAS_CONTROL_30, RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
function distM(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const la1 = rad(a.lat);
  const la2 = rad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function dentro(p: { lat: number; lon: number }, poly: { lat: number; lon: number }[]) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lon, yi = poly[i].lat;
    const xj = poly[j].lon, yj = poly[j].lat;
    const inter =
      yi > p.lat !== yj > p.lat &&
      p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi;
    if (inter) dentro = !dentro;
  }
  return dentro;
}

function distAlBorde(p: { lat: number; lon: number }, poly: { lat: number; lon: number }[]) {
  let min = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    // distancia punto-segmento en grados (aprox local, suficiente)
    const ax = poly[j].lon, ay = poly[j].lat, bx = poly[i].lon, by = poly[i].lat;
    const px = p.lon, py = p.lat;
    const dx = bx - ax, dy = by - ay;
    const L2 = dx * dx + dy * dy || 1e-20;
    let t = ((px - ax) * dx + (py - ay) * dy) / L2;
    t = Math.max(0, Math.min(1, t));
    const mx = ax + t * dx, my = ay + t * dy;
    const d = distM(p, { lat: my, lon: mx });
    if (d < min) min = d;
  }
  return min;
}

const gate = GATES.find((g) => g.id === "pio-nono")!;
console.log("GATE pio-nono:", gate.position);
console.log("  dentro del polígono:", dentro(gate.position, PARK_POLYGON));
console.log("  distancia al borde:", distAlBorde(gate.position, PARK_POLYGON).toFixed(1), "m");

const b30 = BAJADAS_CONTROL_30.find((b) => b.id === "b30-pionono")!;
const ultimo = b30.coords[b30.coords.length - 1];
const penult = b30.coords[b30.coords.length - 2];
const antepenult = b30.coords[b30.coords.length - 3];
console.log("\nBAJADA b30-pionono (Plaza México → Acceso Pío Nono):");
console.log("  puntos totales:", b30.coords.length, "distKm:", b30.distKm);
console.log("  antepenúltimo:", antepenult);
console.log("  penúltimo:    ", penult);
console.log("  ÚLTIMO:       ", ultimo);
const ult = { lat: ultimo[0], lon: ultimo[1] };
console.log("  último dentro del polígono:", dentro(ult, PARK_POLYGON));
console.log("  último distancia al borde:", distAlBorde(ult, PARK_POLYGON).toFixed(1), "m");
console.log("  último → gate:", distM(ult, gate.position).toFixed(1), "m");

for (const id of ["r1", "r2", "r5"]) {
  const t = RUTAS_TRAZADOS[id];
  if (!t) continue;
  const p0 = { lat: t.coords[0][0], lon: t.coords[0][1] };
  console.log(`\nRUTA ${id}: primer punto ${t.coords[0]}, dentro: ${dentro(p0, PARK_POLYGON)}, dist borde: ${distAlBorde(p0, PARK_POLYGON).toFixed(1)} m, → gate: ${distM(p0, gate.position).toFixed(1)} m`);
}

// Contexto del polígono alrededor del acceso (vértices cercanos al gate)
console.log("\nVértices del polígono a <120 m del gate:");
PARK_POLYGON.forEach((v, i) => {
  const d = distM(v, gate.position);
  if (d < 120) console.log(`  [${i}] ${v.lat}, ${v.lon} → ${d.toFixed(1)} m`);
});

// Los primeros nodos del trazado de Av. Alberto Mackenna (grafo) deben
// quedar dentro de la geocerca tras el ajuste (cliente 2026-11-13).
console.log("\nTrazado Av. Alberto Mackenna (grafo, nodos 5334→2921→2922→…):");
const mack = [
  [5334, -33.43069, -70.636273],
  [2921, -33.430446, -70.636154],
  [2922, -33.430214, -70.636087],
  [2923, -33.430127, -70.636062],
  [2924, -33.429898, -70.636014],
] as const;
let todosDentro = true;
for (const [id, lat, lon] of mack) {
  const p = { lat, lon };
  const d = dentro(p, PARK_POLYGON);
  if (!d) todosDentro = false;
  console.log(`  nodo ${id}: dentro=${d} · dist borde=${distAlBorde(p, PARK_POLYGON).toFixed(1)} m`);
}
console.log("GATE dentro:", dentro(gate.position, PARK_POLYGON), "· prof.:", distAlBorde(gate.position, PARK_POLYGON).toFixed(1), "m");
console.log("TODOS los nodos del inicio del trazado dentro:", todosDentro);
if (!dentro(gate.position, PARK_POLYGON) || !todosDentro) {
  console.error("FALLO: el acceso o el inicio del trazado sigue fuera de la geocerca");
  process.exit(1);
}
