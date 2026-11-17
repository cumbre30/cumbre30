// Capturas de alta resolución (3x) del kit de redes sociales Cumbre30.
// Todas en español, modo oscuro, con GPS demo activo.
"use strict";
const { chromium } = require("/opt/zcode/rt/runtime/node_modules/playwright-core");
const EXE = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";
const GEO = { latitude: -33.43721, longitude: -70.64180 };
const OUT = "/tmp/kit";
const fs = require("fs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 3,
    geolocation: GEO,
    permissions: ["geolocation"],
    locale: "es-CL",
  });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/?gps=1", { waitUntil: "domcontentloaded", timeout: 45000 });
  await sleep(9000);

  // 1. Ride: velocímetro + banner + minimapa.
  await page.screenshot({ path: `${OUT}/app-ride.png` });
  console.log("cap 1 ride ok");

  // 2. Ride con ruta a Pío Nono (minimapa con ruta + chip ciclovía).
  await page.locator('select[aria-label*="Ir a"]').selectOption("pio-nono");
  try {
    await page.getByText(/Ciclovía/).first().waitFor({ state: "visible", timeout: 25000 });
  } catch {}
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/app-ruta.png` });
  console.log("cap 2 ruta ok");

  // 3. Sensores Bluetooth abiertos (novedad v1.12.14).
  const btnSens = page.locator('button[aria-label="Abrir sensores Bluetooth"]');
  if (await btnSens.count()) {
    await btnSens.click();
    await sleep(900);
    await page.screenshot({ path: `${OUT}/app-sensores.png` });
    await btnSens.click();
    await sleep(400);
    console.log("cap 3 sensores ok");
  }

  // 4. Tarjeta SOS (seguridad).
  const btnSos = page.locator('button[aria-label="Abrir tarjeta de emergencia"]');
  if (await btnSos.count()) {
    await btnSos.click();
    await sleep(1200);
    await page.screenshot({ path: `${OUT}/app-sos.png` });
    await page.keyboard.press("Escape");
    await sleep(400);
    // posible overlay de cierre
    const cerrar = page.getByText(/Cerrar|Listo|Ahora no/).first();
    if (await cerrar.count()) { try { await cerrar.click(); } catch {} }
    await sleep(400);
    console.log("cap 4 sos ok");
  }

  // 5. Explorar: mapa del parque con capas.
  await page.getByText("Explorar").first().click();
  await sleep(5000);
  await page.screenshot({ path: `${OUT}/app-mapa.png` });
  console.log("cap 5 mapa ok");

  await browser.close();
  console.log("CAPTURAS_KIT_OK");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
