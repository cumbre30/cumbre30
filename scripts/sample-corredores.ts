// Muestrea puntos representativos de corredores nombrados del grafo
// (para usarlos como waypoints/vias al recomputar las rutas).
import { readFileSync } from "node:fs";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[];
  names: string[];
  nodes: [number, number][];
  edges: [number, number, number, number, 0 | 1][];
};

// polígono desde park.ts
const parkSrc = readFileSync("src/lib/park.ts", "utf8");
const m = parkSrc.match(/PARK_POLYGON: LatLng\[\] = \[([\s\S]*?)\];/)!;
const poly = [...m[1].matchAll(/lat: (-?[\d.]+), lon: (-?[\d.]+)/g)].map((x) => [+x[1], +x[2]] as [number, number]);
function inPoly(lat: number, lon: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
    if (yi > lat !== yj > lat && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const NAMES: Array<[string, RegExp]> = [
  ["PaArriba", /Sendero Ciclista Pa' Arriba/],
  ["ElZorzal", /Sendero Ciclista El Zorzal/],
  ["LaS", /Sendero Ciclista La S/],
  ["Anfiteatro", /Sendero Ciclista Anfiteatro/],
  ["Torre5", /Sendero Ciclista Torre 5/],
  ["Sendero4ymedio", /Sendero Ciclista 4/],
  ["Ermitano", /Sendero El Ermitaño/],
  ["LaMontana", /Avenida La Montaña/],
  ["AlbertoMackenna", /Alberto Mackenna/],
  ["PedroBannen", /Pedro Bannen/],
  ["CaminoLaPiramide", /Camino La Pirámide/],
  ["PabloNeruda", /Avenida Pablo Neruda/],
  ["PM-PdVNorte", /Paseo Metropolitano - Tramo Pedro de Valdivia Norte/],
  ["PM-JJ-Piramide", /Paseo Metropolitano - Tramo Jardín Japonés/],
  ["PM-plain", /^Paseo Metropolitano$/],
  ["PM-Bicentenario", /Paseo Metropolitano - Parque Bicentenario/],
  ["PM-Bellavista", /Paseo Metropolitano - Sendero Bellavista/],
  ["PM-LaCascada", /Paseo Metropolitano - Sendero La Cascada/],
  ["Antilen", /^Antilen$/],
  ["GabrielaMistral", /Avenida Gabriela Mistral/],
  ["CarlosMartner", /Carlos Martner/],
  ["CaminoExcursionista", /Camino El Excursionista/],
];

for (const [label, re] of NAMES) {
  const pts: [number, number][] = [];
  for (const [a, b, ci, ni] of raw.edges) {
    if (re.test(raw.names[ni] ?? "")) {
      pts.push(raw.nodes[a]);
      pts.push(raw.nodes[b]);
    }
  }
  if (!pts.length) { console.log(`${label}: SIN EDGES`); continue; }
  // ordena por lat y toma 5 muestras repartidas (solo dentro del parque)
  const uniq = Array.from(new Set(pts.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`)))
    .map((s) => s.split(",").map(Number) as [number, number])
    .filter((p) => inPoly(p[0], p[1]))
    .sort((a, b) => a[0] - b[0]);
  const n = uniq.length;
  if (!n) { console.log(`${label}: SIN NODOS DENTRO DEL PARQUE (${pts.length} endpoints)`); continue; }
  const idxs = [0, Math.round(n * 0.25), Math.round(n * 0.5), Math.round(n * 0.75), n - 1];
  const muestras = idxs.map((i) => uniq[Math.min(n - 1, Math.max(0, i))]);
  console.log(`${label} (${n} nodos dentro): ${muestras.map((p) => `(${p[0].toFixed(5)},${p[1].toFixed(5)})`).join(" ")}`);
}
