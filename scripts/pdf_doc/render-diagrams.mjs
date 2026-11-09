// Renderiza los 3 diagramas HTML a PNG @2x (300dpi equivalente) para embeber en el PDF.
// Uso: node render-diagrams.js
import { chromium } from "playwright";
import path from "path";

const BASE = "/home/z/my-project/scripts/pdf_doc";
const OUT = path.join(BASE, "assets");
const DIAGRAMS = ["diagrama1-gps", "diagrama2-pipeline", "diagrama3-pro"];

const browser = await chromium.launch();
for (const name of DIAGRAMS) {
  const page = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 2 });
  await page.goto("file://" + path.join(BASE, name + ".html"), { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  const el = page.locator(".canvas");
  await el.screenshot({ path: path.join(OUT, name + ".png") });
  const box = await el.boundingBox();
  console.log("OK", name, Math.round(box.width) + "x" + Math.round(box.height));
  await page.close();
}
await browser.close();
console.log("Diagramas listos");
