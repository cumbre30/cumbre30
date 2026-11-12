/** ¿r1 también entra al ramal Anáhuac? vecindario de Casa Anáhuac en r1..r4. */
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";
import { haversineM } from "../src/lib/geo";

const C = { lat: -33.417135, lon: -70.623511 };
for (const id of ["r1", "r2", "r4"]) {
  const t = RUTAS_TRAZADOS[id];
  const coords = t.coords.map(([lat, lon]) => ({ lat, lon }));
  console.log(`\n=== ${id} (${t.distKm.toFixed(2)} km) puntos a <160 m de Casa Anáhuac ===`);
  let lastIdx = -99;
  for (let i = 0; i < coords.length; i++) {
    const d = haversineM(coords[i], C);
    if (d < 160) {
      if (i - lastIdx > 1) console.log("  ---");
      console.log(`  idx=${String(i).padStart(4)} (${coords[i].lat.toFixed(6)}, ${coords[i].lon.toFixed(6)}) d=${d.toFixed(0)}m`);
      lastIdx = i;
    }
  }
}
