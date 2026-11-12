// E2E visual: geocerca en el Acceso Pío Nono (2026-11-13).
// Centra el mapa en el acceso (capa Accesos) y captura la esquina
// Pío Nono × Av. Alberto Mackenna: el marcador debe quedar DENTRO del
// polígono verde de la geocerca (antes quedaba 19 m fuera).
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
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await page.getByRole("button", { name: "Explorar" }).click();
  await page.waitForTimeout(2500);

  // capa Accesos → centrar en Pío Nono (la lista de capas ya es
  // alcanzable tras entrar a Explorar, como en diag-bajadas30.mjs)
  await page.waitForTimeout(600);
  const acc = page.locator("details[data-capa='accesos'] > summary");
  await acc.scrollIntoViewIfNeeded();
  await acc.click();
  await page.waitForTimeout(500);
  await page.locator("button[aria-label='Centrar mapa en Acceso Pío Nono']").click();
  await page.waitForTimeout(2500);
  await page.locator("button:has-text('Capas del mapa')").first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/geocerca-pio-nono-ajuste.png` });
  console.log("captura geocerca-pio-nono-ajuste.png");

  // verificación programática: el marcador del acceso (fill #065f46) debe
  // caer DENTRO del path del polígono del parque (fill #10b981).
  const resultado = await page.evaluate(() => {
    // polígono del parque: path con fill rgb(16,185,129)
    const poly = Array.from(document.querySelectorAll("path")).find((el) =>
      /rgb\(16,\s*185,\s*129\)|#10b981/.test(el.getAttribute("fill") ?? "")
    );
    const marker = Array.from(document.querySelectorAll("path")).find((el) =>
      /rgb\(6,\s*95,\s*70\)|#065f46/.test(el.getAttribute("fill") ?? "")
    );
    if (!poly || !marker) return { ok: false, motivo: "no se encontraron paths" };
    // centro del marcador en px de pantalla
    const mb = marker.getBoundingClientRect();
    const sx = mb.left + mb.width / 2;
    const sy = mb.top + mb.height / 2;
    // punto → unidades locales del path vía getScreenCTM (incluye CSS)
    const sctm = poly.getScreenCTM();
    if (!sctm) return { ok: false, motivo: "sin ScreenCTM" };
    const local = new DOMPoint(sx, sy).matrixTransform(sctm.inverse());
    // prueba nativa de punto-en-polígono de Chromium (SVGGeometryElement)
    const dentro = poly.isPointInFill(new DOMPoint(local.x, local.y));
    return { ok: dentro, motivo: dentro ? "marcador dentro del polígono" : "marcador fuera del polígono" };
  });
  console.log(resultado.ok ? "✓ marcador del acceso DENTRO de la geocerca dibujada" : `✗ ${resultado.motivo}`);

  await browser.close();
  if (!resultado.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
