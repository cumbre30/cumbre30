// Captura el minimapa de Ride (barra inferior con el selector limpio).
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(7000);
await page.screenshot({ path: "/tmp/render/minimapa-ride.png", clip: { x: 0, y: 50, width: 390, height: 500 } });
await browser.close();
console.log("SHOT_OK");
