// E2E: segmentos del cerro en Mis viajes y Estadísticas generales (2026-11-13).
// Nivel gratis: las 2 pantallas deben listar los 9 segmentos (4 subidas +
// 3 bajadas del control 30 + 2 enduro) con candado, y los textos nuevos
// deben mencionar las bajadas del control 30 km/h.
import { chromium } from "playwright";

const BASE = "http://localhost:3000/";
const OUT = "/tmp/render";

const SUBIDAS = [
  "Pío Nono → Plaza México",
  "Pedro de Valdivia Norte → Plaza México",
  "Antilén → Plaza México",
  "La Pirámide → Plaza México",
];
const BAJADAS30 = [
  "Bajada 30 · Plaza México → Pío Nono",
  "Bajada 30 · Antilén → Pedro de Valdivia",
  "Bajada 30 · Chacarillas → La Pirámide",
];
const ENDURO = ["Zorro Vidal · bajada", "Mapuche · bajada"];
const TODOS = [...SUBIDAS, ...BAJADAS30, ...ENDURO];

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const p = await ctx.newPage();
  p.on("console", (m) => {
    if (m.type() === "error") console.log("[consola]", m.text().slice(0, 160));
  });
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForTimeout(3500);

  const abrirStats = async () => {
    await p.locator("button[aria-label='Abrir menú']").click();
    await p.waitForTimeout(600);
    await p.getByRole("button", { name: "Estadísticas generales" }).click();
    await p.waitForTimeout(1200);
  };

  // ---- Estadísticas generales → subsección Pro ----
  // (en nivel gratis, la lista completa de segmentos vive aquí)
  await abrirStats();
  const chips = p.locator("div[role='tablist'][aria-label='Subsecciones de Estadísticas generales'] button[role='tab']");
  await chips.filter({ hasText: /Pro/i }).first().click();
  await p.waitForTimeout(900);
  const bodyStats = await p.locator("section[aria-label*='Estadísticas']").innerText();
  let faltan = TODOS.filter((n) => !bodyStats.includes(n));
  console.log(faltan.length === 0 ? `✓ Estadísticas Pro: los 9 segmentos listados` : `✗ Estadísticas Pro faltan: ${faltan.join(" | ")}`);
  const okConPro = /Con PRO/.test(bodyStats);
  console.log(okConPro ? "✓ Estadísticas Pro: botón «Con PRO» presente (lista bloqueada)" : "✗ falta el botón Con PRO");
  await p.screenshot({ path: `${OUT}/seg-stats.png` });

  // ---- Mis viajes → subsección Pro ----
  // (en nivel gratis, el teaser con los nombres por segmento)
  await p.locator("button[aria-label='Abrir menú']").click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "Mis viajes" }).click();
  await p.waitForTimeout(1200);
  const chipsH = p.locator("div[role='tablist'][aria-label='Subsecciones de Mis viajes'] button[role='tab']");
  await chipsH.filter({ hasText: /Pro/i }).first().click();
  await p.waitForTimeout(900);
  const bodyHist = await p.locator("section[aria-label*='viajes'], section[aria-label*='Viajes']").first().innerText();
  const nombresHist = ["Pío Nono", "Pedro de Valdivia Norte", "Antilén", "La Pirámide",
    "Plaza México → Pío Nono", "Antilén → Pedro de Valdivia", "Chacarillas → La Pirámide"];
  faltan = nombresHist.filter((n) => !bodyHist.includes(n));
  console.log(faltan.length === 0 ? `✓ Mis viajes Pro: teaser con las 4 subidas y las 3 bajadas 30` : `✗ Mis viajes Pro faltan: ${faltan.join(" | ")}`);
  const okTextoHist = /bajadas del control 30/.test(bodyHist);
  console.log(okTextoHist ? "✓ texto gratis de Mis viajes menciona las bajadas del control 30" : "✗ texto de Mis viajes sin las bajadas 30");
  await p.screenshot({ path: `${OUT}/seg-historial.png` });

  const fallos = (faltan.length ? 1 : 0) + (okConPro ? 0 : 1) + (okTextoHist ? 0 : 1);
  console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLAS`);
  await browser.close();
  process.exit(fallos === 0 ? 0 : 1);
}

main();
