// Diagnóstico v2: banner de avisos (siempre visible) + caja-filtro con toggle estable
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/render";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3000);

// 1) Icono de avisos visible en idle
const avisosBtn = page.getByRole("button", { name: /avisos y restricciones/i });
console.log("Icono avisos visible (idle):", await avisosBtn.count());
await avisosBtn.click({ timeout: 10000 });
await page.waitForTimeout(500);
const bannerHorario = await page.getByText(/06:00 a 19:00/).count();
const bannerTupahue = await page.getByText(/Tupahue no se puede acceder desde las 13:30/).count();
console.log("Banner abierto con horario:", bannerHorario > 0, "· Tupahue:", bannerTupahue > 0);
await page.screenshot({ path: `${OUT}/diag-v2-idle-banner.png`, fullPage: true });
console.log("OK -> diag-v2-idle-banner.png");
// Cerrar banner
await page.getByRole("button", { name: "Colapsar banner de avisos" }).click();
await page.waitForTimeout(300);

// 2) Caja en idle: visible y abierta
console.log("Summary caja (idle):", await page.getByText("Estadísticas y bitácora").count() > 0);

// 3) Iniciar ride y probar toggle de la caja en marcha
await page.getByRole("button", { name: /iniciar ride/i }).click({ timeout: 10000 });
await page.waitForTimeout(6000);
const avisosRunning = await page.getByRole("button", { name: /avisos y restricciones/i }).count();
console.log("Icono avisos visible (en marcha):", avisosRunning);

// Abrir caja colapsada en marcha
await page.getByText("Estadísticas y bitácora").first().click();
await page.waitForTimeout(400);
// Cambiar a pestaña Bitácora
await page.getByRole("tab", { name: /Bitácora/ }).click();
await page.waitForTimeout(3500); // esperar varios re-renders (ticks de velocidad)
const tabBitacora = await page.getByRole("tab", { name: /Bitácora/ });
console.log("Tab Bitácora sigue seleccionada tras re-renders:", await tabBitacora.getAttribute("aria-selected"));
const cajaAbierta = await page.getByText(/Sin eventos aún|Eventos del viaje/).count();
console.log("Contenido bitácora visible tras re-renders:", cajaAbierta > 0);
await page.screenshot({ path: `${OUT}/diag-v2-running-caja.png`, fullPage: true });
console.log("OK -> diag-v2-running-caja.png");

// 4) Abrir banner en marcha
await page.getByRole("button", { name: /avisos y restricciones/i }).click();
await page.waitForTimeout(400);
console.log("Banner abre en marcha:", await page.getByText(/06:00 a 19:00|Anochece|06:00/).count() > 0);
await page.screenshot({ path: `${OUT}/diag-v2-running-banner.png`, fullPage: true });
console.log("OK -> diag-v2-running-banner.png");

await browser.close();
console.log("DIAG_V2_LISTO");
