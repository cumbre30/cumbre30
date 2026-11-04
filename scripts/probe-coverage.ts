// Sondeo: qué puntos de Santiago quedan FUERA del grafo local (>250 m)
// para probar el camino OSRM en vivo.
import * as fs from "fs";
import { haversineM, type Network, type NetEdge, type LatLng } from "../src/lib/routing";

const raw = JSON.parse(fs.readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: [number, number][]; edges: NetEdge[]; cicloviaPolylines: number[][];
};
const net: Network = { ...raw, adj: [] };

function distToNearestEdge(p: LatLng): { dM: number; name: string } {
  const kx = Math.cos((p.lat * Math.PI) / 180);
  let bestD = Infinity, bestName = "";
  for (const [a, b, , nameIdx] of net.edges) {
    const na = net.nodes[a]; const nb = net.nodes[b];
    const ax = na[1] * kx, ay = na[0]; const bx = nb[1] * kx, by = nb[0];
    const px = p.lon * kx, py = p.lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const dM = Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320;
    if (dM < bestD) { bestD = dM; bestName = net.names[nameIdx] ?? ""; }
  }
  return { dM: bestD, name: bestName };
}

const pts: { label: string; p: LatLng }[] = [
  { label: "Barrio Brasil", p: { lat: -33.4452, lon: -70.6553 } },
  { label: "Plaza de Armas", p: { lat: -33.4372, lon: -70.6506 } },
  { label: "Barrio Lastarria", p: { lat: -33.4415, lon: -70.6435 } },
  { label: "San Joaquín (Marín sur)", p: { lat: -33.4995, lon: -70.6155 } },
  { label: "Ñuñoa (Plaza)", p: { lat: -33.4545, lon: -70.6085 } },
  { label: "Providencia (Tobalaba)", p: { lat: -33.4380, lon: -70.5750 } },
  { label: "La Reina", p: { lat: -33.4420, lon: -70.5900 } },
  { label: "Recoleta (Cementerio)", p: { lat: -33.4050, lon: -70.6420 } },
  { label: "Yungay", p: { lat: -33.4430, lon: -70.6680 } },
  { label: "Campus San Joaquín UC", p: { lat: -33.4970, lon: -70.6110 } },
];
for (const q of pts) {
  const r = distToNearestEdge(q.p);
  console.log(`${q.label}: ${r.dM.toFixed(0)} m del grafo → ${r.dM <= 250 ? "LOCAL" : "OSRM"} ("${r.name}")`);
}
