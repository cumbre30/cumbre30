// Prueba del CORTE HORARIO (cliente 2026-11-12):
//  · Con corteCumbre=true, no se puede subir de Tupahue a Plaza México
//    por Av. Pedro Bannen (el A* no llega al destino).
//  · Sí se llega hasta el puente Mackenna-Bannen (destino de repliegue).
//  · conVueltaEnU cierra el trazado con una vuelta en U en espejo.
//  · La BAJADA de Plaza México a Tupahue sigue permitida (no se bloquea
//    el descenso, sólo el ascenso a la cumbre).
import { readFileSync } from "node:fs";
import { findRoute, haversineM, type Network, type NetNode, type NetEdge, type LatLng } from "../src/lib/routing";
import { crearDirOk, PUENTE_TUPAHUE_CUMBRE, PLAZA_MEXICO_POS, conVueltaEnU } from "../src/lib/reglasParque";
import { PAV_DEST_OPTS, corredorPav } from "../src/lib/routingService";
import { GATES } from "../src/lib/park";
import { aplicarPuentes } from "../src/lib/puentesGrafo";

let fails = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (!c) fails++;
};

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

const dirOkCorte = crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: true });
const dirOkNormal = crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: false });

const ANAHUAC: LatLng = { lat: -33.417135, lon: -70.623511 };
const PDV = GATES.find((g) => g.id === "pv-norte")!.position;

// 1) corte activo: Tupahue/Anáhuac → Plaza México NO se alcanza
const subida = findRoute(net, ANAHUAC, PLAZA_MEXICO_POS, { ...PAV_DEST_OPTS, edgeDirOk: dirOkCorte });
const llegaCorte = subida ? haversineM(subida.coords[subida.coords.length - 1], PLAZA_MEXICO_POS) <= 250 : false;
ok(!llegaCorte, `corte activo: Anáhuac → Plaza México NO llega (${subida ? haversineM(subida.coords[subida.coords.length - 1], PLAZA_MEXICO_POS).toFixed(0) + " m del destino" : "sin ruta"})`);

// 2) corte activo: Anáhuac → puente SÍ se alcanza (repliegue con vuelta en U)
const aPuente = findRoute(net, ANAHUAC, PUENTE_TUPAHUE_CUMBRE, { ...PAV_DEST_OPTS, edgeDirOk: dirOkCorte });
ok(
  !!aPuente && haversineM(aPuente.coords[aPuente.coords.length - 1], PUENTE_TUPAHUE_CUMBRE) <= 150,
  `corte activo: Anáhuac → puente llega (${aPuente ? (aPuente.distanceM / 1000).toFixed(2) + " km" : "null"})`
);
ok(!!aPuente && aPuente.distanceM < 1600, `corte activo: el repliegue al puente es DIRECTO (${aPuente ? (aPuente.distanceM / 1000).toFixed(2) + " km" : "null"}, esperado < 1.6 km)`);

// 2b) desde el acceso PdV Norte el repliegue al puente también es directo
const pdvPuente = findRoute(net, PDV, PUENTE_TUPAHUE_CUMBRE, { ...PAV_DEST_OPTS, edgeDirOk: dirOkCorte });
ok(!!pdvPuente && pdvPuente.distanceM < 2600, `corte activo: PdV Norte → puente directo (${pdvPuente ? (pdvPuente.distanceM / 1000).toFixed(2) + " km" : "null"}, esperado < 2.6 km)`);

// 2c) el regreso desde el puente hacia Anáhuac/PdV (salida del corte) queda abierto
const regreso = findRoute(net, PUENTE_TUPAHUE_CUMBRE, PDV, { ...PAV_DEST_OPTS, edgeDirOk: dirOkCorte });
ok(!!regreso && regreso.distanceM < 2600, `corte activo: puente → PdV Norte (salida del corte) directo (${regreso ? (regreso.distanceM / 1000).toFixed(2) + " km" : "null"})`);

// 3) vuelta en U sobre el trazado al puente
if (aPuente) {
  const vu = conVueltaEnU(aPuente.coords);
  ok(vu.coords.length > aPuente.coords.length, `vuelta en U agrega el espejo (+${vu.coords.length - aPuente.coords.length} pts, ${vu.metrosVuelta} m)`);
  const fin = vu.coords[vu.coords.length - 1];
  ok(haversineM(fin, aPuente.coords[0]) < 150 || aPuente.distanceM < 300, `la U termina junto al inicio del repliegue (${haversineM(fin, aPuente.coords[0]).toFixed(0)} m; repliegue ${(aPuente.distanceM / 1000).toFixed(2)} km)`);
}

// 4) horario normal: Anáhuac → Plaza México SÍ llega
const subidaNormal = findRoute(net, ANAHUAC, PLAZA_MEXICO_POS, { ...PAV_DEST_OPTS, edgeDirOk: dirOkNormal });
ok(!!subidaNormal && haversineM(subidaNormal.coords[subidaNormal.coords.length - 1], PLAZA_MEXICO_POS) <= 250, `horario normal: Anáhuac → Plaza México llega (${subidaNormal ? (subidaNormal.distanceM / 1000).toFixed(2) + " km" : "null"})`);

// 5) bajada desde la cumbre a PdV sigue permitida con corte activo
const bajada = findRoute(net, PLAZA_MEXICO_POS, PDV, { ...PAV_DEST_OPTS, edgeDirOk: dirOkCorte });
ok(!!bajada && haversineM(bajada.coords[bajada.coords.length - 1], PDV) <= 150, `corte activo: Plaza México → PdV Norte (bajada) llega (${bajada ? (bajada.distanceM / 1000).toFixed(2) + " km" : "null"})`);

console.log(fails ? `\n${fails} FALLAS` : "\nTODO OK");
process.exit(fails ? 1 : 0);
