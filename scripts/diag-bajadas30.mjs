// E2E: bajadas del control 30 km/h (cliente 2026-11-13).
// 1) Activa la capa Normativa y Seguridad → verifica el ítem del control
//    con su detalle de las 3 bajadas.
// 2) Vuelca las polilíneas rojas (#dc2626) visibles: deben ser 3.
// 3) Capturas: bajada Plaza México → Pío Nono y zona Antilén/La Pirámide.
import { chromium } from "playwright";

const BASE = "http://localhost:3000/";
const OUT = "/tmp/render";

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    permissions: ["geolocation"],
    geolocation: { latitude: -33.4234, longitude: -70.6327 }, // Plaza México
  });
  const p = await ctx.newPage();
  p.on("console", (m) => {
    if (m.type() === "error") console.log("[consola]", m.text().slice(0, 160));
  });
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForTimeout(4000);
  await p.getByRole("button", { name: "Explorar" }).click();
  await p.waitForTimeout(2500);

  // abrir el panel de capas y la sección Normativa y Seguridad
  const normSummary = p.locator("details[data-capa='normativa'] > summary");
  await normSummary.scrollIntoViewIfNeeded();
  await normSummary.click();
  await p.waitForTimeout(600);

  // marcar la capa (el switch «Ver» del bloque) → dibuja círculos + 3 bajadas rojas
  const switchNorm = p.locator("button[data-vercapa='normativa']");
  console.log("switch normativa count:", await switchNorm.count());
  await switchNorm.click();
  await p.waitForTimeout(1500);

  const bodyNorm = await p.locator("details[data-capa='normativa']").innerText();
  const okItem = /Control velocidad máx\. 30 km\/h \(bajadas principales\)/.test(bodyNorm);
  const okDetalle = /Cima Chacarillas → Acceso La Pirámide/.test(bodyNorm) && /Plaza México → Acceso Pío Nono/.test(bodyNorm);
  console.log(okItem ? "✓ ítem Control velocidad 30 km/h presente" : "✗ falta el ítem control 30");
  console.log(okDetalle ? "✓ detalle lista las 3 bajadas" : "✗ detalle sin las 3 bajadas");

  // polilíneas rojas visibles (SVG paths con stroke #dc2626)
  const rojas = await p.evaluate(() => {
    const paths = Array.from(document.querySelectorAll("path[stroke='#dc2626'], path[stroke='rgb(220, 38, 38)']"));
    return paths.filter((el) => {
      const d = el.getAttribute("d") ?? "";
      return d.length > 40 && !/^M0 0$/.test(d);
    }).length;
  });
  console.log(rojas >= 3 ? `✓ ${rojas} trazados rojos visibles (>=3)` : `✗ solo ${rojas} trazados rojos visibles`);

  // colapsar panel y capturar la bajada Plaza México → Pío Nono
  await p.locator("button:has-text('Capas del mapa')").first().click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/b30-plaza-mexico-pionono.png` });
  console.log("captura b30-plaza-mexico-pionono.png");

  // volar al sector Antilén (bajadas b30-piramide y b30-pdv pasan por ahí)
  await p.locator("button:has-text('Capas del mapa')").first().click();
  await p.waitForTimeout(500);
  const normSummary2 = p.locator("details[data-capa='normativa'] > summary");
  await normSummary2.scrollIntoViewIfNeeded();
  await normSummary2.click();
  await p.waitForTimeout(500);
  const filaAntilen = p.locator("button[aria-label='Centrar mapa en Advertencia: Cruce Piscina Antilén']");
  await filaAntilen.scrollIntoViewIfNeeded();
  await filaAntilen.click();
  await p.waitForTimeout(2200);
  await p.locator("button:has-text('Capas del mapa')").first().click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/b30-antilen.png` });
  console.log("captura b30-antilen.png");

  const fallos = [okItem, okDetalle, rojas >= 3].filter((x) => !x).length;
  console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLAS`);
  await browser.close();
  process.exit(fallos === 0 ? 0 : 1);
}

main();
