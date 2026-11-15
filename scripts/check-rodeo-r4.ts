// Simula el mecanismo completo de osrmCiudadPorFuera (el fix de
// computePresetRoute) sobre el caso del cliente, usando curl para cada
// llamada OSRM (el fetch de Node no tiene salida directa en el sandbox;
// en la app real el fetch sale del navegador del usuario):
//   1. OSRM cruda Bellavista → inicio trazado R4 (La Pirámide).
//   2. mientras la ruta traiga >150 m de interior: waypoint de rodeo
//      (réplica de viaExternaParque) + re-llamada con vias (3 intentos).
//   3. si sigue entrando → sería respaldo local (ya verificado: 0 m).
// Ejecutar: node_modules/.bin/tsx scripts/check-rodeo-r4.ts
// ============================================================
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { haversineM, type LatLng } from "../src/lib/routing";
import { parkInsideTest } from "../src/lib/routingService";
import { PARK_POLYGON } from "../src/lib/park";

const OSRM_BASE = "https://routing.openstreetmap.de/routed-bike/route/v1/driving";
const bellavista: LatLng = { lat: -33.42659, lon: -70.64033 };
const destino: LatLng = { lat: -33.387957, lon: -70.601486 }; // inicio trazado R4 (boca La Pirámide)
const dentroEstricto = parkInsideTest(0);

function interiorM(coords: LatLng[]): number {
  let m = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    if (dentroEstricto(a.lat, a.lon) && haversineM(a, destino) > 150) m += haversineM(a, coords[i + 1]);
  }
  return m;
}

/** réplica de viaExternaParque: primer punto interior → proyección al borde
 *  del polígono → 450 m hacia afuera (dirección centroide→borde). */
function viaDe(route: LatLng[]): LatLng | null {
  let p: LatLng | null = null;
  for (const c of route) {
    if (dentroEstricto(c.lat, c.lon) && haversineM(c, destino) > 150) { p = c; break; }
  }
  if (!p) return null;
  let cy = 0, cx = 0;
  for (const v of PARK_POLYGON) { cy += v.lat; cx += v.lon; }
  cy /= PARK_POLYGON.length; cx /= PARK_POLYGON.length;
  const R = 111320;
  const k = Math.cos((p.lat * Math.PI) / 180);
  const px = p.lon * R * k, py = p.lat * R;
  let qx = 0, qy = 0, bd = Infinity;
  for (let i = 0; i < PARK_POLYGON.length; i++) {
    const v1 = PARK_POLYGON[i];
    const v2 = PARK_POLYGON[(i + 1) % PARK_POLYGON.length];
    const ax = v1.lon * R * k, ay = v1.lat * R;
    const bx = v2.lon * R * k, by = v2.lat * R;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    const ex = ax + t * dx, ey = ay + t * dy;
    const d = (px - ex) ** 2 + (py - ey) ** 2;
    if (d < bd) { bd = d; qx = ex; qy = ey; }
  }
  let ox = qx - cx * R * k, oy = qy - cy * R;
  const len = Math.hypot(ox, oy) || 1;
  ox /= len; oy /= len;
  const fx = qx + ox * 450, fy = qy + oy * 450;
  return { lat: fy / R, lon: fx / (R * k) };
}

function osrmFetch(vias: LatLng[]): { km: number; coords: LatLng[] } | null {
  const pts = [bellavista, ...vias, destino];
  const coords = pts.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  const radiuses = ["200", ...vias.map(() => "500"), ""].join(";");
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&steps=false&alternatives=false&radiuses=${radiuses}`;
  const out = execFileSync("curl", ["-s", "--max-time", "25", url], { maxBuffer: 16 * 1024 * 1024 }).toString();
  const j = JSON.parse(out) as { code: string; routes?: { distance: number; geometry: { coordinates: [number, number][] } }[] };
  const rt = j.routes?.[0];
  if (j.code !== "Ok" || !rt) return null;
  return { km: rt.distance / 1000, coords: rt.geometry.coordinates.map(([lon, lat]) => ({ lat, lon })) };
}

void (async () => {
  const r0 = osrmFetch([]);
  if (!r0) { console.log("[rodeo] OSRM sin respuesta"); return; }
  let m = interiorM(r0.coords);
  console.log(`[1] OSRM cruda: ${r0.km.toFixed(2)} km · interior: ${Math.round(m)} m ${m > 150 ? "✗" : "✓"}`);
  const vias: LatLng[] = [];
  let ultimo = r0;
  for (let intento = 0; intento < 3 && m > 150; intento++) {
    const via = viaDe(ultimo.coords);
    if (!via) break;
    vias.push(via);
    const r2 = osrmFetch(vias);
    if (!r2) break;
    ultimo = r2;
    m = interiorM(ultimo.coords);
    console.log(`[rodeo ${intento + 1}] via=(${via.lat.toFixed(5)},${via.lon.toFixed(5)}): ${ultimo.km.toFixed(2)} km · interior: ${Math.round(m)} m ${m > 150 ? "✗" : "✓ LIMPIO"}`);
  }
  if (m <= 150) console.log(`→ RESULTADO en el dispositivo: OSRM con ${vias.length} via(s) · ${ultimo.km.toFixed(2)} km POR FUERA ✓`);
  else console.log(`→ OSRM insistió: el fix usaría el respaldo LOCAL por calles (0 m interior, ya verificado) ✓`);
})();
