// Dibuja la ruta actual Pío Nono → Plaza México + aristas Mackenna/Bannen
// para verificar visualmente el puente entre las Bannen paralelas.
// Ejecutar: node_modules/.bin/tsx scripts/debug-mackenna3.ts  → /tmp/render/mack.html
const realFetch = globalThis.fetch;
globalThis.fetch = ((url: string, ...a: any[]) => realFetch(new URL(String(url), "http://localhost:3000"), ...a)) as typeof fetch;

import * as fs from "fs";
import { findRoute, loadNetwork, haversineM } from "../src/lib/routing";
import { GATES } from "../src/lib/park";
import { PAV_DEST_OPTS } from "../src/lib/routingService";

async function main() {
  const net = await loadNetwork();
  if (!net) throw new Error("sin red");
  const pio = GATES.find((g) => g.id === "pio-nono")!.position;
  const plaza = { lat: -33.4234, lon: -70.6327 };
  const r = findRoute(net, pio, plaza, PAV_DEST_OPTS)!;

  const seg = (a: number[], b: number[]) => [[a[1], a[0]], [b[1], b[0]]];
  const mack: number[][][] = [];
  const bannen: number[][][] = [];
  const otros: { nm: string; pts: number[][][] }[] = [];
  const vistos = new Set<string>();
  for (const [a, b, , ni] of net.edges) {
    const nm = net.names[ni] ?? "";
    const pa = net.nodes[a], pb = net.nodes[b];
    if (nm === "Avenida Alberto Mackenna") mack.push(seg(pa, pb));
    else if (nm === "Avenida Pedro Bannen") bannen.push(seg(pa, pb));
    else if (nm && !vistos.has(nm) && haversineM({ lat: (pa[0] + pb[0]) / 2, lon: (pa[1] + pb[1]) / 2 }, { lat: -33.4161, lon: -70.6230 }) < 220) {
      vistos.add(nm);
      otros.push({ nm, pts: [seg(pa, pb)] });
    }
  }
  const DATA = {
    ruta: r.coords.map((c) => [c.lon, c.lat]),
    mack, bannen, otros,
    transicion: [-70.623005, -33.416121],
    plaza: [-70.6327, -33.4234],
    pio: [-70.63592, -33.430691],
  };
  const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file:///home/z/my-project/node_modules/leaflet/dist/leaflet.css"><style>body{margin:0}#m{height:100vh}</style></head>
<body><div id="m"></div>
<script src="file:///home/z/my-project/node_modules/leaflet/dist/leaflet.js"></script>
<script>
var DATA = ${JSON.stringify(DATA)};
var map=L.map('m').setView([-33.4195,-70.6278],15);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
L.polyline(DATA.ruta,{color:'#e11d48',weight:6,opacity:.9}).addTo(map).bindPopup('ruta actual');
L.polyline(DATA.mack,{color:'#2563eb',weight:4,opacity:.8}).addTo(map).bindPopup('Av. Alberto Mackenna');
L.polyline(DATA.bannen,{color:'#f59e0b',weight:4,opacity:.9}).addTo(map).bindPopup('Av. Pedro Bannen');
DATA.otros.forEach(function(o){L.polyline(o.pts,{color:'#10b981',weight:3,opacity:.7}).addTo(map).bindPopup(o.nm);});
L.marker(DATA.transicion).addTo(map).bindPopup('transicion Mackenna-Bannen');
L.marker(DATA.plaza).addTo(map).bindPopup('Plaza Mexico');
L.marker(DATA.pio).addTo(map).bindPopup('Acceso Pio Nono');
var pts=L.polyline(DATA.ruta).getBounds(); map.fitBounds(pts.pad(0.15));
</script></body></html>`;
  fs.writeFileSync("/tmp/render/mack.html", html);
  console.log("ok /tmp/render/mack.html · ruta", (r.distanceM / 1000).toFixed(2), "km");
}
main();
