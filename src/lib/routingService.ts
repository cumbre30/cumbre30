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
import { GATES, PARK_POLYGON, NAV_DESTINATIONS } from "@/lib/park";
import { CAPA_RUTAS } from "@/lib/mapLayers";
import { RUTAS_TRAZADOS } from "@/lib/rutasTrazados";
import { estadoParque } from "@/lib/horario";
import { GATE_PIO_NONO, PLAZA_MEXICO_POS, PUENTE_TUPAHUE_CUMBRE, conVueltaEnU, crearDirOk } from "@/lib/reglasParque";
import { SEND_PEATONALES_BLOCK } from "@/lib/senderos";

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
  /** Aviso NO bloqueante sobre la ruta trazada (corte horario con
   *  vuelta en U, Pío Nono sólo subida…). */
  aviso?: string | null;
};

// ----------------------------------------------------------------
// Reglas direccionales del cliente (2026-11-12)
// ----------------------------------------------------------------

/** ¿Corte horario de la cumbre activo AHORA? Fines de semana y festivos
 *  desde las 13:30 (estadoParque.nivel === "tupa"). */
function corteCumbreActivo(now: Date = new Date()): boolean {
  return estadoParque(now).nivel === "tupa";
}

/** ¿La ruta quedó CORTADA por el puente de Tupahue (pasó cerca y no
 *  alcanzó el destino)? Distancia mínima del trazado al puente. */
function pasaPorPuente(coords: LatLng[]): number {
  let best = Infinity;
  for (const c of coords) {
    const d = haversineM(c, PUENTE_TUPAHUE_CUMBRE);
    if (d < best) best = d;
  }
  return best;
}

/** Alternativas del cliente cerca del corte, ordenadas por cercanía al
 *  punto de partida: Av. Gabriela Mistral (conecta con PdV Norte) y
 *  Av. Carlos Martner. */
function opcionesAlternativas(from: LatLng): string {
  const gabriela = NAV_DESTINATIONS.find((d) => d.id === "av-gabriela-mistral");
  const martner = NAV_DESTINATIONS.find((d) => d.id === "av-carlos-martner");
  const lista = [
    { nombre: "Av. Gabriela Mistral (conecta con PdV Norte)", pos: gabriela?.position },
    { nombre: "Av. Carlos Martner", pos: martner?.position },
  ].filter((x): x is { nombre: string; pos: LatLng } => !!x.pos);
  lista.sort((a, b) => haversineM(from, a.pos) - haversineM(from, b.pos));
  return lista.map((x) => x.nombre).join(" · ");
}

/** Construye la ruta de VUELTA EN U en el puente de Tupahue a partir de
 *  una ruta que ya termina ahí (corte horario, cliente 2026-11-12). */
function rutaVueltaEnU(base: NavRoute, from: LatLng): { route: NavRoute; aviso: string } {
  const vuelta = conVueltaEnU(base.coords);
  const coords = vuelta.coords;
  const steps = [...base.steps];
  const lastIdx = coords.length - 1;
  if (steps.length) {
    const fin = steps[steps.length - 1];
    if (fin.icon === "end") steps.pop();
  }
  steps.push({
    icon: "straight",
    text: "Vuelta en U: acceso a la cumbre restringido desde las 13:30 (fin de semana y festivos)",
    distM: vuelta.metrosVuelta,
    point: coords[coords.length - 1],
    idx: lastIdx,
  });
  steps.push({ icon: "end", text: "Has llegado al puente de Tupahue (corte horario)", distM: 0, point: coords[coords.length - 1], idx: lastIdx });
  const route: NavRoute = {
    ...base,
    coords,
    distanceM: base.distanceM + vuelta.metrosVuelta,
    etaMin: Math.max(1, Math.round((base.distanceM + vuelta.metrosVuelta) / 1000 / 15 * 60)),
    flags: [...base.flags, ...new Array(coords.length - base.coords.length).fill(false)],
    segNames: [...base.segNames, ...new Array(coords.length - base.coords.length).fill("Corte horario Tupahue")],
    steps,
  };
  const aviso = `Fuera de horario (fines de semana y festivos desde 13:30): el acceso a la cumbre por Tupahue está cerrado. Trazamos hasta el puente con vuelta en U. Alternativas según tu posición: ${opcionesAlternativas(from)}.`;
  return { route, aviso };
}

/** Ruta local con reglas del cliente:
 *  · Corte horario activo y destino NO alcanzado (queda al otro lado del
 *    puente de Tupahue) → re-traza HASTA EL PUENTE y agrega la VUELTA EN U
 *    («se debe trazar una vuelta en U en tupahue, donde dejamos el puente»).
 *  · Destino junto al acceso Pío Nono no alcanzado (sólo subida) → aviso.
 *  `trazar(dest)` traza la ruta completa para un destino dado. */
function rutaLocalConCorte(
  from: LatLng,
  dest: LatLng,
  trazar: (d: LatLng) => NavRoute | null
): { route: NavRoute; aviso: string | null } | null {
  const base = trazar(dest);
  if (!base) return null;
  const end = base.coords[base.coords.length - 1];
  if (haversineM(end, dest) <= 250) return { route: base, aviso: null };
  if (!corteCumbreActivo()) return { route: base, aviso: avisoPioNono(base, dest) };
  // corte activo, destino en la cara cumbre sin acceso: ¿destino junto al
  // acceso Pío Nono? → ese caso lo explica avisoPioNono (sólo subida)
  if (haversineM(dest, GATE_PIO_NONO) <= 400) return { route: base, aviso: avisoPioNono(base, dest) };
  // re-traza hasta el puente de Tupahue y cierra con la vuelta en U
  const aPuente = trazar(PUENTE_TUPAHUE_CUMBRE);
  if (
    aPuente &&
    haversineM(aPuente.coords[aPuente.coords.length - 1], PUENTE_TUPAHUE_CUMBRE) <= 150
  ) {
    const vuelta = rutaVueltaEnU(aPuente, from);
    return { route: vuelta.route, aviso: vuelta.aviso };
  }
  return { route: base, aviso: null };
}

/** Aviso de Pío Nono sólo subida: si el destino era el acceso Pío Nono (o
 *  algo a sus pies, en Bellavista) y la ruta quedó cortada dentro del
 *  parque, avisamos que no se puede bajar por ahí. */
function avisoPioNono(route: NavRoute, dest: LatLng): string | null {
  const cercaDelGate = haversineM(dest, GATE_PIO_NONO) <= 250;
  if (!cercaDelGate) return null;
  const end = route.coords[route.coords.length - 1];
  if (haversineM(end, dest) <= 150) return null;
  return "Pío Nono es sólo de subida: la bajada está bloqueada para bici. Te dejamos en el punto más cercano alcanzable.";
}

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
  if (m === "uturn") return "uturn";
  if (m.includes("left")) return "left";
  if (m.includes("right")) return "right";
  return "straight";
}

function osrmText(step: OsrmStep, icon: RouteStep["icon"]): string {
  const name = step.name?.trim() || "la vía";
  if (icon === "start") return `Parte por ${name}`;
  if (icon === "end") return "Has llegado a tu destino";
  if (icon === "uturn") return `Retorna hacia ${name}`;
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

/** v1.12.10: resultado del tramo local (flags del A* confiables en el
 *  sector cubierto; el inicio se ancla a la ubicación real del ciclista). */
function localResult(local: { route: NavRoute; aviso: string | null }, from: LatLng) {
  const route = attachOrigin(local.route, from);
  return {
    route: { ...route, cicloviaPct: cicloPctOf(route) },
    source: "local" as const,
    error: null,
    aviso: local.aviso,
  };
}

// ----------------------------------------------------------------
// OSRM bici
// ----------------------------------------------------------------

async function osrmRoute(from: LatLng, to: LatLng, vias: LatLng[] = []): Promise<NavRoute | null> {
  // radiuses=200; → el ORIGEN debe anclarse a una calle ciclable a ≤200 m
  // del pin. Sin este límite OSRM anclaba a ~700 m (p. ej. pin dentro del
  // Campus San Joaquín, sin calles ciclables) y el tramo pin→red salía
  // como un cordón recto que cruzaba las cuadras. El destino queda sin
  // límite (puede caer en senderos del parque). Los waypoints intermedios
  // (v1.12.10: rodeo del parque para destinos-acceso) aceptan 500 m.
  const pts = [from, ...vias, to];
  const coords = pts.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  const radiuses = ["200", ...vias.map(() => "500"), ""].join(";");
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&steps=true&alternatives=false&radiuses=${radiuses}`;
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

    // pasos → instrucciones; índice del vértice más cercano a cada maniobra.
    // v1.12.10: con waypoints intermedios hay varias legs — concatenar.
    const rawSteps = osrm.legs.flatMap((l) => l.steps ?? []);
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

/** Reglas de vía pavimento (idénticas a scripts/build-rutas.ts). */
const CLASES_PAVIMENTO = new Set([
  "living_street", "residential", "service", "unclassified",
  "tertiary", "tertiary_link", "secondary", "secondary_link",
  "primary", "primary_link",
]);
const NOMBRES_PERMITIDOS_PAV = [
  // todos los tramos del Paseo Metropolitano (incl. "Sendero de los
  // Sentidos", "Sendero Bellavista", "Sendero La Cascada") — es la espina
  // pavimentada oficial del parque
  /^Paseo Metropolitano/,
  // explanadas y miradores del ascenso Pío Nono → Plaza México (el grafo
  // OSM trae el camino con estos nombres locales, sin patrón común)
  /^Terraza Bellavista/,
  /^Explanada$/,
  /^Paseo Peatonal Cumbre/,
  /^Avenida /,
  /^Camino /,
  /^Antilen$/,
  /^Rotonda /,
  // puentes del grafo (explanadas de acceso; el enlace «sector Tupahue»
  // se eliminó por pedido del cliente: dibujaba una línea recta de 318 m)
  /^Acceso (Pedro de Valdivia Norte|La Pirámide)$/,
];

/** Vías pavimentadas nombradas del parque que también alimentan el
 *  corredor geométrico (para rescatar los conectores SIN nombre entre
 *  ellas, p. ej. entre Terraza Bellavista y Explanada). El ascenso Pío
 *  Nono → Plaza México pasa por "Sendero El Excursionista" (footway). */
const NOMBRES_RED_PAV_PARQUE = /^Paseo Metropolitano|^Terraza Bellavista|^Explanada$|^Paseo Peatonal Cumbre|^Sendero El Excursionista/;

/** Filtro pavimento para NAVEGACIÓN a destinos del parque (misma regla
 *  de las rutas pavimento predefinidas): Paseo Metropolitano, avenidas
 *  y caminos del cerro — NUNCA senderos peatonales ni senderos MTB.
 *  Sin esto el A* cortaba por senderos (path/footway 0.9-1.35 pesan
 *  menos que el pavimento pedestrian 1.1) y la ruta a Plaza México
 *  entraba por Sendero Zorro Vidal / El Hundimiento / Mapuche. */
export const PAV_DEST_OPTS = {
  allowedCls: CLASES_PAVIMENTO,
  nameAllow: NOMBRES_PERMITIDOS_PAV,
  // senderos nombrados fuera, EXCEPTO el tramo pavimentado del ascenso
  // ("Sendero El Excursionista", footway dentro del corredor — lo decide
  // corredorOk). nameBlock gana sobre edgeOk en edgePasses.
  // Carlos Reed: la calle del zoo tiene tramo pavimentado y tramo de
  // maicillo/tierra (Carlos Reed → PdV, 1,3 km) — para pavimento la
  // subida desde Pío Nono va SIEMPRE por Av. Alberto Mackenna (cliente,
  // 2026-11-12).
  nameBlock: [
    /^Sendero Ciclista /,
    /^Sendero (?!Ciclista)(?!El Excursionista)/,
    /^Ruta Nativa/,
    /^Avenida Carlos Reed/,
    /^Carlos Reed/,
    // Los 8 senderos peatonales del cliente (2026-11-13) fuera de la
    // navegación: «tenerlos bloqueados en las indicaciones».
    ...SEND_PEATONALES_BLOCK,
  ],
  edgeOk: corredorOk,
};

/** Respaldo si el pavimento estricto no conecta: agrega los senderos
 *  ciclistas oficiales (cycleway, "Sendero Ciclista …") pero igual
 *  excluye todo sendero peatonal (path/footway/track/pedestrian sin
 *  nombre y "Sendero …" no ciclista). */
export const PAV_DEST_RELAX = {
  allowedCls: new Set([...CLASES_PAVIMENTO, "cycleway"]),
  nameAllow: [...NOMBRES_PERMITIDOS_PAV, /^Sendero Ciclista/],
  nameBlock: [/^Sendero (?!Ciclista)(?!El Excursionista)/, /^Ruta Nativa/, ...SEND_PEATONALES_BLOCK],
  edgeOk: corredorOk,
};

// ----------------------------------------------------------------
// Corredor pavimentado del parque (rescate geométrico por arista)
// ----------------------------------------------------------------
// El grafo OSM trae los caminos de ascenso pavimentados del parque
// (p. ej. Acceso Pío Nono → Plaza México) como footway/pedestrian SIN
// nombre: un filtro solo de clases/nombres los bloquea y el A* terminaba
// dando la vuelta por Carlos Reed/Tupahue (4,7 km) o metiéndose por
// senderos (1,8 km). Rescate: se permite footway/pedestrian/service
// dentro de un corredor de 55 m sobre los trazados pavimento
// precomputados (GPX del cliente, RUTAS_TRAZADOS r1-r5) — la red
// pavimentada REAL del parque. Los senderos (path/track) y los
// "Sendero …" nombrados siguen bloqueados.

const CORREDOR_RADIO_M = 55;
let corredorGrid: Map<string, number[][]> | null = null;

/** Construye (una vez) la rejilla del corredor: trazados pavimento
 *  precomputados (GPX del cliente) + nodos de las vías pavimentadas
 *  nombradas del parque (el ascenso Pío Nono → Plaza México). `net` es
 *  opcional: si llega, la rejilla incluye la red nombrada real. */
export function corredorPav(net?: Network | null): Map<string, number[][]> {
  if (corredorGrid) return corredorGrid;
  const cell = 0.0004; // ≈ 44 m
  const grid = new Map<string, number[][]>();
  const key = (lat: number, lon: number) => `${Math.round(lat / cell)}:${Math.round(lon / cell)}`;
  const push = (lat: number, lon: number) => {
    const k = key(lat, lon);
    let arr = grid.get(k);
    if (!arr) grid.set(k, (arr = []));
    arr.push([lat, lon]);
  };
  for (const r of CAPA_RUTAS) {
    if (r.tipo !== "pavimento") continue;
    const t = RUTAS_TRAZADOS[r.trz];
    if (!t) continue;
    for (const [lat, lon] of t.coords) push(lat, lon);
  }
  if (!net) {
    // sin net: rejilla solo con trazados (se reconstruye si luego llega net;
    // NO se cachea para no bloquear la expansión completa del arranque con
    // la red real).
    return grid;
  }
  // Proyección contra LA MISMA rejilla en construcción (antes cada chequeo
  // re-entraba en corredorPav() y reconstruía la rejilla base desde cero:
  // cientos de miles de reconstrucciones ≈ 45 s congelando el hilo — el
  // «se queda pegado» al generar la primera ruta del cliente, 2026-11-12).
  const celdaEn = (lat: number, lon: number, radioM: number): boolean => {
    const ci = Math.round(lat / cell);
    const cj = Math.round(lon / cell);
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        const arr = grid.get(`${ci + di}:${cj + dj}`);
        if (!arr) continue;
        for (const [la, lo] of arr) {
          if (haversineM({ lat, lon }, { lat: la, lon: lo }) <= radioM) return true;
        }
      }
    return false;
  };
  for (const [a, b, , ni] of net.edges) {
    const name = net.names[ni] ?? "";
    if (!name || !NOMBRES_RED_PAV_PARQUE.test(name)) continue;
    push(net.nodes[a][0], net.nodes[a][1]);
    push(net.nodes[b][0], net.nodes[b][1]);
  }
  // Expansión transitiva ACOTADA: los conectores sin nombre entre las
  // vías del Paseo (y sus conectores) se agregan siguiendo el grafo,
  // rondas de crecimiento ~una arista. Incluye path/track sin nombre
  // (la cadena del ascenso Pío Nono → Plaza México intercala tramos
  // etiquetados path) con radio más justo; nunca "Sendero …" ni
  // "Ruta Nativa" nombrados (el corredor no abre senderos).
  for (let ronda = 0; ronda < 3; ronda++) {
    let agregados = 0;
    for (const [a, b, ci, ni] of net.edges) {
      const name = net.names[ni] ?? "";
      if (/^(Sendero (?!Ciclista)(?!El Excursionista)|Ruta Nativa)/.test(name)) continue;
      const cls = net.classes[ci];
      const esCamino = cls === "footway" || cls === "pedestrian" || cls === "service";
      const esSenda = cls === "path" || cls === "track";
      if (!esCamino && !esSenda) continue;
      const pa = net.nodes[a];
      const pb = net.nodes[b];
      const mid = { lat: (pa[0] + pb[0]) / 2, lon: (pa[1] + pb[1]) / 2 };
      if (!celdaEn(mid.lat, mid.lon, esCamino ? 45 : 30)) continue;
      if (!celdaEn(pa[0], pa[1], 0.001)) { push(pa[0], pa[1]); agregados++; }
      if (!celdaEn(pb[0], pb[1], 0.001)) { push(pb[0], pb[1]); agregados++; }
    }
    if (!agregados) break;
  }
  corredorGrid = grid;
  return grid;
}

/** ¿El punto cae dentro del corredor pavimentado del parque? */
export function enCorredorPav(midLat: number, midLon: number, radioM = CORREDOR_RADIO_M): boolean {
  const cell = 0.0004;
  const grid = corredorPav();
  const ci = Math.round(midLat / cell);
  const cj = Math.round(midLon / cell);
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++) {
      const arr = grid.get(`${ci + di}:${cj + dj}`);
      if (!arr) continue;
      for (const [la, lo] of arr) {
        if (haversineM({ lat: midLat, lon: midLon }, { lat: la, lon: lo }) <= radioM) return true;
      }
    }
  return false;
}

/** Clases que puede rescate el corredor: caminos pavimentados y sus
 *  tramos sin nombre. path/track solo con radio más justo (la cadena del
 *  ascenso intercala tramos etiquetados path — sin ellos la cadena se
 *  corta y el A* da la vuelta por el norte del parque). */
const CLASES_CORREDOR = new Set(["footway", "pedestrian", "service"]);
const CLASES_CORREDOR_AJUSTADO = new Set(["footway", "pedestrian", "service", "path", "track"]);
const RADIO_AJUSTADO_M = 22;

/** Caja del Parque Metropolitano Pedro de Valdivia Norte (parque plano
 *  con la CicloRecreoVía, entre Av. El Cerro y la ladera del cerro).
 *  Sus caminos pavimentados son el acceso ciclista PdV Norte real. */
const PDV_NORTE_BOX = { latMin: -33.4178, latMax: -33.4116, lonMin: -70.6112, lonMax: -70.6055 };

function enParquePdvNorte(lat: number, lon: number): boolean {
  return lat >= PDV_NORTE_BOX.latMin && lat <= PDV_NORTE_BOX.latMax && lon >= PDV_NORTE_BOX.lonMin && lon <= PDV_NORTE_BOX.lonMax;
}

/** edgeOk compartido: caminos del parque que el grafo trae sin nombre
 *  (o con nombres sueltos tipo "Explanada") dentro del corredor del
 *  Paseo. Los "Sendero …" nombrados sólo pasan si son footway (pavimento
 *  en OSM) y caen dentro del corredor: es el caso del tramo del ascenso
 *  Pío Nono → Plaza México etiquetado "Sendero El Excursionista".
 *  Excepción geométrica aparte: el Parque Metropolitano Pedro de
 *  Valdivia Norte (parque plano de la CicloRecreoVía sobre Av. El
 *  Cerro), cuyos caminos pavimentados también aparecen sin nombre y
 *  están fuera del corredor de los trazados. */
export function corredorOk(midLat: number, midLon: number, cls: string, name: string): boolean {
  if (/^Sendero /.test(name)) return cls === "footway" && enCorredorPav(midLat, midLon, 30);
  if (enParquePdvNorte(midLat, midLon)) {
    return CLASES_CORREDOR.has(cls) || cls === "cycleway"; // CicloRecreoVía incl.
  }
  if (CLASES_CORREDOR.has(cls)) return enCorredorPav(midLat, midLon);
  if (CLASES_CORREDOR_AJUSTADO.has(cls)) return enCorredorPav(midLat, midLon, RADIO_AJUSTADO_M);
  return false;
}

/** Test "dentro del parque" con tolerancia configurable (por defecto
 *  80 m: los accesos quedan sobre el borde del polígono). Con 0 queda
 *  la prueba ESTRICTA (solo el polígono) para el filtro de accesos. */
export function parkInsideTest(toleranciaM = 80): (lat: number, lon: number) => boolean {
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
  return (lat: number, lon: number) => inPoly(lat, lon) || distToPolyM(lat, lon) <= toleranciaM;
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
 *
 * EXCEPCIÓN accesoDirecto (v1.12.8, minimapa «Ir a»): cuando el
 * destino ES uno de los 4 accesos, la portería se trata como punto
 * de calle y la ruta va DIRECTA por la vía pública — la normativa
 * de ingreso aplica a destinos dentro del parque, no a la puerta
 * misma. Antes el destino-acceso caía «dentro» por la tolerancia de
 * 80 m del borde y se entraba por Pío Nono para llegar a Valdivia.
 */
/** Opciones de trazado (v1.12.11 reglas de accesos, cliente 2026-11-15). */
export type OptsRoute = {
  /** Destino = portería: ruta por la vía pública SIN ingresar al cerro. */
  accesoDirecto?: boolean;
  /** Regla F3 «ingresar»: llega a la portería y se extiende ~130 m hacia
   *  adentro por el camino pavimentado del acceso. */
  ingresoExtendido?: boolean;
  /** Regla D2/D3 «salir por»: destino fuera del cerro, dos tramos
   *  (interior hasta esta portería → exterior hasta el destino). */
  salidaPor?: LatLng;
  salidaNombre?: string;
};

export async function computeRoute(from: LatLng, to: LatLng, opts?: OptsRoute): Promise<RouteResult> {
  const net = await loadNetwork();
  if (net) {
    // calienta la rejilla del corredor con la red real (vías pavimentadas
    // nombradas del parque — ascenso Pío Nono → Plaza México)
    corredorPav(net);
    const inside = parkInsideTest();
    // «ingresar» (F3) reutiliza el camino del acceso directo: llega a la
    // portería por la vía pública y luego se extiende hacia adentro.
    const accDirecto = opts?.accesoDirecto === true || opts?.ingresoExtendido === true;
    const destInPark = !accDirecto && inside(to.lat, to.lon);
    const fromInPark = inside(from.lat, from.lon);
    // Reglas direccionales del cliente: Pío Nono sólo subida (24/7) y
    // corte horario de la cumbre por el puente de Tupahue (FDS ≥ 13:30)
    const dirOk = crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: corteCumbreActivo() });
    // v1.12.11 D2/D3: destino FUERA de las geocercas y salida por una
    // portería concreta (la más cercana al destino, o la elegida en el
    // popup): tramo interior hasta el acceso (pavimento) + tramo exterior
    // por la vía pública hasta el destino.
    if (opts?.salidaPor && fromInPark) {
      const g = opts.salidaPor;
      const gNombre = opts.salidaNombre ?? "el acceso ciclista";
      const leg1 =
        findRoute(net, from, g, { nodeOk: inside, ...PAV_DEST_OPTS, edgeDirOk: dirOk }) ??
        findRoute(net, from, g, { nodeOk: inside, ...PAV_DEST_RELAX, edgeDirOk: dirOk });
      if (leg1) {
        const leg2 = await rutaExterna(net, g, to, dirOk);
        if (leg2) {
          const merged = mergeLegs(leg1, leg2, `Sales por ${gNombre} · salida oficial de ciclistas`);
          return localResult({ route: merged, aviso: null }, from);
        }
      }
      // sin conexión interior/exterior por esa portería: flujo normal
    }
    if (destInPark && !fromInPark) {
      const acc = accesoMasCercano(from);
      // tramo 1: hasta el acceso (ciudad; local si cubre, OSRM si no)
      let leg1: NavRoute | null = null;
      const a = snapInfo(net, from);
      if (a.distM <= ORIGIN_COVER_M) leg1 = findRoute(net, from, acc.position);
      if (!leg1) leg1 = await osrmRoute(from, acc.position);
      // tramo 2: del acceso al destino, SOLO por dentro del parque y por
      // pavimento (Paseo Metropolitano/avenidas) — sin senderos peatonales
      let leg2: NavRoute | null = null;
      if (leg1) {
        leg2 = findRoute(net, acc.position, to, { nodeOk: inside, ...PAV_DEST_OPTS, edgeDirOk: dirOk });
        if (!leg2) leg2 = findRoute(net, acc.position, to, { nodeOk: inside, ...PAV_DEST_RELAX, edgeDirOk: dirOk });
      }
      if (leg1) {
        const merged = rutaLocalConCorte(from, to, (d) => {
          const l2 =
            findRoute(net, acc.position, d, { nodeOk: inside, ...PAV_DEST_OPTS, edgeDirOk: dirOk }) ??
            findRoute(net, acc.position, d, { nodeOk: inside, ...PAV_DEST_RELAX, edgeDirOk: dirOk });
          return l2 ? mergeLegs(leg1, l2, `Ingresa por ${acc.nombre} · ingreso oficial de ciclistas`) : null;
        });
        if (merged) {
          const route = { ...merged.route, cicloviaPct: cicloPctOf(merged.route) };
          return { route, source: "local", error: null, aviso: merged.aviso };
        }
      }
      // si la cadena por el acceso falla, cae al flujo normal (abajo)
    }
    const b = snapInfo(net, to);
    const a = snapInfo(net, from);
    if (a.distM <= ORIGIN_COVER_M && b.distM <= GRAPH_COVER_M) {
      if (destInPark) {
        // destino dentro del cerro: pavimento del parque (sin senderos
        // peatonales), con respaldo que agrega senderos ciclistas
        const local = rutaLocalConCorte(
          from,
          to,
          (d: LatLng) =>
            findRoute(net, from, d, { ...PAV_DEST_OPTS, edgeDirOk: dirOk }) ??
            findRoute(net, from, d, { ...PAV_DEST_RELAX, edgeDirOk: dirOk }),
        );
        if (local) return localResult(local, from);
      } else if (accDirecto && !fromInPark) {
        // v1.12.9: destino = acceso ciclista (minimapa/buscador) y estás
        // fuera: la ruta NO puede meterse al parque para salir por la
        // portería (nodos interiores excluidos, salvo los cercanos a la
        // portería — su nodo queda al borde). Antes el A* tomaba el atajo
        // por dentro (Zapadores → La Pirámide: 79% del trazado dentro).
        // v1.12.11 F3 «ingresar»: además se extiende ~130 m hacia adentro.
        const local = trazarAccesoLocal(net, from, to, dirOk);
        if (local) {
          return localResult(opts?.ingresoExtendido ? extenderInteriorEn(net, local, to, dirOk) : local, from);
        }
      } else {
        const local = rutaLocalConCorte(from, to, (d: LatLng) => findRoute(net, from, d, undefined));
        if (local) return localResult(local, from);
      }
    }
  }

  let r = await osrmRoute(from, to);
  // «ingresar»/acceso directo fuera del alcance del grafo local (recalculado:
  // accDirecto vive dentro del bloque if (net), aquí puede ser null la red).
  const accDirectoOsrm = opts?.accesoDirecto === true || opts?.ingresoExtendido === true;
  if (r && accDirectoOsrm && !parkInsideTest()(from.lat, from.lon) && metrosInteriorParque(r, to) > 150) {
    // v1.12.10: destino = acceso ciclista, estás fuera del parque y el
    // grafo local no cubre el origen (ej. centro de Santiago → La
    // Pirámide) — OSRM se metería al cerro como atajo entrando por Pío
    // Nono. Ruta HÍBRIDA: OSRM lleva solo hasta un nodo ANCLA del grafo
    // (tramo corto de calle: no puede cruzar el parque) y desde ahí el
    // grafo local con el filtro de parque completa hasta la portería.
    const netH = await loadNetwork();
    const dirOkH = netH ? crearDirOk(netH, { pioNonoSoloSubida: true, corteCumbre: corteCumbreActivo() }) : null;
    if (netH && dirOkH) {
      const si = snapInfo(netH, from);
      const anchorPos: LatLng = { lat: netH.nodes[si.idx][0], lon: netH.nodes[si.idx][1] };
      const head = si.distM <= 3000 ? await osrmRoute(from, anchorPos) : null;
      const tail = head && metrosInteriorParque(head, to) <= 150 ? trazarAccesoLocal(netH, anchorPos, to, dirOkH) : null;
      if (head && tail) {
        const headFlags = flagsFromLocalNet(netH, head.coords);
        let combinada = concatenarRutas({ ...head, flags: headFlags }, tail.route);
        let aviso = tail.aviso;
        // v1.12.11 F3 «ingresar»: extensión interior desde la portería.
        if (opts?.ingresoExtendido) {
          const ext = extenderInterior(netH, to, dirOkH);
          if (ext) {
            combinada = concatenarRutas(combinada, ext);
            aviso = `Ingresas al cerro por ${accesoMasCercano(to).nombre}`;
          }
        }
        return localResult({ route: combinada, aviso }, from);
      }
    }
    // último recurso: OSRM con waypoints de rodeo por fuera del borde
    const r0 = r;
    const vias: LatLng[] = [];
    let ultimo: NavRoute | null = null;
    for (let intento = 0; intento < 3 && metrosInteriorParque(ultimo ?? r0, to) > 150; intento++) {
      const via = viaExternaParque(ultimo ?? r0, to);
      if (!via) break;
      vias.push(via);
      const r2 = await osrmRoute(from, to, vias);
      if (!r2) break;
      ultimo = r2;
    }
    if (ultimo && metrosInteriorParque(ultimo, to) <= metrosInteriorParque(r0, to)) r = ultimo;
  }
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

/** v1.12.10: metros recorridos dentro del polígono del parque (prueba
 *  estricta del borde), sin contar la aproximación a la propia portería
 *  destino (±150 m). Detecta rutas OSRM que usan el parque como atajo
 *  cuando el destino es una portería. */
function metrosInteriorParque(route: NavRoute, dest: LatLng): number {
  const estricto = parkInsideTest(0);
  let m = 0;
  for (let i = 0; i < route.coords.length - 1; i++) {
    const a = route.coords[i];
    if (estricto(a.lat, a.lon) && haversineM(a, dest) > 150) m += haversineM(a, route.coords[i + 1]);
  }
  return m;
}

/** v1.12.10: waypoint de «rodeo» para que OSRM no cruce el parque: toma
 *  el primer punto interior de la ruta que se mete al cerro, lo proyecta
 *  al borde del polígono y lo empuja 450 m hacia afuera (dirección
 *  centroide→borde). Con ese punto intermedio la ruta rodea por la vía
 *  pública. */
function viaExternaParque(route: NavRoute, dest: LatLng): LatLng | null {
  const estricto = parkInsideTest(0);
  let p: LatLng | null = null;
  for (const c of route.coords) {
    if (estricto(c.lat, c.lon) && haversineM(c, dest) > 150) { p = c; break; }
  }
  if (!p) return null;
  let cy = 0, cx = 0;
  for (const v of PARK_POLYGON) { cy += v.lat; cx += v.lon; }
  cy /= PARK_POLYGON.length; cx /= PARK_POLYGON.length;
  // proyección del punto sobre cada arista del polígono (metros locales)
  const R = 111320;
  const k = Math.cos((p.lat * Math.PI) / 180);
  const px = p.lon * R * k, py = p.lat * R;
  let qx = 0, qy = 0, bd = Infinity;
  for (let i = 0; i < PARK_POLYGON.length; i++) {
    const v1 = PARK_POLYGON[i];
    const v2 = PARK_POLYGON[(i + 1) % PARK_POLYGON.length];
    const ax = v1.lon * R * k, ay = v1.lat * R;
    const bx = v2.lon * R * k, by = v2.lat * R;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    const ex = ax + t * dx, ey = ay + t * dy;
    const d = (px - ex) ** 2 + (py - ey) ** 2;
    if (d < bd) { bd = d; qx = ex; qy = ey; }
  }
  // hacia afuera: del centroide al punto del borde, 450 m más allá
  let ox = qx - cx * R * k, oy = qy - cy * R;
  const len = Math.hypot(ox, oy) || 1;
  ox /= len; oy /= len;
  const fx = qx + ox * 450, fy = qy + oy * 450;
  return { lat: fy / R, lon: fx / (R * k) };
}

/** v1.12.10: traza LOCAL la ruta a un acceso ciclista quedando FUERA del
 *  parque (nodos interiores excluidos, salvo los cercanos a la portería —
 *  su nodo queda al borde). `origen` puede ser el punto real del ciclista
 *  o un nodo ANCLA del grafo cuando el origen está lejos de la cobertura
 *  local (ruta híbrida OSRM→ancla→portería). */
/** v1.12.11 F3 «ingresar»: extiende la ruta hasta la portería con un
 *  tramo interior de ~130 m por el camino pavimentado del acceso — el
 *  ciclista llega ya dentro del cerro. Si el grafo no conecta hacia
 *  adentro, se queda en la portería (sin error: la ruta sigue siendo válida). */
function extenderInteriorEn(
  net: Network,
  local: { route: NavRoute; aviso: string | null },
  gatePos: LatLng,
  dirOk: ReturnType<typeof crearDirOk>,
): { route: NavRoute; aviso: string | null } {
  const ext = extenderInterior(net, gatePos, dirOk);
  if (!ext) return local;
  const nombre = accesoMasCercano(gatePos).nombre;
  return { route: concatenarRutas(local.route, ext), aviso: `Ingresas al cerro por ${nombre}` };
}

/** Tramo interior de ~130 m desde la portería hacia el centroide del
 *  parque (dirección aproximada «hacia adentro»). Sólo caminos de
 *  pavimento (corredor) y nodos dentro de la geocerca; si el resultado
 *  supera 500 m se descarta (el A* habría entrado por otro lado). */
function extenderInterior(net: Network, gatePos: LatLng, dirOk: ReturnType<typeof crearDirOk>): NavRoute | null {
  let cy = 0, cx = 0;
  for (const v of PARK_POLYGON) {
    cy += v.lat;
    cx += v.lon;
  }
  cy /= PARK_POLYGON.length;
  cx /= PARK_POLYGON.length;
  const EXT_M = 130;
  const dLat = cy - gatePos.lat;
  const dLon = cx - gatePos.lon;
  const norm = Math.hypot(dLat, dLon) || 1;
  const interior: LatLng = {
    lat: gatePos.lat + (dLat / norm) * (EXT_M / 111320),
    lon: gatePos.lon + (dLon / norm) * (EXT_M / (111320 * Math.cos((gatePos.lat * Math.PI) / 180))),
  };
  const nodeOk = parkInsideTest();
  const ext =
    findRoute(net, gatePos, interior, { nodeOk, ...PAV_DEST_OPTS, edgeDirOk: dirOk }) ??
    findRoute(net, gatePos, interior, { nodeOk, ...PAV_DEST_RELAX, edgeDirOk: dirOk });
  if (!ext || ext.distanceM > 500) return null;
  return ext;
}

/** v1.12.11: tramo EXTERIOR desde una portería hasta un destino fuera
 *  del cerro (reglas D2/D3). Primero el grafo local evitando el interior
 *  (trazarAccesoLocal); si el destino escapa al grafo, OSRM con control
 *  de reingreso al parque (ancla = la portería) y waypoints de rodeo,
 *  el mismo mecanismo del acceso directo v1.12.10. */
async function rutaExterna(
  net: Network,
  gatePos: LatLng,
  dest: LatLng,
  dirOk: ReturnType<typeof crearDirOk>,
): Promise<NavRoute | null> {
  const local = trazarAccesoLocal(net, gatePos, dest, dirOk);
  if (local) return local.route;
  const b = snapInfo(net, dest);
  if (b.distM <= GRAPH_COVER_M) return findRoute(net, gatePos, dest);
  let r = await osrmRoute(gatePos, dest);
  if (!r) return null;
  if (metrosInteriorParque(r, gatePos) > 150) {
    const vias: LatLng[] = [];
    const r0 = r;
    let ultimo: NavRoute | null = null;
    for (let intento = 0; intento < 3 && metrosInteriorParque(ultimo ?? r0, gatePos) > 150; intento++) {
      const via = viaExternaParque(ultimo ?? r0, gatePos);
      if (!via) break;
      vias.push(via);
      const r2 = await osrmRoute(gatePos, dest, vias);
      if (!r2) break;
      ultimo = r2;
    }
    if (ultimo && metrosInteriorParque(ultimo, gatePos) <= metrosInteriorParque(r0, gatePos)) r = ultimo;
  }
  return r;
}

function trazarAccesoLocal(
  net: Network,
  origen: LatLng,
  to: LatLng,
  dirOk: ReturnType<typeof crearDirOk>,
): { route: NavRoute; aviso: string | null } | null {
  const a = snapInfo(net, origen);
  const b = snapInfo(net, to);
  if (a.distM > ORIGIN_COVER_M || b.distM > GRAPH_COVER_M) return null;
  const estricto = parkInsideTest(0);
  const filtro = (lat: number, lon: number) => !estricto(lat, lon) || haversineM({ lat, lon }, to) <= 120;
  const trazarDirecto = (d: LatLng) =>
    findRoute(net, origen, d, { nodeOk: filtro, edgeDirOk: dirOk }) ??
    findRoute(net, origen, d, { nodeOk: filtro });
  return rutaLocalConCorte(origen, to, trazarDirecto);
}

/** v1.12.10: une la cabeza OSRM (origen → nodo ancla) con la cola local
 *  (ancla → portería por fuera del parque): coords, flags, pasos (con el
 *  desplazamiento de índice) y nombres de vía. */
function concatenarRutas(head: NavRoute, tail: NavRoute): NavRoute {
  const off = head.coords.length - 1;
  const totalM = head.distanceM + tail.distanceM;
  return {
    coords: [...head.coords, ...tail.coords.slice(1)],
    distanceM: Math.round(totalM),
    steps: [
      ...head.steps.filter((s) => s.icon !== "end"),
      ...tail.steps.filter((s) => s.icon !== "start").map((s) => ({ ...s, idx: s.idx + off })),
    ],
    cicloviaPct: 0,
    etaMin: Math.max(1, Math.round((totalM / 1000 / 15) * 60)),
    flags: [...head.flags, ...tail.flags],
    segNames: [...head.segNames, ...tail.segNames],
  };
}

/** Tramo de ciudad OSRM GARANTIZADO por fuera del parque (cliente
 *  2026-11-15: «me marca con ingreso al cerro y debe ser por fuera, así
 *  como la ruta 1 y 2 parten del acceso»). OSRM no conoce la geocerca y
 *  a veces ataja POR DENTRO del parque (ej.: Bellavista → La Pirámide
 *  entrando por Pío Nono y subiendo por el borde interior). Mismo control
 *  de reingreso del acceso directo v1.12.10: si el OSRM trae >150 m de
 *  interior antes de la llegada, se re-traza con waypoints de rodeo
 *  (viaExternaParque); si aún insiste, respaldo del grafo local con el
 *  interior bloqueado (`nodeOk`, salvo la boca de la portería). */
async function osrmCiudadPorFuera(
  from: LatLng,
  to: LatLng,
  net: Network,
  nodeOk?: (lat: number, lon: number) => boolean,
): Promise<NavRoute | null> {
  const dentro = (r: NavRoute) => metrosInteriorParque(r, to) > 150;
  const r0 = await osrmRoute(from, to);
  if (r0 && dentro(r0)) {
    const vias: LatLng[] = [];
    let ultimo: NavRoute | null = null;
    for (let intento = 0; intento < 3 && dentro(ultimo ?? r0); intento++) {
      const via = viaExternaParque(ultimo ?? r0, to);
      if (!via) break;
      // si el nuevo waypoint coincide con uno ya usado, otra vuelta no
      // cambia nada (OSRM devolvería la misma ruta): cortar aquí
      if (vias.some((v) => haversineM(v, via) < 30)) break;
      vias.push(via);
      const r2 = await osrmRoute(from, to, vias);
      if (!r2) break;
      ultimo = r2;
    }
    if (ultimo && !dentro(ultimo)) return ultimo;
    // OSRM insiste en cruzar el cerro: respaldo local SOLO por calles de
    // la ciudad (los nodos del interior quedan excluidos por nodeOk).
    if (nodeOk) {
      const a = snapInfo(net, from);
      if (a.distM <= ORIGIN_COVER_M) return findRoute(net, from, to, { nodeOk });
    }
  }
  if (!r0 && nodeOk) {
    const a = snapInfo(net, from);
    if (a.distM <= ORIGIN_COVER_M) return findRoute(net, from, to, { nodeOk });
  }
  return r0;
}

/** Ruta HÍBRIDA ciudad → portería, POR FUERA del parque, para orígenes
 *  lejos de la cobertura del grafo local (mismo mecanismo v1.12.10 del
 *  acceso directo en computeRoute): OSRM lleva SOLO hasta el nodo ANCLA
 *  del grafo más cercano al origen (tramo corto de calle, validado contra
 *  la geocerca) y desde ahí el grafo local con el interior bloqueado
 *  completa hasta la portería (trazarAccesoLocal). Garantiza el «por
 *  fuera» también cuando el origen queda a >250 m de un nodo (caso
 *  Bellavista → La Pirámide: el OSRM completo trae ~5 km por dentro del
 *  parque y el rodeo con waypoints no lo corrige). Si la cabeza OSRM sale
 *  sucia o el grafo no conecta, cae a osrmCiudadPorFuera. */
async function hibridaCiudadPorFuera(
  from: LatLng,
  to: LatLng,
  net: Network,
  dirOk: ReturnType<typeof crearDirOk>,
  nodeOk?: (lat: number, lon: number) => boolean,
): Promise<NavRoute | null> {
  const si = snapInfo(net, from);
  if (si.distM > 3000) return osrmCiudadPorFuera(from, to, net, nodeOk);
  const anchorPos: LatLng = { lat: net.nodes[si.idx][0], lon: net.nodes[si.idx][1] };
  const head = await osrmRoute(from, anchorPos);
  if (head && metrosInteriorParque(head, to) <= 150) {
    const tail = trazarAccesoLocal(net, anchorPos, to, dirOk);
    if (tail) return concatenarRutas(head, tail.route);
  }
  return osrmCiudadPorFuera(from, to, net, nodeOk);
}

// ----------------------------------------------------------------
// Rutas predefinidas del mapa («generar ruta» en la capa Rutas)
// ----------------------------------------------------------------

/**
 * Genera la ruta para una ruta predefinida del mapa (botón «Ruta» de la
 * capa Rutas). REGLA DEL CLIENTE (2026-11-12): «el botón ruta tenga el
 * mismo trazado del botón ver» — la navegación recorre SIEMPRE el trazado
 * precomputado COMPLETO (el mismo que dibuja «Ver»), nunca un tramo A*
 * que lo reemplace o lo recorte:
 *   1. tramo de ciudad POR FUERA del parque (sin ingresar al cerro):
 *      mi ubicación → inicio del trazado cuando este es un acceso
 *      ciclista (r1-r5 nacen en la portería); si el trazado nace dentro
 *      del parque (MTB), acceso ciclista más cercano (solo si estoy
 *      fuera del parque). Cliente 2026-11-15: «debe ser por fuera, así
 *      como la ruta 1 y 2 parten del acceso»
 *   2. tramo interno: acceso/origen → inicio del trazado, por caminos
 *      del parque (pavimento sin senderos MTB · MTB sin restricción);
 *      si no se logra, se muestra el trazado completo desde su inicio
 *   3. trazado precomputado COMPLETO de la ruta elegida
 * `fullTrace` (generación inicial) nunca recorta el trazado; en el
 * RECALCULO por desvío se sigue el trazado desde el punto más cercano
 * hacia adelante (comportamiento de navegación en marcha).
 */
export async function computePresetRoute(
  from: LatLng,
  preset: { rutaId: string; nombre: string },
  gen?: { fullTrace?: boolean }
): Promise<RouteResult> {
  const fullTrace = gen?.fullTrace ?? false;
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
  corredorPav(net); // corredor con la red real (conectores sin nombre del ascenso)
  const inside = parkInsideTest();
  const fromInPark = inside(from.lat, from.lon);
  // Reglas direccionales del cliente: Pío Nono sólo subida (24/7) y corte
  // horario de la cumbre (FDS ≥ 13:30) en el tramo interno (acceso → trazado)
  const dirOk = crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: corteCumbreActivo() });
  const opts = {
    nodeOk: inside,
    edgeDirOk: dirOk,
    // Senderos peatonales bloqueados en TODOS los reroutes (cliente
    // 2026-11-13: «tenerlos bloqueados en las indicaciones») — incluido
    // MTB, cuyo único límite son esos 8 senderos.
    nameBlock: SEND_PEATONALES_BLOCK,
    ...(ruta.tipo === "pavimento"
      ? { allowedCls: CLASES_PAVIMENTO, nameAllow: NOMBRES_PERMITIDOS_PAV, nameBlock: [/^Sendero Ciclista /, ...SEND_PEATONALES_BLOCK], edgeOk: corredorOk }
      : {}),
  };

  // 1. tramo de ciudad (si estoy fuera). REGLA DEL CLIENTE (2026-11-12):
  //    «el botón ruta tenga el mismo trazado del botón ver» — cuando el
  //    trazado nace en una portería ciclista (r1-r5), el tramo de ciudad
  //    llega POR CALLES DE LA CIUDAD hasta esa portería (sin cruzar el
  //    parque), así DENTRO del parque se recorre exactamente el trazado
  //    de «Ver» y nada más. MTB (nace dentro del parque): acceso ciclista
  //    más cercano y tramo interno (paso 2).
  let legAcceso: NavRoute | null = null;
  let acceso: { nombre: string; position: LatLng } | null = null;
  if (!fromInPark) {
    const inicioTrace = trace[0];
    const gateInicio = ACCESOS_CICLISTAS.find((g) => haversineM(g.position, inicioTrace) <= 120);
    acceso = gateInicio
      ? { nombre: gateInicio.name, position: inicioTrace }
      : accesoMasCercano(from);
    const a = snapInfo(net, from);
    if (gateInicio) {
      // Ciudad → portería donde nace el trazado, SIEMPRE POR FUERA del
      // parque (cliente 2026-11-15: «me marca con ingreso al cerro y debe
      // ser por fuera, así como la ruta 1 y 2 parten del acceso»).
      // Medido 2026-11-15: el OSRM crudo Bellavista→La Pirámide trae ~5 km
      // POR DENTRO del parque (entra por Pío Nono y sube por el borde) y
      // ni el rodeo con waypoints lo corrige. Orden:
      //   1º grafo local directo (origen cubierto): interior bloqueado
      //      salvo la boca de la portería;
      //   2º híbrido v1.12.10 (origen lejos del grafo): OSRM SOLO hasta el
      //      nodo ancla + grafo local hasta la portería;
      //   3º OSRM completo con control de reingreso y respaldo local
      //      (osrmCiudadPorFuera, último recurso).
      const cityOk = (lat: number, lon: number) =>
        !inside(lat, lon) || haversineM({ lat, lon }, inicioTrace) <= 150;
      if (a.distM <= ORIGIN_COVER_M) {
        legAcceso = findRoute(net, from, acceso.position, { nodeOk: cityOk });
      }
      if (!legAcceso) legAcceso = await hibridaCiudadPorFuera(from, acceso.position, net, dirOk, cityOk);
    } else {
      // MTB (nace dentro del parque): acceso ciclista más cercano, también
      // POR FUERA hasta esa portería (mismo criterio del cliente).
      const cityOkM = (lat: number, lon: number) =>
        !inside(lat, lon) || haversineM({ lat, lon }, acceso!.position) <= 150;
      if (a.distM <= ORIGIN_COVER_M) legAcceso = findRoute(net, from, acceso.position, { nodeOk: cityOkM });
      if (!legAcceso) legAcceso = await hibridaCiudadPorFuera(from, acceso.position, net, dirOk, cityOkM);
    }
    if (!legAcceso) {
      return {
        route: null,
        source: null,
        error: "No pudimos trazar la ruta hasta el acceso ciclista más cercano.",
      };
    }
  }

  // 2. recálculo por desvío (SOLO en marcha, nunca al generar): si ya voy
  //    DENTRO del parque y estoy sobre el trazado, sigo el trazado desde
  //    el punto más cercano hacia adelante; al GENERAR (fullTrace) el
  //    trazado se recorre COMPLETO desde su inicio (cliente: «el botón
  //    ruta tenga el mismo trazado del botón ver»).
  const traceCoordsFull = trace;
  let joinIdx = -1;
  if (fromInPark && !fullTrace) {
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
      // respaldo: sin restricción de vía (mantiene la regla de parque y la
      // direccionalidad: Pío Nono sólo subida y corte horario cumbre)
      legInterno = findRoute(net, origenInterno, traceCoordsFull[0], { nodeOk: inside, edgeDirOk: dirOk, nameBlock: SEND_PEATONALES_BLOCK });
    }
  }
  // Sin conexión hasta el inicio del trazado: la ruta se muestra COMPLETA
  // desde su comienzo (mismo trazado que «Ver») y se avisa.
  const avisoConexion =
    joinIdx < 0 && !yaEnInicio && !legInterno
      ? "No pudimos trazar la conexión hasta el inicio de la ruta; te mostramos el trazado completo desde su comienzo."
      : null;

  // 3. trazado precomputado (desde el punto de empalme si lo hay).
  // Corte horario activo: si el trazado TERMINA en la cara cumbre (más
  // cerca de Plaza México que el puente) y pasa por el puente de Tupahue,
  // se trunca en el puente con VUELTA EN U (el resto del trazado queda
  // tras el corte). Rutas que bajan a PdV (r3) no se tocan: su fin queda
  // en la cara Tupahue.
  let traceCoords = joinIdx >= 0 ? traceCoordsFull.slice(joinIdx) : traceCoordsFull;
  let avisoCorte: string | null = null;
  if (corteCumbreActivo()) {
    const finCumbre = haversineM(traceCoords[traceCoords.length - 1], PLAZA_MEXICO_POS) < haversineM(PLAZA_MEXICO_POS, PUENTE_TUPAHUE_CUMBRE);
    if (finCumbre) {
      let idxPuente = -1;
      let bd = Infinity;
      for (let i = 0; i < traceCoords.length; i++) {
        const d = haversineM(traceCoords[i], PUENTE_TUPAHUE_CUMBRE);
        if (d < bd) {
          bd = d;
          idxPuente = i;
        }
      }
      if (idxPuente >= 0 && bd <= 200 && idxPuente < traceCoords.length - 3) {
        const vuelta = conVueltaEnU(traceCoords.slice(0, idxPuente + 1));
        traceCoords = vuelta.coords;
        avisoCorte = `Fuera de horario (fines de semana y festivos desde 13:30): el acceso a la cumbre por Tupahue está cerrado. Esta ruta termina en el puente con vuelta en U. Alternativas según tu posición: ${opcionesAlternativas(from)}.`;
      }
    }
  }
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
  if (joinIdx < 0 && coords.length > 0) {
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
    text: avisoCorte ? "Fin de la ruta en el puente de Tupahue (corte horario)" : `Fin de ${preset.nombre}`,
    distM: 0,
    point: coords[coords.length - 1],
    idx: coords.length - 1,
  });

  if (avisoCorte) {
    steps.splice(steps.length - 1, 0, {
      icon: "straight",
      text: "Vuelta en U: acceso a la cumbre restringido desde las 13:30 (fin de semana y festivos)",
      distM: 0,
      point: coords[coords.length - 1],
      idx: coords.length - 1,
    });
  }
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
  return { route, source: "local", error: null, aviso: avisoCorte ?? avisoConexion };
}
