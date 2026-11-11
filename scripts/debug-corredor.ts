// Corredor amplio gate→plaza: todos los nombres a ≤260 m + ruta bloqueando solo senderos nombrados
const realFetch = globalThis.fetch;
globalThis.fetch = ((u: string, ...a: any[]) => realFetch(new URL(u, "http://localhost:3000"), ...a)) as typeof fetch;
import { loadNetwork, findRoute, haversineM, type LatLng } from "../src/lib/routing";
import { NAV_DESTINATIONS } from "../src/lib/park";

function distToSeg(p: LatLng, a: LatLng, b: LatLng): number {
  const kx = Math.cos((p.lat * Math.PI) / 180);
  const px = p.lon * kx, py = p.lat;
  const ax = a.lon * kx, ay = a.lat, bx = b.lon * kx, by = b.lat;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320;
}

async function main() {
  const net = await loadNetwork();
  if (!net) return;
  const gate: LatLng = { lat: -33.430691, lon: -70.63592 };
  const plaza = NAV_DESTINATIONS.find((d) => d.id === "plaza-mexico")!.position;

  console.log("== nombres a ≤260 m de la recta gate→plaza ==");
  const vistos = new Map<string, number>();
  for (const [a, b, ci, ni] of net.edges) {
    const pa = { lat: net.nodes[a][0], lon: net.nodes[a][1] };
    const pb = { lat: net.nodes[b][0], lon: net.nodes[b][1] };
    if (Math.min(distToSeg(pa, gate, plaza), distToSeg(pb, gate, plaza)) > 260) continue;
    const key = `${net.classes[ci]} | ${net.names[ni] || "(sin nombre)"}`;
    vistos.set(key, (vistos.get(key) ?? 0) + 1);
  }
  for (const [k, v] of [...vistos.entries()].sort((x, y) => y[1] - x[1])) console.log(`  ${String(v).padStart(3)} ${k}`);

  // ruta bloqueando SOLO senderos peatonales nombrados
  const r = findRoute(net, gate, plaza, {
    nameBlock: [/^Sendero (?!Ciclista)/, /^Ruta Nativa/, /^vereda$/i, /^sendero$/i, /^Camino Siete Palabras/, /^Sendero Universal/],
  });
  if (!r) { console.log("\n[bloqueo nombrados] SIN RUTA"); return; }
  console.log(`\n[bloqueo nombrados] ${(r.distanceM / 1000).toFixed(2)} km`);
  const porNombre = new Map<string, [number, string]>();
  const orden: string[] = [];
  for (let i = 0; i < r.segNames.length; i++) {
    const nm = r.segNames[i] || "(sin nombre)";
    if (!porNombre.has(nm)) { porNombre.set(nm, [0, net.classes[0]]); orden.push(nm); }
  }
  for (const nm of orden) console.log("   ·", nm);
  // clases de los tramos sin nombre
  const clsSinNombre = new Map<string, number>();
  for (let i = 0; i < r.segNames.length; i++) {
    if (r.segNames[i]) continue;
    const cl = (net as any).classes ? "?" : "?";
    // routing.ts no expone clase en segNames; usar longitud
  }
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
