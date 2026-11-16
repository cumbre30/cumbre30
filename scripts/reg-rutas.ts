/* Regresión ruteo presets r1-r5: compara distancias antes/después del
   fix del cityOk estricto. Ejecutar: npx tsx scripts/reg-rutas.ts */

import { readFileSync } from "node:fs";

const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as any).fetch = (input: any, init?: any) => {
  if (typeof input === "string" && input.startsWith("/red-ciclista.json")) {
    const data = readFileSync("public/red-ciclista.json");
    return Promise.resolve(new Response(data, { headers: { "Content-Type": "application/json" } }));
  }
  if (typeof input === "string" && input.startsWith("/")) return realFetch("http://localhost:3000" + input, init);
  return realFetch(input, init);
};

import { computePresetRoute } from "@/lib/routingService";
import { haversineM, type LatLng } from "@/lib/routing";

const ORIGENES: Record<string, LatLng> = {
  "AndresBello1337": { lat: -33.427192, lon: -70.6215983 }, // oriente, junto al río
  "Bellavista/PioNono": { lat: -33.4306903, lon: -70.6362729 }, // oeste, boca Pío Nono
};

async function main() {
  const rutas = ["ruta-1", "ruta-2", "ruta-3", "ruta-4", "ruta-5"];
  for (const [nombreOrigen, from] of Object.entries(ORIGENES)) {
    for (const rutaId of rutas) {
      const res = await computePresetRoute(from, { rutaId, nombre: rutaId }, { fullTrace: true });
      const km = res.route ? (res.route.distanceM / 1000).toFixed(2) : "sin ruta";
      const primera = res.route?.steps?.[0]?.text ?? res.error ?? "";
      console.log(`${rutaId} | ${nombreOrigen} | ${km} km | ${primera}`);
    }
  }
}

main();
