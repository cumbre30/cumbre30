// Valida el PARK_POLYGON nuevo: rotonda/portería La Pirámide dentro,
// sin autointersecciones, límite OSM respetado en el resto, y qué
// nodos urbanos nuevos quedaron dentro (deben ser solo el acceso).
import fs from "fs";

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
const GEO = extractArr("PARK_POLYGON");
const OSM = JSON.parse(fs.readFileSync("/tmp/way-nodes-ll.json", "utf8"));
const G = JSON.parse(fs.readFileSync("/home/z/my-project/public/red-ciclista.json", "utf8"));
const { nodes, edges, names } = G;

function pip(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
    if ((yi > pt[0]) !== (yj > pt[0]) && pt[1] < ((xj - xi) * (pt[0] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segs_intersect(p1, p2, p3, p4) {
  const ccw = (A, B, C) => (C[1] - A[1]) * (B[0] - A[0]) - (B[1] - A[1]) * (C[0] - A[0]);
  const d1 = ccw(p3, p4, p1), d2 = ccw(p3, p4, p2), d3 = ccw(p1, p2, p3), d4 = ccw(p1, p2, p4);
  return ((d1 > 0) != (d2 > 0)) && ((d3 > 0) != (d4 > 0));
}
const n = GEO.length;
let crosses = 0;
for (let i = 0; i < n; i++)
  for (let k = i + 2; k < n; k++) {
    if (i === 0 && k === n - 1) continue;
    const s1 = [GEO[i], GEO[(i + 1) % n]], s2 = [GEO[k], GEO[(k + 1) % n]];
    const share = s1.some((a) => s2.some((b) => a[0] === b[0] && a[1] === b[1]));
    if (!share && segs_intersect(s1[0], s1[1], s2[0], s2[1])) crosses++;
  }
console.log("vértices:", n, "· AUTOCRUZES:", crosses);

const GATE = [-33.38642, -70.60179];
console.log("gate La Pirámide:", pip(GATE, GEO) ? "DENTRO ✓" : "FUERA ✗");
const ni = names.indexOf("Rotonda La Pirámide");
const rpts = [...new Set(edges.filter((e) => e[3] === ni).flatMap((e) => [e[0], e[1]]))];
const rIn = rpts.filter((i) => pip(nodes[i], GEO)).length;
console.log(`rotonda: ${rIn}/${rpts.length} nodos dentro`);

// desviación del resto del contorno vs OSM (excluye la zona nueva)
const KLAT = 110540, KLON = 93500 * Math.cos((-33.41 * Math.PI) / 180);
function d2path(p, path) {
  let best = Infinity;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const ax = (path[j][1] - p[1]) * KLON, ay = (path[j][0] - p[0]) * KLAT;
    const bx = (path[i][1] - p[1]) * KLON, by = (path[i][0] - p[0]) * KLAT;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const t = L2 === 0 ? 0 : Math.max(0, Math.min(1, (-ax * dx - ay * dy) / L2));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}
let maxDev = 0, maxDevPt = null;
for (const p of GEO) {
  if (p[0] > -33.3882 && p[1] < -70.6005 && p[1] > -70.6022) continue; // zona nueva
  const d = d2path(p, OSM);
  if (d > maxDev) { maxDev = d; maxDevPt = p; }
}
console.log("máx desviación del resto vs OSM:", maxDev.toFixed(1), "m en", JSON.stringify(maxDevPt));

// ¿qué vías nuevas cayeron dentro por la extensión? (deben ser solo acceso/portería)
const newInside = {};
for (let i = 0; i < nodes.length; i++) {
  const p = nodes[i];
  if (p[0] > -33.3873 && p[0] < -33.3857 && p[1] > -70.6021 && p[1] < -70.6007 && pip(p, GEO)) {
    for (const [a, b, ci, ni2] of edges) {
      if (a === i || b === i) {
        const nm = names[ni2] ?? "(sin nombre)";
        newInside[nm] = (newInside[nm] ?? 0) + 1;
      }
    }
  }
}
console.log("vías dentro de la zona extendida:", JSON.stringify(newInside));
