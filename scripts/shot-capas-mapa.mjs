// Captura el mapa general con todas las capas activadas (panel abierto arriba).
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/render";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3500);

// Ride → minimapa → "Revisa el listado completo"
await page.selectOption('select[aria-label="Ir a"]', { label: "🗺 Revisa el listado completo" });
await page.waitForTimeout(2500);

// activar: rutas 2 y 5 (pavimento + MTB), POIs, normativa, urbana
const abrirMenu = async (id) => {
  const det = page.locator(`details[data-capa="${id}"]`);
  if (!(await det.getAttribute("open") !== null)) {
    await det.locator("summary").click();
    await page.waitForTimeout(350);
  }
};
await abrirMenu("rutas");
await page.locator('button[data-vercapa="ruta-2"]').click();
await page.locator('button[data-vercapa="mtb-1"]').click();
await abrirMenu("pois");
await page.locator('button[data-vercapa="pois"]').click();
await abrirMenu("normativa");
await page.locator('button[data-vercapa="normativa"]').click();
await abrirMenu("urbana");
await page.locator('button[data-vercapa="urbana"]').click();
await page.waitForTimeout(1200);

// cerrar todos los menús para dejar el panel compacto y ver el mapa
for (const id of ["accesos", "rutas", "pois", "normativa", "urbana"]) {
  const det = page.locator(`details[data-capa="${id}"]`);
  if (await det.getAttribute("open") !== null) {
    await det.locator("summary").click();
    await page.waitForTimeout(200);
  }
}

// scroll al mapa y captura
await page.evaluate(() => {
  const el = document.querySelector(".leaflet-container");
  el?.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/mapa-capas.png` });

// zoom-out para encuadrar el parque con las capas
const menos = page.locator(".leaflet-control-zoom-out");
for (let i = 0; i < 3; i++) {
  await menos.click().catch(() => {});
  await page.waitForTimeout(300);
}
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/mapa-capas-zoom.png` });

await browser.close();
console.log("MAPA_LISTO");
