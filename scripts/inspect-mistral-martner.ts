// Extensión de Av. Gabriela Mistral y Av. Carlos Martner (posiciones destino)
import { readFileSync } from "node:fs";
const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  names: string[]; nodes: [number, number][]; edges: [number, number, number, number, 0 | 1][];
};
const hav = (a: [number, number], b: [number, number]) => {
  const R = 6371000, k = Math.PI / 180;
  const dLat = (b[0] - a[0]) * k, dLon = (b[1] - a[1]) * k;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * k) * Math.cos(b[0] * k) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
for (const pat of [/^Avenida Gabriela Mistral$/, /^Avenida Carlos Martner$/, /^Pasaje Gabriela Mistral$/, /^Sendero Gabriela Mistral$/]) {
  const pts: [number, number][] = [];
  let cnt = 0;
  for (const [a, b, , ni] of raw.edges) {
    if (!pat.test(raw.names[ni] ?? "")) continue;
    cnt++;
    pts.push(raw.nodes[a], raw.nodes[b]);
  }
  let north = pts[0], south = pts[0], east = pts[0];
  for (const p of pts) {
    if (p[0] < north[0]) north = p;
    if (p[0] > south[0]) south = p;
    if (p[1] > east[1]) east = p;
  }
  console.log(`${pat}: ${cnt} aristas · norte ${JSON.stringify(north)} · sur ${JSON.stringify(south)} · este ${JSON.stringify(east)}`);
}
// ¿Dónde conecta Av. Gabriela Mistral con la red PdV? nodo más cercano al acceso PDV nuevo
const gate: [number, number] = [-33.415479, -70.617402];
let bd = Infinity, bp: [number, number] | null = null;
for (const [a, b, , ni] of raw.edges) {
  if (!/^Avenida Gabriela Mistral$/.test(raw.names[ni] ?? "")) continue;
  for (const p of [raw.nodes[a], raw.nodes[b]]) {
    const d = hav(p, gate);
    if (d < bd) { bd = d; bp = p; }
  }
}
console.log(`Av. Gabriela Mistral nodo más cercano al acceso PDV: ${JSON.stringify(bp)} @ ${bd?.toFixed(0)} m`);
