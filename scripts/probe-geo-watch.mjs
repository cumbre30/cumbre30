// Sonda 2: qué error recibe la app en watchPosition con permiso concedido.
import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080/405, isMobile: true, hasTouch: true });
await ctx.grantPermissions(["geolocation"]);
await ctx.setGeolocation({ latitude: -33.403, longitude: -70.633, accuracy: 12 });
const page = await ctx.newPage();

// Envuelve watchPosition ANTES de que cargue la app para registrar errores.
await page.addInitScript(() => {
  const orig = navigator.geolocation.watchPosition.bind(navigator.geolocation);
  navigator.geolocation.watchPosition = (ok, err, opts) => {
    const wrappedErr = (e) => {
      console.warn(`[GEO-WATCH-ERR] code=${e.code} msg=${e.message}`);
      if (err) err(e);
    };
    return orig(ok, wrappedErr, opts);
  };
  const origCur = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
  navigator.geolocation.getCurrentPosition = (ok, err, opts) => {
    const wrappedErr = (e) => {
      console.warn(`[GEO-CURRENT-ERR] code=${e.code} msg=${e.message}`);
      if (err) err(e);
    };
    return origCur(ok, wrappedErr, opts);
  };
});

page.on("console", (m) => {
  const t = m.text();
  if (t.includes("GEO-")) console.log("PAGE:", t);
});

await page.goto("http://localhost:81", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(8_000);

// ¿Qué dice el chip ahora?
const chip = await page.locator("header, header ~ *").first().textContent().catch(() => "—");
const body = await page.textContent("body");
const m = body.match(/GPS[^\n]{0,20}/);
console.log("chip-ish:", m ? m[0] : "no-match");

await browser.close();
