// Nodos exactos para los 2 puentes del ascenso Pío Nono → Plaza México
const realFetch = globalThis.fetch;
globalThis.fetch = ((u: string, ...a: any[]) => realFetch(new URL(u, "http://localhost:3000"), ...a)) as typeof fetch;
import { loadNetwork, haversineM } from "../src/lib/routing";
import { PAV_DEST_OPTS, corredorPav } from "../src/lib/routingService";

async function main() {
  const net = await loadNetwork();
  if (!net) return;
  corredorPav(net);

  const nodosDe = (nombre: RegExp) => {
    const s = new Set<number>();
    for (const [a, b, , ni] of net.edges) if (nombre.test(net.names[ni] ?? "")) { s.add(a); s.add(b); }
    return [...s];
  };
  // puente 1: extremo del path bloqueado (mid -33.42778,-70.63425):
  // nodo en la parte alcanzable (Excursionista/Sentidos) ↔ nodo en la isla Terraza
  const exc = nodosDe(/^Sendero El Excursionista/);
  const terraza = nodosDe(/^Terraza Bellavista/);
  const pasa = (u: number, e: any) => {
    const [nlat, nlon] = net.nodes[e.to];
    const [ulat, ulon] = net.nodes[u];
    return (PAV_DEST_OPTS.nameBlock ?? []).every((re: RegExp) => !re.test(e.name)) &&
      (PAV_DEST_OPTS.allowedCls.has(e.cls) || (PAV_DEST_OPTS.nameAllow ?? []).some((re: RegExp) => re.test(e.name)) ||
        PAV_DEST_OPTS.edgeOk!((ulat + nlat) / 2, (ulon + nlon) / 2, e.cls, e.name));
  };
  const seen = new Set(exc);
  const cola = [...exc];
  while (cola.length) {
    const u = cola.shift()!;
    for (const e of net.adj[u]) {
      if (seen.has(e.to)) continue;
      if (!pasa(u, e)) continue;
      seen.add(e.to); cola.push(e.to);
    }
  }
  // extremos del path bloqueado más cercano a Terraza
  let mejor: { a: number; b: number; d: number } | null = null;
  for (const [a, b, ci, ni] of net.edges) {
    if (net.classes[ci] !== "path" || (net.names[ni] ?? "") !== "") continue;
    if (!seen.has(a) && !seen.has(b)) continue;
    const otro = seen.has(a) ? b : a;
    let dMin = Infinity;
    for (const n of terraza) dMin = Math.min(dMin, haversineM({ lat: net.nodes[otro][0], lon: net.nodes[otro][1] }, { lat: net.nodes[n][0], lon: net.nodes[n][1] }));
    if (!mejor || dMin < mejor.d) mejor = { a: seen.has(a) ? a : b, b: otro, d: dMin };
  }
  if (mejor) {
    const pa: [number, number] = [net.nodes[mejor.a][0], net.nodes[mejor.a][1]];
    const pb: [number, number] = [net.nodes[mejor.b][0], net.nodes[mejor.b][1]];
    console.log(`puente 1 (alcanzado → isla Terraza): A ${pa[0].toFixed(5)},${pa[1].toFixed(5)} ↔ B ${pb[0].toFixed(5)},${pb[1].toFixed(5)} (B a ${mejor.d.toFixed(0)} m de Terraza)`);
  }

  // puente 2: Terraza (norte) ↔ Explanada (sur)
  const expl = nodosDe(/^Explanada$/);
  let m2: { a: number; b: number; d: number } | null = null;
  for (const t of terraza) for (const e of expl) {
    const d = haversineM({ lat: net.nodes[t][0], lon: net.nodes[t][1] }, { lat: net.nodes[e][0], lon: net.nodes[e][1] });
    if (!m2 || d < m2.d) m2 = { a: t, b: e, d };
  }
  if (m2) {
    const pa: [number, number] = [net.nodes[m2.a][0], net.nodes[m2.a][1]];
    const pb: [number, number] = [net.nodes[m2.b][0], net.nodes[m2.b][1]];
    console.log(`puente 2 (Terraza ↔ Explanada): A ${pa[0].toFixed(5)},${pa[1].toFixed(5)} ↔ B ${pb[0].toFixed(5)},${pb[1].toFixed(5)} · dist ${m2.d.toFixed(0)} m`);
  }
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
