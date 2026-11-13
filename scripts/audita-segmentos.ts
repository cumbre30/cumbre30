// Auditoría de los segmentos del cerro (2026-11-13) tras trasladar
// porterías y agregar las 3 bajadas del control 30 km/h.
// Actualización 2026-11-13 (tarde): se retiran los 2 segmentos de
// senderos de tierra (Zorro Vidal · bajada y Mapuche · bajada) a
// pedido del cliente («son personales»): quedan 7 segmentos
// (4 subidas + 3 bajadas del control 30).
// 1) Coherencia de datos: inicios anclados a GATES, extremos de las
//    bajadas 30 = extremos de BAJADAS_CONTROL_30, metas de bajada en
//    las porterías.
// 2) Detección con pistas sintéticas: 1 esfuerzo por bajada 30, la
//    subida La Pirámide → Plaza México sobre la ruta real del grafo
//    (findRoute), subida invertida no cuenta, descenso demasiado
//    rápido se descarta.
import {
  SEGMENTS,
  detectEfforts,
  computeSegmentStats,
} from "../src/lib/segments";
import { GATES } from "../src/lib/park";
import { BAJADAS_CONTROL_30 } from "../src/lib/rutasTrazados";
import { haversineM } from "../src/lib/geo";
import * as fs from "fs";
import { findRoute, type Network, type NetEdge } from "../src/lib/routing";
import type { RideSummary, TrackPt } from "../src/lib/history";

let fails = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fails++;
};

const gate = (id: string) => GATES.find((g) => g.id === id)!.position;
const seg = (id: string) => SEGMENTS.find((s) => s.id === id)!;
const dist = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => haversineM(a, b);

// ---------- 1) Datos ----------
ok(SEGMENTS.length === 7, `7 segmentos definidos (${SEGMENTS.length}): 4 subidas + 3 bajadas del control 30 (sin los personales Zorro Vidal y Mapuche, retirados 2026-11-13)`);
const subidas = SEGMENTS.filter((s) => (s.dir ?? "subida") === "subida");
const bajadas = SEGMENTS.filter((s) => s.dir === "bajada");
ok(subidas.length === 4, `4 subidas (${subidas.length})`);
ok(bajadas.length === 3, `3 bajadas del control 30 (${bajadas.length})`);

// Inicios de subida anclados a GATES / Piscina Antilén
ok(seg("pio-nono-plaza-mexico").start.lat === gate("pio-nono").lat && seg("pio-nono-plaza-mexico").start.lon === gate("pio-nono").lon,
  "Pío Nono → Plaza México arranca en GATES pio-nono (portería del cliente 2026-11-13)");
ok(seg("pv-norte-plaza-mexico").start.lat === gate("pv-norte").lat, "PdV Norte → Plaza México arranca en GATES pv-norte");
ok(seg("la-piramide-plaza-mexico").start.lat === gate("la-piramide").lat && seg("la-piramide-plaza-mexico").start.lon === gate("la-piramide").lon,
  "La Pirámide → Plaza México arranca en GATES la-piramide (nuevo segmento)");
ok(dist(seg("antiluen-plaza-mexico").start, { lat: -33.409051, lon: -70.61374 }) < 1, "Antilén → Plaza México arranca en la Piscina Antilén");
for (const s of subidas) {
  ok(dist(s.end, { lat: -33.4234, lon: -70.6327 }) < 1, `${s.id}: meta en Plaza México (848 m, bici)`);
}

// Bajadas 30: extremos = extremos del trazado rojo; meta en la portería
for (const b of BAJADAS_CONTROL_30) {
  const s = seg(b.id);
  const a = { lat: b.coords[0][0], lon: b.coords[0][1] };
  const z = { lat: b.coords[b.coords.length - 1][0], lon: b.coords[b.coords.length - 1][1] };
  ok(!!s && s.dir === "bajada" && !s.preliminar, `${b.id}: definido como bajada oficial (no preliminar)`);
  ok(dist(s.start, a) < 2 && dist(s.end, z) < 2, `${b.id}: geocercas = extremos del trazado rojo`);
}
ok(dist(seg("b30-pionono").end, gate("pio-nono")) < 60, `b30-pionono meta a ${dist(seg("b30-pionono").end, gate("pio-nono")).toFixed(0)} m de la portería Pío Nono`);
ok(dist(seg("b30-pdv").end, gate("pv-norte")) < 60, `b30-pdv meta a ${dist(seg("b30-pdv").end, gate("pv-norte")).toFixed(0)} m de la portería PdV Norte`);
ok(dist(seg("b30-piramide").end, gate("la-piramide")) < 60, `b30-piramide meta a ${dist(seg("b30-piramide").end, gate("la-piramide")).toFixed(0)} m de la portería La Pirámide`);
ok(dist(seg("b30-pionono").start, { lat: -33.4234, lon: -70.6327 }) < 60, "b30-pionono arranca junto a Plaza México");
ok(dist(seg("b30-pdv").start, { lat: -33.40758, lon: -70.61121 }) < 60, "b30-pdv arranca en Plaza Antilén");
ok(dist(seg("b30-piramide").start, { lat: -33.409051, lon: -70.61374 }) < 60, "b30-piramide arranca en la cima Chacarillas (Antilén)");

// Los segmentos personales retirados ya NO existen en el catálogo
ok(!seg("zorro-vidal-bajada") && !seg("mapuche-bajada"), "segmentos personales Zorro Vidal y Mapuche retirados del catálogo");

// ---------- 2) Detección sintética ----------
let rideSeq = 0;
const mkRide = (track: TrackPt[]): RideSummary =>
  ({
    id: `syn-${++rideSeq}`,
    dateISO: "2026-11-13T15:00:00.000Z",
    source: "gps",
    distanceKm: 5,
    maxKmh: 28,
    maxInParkKmh: 28,
    avgKmh: 20,
    elapsedSec: track[track.length - 1][3] - track[0][3],
    gainM: 0,
    overLimitSec: 0,
    track,
  }) as RideSummary;

/** Pista sintética: puntos del trazado + altitud lineal inicio→meta + reloj lineal. */
const synth = (coords: [number, number][], altA: number, altB: number, kmh: number): TrackPt[] => {
  let distAcc = 0;
  const out: TrackPt[] = [];
  for (let i = 0; i < coords.length; i++) {
    if (i > 0) {
      distAcc += haversineM({ lat: coords[i - 1][0], lon: coords[i - 1][1] }, { lat: coords[i][0], lon: coords[i][1] });
    }
    const f = i / (coords.length - 1);
    out.push([coords[i][0], coords[i][1], altA + (altB - altA) * f, 3600 + (distAcc / 1000 / kmh) * 3600]);
  }
  return out;
};

// 2a. Cada bajada 30 se detecta UNA vez a 20 km/h con su caída real
const DROPS: Record<string, [number, number]> = {
  "b30-pionono": [848, 706], // Plaza México 848 → portería Pío Nono ~706
  "b30-pdv": [800, 705], // Chacarillas 800 → PdV Norte ~705
  "b30-piramide": [800, 755], // Chacarillas 800 → portería La Pirámide
};
for (const b of BAJADAS_CONTROL_30) {
  const [a, z] = DROPS[b.id];
  const r = mkRide(synth(b.coords, a, z, 20));
  const def = seg(b.id);
  const e = detectEfforts(r, def);
  ok(e.length === 1, `${b.id}: 1 intento detectado a 20 km/h (${e.length})`);
  const drop = a - z;
  ok(e.length === 1 && e[0].gainM <= -(drop - 30) && e[0].gainM >= -drop - 3,
    `${b.id}: pérdida GPS ${e.length ? e[0].gainM.toFixed(0) : "?"} m ≈ -${drop} m (±30 m por geocerca)`);
  ok(e.length === 1 && e[0].gainM <= -def.minGainM, `${b.id}: pérdida supera el umbral ${def.minGainM} m`);
  ok(e.length === 1 && e[0].timeSec >= def.minTimeSec && e[0].timeSec <= def.maxTimeSec, `${b.id}: tiempo ${e.length ? e[0].timeSec.toFixed(0) : "?"} s dentro de la ventana`);
  // Subida invertida NO cuenta como bajada
  const rUp = mkRide(synth([...b.coords].reverse(), z, a, 12));
  ok(detectEfforts(rUp, def).length === 0, `${b.id}: subir por el corredor no genera intento de bajada`);
  // Demasiado rápido (misma pista comprimida a 60 km/h en vez de la ventana): se descarta
  const rFast = mkRide(synth(b.coords, a, z, 120));
  ok(detectEfforts(rFast, def).length === 0, `${b.id}: descenso a 120 km/h fuera de ventana se descarta`);
}

// 2b. Subida La Pirámide → Plaza México sobre la ruta REAL del grafo
// (findRoute: Sendero Ciclista Pirámide + Av. Carlos Martner, 5,91 km)
const raw = JSON.parse(fs.readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: [number, number][]; edges: NetEdge[]; cicloviaPolylines: number[][];
};
const PENALTY: Record<string, number> = {
  cycleway: 0.65, path: 0.9, footway: 1.35, pedestrian: 1.1, track: 1.0,
  living_street: 0.95, residential: 0.95, service: 1.05, unclassified: 1.0,
  tertiary: 1.15, tertiary_link: 1.2, secondary: 1.5, secondary_link: 1.5, primary: 2.4, primary_link: 2.4,
};
const adj: Network["adj"] = raw.nodes.map(() => []);
for (const [a, b, clsIdx, nameIdx, ciclo] of raw.edges) {
  const cls = raw.classes[clsIdx] ?? "residential";
  const p = PENALTY[cls] ?? 1;
  const pa = { lat: raw.nodes[a][0], lon: raw.nodes[a][1] };
  const pb = { lat: raw.nodes[b][0], lon: raw.nodes[b][1] };
  const dd = haversineM(pa, pb);
  adj[a].push({ to: b, w: dd * p, dist: dd, cls, name: raw.names[nameIdx] ?? "", ciclovia: ciclo === 1, bearing: 0 });
  adj[b].push({ to: a, w: dd * p, dist: dd, cls, name: raw.names[nameIdx] ?? "", ciclovia: ciclo === 1, bearing: 0 });
}
const net: Network = { ...raw, adj };
const PIR = gate("la-piramide");
const MEX = { lat: -33.4234, lon: -70.6327 };
const rSubida = findRoute(net, PIR, MEX);
ok(!!rSubida && rSubida.distanceM > 4000 && rSubida.distanceM < 8000, `subida ciclable La Pirámide → Plaza México existe (${rSubida ? (rSubida.distanceM / 1000).toFixed(2) : "?"} km)`);
if (rSubida) {
  const coordsSub: [number, number][] = rSubida.coords.map((c) => [c.lat, c.lon]);
  const rideLP = mkRide(synth(coordsSub, 745, 848, 12)); // portería ~745 m → Plaza México 848 m a 12 km/h
  const eLP = detectEfforts(rideLP, seg("la-piramide-plaza-mexico"));
  ok(eLP.length === 1, `La Pirámide → Plaza México: 1 intento en la subida real (${eLP.length})`);
  ok(eLP.length === 1 && Math.abs(eLP[0].distanceM - rSubida.distanceM) < 300, `La Pirámide → Plaza México: distancia ${eLP.length ? (eLP[0].distanceM / 1000).toFixed(2) : "?"} km ≈ trazado ${(rSubida.distanceM / 1000).toFixed(2)} km`);
  ok(eLP.length === 1 && eLP[0].gainM >= 60, `La Pirámide → Plaza México: +${eLP.length ? eLP[0].gainM.toFixed(0) : "?"} m ≥ umbral 60`);
}

// 2c. Resumen Pro: 7 segmentos, con PB en los sintéticos cargados
const stats = computeSegmentStats([mkRide(synth(BAJADAS_CONTROL_30.find((b) => b.id === "b30-piramide")!.coords, 800, 755, 20))]);
ok(stats.length === 7, `computeSegmentStats devuelve los 7 (${stats.length})`);
ok(stats.find((s) => s.def.id === "b30-piramide")?.count === 1, "b30-piramide cuenta el intento sintético");
ok(stats.find((s) => s.def.id === "b30-pionono")?.count === 0, "b30-pionono sin intentos en ese viaje");

console.log(fails ? `\n${fails} FALLAS` : "\nTODO OK");
process.exit(fails ? 1 : 0);
