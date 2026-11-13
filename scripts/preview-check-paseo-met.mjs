// E2E · Capa «Paseo Metropolitano» (cliente 2026-11-13)
// Verifica: menú con 8 tramos, filas con nombre/largo, polilíneas teal
// dibujadas en el mapa (uso mixto), encuadre de un tramo, sin pageerror.
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/render";
mkdirSync(OUT, { recursive: true });

const t0 = Date.now();
const paso = (m) => console.log(`[t=${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const FASE = Number(process.env.FASE || "3");
console.log("FASE", FASE);

const browser = await chromium.launch();
try {
  await flujo(browser);
} finally {
  await browser.close().catch(() => {});
}
process.exit(0);

async function flujo(browser) {
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(12000);
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));

paso("goto");
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector('select[aria-label="Ir a"]', { timeout: 120000 });
await page.waitForTimeout(2500);
paso("landing lista");

// Mapa general: Ride → minimapa → "Revisa el listado completo"
await page.selectOption('select[aria-label="Ir a"]', { label: "🗺 Revisa el listado completo" });
await page.waitForTimeout(2500);
paso("mapa general");

// 1) El menú de la nueva capa existe, con badge 8
const det = page.locator('details[data-capa="paseo-met"]');
const n = await det.count();
if (n !== 1) throw new Error(`FALTA menú paseo-met (n=${n})`);
const summaryTxt = await det.locator("summary").innerText();
console.log("[menu]", summaryTxt.replace(/\n/g, " | "));
if (!summaryTxt.includes("8")) throw new Error("badge de items ≠ 8");

// 2) Abrir y validar las filas de los 8 tramos
await det.locator("summary").click();
await page.waitForTimeout(400);
paso("menú abierto");
const filas = await det.locator("li").allInnerTexts();
console.log("[filas]", filas.length);
for (const esperado of [
  "Tramo Parque Bicentenario de la Infancia",
  "Sendero de los Sentidos",
  "Sendero Bellavista",
  "Sendero Pedro de Valdivia Norte",
  "Tramo Pedro de Valdivia Norte",
  "Tramo Jardín Japonés / Pirámide",
  "Conector El Ermitaño – La Cascada",
  "Sendero La Cascada",
]) {
  if (!filas.some((f) => f.includes(esperado))) throw new Error(`FALTA fila: ${esperado}`);
}
console.log("[filas OK] 8 tramos presentes");
const detTxt = (await det.innerText()).includes("peatones + ciclistas") ? "OK" : "FALTA";
console.log("[uso mixto en detalle]", detTxt);

// 3) La capa viene activada por defecto → polilíneas teal (#0d9488) en el mapa
const tealPaths = () => page.evaluate(() => {
  const paths = [...document.querySelectorAll(".leaflet-overlay-pane path")];
  return paths.filter((p) => (p.getAttribute("stroke") || "").toLowerCase().includes("0d9488")).length;
});
const teal = await tealPaths();
console.log("[polilineas teal]", teal);
if (teal < 8) throw new Error(`polilíneas teal=${teal}, esperado ≥ 8`);
paso("polilíneas teal OK");

// 4) Ocultar/mostrar el switch funciona (FASE ≥ 2)
if (FASE >= 2) {
  await page.locator('button[data-vercapa="paseo-met"]').click();
  await page.waitForTimeout(600);
  const tealOff = await tealPaths();
  await page.locator('button[data-vercapa="paseo-met"]').click();
  await page.waitForTimeout(600);
  console.log("[switch off]", tealOff === 0 ? "OK (0 teal)" : `FALLO (${tealOff} teal)`);
  paso("switch verificado");

  // captura del panel con el menú abierto
  await page.screenshot({ path: `${OUT}/paseo-panel.png` });

  // 5) Encuadrar el tramo JJ/Pirámide con el botón del ojo
  // (aria-label exacto: el detalle de otro tramo menciona este nombre)
  await page.locator('button[aria-label="Encuadrar Tramo Jardín Japonés / Pirámide"]').click();
  await page.waitForTimeout(1800);
  paso("encuadre JJ hecho");
  await page.screenshot({ path: `${OUT}/paseo-encuadre-jj.png` });
}

// 6) Vista general con todas las capas base activadas + paseo-met (FASE 3)
if (FASE >= 3) {
  for (const id of ["accesos", "senderos", "pois", "normativa", "urbana"]) {
    const d = page.locator(`details[data-capa="${id}"]`);
    if ((await d.count()) && (await d.getAttribute("open")) === null) {
      await d.locator("summary").click();
      await page.waitForTimeout(250);
    }
    const sw = page.locator(`button[data-vercapa="${id}"]`);
    if (await sw.count()) await sw.click().catch(() => {});
    await page.waitForTimeout(250);
  }
  paso("capas base activadas");
  const menos = page.locator(".leaflet-control-zoom-out");
  for (let i = 0; i < 3; i++) {
    await menos.click().catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    document.querySelector(".leaflet-container")?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/paseo-mapa-general.png` });
}

await browser.close().catch(() => {});
if (errores.length) throw new Error("pageerror: " + errores.join(" || "));
console.log("E2E_PASEO_OK");
}
