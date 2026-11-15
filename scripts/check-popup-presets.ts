// ============================================================
// Verifica el anclaje de porterías para el popup «¿ingresar al
// cerro o solo llegar al acceso?» del botón Ruta (v1.12.12):
// replica gateDeTrazado() de useNavEngine sobre los 9 trazados.
// Ejecutar: node_modules/.bin/tsx scripts/check-popup-presets.ts
// ============================================================
import { CAPA_RUTAS, rutaTrazado } from "../src/lib/mapLayers";
import { GATES } from "../src/lib/park";
import { haversineM, type LatLng } from "../src/lib/routing";

const GATE_INICIO_UM_M = 120;
function gateDeTrazado(inicio: LatLng) {
  let best = null as (typeof GATES)[number] | null;
  let bd = Infinity;
  for (const g of GATES) {
    if (!g.ciclistas) continue;
    const d = haversineM(inicio, g.position);
    if (d < bd) {
      bd = d;
      best = g;
    }
  }
  return best && bd <= GATE_INICIO_UM_M ? { gate: best, dist: bd } : { gate: null, dist: bd };
}

console.log("ruta                 | inicio del trazado          | popup gate      | dist");
for (const r of CAPA_RUTAS) {
  const t = rutaTrazado(r);
  const inicio = t.coords[0];
  const { gate, dist } = gateDeTrazado(inicio);
  const fin = t.coords[t.coords.length - 1];
  const finGate = gateDeTrazado(fin);
  console.log(
    `${r.id.padEnd(20)} | (${inicio.lat.toFixed(5)},${inicio.lon.toFixed(5)}) | ${
      gate ? gate.id.padEnd(15) : "(ninguno — entra por el acceso más cercano al ciclista)".padEnd(15)
    } | ${Math.round(dist)}m · fin: ${finGate.gate ? finGate.gate.id : "-"}`
  );
}
