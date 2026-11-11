// Conectividad de los senderos ciclistas: con qué vías conectan sus extremos.
import { readFileSync } from "node:fs";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[];
  names: string[];
  nodes: [number, number][];
  edges: [number, number, number, number, 0 | 1][];
};

const NOMBRES = [
  "Sendero Ciclista Pa' Arriba",
  "Sendero Ciclista El Zorzal",
  "Sendero Ciclista La S",
  "Sendero Ciclista Anfiteatro",
  "Sendero Ciclista Torre 5",
  "Sendero Ciclista 4 ½",
  "Sendero Ciclista Centenario",
  "Sendero Ciclista Pirámide",
];

for (const nombre of NOMBRES) {
  const nodos = new Set<number>();
  for (const [a, b, ci, ni] of raw.edges) if (raw.names[ni] === nombre) { nodos.add(a); nodos.add(b); }
  const nb: Record<string, number> = {};
  const pts: [number, number][] = [];
  for (const [a, b, ci, ni] of raw.edges) {
    if (raw.names[ni] === nombre) pts.push(raw.nodes[a], raw.nodes[b]);
    if (nodos.has(a) !== nodos.has(b)) {
      const otro = nodos.has(a) ? b : a;
      const n = raw.names[ni] || "(sin nombre)";
      nb[n] = (nb[n] ?? 0) + 1;
      void otro;
    }
  }
  const top = Object.entries(nb).sort((x, y) => y[1] - x[1]).slice(0, 7);
  // extremos: min/max por lat
  let minP = pts[0], maxP = pts[0];
  for (const p of pts) {
    if (p[0] < minP[0]) minP = p;
    if (p[0] > maxP[0]) maxP = p;
  }
  console.log(`\n${nombre} (${nodos.size} nodos)`);
  console.log(`  extremos: (${minP[0].toFixed(5)},${minP[1].toFixed(5)}) → (${maxP[0].toFixed(5)},${maxP[1].toFixed(5)})`);
  console.log(`  conecta con: ${top.map(([n, c]) => `${n}×${c}`).join(" · ")}`);
}
