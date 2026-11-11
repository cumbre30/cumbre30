// Extremos del puente largo: Excursionista (extremo superior) ↔ Terraza (extremo sur)
const realFetch = globalThis.fetch;
globalThis.fetch = ((u: string, ...a: any[]) => realFetch(new URL(u, "http://localhost:3000"), ...a)) as typeof fetch;
import { loadNetwork, haversineM } from "../src/lib/routing";
import { corredorPav, corredorOk } from "../src/lib/routingService";

async function main() {
  const net = await loadNetwork();
  if (!net) return;
  corredorPav(net);
  const nodosDe = (nombre: RegExp) => {
    const s = new Set<number>();
    for (const [a, b, , ni] of net.edges) if (nombre.test(net.names[ni] ?? "")) { s.add(a); s.add(b); }
    return [...s];
  };
  const exc = nodosDe(/^Sendero El Excursionista/);
  const terraza = nodosDe(/^Terraza Bellavista/);
  // Excursionista: nodos alcanzados con filtros desde Sentidos (todo comp 0 pero
  // verificar con corredorOk) — usamos directamente los extremos geométricos
  let m: { a: number; b: number; d: number } | null = null;
  for (const a of exc) for (const b of terraza) {
    const d = haversineM({ lat: net.nodes[a][0], lon: net.nodes[a][1] }, { lat: net.nodes[b][0], lon: net.nodes[b][1] });
    if (!m || d < m.d) m = { a, b, d };
  }
  if (!m) return;
  const pa: [number, number] = [net.nodes[m.a][0], net.nodes[m.a][1]];
  const pb: [number, number] = [net.nodes[m.b][0], net.nodes[m.b][1]];
  console.log(`puente largo: A(excursionista) ${pa[0].toFixed(5)},${pa[1].toFixed(5)} ↔ B(terraza) ${pb[0].toFixed(5)},${pb[1].toFixed(5)} · dist ${m.d.toFixed(0)} m`);

  // ¿los nodos A y B pasan los filtros como extremos? (anchor con edgePasses vía
  // corredorOk sobre sus coords)
  console.log("A corredorOk:", corredorOk(pa[0], pa[1], "footway", ""), "· B corredorOk:", corredorOk(pb[0], pb[1], "footway", ""));

  // bbox de los tramos path/footway sin nombre entre A y B (para el comentario)
  const entre = new Map<string, number>();
  for (const [a2, b2, ci, ni] of net.edges) {
    const cls = net.classes[ci], name = net.names[ni] ?? "";
    const pa2 = net.nodes[a2], pb2 = net.nodes[b2];
    const mid = [(pa2[0] + pb2[0]) / 2, (pa2[1] + pb2[1]) / 2] as [number, number];
    if (mid[0] > Math.max(pa[0], pb[0]) || mid[0] < Math.min(pa[0], pb[0]) - 0.002) continue;
    if (mid[1] > Math.max(pa[1], pb[1]) + 0.002 || mid[1] < Math.min(pa[1], pb[1]) - 0.002) continue;
    const k = `${cls} | ${name || "(sin nombre)"}`;
    entre.set(k, (entre.get(k) ?? 0) + 1);
  }
  console.log("aristas en la zona del puente:", [...entre.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8));
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
