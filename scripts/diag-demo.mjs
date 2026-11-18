// Diagnóstico del demo: qué renderiza https://cumbregeo.cl en headless,
// errores de consola y estado del combobox "Ir a".
import { chromium } from "playwright";
const BASE = process.argv[2] || "https://cumbregeo.cl";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
page.on("pageerror", (e) => errs.push(`pageerror: ${e.message.slice(0, 160)}`));
const resp = await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
console.log("HTTP", resp?.status());
await page.waitForTimeout(15_000);
console.log("title:", await page.title());
console.log("combobox 'Ir a' en DOM:", await page.getByRole("combobox", { name: "Ir a" }).count());
console.log("combobox visible:", await page.getByRole("combobox", { name: "Ir a" }).first().isVisible().catch(() => false));
console.log("texto visible (primeros):", (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 400));
console.log("errores consola:", errs.length ? errs.slice(0, 5) : "ninguno");
await page.screenshot({ path: "/tmp/render/demo-diag.png", fullPage: false });
await browser.close();
console.log("DIAG_OK");
