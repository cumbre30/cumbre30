// Verifica el estado con QR cargado + pantalla completa (inyecta localStorage)
import { chromium } from "playwright";

// PNG 1x1 negro válido (placeholder de "QR")
const PNG_1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 60000 });

await page.evaluate((img) => {
  localStorage.setItem(
    "cumbre30-entry-qr-v1",
    JSON.stringify({ img, savedAt: new Date().toISOString() })
  );
}, PNG_1x1);

await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: /credencial/i }).first().click();
await page.waitForTimeout(1200);
await page.screenshot({ path: "/home/z/my-project/download/preview-credencial-con-qr.png" });

// Pantalla completa
await page.getByRole("button", { name: /ampliar qr/i }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: "/home/z/my-project/download/preview-credencial-full.png" });

console.log("OK -> preview-credencial-con-qr.png / preview-credencial-full.png");
await browser.close();
