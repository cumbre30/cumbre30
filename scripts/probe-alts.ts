import { execFileSync } from "node:child_process";
import { GATES, PARK_POLYGON } from "@/lib/park";
import { haversineM, type LatLng, type NavRoute } from "@/lib/routing";

const poly: [number, number][] = PARK_POLYGON.map((p) => [p.lat, p.lon]);
const inPoly = (lat: number, lon: number) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const interiorM = (coords: LatLng[], dest: LatLng) => {
  let m = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    if (inPoly(coords[i].lat, coords[i].lon) && haversineM(coords[i], dest) > 150) m += haversineM(coords[i], coords[i + 1]);
  }
  return Math.round(m);
};

const from: LatLng = { lat: -33.4470, lon: -70.6420 };
const dest = GATES.find((g) => g.id === "la-piramide")!.position;
const url = `https://routing.openstreetmap.de/routed-bike/route/v1/driving/${from.lon},${from.lat};${dest.lon},${dest.lat}?overview=full&geometries=geojson&steps=false&alternatives=true&radiuses=200;`;
const out = execFileSync("curl", ["-s", "-m", "30", url], { maxBuffer: 64 * 1024 * 1024 }).toString();
const j = JSON.parse(out);
console.log("code:", j.code, "rutas:", j.routes?.length);
for (const r of (j.routes ?? []) as { distance: number; geometry: { coordinates: [number, number][] } }[]) {
  const coords = r.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
  console.log(`  ${Math.round(r.distance)} m | interior=${interiorM(coords, dest)} m`);
}
