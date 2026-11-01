// Prueba de geometría del prototipo Cumbre30
// Ejecutar: bun /home/z/my-project/scripts/test-geo.ts
import { PARK_POLYGON, RISK_ZONES, GATES, SIM_ROUTE, LIMIT_KMH } from "../src/lib/park";
import { haversineM, pointInPolygon } from "../src/lib/geo";

let failures = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
};

// 1. Inicio del recorrido FUERA del parque, segundo punto DENTRO
const p0 = SIM_ROUTE[0];
const p1 = SIM_ROUTE[1];
check("Inicio (Bellavista) fuera del parque", !pointInPolygon(p0, PARK_POLYGON));
check("Ingreso Pío Nono dentro del parque", pointInPolygon(p1, PARK_POLYGON));

// 2. Todos los puntos intermedios (hasta la salida) dentro del parque
let allInside = true;
const outside: string[] = [];
for (let i = 1; i < SIM_ROUTE.length - 1; i++) {
  const p = SIM_ROUTE[i];
  if (!pointInPolygon(p, PARK_POLYGON)) {
    allInside = false;
    outside.push(`#${i} (${p.lat},${p.lon})`);
  }
}
check("Tramo interior del recorrido dentro del polígono", allInside, outside.join("; "));

// 3. Último punto fuera (Providencia)
check("Salida a Providencia fuera del parque", !pointInPolygon(SIM_ROUTE[SIM_ROUTE.length - 1], PARK_POLYGON));

// 4. La ruta pasa por TODAS las zonas de riesgo (distancia mínima < radio)
for (const z of RISK_ZONES) {
  let minD = Infinity;
  for (let i = 1; i < SIM_ROUTE.length; i++) {
    const a = SIM_ROUTE[i - 1], b = SIM_ROUTE[i];
    const d = haversineM(a, b);
    const steps = Math.max(1, Math.ceil(d / 25));
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      const pt = { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f };
      const dd = haversineM(pt, z.position);
      if (dd < minD) minD = dd;
    }
  }
  check(`Zona "${z.name}" es atravesada`, minD < z.radiusM, `dist. mín. ${minD.toFixed(0)} m (radio ${z.radiusM})`);
}

// 5. Accesos cerca del polígono (< 400 m de algún vértice)
for (const g of GATES) {
  let min = Infinity;
  for (const v of PARK_POLYGON) min = Math.min(min, haversineM(g.position, v));
  check(`Acceso "${g.name}" cerca del borde`, min < 400, `${min.toFixed(0)} m al vértice más cercano`);
}

// 6. Tiempo estimado del recorrido simulado
let timeSec = 0;
let totalDist = 0;
for (let i = 1; i < SIM_ROUTE.length; i++) {
  const d = haversineM(SIM_ROUTE[i - 1], SIM_ROUTE[i]);
  totalDist += d;
  const v = ((SIM_ROUTE[i - 1].kmh + SIM_ROUTE[i].kmh) / 2) * 1000 / 3600;
  timeSec += d / v;
}
console.log(`ℹ️  Distancia total: ${(totalDist / 1000).toFixed(2)} km, duración real ≈ ${(timeSec / 60).toFixed(1)} min → a 6× ≈ ${(timeSec / 60 / 6).toFixed(1)} min`);

// 7. La bajada supera el límite (para probar la alerta de exceso)
const maxKmh = Math.max(...SIM_ROUTE.map((w) => w.kmh));
check("La simulación supera los 30 km/h en algún punto", maxKmh > LIMIT_KMH, `pico ${maxKmh} km/h`);

console.log(failures === 0 ? "\n🎉 Todas las pruebas de geometría pasaron" : `\n💥 ${failures} pruebas fallaron`);
process.exit(failures === 0 ? 0 : 1);
