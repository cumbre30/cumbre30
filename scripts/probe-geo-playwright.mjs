// Sonda: ¿Playwright entrega la geolocalización simulada a la app?
import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 405, height: 720 } });
await ctx.grantPermissions(["geolocation"]);
await ctx.setGeolocation({ latitude: -33.403, longitude: -70.633, accuracy: 12 });
const page = await ctx.newPage();

await page.goto("http://localhost:81", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(3_000);

const perm = await page.evaluate(async () => {
  try {
    const s = await navigator.permissions.query({ name: "geolocation" });
    return `permissions:${s.state}`;
  } catch (e) {
    return `permissions-error:${e.message}`;
  }
});
console.log(perm);

const pos = await page.evaluate(
  () =>
    new Promise((res) => {
      if (!navigator.geolocation) return res("NO-GEO-API");
      navigator.geolocation.getCurrentPosition(
        (p) => res(`OK lat=${p.coords.latitude} lon=${p.coords.longitude} acc=${p.coords.accuracy}`),
        (e) => res(`ERR code=${e.code} msg=${e.message}`),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10_000 }
      );
    })
);
console.log(pos);

await browser.close();
