// ============================================================
// Precompute de las 9 rutas predefinidas del mapa general
// (Capa 2: Pavimento + MTB) usando el MISMO motor A* que la app
// (src/lib/routing.ts sobre public/red-ciclista.json).
//
// Reglas del cliente (2026-11):
//  · TODAS las rutas dentro del polígono del parque (+80 m de
//    tolerancia en los accesos, que están sobre el borde).
//  · Pavimento (r1-r5): sin senderos MTB («Sendero Ciclista *»)
//    ni sendas peatonales (path/footway/track/pedestrian) — solo
//    los caminos amplios del parque (Tramos del Paseo
//    Metropolitana, Avenidas, Caminos, Antilén, Rotonda).
//  · MTB (mtb1-mtb4): sin restricción de vía (los senderos
//    ciclistas son su raison d'être) pero también dentro del parque.
//
// Salida: src/lib/rutasTrazados.ts (trazado estático, offline).
// Ejecutar: node_modules/.bin/tsx scripts/build-rutas.ts
// ============================================================

import { readFileSync, writeFileSync } from "node:fs";
import { findRoute, haversineM, type FindRouteOpts, type Network, type NetNode, type NetEdge, type LatLng } from "../src/lib/routing";
import { PARK_POLYGON } from "../src/lib/park";
import { SEND_PEATONALES_BLOCK } from "../src/lib/senderos";
import { aplicarPuentes } from "../src/lib/puentesGrafo";
import { crearDirOk, PUENTE_TUPAHUE_CUMBRE } from "../src/lib/reglasParque";

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
  const bearingDeg = ((Math.atan2(
    ((pb.lon - pa.lon) * Math.PI) / 180 * Math.cos((pb.lat * Math.PI) / 180),
    (pb.lat - pa.lat) * (Math.PI / 180)
  ) * 180) / Math.PI + 360) % 360;
  adj[a].push({ to: b, w, dist, cls, name, ciclovia: ciclo === 1, bearing: bearingDeg });
  adj[b].push({ to: a, w, dist, cls, name, ciclovia: ciclo === 1, bearing: (bearingDeg + 180) % 360 });
}
const net: Network = { ...raw, adj };
// puentes del grafo: islas OSM desconectadas (explanada PdV Norte)
aplicarPuentes(net);

// Reglas direccionales del cliente (2026-11-12): PÍO NONO SÓLO SUBIDA —
// la ruta en reversa (bajada por el acceso Pío Nono y su corredor de
// ascenso por Av. Alberto Mackenna) queda bloqueada también al
// precomputar los trazados. El corte horario cumbre NO aplica aquí: los
// trazados son geometría de horario normal (la navegación en vivo lo
// recorta con vuelta en U, ver routingService).

// --- restricciones de vía ---
const CLASES_PAVIMENTO = new Set([
  "living_street", "residential", "service", "unclassified",
  "tertiary", "tertiary_link", "secondary", "secondary_link",
  "primary", "primary_link",
]);
// Caminos amplios del parque que el OSM local etiqueta como peatonales/vereda
const NOMBRES_PERMITIDOS_PAV = [
  /^Paseo Metropolitano - Tramo /,   // tramos del anillo (camino de tierra amplio)
  /^Paseo Metropolitano$/,           // anillo histórico
  /^Paseo Metropolitano - Sendero Bellavista/, // rampa oeste (arquitectura R2)
  /^Avenida /,                        // avenidas del parque (algunas quedaron como pedestrian)
  /^Camino /,
  /^Antilen$/,
  /^Rotonda /,
];
const OPTS_PAV: FindRouteOpts = {
  allowedCls: CLASES_PAVIMENTO,
  nameAllow: NOMBRES_PERMITIDOS_PAV,
  nameBlock: [
    /^Sendero Ciclista /, // los senderos MTB nunca en pavimento
    // Carlos Reed (cliente 2026-11-12): tramos del Paseo Metropolitano
    // aún no implementados, fuera del trazado pavimento
    /^Avenida Carlos Reed/,
    /^Carlos Reed/,
    // Senderos PEATONALES fuera de TODAS las rutas (cliente 2026-11-13):
    // Zorro Vidal, Mapuche, Boy Scout, Anáhuac, Gabriela Mistral,
    // Ermitaño, Atacameño, El Carbón — capa informativa, no ciclista.
    ...SEND_PEATONALES_BLOCK,
  ],
  // Pío Nono sólo subida (24/7)
  edgeDirOk: crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: false }),
};
// MTB: senderos ciclistas SÍ, pero los 8 senderos PEATONALES del
// cliente (2026-11-13) quedan bloqueados igual — la auditoría detectó
// que mtb1/mtb2 cruzaban Boy Scout y Atacameño y mtb4 tocaba Boy Scout.
const OPTS_MTB: FindRouteOpts = { nameBlock: [...SEND_PEATONALES_BLOCK] };

// --- dentro del parque con tolerancia 80 m (los accesos quedan sobre el borde) ---
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
  // distancia a las aristas del polígono (equirectangular local, suficiente)
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
const TOL_M = 80;
const nodeOk = (lat: number, lon: number) => inPoly(lat, lon) || distToPolyM(lat, lon) <= TOL_M;
const OPTS_PAV_PARK: FindRouteOpts = { ...OPTS_PAV, nodeOk };
const OPTS_MTB_PARK: FindRouteOpts = { ...OPTS_MTB, nodeOk };
// Bajadas del control 30 km/h (cliente 2026-11-13): geometría de la vía
// SIN reglas direccionales — la bajada Plaza México → Pío Nono recorre el
// corredor de ascenso Pío Nono (sólo subida) y aquí se DIBUJA, no se navega.
const OPTS_PAV_PARK_LIBRE: FindRouteOpts = {
  allowedCls: CLASES_PAVIMENTO,
  nameAllow: NOMBRES_PERMITIDOS_PAV,
  nameBlock: [...(OPTS_PAV.nameBlock ?? [])],
  nodeOk,
};

// --- puntos clave (posiciones verificadas del proyecto / grafo real) ---
const P = {
  // Punto marcado por el cliente (2026-11-13, captura de navegación): la
  // esquina de entrada Pío Nono × Av. Alberto Mackenna (-33.4306903,
  // -70.6362729), junto al 450 de Pío Nono; nodo del grafo n5334 a 0 m.
  pioNono: { lat: -33.4306903, lon: -70.6362729 },
  // Acceso Pedro de Valdivia Norte: coordenada exacta del cliente
  // (2026-11-12), portería en el cruce Av. El Cerro × Av. PdV Norte
  // (GATES pv-norte). Los trazados r1/r3/r5 nacen/terminan aquí.
  pdvNorte: { lat: -33.415479, lon: -70.617402 },
  // Punto marcado por el cliente (2026-11-13, captura de navegación) =
  // POI OSM «Acceso La Pirámide ParqueMet» (node 12223582943) en Av.
  // Manuel Zañartu; nodo del grafo n50353 a 5 m sobre la vía «Acceso
  // Parque Metropolitano sector La Pirámide».
  laPiramide: { lat: -33.3882651, lon: -70.6015948 },
  zapadores: { lat: -33.399921, lon: -70.620406 },
  plazaMexico: { lat: -33.4234, lon: -70.6327 },
  anfiteatro: { lat: -33.40401, lon: -70.60956 },
  // Acceso Paseo Metropolitano (en el anillo, ladera poniente)
  accesoPaseoMet: { lat: -33.412407, lon: -70.623052 },
};

/** Nodo EXACTO más cercano a `p` (barrido completo, sin corte temprano).
 *  snapInfo corta en el primer nodo a <12 m por índice y en rejillas
 *  densas puede devolver un nodo a 11 m cuando el punto pedido ES un nodo
 *  del grafo (via curva Anáhuac: devolvía n3343 a 11,3 m en vez de n3346
 *  a 0 m) — así el tramo anterior terminaba pasado el via y la unión
 *  dibujaba el tramo dos veces («trazado hacia atrás», cliente 2026-11-12). */
function nodoExacto(net: Network, p: LatLng): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < net.nodes.length; i++) {
    const d = haversineM(p, { lat: net.nodes[i][0], lon: net.nodes[i][1] });
    if (d < bestD) {
      bestD = d;
      best = i;
      if (d === 0) break;
    }
  }
  return best;
}

/** Ruta por tramos con puntos de paso (anclados a corredores reales del grafo). */
function routeWithVias(id: string, from: LatLng, vias: LatLng[], to: LatLng, opts: FindRouteOpts): LatLng[] | null {
  const stops = [from, ...vias, to];
  const out: LatLng[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    // anclaje EXACTO del destino del tramo: los tramos consecutivos
    // comparten el mismo nodo y la unión no repite ni salta tramos
    const r = findRoute(net, stops[i], stops[i + 1], { ...opts, targetNode: nodoExacto(net, stops[i + 1]) });
    if (!r || r.coords.length < 2 || r.distanceM < 1) {
      console.error(`✗ ${id} tramo ${i} sin ruta (${stops[i].lat},${stops[i].lon} → ${stops[i + 1].lat},${stops[i + 1].lon}) dist=${r?.distanceM ?? "null"}`);
      return null;
    }
    // resumen de corredores del tramo (para validar contra lo esperado)
    const nm = new Map<string, number>();
    for (const n of r.segNames) nm.set(n, (nm.get(n) ?? 0) + 1);
    const top = [...nm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${n}×${c}`).join(" · ");
    console.log(`   ${id} t${i}: ${(r.distanceM / 1000).toFixed(2)} km ← ${top}`);
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

// --- waypoints anclados a corredores reales (muestreo del grafo) ---
const VIA = {
  // Piscina Antilén (camino residential)
  antilen: { lat: -33.40972, lon: -70.61345 },
  // Camino Carlos Martner (Antilén ↔ Tupahue, residential)
  martner: { lat: -33.41272, lon: -70.61862 },
  // Plaza Tupahue (Nodo Central del GPX, sobre Av. Pedro Bannen)
  nodoTupahue: { lat: -33.4215, lon: -70.6288 },
  // Curva Casa Anáhuac SOBRE Av. Pedro Bannen (nodo n3346 del grafo, donde
  // nace el ramal interno a la Casa de la Cultura): paso del ciclista por
  // la curva SIN entrar al ramal sin salida — el cliente (2026-11-12):
  // «es un trazado hacia atrás que se debe borrar». El ramal interno
  // «Anáhuac» (living_street) muere en senderos peatonales junto a la
  // Casa de la Cultura, así que ningún trazado ciclista debe usarlo.
  curvaAnahuac: { lat: -33.41689, lon: -70.623351 },
  // Avenida La Montaña (Zapadores ↔ ladera poniente, residential)
  laMontana: { lat: -33.40501, lon: -70.61772 },
  // Av. Abate Molina junto al Jardín Japonés (nodo n30354 del grafo, a
  // 41 m de la zona de riesgo): ancla de la BAJADA de r3 que sigue SIEMPRE
  // por Abate Molina (cliente 2026-11-12: «no debe desviarse a Carlos
  // Martner debe seguir por abate Molina siempre»), pasando por las 2
  // zonas de riesgo del descenso: Jardín Japonés y Salida Pedro de
  // Valdivia. La única arista «Avenida Carlos Martner» que queda en el
  // trazado es la junta de 2 m del cruce La Montaña ∩ Martner ∩ Abate
  // Molina (topología OSM del empalme, invisible en el mapa).
  abateMolinaJJ: { lat: -33.413715, lon: -70.614624 },
  // La Rotonda del circuito (control QR MTB del GPX del cliente, sobre el anillo)
  laRotonda: { lat: -33.4093, lon: -70.6213 },
  // Anillo Paseo Metropolitano (tronco poniente)
  pmTronco: { lat: -33.40786, lon: -70.62169 },
  // Rampa Paseo Met - Bellavista (ascenso poniente, arquitectura R2)
  bellavista: { lat: -33.42733, lon: -70.62875 },
  bellavistaAlto: { lat: -33.42405, lon: -70.62339 },
  // Avenida Alberto Mackenna (base suroeste, residential)
  mackenna: { lat: -33.4193, lon: -70.63671 },
  // Comodoro Arturo Merino Benítez (Bellavista ↔ Tupahue, ladera poniente)
  comodoro: { lat: -33.4228, lon: -70.6229 },
  // Tramo Jardín Japonés / Pirámide (ladera oriente)
  jjNorte: { lat: -33.39771, lon: -70.60556 },
  jjMedio: { lat: -33.40477, lon: -70.60514 },
  jjSur: { lat: -33.4131, lon: -70.61562 },
  // Avenida Claudio Gay (camino de crestería norte: Antilén ↔ Zapadores)
  claudioGay: { lat: -33.402, lon: -70.6084 },
  // Tramo Pedro de Valdivia Norte
  pdvTramo: { lat: -33.41423, lon: -70.61797 },
  // Sendero La Cascada (anillo, sector central)
  laCascada: { lat: -33.4048, lon: -70.61616 },
  // Circuito Los Gemelos: hub en Av. Pablo Neruda + senderos
  hubGemelos: { lat: -33.40501, lon: -70.61071 },
  paArriba: { lat: -33.40275, lon: -70.60949 },
  paArribaAlto: { lat: -33.40042, lon: -70.60964 },
  anfiteatroAlto: { lat: -33.39988, lon: -70.61017 },
  zorzal: { lat: -33.40197, lon: -70.60993 },
  laSAlto: { lat: -33.40073, lon: -70.61031 },
  laSMedio: { lat: -33.40315, lon: -70.61034 },
  laSBajo: { lat: -33.40343, lon: -70.61092 },
  // Sector Torre 5 (ladera nororiente, sobre PdV Norte)
  torre5Top: { lat: -33.40805, lon: -70.60694 },
  torre5Bajo: { lat: -33.4032, lon: -70.60768 },
};

const defs: Record<string, LatLng[] | null> = {
  // R1 Pavimento: PdV Norte (cruce Av. El Cerro × Av. PdV Norte) →
  // (curva Anáhuac por Av. Pedro Bannen, SIN ramal a la Casa de la
  // Cultura) → Plaza México (subida directa, sin Antilén)
  r1: routeWithVias("r1", P.pdvNorte, [VIA.curvaAnahuac, VIA.nodoTupahue], P.plazaMexico, OPTS_PAV_PARK),
  // R2 Pavimento: EL MISMO trazado que la navegación a Plaza México del
  // minimapa (cliente, 2026-11-12): Pío Nono → Av. Alberto Mackenna →
  // puente entre las Bannen paralelas (Tupahue) → Av. Pedro Bannen →
  // Plaza México.
  r2: routeWithVias("r2", P.pioNono, [VIA.mackenna, PUENTE_TUPAHUE_CUMBRE], P.plazaMexico, OPTS_PAV_PARK),
  // R3 Pavimento: Zapadores → Avenida La Montaña → el empalme sigue
  // SIEMPRE por Av. Abate Molina hasta PdV Norte (cliente 2026-11-12:
  // «no debe desviarse a Carlos Martner debe seguir por abate Molina
  // siempre»), pasando por las 2 zonas de riesgo de la bajada: Jardín
  // Japonés (33 m) y Salida Pedro de Valdivia (8 m). Sin puente
  // Mackenna-Bannen ni Gabriela Mistral (fuera del trazado desde el
  // mismo día), sin Plaza México ni Carlos Reed.
  r3: routeWithVias(
    "r3",
    P.zapadores,
    [VIA.laMontana, VIA.abateMolinaJJ],
    P.pdvNorte,
    OPTS_PAV_PARK
  ),
  // R4 Pavimento: La Pirámide → camino de crecería norte (Zañartu ·
  // Claudio Gay) → Av. Pablo Neruda → Anfiteatro (OK para el cliente)
  r4: routeWithVias("r4", P.laPiramide, [VIA.claudioGay], P.anfiteatro, OPTS_PAV_PARK),
  // R5 Pavimento: Vuelta Completa conectando los 4 accesos (Pío Nono
  // sólo subida → puente de Tupahue → Av. Carlos Martner al norte →
  // Zapadores → La Pirámide → cierre por la bajada oriente a PdV Norte).
  // SIN el ramal de la curva Anáhuac (cliente 2026-11-12: «es un trazado
  // hacia atrás que se debe borrar»: la ruta entra al camino interno de
  // la Casa de la Cultura y regresa sobre sí misma; desde el puente la
  // curva no tiene paso continuo hacia el norte, así que la vuelta
  // completa toma directo Av. Carlos Martner). SIN bajada por Pío Nono
  // ni Carlos Reed (borrados por el cliente, 2026-11-12).
  r5: routeWithVias(
    "r5",
    P.pioNono,
    [VIA.mackenna, PUENTE_TUPAHUE_CUMBRE, P.zapadores, VIA.laMontana, P.laPiramide],
    P.pdvNorte,
    OPTS_PAV_PARK
  ),
  // MTB 1: Loop Los Gemelos — La Rotonda → Pa' Arriba → Anfiteatro →
  // bajada Zorzal → La Rotonda (control QR MTB del cliente)
  mtb1: routeWithVias(
    "mtb1",
    VIA.laRotonda,
    [VIA.hubGemelos, VIA.paArriba, VIA.paArribaAlto, VIA.anfiteatroAlto, VIA.zorzal, VIA.hubGemelos],
    VIA.laRotonda,
    OPTS_MTB_PARK
  ),
  // MTB 2: Loop Técnico La S — La Rotonda → Pa' Arriba → La S (descenso) → La Rotonda
  mtb2: routeWithVias(
    "mtb2",
    VIA.laRotonda,
    [VIA.hubGemelos, VIA.paArriba, VIA.paArribaAlto, VIA.laSAlto, VIA.laSMedio, VIA.laSBajo, VIA.hubGemelos],
    VIA.laRotonda,
    OPTS_MTB_PARK
  ),
  // MTB 3: Travesía Paseo Metropolitano (XC/Gravel): acceso poniente →
  // anillo de caminos amplios (La Cascada · Jardín Japonés) → La Pirámide
  mtb3: routeWithVias(
    "mtb3",
    P.accesoPaseoMet,
    [VIA.pmTronco, VIA.laCascada, VIA.jjMedio, VIA.jjNorte],
    P.laPiramide,
    OPTS_MTB_PARK
  ),
  // MTB 4: Enduro Torre 5 - PdV Norte — ascenso por camino (tramo Jardín
  // Japonés) al sector Torre 5, descenso técnico por el sendero Torre 5,
  // cierre en la base PdV Norte
  mtb4: routeWithVias("mtb4", P.pdvNorte, [VIA.jjSur, VIA.torre5Top, VIA.torre5Bajo], P.pdvNorte, OPTS_MTB_PARK),
};

// --- diagnóstico: distancia de cada tramo a puntos que DEBEN tocar ---
const probes: Record<string, LatLng> = {
  anahuacTupahue: { lat: -33.417135, lon: -70.623511 },
  zoo: { lat: -33.4312, lon: -70.6358 },
  bellavista: { lat: -33.4285, lon: -70.6345 },
  accesoPaseoMet: P.accesoPaseoMet,
  hubGemelos: VIA.hubGemelos,
  nodoTupahue: VIA.nodoTupahue,
  antilen: VIA.antilen,
  mapulemu: { lat: -33.4195, lon: -70.6218 },
  zapadores: P.zapadores,
  laPiramideGate: P.laPiramide,
  torre5: VIA.torre5Top,
  laS: VIA.laSMedio,
};
const minDist = (route: LatLng[], p: LatLng) => Math.min(...route.map((c) => haversineM(c, p)));

// verificación adicional: % del trazado dentro del parque y uso de senderos MTB en pavimento
const SENDEROS_MTB = /^Sendero Ciclista /;
function edgeNameOf(p: LatLng): { name: string; cls: string } {
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

for (const [id, coords] of Object.entries(defs)) {
  if (!coords) {
    console.error(`✗ ${id}: sin trazado`);
    continue;
  }
  const probe = Object.entries(probes)
    .map(([k, p]) => `${k}:${Math.round(minDist(coords, p))}m`)
    .join(" ");
  console.log(`✓ ${id}: ${coords.length} pts · ${distKm(coords).toFixed(2)} km`);
  console.log(`   cerca de → ${probe}`);
  // fuera del parque + senderos MTB (solo relevante en pavimento)
  let fueraM = 0, total = 0;
  const malas = new Map<string, number>();
  for (let i = 1; i < coords.length; i++) {
    const seg = haversineM(coords[i - 1], coords[i]);
    total += seg;
    const mid = { lat: (coords[i - 1].lat + coords[i].lat) / 2, lon: (coords[i - 1].lon + coords[i].lon) / 2 };
    if (!inPoly(mid.lat, mid.lon) && distToPolyM(mid.lat, mid.lon) > TOL_M) fueraM += seg;
    const ne = edgeNameOf(mid);
    if (id.startsWith("r") && (SENDEROS_MTB.test(ne.name) || ["path", "footway", "track"].includes(ne.cls))) {
      const key = `${ne.name} · ${ne.cls}`;
      malas.set(key, (malas.get(key) ?? 0) + seg);
    }
  }
  console.log(`   fuera del parque(+${TOL_M}m): ${Math.round((fueraM / total) * 100)}%`);
  if (malas.size) {
    const top = [...malas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(`   ⚠ vías no-pavimento: ${top.map(([n, m]) => `${n}=${Math.round(m)}m`).join(" · ")}`);
  }
  // muestra de puntos cada ~15% del recorrido
  const picks = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, coords.length - 1].map((f) => coords[Math.min(coords.length - 1, Math.round(f * (coords.length - 1)))])
    .map((c) => `(${c.lat.toFixed(4)},${c.lon.toFixed(4)})`)
    .join(" ");
  console.log(`   muestras: ${picks}`);
}

// --- emisión del TS ---
const out: Record<string, { coords: [number, number][]; distKm: number }> = {};
for (const [id, coords] of Object.entries(defs)) {
  if (!coords) continue;
  out[id] = { coords: coords.map((c) => [Number(c.lat.toFixed(6)), Number(c.lon.toFixed(6))]), distKm: Number(distKm(coords).toFixed(2)) };
}

// --- bajadas con control 30 km/h (cliente 2026-11-13): «al marcar pintar
// trazado en rojo y que se vean los 3» — corredores de las 3 bajadas
// principales según los enlaces Google Maps del cliente ---
console.log("\n— bajadas control 30 km/h —");
const bajadasDefs: { id: string; nombre: string; from: LatLng; to: LatLng }[] = [
  {
    id: "b30-piramide",
    nombre: "Cima Cerro Chacarillas → Acceso La Pirámide",
    from: { lat: -33.409051, lon: -70.61374 }, // Piscina Antilén (cima Chacarillas)
    to: P.laPiramide,
  },
  {
    id: "b30-pdv",
    nombre: "Plaza Antilén → Acceso Pedro de Valdivia Norte",
    from: { lat: -33.40758, lon: -70.61121 }, // Plaza Antilén
    to: P.pdvNorte,
  },
  {
    id: "b30-pionono",
    nombre: "Plaza México → Acceso Pío Nono",
    from: P.plazaMexico,
    to: P.pioNono,
  },
];
const bajadasOut: { id: string; nombre: string; coords: [number, number][]; distKm: number }[] = [];
for (const b of bajadasDefs) {
  const r = findRoute(net, b.from, b.to, { ...OPTS_PAV_PARK_LIBRE, targetNode: nodoExacto(net, b.to) });
  if (!r || r.coords.length < 2) {
    console.error(`✗ bajada ${b.id} sin ruta`);
    continue;
  }
  const coords = r.coords.map((c) => [Number(c.lat.toFixed(6)), Number(c.lon.toFixed(6))] as [number, number]);
  bajadasOut.push({ id: b.id, nombre: b.nombre, coords, distKm: Number(distKm(r.coords).toFixed(2)) });
  console.log(`✓ bajada ${b.id}: ${coords.length} pts · ${bajadasOut[bajadasOut.length - 1].distKm.toFixed(2)} km`);
}

const ts = `// ============================================================
// GENERADO por scripts/build-rutas.ts - NO editar a mano.
// Trazados reales (grafo OSM propio) para las 9 rutas predefinidas
// del mapa general (Capa 2: Pavimento + MTB) y las 3 bajadas del
// control 30 km/h (Capa 4: Normativa y Seguridad, cliente 2026-11-13).
// Reglas: dentro del parque (+80 m en accesos) · pavimento sin
// senderos MTB ni sendas peatonales · MTB sin restricción de vía.
// coords = [lat, lon].
// ============================================================

export type RutaTrazado = { coords: [number, number][]; distKm: number };

export const RUTAS_TRAZADOS: Record<string, RutaTrazado> = ${JSON.stringify(out, null, 2)};

export type BajadaControl30 = { id: string; nombre: string; coords: [number, number][]; distKm: number };

export const BAJADAS_CONTROL_30: BajadaControl30[] = ${JSON.stringify(bajadasOut, null, 2)};
`;
writeFileSync("src/lib/rutasTrazados.ts", ts);
console.log("\n✎ src/lib/rutasTrazados.ts escrito");
