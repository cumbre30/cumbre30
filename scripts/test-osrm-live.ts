// Prueba EN VIVO del camino OSRM (el que corre la app cuando el pin
// queda fuera del grafo): Barrio Brasil → Acceso Pío Nono.
// Reproduce osrmFetch (radiuses=200;) + attachOrigin y audita si el
// conector pin→ruta sale en recta (el bug que reporta el usuario).
const OSRM_BASE = "https://routing.openstreetmap.de/routed-bike/route/v1/driving";
const PIO_NONO = { lat: -33.430691, lon: -70.63592 };

type LatLng = { lat: number; lon: number };

function haversineM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function projectOnPolyline(coords: LatLng[], p: LatLng) {
  const kx = Math.cos((p.lat * Math.PI) / 180);
  let best = { segIdx: 0, distM: Infinity, point: coords[0] };
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1];
    const ax = a.lon * kx, ay = a.lat;
    const bx = b.lon * kx, by = b.lat;
    const px = p.lon * kx, py = p.lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const dM = Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) * 111_320;
    if (dM < best.distM) {
      best = {
        segIdx: i,
        distM: dM,
        point: { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t },
      };
    }
  }
  return best;
}

async function osrmFetch(from: LatLng, to: LatLng) {
  const url = `${OSRM_BASE}/${from.lon.toFixed(6)},${from.lat.toFixed(6)};${to.lon.toFixed(6)},${to.lat.toFixed(6)}?overview=full&geometries=geojson&steps=true&alternatives=false&radiuses=200;`;
  const ctrl = new AbortController();
  const to2 = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) { console.log(`  OSRM HTTP ${r.status}`); return null; }
    const d = (await r.json()) as { code: string; routes?: { distance: number; geometry: { coordinates: [number, number][] } }[] };
    if (d.code !== "Ok" || !d.routes?.length) { console.log(`  OSRM code=${d.code}`); return null; }
    return d.routes[0];
  } catch (e) {
    console.log(`  OSRM fallo: ${e}`);
    return null;
  } finally {
    clearTimeout(to2);
  }
}

const origins: { label: string; from: LatLng }[] = [
  { label: "Barrio Brasil", from: { lat: -33.4452, lon: -70.6553 } },
  { label: "Ñuñoa Plaza", from: { lat: -33.4545, lon: -70.6085 } },
  { label: "Yungay", from: { lat: -33.4430, lon: -70.6680 } },
  { label: "San Joaquín (Marín sur)", from: { lat: -33.4995, lon: -70.6155 } },
];

for (const o of origins) {
  console.log(`\n=== ${o.label} → Pío Nono (OSRM) ===`);
  const osrm = await osrmFetch(o.from, PIO_NONO);
  if (!osrm) { console.log("  sin ruta OSRM"); continue; }
  const coords: LatLng[] = osrm.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
  const snap = coords[0];
  const pr = projectOnPolyline(coords, o.from);
  const straightM = haversineM(o.from, pr.point);
  console.log(`  OSRM ok: ${(osrm.distance / 1000).toFixed(2)} km, ${coords.length} vértices`);
  console.log(`  snap coords[0]: ${snap.lat.toFixed(6)},${snap.lon.toFixed(6)} → a ${haversineM(o.from, snap).toFixed(0)} m del pin`);
  console.log(`  proyección del pin: segIdx=${pr.segIdx} distM=${pr.distM.toFixed(0)} → straightM=${straightM.toFixed(0)} m`);
  if (straightM > 40) {
    console.log(`  → >40 m: la app pide conector OSRM pin→join…`);
    const conn = await osrmFetch(o.from, pr.point);
    if (!conn) {
      console.log(`  ❌ conector OSRM FALLA → attachOrigin dibuja RECTA de ${straightM.toFixed(0)} m pin→ruta (BUG del usuario)`);
    } else {
      const detour = conn.distance;
      const cap = Math.max(500, straightM * 4);
      console.log(`  conector OSRM ok: ${detour.toFixed(0)} m (tope ${cap.toFixed(0)} m) → ${detour > cap ? "❌ RECHAZADO por tope → RECTA" : "✅ aceptado, va por calles"}`);
      const cc: LatLng[] = conn.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
      console.log(`  conector: v0=${cc[0].lat.toFixed(5)},${cc[0].lon.toFixed(5)} (a ${haversineM(o.from, cc[0]).toFixed(0)} m del pin) → vN=${cc[cc.length - 1].lat.toFixed(5)},${cc[cc.length - 1].lon.toFixed(5)} (a ${haversineM(pr.point, cc[cc.length - 1]).toFixed(0)} m del join)`);
    }
  } else {
    console.log(`  → ≤40 m: chaflán recto corto (aceptable)`);
  }
  // primeros 6 vértices OSRM: ¿siguen calles? (muestreo del inicio)
  console.log(`  primeros vértices OSRM (offsets desde pin):`);
  for (let i = 0; i < Math.min(6, coords.length); i++) {
    console.log(`    v${i}: ${coords[i].lat.toFixed(5)},${coords[i].lon.toFixed(5)} · a ${haversineM(o.from, coords[i]).toFixed(0)} m del pin`);
  }
}
