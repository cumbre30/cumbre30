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

/**
 * Arista (calle) más cercana a `p`: proyección equirectangular sobre cada
 * segmento del grafo (~58k aristas, se ejecuta UNA vez por cálculo de ruta —
 * coste trivial frente al A*). Devuelve también la clase/nombre de la vía.
 */
function nearestEdge(
  net: Network,
  p: LatLng,
  maxM: number
): { u: number; v: number; cls: string; name: string; ciclovia: boolean; point: LatLng; distM: number } | null {
  const kx = Math.cos((p.lat * Math.PI) / 180);
  let best: { u: number; v: number; cls: string; name: string; ciclovia: boolean; point: LatLng; distM: number } | null = null;
  let bestD = Infinity;
  for (let i = 0; i < net.edges.length; i++) {
    const [a, b, clsIdx, nameIdx, ciclo] = net.edges[i];
    const na = net.nodes[a];
    const nb = net.nodes[b];
    const ax = na[1] * kx, ay = na[0];
    const bx = nb[1] * kx, by = nb[0];
    const px = p.lon * kx, py = p.lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + dx * t, qy = ay + dy * t;
    const dM = Math.hypot(px - qx, py - qy) * 111_320;
    if (dM < bestD) {
      bestD = dM;
      best = {
        u: a,
        v: b,
        cls: net.classes[clsIdx] ?? "residential",
        name: net.names[nameIdx] ?? "",
        ciclovia: ciclo === 1,
        point: { lat: na[0] + (nb[0] - na[0]) * t, lon: na[1] + (nb[1] - na[1]) * t },
        distM: dM,
      };
    }
  }
  return best && best.distM <= maxM ? best : null;
}

/** Ruta óptima (A*) con preferencia por ciclovías.
 *  El origen se ancla a la ARISTA (calle) más cercana al ciclista mediante
 *  un nodo virtual en la proyección: la ruta nace en la calle donde estás,
 *  no salta al nodo más próximo (que puede quedar arriba, en la ciclovía).
 *  attachOrigin() agrega después el chaflán final hasta el pin GPS.
 *
 *  ORIGIN_ANCHOR_MAX_M: si el ciclista está más lejos que esto del grafo
 *  (típico: en la ciudad, fuera del sector cubierto), NO se ancla a una
 *  arista lejana (antes 800 m: la ruta nacía sobre la ciclovía de una
 *  avenida a 700 m y el conector al pin cruzaba las cuadras en línea
 *  recta) — se devuelve null y computeRoute cae a OSRM, que sí parte
 *  desde la posición real siguiendo calles. */
export const ORIGIN_ANCHOR_MAX_M = 250;

export function findRoute(net: Network, from: LatLng, to: LatLng): NavRoute | null {
  const t = nearestNode(net, to);
  if (t === null) return null;

  // --- origen: la ruta nace en la CALLE más cercana al ciclista ---
  // Antes se arrancaba en el NODO más próximo del grafo, que puede quedar
  // lejos del punto real (típico: el nodo está arriba, en la ciclovía, y el
  // ciclista abajo en la entrada del parque). Se crea un nodo virtual en la
  // proyección sobre la arista más cercana, heredando su clase/nombre.
  const edge = nearestEdge(net, from, ORIGIN_ANCHOR_MAX_M);
  let runNet: Network = net;
  let s: number;
  if (edge) {
    const virt = net.nodes.length;
    const nodes2 = net.nodes.slice();
    nodes2.push([edge.point.lat, edge.point.lon]);
    const pu = { lat: net.nodes[edge.u][0], lon: net.nodes[edge.u][1] };
    const pv = { lat: net.nodes[edge.v][0], lon: net.nodes[edge.v][1] };
    const dU = Math.max(0.1, haversineM(edge.point, pu));
    const dV = Math.max(0.1, haversineM(edge.point, pv));
    const pen = PENALTY[edge.cls] ?? 1;
    const brU = bearing(edge.point, pu);
    const brV = bearing(edge.point, pv);
    const adj2 = net.adj.slice();
    adj2[virt] = [
      { to: edge.u, w: dU * pen, dist: dU, cls: edge.cls, name: edge.name, ciclovia: edge.ciclovia, bearing: brU },
      { to: edge.v, w: dV * pen, dist: dV, cls: edge.cls, name: edge.name, ciclovia: edge.ciclovia, bearing: brV },
    ];
    // aristas de vuelta u→virt / v→virt sin mutar la red compartida
    adj2[edge.u] = [...net.adj[edge.u], { to: virt, w: dU * pen, dist: dU, cls: edge.cls, name: edge.name, ciclovia: edge.ciclovia, bearing: (brU + 180) % 360 }];
    adj2[edge.v] = [...net.adj[edge.v], { to: virt, w: dV * pen, dist: dV, cls: edge.cls, name: edge.name, ciclovia: edge.ciclovia, bearing: (brV + 180) % 360 }];
    runNet = { ...net, nodes: nodes2, adj: adj2 };
    s = virt;
  } else {
    const s0 = nearestNode(net, from, ORIGIN_ANCHOR_MAX_M);
    if (s0 === null) return null;
    s = s0;
  }

  const n = runNet.nodes.length;
  const g = new Float64Array(n).fill(Infinity);
  const prevEdgeRef: Array<Network["adj"][number][number] | null> = new Array(n).fill(null);
  const prevNode = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const target = { lat: runNet.nodes[t][0], lon: runNet.nodes[t][1] };
  const heap = new MinHeap();
  g[s] = 0;
  heap.push({ f: haversineM({ lat: runNet.nodes[s][0], lon: runNet.nodes[s][1] }, target) * 0.65, i: s });

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
    const du = haversineM({ lat: runNet.nodes[u][0], lon: runNet.nodes[u][1] }, to);
    if (du < bestDist) {
      bestDist = du;
      bestNode = u;
    }
    if (u === t) break;
    for (const e of runNet.adj[u]) {
      if (done[e.to]) continue;
      const ng = g[u] + e.w;
      if (ng < g[e.to]) {
        g[e.to] = ng;
        prevEdgeRef[e.to] = e;
        prevNode[e.to] = u;
        const h = haversineM({ lat: runNet.nodes[e.to][0], lon: runNet.nodes[e.to][1] }, target) * 0.65;
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

  const coords: LatLng[] = [{ lat: runNet.nodes[s][0], lon: runNet.nodes[s][1] }];
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
    coords.push({ lat: runNet.nodes[v][0], lon: runNet.nodes[v][1] });
    void u;
  }

  // --- resguardo: origen anclado a una ISLA del grafo ---
  // Si el pin del ciclista cayó sobre un fragmento aislado (p. ej. el
  // mirador de la Virgen, un sendero sin conexión), la búsqueda no puede
  // avanzar y la "ruta" terminaría a metros del inicio sin acercarse al
  // destino. En ese caso devolvemos null para caer al respaldo (OSRM en
  // web; aviso de sin cobertura en el APK), como con orígenes lejanos.
  const endToM = haversineM(coords[coords.length - 1], to);
  const startToM = haversineM(coords[0], to);
  if (!done[t] && endToM > startToM - 50) return null;

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

/**
 * Proyección de `p` sobre la polilínea: devuelve el punto más cercano
 * (SOBRE una calle de la ruta), el índice del tramo y la distancia en m.
 * Escala equirectangular local — error < 0,2 % en tramos urbanos.
 */
export function projectOnPolyline(
  coords: LatLng[],
  p: LatLng
): { segIdx: number; point: LatLng; distM: number } {
  if (coords.length === 0) return { segIdx: 0, point: p, distM: 0 };
  if (coords.length === 1) return { segIdx: 0, point: coords[0], distM: haversineM(p, coords[0]) };
  const kx = Math.cos((p.lat * Math.PI) / 180); // grados lon → proporción métrica
  let bestSeg = 0;
  let bestT = 0;
  let bestD = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const ax = a.lon * kx, ay = a.lat;
    const bx = b.lon * kx, by = b.lat;
    const px = p.lon * kx, py = p.lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + dx * t, qy = ay + dy * t;
    const dM = Math.hypot(px - qx, py - qy) * 111_320;
    if (dM < bestD) {
      bestD = dM;
      bestSeg = i;
      bestT = t;
    }
  }
  const a = coords[bestSeg];
  const b = coords[bestSeg + 1];
  return {
    segIdx: bestSeg,
    point: { lat: a.lat + (b.lat - a.lat) * bestT, lon: a.lon + (b.lon - a.lon) * bestT },
    distM: bestD,
  };
}

/** Largo máx. del chaflán posición→ruta (lo usa el canvas de nav para
 *  dibujar el tramo de aproximación como tal). El anclaje del inicio
 *  ya no depende de esta cifra: el pin SIEMPRE encabeza la ruta. */
export const CONNECTOR_MAX_M = 40;

/**
 * Ventana de recorte del inicio: solo se recorta la ruta si la
 * proyección de tu posición cae dentro de los primeros TRIM_WINDOW_M
 * metros de la polilínea. Antes el recorte podía caer en CUALQUIER
 * tramo (p. ej. la ciclovía que la ruta tomaba unos metros más
 * adelante, más cerca del fix GPS ruidoso que el propio arranque):
 * se borraba el comienzo real y el mapa mostraba la ruta iniciando
 * en la ciclovía en vez de en tu ubicación.
 */
const TRIM_WINDOW_M = 150;

/**
 * Ancla el inicio de la ruta a la posición del ciclista. Regla dura:
 * coords[0] ES SIEMPRE el pin GPS del ciclista ("la ruta parte de TU
 * ubicación"), y la preferencia por ciclovías se aplica a partir de
 * ahí, nunca moviendo el arranque. Se proyecta la posición sobre la
 * polilínea (que sigue calles) y:
 * · Proyección cercana (dentro de TRIM_WINDOW_M) → se recorta el
 *   arranque hasta el punto proyectado y se antepone el pin con un
 *   chaflán corto posición→calle.
 * · Proyección lejana (más allá de TRIM_WINDOW_M) → NO se recorta
 *   nada: la ruta completa se conserva y el pin se antepone con un
 *   conector recto al inicio de la ruta.
 * Los pasos (steps) se re-mapean a los nuevos índices.
 */
export function attachOrigin(route: NavRoute, from: LatLng): NavRoute {
  if (route.coords.length < 2) return route;
  const pr = projectOnPolyline(route.coords, from);
  const i = pr.segIdx;

  // metros recorridos por la ruta hasta el inicio del tramo proyectado
  let prefixM = 0;
  for (let k = 0; k < i; k++) prefixM += haversineM(route.coords[k], route.coords[k + 1]);
  const canTrim = prefixM <= TRIM_WINDOW_M;

  // ¿Sin cambios útiles? proyección ≈ el inicio actual y la posición cae ahí
  if (canTrim && i === 0 && pr.distM <= 3) return route;

  if (canTrim) {
    const tail = route.coords.slice(i + 1);
    // P reemplaza coords[i]; si la proyección cae prácticamente sobre
    // coords[i+1] (dup), el punto coincide con ese vértice y el "resto
    // del tramo i" desaparece: arrancamos desde el tramo i+1.
    const dup = tail.length > 0 && haversineM(pr.point, tail[0]) < 0.5;
    const tailClean = dup ? tail.slice(1) : tail;
    // tu pin SIEMPRE primero; chaflán pin→calle proyectada
    const coords: LatLng[] = [from, pr.point, ...tailClean];
    if (coords.length < 2) return route;

    const restIdx = dup ? i + 1 : i;
    // banderas/nombres: el chaflán se dibuja como vía compartida; el
    // resto conserva la clasificación original desde restIdx
    const flags: boolean[] = [false, ...route.flags.slice(restIdx)];
    const segNames: string[] = ["", ...route.segNames.slice(restIdx)];

    let distanceM = 0;
    for (let k = 0; k < coords.length - 1; k++) distanceM += haversineM(coords[k], coords[k + 1]);
    distanceM = Math.round(distanceM);

    // re-mapeo de pasos: los que quedaron detrás del punto proyectado se
    // descartan; el primero hereda el recorte del tramo (headM)
    const headM = haversineM(route.coords[i], pr.point);
    const steps: RouteStep[] = [];
    let firstKept = true;
    for (const st of route.steps) {
      if (st.idx <= i) continue;
      const newIdx = st.idx - restIdx + 1;
      steps.push({
        ...st,
        idx: newIdx,
        point: coords[Math.min(newIdx, coords.length - 1)],
        distM: firstKept ? Math.max(1, st.distM - Math.round(headM)) : st.distM,
      });
      firstKept = false;
    }
    const startName = segNames[1]?.trim() || "la vía";
    steps.unshift({
      icon: "start",
      text: `Parte por ${startName}`,
      distM: Math.max(1, Math.round(pr.distM)),
      point: coords[0],
      idx: 0,
    });

    return {
      ...route,
      coords,
      flags,
      segNames,
      steps,
      distanceM,
      etaMin: Math.max(1, Math.round(distanceM / 1000 / 15 * 60)),
    };
  }

  // Proyección lejana: el arranque real de la ruta es el correcto (el
  // recorte borraría el comienzo para saltar a un tramo posterior —
  // típicamente la ciclovía—). Se conserva la ruta íntegra y el pin
  // queda como vértice 0 con un conector recto hasta la ruta.
  const coords: LatLng[] = [from, ...route.coords];
  const flags: boolean[] = [false, ...route.flags];
  const segNames: string[] = ["", ...route.segNames];

  let distanceM = 0;
  for (let k = 0; k < coords.length - 1; k++) distanceM += haversineM(coords[k], coords[k + 1]);
  distanceM = Math.round(distanceM);

  const startName = route.segNames[0]?.trim() || "la vía";
  const steps: RouteStep[] = [];
  for (const st of route.steps) {
    if (st.icon === "start") continue; // lo reemplaza el start anclado al pin
    const newIdx = st.idx + 1;
    steps.push({ ...st, idx: newIdx, point: coords[Math.min(newIdx, coords.length - 1)] });
  }
  steps.unshift({
    icon: "start",
    text: `Parte desde tu ubicación por ${startName}`,
    distM: Math.max(1, Math.round(haversineM(from, route.coords[0]))),
    point: coords[0],
    idx: 0,
  });

  return {
    ...route,
    coords,
    flags,
    segNames,
    steps,
    distanceM,
    etaMin: Math.max(1, Math.round(distanceM / 1000 / 15 * 60)),
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
