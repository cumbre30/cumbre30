// Encadena aristas del grafo por nombre (La S / Zorzal / Anfiteatro /
// Pa' Arriba) en polilíneas contiguas, solo sector Los Gemelos, y reporta
// largo + extremos de cada polilínea. Además: qué porción de cada polilínea
// recorre mtb1/mtb2 (por proximidad <8 m).
import { readFileSync } from "node:fs";
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: [number, number][];
  edges: [number, number, number, number][];
};

// Sector Los Gemelos
const IN_SECTOR = (p: [number, number]) =>
  p[0] >= -33.409 && p[0] <= -33.398 && p[1] >= -70.614 && p[1] <= -70.607;

const RE: Record<string, RegExp> = {
  laS: /la s/i, zorzal: /zorzal/i, anfi: /anfiteatro/i, paArriba: /arriba/i,
};

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
const hav = (a: [number, number], b: [number, number]) => {
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

// recolecta segmentos por corredor (solo in-sector)
const segs: Record<string, { a: [number, number]; b: [number, number]; name: string }[]> = {
  laS: [], zorzal: [], anfi: [], paArriba: [],
};
for (const [ai, bi, , ni] of raw.edges) {
  const name = raw.names[ni] || "";
  for (const [k, re] of Object.entries(RE)) {
    if (re.test(name)) {
      const a = raw.nodes[ai], b = raw.nodes[bi];
      if (IN_SECTOR(a) && IN_SECTOR(b)) segs[k].push({ a, b, name });
      break; // primer match manda (orden: laS, zorzal, anfi, paArriba)
    }
  }
}

// encadena: une segmentos que comparten extremo (tolerancia ~2 m)
function polilineas(list: typeof segs["laS"]): [number, number][][] {
  const puntos = new Map<string, [number, number][]>();
  const k = (p: [number, number]) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
  const remaining = [...list];
  const lines: [number, number][][] = [];
  while (remaining.length) {
    const s0 = remaining.shift()!;
    let line: [number, number][] = [s0.a, s0.b];
    let crecio = true;
    while (crecio) {
      crecio = false;
      for (let i = 0; i < remaining.length; i++) {
        const s = remaining[i];
        const ini = line[0], fin = line[line.length - 1];
        if (hav(s.b, fin) < 2) { line.push(s.b === fin ? s.a : s.b); line.splice(line.length - 2, 0, s.a); /* aprox */ remaining.splice(i, 1); crecio = true; break; }
        if (hav(s.a, fin) < 2) { line.push(s.b); remaining.splice(i, 1); crecio = true; break; }
        if (hav(s.b, ini) < 2) { line.unshift(s.a); remaining.splice(i, 1); crecio = true; break; }
        if (hav(s.a, ini) < 2) { line.unshift(s.b); remaining.splice(i, 1); crecio = true; break; }
      }
    }
    lines.push(line);
  }
  return lines;
}

for (const [k, list] of Object.entries(segs)) {
  const pls = polilineas(list as typeof segs["laS"]).filter((l) => l.length >= 2);
  const largos = pls.map((l) => {
    let m = 0;
    for (let i = 1; i < l.length; i++) m += hav(l[i - 1], l[i]);
    return m;
  });
  console.log(`\n=== ${k}: ${list.length} segmentos → ${pls.length} polilíneas`);
  pls.forEach((l, i) => {
    const ini = l[0], fin = l[l.length - 1];
    console.log(`  #${i}: ${largos[i].toFixed(0)} m, ${l.length} pts · ini ${ini[0].toFixed(5)},${ini[1].toFixed(5)} → fin ${fin[0].toFixed(5)},${fin[1].toFixed(5)}`);
  });
}
