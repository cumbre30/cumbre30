// ¿Se puede recorrer la cadena con filtros? tramos: gate → Excursionista alto,
// Excursionista alto → Terraza (vía puente), Terraza → Explanada
const realFetch = globalThis.fetch;
globalThis.fetch = ((u: string, ...a: any[]) => realFetch(new URL(u, "http://localhost:3000"), ...a)) as typeof fetch;
import { loadNetwork, findRoute } from "../src/lib/routing";
import { PAV_DEST_OPTS } from "../src/lib/routingService";

async function main() {
  const net = await loadNetwork();
  const excAlto = { lat: -33.42639, lon: -70.63273 };
  const terraza = { lat: -33.42647, lon: -70.63358 };
  const gate = { lat: -33.430691, lon: -70.63592 };

  const casos: [string, { lat: number; lon: number }, { lat: number; lon: number }][] = [
    ["gate → Excursionista alto", gate, excAlto],
    ["Excursionista alto → Terraza (puente 79m)", excAlto, terraza],
    ["Terraza → Explanada (puente 35m)", terraza, { lat: -33.42596, lon: -70.63365 }],
    ["gate → Terraza", gate, terraza],
  ];
  for (const [nombre, a, b] of casos) {
    const r = findRoute(net, a, b, PAV_DEST_OPTS);
    if (!r) { console.log(`${nombre}: SIN RUTA`); continue; }
    const orden: string[] = [];
    for (const nm of r.segNames) { const n = nm || "(sin nombre)"; if (orden[orden.length - 1] !== n) orden.push(n); }
    console.log(`${nombre}: ${(r.distanceM).toFixed(0)} m · ${orden.join(" → ").slice(0, 120)}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
