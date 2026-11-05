// Prueba offline del anclaje de origen (arista más cercana + nodo virtual).
// Escenario: ciclista en la entrada Pío Nono y en calles de Bellavista,
// destino Cumbre / Zoológico. Verifica que la ruta nazca en la calle del
// ciclista (chaflán corto), NO en la ciclovía del cerro.
import * as fs from "fs";
import {
  findRoute,
  attachOrigin,
  haversineM,
  type Network,
  type NetEdge,
  type LatLng,
} from "../src/lib/routing";

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
  const w = dist * p;
  const br = Math.atan2(
    Math.sin((pb.lon - pa.lon) * Math.PI / 180) * Math.cos(pb.lat * Math.PI / 180),
    Math.cos(pa.lat * Math.PI / 180) * Math.sin(pb.lat * Math.PI / 180) -
      Math.sin(pa.lat * Math.PI / 180) * Math.cos(pb.lat * Math.PI / 180) * Math.cos((pb.lon - pa.lon) * Math.PI / 180)
  ) / Math.PI * 180;
  const brr = (br + 360) % 360;
  adj[a].push({ to: b, w, dist, cls, name, ciclovia: ciclo === 1, bearing: brr });
  adj[b].push({ to: a, w, dist, cls, name, ciclovia: ciclo === 1, bearing: (brr + 180) % 360 });
}
const net: Network = { ...raw, adj };

// --- nearest node info (para comparar con el comportamiento anterior) ---
function snapInfo(p: LatLng) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < net.nodes.length; i++) {
    const d = haversineM(p, { lat: net.nodes[i][0], lon: net.nodes[i][1] });
    if (d < bestD) { bestD = d; best = i; if (d < 12) break; }
  }
  return { idx: best, distM: bestD };
}

const cases: { label: string; from: LatLng; to: LatLng }[] = [
  {
    label: "Pío Nono → Cumbre",
    from: { lat: -33.430691, lon: -70.63592 },   // Acceso Pío Nono
    to: { lat: -33.42527, lon: -70.63324 },          // Cumbre
  },
  {
    label: "Bellavista (Dardignac) → Zoológico",
    from: { lat: -33.4292, lon: -70.6385 },      // calle Dardignac, Bellavista
    to: { lat: -33.429636, lon: -70.633963 },    // Zoológico
  },
  {
    label: "Pedro de Valdivia Norte → Piscina Antilén",
    from: { lat: -33.411769, lon: -70.607988 },
    to: { lat: -33.409051, lon: -70.61374 },
  },
  {
    label: "Punto mitad de cuadra (elaborado) → Cumbre",
    from: { lat: -33.4315, lon: -70.6375 },      // a mitad de cuadra en Bellavista
    to: { lat: -33.42527, lon: -70.63324 },
  },
];

console.time("total");
for (const c of cases) {
  const t0 = Date.now();
  const r0 = findRoute(net, c.from, c.to);
  if (!r0) { console.log(`${c.label}: SIN RUTA`); continue; }
  const route = attachOrigin(r0, c.from);
  const dt = Date.now() - t0;

  const snap = snapInfo(c.from);
  const oldStartDist = haversineM(c.from, {
    lat: net.nodes[snap.idx][0],
    lon: net.nodes[snap.idx][1],
  });
  const newStartDist = haversineM(c.from, route.coords[0]);
  // ¿primer tramo pegado al usuario? distancia de los 3 primeros vértices
  const first3 = route.coords.slice(0, 3).map((p) => Math.round(haversineM(c.from, p)));
  // ¿la ruta arranca en la ciclovía? chequear flag del primer tramo
  const firstSegCiclo = route.flags[0];
  const cicloOld = r0.flags[0];

  console.log(
    `${c.label}\n` +
    `  cálculo ${dt} ms · ${(route.distanceM / 1000).toFixed(2)} km · ${route.etaMin} min · ${route.cicloviaPct}% ciclovía · ${route.steps.length} pasos\n` +
    `  nodo más cercano a ${Math.round(oldStartDist)} m (antes la ruta partía ahí)\n` +
    `  inicio de ruta ahora a ${newStartDist.toFixed(1)} m del ciclista · vértices [${first3.join(", ")}] m\n` +
    `  1er tramo ciclovía: antes=${cicloOld} ahora=${firstSegCiclo}`
  );
}
console.timeEnd("total");
