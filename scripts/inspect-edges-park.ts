// Inspección del grafo: nombres y clases de aristas dentro del parque
// (para definir el filtro senderos de navegación a destinos del cerro)
import fs from "fs";

const net = JSON.parse(fs.readFileSync("public/red-ciclista.json", "utf8"));
const nodes = net.nodes; // [lat, lon]
const names = net.raw?.names ?? net.names ?? [];
const classes = net.raw?.classes ?? net.classes ?? [];
const edges = net.raw?.edges ?? net.edges ?? [];
console.log("nodes:", nodes.length, "edges:", edges.length, "names:", names.length, "classes:", classes);

// Polígono del parque desde park.ts (copia literal de PARK_POLYGON)
const parkSrc = fs.readFileSync("src/lib/park.ts", "utf8");
const m = parkSrc.match(/PARK_POLYGON[^=]*=\s*\[([\s\S]*?)\];/);
const poly = [...m[1].matchAll(/lat:\s*(-?[\d.]+),\s*lon:\s*(-?[\d.]+)/g)].map((x) => [parseFloat(x[1]), parseFloat(x[2])]);
console.log("poly pts:", poly.length);

function inPoly(lat, lon) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const counts = new Map();
for (const [a, b, ci, ni] of edges) {
  const [la, lo] = nodes[a];
  if (!inPoly(la, lo)) continue;
  const key = `${classes[ci]} | ${names[ni] || "(sin nombre)"}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}
console.log("--- aristas dentro del parque (clase | nombre: nº) ---");
for (const [k, v] of [...counts.entries()].sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(4), k);
