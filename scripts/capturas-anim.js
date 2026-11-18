// Capturas temporizadas de las dos propuestas de animación.
"use strict";
const { chromium } = require("/opt/zcode/rt/runtime/node_modules/playwright-core");
const EXE = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";
const OUT = "/tmp/anim";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const A = "file:///home/z/my-project/download/propuestas-animacion/propuesta-A-logo-cumbregeo.html";
const B = "file:///home/z/my-project/download/propuestas-animacion/propuesta-B-splash-cumbre30.html";

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

  // ── Propuesta A (web /geo, escritorio) ──
  const ctxA = await browser.newContext({ viewport: { width: 900, height: 640 } });
  const pa = await ctxA.newPage();
  await pa.goto(A); await sleep(600);
  await pa.screenshot({ path: `${OUT}/a-t05.png` });      // trazo dibujándose
  await pa.reload(); await sleep(1350);
  await pa.screenshot({ path: `${OUT}/a-t13.png` });      // sol amaneciendo + letras
  await pa.reload(); await sleep(2800);
  await pa.screenshot({ path: `${OUT}/a-t28.png` });      // estado final
  await pa.click("#b-compacta"); await sleep(1500);
  await pa.screenshot({ path: `${OUT}/a-compacta.png` }); // variante compacta
  await ctxA.close();

  // ── Propuesta B (splash app, móvil) ──
  const ctxB = await browser.newContext({ viewport: { width: 412, height: 880 } });
  const pb = await ctxB.newPage();
  await pb.goto(B); await sleep(900);
  await pb.screenshot({ path: `${OUT}/b-t09.png` });      // inicio: wordmark + ciclista abajo
  await pb.reload(); await sleep(2200);
  await pb.screenshot({ path: `${OUT}/b-t22.png` });      // subiendo, barra ~62%
  await pb.reload(); await sleep(3600);
  await pb.screenshot({ path: `${OUT}/b-t36.png` });      // cerca de la cumbre
  await pb.reload(); await sleep(6300);
  await pb.screenshot({ path: `${OUT}/b-t63.png` });      // splash desvanecido → stub app
  await ctxB.close();

  await browser.close();
  console.log("CAPTURAS_ANIM_OK");
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
