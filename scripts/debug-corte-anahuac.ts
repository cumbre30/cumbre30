// Debug: por qué Anáhuac → puente devuelve null tras bloquear los
// senderos peatonales (test-corte-horario 2026-11-13).
import { readFileSync } from "node:fs";
import { findRoute, haversineM, type Network, type NetNode, type NetEdge, type LatLng } from "../src/lib/routing";
import { crearDirOk, PUENTE_TUPAHUE_CUMBRE, PLAZA_MEXICO_POS } from "../src/lib/reglasParque";
import { PAV_DEST_OPTS, corredorPav } from "../src/lib/routingService";
import { SEND_PEATONALES_BLOCK } from "../src/lib/senderos";
import { aplicarPuentes } from "../src/lib/puentesGrafo";

const PENALTY: Record<string, number> = {
  cycleway: 0.65, path: 0.9, footway: 1.35, pedestrian: 1.1, track: 1.0,
  living_street: 0.95, residential: 0.95, service: 1.05, unclassified: 1.0,
  tertiary: 1.15, tertiary_link: 1.2, secondary: 1.5, secondary_link: 1.5,
  primary: 2.4, primary_link: 2.4,
};
const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as { classes: string[]; names: string[]; nodes: NetNode[]; edges: NetEdge[] };
const adj: Network["adj"] = raw.nodes.map(() => []);
for (const [a, b, ci, ni] of raw.edges) {
  const cls = raw.classes[ci] ?? "residential", name = raw.names[ni] ?? "", p = PENALTY[cls] ?? 1;
  const pa = { lat: raw.nodes[a][0], lon: raw.nodes[a][1] }, pb = { lat: raw.nodes[b][0], lon: raw.nodes[b][1] };
  const dist = haversineM(pa, pb);
  const w = dist * p;
  const br = ((Math.atan2((pb.lon - pa.lon) * Math.PI / 180 * Math.cos(pb.lat * Math.PI / 180), (pb.lat - pa.lat) * Math.PI / 180) * 180) / Math.PI + 360) % 360;
  adj[a].push({ to: b, w, dist, cls, name, ciclovia: false, bearing: br });
  adj[b].push({ to: a, w, dist, cls, name, ciclovia: false, bearing: (br + 180) % 360 });
}
const net: Network = { ...raw, adj } as Network;
aplicarPuentes(net);
corredorPav(net);
const dirOkNormal = crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: false });

const ANAHUAC: LatLng = { lat: -33.417135, lon: -70.623511 };

const intentos: [string, Parameters<typeof findRoute>[3]][] = [
  ["PAV_DEST_OPTS + dirOk (ANTES del bloque peatonal)", { ...PAV_DEST_OPTS, edgeDirOk: dirOkNormal, nameBlock: [/^Sendero Ciclista /, /^Sendero (?!Ciclista)(?!El Excursionista)/, /^Ruta Nativa/, /^Avenida Carlos Reed/, /^Carlos Reed/] }],
  ["PAV_DEST_OPTS + dirOk (HOY, con bloque peatonal)", { ...PAV_DEST_OPTS, edgeDirOk: dirOkNormal }],
  ["PAV_DEST_OPTS sin edgeOk + dirOk", { allowedCls: PAV_DEST_OPTS.allowedCls, nameAllow: PAV_DEST_OPTS.nameAllow, nameBlock: PAV_DEST_OPTS.nameBlock, edgeDirOk: dirOkNormal }],
  ["sólo dirOk", { edgeDirOk: dirOkNormal }],
];
for (const [label, opts] of intentos) {
  const r = findRoute(net, ANAHUAC, PUENTE_TUPAHUE_CUMBRE, opts);
  console.log(`${r ? "OK " : "null"} ${label} → ${r ? (r.distanceM / 1000).toFixed(2) + " km" : "null"}`);
  if (!r && label.includes("HOY")) {
    // ¿dónde ancla el origen con los filtros de hoy?
    const rSin = findRoute(net, ANAHUAC, PUENTE_TUPAHUE_CUMBRE, { edgeDirOk: dirOkNormal });
    console.log(`   referencia sin filtros: ${rSin ? (rSin.distanceM / 1000).toFixed(2) + " km" : "null"}`);
  }
}
void PLAZA_MEXICO_POS;
