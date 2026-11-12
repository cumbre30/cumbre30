/**
 * Simula computePresetRoute para las 9 rutas y compara el resultado con el
 * trazado «Ver» (RUTAS_TRAZADOS): mide tramos extra, divergencias y si el
 * tramo interno (acceso → inicio del trazado) reemplaza/recorta el trazado.
 *
 * El fetch relativo "/red-ciclista.json" se redirige al dev server local.
 */
const origFetch = globalThis.fetch;
(globalThis as any).fetch = (u: any, ...a: any[]) =>
  origFetch(typeof u === "string" && u.startsWith("/") ? new URL(u, "http://localhost:3000") : u, ...a);

import { computePresetRoute } from "../src/lib/routingService";
import { CAPA_RUTAS } from "../src/lib/mapLayers";
import { haversineM } from "../src/lib/routing";

type P = { lat: number; lon: number };

/** Distancia de un punto a la polilínea (min por segmento, equirectangular). */
function distAPolyline(p: P, poly: P[]): number {
  const kx = Math.cos((p.lat * Math.PI) / 180);
  let best = Infinity;
  for (let i = 0; i < poly.length - 1; i++) {
    const ax = poly[i].lon * kx, ay = poly[i].lat;
    const bx = poly[i + 1].lon * kx, by = poly[i + 1].lat;
    const px = p.lon * kx, py = p.lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320);
  }
  return best;
}

/** km del tramo de `route` que está a >60 m del trazado de referencia. */
function kmFuera(route: P[], ref: P[]): { fueraKm: number; totalKm: number; peores: { km: number; d: number; p: P }[] } {
  let fuera = 0, total = 0;
  const peores: { km: number; d: number; p: P }[] = [];
  for (let i = 1; i < route.length; i++) {
    const mid = { lat: (route[i - 1].lat + route[i].lat) / 2, lon: (route[i - 1].lon + route[i].lon) / 2 };
    const d = haversineM(route[i - 1], route[i]);
    total += d;
    const dr = distAPolyline(mid, ref);
    if (dr > 60) {
      fuera += d;
      peores.push({ km: total / 1000, d: dr, p: mid });
    }
  }
  peores.sort((a, b) => b.d - a.d);
  return { fueraKm: fuera / 1000, totalKm: total / 1000, peores: peores.slice(0, 5) };
}

// Posiciones GPS de prueba: fuera del parque (Providencia/PdV) y dentro (Tupahue)
const GPS_PRUEBAS: { nombre: string; pos: P }[] = [
  { nombre: "fuera del parque (Av. PdV / Providencia)", pos: { lat: -33.4215, lon: -70.6095 } },
  { nombre: "dentro del parque (sector Tupahue)", pos: { lat: -33.4180, lon: -70.6270 } },
];

async function main() {
  for (const gps of GPS_PRUEBAS) {
    console.log(`\n================ GPS: ${gps.nombre} (${gps.pos.lat}, ${gps.pos.lon}) ================`);
    for (const r of CAPA_RUTAS) {
      const res = await computePresetRoute(gps.pos, { rutaId: r.id, nombre: r.nombre }, { fullTrace: true });
      if (!res.route) {
        console.log(`${r.id}: ERROR ${res.error}`);
        continue;
      }
      const { coords } = res.route;
      const t = (await import("../src/lib/mapLayers")).rutaTrazado(r).coords;
      const { fueraKm, totalKm, peores } = kmFuera(coords, t);
      const inicio = coords[0], fin = coords[coords.length - 1];
      const finTrace = t[t.length - 1];
      console.log(
        `${r.id}: nav ${totalKm.toFixed(2)} km · fuera-del-trazado ${fueraKm.toFixed(2)} km (${((fueraKm / totalKm) * 100).toFixed(0)}%) · fin nav (${fin.lat.toFixed(5)}, ${fin.lon.toFixed(5)}) vs fin trace (${finTrace.lat.toFixed(5)}, ${finTrace.lon.toFixed(5)})`
      );
      for (const pw of peores) {
        console.log(`    ↳ km ${pw.km.toFixed(2)} a ${pw.d.toFixed(0)} m del trazado (${pw.p.lat.toFixed(5)}, ${pw.p.lon.toFixed(5)})`);
      }
    }
  }
}

main().then(() => process.exit(0));
