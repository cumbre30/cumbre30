const realFetch = globalThis.fetch;
globalThis.fetch = ((url: string, ...a: any[]) => realFetch(new URL(String(url), "http://localhost:3000"), ...a)) as typeof fetch;
import { findRoute, haversineM, loadNetwork, type LatLng } from "../src/lib/routing";
import { PAV_DEST_OPTS } from "../src/lib/routingService";

async function main() {
  const net = await loadNetwork();
  if (!net) throw new Error("sin red");
  const plaza = { lat: -33.4234, lon: -70.6327 };
  const cases: [string, LatLng][] = [
    ["Antilén (dentro parque)", { lat: -33.4125, lon: -70.6105 }],
    ["Mackenna/Tupahue (screenshot cliente)", { lat: -33.4175, lon: -70.6252 }],
    ["Bellavista (ciudad, sobre grafo)", { lat: -33.4334, lon: -70.6400 }],
  ];
  for (const [label, from] of cases) {
    const r = findRoute(net, from, plaza, PAV_DEST_OPTS);
    if (!r) { console.log(`✗ ${label}: SIN RUTA`); continue; }
    const dist: Map<string, number> = new Map();
    for (let i = 0; i < (r.segNames?.length ?? 0); i++) {
      const d = haversineM(r.coords[i], r.coords[i + 1]);
      dist.set(r.segNames![i], (dist.get(r.segNames![i]) ?? 0) + d);
    }
    const segs: string[] = [];
    for (const nm of r.segNames ?? []) {
      if (segs[segs.length - 1] !== nm) segs.push(nm);
    }
    console.log(`\n== ${label}: ${(r.distanceM / 1000).toFixed(2)} km ==`);
    console.log("  " + segs.map((s) => `${Math.round(dist.get(s) ?? 0)}m ${s}`).join(" → "));
  }
}
main();
