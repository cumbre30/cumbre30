/* Diagnóstico ruta parcial al buscar una dirección (bug image 2):
   geocode "Fray Camilo Henríquez 255" + computeRoute desde Bellavista,
   medir distancia entre el fin de la ruta y el destino real. */

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
import { geocodeAddress } from "@/lib/geocode";
import { loadNetwork, snapInfo, haversineM, type LatLng } from "@/lib/routing";
import { computeRoute } from "@/lib/routingService";

const PUCK: LatLng = { lat: -33.4330, lon: -70.6320 }; // puck del screenshot (Bellavista oriente)

async function main() {
  const hits = await geocodeAddress("Fray Camilo Henríquez 255", PUCK);
  console.log("resultados geocode:");
  for (const h of hits) console.log(`  ${h.emoji} ${h.name} | ${h.detail} | ${h.lat.toFixed(5)}, ${h.lon.toFixed(5)}`);
  if (!hits.length) {
    console.log("sin resultados");
    return;
  }
  const dest: LatLng = { lat: hits[0].lat, lon: hits[0].lon };
  const net = await loadNetwork();
  if (!net) return;
  const b = snapInfo(net, dest);
  console.log(`\nsnap destino → nodo del grafo más cercano: ${b.distM.toFixed(0)} m (se acepta local si ≤900)`);
  const res = await computeRoute(PUCK, dest);
  console.log(`computeRoute → source=${res.source} error=${res.error}`);
  if (res.route) {
    const fin = res.route.coords[res.route.coords.length - 1];
    const faltante = haversineM(fin, dest);
    console.log(`ruta: ${(res.route.distanceM / 1000).toFixed(2)} km | fin de ruta (${fin.lat.toFixed(5)}, ${fin.lon.toFixed(5)})`);
    console.log(`DISTANCIA ENTRE FIN DE RUTA Y DESTINO: ${faltante.toFixed(0)} m  ← ${faltante > 100 ? "BUG: ruta parcial" : "ok"}`);
  }
}

main();
