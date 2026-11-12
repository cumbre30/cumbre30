// Sondeo para los segmentos del cerro (2026-11-13):
// 1) Extremos de las 3 bajadas del control 30 km/h (distKm declarado vs
//    distancia de la geocerca recta inicio→meta).
// 2) Pierna La Pirámide → Plaza México en las rutas que pasan por la
//    portería nueva (r2/r4/r5/mtb3): distancia acumulada del trazado
//    entre el punto más cercano a la portería y el más cercano a la plaza.
import { RUTAS_TRAZADOS, BAJADAS_CONTROL_30 } from "../src/lib/rutasTrazados";
import { GATES } from "../src/lib/park";
import { haversineM } from "../src/lib/geo";

const PIRAMIDE = GATES.find((g) => g.id === "la-piramide")!.position;
const PLAZA_MEXICO: [number, number] = [-33.4234, -70.6327];
const PIONONO = GATES.find((g) => g.id === "pio-nono")!.position;
const PDV = GATES.find((g) => g.id === "pv-norte")!.position;

const closest = (coords: [number, number][], p: [number, number] | { lat: number; lon: number }) => {
  const ll = "lat" in p ? [p.lat, p.lon] : p;
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = haversineM({ lat: coords[i][0], lon: coords[i][1] }, { lat: ll[0], lon: ll[1] });
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return { idx: best, distM: bd };
};

console.log("=== BAJADAS 30: extremos y referencia a accesos ===");
for (const b of BAJADAS_CONTROL_30) {
  const a = b.coords[0];
  const z = b.coords[b.coords.length - 1];
  const recta = haversineM({ lat: a[0], lon: a[1] }, { lat: z[0], lon: z[1] });
  console.log(`\n${b.id} · ${b.nombre}`);
  console.log(`  inicio ${a[0]},${a[1]} → meta ${z[0]},${z[1]} · trazado ${b.distKm.toFixed(2)} km · recta ${(recta / 1000).toFixed(2)} km`);
  for (const [nom, p] of [["Pío Nono", PIONONO], ["PdV Norte", PDV], ["La Pirámide", PIRAMIDE], ["Plaza México", PLAZA_MEXICO]] as const) {
    const di = closest(b.coords, p as [number, number]);
    if (di.distM < 150) console.log(`    pasa a ${di.distM.toFixed(0)} m de ${nom} (idx ${di.idx}/${b.coords.length - 1})`);
  }
}

console.log("\n=== Pierna La Pirámide → Plaza México por ruta ===");
for (const [id, t] of Object.entries(RUTAS_TRAZADOS)) {
  const iP = closest(t.coords, PIRAMIDE);
  if (iP.distM > 120) continue;
  const iM = closest(t.coords, PLAZA_MEXICO);
  const lo = Math.min(iP.idx, iM.idx);
  const hi = Math.max(iP.idx, iM.idx);
  let d = 0;
  for (let i = lo + 1; i <= hi; i++) {
    d += haversineM({ lat: t.coords[i - 1][0], lon: t.coords[i - 1][1] }, { lat: t.coords[i][0], lon: t.coords[i][1] });
  }
  console.log(
    `${id}: portería idx ${iP.idx} (${iP.distM.toFixed(0)} m) · Plaza México idx ${iM.idx} (${iM.distM.toFixed(0)} m) · pierna ${(d / 1000).toFixed(2)} km (${iP.idx < iM.idx ? "piramide→mexico" : "mexico→piramide"})`,
  );
}

console.log("\n=== Subida Pío Nono → Plaza México: pierna directa en rutas ===");
for (const [id, t] of Object.entries(RUTAS_TRAZADOS)) {
  const iN = closest(t.coords, PIONONO);
  if (iN.distM > 60) continue;
  const iM = closest(t.coords, PLAZA_MEXICO);
  if (iM.distM > 120) continue;
  const lo = Math.min(iN.idx, iM.idx);
  const hi = Math.max(iN.idx, iM.idx);
  let d = 0;
  for (let i = lo + 1; i <= hi; i++) {
    d += haversineM({ lat: t.coords[i - 1][0], lon: t.coords[i - 1][1] }, { lat: t.coords[i][0], lon: t.coords[i][1] });
  }
  console.log(`${id}: ${(d / 1000).toFixed(2)} km entre portería y plaza (${iN.idx < iM.idx ? "nono→mexico" : "mexico→nono"})`);
}
