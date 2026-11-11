// ¿Hasta dónde llega el ascenso con dirOk? Barre puntos de la cadena
// Mackenna (muestreados del grafo) como destinos y encuentra el corte.
import { readFileSync } from "node:fs";
import { findRoute, haversineM, type Network, type NetNode, type NetEdge } from "../src/lib/routing";
import { crearDirOk, GATE_PIO_NONO, PUENTE_TUPAHUE_CUMBRE } from "../src/lib/reglasParque";

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

const dirOk = crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: false });
const PAV = {
  allowedCls: new Set(["living_street", "residential", "service", "unclassified", "tertiary", "tertiary_link", "secondary", "secondary_link", "primary", "primary_link"]),
  nameAllow: [/^Paseo Metropolitano/, /^Avenida /, /^Camino /, /^Antilen$/, /^Rotonda /, /^Terraza Bellavista/, /^Explanada$/, /^Paseo Peatonal Cumbre/],
  nameBlock: [/^Sendero Ciclista /, /^Avenida Carlos Reed/, /^Carlos Reed/],
  edgeDirOk: dirOk,
};

// cadena Mackenna desde el gate: camino simple DFS (igual que inspección)
const CORR = /^(Pío Nono$|Avenida Alberto Mackenna$)/;
const adjC = new Map<number, Array<{ to: number }>>();
for (const [a, b, , ni] of raw.edges) {
  const nm = raw.names[ni] ?? "";
  if (!CORR.test(nm)) continue;
  if (!adjC.has(a)) adjC.set(a, []);
  if (!adjC.has(b)) adjC.set(b, []);
  adjC.get(a)!.push({ to: b });
  adjC.get(b)!.push({ to: a });
}
let raiz = -1, bd = Infinity;
for (const n of adjC.keys()) {
  const d = haversineM({ lat: raw.nodes[n][0], lon: raw.nodes[n][1] }, GATE_PIO_NONO);
  if (d < bd) { bd = d; raiz = n; }
}
const visitados = new Set<number>([raiz]);
let cadena: number[] = [];
const dfs = (n: number, path: number[]) => {
  if (path.length > cadena.length) cadena = path.slice();
  if (path.length > 400) return;
  for (const e of adjC.get(n) ?? []) {
    if (visitados.has(e.to)) continue;
    visitados.add(e.to);
    path.push(e.to);
    dfs(e.to, path);
    path.pop();
    visitados.delete(e.to);
  }
};
dfs(raiz, [raiz]);
console.log(`Cadena: ${cadena.length} nodos`);

// barrido: cada ~15 nodos como destino
const paso = Math.max(1, Math.floor(cadena.length / 24));
for (let i = 0; i < cadena.length; i += paso) {
  const n = cadena[i];
  const dest = { lat: raw.nodes[n][0], lon: raw.nodes[n][1] };
  const dGate = haversineM(dest, GATE_PIO_NONO);
  const r = findRoute(net, GATE_PIO_NONO, dest, PAV);
  const ok = r && haversineM(r.coords[r.coords.length - 1], dest) < 120;
  console.log(`t=${i} · dGate=${dGate.toFixed(0)}m · (${dest.lat.toFixed(5)},${dest.lon.toFixed(5)}) · ${ok ? "ALCANZA" : r ? `ruta ${((r.distanceM / 1000).toFixed(2))} km fin lejos (${haversineM(r.coords[r.coords.length - 1], dest).toFixed(0)} m)` : "null"}`);
}
