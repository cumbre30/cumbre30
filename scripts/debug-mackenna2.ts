// Punto exacto donde la ruta Pío Nono → Plaza México cambia de Av.
// Alberto Mackenna a Av. Pedro Bannen, y contexto alrededor (¿es el
// puente entre las Bannen paralelas en Tupahue?).
// Ejecutar: node_modules/.bin/tsx scripts/debug-mackenna2.ts
const realFetch = globalThis.fetch;
globalThis.fetch = ((url: string, ...a: any[]) => realFetch(new URL(String(url), "http://localhost:3000"), ...a)) as typeof fetch;

import { findRoute, haversineM, loadNetwork, type LatLng } from "../src/lib/routing";
import { GATES } from "../src/lib/park";
import { PAV_DEST_OPTS } from "../src/lib/routingService";

async function main() {
  const net = await loadNetwork();
  if (!net) throw new Error("sin red");
  const pio = GATES.find((g) => g.id === "pio-nono")!.position;
  const plaza = { lat: -33.4234, lon: -70.6327 };

  const r = findRoute(net, pio, plaza, PAV_DEST_OPTS)!;
  const names = r.segNames!;
  let idx = -1;
  for (let i = 0; i < names.length - 1; i++) {
    if (names[i].includes("Alberto Mackenna") && names[i + 1].includes("Pedro Bannen")) { idx = i; break; }
  }
  console.log("transición Mackenna→Bannen en idx", idx, "de", names.length);
  const pA = r.coords[idx];
  const pB = r.coords[idx + 1];
  console.log("coords transición:", pA, "→", pB);
  console.log("dist a Plaza México:", Math.round(haversineM(pA, plaza)), "m");
  console.log("dist a Acceso Pío Nono:", Math.round(haversineM(pA, pio)), "m");

  // aristas con nombre alrededor del punto de transición (radio 120 m)
  const cerca: { name: string; cls: string; d: number; mid: LatLng }[] = [];
  for (const [a, b, ci, ni] of net.edges) {
    const nm = net.names[ni] ?? "";
    const cls = net.classes[ci];
    const pa = net.nodes[a], pb = net.nodes[b];
    const mid = { lat: (pa[0] + pb[0]) / 2, lon: (pa[1] + pb[1]) / 2 };
    const d = haversineM(pA, mid);
    if (d <= 150 && nm) cerca.push({ name: nm, cls, d: Math.round(d), mid });
  }
  cerca.sort((x, y) => x.d - y.d);
  console.log("\naristas nombradas a ≤150 m de la transición:");
  for (const c of cerca.slice(0, 25)) console.log(`  ${c.d} m · [${c.cls}] ${c.name} · ${c.mid.lat.toFixed(6)},${c.mid.lon.toFixed(6)}`);

  // ¿dónde está "Acceso sector Tupahue"?
  const tupEdges: { mid: LatLng; nm: string }[] = [];
  for (const [a, b, , ni] of net.edges) {
    const nm = net.names[ni] ?? "";
    if (/Acceso sector Tupahue|Anáhuac/.test(nm)) {
      const pa = net.nodes[a], pb = net.nodes[b];
      tupEdges.push({ mid: { lat: (pa[0] + pb[0]) / 2, lon: (pa[1] + pb[1]) / 2 }, nm });
    }
  }
  console.log("\naristas 'Acceso sector Tupahue'/'Anáhuac':");
  for (const t of tupEdges) console.log(`  ${t.nm} · ${t.mid.lat.toFixed(6)},${t.mid.lon.toFixed(6)} · d a transición ${Math.round(haversineM(pA, t.mid))} m`);

  // segmentos de Bannen: imprimir todos los nodos extremos ordenados por lat
  // para detectar las DOS cadenas paralelas
  const bannenNodes = new Map<number, [number, number]>();
  for (const [a, b, , ni] of net.edges) {
    if ((net.names[ni] ?? "") === "Avenida Pedro Bannen") {
      bannenNodes.set(a, net.nodes[a]);
      bannenNodes.set(b, net.nodes[b]);
    }
  }
  const ns = [...bannenNodes.values()].sort((p, q) => p[0] - q[0]);
  console.log(`\nnodos Bannen únicos: ${ns.length}`);
  console.log("primeros 6 (sur):", ns.slice(0, 6).map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(" | "));
  console.log("últimos 6 (norte):", ns.slice(-6).map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(" | "));
}
main();
