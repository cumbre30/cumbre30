// Test empírico: ¿el plugin leaflet-rotate rota de verdad con la MISMA
// L y un mapa creado con rotate:true? Replica el orden de imports de
// LeafletNav (setup global → plugin → new Map(rotate:true) → setBearing).
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body><div id='m'></div></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Image = dom.window.Image;

// imports DINÁMICOS: leaflet necesita window en su eval (los estáticos se
// hoistean antes del setup del DOM)
const L = (await import("leaflet")).default;
// igual que leaflet-rotate-setup.ts
if (!globalThis.L) globalThis.L = L;
// igual que el import "leaflet-rotate"
await import("leaflet-rotate");

const sameInstance = globalThis.L === L;
console.log("same L instance:", sameInstance);

const map = L.map(document.getElementById("m"), {
  rotate: true,
  bearing: 0,
  rotateControl: false,
  touchRotate: false,
  attributionControl: false,
  zoomControl: false,
});
map.setView([-33.408, -70.636], 16);

console.log("map._rotate:", map._rotate);
console.log("options.rotate:", map.options.rotate);
console.log("getBearing antes:", map.getBearing());
map.setBearing(45);
console.log("getBearing después:", map.getBearing());

const pane = map._mapPane;
console.log("transform pane:", pane?._leaflet_pos === undefined ? pane?.style?.transform ?? "(sin style.transform)" : pane.style.transform);
// getBearing debería ser 45 y el pane tener rotate(-45deg) o matriz
const ok = Math.abs((map.getBearing() ?? 0) - 45) < 0.01;
console.log(ok ? "ROTACION OK" : "ROTACION ROTA: setBearing no aplicó");
process.exit(ok ? 0 : 1);
