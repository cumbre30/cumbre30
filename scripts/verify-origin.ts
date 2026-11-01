// Verificación: la ruta debe partir EXACTAMENTE de la ubicación del
// usuario (no del nodo de la ciclovía) y el progreso debe seguir
// funcionando sobre la ruta anclada.
import fs from "node:fs";
import path from "node:path";

// shim de fetch para /red-ciclista.json (el módulo lo pide con fetch)
const realFetch = globalThis.fetch;
(globalThis as unknown as { fetch: typeof fetch }).fetch = ((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("red-ciclista.json")) {
    const raw = fs.readFileSync(path.join(process.cwd(), "public", "red-ciclista.json"), "utf8");
    return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(raw)) } as unknown as Response);
  }
  return realFetch(input as RequestInfo) as Promise<Response>;
}) as typeof fetch;

import { attachOrigin, groupSegments, haversineM, routeProgress } from "../src/lib/routing";
import { computeRoute } from "../src/lib/routingService";

async function main() {
  // usuario a ~60 m del Acceso Pío Nono (no sobre un nodo)
  const from = { lat: -33.4303, lon: -70.6355 };
  const to = { lat: -33.404, lon: -70.617 }; // Cumbre

  const res = await computeRoute(from, to);
  if (!res.route) throw new Error("sin ruta: " + res.error);
  const r = res.route;

  console.log("source:", res.source, "| tramos:", r.coords.length, "| distancia:", r.distanceM, "m | ciclovía:", r.cicloviaPct + "%");

  // 1) el primer vértice ES la ubicación exacta del usuario
  const d0 = haversineM(from, r.coords[0]);
  console.log("1) coords[0] == mi ubicación →", d0 < 0.001 ? "OK (exacto)" : `FALLO (${d0.toFixed(1)} m)`);
  if (d0 >= 0.001) process.exit(1);

  // 2) flags/segNames coherentes con la nueva geometría
  const okFlags = r.flags.length === r.coords.length - 1 && r.segNames.length === r.coords.length - 1;
  console.log("2) flags/segNames alineados →", okFlags ? "OK" : "FALLO");
  if (!okFlags) process.exit(1);

  // 3) el primer tramo conecta mi punto con la red (longitud razonable)
  const conn = haversineM(r.coords[0], r.coords[1]);
  console.log("3) conector mi punto → red:", conn.toFixed(0), "m →", conn > 5 && conn < 800 ? "OK" : "revisar");

  // 4) distancia total ≥ suma de tramos (consistencia)
  let sum = 0;
  for (let i = 0; i < r.coords.length - 1; i++) sum += haversineM(r.coords[i], r.coords[i + 1]);
  console.log("4) distanceM vs suma de tramos:", r.distanceM, "vs", Math.round(sum), "→", Math.abs(r.distanceM - sum) < 15 ? "OK" : "revisar");

  // 5) progreso sobre la ruta anclada: usuario avanzado al tramo 5
  const mid = r.coords[5];
  const p = routeProgress(r, { lat: mid.lat + 0.00001, lon: mid.lon });
  console.log("5) progreso → nearestIdx:", p.nearestIdx, "| restante:", Math.round(p.remainingM), "m | offRoute:", p.offRouteM.toFixed(1), "m →", p.nearestIdx >= 3 && p.remainingM < r.distanceM ? "OK" : "revisar");

  // 6) agrupado cubre TODA la ruta restante sin cortes
  const groups = groupSegments(r.coords, r.flags, 0, r.coords.length - 2);
  const covered = groups.reduce((a, g) => a + g.coords.length - 1, 0);
  console.log("6) grupos cubren tramos:", covered, "de", r.coords.length - 1, "→", covered === r.coords.length - 1 ? "OK (sin cortes)" : "FALLO");
  if (covered !== r.coords.length - 1) process.exit(1);

  // 7) attachOrigin no duplica si ya parte del punto
  const again = attachOrigin(r, r.coords[0]);
  console.log("7) attachOrigin idempotente →", again.coords.length === r.coords.length ? "OK" : "FALLO");
  if (again.coords.length !== r.coords.length) process.exit(1);

  console.log("\nTODO OK ✓");
  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
