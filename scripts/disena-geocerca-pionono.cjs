/**
 * Diseño del nuevo contorno de la geocerca en el Acceso Pío Nono
 * (2026-11-13, cliente: "traslada el acceso al punto de inicio del
 * trazado de av. alberto mackenna y la geocerca").
 *
 * Reemplaza los vértices [62] y [63] del PARK_POLYGON por un envolvente
 * de la esquina Pío Nono × Mackenna + el arranque del camino de ascenso
 * (nodos del grafo 5334 → 2921 → 2922 → 2923), con margen ~10-14 m
 * (mismo estándar que el envolvente de la portería La Pirámide).
 */
const fs = require("fs");
const poly = JSON.parse(fs.readFileSync(__dirname + "/park-polygon.json", "utf8"));
const net = require("../public/red-ciclista.json");
const nodes = net.nodes;

const M_LAT = 111320; // m por grado de latitud
const M_LON = 111320 * Math.cos((-33.43 * Math.PI) / 180); // ~92 870
const off = (p, dLatM, dLonM) => ({ lat: p.lat + dLatM / M_LAT, lon: p.lon + dLonM / M_LON });

// --- nodos del grafo ---
const n5334 = { lat: nodes[5334][0], lon: nodes[5334][1] };
const n2921 = { lat: nodes[2921][0], lon: nodes[2921][1] };
const n2922 = { lat: nodes[2922][0], lon: nodes[2922][1] };
const n2923 = { lat: nodes[2923][0], lon: nodes[2923][1] };
const n251 = { lat: nodes[251][0], lon: nodes[251][1] };
const n8045 = { lat: nodes[8045][0], lon: nodes[8045][1] };
const gate = { lat: -33.4306903, lon: -70.6362729 };

// --- vértices actuales a reemplazar ---
console.log("Vértices actuales [60..64]:");
for (let i = 60; i <= 64; i++) console.log(`  [${i}]`, poly[i]);

// --- nuevos vértices ---
// N1: lado SE del camino (paralelo al tramo 5334→2921), 12 m al SE del punto medio
const mid = { lat: (n5334.lat + n2921.lat) / 2, lon: (n5334.lon + n2921.lon) / 2 };
const dLat = n2921.lat - n5334.lat, dLon = n2921.lon - n5334.lon;
const L = Math.hypot(dLat * M_LAT, dLon * M_LON); // longitud del tramo en m
const u = { a: dLat * M_LAT / L, b: dLon * M_LON / L }; // unitario (m, hacia el N)
// perpendicular SE del tramo NE: (-b, a) apunta S-E (el otro signo da NW)
const N1 = off(mid, -12 * u.b, 12 * u.a);
// W1: 15 m al S de 5334 y 2 m al E (bajo la esquina)
const W1 = off(n5334, -15, 2);
// W2: 14 m al W de 5334 (cruzando el frente de la calle, la portería queda dentro)
const W2 = off(n5334, 0, -14);
console.log("\nNuevos vértices propuestos:");
console.log("  N1", N1);
console.log("  W1", W1);
console.log("  W2", W2);

// --- construir polígono candidato ---
const nuevos = [N1, W1, W2];
const candidato = [...poly.slice(0, 62), ...nuevos, ...poly.slice(64)];
console.log("\nPolígono:", poly.length, "→", candidato.length, "vértices (reemplaza [62],[63] por N1,W1,W2)");

// --- utilidades ---
const R = 6371000, rad = (d) => (d * Math.PI) / 180;
const distM = (a, b) => {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
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
function autointersecta(P) {
  const n = P.length;
  const cr = (a, b, c, d) => {
    const d1 = (b.lon - a.lon) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lon - a.lon);
    const d2 = (b.lon - a.lon) * (d.lat - a.lat) - (b.lat - a.lat) * (d.lon - a.lon);
    const d3 = (d.lon - c.lon) * (a.lat - c.lat) - (d.lat - c.lat) * (a.lon - c.lon);
    const d4 = (d.lon - c.lon) * (b.lat - c.lat) - (d.lat - c.lat) * (b.lon - c.lon);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  };
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (cr(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return [i, j];
    }
  return null;
}

// --- verificaciones ---
console.log("\n=== VERIFICACIONES ===");
const si = autointersecta(candidato);
console.log("autointersecciones:", si ? `SÍ en ${si}` : "ninguna");

const pruebas = [
  ["GATE pio-nono", gate],
  ["nodo 5334 (inicio trazado)", n5334],
  ["nodo 2921", n2921],
  ["nodo 2922", n2922],
  ["nodo 2923", n2923],
  ["nodo 2924", { lat: nodes[2924][0], lon: nodes[2924][1] }],
  ["calle 251 (S, ciudad)", n251],
  ["calle 8045 (NW)", n8045],
];
for (const [nom, p] of pruebas) {
  console.log(`  ${nom}: dentro=${dentro(p, candidato)} · dist borde=${distAlBorde(p, candidato).toFixed(1)} m`);
}

// los primeros 12 nodos del trazado Mackenna deben quedar dentro
const cadena = [5334, 2921, 2922, 2923, 2924, 2925];
const adj = new Map();
const MACK_IDX = net.names.indexOf("Avenida Alberto Mackenna");
for (const e of net.edges.filter((e) => e[3] === MACK_IDX)) {
  if (!adj.has(e[0])) adj.set(e[0], []);
  if (!adj.has(e[1])) adj.set(e[1], []);
  adj.get(e[0]).push(e[1]); adj.get(e[1]).push(e[0]);
}
let cur = 5334; const vis = new Set([5334]); const orden = [5334];
while (orden.length < 12) {
  const nx = (adj.get(cur) || []).find((x) => !vis.has(x));
  if (nx === undefined) break;
  orden.push(nx); vis.add(nx); cur = nx;
}
console.log("\nPrimeros", orden.length, "nodos del trazado Mackenna:");
let todosDentro = true;
for (const id of orden) {
  const p = { lat: nodes[id][0], lon: nodes[id][1] };
  const d = dentro(p, candidato);
  if (!d) todosDentro = false;
  console.log(`  ${id}: dentro=${d} · dist=${distAlBorde(p, candidato).toFixed(1)} m`);
}
console.log("TODOS dentro:", todosDentro);

// profundidad del gate y del arranque (histéresis 18 m)
console.log("\nProfundidad gate:", distAlBorde(gate, candidato).toFixed(1), "m (La Pirámide usa 10-20 m; histéresis ride = 18 m)");

// sanity: algunos puntos de control lejos del cambio siguen igual
const controles = [
  ["Plaza México", { lat: -33.4234, lon: -70.6327 }],
  ["portería PdV Norte", { lat: -33.415479, lon: -70.617402 }],
  ["portería La Pirámide", { lat: -33.3882651, lon: -70.6015948 }],
  ["Acceso Carlos Reed", { lat: -33.430102, lon: -70.635426 }],
];
for (const [nom, p] of controles) {
  const antes = dentro(p, poly), ahora = dentro(p, candidato);
  console.log(`  ${nom}: antes=${antes} ahora=${ahora} ${antes === ahora ? "OK" : "¡CAMBIÓ!"}`);
}

// volcar el candidato para inspección
fs.writeFileSync(__dirname + "/park-polygon-candidato.json", JSON.stringify(candidato));
console.log("\nCandidato guardado en scripts/park-polygon-candidato.json");
