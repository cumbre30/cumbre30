// Verificación ajuste de espacio: caja-filtro justo debajo de distancia/tiempo
// + holgura final para que el último contenido no quede tapado por el botón flotante.
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/render";
mkdirSync(OUT, { recursive: true });

const CACHE = { tempC: 21.4, code: 1, t: Date.now() - 5 * 60000 };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript((c) => localStorage.setItem("cumbre30-clima-v1", JSON.stringify(c)), CACHE);
await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3500);

// Grid distancia/tiempo (contiene "Distancia" y "Tiempo")
const grid = page.locator("div.grid.grid-cols-2", { hasText: "Distancia" }).first();
// Caja-filtro (details con "Estadísticas y bitácora")
const caja = page.locator("details", { hasText: "Estadísticas y bitácora" }).first();
// Botón flotante Iniciar ride
const btn = page.getByRole("button", { name: /Iniciar ride/i });

const box = async (loc) => await loc.boundingBox();
const gB = await box(grid);
const cB = await box(caja);
const bB = await box(btn);

const gap = cB.y - (gB.y + gB.height);
console.log("Grid cards  bottom:", (gB.y + gB.height).toFixed(1));
console.log("Caja top         :", cB.y.toFixed(1));
console.log("GAP cards→caja   :", gap.toFixed(1), "px (esperado ≈12px gap-3)");
console.log("Caja pegada (gap ≤ 16px):", gap <= 16);
console.log("Botón flotante top:", bB.y.toFixed(1), "(fixed abajo)");

await page.screenshot({ path: `${OUT}/gap-idle-top.png` });
console.log("OK -> gap-idle-top.png");

// Scroll al fondo: el borde inferior de la caja debe quedar por encima del botón
await page.mouse.wheel(0, 5000);
await page.waitForTimeout(800);
const cB2 = await box(caja);
const bB2 = await box(btn);
const cajaBottom = cB2.y + cB2.height;
console.log("--- Tras scroll al fondo ---");
console.log("Caja bottom :", cajaBottom.toFixed(1));
console.log("Botón top   :", bB2.y.toFixed(1));
console.log("Último contenido despejado del botón (cajaBottom ≤ botónTop):", cajaBottom <= bB2.y);
await page.screenshot({ path: `${OUT}/gap-idle-bottom.png` });
console.log("OK -> gap-idle-bottom.png");

// En marcha: botones Pausar/Finalizar flotantes siguen abajo
await page.mouse.wheel(0, -5000);
await page.waitForTimeout(400);
await btn.click({ timeout: 15000 });
await page.waitForTimeout(5000);
const pausaVisible = await page.getByRole("button", { name: /Pausar/i }).isVisible();
const cajaColapsadaVisible = await page.getByText("Estadísticas y bitácora").first().isVisible();
console.log("--- En marcha ---");
console.log("Pausar visible:", pausaVisible, "· caja (resumen) visible:", cajaColapsadaVisible);
await page.screenshot({ path: `${OUT}/gap-running.png` });
console.log("OK -> gap-running.png");

await browser.close();
console.log("GAP_LISTO");
