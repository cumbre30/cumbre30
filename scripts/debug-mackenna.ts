// Traza la ruta actual (motor A* + PAV_DEST_OPTS) hacia Plaza México
// y la compara con lo que pide el cliente (2026-11-12):
//   "subes por Av. Mackenna, puente (espacio entre las Bannen paralelas
//    en Tupahue) y tomas Pedro Bannen hacia Plaza México".
// Ejecutar: node_modules/.bin/tsx scripts/debug-mackenna.ts
import * as fs from "fs";
import { findRoute, haversineM, loadNetwork, snapInfo, type LatLng } from "../src/lib/routing";
import { GATES } from "../src/lib/park";
import { PAV_DEST_OPTS, PAV_DEST_RELAX } from "../src/lib/routingService";

const realFetch = globalThis.fetch;
globalThis.fetch = ((url: string, ...a: any[]) => realFetch(new URL(String(url), "http://localhost:3000"), ...a)) as typeof fetch;

async function main() {
  const net = await loadNetwork();
  if (!net) throw new Error("sin red");
  const pio = GATES.find((g) => g.id === "pio-nono")!.position;
  const plaza = { lat: -33.4234, lon: -70.6327 }; // NAV_DESTINATIONS plaza-mexico
  const pvNorte = GATES.find((g) => g.id === "pv-norte")!.position;

  const printTrace = (label: string, from: LatLng, to: LatLng, opts: any) => {
    const r = findRoute(net, from, to, opts);
    if (!r) {
      console.log(`✗ ${label}: SIN RUTA`);
      return;
    }
    console.log(`\n== ${label}: ${(r.distanceM / 1000).toFixed(2)} km, ${(r as any).steps?.length ?? "?"} pasos ==`);
    // secuencia de nombres con distancias acumuladas por nombre
    const segs: { name: string; m: number; n: number }[] = [];
    for (const nm of r.segNames ?? []) {
      const last = segs[segs.length - 1];
      if (last && last.name === nm) last.n++;
      else segs.push({ name: nm, m: 0, n: 1 });
    }
    // distancia por nombre: recorrer coords con segNames alineado
    const dist: Map<string, number> = new Map();
    for (let i = 0; i < (r.segNames?.length ?? 0); i++) {
      const d = haversineM(r.coords[i], r.coords[i + 1]);
      const nm = r.segNames![i];
      dist.set(nm, (dist.get(nm) ?? 0) + d);
    }
    for (const s of segs) {
      const m = Math.round(dist.get(s.name) ?? 0);
      console.log(`   ${m.toString().padStart(5)} m · ${s.name}`);
    }
    const haySendero = (r.segNames ?? []).filter((n) => /^Sendero (?!Ciclista)(?!El Excursionista)/.test(n));
    console.log(`   senderos peatonales en ruta: ${haySendero.length ? haySendero.join(", ") : "ninguno"}`);
    console.log(`   Mackenna: ${(r.segNames ?? []).some((n) => n.includes("Alberto Mackenna"))} · Pedro Bannen: ${(r.segNames ?? []).some((n) => n.includes("Pedro Bannen"))}`);
  };

  printTrace("PAV_DEST_OPTS · Acceso Pío Nono → Plaza México", pio, plaza, PAV_DEST_OPTS);
  printTrace("PAV_DEST_RELAX · Acceso Pío Nono → Plaza México", pio, plaza, PAV_DEST_RELAX);
  printTrace("PAV_DEST_OPTS · Acceso PdV Norte → Plaza México", pvNorte, plaza, PAV_DEST_OPTS);

  // ¿dónde están las Bannen paralelas y el puente? listar nodos de
  // Avenida Pedro Bannen y Avenida Alberto Mackenna
  const bannen: [number, number][] = [];
  const mack: [number, number][] = [];
  for (const [a, b, , ni] of net.edges) {
    const nm = net.names[ni] ?? "";
    if (nm === "Avenida Pedro Bannen") {
      bannen.push(net.nodes[a], net.nodes[b]);
    } else if (nm === "Avenida Alberto Mackenna") {
      mack.push(net.nodes[a], net.nodes[b]);
    }
  }
  console.log(`\nAvenida Pedro Bannen: ${bannen.length} nodos · rango lat ${Math.min(...bannen.map((p) => p[0])).toFixed(5)} a ${Math.max(...bannen.map((p) => p[0])).toFixed(5)} · lon ${Math.min(...bannen.map((p) => p[1])).toFixed(5)} a ${Math.max(...bannen.map((p) => p[1])).toFixed(5)}`);
  console.log(`Avenida Alberto Mackenna: ${mack.length} nodos · rango lat ${Math.min(...mack.map((p) => p[0])).toFixed(5)} a ${Math.max(...mack.map((p) => p[0])).toFixed(5)} · lon ${Math.min(...mack.map((p) => p[1])).toFixed(5)} a ${Math.max(...mack.map((p) => p[1])).toFixed(5)}`);
  // puntos extremos de cada cadena Bannen (para ver las dos paralelas)
  const sorted = [...bannen].sort((p, q) => p[0] - q[0]);
  console.log("Bannen extremos (por lat):", sorted.slice(0, 2), "...", sorted.slice(-2));
  const sortedM = [...mack].sort((p, q) => p[0] - q[0]);
  console.log("Mackenna extremos (por lat):", sortedM.slice(0, 2), "...", sortedM.slice(-2));
  const snapPlaza = snapInfo(net, plaza);
  console.log(`snap Plaza México: ${(snapPlaza as any).distM ?? "?"} m`);
}
main();
