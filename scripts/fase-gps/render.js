// Render del diagrama de arquitectura (Playwright + CSS, layout C).
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
  await page.goto("file:///home/z/my-project/scripts/fase-gps/diagrama.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const el = page.locator("#root");
  const bbox = await el.boundingBox();
  if (bbox) {
    await page.setViewportSize({ width: Math.max(1200, Math.ceil(bbox.width + 100)), height: Math.ceil(bbox.height + 100) });
    await page.waitForTimeout(200);
  }
  await el.screenshot({ path: "/home/z/my-project/scripts/fase-gps/diagrama_arquitectura.png" });
  await browser.close();
  const fs = require("fs");
  console.log("PNG:", fs.statSync("/home/z/my-project/scripts/fase-gps/diagrama_arquitectura.png").size, "bytes");
})();
