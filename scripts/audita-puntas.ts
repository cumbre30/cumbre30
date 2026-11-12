/**
 * Auditoría de «puntas» (trazado hacia atrás) en los 9 trazados:
 * con hash espacial detecta pares de índices i<j cuyo extremo queda a
 * <30 m mientras el camino entre ellos recorre >120 m (ida y vuelta),
 * y picos de rumbo >=150°.
 */
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";
import { haversineM } from "../src/lib/geo";

type P = { lat: number; lon: number };

function bearing(a: P, b: P): number {
  const f1 = (a.lat * Math.PI) / 180, f2 = (b.lat * Math.PI) / 180;
  const dl = ((b.lon - a.lon) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
const angDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

for (const id of Object.keys(RUTAS_TRAZADOS)) {
  const t = RUTAS_TRAZADOS[id];
  const coords = t.coords.map(([lat, lon]) => ({ lat, lon }) as P);
  const n = coords.length;
  const km = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) km[i] = km[i - 1] + haversineM(coords[i - 1], coords[i]);

  // 1) puntas: hash espacial de celdas ~30 m
  const CELL = 0.00027; // ≈ 30 m
  const grid = new Map<string, number[]>();
  const keyOf = (p: P) => `${Math.round(p.lat / CELL)}:${Math.round(p.lon / CELL)}`;
  const puntas: { i: number; j: number; d: number }[] = [];
  for (let j = 0; j < n; j++) {
    const ci = Math.round(coords[j].lat / CELL);
    const cj = Math.round(coords[j].lon / CELL);
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        const arr = grid.get(`${ci + di}:${cj + dj}`);
        if (!arr) continue;
        for (const i of arr) {
          const camino = km[j] - km[i];
          if (camino < 120 || camino > 2500) continue;
          const d = haversineM(coords[i], coords[j]);
          if (d < 30) puntas.push({ i, j, d });
        }
      }
    const k = keyOf(coords[j]);
    const arr = grid.get(k);
    if (arr) arr.push(j);
    else grid.set(k, [j]);
  }
  // deduplicar por par (i,j) y quedarnos con la punta de mayor recorrido
  puntas.sort((a, b) => km[b.j] - km[b.i] - (km[a.j] - km[a.i]));
  const vistas = new Set<string>();
  const puntasTop: typeof puntas = [];
  for (const p of puntas) {
    const kk = `${Math.round(p.i / 3)}:${Math.round(p.j / 3)}`;
    if (vistas.has(kk)) continue;
    vistas.add(kk);
    puntasTop.push(p);
  }

  // 2) picos de rumbo >=150°
  const picos: string[] = [];
  for (let i = 1; i < n - 1; i++) {
    const dPrev = haversineM(coords[i - 1], coords[i]);
    const dNext = haversineM(coords[i], coords[i + 1]);
    if (dPrev < 8 || dNext < 8) continue;
    const rev = angDiff(bearing(coords[i - 1], coords[i]), bearing(coords[i], coords[i + 1]));
    if (rev >= 150)
      picos.push(
        `idx=${i} (${coords[i].lat.toFixed(5)},${coords[i].lon.toFixed(5)}) rev=${rev.toFixed(0)}° dPrev=${dPrev.toFixed(0)} dNext=${dNext.toFixed(0)} km=${(km[i] / 1000).toFixed(2)}`
      );
  }

  console.log(`\n=== ${id} · ${t.distKm.toFixed(2)} km · ${n} pts ===`);
  console.log(`puntas ida-y-vuelta: ${puntasTop.length} (de ${puntas.length} pares crudos)`);
  for (const p of puntasTop.slice(0, 12))
    console.log(
      `  idx ${p.i}→${p.j} extremos a ${p.d.toFixed(0)} m · camino ${(km[p.j] - km[p.i]).toFixed(0)} m · @ (${coords[p.i].lat.toFixed(5)},${coords[p.i].lon.toFixed(5)}) km ${(km[p.i] / 1000).toFixed(2)}`
    );
  console.log(`picos de rumbo >=150°: ${picos.length}`);
  for (const p of picos) console.log(`  ${p}`);
}
console.log("\nfin auditoría");
