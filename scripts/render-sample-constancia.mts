// Genera un PDF de EJEMPLO de la Constancia de Registro de Trayecto
// para revisión del dueño del proyecto (no se compila el APK aquí).
// Uso: npx tsx scripts/render-sample-constancia.mts
import { writeFileSync } from "node:fs";
import { buildRidePdf } from "../src/lib/ridePdf";
import type { RideSummary } from "../src/lib/history";

// Viaje de ejemplo: subida y bajada al Cerro San Cristóbal
const ride: RideSummary = {
  id: "7f3c2b1a-4d5e-4f60-9a8b-1c2d3e4f5a6b",
  dateISO: "2026-11-01T14:35:00.000Z", // 11:35 hora local de Chile (UTC-3)
  source: "gps",
  distanceKm: 12.42,
  maxKmh: 38.2,
  maxInParkKmh: 29.6,
  avgKmh: 16.1,
  elapsedSec: 2780,
  gainM: 412,
  overLimitSec: 0,
};

const doc = await buildRidePdf(ride, {
  name: "Camila Rojas Fuentes",
  email: "camila.rojas@correo.cl",
  username: "camila_stgo",
});

const buf = doc.output("arraybuffer") as ArrayBuffer;
writeFileSync("/home/z/my-project/download/constancia-ejemplo-cumbre30.pdf", Buffer.from(buf));
console.log("PDF ejemplo generado:", Buffer.from(buf).length, "bytes");
