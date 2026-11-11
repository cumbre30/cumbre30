// Verificación visual de la actualización Parquemet:
//   1. Banner de avisos con horario 20:30, accesos autorizados y Pedalea Seguro
//   2. Mapa (Explorar) con los 4 accesos ciclistas marcados
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

// 1) Abrir el banner de avisos (icono triangular de la fila superior)
await page.getByRole("button", { name: /avisos y restricciones/i }).click();
await page.waitForTimeout(600);
const banner = page.getByRole("region", { name: "Avisos y restricciones del parque" });
console.log("Banner abierto:", await banner.isVisible());

const textoBanner = (await banner.innerText()).replace(/\n/g, " | ");
console.log("--- Texto del banner ---");
console.log(textoBanner);
console.log("--- Chequeos ---");
const tiene = (s) => textoBanner.includes(s);
console.log("Horario 20:30:", tiene("06:00 a 20:30"));
console.log("Accesos autorizados:", tiene("Ingresa en bici solo por") && tiene("Zapadores, Pedro de Valdivia Norte, Pío Nono y La Pirámide"));
console.log("Excluye resto de accesos:", tiene("Los demás accesos no habilitan"));
console.log("Pedalea Seguro:", tiene("Pedalea Seguro (desde dic 2026)") && tiene("Carabineros"));
console.log("QR enduro 15/12:", tiene("15/12") && tiene("marcha blanca desde el 01/12"));
console.log("Tupahue FDS/festivos:", tiene("Fines de semana y festivos"));
// Hoy es miércoles: la restricción activa NO debe aparecer como aviso del día
console.log("Miércoles: sin restricción activa (fallback informativo solo):", !textoBanner.includes("no se puede acceder desde las 13:30"));

await page.screenshot({ path: `${OUT}/parquemet-banner.png` });
console.log("OK -> parquemet-banner.png");

// 2) Cerrar banner y navegar a Explorar para ver los accesos en el mapa
await page.getByRole("button", { name: "Colapsar banner de avisos" }).click();
await page.getByRole("link", { name: /Explorar/i }).click().catch(async () => {
  await page.getByText("Explorar", { exact: true }).first().click();
});
await page.waitForTimeout(2500);
const mapaVisible = await page.locator(".leaflet-container").first().isVisible();
console.log("Mapa Explorar visible:", mapaVisible);
await page.screenshot({ path: `${OUT}/parquemet-mapa.png` });
console.log("OK -> parquemet-mapa.png");

await browser.close();
console.log("PARQUEMET_LISTO");
