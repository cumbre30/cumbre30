// Buscar CicloRecreoVía y conexiones grafo entre Av. El Cerro y el cerro
import fs from "fs";
const net = JSON.parse(fs.readFileSync("public/red-ciclista.json", "utf8"));
const haversine = (a: [number, number], b: [number, number]) => {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toR, dLon = (b[1] - a[1]) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
const elCerro: [number, number] = [-33.4160, -70.6080];
// 1) nombres que contengan CicloRecreo / Recreativa en el grafo
const nombres = new Map<string, number>();
for (const ni of net.names) {
  if (/ciclorecreo|recreo/i.test(ni)) nombres.set(ni, (nombres.get(ni) ?? 0) + 1);
}
console.log("nombres CicloRecreo en grafo:", [...nombres.entries()].slice(0, 6));

// 2) aristas entre lat -33.4170..-33.4125, lon -70.6100..-70.6060 (parque plano + conexión)
const zona = new Map<string, { n: number; latMin: number; latMax: number; lonMin: number; lonMax: number }>();
for (const [a, b, ci, ni] of net.edges) {
  const pa = net.nodes[a], pb = net.nodes[b];
  const mid: [number, number] = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
  if (mid[0] > -33.4125 || mid[0] < -33.4172 || mid[1] > -70.6060 || mid[1] < -70.6105) continue;
  const k = `${net.classes[ci]} | ${net.names[ni] || "(sin nombre)"}`;
  const z = zona.get(k) ?? { n: 0, latMin: 0, latMax: -90, lonMin: 0, lonMax: -200 };
  z.n++;
  z.latMin = Math.min(z.latMin, mid[0]); z.latMax = Math.max(z.latMax, mid[0]);
  z.lonMin = Math.min(z.lonMin, mid[1]); z.lonMax = Math.max(z.lonMax, mid[1]);
  zona.set(k, z);
}
console.log("\nzona parque plano PdV Norte (clase | nombre: n, bbox):");
for (const [k, z] of [...zona.entries()].sort((x, y) => y[1].n - x[1].n).slice(0, 14))
  console.log(`  ${String(z.n).padStart(3)}  lat ${z.latMin.toFixed(4)}..${z.latMax.toFixed(4)} lon ${z.lonMin.toFixed(4)}..${z.lonMax.toFixed(4)}  ${k}`);

// 3) cicloviaPolylines cerca del parque plano
const cercaPoly = (net.cicloviaPolylines ?? []).filter((poly: number[]) => {
  const p0 = net.nodes[poly[0]];
  return haversine([p0[0], p0[1]], elCerro) < 800;
});
console.log("\npolilíneas de ciclovía a <800 m de El Cerro:", cercaPoly.length);
