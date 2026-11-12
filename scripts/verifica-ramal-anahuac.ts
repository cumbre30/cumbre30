/**
 * Verificación post-fix: r1 y r5 NO deben tocar el ramal interno «Anáhuac»
 * (living_street n28473..n28478 + Casa Anáhuac) y los picos de reversa
 * deben quedar solo en cruces reales.
 */
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";
import grafo from "../public/red-ciclista.json";
import { haversineM } from "../src/lib/geo";

const nodes = grafo.nodes as [number, number][];
const names = grafo.names as string[];
const edges = grafo.edges as [number, number, number, number, number][];

// nodos del ramal Anáhuac (living_street) + Casa Anáhuac
const ramal = new Set<number>();
for (const [a, b, , nameIdx] of edges) {
  if (names[nameIdx] === "Anáhuac" || names[nameIdx] === "Casa Anáhuac") {
    ramal.add(a); ramal.add(b);
  }
}
const ramalPos = [...ramal].map((i) => ({ lat: nodes[i][0], lon: nodes[i][1] }));
console.log(`Nodos del ramal Anáhuac/Casa: ${ramalPos.length}`);

function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const φ1 = (a.lat * Math.PI) / 180, φ2 = (b.lat * Math.PI) / 180;
  const Δλ = ((b.lon - a.lon) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
function angDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

for (const id of ["r1", "r5"]) {
  const t = RUTAS_TRAZADOS[id];
  const coords = t.coords.map(([lat, lon]) => ({ lat, lon }));
  // 1) puntos sobre el ramal
  let enRamal = 0;
  let minCasa = Infinity;
  for (const c of coords) {
    for (const p of ramalPos) {
      if (haversineM(c, p) < 6) { enRamal++; break; }
    }
    minCasa = Math.min(minCasa, haversineM(c, { lat: -33.417135, lon: -70.623511 }));
  }
  // 2) picos de reversa
  const picos: string[] = [];
  for (let i = 1; i < coords.length - 1; i++) {
    const dPrev = haversineM(coords[i - 1], coords[i]);
    const dNext = haversineM(coords[i], coords[i + 1]);
    if (dPrev < 8 || dNext < 8) continue;
    const rev = angDiff(bearing(coords[i - 1], coords[i]), bearing(coords[i], coords[i + 1]));
    if (rev >= 150) picos.push(`idx=${i} (${coords[i].lat.toFixed(5)},${coords[i].lon.toFixed(5)}) rev=${rev.toFixed(0)}° dPrev=${dPrev.toFixed(0)} dNext=${dNext.toFixed(0)}`);
  }
  console.log(`\n${id} (${t.distKm} km): puntos en ramal Anáhuac = ${enRamal} · distancia mínima a Casa Anáhuac = ${minCasa.toFixed(0)} m`);
  console.log(`  picos >=150°: ${picos.length}`);
  for (const p of picos) console.log(`   ${p}`);
}
