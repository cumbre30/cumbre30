// Diagnóstico: ¿qué aristas hacia adelante (ascenso) bloquea crearDirOk?
import { readFileSync } from "node:fs";
import { findRoute, haversineM, type Network, type NetNode, type NetEdge } from "../src/lib/routing";
import { crearDirOk, GATE_PIO_NONO, PLAZA_MEXICO_POS } from "../src/lib/reglasParque";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: NetNode[]; edges: NetEdge[]; cicloviaPolylines: number[][];
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

const dirOk = crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: false });

// camino teórico del ascenso: aristas con nombre corredor ordenadas por
// distancia al gate; detecta bloqueos en sentido ASCENDENTE (lejos del gate)
const CORR = /^(Pío Nono$|Avenida Alberto Mackenna$)/;
let bloqueados = 0, revisadas = 0;
for (const [a, b, ci, ni] of raw.edges) {
  const nm = raw.names[ni] ?? "";
  if (!CORR.test(nm)) continue;
  const pa = raw.nodes[a], pb = raw.nodes[b];
  const dA = haversineM({ lat: pa[0], lon: pa[1] }, GATE_PIO_NONO);
  const dB = haversineM({ lat: pb[0], lon: pb[1] }, GATE_PIO_NONO);
  revisadas++;
  // sentido ascendente: el extremo más lejano del gate es el destino
  const [u, v, uC, vC] = dA <= dB ? [a, b, pa, pb] : [b, a, pb, pa];
  if (!dirOk(u, v, uC[0], uC[1], vC[0], vC[1], raw.classes[ci], nm)) {
    bloqueados++;
    if (bloqueados <= 12) {
      console.log(`BLOQUEADO ascenso: (${uC[0].toFixed(5)},${uC[1].toFixed(5)}) → (${vC[0].toFixed(5)},${vC[1].toFixed(5)}) · ${nm} · dGate ${haversineM({ lat: uC[0], lon: uC[1] }, GATE_PIO_NONO).toFixed(0)} → ${haversineM({ lat: vC[0], lon: vC[1] }, GATE_PIO_NONO).toFixed(0)} m`);
    }
  }
}
console.log(`Corredor: ${revisadas} aristas revisadas, ${bloqueados} bloqueadas en ASCENSO`);
// y el descenso debería estar bloqueado (muestra cuántas NO lo están)
let libresDesc = 0;
for (const [a, b, ci, ni] of raw.edges) {
  const nm = raw.names[ni] ?? "";
  if (!CORR.test(nm)) continue;
  const pa = raw.nodes[a], pb = raw.nodes[b];
  const dA = haversineM({ lat: pa[0], lon: pa[1] }, GATE_PIO_NONO);
  const dB = haversineM({ lat: pb[0], lon: pb[1] }, GATE_PIO_NONO);
  const [u, v, uC, vC] = dA > dB ? [a, b, pa, pb] : [b, a, pb, pa];
  if (dirOk(u, v, uC[0], uC[1], vC[0], vC[1], raw.classes[ci], nm)) libresDesc++;
}
console.log(`Descensos NO bloqueados: ${libresDesc}`);

// prueba directa de las dos patas que fallaron en build-rutas
const rA = findRoute(net, GATE_PIO_NONO, { lat: -33.4193, lon: -70.63671 });
console.log(`gate → VIA.mackenna (sin dirOk): ${rA ? (rA.distanceM / 1000).toFixed(2) + " km" : "null"}`);
const dirOk2 = crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: false });
const CLASES_PAVIMENTO = new Set(["living_street", "residential", "service", "unclassified", "tertiary", "tertiary_link", "secondary", "secondary_link", "primary", "primary_link"]);
const rB = findRoute(net, GATE_PIO_NONO, { lat: -33.4193, lon: -70.63671 }, {
  allowedCls: CLASES_PAVIMENTO,
  nameAllow: [/^Paseo Metropolitano/, /^Avenida /, /^Camino /, /^Antilen$/, /^Rotonda /, /^Terraza Bellavista/, /^Explanada$/, /^Paseo Peatonal Cumbre/],
  nameBlock: [/^Sendero Ciclista /, /^Avenida Carlos Reed/, /^Carlos Reed/],
  edgeDirOk: dirOk2,
});
console.log(`gate → VIA.mackenna (con dirOk + pav): ${rB ? (rB.distanceM / 1000).toFixed(2) + " km · fin (" + rB.coords[rB.coords.length - 1].lat.toFixed(5) + "," + rB.coords[rB.coords.length - 1].lon.toFixed(5) + ")" : "null"}`);
if (rB) {
  const nombres = new Map<string, number>();
  for (const n of rB.segNames) nombres.set(n, (nombres.get(n) ?? 0) + 1);
  console.log("  vía:", [...nombres.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([n, c]) => `${n}×${c}`).join(" · "));
}
void PLAZA_MEXICO_POS;

// --- aislamiento del fallo r1 t2: nodoTupahue → Plaza México ---
const nodoTupahue = { lat: -33.4215, lon: -70.6288 };
const plaza = { lat: -33.4234, lon: -70.6327 };
const rC = findRoute(net, nodoTupahue, plaza, {
  allowedCls: CLASES_PAVIMENTO,
  nameAllow: [/^Paseo Metropolitano/, /^Avenida /, /^Camino /, /^Antilen$/, /^Rotonda /, /^Terraza Bellavista/, /^Explanada$/, /^Paseo Peatonal Cumbre/],
  nameBlock: [/^Sendero Ciclista /, /^Avenida Carlos Reed/, /^Carlos Reed/],
  edgeDirOk: dirOk2,
});
console.log(`nodoTupahue → Plaza México (con dirOk): ${rC ? (rC.distanceM / 1000).toFixed(2) + " km" : "null"}`);
const rD = findRoute(net, nodoTupahue, plaza, {
  allowedCls: CLASES_PAVIMENTO,
  nameAllow: [/^Paseo Metropolitano/, /^Avenida /, /^Camino /, /^Antilen$/, /^Rotonda /, /^Terraza Bellavista/, /^Explanada$/, /^Paseo Peatonal Cumbre/],
  nameBlock: [/^Sendero Ciclista /, /^Avenida Carlos Reed/, /^Carlos Reed/],
});
console.log(`nodoTupahue → Plaza México (sin dirOk): ${rD ? (rD.distanceM / 1000).toFixed(2) + " km" : "null"}`);
if (rD) {
  const nombres = new Map<string, number>();
  for (const n of rD.segNames) nombres.set(n, (nombres.get(n) ?? 0) + 1);
  console.log("  vía:", [...nombres.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([n, c]) => `${n}×${c}`).join(" · "));
}
