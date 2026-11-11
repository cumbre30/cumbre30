/* Ruteo desde el nuevo Acceso PdV Norte (cruce Av. El Cerro × Av. PdV Norte)
 * hacia destinos del parque y desde la ciudad hacia el acceso. */
import { computeRoute } from "../src/lib/routingService";
import type { LatLng } from "../src/lib/park";

// en Node el fetch relativo falla: lo reescribimos al dev server
const realFetch = globalThis.fetch;
globalThis.fetch = async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input.url;
  if (typeof url === "string" && url.startsWith("/")) {
    return realFetch(`http://localhost:3000${url}`, init);
  }
  return realFetch(input, init);
};

const ACCESO: LatLng = { lat: -33.415479, lon: -70.617402 };
const PLAZA_MEXICO: LatLng = { lat: -33.4234, lon: -70.6327 };
const ANTILEN: LatLng = { lat: -33.409051, lon: -70.61374 };
const TUPAHUE: LatLng = { lat: -33.4158, lon: -70.6235 };
const EXPLANADA: LatLng = { lat: -33.4121, lon: -70.6076 };
const CIUDAD_PDV: LatLng = { lat: -33.4172, lon: -70.6165 }; // Av. PdV Norte al sur del cruce

async function main() {
  const casos: [string, LatLng, LatLng][] = [
    ["acceso → Plaza México", ACCESO, PLAZA_MEXICO],
    ["acceso → Piscina Antilén", ACCESO, ANTILEN],
    ["acceso → Piscina Tupahue", ACCESO, TUPAHUE],
    ["explanada → acceso (CicloRecreoVía/Av. El Cerro)", EXPLANADA, ACCESO],
    ["ciudad (Av. PdV Norte) → acceso", CIUDAD_PDV, ACCESO],
  ];
  for (const [nombre, from, to] of casos) {
    try {
      const r = await computeRoute(from, to);
      const pts: any = r.route?.coords ?? r.route?.points ?? [];
      const dist = (r.route?.distanceM ?? 0) / 1000;
      const n = pts.length;
      const first = n ? pts[0] : null;
      const last = n ? pts[n - 1] : null;
      console.log(
        `${nombre}: ok=${!!r.route} src=${r.source} err=${r.error ?? "-"} ${dist.toFixed(2)} km, ${n} pts, ` +
        `start=(${first && first.lat ? first.lat.toFixed(5) : "?"},${first && first.lon ? first.lon.toFixed(5) : "?"}) ` +
        `end=(${last && last.lat ? last.lat.toFixed(5) : "?"},${last && last.lon ? last.lon.toFixed(5) : "?"})`
      );
    } catch (e) {
      console.log(`${nombre}: ERROR ${e}`);
    }
  }
}
main().then(() => process.exit(0));
