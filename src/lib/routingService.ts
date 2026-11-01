// ============================================================
// Servicio de rutas "Ir a…": calcula la ruta DESDE LA UBICACIÓN
// REAL del ciclista hasta el destino.
// · Si ambos puntos caen cerca del grafo OSM local del sector
//   (public/red-ciclista.json), usa el motor propio A* (offline,
//   con nombres de calle y banderas de ciclovía incluidas).
// · Si no (cualquier punto de Santiago), pide la ruta a OSRM bici
//   (routed-bike de FOSSGIS, público y sin clave) y clasifica los
//   tramos ciclovía consultando Overpass (etiquetas cycleway de
//   OSM). Sin conexión: nota clara en la UI.
// ============================================================

import { attachOrigin, findRoute, haversineM, loadNetwork, snapInfo, type LatLng, type NavRoute, type Network, type RouteStep } from "@/lib/routing";

/** Distancia máx. al grafo local para usar el motor propio. */
const GRAPH_COVER_M = 900;
const OSRM_BASE = "https://routing.openstreetmap.de/routed-bike/route/v1/driving";
const OVERPASS_BASE = "https://overpass-api.de/api/interpreter";

export type RouteResult = {
  route: NavRoute | null;
  /** De dónde salió la ruta. */
  source: "local" | "osrm" | null;
  /** Mensaje para la UI (sin conexión, área no cubierta…). */
  error: string | null;
};

// ----------------------------------------------------------------
// Conversión OSRM → NavRoute
// ----------------------------------------------------------------

type OsrmStep = {
  distance: number;
  name: string;
  maneuver: { type: string; modifier?: string; location: [number, number] };
};
type OsrmRoute = {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
  legs: { steps: OsrmStep[] }[];
};

function osrmIcon(step: OsrmStep): RouteStep["icon"] {
  const t = step.maneuver.type;
  if (t === "depart") return "start";
  if (t === "arrive") return "end";
  const m = step.maneuver.modifier ?? "straight";
  if (m.includes("left")) return "left";
  if (m.includes("right")) return "right";
  return "straight";
}

function osrmText(step: OsrmStep, icon: RouteStep["icon"]): string {
  const name = step.name?.trim() || "la vía";
  if (icon === "start") return `Parte por ${name}`;
  if (icon === "end") return "Has llegado a tu destino";
  if (icon === "left") return `Gira a la izquierda hacia ${name}`;
  if (icon === "right") return `Gira a la derecha hacia ${name}`;
  return `Continúa por ${name}`;
}

/** Filtra pasos inútiles (cambio de nombre en la misma vía, el último). */
function meaningfulSteps(steps: OsrmStep[]): OsrmStep[] {
  const out: OsrmStep[] = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const next = steps[i + 1];
    if (s.maneuver.type === "new name" && next && s.name === next.name) continue;
    if (i === steps.length - 1 && s.maneuver.type !== "arrive") {
      out.push({ ...s, maneuver: { ...s.maneuver, type: "arrive" } });
      continue;
    }
    out.push(s);
  }
  return out;
}

// ----------------------------------------------------------------
// Clasificación ciclovía: Overpass (etiquetas cycleway de OSM)
// ----------------------------------------------------------------

type CycleCache = { flags: boolean[] | null; promise: Promise<boolean[]> | null; at: number };
const cycleCache = new Map<string, CycleCache>();
const CYCLE_TTL_MS = 30 * 60_000; // los carriles bici no cambian cada rato

/** Polilíneas de ciclovía del grafo local (para el sector cubierto). */
function flagsFromLocalNet(net: Network, coords: LatLng[]): boolean[] {
  // rejilla espacial de puntos de ciclovía del grafo local
  const cell = 0.00035; // ≈ 39 m
  const grid = new Map<string, number[][]>();
  const key = (lat: number, lon: number) => `${Math.round(lat / cell)}:${Math.round(lon / cell)}`;
  for (const poly of net.cicloviaPolylines) {
    for (const id of poly) {
      const [lat, lon] = net.nodes[id];
      const k = key(lat, lon);
      let arr = grid.get(k);
      if (!arr) grid.set(k, (arr = []));
      arr.push([lat, lon]);
    }
  }
  const flags: boolean[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const mLat = (a.lat + b.lat) / 2;
    const mLon = (a.lon + b.lon) / 2;
    const ci = Math.round(mLat / cell);
    const cj = Math.round(mLon / cell);
    let hit = false;
    for (let di = -1; di <= 1 && !hit; di++)
      for (let dj = -1; dj <= 1 && !hit; dj++) {
        const arr = grid.get(`${ci + di}:${cj + dj}`);
        if (!arr) continue;
        for (const [lat, lon] of arr) if (haversineM({ lat: mLat, lon: mLon }, { lat, lon }) < 22) { hit = true; break; }
      }
    flags.push(hit);
  }
  return flags;
}

function bboxOf(coords: LatLng[], pad = 0.012) {
  let s = 90, n = -90, w = 180, e = -180;
  for (const c of coords) {
    s = Math.min(s, c.lat); n = Math.max(n, c.lat);
    w = Math.min(w, c.lon); e = Math.max(e, c.lon);
  }
  return { s: s - pad, w: w - pad, n: n + pad, e: e + pad };
}

const CYCLEWAY_VALUES = "lane|track|opposite_lane|opposite|shared_lane|shared|busway|buffered_bike_lane|crossing";

function overpassCycleFlags(coords: LatLng[]): Promise<boolean[]> {
  const b = bboxOf(coords);
  const cacheKey = `${b.s.toFixed(3)}:${b.w.toFixed(3)}:${b.n.toFixed(3)}:${b.e.toFixed(3)}`;
  const hit = cycleCache.get(cacheKey);
  if (hit && hit.flags && Date.now() - hit.at < CYCLE_TTL_MS) return Promise.resolve(hit.flags);
  if (hit?.promise) return hit.promise;

  const q = `[out:json][timeout:14];(way["highway"="cycleway"](${b.s},${b.w},${b.n},${b.e});way["cycleway"~"^(${CYCLEWAY_VALUES})$"](${b.s},${b.w},${b.n},${b.e});way["highway"="path"]["bicycle"="designated"](${b.s},${b.w},${b.n},${b.e}););out geom 6000;`;

  const promise = (async () => {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 9000);
    try {
      const r = await fetch(OVERPASS_BASE, { method: "POST", body: "data=" + encodeURIComponent(q), signal: ctrl.signal, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      if (!r.ok) throw new Error("overpass " + r.status);
      const d = (await r.json()) as { elements: { type: string; geometry?: { lat: number; lon: number }[]; tags?: Record<string, string> }[] };
      // rejilla espacial de puntos de ciclovía
      const cell = 0.00035;
      const grid = new Map<string, [number, number][]>();
      for (const el of d.elements) {
        if (el.type !== "way" || !el.geometry) continue;
        for (const p of el.geometry) {
          const k = `${Math.round(p.lat / cell)}:${Math.round(p.lon / cell)}`;
          let arr = grid.get(k);
          if (!arr) grid.set(k, (arr = []));
          arr.push([p.lat, p.lon]);
        }
      }
      const flags: boolean[] = [];
      for (let i = 0; i < coords.length - 1; i++) {
        const a = coords[i];
        const b2 = coords[i + 1];
        const mLat = (a.lat + b2.lat) / 2;
        const mLon = (a.lon + b2.lon) / 2;
        const ci = Math.round(mLat / cell);
        const cj = Math.round(mLon / cell);
        let hit = false;
        for (let di = -1; di <= 1 && !hit; di++)
          for (let dj = -1; dj <= 1 && !hit; dj++) {
            const arr = grid.get(`${ci + di}:${cj + dj}`);
            if (!arr) continue;
            for (const [lat, lon] of arr) if (haversineM({ lat: mLat, lon: mLon }, { lat, lon }) < 18) { hit = true; break; }
          }
        flags.push(hit);
      }
      cycleCache.set(cacheKey, { flags, promise: null, at: Date.now() });
      return flags;
    } catch {
      // sin Overpass: todo como vía compartida (degradación elegante)
      const flags = new Array(Math.max(0, coords.length - 1)).fill(false);
      cycleCache.set(cacheKey, { flags, promise: null, at: Date.now() });
      return flags;
    } finally {
      clearTimeout(to);
    }
  })();

  cycleCache.set(cacheKey, { flags: null, promise, at: Date.now() });
  return promise;
}

// ----------------------------------------------------------------
// OSRM bici
// ----------------------------------------------------------------

async function osrmRoute(from: LatLng, to: LatLng): Promise<NavRoute | null> {
  const url = `${OSRM_BASE}/${from.lon.toFixed(6)},${from.lat.toFixed(6)};${to.lon.toFixed(6)},${to.lat.toFixed(6)}?overview=full&geometries=geojson&steps=true&alternatives=false`;
  const ctrl = new AbortController();
  const to2 = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    const d = (await r.json()) as { code: string; routes?: OsrmRoute[] };
    if (d.code !== "Ok" || !d.routes?.length) return null;
    const osrm = d.routes[0];
    const coords: LatLng[] = osrm.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
    if (coords.length < 2) return null;

    // pasos → instrucciones; índice del vértice más cercano a cada maniobra
    const rawSteps = osrm.legs[0]?.steps ?? [];
    const stepsSrc = meaningfulSteps(rawSteps);
    const steps: RouteStep[] = [];
    const segNames: string[] = new Array(Math.max(0, coords.length - 1)).fill("");
    const stepIdx: number[] = [];
    for (const s of stepsSrc) {
      const [slon, slat] = s.maneuver.location;
      let best = 0, bestD = Infinity;
      for (let i = 0; i < coords.length; i++) {
        const dd = (coords[i].lat - slat) ** 2 + (coords[i].lon - slon) ** 2;
        if (dd < bestD) { bestD = dd; best = i; }
      }
      stepIdx.push(best);
    }
    for (let i = 0; i < stepsSrc.length; i++) {
      const s = stepsSrc[i];
      const icon = osrmIcon(s);
      const from0 = stepIdx[i];
      const upto = i + 1 < stepIdx.length ? stepIdx[i + 1] : coords.length - 1;
      const nm = s.name?.trim() || "";
      for (let k = from0; k < upto && k < segNames.length; k++) segNames[k] = nm;
      steps.push({ icon, text: osrmText(s, icon), distM: Math.round(s.distance), point: coords[Math.min(from0, coords.length - 1)], idx: Math.min(from0, coords.length - 1) });
    }
    if (!steps.length) {
      steps.push({ icon: "start", text: "Sigue la ruta trazada", distM: Math.round(osrm.distance), point: coords[0], idx: 0 });
      steps.push({ icon: "end", text: "Has llegado a tu destino", distM: 0, point: coords[coords.length - 1], idx: coords.length - 1 });
    }

    const distanceM = Math.round(osrm.distance);
    return {
      coords,
      distanceM,
      steps,
      cicloviaPct: 0, // se completa tras la clasificación
      etaMin: Math.max(1, Math.round(distanceM / 1000 / 15 * 60)),
      flags: new Array(Math.max(0, coords.length - 1)).fill(false),
      segNames,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(to2);
  }
}

// ----------------------------------------------------------------
// API pública
// ----------------------------------------------------------------

/**
 * Ruta completa desde `from` (mi ubicación) hasta `to`.
 * Primero intenta el grafo local (cubre el cerro y alrededores con
 * datos ricos); si el punto queda fuera, OSRM bici. Los tramos
 * ciclovía se marcan con datos del grafo local o de Overpass.
 */
export async function computeRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
  const net = await loadNetwork();
  if (net) {
    const a = snapInfo(net, from);
    const b = snapInfo(net, to);
    if (a.distM <= GRAPH_COVER_M && b.distM <= GRAPH_COVER_M) {
      const r = findRoute(net, from, to);
      if (r) {
        // flags del A* ya son confiables en el sector cubierto;
        // el inicio se ancla a la ubicación real del ciclista
        const route = attachOrigin(r, from);
        return {
          route: { ...route, cicloviaPct: cicloPctOf(route) },
          source: "local",
          error: null,
        };
      }
    }
  }

  const r = await osrmRoute(from, to);
  if (!r) {
    return {
      route: null,
      source: null,
      error: "No pudimos trazar la ruta (sin conexión al servicio de rutas).",
    };
  }
  // clasificación ciclovía: grafo local primero (instantáneo), Overpass después
  let flags: boolean[] | null = null;
  if (net) {
    flags = flagsFromLocalNet(net, r.coords);
    // si casi todo quedó sin clasificar y hay tramos fuera del sector, pregunta a Overpass
    const known = flags.filter(Boolean).length;
    if (known < 2) flags = await overpassCycleFlags(r.coords);
  } else {
    flags = await overpassCycleFlags(r.coords);
  }
  // el inicio se ancla a la ubicación real del ciclista (OSRM
  // también ajusta el origen a la red vial)
  const route = attachOrigin({ ...r, flags }, from);
  return {
    route: { ...route, cicloviaPct: cicloPctOf(route) },
    source: "osrm",
    error: null,
  };
}

/** % de metros sobre ciclovía de la ruta ya anclada al origen. */
function cicloPctOf(route: NavRoute): number {
  let cicloM = 0;
  for (let i = 0; i < route.flags.length; i++) {
    if (route.flags[i]) cicloM += haversineM(route.coords[i], route.coords[i + 1]);
  }
  return route.distanceM > 0 ? Math.round((cicloM / route.distanceM) * 100) : 0;
}
