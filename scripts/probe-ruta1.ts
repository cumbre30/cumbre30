// ============================================================
// Prueba de variantes para r1 (Ruta 1 · Clásica Cumbre por PdV)
// para que pase por las 3 zonas de riesgo: Salida PDV, Jardín
// Japonés y Curva Anáhuac. NO escribe rutasTrazados.ts: sólo
// informa corredores, distancias a zonas y trazado repetido.
// Ejecutar: node_modules/.bin/tsx scripts/probe-ruta1.ts
// ============================================================
import { readFileSync } from "node:fs";
import { findRoute, haversineM, type FindRouteOpts, type Network, type NetNode, type NetEdge, type LatLng } from "../src/lib/routing";
import { PARK_POLYGON, RISK_ZONES } from "../src/lib/park";
import { SEND_PEATONALES_BLOCK } from "../src/lib/senderos";
import { aplicarPuentes } from "../src/lib/puentesGrafo";
import { crearDirOk } from "../src/lib/reglasParque";

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
for (const [a, b, clsIdx, nameIdx] of raw.edges) {
  const cls = raw.classes[clsIdx] ?? "residential";
  const name = raw.names[nameIdx] ?? "";
  const p = PENALTY[cls] ?? 1;
  const pa = { lat: raw.nodes[a][0], lon: raw.nodes[a][1] };
  const pb = { lat: raw.nodes[b][0], lon: raw.nodes[b][1] };
  const dist = haversineM(pa, pb);
  adj[a].push({ to: b, w: dist * p, dist, cls, name, ciclovia: false, bearing: 0 });
  adj[b].push({ to: a, w: dist * p, dist, cls, name, ciclovia: false, bearing: 0 });
}
const net: Network = { ...raw, adj } as Network;
aplicarPuentes(net);

const CLASES_PAVIMENTO = new Set([
  "living_street", "residential", "service", "unclassified",
  "tertiary", "tertiary_link", "secondary", "secondary_link",
  "primary", "primary_link",
]);
const NOMBRES_PERMITIDOS_PAV = [
  /^Paseo Metropolitano - Tramo /, /^Paseo Metropolitano$/,
  /^Paseo Metropolitano - Sendero Bellavista/, /^Avenida /, /^Camino /,
  /^Antilen$/, /^Rotonda /,
];
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
    const ax = poly[j][1] * kx, ay = poly[j][0];
    const bx = poly[i][1] * kx, by = poly[i][0];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320);
  }
  return best;
}
const nodeOk = (lat: number, lon: number) => inPoly(lat, lon) || distToPolyM(lat, lon) <= 80;
const OPTS: FindRouteOpts = {
  allowedCls: CLASES_PAVIMENTO,
  nameAllow: NOMBRES_PERMITIDOS_PAV,
  nameBlock: [/^Sendero Ciclista /, /^Avenida Carlos Reed/, /^Carlos Reed/, ...SEND_PEATONALES_BLOCK],
  edgeDirOk: crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: false }),
  nodeOk,
};

function nodoExacto(p: LatLng): number {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < net.nodes.length; i++) {
    const d = haversineM(p, { lat: net.nodes[i][0], lon: net.nodes[i][1] });
    if (d < bestD) { bestD = d; best = i; if (d === 0) break; }
  }
  return best;
}

function rutaConVias(from: LatLng, vias: LatLng[], to: LatLng): LatLng[] | null {
  const stops = [from, ...vias, to];
  const out: LatLng[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const r = findRoute(net, stops[i], stops[i + 1], { ...OPTS, targetNode: nodoExacto(stops[i + 1]) });
    if (!r || r.coords.length < 2 || r.distanceM < 1) {
      console.error(`  ✗ tramo ${i} sin ruta`);
      return null;
    }
    const nm = new Map<string, number>();
    for (const n of r.segNames) nm.set(n, (nm.get(n) ?? 0) + 1);
    const top = [...nm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${n}×${c}`).join(" · ");
    console.log(`  t${i}: ${(r.distanceM / 1000).toFixed(2)} km ← ${top}`);
    for (const c of r.coords) {
      const last = out[out.length - 1];
      if (!last || haversineM(last, c) > 1) out.push(c);
    }
  }
  return out;
}

function distKm(cs: LatLng[]): number {
  let d = 0;
  for (let i = 1; i < cs.length; i++) d += haversineM(cs[i - 1], cs[i]);
  return d / 1000;
}

const ZONAS = ["salida-pv", "jardin-japones", "anahuac"];
function minZona(cs: LatLng[], id: string): number {
  const z = RISK_ZONES.find((x) => x.id === id)!;
  return Math.min(...cs.map((c) => haversineM(c, z.position)));
}
/** nombre de vía más cercana a un punto (para leer la forma del trazado) */
function viaDe(p: LatLng): string {
  let bn = "?", bd = Infinity;
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
    if (dM < bd) { bd = dM; bn = raw.names[ni] || "(sin nombre)"; }
  }
  return bn;
}
function forma(cs: LatLng[]): string {
  const picks = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((f) => cs[Math.round(f * (cs.length - 1))]);
  return picks.map((c, i) => `${(i * 10).toFixed(0)}%:${viaDe(c).replace("Avenida ", "Av.")}`).join(" · ");
}
/** metros de calzada recorridos más de una vez: muestreo a 5 m; un punto
 *  cuenta repetido si existe otro muestreo a <4 m con índice lejano (>25
 *  muestras ≈ >125 m de distancia en la ruta) — descarta curvas/switchbacks. */
function repetido(cs: LatLng[]): number {
  const samples: { lat: number; lon: number; idx: number }[] = [];
  for (let i = 1; i < cs.length; i++) {
    const seg = haversineM(cs[i - 1], cs[i]);
    const n = Math.max(1, Math.round(seg / 5));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      samples.push({ lat: cs[i - 1].lat + (cs[i].lat - cs[i - 1].lat) * t, lon: cs[i - 1].lon + (cs[i].lon - cs[i - 1].lon) * t, idx: i });
    }
  }
  const cell = (s: { lat: number; lon: number }) => `${Math.round(s.lat * 200000)}:${Math.round(s.lon * 200000)}`;
  const grid = new Map<string, typeof samples>();
  for (const s of samples) {
    const k = cell(s);
    const arr = grid.get(k) ?? [];
    arr.push(s);
    grid.set(k, arr);
  }
  const vecinos = (s: { lat: number; lon: number; idx: number }) => {
    const la = Math.round(s.lat * 200000), lo = Math.round(s.lon * 200000);
    for (let da = -1; da <= 1; da++) for (let doo = -1; doo <= 1; doo++) {
      const arr = grid.get(`${la + da}:${lo + doo}`);
      if (!arr) continue;
      for (const o of arr) {
        if (Math.abs(o.idx - s.idx) > 25 && haversineM(s, o) < 4) return true;
      }
    }
    return false;
  };
  let rep = 0;
  for (const s of samples) if (vecinos(s)) rep += 5;
  return rep;
}

const P = {
  pdvNorte: { lat: -33.415479, lon: -70.617402 },
  plazaMexico: { lat: -33.4234, lon: -70.6327 },
};
const VIA = {
  curvaAnahuac: { lat: -33.41689, lon: -70.623351 },
  nodoTupahue: { lat: -33.4215, lon: -70.6288 },
  abateMolinaJJ: { lat: -33.413715, lon: -70.614624 },
  martner: { lat: -33.41272, lon: -70.61862 },
  laMontana: { lat: -33.40501, lon: -70.61772 },
};

const variantes: { nombre: string; vias: LatLng[] }[] = [
  { nombre: "ACTUAL  [curvaAnahuac, nodoTupahue]", vias: [VIA.curvaAnahuac, VIA.nodoTupahue] },
  { nombre: "A       [abateMolinaJJ, curvaAnahuac, nodoTupahue]", vias: [VIA.abateMolinaJJ, VIA.curvaAnahuac, VIA.nodoTupahue] },
  { nombre: "B       [abateMolinaJJ, martner, curvaAnahuac, nodoTupahue]", vias: [VIA.abateMolinaJJ, VIA.martner, VIA.curvaAnahuac, VIA.nodoTupahue] },
];

for (const v of variantes) {
  console.log(`\n=== ${v.nombre} ===`);
  const cs = rutaConVias(P.pdvNorte, v.vias, P.plazaMexico);
  if (!cs) continue;
  const zonas = ZONAS.map((id) => `${id}:${Math.round(minZona(cs, id))}m`).join(" ");
  console.log(`  TOTAL ${distKm(cs).toFixed(2)} km · ${cs.length} pts · repetido≈${Math.round(repetido(cs))} m`);
  console.log(`  zonas → ${zonas}`);
  console.log(`  forma → ${forma(cs)}`);
}
