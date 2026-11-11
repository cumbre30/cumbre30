// Diagnóstico del bloqueo del ascenso: aristas de Mackenna alrededor de
// t≈900-1300 y qué regla las bloquea.
import { readFileSync } from "node:fs";
import { haversineM, type Network, type NetNode, type NetEdge } from "../src/lib/routing";
import { crearDirOk, debugDirOk, GATE_PIO_NONO } from "../src/lib/reglasParque";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: NetNode[]; edges: NetEdge[];
};
const PENALTY: Record<string, number> = {
  cycleway: 0.65, path: 0.9, footway: 1.35, pedestrian: 1.1, track: 1.0,
  living_street: 0.95, residential: 0.95, service: 1.05, unclassified: 1.0,
  tertiary: 1.15, tertiary_link: 1.2, secondary: 1.5, secondary_link: 1.5,
  primary: 2.4, primary_link: 2.4,
};
const adj: Network["adj"] = raw.nodes.map(() => []);
for (const [a, b, clsIdx, nameIdx, ciclo] of raw.edges) {
  const cls = raw.classes[clsIdx] ?? "residential";
  const name = raw.names[nameIdx] ?? "";
  const p = PENALTY[cls] ?? 1;
  const pa = { lat: raw.nodes[a][0], lon: raw.nodes[a][1] };
  const pb = { lat: raw.nodes[b][0], lon: raw.nodes[b][1] };
  const dist = haversineM(pa, pb);
  adj[a].push({ to: b, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: 0 });
  adj[b].push({ to: a, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: 0 });
}
const net: Network = { ...raw, adj };

// traza la ruta real que produce findRoute con dirOk y lista sus aristas
// con su estado; luego para cada nodo de la ruta imprime las aristas
// SALIENTES hacia arriba (Mackenna) y su diagnóstico
const dirOk = crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: false });

// localiza el punto donde se corta: usa la ruta A2 (gate→plaza) y muestra
// las últimas aristas + las aristas salientes del último nodo
const rutaFin = { lat: -33.42341, lon: -70.63688 };
let finIdx = -1, fd = Infinity;
for (let i = 0; i < raw.nodes.length; i++) {
  const d = haversineM({ lat: raw.nodes[i][0], lon: raw.nodes[i][1] }, rutaFin);
  if (d < fd) { fd = d; finIdx = i; }
}
console.log(`Nodo final de la ruta cortada: (${raw.nodes[finIdx][0].toFixed(5)},${raw.nodes[finIdx][1].toFixed(5)}) @ ${fd.toFixed(1)} m`);

// aristas salientes de finIdx con diagnóstico
console.log("\nAristas salientes del nodo cortado:");
for (const e of adj[finIdx]) {
  const pv = raw.nodes[e.to];
  const dU = haversineM({ lat: raw.nodes[finIdx][0], lon: raw.nodes[finIdx][1] }, GATE_PIO_NONO);
  const dV = haversineM({ lat: pv[0], lon: pv[1] }, GATE_PIO_NONO);
  console.log(`  → (${pv[0].toFixed(5)},${pv[1].toFixed(5)}) [${e.cls}] "${e.name}" · dGate ${dU.toFixed(0)}→${dV.toFixed(0)} · ${debugDirOk(net, { pioNonoSoloSubida: true, corteCumbre: false }, finIdx, e.to, raw.nodes[finIdx][0], raw.nodes[finIdx][1], pv[0], pv[1], e.cls, e.name)}`);
}

// y una vista del árbol pio en ese sector: nodos Mackenna con su t/padre
const tU = new Map<number, [number, number]>(); // nodo → [t, padre]
void tU;
console.log("\nContexto: aristas Mackenna cercanas al punto cortado (radio 150 m):");
const CORR = /^Avenida Alberto Mackenna/;
for (const [a, b, , ni] of raw.edges) {
  const nm = raw.names[ni] ?? "";
  if (!CORR.test(nm)) continue;
  const pa = raw.nodes[a], pb = raw.nodes[b];
  const d = Math.min(
    haversineM({ lat: pa[0], lon: pa[1] }, rutaFin),
    haversineM({ lat: pb[0], lon: pb[1] }, rutaFin)
  );
  if (d > 150) continue;
  const diag = debugDirOk(net, { pioNonoSoloSubida: true, corteCumbre: false }, a, b, pa[0], pa[1], pb[0], pb[1], raw.classes[raw.edges.findIndex((x) => x === undefined)] ?? "residential", nm);
  console.log(`  (${pa[0].toFixed(5)},${pa[1].toFixed(5)})→(${pb[0].toFixed(5)},${pb[1].toFixed(5)}) ${diag.replace("bannen: esBannen=false padreU=- padreV=-", "").trim()}`);
}
void dirOk;
