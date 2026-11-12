/**
 * Topología del grafo en puntos clave del sector norte:
 * 1. tip r5 (-33.413820, -70.621199) — pico con reversa 169°
 * 2. curva Anáhuac (-33.417135, -70.623511)
 * 3. empalme La Montaña ∩ Martner ∩ Abate Molina (-33.413715, -70.614624)
 * Lista las aristas nombradas y hasta dónde llega cada camino.
 */
import grafo from "../public/red-ciclista.json";

const nodes = grafo.nodes as [number, number][];
const names = grafo.names as string[];
const classes = grafo.classes as string[];
const edges = grafo.edges as [number, number, number, number, number][];

function hav(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (bLat - aLat) * toR, dLon = (bLon - aLon) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const ady = new Map<number, { to: number; name: string; cls: string }[]>();
for (const [a, b, clsIdx, nameIdx] of edges) {
  const name = names[nameIdx] ?? "";
  const cls = classes[clsIdx] ?? "?";
  if (!ady.has(a)) ady.set(a, []);
  if (!ady.has(b)) ady.set(b, []);
  ady.get(a)!.push({ to: b, name, cls });
  ady.get(b)!.push({ to: a, name, cls });
}

function nodoCercano(p: [number, number]): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const d = hav(p[0], p[1], nodes[i][0], nodes[i][1]);
    if (d < bd) { bd = d; best = i; }
  }
  console.log(`\n### punto (${p[0]}, ${p[1]}) → nodo n${best} (${nodes[best][0]}, ${nodes[best][1]}) d=${bd.toFixed(0)}m`);
  const aristas = ady.get(best) ?? [];
  for (const e of aristas) {
    const n2 = nodes[e.to];
    console.log(`  → n${e.to} (${n2[0].toFixed(6)}, ${n2[1].toFixed(6)}) vía="${e.name}" [${e.cls}]`);
  }
  return best;
}

nodoCercano([-33.41382, -70.621199]); // tip r5
nodoCercano([-33.413715, -70.614624]); // empalme 3 vías
nodoCercano([-33.41272, -70.61862]); // VIA.martner

// ¿Dónde llega "Avenida Carlos Martner"? listar todos los nodos con esa vía
console.log("\n### Nodos con vía 'Avenida Carlos Martner' (segmento de la curva Anáhuac hacia el NE)");
const martner: number[] = [];
for (const [a, b, , nameIdx] of edges) {
  if (names[nameIdx] === "Avenida Carlos Martner") { martner.push(a, b); }
}
const uniq = [...new Set(martner)].sort((x, y) => x - y);
console.log(`nodos: ${uniq.length}`);
for (const i of uniq) console.log(`  n${i} (${nodes[i][0].toFixed(6)}, ${nodes[i][1].toFixed(6)})`);
