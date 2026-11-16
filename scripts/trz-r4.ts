import { RUTAS_TRAZADOS } from "@/lib/rutasTrazados";
import { GATES } from "@/lib/park";
import { haversineM } from "@/lib/routing";
const t = RUTAS_TRAZADOS["r4"];
const p0 = t.coords[0];
console.log("trace[0] r4:", p0[0], p0[1], "| puntos:", t.coords.length);
for (const g of GATES.filter(g => g.ciclistas)) {
  const d = haversineM({ lat: p0[0], lon: p0[1] }, g.position);
  console.log(`  dist a ${g.name}: ${d.toFixed(0)} m`);
}
console.log("últimos puntos trace:", JSON.stringify(t.coords.slice(-2)));
