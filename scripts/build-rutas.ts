// ============================================================
// Precompute de las 6 rutas predefinidas del GPX de arquitectura
// (Capa 2: Pavimento + MTB) usando el MISMO motor A* que la app
// (src/lib/routing.ts sobre public/red-ciclista.json).
// Salida: src/lib/rutasTrazados.ts (trazado estático, offline).
//
// Ejecutar: node_modules/.bin/tsx scripts/build-rutas.ts
// ============================================================

import { readFileSync, writeFileSync } from "node:fs";
import { findRoute, haversineM, type Network, type NetNode, type NetEdge, type LatLng } from "../src/lib/routing";
import { PARK_POLYGON } from "../src/lib/park";
import { pointInPolygon } from "../src/lib/geo";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[];
  names: string[];
  nodes: NetNode[];
  edges: NetEdge[];
  cicloviaPolylines: number[][];
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
  const w = dist * p;
  const br = (Math.atan2(
    Math.sin(((pb.lon - pa.lon) * Math.PI) / 180) * Math.cos((pb.lat * Math.PI) / 180),
    Math.cos((pa.lat * Math.PI) / 180) * Math.sin((pb.lat * Math.PI) / 180) -
      Math.sin((pa.lat * Math.PI) / 180) * Math.cos((pb.lat * Math.PI) / 180) * Math.cos(((pb.lon - pa.lon) * Math.PI) / 180)
  ) / Math.PI) * 180 * (1 / 1); // bearing simple (no crítico aquí)
  const bearingDeg = ((Math.atan2(
    ((pb.lon - pa.lon) * Math.PI) / 180 * Math.cos((pb.lat * Math.PI) / 180),
    (pb.lat - pa.lat) * (Math.PI / 180)
  ) * 180) / Math.PI + 360) % 360;
  void br;
  adj[a].push({ to: b, w, dist, cls, name, ciclovia: ciclo === 1, bearing: bearingDeg });
  adj[b].push({ to: a, w, dist, cls, name, ciclovia: ciclo === 1, bearing: (bearingDeg + 180) % 360 });
}
const net: Network = { ...raw, adj };

// --- puntos clave (posiciones verificadas del proyecto) ---
const P = {
  pioNono: { lat: -33.430691, lon: -70.63592 },
  pdvNorte: { lat: -33.411769, lon: -70.607988 },
  laPiramide: { lat: -33.38642, lon: -70.60179 },
  zapadores: { lat: -33.399921, lon: -70.620406 },
  plazaMexico: { lat: -33.4234, lon: -70.6327 },
  anfiteatro: { lat: -33.40401, lon: -70.60956 },
  // La Rotonda según GPX del cliente (referencial, snap a grafo ~29 m)
  laRotonda: { lat: -33.409, lon: -70.6215 },
  cruceTorre5: { lat: -33.4232, lon: -70.6315 },
};

/** Ruta por tramos con puntos de paso (waypoints del GPX). */
function routeWithVias(from: LatLng, vias: LatLng[], to: LatLng): LatLng[] | null {
  const stops = [from, ...vias, to];
  const out: LatLng[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const r = findRoute(net, stops[i], stops[i + 1]);
    if (!r || r.coords.length < 2) {
      console.error(`✗ tramo ${i} sin ruta (${stops[i].lat},${stops[i].lon} → ${stops[i + 1].lat},${stops[i + 1].lon})`);
      return null;
    }
    for (const c of r.coords) {
      const last = out[out.length - 1];
      if (!last || haversineM(last, c) > 1) out.push(c); // dedupe <1 m
    }
  }
  return out;
}

function distKm(coords: LatLng[]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) d += haversineM(coords[i - 1], coords[i]);
  return d / 1000;
}

// Waypoints de la arquitectura GPX del cliente (referenciales):
const VIA = {
  // Plaza Tupahue (Nodo Central) del GPX, sobre Av. Pedro Bannen
  nodoTupahue: { lat: -33.4215, lon: -70.6288 },
  // El Ermitaño: enlace de la ladera norte = nodo Acceso Paseo Metropolitano (OSM)
  elErmitano: { lat: -33.412407, lon: -70.623052 },
  // Tupahue (cruce Casa Anáhuac, convergencia real de caminos)
  tupahue: { lat: -33.417135, lon: -70.623511 },
  // La Rotonda según GPX (referencial, dentro del parque)
  laRotonda: P.laRotonda,
};

const defs: Record<string, LatLng[] | null> = {
  // R1 Pavimento: PdV Norte → Tupahue → Plaza México (GPX pasa por su nodo Tupahue)
  r1: routeWithVias(P.pdvNorte, [VIA.nodoTupahue], P.plazaMexico),
  // R2 Pavimento: Pío Nono → Zoológico → Mirador Bellavista → Cumbre (Plaza México)
  r2: routeWithVias(P.pioNono, [], P.plazaMexico),
  // R3 Pavimento: Zapadores → El Ermitaño → Tupahue → bajada PdV Norte
  r3: routeWithVias(P.zapadores, [VIA.elErmitano, VIA.tupahue], P.pdvNorte),
  // R4 Pavimento: La Pirámide → Anfiteatro (corredor directo real del sector
  // nororiente; el desvío por la La Rotonda-GPX crea un circuito irreal de 6.9 km
  // por la deriva oeste del GPX referencial)
  r4: routeWithVias(P.laPiramide, [], P.anfiteatro),
  // MTB 1: loop La Rotonda → Pa' Arriba → Anfiteatro → descenso Zorzal → La Rotonda
  // (subida con waypoint GPX Pa' Arriba; bajada directa: A* elige el corredor de vuelta)
  mtb1: (() => {
    const up = routeWithVias(P.laRotonda, [{ lat: -33.4112, lon: -70.623 }], P.anfiteatro);
    const down = routeWithVias(P.anfiteatro, [], P.laRotonda);
    if (!up || !down) return null;
    return [...up, ...down.slice(1)];
  })(),
  // MTB 2: Enduro Cumbre (Torre 5) → Sendero 4½ → Acceso PdV Norte
  mtb2: routeWithVias(P.cruceTorre5, [
    { lat: -33.422, lon: -70.6275 },
    { lat: -33.421, lon: -70.6235 },
    { lat: -33.4198, lon: -70.6195 },
  ], P.pdvNorte),
};

// --- diagnóstico: distancia de cada tramo a puntos que DEBEN tocar ---
const probes: Record<string, LatLng> = {
  anahuacTupahue: { lat: -33.417135, lon: -70.623511 },
  zoo: { lat: -33.429636, lon: -70.633963 },
  bellavista: { lat: -33.4285, lon: -70.6345 },
  paseoMet: { lat: -33.412407, lon: -70.623052 },
  laRotonda: P.laRotonda,
  nodoTupahue: { lat: -33.4215, lon: -70.6288 },
  antilen: { lat: -33.409051, lon: -70.61374 },
  mapulemu: { lat: -33.4195, lon: -70.6218 },
};
const minDist = (route: LatLng[], p: LatLng) => Math.min(...route.map((c) => haversineM(c, p)));

for (const [id, coords] of Object.entries(defs)) {
  if (!coords) {
    console.error(`✗ ${id}: sin trazado`);
    continue;
  }
  const probe = Object.entries(probes)
    .map(([k, p]) => `${k}:${Math.round(minDist(coords, p))}m`)
    .join(" ");
  console.log(`✓ ${id}: ${coords.length} pts · ${distKm(coords).toFixed(2)} km · cerca de → ${probe}`);
  // muestra de puntos cada ~15% del recorrido (para verificar corredor)
  const picks = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, coords.length - 1].map((f) => coords[Math.min(coords.length - 1, Math.round(f * (coords.length - 1)))])
    .map((c) => `(${c.lat.toFixed(4)},${c.lon.toFixed(4)})`)
    .join(" ");
  console.log(`   muestras: ${picks}`);
}

// --- verificación de puntos GPX referencias contra el polígono ---
console.log("\n-- puntos GPX vs polígono del parque --");
for (const [name, p] of Object.entries({
  nodoTupahue: { lat: -33.4215, lon: -70.6288 },
  elErmitanoGPX: { lat: -33.4115, lon: -70.635 },
  laRotondaGPX: { lat: -33.409, lon: -70.6215 },
  mapulemuGPX: { lat: -33.4195, lon: -70.6218 },
  bellavistaGPX: { lat: -33.4285, lon: -70.6345 },
  miradorHundidoGPX: { lat: -33.4165, lon: -70.6295 },
  precauCumbreGPX: { lat: -33.4248, lon: -70.6331 },
  torre5GPX: { lat: -33.4232, lon: -70.6315 },
  control30GPX: { lat: -33.4202, lon: -70.625 },
  controlQrGPX: { lat: -33.4093, lon: -70.6213 },
  soportePdvGPX: { lat: -33.4184, lon: -70.6166 },
  soporteTupahueGPX: { lat: -33.4213, lon: -70.6285 },
  soportePioNonoGPX: { lat: -33.4333, lon: -70.6351 },
  corteTupahueGPX: { lat: -33.4218, lon: -70.6292 },
} as Record<string, LatLng>)) {
  console.log(`${pointInPolygon(p, PARK_POLYGON) ? "dentro" : "FUERA"}  ${name}`);
}

// --- emisión del TS ---
const out: Record<string, { coords: [number, number][]; distKm: number }> = {};
for (const [id, coords] of Object.entries(defs)) {
  if (!coords) continue;
  out[id] = { coords: coords.map((c) => [Number(c.lat.toFixed(6)), Number(c.lon.toFixed(6))]), distKm: Number(distKm(coords).toFixed(2)) };
}

const ts = `// ============================================================
// GENERADO por scripts/build-rutas.ts - NO editar a mano.
// Trazados reales (grafo OSM propio) para las 6 rutas predefinidas
// de la arquitectura GPX del cliente (Capa 2: Pavimento + MTB).
// coords = [lat, lon].
// ============================================================

export type RutaTrazado = { coords: [number, number][]; distKm: number };

export const RUTAS_TRAZADOS: Record<string, RutaTrazado> = ${JSON.stringify(out, null, 2)};
`;
writeFileSync("src/lib/rutasTrazados.ts", ts);
console.log("\n✎ src/lib/rutasTrazados.ts escrito");
