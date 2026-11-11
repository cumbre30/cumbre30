// Prueba el ascenso por tramos: gate → puntos de referencia del camino
const realFetch = globalThis.fetch;
globalThis.fetch = ((u: string, ...a: any[]) => realFetch(new URL(u, "http://localhost:3000"), ...a)) as typeof fetch;
import { loadNetwork, findRoute, haversineM } from "../src/lib/routing";
import { PAV_DEST_OPTS } from "../src/lib/routingService";
import { NAV_DESTINATIONS } from "../src/lib/park";

async function main() {
  const net = await loadNetwork();
  if (!net) return;
  const gate = { lat: -33.430691, lon: -70.63592 };
  const plaza = NAV_DESTINATIONS.find((x) => x.id === "plaza-mexico")!.position;

  const puntos: [string, { lat: number; lon: number }][] = [
    ["Sendero de los Sentidos (bajo)", { lat: -33.4295, lon: -70.6355 }],
    ["Terraza Bellavista", { lat: -33.42635, lon: -70.63385 }],
    ["Explanada / Siete Palabras", { lat: -33.42575, lon: -70.6328 }],
    ["Paseo Peatonal Cumbre (alto)", { lat: -33.4240, lon: -70.6321 }],
    ["Plaza México", plaza],
  ];
  for (const [nombre, p] of puntos) {
    const r = findRoute(net, gate, p, PAV_DEST_OPTS);
    if (!r) { console.log(`${nombre}: SIN RUTA`); continue; }
    const orden: string[] = [];
    for (const nm of r.segNames) { const n = nm || "(sin nombre)"; if (orden[orden.length - 1] !== n) orden.push(n); }
    console.log(`${nombre}: ${(r.distanceM).toFixed(0)} m · ${orden.join(" → ").slice(0, 150)}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
