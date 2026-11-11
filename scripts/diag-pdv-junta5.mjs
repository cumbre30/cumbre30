// Captura final: panel colapsado con data-testid, acceso PdV al centro.
import { chromium } from "playwright";

const BASE = "http://localhost:3000/";
const OUT = "/tmp/render";

async function main() {
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream"] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);

  await page.getByRole("button", { name: "Explorar" }).click();
  await page.waitForTimeout(2200);

  const panel = page.locator("[data-testid='capas-panel']").first();
  const header = panel.locator("> button").first();
  const detAcc = panel.locator("details", { hasText: "Entradas y salidas oficiales" }).first();

  await detAcc.locator("summary").click();
  await page.waitForTimeout(500);
  await detAcc.locator("button[aria-label='Centrar mapa en Acceso Pedro de Valdivia Norte']").click();
  await page.waitForTimeout(1200);
  // colapsar el panel (el botón header mantiene abierto=true)
  if ((await header.getAttribute("aria-expanded")) === "true") {
    await header.click();
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: `${OUT}/pdv-junta-final.png` });

  const map = page.locator(".leaflet-container").first();
  const bb = await map.boundingBox();
  await map.dblclick({ position: { x: bb.width / 2, y: bb.height / 2 - 60 } });
  await page.waitForTimeout(1700);
  await page.screenshot({ path: `${OUT}/pdv-junta-final-z16.png` });

  await browser.close();
  console.log("OK captura final");
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
