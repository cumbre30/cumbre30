// Verificación del banner de clima (punto 6) en el preview
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/render";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(4000); // dar tiempo al fetch de Open-Meteo

const banner = page.locator('div[role="status"][aria-label^="Clima en el parque"]');
console.log("Banner clima visible (idle):", await banner.count());
if (await banner.count()) {
  const texto = await banner.first().innerText();
  console.log("Texto del banner:", texto.replace(/\n/g, " | "));
}
await page.screenshot({ path: `${OUT}/diag-clima-idle.png`, fullPage: true });
console.log("OK -> diag-clima-idle.png");

// En marcha (demo)
await page.getByRole("button", { name: /iniciar ride/i }).click({ timeout: 10000 });
await page.waitForTimeout(5000);
console.log("Banner clima visible (en marcha):", await banner.count());
await page.screenshot({ path: `${OUT}/diag-clima-running.png`, fullPage: true });
console.log("OK -> diag-clima-running.png");

await browser.close();
console.log("CLIMA_LISTO");
