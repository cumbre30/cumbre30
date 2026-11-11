// ¿Se aplicaron los puentes nuevos? ¿existen las aristas "Camino Pío Nono - Plaza México"?
const realFetch = globalThis.fetch;
globalThis.fetch = ((u: string, ...a: any[]) => realFetch(new URL(u, "http://localhost:3000"), ...a)) as typeof fetch;
import { loadNetwork, findRoute, haversineM } from "../src/lib/routing";
import { PAV_DEST_OPTS } from "../src/lib/routingService";
import { NAV_DESTINATIONS } from "../src/lib/park";

async function main() {
  const net = await loadNetwork();
  if (!net) return;
  // aristas con nombre del puente
  let cuenta = 0;
  const extremos: string[] = [];
  for (let u = 0; u < net.adj.length; u++) {
    for (const e of net.adj[u]) {
      if (e.name === "Camino Pío Nono - Plaza México") {
        cuenta++;
        if (extremos.length < 6) extremos.push(`${net.nodes[u][0].toFixed(5)},${net.nodes[u][1].toFixed(5)} ↔ ${net.nodes[e.to][0].toFixed(5)},${net.nodes[e.to][1].toFixed(5)} (${e.dist.toFixed(0)} m)`);
      }
    }
  }
  console.log(`aristas de puente aplicadas: ${cuenta}`);
  for (const e of extremos) console.log("   ", e);

  // ruta gate → Terraza con PAV_DEST_OPTS
  const gate = { lat: -33.430691, lon: -70.63592 };
  const r = findRoute(net, gate, { lat: -33.42635, lon: -70.63385 }, PAV_DEST_OPTS);
  console.log(r ? `gate→Terraza: ${(r.distanceM).toFixed(0)} m` : "gate→Terraza SIN RUTA");

  // y sin filtros
  const r2 = findRoute(net, gate, { lat: -33.42635, lon: -70.63385 });
  console.log(r2 ? `gate→Terraza sin filtros: ${(r2.distanceM).toFixed(0)} m` : "sin filtros SIN RUTA");
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
