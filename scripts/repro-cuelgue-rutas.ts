// Reproduce el flujo «Ruta» del panel de capas (computePresetRoute)
// para las 9 rutas desde varios orígenes, midiendo el tiempo de cada
// llamada. Sin red externa: fetch local para el grafo, OSRM caído.
import { readFileSync } from "node:fs";

const RAW = readFileSync("public/red-ciclista.json", "utf8");
globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : String(input);
  if (url.includes("/red-ciclista.json")) {
    return new Response(RAW, { status: 200, headers: { "content-type": "application/json" } });
  }
  // OSRM/Overpass "caídos" (simula el APK sin cobertura)
  throw new TypeError("fetch bloqueado (test): " + url);
}) as typeof fetch;

async function main() {
  const { computePresetRoute } = await import("../src/lib/routingService");
  const { CAPA_RUTAS } = await import("../src/lib/mapLayers");

  const ORIGENES: { nombre: string; lat: number; lon: number }[] = [
    { nombre: "fuera · Providencia/PdV", lat: -33.4215, lon: -70.6095 },
    { nombre: "fuera · Plaza Baquedano", lat: -33.4267, lon: -70.6195 },
    { nombre: "dentro · acceso PdV", lat: -33.4160, lon: -70.6174 },
    { nombre: "dentro · La Montaña media", lat: -33.4074, lon: -70.6185 },
    { nombre: "dentro · La Rotonda", lat: -33.4115, lon: -70.6107 },
  ];

  let worst = { ms: 0, caso: "" };
  for (const o of ORIGENES) {
    for (const r of CAPA_RUTAS) {
      const t0 = performance.now();
      const res = await computePresetRoute({ lat: o.lat, lon: o.lon }, { rutaId: r.id, nombre: r.nombre });
      const ms = Math.round(performance.now() - t0);
      const ok = res.route ? `${(res.route.distanceM / 1000).toFixed(2)} km` : res.error ?? "null";
      console.log(`${ms >= 3000 ? "LENTO" : "ok  "} ${o.nombre} · ${r.id}: ${ms} ms → ${ok}`);
      if (ms > worst.ms) worst = { ms, caso: `${o.nombre} · ${r.id}` };
    }
  }
  console.log("\nPEOR CASO:", worst.caso, worst.ms + " ms");
}
main().catch((e) => { console.error("EXCEPCIÓN:", e); process.exit(1); });
