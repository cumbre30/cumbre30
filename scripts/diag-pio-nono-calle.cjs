/** Nodos de la calle Pío Nono junto a la esquina con Mackenna. */
const net = require("../public/red-ciclista.json");
const nodes = net.nodes;
const PN_IDXS = net.names
  .map((n, i) => [i, n])
  .filter(([i, n]) => /p[íi]o nono/i.test(n))
  .map(([i]) => i);
const aristas = net.edges.filter((e) => PN_IDXS.includes(e[3]));
const nodos = new Set();
for (const e of aristas) { nodos.add(e[0]); nodos.add(e[1]); }
const cerca = [...nodos]
  .map((id) => ({ id, lat: nodes[id][0], lon: nodes[id][1] }))
  .filter((p) => p.lat < -33.4298 && p.lat > -33.4313 && p.lon < -70.6359 && p.lon > -70.6368)
  .sort((a, b) => b.lat - a.lat); // norte → sur
console.log("Nodos calle Pío Nono cerca de la esquina (norte→sur):");
for (const p of cerca) console.log(`  ${p.id}: ${p.lat.toFixed(7)}, ${p.lon.toFixed(7)}`);

// aristas que tocan 5334 (todas las calles, para ver la conexión de la esquina)
console.log("\nAristas que tocan el nodo 5334 (esquina):");
for (const e of net.edges) {
  if (e[0] === 5334 || e[1] === 5334) {
    const otro = e[0] === 5334 ? e[1] : e[0];
    console.log(`  → nodo ${otro} (${nodes[otro][0].toFixed(7)}, ${nodes[otro][1].toFixed(7)}) · calle: "${net.names[e[3]]}"`);
  }
}
