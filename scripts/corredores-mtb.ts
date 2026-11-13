// Extrae del grafo public/red-ciclista.json las aristas con nombre
// La S / Zorzal / Anfiteatro / Pa' Arriba y mide cuánto recorre cada
// trazado mtb1/mtb2 sobre cada corredor (por proximidad, no por nombre).
import { readFileSync, writeFileSync } from "node:fs";
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: [number, number][];
  edges: [number, number, number, number][];
};

const RE = { laS: /La S/i, zorzal: /Zorzal/i, anfi: /Anfiteatro/i, paArriba: /Pa' Arriba/i };
const corredores: Record<string, [number, number][][]> = { laS: [], zorzal: [], anfi: [], paArriba: [] };
const metrosArista: Record<string, number> = { laS: 0, zorzal: 0, anfi: 0, paArriba: 0 };

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
const hav = (a: [number, number], b: [number, number]) => {
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

for (const [ai, bi, ci, ni] of raw.edges) {
  const name = raw.names[ni] || "";
  const which = RE.laS.test(name) ? "laS" : RE.zorzal.test(name) ? "zorzal" : RE.anfi.test(name) ? "anfi" : RE.paArriba.test(name) ? "paArriba" : null;
  if (!which) continue;
  const a = raw.nodes[ai], b = raw.nodes[bi];
  corredores[which].push([a, b]);
  metrosArista[which] += hav(a, b);
}
for (const k of Object.keys(corredores)) {
  console.log(`${k}: ${corredores[k].length} aristas, ${metrosArista[k].toFixed(0)} m totales`);
  const all = corredores[k].flat();
  const lats = all.map((p) => p[0]), lons = all.map((p) => p[1]);
  console.log(`   bbox lat ${Math.min(...lats).toFixed(5)}..${Math.max(...lats).toFixed(5)} · lon ${Math.min(...lons).toFixed(5)}..${Math.max(...lons).toFixed(5)}`);
}

// ¿Qué corredor toca cada trazado? Distancia de cada punto del trazado
// al corredor más cercano (punto-a-segmento aprox por punto más cercano).
function distACorredor(p: [number, number], cor: [number, number][][]): number {
  let best = Infinity;
  const kx = Math.cos((p[0] * Math.PI) / 180);
  const px = p[1] * kx, py = p[0];
  for (const [a, b] of cor) {
    const ax = a[1] * kx, ay = a[0], bx = b[1] * kx, by = b[0];
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320);
  }
  return best;
}

const resumen: Record<string, string> = {};
for (const id of ["mtb1", "mtb2"]) {
  const t = RUTAS_TRAZADOS[id].coords;
  const line: string[] = [];
  for (const k of Object.keys(corredores)) {
    const con = corredores[k];
    if (!con.length) continue;
    // metros del trazado dentro de 12 m del corredor
    let m = 0;
    for (let i = 1; i < t.length; i++) {
      const mid: [number, number] = [(t[i - 1][0] + t[i][0]) / 2, (t[i - 1][1] + t[i][1]) / 2];
      if (distACorredor(mid, con) <= 12) m += hav(t[i - 1], t[i]);
    }
    line.push(`${k}=${m.toFixed(0)} m`);
  }
  resumen[id] = line.join(" · ");
  console.log(`${id}: ${resumen[id]}`);
}

// Dump GeoJSON de los corredores para inspección/plot
const gj = {
  type: "FeatureCollection",
  features: Object.entries(corredores).flatMap(([k, segs]) =>
    segs.map(([a, b]) => ({
      type: "Feature",
      properties: { corredor: k },
      geometry: { type: "LineString", coordinates: [[a[1], a[0]], [b[1], b[0]]] },
    }))
  ),
};
writeFileSync("/tmp/corredores-mtb.geojson", JSON.stringify(gj));
console.log("GeoJSON → /tmp/corredores-mtb.geojson");
