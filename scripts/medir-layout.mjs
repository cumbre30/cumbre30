// Medición de alturas del layout de Explorar
import { chromium } from "playwright";

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
await p.getByRole("button", { name: "Explorar" }).click();
await p.waitForTimeout(2200);
const m = await p.evaluate(`(() => {
  const main = document.querySelector("main");
  const root = document.querySelector("[data-testid=mapa-explorar]");
  const leaflet = document.querySelector(".leaflet-container");
  const capas = document.querySelector("[data-testid=capas-panel]");
  const gb = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top) };
  };
  return {
    main: gb(main),
    mainCls: main ? main.className : "",
    root: gb(root),
    leaflet: gb(leaflet),
    capas: gb(capas),
    bodyH: Math.round(document.body.getBoundingClientRect().height),
  };
})()`);
console.log(JSON.stringify(m, null, 1));
await b.close();
