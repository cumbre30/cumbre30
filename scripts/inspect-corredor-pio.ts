// Cadena real del corredor Pío Nono (gate → arriba) y el sector del puente
// Mackenna/Bannen: para fijar el bloqueo direccional (sólo subida) y la banda
// del corte horario.
import { readFileSync } from "node:fs";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: [number, number][];
  edges: [number, number, number, number, 0 | 1][];
};

const hav = (a: [number, number], b: [number, number]) => {
  const R = 6371000, k = Math.PI / 180;
  const dLat = (b[0] - a[0]) * k, dLon = (b[1] - a[1]) * k;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * k) * Math.cos(b[0] * k) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

// polígono del parque simplificado (desde park.ts) — versión corta para "dentro"
// usamos una caja aproximada NO: import real más abajo vía park.ts no es posible
// en este script suelto; usamos test de caja por sector. Mejor: distancia al gate.
const GATE: [number, number] = [-33.430691, -70.63592];

const CORR = /^(Pío Nono|Pio Nono|Avenida Alberto Mackenna|Terraza Bellavista|Explanada$|Paseo Peatonal Cumbre|Camino Siete Palabras|Sendero El Excursionista|Camino El Excursionista|Camino Pío Nono - Plaza México)/;

const adjC: Array<Array<{ to: number; nm: string; d: number }>> = raw.nodes.map(() => []);
for (const [a, b, , ni] of raw.edges) {
  const nm = raw.names[ni] ?? "";
  if (!CORR.test(nm)) continue;
  const d = hav(raw.nodes[a], raw.nodes[b]);
  adjC[a].push({ to: b, nm, d });
  adjC[b].push({ to: a, nm, d });
}

// BFS desde el nodo del CORREDOR más cercano al gate
let gN = -1, gd = Infinity;
for (let i = 0; i < raw.nodes.length; i++) {
  if (!adjC[i].length) continue;
  const d = hav(raw.nodes[i], GATE);
  if (d < gd) { gd = d; gN = i; }
}
console.log(`Nodo corredor más cercano al gate: (${raw.nodes[gN][0].toFixed(5)},${raw.nodes[gN][1].toFixed(5)}) @ ${gd.toFixed(0)} m`);
// camino más LARGO simple desde el gate (DFS acotado por profundidad)
const visited = new Set<number>([gN]);
let bestPath: Array<{ n: number; nm: string; d: number }> = [];
const dfs = (n: number, path: Array<{ n: number; nm: string; d: number }>) => {
  if (path.length > bestPath.length) bestPath = path.slice();
  if (path.length > 260) return;
  for (const e of adjC[n]) {
    if (visited.has(e.to)) continue;
    visited.add(e.to);
    path.push(e);
    dfs(e.to, path);
    path.pop();
    visited.delete(e.to);
  }
};
dfs(gN, []);
console.log(`Cadena más larga de corredor desde el gate: ${bestPath.length} aristas`);
// muestrea la cadena: nodo, nombre, distancia al gate
const step = Math.max(1, Math.floor(bestPath.length / 22));
for (let i = 0; i < bestPath.length; i += step) {
  const e = bestPath[i];
  const p = raw.nodes[e.to];
  console.log(`  +${(bestPath.slice(0, i + 1).reduce((s, x) => s + x.d, 0) / 1000).toFixed(2)} km · (${p[0].toFixed(5)},${p[1].toFixed(5)}) · ${e.nm} · a ${hav(p, GATE).toFixed(0)} m del gate`);
}
const last = raw.nodes[bestPath[bestPath.length - 1].to];
console.log(`  FIN: (${last[0].toFixed(5)},${last[1].toFixed(5)})`);

// Sector del puente: aristas con algún nodo a <140 m del puente, con nombre
const PUENTE: [number, number] = [-33.416121, -70.623005];
console.log("\nAristas cerca del puente Tupahue (<140 m), agrupadas por nombre:");
const porNombre = new Map<string, number>();
for (const [a, b, ci, ni] of raw.edges) {
  const pa = raw.nodes[a], pb = raw.nodes[b];
  const d = Math.min(hav(pa, PUENTE), hav(pb, PUENTE));
  if (d > 140) continue;
  const nm = `${raw.names[ni] || "(sin nombre)"} · ${raw.classes[ci]}`;
  porNombre.set(nm, (porNombre.get(nm) ?? 0) + 1);
}
for (const [nm, c] of [...porNombre.entries()].sort((x, y) => y[1] - x[1])) console.log(`  ${c}× ${nm}`);

// ¿Av. Alberto Mackenna toca la zona del puente? nodo Mackenna más cercano al puente
let bd = Infinity, bp: [number, number] | null = null;
for (const [a, b, , ni] of raw.edges) {
  if (!/Avenida Alberto Mackenna/.test(raw.names[ni] ?? "")) continue;
  for (const p of [raw.nodes[a], raw.nodes[b]]) {
    const d = hav(p, PUENTE);
    if (d < bd) { bd = d; bp = p; }
  }
}
console.log(`\nNodo de Av. Alberto Mackenna más cercano al puente: ${JSON.stringify(bp)} @ ${bd.toFixed(0)} m`);
