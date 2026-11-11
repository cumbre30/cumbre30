// Verificación layout v2: clima+modo arriba, minimapa sobre velocímetro, botón fijo abajo
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

const y = async (locator) => (await locator.boundingBox())?.y ?? null;
const climaY = await y(page.locator('div[role="status"][aria-label^="Clima en el parque"]'));
const modoY = await y(page.locator("span[role='status'][aria-live='polite']").first());
const sosY = await y(page.getByRole("button", { name: "Abrir tarjeta de emergencia" }));
const mapaY = await y(page.locator("canvas, .leaflet-container").first());
const distY = await y(page.getByText("Distancia").first());
const btnY = await y(page.getByRole("button", { name: /Iniciar ride/i }));
console.log("Y clima:", climaY, "· modo:", modoY, "· SOS:", sosY, "· mapa:", mapaY, "· distancia:", distY, "· botón:", btnY);
console.log("Orden correcto (clima<modo<SOS<mapa<distancia):", climaY < modoY && modoY < sosY && sosY < mapaY && mapaY < distY);
console.log("Botón fijo abajo (viewport 844, y > 650):", btnY > 650);

// Scroll al fondo: el botón debe seguir visible y el contenido completo alcanzable
await page.mouse.wheel(0, 4000);
await page.waitForTimeout(800);
const btnVisible = await page.getByRole("button", { name: /Iniciar ride/i }).isVisible();
const cajaEnPantalla = await page.getByText("Estadísticas y bitácora").first().isVisible();
console.log("Tras scroll al fondo - botón visible:", btnVisible, "· caja alcanzable:", cajaEnPantalla);
await page.screenshot({ path: `${OUT}/layout-idle-scroll.png`, fullPage: false });
console.log("OK -> layout-idle-scroll.png");

// Volver arriba y capturar estado inicial
await page.mouse.wheel(0, -4000);
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/layout-idle-top.png`, fullPage: false });
console.log("OK -> layout-idle-top.png");

// En marcha: botones Pausar/Finalizar flotantes
await page.getByRole("button", { name: /Iniciar ride/i }).click({ timeout: 15000 });
await page.waitForTimeout(5000);
const pausaY = await y(page.getByRole("button", { name: /Pausar/i }));
console.log("Pausar visible (en marcha):", await page.getByRole("button", { name: /Pausar/i }).isVisible(), "· y:", pausaY);
await page.screenshot({ path: `${OUT}/layout-running.png`, fullPage: false });
console.log("OK -> layout-running.png");

await browser.close();
console.log("LAYOUT_LISTO");
