// Aceptación de reglas direccionales:
//  A. Ascenso Pío Nono → puente → Plaza México funciona (corte OFF)
//  B. Descenso Tupahue/Puente → acceso Pío Nono NO corta el corredor
//  C. Corte cumbre ON: Anáhuac/Pío Nono → Plaza México queda cortado en
//     el puente (fin a <150 m del puente)
//  D. Corte cumbre ON: Anáhuac → Av. Gabriela Mistral / Carlos Martner OK
import { readFileSync } from "node:fs";
import { findRoute, haversineM, type Network, type NetNode, type NetEdge } from "../src/lib/routing";
import { crearDirOk, GATE_PIO_NONO, PLAZA_MEXICO_POS, PUENTE_TUPAHUE_CUMBRE } from "../src/lib/reglasParque";

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

const PAV = {
  allowedCls: new Set(["living_street", "residential", "service", "unclassified", "tertiary", "tertiary_link", "secondary", "secondary_link", "primary", "primary_link"]),
  nameAllow: [/^Paseo Metropolitano/, /^Avenida /, /^Camino /, /^Antilen$/, /^Rotonda /, /^Terraza Bellavista/, /^Explanada$/, /^Paseo Peatonal Cumbre/],
  nameBlock: [/^Sendero Ciclista /, /^Avenida Carlos Reed/, /^Carlos Reed/],
};
const anahuac = { lat: -33.417135, lon: -70.623511 };
const pioNonoGate = GATE_PIO_NONO;
const tipMackenna = { lat: -33.4193, lon: -70.63671 }; // mitad del ascenso

const resumen = (r: ReturnType<typeof findRoute>) => {
  if (!r) return "null";
  const fin = r.coords[r.coords.length - 1];
  return `${(r.distanceM / 1000).toFixed(2)} km · fin (${fin.lat.toFixed(5)},${fin.lon.toFixed(5)})`;
};
const dPuente = (r: ReturnType<typeof findRoute>) => {
  if (!r) return "—";
  const fin = r.coords[r.coords.length - 1];
  return `${haversineM(fin, PUENTE_TUPAHUE_CUMBRE).toFixed(0)} m del puente`;
};

// A. ascenso (corte OFF)
const dirSubida = crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: false });
const a1 = findRoute(net, anahuac, PLAZA_MEXICO_POS, { ...PAV, edgeDirOk: dirSubida });
console.log(`A. Anáhuac → Plaza México (corte OFF): ${resumen(a1)} · ${dPuente(a1)}`);
const a2 = findRoute(net, pioNonoGate, PLAZA_MEXICO_POS, { ...PAV, edgeDirOk: dirSubida });
console.log(`A2. Gate Pío Nono → Plaza México (corte OFF): ${resumen(a2)} · ${dPuente(a2)}`);

// B. descenso: desde el puente al acceso Pío Nono — la ruta NO debe cortar
//    el corredor del parque (si llega, debe venir rodeando por la ciudad)
const b1 = findRoute(net, PUENTE_TUPAHUE_CUMBRE, pioNonoGate, { ...PAV, edgeDirOk: dirSubida });
if (b1) {
  // ¿el trazado entra al corredor del parque descendiendo? comprobar el
  // punto más cercano del trazado al gate ANTES del final
  let minD = Infinity;
  for (const c of b1.coords) minD = Math.min(minD, haversineM(c, pioNonoGate));
  const nombres = new Map<string, number>();
  for (const n of b1.segNames) nombres.set(n, (nombres.get(n) ?? 0) + 1);
  const via = [...nombres.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([n, c]) => `${n}×${c}`).join(" · ");
  console.log(`B. Puente → Gate Pío Nono (sólo subida): ${resumen(b1)} · mín dist al gate en el trazado: ${minD.toFixed(0)} m · vía: ${via}`);
} else {
  console.log("B. Puente → Gate Pío Nono (sólo subida): null");
}
const b2 = findRoute(net, tipMackenna, pioNonoGate, { ...PAV, edgeDirOk: dirSubida });
console.log(`B2. Mitad de Mackenna → Gate (sólo subida): ${resumen(b2)}`);

// C. corte cumbre ON
const dirCorte = crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: true });
const c1 = findRoute(net, anahuac, PLAZA_MEXICO_POS, { ...PAV, edgeDirOk: dirCorte });
console.log(`C. Anáhuac → Plaza México (corte ON): ${resumen(c1)} · ${dPuente(c1)}`);
const c2 = findRoute(net, pioNonoGate, PLAZA_MEXICO_POS, { ...PAV, edgeDirOk: dirCorte });
console.log(`C2. Gate Pío Nono → Plaza México (corte ON): ${resumen(c2)} · ${dPuente(c2)}`);

// D. alternativas con corte ON
const gabriela = { lat: -33.4156, lon: -70.6204 };
const martner = { lat: -33.41272, lon: -70.61862 };
const d1 = findRoute(net, anahuac, gabriela, { ...PAV, edgeDirOk: dirCorte });
console.log(`D. Anáhuac → Av. Gabriela Mistral (corte ON): ${resumen(d1)}`);
const d2 = findRoute(net, anahuac, martner, { ...PAV, edgeDirOk: dirCorte });
console.log(`D2. Anáhuac → Av. Carlos Martner (corte ON): ${resumen(d2)}`);
// bajada cumbre → Tupahue sigue permitida con corte ON
const d3 = findRoute(net, PLAZA_MEXICO_POS, anahuac, { ...PAV, edgeDirOk: dirCorte });
console.log(`D3. Plaza México → Anáhuac (corte ON, bajada): ${resumen(d3)}`);
