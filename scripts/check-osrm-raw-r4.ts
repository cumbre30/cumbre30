// Analiza la ruta OSRM CRUDA (Bellavista → inicio del trazado de Ruta 4,
// guardada en /tmp/osrm-r4.json por curl) contra la geocerca del parque —
// misma lógica de metrosInteriorParque: metros por DENTRO a >150 m del
// destino. Si la cruda se mete al cerro, el fix de computePresetRoute
// activa el rodeo (viaExternaParque) o el respaldo local por fuera.
// Ejecutar: node_modules/.bin/tsx scripts/check-osrm-raw-r4.ts
// ============================================================
import { readFileSync } from "node:fs";
import { haversineM, type LatLng } from "../src/lib/routing";
import { parkInsideTest } from "../src/lib/routingService";

const gateLP: LatLng = { lat: -33.3882651, lon: -70.6015948 }; // Acceso La Pirámide
const dentroEstricto = parkInsideTest(0);

function interiorM(coords: LatLng[], dest: LatLng): number {
  let m = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    if (dentroEstricto(a.lat, a.lon) && haversineM(a, dest) > 150) m += haversineM(a, coords[i + 1]);
  }
  return m;
}

const j = JSON.parse(readFileSync("/tmp/osrm-r4.json", "utf8")) as {
  code: string;
  routes?: { distance: number; geometry: { coordinates: [number, number][] } }[];
};
const rt = j.routes?.[0];
if (j.code !== "Ok" || !rt) {
  console.log("[OSRM cruda] sin ruta");
  process.exit(0);
}
const coords: LatLng[] = rt.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
const dentro = interiorM(coords, coords[coords.length - 1]);
const primer = coords.findIndex((c) => haversineM(c, gateLP) < 60);
console.log(`[OSRM cruda Bellavista → inicio trazado R4 (La Pirámide)] ${(rt.distance / 1000).toFixed(2)} km · ${coords.length} vértices`);
console.log(`  interior del parque (>150 m del destino): ${Math.round(dentro)} m ${dentro > 150 ? "→ ✗ SE METE AL CERRO (el fix activa rodeo/respaldo)" : "→ ✓ por fuera (el fix no necesita actuar)"}`);
console.log(`  pasa por el Acceso La Pirámide: idx=${primer} ${primer >= 0 ? "✓" : "✗"}`);
