// Números duros: puntos del tramo único de cada trazado y su distancia
// a las polilíneas principales de Zorzal y La S (punto a segmento).
import { readFileSync } from "node:fs";
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as any;

function polilineas(list: [number, number][][]): [number, number][][] {
  const remaining = [...list];
  const lines: [number, number][][] = [];
  const rad = (d: number) => (d * Math.PI) / 180;
  const hav = (a: [number, number], b: [number, number]) => {
    const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(s));
  };
  while (remaining.length) {
    const s0 = remaining.shift()!;
    const line: [number, number][] = [s0[0], s0[1]];
    let crecio = true;
    while (crecio) {
      crecio = false;
      for (let i = 0; i < remaining.length; i++) {
        const s = remaining[i];
        const ini = line[0], fin = line[line.length - 1];
        if (hav(s[1], fin) < 2) { line.push(s[0]); remaining.splice(i, 1); crecio = true; break; }
        if (hav(s[0], fin) < 2) { line.push(s[1]); remaining.splice(i, 1); crecio = true; break; }
        if (hav(s[1], ini) < 2) { line.unshift(s[0]); remaining.splice(i, 1); crecio = true; break; }
        if (hav(s[0], ini) < 2) { line.unshift(s[1]); remaining.splice(i, 1); crecio = true; break; }
      }
    }
    lines.push(line);
  }
  return lines;
}

const IN_SECTOR = (p: [number, number]) =>
  p[0] >= -33.409 && p[0] <= -33.398 && p[1] >= -70.614 && p[1] <= -70.607;

function mainPoly(re: RegExp): [number, number][] {
  const segs: [number, number][][] = [];
  for (const [ai, bi, , ni] of raw.edges) {
    if (!re.test(raw.names[ni] || "")) continue;
    const a = raw.nodes[ai], b = raw.nodes[bi];
    if (IN_SECTOR(a) && IN_SECTOR(b)) segs.push([a, b]);
  }
  const pls = polilineas(segs);
  const largo = (l: [number, number][]) => {
    let m = 0;
    for (let i = 1; i < l.length; i++) {
      const dLat = (l[i][0] - l[i - 1][0]) * 111_320;
      const dLon = (l[i][1] - l[i - 1][1]) * 111_320 * Math.cos((l[i][0] * Math.PI) / 180);
      m += Math.hypot(dLat, dLon);
    }
    return m;
  };
  return pls[pls.map(largo).indexOf(Math.max(...pls.map(largo)))];
}

const zorzal = mainPoly(/zorzal/i);
const laS = mainPoly(/la s/i);
console.log(`zorzal: ${zorzal.length} pts | laS: ${laS.length} pts`);

function distPP(p: [number, number], line: [number, number][]): number {
  const kx = Math.cos((p[0] * Math.PI) / 180);
  const px = p[1] * kx, py = p[0];
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    const ax = a[1] * kx, ay = a[0], bx = b[1] * kx, by = b[0];
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320);
  }
  return best;
}

const a = RUTAS_TRAZADOS["mtb1"].coords;
const b = RUTAS_TRAZADOS["mtb2"].coords;
const key = (p: [number, number]) => `${p[0]},${p[1]}`;
const setB = new Set(b.map(key));
const setA = new Set(a.map(key));

for (const [id, t, otro] of [["mtb1", a, setB], ["mtb2", b, setA]] as const) {
  const unicos: number[] = [];
  t.forEach((p, i) => { if (!otro.has(key(p))) unicos.push(i); });
  console.log(`\n=== ${id}: únicos idx ${unicos[0]}..${unicos[unicos.length - 1]} (${unicos.length} pts)`);
  for (let j = 0; j < unicos.length; j += 5) {
    const p = t[unicos[j]];
    console.log(`  [${unicos[j]}] ${p[0].toFixed(5)},${p[1].toFixed(5)} → zorzal ${distPP(p, zorzal).toFixed(0)} m | laS ${distPP(p, laS).toFixed(0)} m`);
  }
}
