// E2E smoke · lote cliente 2026-11-13 (tarde):
//   · Estadísticas: 6 KPI con texto centrado + 7 segmentos Pro (sin
//     los personales Zorro Vidal / Mapuche).
//   · Desafíos y recompensas: la pestaña renderiza (sin sesión muestra
//     la tarjeta de acceso; la Serie Metropolitana vive en pins.ts,
//     validada aparte en scripts/valida-lote-cliente-nov13.ts).
//   · Sin pageerror en toda la sesión.
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/download";
mkdirSync(OUT, { recursive: true });

const t0 = Date.now();
const paso = (m) => console.log(`[t=${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);

const browser = await chromium.launch();
const errores = [];
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => errores.push(String(e)));
try {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('select[aria-label="Ir a"]', { timeout: 120000 });
  await page.waitForTimeout(2000);
  paso("landing lista");

  // 1) Estadísticas generales (General): 6 KPI centrados
  await page.click('button[aria-label="Abrir menú"]');
  await page.waitForTimeout(600);
  await page.locator("text=Estadísticas generales").last().click();
  await page.waitForTimeout(1200);
  paso("stats abiertas");
  const kpis = await page.locator(".grid.grid-cols-2 .justify-center").count();
  console.log("[kpi centrados]", kpis);
  if (kpis < 6) throw new Error(`KPI centrados insuficientes: ${kpis}`);
  await page.screenshot({ path: `${OUT}/estadisticas-kpi-centrado.png` });

  // 2) Pestaña Pro: 7 tarjetas de segmento (4 subidas + 3 bajadas 30)
  await page.locator("button", { hasText: /^Pro/ }).first().click();
  await page.waitForTimeout(900);
  paso("subtab Pro");
  const segCards = await page.locator("text=🏁").count();
  console.log("[segmentos Pro]", segCards);
  if (segCards !== 7) throw new Error(`segmentos ≠ 7: ${segCards}`);
  const texto = await page.locator("main").innerText();
  if (texto.includes("Zorro Vidal · bajada") || texto.includes("Mapuche · bajada")) {
    throw new Error("los segmentos personales siguen en la UI");
  }
  console.log("[sin personales] OK");
  await page.screenshot({ path: `${OUT}/estadisticas-pro-segmentos.png` });

  // 3) Desafíos y recompensas: renderiza (sin sesión)
  await page.click('button[aria-label="Abrir menú"]');
  await page.waitForTimeout(600);
  await page.locator("text=Desafíos y recompensas").last().click();
  await page.waitForTimeout(1200);
  paso("desafíos");
  const body = await page.locator("main").innerText();
  if (!body.includes("Desafíos y recompensas")) throw new Error("pestaña desafíos no renderiza");
  console.log("[desafíos] render OK");
  await page.screenshot({ path: `${OUT}/desafios-acceso.png` });

  if (errores.length) throw new Error(`pageerror: ${errores.join(" | ")}`);
  console.log("E2E_STATS_OK");
} finally {
  await browser.close().catch(() => {});
}
process.exit(0);
