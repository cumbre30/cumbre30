import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (url: string | URL) => {
  const u = String(url);
  if (u.includes("/red-ciclista.json")) return new Response(readFileSync("/home/z/my-project/public/red-ciclista.json"), { status: 200 });
  if (u.includes("routing.openstreetmap.de")) {
    const out = execFileSync("curl", ["-s", "-m", "25", u], { maxBuffer: 64 * 1024 * 1024 });
    return new Response(out.toString(), { status: 200 });
  }
  return realFetch(url);
}) as typeof fetch;
import { computeRoute } from "@/lib/routingService";
import { loadNetwork, haversineM, type LatLng, type NavRoute } from "@/lib/routing";
import { GATES, PARK_POLYGON } from "@/lib/park";

function viaExternaParque(route: NavRoute, dest: LatLng): LatLng | null {
  const poly: [number, number][] = PARK_POLYGON.map((p) => [p.lat, p.lon]);
  const inPoly = (lat: number, lon: number) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  let p: LatLng | null = null;
  for (const c of route.coords) {
    if (inPoly(c.lat, c.lon) && haversineM(c, dest) > 150) { p = c; break; }
  }
  if (!p) return null;
  console.log("primer punto interior:", p.lat.toFixed(5), p.lon.toFixed(5));
  let cy = 0, cx = 0;
  for (const v of PARK_POLYGON) { cy += v.lat; cx += v.lon; }
  cy /= PARK_POLYGON.length; cx /= PARK_POLYGON.length;
  const R = 111320;
  const k = Math.cos((p.lat * Math.PI) / 180);
  const px = p.lon * R * k, py = p.lat * R;
  let qx = 0, qy = 0, bd = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [y1, x1] = poly[i];
    const [y2, x2] = poly[(i + 1) % poly.length];
    const ax = x1 * R * k, ay = y1 * R;
    const bx = x2 * R * k, by = y2 * R;
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

async function main() {
  const net = await loadNetwork();
  void net;
  const piramide = GATES.find((g) => g.id === "la-piramide")!;
  const from: LatLng = { lat: -33.4470, lon: -70.6420 };
  const r = await computeRoute(from, piramide.position, { accesoDirecto: true });
  if (!r.route) { console.log("sin ruta"); return; }
  console.log("ruta:", Math.round(r.route.distanceM), "m");
  const via = viaExternaParque(r.route, piramide.position);
  console.log("via:", via ? `${via.lat.toFixed(5)},${via.lon.toFixed(5)}` : "null");
  if (via) {
    const url = `https://routing.openstreetmap.de/routed-bike/route/v1/driving/${from.lon.toFixed(6)},${from.lat.toFixed(6)};${via.lon.toFixed(6)},${via.lat.toFixed(6)};${piramide.position.lon.toFixed(6)},${piramide.position.lat.toFixed(6)}?overview=false&alternatives=false&radiuses=200;500;`;
    console.log("URL:", url);
    const out = execFileSync("curl", ["-s", "-m", "25", url], { maxBuffer: 8 * 1024 * 1024 }).toString();
    try {
      const j = JSON.parse(out);
      console.log("code:", j.code, "dist:", Math.round(j.routes?.[0]?.distance ?? 0), "legs:", j.routes?.[0]?.legs?.length);
    } catch { console.log("respuesta no-JSON:", out.slice(0, 200)); }
  }
}
void main();
