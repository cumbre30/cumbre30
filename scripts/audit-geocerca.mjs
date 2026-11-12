// ============================================================
// Auditoría de la GEOCERCA (PARK_POLYGON) del cerro San Cristóbal.
// 1) GATES / RISK_ZONES / NAV_DESTINATIONS / PARK_PLACES dentro-fuera.
// 2) Nodos del grafo OSM propio (red-ciclista.json) que SABEMOS son
//    del parque (por nombre de vía) pero quedan FUERA del polígono
//    → geocerca más chica de lo real ahí.
// 3) Calles urbanas que quedan DENTRO del polígono → geocerca más
//    grande de lo real ahí (bloquea 30 km/h en la ciudad).
// 4) Render PNG sobre tiles OSM para inspección visual.
// ============================================================
import fs from "fs";
import path from "path";

const ROOT = "/home/z/my-project";
const net = JSON.parse(fs.readFileSync(path.join(ROOT, "public/red-ciclista.json"), "utf8"));

// --- extraer PARK_POLYGON de src/lib/park.ts ---
const parkSrc = fs.readFileSync(path.join(ROOT, "src/lib/park.ts"), "utf8");
function extractArr(varName) {
  const re = new RegExp(`export const ${varName}[^=]*=\\s*[\\[{]`);
  const m = parkSrc.match(re);
  if (!m) throw new Error("no " + varName);
  let i = parkSrc.indexOf(m[0]) + m[0].length - 1;
  // balancear llaves/corchetes
  const open = m[0].trim().endsWith("[") ? "[" : "{";
  const close = open === "[" ? "]" : "}";
  let depth = 0, j = i;
  for (; j < parkSrc.length; j++) {
    if (parkSrc[j] === open) depth++;
    else if (parkSrc[j] === close) { depth--; if (depth === 0) break; }
  }
  let txt = parkSrc.slice(i, j + 1);
  // { lat: x, lon: y } → ["x","y"]  y quitar comentarios //
  txt = txt.replace(/\/\/.*$/gm, "");
  txt = txt.replace(/\{\s*lat:\s*(-?[\d.]+),\s*lon:\s*(-?[\d.]+)\s*\}/g, '[$1,$2]');
  txt = txt.replace(/,(\s*[\]}])/g, "$1"); // comas colgantes
  return JSON.parse(txt);
}
const POLY = extractArr("PARK_POLYGON").map(([lat, lon]) => ({ lat, lon }));
console.log("PARK_POLYGON vértices:", POLY.length);

// --- point in polygon (ray casting, igual semántica que geo.ts) ---
function pip(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lon, yi = poly[i].lat, xj = poly[j].lon, yj = poly[j].lat;
    const intersect = ((yi > pt.lat) !== (yj > pt.lat)) && (pt.lon < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
// distancia a la frontera (m) aprox equirectangular
function distToBoundaryM(pt, poly) {
  const R = 6371000, toR = Math.PI / 180;
  const kmLat = 111320, kmLon = 111320 * Math.cos(pt.lat * toR);
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = { x: (poly[j].lon - pt.lon) * kmLon, y: (poly[j].lat - pt.lat) * kmLat };
    const b = { x: (poly[i].lon - pt.lon) * kmLon, y: (poly[i].lat - pt.lat) * kmLat };
    const dx = b.x - a.x, dy = b.y - a.y;
    const L2 = dx * dx + dy * dy;
    const t = L2 === 0 ? 0 : Math.max(0, Math.min(1, (-a.x * dx - a.y * dy) / L2));
    const px = a.x + t * dx, py = a.y + t * dy;
    best = Math.min(best, Math.hypot(px, py));
  }
  return best;
}

// --- 1) puntos oficiales ---
const GATES = [
  ["pio-nono", -33.430691, -70.63592, "ciclistas"],
  ["pv-norte", -33.415479, -70.617402, "ciclistas"],
  ["la-piramide", -33.38642, -70.60179, "ciclistas"],
  ["santos-dumont", -33.423385, -70.637442, ""],
  ["carlos-reed", -33.430102, -70.635426, ""],
  ["aurora-de-chile", -33.415205, -70.627807, ""],
  ["zapadores", -33.399921, -70.620406, "ciclistas"],
  ["paseo-metropolitano", -33.412407, -70.623052, ""],
];
console.log("\n== GATES ==");
for (const [id, lat, lon, cic] of GATES) {
  const inside = pip({ lat, lon }, POLY);
  const d = distToBoundaryM({ lat, lon }, POLY);
  console.log(`${inside ? "DENTRO " : "FUERA  "} ${id} (dist frontera ${d.toFixed(0)} m) ${cic}`);
}

const RISK_ZONES = [
  ["anahuac", -33.417135, -70.623511], ["antiluen", -33.409051, -70.61374],
  ["jardin-japones", -33.413345, -70.614692], ["salida-pv", -33.416209, -70.619256],
  ["zoologico", -33.429636, -70.633963],
];
console.log("\n== RISK_ZONES ==");
for (const [id, lat, lon] of RISK_ZONES) {
  const inside = pip({ lat, lon }, POLY);
  console.log(`${inside ? "DENTRO " : "FUERA  "} ${id}`);
}

const DESTS = [
  ["plaza-mexico", -33.4234, -70.6327], ["antiluen", -33.409051, -70.61374],
  ["jardin-japones", -33.413345, -70.614692], ["zoologico", -33.429636, -70.633963],
  ["anahuac", -33.417135, -70.623511], ["av-gabriela-mistral", -33.4156, -70.6204],
  ["av-carlos-martner", -33.41272, -70.61862], ["santuario", -33.42574, -70.63319],
  ["piscina-tupahue", -33.41581, -70.62355], ["torreon-victoria", -33.41537, -70.62225],
  ["plaza-antilen", -33.40758, -70.61121], ["anfiteatro-neruda", -33.40401, -70.60956],
  ["cumbre-chacarillas", -33.409051, -70.61374], ["piramide-cumbre", -33.39259, -70.60491],
];
console.log("\n== POIs / destinos ==");
for (const [id, lat, lon] of DESTS) {
  const inside = pip({ lat, lon }, POLY);
  console.log(`${inside ? "DENTRO " : "FUERA  "} ${id}`);
}

// --- 2) nodos del grafo con nombre de vía del parque, FUERA del polígono ---
const PARK_NAME_RE =
  /Bannen|Tupahue|Martner|Mistral|Anáhuac|Anahuac|El Cerro|La Montaña|Montaña|Funicular|Metropolitano|Sendero|Pirámide|Piramide|Antilén|Antilen|Jardín|Zoológico|Zoologico|Mackenna|Pío Nono|Pio Nono|Bellavista|San Cristóbal|Cumbre|Mirador|Foster|Chacabuco/i;
const nodes = net.nodes; // [lat,lon]
const edges = net.edges; // [a,b,cls,nameIdx,ciclo]
// contar por NOMBRE de vía: recolectar todos los nodos tocados por aristas con nombre de parque
const parkNodeIdx = new Set();
for (const [a, b, , nameIdx] of edges) {
  const nm = net.names[nameIdx] ?? "";
  if (PARK_NAME_RE.test(nm)) { parkNodeIdx.add(a); parkNodeIdx.add(b); }
}
// agrupar por nombre
const byName = {};
for (const i of parkNodeIdx) {
  const inside = pip({ lat: nodes[i][0], lon: nodes[i][1] }, POLY);
  const nm = (function () {
    for (const [a, b, , nameIdx] of edges) if (a === i || b === i) return net.names[nameIdx] ?? "(sin nombre)";
    return "?";
  })();
  const key = nm;
  (byName[key] ??= { total: 0, fuera: 0, sample: null, worstD: 0 });
  const rec = byName[key];
  rec.total++;
  if (!inside) {
    rec.fuera++;
    const d = distToBoundaryM({ lat: nodes[i][0], lon: nodes[i][1] }, POLY);
    if (d > rec.worstD) { rec.worstD = d; rec.sample = { i, lat: nodes[i][0], lon: nodes[i][1] }; }
  }
}
console.log("\n== VÍAS DEL PARQUE: nodos FUERA de la geocerca (por vía) ==");
const rows = Object.entries(byName).filter(([, r]) => r.fuera > 0).sort((a, b) => b[1].fuera - a[1].fuera);
for (const [nm, r] of rows.slice(0, 30)) {
  console.log(`${r.fuera}/${r.total} fuera · ${nm} · peor a ${r.worstD.toFixed(0)} m del borde (${r.sample.lat.toFixed(6)},${r.sample.lon.toFixed(6)})`);
}
console.log(`vías con nodos fuera: ${rows.length}`);

// --- 3) calles urbanas DENTRO del polígono ---
const URBAN_RE = /^(Avenida |Av\. |Calle |Pasaje |Camino )?/; // todo lo que no matchee PARQUE_NAME_RE y sea clase urbana
const urbanInside = new Map();
for (let i = 0; i < nodes.length; i++) {
  const [lat, lon] = nodes[i];
  if (!pip({ lat, lon }, POLY)) continue;
  for (const [a, b, clsIdx, nameIdx] of edges) {
    if ((a === i || b === i) && !PARK_NAME_RE.test(net.names[nameIdx] ?? "")) {
      const nm = net.names[nameIdx] ?? "(sin nombre)";
      const cls = net.classes[clsIdx];
      const rec = urbanInside.get(nm + "|" + cls) ?? { n: 0, sample: null };
      rec.n++;
      if (!rec.sample) rec.sample = { lat, lon, cls, nm };
      urbanInside.set(nm + "|" + cls, rec);
    }
  }
}
console.log("\n== CALLES URBANAS DENTRO de la geocerca (top 25 por nodos) ==");
const urb = [...urbanInside.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 25);
for (const [k, r] of urb) console.log(`${r.n} nodos · ${k} · ej (${r.sample.lat.toFixed(6)},${r.sample.lon.toFixed(6)})`);

// --- 4) resumen de área y bbox ---
let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
for (const p of POLY) { minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat); minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon); }
console.log("\n== bbox polígono ==");
console.log(`lat ${minLat.toFixed(6)} .. ${maxLat.toFixed(6)} · lon ${minLon.toFixed(6)} .. ${maxLon.toFixed(6)}`);
fs.writeFileSync("/tmp/render/geocerca-poly.json", JSON.stringify(POLY));
