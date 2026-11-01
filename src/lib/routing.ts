// ============================================================
// Navegación tipo Waze sobre el grafo OSM del sector
// (public/red-ciclista.json): A* con penalización por clase de
// vía → prefiere ciclovías y calles tranquilas.
// ============================================================

export type NetNode = [number, number]; // [lat, lon]
export type NetEdge = [number, number, number, number, 0 | 1]; // [a,b,classIdx,nameIdx,ciclovia]

export type Network = {
  classes: string[];
  names: string[];
  nodes: NetNode[];
  edges: NetEdge[];
  cicloviaPolylines: number[][];
  // estructuras derivadas
  adj: Array<Array<{ to: number; w: number; dist: number; cls: string; name: string; ciclovia: boolean; bearing: number }>>;
};

export type RouteStep = { icon: "start" | "left" | "right" | "straight" | "end"; text: string; distM: number; point: LatLng; idx: number };
export type NavRoute = {
  coords: LatLng[];
  distanceM: number;
  steps: RouteStep[];
  cicloviaPct: number;
  etaMin: number;
  /** Por tramo i (coords[i]→coords[i+1]): ¿es ciclovía? */
  flags: boolean[];
  /** Nombre de la vía de cada tramo (para la píldora de calle actual). */
  segNames: string[];
};

export type LatLng = { lat: number; lon: number };

const PENALTY: Record<string, number> = {
  cycleway: 0.65,
  path: 0.9,
  footway: 1.35,
  pedestrian: 1.1,
  track: 1.0,
  living_street: 0.95,
  residential: 0.95,
  service: 1.05,
  unclassified: 1.0,
  tertiary: 1.15,
  tertiary_link: 1.2,
  secondary: 1.5,
  secondary_link: 1.5,
  primary: 2.4,
  primary_link: 2.4,
};

const CLASS_LABEL: Record<string, string> = {
  cycleway: "ciclovía",
  path: "sendero",
  footway: "vereda",
  pedestrian: "paseo peatonal",
  track: "camino",
  living_street: "calle local",
  residential: "calle",
  service: "vía de servicio",
  unclassified: "calle",
  tertiary: "avenida",
  tertiary_link: "avenida",
  secondary: "avenida",
  secondary_link: "avenida",
  primary: "avenida principal",
  primary_link: "avenida principal",
};

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR;
  const dLon = (b.lon - a.lon) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function bearing(a: LatLng, b: LatLng): number {
  const toR = Math.PI / 180;
  const y = Math.sin((b.lon - a.lon) * toR) * Math.cos(b.lat * toR);
  const x = Math.cos(a.lat * toR) * Math.sin(b.lat * toR) - Math.sin(a.lat * toR) * Math.cos(b.lat * toR) * Math.cos((b.lon - a.lon) * toR);
  return (Math.atan2(y, x) / toR + 360) % 360;
}

let netPromise: Promise<Network | null> | null = null;

/** Carga (una vez) y prepara el grafo de navegación. */
export function loadNetwork(): Promise<Network | null> {
  if (!netPromise) {
    netPromise = fetch("/red-ciclista.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then((raw: { classes: string[]; names: string[]; nodes: NetNode[]; edges: NetEdge[]; cicloviaPolylines: number[][] }) => {
        const adj: Network["adj"] = raw.nodes.map(() => []);
        for (const [a, b, clsIdx, nameIdx, ciclo] of raw.edges) {
          const cls = raw.classes[clsIdx] ?? "residential";
          const name = raw.names[nameIdx] ?? "";
          const p = PENALTY[cls] ?? 1;
          const pa = { lat: raw.nodes[a][0], lon: raw.nodes[a][1] };
          const pb = { lat: raw.nodes[b][0], lon: raw.nodes[b][1] };
          const dist = haversineM(pa, pb);
          const w = dist * p;
          const br = bearing(pa, pb);
          adj[a].push({ to: b, w, dist, cls, name, ciclovia: ciclo === 1, bearing: br });
          adj[b].push({ to: a, w, dist, cls, name, ciclovia: ciclo === 1, bearing: (br + 180) % 360 });
        }
        return { ...raw, adj } as Network;
      })
      .catch(() => null);
  }
  return netPromise;
}

/**
 * Nodo más cercano del grafo y su distancia. Sirve para decidir si el
 * grafo local cubre un punto o hay que pedir ruta al servicio OSRM.
 */
export function snapInfo(net: Network, p: LatLng): { idx: number; distM: number } {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < net.nodes.length; i++) {
    const d = haversineM(p, { lat: net.nodes[i][0], lon: net.nodes[i][1] });
    if (d < bestD) {
      bestD = d;
      best = i;
      if (d < 12) break;
    }
  }
  return { idx: best, distM: bestD };
}

/**
 * Nodo más cercano del grafo. `maxM` generoso (800 m) para que fijar
 * destino a mitad de un sendero del parque encuentre conexión igual.
 */
function nearestNode(net: Network, p: LatLng, maxM = 800): number | null {
  const s = snapInfo(net, p);
  return s.distM <= maxM ? s.idx : null;
}

// --- min-heap simple ---
type HeapItem = { f: number; i: number };
class MinHeap {
  private a: HeapItem[] = [];
  push(x: HeapItem) {
    this.a.push(x);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p].f <= this.a[i].f) break;
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
      i = p;
    }
  }
  pop(): HeapItem | undefined {
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length && last) {
      this.a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.a.length && this.a[l].f < this.a[m].f) m = l;
        if (r < this.a.length && this.a[r].f < this.a[m].f) m = r;
        if (m === i) break;
        [this.a[m], this.a[i]] = [this.a[i], this.a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
}

/** Ruta óptima (A*) con preferencia por ciclovías. */
export function findRoute(net: Network, from: LatLng, to: LatLng): NavRoute | null {
  const s = nearestNode(net, from);
  const t = nearestNode(net, to);
  if (s === null || t === null) return null;

  const n = net.nodes.length;
  const g = new Float64Array(n).fill(Infinity);
  const prevEdgeRef: Array<Network["adj"][number][number] | null> = new Array(n).fill(null);
  const prevNode = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const target = { lat: net.nodes[t][0], lon: net.nodes[t][1] };
  const heap = new MinHeap();
  g[s] = 0;
  heap.push({ f: haversineM({ lat: net.nodes[s][0], lon: net.nodes[s][1] }, target) * 0.65, i: s });

  // Nodo asentado más cercano al destino pedido: si el destino cae en
  // una componente aislada del grafo (ej. senderos de la Piscina
  // Antilén), terminamos en el punto alcanzable más cercano.
  let bestNode = -1;
  let bestDist = Infinity;

  while (heap.size > 0) {
    const cur = heap.pop()!;
    const u = cur.i;
    if (done[u]) continue;
    done[u] = 1;
    const du = haversineM({ lat: net.nodes[u][0], lon: net.nodes[u][1] }, to);
    if (du < bestDist) {
      bestDist = du;
      bestNode = u;
    }
    if (u === t) break;
    for (const e of net.adj[u]) {
      if (done[e.to]) continue;
      const ng = g[u] + e.w;
      if (ng < g[e.to]) {
        g[e.to] = ng;
        prevEdgeRef[e.to] = e;
        prevNode[e.to] = u;
        const h = haversineM({ lat: net.nodes[e.to][0], lon: net.nodes[e.to][1] }, target) * 0.65;
        heap.push({ f: ng + h, i: e.to });
      }
    }
  }
  const end = done[t] ? t : bestNode;
  if (end < 0) return null;

  // reconstruir secuencia de aristas
  const seq: Array<{ edge: Network["adj"][number][number]; from: number }> = [];
  let cur = end;
  while (cur !== s && prevNode[cur] >= 0) {
    const u = prevNode[cur];
    const e = prevEdgeRef[cur]!;
    seq.unshift({ edge: e, from: u });
    cur = u;
  }
  if (!seq.length) return null;

  const coords: LatLng[] = [{ lat: net.nodes[s][0], lon: net.nodes[s][1] }];
  const flags: boolean[] = [];
  const segNames: string[] = [];
  let distanceM = 0;
  let cicloM = 0;
  for (const { edge, from: u } of seq) {
    const v = edge.to;
    distanceM += edge.dist;
    if (edge.ciclovia) cicloM += edge.dist;
    flags.push(edge.ciclovia);
    segNames.push(edge.name || CLASS_LABEL[edge.cls] || "");
    coords.push({ lat: net.nodes[v][0], lon: net.nodes[v][1] });
    void u;
  }

  // --- instrucciones paso a paso ---
  const steps: RouteStep[] = [];
  const fmt = (m: number) => (m >= 950 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);
  let acc = 0;
  let lastName = "\u0000";
  let lastCls = "";
  let inCiclo = false;
  let prevBearing: number | null = null;

  const push = (icon: RouteStep["icon"], text: string, point: LatLng, idx: number) => {
    steps.push({ icon, text, distM: Math.round(acc), point, idx });
    acc = 0;
  };

  push("start", `Parte por ${seq[0].edge.name || CLASS_LABEL[seq[0].edge.cls] || "la vía"}`, coords[0], 0);

  for (let i = 0; i < seq.length; i++) {
    const e = seq[i].edge;
    const turnOfThis = prevBearing !== null ? ((e.bearing - prevBearing + 540) % 360) - 180 : 0;
    const label = e.name || CLASS_LABEL[e.cls] || "la vía";
    const isCiclo = e.ciclovia;

    if (i > 0 && (Math.abs(turnOfThis) > 40 || label !== lastName || (isCiclo !== inCiclo && isCiclo))) {
      const dir = turnOfThis < -40 ? "left" : turnOfThis > 40 ? "right" : "straight";
      let text: string;
      if (dir === "left") text = `Gira a la izquierda hacia ${label}`;
      else if (dir === "right") text = `Gira a la derecha hacia ${label}`;
      else if (isCiclo) text = `Continúa por la ciclovía ${label}`;
      else if (lastCls === "cycleway" && !isCiclo) text = `Sigue por ${label}`;
      else text = `Continúa por ${label}`;
      push(dir, text, coords[i], i);
      prevBearing = e.bearing;
    } else if (i === 0) {
      prevBearing = e.bearing;
    }
    acc += e.dist;
    lastName = label;
    lastCls = e.cls;
    inCiclo = isCiclo;
  }
  const lastIdx = coords.length - 1;
  push("end", `Has llegado a tu destino`, coords[lastIdx], lastIdx);

  return {
    coords,
    distanceM: Math.round(distanceM),
    steps,
    cicloviaPct: distanceM > 0 ? Math.round((cicloM / distanceM) * 100) : 0,
    etaMin: Math.max(1, Math.round(distanceM / 1000 / 15 * 60)), // ~15 km/h
    flags,
    segNames,
  };
}

export type RouteSegGroup = { ciclovia: boolean; coords: LatLng[] };

/**
 * Agrupa tramos consecutivos con la misma condición (ciclovía / vía
 * compartida) en polilíneas continuas. Los grupos comparten el vértice
 * frontera, así la ruta se ve COMPLETA y sin cortes de inicio a fin.
 */
export function groupSegments(coords: LatLng[], flags: boolean[], fromSeg: number, toSeg: number): RouteSegGroup[] {
  const out: RouteSegGroup[] = [];
  const last = Math.min(toSeg, coords.length - 2);
  for (let i = Math.max(0, fromSeg); i <= last; i++) {
    const c = !!flags[i];
    const g = out[out.length - 1];
    if (g && g.ciclovia === c) g.coords.push(coords[i + 1]);
    else out.push({ ciclovia: c, coords: [coords[i], coords[i + 1]] });
  }
  return out;
}

/** Nombre de la vía del tramo donde cae el vértice `idx` ("" si no hay dato). */
export function streetAt(route: NavRoute, idx: number): string {
  if (!route.segNames.length) return "";
  return route.segNames[Math.min(Math.max(idx, 0), route.segNames.length - 1)] ?? "";
}

/** Extrae la calle de un texto de paso ("Gira a la derecha hacia X" → "X",
 *  "Continúa por la ciclovía Y" → "Y"). */
export function streetOfStep(text: string): string {
  const m = text.match(/hacia\s+(.+)$/) ?? text.match(/por\s+(?:la\s+)?(?:ciclov[ií]a\s+|sendero\s+|vereda\s+)?(.+)$/);
  return m ? m[1] : text;
}

export function formatStepRemaining(step: RouteStep): string {
  return step.distM >= 950 ? `${(step.distM / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(step.distM / 10) * 10)} m`;
}

/** Glifo de maniobra para banners y chips de navegación. */
export function stepGlyph(icon: RouteStep["icon"]): string {
  return icon === "left" ? "↰" : icon === "right" ? "↱" : icon === "end" ? "🏁" : icon === "start" ? "🚩" : "↑";
}

/**
 * Punto sobre la ruta a `aheadM` metros del vértice `fromIdx` (hacia adelante).
 * Se usa para la cámara de navegación: centrar un punto más adelante deja el
 * pin del ciclista en el tercio inferior, estilo Waze.
 */
export function pointAhead(coords: LatLng[], fromIdx: number, aheadM: number): LatLng {
  const last = coords.length - 1;
  if (fromIdx >= last) return coords[last];
  let acc = 0;
  for (let i = Math.max(0, fromIdx); i < last; i++) {
    const seg = haversineM(coords[i], coords[i + 1]);
    if (seg > 0 && acc + seg >= aheadM) {
      const f = Math.min(1, (aheadM - acc) / seg);
      return {
        lat: coords[i].lat + (coords[i + 1].lat - coords[i].lat) * f,
        lon: coords[i].lon + (coords[i + 1].lon - coords[i].lon) * f,
      };
    }
    acc += seg;
  }
  return coords[last];
}

export type RouteProgress = {
  nearestIdx: number;
  /** Paso próximo (el que aún no se alcanza). */
  nextStep: RouteStep;
  /** Pasos ya superados (incluye el "start" cuando corresponde). */
  passedCount: number;
  /** Metros desde la posición hasta el punto del próximo paso. */
  distToNextStepM: number;
  /** Metros restantes hasta el destino. */
  remainingM: number;
  /** Distancia de la posición a la polilínea (m): > 0 ⇒ fuera de ruta. */
  offRouteM: number;
};

/** Distancia viva sobre la ruta: próximo paso, metros y desvío. */
export function routeProgress(route: NavRoute, pos: LatLng): RouteProgress {
  const { coords, steps } = route;
  // vértice más cercano
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = haversineM(pos, coords[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
      if (d < 8) break;
    }
  }
  // distancias acumuladas desde best hacia cada vértice
  const cum: number[] = new Array(coords.length).fill(0);
  for (let i = best + 1; i < coords.length; i++) cum[i] = cum[i - 1] + haversineM(coords[i - 1], coords[i]);
  for (let i = best - 1; i >= 0; i--) cum[i] = cum[i + 1] + haversineM(coords[i], coords[i + 1]);

  const remainingM = cum[coords.length - 1] + bestD;
  // primer paso cuyo índice de vértice está por delante (o el final)
  let passed = 0;
  while (passed < steps.length - 1 && steps[passed].idx <= best) passed++;
  const nextStep = steps[Math.min(passed, steps.length - 1)];
  const distToNextStepM = Math.max(0, cum[Math.min(nextStep.idx, coords.length - 1)] - 0) + (nextStep.idx >= best ? bestD : 0);

  return { nearestIdx: best, nextStep, passedCount: passed, distToNextStepM, remainingM, offRouteM: bestD };
}
