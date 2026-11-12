// Secuencia de vías recorridas por mtb1 y mtb2 (nombre de arista más
// cercana por tramo, agrupado y con km + dirección N/S para leer el sentido).
import { readFileSync } from "node:fs";
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: [number, number][];
  edges: [number, number, number, number][];
};

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
const hav = (a: [number, number], b: [number, number]) => {
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

const kxG = Math.cos((-33.4 * Math.PI) / 180);
function nearestName(p: [number, number]): string {
  const px = p[1] * kxG, py = p[0];
  let bd = Infinity, bn = "(sin nombre)";
  for (const [ai, bi, , ni] of raw.edges) {
    const a = raw.nodes[ai], b = raw.nodes[bi];
    const ax = a[1] * kxG, ay = a[0], bx = b[1] * kxG, by = b[0];
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320;
    if (d < bd) { bd = d; bn = raw.names[ni] || "(sin nombre)"; }
  }
  return bn;
}

for (const id of ["mtb1", "mtb2"]) {
  const t = RUTAS_TRAZADOS[id].coords;
  console.log(`\n===== ${id} (${t.length} pts) =====`);
  let km = 0;
  type Tramo = { name: string; desdeKm: number; metros: number; latIni: number; latFin: number };
  const tramos: Tramo[] = [];
  for (let i = 1; i < t.length; i++) {
    const mid: [number, number] = [(t[i - 1][0] + t[i][0]) / 2, (t[i - 1][1] + t[i][1]) / 2];
    const m = hav(t[i - 1], t[i]);
    const name = nearestName(mid);
    const last = tramos[tramos.length - 1];
    if (last && last.name === name) last.metros += m;
    else tramos.push({ name, desdeKm: km, metros: m, latIni: t[i - 1][0], latFin: t[i][0] });
    km += m / 1000;
  }
  // agrupa: fusiona tramos <40 m en «conector»
  for (const tr of tramos) {
    if (tr.metros < 40) continue;
    const dir = tr.latFin > tr.latIni ? "↑N" : "↓S";
    console.log(`  km ${tr.desdeKm.toFixed(2)} · ${tr.metros.toFixed(0)} m · ${dir} · ${tr.name}`);
  }
}
