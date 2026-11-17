// Capturas de verificación del release v1.12.14 (cliente 2026-11-17):
//   1. Ride con velocímetro "neon" y minimapa CyclOSM.
//   2. Configuración → Personalización → Velocímetro: preview "Neón".
//   3. Ídem con estilo "Rayos".
//   4. Configuración → Personalización → Minimapa: vista previa nueva.
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
  // Tema inicial: velocímetro Neón + minimapa Clásico.
  await page.addInitScript(() => {
    localStorage.setItem(
      "cumbre30-ridetheme-v1",
      JSON.stringify({ color: "cerro", speedoStyle: "neon", speedoSize: "normal", minimapSize: "normal", minimapStyle: "clasico" })
    );
  });
  await page.goto("http://localhost:3000/?gps=1", { waitUntil: "domcontentloaded", timeout: 45000 });
  await sleep(9000);
  // 1. Ride: velocímetro neon + minimapa (CyclOSM).
  await page.screenshot({ path: "/tmp/shot-1-ride-neon.png" });
  console.log("shot 1 ok");

  // 2. Menú (icono hamburguesa, arriba a la derecha) → Configuración
  //    → Personalización → Velocímetro.
  await page.click('button[aria-label="Abrir menú"]', { timeout: 8000 });
  await sleep(900);
  const diagnostico = await page.evaluate(() => {
    const labels = [...document.querySelectorAll("button")].map((b) => b.getAttribute("aria-label") || b.textContent?.trim().slice(0, 22)).filter(Boolean);
    const hayCfg = [...document.querySelectorAll("button,li,a")].some((el) => el.textContent?.includes("Configuración"));
    return { labels: labels.slice(0, 14), hayCfg };
  });
  console.log("DIAG:", JSON.stringify(diagnostico));
  await page.getByText("Configuración").first().click();
  await sleep(900);
  await page.getByText("Personalización").first().click();
  await sleep(900);
  await page.getByText("Velocímetro").first().click();
  await sleep(1200);
  await page.screenshot({ path: "/tmp/shot-2-velocimetro-neon.png" });
  console.log("shot 2 ok");

  // 3. Cambiar a estilo Rayos.
  await page.getByText("Rayos").first().click();
  await sleep(1200);
  await page.screenshot({ path: "/tmp/shot-3-velocimetro-rayos.png" });
  console.log("shot 3 ok");

  // 4. Volver → Personalización → Minimapa (vista previa nueva).
  await page.getByText("Volver").first().click();
  await sleep(800);
  await page.getByText("Minimapa").first().click();
  await sleep(2500);
  await page.screenshot({ path: "/tmp/shot-4-minimapa-preview.png" });
  console.log("shot 4 ok");

  // 5. Preview con marco Tarjeta (cambia el acabado).
  await page.getByText("Tarjeta").first().click();
  await sleep(1200);
  await page.screenshot({ path: "/tmp/shot-5-minimapa-tarjeta.png" });
  console.log("shot 5 ok");

  await browser.close();
  console.log("CAPTURAS_OK");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
