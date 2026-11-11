// Recorre el track r2 (gate→plaza) y lista las aristas del grafo a ≤25 m
// por tramo, con resultado del filtro — para ver dónde se corta la cadena.
const realFetch = globalThis.fetch;
globalThis.fetch = ((u: string, ...a: any[]) => realFetch(new URL(u, "http://localhost:3000"), ...a)) as typeof fetch;
import { loadNetwork, haversineM } from "../src/lib/routing";
import { PAV_DEST_OPTS, corredorOk } from "../src/lib/routingService";
import { NAV_DESTINATIONS } from "../src/lib/park";

function distToSeg(p: { lat: number; lon: number }, a: [number, number], b: [number, number]): number {
  const kx = Math.cos((p.lat * Math.PI) / 180);
  const px = p.lon * kx, py = p.lat;
  const ax = a[1] * kx, ay = a[0], bx = b[1] * kx, by = b[0];
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320;
}

function pasa(opts: any, cls: string, name: string, mid: { lat: number; lon: number }): boolean {
  if ((opts.nameBlock ?? []).some((re: RegExp) => re.test(name))) return false;
  if (opts.allowedCls.has(cls) || (opts.nameAllow ?? []).some((re: RegExp) => re.test(name))) return true;
  return corredorOk(mid.lat, mid.lon, cls);
}

async function main() {
  const net = await loadNetwork();
  if (!net) return;
  const gate = { lat: -33.430691, lon: -70.63592 };
  const plaza = NAV_DESTINATIONS.find((x) => x.id === "plaza-mexico")!.position;
  const track = (await import("../src/lib/rutasTrazados")).RUTAS_TRAZADOS["r2"].coords
    .map(([lat, lon]) => ({ lat, lon }));

  // solo la parte gate→plaza: puntos del track hasta ~900 m acumulados
  let acum = 0;
  const tramo: typeof track = [track[0]];
  for (let i = 1; i < track.length; i++) {
    acum += haversineM(track[i - 1], track[i]);
    tramo.push(track[i]);
    if (acum > 950) break;
  }
  console.log(`track gate→plaza: ${tramo.length} pts, ${acum.toFixed(0)} m`);

  // aristas cerca del tramo
  const filas: { km: number; cls: string; name: string; ok: boolean; dSeg: number }[] = [];
  for (const [a, b, ci, ni] of net.edges) {
    const pa = net.nodes[a], pb = net.nodes[b];
    const mid = { lat: (pa[0] + pb[0]) / 2, lon: (pa[1] + pb[1]) / 2 };
    // distancia del mid a la POLILÍNEA del tramo + km a lo largo
    let best = Infinity, bestKm = 0;
    let acc = 0;
    for (let i = 1; i < tramo.length; i++) {
      const d = distToSeg(mid, [tramo[i - 1].lat, tramo[i - 1].lon], [tramo[i].lat, tramo[i].lon]);
      if (d < best) { best = d; bestKm = acc + haversineM(tramo[i - 1], tramo[i]) / 2; }
      acc += haversineM(tramo[i - 1], tramo[i]);
    }
    if (best > 25) continue;
    const cls = net.classes[ci], name = net.names[ni] ?? "";
    filas.push({ km: bestKm, cls, name, ok: pasa(PAV_DEST_OPTS, cls, name, mid), dSeg: best });
  }
  filas.sort((x, y) => x.km - y.km);
  console.log("km | clase | nombre | pasa | dist");
  let lastKm = -1;
  for (const f of filas) {
    console.log(`${f.km.toFixed(2).padStart(6)}  ${f.cls.padEnd(12)} ${(f.name || "(sin nombre)").padEnd(45)} ${f.ok ? "✓" : "✗ BLOQUEADA"}  ${f.dSeg.toFixed(0)}m`);
  }
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
