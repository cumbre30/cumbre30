// ¿Dónde conectan / se acercan Av. Alberto Mackenna y Av. Pedro Bannen
// dentro del grafo? Busca nodos compartidos y pares a <40 m.
const realFetch = globalThis.fetch;
globalThis.fetch = ((url: string, ...a: any[]) => realFetch(new URL(String(url), "http://localhost:3000"), ...a)) as typeof fetch;
import { loadNetwork, haversineM } from "../src/lib/routing";

async function main() {
  const net = await loadNetwork();
  if (!net) throw new Error("sin red");
  const mackNodes = new Set<number>();
  const bannenNodes = new Set<number>();
  for (const [a, b, , ni] of net.edges) {
    const nm = net.names[ni] ?? "";
    if (nm === "Avenida Alberto Mackenna") { mackNodes.add(a); mackNodes.add(b); }
    else if (nm === "Avenida Pedro Bannen") { bannenNodes.add(a); bannenNodes.add(b); }
  }
  console.log("nodos mack:", mackNodes.size, "· bannen:", bannenNodes.size);
  const shared = [...mackNodes].filter((n) => bannenNodes.has(n));
  console.log("nodos COMPARTIDOS:", shared.length, shared.slice(0, 10).map((n) => `${net.nodes[n][0].toFixed(6)},${net.nodes[n][1].toFixed(6)}`).join(" | "));

  // pares cercanos (muestreo: mack x bannen, ambos ~400 nodos -> 160k pares ok)
  const cercanos: { m: number; b: number; d: number }[] = [];
  const bl = [...bannenNodes];
  for (const m of mackNodes) {
    const pm = net.nodes[m];
    for (const b of bl) {
      const pb = net.nodes[b];
      const dLat = Math.abs(pm[0] - pb[0]);
      const dLon = Math.abs(pm[1] - pb[1]);
      if (dLat > 0.0004 || dLon > 0.0005) continue;
      const d = haversineM({ lat: pm[0], lon: pm[1] }, { lat: pb[0], lon: pb[1] });
      if (d < 40) cercanos.push({ m, b, d });
    }
  }
  cercanos.sort((x, y) => x.d - y.d);
  console.log(`\npares mack-bannen a <40 m: ${cercanos.length}`);
  for (const c of cercanos.slice(0, 30)) {
    console.log(`  ${c.d.toFixed(1)} m · mack ${net.nodes[c.m][0].toFixed(6)},${net.nodes[c.m][1].toFixed(6)} · bannen ${net.nodes[c.b][0].toFixed(6)},${net.nodes[c.b][1].toFixed(6)}`);
  }

  // ¿Qué conectores (cualquier nombre, incluso sin nombre) unen un nodo de
  // Mackenna con uno de Bannen (1 salto)?
  const adjOf = (n: number) => (net.adj[n] ?? []);
  const conectores = new Map<string, number>();
  for (const m of mackNodes) {
    for (const e of adjOf(m)) {
      if (bannenNodes.has(e.to)) {
        const nm = e.name || "(sin nombre)";
        conectores.set(nm, (conectores.get(nm) ?? 0) + 1);
      }
    }
  }
  console.log("\nconectores directos mack→bannen (1 arista):");
  for (const [nm, k] of conectores) console.log(`  ${k}x · ${nm}`);
}
main();
