// Diagnóstico del grafo red-ciclista.json: conectividad y ruta Pío Nono → Cumbre
const fs = require("fs");
const raw = JSON.parse(fs.readFileSync("/home/z/my-project/public/red-ciclista.json", "utf8"));
const { nodes, edges } = raw;
console.log("nodes:", nodes.length, "edges:", edges.length, "classes:", raw.classes, "names:", raw.names.length);

function hav(a, b) {
  const R = 6371000, to = Math.PI / 180;
  const dLat = (b[0] - a[0]) * to, dLon = (b[1] - a[1]) * to;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * to) * Math.cos(b[0] * to) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function nearest(p, maxM = 800) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const d = hav(p, nodes[i]);
    if (d < bd) { bd = d; best = i; if (d < 12) break; }
  }
  return { idx: bd <= maxM ? best : null, d: bd };
}
const ORIGIN = [-33.430691, -70.63592]; // Pío Nono
const DEST = [-33.404, -70.617]; // Cumbre
const so = nearest(ORIGIN), sd = nearest(DEST);
console.log("origen → nodo", so.idx, "a", Math.round(so.d), "m — coord", nodes[so.idx]);
console.log("destino → nodo", sd.idx, "a", Math.round(sd.d), "m — coord", nodes[sd.idx]);

// adyacencia
const adj = nodes.map(() => []);
for (const [a, b] of edges.map(e => [e[0], e[1]])) { adj[a].push(b); adj[b].push(a); }

// componentes
const comp = new Int32Array(nodes.length).fill(-1);
let nc = 0; const sizes = [];
for (let i = 0; i < nodes.length; i++) {
  if (comp[i] >= 0) continue;
  const q = [i]; comp[i] = nc; let n = 0;
  while (q.length) { const u = q.pop(); n++; for (const v of adj[u]) if (comp[v] < 0) { comp[v] = nc; q.push(v); } }
  sizes.push(n); nc++;
}
sizes.sort((a, b) => b - a);
console.log("componentes:", nc, "top5 tamaños:", sizes.slice(0, 5));
console.log("origen comp:", comp[so.idx], "destino comp:", comp[sd.idx], "mismo:", comp[so.idx] === comp[sd.idx]);

// bbox de nodos (¿basura?)
let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180, bad = 0;
for (const [la, lo] of nodes) {
  if (la < -40 || la > -30 || lo < -75 || lo > -68) { bad++; continue; }
  if (la < minLat) minLat = la; if (la > maxLat) maxLat = la;
  if (lo < minLon) minLon = lo; if (lo > maxLon) maxLon = lo;
}
console.log("bbox nodos válidos:", minLat.toFixed(4), maxLat.toFixed(4), minLon.toFixed(4), maxLon.toFixed(4), "| nodos fuera de rango:", bad);

// Dijkstra simple para distancia y bbox de la ruta
if (comp[so.idx] === comp[sd.idx]) {
  const dist = new Float64Array(nodes.length).fill(Infinity);
  const prev = new Int32Array(nodes.length).fill(-1);
  dist[so.idx] = 0;
  const visited = new Uint8Array(nodes.length);
  for (;;) {
    let u = -1, du = Infinity;
    for (let i = 0; i < nodes.length; i++) if (!visited[i] && dist[i] < du) { du = dist[i]; u = i; }
    if (u < 0 || u === sd.idx) break;
    visited[u] = 1;
    for (const [a, b] of edges.map(e => [e[0], e[1]])) {} // noop
  }
  // (Dijkstra O(n²) es lento con muchos nodos; hacemos BFS por aristas con peso 1 para confirmar alcanzabilidad y bbox)
  const prevB = new Int32Array(nodes.length).fill(-1);
  const seen = new Uint8Array(nodes.length);
  const q = [so.idx]; seen[so.idx] = 1;
  while (q.length) {
    const u = q.shift();
    if (u === sd.idx) break;
    for (const v of adj[u]) if (!seen[v]) { seen[v] = 1; prevB[v] = u; q.push(v); }
  }
  if (!seen[sd.idx]) { console.log("destino NO alcanzable por BFS (raro)"); }
  else {
    const path = []; let u = sd.idx;
    while (u >= 0) { path.push(u); u = prevB[u]; }
    path.reverse();
    let d = 0;
    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    for (let i = 0; i < path.length - 1; i++) d += hav(nodes[path[i]], nodes[path[i + 1]]);
    for (const i of path) { const [la, lo] = nodes[i]; if (la < minLat) minLat = la; if (la > maxLat) maxLat = la; if (lo < minLon) minLon = lo; if (lo > maxLon) maxLon = lo; }
    console.log("ruta BFS (en aristas):", path.length, "nodos —", (d / 1000).toFixed(2), "km — bbox lat", minLat.toFixed(4), maxLat.toFixed(4), "lon", minLon.toFixed(4), maxLon.toFixed(4));
    console.log("inicio:", nodes[path[0]], "fin:", nodes[path[path.length - 1]]);
  }
}
