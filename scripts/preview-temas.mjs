// Capturas de verificación: temas Pro, velocímetros y píldora de modo
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/download";

const THEMES = {
  andes: { color: "andes", speedoStyle: "arco", speedoSize: "grande", minimapSize: "grande" },
  lila: { color: "lila", speedoStyle: "dial", speedoSize: "gigante", minimapSize: "normal" },
  atardecer: { color: "atardecer", speedoStyle: "digital", speedoSize: "gigante", minimapSize: "compacto" },
};

async function withTheme(page, theme) {
  await page.addInitScript((t) => {
    localStorage.setItem("cumbre30-ridetheme-v1", JSON.stringify(t));
  }, theme);
}

async function shot(browser, name, { theme = null, full = false, runSim = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  if (theme) await withTheme(page, theme);
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  if (runSim) {
    await page.getByRole("button", { name: /iniciar ride/i }).click({ timeout: 15000 });
    await page.waitForTimeout(6000);
  }
  await page.screenshot({ path: `${OUT}/preview-${name}.png`, fullPage: full });
  console.log(`OK -> preview-${name}.png`);
  await page.close();
}

const browser = await chromium.launch();
await shot(browser, "ride-default"); // tema cerro, digital normal, píldora MODO LIBRE
await shot(browser, "ride-andes-arco", { theme: THEMES.andes });
await shot(browser, "ride-lila-dial", { theme: THEMES.lila });
await shot(browser, "ride-atardecer-digital", { theme: THEMES.atardecer });
await shot(browser, "ride-corriendo-parque", { runSim: true });

// Configuración: tarjeta Temas y pantalla ride
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: /abrir menú/i }).click({ timeout: 15000 });
  await page.getByRole("button", { name: /configuración/i }).click({ timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/preview-config-temas.png`, fullPage: true });
  console.log("OK -> preview-config-temas.png");
  await page.close();
}
await browser.close();
