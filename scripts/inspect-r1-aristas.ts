/**
 * ¿Qué aristas del grafo recorre r1 en idx 80..115 (curva Anáhuac)?
 * Mapea cada punto de r1 a su arista más cercana (por extremos y punto
 * medio) y detecta la geometría del doble paso.
 */
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";
import grafo from "../public/red-ciclista.json";
import { haversineM } from "../src/lib/geo";

const nodes = grafo.nodes as [number, number][];
const names = grafo.names as string[];
const classes = grafo.classes as string[];
const edges = grafo.edges as [number, number, number, number, number][];

function nearestEdge(p: { lat: number; lon: number }) {
  let best = { name: "?", cls: "?", d: Infinity, a: -1, b: -1 };
  for (let e = 0; e < edges.length; e++) {
    const [a, b, ci, ni] = edges[e];
    const pa = nodes[a], pb = nodes[b];
    if (Math.abs(pa[0] - p.lat) > 0.0016 || Math.abs(pa[1] - p.lon) > 0.0022) continue;
    if (Math.abs(pb[0] - p.lat) > 0.0016 || Math.abs(pb[1] - p.lon) > 0.0022) continue;
    const dMid = haversineM(p, { lat: (pa[0] + pb[0]) / 2, lon: (pa[1] + pb[1]) / 2 });
    const dEnd = Math.min(haversineM(p, { lat: pa[0], lon: pa[1] }), haversineM(p, { lat: pb[0], lon: pb[1] }));
    const d = Math.min(dMid, dEnd);
    if (d < best.d) best = { name: names[ni] ?? "(sin nombre)", cls: classes[ci] ?? "?", d, a, b };
  }
  return best;
}

const r1 = RUTAS_TRAZADOS["r1"].coords.map(([lat, lon]) => ({ lat, lon }));
console.log("r1 idx 78..118 con arista más cercana:");
let last = "";
for (let i = 78; i <= 118 && i < r1.length; i++) {
  const ne = nearestEdge(r1[i]);
  const tag = `${ne.name}[${ne.cls}] n${ne.a}↔n${ne.b}`;
  const marca = tag !== last ? `→ ${tag}` : "·";
  last = tag;
  console.log(
    `  idx=${String(i).padStart(3)} (${r1[i].lat.toFixed(6)}, ${r1[i].lon.toFixed(6)}) ${marca} d=${ne.d.toFixed(1)}m`
  );
}

// detalle: todos los extremos de aristas alrededor de n3346 y el vecindario inmediato
console.log("\nVecindario de n3346 (-33.416890,-70.623351):");
const C = { lat: -33.41689, lon: -70.623351 };
for (const [a, b, ci, ni] of edges) {
  const pa = nodes[a], pb = nodes[b];
  if (haversineM(C, { lat: pa[0], lon: pa[1] }) > 90 && haversineM(C, { lat: pb[0], lon: pb[1] }) > 90) continue;
  console.log(
    `  n${a} (${pa[0].toFixed(6)},${pa[1].toFixed(6)}) ↔ n${b} (${pb[0].toFixed(6)},${pb[1].toFixed(6)}) vía="${names[ni]}" [${classes[ci]}]`
  );
}
