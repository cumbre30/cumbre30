// ¿Qué componentes tienen Terraza/Sentidos/Excursionista/plaza y qué aristas los conectan?
const realFetch = globalThis.fetch;
globalThis.fetch = ((u: string, ...a: any[]) => realFetch(new URL(u, "http://localhost:3000"), ...a)) as typeof fetch;
import { loadNetwork, haversineM } from "../src/lib/routing";
import { corredorPav } from "../src/lib/routingService";
import { NAV_DESTINATIONS } from "../src/lib/park";

async function main() {
  const net = await loadNetwork();
  if (!net) return;
  corredorPav(net);

  const comp = new Int32Array(net.nodes.length).fill(-1);
  let nc = 0;
  for (let i = 0; i < net.nodes.length; i++) {
    if (comp[i] >= 0) continue;
    const cola = [i]; comp[i] = nc;
    while (cola.length) {
      const u = cola.pop()!;
      for (const e of net.adj[u]) if (comp[e.to] < 0) { comp[e.to] = nc; cola.push(e.to); }
    }
    nc++;
  }
  const nodosDe = (nombre: RegExp) => {
    const s = new Set<number>();
    for (const [a, b, , ni] of net.edges) if (nombre.test(net.names[ni] ?? "")) { s.add(a); s.add(b); }
    return [...s];
  };
  const comps = (nombre: RegExp) => [...new Set(nodosDe(nombre).map((n) => comp[n]))];
  console.log("componentes:");
  console.log("  Terraza Bellavista:", comps(/^Terraza Bellavista/));
  console.log("  Explanada:", comps(/^Explanada$/));
  console.log("  Camino Siete Palabras:", comps(/^Camino Siete Palabras/));
  console.log("  Paseo Peatonal Cumbre:", comps(/^Paseo Peatonal Cumbre/));
  console.log("  Sendero El Excursionista:", comps(/^Sendero El Excursionista/));
  console.log("  Paseo Metrop. - Sendero de los Sentidos:", comps(/^Paseo Metropolitano - Sendero de los Sentidos/));
  console.log("  Avenida Pedro Bannen:", comps(/^Avenida Pedro Bannen/));
  const plaza = NAV_DESTINATIONS.find((x) => x.id === "plaza-mexico")!.position;
  const plazaNodes: number[] = [];
  for (let i = 0; i < net.nodes.length; i++) if (haversineM({ lat: net.nodes[i][0], lon: net.nodes[i][1] }, plaza) <= 70) plazaNodes.push(i);
  console.log("  nodos plaza (≤70m):", [...new Set(plazaNodes.map((n) => comp[n]))]);

  // aristas que CONECTAN componentes distintos en la zona del ascenso:
  // extremos en comps distintos → son los puntos de corte
  console.log("\naristas inter-componente cerca del corredor (zona ascenso):");
  for (const [a, b, ci, ni] of net.edges) {
    if (comp[a] === comp[b]) continue;
    const pa = net.nodes[a], pb = net.nodes[b];
    const mid = { lat: (pa[0] + pb[0]) / 2, lon: (pa[1] + pb[1]) / 2 };
    // zona: entre Sentidos y plaza
    if (mid.lat > -33.4245 || mid.lat < -33.4310 || mid.lon > -70.6315 || mid.lon < -70.6370) continue;
    console.log(`  comp ${comp[a]} ↔ ${comp[b]} · ${net.classes[ci]} | "${net.names[ni] ?? "(sin nombre)"}" · mid ${mid.lat.toFixed(5)},${mid.lon.toFixed(5)}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
