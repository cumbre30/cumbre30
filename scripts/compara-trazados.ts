/**
 * Compara trazados NUEVOS (src) vs ANTERIORES (git HEAD): desviación
 * máxima y media en ambas direcciones por ruta, para confirmar que la
 * regeneración con anclaje exacto solo limpió uniones de tramos sin
 * cambiar los corredores.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";
import { haversineM } from "../src/lib/geo";

type P = { lat: number; lon: number };

// versión HEAD a un archivo temporal e import dinámico
execSync("git show HEAD:src/lib/rutasTrazados.ts > /tmp/rutas-viejo.ts", { stdio: "ignore" });
const viejoRaw: Record<string, { coords: [number, number][]; distKm: number }> = (() => {
  delete require.cache["/tmp/rutas-viejo.ts"];
  return require("/tmp/rutas-viejo.ts").RUTAS_TRAZADOS;
})();

function distAPolyline(p: P, poly: P[]): number {
  const kx = Math.cos((p.lat * Math.PI) / 180);
  let best = Infinity;
  for (let i = 0; i < poly.length - 1; i++) {
    const ax = poly[i].lon * kx, ay = poly[i].lat;
    const bx = poly[i + 1].lon * kx, by = poly[i + 1].lat;
    const px = p.lon * kx, py = p.lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320);
  }
  return best;
}

/** desviación de cada punto de A contra la polilínea B (muestras cada 3) */
function resumen(a: P[], b: P[]) {
  let max = 0, sum = 0, n = 0;
  const peores: { d: number; p: P }[] = [];
  for (let i = 0; i < a.length; i += 2) {
    const d = distAPolyline(a[i], b);
    max = Math.max(max, d);
    sum += d;
    n++;
    peores.push({ d, p: a[i] });
  }
  peores.sort((x, y) => y.d - x.d);
  return { max, mean: sum / n, peores: peores.slice(0, 3) };
}

for (const id of Object.keys(RUTAS_TRAZADOS)) {
  const nuevo = RUTAS_TRAZADOS[id];
  const viejo = viejoRaw[id];
  if (!viejo) continue;
  const nA = nuevo.coords.map(([lat, lon]) => ({ lat, lon }) as P);
  const vA = viejo.coords.map(([lat, lon]) => ({ lat, lon }) as P);
  const nv = resumen(nA, vA); // nuevo contra viejo
  const vn = resumen(vA, nA); // viejo contra nuevo
  console.log(
    `${id}: ${viejo.distKm.toFixed(2)} → ${nuevo.distKm.toFixed(2)} km · nuevo→viejo máx ${nv.max.toFixed(1)} m (media ${nv.mean.toFixed(1)}) · viejo→nuevo máx ${vn.max.toFixed(1)} m (media ${vn.mean.toFixed(1)})`
  );
  for (const p of nv.peores) if (p.d > 25) console.log(`   nuevo fuera: ${p.d.toFixed(0)} m @ (${p.p.lat.toFixed(5)},${p.p.lon.toFixed(5)})`);
  for (const p of vn.peores) if (p.d > 25) console.log(`   viejo fuera: ${p.d.toFixed(0)} m @ (${p.p.lat.toFixed(5)},${p.p.lon.toFixed(5)})`);
}
