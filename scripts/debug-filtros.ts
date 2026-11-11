// ¿Qué aristas del ascenso Pío Nono→Plaza México pasan PAV_DEST_OPTS?
const realFetch = globalThis.fetch;
globalThis.fetch = ((u: string, ...a: any[]) => realFetch(new URL(u, "http://localhost:3000"), ...a)) as typeof fetch;
import { loadNetwork, findRoute, haversineM } from "../src/lib/routing";
import { PAV_DEST_OPTS } from "../src/lib/routingService";
import { NAV_DESTINATIONS } from "../src/lib/park";

async function main() {
  const net = await loadNetwork();
  if (!net) return;
  const gate = { lat: -33.430691, lon: -70.63592 };
  const plaza = NAV_DESTINATIONS.find((x) => x.id === "plaza-mexico")!.position;

  // ruta con PAV_DEST_OPTS real (con corredor)
  const r = findRoute(net, gate, plaza, PAV_DEST_OPTS);
  if (!r) { console.log("PAV_DEST_OPTS: SIN RUTA"); }
  else {
    console.log(`PAV_DEST_OPTS: ${(r.distanceM / 1000).toFixed(2)} km`);
    const orden: string[] = [];
    for (const nm of r.segNames) { const n = nm || "(sin nombre)"; if (orden[orden.length - 1] !== n) orden.push(n); }
    console.log("   ", orden.join(" → "));
  }

  // aristas dentro del corredor r2 (≤55 m del track) entre gate y plaza:
  // ¿qué clase/nombre tienen y pasan edgePasses?
  // track r2 directamente del JSON compilado del cliente:
  const mod = await import("../src/lib/rutasTrazados");
  const track = mod.RUTAS_TRAZADOS["r2"].coords;
  const porTipo = new Map<string, { n: number; ok: number }>();
  for (const [a, b, ci, ni] of net.edges) {
    const pa = { lat: net.nodes[a][0], lon: net.nodes[a][1] };
    const pb = { lat: net.nodes[b][0], lon: net.nodes[b][1] };
    const mid = { lat: (pa.lat + pb.lat) / 2, lon: (pa.lon + pb.lon) / 2 };
    // solo tramo gate→plaza: dentro de 200 m de la recta aproximada por puntos del track
    let cerca = false;
    for (let i = 0; i < track.length && !cerca; i += 2) {
      const t = { lat: track[i][0], lon: track[i][1] };
      if (haversineM(mid, t) <= 55) cerca = true;
    }
    if (!cerca) continue;
    const cls = net.classes[ci], name = net.names[ni] ?? "";
    const k = `${cls} | ${name || "(sin nombre)"}`;
    const e = porTipo.get(k) ?? { n: 0, ok: 0 };
    e.n++;
    // edgePasses con midpoint
    const passed = (PAV_DEST_OPTS.nameBlock ?? []).every((re) => !re.test(name)) &&
      (PAV_DEST_OPTS.allowedCls!.has(cls) || (PAV_DEST_OPTS.nameAllow ?? []).some((re) => re.test(name)) || PAV_DEST_OPTS.edgeOk!(mid.lat, mid.lon, cls, name));
    if (passed) e.ok++;
    porTipo.set(k, e);
  }
  console.log("\naristas ≤55 m del track r2 (gate→plaza): clase | nombre: total, pasan filtro");
  for (const [k, v] of [...porTipo.entries()].sort((x, y) => y[1].n - x[1].n)) console.log(`  ${String(v.n).padStart(3)} → ${String(v.ok).padStart(3)}   ${k}`);
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
