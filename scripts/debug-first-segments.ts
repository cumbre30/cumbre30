// ¿La ruta arranca por un PASAJE / sendero interior (parece "cruzar en
// recta")? Para pins dentro de las cuadras alrededor de Pío Nono,
// imprime la clase y nombre de los primeros tramos de la ruta.
import * as fs from "fs";
import { findRoute, haversineM, type Network, type NetEdge, type LatLng } from "../src/lib/routing";

const raw = JSON.parse(fs.readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: [number, number][]; edges: NetEdge[]; cicloviaPolylines: number[][];
};
const PENALTY: Record<string, number> = {
  cycleway: 0.65, path: 0.9, footway: 1.35, pedestrian: 1.1, track: 1.0,
  living_street: 0.95, residential: 0.95, service: 1.05, unclassified: 1.0,
  tertiary: 1.15, tertiary_link: 1.2, secondary: 1.5, secondary_link: 1.5, primary: 2.4, primary_link: 2.4,
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

// edges con clase "peatonal/interior" cerca de Pío Nono
const INTERIOR = new Set(["footway", "pedestrian", "path", "service"]);
const pioCenter: LatLng = { lat: -33.4335, lon: -70.6363 };
const near: { d: number; cls: string; name: string; a: number; b: number }[] = [];
for (const e of raw.edges) {
  const a = raw.nodes[e[0]], b = raw.nodes[e[1]];
  const mid = { lat: (a[0] + b[0]) / 2, lon: (a[1] + b[1]) / 2 };
  const d = haversineM(pioCenter, mid);
  if (d > 220) continue;
  near.push({ d, cls: raw.classes[e[2]], name: raw.names[e[3]], a: e[0], b: e[1] });
}
const interior = near.filter((e) => INTERIOR.has(e.cls)).sort((x, y) => x.d - y.d);
console.log(`aristas a ≤220 m del centro de Pío Nono: ${near.length} · interiores (footway/pedestrian/path/service): ${interior.length}`);
interior.slice(0, 25).forEach((e) => console.log(`   ${e.cls} · "${e.name}" · ${Math.round(e.d)} m del centro`));

// ---- rutas desde pins dentro de las cuadras alrededor de Pío Nono ----
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(11);
const PIO_ENTRADA: LatLng = { lat: -33.430554, lon: -70.636347 };
console.log("\nprimeros tramos de rutas hacia Pío Nono (entrada cerro), pin con ruido 15–55 m:");
for (let k = 0; k < 14; k++) {
  const from = {
    lat: pioCenter.lat + ((rng() - 0.5) * 2 * 140) / 111320,
    lon: pioCenter.lon + ((rng() - 0.5) * 2 * 140) / (111320 * Math.cos((pioCenter.lat * Math.PI) / 180)),
  };
  const noisy = {
    lat: from.lat + ((rng() - 0.5) * 2 * 55) / 111320,
    lon: from.lon + ((rng() - 0.5) * 2 * 55) / (111320 * Math.cos((from.lat * Math.PI) / 180)),
  };
  const r0 = findRoute(net, noisy, PIO_ENTRADA);
  if (!r0) { console.log("  sin ruta"); continue; }
  const r = r0; // pre-attachOrigin: coords[0] = nodo virtual sobre la arista ancla
  const firstSegClass = (i: number): string => {
    // buscar la arista que conecta coords[i]→coords[i+1]
    let best = "";
    let bd = Infinity;
    for (const e of raw.edges) {
      const a = raw.nodes[e[0]], b = raw.nodes[e[1]];
      const da = haversineM(r.coords[i], { lat: a[0], lon: a[1] }) + haversineM(r.coords[i + 1], { lat: b[0], lon: b[1] });
      const db = haversineM(r.coords[i], { lat: b[0], lon: b[1] }) + haversineM(r.coords[i + 1], { lat: a[0], lon: a[1] });
      const d = Math.min(da, db);
      if (d < bd) { bd = d; best = raw.classes[e[2]]; }
    }
    return best;
  };
  const parts: string[] = [];
  for (let i = 0; i < Math.min(4, r.flags.length); i++) {
    const seg = Math.round(haversineM(r.coords[i], r.coords[i + 1]));
    parts.push(`${r.segNames[i] || "(?)"}<${firstSegClass(i)}>·${seg}m`);
  }
  console.log(`  pin ${noisy.lat.toFixed(5)},${noisy.lon.toFixed(5)} → ${parts.join(" → ")}`);
}
