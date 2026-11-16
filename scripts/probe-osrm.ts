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
import { computeRoute } from "@/lib/routingService";
import type { LatLng } from "@/lib/routing";

async function main() {
  const from: LatLng = { lat: -33.4330, lon: -70.6320 };
  const to: LatLng = { lat: -33.44539, lon: -70.63534 };
  try {
    const res = await computeRoute(from, to);
    console.log("source:", res.source, "| error:", res.error);
    if (res.route) console.log("km:", (res.route.distanceM / 1000).toFixed(2));
  } catch (e) {
    console.log("EXCEPCIÓN:", (e as Error).message);
    console.log((e as Error).stack?.split("\n").slice(0, 6).join("\n"));
  }
}
main();
