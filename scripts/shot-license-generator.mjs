// Screenshot del generador de licencias (vista móvil) para control visual.
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const URL = pathToFileURL("download/cumbre30-generador-licencias.html").href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(URL);
await page.fill("#email", "jhernansm93@gmail.com");
await page.click("#gen");
await page.waitForFunction(() =>
  document.getElementById("resCodigo")?.textContent?.startsWith("C30P-"));
await page.screenshot({ path: "/tmp/render/generador-movil.png", fullPage: true });
await browser.close();
console.log("OK screenshot /tmp/render/generador-movil.png");
