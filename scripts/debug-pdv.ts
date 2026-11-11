// Posición del acceso PdV Norte actual vs Av. El Cerro del grafo vs inicio GPX r1
import fs from "fs";
const net = JSON.parse(fs.readFileSync("public/red-ciclista.json", "utf8"));
const haversine = (a: [number, number], b: [number, number]) => {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toR, dLon = (b[1] - a[1]) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
const gate: [number, number] = [-33.411769, -70.607988];
const r1start: [number, number] = [-33.412097, -70.607576];
console.log("gate actual:", gate, "· r1 GPX inicio:", r1start, "· dist:", haversine(gate, r1start).toFixed(0), "m");

// tramos de "Avenida El Cerro" en el grafo
const segs: { name: string; mid: [number, number]; dGate: number; dR1: number }[] = [];
for (const [a, b, ci, ni] of net.edges) {
  const name = net.names[ni] ?? "";
  if (!/^Avenida El Cerro|^El Cerro/.test(name)) continue;
  const pa = net.nodes[a], pb = net.nodes[b];
  const mid: [number, number] = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
  segs.push({ name, mid, dGate: haversine(mid, gate), dR1: haversine(mid, r1start) });
}
segs.sort((x, y) => x.dR1 - y.dR1);
console.log("tramos Av. El Cerro (más cercanos al inicio GPX r1):");
for (const s of segs.slice(0, 8)) console.log(`  ${s.name} · mid ${s.mid[0].toFixed(5)},${s.mid[1].toFixed(5)} · a gate: ${s.dGate.toFixed(0)} m · a r1: ${s.dR1.toFixed(0)} m`);

// estacionamientos ParqueMet y Acceso PdV Norte del grafo
for (const patron of [/^Estacionamientos ParqueMet/, /^Acceso Pedro de Valdivia Norte/, /^Parque Metropolitano Pedro de Valdivia/, /^Pedro de Valdivia Norte/]) {
  const found: string[] = [];
  for (const [a, b, ci, ni] of net.edges) {
    const name = net.names[ni] ?? "";
    if (!patron.test(name)) continue;
    const pa = net.nodes[a], pb = net.nodes[b];
    const mid: [number, number] = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
    found.push(`${name} (${net.classes[ci]}) mid ${mid[0].toFixed(5)},${mid[1].toFixed(5)} · a r1: ${haversine(mid, r1start).toFixed(0)} m`);
  }
  console.log(patron.source, "→", found.length ? found.slice(0, 4).join("\n   ") : "(nada)");
}
