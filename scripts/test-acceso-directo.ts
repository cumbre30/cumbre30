// ============================================================
// Test e2e (v1.12.8): acceso Valdivia DIRECTO desde el minimapa.
// Corre computeRoute real contra el grafo local (red-ciclista.json):
//   1. SIN flag (comportamiento anterior): la ruta a pv-norte PASA
//      por el acceso Pío Nono (desvío en 2 tramos).
//   2. CON accesoDirecto (minimapa «Ir a»): ruta DIRECTA por la
//      calle, lejos de Pío Nono, terminando en la portería.
//   3. Unidades de navSnap: filtro anti-saltos + snapping.
// Run: npx --yes tsx scripts/test-acceso-directo.ts
// ============================================================

import { readFileSync } from "node:fs";

// --- shim de fetch: loadNetwork pide "/red-ciclista.json" -------------
const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (url: string | URL) => {
  const u = String(url);
  if (u.includes("/red-ciclista.json")) {
    const body = readFileSync(new URL("../public/red-ciclista.json", import.meta.url));
    return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  }
  return realFetch(url);
}) as typeof fetch;

import { computeRoute } from "@/lib/routingService";
import { loadNetwork, haversineM, type LatLng, type NavRoute } from "@/lib/routing";
import { GATES } from "@/lib/park";
import { createSmoother, snapToNet, snapToRoute } from "@/lib/navSnap";

let fails = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? "✓" : "✗ FALLO"} ${msg}`);
  if (!ok) fails++;
};

const minDistTo = (route: NavRoute, p: LatLng): number => {
  let m = Infinity;
  for (const c of route.coords) m = Math.min(m, haversineM(c, p));
  return m;
};

async function main() {
  const valdivia = GATES.find((g) => g.id === "pv-norte")!;
  const pioNono = GATES.find((g) => g.id === "pio-nono")!;
  const bellavista: LatLng = { lat: -33.4345, lon: -70.6422 }; // Pío Nono × Constitución

  console.log("== 1) SIN accesoDirecto (comportamiento anterior) ==");
  const viejo = await computeRoute(bellavista, valdivia.position);
  check(!!viejo.route, `ruta calculada (source=${viejo.source}${viejo.route ? `, ${viejo.route.distanceM} m` : ""})`);
  if (viejo.route) {
    const dNono = Math.round(minDistTo(viejo.route, pioNono.position));
    check(dNono < 250, `pasa cerca de Pío Nono (dist. mín. ${dNono} m — desvío esperado en el flujo viejo)`);
  }

  console.log("== 2) CON accesoDirecto (minimapa «Ir a») ==");
  const nuevo = await computeRoute(bellavista, valdivia.position, { accesoDirecto: true });
  check(!!nuevo.route, `ruta calculada (source=${nuevo.source}${nuevo.route ? `, ${nuevo.route.distanceM} m` : ""})`);
  if (nuevo.route) {
    const dNono = Math.round(minDistTo(nuevo.route, pioNono.position));
    check(dNono > 300, `NO pasa por Pío Nono (dist. mín. ${dNono} m)`);
    const last = nuevo.route.coords[nuevo.route.coords.length - 1];
    check(haversineM(last, valdivia.position) < 80, `termina en la portería Valdivia (${Math.round(haversineM(last, valdivia.position))} m)`);
    const conAviso = (nuevo.aviso ?? "").includes("Ingresa por");
    check(!conAviso, `sin banner «Ingresa por …» (aviso=${JSON.stringify(nuevo.aviso ?? null)})`);
  }

  console.log("== 3) navSnap: filtro anti-saltos ==");
  const smoother = createSmoother();
  const p1 = smoother({ lat: -33.4345, lon: -70.6422 }, 10, 8);
  check(!!p1, "primer fix aceptado");
  const p2 = smoother({ lat: -33.42, lon: -70.61 }, 10, 8); // teleporte ~3 km
  check(p2 === null, "teleporte imposible descartado");
  const p3 = smoother({ lat: -33.434501, lon: -70.642201 }, 0.5, 6); // jitter en reposo
  check(p3 !== null && haversineM(p3, { lat: -33.4345, lon: -70.6422 }) < 1.2, "jitter en reposo suprimido (mantiene posición)");
  const p4 = smoother({ lat: -33.4345, lon: -70.6422 }, 10, 80); // precisión mala
  check(p4 === null, "fix con precisión >45 m descartado");

  console.log("== 4) navSnap: snapping a calzada ==");
  const net = await loadNetwork();
  check(!!net, "grafo cargado");
  if (net) {
    const n0 = 100;
    const nodePos: LatLng = { lat: net.nodes[n0][0], lon: net.nodes[n0][1] };
    const off: LatLng = { lat: nodePos.lat + 0.00008, lon: nodePos.lon + 0.00008 }; // ~11 m
    const sn = snapToNet(net, off);
    check(!!sn && sn !== null, `pin pegado a vía cercana (${sn ? "ok" : "null"})`);
    const lejos: LatLng = { lat: nodePos.lat + 0.01, lon: nodePos.lon + 0.01 }; // ~1.5 km
    // Umbral con red sintética (determinista: con datos reales siempre hay
    // otra calle a <30 m en Santiago)
    const netFake = {
      classes: [], names: [],
      nodes: [[nodePos.lat, nodePos.lon]] as [number, number][],
      edges: [] as unknown as Network["edges"],
      cicloviaPolylines: [],
      adj: [[]] as Network["adj"],
    };
    check(snapToNet(netFake, lejos) === null, "sin vía a <30 m → sin snap (red sintética, umbral)");
    const ruta: NavRoute = {
      coords: [
        { lat: -33.43, lon: -70.64 },
        { lat: -33.43, lon: -70.63 },
        { lat: -33.42, lon: -70.63 },
      ],
      distanceM: 1000,
      steps: [],
      cicloviaPct: 0,
      etaMin: 4,
      flags: [false, false],
      segNames: ["A", "B"],
    };
    const sp = snapToRoute(ruta, 0, { lat: -33.43, lon: -70.6355 }); // ~45 m al este del tramo 1
    check(sp !== null, "pin proyectado a la ruta activa (≤40 m)");
  }

  console.log(fails === 0 ? "\nTODO OK ✓" : `\n${fails} FALLOS ✗`);
  process.exit(fails === 0 ? 0 : 1);
}

void main();
