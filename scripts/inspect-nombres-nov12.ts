// Inspección del grafo: calles clave, puente Mackenna-Bannen,
// extremos de los trazados r1..r5 y corredor Pío Nono.
import { readFileSync } from "node:fs";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: [number, number][];
  edges: [number, number, number, number, 0 | 1][];
};

const hav = (a: [number, number], b: [number, number]) => {
  const R = 6371000, k = Math.PI / 180;
  const dLat = (b[0] - a[0]) * k, dLon = (b[1] - a[1]) * k;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * k) * Math.cos(b[0] * k) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

// 1. nombres únicos que matchean patrones clave
const pats = [/Mackenna/i, /Bannen/i, /Pío Nono|Pio Nono/i, /Gabriela/i, /Martner/i, /Carlos Reed/i, /Terraza/i, /Explanada/i, /Peatonal Cumbre/i, /Siete/i, /Excursionista/i, /Funicular/i];
const names = new Map<string, number>();
for (const [, , , ni] of raw.edges) {
  const n = raw.names[ni] ?? "";
  if (!n) continue;
  names.set(n, (names.get(n) ?? 0) + 1);
}
for (const p of pats) {
  const hits = [...names.entries()].filter(([n]) => p.test(n));
  console.log(` Patron ${p}: ${hits.map(([n, c]) => `"${n}"(${c})`).join(", ") || "—"}`);
}

// 2. cadena Mackenna → Bannen: nodos y su unión (puente real de OSM)
const mackennaEdges: Array<{ a: [number, number]; b: [number, number] }> = [];
const bannenEdges: Array<{ a: [number, number]; b: [number, number] }> = [];
for (const [a, b, , ni] of raw.edges) {
  const n = raw.names[ni] ?? "";
  if (/^Avenida Alberto Mackenna/.test(n)) mackennaEdges.push({ a: raw.nodes[a], b: raw.nodes[b] });
  if (/^Avenida Pedro Bannen/.test(n)) bannenEdges.push({ a: raw.nodes[a], b: raw.nodes[b] });
}
const ext = (eds: typeof mackennaEdges) => {
  let min = [90, 0], max = [-90, 0];
  for (const e of eds) for (const p of [e.a, e.b]) {
    if (p[0] < min[0]) min = p;
    if (p[0] > max[0]) max = p;
  }
  return { min, max };
};
console.log(" Mackenna extremos:", JSON.stringify(ext(mackennaEdges)));
console.log(" Bannen extremos:", JSON.stringify(ext(bannenEdges)));
// nodo Mackenna más cercano a un nodo Bannen = transición (puente)
let bestPair: { m: [number, number]; b: [number, number]; d: number } | null = null;
const bnodes = new Set(bannenEdges.flatMap((e) => [e.a, e.b] as [number, number][]));
for (const e of mackennaEdges) for (const p of [e.a, e.b]) {
  for (const q of bnodes) {
    const d = hav(p, q);
    if (!bestPair || d < bestPair.d) bestPair = { m: p, b: q, d };
  }
}
console.log(" Transición Mackenna-Bannen más cercana:", bestPair && JSON.stringify(bestPair), `${bestPair ? bestPair.d.toFixed(1) : "?"} m`);

// 3. corredor Pío Nono: cadena de nombres desde el acceso (-33.430691,-70.63592) hacia arriba
const gate: [number, number] = [-33.430691, -70.63592];
const pioNames = /^(Avenida Pío Nono|Camino Pío Nono|Pío Nono)/i;
const pioEdges = raw.edges.filter(([, , , ni]) => pioNames.test(raw.names[ni] ?? ""));
console.log(` Aristas "Pío Nono*": ${pioEdges.length}`);
if (pioEdges.length) {
  const pts = pioEdges.flatMap((e) => [raw.nodes[e[0]], raw.nodes[e[1]]]);
  let n = pts[0], f = pts[0];
  for (const p of pts) { if (hav(p, gate) < hav(n, gate)) n = p; if (p[0] > f[0]) f = p; }
  console.log(`  extremo más cercano al acceso: ${JSON.stringify(n)} (${hav(n, gate).toFixed(0)} m); más al norte: ${JSON.stringify(f)}`);
}

// 4. trazados actuales: extremos r1..r5
const tz = (readFileSync("src/lib/rutasTrazados.ts", "utf8").match(/export const RUTAS_TRAZADOS[\s\S]*$/) ?? [""])[0];
const obj = eval("(" + tz.slice(tz.indexOf("{"), tz.lastIndexOf("}") + 1) + ")");
for (const k of ["r1", "r2", "r3", "r4", "r5"]) {
  const t = obj[k];
  if (!t) { console.log(`${k}: FALTA`); continue; }
  console.log(`${k}: ${t.distKm} km · ${t.coords.length} pts · ini (${t.coords[0]}) · fin (${t.coords[t.coords.length - 1]})`);
}

// 5. ¿qué calles hay entre el acceso PDV nuevo y Tupahue? (Av. El Cerro)
const elCerro = raw.edges.filter(([, , , ni]) => /El Cerro|Pedro de Valdivia Norte/i.test(raw.names[ni] ?? ""));
console.log(` Aristas "El Cerro"/"PdV Norte": ${elCerro.length}`);
const cerca: [number, number][] = [[-33.415479, -70.617402], [-33.416209, -70.619256]];
for (const c of cerca) {
  let bd = Infinity, bp: [number, number] | null = null, bn = "";
  for (const [a, b, , ni] of raw.edges) {
    for (const p of [raw.nodes[a], raw.nodes[b]]) {
      const d = hav(p, c as [number, number]);
      if (d < bd) { bd = d; bp = p; bn = raw.names[ni] ?? "(sin nombre)"; }
    }
  }
  console.log(`  cerca de ${c}: nodo ${JSON.stringify(bp)} @ ${bd.toFixed(0)} m · vía "${bn}"`);
}
