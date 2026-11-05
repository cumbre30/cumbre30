// Zoom visual sobre el pin 🏁 de un destino en el mapa de Explorar
// (variante FREE: lista de destinos del cerro con botón "Ruta").
// Uso: node scripts/shot-cumbre-zoom.mjs [BASE] [texto destino]
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:81";
const DEST = process.argv[3] || "🏔️ Cumbre del Cerro";

async function flagCenter(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll(".leaflet-marker-icon")];
    const el = els.find((e) => (e.textContent || "").includes("🏁"));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByText("Cumbre").first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1_500);

  await page.getByRole("button", { name: "Explorar" }).first().click();
  await page.waitForTimeout(1_500);

  // lista FREE de destinos del cerro → destino → botón Ruta
  const row = page.getByText(DEST).first();
  await row.waitFor({ timeout: 15_000 });
  await page.screenshot({ path: "/tmp/render/dest-lista.png" });

  // trazar la ruta: botón "Ruta" de esa fila (o el nombre, que también traza)
  const fila = page.locator("li", { hasText: DEST.replace(/^[^ ]+ /, "") }).first();
  await fila.getByRole("button", { name: "Ruta", exact: true }).click();
  await page.waitForTimeout(3_500);

  // píldora con la distancia (destino · X km · ~Y min en bici)
  const pillRx = new RegExp(DEST.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " · .+km");
  const pill = await page.getByText(pillRx).first().textContent().catch(() => null);
  console.log("píldora de ruta:", pill?.trim() ?? "(no visible)");
  await page.screenshot({ path: "/tmp/render/cumbre-explore.png" });

  // zoom ×3 con doble clic centrado en el pin 🏁
  for (let i = 0; i < 3; i++) {
    const c = await flagCenter(page);
    if (!c) { console.log("pin 🏁 no encontrado en la pasada", i); break; }
    await page.mouse.dblclick(c.x, c.y);
    await page.waitForTimeout(1_100);
  }
  await page.waitForTimeout(2_000);
  const fin = await flagCenter(page);
  console.log("pin 🏁 tras zoom:", fin ? `(${fin.x.toFixed(0)}, ${fin.y.toFixed(0)})` : "fuera de vista");
  await page.screenshot({ path: "/tmp/render/cumbre-zoom.png" });

  if (errors.length) console.log("pageerrors:", errors.slice(0, 3).join(" | "));
  console.log(`ok → dest-lista.png, dest-explore.png, dest-zoom.png (${DEST})`);
  await browser.close();
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
