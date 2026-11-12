// Diff PARK_POLYGON (geocerca vigente) vs límite oficial OSM way/168227059
// (descargado hoy a /tmp/way-nodes-ll.json). Reporta:
//  A) vértices de la geocerca que se alejan del límite OSM (> 20 m)
//  B) tramos del límite OSM que la geocerca no sigue (> 25 m)
import fs from "fs";

const osm = JSON.parse(fs.readFileSync("/tmp/way-nodes-ll.json", "utf8")); // [lat,lon] full res
const parkSrc = fs.readFileSync("/home/z/my-project/src/lib/park.ts", "utf8");

function extractArr(varName) {
  const re = new RegExp(`export const ${varName}[^=]*=\\s*\\[`);
  const m = parkSrc.match(re);
  let i = parkSrc.indexOf(m[0]) + m[0].length - 1;
  let depth = 0, j = i;
  for (; j < parkSrc.length; j++) {
    if (parkSrc[j] === "[") depth++;
    else if (parkSrc[j] === "]") { depth--; if (depth === 0) break; }
  }
  let txt = parkSrc.slice(i, j + 1).replace(/\/\/.*$/gm, "");
  txt = txt.replace(/\{\s*lat:\s*(-?[\d.]+),\s*lon:\s*(-?[\d.]+)\s*\}/g, "[$1,$2]");
  txt = txt.replace(/,(\s*[\]}])/g, "$1");
  return JSON.parse(txt);
}
const GEO = extractArr("PARK_POLYGON"); // [lat,lon]

// metros entre puntos (aprox local Santiago)
const KLAT = 110540;
const KLON = 93500 * Math.cos((-33.41 * Math.PI) / 180);
const mLat = (a, b) => (b[0] - a[0]) * KLAT;
const mLon = (a, b) => (b[1] - a[1]) * KLON;
function d2seg(p, a, b) {
  const dx = mLon(a, b), dy = mLat(a, b);
  const px = mLon(a, p), py = mLat(a, p);
  const L = dx * dx + dy * dy;
  const t = L === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / L));
  return Math.hypot(px - t * dx, py - t * dy);
}
function distToPath(p, path) {
  let best = Infinity;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    best = Math.min(best, d2seg(p, path[j], path[i]));
    if (best === 0) break;
  }
  return best;
}

console.log("geocerca vértices:", GEO.length, "· OSM límite puntos:", osm.length);

// área (shoelace en m² aprox)
function area(path) {
  let s = 0;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    s += (path[j][1] * KLON) * (path[i][0] * KLAT) - (path[i][1] * KLON) * (path[j][0] * KLAT);
  }
  return Math.abs(s / 2);
}
console.log(`área geocerca: ${(area(GEO) / 1e6).toFixed(1)} ha · área OSM: ${(area(osm) / 1e6).toFixed(1)} ha`);

console.log("\n== A) vértices de la GEOCERCA lejos del límite OSM (> 20 m) ==");
for (let i = 0; i < GEO.length; i++) {
  const d = distToPath(GEO[i], osm);
  if (d > 20) console.log(`geo[${i}] ${GEO[i][0].toFixed(6)},${GEO[i][1].toFixed(6)} → ${d.toFixed(0)} m del límite OSM`);
}

console.log("\n== B) tramos del límite OSM que la GEOCERCA no cubre (> 30 m) ==");
let worst = [];
for (let i = 0; i < osm.length; i++) {
  const d = distToPath(osm[i], GEO);
  worst.push([d, i]);
}
worst.sort((a, b) => b[0] - a[0]);
for (const [d, i] of worst.slice(0, 40)) {
  if (d <= 30) break;
  console.log(`osm[${i}] ${osm[i][0].toFixed(6)},${osm[i][1].toFixed(6)} → ${d.toFixed(0)} m fuera de la geocerca`);
}
fs.writeFileSync("/tmp/render/osm-boundary.json", JSON.stringify(osm));
