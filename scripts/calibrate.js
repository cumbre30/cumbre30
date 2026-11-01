// Calibración Cumbre30: descarga el límite real del Parque Metropolitano
// y los POIs desde openstreetmap.org, simplifica el polígono y deja el
// resultado en window.__cumbre30osm. Se ejecuta en el navegador porque
// el sandbox solo permite salida web desde ahí.
(async () => {
  const UA = { headers: { "Accept": "application/json", "User-Agent": "Cumbre30-calibration/1.0 (prototype)" } };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function jget(url) {
    const r = await fetch(url, UA);
    if (!r.ok) throw new Error(url + " -> HTTP " + r.status);
    return r.json();
  }

  // --- 1) Geometría completa del way 168227059 ---
  const way = await jget("https://www.openstreetmap.org/api/0.6/way/168227059/full.json");
  const nodes = {};
  for (const el of way.elements) if (el.type === "node") nodes[el.id] = [el.lat, el.lon];
  const ndSeq = way.elements.find((e) => e.type === "way").nodes;
  let ring = ndSeq.map((id) => nodes[id]);

  // --- 2) Simplificación Douglas-Peucker (~13 m ≈ 0.00012°) ---
  const eps = 0.00012;
  function rdp(points) {
    const keep = new Array(points.length).fill(false);
    keep[0] = keep[points.length - 1] = true;
    const stack = [[0, points.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      if (b <= a + 1) continue;
      const ax = points[a][1], ay = points[a][0];
      const bx = points[b][1], by = points[b][0];
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy) || 1e-12;
      let maxD = 0, idx = -1;
      for (let i = a + 1; i < b; i++) {
        const px = points[i][1], py = points[i][0];
        const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
        if (d > maxD) { maxD = d; idx = i; }
      }
      if (maxD > eps && idx > 0) { keep[idx] = true; stack.push([a, idx], [idx, b]); }
    }
    return points.filter((_, i) => keep[i]);
  }
  // Anillo cerrado: quitar duplicado final y dividir en 2 cadenas con
  // anclas lejanas para que el RDP no colapse la figura.
  const pts = ring.slice(0, -1);
  let far = 0, fd = -1;
  for (let i = 1; i < pts.length; i++) {
    const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2;
    if (d > fd) { fd = d; far = i; }
  }
  const chain1 = rdp(pts.slice(0, far + 1));
  const chain2 = rdp(pts.slice(far).concat([pts[0]]));
  const simplified = chain1.slice(0, -1).concat(chain2).map(([lat, lon]) => [Math.round(lat * 1e6) / 1e6, Math.round(lon * 1e6) / 1e6]);

  // --- 3) POIs por nombre (con rate limit de Nominatim) ---
  const pois = {};
  const queries = {
    antilen: "Piscina Antilén, Santiago",
    jardin: "Jardín Japonés, Providencia, Santiago",
    zoo: "Zoológico Nacional, Santiago",
    anahuac: "Anáhuac, Providencia, Santiago",
    cumbre: "Virgen San Cristóbal, Santiago",
  };
  for (const [key, q] of Object.entries(queries)) {
    try {
      await sleep(1200);
      const d = await jget("https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(q));
      if (d[0]) pois[key] = { name: d[0].display_name.split(",")[0], lat: +(+d[0].lat).toFixed(6), lon: +(+d[0].lon).toFixed(6) };
      else pois[key] = null;
    } catch (e) {
      pois[key] = { error: String(e.message).slice(0, 60) };
    }
  }

  window.__cumbre30osm = {
    source: "OSM way/168227059",
    rawPoints: ring.length,
    simplifiedPoints: simplified.length,
    park: simplified,
    pois,
  };
  return "listo: " + simplified.length + " puntos";
})().catch((e) => { window.__cumbre30err = String(e); return "ERROR " + e; });
