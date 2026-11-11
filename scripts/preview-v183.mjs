// Capturas de verificación v1.8.3: velocímetro aguja (4 estilos) y SOS ampliado
import { chromium } from "playwright";

const BASE = "http://localhost:3100";
const OUT = "/home/z/my-project/download";

// Cada combinación usa el ride corriendo en modo Demo para ver la aguja en movimiento
async function withTheme(page, theme) {
  await page.addInitScript((t) => {
    localStorage.setItem("cumbre30-ridetheme-v1", JSON.stringify(t));
  }, theme);
}

async function rideShot(browser, name, { theme = null } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  if (theme) await withTheme(page, theme);
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /iniciar ride/i }).click({ timeout: 15000 });
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `${OUT}/v183-${name}.png` });
  console.log(`OK -> v183-${name}.png`);
  await page.close();
}

async function sosShot(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /abrir tarjeta de emergencia/i }).click({ timeout: 15000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/v183-sos.png` });
  console.log("OK -> v183-sos.png");
  await page.close();
}

async function configShot(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: /abrir menú/i }).click({ timeout: 15000 });
  await page.getByRole("button", { name: /configuración/i }).click({ timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/v183-config-aguja.png`, fullPage: true });
  console.log("OK -> v183-config-aguja.png");
  await page.close();
}

const browser = await chromium.launch();
await rideShot(browser, "aguja-normal", { theme: { color: "cerro", speedoStyle: "aguja", speedoSize: "normal", minimapSize: "normal" } });
await rideShot(browser, "aguja-gigante-grafito", { theme: { color: "grafito", speedoStyle: "aguja", speedoSize: "gigante", minimapSize: "grande" } });
await sosShot(browser);
await configShot(browser);
await browser.close();
