// Captura del ride con el velocímetro "Rayos" (tema inyectado por
// localStorage; la preview de config lo bloquea si no hay Pro).
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
  // Escuchar errores de consola (identificar el "1 Issue" del overlay dev).
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") console.log("CONSOLA:", m.type(), m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));
  await page.addInitScript(() => {
    localStorage.setItem(
      "cumbre30-ridetheme-v1",
      JSON.stringify({ color: "cerro", speedoStyle: "rayos", speedoSize: "normal", minimapSize: "normal", minimapStyle: "clasico" })
    );
  });
  await page.goto("http://localhost:3000/?gps=1", { waitUntil: "domcontentloaded", timeout: 45000 });
  await sleep(9000);
  await page.screenshot({ path: "/tmp/shot-6-ride-rayos.png" });
  console.log("shot 6 ok");
  await browser.close();
  console.log("OK");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
