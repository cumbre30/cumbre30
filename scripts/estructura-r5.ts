/** Estructura global de r5: cada 20 puntos + km acumulado. */
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";
import { haversineM } from "../src/lib/geo";

const r5 = RUTAS_TRAZADOS["r5"];
const coords = r5.coords.map(([lat, lon]) => ({ lat, lon }));
let km = 0;
console.log(`r5 total: ${r5.distKm.toFixed(2)} km, ${coords.length} pts`);
for (let i = 0; i < coords.length; i++) {
  if (i > 0) km += haversineM(coords[i - 1], coords[i]);
  if (i % 20 === 0 || i === coords.length - 1) {
    console.log(
      `idx=${String(i).padStart(4)} km=${(km / 1000).toFixed(2)} (${coords[i].lat.toFixed(6)}, ${coords[i].lon.toFixed(6)})`
    );
  }
}
