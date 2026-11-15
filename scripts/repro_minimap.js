// Reproduce el estado EXACTO del usuario en el video:
// posición GPS ambiental activa (sin ride iniciado), sin course GPS
// (parado), ruta a Pío Nono seleccionada desde el minimap.
// Mide bearing/pitch/zoom de la cámara del minimap + rotación del pin.
"use strict";
const { chromium } = require("/opt/zcode/rt/runtime/node_modules/playwright-core");

const EXE = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";
const URL = "http://localhost:3000/?gps=1";
// Punto tipo video: cerca del acceso Pío Nono (Bellas Artes)
const GEO = { latitude: -33.43721, longitude: -70.64180 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sample(page, label) {
  const d = await page.evaluate(() => {
    const m = window.__c30nav;
    const puck = document.querySelector(".c30-puck-arrow-wrap");
    const arrowT = puck ? puck.style.transform : "sin-flecha";
    // bearing objetivo teórico del tramo lo da la app; medimos lo real
    const banner = (document.querySelector(".c30-minimap")?.textContent || "").slice(0, 90);
    return {
      bearing: m ? Math.round(m.getBearing()) : null,
      pitch: m ? Math.round(m.getPitch()) : null,
      zoom: m ? Number(m.getZoom().toFixed(1)) : null,
      pinTransform: arrowT,
      banner,
    };
  });
  console.log(label, JSON.stringify(d));
  return d;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: EXE,
    args: ["--no-sandbox", "--use-gl=angle", "--enable-webgl"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 },
    geolocation: GEO,
    permissions: ["geolocation"],
    locale: "es-CL",
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await sleep(6000); // GPS ambiental → posición; mapa listo

  // Seleccionar Pío Nono en el minimap ("Ir a…")
  await page.evaluate(() => {
    const sel = document.querySelector('.c30-minimap select[aria-label="Ir a"]');
    if (!sel) throw new Error("no select Ir a");
    const opt = [...sel.options].find((o) => /Pío Nono/i.test(o.textContent || ""));
    if (!opt) throw new Error("no option Pío Nono");
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    setter.call(sel, opt.value);
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  });
  console.log("== ruta seleccionada: Pío Nono (sin ride, GPS ambiental parado) ==");
  for (let i = 0; i < 6; i++) {
    await sleep(2200);
    await sample(page, `t+${(i + 1) * 2.2}s`);
  }
  await page.screenshot({ path: "/tmp/vidframes/repro_minimap.png", clip: { x: 0, y: 210, width: 412, height: 380 } });
  console.log("screenshot: /tmp/vidframes/repro_minimap.png");
  await browser.close();
})().catch((e) => {
  console.error("FALLO:", e);
  process.exit(1);
});
