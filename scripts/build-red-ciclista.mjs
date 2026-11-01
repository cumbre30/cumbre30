// Construye el grafo de navegación (vías + ciclovías) usando la API 0.6
// oficial de openstreetmap.org (Overpass no es alcanzable en este entorno).
// Salida: public/red-ciclista.json
import { writeFileSync } from "fs";

const S = -33.44, W = -70.65, N = -33.38, E = -70.59;
const TILES = 3; // 3x3
const CLASSES = ["cycleway", "path", "footway", "pedestrian", "track", "living_street", "residential", "service", "unclassified", "tertiary", "tertiary_link", "secondary", "secondary_link", "primary", "primary_link"];
const UA = "Cumbre30-app-builder/1.0 (contacto: dev@cumbre30.cl)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- recolección por teselas ---
const nodesMap = new Map(); // id -> [lat, lon]
const waysRaw = []; // {nodes:[ids], tags:{}}
let wayIdSeen = new Set();

function tagOf(block, k) {
  const m = block.match(new RegExp(`<tag k="${k}" v="([^"]*)"`));
  return m ? m[1] : null;
}

for (let i = 0; i < TILES; i++) {
  for (let j = 0; j < TILES; j++) {
    const s = S + ((N - S) / TILES) * i;
    const n = S + ((N - S) / TILES) * (i + 1);
    const w = W + ((E - W) / TILES) * j;
    const e = W + ((E - W) / TILES) * (j + 1);
    const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${w.toFixed(4)},${s.toFixed(4)},${e.toFixed(4)},${n.toFixed(4)}`;
    let xml;
    for (let intento = 1; intento <= 3; intento++) {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) { xml = await res.text(); break; }
      console.log(`tesela ${i},${j} → HTTP ${res.status}, intento ${intento}`);
      await sleep(3000 * intento);
    }
    if (!xml) { console.log(`✗ tesela ${i},${j} falló`); continue; }

    // nodos (los atributos visible/version/etc. van entre id y lat)
    for (const m of xml.matchAll(/<node id="(\d+)"[^>]*?lat="([-\d.]+)"[^>]*?lon="([-\d.]+)"/g)) {
      nodesMap.set(m[1], [Number(m[2]), Number(m[3])]);
    }
    // ways con highway
    for (const wm of xml.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
      const wayId = wm[1];
      if (wayIdSeen.has(wayId)) continue;
      wayIdSeen.add(wayId);
      const block = wm[2];
      const highway = tagOf(block, "highway");
      if (!highway || !CLASSES.includes(highway)) continue;
      const nds = [...block.matchAll(/<nd ref="(\d+)"/g)].map((x) => x[1]);
      if (nds.length < 2) continue;
      const tags = {};
      for (const tm of block.matchAll(/<tag k="([^"]+)" v="([^"]*)"/g)) tags[tm[1]] = tm[2];
      waysRaw.push({ nodes: nds, tags });
    }
    console.log(`✓ tesela ${i},${j}: nodos tot=${nodesMap.size}, ways highway=${waysRaw.length}`);
    await sleep(1200);
  }
}

// --- grafo ---
const nodeIndex = new Map(); // "lat6|lon6" -> id compacto
const nodes = [];
function nodeId(lat, lon) {
  const k = `${lat.toFixed(6)}|${lon.toFixed(6)}`;
  let id = nodeIndex.get(k);
  if (id === undefined) {
    id = nodes.length;
    nodes.push([Number(lat.toFixed(6)), Number(lon.toFixed(6))]);
    nodeIndex.set(k, id);
  }
  return id;
}

const edgeSeen = new Set();
const edges = []; // [a,b,classIdx,nameIdx,ciclovia]
const names = [];
const nameIndex = new Map();
function nameId(n) {
  if (!nameIndex.has(n)) { nameIndex.set(n, names.length); names.push(n); }
  return nameIndex.get(n);
}

const cyclePolylines = [];

for (const way of waysRaw) {
  const cls = way.tags.highway;
  const clsIdx = CLASSES.indexOf(cls);
  const t = way.tags;
  const esCiclovia =
    cls === "cycleway" ||
    t.cycleway === "lane" || t.cycleway === "track" || t.cycleway === "shared_lane" ||
    t["cycleway:right"] === "lane" || t["cycleway:right"] === "track" ||
    t["cycleway:left"] === "lane" || t["cycleway:left"] === "track" ||
    (cls === "path" && (t.bicycle === "designated" || t.segregated === "yes"));
  const nId = nameId(t.name ?? "");
  const pts = way.nodes.map((id) => nodesMap.get(id)).filter(Boolean);
  if (pts.length < 2) continue;
  if (esCiclovia) cyclePolylines.push(pts.map((p) => nodeId(p[0], p[1])));
  for (let i = 0; i < pts.length - 1; i++) {
    const a = nodeId(pts[i][0], pts[i][1]);
    const b = nodeId(pts[i + 1][0], pts[i + 1][1]);
    if (a === b) continue;
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (edgeSeen.has(key)) continue;
    edgeSeen.add(key);
    edges.push([a, b, clsIdx, nId, esCiclovia ? 1 : 0]);
  }
}

const out = { v: 1, classes: CLASSES, names, nodes, edges, cicloviaPolylines: cyclePolylines };
const json = JSON.stringify(out);
writeFileSync("/home/z/my-project/public/red-ciclista.json", json);
console.log("FINAL: nodos:", nodes.length, "aristas:", edges.length, "polilíneas ciclo:", cyclePolylines.length);
console.log("tamaño:", (json.length / 1024 / 1024).toFixed(2), "MB");
