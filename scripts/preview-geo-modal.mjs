// Capturas del modal de detalle (/geo) para revisión del cliente.
// Requiere servidor corriendo en BASE_URL (default http://localhost:3210).
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3210";
const OUT = "/home/z/my-project/download";

const browser = await chromium.launch();

// ── Escritorio ──
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.goto(BASE + "/geo", { waitUntil: "networkidle", timeout: 60_000 });
await page.locator(".tarjeta").first().getByRole("button", { name: "Ver detalles" }).click();
await page.waitForTimeout(700);
const modal = page.locator("#geo-root .modal");

// 1. Modal completo (estado inicial: APK + capturas + acordeón)
await modal.screenshot({ path: `${OUT}/preview-geo-modal.png` });

// 2. Final del cuerpo: pills de contacto / privacidad / eliminar cuenta
await page.evaluate(() => {
  const body = document.querySelector("#geo-root .modal-cuerpo");
  body?.scrollTo({ top: body.scrollHeight });
});
await page.waitForTimeout(350);
await modal.screenshot({ path: `${OUT}/preview-geo-modal-accesos.png` });

// 3. Cerzo de la fila de pills (zoom al bloque nuevo)
const pills = page.locator("#geo-root .modal-enlaces");
await pills.screenshot({ path: `${OUT}/preview-geo-modal-accesos-zoom.png` });
await page.close();

// ── Móvil ──
const movil = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await movil.goto(BASE + "/geo", { waitUntil: "networkidle", timeout: 60_000 });
await movil.locator(".tarjeta").first().getByRole("button", { name: "Ver detalles" }).click();
await movil.waitForTimeout(700);
await movil.locator("#geo-root .modal-enlaces").scrollIntoViewIfNeeded();
await movil.waitForTimeout(400);
await movil.screenshot({ path: `${OUT}/preview-geo-modal-movil.png` });

await browser.close();
console.log("OK capturas modal");
