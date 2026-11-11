import { chromium } from "playwright";
const BASE = "http://localhost:3000/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.locator("button[aria-label='Plan gratis - ver planes']").first().click();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Explorar" }).click();
await page.waitForTimeout(3500);
await ctx.grantPermissions(["geolocation"]);
await ctx.setGeolocation({ latitude: -33.4505, longitude: -70.67, accuracy: 12 });
await page.waitForTimeout(6000);
await page.locator("button[title='Centrar en mi ubicación']").first().click();
await page.waitForTimeout(3500);
await page.getByRole("button", { name: "Ride" }).click();
await page.waitForTimeout(1000);
await ctx.setGeolocation({ latitude: -33.4307, longitude: -70.6359, accuracy: 8 });
const btn = page.locator("button", { hasText: "Iniciar ride" }).first();
if (await btn.isVisible().catch(() => false)) { await btn.click(); }
// timeline
for (let i = 0; i < 12; i++) {
  const n = await page.locator("select").count();
  const body = await page.locator("body").innerText();
  const flags = [
    n > 0 ? "sel" : "NO-SEL",
    body.includes("Ruta lista") ? "ruta-lista" : "",
    /\d+ min ·/.test(body) ? "eta" : "",
    body.includes("Buscando tu ubicación") ? "buscando" : "",
    body.includes("desviado") ? "desviado" : "",
  ].filter(Boolean).join(",");
  console.log(`t+${i}s: ${flags}`);
  await page.waitForTimeout(1000);
}
await browser.close();
