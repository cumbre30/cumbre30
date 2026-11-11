// Verificación visual del banner de clima vía caché (ruta offline del APK)
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/render";
mkdirSync(OUT, { recursive: true });

// Caché simulado: 21.4°, parcialmente nublado (code 1), hace 5 minutos
const CACHE = { tempC: 21.4, code: 1, t: Date.now() - 5 * 60000 };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript((c) => {
  localStorage.setItem("cumbre30-clima-v1", JSON.stringify(c));
}, CACHE);

await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(4000);

const banner = page.locator('div[role="status"][aria-label^="Clima en el parque"]');
console.log("Banner clima visible (idle, caché):", await banner.count());
if (await banner.count()) {
  console.log("Texto:", (await banner.first().innerText()).replace(/\n/g, " | "));
}
await page.screenshot({ path: `${OUT}/diag-clima-cache-idle.png`, fullPage: true });
console.log("OK -> diag-clima-cache-idle.png");

await page.getByRole("button", { name: /iniciar ride/i }).click({ timeout: 15000 });
await page.waitForTimeout(5000);
console.log("Banner clima visible (en marcha, caché):", await banner.count());
await page.screenshot({ path: `${OUT}/diag-clima-cache-running.png`, fullPage: true });
console.log("OK -> diag-clima-cache-running.png");

await browser.close();
console.log("CLIMA_CACHE_LISTO");
