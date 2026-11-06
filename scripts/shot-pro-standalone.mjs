// Screenshot del HTML autónomo (file://) para verificación visual
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto("file:///home/z/my-project/download/cumbre30-pro.html");
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/render/standalone-top.png" });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/render/standalone-bottom.png" });
console.log("OK");
await browser.close();
