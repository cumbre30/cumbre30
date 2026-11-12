/**
 * Mapea puntos de r5 a la arista más cercana del grafo OSM propio,
 * para saber qué calle toma en cada tramo (especialmente los
 * "trazados hacia atrás" que el cliente marcó).
 */
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";
import grafo from "../public/red-ciclista.json";

const nodes = grafo.nodes as [number, number][];
const names = grafo.names as string[];
const classes = grafo.classes as string[];
const edges = grafo.edges as [number, number, number, number, number][];

function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (bLat - aLat) * toR, dLon = (bLon - aLon) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Arista más cercana a p (proyección simple sobre extremos y punto medio). */
function nearestEdgeName(p: [number, number]): { name: string; cls: string; dM: number; a: number; b: number } {
  let best = { name: "", cls: "", dM: Infinity, a: -1, b: -1 };
  for (let e = 0; e < edges.length; e++) {
    const [a, b, clsIdx, nameIdx] = edges[e];
    const pa = nodes[a], pb = nodes[b];
    // bbox rápido
    const minLat = Math.min(pa[0], pb[0]) - 0.0015, maxLat = Math.max(pa[0], pb[0]) + 0.0015;
    const minLon = Math.min(pa[1], pb[1]) - 0.002, maxLon = Math.max(pa[1], pb[1]) + 0.002;
    if (p[0] < minLat || p[0] > maxLat || p[1] < minLon || p[1] > maxLon) continue;
    const dEnds = Math.min(haversineM(p[0], p[1], pa[0], pa[1]), haversineM(p[0], p[1], pb[0], pb[1]));
    // punto medio
    const mid = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
    const dMid = haversineM(p[0], p[1], mid[0], mid[1]);
    const d = Math.min(dEnds, dMid);
    if (d < best.dM) {
      best = { name: names[nameIdx] ?? "(sin nombre)", cls: classes[clsIdx] ?? "?", dM: d, a, b };
    }
  }
  return best;
}

const r5 = RUTAS_TRAZADOS["r5"];
const coords = r5.coords;

const rangos: [number, number, string][] = [
  [200, 290, "Acercamiento y retroceso en Anáhuac"],
  [290, 330, "Pico 1 (tip idx=302)"],
  [330, 400, "Zigzag post-pico 1"],
  [400, 480, "Tramo laMontana → zapadores"],
  [480, 570, "Zapadores → laPirámide"],
  [570, 670, "Regreso + pico 2 (tip idx=662)"],
  [670, 720, "Salida hacia el oriente"],
  [1060, 1231, "Cierre bajada oriente → PdV Norte"],
];

for (const [desde, hasta, titulo] of rangos) {
  console.log(`\n=== ${titulo} (idx ${desde}..${hasta}) ===`);
  let lastName = "";
  for (let i = desde; i <= hasta; i += 4) {
    const ne = nearestEdgeName(coords[i]);
    const etiqueta = ne.name !== lastName ? ne.name : "·";
    lastName = ne.name;
    console.log(
      `idx=${String(i).padStart(4)} (${coords[i][0].toFixed(6)}, ${coords[i][1].toFixed(6)}) → ${etiqueta} [${ne.cls}] d=${ne.dM.toFixed(0)}m`
    );
  }
}
