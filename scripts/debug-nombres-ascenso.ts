// ¿Qué nombre tiene el ascenso directo Puerta Pío Nono → Plaza México en el grafo?
// Para cada nombre candidato: nº aristas, bbox y distancia media a la recta gate→plaza.
const realFetch = globalThis.fetch;
globalThis.fetch = ((u: string, ...a: any[]) => realFetch(new URL(u, "http://localhost:3000"), ...a)) as typeof fetch;
import { loadNetwork, haversineM } from "../src/lib/routing";
import { NAV_DESTINATIONS } from "../src/lib/park";

function distToSeg(p: { lat: number; lon: number }, a: [number, number], b: [number, number]): number {
  const kx = Math.cos((p.lat * Math.PI) / 180);
  const px = p.lon * kx, py = p.lat;
  const ax = a[1] * kx, ay = a[0], bx = b[1] * kx, by = b[0];
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320;
}

async function main() {
  const net = await loadNetwork();
  if (!net) return;
  const gate = { lat: -33.430691, lon: -70.63592 };
  const plaza = NAV_DESTINATIONS.find((x) => x.id === "plaza-mexico")!.position;

  const stats = new Map<string, { n: number; dSum: number; dMin: number; cls: Set<string>; latMin: number; latMax: number; lonMin: number; lonMax: number }>();
  for (const [a, b, ci, ni] of net.edges) {
    const name = net.names[ni] ?? "";
    if (!name) continue;
    const pa = net.nodes[a], pb = net.nodes[b];
    const mid = { lat: (pa[0] + pb[0]) / 2, lon: (pa[1] + pb[1]) / 2 };
    const d = Math.min(distToSeg(mid, [pa[0], pa[1]], [pb[0], pb[1]]), Infinity);
    // dist del mid a la recta gate→plaza
    const dd = distToSeg(mid, [gate.lat, gate.lon], [plaza.lat, plaza.lon]);
    const s = stats.get(name) ?? { n: 0, dSum: 0, dMin: Infinity, cls: new Set<string>(), latMin: 90, latMax: -90, lonMin: 0, lonMax: -200 };
    s.n++; s.dSum += dd; s.dMin = Math.min(s.dMin, dd);
    s.cls.add(net.classes[ci]);
    s.latMin = Math.min(s.latMin, mid.lat); s.latMax = Math.max(s.latMax, mid.lat);
    s.lonMin = Math.min(s.lonMin, mid.lon); s.lonMax = Math.max(s.lonMax, mid.lon);
    stats.set(name, s);
  }
  // nombres con al menos 3 aristas a ≤80 m de la recta
  const cand = [...stats.entries()].filter(([k, s]) => s.dMin <= 80).sort((x, y) => x[1].dSum / x[1].n - y[1].dSum / y[1].n);
  console.log("nombre | n(aristas ≤80m) | dist media | clases | bbox lat,lon");
  for (const [k, s] of cand.slice(0, 25)) {
    console.log(`${k.padEnd(48)} n=${String(s.n).padStart(3)} dMedia=${(s.dSum / s.n).toFixed(0).padStart(3)}m  cls=[${[...s.cls].join(",")}]  bbox=${s.latMin.toFixed(4)},${s.lonMin.toFixed(4)} → ${s.latMax.toFixed(4)},${s.lonMax.toFixed(4)}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
