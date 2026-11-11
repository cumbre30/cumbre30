// Debug: ¿cómo se llama el camino directo Acceso Pío Nono → Plaza México?
// Lista aristas cercanas a la línea recta y prueba findRoute con distintos filtros.
// Ejecutar: node_modules/.bin/tsx scripts/debug-pio-nono-plaza.ts
const realFetch = globalThis.fetch;
globalThis.fetch = ((url: string, ...a: any[]) => realFetch(new URL(url, "http://localhost:3000"), ...a)) as typeof fetch;

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
  if (!net) { console.log("sin red"); return; }
  const gate: LatLng = { lat: -33.430691, lon: -70.63592 }; // Acceso Pío Nono
  const plaza = NAV_DESTINATIONS.find((d) => d.id === "plaza-mexico")!.position;

  // 1) aristas a ≤140 m de la línea recta gate→plaza, con clase y nombre
  console.log("== aristas a ≤140 m de la recta Acceso Pío Nono → Plaza México ==");
  const vistos = new Map<string, number>();
  for (const [a, b, ci, ni] of net.edges) {
    const pa = { lat: net.nodes[a][0], lon: net.nodes[a][1] };
    const pb = { lat: net.nodes[b][0], lon: net.nodes[b][1] };
    const d = Math.min(distToSeg(pa, gate, plaza), distToSeg(pb, gate, plaza));
    if (d > 140) continue;
    const key = `${net.classes[ci]} | ${net.names[ni] || "(sin nombre)"}`;
    vistos.set(key, (vistos.get(key) ?? 0) + 1);
  }
  for (const [k, v] of [...vistos.entries()].sort((x, y) => y[1] - x[1]).slice(0, 14)) console.log(`  ${String(v).padStart(3)} ${k}`);

  // 2) findRoute con distintos filtros: secuencia nombre+clase con metros
  const filtros: [string, any][] = [
    ["sin filtro", undefined],
    ["solo nodeOk", {}],
    ["PAV (estricto)", { allowedCls: new Set(["living_street","residential","service","unclassified","tertiary","tertiary_link","secondary","secondary_link","primary","primary_link"]), nameAllow: [/^Paseo Metropolitano/, /^Avenida /, /^Camino /, /^Antilen$/, /^Rotonda /, /^Acceso /], nameBlock: [/^Sendero Ciclista /] }],
  ];
  for (const [nombre, opts] of filtros) {
    const o = opts ? { ...opts, nodeOk: undefined } : undefined;
    const r = findRoute(net, gate, plaza, nombre === "solo nodeOk" ? {} : o);
    if (!r) { console.log(`\n[${nombre}] SIN RUTA`); continue; }
    console.log(`\n[${nombre}] ${(r.distanceM / 1000).toFixed(2)} km:`);
    const porNombre = new Map<string, [number, string]>();
    const orden: string[] = [];
    for (let i = 0; i < r.segNames.length; i++) {
      const nm = r.segNames[i] || "(sin nombre)";
      const m = haversineM(r.coords[i], r.coords[i + 1]);
      if (!porNombre.has(nm)) { porNombre.set(nm, [0, ""]); orden.push(nm); }
      const acc = porNombre.get(nm)!;
      acc[0] += m;
    }
    for (const nm of orden) console.log(`   ${((porNombre.get(nm)?.[0] ?? 0)).toFixed(0).padStart(6)} m  ${nm}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
