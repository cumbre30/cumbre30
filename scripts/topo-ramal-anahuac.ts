/** Camino "Anáhuac" (living_street): nodos y conexiones — ¿es un ramal sin
 *  salida o une Bannen con la calle noreste? */
import grafo from "../public/red-ciclista.json";

const nodes = grafo.nodes as [number, number][];
const names = grafo.names as string[];
const classes = grafo.classes as string[];
const edges = grafo.edges as [number, number, number, number, number][];

const ady = new Map<number, { to: number; name: string; cls: string }[]>();
for (const [a, b, clsIdx, nameIdx] of edges) {
  const name = names[nameIdx] ?? "";
  const cls = classes[clsIdx] ?? "?";
  if (!ady.has(a)) ady.set(a, []);
  if (!ady.has(b)) ady.set(b, []);
  ady.get(a)!.push({ to: b, name, cls });
  ady.get(b)!.push({ to: a, name, cls });
}

// nodos del camino "Anáhuac"
const nodosAnahuac = new Set<number>();
for (const [a, b, , nameIdx] of edges) {
  if (names[nameIdx] === "Anáhuac") { nodosAnahuac.add(a); nodosAnahuac.add(b); }
}
console.log(`Nodos de la vía "Anáhuac" (${classes}): ${nodosAnahuac.size}`);
for (const i of [...nodosAnahuac].sort((x, y) => x - y)) {
  const n = nodes[i];
  const conex = (ady.get(i) ?? []).map((e) => `n${e.to}(${e.name || "·"},${e.cls})`).join(" ");
  console.log(`n${i} (${n[0].toFixed(6)}, ${n[1].toFixed(6)}) → ${conex}`);
}

// ¿qué camino pasa por (-33.417150, -70.622772)? (el que usa r1 idx 64-72)
console.log("\n--- Aristas cerca de (-33.417150, -70.622772) ---");
for (const [a, b, clsIdx, nameIdx] of edges) {
  const pa = nodes[a], pb = nodes[b];
  const dm = Math.min(
    Math.hypot((pa[0] +33.417150) * 111320, (pa[1] + 70.622772) * 93200),
    Math.hypot((pb[0] +33.417150) * 111320, (pb[1] + 70.622772) * 93200)
  );
  if (dm < 25) {
    console.log(`n${a} (${pa[0].toFixed(6)}, ${pa[1].toFixed(6)}) ↔ n${b} (${pb[0].toFixed(6)}, ${pb[1].toFixed(6)}) vía="${names[nameIdx]}" [${classes[clsIdx]}]`);
  }
}
