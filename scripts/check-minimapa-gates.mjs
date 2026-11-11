// Verifica que el minimapa dibuja SOLO los 4 accesos ciclistas (fuente "gates").
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(6000);
let res;
for (let i = 0; i < 3; i++) {
  try {
    res = await page.evaluate(async () => {
      const map = window.__c30nav;
      if (!map) return { err: "sin asa __c30nav (canvas aún no montado)" };
      const src = map.getSource("gates");
      if (!src) return { err: "sin fuente gates" };
      const fc = await new Promise((res2) => src.getData(res2));
      return { features: fc.features.length, ids: fc.features.map((f) => f.properties?.id) };
    });
    break;
  } catch (e) {
    await page.waitForTimeout(2500);
  }
}
console.log("minimapa gates:", JSON.stringify(res));
if (res?.features === 4) console.log("OK: 4 accesos ciclistas en el minimapa");
else console.log("REVISAR: esperados 4");
await browser.close();
