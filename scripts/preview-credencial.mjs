// Captura la pestaña Credencial (QR Pedalea Seguro) en móvil y desktop
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

const shots = [
  { name: "credencial-movil", w: 390, h: 844, full: true },
  { name: "credencial-desktop", w: 1280, h: 900, full: false },
];

for (const s of shots) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  // Ir a la pestaña Credencial
  const tab = page.getByRole("button", { name: /credencial/i }).first();
  await tab.click({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `/home/z/my-project/download/preview-${s.name}.png`, fullPage: s.full });
  console.log(`OK -> download/preview-${s.name}.png`);
  await browser.close();
}
