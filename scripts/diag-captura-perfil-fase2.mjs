// Captura del Perfil Ciclista (6 ejes) para verificación visual.
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.getByText("Cumbre").first().waitFor({ timeout: 60000 });
await page.evaluate(async () => {
  await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "e2e-perfil@cumbre30.test", password: "test-12345678" }) });
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Perfil", exact: true }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: "/tmp/render/perfil-fase2.png", fullPage: true });
console.log("captura lista");
await browser.close();
