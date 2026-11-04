// Captura PNG 2x de un HTML local (para embeber diagramas en PDF)
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const [,, htmlPath, outPath, widthArg] = process.argv;
  const width = parseInt(widthArg || '1180', 10);
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width, height: 800 },
    deviceScaleFactor: 2,
  });
  await page.goto('file://' + path.resolve(htmlPath));
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600); // fuentes
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
  console.log('OK', outPath);
})().catch((e) => { console.error(e); process.exit(1); });
