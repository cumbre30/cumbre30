// Screenshot de la página /pro para verificación visual
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto("http://localhost:3000/pro", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.screenshot({ path: "/tmp/render/pro-top.png" });
// scroll al final para ver FAQ + footer
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(600);
await page.screenshot({ path: "/tmp/render/pro-bottom.png" });
console.log("OK screenshots");
await browser.close();
