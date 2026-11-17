// Capturas de verificación v1.12.14b (cliente 2026-11-17):
//   1. Ride: minimapa con base CARTO Voyager (estética OMT).
//   2. Explorar: MapView con Voyager + attribution legible y la
//      barra de capas subida.
//   3. Explorar: modal Pro del buscador de direcciones SOBRE las
//      capas del mapa (z-index corregido).
//   4. Configuración → Minimapa: vista previa con la base nueva.
"use strict";
const { chromium } = require("/opt/zcode/rt/runtime/node_modules/playwright-core");
const EXE = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";
const GEO = { latitude: -33.43721, longitude: -70.64180 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 },
    geolocation: GEO,
    permissions: ["geolocation"],
    locale: "es-CL",
  });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/?gps=1", { waitUntil: "domcontentloaded", timeout: 45000 });
  await sleep(9000);
  // 1. Ride con minimapa Voyager.
  await page.screenshot({ path: "/tmp/omt-1-ride.png" });
  console.log("shot 1 ok");

  // 2. Pestaña Explorar: MapView + attribution + barra de capas.
  await page.getByText("Explorar").first().click();
  await sleep(4500);
  await page.screenshot({ path: "/tmp/omt-2-explorar.png" });
  console.log("shot 2 ok");

  // 3. Modal Pro del buscador de direcciones (barra con badge PRO).
  await page.click('button[aria-label*="Buscador universal"]', { timeout: 8000 });
  await sleep(900);
  await page.screenshot({ path: "/tmp/omt-3-modal-pro.png" });
  console.log("shot 3 ok");
  await page.getByText("Ahora no").first().click();
  await sleep(600);

  // 4. Configuración → Personalización → Minimapa (preview con base nueva).
  await page.click('button[aria-label="Abrir menú"]', { timeout: 8000 });
  await sleep(800);
  await page.getByText("Configuración").first().click();
  await sleep(800);
  await page.getByText("Personalización").first().click();
  await sleep(800);
  await page.getByText("Minimapa").first().click();
  await sleep(2500);
  await page.screenshot({ path: "/tmp/omt-4-preview.png" });
  console.log("shot 4 ok");

  await browser.close();
  console.log("CAPTURAS_OK");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
