/**
 * Nav vs Ver, métrica fina: separa el CONECTOR (GPS → inicio del trazado)
 * y mide el % fuera-del-trazado (>60 m) SOLO después del empalme.
 * El cliente: «el botón ruta tenga el mismo trazado del botón ver» —
 * tras llegar al inicio, el recorrido debe seguir el trazado de «Ver».
 */
const origFetch = globalThis.fetch;
(globalThis as any).fetch = (u: any, ...a: any[]) =>
  origFetch(typeof u === "string" && u.startsWith("/") ? new URL(u, "http://localhost:3000") : u, ...a);

import { computePresetRoute } from "../src/lib/routingService";
import { CAPA_RUTAS, rutaTrazado } from "../src/lib/mapLayers";
import { haversineM } from "../src/lib/routing";

type P = { lat: number; lon: number };

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

const GPS_PRUEBAS: { nombre: string; pos: P }[] = [
  { nombre: "fuera del parque (Av. PdV / Providencia)", pos: { lat: -33.4215, lon: -70.6095 } },
  { nombre: "dentro del parque (sector Tupahue)", pos: { lat: -33.4180, lon: -70.6270 } },
];

async function main() {
  let fallos = 0;
  for (const gps of GPS_PRUEBAS) {
    console.log(`\n===== GPS: ${gps.nombre} =====`);
    for (const r of CAPA_RUTAS) {
      const res = await computePresetRoute(gps.pos, { rutaId: r.id, nombre: r.nombre }, { fullTrace: true });
      if (!res.route) {
        console.log(`${r.id}: ERROR ${res.error}`);
        fallos++;
        continue;
      }
      const coords = res.route.coords as P[];
      const t = rutaTrazado(r).coords as P[];
      // empalme: primer índice de la nav a <30 m del INICIO del trazado
      let join = -1;
      for (let i = 0; i < coords.length; i++) {
        if (haversineM(coords[i], t[0]) < 30) { join = i; break; }
      }
      let conectorKm = 0, tramoKm = 0, fueraKm = 0;
      const peores: { km: number; d: number }[] = [];
      for (let i = 1; i < coords.length; i++) {
        const d = haversineM(coords[i - 1], coords[i]);
        if (join < 0 || i <= join) { conectorKm += d; continue; }
        tramoKm += d;
        const dr = distAPolyline({ lat: (coords[i - 1].lat + coords[i].lat) / 2, lon: (coords[i - 1].lon + coords[i].lon) / 2 }, t);
        if (dr > 60) {
          fueraKm += d;
          peores.push({ km: conectorKm / 1000 + (tramoKm / 1000), d: dr });
        }
      }
      const pct = tramoKm > 0 ? ((fueraKm / tramoKm) * 100).toFixed(1) : "n/a";
      const estado = join >= 0 && parseFloat(pct) < 5 ? "OK" : "REVISAR";
      if (estado === "REVISAR") fallos++;
      console.log(
        `${r.id}: conector ${(conectorKm / 1000).toFixed(2)} km · tras empalme ${((tramoKm - fueraKm) / 1000).toFixed(2)} km (trace ${(t.length ? 0 : 0)}·nav ${((conectorKm + tramoKm) / 1000).toFixed(2)} km) · fuera ${pct}% · ${estado}`
      );
      peores.sort((a, b) => b.d - a.d);
      for (const p of peores.slice(0, 2)) console.log(`    ↳ km ${p.km.toFixed(2)} a ${p.d.toFixed(0)} m del trazado`);
    }
  }
  console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} REVISIONES`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().then(() => process.exit(0));
