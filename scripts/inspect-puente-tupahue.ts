// Edges reales alrededor del puente Tupahue (-33.416121,-70.623005):
// endpoints, distancia a Plaza México y dirección, para fijar el corte horario.
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
const PUENTE: [number, number] = [-33.416121, -70.623005];
const PLAZA: [number, number] = [-33.4234, -70.6327];
const GATE_PIO: [number, number] = [-33.430691, -70.63592];

const filas: Array<{ nm: string; cls: string; a: [number, number]; b: [number, number]; dP: number; dPio: number; dPuen: number }> = [];
for (const [a, b, ci, ni] of raw.edges) {
  const pa = raw.nodes[a], pb = raw.nodes[b];
  const dPuen = Math.min(hav(pa, PUENTE), hav(pb, PUENTE));
  if (dPuen > 150) continue;
  const dPa = hav(pa, PLAZA), dPb = hav(pb, PLAZA);
  filas.push({
    nm: raw.names[ni] || "(sin nombre)",
    cls: raw.classes[ci],
    a: pa, b: pb,
    dP: dPb - dPa, // positivo: b se aleja de Plaza México (bajando)
    dPio: hav(pb, GATE_PIO) - hav(pa, GATE_PIO),
    dPuen,
  });
}
filas.sort((x, y) => x.dPuen - y.dPuen);
console.log(`Aristas a <150 m del puente: ${filas.length}`);
for (const f of filas.slice(0, 40)) {
  console.log(
    `  ${f.nm} [${f.cls}] · A(${f.a[0].toFixed(5)},${f.a[1].toFixed(5)}) → B(${f.b[0].toFixed(5)},${f.b[1].toFixed(5)}) · ΔPlaza=${f.dP.toFixed(0)} m · ΔPioNono=${f.dPio.toFixed(0)} m · al puente ${f.dPuen.toFixed(0)} m`
  );
}
// resumen por nombre: cuántas aristas "suben a la cumbre" (ΔPlaza < -12)
console.log("\nPor nombre — aristas con ΔPlaza < -12 (avanzan hacia Plaza México):");
const suben = new Map<string, number>();
const bajan = new Map<string, number>();
for (const f of filas) {
  if (f.dP < -12) suben.set(f.nm, (suben.get(f.nm) ?? 0) + 1);
  else if (f.dP > 12) bajan.set(f.nm, (bajan.get(f.nm) ?? 0) + 1);
}
console.log(" suben:", [...suben.entries()].map(([n, c]) => `${n}(${c})`).join(", ") || "—");
console.log(" bajan:", [...bajan.entries()].map(([n, c]) => `${n}(${c})`).join(", ") || "—");
