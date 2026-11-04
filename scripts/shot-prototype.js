// Capturas del prototipo: recorte del elemento .phone a 2x para el PDF
const { chromium } = require('playwright');
const path = require('path');

const SRC = 'file://' + path.resolve('/home/z/my-project/download/Cumbre30_Prototipo_Rediseno.html');
const OUT = '/tmp/proto/fig';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
  await page.goto(SRC);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(700);
  const phone = page.locator('.phone');

  // 1. Ride detenido (FREE, con ruta activa en minimapa)
  await phone.screenshot({ path: `${OUT}-ride-idle.png` });

  // 2. Ride en marcha (velocidad 23+)
  await page.evaluate('startRide()');
  await page.waitForTimeout(3400);
  await phone.screenshot({ path: `${OUT}-ride-run.png` });

  // 3. Drawer FREE
  await page.evaluate('stopRide(); openDrawer()');
  await page.waitForTimeout(450);
  await phone.screenshot({ path: `${OUT}-drawer.png` });

  // 4. Explorar PRO con resultados
  await page.evaluate('closeDrawer(); setPlan(true); goto("explorar"); onSearch("Providencia")');
  await page.waitForTimeout(450);
  await phone.screenshot({ path: `${OUT}-explorar.png` });

  // 5. Modal bloqueo PRO (FREE)
  await page.evaluate('setPlan(false); onSearchFocus()');
  await page.waitForTimeout(450);
  await phone.screenshot({ path: `${OUT}-modal.png` });

  // 6. Planes
  await page.evaluate('closeModal(); goto("planes")');
  await page.waitForTimeout(350);
  await phone.screenshot({ path: `${OUT}-planes.png` });

  await browser.close();
  console.log('OK capturas');
})().catch((e) => { console.error(e); process.exit(1); });
