// Verificación de los accesos ciclistas en el mapa (Explorar):
// cuenta los CircleMarker por color (verde = autorizado, gris = resto)
// y captura el mapa alejado para ver los 9 accesos.
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/render";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3500);

await page.getByRole("link", { name: /Explorar/i }).click().catch(async () => {
  await page.getByText("Explorar", { exact: true }).first().click();
});
await page.waitForTimeout(2500);

// Contar los CircleMarker de accesos por su color de trazo.
// Nota: el polígono del límite del parque también usa #34d399, así
// que verdes = 4 accesos ciclistas + 1 polígono = 5.
const conteo = await page.evaluate(() => {
  const paths = Array.from(document.querySelectorAll(".leaflet-overlay-pane svg path"));
  const verde = paths.filter((p) => p.getAttribute("stroke") === "#34d399").length;
  const gris = paths.filter((p) => p.getAttribute("stroke") === "#94a3b8").length;
  return { verde, gris, total: paths.length };
});
console.log("Verdes (#34d399):", conteo.verde, "(4 accesos ciclistas + 1 polígono del parque = 5)");
console.log("Otros accesos (gris #94a3b8):", conteo.gris, "(esperado 4)");
const gatesOk = conteo.verde === 5 && conteo.gris === 4;
console.log("Marcado de accesos correcto:", gatesOk);

// Alejar el zoom para ver el parque completo con los accesos y capturar
const menos = page.locator(".leaflet-control-zoom-out");
for (let i = 0; i < 2; i++) {
  await menos.click().catch(() => {});
  await page.waitForTimeout(250);
}
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/parquemet-gates.png` });
console.log("OK -> parquemet-gates.png");

await browser.close();
console.log("GATES_LISTO");
