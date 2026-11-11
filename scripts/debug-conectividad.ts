// ¿El ascenso sin nombre (footway ≤55 m del track r2) está conectado a la puerta Pío Nono?
const realFetch = globalThis.fetch;
globalThis.fetch = ((u: string, ...a: any[]) => realFetch(new URL(u, "http://localhost:3000"), ...a)) as typeof fetch;
import { loadNetwork, haversineM } from "../src/lib/routing";
import { PAV_DEST_OPTS, enCorredorPav } from "../src/lib/routingService";
import { NAV_DESTINATIONS } from "../src/lib/park";

async function main() {
  const net = await loadNetwork();
  if (!net) return;
  const gate = { lat: -33.430691, lon: -70.63592 };
  const plaza = NAV_DESTINATIONS.find((x) => x.id === "plaza-mexico")!.position;

  // nodos "de la puerta" (≤60 m) y "de la plaza" (≤60 m)
  const cerca = (p: { lat: number; lon: number }, r: number) => {
    const out: number[] = [];
    for (let i = 0; i < net.nodes.length; i++) if (haversineM({ lat: net.nodes[i][0], lon: net.nodes[i][1] }, p) <= r) out.push(i);
    return out;
  };
  const nodosPuerta = cerca(gate, 70);
  const nodosPlaza = cerca(plaza, 70);
  console.log("nodos puerta:", nodosPuerta.length, "· nodos plaza:", nodosPlaza.length);

  // BFS desde todos los nodos puerta usando SOLO aristas que pasan PAV_DEST_OPTS (+nodeOk parque aproximado)
  const inside = (lat: number, lon: number) => true; // para diagnóstico: sin límite de parque
  const pasa = (u: number, e: any) => {
    const [nlat, nlon] = net.nodes[e.to];
    const [ulat, ulon] = net.nodes[u];
    return (PAV_DEST_OPTS.nameBlock ?? []).every((re) => !re.test(e.name)) &&
      (PAV_DEST_OPTS.allowedCls!.has(e.cls) || (PAV_DEST_OPTS.nameAllow ?? []).some((re) => re.test(e.name)) ||
        PAV_DEST_OPTS.edgeOk!((ulat + nlat) / 2, (ulon + nlon) / 2, e.cls, e.name));
  };
  const seen = new Set(nodosPuerta);
  const cola = [...nodosPuerta];
  while (cola.length) {
    const u = cola.shift()!;
    for (const e of net.adj[u]) {
      if (seen.has(e.to)) continue;
      if (!pasa(u, e)) continue;
      seen.add(e.to);
      cola.push(e.to);
    }
  }
  const alcanzadasPlaza = nodosPlaza.filter((n) => seen.has(n));
  console.log("con BFS con filtros: nodos alcanzados:", seen.size, "· nodos plaza alcanzados:", alcanzadasPlaza.length, "/", nodosPlaza.length);

  // la cadena sin nombre del ascenso: ¿a qué componente pertenece?
  // BFS completo del grafo (sin filtros) para etiquetar componentes
  const comp = new Int32Array(net.nodes.length).fill(-1);
  let nc = 0;
  for (let i = 0; i < net.nodes.length; i++) {
    if (comp[i] >= 0) continue;
    const cola2 = [i]; comp[i] = nc;
    while (cola2.length) {
      const u = cola2.pop()!;
      for (const e of net.adj[u]) if (comp[e.to] < 0) { comp[e.to] = nc; cola2.push(e.to); }
    }
    nc++;
  }
  const compsPuerta = new Set(nodosPuerta.map((n) => comp[n]));
  const compsPlaza = new Set(nodosPlaza.map((n) => comp[n]));
  console.log("componentes de nodos puerta:", [...compsPuerta], "· de plaza:", [...compsPlaza], "· total componentes grafo:", nc);

  // aristas del ascenso (footway sin nombre ≤55 m del track) — componente dominante
  const mod = await import("../src/lib/rutasTrazados");
  const track = mod.RUTAS_TRAZADOS["r2"].coords;
  const compAscenso = new Map<number, number>();
  for (const [a, b, ci, ni] of net.edges) {
    const cls = net.classes[ci];
    if (cls !== "footway" || (net.names[ni] ?? "") !== "") continue;
    const pa = { lat: net.nodes[a][0], lon: net.nodes[a][1] };
    const pb = { lat: net.nodes[b][0], lon: net.nodes[b][1] };
    const mid = { lat: (pa.lat + pb.lat) / 2, lon: (pa.lon + pb.lon) / 2 };
    for (let i = 0; i < track.length; i += 2) {
      if (haversineM(mid, { lat: track[i][0], lon: track[i][1] }) <= 55) {
        compAscenso.set(comp[a], (compAscenso.get(comp[a]) ?? 0) + 1);
        compAscenso.set(comp[b], (compAscenso.get(comp[b]) ?? 0) + 1);
        break;
      }
    }
  }
  console.log("componentes de aristas footway sin nombre en corredor:", [...compAscenso.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6));
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
