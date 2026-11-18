// Verificación puntual: estado final del splash (stub visible tras el desvanecido).
"use strict";
const { chromium } = require("/opt/zcode/rt/runtime/node_modules/playwright-core");
const EXE = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 412, height: 880 } });
  await page.goto("file:///home/z/my-project/download/propuestas-animacion/propuesta-B-splash-cumbre30.html");
  await sleep(6300);
  await page.screenshot({ path: "/tmp/anim/b-final2.png" });
  await browser.close();
  console.log("STUB_CHECK_OK");
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
