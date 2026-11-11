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
import { GATES, PARK_POLYGON } from "@/lib/park";
import { CAPA_RUTAS } from "@/lib/mapLayers";
import { RUTAS_TRAZADOS } from "@/lib/rutasTrazados";

/** Distancia máx. al grafo local para usar el motor propio. */
const GRAPH_COVER_M = 900;
/** El ORIGEN exige estar (casi) sobre el grafo: si estás más lejos, tu
 *  calle no está en el grafo y anclar el inicio a una arista lejana
 *  producía rutas que nacían en la ciclovía más próxima o con cordones
 *  rectos cruzando cuadras. Con esto caes a OSRM, que parte desde tu
 *  posición real siguiendo calles. */
const ORIGIN_COVER_M = 250;
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
  // radiuses=200; → el ORIGEN debe anclarse a una calle ciclable a ≤200 m
  // del pin. Sin este límite OSRM anclaba a ~700 m (p. ej. pin dentro del
  // Campus San Joaquín, sin calles ciclables) y el tramo pin→red salía
  // como un cordón recto que cruzaba las cuadras. El destino queda sin
  // límite (puede caer en senderos del parque).
  const url = `${OSRM_BASE}/${from.lon.toFixed(6)},${from.lat.toFixed(6)};${to.lon.toFixed(6)},${to.lat.toFixed(6)}?overview=full&geometries=geojson&steps=true&alternatives=false&radiuses=200;`;
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
// Regla del parque: entrar por el acceso ciclista más cercano
// ----------------------------------------------------------------

/** Los 4 accesos habilitados para ingreso en bicicleta (normativa Parquemet). */
const ACCESOS_CICLISTAS = GATES.filter((g) => g.ciclistas);

/** Test "dentro del parque" con tolerancia de 80 m (los accesos quedan sobre
 *  el borde del polígono). */
function parkInsideTest(): (lat: number, lon: number) => boolean {
  const poly = PARK_POLYGON.map((p) => [p.lat, p.lon] as [number, number]);
  const inPoly = (lat: number, lon: number) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
      if (yi > lat !== yj > lat && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const distToPolyM = (lat: number, lon: number) => {
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
  };
  return (lat: number, lon: number) => inPoly(lat, lon) || distToPolyM(lat, lon) <= 80;
}

/** Acceso ciclista más cercano a un punto. */
function accesoMasCercano(p: LatLng): { nombre: string; position: LatLng } {
  let best = ACCESOS_CICLISTAS[0];
  let bd = Infinity;
  for (const g of ACCESOS_CICLISTAS) {
    const d = haversineM(p, g.position);
    if (d < bd) {
      bd = d;
      best = g;
    }
  }
  return { nombre: best.name, position: best.position };
}

/** Une dos tramos en un NavRoute con pasos coherentes (turn-by-turn del
 *  primer tramo + hito de ingreso + turn-by-turn del segundo). */
function mergeLegs(leg1: NavRoute, leg2: NavRoute, ingreso: string | null): NavRoute {
  const off = leg1.coords.length - 1; // índice del punto de empalme
  const coords = [...leg1.coords, ...leg2.coords.slice(1)];
  const flags = [...leg1.flags, ...leg2.flags];
  const segNames = [...leg1.segNames, ...leg2.segNames];
  const steps: RouteStep[] = [];
  for (const s of leg1.steps) {
    if (s.icon === "end") continue; // el hito de ingreso lo reemplaza
    steps.push({ ...s, idx: s.idx });
  }
  if (ingreso) {
    steps.push({ icon: "straight", text: ingreso, distM: 0, point: leg1.coords[leg1.coords.length - 1], idx: off });
  }
  for (const s of leg2.steps) {
    if (s.icon === "start") continue; // ya venimos andando
    steps.push({ ...s, idx: s.idx + off });
  }
  const distanceM = leg1.distanceM + leg2.distanceM;
  const etaMin = Math.max(1, Math.round(distanceM / 1000 / 15 * 60));
  let cicloM = 0;
  for (let i = 0; i < flags.length; i++) if (flags[i]) cicloM += haversineM(coords[i], coords[i + 1]);
  return {
    coords,
    distanceM,
    steps,
    cicloviaPct: distanceM > 0 ? Math.round((cicloM / distanceM) * 100) : 0,
    etaMin,
    flags,
    segNames,
  };
}

// ----------------------------------------------------------------
// API pública
// ----------------------------------------------------------------

/**
 * Ruta completa desde `from` (mi ubicación) hasta `to`.
 * Primero intenta el grafo local (cubre el cerro y alrededores con
 * datos ricos); si el punto queda fuera, OSRM bici. Los tramos
 * ciclovía se marcan con datos del grafo local o de Overpass.
 *
 * REGLA DEL PARQUE: si el destino está dentro del cerro y tú estás
 * fuera, la ruta primero te lleva al ACCESO CICLISTA más cercano
 * (normativa Parquemet: solo 4 ingresos en bici) y desde ahí sigue
 * por dentro del parque hasta el destino.
 */
export async function computeRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
  const net = await loadNetwork();
  if (net) {
    const inside = parkInsideTest();
    const destInPark = inside(to.lat, to.lon);
    const fromInPark = inside(from.lat, from.lon);
    if (destInPark && !fromInPark) {
      const acc = accesoMasCercano(from);
      // tramo 1: hasta el acceso (ciudad; local si cubre, OSRM si no)
      let leg1: NavRoute | null = null;
      const a = snapInfo(net, from);
      if (a.distM <= ORIGIN_COVER_M) leg1 = findRoute(net, from, acc.position);
      if (!leg1) leg1 = await osrmRoute(from, acc.position);
      // tramo 2: del acceso al destino, SOLO por dentro del parque
      const leg2 = leg1 ? findRoute(net, acc.position, to, { nodeOk: inside }) : null;
      if (leg1 && leg2) {
        const merged = mergeLegs(leg1, leg2, `Ingresa por ${acc.nombre} · ingreso oficial de ciclistas`);
        const route = { ...merged, cicloviaPct: cicloPctOf(merged) };
        return { route, source: "local", error: null };
      }
      // si la cadena por el acceso falla, cae al flujo normal (abajo)
    }
    const b = snapInfo(net, to);
    const a = snapInfo(net, from);
    if (a.distM <= ORIGIN_COVER_M && b.distM <= GRAPH_COVER_M) {
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

// ----------------------------------------------------------------
// Rutas predefinidas del mapa («generar ruta» en la capa Rutas)
// ----------------------------------------------------------------

/** Reglas de vía por tipo de ruta (idénticas a scripts/build-rutas.ts). */
const CLASES_PAVIMENTO = new Set([
  "living_street", "residential", "service", "unclassified",
  "tertiary", "tertiary_link", "secondary", "secondary_link",
  "primary", "primary_link",
]);
const NOMBRES_PERMITIDOS_PAV = [
  /^Paseo Metropolitano - Tramo /,
  /^Paseo Metropolitano$/,
  /^Paseo Metropolitano - Sendero Bellavista/,
  /^Avenida /,
  /^Camino /,
  /^Antilen$/,
  /^Rotonda /,
  // puentes del grafo (explanadas de acceso)
  /^Acceso (Pedro de Valdivia Norte|La Pirámide|sector Tupahue)$/,
];

/**
 * Genera la ruta para una ruta predefinida del mapa (botón «Ruta» de la
 * capa Rutas). REGLA DEL CLIENTE: toda ruta que accede al cerro dirige
 * primero al ACCESO CICLISTA más cercano y desde ahí sigue la ruta
 * dentro del parque:
 *   1. tramo de ciudad: mi ubicación → acceso ciclista más cercano
 *      (solo si estoy fuera del parque)
 *   2. tramo interno: acceso → inicio del trazado, por caminos del
 *      parque (pavimento sin senderos MTB · MTB sin restricción)
 *   3. trazado precomputado completo de la ruta elegida
 */
export async function computePresetRoute(
  from: LatLng,
  preset: { rutaId: string; nombre: string }
): Promise<RouteResult> {
  const ruta = CAPA_RUTAS.find((r) => r.id === preset.rutaId);
  const t = ruta ? RUTAS_TRAZADOS[ruta.trz] : null;
  if (!ruta || !t || t.coords.length < 2) {
    return { route: null, source: null, error: "No encontramos el trazado de esa ruta." };
  }
  const trace = t.coords.map(([lat, lon]) => ({ lat, lon }));

  const net = await loadNetwork();
  if (!net) {
    return { route: null, source: null, error: "Sin conexión al mapa de rutas." };
  }
  const inside = parkInsideTest();
  const fromInPark = inside(from.lat, from.lon);
  const opts = {
    nodeOk: inside,
    ...(ruta.tipo === "pavimento"
      ? { allowedCls: CLASES_PAVIMENTO, nameAllow: NOMBRES_PERMITIDOS_PAV, nameBlock: [/^Sendero Ciclista /] }
      : {}),
  };

  // 1. tramo de ciudad hasta el acceso ciclista más cercano (si estoy fuera)
  let legAcceso: NavRoute | null = null;
  let acceso: { nombre: string; position: LatLng } | null = null;
  if (!fromInPark) {
    acceso = accesoMasCercano(from);
    const a = snapInfo(net, from);
    if (a.distM <= ORIGIN_COVER_M) legAcceso = findRoute(net, from, acceso.position);
    if (!legAcceso) legAcceso = await osrmRoute(from, acceso.position);
    if (!legAcceso) {
      return {
        route: null,
        source: null,
        error: "No pudimos trazar la ruta hasta el acceso ciclista más cercano.",
      };
    }
  }

  // 2. si ya voy DENTRO del parque y estoy sobre el trazado (recálculo por
  //    desvío), sigo el trazado desde el punto más cercano hacia adelante;
  //    si no, tramo interno: acceso/origen → inicio del trazado.
  const traceCoordsFull = trace;
  let joinIdx = -1;
  if (fromInPark) {
    let bd = Infinity;
    const fromIdx = Math.floor(traceCoordsFull.length * 0.25); // no reenviar al inicio
    for (let i = fromIdx; i < traceCoordsFull.length; i++) {
      const d = haversineM(from, traceCoordsFull[i]);
      if (d < bd) {
        bd = d;
        joinIdx = i;
      }
    }
    if (bd > 150) joinIdx = -1; // demasiado lejos del trazado: ir al inicio
    if (joinIdx > traceCoordsFull.length - 3) joinIdx = traceCoordsFull.length - 3; // cola mínima
    if (joinIdx < Math.floor(traceCoordsFull.length * 0.25)) joinIdx = -1;
  }
  const yaEnInicio = joinIdx < 0 && haversineM(fromInPark ? from : acceso!.position, traceCoordsFull[0]) < 60;
  let legInterno: NavRoute | null = null;
  if (joinIdx < 0 && !yaEnInicio) {
    const origenInterno: LatLng = fromInPark ? from : acceso!.position;
    legInterno = findRoute(net, origenInterno, traceCoordsFull[0], opts);
    if (!legInterno) {
      // respaldo: sin restricción de vía (mantiene la regla de parque)
      legInterno = findRoute(net, origenInterno, traceCoordsFull[0], { nodeOk: inside });
    }
  }

  // 3. trazado precomputado (desde el punto de empalme si lo hay)
  const traceCoords = joinIdx >= 0 ? traceCoordsFull.slice(joinIdx) : traceCoordsFull;
  const traceFlags = new Array<boolean>(Math.max(0, traceCoords.length - 1)).fill(false);
  const traceNames = new Array<string>(Math.max(0, traceCoords.length - 1)).fill("");
  let traceDistM = 0;
  for (let i = 1; i < traceCoords.length; i++) traceDistM += haversineM(traceCoords[i - 1], traceCoords[i]);

  // ensamblado
  const coords: LatLng[] = [];
  const flags: boolean[] = [];
  const segNames: string[] = [];
  const steps: RouteStep[] = [];
  let distanceM = 0;

  const pushLeg = (leg: NavRoute, dropEnd: boolean) => {
    const base = coords.length;
    if (base === 0) coords.push(...leg.coords);
    else coords.push(...leg.coords.slice(1));
    flags.push(...leg.flags);
    segNames.push(...leg.segNames);
    distanceM += leg.distanceM;
    for (const s of leg.steps) {
      if (dropEnd && s.icon === "end") continue;
      if (!dropEnd && s.icon === "start" && base > 0) continue;
      steps.push({ ...s, idx: s.idx + (base > 0 ? base - 1 : 0) });
    }
  };

  if (legAcceso) {
    pushLeg(legAcceso, true);
    steps.push({
      icon: "straight",
      text: `Ingresa por ${acceso!.nombre} · ingreso oficial de ciclistas`,
      distM: 0,
      point: coords[coords.length - 1],
      idx: coords.length - 1,
    });
  }
  if (legInterno) pushLeg(legInterno, true);
  if (joinIdx < 0) {
    steps.push({
      icon: "straight",
      text: `Comienza ${preset.nombre} (${(traceDistM / 1000).toFixed(1)} km)`,
      distM: 0,
      point: coords[coords.length - 1],
      idx: coords.length - 1,
    });
  }

  // trazado precomputado
  const base = coords.length;
  if (base === 0) coords.push(...traceCoords);
  else coords.push(...traceCoords.slice(1));
  flags.push(...traceFlags);
  segNames.push(...traceNames);
  distanceM += Math.round(traceDistM);
  steps.push({
    icon: "end",
    text: `Fin de ${preset.nombre}`,
    distM: 0,
    point: coords[coords.length - 1],
    idx: coords.length - 1,
  });

  if (coords.length < 2) {
    return { route: null, source: null, error: "No pudimos armar la ruta." };
  }
  const etaMin = Math.max(1, Math.round(distanceM / 1000 / 15 * 60));
  const route: NavRoute = {
    coords,
    distanceM,
    steps,
    cicloviaPct: 0,
    etaMin,
    flags,
    segNames,
  };
  return { route, source: "local", error: null };
}
