// Gradiente por arista (cambio de distancia al ancla / longitud) a lo largo
// del ascenso REAL (cadena DFS gate→puente) para calibrar el umbral.
import { readFileSync } from "node:fs";
import { haversineM, type Network, type NetNode, type NetEdge } from "../src/lib/routing";
import { GATE_PIO_NONO, PLAZA_MEXICO_POS } from "../src/lib/reglasParque";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: NetNode[]; edges: NetEdge[];
};
const CORR = /^(Pío Nono$|Avenida Alberto Mackenna$)/;
// grafo del corredor
const adjC = new Map<number, Array<{ to: number; nm: string; cls: string }>>();
for (const [a, b, ci, ni] of raw.edges) {
  const nm = raw.names[ni] ?? "";
  if (!CORR.test(nm)) continue;
  if (!adjC.has(a)) adjC.set(a, []);
  if (!adjC.has(b)) adjC.set(b, []);
  adjC.get(a)!.push({ to: b, nm, cls: raw.classes[ci] });
  adjC.get(b)!.push({ to: a, nm, cls: raw.classes[ci] });
}
// nodo de arranque: el más cercano al gate entre los del corredor
let raiz = -1, bd = Infinity;
for (const n of adjC.keys()) {
  const d = haversineM({ lat: raw.nodes[n][0], lon: raw.nodes[n][1] }, GATE_PIO_NONO);
  if (d < bd) { bd = d; raiz = n; }
}
// cadena más larga simple (DFS), como el script de inspección
const visitados = new Set<number>([raiz]);
let mejor: Array<{ u: number; v: number; nm: string; len: number }> = [];
const dfs = (n: number, path: Array<{ u: number; v: number; nm: string; len: number }>) => {
  if (path.length > mejor.length) mejor = path.slice();
  if (path.length > 400) return;
  for (const e of adjC.get(n) ?? []) {
    if (visitados.has(e.to)) continue;
    visitados.add(e.to);
    const len = haversineM({ lat: raw.nodes[n][0], lon: raw.nodes[n][1] }, { lat: raw.nodes[e.to][0], lon: raw.nodes[e.to][1] });
    path.push({ u: n, v: e.to, nm: e.nm, len });
    dfs(e.to, path);
    path.pop();
    visitados.delete(e.to);
  }
};
dfs(raiz, []);
console.log(`Cadena de ascenso: ${mejor.length} aristas`);

// gradiente de CADA arista de la cadena en sentido de ASCENSO
const grads: Array<{ g: number; len: number; dA: number }> = [];
for (const e of mejor) {
  const pu = { lat: raw.nodes[e.u][0], lon: raw.nodes[e.u][1] };
  const pv = { lat: raw.nodes[e.v][0], lon: raw.nodes[e.v][1] };
  const dU = haversineM(pu, GATE_PIO_NONO);
  const dV = haversineM(pv, GATE_PIO_NONO);
  grads.push({ g: (dV - dU) / Math.max(0.1, e.len), len: e.len, dA: dU });
}
grads.sort((x, y) => x.g - y.g);
const peor = grads.slice(0, 14);
console.log("Peores gradientes del ASCENSO (dGate cambia / longitud):");
for (const p of peor) console.log(`  g=${(p.g * 100).toFixed(0)}% · len=${p.len.toFixed(1)} m · a ${p.dA.toFixed(0)} m del gate`);
const bajoUmbral = (u: number) => grads.filter((p) => p.g < u).length;
for (const u of [0.4, 0.5, 0.55, 0.6, 0.65, 0.7]) console.log(`  ascenso con g < -${(u * 100).toFixed(0)}%: ${bajoUmbral(-u)} aristas`);

// descenso real (recorrer la cadena en reversa): gradiente negativo de la distancia
const descGrad = grads.map((p) => -p.g).sort((a, b) => a - b);
console.log(`Descenso: gradiente más pequeño (menos descendente) = ${(descGrad[0] * 100).toFixed(0)}%`);
// y para Bannen en sentido Tupahue → Plaza México
let banAsc = 0, banSub0 = 0;
const BANNEN = /^Avenida Pedro Bannen$/;
const gradsBan: number[] = [];
for (const [a, b, , ni] of raw.edges) {
  const nm = raw.names[ni] ?? "";
  if (!BANNEN.test(nm)) continue;
  const pu = { lat: raw.nodes[a][0], lon: raw.nodes[a][1] };
  const pv = { lat: raw.nodes[b][0], lon: raw.nodes[b][1] };
  const len = Math.max(0.1, haversineM(pu, pv));
  const dP = haversineM(pu, PLAZA_MEXICO_POS), dQ = haversineM(pv, PLAZA_MEXICO_POS);
  banAsc++;
  const gSub = (dQ - dP) / len; // subida: hacia plaza → negativo
  gradsBan.push(gSub);
}
gradsBan.sort((x, y) => x - y);
console.log(`Bannen: ${banAsc} aristas · gradiente subida percentiles: p5=${(gradsBan[Math.floor(gradsBan.length * 0.05)] * 100).toFixed(0)}% p1=${(gradsBan[Math.floor(gradsBan.length * 0.01)] * 100).toFixed(0)}% min=${(gradsBan[0] * 100).toFixed(0)}%`);
void adjC;
