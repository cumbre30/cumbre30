// ============================================================
// Verifica la nueva decisión del popup «Ruta» (v1.12.12, cliente
// 2026-11-15) con el ejemplo del cliente: Ruta 4 (nace en La
// Pirámide) y origen Bellavista:
//  · «ingresar» → entra por el ACCESO MÁS CERCANO AL CICLISTA
//    (Pío Nono) y al inicio de la ruta llega POR DENTRO.
//  · «sin ingresar» → por la vía pública hasta el acceso donde
//    NACE el trazado (La Pirámide).
// Ejecutar: node_modules/.bin/tsx scripts/check-popup-ingreso.ts
// ============================================================
import { CAPA_RUTAS, rutaTrazado } from "../src/lib/mapLayers";
import { GATES } from "../src/lib/park";
import { haversineM, type LatLng } from "../src/lib/routing";
import { computePresetRoute, computeRoute } from "../src/lib/routingService";
import { accesoCiclistaMasCercano } from "../src/lib/reglasAcceso";
import { readFileSync } from "node:fs";

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

const GATE_INICIO_UM_M = 120;
function gateDeTrazado(inicio: LatLng) {
  let best: (typeof GATES)[number] | null = null;
  let bd = Infinity;
  for (const g of GATES) {
    if (!g.ciclistas) continue;
    const d = haversineM(inicio, g.position);
    if (d < bd) {
      bd = d;
      best = g;
    }
  }
  return best && bd <= GATE_INICIO_UM_M ? best : null;
}

// Plaza Camilo Mori, Bellavista
const bellavista: LatLng = { lat: -33.42659, lon: -70.64033 };

const gateIngreso = accesoCiclistaMasCercano(bellavista);
console.log(`\n[decisión] acceso ciclista más cercano a Bellavista: ${gateIngreso?.gate.id} (${Math.round(gateIngreso?.distM ?? -1)} m)`);

void (async () => {
for (const id of ["ruta-1", "ruta-3", "ruta-4", "mtb-1"]) {
  const r = CAPA_RUTAS.find((x) => x.id === id)!;
  const t = rutaTrazado(r);
  const inicio = t.coords[0];
  const gateInicio = gateDeTrazado(inicio) ?? accesoCiclistaMasCercano(inicio)?.gate;
  console.log(`[decisión] ${id}: nace en ${gateInicio?.id ?? "-"} · popup = «Ingresar por el ${gateIngreso?.gate.name}» / «Por fuera hasta el ${gateInicio?.name}»`);
}

// Opción A «ingresar»: Ruta 4 desde Bellavista — debe entrar por Pío Nono
// y llegar al inicio del trazado POR DENTRO, luego el trazado completo.
const r4 = CAPA_RUTAS.find((x) => x.id === "ruta-4")!;
const tR4 = rutaTrazado(r4);
const resA = await computePresetRoute(bellavista, { rutaId: r4.id, nombre: r4.nombre }, { fullTrace: true, ingresoCercano: true });
if (!resA.route) {
  console.log("\n[OPCIÓN INGRESAR] ERROR:", resA.error);
} else {
  const st = resA.route.steps;
  const ingresoStep = st.find((s) => s.text.startsWith("Ingresa por"));
  const beginStep = st.find((s) => s.text.startsWith("Comienza"));
  const first = resA.route.coords[0];
  const afterHead = resA.route.coords[Math.min(30, resA.route.coords.length - 1)];
  console.log(`\n[OPCIÓN INGRESAR] ruta-4 desde Bellavista: ${(resA.route.distanceM / 1000).toFixed(2)} km · ${resA.route.steps.length} pasos · ${st.length ? Math.round(resA.route.etaMin) : "?"} min`);
  console.log(`  paso ingreso: «${ingresoStep?.text ?? "(no hay)"}»`);
  console.log(`  paso inicio:  «${beginStep?.text ?? "(no hay)"}»`);
  console.log(`  arranque cerca de Bellavista: ${haversineM(first, bellavista).toFixed(0)} m`);
  console.log(`  hacia el acceso (c30m): cerca de Pío Nono=${haversineM(afterHead, GATES.find((g) => g.id === "pio-nono")!.position).toFixed(0)} m`);
  const dInicioTrace = resA.route.coords.findIndex((c) => haversineM(c, tR4.coords[0]) < 40);
  console.log(`  pasa por el inicio del trazado (La Pirámide): idx=${dInicioTrace} ${dInicioTrace > 0 ? "✓ (llegó POR DENTRO antes de recorrer la ruta)" : "✗"}`);
}

// Opción B «sin ingresar»: por la vía pública hasta La Pirámide (acceso
// donde nace la ruta 4), sin meterse al cerro.
const gateLP = GATES.find((g) => g.id === "la-piramide")!;
const resB = await computeRoute(bellavista, gateLP.position, { accesoDirecto: true });
if (!resB.route) {
  console.log("\n[OPCIÓN POR FUERA] ERROR:", resB.error);
} else {
  const fin = resB.route.coords[resB.route.coords.length - 1];
  console.log(`[OPCIÓN POR FUERA] Bellavista → Acceso La Pirámide: ${(resB.route.distanceM / 1000).toFixed(2)} km · fin a ${haversineM(fin, gateLP.position).toFixed(0)} m de la portería`);
}
})();
