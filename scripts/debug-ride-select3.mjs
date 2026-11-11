import { chromium } from "playwright";
const BASE = "http://localhost:3000/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
// replica exacta del flujo E2E
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
console.log("[Iniciar visible]", await btn.isVisible().catch(() => false));
if (await btn.isVisible().catch(() => false)) { await btn.click(); await page.waitForTimeout(3500); }
const sel = page.locator("select[aria-label='Ir a']");
console.log("[selects]", await page.locator("select").count());
console.log("[box]", JSON.stringify(await sel.boundingBox().catch(() => null)));
console.log("[stable?]", await sel.evaluate((el) => ({ w: el.offsetWidth, h: el.offsetHeight, disabled: el.disabled })).catch((e) => "ERR " + e.message.slice(0, 80)));
await page.screenshot({ path: "/tmp/render/ride-flujo-e2e.png", fullPage: false });
await browser.close();
