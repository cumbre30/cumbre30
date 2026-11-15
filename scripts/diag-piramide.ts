import { readFileSync } from "node:fs";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (url: string | URL) => {
  const u = String(url);
  if (u.includes("/red-ciclista.json")) return new Response(readFileSync("/home/z/my-project/public/red-ciclista.json"), { status: 200 });
  return realFetch(url);
}) as typeof fetch;
import { computeRoute } from "@/lib/routingService";
import { loadNetwork, haversineM, type LatLng, type NavRoute } from "@/lib/routing";
import { GATES, PARK_POLYGON } from "@/lib/park";

let fails = 0;
const check = (ok: boolean, msg: string) => { console.log(`  ${ok ? "✓" : "✗ FALLO"} ${msg}`); if (!ok) fails++; };

async function main() {
  const ORIGENES: Record<string, LatLng> = {
    bellavista: { lat: -33.4345, lon: -70.6422 },
    baquedano: { lat: -33.4380, lon: -70.6540 },
    providencia: { lat: -33.4230, lon: -70.6110 },
    zapadoresSector: { lat: -33.4080, lon: -70.6390 },
  };
  const piramide = GATES.find((g) => g.id === "la-piramide")!;
  const valdivia = GATES.find((g) => g.id === "pv-norte")!;
  const poly: [number, number][] = PARK_POLYGON.map((p) => [p.lat, p.lon]);
  const inPoly = (lat: number, lon: number) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const pctInterior = (r: NavRoute) => Math.round((r.coords.filter((c) => inPoly(c.lat, c.lon)).length / r.coords.length) * 100);
  const minD = (r: NavRoute, p: LatLng) => Math.round(Math.min(...r.coords.map((c) => haversineM(c, p))));

  console.log("== v1.12.9: destino = ACCESO ciclista → ruta por FUERA del parque ==");
  for (const [k, o] of Object.entries(ORIGENES)) {
    for (const g of [piramide, valdivia]) {
      const r = await computeRoute(o, g.position, { accesoDirecto: true });
      if (!r.route) { check(false, `${k} → ${g.name}: SIN RUTA (error=${r.error})`); continue; }
      const pct = pctInterior(r.route);
      const fin = Math.round(haversineM(r.route.coords[r.route.coords.length - 1], g.position));
      check(pct <= 15, `${k} → ${g.name}: ${Math.round(r.route.distanceM)} m, interior=${pct}% (≤15), fin→portería=${fin} m`);
    }
  }

  console.log("== regresión: destino DENTRO del parque conserva la regla del acceso más cercano ==");
  const antilen: LatLng = { lat: -33.4093, lon: -70.6118 };
  const r = await computeRoute(ORIGENES.bellavista, antilen);
  if (!r.route) { check(false, "Bellavista → Piscina Antilén: SIN RUTA"); }
  else {
    const cercaAcceso = Math.min(...GATES.filter((g) => g.ciclistas).map((g) => minD(r.route!, g.position)));
    check(cercaAcceso < 400, `entra por un acceso oficial (dist. mín. ruta↔acceso = ${Math.round(cercaAcceso)} m, aviso=${JSON.stringify(r.aviso ?? null)})`);
  }

  void loadNetwork;
  console.log(fails === 0 ? "\nTODO OK ✓" : `\n${fails} FALLOS ✗`);
  process.exit(fails === 0 ? 0 : 1);
}
void main();
