// Smoke test del preview: la app debe cargar sin errores de consola.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const CONSOLE_IGNORE = [/401 \(Unauthorized\)/];

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" && !CONSOLE_IGNORE.some((r) => r.test(m.text()))) {
    errors.push(m.text());
  }
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
// Esperar a que la app monte (algo de UI visible)
await page.waitForTimeout(4000);

const title = await page.title();
const bodyText = (await page.textContent("body"))?.slice(0, 400) ?? "";
const hasContent = bodyText.trim().length > 50;

console.log("title:", JSON.stringify(title));
console.log("body chars:", bodyText.trim().length);
console.log("muestra:", JSON.stringify(bodyText.trim().slice(0, 120)));

if (errors.length) {
  console.log("ERRORES DE CONSOLA:");
  for (const e of errors) console.log("  -", e);
} else {
  console.log("consola: sin errores");
}

await page.screenshot({ path: "/tmp/preview-smoke.png" });
await browser.close();

if (!hasContent) {
  console.error("FALLO: la página no tiene contenido");
  process.exit(1);
}
if (errors.length) process.exit(2);
console.log("SMOKE OK");
