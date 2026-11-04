// Debug puntual: ruta Barrio Italia → Pío Nono Sur, segmento 52 fuera de red.
async function main() {
  const from = { lat: -33.452, lon: -70.638 };
  const to = { lat: -33.436235, lon: -70.635415 };
  const url =
    "https://routing.openstreetmap.de/routed-bike/route/v1/driving/" +
    `${from.lon.toFixed(6)},${from.lat.toFixed(6)};${to.lon.toFixed(6)},${to.lat.toFixed(6)}` +
    "?overview=full&geometries=geojson&steps=false&alternatives=false&radiuses=200;";
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const j = await r.json();
      if (j.code !== "Ok") { console.log("OSRM:", j.code); return; }
      const c = j.routes[0].geometry.coordinates.map(([lon, lat]: [number, number]) => ({ lat, lon }));
      console.log("vertices:", c.length, "dist:", Math.round(j.routes[0].distance));
      const i = 52;
      console.log(`seg${i}:`, c[i], "→", c[i + 1]);
      // contexto: 10 segmentos alrededor
      for (let k = 48; k <= 56 && k < c.length - 1; k++) {
        const len = Math.hypot((c[k + 1].lat - c[k].lat) * 111320, (c[k + 1].lon - c[k].lon) * 111320 * Math.cos(c[k].lat * Math.PI / 180));
        console.log(`  seg${k}: ${c[k].lat.toFixed(5)},${c[k].lon.toFixed(5)} → ${c[k + 1].lat.toFixed(5)},${c[k + 1].lon.toFixed(5)} · ${Math.round(len)} m`);
      }
      return;
    } catch (e) {
      console.log(`intento ${intento} falló:`, (e as Error).message);
      await new Promise((r2) => setTimeout(r2, 2000));
    }
  }
}
main();
