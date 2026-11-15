// Verificación completa de los 3 estados del minimap:
//  A) Sin posición GPS (GPS denegado) + ruta activa → overview girada al
//     rumbo inicial del trazado (antes: norte arriba con la ruta acostada
//     = el estado clavado del video del cliente).
//  B) Riding demo en marcha → cámara sigue course GPS y el pin queda arriba.
"use strict";
const { chromium } = require("/opt/zcode/rt/runtime/node_modules/playwright-core");
const EXE = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nuevoCtx(browser, geo) {
  const opts = { viewport: { width: 412, height: 915 }, locale: "es-CL" };
  if (geo) { opts.geolocation = geo; opts.permissions = ["geolocation"]; }
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  return page;
}

async function seleccionarPioNono(page) {
  await page.evaluate(() => {
    const sel = document.querySelector('.c30-minimap select[aria-label="Ir a"]');
    const opt = [...sel.options].find((o) => /Pío Nono/i.test(o.textContent || ""));
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    setter.call(sel, opt.value);
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function cam(page) {
  return page.evaluate(() => {
    const m = window.__c30nav;
    const wrap = document.querySelector(".c30-puck-arrow-wrap");
    const root = document.querySelector(".c30-puck");
    const rz = root ? (root.style.transform.match(/rotateZ\((-?[\d.]+)deg\)/) || [])[1] : null;
    const wi = wrap ? (wrap.style.transform.match(/rotate\((-?[\d.]+)deg\)/) || [])[1] : null;
    const net = rz !== undefined && wi !== undefined && rz !== null && wi !== null
      ? Math.round(((((-rz) + +wi) % 360) + 360) % 360) // -rootZ + wrapZ = ángulo en pantalla
      : null;
    return { bearing: m ? Math.round(m.getBearing()) : null, pitch: m ? Math.round(m.getPitch()) : null, rootZ: rz ? Math.round(+rz) : null, wrap: wi ? Math.round(+wi) : null, pinEnPantalla: net };
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

  // ---- A) GPS denegado: overview con ruta activa ----
  let page = await nuevoCtx(browser, null);
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await sleep(7000);
  await seleccionarPioNono(page);
  await sleep(6000);
  console.log("A) overview sin posición:      ", JSON.stringify(await cam(page)));
  await browser.close();

  // ---- B) riding demo (sim moviéndose, course por recorrido) ----
  const browser2 = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  page = await nuevoCtx(browser2, null);
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await sleep(6000);
  await seleccionarPioNono(page);
  await sleep(2500);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /Iniciar ride/i.test(b.textContent || ""));
    if (btn) btn.click();
  });
  await sleep(15000); // que el sim avance ~unos cientos de metros (12x)
  console.log("B) riding demo (sim en marcha):", JSON.stringify(await cam(page)));
  await sleep(6000);
  console.log("B2) riding +6s:                ", JSON.stringify(await cam(page)));
  const box = await page.locator(".c30-minimap").boundingBox();
  await page.screenshot({ path: "/tmp/vidframes/minimap_riding.png", clip: box });
  await browser2.close();
  console.log("ok");
})().catch((e) => { console.error("FALLO:", e); process.exit(1); });
