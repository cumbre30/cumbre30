// ¿Dónde empieza/termina el trazado r2 y qué tan cerca está de la puerta Pío Nono y de Plaza México?
const realFetch = globalThis.fetch;
globalThis.fetch = ((u: string, ...a: any[]) => realFetch(new URL(u, "http://localhost:3000"), ...a)) as typeof fetch;
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";
import { CAPA_RUTAS } from "../src/lib/mapLayers";
import { NAV_DESTINATIONS } from "../src/lib/park";
import { haversineM } from "../src/lib/routing";

function d(a: [number, number], b: { lat: number; lon: number }): number {
  return haversineM({ lat: a[0], lon: a[1] }, b);
}

const gate = { lat: -33.430691, lon: -70.63592 };
const plaza = NAV_DESTINATIONS.find((x) => x.id === "plaza-mexico")!.position;

for (const r of CAPA_RUTAS.filter((x) => x.tipo === "pavimento")) {
  const t = RUTAS_TRAZADOS[r.trz];
  if (!t) { console.log(r.nombre, "sin trazado"); continue; }
  const c = t.coords;
  console.log(`${r.nombre} (${r.trz}): ${c.length} pts, ${t.distKm} km`);
  console.log(`   inicio ${c[0]} → dist a puerta Pío Nono: ${d(c[0], gate).toFixed(0)} m · dist a plaza: ${d(c[0], plaza).toFixed(0)} m`);
  console.log(`   final  ${c[c.length - 1]} → dist a puerta: ${d(c[c.length - 1], gate).toFixed(0)} m · dist a plaza: ${d(c[c.length - 1], plaza).toFixed(0)} m`);
  // punto más cercano del trazado a la puerta y a la plaza
  let bg = Infinity, bp = Infinity;
  for (const p of c) { bg = Math.min(bg, d(p, gate)); bp = Math.min(bp, d(p, plaza)); }
  console.log(`   mínima dist trazado↔puerta: ${bg.toFixed(0)} m · trazado↔plaza: ${bp.toFixed(0)} m`);
}
process.exit(0);
