// ============================================================
// Verifica el botón «Ruta» SIN popup y con el tramo de ciudad
// SIEMPRE POR FUERA del parque (cliente 2026-11-15: «me marca con
// ingreso al cerro y debe ser por fuera, así como la ruta 1 y 2
// parten del acceso»).
// · RUTA 4 desde Bellavista: vía pública hasta el Acceso La
//   Pirámide (cero interior del parque salvo la boca del acceso)
//   y el trazado comienza ahí.
// · r1-r5: tramo de ciudad sin interior del parque (>150 m del inicio).
// · mtb-1: acceso más cercano + tramo interno (dentro es legítimo).
// Ejecutar: node_modules/.bin/tsx scripts/check-ruta4-porfuera.ts
// ============================================================
import { readFileSync } from "node:fs";
import { CAPA_RUTAS, rutaTrazado } from "../src/lib/mapLayers";
import { GATES } from "../src/lib/park";
import { haversineM, loadNetwork, snapInfo, type LatLng } from "../src/lib/routing";
import { computePresetRoute, parkInsideTest } from "../src/lib/routingService";

// tsx no sirve estáticos: /red-ciclista.json se lee de public/ y el resto
// de fetches (OSRM) van al fetch real.
const redJson = readFileSync("public/red-ciclista.json", "utf8");
const fetchReal = globalThis.fetch;
(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (url: RequestInfo | URL) => {
  const u = String(url);
  if (u.includes("/red-ciclista.json")) {
    return { ok: true, json: async () => JSON.parse(redJson) } as unknown as Response;
  }
  return fetchReal(url);
}) as typeof fetch;

// Plaza Camilo Mori, Bellavista
const bellavista: LatLng = { lat: -33.42659, lon: -70.64033 };
const gateLP = GATES.find((g) => g.id === "la-piramide")!;
const dentroEstricto = parkInsideTest(0);

/** metros de la cabeza de la ruta (hasta el inicio del trazado) que van
 *  por DENTRO del parque, excluida la boca del acceso (150 m). */
function interiorCabeza(coords: LatLng[], inicioTrace: LatLng, idxTrace: number): number {
  let m = 0;
  for (let i = 0; i < idxTrace && i < coords.length - 1; i++) {
    const c = coords[i];
    if (dentroEstricto(c.lat, c.lon) && haversineM(c, inicioTrace) > 150) {
      m += haversineM(c, coords[i + 1]);
    }
  }
  return m;
}

void (async () => {
  // RUTA 4 desde varios orígenes (Bellavista = control; los lejanos
  // ejercitan el híbrido OSRM→ancla→portería cuando el origen queda a
  // >250 m de un nodo del grafo local). Con OSRM inaccesible desde el
  // sandbox, orígenes fuera de cobertura local pueden fallar: en el
  // dispositivo real OSRM responde y el híbrido completa por fuera.
  const r4 = CAPA_RUTAS.find((x) => x.id === "ruta-4")!;
  const t4 = rutaTrazado(r4);
  const ORIGENES: Record<string, LatLng> = {
    "Bellavista (Plaza Camilo Mori)": bellavista,
    "Plaza de Armas": { lat: -33.4372, lon: -70.6506 },
    "Parque O'Higgins": { lat: -33.4570, lon: -70.6622 },
  };
  const netP = await loadNetwork();
  for (const [nomOrg, org] of Object.entries(ORIGENES)) {
    const snapD = netP ? snapInfo(netP, org).distM : -1;
    const res = await computePresetRoute(org, { rutaId: r4.id, nombre: r4.nombre }, { fullTrace: true });
    if (!res.route) {
      console.log(`[RUTA 4 · ${nomOrg}] ERROR: ${res.error} · snap ${Math.round(snapD)} m (con OSRM caído y origen fuera de cobertura local no hay tramo posible; en el dispositivo el híbrido OSRM→ancla lo completa)`);
      continue;
    }
    const st = res.route.steps;
    const ingresoStep = st.find((s) => s.text.startsWith("Ingresa por"));
    const beginStep = st.find((s) => s.text.startsWith("Comienza"));
    let idxLP = -1;
    const idxTrace = res.route.coords.findIndex((c) => haversineM(c, t4.coords[0]) < 40);
    for (let i = 0; i < res.route.coords.length; i++) {
      if (haversineM(res.route.coords[i], gateLP.position) < 60) {
        idxLP = i;
        break;
      }
    }
    const metroInside = interiorCabeza(res.route.coords, t4.coords[0], idxTrace);
    console.log(`[RUTA 4 · ${nomOrg}] snap ${Math.round(snapD)} m · ${(res.route.distanceM / 1000).toFixed(2)} km · ${st.length} pasos · ${res.route.etaMin} min`);
    console.log(`  paso ingreso: «${ingresoStep?.text ?? "(no hay)"}»`);
    console.log(`  paso inicio:  «${beginStep?.text ?? "(no hay)"}»`);
    console.log(`  pasa por Acceso La Pirámide: idx=${idxLP} ${idxLP >= 0 ? "✓" : "✗"} · trazado arranca ahí: ${idxLP >= 0 && idxTrace >= idxLP && idxTrace - idxLP < 5 ? "✓ (ciudad por fuera → acceso → trazado)" : "✗"}`);
    console.log(`  tramo de ciudad DENTRO del parque (salvo boca acceso): ${Math.round(metroInside)} m ${metroInside < 50 ? "✓ POR FUERA" : "✗ SE METE AL CERRO"}`);
  }

  // r1-r5: tramo de ciudad sin interior del parque; mtb-1 sanity.
  for (const id of ["ruta-1", "ruta-2", "ruta-3", "ruta-5", "mtb-1"]) {
    const r = CAPA_RUTAS.find((x) => x.id === id)!;
    const tt = rutaTrazado(r);
    const rr = await computePresetRoute(bellavista, { rutaId: r.id, nombre: r.nombre }, { fullTrace: true });
    if (!rr.route) {
      console.log(`[${id}] ERROR: ${rr.error}`);
      continue;
    }
    const ing = rr.route.steps.find((s) => s.text.startsWith("Ingresa por"));
    const itx = rr.route.coords.findIndex((c) => haversineM(c, tt.coords[0]) < 40);
    const mi = itx >= 0 ? interiorCabeza(rr.route.coords, tt.coords[0], itx) : -1;
    const esMtb = id.startsWith("mtb");
    console.log(
      `[${id}] ${(rr.route.distanceM / 1000).toFixed(2)} km · «${ing?.text ?? "-"}» · ciudad dentro parque: ${esMtb ? "n/a (lleva tramo interno propio del MTB)" : `${Math.round(mi)} m ${mi < 50 ? "✓ POR FUERA" : "✗"}`}`,
    );
  }
})();
