// Render de la geocerca PARK_POLYGON sobre tiles OSM + accesos + nodos
// problema, para inspección visual. Captura 5 zonas.
import fs from "fs";
import { chromium } from "playwright";

const GEO = JSON.parse(fs.readFileSync("/tmp/render/osm-boundary-park.json", "utf8"));
const OSM = JSON.parse(fs.readFileSync("/tmp/way-nodes-ll.json", "utf8"));

const html = `<!doctype html><html><head><meta charset="utf-8"/>
<link rel="stylesheet" href="file:///home/z/my-project/node_modules/leaflet/dist/leaflet.css"/>
<style>html,body{margin:0;height:100%;background:#222}#m{height:100vh;width:100vw}</style>
</head><body><div id="m"></div>
<script src="file:///home/z/my-project/node_modules/leaflet/dist/leaflet-src.js"></script>
<script>
const GEO = ${JSON.stringify(GEO)};
const OSM = ${JSON.stringify(OSM)};
const map = L.map("m", { zoomControl: true });
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
L.polygon(GEO.map(p=>[p[0],p[1]]), {color:"#ff00ff", weight:3, fillOpacity:0.06, dashArray:"2 6"}).addTo(map).bindTooltip("GEOCERCA");
L.polygon(OSM.map(p=>[p[0],p[1]]), {color:"#00ffff", weight:1.5, fill:false, opacity:0.8}).addTo(map).bindTooltip("OSM way/168227059");
const GATES = [
  ["Pío Nono",-33.430691,-70.63592],["PdV Norte",-33.415479,-70.617402],
  ["La Pirámide",-33.38642,-70.60179],["Zapadores",-33.399921,-70.620406],
  ["Santos Dumont",-33.423385,-70.637442],["Carlos Reed",-33.430102,-70.635426],
  ["Aurora de Chile",-33.415205,-70.627807],["Paseo Metropolitano",-33.412407,-70.623052],
  ["Cumbre/Santuario",-33.42574,-70.63319],["Plaza México",-33.4234,-70.6327],
  ["Antilén",-33.409051,-70.61374],["Tupahue",-33.41581,-70.62355],
  ["Jardín Japonés",-33.413345,-70.614692],["Anáhuac",-33.417135,-70.623511],
  ["Salida PdV",-33.416209,-70.619256],["Zañartu/F.Albert/ClaudioGay",-33.399379,-70.608406]
];
GATES.forEach(([n,la,lo])=>L.circleMarker([la,lo],{radius:5,color:"#ffff00",weight:2,fillColor:"#ff8800",fillOpacity:1}).addTo(map).bindTooltip(n,{permanent:false}));
window.goto1 = () => map.fitBounds(L.latLngBounds(GEO.map(p=>[p[0],p[1]])), {padding:[10,10]});
window.goto2 = () => map.setView([-33.41546,-70.6170], 17);   // cruce El Cerro × PdV Norte
window.goto3 = () => map.setView([-33.4307,-70.6359], 17);    // Pío Nono
window.goto4 = () => map.setView([-33.3875,-70.6015], 16);    // punta La Pirámide
window.goto5 = () => map.setView([-33.3994,-70.6084], 16);    // lobo NW (Zañartu)
window.goto6 = () => map.setView([-33.4257,-70.6330], 16);    // cumbre/zoológico
</script></body></html>`;

fs.writeFileSync("/tmp/render/geo-map.html", html);

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 700, height: 900 } });
await p.goto("file:///tmp/render/geo-map.html");
await p.waitForTimeout(2500);
for (const [fn, name] of [["goto1","full"],["goto2","elcerro"],["goto3","pionono"],["goto4","piramide"],["goto5","nw"],["goto6","cumbre"]]) {
  await p.evaluate(fn);
  await p.evaluate(() => new Promise((res) => {
    let n = 0;
    const iv = setInterval(() => {
      const imgs = [...document.querySelectorAll("img.leaflet-tile")];
      const ok = imgs.filter((i) => i.complete && i.naturalWidth > 0).length;
      if (ok === imgs.length && imgs.length > 0 && ++n > 1) { clearInterval(iv); res(); }
    }, 300);
    setTimeout(() => { clearInterval(iv); res(); }, 6000);
  }));
  await p.waitForTimeout(600);
  await p.screenshot({ path: `/tmp/render/geo-${name}.png` });
  console.log("shot", name);
}
await browser.close();
