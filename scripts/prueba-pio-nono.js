// Prueba v1.12.14c (cliente 2026-11-17):
//   1. Botón de sensores Bluetooth en el banner (al lado del de música)
//      + panel de sensores abierto/cerrado.
//   2. Ruta «Ir a... → Acceso Pío Nono»: chip Ciclovía X% · Vía compartida
//      + captura de red (grafo local / OSRM / Overpass) para validar los %.
"use strict";
const { chromium } = require("/opt/zcode/rt/runtime/node_modules/playwright-core");
const EXE = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";
const GEO = { latitude: -33.43721, longitude: -70.64180 };
const fs = require("fs");
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

  // Captura de red para la validación de los % (grafo/OSRM/Overpass).
  const red = [];
  let n = 0;
  page.on("response", async (resp) => {
    const url = resp.url();
    if (/routing\.openstreetmap\.de|overpass|nominatim|photon|\.json/i.test(url)) {
      n++;
      const nombre = `/tmp/red-${n}-${url.replace(/[^a-z0-9]+/gi, "_").slice(0, 60)}.json`;
      try {
        const body = await resp.text();
        fs.writeFileSync(nombre, body);
        red.push({ url: url.slice(0, 160), archivo: nombre, status: resp.status(), bytes: body.length });
      } catch (e) {
        red.push({ url: url.slice(0, 160), error: String(e).slice(0, 80) });
      }
    }
  });

  await page.goto("http://localhost:3000/?gps=1", { waitUntil: "domcontentloaded", timeout: 45000 });
  await sleep(9000);

  // 1. Banner con botón Bluetooth al lado del de música (música solo APK).
  await page.screenshot({ path: "/tmp/sens-1-banner.png" });

  // Panel de sensores abierto desde el botón.
  const btnSens = page.locator('button[aria-label="Abrir sensores Bluetooth"]');
  if (await btnSens.count()) {
    await btnSens.click();
    await sleep(900);
    await page.screenshot({ path: "/tmp/sens-2-panel.png" });
    await btnSens.click(); // cerrar
    await sleep(400);
    console.log("SENSORES_OK");
  } else {
    console.log("SENSORES_BTN_NO");
  }

  // 2. Ruta a Pío Nono desde el «Ir a...» del minimapa.
  const sel = page.locator('select[aria-label*="Ir a"]');
  if (!(await sel.count())) {
    console.log("SELECT_NO");
  } else {
    await sel.selectOption("pio-nono");
    // Espera al chip de la leyenda de la ruta (Ciclovía %).
    let chipTxt = null;
    try {
      await page.getByText(/Ciclovía/).first().waitFor({ state: "visible", timeout: 25000 });
      await sleep(1500); // deja asentar la ruta (flags/pct finales)
      const chip = page.locator("div", { hasText: /Ciclovía/ }).last();
      chipTxt = (await chip.innerText()).replace(/\s+/g, " ").slice(0, 120);
    } catch (e) {
      chipTxt = "CHIP_NO:" + e.message.slice(0, 60);
    }
    // Texto de la barra (ETA/distancia) y avisos visibles.
    const barra = await page.locator("body").innerText().then((t) => {
      const m = t.match(/\d+ min[^\n]{0,40}|\d+(\.\d+)?\s?km[^\n]{0,30}/g);
      return m ? m.slice(0, 4).join(" | ") : "";
    });
    await page.screenshot({ path: "/tmp/sens-3-pio-nono.png" });
    console.log("CHIP:", chipTxt);
    console.log("BARRA:", barra);
  }

  fs.writeFileSync("/tmp/red-log.json", JSON.stringify(red, null, 1));
  console.log("RED:", JSON.stringify(red.map((r) => r.url), null, 0));
  await browser.close();
  console.log("PRUEBA_OK");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
