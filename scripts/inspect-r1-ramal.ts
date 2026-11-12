/**
 * ¿Dónde toca r1 los nodos del ramal Anáhuac/Casa Anáhuac?
 * Lista los puntos de r1 a <15 m de cada nodo del ramal, distinguiendo
 * el living_street interior (n28473..n28478) de los nodos del cruce.
 */
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";
import grafo from "../public/red-ciclista.json";
import { haversineM } from "../src/lib/geo";

const nodes = grafo.nodes as [number, number][];
const names = grafo.names as string[];
const classes = grafo.classes as string[];
const edges = grafo.edges as [number, number, number, number, number][];

// aristas del ramal: living_street Anáhuac/Casa Anáhuac
type Arista = { a: number; b: number; cls: string; name: string };
const ramal: Arista[] = [];
for (const [a, b, clsIdx, nameIdx] of edges) {
  const name = names[nameIdx] ?? "";
  const cls = classes[clsIdx] ?? "";
  if (name === "Anáhuac" || name === "Casa Anáhuac") {
    ramal.push({ a, b, cls, name });
  }
}
const nodosRamal = new Set<number>();
for (const e of ramal) {
  nodosRamal.add(e.a);
  nodosRamal.add(e.b);
}
console.log("Aristas Anáhuac/Casa Anáhuac:");
for (const e of ramal) {
  console.log(
    `  n${e.a} (${nodes[e.a][0].toFixed(6)},${nodes[e.a][1].toFixed(6)}) ↔ n${e.b} (${nodes[e.b][0].toFixed(6)},${nodes[e.b][1].toFixed(6)}) [${e.cls}] ${e.name}`
  );
}

const r1 = RUTAS_TRAZADOS["r1"].coords.map(([lat, lon]) => ({ lat, lon }));
console.log("\nr1: puntos a <15 m de nodos del ramal");
for (let i = 0; i < r1.length; i++) {
  for (const ni of nodosRamal) {
    const d = haversineM(r1[i], { lat: nodes[ni][0], lon: nodes[ni][1] });
    if (d < 15) {
      console.log(
        `  idx=${i} (${r1[i].lat.toFixed(6)},${r1[i].lon.toFixed(6)}) ↔ n${ni} (${nodes[ni][0].toFixed(6)},${nodes[ni][1].toFixed(6)}) d=${d.toFixed(1)}m`
      );
      break;
    }
  }
}
