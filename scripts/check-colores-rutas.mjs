import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3000);
await page.selectOption('select[aria-label="Ir a"]', { label: "🗺 Revisa el listado completo" });
await page.waitForTimeout(2200);
const abrir = async (id) => {
  const det = page.locator(`details[data-capa="${id}"]`);
  if (!(await det.getAttribute("open") !== null)) { await det.locator("summary").click(); await page.waitForTimeout(300); }
};
await abrir("rutas");
await page.locator('button[data-vercapa="ruta-2"]').click();
await page.locator('button[data-vercapa="mtb-1"]').click();
await page.waitForTimeout(1200);
const c = await page.evaluate(() => {
  const paths = Array.from(document.querySelectorAll(".leaflet-overlay-pane svg path"));
  const by = {};
  for (const p of paths) {
    const s = p.getAttribute("stroke");
    by[s] = (by[s] ?? 0) + 1;
    if (s === "#f97316") by.mtbDash = p.getAttribute("stroke-dasharray");
  }
  return by;
});
console.log("paths por stroke:", JSON.stringify(c));
console.log(c["#0ea5e9"] >= 1 ? "OK pavimento azul" : "FALTA pavimento");
console.log(c["#f97316"] >= 1 && c.mtbDash === "10 8" ? "OK MTB naranja punteado (10 8)" : "REVISAR MTB");
await browser.close();
