// Verificación puntos 4 y 8 del brief: banner de avisos colapsable
// y caja-filtro de estadísticas + bitácora en la pantalla ride.
// El reloj se fija a las 20:00 de Santiago para que estadoParque()
// entregue el aviso de luces (icono de avisos siempre visible).
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/download";

// Hoy 20:00 en hora de Santiago (verano = UTC-3)
const fixed = new Date();
const hoySantiago = new Date(fixed.toLocaleString("en-US", { timeZone: "America/Santiago" }));
const objetivo = new Date(hoySantiago);
objetivo.setHours(20, 0, 0, 0);
const fixedUTC = new Date(
  objetivo.getTime() + (fixed.getTime() - hoySantiago.getTime()),
);

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.clock.setFixedTime(fixedUTC);
  const page = await ctx.newPage();

  // 1. Detenido: caja abierta en pestaña Estadísticas + fila superior
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/v183-caja-stats.png` });
  console.log("OK -> v183-caja-stats.png");

  // 2. Pestaña Bitácora de la caja-filtro
  await page.getByRole("tab", { name: /bitácora/i }).click({ timeout: 15000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/v183-caja-bitacora.png` });
  console.log("OK -> v183-caja-bitacora.png");

  // 3. Banner de avisos expandido (icono junto al estado GPS)
  await page.getByRole("button", { name: /avisos y restricciones/i }).click({ timeout: 15000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/v183-banner-avisos.png` });
  console.log("OK -> v183-banner-avisos.png");

  // 4. En marcha: banner colapsado a icono, caja colapsada
  await page.getByRole("button", { name: /avisos y restricciones/i }).click({ timeout: 15000 });
  await page.getByRole("button", { name: /iniciar ride/i }).click({ timeout: 15000 });
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `${OUT}/v183-marcha.png` });
  console.log("OK -> v183-marcha.png");

  await browser.close();
}

main().catch((e) => {
  console.error("FALLO:", e.message);
  process.exit(1);
});
