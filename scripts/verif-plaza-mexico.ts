// Verificación: navegación a TODOS los destinos del parque (computeRoute)
// tras aplicar el filtro pavimento — ningún tramo debe usar senderos
// peatonales (Sendero sin "Ciclista", Ruta Nativa, veredas, paths sin nombre).
// Ejecutar: node_modules/.bin/tsx scripts/verif-plaza-mexico.ts
const realFetch = globalThis.fetch;
globalThis.fetch = ((url: string, ...a: any[]) => realFetch(new URL(url, "http://localhost:3000"), ...a)) as typeof fetch;

import { computeRoute } from "../src/lib/routingService";
import { NAV_DESTINATIONS, PARK_POLYGON } from "../src/lib/park";

function inPark(lat: number, lon: number): boolean {
  const poly = PARK_POLYGON.map((p) => [p.lat, p.lon] as [number, number]);
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const RE_SENDERO_PEATONAL = /^(Sendero (?!Ciclista)|Ruta Nativa|vereda$|sendero$)/i;

async function main() {
  const origenes: Record<string, { lat: number; lon: number }> = {
    "Pío Nono (ciudad)": { lat: -33.4355, lon: -70.6452 },
    "Av. Bellavista": { lat: -33.4376, lon: -70.6507 },
    "dentro del parque (Antilén)": { lat: -33.4125, lon: -70.6105 },
  };

  let fallos = 0;
  for (const [nombreOrigen, from] of Object.entries(origenes)) {
    console.log(`\n========== ORIGEN: ${nombreOrigen} ==========`);
    for (const dest of NAV_DESTINATIONS) {
      if (!inPark(dest.position.lat, dest.position.lon)) continue;
      const res = await computeRoute(from, dest.position);
      if (!res.route) {
        console.log(`✗ ${dest.name}: SIN RUTA (${res.error ?? "local+osrm fallaron"})`);
        fallos++;
        continue;
      }
      const r = res.route;
      const seq: string[] = [];
      for (const nm of r.segNames) {
        const n = nm || "(sin nombre)";
        if (seq[seq.length - 1] !== n) seq.push(n);
      }
      const senderos = seq.filter((s) => RE_SENDERO_PEATONAL.test(s));
      const ok = senderos.length === 0 ? "✓" : "✗ SENDEROS";
      if (senderos.length) fallos++;
      console.log(`${ok} ${dest.name}: ${(r.distanceM / 1000).toFixed(2)} km · ${seq.slice(0, 6).join(" → ")}${seq.length > 6 ? " → …" : ""}`);
      if (senderos.length) console.log("   senderos usados:", senderos.join(", "));
    }
  }
  console.log(fallos === 0 ? "\nTODO OK — ningún destino del parque usa senderos peatonales" : `\n${fallos} problema(s)`);
  process.exit(0);
}

main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
