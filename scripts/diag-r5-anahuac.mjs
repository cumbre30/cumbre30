// E2E: reproduce lo que ve el cliente en Ruta 5.
// 1) «Ver» (switch) de Ruta 5 → centrar en la curva Anáhuac → captura.
// 2) «Ruta» (generar navegación) de Ruta 5 → centrar en la curva Anáhuac → captura.
// 3) Volcado de las polilíneas dibujadas (paths SVG) para comparar formas.
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
    // posición del cliente al probar (sector Tupahue, dentro del parque)
    geolocation: { latitude: -33.4180, longitude: -70.6270 },
  });
  const p = await ctx.newPage();
  p.on("console", (m) => {
    if (m.type() === "error") console.log("[consola]", m.text().slice(0, 200));
  });
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForTimeout(4000);
  await p.getByRole("button", { name: "Explorar" }).click();
  await p.waitForTimeout(2500);

  const rutasSummary = p.locator("details[data-capa='rutas'] > summary");
  await rutasSummary.scrollIntoViewIfNeeded();
  await rutasSummary.click();
  await p.waitForTimeout(600);

  // --- 1) VER: activar el switch de Ruta 5 ---
  // el SwitchCapa usa data-vercapa={label} → [data-vercapa="ruta-5"]
  const switchR5 = p.locator("button[data-vercapa='ruta-5']");
  console.log("switch ruta-5 count:", await switchR5.count());
  await switchR5.click();
  await p.waitForTimeout(2500); // esperar el flyTo del FocusHandler

  // centrar en la curva Anáhuac vía la fila de Normativa (flyTo del FocusHandler)
  await rutasSummary.click(); // cerrar rutas
  await p.waitForTimeout(300);
  const normSummary = p.locator("details[data-capa='normativa'] > summary");
  await normSummary.scrollIntoViewIfNeeded();
  await normSummary.click();
  await p.waitForTimeout(400);
  const filaAnahuac = p.locator("button[aria-label='Centrar mapa en Advertencia: Curva Casa de la Cultura Anáhuac']");
  await filaAnahuac.scrollIntoViewIfNeeded();
  await filaAnahuac.click();
  await p.waitForTimeout(2200); // esperar flyTo
  // colapsar el panel de capas para ver el mapa completo
  await p.locator("button:has-text('Capas del mapa')").first().click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/r5-ver-anahuac.png` });
  console.log("captura r5-ver-anahuac.png");

  // --- 2) RUTA: quitar la ruta Ver y generar la navegación ---
  const quitar = p.getByText("Quitar ruta");
  if (await quitar.count()) {
    await quitar.click();
    await p.waitForTimeout(1200);
  }
  // re-expandir el panel de capas y abrir el menú Rutas
  await p.locator("button:has-text('Capas del mapa')").first().click();
  await p.waitForTimeout(500);
  // reabrir capas rutas y tocar «Ruta» de Ruta 5
  const rutasSummary2 = p.locator("details[data-capa='rutas'] > summary");
  await rutasSummary2.scrollIntoViewIfNeeded();
  await rutasSummary2.click();
  await p.waitForTimeout(500);
  const btnRutaR5 = p.locator("button[aria-label='Generar ruta: Ruta 5 · Vuelta Completa (4 accesos)']");
  console.log("botón Ruta r5 count:", await btnRutaR5.count());
  const t0 = Date.now();
  await btnRutaR5.click();
  await p.getByText("Quitar ruta").waitFor({ state: "visible", timeout: 30000 });
  console.log(`ruta generada en ${Date.now() - t0} ms`);

  // centrar de nuevo en la curva Anáhuac
  const normSummary2 = p.locator("details[data-capa='normativa'] > summary");
  await normSummary2.scrollIntoViewIfNeeded();
  await normSummary2.click();
  await p.waitForTimeout(400);
  await filaAnahuac.scrollIntoViewIfNeeded();
  await filaAnahuac.click();
  await p.waitForTimeout(2200);
  await p.locator("button:has-text('Capas del mapa')").first().click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/r5-ruta-anahuac.png` });
  console.log("captura r5-ruta-anahuac.png");

  // --- 3) volcado de polilíneas SVG visibles (path d, truncado) ---
  const paths = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll("path.leaflet-interactive, path").forEach((el) => {
      const d = el.getAttribute("d") ?? "";
      const stroke = el.getAttribute("stroke") ?? "";
      if (d.startsWith("M") && stroke && stroke !== "none") {
        out.push(`stroke=${stroke} d=${d.slice(0, 160)}`);
      }
    });
    return out.slice(0, 30);
  });
  console.log("polilíneas visibles:", paths.length);
  for (const s of paths) console.log("  ", s);

  await browser.close();
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
