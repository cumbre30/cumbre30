/* Probe: cobertura del grafo en el destino Fray Camilo Henríquez 255 */
const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as any).fetch = (input: any, init?: any) => {
  if (typeof input === "string" && input.startsWith("/red-ciclista.json")) {
    const data = readFileSync("public/red-ciclista.json");
    return Promise.resolve(new Response(data, { headers: { "Content-Type": "application/json" } }));
  }
  if (typeof input === "string" && input.startsWith("/")) return realFetch("http://localhost:3000" + input, init);
  return realFetch(input, init);
};
import { readFileSync } from "node:fs";
import { loadNetwork, snapInfo, type Network, type LatLng } from "@/lib/routing";

function nearestEdgeDist(net: Network, p: LatLng): number {
  const kx = Math.cos((p.lat * Math.PI) / 180);
  let bestD = Infinity;
  for (const e of net.edges) {
    const [a, b] = e as unknown as [number, number];
    const na = net.nodes[a], nb = net.nodes[b];
    const ax = na[1] * kx, ay = na[0], bx = nb[1] * kx, by = nb[0];
    const px = p.lon * kx, py = p.lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const dM = Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320;
    if (dM < bestD) bestD = dM;
  }
  return bestD;
}

async function main() {
  const dest: LatLng = { lat: -33.44539, lon: -70.63534 };
  const net = await loadNetwork();
  if (!net) return;
  const sn = snapInfo(net, dest);
  const nodo = net.nodes[sn.idx];
  console.log(`nodo más cercano: ${sn.distM.toFixed(0)} m (${nodo[0].toFixed(5)}, ${nodo[1].toFixed(5)})`);
  console.log(`arista más cercana: ${nearestEdgeDist(net, dest).toFixed(0)} m`);
}

main();
