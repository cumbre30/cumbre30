import { readFileSync } from "node:fs";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { execFileSync } from "node:child_process";
const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (url: string | URL) => {
  const u = String(url);
  if (u.includes("/red-ciclista.json")) return new Response(readFileSync("/home/z/my-project/public/red-ciclista.json"), { status: 200 });
  // El sandbox no resuelve bien el fetch de Node hacia el servidor OSRM;
  // para el e2e usamos curl (en producción va el fetch real del navegador).
  if (u.includes("routing.openstreetmap.de")) {
    const out = execFileSync("curl", ["-s", "-m", "25", u], { maxBuffer: 64 * 1024 * 1024 });
    return new Response(out.toString(), { status: 200 });
  }
  return realFetch(url);
}) as typeof fetch;
import { computeRoute } from "@/lib/routingService";
import { loadNetwork, snapInfo, haversineM, type LatLng, type NavRoute } from "@/lib/routing";
import { GATES, PARK_POLYGON } from "@/lib/park";

async function main() {
  const net = await loadNetwork();
  const piramide = GATES.find((g) => g.id === "la-piramide")!;
  const poly: [number, number][] = PARK_POLYGON.map((p) => [p.lat, p.lon]);
  const inPoly = (lat: number, lon: number) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const interiorM = (r: NavRoute, dest: LatLng) => {
    let m = 0;
    for (let i = 0; i < r.coords.length; i++) {
      const c = r.coords[i];
      if (inPoly(c.lat, c.lon) && haversineM(c, dest) > 150) m += haversineM(c, r.coords[i + 1] ?? c);
    }
    return Math.round(m);
  };
  const ORIGENES: Record<string, LatLng> = {
    santaIsabel: { lat: -33.4470, lon: -70.6420 },
    plazaArgentina: { lat: -33.4550, lon: -70.6550 },
  };
  for (const [k, o] of Object.entries(ORIGENES)) {
    const s = snapInfo(net, o);
    console.log(`${k}: snap a grafo = ${Math.round(s.distM)} m`);
    const r = await computeRoute(o, piramide.position, { accesoDirecto: true });
    if (!r.route) { console.log(`  SIN RUTA (error=${r.error})`); continue; }
    console.log(`  → source=${r.source} ${Math.round(r.route.distanceM)} m | metros DENTRO del parque (sin portería) = ${interiorM(r.route, piramide.position)} m`);
  }
}
void main();
