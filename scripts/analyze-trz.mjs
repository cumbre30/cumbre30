// Analiza los trazados r1 y r3: detecta tramos rectos largos (saltos sin
// vértices intermedios) y los compara con la red real (red-ciclista.json).
import fs from "node:fs";

const src = fs.readFileSync("src/lib/rutasTrazados.ts", "utf8");
const start = src.indexOf("export const RUTAS_TRAZADOS");
const objStart = src.indexOf("=", start) + 1;
const objEnd = src.lastIndexOf("};");
const data = JSON.parse(src.slice(objStart, objEnd + 1).replace(/};\s*$/, "}"));

const g = JSON.parse(fs.readFileSync("public/red-ciclista.json", "utf8"));

// distancia en metros (equirectangular)
const R = 111320;
function distM(a, b) {
  const kx = Math.cos(((a[0] + b[0]) / 2) * (Math.PI / 180));
  return Math.hypot((b[1] - a[1]) * kx * R, (b[0] - a[0]) * R);
}

// para cada segmento del trazado: distancia entre puntos consecutivos
for (const key of ["r1", "r3"]) {
  const t = data[key];
  const coords = t.coords;
  console.log(`\n=== ${key} · ${coords.length} puntos · ${t.distKm} km ===`);
  // segmentos > 120 m = sospechosos de ser rectas trazadas a mano
  let prev = null;
  for (let i = 0; i < coords.length; i++) {
    const c = coords[i];
    if (prev) {
      const d = distM(prev, c);
      if (d > 120) {
        console.log(`  SALTO ${i - 1}->${i}: ${d.toFixed(0)} m  [${prev}] -> [${c}]`);
      }
    }
    prev = c;
  }
}
