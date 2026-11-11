// Aristas en la zona de quiebre (-33.4280..-33.4260, -70.6350..-70.6333)
const realFetch = globalThis.fetch;
globalThis.fetch = ((u: string, ...a: any[]) => realFetch(new URL(u, "http://localhost:3000"), ...a)) as typeof fetch;
import { loadNetwork, haversineM } from "../src/lib/routing";
import { corredorOk, enCorredorPav } from "../src/lib/routingService";

async function main() {
  const net = await loadNetwork();
  if (!net) return;
  const z = { latMin: -33.4282, latMax: -33.4258, lonMin: -70.6352, lonMax: -70.6330 };
  const dentro = (p: [number, number]) => p[0] >= z.latMin && p[0] <= z.latMax && p[1] >= z.lonMin && p[1] <= z.lonMax;
  const filas = new Map<string, { n: number; cor55: number; cor22: number }>();
  for (const [a, b, ci, ni] of net.edges) {
    const pa = net.nodes[a], pb = net.nodes[b];
    if (!dentro(pa) && !dentro(pb)) continue;
    const cls = net.classes[ci], name = net.names[ni] ?? "";
    const mid = { lat: (pa[0] + pb[0]) / 2, lon: (pa[1] + pb[1]) / 2 };
    const k = `${cls} | ${name || "(sin nombre)"}`;
    const f = filas.get(k) ?? { n: 0, cor55: 0, cor22: 0 };
    f.n++;
    if (enCorredorPav(mid.lat, mid.lon, 55)) f.cor55++;
    if (enCorredorPav(mid.lat, mid.lon, 22)) f.cor22++;
    filas.set(k, f);
  }
  console.log("zona de quiebre — clase | nombre: n, en corredor 55m, 22m");
  for (const [k, v] of [...filas.entries()].sort((x, y) => y[1].n - x[1].n)) console.log(`  ${String(v.n).padStart(3)}  cor55=${String(v.cor55).padStart(3)} cor22=${String(v.cor22).padStart(3)}  ${k}`);
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
