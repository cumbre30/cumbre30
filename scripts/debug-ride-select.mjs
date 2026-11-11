import { chromium } from "playwright";
const BASE = "http://localhost:3000/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
console.log("[antes] selects:", await page.locator("select").count());
const btn = page.locator("button", { hasText: "Iniciar ride" }).first();
console.log("[Iniciar ride visible]", await btn.isVisible().catch(() => false));
if (await btn.isVisible().catch(() => false)) { await btn.click(); await page.waitForTimeout(3500); }
console.log("[después] selects:", await page.locator("select").count());
const opts = await page.locator("select[aria-label='Ir a'] option").allTextContents().catch(() => "sin select");
console.log("[opciones Ir a]", JSON.stringify(opts));
const body = await page.locator("body").innerText();
console.log("[body ~200]", body.slice(0, 260).replace(/\n/g, " | "));
await browser.close();
