/**
 * Localiza el punto de INICIO (extremo ciudad) del trazado de
 * Av. Alberto Mackenna en el grafo local (public/red-ciclista.json),
 * lo compara con el gate pio-nono y con la geocerca PARK_POLYGON.
 * Formato arista: [a, b, clase, nameIdx, oneway].
 */
const net = require("../public/red-ciclista.json");
const nodes = net.nodes; // array de [lat, lon]
const getPos = (id) => ({ lat: nodes[id][0], lon: nodes[id][1] });
const MACK = names().indexOf;
function names() { return net.names; }
const MACK_IDX = net.names.indexOf("Avenida Alberto Mackenna");
console.log("nameIdx de Avenida Alberto Mackenna:", MACK_IDX);

const aristas = net.edges.filter((e) => e[3] === MACK_IDX);
console.log("aristas Mackenna:", aristas.length);

const grado = new Map();
const nodosMack = new Set();
for (const e of aristas) {
  nodosMack.add(e[0]); nodosMack.add(e[1]);
  grado.set(e[0], (grado.get(e[0]) || 0) + 1);
  grado.set(e[1], (grado.get(e[1]) || 0) + 1);
}
const extremos = [...nodosMack].filter((id) => (grado.get(id) || 0) === 1);
console.log("nodos Mackenna:", nodosMack.size, "· extremos:", extremos.length);
for (const id of extremos) {
  const p = getPos(id);
  console.log(`  extremo nodo ${id}: ${p.lat.toFixed(7)}, ${p.lon.toFixed(7)}`);
}

// extremo más al sur = inicio del ascenso (lado ciudad)
let inicio = null, best = Infinity;
for (const id of extremos) {
  const p = getPos(id);
  if (p.lat < best) { best = p.lat; inicio = { id, ...p }; }
}
console.log("\nINICIO (extremo sur) cadena Mackenna:", inicio);

const gate = { lat: -33.4306903, lon: -70.6362729 };
const R = 6371000, rad = (d) => (d * Math.PI) / 180;
const distM = (a, b) => {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
console.log("inicio → gate actual:", distM(inicio, gate).toFixed(1), "m");

const poly = require("./park-polygon.json");
function dentro(p, P) {
  let d = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const xi = P[i].lon, yi = P[i].lat, xj = P[j].lon, yj = P[j].lat;
    if ((yi > p.lat) !== (yj > p.lat) && p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}
function distAlBorde(p, P) {
  let min = Infinity;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const ax = P[j].lon, ay = P[j].lat, bx = P[i].lon, by = P[i].lat;
    const dx = bx - ax, dy = by - ay;
    const L2 = dx * dx + dy * dy || 1e-20;
    let t = Math.max(0, Math.min(1, ((p.lon - ax) * dx + (p.lat - ay) * dy) / L2));
    const d = distM(p, { lat: ay + t * dy, lon: ax + t * dx });
    if (d < min) min = d;
  }
  return min;
}
console.log("inicio dentro de geocerca:", dentro(inicio, poly));
console.log("inicio dist al borde:", distAlBorde(inicio, poly).toFixed(1), "m");

// cadena ordenada de Mackenna: primeros 3 nodos desde el inicio
const adj = new Map();
for (const e of aristas) {
  if (!adj.has(e[0])) adj.set(e[0], []);
  if (!adj.has(e[1])) adj.set(e[1], []);
  adj.get(e[0]).push(e[1]);
  adj.get(e[1]).push(e[0]);
}
const cadena = [inicio.id];
const vistos = new Set([inicio.id]);
let cur = inicio.id;
while (true) {
  const sig = (adj.get(cur) || []).find((n) => !vistos.has(n));
  if (sig === undefined) break;
  cadena.push(sig); vistos.add(sig); cur = sig;
  if (cadena.length > 5) break;
}
console.log("\nPrimeros nodos de la cadena desde el inicio:");
for (const id of cadena) {
  const p = getPos(id);
  console.log(`  nodo ${id}: ${p.lat.toFixed(7)}, ${p.lon.toFixed(7)} · dentro: ${dentro(p, poly)} · dist borde: ${distAlBorde(p, poly).toFixed(1)} m · → gate: ${distM(p, gate).toFixed(1)} m`);
}
