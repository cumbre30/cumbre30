/**
 * Topología del grafo alrededor de la curva Anáhuac (-33.417135, -70.623511):
 * nodos y aristas con nombres a <180 m, para entender qué camino es
 * el "trazado hacia atrás" y cuál es el paso correcto.
 */
import grafo from "../public/red-ciclista.json";

const C = { lat: -33.417135, lon: -70.623511 };
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

const cerca: number[] = [];
nodes.forEach((n, i) => {
  if (haversineM(C.lat, C.lon, n[0], n[1]) < 180) cerca.push(i);
});
const set = new Set(cerca);
console.log(`Nodos a <180 m de la curva Anáhuac: ${cerca.length}`);

const ady = new Map<number, { to: number; name: string; cls: string }[]>();
for (const [a, b, clsIdx, nameIdx] of edges) {
  if (!set.has(a) && !set.has(b)) continue;
  const name = names[nameIdx] ?? "(sin nombre)";
  const cls = classes[clsIdx] ?? "?";
  if (!ady.has(a)) ady.set(a, []);
  if (!ady.has(b)) ady.set(b, []);
  ady.get(a)!.push({ to: b, name, cls });
  ady.get(b)!.push({ to: a, name, cls });
}

const idOf = new Map<number, string>();
cerca.forEach((i) => idOf.set(i, `n${i}`));
console.log("\n--- Nodos y sus aristas (nombre vía) ---");
for (const i of cerca) {
  const n = nodes[i];
  const d = haversineM(C.lat, C.lon, n[0], n[1]).toFixed(0);
  const aristas = (ady.get(i) ?? [])
    .map((e) => `${idOf.get(e.to)}(${e.name},${e.cls})`)
    .join(" ");
  console.log(`n${i} (${n[0].toFixed(6)}, ${n[1].toFixed(6)}) d=${d}m → ${aristas}`);
}
