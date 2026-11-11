// Frontera ampliada: aristas bloqueadas vistas→no-vistas cerca del corredor del ascenso
const realFetch = globalThis.fetch;
globalThis.fetch = ((u: string, ...a: any[]) => realFetch(new URL(u, "http://localhost:3000"), ...a)) as typeof fetch;
import { loadNetwork, haversineM } from "../src/lib/routing";
import { PAV_DEST_OPTS, corredorPav } from "../src/lib/routingService";
import { NAV_DESTINATIONS } from "../src/lib/park";

async function main() {
  const net = await loadNetwork();
  if (!net) return;
  corredorPav(net);
  const terraza = { lat: -33.426573, lon: -70.633746 };

  const nodosDe = (nombre: RegExp) => {
    const s = new Set<number>();
    for (const [a, b, , ni] of net.edges) if (nombre.test(net.names[ni] ?? "")) { s.add(a); s.add(b); }
    return [...s];
  };
  // BFS desde TODOS los nodos de Sentidos y El Excursionista (parte baja alcanzable)
  const semillas = [...nodosDe(/^Paseo Metropolitano - Sendero de los Sentidos/), ...nodosDe(/^Sendero El Excursionista/)];
  const pasa = (u: number, e: any) => {
    const [nlat, nlon] = net.nodes[e.to];
    const [ulat, ulon] = net.nodes[u];
    return (PAV_DEST_OPTS.nameBlock ?? []).every((re: RegExp) => !re.test(e.name)) &&
      (PAV_DEST_OPTS.allowedCls.has(e.cls) || (PAV_DEST_OPTS.nameAllow ?? []).some((re: RegExp) => re.test(e.name)) ||
        PAV_DEST_OPTS.edgeOk!((ulat + nlat) / 2, (ulon + nlon) / 2, e.cls, e.name));
  };
  const seen = new Set(semillas);
  const cola = [...semillas];
  while (cola.length) {
    const u = cola.shift()!;
    for (const e of net.adj[u]) {
      if (seen.has(e.to)) continue;
      if (!pasa(u, e)) continue;
      seen.add(e.to); cola.push(e.to);
    }
  }
  const terrazaNodos = nodosDe(/^Terraza Bellavista/);
  const llega = terrazaNodos.some((n) => seen.has(n));
  console.log(`BFS: ${seen.size} nodos · ¿llega a Terraza? ${llega ? "SÍ" : "NO"}`);

  // aristas bloqueadas desde nodos vistos, con distancia mínima al nodo Terraza más cercano
  const filas: { cls: string; name: string; d: number; bloque: string; midLat: number; midLon: number }[] = [];
  for (const u of seen) {
    for (const e of net.adj[u]) {
      if (seen.has(e.to)) continue;
      const [nlat, nlon] = net.nodes[e.to];
      const [ulat, ulon] = net.nodes[u];
      const mid = { lat: (ulat + nlat) / 2, lon: (ulon + nlon) / 2 };
      let dMin = Infinity;
      for (const n of terrazaNodos) dMin = Math.min(dMin, haversineM(mid, { lat: net.nodes[n][0], lon: net.nodes[n][1] }));
      if (dMin > 600) continue;
      const bloqueName = (PAV_DEST_OPTS.nameBlock ?? []).some((re: RegExp) => re.test(e.name));
      const clsOk = PAV_DEST_OPTS.allowedCls.has(e.cls);
      const nameOk = (PAV_DEST_OPTS.nameAllow ?? []).some((re: RegExp) => re.test(e.name));
      const corOk = PAV_DEST_OPTS.edgeOk!(mid.lat, mid.lon, e.cls, e.name);
      const motivo = bloqueName ? "nameBlock" : !clsOk && !nameOk && !corOk ? "clase+corredor" : "?";
      filas.push({ cls: e.cls, name: e.name || "(sin nombre)", d: dMin, bloque: motivo, midLat: mid.lat, midLon: mid.lon });
    }
  }
  filas.sort((x, y) => x.d - y.d);
  console.log("aristas bloqueadas (frontera), por cercanía a Terraza:");
  for (const f of filas.slice(0, 20)) console.log(`  ${f.cls.padEnd(11)} "${f.name.padEnd(35)}" motivo=${f.bloque.padEnd(14)} aTerraza=${f.d.toFixed(0)}m  mid=${f.midLat.toFixed(5)},${f.midLon.toFixed(5)}`);
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
