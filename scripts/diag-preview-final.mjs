// Verificación final: 9 rutas en el mapa general + minimapa limpio
import { chromium } from "playwright";

const BASE = "http://localhost:3000/";
const OUT = "/tmp/render";

const RUTAS = [
  "Ruta 1 · Clásica Cumbre por Pedro de Valdivia",
  "Ruta 2 · Clásica Cumbre por Pío Nono",
  "Ruta 3 · Travesía Zapadores - Pedro de Valdivia",
  "Ruta 4 · Circuito La Pirámide - Anfiteatro",
  "Ruta 5 · Vuelta Completa (4 accesos)",
  "MTB 1 · Loop Los Gemelos",
  "MTB 2 · Loop Técnico La S",
  "MTB 3 · Travesía Paseo Metropolitano",
  "MTB 4 · Enduro Torre 5 - PdV Norte",
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", (m) => {
    if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 160));
  });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);

  // 1. Minimapa (Pantalla ride): opciones exactas
  const mini = page.locator("select").first();
  const opciones = await mini.locator("option").allTextContents();
  console.log("[minimapa]", JSON.stringify(opciones));
  await page.screenshot({ path: `${OUT}/final-ride.png` });

  // 2. Abrir mapa general vía "Revisa el listado completo"
  await mini.selectOption("listado");
  await page.waitForTimeout(2500);

  // 3. Abrir el <details> de Rutas
  const detRutas = page.locator("details", { hasText: "Trazados de pavimento y circuitos MTB" }).first();
  await detRutas.locator("summary").click();
  await page.waitForTimeout(600);

  const texto = await page.locator("body").innerText();
  let ok = 0;
  for (const r of RUTAS) {
    const found = texto.includes(r.split(" · ")[1].split(" (")[0].slice(0, 18));
    if (found) ok++;
    console.log(`[ruta] ${found ? "OK " : "FALTA"} ${r}`);
  }
  console.log(`[rutas] ${ok}/9 visibles`);

  // contador de "dibujadas"/items del encabezado
  const itemsTag = await detRutas.locator("summary").innerText();
  console.log("[summary rutas]", itemsTag.replace(/\s+/g, " ").slice(0, 120));

  // 4. Dibujar la Ruta 5 (la nueva) sobre el mapa
  const filaR5 = detRutas.locator("li", { hasText: "Vuelta Completa" }).first();
  await filaR5.locator("button[aria-label*='Encuadrar']").click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/final-mapa-rutas.png` });

  await browser.close();
  console.log("OK diag final");
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
