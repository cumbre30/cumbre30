// Captura el minimap completo (elemento .c30-minimap) con ruta a Pío Nono
// activa y GPS parado — para ver ruta, pin y orientación de la vista.
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
  await sleep(6000);
  await page.evaluate(() => {
    const sel = document.querySelector('.c30-minimap select[aria-label="Ir a"]');
    const opt = [...sel.options].find((o) => /Pío Nono/i.test(o.textContent || ""));
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    setter.call(sel, opt.value);
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await sleep(9000);
  const info = await page.evaluate(() => {
    const m = window.__c30nav;
    const pin = document.querySelector(".c30-puck-arrow-wrap");
    const st = pin ? getComputedStyle(pin).transform : "none";
    return { bearing: Math.round(m.getBearing()), pinCss: st, pinInline: pin?.style.transform };
  });
  console.log(JSON.stringify(info));
  const box = await page.locator(".c30-minimap").boundingBox();
  await page.screenshot({ path: "/tmp/vidframes/minimap_full.png", clip: box });
  console.log("ok minimap_full.png", JSON.stringify(box));
  await browser.close();
})().catch((e) => { console.error("FALLO:", e); process.exit(1); });
