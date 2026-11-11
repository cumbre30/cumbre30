// ¿Dónde está el borde del parque cerca de PdV Norte? ¿Qué hay alrededor de cada candidato?
import fs from "fs";
const net = JSON.parse(fs.readFileSync("public/red-ciclista.json", "utf8"));
const parkSrc = fs.readFileSync("src/lib/park.ts", "utf8");
const m = parkSrc.match(/PARK_POLYGON[^=]*=\s*\[([\s\S]*?)\];/);
const poly = [...m[1].matchAll(/lat:\s*(-?[\d.]+),\s*lon:\s*(-?[\d.]+)/g)].map((x) => [parseFloat(x[1]), parseFloat(x[2])]);

const haversine = (a: [number, number], b: [number, number]) => {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toR, dLon = (b[1] - a[1]) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
// vértices del polígono más cercanos a una lat/lon dada (y su índice)
const cercaBorde = (p: [number, number]) => {
  const orden = poly.map((v, i) => ({ v, i, d: haversine(v, p) })).sort((x, y) => x.d - y.d).slice(0, 4);
  return orden.map((o) => `v${o.i} ${o.v[0].toFixed(5)},${o.v[1].toFixed(5)} (${o.d.toFixed(0)} m)`).join(" · ");
};
const candidatos: [string, [number, number]][] = [
  ["gate actual", [-33.411769, -70.607988]],
  ["inicio GPX r1", [-33.412097, -70.607576]],
  ["Av. El Cerro (photon)", [-33.4163622, -70.6082518]],
  ["Av. El Cerro grafo", [-33.41600, -70.60802]],
];
for (const [nombre, p] of candidatos) console.log(`${nombre}: ${p} → borde del parque: ${cercaBorde(p)}`);

// calles dentro de 200 m de cada candidato (qué hay ahí)
const alrededor = (p: [number, number], r = 220) => {
  const out = new Map<string, number>();
  for (const [a, b, ci, ni] of net.edges) {
    const pa = net.nodes[a], pb = net.nodes[b];
    const mid: [number, number] = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
    if (haversine(mid, p) > r) continue;
    const k = `${net.classes[ci]} | ${net.names[ni] || "(sin nombre)"}`;
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return [...out.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => `${v}× ${k}`).join(" · ");
};
for (const [nombre, p] of candidatos) console.log(`\n${nombre}: ${alrededor(p)}`);
