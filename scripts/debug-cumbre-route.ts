// Depuración: por qué findRoute(cumbre → plaza) devuelve null.
import * as fs from "fs";
import { findRoute, haversineM, snapInfo, type Network, type NetEdge } from "../src/lib/routing";
import { NAV_DESTINATIONS } from "../src/lib/park";

const raw = JSON.parse(fs.readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: [number, number][]; edges: NetEdge[]; cicloviaPolylines: number[][];
};
const PENALTY: Record<string, number> = { cycleway: 0.65, path: 0.9, footway: 1.35, pedestrian: 1.1, track: 1.0, living_street: 0.95, residential: 0.95, service: 1.05, unclassified: 1.0, tertiary: 1.15, tertiary_link: 1.2, secondary: 1.5, secondary_link: 1.5, primary: 2.4, primary_link: 2.4 };
const adj: Network["adj"] = raw.nodes.map(() => []);
for (const [a, b, clsIdx, nameIdx, ciclo] of raw.edges) {
  const cls = raw.classes[clsIdx] ?? "residential";
  const name = raw.names[nameIdx] ?? "";
  const p = PENALTY[cls] ?? 1;
  const pa = { lat: raw.nodes[a][0], lon: raw.nodes[a][1] };
  const pb = { lat: raw.nodes[b][0], lon: raw.nodes[b][1] };
  const dist = haversineM(pa, pb);
  adj[a].push({ to: b, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: 0 });
  adj[b].push({ to: a, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: 0 });
}
const net: Network = { ...raw, adj };
const D = Object.fromEntries(NAV_DESTINATIONS.map((d) => [d.id, d.position]));
const cumbre = D["cumbre"], plaza = D["plaza-mexico"];

const snapC = snapInfo(net, cumbre);
console.log("snap cumbre:", snapC.distM.toFixed(1), "m · nodo:", raw.nodes[snapC.idx]);

// arista más cercana al punto cumbre (réplica de nearestEdge de routing.ts)
const kx = Math.cos((cumbre.lat * Math.PI) / 180);
let best: { d: number; a: number; b: number; cls: string } | null = null;
for (const [a, b, clsIdx] of raw.edges) {
  const na = raw.nodes[a], nb = raw.nodes[b];
  const ax = na[1] * kx, ay = na[0], bx = nb[1] * kx, by = nb[0];
  const px = cumbre.lon * kx, py = cumbre.lat;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dM = Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320;
  if (!best || dM < best.d) best = { d: dM, a, b, cls: raw.classes[clsIdx] ?? "?" };
}
console.log("arista más cercana a la cumbre:", best && { d: best.d.toFixed(1), cls: best.cls }, "nodoA:", raw.nodes[best!.a], "nodoB:", raw.nodes[best!.b]);

const r = findRoute(net, cumbre, plaza);
console.log("findRoute cumbre→plaza:", r ? `${(r.distanceM / 1000).toFixed(2)} km · ${r.coords.length} pts` : "null");
const r2 = findRoute(net, plaza, cumbre);
console.log("findRoute plaza→cumbre:", r2 ? `${(r2.distanceM / 1000).toFixed(2)} km · fin a ${Math.round(haversineM(r2.coords[r2.coords.length - 1], cumbre))} m de la Virgen` : "null");
