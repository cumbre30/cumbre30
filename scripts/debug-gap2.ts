// Zona de quiebre con CORREDOR CALENTADO (net incluida)
const realFetch = globalThis.fetch;
globalThis.fetch = ((u: string, ...a: any[]) => realFetch(new URL(u, "http://localhost:3000"), ...a)) as typeof fetch;
import { loadNetwork, findRoute, haversineM } from "../src/lib/routing";
import { corredorOk, enCorredorPav, corredorPav } from "../src/lib/routingService";
import { NAV_DESTINATIONS } from "../src/lib/park";

async function main() {
  const net = await loadNetwork();
  if (!net) return;
  corredorPav(net); // CALIENTA

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
  console.log("zona de quiebre (corredor calentado):");
  for (const [k, v] of [...filas.entries()].sort((x, y) => y[1].n - x[1].n)) console.log(`  ${String(v.n).padStart(3)}  cor55=${String(v.cor55).padStart(3)} cor22=${String(v.cor22).padStart(3)}  ${k}`);

  // y la ruta completa de nuevo
  const gate = { lat: -33.430691, lon: -70.63592 };
  const plaza = NAV_DESTINATIONS.find((x) => x.id === "plaza-mexico")!.position;
  const r = findRoute(net, gate, plaza, PAV_DEST());
  if (r) {
    const orden: string[] = [];
    for (const nm of r.segNames) { const n = nm || "(sin nombre)"; if (orden[orden.length - 1] !== n) orden.push(n); }
    console.log(`\ngate→plaza con PAV_DEST_OPTS: ${(r.distanceM).toFixed(0)} m · ${orden.join(" → ").slice(0, 130)}`);
  }
  function PAV_DEST() {
    // eslint-disable-next-line
    const { PAV_DEST_OPTS } = require("../src/lib/routingService");
    return PAV_DEST_OPTS;
  }
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
