import { readFileSync } from "node:fs";
import { findRoute, haversineM, type Network, type NetNode, type NetEdge } from "../src/lib/routing";
import { crearDirOk, debugDirOk, GATE_PIO_NONO, PUENTE_TUPAHUE_CUMBRE } from "../src/lib/reglasParque";
const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as { classes: string[]; names: string[]; nodes: NetNode[]; edges: NetEdge[]; cicloviaPolylines: number[][] };
const PENALTY: Record<string, number> = { cycleway: 0.65, path: 0.9, footway: 1.35, pedestrian: 1.1, track: 1.0, living_street: 0.95, residential: 0.95, service: 1.05, unclassified: 1.0, tertiary: 1.15, tertiary_link: 1.2, secondary: 1.5, secondary_link: 1.5, primary: 2.4, primary_link: 2.4 };
const adj: Network["adj"] = raw.nodes.map(() => []);
for (const [a, b, clsIdx, nameIdx, ciclo] of raw.edges) {
  const cls = raw.classes[clsIdx] ?? "residential";
  const name = raw.names[nameIdx] ?? "";
  const p = PENALTY[cls] ?? 1;
  const pa = { lat: raw.nodes[a][0], lon: raw.nodes[a][1] };
  const pb = { lat: raw.nodes[b][0], lon: raw.nodes[b][1] };
  const dist = haversineM(pa, pb);
  adj[a].push({ to: b, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: 0 });
  adj[b].push({ to: a, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: 0 });
}
const net: Network = { ...raw, adj };
const PAV = {
  allowedCls: new Set(["living_street", "residential", "service", "unclassified", "tertiary", "tertiary_link", "secondary", "secondary_link", "primary", "primary_link"]),
  nameAllow: [/^Paseo Metropolitano/, /^Avenida /, /^Camino /, /^Antilen$/, /^Rotonda /, /^Terraza Bellavista/, /^Explanada$/, /^Paseo Peatonal Cumbre/],
  nameBlock: [/^Sendero Ciclista /, /^Avenida Carlos Reed/, /^Carlos Reed/],
};
const CORTE = process.env.CORTE === "1";
const dirOk = crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: CORTE });
const nodoDe = (lat: number, lon: number) => {
  let bi = -1, bd = Infinity;
  for (let i = 0; i < raw.nodes.length; i++) {
    const d = haversineM({ lat: raw.nodes[i][0], lon: raw.nodes[i][1] }, { lat, lon });
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
};
const ideal = findRoute(net, GATE_PIO_NONO, PUENTE_TUPAHUE_CUMBRE, PAV);
console.log(`Ideal gate→puente sin dirOk: ${ideal ? (ideal.distanceM / 1000).toFixed(2) + " km" : "null"}`);
if (ideal) {
  const nombres = new Map<string, number>();
  for (const n of ideal.segNames) nombres.set(n, (nombres.get(n) ?? 0) + 1);
  console.log("  vía:", [...nombres.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([n, c]) => `${n}×${c}`).join(" · "));
  let bloqueos = 0;
  for (let i = 0; i < ideal.coords.length - 1; i++) {
    const a = ideal.coords[i], b = ideal.coords[i + 1];
    const u = nodoDe(a.lat, a.lon), v = nodoDe(b.lat, b.lon);
    const nm = ideal.segNames[i] ?? "";
    if (!dirOk(u, v, a.lat, a.lon, b.lat, b.lon, "residential", nm)) {
      bloqueos++;
      if (bloqueos <= 8) {
        console.log(`  BLOQUEO tramo ${i}: (${a.lat.toFixed(5)},${a.lon.toFixed(5)}) → (${b.lat.toFixed(5)},${b.lon.toFixed(5)}) · "${nm}"`);
        console.log(`    ${debugDirOk(net, { pioNonoSoloSubida: true, corteCumbre: CORTE }, u, v, a.lat, a.lon, b.lat, b.lon, "residential", nm)}`);
      }
    }
  }
  console.log(`  bloqueos en la ruta ideal: ${bloqueos} de ${ideal.coords.length - 1}`);
}
