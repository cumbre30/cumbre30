// Chip EN PAUSA + tema atardecer digital gigante
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(() => {
  localStorage.setItem("cumbre30-ridetheme-v1", JSON.stringify({ color: "atardecer", speedoStyle: "digital", speedoSize: "gigante", minimapSize: "compacto" }));
});
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2000);
await page.getByRole("button", { name: /iniciar ride/i }).click({ timeout: 15000 });
await page.waitForTimeout(5000);
await page.getByRole("button", { name: /pausar/i }).click({ timeout: 15000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: "/home/z/my-project/download/preview-ride-pausa.png", fullPage: false });
const chip = await page.locator('[role="status"]').allTextContents();
console.log("chips:", JSON.stringify(chip));
await browser.close();
