// Nodo-junta: nodos del grafo ≤60 m de Av. El Cerro con aristas footway/service
// (caminos del parque) — candidatos a "Acceso Pedro de Valdivia Norte"
import fs from "fs";
const net = JSON.parse(fs.readFileSync("public/red-ciclista.json", "utf8"));
const haversine = (a: [number, number], b: [number, number]) => {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toR, dLon = (b[1] - a[1]) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
const elCerro: [number, number] = [-33.41636, -70.60825]; // photon Av. El Cerro
const filaElCerro = new Set<number>();
for (const [a, b, ci, ni] of net.edges) {
  if (!/^Avenida El Cerro/.test(net.names[ni] ?? "")) continue;
  filaElCerro.add(a); filaElCerro.add(b);
}
const parques = new Set<number>();
for (const [a, b, ci, ni] of net.edges) {
  const cls = net.classes[ci];
  if (cls !== "footway" && cls !== "pedestrian" && cls !== "service" && cls !== "cycleway") continue;
  parques.add(a); parques.add(b);
}
// juntas: nodo de El Cerro que también toca camino de parque (mismo nodo)
const juntas: number[] = [];
for (const n of filaElCerro) if (parques.has(n)) juntas.push(n);
console.log(`juntas directas El Cerro ↔ camino de parque: ${juntas.length}`);
for (const n of juntas.slice(0, 10)) {
  const p: [number, number] = [net.nodes[n][0], net.nodes[n][1]];
  console.log(`  nodo ${n}: ${p[0].toFixed(5)},${p[1].toFixed(5)} · a photon: ${haversine(p, elCerro).toFixed(0)} m`);
}
// si no hay juntas exactas, nodos de parque a ≤40 m de la fila El Cerro
if (juntas.length < 3) {
  console.log("\nnodos de parque a ≤40 m de la fila de El Cerro:");
  const cerca: { n: number; p: [number, number]; d: number }[] = [];
  for (const n of parques) {
    const p: [number, number] = [net.nodes[n][0], net.nodes[n][1]];
    if (p[0] > -33.4140 || p[0] < -33.4180 || p[1] > -70.6050 || p[1] < -70.6110) continue;
    let dMin = Infinity;
    for (const m of filaElCerro) dMin = Math.min(dMin, haversine(p, [net.nodes[m][0], net.nodes[m][1]]));
    if (dMin <= 40) cerca.push({ n, p, d: dMin });
  }
  cerca.sort((x, y) => x.d - y.d);
  for (const c of cerca.slice(0, 12)) console.log(`  nodo ${c.n}: ${c.p[0].toFixed(5)},${c.p[1].toFixed(5)} · a El Cerro: ${c.d.toFixed(0)} m`);
}
