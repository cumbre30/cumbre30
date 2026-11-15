// ============================================================
// Verifica el comportamiento del botón «Ruta» SIN popup (cliente
// 2026-11-15: «quita el pop up de las rutas, dejar como estaba»)
// con el ejemplo del cliente: RUTA 4 desde Bellavista — la ruta
// se traza POR FUERA (vía pública) hasta el acceso La Pirámide,
// donde COMIENZA el trazado, y ahí se recorre completo.
// También sanity-check de r1 y mtb-1.
// Ejecutar: node_modules/.bin/tsx scripts/check-ruta4-porfuera.ts
// ============================================================
import { readFileSync } from "node:fs";
import { CAPA_RUTAS, rutaTrazado } from "../src/lib/mapLayers";
import { GATES } from "../src/lib/park";
import { haversineM, type LatLng } from "../src/lib/routing";
import { computePresetRoute } from "../src/lib/routingService";

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

void (async () => {
  // Ruta 4: esperamos tramo de ciudad POR FUERA hasta La Pirámide
  // (nace en esa portería) y luego el trazado completo.
  const r4 = CAPA_RUTAS.find((x) => x.id === "ruta-4")!;
  const t4 = rutaTrazado(r4);
  const res = await computePresetRoute(bellavista, { rutaId: r4.id, nombre: r4.nombre }, { fullTrace: true });
  if (!res.route) {
    console.log("[RUTA 4] ERROR:", res.error);
    return;
  }
  const st = res.route.steps;
  const ingresoStep = st.find((s) => s.text.startsWith("Ingresa por"));
  const beginStep = st.find((s) => s.text.startsWith("Comienza"));
  // ¿la cabeza de la ruta (antes del trazado) pasa por La Pirámide?
  let idxLP = -1;
  let idxInicioTrace = res.route.coords.findIndex((c) => haversineM(c, t4.coords[0]) < 40);
  for (let i = 0; i < res.route.coords.length; i++) {
    if (haversineM(res.route.coords[i], gateLP.position) < 60) {
      idxLP = i;
      break;
    }
  }
  console.log(`[RUTA 4 desde Bellavista] ${(res.route.distanceM / 1000).toFixed(2)} km · ${st.length} pasos · ${res.route.etaMin} min`);
  console.log(`  paso ingreso: «${ingresoStep?.text ?? "(no hay)"}»`);
  console.log(`  paso inicio:  «${beginStep?.text ?? "(no hay)"}»`);
  console.log(`  pasa por Acceso La Pirámide: idx=${idxLP} ${idxLP >= 0 ? "✓" : "✗"}`);
  console.log(`  el trazado comienza en/junto al Acceso La Pirámide: inicio trazado idx=${idxInicioTrace} ${idxLP >= 0 && idxInicioTrace >= idxLP && idxInicioTrace - idxLP < 5 ? "✓ (ciudad por fuera → acceso → trazado)" : "✗"}`);
  const dentroCabeza = res.route.coords.slice(0, Math.max(1, idxInicioTrace)).filter((c) => {
    // aproximación: el parque interior está al norte de La Pirámide;
    // basta comprobar que no hay nodos del trazado antes del inicio
    return false;
  });
  console.log(`  inicio de ruta cerca de Bellavista (arranque en la ciudad): ${haversineM(res.route.coords[0], bellavista).toFixed(0)} m`);

  // Sanity: r1 (nace en PdV Norte) y mtb-1 (nace dentro → acceso más cercano)
  for (const id of ["ruta-1", "mtb-1"]) {
    const r = CAPA_RUTAS.find((x) => x.id === id)!;
    const rr = await computePresetRoute(bellavista, { rutaId: r.id, nombre: r.nombre }, { fullTrace: true });
    const ing = rr.route?.steps.find((s) => s.text.startsWith("Ingresa por"));
    console.log(`[${id} desde Bellavista] ${rr.route ? `${(rr.route.distanceM / 1000).toFixed(2)} km · «${ing?.text ?? "-"}»` : `ERROR: ${rr.error}`}`);
  }
})();
