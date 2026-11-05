// Prueba "primer tramo por la CALLE" — v1.3.8.
// Reproduce el pipeline exacto de computeRoute (grafo local A* + fallback
// OSRM bici + conector por calles) para rutas con destino Pío Nono y
// verifica que NINGÚN tramo de la ruta final cruce cuadras en recta
// (punto medio de cada tramo a >25 m de la red vial real).
//
// Uso: npx esbuild scripts/test-connector-streets.ts --bundle --platform=node --outfile=/tmp/test-connector.js && node /tmp/test-connector.js
import * as fs from "fs";
import {
  CONNECTOR_MAX_M,
  attachOrigin,
  findRoute,
  haversineM,
  originAttachPlan,
  snapInfo,
  streetConnector,
  type Network,
  type NavRoute,
  type NetEdge,
  type StreetConnector,
  type LatLng,
} from "../src/lib/routing";

// ---------------------------------------------------------------
// Red real (grafo local del cerro + Bellavista)
// ---------------------------------------------------------------
const raw = JSON.parse(fs.readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[];
  names: string[];
  nodes: [number, number][];
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
  const y = Math.sin((pb.lon - pa.lon) * Math.PI / 180) * Math.cos(pb.lat * Math.PI / 180);
  const x = Math.cos(pa.lat * Math.PI / 180) * Math.sin(pb.lat * Math.PI / 180) - Math.sin(pa.lat * Math.PI / 180) * Math.cos(pb.lat * Math.PI / 180) * Math.cos((pb.lon - pa.lon) * Math.PI / 180);
  const brr = (Math.atan2(y, x) / Math.PI * 180 + 360) % 360;
  adj[a].push({ to: b, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: brr });
  adj[b].push({ to: a, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: (brr + 180) % 360 });
}
const net: Network = { ...raw, adj };

// ---------------------------------------------------------------
// Detector "sigue la calle": rejilla espacial de puntos muestreados
// de TODAS las aristas (cada ~15 m). Un tramo cuyo punto medio quede a
// >25 m de cualquier punto de la red cruza cuadras.
// ---------------------------------------------------------------
const CELL = 0.0003;
const grid = new Map<string, number[]>();
const gridKey = (lat: number, lon: number) => `${Math.round(lat / CELL)}:${Math.round(lon / CELL)}`;
function gridAdd(lat: number, lon: number) {
  const k = gridKey(lat, lon);
  let arr = grid.get(k);
  if (!arr) grid.set(k, (arr = []));
  arr.push(lat, lon);
}
for (const [a, b] of raw.edges) {
  const [la, lo] = raw.nodes[a];
  const [lb, ob] = raw.nodes[b];
  gridAdd(la, lo);
  const dLat = lb - la, dLon = ob - lo;
  const lenDeg = Math.hypot(dLat, dLon);
  const steps = Math.ceil((lenDeg * 111320) / 15);
  for (let s = 1; s < steps; s++) gridAdd(la + (dLat * s) / steps, lo + (dLon * s) / steps);
}
function nearestStreetDist(p: LatLng): number {
  const ci = Math.round(p.lat / CELL), cj = Math.round(p.lon / CELL);
  let best = Infinity;
  for (let di = -2; di <= 2; di++)
    for (let dj = -2; dj <= 2; dj++) {
      const arr = grid.get(`${ci + di}:${cj + dj}`);
      if (!arr) continue;
      for (let k = 0; k < arr.length; k += 2) {
        const d = haversineM(p, { lat: arr[k], lon: arr[k + 1] });
        if (d < best) best = d;
      }
    }
  return best;
}

/** Tramos que NO siguen calles: largo > 25 m y punto medio a > 25 m de la red.
 *  Solo se juzgan tramos dentro del bbox EXACTO del grafo (fuera no hay datos
 *  con qué juzgar: ahí la ruta viene de OSRM y sigue calles reales de OSM). */
const BBOX = { s: -33.44, w: -70.65, n: -33.38, e: -70.59 };
function inBbox(p: LatLng): boolean {
  return p.lat >= BBOX.s && p.lat <= BBOX.n && p.lon >= BBOX.w && p.lon <= BBOX.e;
}
function violations(route: NavRoute): { idx: number; lenM: number; offM: number }[] {
  const out: { idx: number; lenM: number; offM: number }[] = [];
  for (let i = 0; i < route.coords.length - 1; i++) {
    const len = haversineM(route.coords[i], route.coords[i + 1]);
    if (len <= 25) continue;
    const mid = {
      lat: (route.coords[i].lat + route.coords[i + 1].lat) / 2,
      lon: (route.coords[i].lon + route.coords[i + 1].lon) / 2,
    };
    if (!inBbox(mid)) continue;
    const off = nearestStreetDist(mid);
    if (off > 25) out.push({ idx: i, lenM: Math.round(len), offM: Math.round(off) });
  }
  return out;
}

// ---------------------------------------------------------------
// Replicación EXACTA del branch OSRM de computeRoute (con el fix:
// conector por calles cuando el cordón recto supera CONNECTOR_MAX_M).
// ---------------------------------------------------------------
const OSRM_BASE = "https://routing.openstreetmap.de/routed-bike/route/v1/driving";
type OsrmResp = { distance: number; geometry: { coordinates: [number, number][] } };
async function osrmFetch(from: LatLng, to: LatLng): Promise<OsrmResp | null> {
  const url = `${OSRM_BASE}/${from.lon.toFixed(6)},${from.lat.toFixed(6)};${to.lon.toFixed(6)},${to.lat.toFixed(6)}?overview=full&geometries=geojson&steps=false&alternatives=false&radiuses=200;`;
  const ctrl = new AbortController();
  const to2 = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    const d = (await r.json()) as { code: string; routes?: OsrmResp[] };
    if (d.code !== "Ok" || !d.routes?.length) return null;
    return d.routes[0];
  } catch {
    return null;
  } finally {
    clearTimeout(to2);
  }
}
function toNav(osrm: OsrmResp): NavRoute | null {
  const coords: LatLng[] = osrm.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
  if (coords.length < 2) return null;
  return {
    coords,
    distanceM: Math.round(osrm.distance),
    steps: [
      { icon: "start", text: "Parte por la vía", distM: osrm.distance, point: coords[0], idx: 0 },
      { icon: "end", text: "Has llegado a tu destino", distM: 0, point: coords[coords.length - 1], idx: coords.length - 1 },
    ],
    cicloviaPct: 0,
    etaMin: 5,
    flags: new Array(coords.length - 1).fill(false),
    segNames: new Array(coords.length - 1).fill(""),
  };
}
const ORIGIN_COVER_M = 250;
const GRAPH_COVER_M = 900;

async function computeRouteReplica(from: LatLng, to: LatLng): Promise<{ route: NavRoute | null; source: "local" | "osrm" | null; viaUsed: boolean }> {
  const a = snapInfo(net, from);
  const b = snapInfo(net, to);
  if (a.distM <= ORIGIN_COVER_M && b.distM <= GRAPH_COVER_M) {
    const r = findRoute(net, from, to);
    if (r) return { route: attachOrigin(r, from, { net }), source: "local", viaUsed: false };
  }
  const osrm = await osrmFetch(from, to);
  if (!osrm) return { route: null, source: null, viaUsed: false };
  const r = toNav(osrm)!;
  const plan = originAttachPlan(r, from);
  let via: StreetConnector | null = null;
  if (plan.mode !== "none" && plan.straightM > CONNECTOR_MAX_M) {
    const c = await osrmFetch(from, plan.join);
    if (c && c.distance <= Math.max(500, plan.straightM * 4)) {
      let cc: LatLng[] = c.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
      // espejo del fix en osrmStreetConnector: el pin SIEMPRE primero
      if (cc.length >= 2) {
        const pin = { lat: from.lat, lon: from.lon };
        cc = [pin, ...cc];
        via = {
          coords: cc,
          names: cc.slice(0, -1).map(() => ""),
          flags: cc.slice(0, -1).map(() => false),
          kinds: ["connector", ...cc.slice(2).map(() => "route" as const)],
          distM: c.distance + haversineM(pin, cc[1]),
        };
      }
    }
  }
  return { route: attachOrigin(r, from, via ? { net, via } : { net }), source: "osrm", viaUsed: !!via };
}

// ---------------------------------------------------------------
// Batería de casos "ir a Pío Nono"
// ---------------------------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);
function jitter(p: LatLng, dM: number): LatLng {
  const brg = rng() * 2 * Math.PI;
  return { lat: p.lat + (dM * Math.cos(brg)) / 111320, lon: p.lon + (dM * Math.sin(brg)) / (111320 * Math.cos((p.lat * Math.PI) / 180)) };
}
function nodeOfStreet(part: string): LatLng | null {
  const idx = raw.names.findIndex((n) => n.toLowerCase().includes(part.toLowerCase()));
  if (idx < 0) return null;
  const e = raw.edges.find((e) => e[3] === idx);
  if (!e) return null;
  return { lat: raw.nodes[e[0]][0], lon: raw.nodes[e[0]][1] };
}

const PIO_ENTRADA: LatLng = { lat: -33.430554, lon: -70.636347 }; // extremo norte Pío Nono (acceso cerro)
const PIO_SUR: LatLng = { lat: -33.436235, lon: -70.635415 };     // puente Pío Nono / Bellavista

type Caso = { label: string; from: LatLng; to: LatLng; grid: boolean };
const casos: Caso[] = [];

// 1) Pines sobre la calle (control)
const calles = ["Merced", "Constitución", "Antonia López de Bello", "Dardignac", "Ernesto Pinto", "Purísima", "Pío Nono"];
for (const c of calles) {
  const n = nodeOfStreet(c);
  if (!n) { console.log(`(aviso: calle no encontrada en grafo: ${c})`); continue; }
  casos.push({ label: `${c} (pin sobre calle)`, from: n, to: PIO_ENTRADA, grid: true });
}

// 2) GPS con ruido sobre un pin de Bellavista y de Pío Nono
const baseBell = nodeOfStreet("Constitución") ?? { lat: -33.4345, lon: -70.6395 };
casos.push({ label: "Bellavista + ruido GPS 12 m", from: jitter(baseBell, 12), to: PIO_ENTRADA, grid: true });
casos.push({ label: "Bellavista + ruido GPS 25 m", from: jitter(baseBell, 25), to: PIO_ENTRADA, grid: true });
casos.push({ label: "Bellavista + ruido GPS 40 m", from: jitter(baseBell, 40), to: PIO_ENTRADA, grid: true });
const basePio = nodeOfStreet("Pío Nono") ?? PIO_SUR;
casos.push({ label: "Pío Nono + ruido GPS 25 m (→ Cumbre)", from: jitter(basePio, 25), to: { lat: -33.42527, lon: -70.63324 }, grid: true });

// 3) Pines dentro de una cuadra / zona peatonal (Patio Bellavista)
casos.push({ label: "interior de cuadra Bellavista (+45 m diagonal)", from: { lat: baseBell.lat + 0.00035, lon: baseBell.lon + 0.00042 }, to: PIO_ENTRADA, grid: true });
casos.push({ label: "interior de cuadra Pío Nono (+45 m diagonal, → Cumbre)", from: { lat: basePio.lat + 0.00035, lon: basePio.lon + 0.00042 }, to: { lat: -33.42527, lon: -70.63324 }, grid: true });
const patio = nodeOfStreet("Patio Bellavista");
if (patio) casos.push({ label: "pin sobre pasaje Patio Bellavista", from: jitter(patio, 10), to: PIO_ENTRADA, grid: true });

// 4) Orígenes fuera del grafo (cayendo a OSRM, como un usuario que parte desde su casa)
casos.push({ label: "Plaza de Armas → Pío Nono", from: { lat: -33.43695, lon: -70.65035 }, to: PIO_ENTRADA, grid: true });
casos.push({ label: "Parque Bustamante → Pío Nono", from: { lat: -33.44440, lon: -70.63510 }, to: PIO_ENTRADA, grid: false });
casos.push({ label: "Plaza Ñuñoa → Pío Nono", from: { lat: -33.44980, lon: -70.60970 }, to: PIO_ENTRADA, grid: false });
casos.push({ label: "Barrio Italia → Pío Nono", from: { lat: -33.45200, lon: -70.63800 }, to: PIO_SUR, grid: false });

// 5) Control clásico: acceso Pío Nono → Cumbre (origen provisional de la app)
casos.push({ label: "Acceso Pío Nono → Cumbre (control)", from: { lat: -33.430691, lon: -70.63592 }, to: { lat: -33.42527, lon: -70.63324 }, grid: true });

// ---------------------------------------------------------------
let failures = 0;
function check(cond: boolean, msg: string) {
  if (cond) console.log(`      ✅ ${msg}`);
  else { failures++; console.log(`      ❌ ${msg}`); }
}

(async () => {
  console.log(`red: ${raw.nodes.length} nodos · ${raw.edges.length} aristas\n`);

  // --- 0) unit: streetConnector dentro del grafo ---
  console.log("0) streetConnector (unit): pin en cuadra → punto de la ciclovía al otro lado");
  {
    const pinEnCuadra: LatLng = { lat: baseBell.lat + 0.0003, lon: baseBell.lon + 0.0004 };
    const target: LatLng = PIO_SUR;
    const c = streetConnector(net, pinEnCuadra, target);
    const recta = haversineM(pinEnCuadra, target);
    check(!!c, "streetConnector devuelve conector");
    if (c) {
      check(haversineM(pinEnCuadra, c.coords[0]) < 1, `parte en el pin (Δ ${haversineM(pinEnCuadra, c.coords[0]).toFixed(2)} m)`);
      check(haversineM(target, c.coords[c.coords.length - 1]) < 0.6, `termina en el target (Δ ${haversineM(target, c.coords[c.coords.length - 1]).toFixed(2)} m)`);
      check(c.distM >= recta * 1.2, `avanza por calles (conector ${Math.round(c.distM)} m ≥ 1.2 × recta ${Math.round(recta)} m)`);
      const fakeRoute: NavRoute = { coords: c.coords, distanceM: Math.round(c.distM), steps: [], cicloviaPct: 0, etaMin: 1, flags: c.flags, segNames: c.names };
      const v = violations(fakeRoute).filter((x) => x.idx > 0 || x.lenM > 60);
      check(v.length === 0, `sin tramos cruzando cuadras (más allá del chaflán del pin) ${JSON.stringify(v)}`);
    }
  }

  // --- casos de extremo a extremo ---
  for (const c of casos) {
    const snap = snapInfo(net, c.from);
    const { route, source, viaUsed } = await computeRouteReplica(c.from, c.to);
    if (!route) {
      if (source === null && snap.distM > ORIGIN_COVER_M) {
        console.log(`⚠️  ${c.label} (snap ${Math.round(snap.distM)} m): OSRM no dio ruta (sin calle bici a ≤200 m o servicio saturado) — la app mostraría el aviso de sin conexión`);
        continue;
      }
      failures++;
      console.log(`❌ ${c.label} [${source ?? "sin ruta"}] (snap ${Math.round(snap.distM)} m): SIN RUTA`);
      continue;
    }
    const v = violations(route);
    const vFin = v.filter((x) => Number.isFinite(x.offM));
    const stubLen = haversineM(route.coords[0], route.coords[1]);
    // el pin encabeza la ruta: tolerancia 3.5 m = el early-return de
    // attachOrigin cuando el pin ya está prácticamente sobre el arranque
    const pinOk = haversineM(c.from, route.coords[0]) < 3.5;
    const bad = vFin.length > 0 || !pinOk;
    failures += vFin.length + (pinOk ? 0 : 1);
    console.log(
      `${bad ? "❌" : "✅"} ${c.label} [${source}${viaUsed ? "+conector" : ""}] (snap ${Math.round(snap.distM)} m) ` +
      `· ${(route.distanceM / 1000).toFixed(2)} km · 1er tramo ${Math.round(stubLen)} m · pasos: ${route.steps.length}` +
      (vFin.length ? ` ${JSON.stringify(vFin)}` : "")
    );
    if (!pinOk) console.log(`      ❌ coords[0] NO es el pin (Δ ${haversineM(c.from, route.coords[0]).toFixed(1)} m)`);
    // pasos íntegros
    let mono = true;
    for (let k = 1; k < route.steps.length; k++) if (route.steps[k].idx <= route.steps[k - 1].idx) mono = false;
    const inB = route.steps.every((st) => st.idx >= 0 && st.idx <= route.coords.length - 1);
    if (route.steps.length >= 2 && (!mono || !inB)) {
      failures++;
      console.log(`      ❌ pasos rotos (mono=${mono}, inBounds=${inB})`);
    }
  }

  console.log(`\n${failures === 0 ? "✅ TODO OK — ningún tramo cruza cuadras" : `❌ ${failures} fallos`}`);
  process.exit(failures === 0 ? 0 : 1);
})();
