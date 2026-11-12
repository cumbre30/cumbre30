// Auditoría MTB 1-4 (cliente 2026-11-13: «Auditar las rutas MTB 1,2,3 y
// 4, y validar para ejecutar modificación. Guíate por los nombres y busca
// información en la página https://www.mesadeciclistas.org/»).
//
// La Mesa de Ciclistas mapea y clasifica los senderos del cerro; su
// propuesta distingue senderos CICLISTAS (Pa' Arriba, La S, Zorzal,
// Anfiteatro, Torre 5 / 4½…) de senderos PEATONALES. El cliente fijó los
// 8 peatonales (Zorro Vidal, Ermitaño, Anáhuac, Mapuche, Gabriela
// Mistral, Boy Scout, Atacameño, El Carbón) como «no considerar».
//
// Verifica sobre los trazados REGENERADOS:
//  1. NINGUNA de las 12 rutas predefinidas (r1-r5, mtb1-4) recorre
//     aristas de los 8 senderos peatonales (nombre de vía real del grafo).
//  2. Cada MTB sigue usando SUS senderos ciclistas (los nombres guían):
//     mtb1 Pa' Arriba + Anfiteatro/Zorzal · mtb2 Pa' Arriba + La S ·
//     mtb3 Paseo Metropolitano (tramo JJ/Pirámide) · mtb4 Torre 5.
//  3. Distancias plausibles y dentro del parque (+80 m).
import { readFileSync } from "node:fs";
import { haversineM, type Network, type NetEdge } from "../src/lib/routing";
import { RUTAS_TRAZADOS, BAJADAS_CONTROL_30 } from "../src/lib/rutasTrazados";
import { SEND_PEATONALES_BLOCK, SENDEROS } from "../src/lib/senderos";
import { PARK_POLYGON } from "../src/lib/park";

let fails = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fails++;
};

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: [number, number][]; edges: NetEdge[];
};
const net: Pick<Network, "nodes" | "edges" | "names" | "classes"> = raw;

/** Nombre/clase de la arista más cercana al punto (midpoint de cada seg). */
function edgeNameOf(p: { lat: number; lon: number }): { name: string; cls: string } {
  let bn = "(sin nombre)", bc = "?", bd = Infinity;
  const kx = Math.cos((p.lat * Math.PI) / 180);
  const px = p.lon * kx, py = p.lat;
  for (const [a, b, ci, ni] of raw.edges) {
    const na = raw.nodes[a], nb = raw.nodes[b];
    const ax = na[1] * kx, ay = na[0], bx = nb[1] * kx, by = nb[0];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const dM = Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320;
    if (dM < bd) { bd = dM; bn = raw.names[ni] || "(sin nombre)"; bc = raw.classes[ci]; }
  }
  return { name: bn, cls: bc };
}

const poly = PARK_POLYGON.map((p) => [p.lat, p.lon] as [number, number]);
function inPoly(lat: number, lon: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
    if (yi > lat !== yj > lat && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distToPolyM(lat: number, lon: number): number {
  const kx = Math.cos((lat * Math.PI) / 180);
  const px = lon * kx, py = lat;
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][1] * kx, ay = poly[j][0], bx = poly[i][1] * kx, by = poly[i][0];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320);
  }
  return best;
}
const TOL_M = 80;
const dentroParque = (lat: number, lon: number) => inPoly(lat, lon) || distToPolyM(lat, lon) <= TOL_M;

// 1) senderos peatonales: cero uso en TODAS las rutas (9 + 3 bajadas 30)
const traces: Record<string, { coords: [number, number][]; distKm: number }> = { ...RUTAS_TRAZADOS };
for (const b of BAJADAS_CONTROL_30) traces[b.id] = { coords: b.coords, distKm: b.distKm };
const ids = Object.keys(traces);
ok(ids.length === 12, `12 trazados precomputados (${ids.length}: 9 rutas + 3 bajadas 30)`);
for (const id of ids) {
  const t = traces[id];
  const uso = new Map<string, number>();
  for (let i = 1; i < t.coords.length; i++) {
    const mid = { lat: (t.coords[i - 1][0] + t.coords[i][0]) / 2, lon: (t.coords[i - 1][1] + t.coords[i][1]) / 2 };
    const ne = edgeNameOf(mid);
    if (SEND_PEATONALES_BLOCK.some((re) => re.test(ne.name))) {
      uso.set(ne.name, (uso.get(ne.name) ?? 0) + haversineM({ lat: t.coords[i - 1][0], lon: t.coords[i - 1][1] }, { lat: t.coords[i][0], lon: t.coords[i][1] }));
    }
  }
  ok(uso.size === 0, `${id}: sin aristas de los 8 senderos peatonales${uso.size ? ` → ${[...uso.entries()].map(([n, m]) => `${n}=${Math.round(m)}m`).join(", ")}` : ""}`);
}

// 2) nombres guían: cada MTB usa sus senderos ciclistas
const hasName = (id: string, re: RegExp): { ok: boolean; metros: number } => {
  const t = RUTAS_TRAZADOS[id];
  let m = 0;
  for (let i = 1; i < t.coords.length; i++) {
    const mid = { lat: (t.coords[i - 1][0] + t.coords[i][0]) / 2, lon: (t.coords[i - 1][1] + t.coords[i][1]) / 2 };
    const ne = edgeNameOf(mid);
    if (re.test(ne.name)) m += haversineM({ lat: t.coords[i - 1][0], lon: t.coords[i - 1][1] }, { lat: t.coords[i][0], lon: t.coords[i][1] });
  }
  return { ok: m > 100, metros: m };
};
ok(hasName("mtb1", /Pa' Arriba/).ok, `mtb1 sube por Pa' Arriba (${hasName("mtb1", /Pa' Arriba/).metros.toFixed(0)} m)`);
ok(hasName("mtb1", /Anfiteatro|Zorzal/).ok, `mtb1 baja por Anfiteatro/Zorzal (${hasName("mtb1", /Anfiteatro|Zorzal/).metros.toFixed(0)} m)`);
ok(hasName("mtb2", /Pa' Arriba/).ok, `mtb2 sube por Pa' Arriba (${hasName("mtb2", /Pa' Arriba/).metros.toFixed(0)} m)`);
ok(hasName("mtb2", /La S/).ok, `mtb2 baja por La S (${hasName("mtb2", /La S/).metros.toFixed(0)} m)`);
ok(hasName("mtb3", /Tramo Jardín Japonés \/ Pirámide/).ok, `mtb3 va por el tramo JJ/Pirámide del Paseo Metropolitano (${hasName("mtb3", /Tramo Jardín Japonés \/ Pirámide/).metros.toFixed(0)} m)`);
ok(hasName("mtb4", /Torre 5/).ok, `mtb4 usa el sector Torre 5 (${hasName("mtb4", /Torre 5/).metros.toFixed(0)} m)`);

// 3) distancias plausibles + dentro del parque (+80 m de tolerancia)
const ESPERADO: Record<string, [number, number]> = {
  mtb1: [5.5, 7.5], mtb2: [5.5, 7.5], mtb3: [5.5, 7.5], mtb4: [5.0, 7.0],
  r1: [3.0, 3.7], r2: [4.8, 5.4], r3: [4.3, 4.9], r4: [2.9, 3.4], r5: [18.0, 19.5],
};
for (const [id, [lo, hi]] of Object.entries(ESPERADO)) {
  const km = RUTAS_TRAZADOS[id].distKm;
  ok(km >= lo && km <= hi, `${id}: ${km} km en rango [${lo}, ${hi}]`);
}
for (const id of ids) {
  const t = traces[id];
  let fuera = 0, total = 0;
  for (let i = 1; i < t.coords.length; i++) {
    const mid = { lat: (t.coords[i - 1][0] + t.coords[i][0]) / 2, lon: (t.coords[i - 1][1] + t.coords[i][1]) / 2 };
    const seg = haversineM({ lat: t.coords[i - 1][0], lon: t.coords[i - 1][1] }, { lat: t.coords[i][0], lon: t.coords[i][1] });
    total += seg;
    if (!dentroParque(mid.lat, mid.lon)) fuera += seg;
  }
  ok(fuera / total < 0.02, `${id}: ${(100 - (fuera / total) * 100).toFixed(1)}% del trazado dentro del parque (+${TOL_M} m)`);
}

// 4) los 8 peatonales del cliente existen como senderos tipo "peatonal"
const PEAT = ["zorro-vidal", "ermitano", "anahuac", "mapuche", "gabriela-mistral", "boy-scout", "atacameno", "el-carbon"];
for (const pid of PEAT) {
  const s = SENDEROS.find((x) => x.id === pid)!;
  ok(!!s && s.tipo === "peatonal", `sendero ${s.nombre} (${s.largoOficialM} m) clasificado peatonal`);
}
ok(SENDEROS.filter((s) => s.tipo === "peatonal").length === 8, `8 senderos peatonales en total (${SENDEROS.filter((s) => s.tipo === "peatonal").length})`);

console.log(fails ? `\n${fails} FALLAS` : "\nTODO OK");
process.exit(fails ? 1 : 0);
