// Capturas de verificación visual (2026-11-12):
//  · Ruta 1 encuadrada: nace en el cruce Av. El Cerro × Av. PdV Norte
//  · Normativa: corte horario EN el puente Mackenna-Bannen (zoom Tupahue)
import { chromium } from "playwright";

const BASE = "http://localhost:3000/";
const OUT = "/tmp/render";

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  await p.getByRole("button", { name: "Explorar" }).click();
  await p.waitForTimeout(2500);

  // dibuja Ruta 1 y encuadra
  await p.locator("details[data-capa='rutas'] > summary").click();
  await p.waitForTimeout(400);
  await p.locator("button[data-vercapa='ruta-1']").click();
  await p.waitForTimeout(800);
  await p.locator("button[aria-label='Encuadrar Ruta 1 · Clásica Cumbre por Pedro de Valdivia']").click();
  await p.waitForTimeout(2200);
  // cierra el panel para ver el mapa completo
  await p.locator("button[aria-expanded]").first().click();
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/zoom-ruta1-pdv.png` });

  // zoom al puente de Tupahue con la capa normativa activa
  // (el panel quedó plegado tras la captura anterior: reabrirlo)
  await p.locator("button[aria-expanded]").first().click();
  await p.waitForTimeout(600);
  await p.locator("details[data-capa='normativa'] > summary").scrollIntoViewIfNeeded();
  await p.locator("details[data-capa='normativa'] > summary").click();
  await p.waitForTimeout(400);
  const sw = p.locator("button[data-vercapa='normativa']");
  if (await sw.count()) await sw.click();
  await p.waitForTimeout(1200);
  // centrar el mapa EN el puente con el botón «Centrar mapa en…» de la fila
  await p.locator("button[aria-label='Centrar mapa en Corte horario fin de semana (Tupahue → Cumbre)']").click();
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `${OUT}/zoom-puente-corte.png` });

  await browser.close();
  console.log("capturas listas");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
