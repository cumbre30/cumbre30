// BFS con filtros desde el extremo superior de "Sendero de los Sentidos";
// lista las aristas de la frontera con motivo de bloqueo.
const realFetch = globalThis.fetch;
globalThis.fetch = ((u: string, ...a: any[]) => realFetch(new URL(u, "http://localhost:3000"), ...a)) as typeof fetch;
import { loadNetwork, haversineM } from "../src/lib/routing";
import { PAV_DEST_OPTS, corredorPav } from "../src/lib/routingService";

async function main() {
  const net = await loadNetwork();
  if (!net) return;
  corredorPav(net);

  // nodos extremos de cada segmento
  const nodosDe = (nombre: RegExp) => {
    const s = new Set<number>();
    for (const [a, b, , ni] of net.edges) if (nombre.test(net.names[ni] ?? "")) { s.add(a); s.add(b); }
    return [...s];
  };
  const sentidos = nodosDe(/^Paseo Metropolitano - Sendero de los Sentidos/);
  const terraza = nodosDe(/^Terraza Bellavista/);
  // extremo de Sentidos más cercano a Terraza y viceversa
  let sTop = sentidos[0], dMin = Infinity;
  for (const s of sentidos) for (const t of terraza) { const d = haversineM({ lat: net.nodes[s][0], lon: net.nodes[s][1] }, { lat: net.nodes[t][0], lon: net.nodes[t][1] }); if (d < dMin) { dMin = d; sTop = s; } }
  let tTop = terraza[0]; dMin = Infinity;
  for (const t of terraza) { const d = haversineM({ lat: net.nodes[t][0], lon: net.nodes[t][1] }, { lat: net.nodes[sTop][0], lon: net.nodes[sTop][1] }); if (d < dMin) { dMin = d; tTop = t; } }
  console.log(`extremo Sentidos: ${net.nodes[sTop]} · Terraza más cercano a ${net.nodes[tTop]} · distancia ${dMin.toFixed(0)} m`);

  // BFS con filtros desde sTop
  const pasa = (u: number, e: any) => {
    const [nlat, nlon] = net.nodes[e.to];
    const [ulat, ulon] = net.nodes[u];
    return (PAV_DEST_OPTS.nameBlock ?? []).every((re: RegExp) => !re.test(e.name)) &&
      (PAV_DEST_OPTS.allowedCls.has(e.cls) || (PAV_DEST_OPTS.nameAllow ?? []).some((re: RegExp) => re.test(e.name)) ||
        PAV_DEST_OPTS.edgeOk!((ulat + nlat) / 2, (ulon + nlon) / 2, e.cls, e.name));
  };
  const seen = new Set([sTop]);
  const cola = [sTop];
  let alcanzatTop = false;
  while (cola.length) {
    const u = cola.shift()!;
    if (u === tTop) { alcanzatTop = true; }
    for (const e of net.adj[u]) {
      if (seen.has(e.to)) continue;
      if (!pasa(u, e)) continue;
      seen.add(e.to); cola.push(e.to);
    }
  }
  console.log(`BFS con filtros desde extremo Sentidos: ${seen.size} nodos · ¿llega a Terraza? ${alcanzatTop ? "SÍ" : "NO"}`);

  // frontera: aristas que SALen de nodos vistos hacia no-vistos y fallan
  console.log("\naristas de frontera bloqueadas (hasta 25):");
  let mostradas = 0;
  for (const u of seen) {
    for (const e of net.adj[u]) {
      if (seen.has(e.to) || mostradas >= 25) continue;
      const [nlat, nlon] = net.nodes[e.to];
      const [ulat, ulon] = net.nodes[u];
      const mid = { lat: (ulat + nlat) / 2, lon: (ulon + nlon) / 2 };
      const bloqueName = (PAV_DEST_OPTS.nameBlock ?? []).some((re: RegExp) => re.test(e.name));
      const clsOk = PAV_DEST_OPTS.allowedCls.has(e.cls);
      const nameOk = (PAV_DEST_OPTS.nameAllow ?? []).some((re: RegExp) => re.test(e.name));
      const corOk = PAV_DEST_OPTS.edgeOk!(mid.lat, mid.lon, e.cls, e.name);
      const dist = haversineM(mid, { lat: net.nodes[tTop][0], lon: net.nodes[tTop][1] });
      if (dist > 250) continue;
      console.log(`  ${e.cls.padEnd(11)} "${(e.name || "(sin nombre)").padEnd(40)}" nameBlock=${bloqueName ? "SÍ" : "no"} cls=${clsOk} name=${nameOk} corredor=${corOk} · dist a Terraza ${dist.toFixed(0)}m`);
      mostradas++;
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
