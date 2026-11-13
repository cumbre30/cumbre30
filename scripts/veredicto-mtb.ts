// VEREDICTO: ¿por qué corredor va cada tramo único? Distancia media/mínima
// de cada tramo único (mtb1 y mtb2) a las polilíneas encadenadas de
// La S, Zorzal y Anfiteatro. Además: % del tramo a <8 m de cada corredor.
import { readFileSync } from "node:fs";
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: [number, number][];
  edges: [number, number, number, number][];
};
const IN_SECTOR = (p: [number, number]) =>
  p[0] >= -33.409 && p[0] <= -33.398 && p[1] >= -70.614 && p[1] <= -70.607;
const RE: Record<string, RegExp> = { laS: /la s/i, zorzal: /zorzal/i, anfi: /anfiteatro/i };

// encadena segmentos en polilíneas (igual que encadena-corredores)
function polilineas(list: [number, number][][]): [number, number][][] {
  const remaining = [...list];
  const lines: [number, number][][] = [];
  const R2 = 6371000, rad = (d: number) => (d * Math.PI) / 180;
  const hav = (a: [number, number], b: [number, number]) => {
    const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
    return 2 * R2 * Math.asin(Math.sqrt(s));
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

const corredores: Record<string, [number, number][][]> = {};
for (const [k, re] of Object.entries(RE)) {
  const segs: [number, number][][] = [];
  for (const [ai, bi, , ni] of raw.edges) {
    if (!re.test(raw.names[ni] || "")) continue;
    const a = raw.nodes[ai], b = raw.nodes[bi];
    if (IN_SECTOR(a) && IN_SECTOR(b)) segs.push([a, b]);
  }
  const pls = polilineas(segs);
  // quedarse con la polilínea más larga
  const largos = pls.map((l) => {
    let m = 0;
    for (let i = 1; i < l.length; i++) {
      const dLat = (l[i][0] - l[i - 1][0]) * 111_320;
      const dLon = (l[i][1] - l[i - 1][1]) * 111_320 * Math.cos((l[i][0] * Math.PI) / 180);
      m += Math.hypot(dLat, dLon);
    }
    return m;
  });
  const idx = largos.indexOf(Math.max(...largos));
  corredores[k] = [pls[idx]];
  console.log(`${k}: polilínea principal ${largos[idx].toFixed(0)} m (${pls[idx].length} pts)`);
}

function distPuntoPolilinea(p: [number, number], line: [number, number][]): number {
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
  for (let i = 0; i < t.length; i++) if (!otro.has(key(t[i]))) unicos.push(i);
  if (!unicos.length) continue;
  const desde = unicos[0], hasta = unicos[unicos.length - 1];
  const tramo = t.slice(desde, hasta + 1);
  console.log(`\n=== ${id}: tramo único idx ${desde}..${hasta} (${tramo.length} pts)`);
  for (const [k, lines] of Object.entries(corredores)) {
    const ds = tramo.map((p) => distPuntoPolilinea(p, lines[0]));
    const media = ds.reduce((s, d) => s + d, 0) / ds.length;
    const cerca8 = (ds.filter((d) => d <= 8).length / ds.length) * 100;
    const cerca15 = (ds.filter((d) => d <= 15).length / ds.length) * 100;
    console.log(`  dist a ${k}: media ${media.toFixed(0)} m · mín ${Math.min(...ds).toFixed(0)} m · ≤8 m: ${cerca8.toFixed(0)}% · ≤15 m: ${cerca15.toFixed(0)}%`);
  }
}
