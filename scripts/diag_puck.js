// Diagnóstico: transforms reales del puck (raíz MapLibre + arrow-wrap interno)
"use strict";
const { chromium } = require("/opt/zcode/rt/runtime/node_modules/playwright-core");
const EXE = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";
const GEO = { latitude: -33.43721, longitude: -70.64180 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, geolocation: GEO, permissions: ["geolocation"], locale: "es-CL" });
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
  await sleep(8000);
  const d = await page.evaluate(() => {
    const root = document.querySelector(".c30-puck");
    const wrap = document.querySelector(".c30-puck-arrow-wrap");
    const m = window.__c30nav;
    return {
      bearing: Math.round(m.getBearing()),
      rootTransform: root ? (root.style.transform || getComputedStyle(root).transform) : null,
      wrapInline: wrap?.style.transform,
      wrapComputed: wrap ? getComputedStyle(wrap).transform : null,
      svgInline: wrap?.querySelector("svg")?.getAttribute("style") || "(sin style)",
    };
  });
  console.log(JSON.stringify(d, null, 1));
  await browser.close();
})().catch((e) => { console.error("FALLO:", e); process.exit(1); });
