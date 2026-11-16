/* Diagnóstico ruta 4: por qué el ruteo a Acceso La Pirámide desde
   Av. Andrés Bello 1337 (Providencia) va por el oeste (Recoleta)
   en vez de por Providencia / el oriente.
   Ejecutar: npx tsx scripts/diag-ruta4.ts  (no requiere server) */

import { readFileSync } from "node:fs";

const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as any).fetch = (input: any, init?: any) => {
  if (typeof input === "string" && input.startsWith("/red-ciclista.json")) {
    const data = readFileSync("public/red-ciclista.json");
    return Promise.resolve(new Response(data, { headers: { "Content-Type": "application/json" } }));
  }
  if (typeof input === "string" && input.startsWith("/")) return realFetch("http://localhost:3000" + input, init);
  return realFetch(input, init);
};

import { loadNetwork, snapInfo, findRoute, haversineM, type LatLng } from "@/lib/routing";
import { computeRoute, computePresetRoute, parkInsideTest } from "@/lib/routingService";
import { RUTAS_TRAZADOS } from "@/lib/rutasTrazados";
import { crearDirOk } from "@/lib/reglasParque";

const ORIGIN: LatLng = { lat: -33.427192, lon: -70.6215983 }; // Av. Andrés Bello 1337
const GATE: LatLng = { lat: -33.3882651, lon: -70.6015948 }; // Acceso La Pirámide

function resumen(nombre: string, r: any) {
  if (!r) {
    console.log(`\n== ${nombre}: NULL (sin ruta)`);
    return;
  }
  console.log(`\n== ${nombre}: ${(r.distanceM / 1000).toFixed(2)} km, ${r.coords.length} puntos`);
  let prev = "";
  for (const s of r.steps || []) {
    if (s.text !== prev) console.log(`   · [${s.icon}] ${s.text}`);
    prev = s.text;
  }
}

async function main() {
  const net = await loadNetwork();
  if (!net) {
    console.log("ERROR: no cargó red-ciclista.json");
    return;
  }
  console.log(`red: ${net.nodes.length} nodos, ${net.edges.length} aristas`);
  let s = 90, n = -90, w = 180, e = -180;
  for (const [lat, lon] of net.nodes) {
    s = Math.min(s, lat); n = Math.max(n, lat); w = Math.min(w, lon); e = Math.max(e, lon);
  }
  console.log(`bbox red: S${s.toFixed(4)} N${n.toFixed(4)} O${w.toFixed(4)} E${e.toFixed(4)}`);
  const so = snapInfo(net, ORIGIN);
  const sg = snapInfo(net, GATE);
  console.log(`snap origen: ${so.distM.toFixed(0)} m (umbral 250) | snap portería: ${sg.distM.toFixed(0)} m (umbral 900)`);
  console.log(`línea recta origen→portería: ${(haversineM(ORIGIN, GATE) / 1000).toFixed(2)} km`);
  console.log(`origen dentro del parque: ${parkInsideTest(0)(ORIGIN.lat, ORIGIN.lon)}`);

  // 1) flujo real de la app: destino = portería ciclista, acceso directo
  const real = await computeRoute(ORIGIN, GATE, { accesoDirecto: true });
  console.log(`\ncomputeRoute → source=${real.source} error=${real.error} aviso=${real.aviso ?? "-"}`);
  resumen("computeRoute accesoDirecto=true", real.route);

  // 5) flujo real al elegir «Ruta 4» en el catálogo (preset, fullTrace)
  const preset = await computePresetRoute(ORIGIN, { rutaId: "ruta-4", nombre: "Ruta 4" }, { fullTrace: true });
  console.log(`\ncomputePresetRoute ruta-4 → source=${preset.source} error=${preset.error} aviso=${preset.aviso ?? "-"}`);
  resumen("computePresetRoute ruta-4", preset.route);

  // 6) causa raíz: cityOk del preset (inside tolerancia 80 m) vs estricto (0 m)
  const t = RUTAS_TRAZADOS["r4"].coords[0];
  const trace0: LatLng = { lat: t[0], lon: t[1] };
  const cityOk80 = (lat: number, lon: number) => !parkInsideTest()(lat, lon) || haversineM({ lat, lon }, trace0) <= 150;
  const cityOk0 = (lat: number, lon: number) => !parkInsideTest(0)(lat, lon) || haversineM({ lat, lon }, trace0) <= 150;
  resumen("city leg con cityOk tolerancia 80 (como el preset)", findRoute(net, ORIGIN, trace0, { nodeOk: cityOk80 }));
  resumen("city leg con cityOk tolerancia 0 (estricto)", findRoute(net, ORIGIN, trace0, { nodeOk: cityOk0 }));

  // 2) A* sin restricciones: ¿existe camino corto por el oriente en el grafo?
  resumen("A* libre (sin nodeOk ni dirOk)", findRoute(net, ORIGIN, GATE));

  // 3) A* con interior del parque bloqueado, SIN reglas de dirección
  const dentro = parkInsideTest(0);
  const filtro = (lat: number, lon: number) => !dentro(lat, lon) || haversineM({ lat, lon }, GATE) <= 120;
  resumen("A* interior bloqueado (sin dirOk)", findRoute(net, ORIGIN, GATE, { nodeOk: filtro }));

  // 4) A* exacto de trazarAccesoLocal: interior bloqueado + dirOk
  const dirOk = crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: false });
  resumen("A* interior bloqueado + dirOk(pioNonoSoloSubida)", findRoute(net, ORIGIN, GATE, { nodeOk: filtro, edgeDirOk: dirOk }));
}

main();
