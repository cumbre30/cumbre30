/* Verifica el camino OSRM de computeRoute con respuesta simulada (sin red). */
(globalThis as any).fetch = (input: any, init?: any) => {
  const url = typeof input === "string" ? input : String(input);
  if (url.includes("routing.openstreetmap.de")) {
    const route = {
      code: "Ok",
      routes: [{
        distance: 2560, duration: 600,
        geometry: { coordinates: [[-70.632, -33.433], [-70.6335, -33.438], [-70.63526, -33.44537]] },
        legs: [{ steps: [
          { distance: 0, name: "Avenida Santa María", maneuver: { type: "depart", location: [-70.632, -33.433] } },
          { distance: 2560, name: "Avenida da la Luz", maneuver: { type: "arrive", modifier: "left", location: [-70.63526, -33.44537] } },
        ]}],
      }],
    };
    return Promise.resolve(new Response(JSON.stringify(route), { headers: { "Content-Type": "application/json" } }));
  }
  if (url.startsWith("/red-ciclista.json")) {
    const data = readFileSync("public/red-ciclista.json");
    return Promise.resolve(new Response(data, { headers: { "Content-Type": "application/json" } }));
  }
  return Promise.resolve(new Response("{}", { status: 404 }));
};
import { readFileSync } from "node:fs";
import { computeRoute } from "@/lib/routingService";
import { setLang } from "@/lib/i18n";
import type { LatLng } from "@/lib/routing";

async function main() {
  setLang("es");
  let res = await computeRoute({ lat: -33.4330, lon: -70.6320 }, { lat: -33.44539, lon: -70.63534 });
  console.log("ES →", res.source, res.error ?? `${(res.route!.distanceM/1000).toFixed(2)} km`);
  console.log("   pasos:", res.route?.steps.map(s => `[${s.icon}] ${s.text}`).join(" | "));
  setLang("en");
  res = await computeRoute({ lat: -33.4330, lon: -70.6320 }, { lat: -33.44539, lon: -70.63534 });
  console.log("EN →", res.source, res.error ?? `${(res.route!.distanceM/1000).toFixed(2)} km`);
  console.log("   pasos:", res.route?.steps.map(s => `[${s.icon}] ${s.text}`).join(" | "));
  setLang("pt");
  res = await computeRoute({ lat: -33.4330, lon: -70.6320 }, { lat: -33.44539, lon: -70.63534 });
  console.log("PT →", res.source, res.error ?? `${(res.route!.distanceM/1000).toFixed(2)} km`);
  console.log("   pasos:", res.route?.steps.map(s => `[${s.icon}] ${s.text}`).join(" | "));
}
main();
